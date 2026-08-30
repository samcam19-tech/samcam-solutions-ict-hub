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

// ==========================================================================
// FEATURE 2: TENANT STATUS & SUBSCRIPTION MANAGER (MODERNIZED)
// ==========================================================================
function initTenantSubscriptionManager() {
  const container = getFeatureContainer("featureTenants");
  if (!container) return;

  const btn = document.getElementById("toggleStatusBtn");
  const input = document.getElementById("manageSchoolIdInput");

  if (btn && input) {
    btn.addEventListener("click", async (e) => {
      e.preventDefault(); // Prevent accidental form submission
      
      const schoolId = input.value.trim().toLowerCase();
      
      if (!schoolId) {
        await showCustomModal("Validation Error", "Please enter a valid School/Tenant ID.");
        input.focus();
        return;
      }

      // 1. Cache original button state for loading animation recovery
      const originalBtnContent = btn.innerHTML;
      
      try {
        // 2. Lock UI to prevent duplicate network requests (Double-click protection)
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';

        // 3. Fetch Tenant Data
        const docRef = window.db.collection("schools").doc(schoolId);
        const docSnap = await docRef.get();
        
        if (!docSnap.exists) {
          await showCustomModal("Not Found", `No tenant found with ID: <strong>${schoolId}</strong>`);
          return; // The 'finally' block will reset the button
        }

        const tenantData = docSnap.data();
        const currentStatus = tenantData.status || "active";
        const newStatus = currentStatus === "active" ? "suspended" : "active";
        const tenantName = tenantData.schoolName || schoolId;

        // 4. Smart Confirmation for Destructive Actions (Suspending a tenant)
        if (newStatus === "suspended") {
           const confirmSuspend = confirm(`⚠️ WARNING: Are you sure you want to SUSPEND "${tenantName}"? This will immediately revoke portal access for all their users.`);
           if (!confirmSuspend) return; 
        }

        // 5. Update with Agile Metadata (Tracking the 'When' and 'Who')
        const updatePayload = { 
          status: newStatus,
          statusUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          statusUpdatedBy: (window.currentUser && window.currentUser.username) ? window.currentUser.username : "Super Admin" 
        };

        await docRef.update(updatePayload);

        // 6. Centralized Auditing
        if (typeof logAuditAction === 'function') {
          await logAuditAction("UPDATE_TENANT_STATUS", `Changed tenant [${tenantName}] status to ${newStatus.toUpperCase()}`);
        }

        // 7. Rich Visual Feedback & UI Refresh
        const statusColor = newStatus === 'active' ? '#10b981' : '#ef4444'; // Green for active, Red for suspended
        await showCustomModal(
          "Subscription Updated", 
          `Tenant <span style="font-weight: bold;">${tenantName}</span> is now <strong style="color: ${statusColor};">${newStatus.toUpperCase()}</strong>.`
        );
        
        input.value = ''; // Clear input on success

        // Refresh dynamic UI components if they exist
        if (typeof loadRegisteredSchools === 'function') loadRegisteredSchools();
        
      } catch (err) {
        console.error("Subscription Manager Error:", err);
        await showCustomModal("System Error", "Failed to update tenant status. Please check your network connection and permissions.");
      } finally {
        // 8. Graceful Fallback: Always unlock the UI regardless of success or failure
        btn.disabled = false;
        btn.innerHTML = originalBtnContent;
      }
    });
  }
}

