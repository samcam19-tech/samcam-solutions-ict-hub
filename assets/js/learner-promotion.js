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
    if (window.db) return window.db;
    if (typeof firebase !== "undefined" && firebase.apps && firebase.apps.length) {
      return firebase.firestore();
    }
    throw new Error("Firestore SDK is not initialized.");
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

  function confirmPromotion(summaryText) {
    const modal = document.getElementById("customModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalMessage = document.getElementById("modalMessage");
    const confirmBtn = document.getElementById("modalConfirmBtn");
    const cancelBtn = document.getElementById("modalCancelBtn");
    const inputContainer = document.getElementById("modalInputContainer");

    if (!modal || !confirmBtn || !cancelBtn) {
      return Promise.resolve(window.confirm(summaryText));
    }

    return new Promise((resolve) => {
      if (inputContainer) inputContainer.classList.add("modal-hidden");
      if (modalTitle) modalTitle.textContent = "Confirm Learner Promotion";
      if (modalMessage) modalMessage.textContent = summaryText;

      cancelBtn.classList.remove("modal-hidden");
      modal.classList.add("active");

      const cleanup = () => {
        modal.classList.remove("active");
        confirmBtn.removeEventListener("click", onConfirm);
        cancelBtn.removeEventListener("click", onCancel);
      };

      const onConfirm = () => {
        cleanup();
        resolve(true);
      };

      const onCancel = () => {
        cleanup();
        resolve(false);
      };

      confirmBtn.addEventListener("click", onConfirm);
      cancelBtn.addEventListener("click", onCancel);
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

  document.addEventListener("DOMContentLoaded", () => {
    const promoteBtn = document.getElementById("executePromotionBtn");
    const schoolSelect = document.getElementById("promoteSchoolSelect");
    const modeSelect = document.getElementById("promoteTrackMode");
    const statusLog = document.getElementById("promotionStatusLog");

    if (!promoteBtn) return;

    // Populate school options once legacy migration populates #targetSchoolSelect
    syncSchoolDropdown(schoolSelect);
    const targetSchoolSelect = document.getElementById("targetSchoolSelect");
    if (targetSchoolSelect) {
      const observer = new MutationObserver(() => syncSchoolDropdown(schoolSelect));
      observer.observe(targetSchoolSelect, { childList: true });
    }

    promoteBtn.addEventListener("click", async () => {
      const selectedSchool = schoolSelect ? schoolSelect.value.trim() : "";
      const selectedMode = modeSelect ? modeSelect.value : "all";
      const scopeLabel = selectedSchool ? `school "${selectedSchool}"` : "all schools";

      const approved = await confirmPromotion(
        `Promote matching Students (${selectedMode.toUpperCase()}) for ${scopeLabel}? This updates "class" and records "previousClass".`
      );
      if (!approved) return;

      promoteBtn.disabled = true;
      const originalHtml = promoteBtn.innerHTML;
      promoteBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="margin-right: 6px;"></i> Promoting...`;

      if (statusLog) {
        statusLog.textContent = `Running promotion (${selectedMode}) for ${scopeLabel}...`;
      }

      try {
        const { promotedCount, totalScanned } = await promoteLearners({
          schoolId: selectedSchool,
          mode: selectedMode
        });

        const msg = `Completed: Promoted ${promotedCount} of ${totalScanned} student record(s) for ${scopeLabel}.`;
        if (statusLog) statusLog.textContent = msg;
      } catch (err) {
        console.error("Learner promotion error:", err);
        const errMsg = `Promotion failed: ${err.message}`;
        if (statusLog) statusLog.textContent = errMsg;
      } finally {
        promoteBtn.disabled = false;
        promoteBtn.innerHTML = originalHtml;
      }
    });
  });

  // Expose helper globally in case you call it from console or another script
  window.LearnerPromotionModule = {
    promoteLearners,
    PROMOTION_MAPS
  };
})();
