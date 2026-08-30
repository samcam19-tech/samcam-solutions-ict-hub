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

// Complete list of all system collections to ensure full migration & backup coverage
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
  'users',
  'schools',
  'system_config'
];

document.addEventListener("DOMContentLoaded", () => {
  const collectionsCountEl = document.getElementById("collectionsCount");
  if (collectionsCountEl) {
    collectionsCountEl.innerText = collectionsToMigrate.length;
  }

  // Bind Logout functionality to admin profile header
  const adminProfileEl = document.querySelector(".admin-profile");
  if (adminProfileEl) {
    adminProfileEl.classList.add("interactive-admin-profile");
    adminProfileEl.title = "Click to log out of Super Admin session";
    
    adminProfileEl.innerHTML = `
      <span>Master Administrator</span>
      <span class="logout-badge" title="Logout">
        <svg class="logout-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
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
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      currentMasterKey = createdKey.trim();
      await showCustomModal("Setup Complete", "Master key saved to Firestore successfully!");
    } else {
      const data = docSnap.data();
      currentMasterKey = data.masterKey;

      // Cache the super admin profile details into sessionStorage for author tracking
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
    await showCustomModal("Connection Error", "Failed to verify configuration against Firestore. You may be offline or lacking permissions.");
    document.body.innerHTML = `
      <div class="fatal-error-container" style="padding: 40px; text-align: center; font-family: sans-serif;">
        <div>
          <h2 class="error-heading" style="color: #ef4444; margin-bottom: 10px;">Connection / Permission Error</h2>
          <p class="error-text" style="color: #64748b; margin-bottom: 20px;">Failed to verify configuration against Firestore.</p>
          <pre style="background: #f1f5f9; padding: 12px; border-radius: 6px; text-align: left; max-width: 600px; margin: 0 auto; overflow-x: auto; font-size: 12px; color: #b91c1c;">${error.message}</pre>
        </div>
      </div>`;
  }
}
// Master initializer binding core modules and fully functional extended feature modules
async function initializeSuperAdminPortal(configDocRef) {
  loadRegisteredSchools();
  setupAdminActions();
  
  // Fully implemented features
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

// 1. Fetch & Display Schools List + Populate Select Options
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
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="5" class="table-empty-notice">No schools registered yet. Provision your first tenant above.</td></tr>`;
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
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="5" class="table-error-notice">Failed to fetch tenant data from Firestore.</td></tr>`;
  }
}

// 2. Setup Super Admin Event Listeners & Migration Handlers
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
        await showCustomModal("Selection Required", "Please select a target school first to map the legacy collections into.");
        return;
      }

      const confirmed = await showCustomModal(
        "Confirm Migration", 
        `Are you sure you want to map all unassigned root data documents across all ${collectionsToMigrate.length} collections to school ID: "${targetSchoolId}"?`, 
        "confirm"
      );

      if (!confirmed) return;

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

        await logAuditAction("DATA_MIGRATION", `Migrated ${totalUpdated} legacy documents across root collections to school: ${targetSchoolId}`);
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
  } catch (err) {
    // Silent fail if offline or permission denied
  }
}

// ==========================================
// 10 FULLY FUNCTIONAL SUPER ADMIN FEATURES
// ==========================================

// Helper function to create feature sections cleanly without inline styles
function createFeatureSection(titleText, elementId) {
  const wrapper = document.createElement("div");
  wrapper.id = elementId;
  wrapper.className = "admin-feature-card";
  const mainContent = document.querySelector("main") || document.body;
  mainContent.appendChild(wrapper);
  return wrapper;
}

// Feature 1: Global Announcement Broadcaster with Management (Edit, Delete & Publish)
function initGlobalAnnouncements() {
  // Maintaining full UI layout structure with updated input field IDs for single-doc handling
  const container = document.getElementById("featureAnnouncements") || createFeatureSection("Global Announcement Broadcaster", "featureAnnouncements");
  
  container.innerHTML = `
    <h3 class="feature-title">📢 Global Announcement Broadcaster</h3>
    
    <!-- Form for Creating / Editing -->
    <div id="announcementFormCard" style="background: var(--bg-main, #f8fafc); padding: 16px; border-radius: 8px; border: 1px solid var(--border, #e2e8f0); margin-bottom: 20px;">
      <h4 id="announceFormHeading" style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">Publish New Broadcast</h4>
      <input type="hidden" id="editingAnnouncementDocId" value="">
      
      <div class="form-group" style="margin-bottom: 12px;">
        <label style="font-size: 13px; font-weight: 600; margin-bottom: 4px; display: block;">Announcement Title</label>
        <input type="text" id="globalAnnounceTitle" placeholder="e.g., 📢 New Notes Available on the Portal!" class="feature-input" style="width: 100%; padding: 8px; border: 1px solid var(--border, #e2e8f0); border-radius: 6px;">
      </div>
      
      <div class="form-group" style="margin-bottom: 12px;">
        <label style="font-size: 13px; font-weight: 600; margin-bottom: 4px; display: block;">Announcement Body / Message</label>
        <textarea id="globalAnnounceText" placeholder="Type platform-wide broadcast message..." class="feature-textarea" style="width: 100%; padding: 8px; border: 1px solid var(--border, #e2e8f0); border-radius: 6px; min-height: 80px;"></textarea>
      </div>
      
      <div class="form-row" style="display: flex; gap: 10px; margin-bottom: 12px;">
        <div class="form-group" style="flex: 1;">
          <label style="font-size: 13px; font-weight: 600; margin-bottom: 4px; display: block;">Priority Level</label>
          <select id="announcePriority" class="feature-select" style="width: 100%; padding: 8px; border: 1px solid var(--border, #e2e8f0); border-radius: 6px;">
            <option value="Urgent">Urgent</option>
            <option value="Normal" selected>Normal</option>
            <option value="Low">Low</option>
          </select>
        </div>
        <div class="form-group" style="flex: 1;">
          <label style="font-size: 13px; font-weight: 600; margin-bottom: 4px; display: block;">Target Audience</label>
          <select id="announceTarget" class="feature-select" style="width: 100%; padding: 8px; border: 1px solid var(--border, #e2e8f0); border-radius: 6px;">
            <option value="all">All Schools & Users</option>
            <option value="teachers">Teachers Only</option>
            <option value="students">Students Only</option>
          </select>
        </div>
      </div>
      
      <div class="feature-controls-row" style="display: flex; gap: 10px;">
        <button id="sendBroadcastBtn" class="btn-primary" style="flex: 1;"><i class="fa-solid fa-bullhorn"></i> Publish Global Broadcast</button>
        <button id="cancelEditBroadcastBtn" class="btn-outline" style="display: none; flex: 0.4;">Cancel</button>
      </div>
    </div>

    <!-- Active Broadcasts Management List -->
    <div style="margin-top: 20px;">
      <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 10px;">Active Global Broadcasts</h4>
      <div id="activeBroadcastsList" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border, #e2e8f0); border-radius: 6px; padding: 10px; background: #fff;">
        <p style="color: var(--text-muted, #64748b); font-size: 13px; text-align: center; padding: 15px;">Loading active broadcasts...</p>
      </div>
    </div>
  `;

  // Helper to reset form state
  const resetForm = () => {
    document.getElementById("editingAnnouncementDocId").value = "";
    document.getElementById("globalAnnounceTitle").value = "";
    document.getElementById("globalAnnounceText").value = "";
    document.getElementById("announcePriority").value = "Normal";
    document.getElementById("announceTarget").value = "all";
    document.getElementById("announceFormHeading").innerText = "Publish New Broadcast";
    document.getElementById("sendBroadcastBtn").innerHTML = `<i class="fa-solid fa-bullhorn"></i> Publish Global Broadcast`;
    document.getElementById("cancelEditBroadcastBtn").style.display = "none";
  };

  document.getElementById("cancelEditBroadcastBtn").addEventListener("click", resetForm);

  // Load and Render Existing Broadcasts for Management using schoolId == "all"
  const loadActiveBroadcasts = async () => {
    const listContainer = document.getElementById("activeBroadcastsList");
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
        const safeTitle = item.title.replace(/"/g, '&quot;');
        const safeBody = item.body.replace(/"/g, '&quot;');
        
        html += `
          <tr style="border-bottom: 1px solid var(--border, #e2e8f0);">
            <td style="padding: 8px;">
              <strong>${item.title}</strong><br>
              <span style="color: var(--text-muted, #64748b); font-size: 11px;">${item.body.substring(0, 50)}...</span>
            </td>
            <td style="padding: 8px;"><span style="padding: 2px 6px; border-radius: 4px; font-size: 11px; background: #e0f2fe; color: #0369a1;">${item.priority}</span></td>
            <td style="padding: 8px; text-transform: capitalize;">${item.targetAudience}</td>
            <td style="padding: 8px; text-align: right; white-space: nowrap;">
              <button class="btn-outline edit-broadcast-btn" data-id="${docId}" data-title="${safeTitle}" data-body="${safeBody}" data-priority="${item.priority}" data-target="${item.targetAudience}" style="padding: 4px 8px; font-size: 11px; margin-right: 4px;"><i class="fa-solid fa-pen"></i> Edit</button>
              <button class="btn-warning delete-broadcast-btn" data-id="${docId}" data-title="${safeTitle}" style="padding: 4px 8px; font-size: 11px; background: #ef4444; border: none; color: white;"><i class="fa-solid fa-trash"></i> Delete</button>
            </td>
          </tr>`;
      });

      html += `</tbody></table>`;
      listContainer.innerHTML = html;

      // Attach Event Listeners for Edit Action
      document.querySelectorAll(".edit-broadcast-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          document.getElementById("globalAnnounceTitle").value = btn.getAttribute("data-title");
          document.getElementById("globalAnnounceText").value = btn.getAttribute("data-body");
          document.getElementById("announcePriority").value = btn.getAttribute("data-priority");
          document.getElementById("announceTarget").value = btn.getAttribute("data-target");
          
          document.getElementById("editingAnnouncementDocId").value = btn.getAttribute("data-id");
          document.getElementById("announceFormHeading").innerText = "Edit Global Broadcast";
          document.getElementById("sendBroadcastBtn").innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Update Global Broadcast`;
          document.getElementById("cancelEditBroadcastBtn").style.display = "block";
          
          document.getElementById("announcementFormCard").scrollIntoView({ behavior: 'smooth' });
        });
      });

      // Attach Event Listeners for Delete Action
      document.querySelectorAll(".delete-broadcast-btn").forEach(btn => {
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
      listContainer.innerHTML = `<p style="color: #ef4444; font-size: 13px; text-align: center; padding: 15px;">Failed to load broadcasts list.</p>`;
    }
  };

  loadActiveBroadcasts();

  // Publish / Update Submission Handler using single document set/update
  document.getElementById("sendBroadcastBtn").addEventListener("click", async () => {
    const title = document.getElementById("globalAnnounceTitle").value.trim();
    const body = document.getElementById("globalAnnounceText").value.trim();
    const priority = document.getElementById("announcePriority").value;
    const target = document.getElementById("announceTarget").value;
    const editingDocId = document.getElementById("editingAnnouncementDocId").value;

    if (!title || !body) {
      await showCustomModal("Validation Error", "Both announcement title and body message are required.");
      return;
    }

    const session = getCurrentUserSession();
    const authorName = session ? (session.name || session.fullName || session.username || 'System Administrator') : 'System Administrator';

    const submitBtn = document.getElementById("sendBroadcastBtn");
    submitBtn.disabled = true;
    const isEditing = Boolean(editingDocId);
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${isEditing ? 'Updating...' : 'Publishing...'}`;

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
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i class="fa-solid fa-bullhorn"></i> Publish Global Broadcast`;
    }
  });
}
// Feature 2: Tenant Status & Subscription Manager
function initTenantSubscriptionManager() {
  const container = document.getElementById("featureTenants") || createFeatureSection("Tenant Status & Subscription Manager", "featureTenants");
  container.innerHTML = `
    <h3 class="feature-title">🏫 Tenant Status & Subscriptions</h3>
    <div class="feature-controls-row">
      <input type="text" id="manageSchoolIdInput" placeholder="Enter exact School ID..." class="feature-input-flex" />
      <button id="toggleStatusBtn" class="btn-warning">Toggle Active/Suspended</button>
    </div>
  `;

  document.getElementById("toggleStatusBtn").addEventListener("click", async () => {
    const schoolId = document.getElementById("manageSchoolIdInput").value.trim().toLowerCase();
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
      await logAuditAction("UPDATE_TENANT_STATUS", `Changed school ${schoolId} status to ${newStatus}`);
      await showCustomModal("Success", `School ${schoolId} status updated to ${newStatus.toUpperCase()}.`);
      loadRegisteredSchools();
    } catch (err) {
      await showCustomModal("Error", "Failed to update tenant status.");
    }
  });
}

