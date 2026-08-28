document.addEventListener("DOMContentLoaded", () => {
  // Wait slightly to ensure initializeSamcamFirebase has bound window.db
  const checkDbInterval = setInterval(() => {
    if (window.db) {
      clearInterval(checkDbInterval);
      loadRegisteredSchools();
      setupAdminActions();
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

      alert(`Success! School instance "${schoolName}" has been provisioned.`);
      document.getElementById("superSchoolForm").reset();
      loadRegisteredSchools();
    } catch (error) {
      console.error("Error provisioning school:", error);
      alert("Error: Failed to register school instance.");
    }
  });

  // Execute Global Legacy Data Migration Handler
  document.getElementById("executeMigrationBtn").addEventListener("click", async () => {
    const targetSchoolId = document.getElementById("targetSchoolSelect").value;
    
    if (!targetSchoolId) {
      alert("Please select a target school first to map the legacy collections into.");
      return;
    }

    if (!confirm(`Are you sure you want to map all unassigned root data documents to school ID: "${targetSchoolId}"?`)) {
      return;
    }

    const collectionsToMigrate = ['portal_resources', 'quizzes', 'challenges', 'blog_posts'];

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

      alert(`Migration completed successfully! ${totalUpdated} total documents across root collections were successfully linked to ${targetSchoolId}.`);
    } catch (error) {
      console.error("Migration process failed:", error);
      alert("Migration failed. Check browser console for security or structural errors.");
    }
  });
}
