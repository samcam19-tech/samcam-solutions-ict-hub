// ../assets/js/learner-promotion.js
(function () {
  const PROMOTION_MAPS = {
    all: {
      S1: "S2",
      S2: "S3",
      S3: "S4",
      S4: "Graduated O-Level", // Adjust or omit if S4 is handled separately
      S5: "S6",
      S6: "Graduated A-Level"  // Adjust or omit if S6 is handled separately
    },
    olevel: {
      S1: "S2",
      S2: "S3",
      S3: "S4",
      S4: "Graduated O-Level"
    },
    alevel: {
      S5: "S6",
      S6: "Graduated A-Level"
    }
  };

  function getFirestoreDb() {
    if (window.db && typeof window.db.collection === "function") return window.db;
    if (typeof firebase !== "undefined" && firebase.apps && firebase.apps.length) {
      return firebase.firestore();
    }
    throw new Error("Firestore SDK is not initialized. Check firebase-config.js.");
  }

  function syncSchoolDropdown(promoteSelect) {
    const sourceSelect = document.getElementById("targetSchoolSelect");
    if (!sourceSelect || !promoteSelect) return;

    const existingValues = new Set(
      Array.from(promoteSelect.options).map((opt) => opt.value)
    );

    Array.from(sourceSelect.options).forEach((opt) => {
      if (opt.value && !existingValues.has(opt.value)) {
        const cloned = document.createElement("option");
        cloned.value = opt.value;
        cloned.textContent = `${opt.textContent} (${opt.value})`;
        promoteSelect.appendChild(cloned);
      }
    });
  }

  async function promoteLearners({ schoolId = "", mode = "all" } = {}) {
    const db = getFirestoreDb();
    const map = PROMOTION_MAPS[mode] || PROMOTION_MAPS.all;

    let queryRef = db.collection("users").where("role", "==", "Student");
    if (schoolId) {
      queryRef = queryRef.where("schoolId", "==", schoolId);
    }

    const snapshot = await queryRef.get();
    if (snapshot.empty) {
      return { promotedCount: 0, totalScanned: 0 };
    }

    const promotableDocs = snapshot.docs.filter((doc) => {
      const currentClass = (doc.data().class || "").trim();
      return Boolean(currentClass && map[currentClass]);
    });

    const batchSize = 500;
    for (let i = 0; i < promotableDocs.length; i += batchSize) {
      const batch = db.batch();
      const chunk = promotableDocs.slice(i, i + batchSize);

      chunk.forEach((doc) => {
        const currentClass = doc.data().class.trim();
        const nextClass = map[currentClass];

        batch.update(doc.ref, {
          class: nextClass,
          previousClass: currentClass,
          promotedAt: new Date().toISOString()
        });
      });

      await batch.commit();
    }

    return {
      promotedCount: promotableDocs.length,
      totalScanned: snapshot.size
    };
  }

  function initLearnerPromotion() {
    const promoteBtn = document.getElementById("executePromotionBtn");
    const schoolSelect = document.getElementById("promoteSchoolSelect");
    const modeSelect = document.getElementById("promoteTrackMode");
    const statusLog = document.getElementById("promotionStatusLog");

    if (!promoteBtn) {
      console.warn("[LearnerPromotion] Button #executePromotionBtn not found.");
      return;
    }

    if (promoteBtn.dataset.promotionBound === "true") return;
    promoteBtn.dataset.promotionBound = "true";

    syncSchoolDropdown(schoolSelect);
    const targetSchoolSelect = document.getElementById("targetSchoolSelect");
    if (targetSchoolSelect) {
      const observer = new MutationObserver(() => syncSchoolDropdown(schoolSelect));
      observer.observe(targetSchoolSelect, { childList: true });
    }

    promoteBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      console.log("[LearnerPromotion] Promote button clicked.");

      const selectedSchool = schoolSelect ? schoolSelect.value.trim() : "";
      const selectedMode = modeSelect ? modeSelect.value : "all";
      const scopeLabel = selectedSchool ? `school "${selectedSchool}"` : "all schools";

      const approved = window.confirm(
        `Promote matching Students (${selectedMode.toUpperCase()}) for ${scopeLabel}? This updates "class" and records "previousClass".`
      );
      if (!approved) {
        if (statusLog) statusLog.textContent = "Promotion cancelled.";
        return;
      }

      promoteBtn.disabled = true;
      const originalHtml = promoteBtn.innerHTML;
      promoteBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="margin-right: 6px;"></i> Promoting...`;

      if (statusLog) {
        statusLog.style.color = "#0284c7";
        statusLog.textContent = `Running promotion (${selectedMode}) for ${scopeLabel}...`;
      }

      try {
        const { promotedCount, totalScanned } = await promoteLearners({
          schoolId: selectedSchool,
          mode: selectedMode
        });

        const msg = `Completed: Promoted ${promotedCount} of ${totalScanned} student record(s) for ${scopeLabel}.`;
        if (statusLog) {
          statusLog.style.color = "#16a34a";
          statusLog.textContent = msg;
        }
        window.alert(msg);
      } catch (err) {
        console.error("[LearnerPromotion] Error:", err);
        const errMsg = `Promotion failed: ${err.message}`;
        if (statusLog) {
          statusLog.style.color = "#dc2626";
          statusLog.textContent = errMsg;
        }
        window.alert(errMsg);
      } finally {
        promoteBtn.disabled = false;
        promoteBtn.innerHTML = originalHtml;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLearnerPromotion);
  } else {
    initLearnerPromotion();
  }

  window.LearnerPromotionModule = {
    promoteLearners,
    PROMOTION_MAPS,
    init: initLearnerPromotion
  };
})();
