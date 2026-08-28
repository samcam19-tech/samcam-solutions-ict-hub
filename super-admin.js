// Custom Modal Helper Utility
function showCustomModal(title, message, type = "alert", inputPlaceholder = "") {
  return new Promise((resolve) => {
    const modal = document.getElementById("customModal");
    const titleEl = document.getElementById("modalTitle");
    const msgEl = document.getElementById("modalMessage");
    const confirmBtn = document.getElementById("modalConfirmBtn");
    const cancelBtn = document.getElementById("modalCancelBtn");
    const inputContainer = document.getElementById("modalInputContainer");
    const inputField = document.getElementById("modalInput");

    if (!modal) {
      if (type === "confirm") resolve(window.confirm(message));
      else if (type === "prompt") resolve(window.prompt(message));
      else { window.alert(message); resolve(true); }
      return;
    }

    titleEl.innerText = title;
    msgEl.innerText = message;
    inputField.value = "";

    if (type === "confirm") {
      cancelBtn.style.display = "inline-block";
      inputContainer.style.display = "none";
    } else if (type === "prompt") {
      cancelBtn.style.display = "inline-block";
      inputContainer.style.display = "block";
      inputField.placeholder = inputPlaceholder;
      inputField.type = "text";
    } else {
      cancelBtn.style.display = "none";
      inputContainer.style.display = "none";
    }

    modal.style.display = "flex";
    if (type === "prompt") inputField.focus();

    const newConfirm = confirmBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    newConfirm.addEventListener("click", () => {
      modal.style.display = "none";
      resolve(type === "prompt" ? inputField.value : true);
    });

    newCancel.addEventListener("click", () => {
      modal.style.display = "none";
      resolve(type === "prompt" ? null : false);
    });
  });
}

// Complete list of all system collections to ensure full migration
const collectionsToMigrate = [
  'announcements',
  'audit_logs',
  'blog_posts',
  'challenges',
  'e_library_resources',
  'formulaSubmissions',
  'forum_threads',
  'live_classes',
  'notifications',
  'pending_payments',
  'portal_resources',
  'quiz_results',
  'quizzes',
  'submissions',
  'users'
];

// Set your authorized Master Super Admin Firebase UID here (Properly terminated with a semicolon)
const MASTER_ADMIN_UID = "xaQVWdmhd7ST9m6yUHRq7...";

document.addEventListener("DOMContentLoaded", () => {
  // Update collections targeted count display on load
  const collectionsCountEl = document.getElementById("collectionsCount");
  if (collectionsCountEl) {
    collectionsCountEl.innerText = collectionsToMigrate.length;
  }

  // Enforce Firebase Auth UID Security Gate on load
  const checkAuthInterval = setInterval(() => {
    if (window.db && typeof firebase.auth !== 'undefined') {
      clearInterval(checkAuthInterval);
      
      firebase.auth().onAuthStateChanged(async (user) => {
        if (user && user.uid === MASTER_ADMIN_UID) {
          // Authorized Super Admin: Load Portal Interface
          loadRegisteredSchools();
          setupAdminActions();
        } else {
          // Unauthorized or Not Logged In
          document.body.innerHTML = `
            <div style="display:flex;height:100vh;justify-content:center;align-items:center;background:#030712;color:white;font-family:system-ui;text-align:center;padding:20px;">
              <div>
                <h2 style="color:#ef4444;margin-bottom:8px;">Access Denied</h2>
                <p style="color:#94a3b8;margin-bottom:16px;">You must be signed in with the authorized master administrator account to view the Samcam Super Admin portal.</p>
                <a href="index.html" style="color:#3b82f6;text-decoration:none;font-weight:600;">Return to Portal Home</a>
              </div>
            </div>
          `;
        }
      });
    }
  }, 50);
});

// 1. Fetch & Display Schools List + Populate Select Options
async function loadRegisteredSchools() {
  const tableBody = document.querySelector("#schoolsTable tbody");
  const selectDropdown = document.getElementById("targetSchoolSelect");
  
  try {
    const querySnapshot = await window.db.collection("schools").get();
    tableBody.innerHTML = "";
    selectDropdown.innerHTML = `<option value="">-- Choose Target School --</option>`;
    
    document.getElementById("totalSchoolsCount").innerText = querySnapshot.size;

    if (querySnapshot.empty) {
      tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No schools registered yet. Provision your first tenant above.</td></tr>`;
      return;
    }

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const dateStr = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : "Just now";
      
      tableBody.innerHTML += `
        <tr>
          <td><code>${data.schoolId}</code></td>
          <td><strong>${data.schoolName}</strong></td>
          <td>${data.location || "N/A"}</td>
          <td>${dateStr}</td>
        </tr>
      `;

      const option = document.createElement("option");
      option.value = data.schoolId;
      option.textContent = `${data.schoolName} (${data.schoolId})`;
      selectDropdown.appendChild(option);
    });

  } catch (error) {
    console.error("Error loading schools data:", error);
    tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: red;">Failed to fetch tenant data from Firestore. Check console logs.</td></tr>`;
  }
}

// 2. Setup Super Admin Event Listeners
function setupAdminActions() {
  
  // Register New School Form Handler
  document.getElementById("superSchoolForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const schoolId = document.getElementById("newSchoolId").value.trim().toLowerCase().replace(/\s+/g, '_');
    const schoolName = document.getElementById("newSchoolName").value.trim();
    const location = document.getElementById("newSchoolLocation").value.trim();

    try {
      await window.db.collection("schools").doc(schoolId).set({
        schoolId,
        schoolName,
        location,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      await showCustomModal("Success", `School instance "${schoolName}" has been provisioned.`);
      document.getElementById("superSchoolForm").reset();
      loadRegisteredSchools();
    } catch (error) {
      console.error("Error provisioning school:", error);
      await showCustomModal("Error", "Failed to register school instance.");
    }
  });

  // Execute Global Legacy Data Migration Handler
  document.getElementById("executeMigrationBtn").addEventListener("click", async () => {
    const targetSchoolId = document.getElementById("targetSchoolSelect").value;
    
    if (!targetSchoolId) {
      await showCustomModal("Selection Required", "Please select a target school first to map the legacy collections into.");
      return;
    }

    const confirmed = await showCustomModal(
      "Confirm Migration", 
      `Are you sure you want to map all unassigned root data documents across all ${collectionsToMigrate.length} collections to school ID: "${targetSchoolId}"?`, 
      "confirm"
    );

    if (!confirmed) {
      return;
    }

    try {
      let totalUpdated = 0;
      
      for (const colName of collectionsToMigrate) {
        const snapshot = await window.db.collection(colName).get();
        const batch = window.db.batch();

        snapshot.forEach((documentSnap) => {
          const docRef = window.db.collection(colName).doc(documentSnap.id);
          batch.update(docRef, { schoolId: targetSchoolId });
          totalUpdated++;
        });

        await batch.commit();
      }

      await showCustomModal("Migration Complete", `Migration completed successfully! ${totalUpdated} total documents across root collections were successfully linked to ${targetSchoolId}.`);
    } catch (error) {
      console.error("Migration process failed:", error);
      await showCustomModal("Migration Error", "Migration failed. Check browser console for security or structural errors.");
    }
  });
}