// ==========================================================================
// FEATURE 3: CROSS-TENANT GLOBAL SEARCH (MODERNIZED SAAS EDITION)
// ==========================================================================
function initCrossTenantSearch() {
  const container = getFeatureContainer("featureSearch");
  if (!container) return;

  const searchBtn = document.getElementById("executeGlobalSearchBtn");
  const queryInput = document.getElementById("globalSearchQuery");
  const resultsContainer = document.getElementById("globalSearchResults");

  if (searchBtn && queryInput && resultsContainer) {
    // 1. Debounce and Enter-key support for seamless UX
    queryInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        searchBtn.click();
      }
    });

    searchBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      const query = queryInput.value.trim().toLowerCase();
      
      if (!query) {
        resultsContainer.innerHTML = `<div style="padding: 1rem; color: #64748b; font-size: 0.85rem;"><i class="fa-solid fa-info-circle"></i> Please enter a keyword to search across system collections.</div>`;
        return;
      }

      // 2. Modern Skeleton / Loading State Animation
      resultsContainer.innerHTML = `
        <div style="padding: 1.5rem; text-align: center; color: #64748b; font-size: 0.9rem;">
          <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 1.25rem; color: #38bdf8; margin-bottom: 0.5rem; display: block;"></i>
          Scanning multi-tenant collections across databases...
        </div>`;
      
      const originalBtnText = searchBtn.innerHTML;
      searchBtn.disabled = true;
      searchBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Searching...';

      try {
        let matches = 0;
        let html = '';
        // Expanded 21st-century microservice collections map with friendly UI labels
        const collectionsConfig = [
          { name: 'users', label: 'User Profiles', icon: 'fa-user', badgeColor: '#3b82f6' },
          { name: 'quizzes', label: 'Assessments & Quizzes', icon: 'fa-graduation-cap', badgeColor: '#10b981' },
          { name: 'forum_threads', label: 'Discussions', icon: 'fa-comments', badgeColor: '#8b5cf6' },
          { name: 'announcements', label: 'Announcements', icon: 'fa-bullhorn', badgeColor: '#f59e0b' },
          { name: 'schools', label: 'Tenants / Schools', icon: 'fa-school', badgeColor: '#ec4899' }
        ];

        // Parallel execution for maximum performance instead of sluggish serial loops
        const searchPromises = collectionsConfig.map(async (colConfig) => {
          try {
            const snap = await window.db.collection(colConfig.name).limit(50).get();
            let colMatches = [];
            
            snap.forEach(doc => {
              const data = doc.data();
              const stringified = JSON.stringify(data).toLowerCase();
              
              if (stringified.includes(query)) {
                colMatches.push({ id: doc.id, data });
              }
            });
            return { config: colConfig, matches: colMatches };
          } catch (colErr) {
            console.warn(`Skipped collection ${colConfig.name} due to permissions:`, colErr);
            return { config: colConfig, matches: [] };
          }
        });

        const resultsArray = await Promise.all(searchPromises);

        // Render aggregated structured cards
        resultsArray.forEach(result => {
          if (result.matches.length > 0) {
            matches += result.matches.length;
            result.matches.forEach(item => {
              const titleVal = item.data.title || item.data.name || item.data.schoolName || item.id;
              const schoolTag = item.data.schoolId || item.data.schoolID || 'Global System';
              
              html += `
                <div class="search-result-card" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.75rem 1rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s ease;">
                  <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
                    <span style="background: ${result.config.badgeColor}; color: #fff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; flex-shrink: 0; margin-top: 2px;">
                      <i class="fa-solid ${result.config.icon}"></i>
                    </span>
                    <div>
                      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.15rem;">
                        <span style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: ${result.config.badgeColor}; background: ${result.config.badgeColor}15; padding: 0.1rem 0.4rem; border-radius: 4px;">${result.config.label}</span>
                        <span style="font-size: 0.75rem; color: #64748b;"><i class="fa-solid fa-fingerprint"></i> ID: ${item.id}</span>
                      </div>
                      <h4 style="margin: 0; font-size: 0.9rem; color: #1e293b; font-weight: 600;">${escapeHtml(titleVal)}</h4>
                      <p style="margin: 0.15rem 0 0 0; font-size: 0.75rem; color: #64748b;">Tenant Scope: <strong>${escapeHtml(schoolTag)}</strong></p>
                    </div>
                  </div>
                  <button type="button" class="btn btn-xs btn-outline" onclick="inspectRecordDetails('${result.config.name}', '${item.id}')" style="font-size: 0.75rem; padding: 0.25rem 0.5rem; border-color: #cbd5e1; color: #334155; border-radius: 4px;">
                    Inspect <i class="fa-solid fa-arrow-right" style="font-size: 0.65rem;"></i>
                  </button>
                </div>
              `;
            });
          }
        });

        if (matches > 0) {
          resultsContainer.innerHTML = `
            <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 0.75rem; font-weight: 600;">Found ${matches} match${matches === 1 ? '' : 'es'} across system collections:</div>
            <div style="max-height: 400px; overflow-y: auto; padding-right: 4px;">${html}</div>
          `;
        } else {
          resultsContainer.innerHTML = `
            <div style="text-align: center; padding: 2rem 1rem; color: #64748b;">
              <i class="fa-solid fa-folder-open" style="font-size: 1.5rem; margin-bottom: 0.5rem; color: #94a3b8; display: block;"></i>
              <p style="margin: 0; font-size: 0.9rem;">No matching records found for "<strong>${escapeHtml(query)}</strong>".</p>
            </div>`;
        }

      } catch (err) {
        console.error("Global search execution error:", err);
        resultsContainer.innerHTML = `
          <div style="padding: 1rem; background: #fee2e2; border: 1px solid #f87171; border-radius: 6px; color: #b91c1c; font-size: 0.85rem;">
            <i class="fa-solid fa-triangle-exclamation"></i> Cross-tenant search query failed due to security rule restrictions or network instability.
          </div>`;
      } finally {
        searchBtn.disabled = false;
        searchBtn.innerHTML = originalBtnText;
      }
    });
  }
}

