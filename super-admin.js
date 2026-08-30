// Retrieves active super admin session mapped from database cache or profile defaults
function getCurrentUserSession() {
  try {
    const cachedSession = sessionStorage.getItem("samcam_super_session");
    if (cachedSession) {
      const data = JSON.parse(cachedSession);
      return {
        name: data.fullName || "AKUGIZIBWE SAMUEL",
        fullName: data.fullName || "AKUGIZIBWE SAMUEL",
        username: data.username || "samcam",
        email: data.email || "samuelakugizibwe23@gmail.com",
        role: "super_admin"
      };
    }
  } catch (e) {
    console.warn("Failed to retrieve cached super admin session:", e);
  }

  // Fallback session object mapped to database profile defaults
  return {
    name: "AKUGIZIBWE SAMUEL",
    fullName: "AKUGIZIBWE SAMUEL",
    username: "samcam",
    email: "samuelakugizibwe23@gmail.com",
    role: "super_admin"
  };
}

// Custom Modal Helper Utility (Corrected)
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
      cancelBtn.classList.remove("modal-hidden");
      inputContainer.classList.add("modal-hidden");
    } else if (type === "prompt") {
      cancelBtn.classList.remove("modal-hidden");
      inputContainer.classList.remove("modal-hidden"); // Ensures input field is shown
      inputField.placeholder = inputPlaceholder;
      inputField.type = inputPlaceholder.toLowerCase().includes("key") || inputPlaceholder.toLowerCase().includes("password") ? "password" : "text";
    } else {
      cancelBtn.classList.add("modal-hidden");
      inputContainer.classList.add("modal-hidden");
    }

    modal.classList.add("modal-active");
    if (type === "prompt") inputField.focus();

    const newConfirm = confirmBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    newConfirm.addEventListener("click", () => {
      modal.classList.remove("modal-active");
      resolve(type === "prompt" ? inputField.value : true);
    });

    newCancel.addEventListener("click", () => {
      modal.classList.remove("modal-active");
      resolve(type === "prompt" ? null : false);
    });
  });
}

// Excluded collections containing root admin details or infrastructure configs
const EXCLUDED_COLLECTIONS = ['system_config', 'schools'];

document.addEventListener("DOMContentLoaded", () => {
  // Bind Dynamic Database Session to admin profile header
  const adminProfileEl = document.querySelector(".admin-profile");
  if (adminProfileEl) {
    adminProfileEl.classList.add("interactive-admin-profile");
    adminProfileEl.title = "Click to log out of Super Admin session";
    
    const currentAdmin = getCurrentUserSession();
    
    adminProfileEl.innerHTML = `
      <div style="display: flex; flex-direction: column; text-align: right; line-height: 1.2;">
        <span style="font-weight: 600; font-size: 13px; color: #f8fafc;">${currentAdmin.fullName}</span>
        <span style="font-size: 11px; color: #94a3b8;">@${currentAdmin.username}</span>
      </div>
      <span class="logout-badge" title="Logout" style="display: flex; align-items: center; justify-content: center; margin-left: 8px;">
        <svg class="logout-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width: 18px; height: 18px;"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
      </span>
    `;

    adminProfileEl.addEventListener("click", async () => {
      const confirmLogout = await showCustomModal(
        "Sign Out",
        "Are you sure you want to end your active Super Admin session?",
        "confirm"
      );

      if (confirmLogout) {
        sessionStorage.removeItem("samcam_super_auth");
        sessionStorage.removeItem("samcam_super_session");
        await showCustomModal("Logged Out", "Your session has been terminated securely.");
        window.location.reload();
      }
    });
  }

  const checkDbInterval = setInterval(async () => {
    if (window.db) {
      clearInterval(checkDbInterval);
      await enforceFirestoreMasterKeyGate();
    }
  }, 50);
});

