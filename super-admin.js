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

function showCustomModal(title, message, type = "alert", inputPlaceholder = "", inputType = "text") {
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
      inputContainer.classList.remove("modal-hidden");
      inputField.placeholder = inputPlaceholder;
      // Explicitly sets the type using the parameter, falling back safely to "text"
      inputField.type = inputType;
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
    
    const currentAdmin = getCurrentUserSession();
    
    // Updated HTML template to support dropdown interaction instead of direct logout click
    adminProfileEl.innerHTML = `
      <div id="adminDropdownBtn" style="cursor: pointer; display: flex; align-items: center; gap: 10px;">
        <div style="display: flex; flex-direction: column; text-align: right; line-height: 1.2;">
          <span style="font-weight: 600; font-size: 13px; color: #f8fafc;">${currentAdmin.fullName}</span>
          <span style="font-size: 11px; color: #94a3b8;">@${currentAdmin.username}</span>
        </div>
        <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(239, 68, 68, 0.15); display: flex; align-items: center; justify-content: center;">
          <i class="fa-solid fa-right-from-bracket" style="font-size: 0.85rem; color: #f87171;"></i>
        </div>
      </div>

      <div id="adminDropdownMenu" style="display: none; position: absolute; right: 0; top: 100%; margin-top: 8px; background: #fff; min-width: 220px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid #e2e8f0; z-index: 99999; overflow: hidden;">
        <div style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9; background: #f8fafc;">
          <span style="display: block; font-size: 0.75rem; color: #64748b; font-weight: 600;">Signed in as</span>
          <span style="display: block; font-size: 0.85rem; color: #1e293b; font-weight: bold;">${currentAdmin.fullName}</span>
        </div>
        <a href="network-manager.html" style="display: flex; align-items: center; gap: 10px; padding: 10px 16px; color: #334155; text-decoration: none; font-size: 0.85rem;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
          <i class="fa-solid fa-network-wired" style="color: #0284c7; width: 16px;"></i> Lab Network Management
        </a>
        <a href="#deep-stuff" style="display: flex; align-items: center; gap: 10px; padding: 10px 16px; color: #334155; text-decoration: none; font-size: 0.85rem;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
          <i class="fa-solid fa-brain" style="color: #0284c7; width: 16px;"></i> Deep Stuff
        </a>
        <div style="border-top: 1px solid #f1f5f9; padding: 4px 0;">
          <a href="#" id="actualLogoutBtn" style="display: flex; align-items: center; gap: 10px; padding: 8px 16px; color: #ef4444; text-decoration: none; font-size: 0.85rem;" onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='transparent'">
            <i class="fa-solid fa-right-from-bracket" style="width: 16px;"></i> Sign Out
          </a>
        </div>
      </div>
    `;

    // Dropdown toggle logic
    const dropdownBtn = document.getElementById("adminDropdownBtn");
    const dropdownMenu = document.getElementById("adminDropdownMenu");

    if (dropdownBtn && dropdownMenu) {
      dropdownBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isVisible = dropdownMenu.style.display === "block";
        dropdownMenu.style.display = isVisible ? "none" : "block";
      });

      document.addEventListener("click", () => {
        dropdownMenu.style.display = "none";
      });
    }

    // Secure logout execution handler tied exclusively to the dropdown's "Sign Out" option
    const actualLogoutBtn = document.getElementById("actualLogoutBtn");
    if (actualLogoutBtn) {
      actualLogoutBtn.addEventListener("click", async (e) => {
        e.preventDefault();
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
  }
});
  const checkDbInterval = setInterval(async () => {
    if (window.db) {
      clearInterval(checkDbInterval);
      await enforceFirestoreMasterKeyGate();
    }
  }, 50);