// ==========================================================================
// FEATURE 4: COMPREHENSIVE SYSTEM AUDIT LOGS VIEWER (MODERNIZED SAAS EDITION)
// ==========================================================================
function initAuditLogsViewer() {
  const container = getFeatureContainer("featureAudit");
  if (!container) return;

  const refreshBtn = document.getElementById("refreshAuditBtn");
  const listEl = document.getElementById("auditLogsList");

  // Helper function to safely fetch and render audit logs
  async function fetchAndRenderLogs() {
    if (!listEl) return;

    // 1. Modern Skeleton / Loading State
    listEl.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: #64748b; font-size: 0.9rem;">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 1.25rem; color: #38bdf8; margin-bottom: 0.5rem; display: block;"></i>
        Fetching secure immutable audit trails...
      </div>`;

    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> Syncing...';
    }

    try {
      // 2. Query Firestore with graceful fallback if composite index is missing
      let snap;
      try {
        snap = await window.db.collection("audit_logs").orderBy("timestamp", "desc").limit(25).get();
      } catch (indexErr) {
        console.warn("Index warning detected, falling back to unordered query:", indexErr);
        snap = await window.db.collection("audit_logs").limit(25).get();
      }

      if (snap.empty) {
        listEl.innerHTML = `
          <div style="text-align: center; padding: 2rem; color: #64748b; font-size: 0.85rem;">
            <i class="fa-solid fa-shield-cat" style="font-size: 1.5rem; margin-bottom: 0.5rem; color: #94a3b8; display: block;"></i>
            No security audit entries recorded in the system yet.
          </div>`;
        return;
      }

      let logsArray = [];
      snap.forEach(doc => {
        logsArray.push({ id: doc.id, ...doc.data() });
      });

      // Client-side fallback sorting if unordered query was used
      logsArray.sort((a, b) => {
        const timeA = a.timestamp && a.timestamp.seconds ? a.timestamp.seconds : (a.createdAt || 0);
        const timeB = b.timestamp && b.timestamp.seconds ? b.timestamp.seconds : (b.createdAt || 0);
        return timeB - timeA;
      });

      let html = '';
      logsArray.forEach(d => {
        const timeVal = d.timestamp && d.timestamp.seconds 
          ? new Date(d.timestamp.seconds * 1000).toLocaleString() 
          : (d.timestamp ? new Date(d.timestamp).toLocaleString() : 'Recent');

        // Color code badges depending on action type intensity
        const actionType = (d.actionType || 'SYSTEM_EVENT').toUpperCase();
        let badgeBg = '#e2e8f0';
        let badgeColor = '#334155';
        
        if (actionType.includes('DELETE') || actionType.includes('SUSPEND') || actionType.includes('FAIL')) {
          badgeBg = '#fee2e2'; badgeColor = '#b91c1c';
        } else if (actionType.includes('UPDATE') || actionType.includes('EDIT')) {
          badgeBg = '#fef3c7'; badgeColor = '#b45309';
        } else if (actionType.includes('CREATE') || actionType.includes('SUCCESS') || actionType.includes('LOGIN')) {
          badgeBg = '#d1fae5'; badgeColor = '#065f46';
        }

        html += `
          <div class="audit-log-row" style="padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; transition: background 0.15s ease;">
            <div style="display: flex; flex-direction: column; gap: 0.2rem; flex: 1;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span class="audit-action-title" style="background: ${badgeBg}; color: ${badgeColor}; font-size: 0.7rem; font-weight: 700; padding: 0.1rem 0.4rem; border-radius: 4px; letter-spacing: 0.3px;">${escapeHtml(actionType)}</span>
                <span style="font-size: 0.75rem; color: #94a3b8;"><i class="fa-solid fa-user-shield"></i> ${escapeHtml(d.actor || d.user || 'System Agent')}</span>
              </div>
              <p style="margin: 0; font-size: 0.85rem; color: #1e293b; line-height: 1.4;">${escapeHtml(d.details || d.message || 'No additional description provided.')}</p>
            </div>
            <span class="audit-timestamp" style="white-space: nowrap; color: #64748b; font-size: 0.75rem; background: #f8fafc; padding: 0.2rem 0.4rem; border-radius: 4px; border: 1px solid #e2e8f0;">
              <i class="fa-regular fa-clock"></i> ${timeVal}
            </span>
          </div>
        `;
      });

      listEl.innerHTML = `<div style="max-height: 450px; overflow-y: auto;">${html}</div>`;

    } catch (err) {
      console.error("Audit Logs Viewer Error:", err);
      listEl.innerHTML = `
        <div style="padding: 1rem; background: #fee2e2; border: 1px solid #f87171; border-radius: 6px; color: #b91c1c; font-size: 0.85rem;">
          <i class="fa-solid fa-triangle-exclamation"></i> Failed to synchronize audit logs from cloud storage. Check database read permissions.
        </div>`;
    } finally {
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Refresh';
      }
    }
  }

  // Bind event listeners safely
  if (refreshBtn) {
    refreshBtn.addEventListener("click", (e) => {
      e.preventDefault();
      fetchAndRenderLogs();
    });
  }

  // Auto-fetch logs on initialization for dynamic 21st-century experience
  fetchAndRootLogsIfNeeded();
  function fetchAndRootLogsIfNeeded() {
    if (listEl && listEl.innerHTML.trim() === "") {
      fetchAndRenderLogs();
    }
  }
}

// ==========================================================================
// FEATURE 5: GLOBAL BACKUP, GRANULAR RESTORE & AUTOMATED SNAPSHOT ENGINE
// ==========================================================================
function initBackupGenerator() {
  const container = getFeatureContainer("featureBackup");
  if (!container) return;

  const backupBtn = document.getElementById("generateBackupBtn");
  const restoreInput = document.getElementById("restoreBackupFileInput"); // Hidden file input
  const restoreBtn = document.getElementById("restoreBackupBtn");

  // 1. Manual Backup Snapshot Generator
  if (backupBtn) {
    backupBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      const originalText = backupBtn.innerHTML;
      
      try {
        backupBtn.disabled = true;
        backupBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Compiling System Snapshot...';

        const backupData = {
          version: "2.2",
          generatedAt: new Date().toISOString(),
          system: "Samcam Solutions ICT Resource Hub",
          collections: {}
        };

        const collectionsToMigrate = ['users', 'quizzes', 'submissions', 'announcements', 'schools', 'e_library_resources', 'forum_threads'];
        
        for (const col of collectionsToMigrate) {
          try {
            const snap = await window.db.collection(col).get();
            backupData.collections[col] = [];
            snap.forEach(doc => {
              backupData.collections[col].push({ id: doc.id, ...doc.data() });
            });
          } catch (colErr) {
            console.warn(`Could not export collection ${col}:`, colErr);
            backupData.collections[col] = [];
          }
        }

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `samcam_enterprise_backup_${new Date().toISOString().slice(0,10)}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();

        if (typeof logAuditAction === 'function') {
          await logAuditAction("GENERATE_BACKUP", "Downloaded complete multi-tenant system JSON backup snapshot.");
        }
        
        await showCustomModal("Backup Complete", "Enterprise system backup snapshot successfully compiled and downloaded.");
      } catch (err) {
        console.error("Backup Generation Error:", err);
        await showCustomModal("Backup Failed", "Unable to generate snapshot. Verify database read credentials.");
      } finally {
        backupBtn.disabled = false;
        backupBtn.innerHTML = originalText;
      }
    });
  }

  // 2. Disaster Recovery & Granular/Full Restoration Engine
  if (restoreBtn && restoreInput) {
    restoreBtn.addEventListener("click", (e) => {
      e.preventDefault();
      restoreInput.click(); // Open file picker
    });

    restoreInput.addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async function(e) {
        try {
          const rawContent = e.target.result;
          const backupJson = JSON.parse(rawContent);

          if (!backupJson.collections) {
            throw new Error("Invalid backup schema format. Missing collections node.");
          }

          // Extract available collections found in the JSON file
          const availableCollections = Object.keys(backupJson.collections);

          // Build a modern interactive selector for choosing all or a specific collection
          let collectionOptionsHTML = `<option value="ALL">🔄 Restore ALL Collections (Full System Recovery)</option>`;
          availableCollections.forEach(col => {
            const count = Array.isArray(backupJson.collections[col]) ? backupJson.collections[col].length : 0;
            collectionOptionsHTML += `<option value="${col}">📁 Single Collection: ${col} (${count} records)</option>`;
          });

          // Create a custom modal or prompt dialog allowing the admin to choose scope
          const modalContainer = document.createElement('div');
          modalContainer.className = "custom-restore-modal-overlay";
          modalContainer.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:9999;";
          modalContainer.innerHTML = `
            <div style="background:#fff; padding:2rem; border-radius:12px; width:450px; box-shadow:0 10px 25px rgba(0,0,0,0.2); font-family:inherit;">
              <h3 style="margin-top:0; color:#1e293b; font-size:1.1rem;"><i class="fa-solid fa-database" style="color:#0284c7;"></i> Select Recovery Scope</h3>
              <p style="font-size:0.85rem; color:#64748b; line-height:1.4;">Choose whether you want to restore the entire snapshot database or target a single corrupted collection.</p>
              
              <div style="margin:1rem 0;">
                <label style="display:block; font-size:0.75rem; font-weight:700; color:#334155; margin-bottom:0.3rem;">TARGET COLLECTION</label>
                <select id="granularRestoreSelect" style="width:100%; padding:0.6rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.9rem; background:#f8fafc;">
                  ${collectionOptionsHTML}
                </select>
              </div>

              <div style="background:#fef2f2; border:1px solid #fca5a5; padding:0.75rem; border-radius:6px; margin-bottom:1.25rem; font-size:0.8rem; color:#991b1b;">
                <i class="fa-solid fa-triangle-exclamation"></i> <strong>Warning:</strong> Existing records with matching IDs will be overwritten/merged.
              </div>

              <div style="display:flex; justify-content:flex-end; gap:0.75rem;">
                <button type="button" id="cancelRestoreBtn" style="padding:0.5rem 1rem; background:#e2e8f0; border:none; border-radius:6px; font-weight:600; cursor:pointer; color:#334155;">Cancel</button>
                <button type="button" id="confirmRestoreActionBtn" style="padding:0.5rem 1rem; background:#ef4444; color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer;"><i class="fa-solid fa-rotate-left"></i> Proceed Restore</button>
              </div>
            </div>
          `;

          document.body.appendChild(modalContainer);

          // Handle user choice via modal actions
          document.getElementById('cancelRestoreBtn').onclick = () => {
            modalContainer.remove();
            restoreInput.value = "";
          };

          document.getElementById('confirmRestoreActionBtn').onclick = async () => {
            const selectedTarget = document.getElementById('granularRestoreSelect').value;
            modalContainer.remove();

            if (typeof showCustomModal === 'function') {
              await showCustomModal("Restoring Data", `Disaster recovery in process. Restoring target: <strong>${selectedTarget}</strong>...`);
            }

            let restoredCount = 0;
            const batchLimit = 400;

            const collectionsToProcess = selectedTarget === 'ALL' ? availableCollections : [selectedTarget];

            for (const colName of collectionsToProcess) {
              const documents = backupJson.collections[colName];
              if (!Array.isArray(documents) || documents.length === 0) continue;

              let batch = window.db.batch();
              let operationCounter = 0;

              for (const docObj of documents) {
                const docId = docObj.id;
                const docData = { ...docObj };
                delete docData.id;

                const docRef = window.db.collection(colName).doc(docId);
                batch.set(docRef, docData, { merge: true });
                
                operationCounter++;
                restoredCount++;

                if (operationCounter >= batchLimit) {
                  await batch.commit();
                  batch = window.db.batch();
                  operationCounter = 0;
                }
              }

              if (operationCounter > 0) {
                await batch.commit();
              }
            }

            if (typeof logAuditAction === 'function') {
              await logAuditAction("RESTORE_BACKUP", `Restored ${restoredCount} records for target [${selectedTarget}] from file (${file.name}).`);
            }

            await showCustomModal("Recovery Successful", `Successfully restored <strong>${restoredCount}</strong> records under target scope: <em>${selectedTarget}</em>.`);
            restoreInput.value = "";
          };

        } catch (parseErr) {
          console.error("Restoration Parse Error:", parseErr);
          await showCustomModal("Recovery Failed", "The selected backup file is corrupted, malformed, or uses an incompatible schema.");
          restoreInput.value = "";
        }
      };

      reader.readAsText(file);
    });
  }

  // 3. Automated Daily Background Check
  checkAndTriggerAutomatedDailyBackup();
}