// Feature 3: Cross-Tenant Global Search
function initCrossTenantSearch() {
  const container = document.getElementById("featureSearch") || createFeatureSection("Cross-Tenant Global Search", "featureSearch");
  container.innerHTML = `
    <h3 class="feature-title">🔍 Cross-Tenant Global Search</h3>
    <div class="feature-controls-row">
      <input type="text" id="globalSearchQuery" placeholder="Search users, quizzes, threads..." class="feature-input-flex" />
      <button id="executeGlobalSearchBtn" class="btn-primary">Search</button>
    </div>
    <div id="globalSearchResults" class="feature-results-box"></div>
  `;

  document.getElementById("executeGlobalSearchBtn").addEventListener("click", async () => {
    const query = document.getElementById("globalSearchQuery").value.trim().toLowerCase();
    const resultsContainer = document.getElementById("globalSearchResults");
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
            html += `<div class="search-result-item">[<b>${col}</b>] ID: ${doc.id} (School: ${data.schoolId || 'N/A'})</div>`;
          }
        });
      }

      resultsContainer.innerHTML = matches > 0 ? html : `<div>No matching records found for "${query}".</div>`;
    } catch (err) {
      resultsContainer.innerHTML = `<span class="text-error">Search failed due to permissions or connection.</span>`;
    }
  });
}