// Handles Firestore-backed Super Admin Key setup, authentication gate, and advanced feature hooks
async function enforceFirestoreMasterKeyGate() {
  const configDocRef = window.db.collection("system_config").doc("super_admin_settings");

  try {
    const docSnap = await configDocRef.get();
    let currentMasterKey = "";

    if (!docSnap.exists) {
      let createdKey = "";
      while (!createdKey || createdKey.trim().length < 6) {
        createdKey = await showCustomModal(
          "Initialize Super Admin Key",
          "Create your secure master secret key (at least 6 characters):",
          "prompt",
          "Enter new master key..."
        );

        if (createdKey === null) {
          await showCustomModal("Access Cancelled", "Master key setup is required to proceed.");
          document.body.innerHTML = `<div class="fatal-error-container"><div><h2 class="error-heading">Access Cancelled</h2><p class="error-text">Master key setup is required.</p></div></div>`;
          return;
        }
        if (createdKey.trim().length < 6) {
          await showCustomModal("Invalid Key", "The master key must be at least 6 characters long.");
        }
      }

      await configDocRef.set({
        masterKey: createdKey.trim(),
        maintenanceMode: false,
        systemName: "SAMCAM SOLUTIONS ICT HUB",
        systemSlogan: "Empowering Digital Education",
        systemLogoUrl: "",
        fullName: "AKUGIZIBWE SAMUEL",
        username: "samcam",
        email: "samuelakugizibwe23@gmail.com",
        contact: "0703999089",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      currentMasterKey = createdKey.trim();
      await showCustomModal("Setup Complete", "Master key saved to Firestore successfully!");
    } else {
      const data = docSnap.data();
      currentMasterKey = data.masterKey;

      sessionStorage.setItem("samcam_super_session", JSON.stringify({
        fullName: data.fullName || "AKUGIZIBWE SAMUEL",
        username: data.username || "samcam",
        email: data.email || "samuelakugizibwe23@gmail.com",
        role: "super_admin"
      }));
    }

    const authenticatedKey = sessionStorage.getItem("samcam_super_auth");
    if (authenticatedKey && currentMasterKey && authenticatedKey.trim() === currentMasterKey.trim()) {
      await initializeSuperAdminPortal(configDocRef);
      return;
    }

    let authorized = false;
    while (!authorized) {
      const enteredKey = await showCustomModal(
        "Restricted Master Access",
        "Enter your Super Admin master key to access the control panel:",
        "prompt",
        "Enter master key..."
      );

      if (enteredKey && currentMasterKey && enteredKey.trim() === currentMasterKey.trim()) {
        sessionStorage.setItem("samcam_super_auth", currentMasterKey.trim());
        authorized = true;
      } else if (enteredKey === null) {
        await showCustomModal("Access Denied", "Authentication required to access the dashboard.");
        document.body.innerHTML = `<div class="fatal-error-container"><div><h2 class="error-heading">Access Denied</h2><p class="error-text">Authentication required.</p></div></div>`;
        return;
      } else {
        await showCustomModal("Access Denied", "Incorrect master admin key provided.");
      }
    }

    await initializeSuperAdminPortal(configDocRef);

  } catch (error) {
    console.error("FATAL MASTER KEY GATE ERROR:", error);
    await showCustomModal("Connection Error", "Failed to verify configuration against Firestore.");
  }
}

async function initializeSuperAdminPortal(configDocRef) {
  loadRegisteredSchools();
  setupAdminActions();
  loadMigrationCollectionsCheckboxes();
  
  // Initialize new branding module
  initBrandingSettings(configDocRef);

  initGlobalAnnouncements();
  initTenantSubscriptionManager();
  initCrossTenantSearch();
  initAuditLogsViewer();
  initBackupGenerator();
  initGlobalEResources();
  initTelemetryDashboard();
  initMaintenanceModeToggle(configDocRef);
  initFeatureFlagTogglers();
  initKeyRotator(configDocRef);
}

// Updated Branding Module with Firebase Storage Support
async function initBrandingSettings(configDocRef) {
  const form = document.getElementById("systemBrandingForm");
  const nameInput = document.getElementById("brandingSystemName");
  const sloganInput = document.getElementById("brandingSystemSlogan");
  const logoUrlInput = document.getElementById("brandingSystemLogoUrl");
  const logoFileInput = document.getElementById("brandingSystemLogoFile"); // Optional file input in HTML

  try {
    const docSnap = await configDocRef.get();
    if (docSnap.exists) {
      const data = docSnap.data();
      if (nameInput) nameInput.value = data.systemName || "";
      if (sloganInput) sloganInput.value = data.systemSlogan || "";
      if (logoUrlInput) logoUrlInput.value = data.systemLogoUrl || "";
    }
  } catch (err) {
    console.warn("Failed to load branding configs:", err);
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      let systemLogoUrl = logoUrlInput ? logoUrlInput.value.trim() : "";

      try {
        // If a physical file was chosen, upload it to Firebase Storage first
        if (logoFileInput && logoFileInput.files && logoFileInput.files[0]) {
          const file = logoFileInput.files[0];
          const storageRef = firebase.storage().ref(`system_branding/logo_${Date.now()}_${file.name}`);
          const snapshot = await storageRef.put(file);
          systemLogoUrl = await snapshot.ref.getDownloadURL();
          
          if (logoUrlInput) logoUrlInput.value = systemLogoUrl; // Sync back to input
        }

        const systemName = nameInput ? nameInput.value.trim() : "";
        const systemSlogan = sloganInput ? sloganInput.value.trim() : "";

        await configDocRef.set({
          systemName,
          systemSlogan,
          systemLogoUrl
        }, { merge: true });

        await logAuditAction("UPDATE_BRANDING", `Updated system branding settings: Name="${systemName}"`);
        await showCustomModal("Success", "System branding parameters and logo updated successfully!");
      } catch (error) {
        console.error("Branding update error:", error);
        await showCustomModal("Error", "Failed to save branding configurations or upload logo file.");
      }
    });
  }
}
async function loadRegisteredSchools() {
  const tableBody = document.querySelector("#schoolsTable tbody");
  const selectDropdown = document.getElementById("targetSchoolSelect");
  
  try {
    const querySnapshot = await window.db.collection("schools").get();
    if (tableBody) tableBody.innerHTML = "";
    if (selectDropdown) selectDropdown.innerHTML = `<option value="">-- Choose Target School --</option>`;
    
    const totalSchoolsEl = document.getElementById("totalSchoolsCount");
    if (totalSchoolsEl) totalSchoolsEl.innerText = querySnapshot.size;

    if (querySnapshot.empty) {
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="5" class="table-empty-notice">No schools registered yet.</td></tr>`;
      return;
    }

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const dateStr = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : "Just now";
      const statusBadge = data.status === 'suspended' ? '<span class="status-badge-suspended">Suspended</span>' : '<span class="status-badge-active">Active</span>';
      
      if (tableBody) {
        tableBody.innerHTML += `
          <tr>
            <td><code>${data.schoolId}</code></td>
            <td><strong>${data.schoolName}</strong></td>
            <td>${data.location || "N/A"}</td>
            <td>${statusBadge}</td>
            <td>${dateStr}</td>
          </tr>
        `;
      }

      if (selectDropdown) {
        const option = document.createElement("option");
        option.value = data.schoolId;
        option.textContent = `${data.schoolName} (${data.schoolId})`;
        selectDropdown.appendChild(option);
      }
    });
  } catch (error) {
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="5" class="table-error-notice">Failed to fetch tenant data.</td></tr>`;
  }
}

async function loadMigrationCollectionsCheckboxes() {
  const container = document.getElementById("migrationCollectionsContainer");
  if (!container) return;

  container.innerHTML = `<p style="font-size: 13px; color: #64748b;">Fetching collections dynamically from database...</p>`;

  try {
    // Replace with your actual deployed region and project URL endpoint
    const response = await fetch('https://us-central1-samcam-system.cloudfunctions.net/listCollections');
    const result = await response.json();
    
    if (!result.success) throw new Error(result.error);
    const collectionsList = result.collections || [];

    container.innerHTML = "";
    
    const formatCollectionName = (str) => {
      return str
        .replace(/[_-]+/g, " ")
        .toLowerCase()
        .replace(/(^\w|\s\w)/g, (match) => match.toUpperCase());
    };

   const controlsHtml = `
      <div class="migration-controls-bar">
        <span class="title">Available Collections</span>
        <div class="migration-controls-actions">
          <button type="button" id="selectAllCols" class="migration-action-btn">Select All</button>
          <span style="color: var(--border-subtle);">|</span>
          <button type="button" id="deselectAllCols" class="migration-action-btn">Deselect All</button>
        </div>
      </div>
      <div class="migration-grid-container">
    `;
    
    let checkboxesHtml = controlsHtml;
    let validCount = 0;

    collectionsList.forEach((col) => {
      if (!EXCLUDED_COLLECTIONS.includes(col)) {
        validCount++;
        const displayName = formatCollectionName(col);
        checkboxesHtml += `
          <label class="migration-item-pill">
            <input type="checkbox" class="migration-col-checkbox" value="${col}" checked>
            <span class="label-text">${displayName}</span>
          </label>
        `;
      }
    });

    if (validCount === 0) {
      container.innerHTML = `<p style="color: #64748b; font-size: 12px;">No active collections found in the database.</p>`;
      return;
    }

    checkboxesHtml += `</div>`;
    container.innerHTML = checkboxesHtml;

    document.getElementById("selectAllCols")?.addEventListener("click", () => {
      document.querySelectorAll(".migration-col-checkbox").forEach(cb => cb.checked = true);
    });
    document.getElementById("deselectAllCols")?.addEventListener("click", () => {
      document.querySelectorAll(".migration-col-checkbox").forEach(cb => cb.checked = false);
    });

    const countEl = document.getElementById("collectionsCount");
    if (countEl) countEl.innerText = validCount;

  } catch (err) {
    console.error("Cloud function error:", err);
    container.innerHTML = `<p style="color: #ef4444; font-size: 12px;">Failed to load collections dynamically. Ensure the Cloud Function is deployed.</p>`;
  }
}

function setupAdminActions() {
  const schoolForm = document.getElementById("superSchoolForm");
  if (schoolForm) {
    schoolForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const schoolId = document.getElementById("newSchoolId").value.trim().toLowerCase().replace(/\s+/g, '_');
      const schoolName = document.getElementById("newSchoolName").value.trim();
      const location = document.getElementById("newSchoolLocation").value.trim();

      try {
        await window.db.collection("schools").doc(schoolId).set({
          schoolId,
          schoolName,
          location,
          status: "active",
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await logAuditAction("PROVISION_SCHOOL", `Provisioned new school instance: ${schoolName} (${schoolId})`);
        await showCustomModal("Success", `School instance "${schoolName}" has been provisioned.`);
        schoolForm.reset();
        loadRegisteredSchools();
      } catch (error) {
        await showCustomModal("Error", "Failed to register school instance.");
      }
    });
  }

  const migrationBtn = document.getElementById("executeMigrationBtn");
  if (migrationBtn) {
    migrationBtn.addEventListener("click", async () => {
      const targetSchoolId = document.getElementById("targetSchoolSelect").value;
      
      if (!targetSchoolId) {
        await showCustomModal("Selection Required", "Please select a target school first.");
        return;
      }

      // Collect checked collections
      const selectedCheckboxes = document.querySelectorAll(".migration-col-checkbox:checked");
      const selectedCollections = Array.from(selectedCheckboxes).map(cb => cb.value);

      if (selectedCollections.length === 0) {
        await showCustomModal("Selection Required", "Please select at least one collection to migrate.");
        return;
      }

      const confirmed = await showCustomModal(
        "Confirm Migration", 
        `Are you sure you want to map unassigned documents across the selected (${selectedCollections.length}) collection(s) to school ID: "${targetSchoolId}"?`, 
        "confirm"
      );

      if (!confirmed) return;

      try {
        let totalUpdated = 0;
        for (const colName of selectedCollections) {
          const snapshot = await window.db.collection(colName).get();
          const batch = window.db.batch();

          snapshot.forEach((documentSnap) => {
            const docRef = window.db.collection(colName).doc(documentSnap.id);
            batch.update(docRef, { schoolId: targetSchoolId });
            totalUpdated++;
          });

          await batch.commit();
        }

        await logAuditAction("DATA_MIGRATION", `Migrated ${totalUpdated} documents across collections (${selectedCollections.join(', ')}) to school: ${targetSchoolId}`);
        await showCustomModal("Migration Complete", `Successfully linked ${totalUpdated} total documents to ${targetSchoolId}.`);
      } catch (error) {
        await showCustomModal("Migration Error", "Migration process failed. Check security rules or indices.");
      }
    });
  }
}

async function logAuditAction(actionType, details) {
  try {
    await window.db.collection("audit_logs").add({
      actionType,
      details,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {}
}


// ==========================================
// 10 FULLY FUNCTIONAL SUPER ADMIN FEATURES (LOGIC ONLY)
// ==========================================

// Helper function to verify that the required HTML container exists in super-admin.html
function getFeatureContainer(elementId) {
  const container = document.getElementById(elementId);
  if (!container) {
    console.warn(`Container with ID "${elementId}" was not found in super-admin.html.`);
  }
  return container;
}

// Feature 1: Global Announcement Broadcaster with Management (Edit, Delete & Publish)
function initGlobalAnnouncements() {
  const container = getFeatureContainer("featureAnnouncements");
  if (!container) return;

  const formCard = document.getElementById("announcementFormCard");
  const editingDocIdInput = document.getElementById("editingAnnouncementDocId");
  const titleInput = document.getElementById("globalAnnounceTitle");
  const bodyInput = document.getElementById("globalAnnounceText");
  const prioritySelect = document.getElementById("announcePriority");
  const targetSelect = document.getElementById("announceTarget");
  const formHeading = document.getElementById("announceFormHeading");
  const sendBtn = document.getElementById("sendBroadcastBtn");
  const cancelBtn = document.getElementById("cancelEditBroadcastBtn");
  const listContainer = document.getElementById("activeBroadcastsList");

  // Helper to reset form state
  const resetForm = () => {
    if (editingDocIdInput) editingDocIdInput.value = "";
    if (titleInput) titleInput.value = "";
    if (bodyInput) bodyInput.value = "";
    if (prioritySelect) prioritySelect.value = "Normal";
    if (targetSelect) targetSelect.value = "all";
    if (formHeading) formHeading.innerText = "Publish New Broadcast";
    if (sendBtn) sendBtn.innerHTML = `<i class="fa-solid fa-bullhorn"></i> Publish Global Broadcast`;
    if (cancelBtn) cancelBtn.style.display = "none";
  };

  if (cancelBtn) {
    cancelBtn.addEventListener("click", resetForm);
  }

  // Load and Render Existing Broadcasts for Management using schoolId == "all"
  const loadActiveBroadcasts = async () => {
    if (!listContainer) return;
    try {
      const snapshot = await window.db.collection("announcements")
        .where("schoolId", "==", "all")
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();
      
      if (snapshot.empty) {
        listContainer.innerHTML = `<p style="color: var(--text-muted, #64748b); font-size: 13px; text-align: center; padding: 15px;">No active global broadcasts found.</p>`;
        return;
      }

      let html = `<table class="data-table" style="width: 100%; font-size: 13px; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 2px solid var(--border, #e2e8f0); text-align: left;">
            <th style="padding: 8px;">Title / Message</th>
            <th style="padding: 8px;">Priority</th>
            <th style="padding: 8px;">Audience</th>
            <th style="padding: 8px; text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>`;

      snapshot.forEach(docSnap => {
        const item = docSnap.data();
        const docId = docSnap.id;
        const safeTitle = (item.title || '').replace(/"/g, '&quot;');
        const safeBody = (item.body || '').replace(/"/g, '&quot;');
        
        html += `
          <tr style="border-bottom: 1px solid var(--border, #e2e8f0);">
            <td style="padding: 8px;">
              <strong>${item.title || ''}</strong><br>
              <span style="color: var(--text-muted, #64748b); font-size: 11px;">${(item.body || '').substring(0, 50)}...</span>
            </td>
            <td style="padding: 8px;"><span style="padding: 2px 6px; border-radius: 4px; font-size: 11px; background: #e0f2fe; color: #0369a1;">${item.priority || 'Normal'}</span></td>
            <td style="padding: 8px; text-transform: capitalize;">${item.targetAudience || 'all'}</td>
            <td style="padding: 8px; text-align: right; white-space: nowrap;">
              <button class="btn-outline edit-broadcast-btn" data-id="${docId}" data-title="${safeTitle}" data-body="${safeBody}" data-priority="${item.priority || 'Normal'}" data-target="${item.targetAudience || 'all'}" style="padding: 4px 8px; font-size: 11px; margin-right: 4px;"><i class="fa-solid fa-pen"></i> Edit</button>
              <button class="btn-warning delete-broadcast-btn" data-id="${docId}" data-title="${safeTitle}" style="padding: 4px 8px; font-size: 11px; background: #ef4444; border: none; color: white;"><i class="fa-solid fa-trash"></i> Delete</button>
            </td>
          </tr>`;
      });

      html += `</tbody></table>`;
      listContainer.innerHTML = html;

      // Attach Event Listeners for Edit Action
      listContainer.querySelectorAll(".edit-broadcast-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          if (titleInput) titleInput.value = btn.getAttribute("data-title");
          if (bodyInput) bodyInput.value = btn.getAttribute("data-body");
          if (prioritySelect) prioritySelect.value = btn.getAttribute("data-priority");
          if (targetSelect) targetSelect.value = btn.getAttribute("data-target");
          
          if (editingDocIdInput) editingDocIdInput.value = btn.getAttribute("data-id");
          if (formHeading) formHeading.innerText = "Edit Global Broadcast";
          if (sendBtn) sendBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Update Global Broadcast`;
          if (cancelBtn) cancelBtn.style.display = "block";
          
          if (formCard) formCard.scrollIntoView({ behavior: 'smooth' });
        });
      });

      // Attach Event Listeners for Delete Action
      listContainer.querySelectorAll(".delete-broadcast-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const docId = btn.getAttribute("data-id");
          const titleToDelete = btn.getAttribute("data-title");

          const confirmDelete = confirm(`Are you sure you want to delete the global broadcast "${titleToDelete}"?`);
          if (!confirmDelete) return;

          try {
            await window.db.collection("announcements").doc(docId).delete();

            if (typeof logAuditAction === 'function') {
              await logAuditAction("DELETE_GLOBAL_BROADCAST", `Deleted global announcement titled "${titleToDelete}".`);
            }

            await showCustomModal("Success", "Global broadcast successfully removed.");
            loadActiveBroadcasts();
            resetForm();
          } catch (delErr) {
            console.error("Error deleting global broadcast:", delErr);
            await showCustomModal("Error", "Failed to delete broadcast: " + delErr.message);
          }
        });
      });

    } catch (err) {
      console.error("Failed to load active broadcasts:", err);
      if (listContainer) {
        listContainer.innerHTML = `<p style="color: #ef4444; font-size: 13px; text-align: center; padding: 15px;">Failed to load broadcasts list.</p>`;
      }
    }
  };

  loadActiveBroadcasts();

  // Publish / Update Submission Handler
  if (sendBtn) {
    sendBtn.addEventListener("click", async () => {
      const title = titleInput ? titleInput.value.trim() : "";
      const body = bodyInput ? bodyInput.value.trim() : "";
      const priority = prioritySelect ? prioritySelect.value : "Normal";
      const target = targetSelect ? targetSelect.value : "all";
      const editingDocId = editingDocIdInput ? editingDocIdInput.value : "";

      if (!title || !body) {
        await showCustomModal("Validation Error", "Both announcement title and body message are required.");
        return;
      }

      const session = getCurrentUserSession();
      const authorName = session ? (session.name || session.fullName || session.username || 'System Administrator') : 'System Administrator';

      sendBtn.disabled = true;
      const isEditing = Boolean(editingDocId);
      sendBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${isEditing ? 'Updating...' : 'Publishing...'}`;

      try {
        const timestamp = (typeof firebase !== 'undefined' && firebase.firestore) 
                         ? firebase.firestore.FieldValue.serverTimestamp() 
                         : new Date().toISOString();

        if (isEditing) {
          await window.db.collection("announcements").doc(editingDocId).update({
            title: title,
            body: body,
            priority: priority,
            targetAudience: target,
            author: authorName,
            updatedAt: timestamp
          });

          if (typeof logAuditAction === 'function') {
            await logAuditAction("UPDATE_GLOBAL_BROADCAST", `Updated global announcement titled "${title}".`);
          }
        } else {
          await window.db.collection("announcements").add({
            title: title,
            body: body,
            author: authorName,
            priority: priority,
            targetAudience: target,
            schoolId: "all",
            createdAt: timestamp
          });

          if (typeof logAuditAction === 'function') {
            await logAuditAction("GLOBAL_BROADCAST", `Published global announcement titled "${title}".`);
          }
        }

        resetForm();
        loadActiveBroadcasts();
        await showCustomModal("Success", `Global announcement successfully ${isEditing ? 'updated' : 'published'}!`);
      } catch (err) {
        console.error("Failed to process global broadcast operation:", err);
        await showCustomModal("Error", "Operation failed: " + err.message);
      } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = `<i class="fa-solid fa-bullhorn"></i> Publish Global Broadcast`;
      }
    });
  }
}

// Feature 2: Tenant Status & Subscription Manager
function initTenantSubscriptionManager() {
  const container = getFeatureContainer("featureTenants");
  if (!container) return;

  const btn = document.getElementById("toggleStatusBtn");
  const input = document.getElementById("manageSchoolIdInput");

  if (btn && input) {
    btn.addEventListener("click", async () => {
      const schoolId = input.value.trim().toLowerCase();
      if (!schoolId) {
        await showCustomModal("Input Required", "Please enter a valid school ID.");
        return;
      }

      try {
        const docRef = window.db.collection("schools").doc(schoolId);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
          await showCustomModal("Not Found", `No school found with ID: ${schoolId}`);
          return;
        }

        const currentStatus = docSnap.data().status || "active";
        const newStatus = currentStatus === "active" ? "suspended" : "active";

        await docRef.update({ status: newStatus });
        if (typeof logAuditAction === 'function') {
          await logAuditAction("UPDATE_TENANT_STATUS", `Changed school ${schoolId} status to ${newStatus}`);
        }
        await showCustomModal("Success", `School ${schoolId} status updated to ${newStatus.toUpperCase()}.`);
        if (typeof loadRegisteredSchools === 'function') {
          loadRegisteredSchools();
        }
      } catch (err) {
        await showCustomModal("Error", "Failed to update tenant status.");
      }
    });
  }
}

// Feature 3: Cross-Tenant Global Search
function initCrossTenantSearch() {
  const container = getFeatureContainer("featureSearch");
  if (!container) return;

  const searchBtn = document.getElementById("executeGlobalSearchBtn");
  const queryInput = document.getElementById("globalSearchQuery");
  const resultsContainer = document.getElementById("globalSearchResults");

  if (searchBtn && queryInput && resultsContainer) {
    searchBtn.addEventListener("click", async () => {
      const query = queryInput.value.trim().toLowerCase();
      if (!query) return;

      resultsContainer.innerHTML = "Searching collections...";
      try {
        let matches = 0;
        let html = "";
        const collections = ['users', 'quizzes', 'forum_threads', 'announcements'];

        for (const col of collections) {
          const snap = await window.db.collection(col).limit(20).get();
          snap.forEach(doc => {
            const data = doc.data();
            const stringified = JSON.stringify(data).toLowerCase();
            if (stringified.includes(query)) {
              matches++;
              html += `<div class="search-result-item" style="padding: 6px 0; border-bottom: 1px solid #eee;">[<b>${col}</b>] ID: ${doc.id} (School: ${data.schoolId || 'N/A'})</div>`;
            }
          });
        }

        resultsContainer.innerHTML = matches > 0 ? html : `<div>No matching records found for "${query}".</div>`;
      } catch (err) {
        resultsContainer.innerHTML = `<span class="text-error" style="color: #ef4444;">Search failed due to permissions or connection.</span>`;
      }
    });
  }
}

// Feature 4: Comprehensive System Audit Logs
function initAuditLogsViewer() {
  const container = getFeatureContainer("featureAudit");
  if (!container) return;

  const refreshBtn = document.getElementById("refreshAuditBtn");
  const listEl = document.getElementById("auditLogsList");

  if (refreshBtn && listEl) {
    refreshBtn.addEventListener("click", async () => {
      listEl.innerHTML = "Loading logs...";
      try {
        const snap = await window.db.collection("audit_logs").orderBy("timestamp", "desc").limit(15).get();
        if (snap.empty) {
          listEl.innerHTML = "No audit logs recorded yet.";
          return;
        }
        let html = "";
        snap.forEach(doc => {
          const d = doc.data();
          const time = d.timestamp && d.timestamp.seconds ? new Date(d.timestamp.seconds * 1000).toLocaleString() : "Just now";
          html += `<div class="audit-log-row" style="padding: 6px 0; border-bottom: 1px solid #f1f5f9;"><strong class="audit-action-title">[${d.actionType}]</strong> ${d.details} <span class="audit-timestamp" style="float: right; color: #64748b; font-size: 11px;">${time}</span></div>`;
        });
        listEl.innerHTML = html;
      } catch (err) {
        listEl.innerHTML = "<span class='text-error' style='color: #ef4444;'>Failed to load audit logs. Ensure Firestore index exists.</span>";
      }
    });
  }
}

// Feature 5: Global Backup & Snapshot Generator
function initBackupGenerator() {
  const container = getFeatureContainer("featureBackup");
  if (!container) return;

  const backupBtn = document.getElementById("generateBackupBtn");
  if (backupBtn) {
    backupBtn.addEventListener("click", async () => {
      try {
        const backupData = {};
        const collectionsToMigrate = ['users', 'quizzes', 'submissions', 'announcements', 'schools', 'e_library_resources'];
        for (const col of collectionsToMigrate) {
          const snap = await window.db.collection(col).get();
          backupData[col] = [];
          snap.forEach(doc => {
            backupData[col].push({ id: doc.id, ...doc.data() });
          });
        }

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `samcam_full_backup_${new Date().toISOString().slice(0,10)}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();

        if (typeof logAuditAction === 'function') {
          await logAuditAction("GENERATE_BACKUP", "Downloaded complete system JSON backup snapshot.");
        }
        await showCustomModal("Success", "Backup snapshot generated and downloaded successfully.");
      } catch (err) {
        await showCustomModal("Error", "Backup generation failed.");
      }
    });
  }
}

// Feature 6: Centralized E-Resource Repository Manager
function initGlobalEResources() {
  const container = getFeatureContainer("featureEResources");
  if (!container) return;

  const publishBtn = document.getElementById("publishGlobalResBtn");
  const titleInput = document.getElementById("globalResTitle");
  const urlInput = document.getElementById("globalResUrl");

  if (publishBtn && titleInput && urlInput) {
    publishBtn.addEventListener("click", async () => {
      const title = titleInput.value.trim();
      const url = urlInput.value.trim();
      if (!title || !url) {
        await showCustomModal("Validation Error", "Title and URL are required.");
        return;
      }

      try {
        await window.db.collection("e_library_resources").add({
          title,
          url,
          isGlobal: true,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        if (typeof logAuditAction === 'function') {
          await logAuditAction("PUBLISH_GLOBAL_RESOURCE", `Published central resource: ${title}`);
        }
        titleInput.value = "";
        urlInput.value = "";
        await showCustomModal("Success", "Resource successfully published across all school e-libraries.");
      } catch (err) {
        await showCustomModal("Error", "Failed to publish resource.");
      }
    });
  }
}

// Feature 7: Global Analytics & Telemetry Dashboard
function initTelemetryDashboard() {
  const container = getFeatureContainer("featureTelemetry");
  if (!container) return;

  const loadBtn = document.getElementById("loadTelemetryBtn");
  const contentEl = document.getElementById("telemetryStatsContent");

  if (loadBtn && contentEl) {
    loadBtn.addEventListener("click", async () => {
      contentEl.innerHTML = "Calculating metrics across collections...";
      try {
        let totalUsers = 0;
        let totalQuizzes = 0;
        let totalSubmissions = 0;

        const usersSnap = await window.db.collection("users").get();
        totalUsers = usersSnap.size;

        const quizSnap = await window.db.collection("quizzes").get();
        totalQuizzes = quizSnap.size;

        const subSnap = await window.db.collection("submissions").get();
        totalSubmissions = subSnap.size;

        contentEl.innerHTML = `
          <div class="telemetry-grid" style="display: flex; gap: 10px; margin-top: 10px;">
            <div class="telemetry-card" style="flex: 1; background: #f8fafc; padding: 10px; border-radius: 6px; text-align: center;"><strong class="telemetry-number" style="font-size: 18px; color: #0284c7;">${totalUsers}</strong><br><span style="font-size: 12px; color: #64748b;">Users</span></div>
            <div class="telemetry-card" style="flex: 1; background: #f8fafc; padding: 10px; border-radius: 6px; text-align: center;"><strong class="telemetry-number" style="font-size: 18px; color: #0284c7;">${totalQuizzes}</strong><br><span style="font-size: 12px; color: #64748b;">Quizzes</span></div>
            <div class="telemetry-card" style="flex: 1; background: #f8fafc; padding: 10px; border-radius: 6px; text-align: center;"><strong class="telemetry-number" style="font-size: 18px; color: #0284c7;">${totalSubmissions}</strong><br><span style="font-size: 12px; color: #64748b;">Submissions</span></div>
          </div>
        `;
      } catch (err) {
        contentEl.innerHTML = "<span class='text-error' style='color: #ef4444;'>Failed to load analytics telemetry.</span>";
      }
    });
  }
}

// Feature 8: System Maintenance & Read-Only Mode Switch
function initMaintenanceModeToggle(configDocRef) {
  const container = getFeatureContainer("featureMaintenance");
  if (!container) return;

  const toggleBtn = document.getElementById("toggleMaintenanceBtn");
  if (toggleBtn && configDocRef) {
    toggleBtn.addEventListener("click", async () => {
      try {
        const snap = await configDocRef.get();
        const currentMode = snap.exists ? (snap.data().maintenanceMode || false) : false;
        const newMode = !currentMode;

        await configDocRef.set({ maintenanceMode: newMode }, { merge: true });
        if (typeof logAuditAction === 'function') {
          await logAuditAction("TOGGLE_MAINTENANCE", `Set system maintenance mode to: ${newMode}`);
        }
        await showCustomModal("Success", `System Maintenance Mode is now ${newMode ? 'ENABLED (Locked)' : 'DISABLED (Normal)'}.`);
      } catch (err) {
        await showCustomModal("Error", "Failed to toggle maintenance mode.");
      }
    });
  }
}

// Feature 9: Custom Feature Flag / Module Toggler
function initFeatureFlagTogglers() {
  const container = getFeatureContainer("featureFlags");
  if (!container) return;

  const schoolInput = document.getElementById("flagSchoolId");
  const moduleSelect = document.getElementById("flagModule");
  const toggleBtn = document.getElementById("toggleModuleBtn");

  if (toggleBtn && schoolInput && moduleSelect) {
    toggleBtn.addEventListener("click", async () => {
      const schoolId = schoolInput.value.trim().toLowerCase();
      const moduleName = moduleSelect.value;
      if (!schoolId) {
        await showCustomModal("Input Required", "Please enter a valid school ID.");
        return;
      }

      try {
        const docRef = window.db.collection("schools").doc(schoolId);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
          await showCustomModal("Not Found", `School ID "${schoolId}" does not exist.`);
          return;
        }

        const flags = docSnap.data().featureFlags || {};
        const newState = !(flags[moduleName] ?? true);
        flags[moduleName] = newState;

        await docRef.update({ featureFlags: flags });
        if (typeof logAuditAction === 'function') {
          await logAuditAction("TOGGLE_FEATURE_FLAG", `Set module ${moduleName} for school ${schoolId} to ${newState}`);
        }
        await showCustomModal("Success", `Module "${moduleName}" for school ${schoolId} is now ${newState ? 'ENABLED' : 'DISABLED'}.`);
      } catch (err) {
        await showCustomModal("Error", "Failed to update feature flag.");
      }
    });
  }
}

// Feature 10: Master Admin Access & Credential Rotator
function initKeyRotator(configDocRef) {
  const container = getFeatureContainer("featureKeyRotator");
  if (!container) return;

  const rotateBtn = document.getElementById("rotateMasterKeyBtn");
  if (rotateBtn && configDocRef) {
    rotateBtn.addEventListener("click", async () => {
      const newKey = await showCustomModal(
        "Rotate Master Key",
        "Enter your new master secret key (at least 6 characters):",
        "prompt",
        "Enter new master key..."
      );

      if (newKey === null) return;
      if (newKey.trim().length < 6) {
        await showCustomModal("Invalid Key", "The master key must be at least 6 characters long.");
        return;
      }

      try {
        await configDocRef.set({ masterKey: newKey.trim() }, { merge: true });
        sessionStorage.setItem("samcam_super_auth", newKey.trim());
        if (typeof logAuditAction === 'function') {
          await logAuditAction("ROTATE_MASTER_KEY", "Rotated super admin master secret key.");
        }
        await showCustomModal("Success", "Master key updated successfully!");
      } catch (err) {
        await showCustomModal("Error", "Failed to update master key.");
      }
    });
  }
}

/* ====================================================================
   Additional JavaScript for Mobile Adaptability & UI Enhancements
   ==================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  const tableContainer = document.querySelector(".table-container");
  if (tableContainer) {
    tableContainer.setAttribute("tabindex", "0");
    tableContainer.setAttribute("aria-label", "Active Platform Tenants table, scroll horizontally to view more details");
  }

  const setMobileViewportFix = () => {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };

  window.addEventListener('resize', setMobileViewportFix);
  setMobileViewportFix();
});