// Self-contained 21st-century modern modal generator with inline CSS and animations
function showModernMasterModal({ title, message, placeholder, isPassword = true, showCancel = true }) {
  return new Promise((resolve) => {
    const existing = document.getElementById('modernMasterModalOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'modernMasterModalOverlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 100000;
      background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      padding: 20px; animation: fadeInModal 0.25s ease-out forwards;
    `;

    overlay.innerHTML = `
      <div style="
        background: #ffffff; width: 100%; max-width: 440px; border-radius: 20px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); overflow: hidden;
        font-family: system-ui, -apple-system, sans-serif;
        transform: translateY(0); animation: scaleUpModal 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      ">
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%); padding: 24px; color: white; display: flex; align-items: center; gap: 16px;">
          <div style="background: rgba(255, 255, 255, 0.2); padding: 12px; border-radius: 14px; display: flex; align-items: center; justify-content: center;">
            <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4v-3.254a6 6 0 1115-1.127z"></path></svg>
          </div>
          <div>
            <h3 style="margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.01em;">${title}</h3>
            <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.85;">Secure Control Panel Gate</p>
          </div>
        </div>
        <div style="padding: 24px;">
          <p style="margin: 0 0 16px 0; font-size: 14px; color: #475569; line-height: 1.5;">${message}</p>
          ${placeholder !== undefined ? `
            <div style="position: relative; margin-bottom: 20px;">
              <input type="${isPassword ? 'password' : 'text'}" id="modernModalInput" placeholder="${placeholder}" style="
                width: 100%; padding: 12px 16px; font-size: 15px; border: 2px solid #e2e8f0; border-radius: 12px;
                outline: none; transition: all 0.2s; box-sizing: border-box; background: #f8fafc; color: #1e293b;
              ">
            </div>
          ` : ''}
          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            ${showCancel ? `
              <button id="modernModalCancel" style="
                padding: 10px 18px; border-radius: 10px; font-weight: 600; font-size: 14px;
                background: #f1f5f9; color: #475569; border: none; cursor: pointer; transition: background 0.2s;
              ">Cancel</button>
            ` : ''}
            <button id="modernModalConfirm" style="
              padding: 10px 20px; border-radius: 10px; font-weight: 600; font-size: 14px;
              background: #4f46e5; color: white; border: none; cursor: pointer; transition: background 0.2s;
              box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
            ">Continue</button>
          </div>
        </div>
      </div>
      <style>
        @keyframes fadeInModal { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleUpModal { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        #modernModalInput:focus { border-color: #4f46e5 !important; background: #fff !important; box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1); }
        #modernModalConfirm:hover { background: #4338ca !important; }
        #modernModalCancel:hover { background: #e2e8f0 !important; }
      </style>
    `;

    document.body.appendChild(overlay);

    const inputEl = document.getElementById('modernModalInput');
    if (inputEl) {
      inputEl.focus();
      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          document.getElementById('modernModalConfirm').click();
        }
      });
    }

    const closeOverlay = (val) => {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 250);
      resolve(val);
    };

    document.getElementById('modernModalConfirm').addEventListener('click', () => {
      const val = inputEl ? inputEl.value : true;
      closeOverlay(val);
    });

    const cancelBtn = document.getElementById('modernModalCancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        closeOverlay(placeholder !== undefined ? null : false);
      });
    }
  });
}

// Self-contained 21st-century modern modal generator with inline CSS and animations
function showModernMasterModal({ title, message, placeholder, isPassword = true, showCancel = true }) {
  return new Promise((resolve) => {
    const existing = document.getElementById('modernMasterModalOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'modernMasterModalOverlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 100000;
      background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      padding: 20px; animation: fadeInModal 0.25s ease-out forwards;
    `;

    overlay.innerHTML = `
      <div style="
        background: #ffffff; width: 100%; max-width: 440px; border-radius: 20px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); overflow: hidden;
        font-family: system-ui, -apple-system, sans-serif;
        transform: translateY(0); animation: scaleUpModal 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      ">
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%); padding: 24px; color: white; display: flex; align-items: center; gap: 16px;">
          <div style="background: rgba(255, 255, 255, 0.2); padding: 12px; border-radius: 14px; display: flex; align-items: center; justify-content: center;">
            <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4v-3.254a6 6 0 1115-1.127z"></path></svg>
          </div>
          <div>
            <h3 style="margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.01em;">${title}</h3>
            <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.85;">Secure Control Panel Gate</p>
          </div>
        </div>
        <div style="padding: 24px;">
          <p style="margin: 0 0 16px 0; font-size: 14px; color: #475569; line-height: 1.5;">${message}</p>
          ${placeholder !== undefined ? `
            <div style="position: relative; margin-bottom: 20px;">
              <input type="${isPassword ? 'password' : 'text'}" id="modernModalInput" placeholder="${placeholder}" style="
                width: 100%; padding: 12px 16px; font-size: 15px; border: 2px solid #e2e8f0; border-radius: 12px;
                outline: none; transition: all 0.2s; box-sizing: border-box; background: #f8fafc; color: #1e293b;
              ">
            </div>
          ` : ''}
          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            ${showCancel ? `
              <button id="modernModalCancel" style="
                padding: 10px 18px; border-radius: 10px; font-weight: 600; font-size: 14px;
                background: #f1f5f9; color: #475569; border: none; cursor: pointer; transition: background 0.2s;
              ">Cancel</button>
            ` : ''}
            <button id="modernModalConfirm" style="
              padding: 10px 20px; border-radius: 10px; font-weight: 600; font-size: 14px;
              background: #4f46e5; color: white; border: none; cursor: pointer; transition: background 0.2s;
              box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
            ">Continue</button>
          </div>
        </div>
      </div>
      <style>
        @keyframes fadeInModal { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleUpModal { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        #modernModalInput:focus { border-color: #4f46e5 !important; background: #fff !important; box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1); }
        #modernModalConfirm:hover { background: #4338ca !important; }
        #modernModalCancel:hover { background: #e2e8f0 !important; }
      </style>
    `;

    document.body.appendChild(overlay);

    const inputEl = document.getElementById('modernModalInput');
    if (inputEl) {
      inputEl.focus();
      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          document.getElementById('modernModalConfirm').click();
        }
      });
    }

    const closeOverlay = (val) => {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 250);
      resolve(val);
    };

    document.getElementById('modernModalConfirm').addEventListener('click', () => {
      const val = inputEl ? inputEl.value : true;
      closeOverlay(val);
    });

    const cancelBtn = document.getElementById('modernModalCancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        closeOverlay(placeholder !== undefined ? null : false);
      });
    }
  });
}

// Renders a high-end 21st-century fallback security screen when access is denied or cancelled
function renderAccessDeniedFallback(reasonTitle, reasonMessage) {
  document.body.innerHTML = `
    <div style="
      position: fixed; inset: 0; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      display: flex; align-items: center; justify-content: center; padding: 20px;
      font-family: system-ui, -apple-system, sans-serif; color: #f8fafc; z-index: 999999;
    ">
      <div style="
        background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.1);
        max-width: 480px; width: 100%; padding: 40px; border-radius: 24px; text-align: center;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      ">
        <div style="
          background: rgba(239, 68, 68, 0.15); color: #ef4444; width: 64px; height: 64px; border-radius: 20px;
          display: flex; align-items: center; justify-content: center; margin: 0 auto 24px auto;
        ">
          <svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
        </div>
        <h1 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 800; letter-spacing: -0.02em; color: #ffffff;">${reasonTitle}</h1>
        <p style="margin: 0 0 32px 0; font-size: 15px; color: #94a3b8; line-height: 1.6;">${reasonMessage}</p>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button onclick="window.location.reload()" style="
            padding: 12px 24px; background: #4f46e5; color: white; border: none; border-radius: 12px;
            font-weight: 600; font-size: 14px; cursor: pointer; transition: background 0.2s; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);
          ">Try Again</button>
          <button onclick="window.location.href='/'" style="
            padding: 12px 24px; background: rgba(255, 255, 255, 0.08); color: #f8fafc; border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 12px; font-weight: 600; font-size: 14px; cursor: pointer; transition: background 0.2s;
          ">Return Home</button>
        </div>
      </div>
    </div>
  `;
}