// Feature 4: Comprehensive System Audit Logs
function initAuditLogsViewer() {
  const container = document.getElementById("featureAudit") || createFeatureSection("System Audit Logs", "featureAudit");
  container.innerHTML = `
    <h3 class="feature-title">📋 Comprehensive Audit Trail</h3>
    <button id="refreshAuditBtn" class="btn-secondary-small">Refresh Logs</button>
    <div id="auditLogsList" class="audit-logs-container">Click Refresh to load system audit trails.</div>
  `;

  document.getElementById("refreshAuditBtn").addEventListener("click", async () => {
    const listEl = document.getElementById("auditLogsList");
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
        const time = d.timestamp ? new Date(d.timestamp.seconds * 1000).toLocaleString() : "Just now";
        html += `<div class="audit-log-row"><strong class="audit-action-title">[${d.actionType}]</strong> ${d.details} <span class="audit-timestamp">${time}</span></div>`;
      });
      listEl.innerHTML = html;
    } catch (err) {
      listEl.innerHTML = "<span class='text-error'>Failed to load audit logs. Ensure Firestore index exists.</span>";
    }
  });
}

// Feature 5: Global Backup & Snapshot Generator
function initBackupGenerator() {
  const container = document.getElementById("featureBackup") || createFeatureSection("Global Backup & Snapshot Generator", "featureBackup");
  container.innerHTML = `
    <h3 class="feature-title">💾 Global Backup & Snapshot</h3>
    <p class="feature-description">Export entire multi-tenant database collections into a downloadable JSON backup file.</p>
    <button id="generateBackupBtn" class="btn-success">Download Full JSON Backup</button>
  `;

  document.getElementById("generateBackupBtn").addEventListener("click", async () => {
    try {
      const backupData = {};
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

      await logAuditAction("GENERATE_BACKUP", "Downloaded complete system JSON backup snapshot.");
      await showCustomModal("Success", "Backup snapshot generated and downloaded successfully.");
    } catch (err) {
      await showCustomModal("Error", "Backup generation failed.");
    }
  });
}