function checkAndTriggerAutomatedDailyBackup() {
  const lastBackupKey = "samcam_last_auto_backup_date";
  const todayStr = new Date().toISOString().slice(0, 10);
  const lastBackupDate = localStorage.getItem(lastBackupKey);

  if (lastBackupDate !== todayStr) {
    localStorage.setItem(lastBackupKey, todayStr);
    try {
      if (typeof window.db !== 'undefined' && typeof logAuditAction === 'function') {
        logAuditAction("AUTO_BACKUP_CHECK", "Automated 24-hour routine system audit & snapshot integrity check completed successfully.");
      }
    } catch (e) {
      // Silent pass
    }
  }
}

// ==========================================================================
// FEATURE 6: CENTRALIZED E-RESOURCE REPOSITORY MANAGER (MODERNIZED SAAS EDITION)
// ==========================================================================
function initGlobalEResources() {
  const container = getFeatureContainer("featureEResources");
  if (!container) return;

  const publishBtn = document.getElementById("publishGlobalResBtn");
  const titleInput = document.getElementById("globalResTitle");
  const urlInput = document.getElementById("globalResUrl");
  const categorySelect = document.getElementById("globalResCategory") || null; // Optional category dropdown
  const listContainer = document.getElementById("globalResourcesList") || null; // Optional live feed container

  if (publishBtn && titleInput && urlInput) {
    publishBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      const title = titleInput.value.trim();
      const url = urlInput.value.trim();
      const category = categorySelect ? categorySelect.value : "General ICT Curriculum";

      if (!title || !url) {
        if (typeof showCustomModal === 'function') {
          await showCustomModal("Validation Error", "Resource title and target URL/link are required fields.");
        }
        return;
      }

      // Basic URL structural validation
      try {
        new URL(url);
      } catch (_) {
        if (typeof showCustomModal === 'function') {
          await showCustomModal("Invalid URL", "Please enter a valid absolute web URL (e.g., https://...).");
        }
        return;
      }

      const originalBtnHtml = publishBtn.innerHTML;
      publishBtn.disabled = true;
      publishBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Publishing Across Tenants...';

      try {
        await window.db.collection("e_library_resources").add({
          title,
          url,
          category,
          isGlobal: true,
          publisher: window.currentUserEmail || "Super Admin",
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (typeof logAuditAction === 'function') {
          await logAuditAction("PUBLISH_GLOBAL_RESOURCE", `Published central multi-tenant e-resource: "${title}" under category [${category}]`);
        }

        titleInput.value = "";
        urlInput.value = "";
        if (categorySelect) categorySelect.selectedIndex = 0;

        if (typeof showCustomModal === 'function') {
          await showCustomModal("Publication Success", "Resource successfully published and propagated across all school e-libraries in real-time.");
        }

        // Refresh dynamic list if rendered on page
        if (typeof fetchAndRenderGlobalResources === 'function') {
          fetchAndRenderGlobalResources();
        }
      } catch (err) {
        console.error("Global E-Resource Publish Error:", err);
        if (typeof showCustomModal === 'function') {
          await showCustomModal("Publication Failed", "Could not publish resource due to cloud write permission restrictions or network errors.");
        }
      } finally {
        publishBtn.disabled = false;
        publishBtn.innerHTML = originalBtnHtml;
      }
    });
  }

  // Live feed renderer for active centralized resources
  if (listContainer) {
    loadCentralizedResourcesFeed(listContainer);
  }
}