// Handles Firestore-backed Super Admin Key setup, authentication gate, and advanced feature hooks with fallback routing
async function enforceFirestoreMasterKeyGate() {
  const configDocRef = window.db.collection("system_config").doc("super_admin_settings");

  try {
    const docSnap = await configDocRef.get();
    let currentMasterKey = "";

    if (!docSnap.exists) {
      let createdKey = "";
      while (!createdKey || createdKey.trim().length < 6) {
        createdKey = await showModernMasterModal({
          title: "Initialize Master Key",
          message: "Create your secure master secret key (at least 6 characters):",
          placeholder: "Enter new master key...",
          isPassword: true
        });

        if (createdKey === null) {
          renderAccessDeniedFallback("Setup Cancelled", "Master key configuration is required to secure the administrative control panel.");
          return;
        }
        if (createdKey.trim().length < 6) {
          await showModernMasterModal({
            title: "Invalid Key",
            message: "The master key must be at least 6 characters long.",
            showCancel: false
          });
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
      await showModernMasterModal({
        title: "Setup Complete",
        message: "Master key saved to Firestore successfully!",
        showCancel: false
      });
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

    // Prompt user for the master key with a single strict attempt or cancellation check
    const enteredKey = await showModernMasterModal({
      title: "Restricted Master Access",
      message: "Enter your Super Admin master key to access the control panel:",
      placeholder: "Enter master key...",
      isPassword: true
    });

    if (enteredKey === null) {
      renderAccessDeniedFallback("Access Cancelled", "Authentication was cancelled. Secure entry to the control panel is restricted.");
      return;
    }

    if (enteredKey && currentMasterKey && enteredKey.trim() === currentMasterKey.trim()) {
      sessionStorage.setItem("samcam_super_auth", currentMasterKey.trim());
      await initializeSuperAdminPortal(configDocRef);
    } else {
      renderAccessDeniedFallback("Authentication Failed", "The master key provided was incorrect. Access to this sector has been blocked.");
    }

  } catch (error) {
    console.error("FATAL MASTER KEY GATE ERROR:", error);
    renderAccessDeniedFallback("Connection Error", "Failed to verify configuration against Firestore database.");
  }
}

async function initializeSuperAdminPortal(configDocRef) {
  const wrapper = document.getElementById('secureAdminWrapper');
  if (wrapper) wrapper.style.display = 'block';

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
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="table-empty-notice">No schools registered yet.</td></tr>`;
      return;
    }

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const dateStr = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : "Just now";
      const statusBadge = data.status === 'suspended' ? '<span class="status-badge-suspended">Suspended</span>' : '<span class="status-badge-active">Active</span>';
      const logoUrl = data.logoUrl || 'images/default-avatar.png';
      
      if (tableBody) {
        tableBody.innerHTML += `
          <tr>
            <td><code>${escapeHtml(data.schoolId)}</code></td>
            <td>
              <div style="display: flex; align-items: center; gap: 8px;">
                <img src="${escapeHtml(logoUrl)}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1px solid #cbd5e1; background: #fff;" onerror="this.src='images/default-avatar.png';" />
                <strong>${escapeHtml(data.schoolName)}</strong>
              </div>
            </td>
            <td>${escapeHtml(data.location || "N/A")}</td>
            <td>${statusBadge}</td>
            <td>${dateStr}</td>
            <td>
              <button class="btn-secondary-small" onclick="editSchoolInstance('${escapeHtml(data.schoolId)}')" title="Edit School"><i class="fa-solid fa-pen"></i></button>
              <button class="btn-danger-small" onclick="deleteSchoolInstance('${escapeHtml(data.schoolId)}')" title="Delete School"><i class="fa-solid fa-trash"></i></button>
            </td>
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
    console.error("Load Schools Error:", error);
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="table-error-notice">Failed to fetch tenant data.</td></tr>`;
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

// ==========================================================================
// ADMIN ACTIONS: PROVISION, EDIT, DELETE & LOGO STORAGE
// ==========================================================================
function setupAdminActions() {
  const schoolForm = document.getElementById("superSchoolForm");
  const logoFileInput = document.getElementById("newSchoolLogoFile");
  const logoPreview = document.getElementById("schoolLogoPreview");
  const isEditingInput = document.getElementById("isEditingSchool");
  const schoolIdInput = document.getElementById("newSchoolId");
  const formTitle = document.getElementById("schoolFormTitle");
  const formDesc = document.getElementById("schoolFormDesc");
  const saveBtn = document.getElementById("saveSchoolBtn");
  const cancelEditBtn = document.getElementById("cancelSchoolEditBtn");

  let selectedLogoFile = null;

  // Live Image Preview Handler
  if (logoFileInput && logoPreview) {
    logoFileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        selectedLogoFile = file;
        const reader = new FileReader();
        reader.onload = (uploadEvent) => {
          logoPreview.src = uploadEvent.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Handle Form Submit (Create or Update School)
  if (schoolForm) {
    schoolForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const schoolId = schoolIdInput.value.trim().toLowerCase().replace(/\s+/g, '_');
      const schoolName = document.getElementById("newSchoolName").value.trim();
      const location = document.getElementById("newSchoolLocation").value.trim();
      const isEditing = isEditingInput.value === "true";

      try {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...';

        let logoUrl = logoPreview.src;

        // Upload new logo file to Firebase Storage if selected
        if (selectedLogoFile) {
          const storageRef = firebase.storage().ref(`school_logos/${schoolId}_${Date.now()}`);
          const snapshot = await storageRef.put(selectedLogoFile);
          logoUrl = await snapshot.ref.getDownloadURL();
        }

        const schoolPayload = {
          schoolId,
          schoolName,
          location,
          logoUrl,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (!isEditing) {
          schoolPayload.status = "active";
          schoolPayload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        }

        // Save to Firestore 'schools' collection
        await window.db.collection("schools").doc(schoolId).set(schoolPayload, { merge: true });

        await logAuditAction(
          isEditing ? "UPDATE_SCHOOL" : "PROVISION_SCHOOL", 
          `${isEditing ? 'Updated' : 'Provisioned'} school instance: ${schoolName} (${schoolId})`
        );

        await showCustomModal("Success", `School instance "${schoolName}" has been successfully ${isEditing ? 'updated' : 'provisioned'}.`);
        
        resetSchoolForm();
        if (typeof loadRegisteredSchools === 'function') loadRegisteredSchools();

      } catch (error) {
        console.error("School Save Error:", error);
        await showCustomModal("Error", "Failed to save school instance. Check console for details.");
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = isEditing ? '<i class="fa-solid fa-floppy-disk"></i> Update School' : '<i class="fa-solid fa-plus"></i> Provision School Instance';
      }
    });
  }

  if (cancelEditBtn) {
    cancelEditBtn.addEventListener("click", () => {
      resetSchoolForm();
    });
  }

  function resetSchoolForm() {
    schoolForm.reset();
    isEditingInput.value = "false";
    schoolIdInput.disabled = false;
    formTitle.textContent = "Register New School Instance";
    formDesc.textContent = "Create a brand new tenant record in the global database.";
    saveBtn.innerHTML = '<i class="fa-solid fa-plus" style="margin-right: 6px;"></i> Provision School Instance';
    cancelEditBtn.style.display = "none";
    logoPreview.src = "images/default-avatar.png";
    selectedLogoFile = null;
  }

  // Global Attachments for Edit / Delete Triggered from the Tenants Table
  window.editSchoolInstance = async function(schoolId) {
    try {
      const docSnap = await window.db.collection("schools").doc(schoolId).get();
      if (!docSnap.exists) {
        await showCustomModal("Not Found", "School record not found.");
        return;
      }

      const data = docSnap.data();
      schoolIdInput.value = data.schoolId || schoolId;
      schoolIdInput.disabled = true; // Lock slug during edit
      document.getElementById("newSchoolName").value = data.schoolName || "";
      document.getElementById("newSchoolLocation").value = data.location || "";
      logoPreview.src = data.logoUrl || "images/default-avatar.png";
      
      isEditingInput.value = "true";
      formTitle.textContent = `Edit School: ${data.schoolName || schoolId}`;
      formDesc.textContent = "Modify existing tenant details and branding assets.";
      saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk" style="margin-right: 6px;"></i> Update School Details';
      cancelEditBtn.style.display = "inline-block";

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error("Error loading school for edit:", err);
    }
  };

  window.deleteSchoolInstance = async function(schoolId) {
    const confirmDelete = await showCustomModal(
      "Confirm Deletion",
      `⚠️ Are you sure you want to delete school ID "<strong>${escapeHtml(schoolId)}</strong>"? This action cannot be undone.`,
      "prompt",
      "Type 'DELETE' to confirm"
    );

    if (confirmDelete === null) return;

    try {
      await window.db.collection("schools").doc(schoolId).delete();
      await logAuditAction("DELETE_SCHOOL", `Deleted school instance: ${schoolId}`);
      await showCustomModal("Deleted", `School instance ${schoolId} has been removed.`);
      if (typeof loadRegisteredSchools === 'function') loadRegisteredSchools();
    } catch (err) {
      console.error("Delete Error:", err);
      await showCustomModal("Error", "Failed to delete school instance.");
    }
  };

  // Migration Action Handler...
  const migrationBtn = document.getElementById("executeMigrationBtn");
  if (migrationBtn) {
    migrationBtn.addEventListener("click", async () => {
      const targetSchoolId = document.getElementById("targetSchoolSelect").value;
      
      if (!targetSchoolId) {
        await showCustomModal("Selection Required", "Please select a target school first.");
        return;
      }

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
// FEATURE 2: TENANT STATUS & SUBSCRIPTION MANAGER (WITH LOGO & DEFAULT AVATAR FALLBACK)
// ==========================================================================
function initTenantSubscriptionManager() {
  const container = getFeatureContainer("featureTenants");
  if (!container) return;

  const btn = document.getElementById("toggleStatusBtn");
  const input = document.getElementById("manageSchoolIdInput");

  // 1. Automatically create or inject the live preview container if it doesn't exist yet
  let previewFeed = document.getElementById("tenantLivePreviewFeed");
  if (!previewFeed && input) {
    previewFeed = document.createElement("div");
    previewFeed.id = "tenantLivePreviewFeed";
    previewFeed.style.cssText = "background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; font-size: 0.8rem; color: #475569;";
    input.parentNode.insertBefore(previewFeed, input);
  }

  // 2. Helper to fetch and render tenant metadata in real time with school logo and fallback avatar support
  async function fetchAndRenderTenant(schoolId) {
    const cleanId = schoolId.trim().toLowerCase();
    if (!cleanId) {
      if (previewFeed) {
        previewFeed.innerHTML = `<span style="color: #94a3b8; font-style: italic;">Please enter a valid school ID.</span>`;
      }
      return;
    }

    if (previewFeed) {
      previewFeed.innerHTML = `<div style="text-align: center; color: #64748b;"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading tenant metadata for <strong>${escapeHtml(cleanId)}</strong>...</div>`;
    }

    try {
      const docRef = window.db.collection("schools").doc(cleanId);
      const docSnap = await docRef.get();
      
      if (!docSnap.exists) {
        if (previewFeed) {
          previewFeed.innerHTML = `
            <div style="color: #ef4444; margin-bottom: 0.25rem;"><i class="fa-solid fa-triangle-exclamation"></i> School ID "<strong>${escapeHtml(cleanId)}</strong>" not found.</div>
            <div style="font-size: 0.75rem; color: #94a3b8;">Verify the exact ID in your database or try another registered tenant.</div>
          `;
        }
        return;
      }

      const data = docSnap.data();
      const currentStatus = data.status || "active";
      const isActive = currentStatus === "active";
      const tenantName = data.schoolName || data.name || cleanId;
      
      // Fallback to default avatar image if school logo is not present
      const schoolLogoUrl = data.logoUrl || data.logo || "images/default-avatar.png";

      if (previewFeed) {
        previewFeed.innerHTML = `
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 0.75rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem;">
            <img src="${escapeHtml(schoolLogoUrl)}" alt="School Logo" style="width: 36px; height: 36px; object-fit: cover; border-radius: 50%; border: 1px solid #cbd5e1; background: #fff;" onerror="this.src='images/default-avatar.png';" />
            <div style="flex: 1; overflow: hidden;">
              <div style="font-weight: 700; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(tenantName)}</div>
              <div style="font-size: 0.75rem; color: #64748b;">ID: <strong>${escapeHtml(cleanId)}</strong></div>
            </div>
            <span style="padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: 700; font-size: 0.7rem; background: ${isActive ? '#dcfce7' : '#fee2e2'}; color: ${isActive ? '#166534' : '#b91c1c'};">
              ${currentStatus.toUpperCase()}
            </span>
          </div>
          <div style="font-size: 0.78rem; color: #475569; line-height: 1.4;">
            Subscription Tier: <strong>${escapeHtml(data.subscriptionPlan || 'Enterprise SaaS')}</strong><br>
            Admin Contact: <strong>${escapeHtml(data.adminEmail || data.email || 'admin@stacon.ac.ug')}</strong>
          </div>
        `;
      }

      // Update button contextual label
      if (btn) {
        btn.innerHTML = `<i class="fa-solid fa-toggle-${isActive ? 'on' : 'off'}"></i> ${isActive ? 'Suspend Tenant Account' : 'Activate Tenant Account'}`;
      }

    } catch (err) {
      console.error("Tenant Fetch Error:", err);
      if (previewFeed) {
        previewFeed.innerHTML = `<span style="color: #ef4444;">Error retrieving data from Firestore cloud storage.</span>`;
      }
    }
  }

  // 3. Set default value to 'stacon' and load it immediately on page startup
  if (input) {
    input.value = "stacon";
    fetchAndRenderTenant("stacon");

    // 4. Attach real-time listener so typing any other school ID updates the preview instantly
    input.addEventListener("input", debounce((e) => {
      const val = e.target.value.trim();
      if (val.length > 0) {
        fetchAndRenderTenant(val);
      } else if (previewFeed) {
        previewFeed.innerHTML = `<span style="color: #94a3b8; font-style: italic;">Type a registered school ID to inspect...</span>`;
      }
    }, 300));
  }

  // 5. Toggle Button Click Handler (Action execution)
  if (btn && input) {
    btn.addEventListener("click", async (e) => {
      e.preventDefault(); // Prevent accidental form submission
      
      const schoolId = input.value.trim().toLowerCase();
      
      if (!schoolId) {
        await showCustomModal("Validation Error", "Please enter a valid School/Tenant ID.");
        input.focus();
        return;
      }
      
      try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';

        const docRef = window.db.collection("schools").doc(schoolId);
        const docSnap = await docRef.get();
        
        if (!docSnap.exists) {
          await showCustomModal("Not Found", `No tenant found with ID: <strong>${escapeHtml(schoolId)}</strong>`);
          return;
        }

        const tenantData = docSnap.data();
        const currentStatus = tenantData.status || "active";
        const newStatus = currentStatus === "active" ? "suspended" : "active";
        const tenantName = tenantData.schoolName || tenantData.name || schoolId;

        // Smart Confirmation for Destructive Actions (Suspending a tenant)
        if (newStatus === "suspended") {
           const confirmSuspend = await showCustomModal(
             "Confirm Suspension", 
             `⚠️ WARNING: Are you sure you want to SUSPEND "<strong>${escapeHtml(tenantName)}</strong>"? This will immediately revoke portal access for all their users.`,
             "prompt", 
             "Type 'SUSPEND' to confirm"
           );
           if (confirmSuspend === null) return; 
        }

        const updatePayload = { 
          status: newStatus,
          statusUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          statusUpdatedBy: (window.currentUser && window.currentUser.username) ? window.currentUser.username : "Super Admin" 
        };

        await docRef.update(updatePayload);

        if (typeof logAuditAction === 'function') {
          await logAuditAction("UPDATE_TENANT_STATUS", `Changed tenant [${tenantName}] status to ${newStatus.toUpperCase()}`);
        }

        const statusColor = newStatus === 'active' ? '#10b981' : '#ef4444';
        await showCustomModal(
          "Subscription Updated", 
          `Tenant <span style="font-weight: bold;">${escapeHtml(tenantName)}</span> is now <strong style="color: ${statusColor};">${newStatus.toUpperCase()}</strong>.`
        );
        
        // Refresh the preview box with the newly updated status
        await fetchAndRenderTenant(schoolId);

        if (typeof loadRegisteredSchools === 'function') loadRegisteredSchools();
        
      } catch (err) {
        console.error("Subscription Manager Error:", err);
        await showCustomModal("System Error", "Failed to update tenant status. Please check your network connection and permissions.");
      } finally {
        btn.disabled = false;
        // Restore contextual button label matching current tenant state
        fetchAndRenderTenant(input.value);
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

  // Helper function to fetch all collections dynamically using your Cloud Function
  async function fetchAllCollectionNames() {
    try {
      const response = await fetch('https://us-central1-samcam-system.cloudfunctions.net/listCollections');
      const result = await response.json();
      
      if (result.success && Array.isArray(result.collections)) {
        const excluded = typeof EXCLUDED_COLLECTIONS !== 'undefined' ? EXCLUDED_COLLECTIONS : [];
        return result.collections.filter(col => typeof col === 'string' && !excluded.includes(col));
      }
    } catch (err) {
      console.warn("Could not fetch collections dynamically from Cloud Function, falling back to defaults:", err);
    }
    // Fallback array if network call fails
    return ['users', 'quizzes', 'submissions', 'announcements', 'schools', 'e_library_resources', 'forum_threads', 'blogs'];
  }

  // 1. Manual Backup Snapshot Generator
  if (backupBtn) {
    backupBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      const originalText = backupBtn.innerHTML;
      
      try {
        backupBtn.disabled = true;
        backupBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Discovering Collections...';

        const collectionsToMigrate = await fetchAllCollectionNames();

        backupBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Compiling System Snapshot...';

        const backupData = {
          version: "2.6",
          generatedAt: new Date().toISOString(),
          system: "Samcam Solutions ICT Resource Hub",
          collections: {}
        };
        
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
        const dateSlice = String(new Date().toISOString()).slice(0, 10);
        downloadAnchor.setAttribute("download", `samcam_enterprise_backup_${dateSlice}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();

        if (typeof logAuditAction === 'function') {
          await logAuditAction("GENERATE_BACKUP", "Downloaded complete multi-tenant system JSON backup snapshot using cloud function discovery.");
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
    restoreBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      const file = restoreInput.files[0];
      
      if (!file) {
        restoreInput.click();
        return;
      }

      processBackupFile(file, restoreInput);
    });

    restoreInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (file && restoreBtn) {
        const fileNameSafe = String(file.name || '').slice(0, 15);
        restoreBtn.innerHTML = `<i class="fa-solid fa-file-arrow-up"></i> Process Recovery (${fileNameSafe}...)`;
      }
    });
  }

  // Helper function to read file and spawn the restore modal
  function processBackupFile(file, restoreInputRef) {
    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const rawContent = e.target.result;
        const backupJson = JSON.parse(rawContent);

        if (!backupJson.collections) {
          throw new Error("Invalid backup schema format. Missing collections node.");
        }

        const availableCollections = Object.keys(backupJson.collections);

        let collectionOptionsHTML = `<option value="ALL">🔄 Restore ALL Collections (Full System Recovery)</option>`;
        availableCollections.forEach(col => {
          const count = Array.isArray(backupJson.collections[col]) ? backupJson.collections[col].length : 0;
          collectionOptionsHTML += `<option value="${col}">📁 Single Collection: ${col} (${count} records)</option>`;
        });

        const modalContainer = document.createElement('div');
        modalContainer.className = "custom-restore-modal-overlay";
        modalContainer.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:9999;";
        modalContainer.innerHTML = `
          <div style="background:#fff; padding:2rem; border-radius:12px; width:450px; box-shadow:0 10px 25px rgba(0,0,0,0.2); font-family:inherit;">
            <h3 style="margin-top:0; color:#1e293b; font-size:1.1rem;"><i class="fa-solid fa-database" style="color:#0284c7;"></i> Select Recovery Scope</h3>
            <p style="font-size:0.85rem; color:#64748b; line-height:1.4;">Choose whether you want to restore the entire snapshot database or target a single collection (like blogs).</p>
            
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

        document.getElementById('cancelRestoreBtn').onclick = () => {
          modalContainer.remove();
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
              if (!docObj || typeof docObj !== 'object') continue;
              const docId = docObj.id;
              if (!docId) continue;

              const docData = { ...docObj };
              delete docData.id;

              const docRef = window.db.collection(colName).doc(String(docId));
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
          restoreInputRef.value = "";
          if (restoreBtn) restoreBtn.innerHTML = '<i class="fa-solid fa-database"></i> Restore Database Snapshot';
        };

      } catch (parseErr) {
        console.error("Restoration Parse Error:", parseErr);
        await showCustomModal("Recovery Failed", "The selected backup file is corrupted, malformed, or uses an incompatible schema.");
        restoreInputRef.value = "";
      }
    };
    reader.readAsText(file);
  }

  // 3. Automated Daily Background Check
  checkAndTriggerAutomatedDailyBackup();
}

async function checkAndTriggerAutomatedDailyBackup() {
  const lastBackupKey = "samcam_last_auto_backup_date";
  const todayStr = String(new Date().toISOString()).slice(0, 10);
  const lastBackupDate = localStorage.getItem(lastBackupKey);

  // Check if it's a new day
  if (lastBackupDate !== todayStr) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Check if current time is 10:30 PM (22:30) or later
    if (currentHour > 22 || (currentHour === 22 && currentMinute >= 30)) {
      try {
        if (typeof window.db !== 'undefined' && typeof window.storage !== 'undefined') {
          let collectionsToMigrate = ['users', 'quizzes', 'submissions', 'announcements', 'schools', 'e_library_resources', 'forum_threads', 'blogs'];
          
          try {
            const response = await fetch('https://us-central1-samcam-system.cloudfunctions.net/listCollections');
            const result = await response.json();
            if (result.success && Array.isArray(result.collections)) {
              collectionsToMigrate = result.collections;
            }
          } catch (err) {
            console.warn("Auto-backup using fallback collection list");
          }

          const backupData = {
            version: "2.6",
            generatedAt: now.toISOString(),
            system: "Samcam Solutions ICT Resource Hub - Daily Snapshot",
            collections: {}
          };
          
          for (const col of collectionsToMigrate) {
            try {
              const snap = await window.db.collection(col).get();
              backupData.collections[col] = [];
              snap.forEach(doc => {
                backupData.collections[col].push({ id: doc.id, ...doc.data() });
              });
            } catch (colErr) {
              console.warn(`Could not export collection ${col} for auto backup:`, colErr);
              backupData.collections[col] = [];
            }
          }

          const jsonString = JSON.stringify(backupData, null, 2);
          const blob = new Blob([jsonString], { type: "application/json" });

          const storageRef = window.storage.ref();
          const backupFileRef = storageRef.child('automated_backups/latest_backup.json');
          
          await backupFileRef.put(blob);

          localStorage.setItem(lastBackupKey, todayStr);

          if (typeof logAuditAction === 'function') {
            await logAuditAction("AUTO_BACKUP_SUCCESS", "Automated daily snapshot successfully saved using cloud function collection discovery.");
          }
        }
      } catch (e) {
        console.error("Automated Daily Backup Error:", e);
      }
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
  const descInput = document.getElementById("globalResDescription"); 
  const classLevelSelect = document.getElementById("globalResClassLevel"); 
  const categorySelect = document.getElementById("globalResCategory"); 
  const accessTypeSelect = document.getElementById("globalResAccessType"); 
  const priceInput = document.getElementById("globalResPrice"); 
  const fileInput = document.getElementById("globalResFileInput"); 
  const listContainer = document.getElementById("globalResourcesList") || null;

  // Track active editing ID if user is updating an existing resource
  let editingDocId = null;

  if (publishBtn && titleInput && fileInput) {
    publishBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      const title = titleInput.value.trim();
      const description = descInput ? descInput.value.trim() : "";
      const classLevel = classLevelSelect ? classLevelSelect.value : "S5";
      const category = categorySelect ? categorySelect.value : "Notes & Handouts";
      const accessType = accessTypeSelect ? accessTypeSelect.value : "free";
      const price = priceInput ? parseFloat(priceInput.value) || 0 : 0;
      const file = fileInput.files[0];

      // If creating new, file is mandatory. If editing, file is optional.
      if (!title || (!file && !editingDocId)) {
        if (typeof showCustomModal === 'function') {
          await showCustomModal("Validation Error", "Resource title and a resource file are required fields.");
        }
        return;
      }

      const originalBtnHtml = publishBtn.innerHTML;
      publishBtn.disabled = true;
      publishBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving Resource...';

      try {
        let fileUrl = null;
        let fileName = null;
        let fileType = null;

        // 1. Upload new file if provided
        if (file) {
          const storageRef = window.storage.ref();
          const uniqueFileName = `${Date.now()}_${file.name}`;
          const fileRef = storageRef.child(`e_library_files/${uniqueFileName}`);
          
          const snapshot = await fileRef.put(file);
          fileUrl = await snapshot.ref.getDownloadURL();
          fileName = file.name;
          fileType = file.type || "application/octet-stream";
        }

        // 2. Build payload
        const payload = {
          title,
          description,
          classLevel,
          category,
          accessType,
          price,
          isGlobal: true,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (fileUrl) {
          payload.fileUrl = fileUrl;
          payload.fileName = fileName;
          payload.fileType = fileType;
        }

        if (editingDocId) {
          // Update existing document
          await window.db.collection("e_library_resources").doc(editingDocId).update(payload);
          if (typeof logAuditAction === 'function') {
            await logAuditAction("UPDATE_GLOBAL_RESOURCE", `Updated central e-resource: "${title}"`);
          }
          editingDocId = null;
          publishBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Publish Resource';
        } else {
          // Create new document
          payload.downloads = 0;
          payload.schoolId = window.currentSchoolId || "stacon";
          payload.publisher = window.currentUserEmail || "Super Admin";
          payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();

          await window.db.collection("e_library_resources").add(payload);
          if (typeof logAuditAction === 'function') {
            await logAuditAction("PUBLISH_GLOBAL_RESOURCE", `Published central e-resource file: "${title}" under class [${classLevel}]`);
          }
        }

        // Reset form inputs
        titleInput.value = "";
        if (descInput) descInput.value = "";
        if (priceInput) priceInput.value = "";
        fileInput.value = "";
        if (classLevelSelect) classLevelSelect.selectedIndex = 0;
        if (categorySelect) categorySelect.selectedIndex = 0;
        if (accessTypeSelect) accessTypeSelect.selectedIndex = 0;

        if (typeof showCustomModal === 'function') {
          await showCustomModal("Success", "Resource successfully saved and propagated across the system.");
        }

        if (listContainer) {
          loadCentralizedResourcesFeed(listContainer);
        }
      } catch (err) {
        console.error("Global E-Resource Save Error:", err);
        if (typeof showCustomModal === 'function') {
          await showCustomModal("Operation Failed", "Could not complete action due to permissions or network errors.");
        }
      } finally {
        publishBtn.disabled = false;
        publishBtn.innerHTML = originalBtnHtml;
      }
    });
  }

  // Expose global handler functions for the icon actions
  window.viewGlobalResource = async function(id) {
    try {
      const doc = await window.db.collection("e_library_resources").doc(id).get();
      if (!doc.exists) return;
      const d = doc.data();

      if (d.fileUrl) {
        window.open(d.fileUrl, '_blank');
      } else {
        if (typeof showCustomModal === 'function') {
          await showCustomModal("Resource View", `<strong>${escapeHtml(d.title)}</strong><br><br>${escapeHtml(d.description || 'No description available.')}`);
        }
      }
    } catch (e) {
      console.error("View error:", e);
    }
  };

  window.editGlobalResource = async function(id) {
    try {
      const doc = await window.db.collection("e_library_resources").doc(id).get();
      if (!doc.exists) return;
      const d = doc.data();

      titleInput.value = d.title || "";
      if (descInput) descInput.value = d.description || "";
      if (classLevelSelect) classLevelSelect.value = d.classLevel || "S5";
      if (categorySelect) categorySelect.value = d.category || "Notes & Handouts";
      if (accessTypeSelect) accessTypeSelect.value = d.accessType || "free";
      if (priceInput) priceInput.value = d.price || 0;

      editingDocId = id;
      if (publishBtn) {
        publishBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Update Resource';
      }

      container.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      console.error("Edit preparation error:", e);
    }
  };

  // Toggle global status (isGlobal: true <-> false) for any existing resource
  window.toggleGlobalStatus = async function(id, currentStatus) {
    try {
      const newStatus = !currentStatus;
      await window.db.collection("e_library_resources").doc(id).update({
        isGlobal: newStatus,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      if (typeof logAuditAction === 'function') {
        await logAuditAction("TOGGLE_GLOBAL_STATUS", `Changed global resource state for ID ${id} to [${newStatus}]`);
      }

      if (listContainer) {
        loadCentralizedResourcesFeed(listContainer);
      }
    } catch (e) {
      console.error("Toggle global status error:", e);
      if (typeof showCustomModal === 'function') {
        await showCustomModal("Action Failed", "Could not toggle global resource state due to permission or network errors.");
      }
    }
  };

  window.deleteGlobalResource = async function(id) {
    if (typeof showCustomModal === 'function') {
      const confirmDel = confirm("Are you sure you want to delete this e-resource?");
      if (!confirmDel) return;
    }

    try {
      await window.db.collection("e_library_resources").doc(id).delete();
      if (typeof logAuditAction === 'function') {
        await logAuditAction("DELETE_GLOBAL_RESOURCE", `Deleted e-resource ID: ${id}`);
      }
      if (listContainer) {
        loadCentralizedResourcesFeed(listContainer);
      }
    } catch (e) {
      console.error("Delete error:", e);
    }
  };

  // Live feed renderer listing all resources to allow managing global states, viewing, editing, and deleting
  if (listContainer) {
    loadCentralizedResourcesFeed(listContainer);
  }
}

// Helper function to fetch and display all resources with icon-only actions including global status toggle
async function loadCentralizedResourcesFeed(listContainer) {
  listContainer.innerHTML = `
    <div class="resource-feed-loading">
      <i class="fa-solid fa-circle-notch fa-spin"></i>
      Loading e-library repository manager...
    </div>`;

  try {
    // Fetch all resources (or a comprehensive list) ordered by creation date
    const snap = await window.db.collection("e_library_resources").orderBy("createdAt", "desc").limit(25).get();
    
    if (snap.empty) {
      listContainer.innerHTML = `
        <div class="resource-feed-empty">
          <i class="fa-solid fa-book-bookmark"></i>
          No resources found in the repository yet.
        </div>`;
      return;
    }

    let html = '';
    snap.forEach(doc => {
      const d = doc.data();
      const isGlobal = d.isGlobal === true;
      
      const globalBadgeClass = isGlobal ? 'badge-global-active' : 'badge-global-local';
      const globalIcon = isGlobal ? 'fa-globe' : 'fa-globe-slash';
      const globalTitle = isGlobal ? 'Global Resource (Click to make local)' : 'Local Resource (Click to make global)';

      html += `
        <div class="resource-item-row">
          <div class="resource-item-info">
            <span class="resource-file-icon">
              <i class="fa-solid fa-file-pdf"></i>
            </span>
            <div class="resource-text-content">
              <div class="resource-badges-row">
                <span class="badge-pill badge-class">${escapeHtml(d.classLevel || 'S5')}</span>
                <span class="badge-pill badge-category">${escapeHtml(d.category || 'General')}</span>
                <span class="badge-pill ${globalBadgeClass}">${isGlobal ? 'Global' : 'Local'}</span>
                <span class="resource-downloads-count"><i class="fa-solid fa-download"></i> ${d.downloads || 0}</span>
              </div>
              <h4 class="resource-item-title" title="${escapeHtml(d.title)}">${escapeHtml(d.title)}</h4>
              <p class="resource-item-desc">${escapeHtml(d.description || d.fileName || '')}</p>
            </div>
          </div>
          
          <!-- Icon-Only Action Buttons Bar -->
          <div class="resource-actions-bar">
            <button type="button" class="action-icon-btn btn-toggle-global ${globalBadgeClass}" onclick="toggleGlobalStatus('${doc.id}', ${isGlobal})" title="${globalTitle}">
              <i class="fa-solid ${globalIcon}"></i>
            </button>
            <button type="button" class="action-icon-btn btn-view" onclick="viewGlobalResource('${doc.id}')" title="View Resource">
              <i class="fa-solid fa-eye"></i>
            </button>
            <button type="button" class="action-icon-btn btn-edit" onclick="editGlobalResource('${doc.id}')" title="Edit Resource">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button type="button" class="action-icon-btn btn-delete" onclick="deleteGlobalResource('${doc.id}')" title="Delete Resource">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      `;
    });

    listContainer.innerHTML = `<div class="resource-feed-scroll">${html}</div>`;

  } catch (err) {
    console.error("Error loading resource feed:", err);
    listContainer.innerHTML = `
      <div class="resource-feed-error">
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