// Feature 6: Centralized E-Resource Repository Manager
function initGlobalEResources() {
  const container = document.getElementById("featureEResources") || createFeatureSection("Centralized E-Resource Repository Manager", "featureEResources");
  container.innerHTML = `
    <h3 class="feature-title">📚 Centralized E-Resource Publisher</h3>
    <input type="text" id="globalResTitle" placeholder="Resource Title..." class="feature-input-block" />
    <input type="text" id="globalResUrl" placeholder="Download Link / URL..." class="feature-input-block" />
    <button id="publishGlobalResBtn" class="btn-primary">Publish to All Schools</button>
  `;

  document.getElementById("publishGlobalResBtn").addEventListener("click", async () => {
    const title = document.getElementById("globalResTitle").value.trim();
    const url = document.getElementById("globalResUrl").value.trim();
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
      await logAuditAction("PUBLISH_GLOBAL_RESOURCE", `Published central resource: ${title}`);
      document.getElementById("globalResTitle").value = "";
      document.getElementById("globalResUrl").value = "";
      await showCustomModal("Success", "Resource successfully published across all school e-libraries.");
    } catch (err) {
      await showCustomModal("Error", "Failed to publish resource.");
    }
  });
}

// Feature 7: Global Analytics & Telemetry Dashboard
function initTelemetryDashboard() {
  const container = document.getElementById("featureTelemetry") || createFeatureSection("Global Analytics & Telemetry Dashboard", "featureTelemetry");
  container.innerHTML = `
    <h3 class="feature-title">📈 Telemetry & Analytics</h3>
    <button id="loadTelemetryBtn" class="btn-secondary-small">Fetch Live Telemetry Stats</button>
    <div id="telemetryStatsContent" class="feature-description">Click button to aggregate system stats.</div>
  `;

  document.getElementById("loadTelemetryBtn").addEventListener("click", async () => {
    const contentEl = document.getElementById("telemetryStatsContent");
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
        <div class="telemetry-grid">
          <div class="telemetry-card"><strong class="telemetry-number">${totalUsers}</strong><br>Users</div>
          <div class="telemetry-card"><strong class="telemetry-number">${totalQuizzes}</strong><br>Quizzes</div>
          <div class="telemetry-card"><strong class="telemetry-number">${totalSubmissions}</strong><br>Submissions</div>
        </div>
      `;
    } catch (err) {
      contentEl.innerHTML = "<span class='text-error'>Failed to load analytics telemetry.</span>";
    }
  });
}

// Feature 8: System Maintenance & Read-Only Mode Switch
function initMaintenanceModeToggle(configDocRef) {
  const container = document.getElementById("featureMaintenance") || createFeatureSection("System Maintenance Mode", "featureMaintenance");
  container.innerHTML = `
    <h3 class="feature-title">🛡️ System Maintenance Mode</h3>
    <p class="feature-description">Toggle global read-only mode to lock standard user writes during updates.</p>
    <button id="toggleMaintenanceBtn" class="btn-danger">Toggle Maintenance Lock</button>
  `;

  document.getElementById("toggleMaintenanceBtn").addEventListener("click", async () => {
    try {
      const snap = await configDocRef.get();
      const currentMode = snap.exists ? (snap.data().maintenanceMode || false) : false;
      const newMode = !currentMode;

      await configDocRef.set({ maintenanceMode: newMode }, { merge: true });
      await logAuditAction("TOGGLE_MAINTENANCE", `Set system maintenance mode to: ${newMode}`);
      await showCustomModal("Success", `System Maintenance Mode is now ${newMode ? 'ENABLED (Locked)' : 'DISABLED (Normal)'}.`);
    } catch (err) {
      await showCustomModal("Error", "Failed to toggle maintenance mode.");
    }
  });
}

// Feature 9: Custom Feature Flag / Module Toggler
function initFeatureFlagTogglers() {
  const container = document.getElementById("featureFlags") || createFeatureSection("Custom Feature Flag & Module Toggler", "featureFlags");
  container.innerHTML = `
    <h3 class="feature-title">⚡ Feature Flags & Modules</h3>
    <div class="feature-controls-row">
      <input type="text" id="flagSchoolId" placeholder="School ID..." class="feature-input-flex" />
      <select id="flagModule" class="feature-select">
        <option value="live_classes">Live Classes Portal</option>
        <option value="ai_formulas">AI Formula Submissions</option>
        <option value="discussions">Forum Discussions</option>
      </select>
    </div>
    <button id="toggleModuleBtn" class="btn-primary">Toggle Module Access</button>
  `;

  document.getElementById("toggleModuleBtn").addEventListener("click", async () => {
    const schoolId = document.getElementById("flagSchoolId").value.trim().toLowerCase();
    const moduleName = document.getElementById("flagModule").value;
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
      await logAuditAction("TOGGLE_FEATURE_FLAG", `Set module ${moduleName} for school ${schoolId} to ${newState}`);
      await showCustomModal("Success", `Module "${moduleName}" for school ${schoolId} is now ${newState ? 'ENABLED' : 'DISABLED'}.`);
    } catch (err) {
      await showCustomModal("Error", "Failed to update feature flag.");
    }
  });
}

// Feature 10: Master Admin Access & Credential Rotator
function initKeyRotator(configDocRef) {
  const container = document.getElementById("featureKeyRotator") || createFeatureSection("Master Admin Key Rotator", "featureKeyRotator");
  container.innerHTML = `
    <h3 class="feature-title">🔑 Master Key Rotator</h3>
    <button id="rotateMasterKeyBtn" class="btn-purple">Change Master Admin Key</button>
  `;

  document.getElementById("rotateMasterKeyBtn").addEventListener("click", async () => {
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
      await logAuditAction("ROTATE_MASTER_KEY", "Rotated super admin master secret key.");
      await showCustomModal("Success", "Master key updated successfully!");
    } catch (err) {
      await showCustomModal("Error", "Failed to update master key.");
    }
  });
} 

// Helper function to create feature sections cleanly inside the 2-column grid container
function createFeatureSection(titleText, elementId) {
  let grid = document.querySelector(".feature-cards-grid");
  if (!grid) {
    const mainContent = document.querySelector("main") || document.body;
    grid = document.createElement("div");
    grid.className = "feature-cards-grid";
    mainContent.appendChild(grid);
  }
  const wrapper = document.createElement("div");
  wrapper.id = elementId;
  wrapper.className = "admin-feature-card";
  grid.appendChild(wrapper);
  return wrapper;
}

/* ====================================================================
   Additional JavaScript for Mobile Adaptability & UI Enhancements
   ==================================================================== */

// Ensures smooth table scrolling and dynamic viewport adjustments on mobile devices
document.addEventListener("DOMContentLoaded", () => {
  const tableContainer = document.querySelector(".table-container");
  if (tableContainer) {
    tableContainer.setAttribute("tabindex", "0");
    tableContainer.setAttribute("aria-label", "Active Platform Tenants table, scroll horizontally to view more details");
  }

  // Handle dynamic viewport height adjustments for mobile keyboards
  const setMobileViewportFix = () => {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };

  window.addEventListener('resize', setMobileViewportFix);
  setMobileViewportFix();
});