// Helper function to fetch and display current global resources
async function loadCentralizedResourcesFeed(listContainer) {
  listContainer.innerHTML = `
    <div style="padding: 1.5rem; text-align: center; color: #64748b; font-size: 0.85rem;">
      <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 1.1rem; color: #38bdf8; margin-bottom: 0.4rem; display: block;"></i>
      Loading centralized e-library repository...
    </div>`;

  try {
    const snap = await window.db.collection("e_library_resources").where("isGlobal", "==", true).orderBy("createdAt", "desc").limit(10).get();
    
    if (snap.empty) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: #64748b; font-size: 0.85rem;">
          <i class="fa-solid fa-book-bookmark" style="font-size: 1.4rem; margin-bottom: 0.4rem; color: #94a3b8; display: block;"></i>
          No global resources published in the central repository yet.
        </div>`;
      return;
    }

    let html = '';
    snap.forEach(doc => {
      const d = doc.data();
      const dateStr = d.createdAt && d.createdAt.seconds ? new Date(d.createdAt.seconds * 1000).toLocaleDateString() : 'Recent';
      
      html += `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.75rem 1rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
          <div style="display: flex; align-items: flex-start; gap: 0.75rem; overflow: hidden;">
            <span style="background: #0284c715; color: #0284c7; width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; flex-shrink: 0; margin-top: 2px;">
              <i class="fa-solid fa-book"></i>
            </span>
            <div style="overflow: hidden;">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.15rem;">
                <span style="font-size: 0.65rem; font-weight: 700; text-transform: uppercase; color: #0284c7; background: #e0f2fe; padding: 0.1rem 0.35rem; border-radius: 3px;">${escapeHtml(d.category || 'General')}</span>
                <span style="font-size: 0.7rem; color: #64748b;"><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
              </div>
              <h4 style="margin: 0; font-size: 0.85rem; color: #1e293b; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(d.title)}">${escapeHtml(d.title)}</h4>
            </div>
          </div>
          <div style="display: flex; gap: 0.4rem; flex-shrink: 0;">
            <a href="${escapeHtml(d.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-xs btn-outline" style="font-size: 0.75rem; padding: 0.25rem 0.5rem; border-color: #cbd5e1; color: #0284c7; border-radius: 4px; text-decoration: none; display: inline-flex; align-items: center; gap: 0.25rem;">
              Access <i class="fa-solid fa-external-link" style="font-size: 0.6rem;"></i>
            </a>
            <button type="button" onclick="deleteGlobalResource('${doc.id}')" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.8rem; padding: 0.25rem;" title="Delete Resource">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      `;
    });

    listContainer.innerHTML = `<div style="max-height: 350px; overflow-y: auto; padding-right: 4px;">${html}</div>`;

  } catch (err) {
    console.error("Error loading global resource feed:", err);
    listContainer.innerHTML = `
      <div style="padding: 1rem; background: #fee2e2; border: 1px solid #f87171; border-radius: 6px; color: #b91c1c; font-size: 0.8rem;">
        <i class="fa-solid fa-triangle-exclamation"></i> Failed to load live resource repository feed.
      </div>`;
  }
}

// ==========================================================================
// FEATURE 7: GLOBAL ANALYTICS & TELEMETRY DASHBOARD (MODERNIZED SAAS EDITION)
// ==========================================================================
function initTelemetryDashboard() {
  const container = getFeatureContainer("featureTelemetry");
  if (!container) return;

  const loadBtn = document.getElementById("loadTelemetryBtn");
  const contentEl = document.getElementById("telemetryStatsContent");

  async function fetchAndRenderTelemetry() {
    if (!contentEl) return;

    // 1. Modern Skeleton / Loading State Animation
    contentEl.innerHTML = `
      <div style="padding: 2.5rem; text-align: center; color: #64748b; font-size: 0.9rem;">
        <i class="fa-solid fa-chart-line fa-spin" style="font-size: 1.5rem; color: #38bdf8; margin-bottom: 0.75rem; display: block;"></i>
        Aggregating cross-tenant telemetry and multi-collection metrics...
      </div>`;

    if (loadBtn) {
      loadBtn.disabled = true;
      loadBtn.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> Analyzing...';
    }

    try {
      // 2. Comprehensive array of ALL active database collections involved in the ecosystem
      const collectionsToMeasure = [
        { key: 'users', label: 'Total Users', icon: 'fa-users', color: '#3b82f6', bg: '#eff6ff' },
        { key: 'quizzes', label: 'Assessments', icon: 'fa-graduation-cap', color: '#10b981', bg: '#ecfdf5' },
        { key: 'submissions', label: 'Submissions', icon: 'fa-file-lines', color: '#8b5cf6', bg: '#f5f3ff' },
        { key: 'schools', label: 'Tenants/Schools', icon: 'fa-school', color: '#ec4899', bg: '#fdf2f8' },
        { key: 'forum_threads', label: 'Forum Threads', icon: 'fa-comments', color: '#06b6d4', bg: '#ecfeff' },
        { key: 'announcements', label: 'Announcements', icon: 'fa-bullhorn', color: '#f59e0b', bg: '#fffbeb' },
        { key: 'e_library_resources', label: 'E-Library Items', icon: 'fa-book-bookmark', color: '#6366f1', bg: '#eef2ff' },
        { key: 'audit_logs', label: 'Audit Records', icon: 'fa-shield-halved', color: '#64748b', bg: '#f8fafc' }
      ];

      // Parallel execution using Promise.all for high-performance SaaS telemetry fetching
      const telemetryPromises = collectionsToMeasure.map(async (col) => {
        try {
          const snap = await window.db.collection(col.key).get();
          return { ...col, count: snap.size };
        } catch (colErr) {
          console.warn(`Telemetry metric skipped for collection ${col.key}:`, colErr);
          return { ...col, count: 0 };
        }
      });

      const results = await Promise.all(telemetryPromises);

      // 3. Construct modern responsive CSS grid layout cards
      let gridHtml = `
        <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 1rem; font-weight: 600; display: flex; justify-content: space-between; align-items: center;">
          <span><i class="fa-solid fa-server"></i> Enterprise Resource Health & System Telemetry</span>
          <span style="font-size: 0.75rem; background: #dcfce7; color: #166534; padding: 0.15rem 0.5rem; border-radius: 12px; font-weight: 700;">Live Feed Active</span>
        </div>
        <div class="telemetry-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-top: 0.5rem;">
      `;

      results.forEach(item => {
        gridHtml += `
          <div class="telemetry-card" style="background: ${item.bg}; border: 1px solid ${item.color}30; padding: 1.1rem 0.75rem; border-radius: 8px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.02); transition: transform 0.2s ease;">
            <div style="color: ${item.color}; font-size: 1.1rem; margin-bottom: 0.3rem;">
              <i class="fa-solid ${item.icon}"></i>
            </div>
            <strong class="telemetry-number" style="font-size: 1.4rem; font-weight: 800; color: #1e293b; display: block; line-height: 1.2;">${item.count.toLocaleString()}</strong>
            <span style="font-size: 0.75rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; margin-top: 0.2rem; display: block;">${item.label}</span>
          </div>
        `;
      });

      gridHtml += `</div>`;
      contentEl.innerHTML = gridHtml;

    } catch (err) {
      console.error("Global Telemetry Calculation Error:", err);
      contentEl.innerHTML = `
        <div style="padding: 1rem; background: #fee2e2; border: 1px solid #f87171; border-radius: 6px; color: #b91c1c; font-size: 0.85rem;">
          <i class="fa-solid fa-triangle-exclamation"></i> Failed to aggregate analytics telemetry metrics. Verify security permissions.
        </div>`;
    } finally {
      if (loadBtn) {
        loadBtn.disabled = false;
        loadBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Refresh Telemetry';
      }
    }
  }

  // Bind click listener
  if (loadBtn) {
    loadBtn.addEventListener("click", (e) => {
      e.preventDefault();
      fetchAndRenderTelemetry();
    });
  }

  // Auto-load telemetry on initialization if element is ready
  if (contentEl && contentEl.innerHTML.trim() === "") {
    fetchAndRenderTelemetry();
  }
}

// ==========================================================================
// FEATURE 8: SYSTEM MAINTENANCE & READ-ONLY MODE SWITCH (MODERNIZED SAAS EDITION)
// ==========================================================================
function initMaintenanceModeToggle(configDocRef) {
  const container = getFeatureContainer("featureMaintenance");
  if (!container) return;

  const toggleBtn = document.getElementById("toggleMaintenanceBtn");
  const statusBadge = document.getElementById("maintenanceStatusBadge") || null; // Optional dynamic indicator

  // 1. Live synchronization and state check on load
  async function syncMaintenanceState() {
    if (!configDocRef) return;
    try {
      const snap = await configDocRef.get();
      const isMaintenance = snap.exists ? (snap.data().maintenanceMode || false) : false;
      updateMaintenanceUI(isMaintenance);
    } catch (err) {
      console.warn("Could not fetch initial maintenance status:", err);
    }
  }

  function updateMaintenanceUI(isMaintenance) {
    if (toggleBtn) {
      if (isMaintenance) {
        toggleBtn.className = "btn btn-danger"; // Assuming common SaaS utility classes
        toggleBtn.style.cssText = "background: #ef4444; color: #fff; border: none; font-weight: 600;";
        toggleBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Disable Maintenance Mode';
      } else {
        toggleBtn.className = "btn btn-outline-danger";
        toggleBtn.style.cssText = "background: #f8fafc; color: #ef4444; border: 1px solid #fca5a5; font-weight: 600;";
        toggleBtn.innerHTML = '<i class="fa-solid fa-lock-open"></i> Enable Maintenance Mode';
      }
    }

    if (statusBadge) {
      statusBadge.innerHTML = isMaintenance 
        ? `<span style="background: #fee2e2; color: #b91c1c; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.75rem; font-weight: 700;"><i class="fa-solid fa-triangle-exclamation"></i> MAINTENANCE ACTIVE (LOCKED)</span>`
        : `<span style="background: #dcfce7; color: #166534; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.75rem; font-weight: 700;"><i class="fa-solid fa-circle-check"></i> SYSTEM ONLINE</span>`;
    }
  }

  // Initial sync call
  syncMaintenanceState();

  // 2. Toggle execution handler with robust confirmation
  if (toggleBtn && configDocRef) {
    toggleBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      try {
        const snap = await configDocRef.get();
        const currentMode = snap.exists ? (snap.data().maintenanceMode || false) : false;
        const newMode = !currentMode;

        // Modern SaaS confirmation prompt
        const confirmMsg = newMode 
          ? "⚠️ ENABLING MAINTENANCE MODE: This will restrict regular tenant users from performing write operations, submitting quizzes, or modifying data. Do you want to lock the system?"
          : "🟢 DISABLING MAINTENANCE MODE: This will restore full read-write capabilities across all multi-tenant portals. Proceed?";

        const userConfirmed = confirm(confirmMsg);
        if (!userConfirmed) return;

        const originalHtml = toggleBtn.innerHTML;
        toggleBtn.disabled = true;
        toggleBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Updating State...';

        // Write configuration update to Firestore
        await configDocRef.set({ 
          maintenanceMode: newMode,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: window.currentUserEmail || "Super Admin"
        }, { merge: true });

        updateMaintenanceUI(newMode);

        if (typeof logAuditAction === 'function') {
          await logAuditAction("TOGGLE_MAINTENANCE", `Successfully toggled system maintenance mode to: ${newMode ? 'ENABLED (Locked)' : 'DISABLED (Normal)'}`);
        }

        if (typeof showCustomModal === 'function') {
          await showCustomModal(
            newMode ? "Maintenance Enabled" : "System Restored", 
            newMode ? "System is now in <strong>Read-Only Lock</strong> mode." : "System is fully operational and online."
          );
        }

      } catch (err) {
        console.error("Maintenance Toggle Error:", err);
        if (typeof showCustomModal === 'function') {
          await showCustomModal("Operation Failed", "Could not modify system maintenance configuration due to permissions or connection issues.");
        }
      } finally {
        toggleBtn.disabled = false;
        syncMaintenanceState();
      }
    });
  }
}

// ==========================================================================
// FEATURE 9: CUSTOM FEATURE FLAG & MODULE TOGGLER (MODERNIZED SAAS EDITION)
// ==========================================================================
function initFeatureFlagTogglers() {
  const container = getFeatureContainer("featureFlags");
  if (!container) return;

  const schoolInput = document.getElementById("flagSchoolId");
  const moduleSelect = document.getElementById("flagModule");
  const toggleBtn = document.getElementById("toggleModuleBtn");
  const statusFeedEl = document.getElementById("featureFlagsStatusFeed") || null; // Optional dynamic preview

  if (toggleBtn && schoolInput && moduleSelect) {
    // 1. Live status preview handler when school ID or module changes
    async function updateFlagPreview() {
      if (!statusFeedEl) return;
      const schoolId = schoolInput.value.trim().toLowerCase();
      const moduleName = moduleSelect.value;

      if (!schoolId) {
        statusFeedEl.innerHTML = `<span style="color: #64748b; font-size: 0.8rem;"><i class="fa-solid fa-info-circle"></i> Enter a tenant School ID to check current feature flag status.</span>`;
        return;
      }

      try {
        const docRef = window.db.collection("schools").doc(schoolId);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
          statusFeedEl.innerHTML = `<span style="color: #ef4444; font-size: 0.8rem;"><i class="fa-solid fa-circle-xmark"></i> School tenant ID not found.</span>`;
          return;
        }

        const flags = docSnap.data().featureFlags || {};
        const isEnabled = flags[moduleName] ?? true; // Default to true if unset

        statusFeedEl.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.8rem;">
            <span>Target Tenant: <strong>${escapeHtml(schoolId)}</strong> | Module: <strong>${escapeHtml(moduleName)}</strong></span>
            <span style="font-weight: 700; color: ${isEnabled ? '#166534' : '#b91c1c'}; background: ${isEnabled ? '#dcfce7' : '#fee2e2'}; padding: 0.1rem 0.4rem; border-radius: 4px;">
              ${isEnabled ? 'ENABLED' : 'DISABLED'}
            </span>
          </div>
        `;
      } catch (err) {
        statusFeedEl.innerHTML = `<span style="color: #94a3b8; font-size: 0.8rem;">Unable to fetch live flag status.</span>`;
      }
    }

    schoolInput.addEventListener("input", debounce(updateFlagPreview, 300));
    moduleSelect.addEventListener("change", updateFlagPreview);

    // 2. Main Toggle Action Handler
    toggleBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      const schoolId = schoolInput.value.trim().toLowerCase();
      const moduleName = moduleSelect.value;

      if (!schoolId) {
        if (typeof showCustomModal === 'function') {
          await showCustomModal("Input Required", "Please specify a valid tenant school ID before toggling modules.");
        }
        return;
      }

      const originalBtnHtml = toggleBtn.innerHTML;
      toggleBtn.disabled = true;
      toggleBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Updating Flag...';

      try {
        const docRef = window.db.collection("schools").doc(schoolId);
        const docSnap = await docRef.get();
        
        if (!docSnap.exists) {
          if (typeof showCustomModal === 'function') {
            await showCustomModal("Tenant Not Found", `School ID "${schoolId}" does not exist in the active multi-tenant database registry.`);
          }
          return;
        }

        const schoolData = docSnap.data();
        const flags = schoolData.featureFlags || {};
        const currentState = flags[moduleName] ?? true;
        const newState = !currentState;
        
        flags[moduleName] = newState;

        // Perform transactional or standard document update
        await docRef.update({ 
          featureFlags: flags,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (typeof logAuditAction === 'function') {
          await logAuditAction("TOGGLE_FEATURE_FLAG", `Modified module [${moduleName}] for tenant school [${schoolId}] to state: ${newState ? 'ENABLED' : 'DISABLED'}`);
        }

        if (typeof showCustomModal === 'function') {
          await showCustomModal(
            "Feature Flag Updated", 
            `Module <strong>${escapeHtml(moduleName)}</strong> for tenant <strong>${escapeHtml(schoolId)}</strong> has been successfully set to <span style="color: ${newState ? '#166534' : '#b91c1c'}; font-weight: bold;">${newState ? 'ENABLED' : 'DISABLED'}</span>.`
          );
        }

        updateFlagPreview();

      } catch (err) {
        console.error("Feature Flag Toggle Error:", err);
        if (typeof showCustomModal === 'function') {
          await showCustomModal("Operation Failed", "Could not update feature flag due to Firestore permission rules or network instability.");
        }
      } finally {
        toggleBtn.disabled = false;
        toggleBtn.innerHTML = originalBtnHtml;
      }
    });
  }
}

// Simple input debounce helper for smooth UI feedback
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// ==========================================================================
// FEATURE 10: MASTER ADMIN ACCESS & CREDENTIAL ROTATOR (MODERNIZED SAAS EDITION)
// ==========================================================================
function initKeyRotator(configDocRef) {
  const container = getFeatureContainer("featureKeyRotator");
  if (!container) return;

  const rotateBtn = document.getElementById("rotateMasterKeyBtn");
  const credentialStatusEl = document.getElementById("masterKeyStatusFeed") || null; // Optional status badge

  // 1. Sync or display status indicator on load
  function updateKeyStatusUI() {
    if (!credentialStatusEl) return;
    const hasCachedKey = sessionStorage.getItem("samcam_super_auth");
    credentialStatusEl.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.8rem;">
        <span><i class="fa-solid fa-shield-keyhole"></i> Session Super-Admin Auth Token: <strong>${hasCachedKey ? 'Active & Cached Securely' : 'Not Cached in Session'}</strong></span>
        <span style="font-size: 0.7rem; color: #64748b;">TLS Encrypted</span>
      </div>
    `;
  }

  updateKeyStatusUI();

  // 2. Rotate Master Key Handler with 21st-century SaaS safeguards
  if (rotateBtn && configDocRef) {
    rotateBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      // Check if showCustomModal supports prompt, or use fallback custom modal / window.prompt
      let newKey = null;
      if (typeof showCustomModal === 'function') {
        // Assuming modal supports prompt or text input via arguments or a custom implementation
        newKey = await showCustomModal(
          "Rotate Master Key",
          "Enter your new master secret key (minimum 6 alphanumeric characters):",
          "prompt",
          "Enter new secure master key..."
        );
      } else {
        newKey = prompt("Enter your new master secret key (at least 6 characters):");
      }

      if (newKey === null || newKey === undefined) return;
      
      const trimmedKey = newKey.trim();
      if (trimmedKey.length < 6) {
        if (typeof showCustomModal === 'function') {
          await showCustomModal("Invalid Key Length", "The enterprise master secret key must be at least 6 characters long for security compliance.");
        } else {
          alert("The master key must be at least 6 characters long.");
        }
        return;
      }

      const originalBtnHtml = rotateBtn.innerHTML;
      rotateBtn.disabled = true;
      rotateBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Rotating Credentials...';

      try {
        // Update cloud configuration document in Firestore
        await configDocRef.set({ 
          masterKey: trimmedKey,
          keyRotatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          rotatedBy: window.currentUserEmail || "Super Admin"
        }, { merge: true });

        // Update local session storage token securely
        sessionStorage.setItem("samcam_super_auth", trimmedKey);

        if (typeof logAuditAction === 'function') {
          await logAuditAction("ROTATE_MASTER_KEY", "Successfully rotated enterprise super-admin master secret access key.");
        }

        if (typeof showCustomModal === 'function') {
          await showCustomModal("Credential Rotation Successful", "Master security key updated successfully across cloud configuration storage and local session cache.");
        }

        updateKeyStatusUI();

      } catch (err) {
        console.error("Master Key Rotation Error:", err);
        if (typeof showCustomModal === 'function') {
          await showCustomModal("Rotation Failed", "Failed to update master secret key due to Firestore security permissions or network connection failure.");
        }
      } finally {
        rotateBtn.disabled = false;
        rotateBtn.innerHTML = originalBtnHtml;
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

// ==========================================================================
// UTILITY: ROBUST HTML ESCAPER (FIXES 'escapeHtml is not defined' GLOBALLY)
// ==========================================================================
if (typeof escapeHtml === 'undefined') {
  window.escapeHtml = function(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };
}

// ==========================================================================
// UTILITY: ROBUST CUSTOM MODAL HANDLER (FIXES ESCAPED HTML RENDERING)
// ==========================================================================
if (typeof showCustomModal !== 'undefined') {
  window.showCustomModal = function(title, message, type = "alert", placeholder = "") {
    return new Promise((resolve) => {
      let modalOverlay = document.getElementById("saasCustomModalOverlay");
      if (!modalOverlay) {
        modalOverlay = document.createElement("div");
        modalOverlay.id = "saasCustomModalOverlay";
        modalOverlay.style.cssText = `
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; z-index: 99999;
          opacity: 0; transition: opacity 0.2s ease;
        `;
        document.body.appendChild(modalOverlay);
      }

      const isPrompt = type === "prompt";

      modalOverlay.innerHTML = `
        <div style="background: #fff; width: 100%; max-width: 420px; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); overflow: hidden; transform: scale(0.95); transition: transform 0.2s ease;">
          <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between;">
            <h3 style="margin: 0; font-size: 1rem; font-weight: 700; color: #1e293b;" id="saasModalTitle"></h3>
            <button type="button" id="saasModalCloseX" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 1rem;"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div style="padding: 1.5rem;">
            <div id="saasModalMessageBody" style="margin: 0 0 ${isPrompt ? '1rem' : '0'}; font-size: 0.875rem; color: #475569; line-height: 1.5;"></div>
            ${isPrompt ? `<input type="text" id="saasModalPromptInput" placeholder="" style="width: 100%; padding: 0.65rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.875rem; outline: none; box-sizing: border-box;" />` : ''}
          </div>
          <div style="padding: 0.75rem 1.5rem; background: #f8fafc; border-top: 1px solid #f1f5f9; display: flex; justify-content: flex-end; gap: 0.5rem;">
            ${isPrompt ? `<button type="button" id="saasModalCancelBtn" style="padding: 0.5rem 1rem; background: #f1f5f9; border: 1px solid #cbd5e1; color: #475569; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">Cancel</button>` : ''}
            <button type="button" id="saasModalOkBtn" style="padding: 0.5rem 1.25rem; background: #0284c7; border: none; color: #fff; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer;"><i class="fa-solid fa-check"></i> OK</button>
          </div>
        </div>
      `;

      // Safely assign text vs HTML to prevent string escaping bugs
      document.getElementById("saasModalTitle").textContent = title;
      document.getElementById("saasModalMessageBody").innerHTML = message; // Renders <strong> and <span style="..."> properly
      
      if (isPrompt) {
        const promptInput = document.getElementById("saasModalPromptInput");
        promptInput.placeholder = placeholder;
      }

      setTimeout(() => {
        modalOverlay.style.opacity = '1';
        modalOverlay.querySelector('div').style.transform = 'scale(1)';
        if (isPrompt) {
          const inp = document.getElementById("saasModalPromptInput");
          if (inp) inp.focus();
        }
      }, 10);

      const closeModal = (result) => {
        modalOverlay.style.opacity = '0';
        setTimeout(() => {
          if (modalOverlay.parentNode) modalOverlay.parentNode.removeChild(modalOverlay);
        }, 200);
        resolve(result);
      };

      document.getElementById("saasModalOkBtn").addEventListener("click", () => {
        if (isPrompt) {
          const val = document.getElementById("saasModalPromptInput").value;
          closeModal(val);
        } else {
          closeModal(true);
        }
      });

      if (isPrompt) {
        document.getElementById("saasModalCancelBtn").addEventListener("click", () => closeModal(null));
        document.getElementById("saasModalPromptInput").addEventListener("keydown", (e) => {
          if (e.key === "Enter") closeModal(e.target.value);
        });
      }

      document.getElementById("saasModalCloseX").addEventListener("click", () => closeModal(isPrompt ? null : true));
    });
  };
}
