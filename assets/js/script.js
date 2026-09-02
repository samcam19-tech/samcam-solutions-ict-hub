// ==========================================================================
//    SAMCAM SOLUTIONS - ASSESSMENT PORTAL ENGINE (script.js)
// ==========================================================================
// Shared Portal State
window.currentUser = null;
let editingUsername = null;
let currentStudentSubmissionsPage = 1;
const ITEMS_PER_PAGE = 5;

// --- FIREBASE SETUP ---
// Firebase is already initialized in firebase-config.js. 

// --- STATE VARIABLES ---
let assessmentCurrentPage = 1;
let assessmentPerPage = 5;

let submissionCurrentPage = 1;
let submissionPerPage = 5;

let studentCurrentPage = 1;
let studentPerPage = 8;

let currentEditingStudentId = null;

const initialAssessments = [
  {
    "id": 1,
    "class": "S4",
    "category": "Question Paper",
    "title": "Wakissha UCE ICT 2 MOCK 2026",
    "description": "Full practical paper instructions and tasks.",
    "fileUrl": "uploads/Wakissha UCE ICT 2 MOCK 2026.pdf",
    "date": "2026-08-05",
    "deadline": "2026-08-20T23:59"
  }
];

// Helper: Safely get current session
function loadSessionFromStorage() {
  try {
    const raw = localStorage.getItem('portal_session');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error("Corrupted portal_session format:", e);
    return null;
  }
}

// Helper: Broadcast session updates to other modules (like Quiz Engine)
function broadcastSessionUpdate(user) {
  window.currentUser = user;
  
  // Guarantee localStorage persistence before dispatching event
  if (user) {
    localStorage.setItem('portal_session', JSON.stringify(user));
  } else {
    localStorage.removeItem('portal_session');
  }

  // Dispatch custom event for real-time listeners on the same page
  window.dispatchEvent(new CustomEvent('portalSessionChanged', { detail: user }));
}

/* ==========================================================================
    URL ROUTING (HISTORY API) & VIEW STATE MANAGEMENT
   ========================================================================== */
window.navigateToView = function(viewName, pushState = true) {
  const loginSec = document.getElementById('loginSection');
  const dashSec = document.getElementById('dashboardSection');
  const assessmentsSec = document.getElementById('assessmentsSection');
  const submissionsSec = document.getElementById('submissionsSection');
  const studentsSec = document.getElementById('studentsSection');

  // Hide all sections first
  if (loginSec) loginSec.style.display = 'none';
  if (dashSec) dashSec.style.display = 'none';
  if (assessmentsSec) assessmentsSec.style.display = 'none';
  if (submissionsSec) submissionsSec.style.display = 'none';
  if (studentsSec) studentsSec.style.display = 'none';

  if (!window.currentUser) {
    // Explicitly hide all other modules when unauthenticated
    if (dashSec) dashSec.style.display = 'none';
    if (assessmentsSec) assessmentsSec.style.display = 'none';
    if (submissionsSec) submissionsSec.style.display = 'none';
    if (studentsSec) studentsSec.style.display = 'none';

    // Show only the login section
    if (loginSec) loginSec.style.display = 'block';
    if (pushState) history.pushState({ view: 'login' }, '', '#login');
    return;
  }

  // Map viewName to corresponding DOM section
  let targetSection = dashSec;
  if (viewName === 'assessments' && assessmentsSec) targetSection = assessmentsSec;
  else if (viewName === 'submissions' && submissionsSec) targetSection = submissionsSec;
  else if (viewName === 'students' && studentsSec) targetSection = studentsSec;
  else if (viewName === 'dashboard' && dashSec) targetSection = dashSec;

  if (targetSection) {
    targetSection.style.display = 'block';
  } else if (dashSec) {
    dashSec.style.display = 'block';
  }

  if (pushState) {
    history.pushState({ view: viewName }, '', `#${viewName}`);
  }
};

window.addEventListener('popstate', (event) => {
  if (event.state && event.state.view) {
    navigateToView(event.state.view, false);
  } else {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    navigateToView(hash, false);
  }
});

/* ==========================================================================
    UNIFIED INITIALIZATION & SESSION PERSISTENCE
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  // Navigation & Menu toggles
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', toggleMobileMenu);
  }

  // 1. Initialize default collections if missing
  if (!localStorage.getItem('portal_resources')) {
    localStorage.setItem('portal_resources', JSON.stringify(initialAssessments));
  }
  if (!localStorage.getItem('portal_submissions')) {
    localStorage.setItem('portal_submissions', JSON.stringify([]));
  }

  // 2. Restore session
  const session = loadSessionFromStorage();
  broadcastSessionUpdate(session);

  const navActions = document.getElementById('authNavActions');

  if (!session) {
    if (navActions) navActions.style.display = 'none';
    navigateToView('login', false);
  } else {
    if (navActions) navActions.style.display = 'flex';

    // 3. Refresh UI components
    if (typeof updatePortalUI === 'function') {
      updatePortalUI();
    }

    // 4. Handle initial route based on URL hash (keeps user on current view after refresh)
    const currentHash = window.location.hash.replace('#', '').trim();
    const validViews = ['dashboard', 'assessments', 'submissions', 'students'];
    const initialView = validViews.includes(currentHash) ? currentHash : 'dashboard';
    
    navigateToView(initialView, false);
  }

  // Live countdown timer interval (updates every second)
  setInterval(() => {
    if (typeof updateCountdowns === 'function') {
      updateCountdowns();
    }
  }, 1000);
});

/* ==========================================================================
    1. AUTO-FILL REMEMBERED DETAILS ON PAGE LOAD
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const savedUser = localStorage.getItem('portal_remembered_user');
  const savedPass = localStorage.getItem('portal_remembered_pass');
  
  const userEl = document.getElementById('loginUsername');
  const passEl = document.getElementById('loginPassword');
  const rememberCheck = document.getElementById('rememberMeCheck');

  if (savedUser && userEl) {
    userEl.value = savedUser;
    if (savedPass && passEl) {
      passEl.value = savedPass;
    }
    if (rememberCheck) {
      rememberCheck.checked = true;
    }
  }
});


/* ==========================================================================
    2. EXECUTE LOGIN (WITH SINGLE-DEVICE RESTRICTION & REMEMBER ME)
   ========================================================================== */
/**
 * Helper function to fetch the user's actual public IP address and approximate location using ipwho.is
 */
async function fetchClientIPAndLocation() {
  try {
    const response = await fetch('https://ipwho.is/');
    const data = await response.json();
    
    if (data.success) {
      return {
        ip: data.ip || '127.0.0.1',
        location: `${data.city || 'Unknown City'}, ${data.country || 'Unknown Country'}`
      };
    } else {
      throw new Error(data.message || 'Geolocation lookup failed');
    }
  } catch (err) {
    console.warn("Could not retrieve public IP or location via ipwho.is, trying fallback:", err);
    
    // Fallback backup API
    try {
      const fallbackRes = await fetch('https://ipapi.co/json/');
      const fallbackData = await fallbackRes.json();
      if (fallbackData.ip) {
        return {
          ip: fallbackData.ip,
          location: `${fallbackData.city || 'Unknown City'}, ${fallbackData.country_name || 'Unknown Country'}`
        };
      }
    } catch (e) {}

    return {
      ip: '127.0.0.1',
      location: 'Unknown Location'
    };
  }
}

/**
 * Helper function to record login attempts with guaranteed Firestore write confirmation
 */
async function logAuthenticationAttempt(status, schoolId, failureReason = '—') {
  const clientData = await fetchClientIPAndLocation();

  const auditEntry = {
    status: status, // 'SUCCESS' or 'FAILED'
    timestamp: new Date().toISOString(),
    schoolId: schoolId || 'unknown_school_id',
    failureReason: failureReason,
    ipAddress: clientData.ip,
    location: clientData.location,
    userAgent: navigator.userAgent || 'Unknown Device',
    dateStr: new Date().toISOString().slice(0, 10)
  };

  let firestoreSuccess = false;

  // 1. Try writing to Firestore
  if (window.db) {
    try {
      console.log("Writing audit log to Firestore collection 'audit_logs'...");
      await window.db.collection('audit_logs').add(auditEntry);
      console.log("Audit log successfully written to Firestore!");
      firestoreSuccess = true;
    } catch (err) {
      console.error("Firestore audit log write failed:", err.message);
    }
  } else {
    console.warn("window.db is not available. Skipping Firestore write.");
  }

  // 2. Always fallback / mirror to LocalStorage to guarantee data persistence
  try {
    const localLogs = JSON.parse(localStorage.getItem('portal_audit_logs')) || [];
    localLogs.unshift(auditEntry);
    if (localLogs.length > 200) localLogs.pop();
    localStorage.setItem('portal_audit_logs', JSON.stringify(localLogs));
    console.log("Audit log saved to localStorage fallback.");
  } catch (e) {
    console.error("Error saving audit log to localStorage fallback:", e);
  }

  return firestoreSuccess;
}

// Floating Toast Notification Helper (if not already defined globally)
function showToast(message, type = 'error') {
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px; pointer-events: none;';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.style.cssText = `
    background: ${type === 'error' ? '#e74c3c' : '#2ecc71'};
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-family: inherit;
    font-size: 14px;
    pointer-events: auto;
    transition: opacity 0.3s ease, transform 0.3s ease;
    opacity: 0;
    transform: translateY(-10px);
  `;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

window.executeLogin = async function() {
  const userEl = document.getElementById('loginUsername');
  const passEl = document.getElementById('loginPassword');
  const rememberCheck = document.getElementById('rememberMeCheck');
  const errEl = document.getElementById('loginError');

  if (!userEl || !passEl) return;

  const usernameInput = userEl.value.trim();
  const p = passEl.value.trim();

  if (!usernameInput || !p) {
    showToast('Please fill in both fields.', 'error');
    if (errEl) {
      errEl.textContent = 'Please fill in both fields.';
      errEl.style.display = 'block';
    }
    return;
  }

  let foundUser = null;
  let failureReason = 'USERNAME_NOT_FOUND';

  // 1. Primary Auth: Firebase Firestore querying by username field or direct document ID match
  if (window.db) {
    try {
      // Query by 'username' field
      const snapQuery = await window.db.collection('users').where('username', '==', usernameInput).limit(1).get();
      if (!snapQuery.empty) {
        const snapDoc = snapQuery.docs[0];
        const userData = snapDoc.data();
        if (userData.password === p) {
          foundUser = {
            id: snapDoc.id,
            username: userData.username || usernameInput,
            name: userData.fullName || userData.name || usernameInput,
            role: userData.role || 'Student',
            userClass: userData.class || userData.userClass || '',
            schoolId: userData.schoolId || '',
            profilePic: userData.profilePic || '',
            ...userData
          };
        } else {
          failureReason = 'INVALID_PASSWORD';
        }
      } else {
        // Fallback document lookup by direct document ID (matching username like 'bonitah')
        const docSnap = await window.db.collection('users').doc(usernameInput).get();
        if (docSnap.exists) {
          const userData = docSnap.data();
          if (userData.password === p) {
            foundUser = {
              id: docSnap.id,
              username: userData.username || usernameInput,
              name: userData.fullName || userData.name || usernameInput,
              role: userData.role || 'Student',
              userClass: userData.class || userData.userClass || '',
              schoolId: userData.schoolId || '',
              profilePic: userData.profilePic || '',
              ...userData
            };
          } else {
            failureReason = 'INVALID_PASSWORD';
          }
        } else {
          // Lowercase document lookup fallback
          const docSnapLower = await window.db.collection('users').doc(usernameInput.toLowerCase()).get();
          if (docSnapLower.exists) {
            const userData = docSnapLower.data();
            if (userData.password === p) {
              foundUser = {
                id: docSnapLower.id,
                username: userData.username || usernameInput,
                name: userData.fullName || userData.name || usernameInput,
                role: userData.role || 'Student',
                userClass: userData.class || userData.userClass || '',
                schoolId: userData.schoolId || '',
                profilePic: userData.profilePic || '',
                ...userData
              };
            } else {
              failureReason = 'INVALID_PASSWORD';
            }
          }
        }
      }
    } catch (err) {
      console.warn("Firestore lookup error:", err);
    }
  }

  // 2. Offline Fallback: LocalStorage users matching username
  if (!foundUser) {
    try {
      const localUsers = JSON.parse(localStorage.getItem('portal_users')) || [];
      const match = localUsers.find(
        acc => (acc.username || '').toLowerCase() === usernameInput.toLowerCase()
      );
      
      if (match) {
        if (match.password === p) {
          foundUser = {
            id: match.id || match.username || usernameInput,
            username: match.username || usernameInput,
            name: match.fullName || match.name || match.username || usernameInput,
            role: match.role || 'Student',
            userClass: match.class || match.userClass || '',
            schoolId: match.schoolId || '',
            profilePic: match.profilePic || '',
            ...match
          };
        } else {
          failureReason = 'INVALID_PASSWORD';
        }
      }
    } catch (e) {
      console.error("Error checking portal_users fallback:", e);
    }
  }

  // 3. Complete Login & Record Audit Trail
  if (foundUser) {
    await logAuthenticationAttempt('SUCCESS', foundUser.username, '—');

    showToast(`Welcome back, ${foundUser.name || foundUser.username}!`, 'success');
    if (errEl) errEl.style.display = 'none';

    const currentDeviceSessionId = 'sess_' + Math.random().toString(36).substring(2) + Date.now();
    foundUser.activeSessionId = currentDeviceSessionId;

    if (window.db) {
      try {
        const userDocId = foundUser.id || foundUser.username.toLowerCase();
        await window.db.collection('users').doc(userDocId).set({
          activeSessionId: currentDeviceSessionId
        }, { merge: true });
      } catch (err) {
        console.warn("Could not sync active session token to Firestore:", err);
      }
    }

    if (rememberCheck && rememberCheck.checked) {
      localStorage.setItem('portal_remembered_user', usernameInput);
      localStorage.setItem('portal_remembered_pass', p);
    } else {
      localStorage.removeItem('portal_remembered_user');
      localStorage.removeItem('portal_remembered_pass');
    }

    localStorage.setItem('portal_session', JSON.stringify(foundUser));
    
    if (typeof broadcastSessionUpdate === 'function') {
      broadcastSessionUpdate(foundUser);
    }

    const navActions = document.getElementById('authNavActions');
    if (navActions) {
      navActions.style.display = 'flex';
    }

    if (typeof updatePortalUI === 'function') updatePortalUI();

    // Redirect cleanly to the main dashboard page
    window.location.replace('../assessments/index.html');
  } else {
    await logAuthenticationAttempt('FAILED', usernameInput, failureReason);

    const errorMessage = failureReason === 'INVALID_PASSWORD' 
      ? 'Incorrect password! Please try again.' 
      : 'Username not found!';

    showToast(errorMessage, 'error');

    if (errEl) {
      errEl.textContent = errorMessage;
      errEl.style.display = 'block';
    }
  }
};

/// Check every 10 seconds if another device has logged into this same account
setInterval(async () => {
  const sessionStr = localStorage.getItem('portal_session');
  if (!sessionStr) return;

  const currentSession = JSON.parse(sessionStr);
  if (!currentSession || !currentSession.schoolId || !currentSession.activeSessionId) return;

  if (window.db) {
    try {
      const userDocId = currentSession.id || currentSession.schoolId.toLowerCase();
      const userDoc = await window.db.collection('users').doc(userDocId).get();
      if (userDoc.exists) {
        const remoteData = userDoc.data();
        // If the active session token in the database doesn't match local session, another device logged in!
        if (remoteData.activeSessionId && remoteData.activeSessionId !== currentSession.activeSessionId) {
          
          // Clear session immediately so background requests stop
          localStorage.removeItem('portal_session');

          // Trigger the custom modal
          showCustomModal({
            title: "Session Terminated",
            message: "Your account was logged into from another device. You have been logged out.",
            type: "warning"
          });

          // Wait 5 seconds before refreshing back to the login screen
          setTimeout(() => {
            window.location.reload();
          }, 5000);
        }
      }
    } catch (err) {
      // Ignore network blips during background check
    }
  }
}, 10000); // Checks every 10 seconds

/* ==========================================================================
    PASSWORD VISIBILITY TOGGLE HELPER
   ========================================================================== */
window.togglePasswordVisibility = function(passwordFieldId, iconElementId) {
  const passField = document.getElementById(passwordFieldId);
  const icon = document.getElementById(iconElementId);

  if (!passField) return;

  if (passField.type === 'password') {
    passField.type = 'text';
    if (icon) {
      icon.classList.remove('fa-eye');
      icon.classList.add('fa-eye-slash');
    }
  } else {
    passField.type = 'password';
    if (icon) {
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
    }
  }
};

window.handleLogout = function() {
  // 1. Clear ALL possible session and local storage locations
  localStorage.removeItem('portal_session');
  localStorage.removeItem('currentLoggedInUser');
  localStorage.removeItem('currentUser');
  localStorage.removeItem('portal_resources');
  localStorage.removeItem('portal_submissions');
  
  sessionStorage.removeItem('portal_session');
  sessionStorage.removeItem('currentLoggedInUser');

  // 2. Clear global user memory states and broadcast updates if available
  if (typeof broadcastSessionUpdate === 'function') {
    broadcastSessionUpdate(null);
  }
  window.currentUser = null;

  // 3. Reset input fields if present on the page
  const userEl = document.getElementById('loginUsername');
  const passEl = document.getElementById('loginPassword');
  const errEl = document.getElementById('loginError');

  if (userEl) userEl.value = '';
  if (passEl) passEl.value = '';
  if (errEl) errEl.style.display = 'none';

  // 4. Hide authenticated navigation links
  const authNavActions = document.getElementById('authNavActions');
  if (authNavActions) {
    authNavActions.style.display = 'none';
  }

  if (typeof updatePortalUI === 'function') {
    updatePortalUI();
  }

  // 5. Redirect back to the standalone login page (adjust relative depth if needed)
  window.location.replace('../login.html');
};

/* ==========================================================================
   PROFILE PICTURE UPLOAD & UI DISPLAY MODULE
   ========================================================================== */

// 1. Function to update all profile image elements on the page
window.updateProfileUIImages = function(user) {
  const defaultAvatar = "images/default-avatar.png";
  const userAvatar = (user && user.profilePic && user.profilePic.trim() !== "") 
    ? user.profilePic 
    : defaultAvatar;

  // Target banner and preview image elements safely
  const bannerPic = document.getElementById('bannerProfilePic');
  const previewPic = document.getElementById('profilePicPreview');
  const fullNameDisplay = document.getElementById('profileFullName');
  const usernameDisplay = document.getElementById('profileUsernameDisplay');
  const nameDisplay = document.getElementById('userNameDisplay');
  const roleDisplay = document.getElementById('userRoleDisplay');

  if (bannerPic) bannerPic.src = userAvatar;
  if (previewPic) previewPic.src = userAvatar;
  
  if (user) {
    if (fullNameDisplay) fullNameDisplay.textContent = user.fullName || user.schoolId || user.username || "User";
    if (usernameDisplay) usernameDisplay.textContent = "@" + (user.schoolId || user.username || "");
    if (nameDisplay) nameDisplay.textContent = user.fullName || user.schoolId || user.username || "User";
    if (roleDisplay) roleDisplay.textContent = user.role || "User";
  }
};

// 2. Hook into session changes to refresh profile images automatically
window.addEventListener('portalSessionChanged', (e) => {
  window.updateProfileUIImages(e.detail);
});

// Handle File Input Change & Firebase Storage Upload with Debug Logging
document.addEventListener('DOMContentLoaded', () => {
  const profilePicInput = document.getElementById('profilePicInput');
  
  if (!profilePicInput) {
    return;
  }

  profilePicInput.addEventListener('change', async (e) => {
    console.log("📁 File input change event triggered.");
    const file = e.target.files[0];
    
    if (!file) {
      console.log("⚠️ No file selected.");
      return;
    }
    console.log("✅ File selected:", file.name, file.size);

    // Check if session loader exists
    if (typeof loadSessionFromStorage !== 'function') {
      console.error("❌ Error: 'loadSessionFromStorage' function is not defined.");
      showCustomModal({
        title: "Configuration Error",
        message: "System configuration error: Session manager missing.",
        type: "error"
      });
      return;
    }

    const currentUser = loadSessionFromStorage();
    const userIdentifier = currentUser ? (currentUser.schoolId || currentUser.username) : null;
    if (!currentUser || !userIdentifier) {
      console.warn("⚠️ No active user session found in storage.");
      showCustomModal({
        title: "Session Expired",
        message: "Please sign in again to update your profile picture.",
        type: "warning"
      });
      return;
    }

    // Visual loading indicator
    const uploadLabel = document.querySelector('label[for="profilePicInput"]');
    const originalLabelHTML = uploadLabel ? uploadLabel.innerHTML : '';
    if (uploadLabel) {
      uploadLabel.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
      uploadLabel.style.pointerEvents = 'none';
    }

    try {
      // Verify Firebase storage reference
      if (typeof storageRef === 'undefined') {
        throw new Error("Firebase 'storageRef' is not initialized globally.");
      }

      const fileExtension = file.name.split('.').pop();
      const filePath = `profile_pictures/${userIdentifier}_${Date.now()}.${fileExtension}`;
      console.log("☁️ Uploading to Firebase path:", filePath);

      const fileRef = storageRef.child(filePath);
      const snapshot = await fileRef.put(file);
      const downloadURL = await snapshot.ref.getDownloadURL();
      console.log("🔗 File uploaded successfully. Download URL:", downloadURL);

      // Update session data
      currentUser.profilePic = downloadURL;
      localStorage.setItem('portal_session', JSON.stringify(currentUser));
      
      if (typeof broadcastSessionUpdate === 'function') {
        broadcastSessionUpdate(currentUser);
      }

      // Update Firestore database document using the user's document ID or schoolId as fallback
      if (window.db) {
        const docId = currentUser.id || (currentUser.schoolId ? currentUser.schoolId.toLowerCase() : null) || currentUser.username;
        const userDocRef = window.db.collection('users').doc(docId);
        
        await userDocRef.set({ profilePic: downloadURL }, { merge: true });
        console.log("💾 Firestore user profilePic updated for document:", docId);
      }

      // Refresh UI images instantly
      if (typeof window.updateProfileUIImages === 'function') {
        window.updateProfileUIImages(currentUser);
      }
      
      showCustomModal({
        title: "Success",
        message: "Profile picture updated successfully!",
        type: "success"
      });

    } catch (error) {
      console.error("❌ Error during profile picture upload process:", error);
      showCustomModal({
        title: "Upload Failed",
        message: "Failed to upload profile picture: " + error.message,
        type: "error"
      });
    } finally {
      if (uploadLabel) {
        uploadLabel.innerHTML = originalLabelHTML;
        uploadLabel.style.pointerEvents = 'auto';
      }
      profilePicInput.value = '';
    }
  });
});


// ==========================================
// TEACHER / ADMIN STAFF REGISTRATION & MANAGEMENT MODULE
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  // Bind staff registration form submission
  const registerStaffForm = document.getElementById("registerStaffForm");
  if (registerStaffForm) {
    registerStaffForm.addEventListener("submit", handleRegisterStaff);
  }

  // Bind Staff Management Modal openers and closers
  const openManageStaffBtn = document.getElementById("openManageStaffBtn");
  if (openManageStaffBtn) {
    openManageStaffBtn.addEventListener("click", () => {
      openManageStaffModal();
      populateRegisteredSchoolsDropdown();
    });
  }

  const closeManageStaffModalBtn = document.getElementById("closeManageStaffModalBtn");
  if (closeManageStaffModalBtn) {
    closeManageStaffModalBtn.addEventListener("click", () => {
      document.getElementById("manageStaffModal").style.display = "none";
    });
  }

  // Bind Staff Search Input
  const staffSearchInput = document.getElementById("staffSearchInput");
  if (staffSearchInput) {
    staffSearchInput.addEventListener("input", filterStaffTable);
  }

  // Populate school select options on initial load if dropdown exists
  populateRegisteredSchoolsDropdown();
});

// Helper: Fetch and Populate Registered Schools Dropdown
async function populateRegisteredSchoolsDropdown() {
  const schoolSelectEl = document.getElementById("staffSchoolSelect");
  if (!schoolSelectEl) return;

  let schoolsSet = new Set();

  // 1. Fetch unique schools from Firestore collections (users, submissions, classes, etc.)
  if (window.db) {
    try {
      const usersSnap = await window.db.collection("users").get();
      usersSnap.forEach(doc => {
        const data = doc.data();
        if (data.schoolId) schoolsSet.add(data.schoolId.toUpperCase());
        if (data.schoolName) schoolsSet.add(data.schoolName.toUpperCase());
      });

      const subsSnap = await window.db.collection("submissions").get();
      subsSnap.forEach(doc => {
        const data = doc.data();
        if (data.schoolId) schoolsSet.add(data.schoolId.toUpperCase());
      });
    } catch (err) {
      console.warn("Firestore schools fetch warning:", err);
    }
  }

  // 2. Fallback or merge with local storage caches (portal_users, portal_submissions, portal_classes)
  const localUsers = JSON.parse(localStorage.getItem("portal_users")) || [];
  localUsers.forEach(u => {
    if (u.schoolId) schoolsSet.add(u.schoolId.toUpperCase());
  });

  const localSubs = JSON.parse(localStorage.getItem("portal_submissions")) || [];
  localSubs.forEach(s => {
    if (s.schoolId) schoolsSet.add(s.schoolId.toUpperCase());
  });

  const localClasses = JSON.parse(localStorage.getItem("portal_classes")) || [];
  localClasses.forEach(c => {
    if (c.schoolId) schoolsSet.add(c.schoolId.toUpperCase());
  });

  // Render options into select element cleanly without counter text
  const sortedSchools = Array.from(schoolsSet).sort();
  schoolSelectEl.innerHTML = `
    <option value="">-- Select Existing School --</option>
    ${sortedSchools.map(sch => `<option value="${sch}">${sch}</option>`).join('')}
  `;

  // Auto-fill the school ID text input when an option is selected from the dropdown
  schoolSelectEl.onchange = function() {
    if (this.value) {
      const schoolIdInput = document.getElementById("staffUsername");
      if (schoolIdInput) {
        schoolIdInput.value = this.value;
      }
    }
  };
}

// Automatically trigger population when the admin registration module opens or DOM loads
document.addEventListener("DOMContentLoaded", () => {
  populateRegisteredSchoolsDropdown();

  // Also trigger when the admin staff registration view or modal becomes visible
  const openManageStaffBtn = document.getElementById("openManageStaffBtn");
  if (openManageStaffBtn) {
    openManageStaffBtn.addEventListener("click", populateRegisteredSchoolsDropdown);
  }
});

// 1. Handle Registration of New Teachers / Admins
async function handleRegisterStaff(e) {
  e.preventDefault();

  const fullName = document.getElementById("staffFullName").value.trim();
  const role = document.getElementById("staffRole").value; // 'teacher' or 'admin'
  const schoolId = document.getElementById("staffUsername").value.trim().toUpperCase();
  const password = document.getElementById("staffPassword").value.trim();

  if (!fullName || !role || !schoolId || !password) {
    showCustomModal({
      title: "Missing Information",
      message: "Please fill in all required fields for staff registration.",
      type: "warning"
    });
    return;
  }

  try {
    // Check if schoolId already exists in Firestore users collection
    const existingUser = await db.collection("users").where("schoolId", "==", schoolId).get();
    if (!existingUser.empty) {
      showCustomModal({
        title: "School ID Taken",
        message: "This School ID is already taken. Please choose another School ID.",
        type: "warning"
      });
      return;
    }

    // Save staff/admin profile to Firestore
    await db.collection("users").doc(schoolId.toLowerCase()).set({
      fullName: fullName,
      role: role, // 'teacher' or 'admin'
      schoolId: schoolId,
      username: schoolId,
      password: password, // Note: In production, hash passwords securely. Matches plain text logic of portal.
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showCustomModal({
      title: "Success",
      message: `Successfully registered ${role.toUpperCase()} account for ${fullName} under school [${schoolId}]!`,
      type: "success"
    });

    document.getElementById("registerStaffForm").reset();
    populateRegisteredSchoolsDropdown();

    // Refresh staff table if modal is open
    if (document.getElementById("manageStaffModal").style.display === "flex") {
      loadStaffTableData();
    }
  } catch (error) {
    console.error("Error registering staff account:", error);
    showCustomModal({
      title: "Registration Failed",
      message: "Failed to register account. Check console for details.",
      type: "error"
    });
  }
}
// 2. Open Staff Management Modal & Load Data
let allStaffRecords = [];
let currentStaffPage = 1;
const staffRowsPerPage = 8;

async function openManageStaffModal() {
  document.getElementById("manageStaffModal").style.display = "flex";
  await loadStaffTableData();
}

async function loadStaffTableData() {
  const tableBody = document.getElementById("staffModalTableBody");
  tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 1rem;">Loading staff records...</td></tr>`;

  try {
    // Fetch users with roles 'teacher' or 'admin'
    const snapshot = await db.collection("users")
      .where("role", "in", ["teacher", "admin"])
      .get();

    allStaffRecords = [];
    snapshot.forEach(doc => {
      allStaffRecords.push({ id: doc.id, ...doc.data() });
    });

    renderStaffTablePage(1);
  } catch (error) {
    console.error("Error loading staff accounts:", error);
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#ef4444;">Failed to load records.</td></tr>`;
  }
}

// 3. Render Staff Pagination & Data Table
function renderStaffTablePage(page, recordsToRender = allStaffRecords) {
  currentStaffPage = page;
  const tableBody = document.getElementById("staffModalTableBody");
  const paginationContainer = document.getElementById("staffTablePagination");
  
  tableBody.innerHTML = "";
  paginationContainer.innerHTML = "";

  if (recordsToRender.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 1rem; color: #64748b;">No staff or administrator accounts found.</td></tr>`;
    return;
  }

  const startIndex = (page - 1) * staffRowsPerPage;
  const endIndex = startIndex + staffRowsPerPage;
  const paginatedItems = recordsToRender.slice(startIndex, endIndex);

  paginatedItems.forEach((staff, index) => {
    const tr = document.createElement("tr");
    const globalIndex = startIndex + index + 1;

    tr.innerHTML = `
      <td>${globalIndex}</td>
      <td><input type="text" id="staff-name-${staff.id}" value="${escapeHtml(staff.fullName || '')}"></td>
      <td>
        <select id="staff-role-${staff.id}">
          <option value="teacher" ${staff.role === 'teacher' ? 'selected' : ''}>Teacher</option>
          <option value="admin" ${staff.role === 'admin' ? 'selected' : ''}>Admin</option>
        </select>
      </td>
      <td><input type="text" id="staff-user-${staff.id}" value="${escapeHtml(staff.schoolId || staff.username || '')}"></td>
      <td><input type="text" id="staff-pass-${staff.id}" value="${escapeHtml(staff.password || '')}"></td>
      <td>
        <button type="button" class="page-btn" style="background:#0284c7; color:white; padding:0.25rem 0.5rem;" onclick="updateStaffAccount('${staff.id}')"><i class="fa-solid fa-floppy-disk"></i> Save</button>
        <button type="button" class="page-btn" style="background:#dc2626; color:white; padding:0.25rem 0.5rem;" onclick="deleteStaffAccount('${staff.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  renderPaginationControls(recordsToRender.length, staffRowsPerPage, page, paginationContainer, (newPage) => {
    renderStaffTablePage(newPage, recordsToRender);
  });
}

// 4. Update Individual Staff Record
async function updateStaffAccount(docId) {
  const newName = document.getElementById(`staff-name-${docId}`).value.trim();
  const newRole = document.getElementById(`staff-role-${docId}`).value;
  const newSchoolId = document.getElementById(`staff-user-${docId}`).value.trim().toUpperCase();
  const newPass = document.getElementById(`staff-pass-${docId}`).value.trim();

  if (!newName || !newSchoolId || !newPass) {
    showCustomModal({
      title: "Missing Fields",
      message: "Fields cannot be left empty.",
      type: "warning"
    });
    return;
  }

  try {
    await db.collection("users").doc(docId).update({
      fullName: newName,
      role: newRole,
      schoolId: newSchoolId,
      username: newSchoolId,
      password: newPass
    });
    
    showCustomModal({
      title: "Success",
      message: "Staff account updated successfully!",
      type: "success"
    });
    
    loadStaffTableData();
  } catch (error) {
    console.error("Error updating staff account:", error);
    showCustomModal({
      title: "Update Failed",
      message: "Failed to update account.",
      type: "error"
    });
  }
}

// 5. Delete Individual Staff Record
async function deleteStaffAccount(docId) {
  showCustomModal({
    title: "Confirm Deletion",
    message: "Are you sure you want to delete this staff/admin account?",
    type: "warning",
    showCancel: true,
    onConfirm: async () => {
      try {
        await db.collection("users").doc(docId).delete();
        
        showCustomModal({
          title: "Deleted",
          message: "Account deleted successfully.",
          type: "success"
        });
        
        loadStaffTableData();
      } catch (error) {
        console.error("Error deleting account:", error);
        showCustomModal({
          title: "Deletion Failed",
          message: "Failed to delete account.",
          type: "error"
        });
      }
    }
  });
}

// 6. Filter Staff Table by Search Input
function filterStaffTable() {
  const query = document.getElementById("staffSearchInput").value.toLowerCase();
  const filtered = allStaffRecords.filter(staff => 
    (staff.fullName || '').toLowerCase().includes(query) ||
    (staff.schoolId || '').toLowerCase().includes(query) ||
    (staff.username || '').toLowerCase().includes(query) ||
    (staff.role || '').toLowerCase().includes(query)
  );
  renderStaffTablePage(1, filtered);
}

// ==========================================================================
// 2. STUDENT REGISTRATION & BULK IMPORT (SCOPED WITH SCHOOL ID)
// ==========================================================================
async function saveUserToCloud(userObj) {
  const localUsers = JSON.parse(localStorage.getItem('portal_users')) || [];
  const targetId = (userObj.schoolId || userObj.username || '').toLowerCase();
  
  const idx = localUsers.findIndex(u => (u.schoolId || u.username || '').toLowerCase() === targetId);
  if (idx >= 0) {
    localUsers[idx] = userObj;
  } else {
    localUsers.push(userObj);
  }
  localStorage.setItem('portal_users', JSON.stringify(localUsers));

  if (window.db) {
    try {
      const activeSchoolId = userObj.schoolId || userObj.schoolID || window.currentSchoolId || 'default_school';
      await window.db.collection('users').doc(targetId).set({
        fullName: userObj.fullName,
        class: userObj.class,
        schoolId: activeSchoolId,
        username: userObj.schoolId || userObj.username,
        password: userObj.password,
        role: userObj.role || 'Student',
        createdAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.error('Firestore sync error:', err);
    }
  }
}

window.handleRegisterStudent = async function(e) {
  e.preventDefault();
  if (!window.currentUser || window.currentUser.role !== 'Teacher') return;

  const fullName = document.getElementById('regFullName').value.trim();
  const studentClass = document.getElementById('regClass').value;
  const schoolId = document.getElementById('regUsername').value.trim().toUpperCase();
  const password = document.getElementById('regPassword').value.trim();

  const localUsers = JSON.parse(localStorage.getItem('portal_users')) || [];
  if (localUsers.some(u => (u.schoolId || u.username || '').toLowerCase() === schoolId.toLowerCase())) {
    showCustomModal({
      title: "School ID Exists",
      message: "School ID already exists! Please assign a unique School ID.",
      type: "warning"
    });
    return;
  }

  const activeSchoolId = window.currentUser.schoolId || window.currentUser.schoolID || window.currentSchoolId || schoolId;
  const newUser = { fullName, class: studentClass, schoolId: activeSchoolId, username: schoolId, password, role: "Student" };
  await saveUserToCloud(newUser);

  showCustomModal({
    title: "Success",
    message: `Student "${fullName}" registered successfully!`,
    type: "success"
  });

  e.target.reset();

  if (typeof renderStudentModalTable === 'function') renderStudentModalTable();
};

function generateStrongPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < 8; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}

window.handleBulkImport = function() {
  if (!window.currentUser || window.currentUser.role !== 'Teacher') return;

  const fileInput = document.getElementById('bulkStudentFile');
  const targetClass = document.getElementById('bulkClass').value;

  if (!fileInput || !fileInput.files.length) {
    showCustomModal({
      title: "Missing File",
      message: "Please select an Excel or CSV file to import.",
      type: "warning"
    });
    return;
  }

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "", blankrows: false });

      let systemUsers = JSON.parse(localStorage.getItem('portal_users')) || [];
      let addedCount = 0;
      const savePromises = [];

      const activeSchoolId = window.currentUser.schoolId || window.currentUser.schoolID || window.currentSchoolId || 'default_school';

      jsonRows.forEach((row, index) => {
        if (!row || row.length === 0) return;
        let rawName = String(row[0] || '').trim();

        if (index === 0 && (rawName.toLowerCase().includes('name') || rawName.toLowerCase().includes('student'))) return;

        if (rawName && isNaN(rawName)) {
          const nameParts = rawName.split(/\s+/);
          let lastName = nameParts[nameParts.length - 1].toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (!lastName) lastName = "STUDENT";

          let baseSchoolId = lastName;
          let finalSchoolId = baseSchoolId;
          let counter = 1;

          while (systemUsers.some(u => (u.schoolId || u.username || '').toLowerCase() === finalSchoolId.toLowerCase())) {
            finalSchoolId = `${baseSchoolId}${counter}`;
            counter++;
          }

          const newUser = {
            fullName: rawName,
            class: targetClass,
            schoolId: activeSchoolId,
            username: finalSchoolId,
            password: generateStrongPassword(),
            role: "Student"
          };

          systemUsers.push(newUser);
          addedCount++;
          savePromises.push(saveUserToCloud(newUser));
        }
      });

      await Promise.all(savePromises);
      
      showCustomModal({
        title: "Import Successful",
        message: `Imported ${addedCount} student account(s) into ${targetClass}!`,
        type: "success"
      });

      fileInput.value = '';
      if (typeof renderStudentModalTable === 'function') renderStudentModalTable();
    } catch (err) {
      console.error(err);
      showCustomModal({
        title: "Import Error",
        message: "Error parsing or saving file data.",
        type: "error"
      });
    }
  };
  reader.readAsArrayBuffer(fileInput.files[0]);
};

// ==========================================================================
// 1. SAAS-GRADE STUDENT CSV EXPORT (WITH SCHOOL NAME, TITLE CASE & SORTING)
// ==========================================================================
window.downloadStudentCSV = async function() {
  const classSelect = document.getElementById('exportClassSelect');
  const selectedClass = classSelect ? classSelect.value.trim() : '';

  let students = [];
  let fetchedSchoolName = null;
  let targetSchoolId = null;

  if (window.currentUser) {
    targetSchoolId = window.currentUser.schoolId || window.currentUser.schoolID || window.currentSchoolId || null;
  }

  if (window.db) {
    try {
      let query = window.db.collection('users').where('role', '==', 'Student');
      
      if (targetSchoolId) {
        query = query.where('schoolId', '==', targetSchoolId);
      }
      if (selectedClass) {
        query = query.where('class', '==', selectedClass);
      }

      const snap = await query.get();
      snap.forEach(doc => students.push(doc.data()));

      // Fetch official school name from Firestore 'schools' collection
      if (targetSchoolId) {
        const schoolDoc = await window.db.collection('schools').doc(targetSchoolId).get();
        if (schoolDoc.exists) {
          const schoolData = schoolDoc.data();
          fetchedSchoolName = schoolData.schoolName || schoolData.name;
        }
      }
    } catch (err) {
      console.warn('Fallback to local storage:', err);
    }
  }

  if (students.length === 0) {
    const users = JSON.parse(localStorage.getItem('portal_users')) || [];
    
    students = users.filter(u => {
      const isStudent = u.role === 'Student';
      const matchesSchool = !targetSchoolId || (u.schoolId || '').toLowerCase() === targetSchoolId.toLowerCase();
      const matchesClass = !selectedClass || (u.class || '').toUpperCase() === selectedClass.toUpperCase();
      return isStudent && matchesSchool && matchesClass;
    });
  }

  // Fallback school name lookup
  if (!fetchedSchoolName && window.currentUser) {
    fetchedSchoolName = window.currentUser.schoolName || window.currentUser.institutionName;
  }

  const finalSchoolName = fetchedSchoolName || (targetSchoolId ? targetSchoolId.toUpperCase() : 'Academic Institution');

  if (students.length === 0) {
    showCustomModal({
      title: "No Data Available",
      message: selectedClass ? `No registered students found for class ${selectedClass}.` : "No registered students found to export.",
      type: "info"
    });
    return;
  }

  // Helper function to capitalize each word in names
  function formatTitleCase(str) {
    if (!str) return 'N/A';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  // Sort students: By Class first (if whole school), then Alphabetically by Full Name
  students.sort((a, b) => {
    const classA = (a.class || '').toLowerCase();
    const classB = (b.class || '').toLowerCase();
    
    if (!selectedClass && classA !== classB) {
      return classA.localeCompare(classB, undefined, { numeric: true, sensitivity: 'base' });
    }
    
    const nameA = (a.fullName || a.name || '').toLowerCase();
    const nameB = (b.fullName || b.name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  // Build CSV content with School Name header row
  let csvContent = `data:text/csv;charset=utf-8,`;
  csvContent += `"${finalSchoolName.replace(/"/g, '""')}"\n`;
  csvContent += `${selectedClass ? 'Class: ' + selectedClass : 'Complete School Student Credentials Report'}\n`;
  csvContent += `Full Name,Class,School ID,Username,Password\n`;

  students.forEach(s => {
    const formattedName = formatTitleCase(s.fullName || s.name);
    csvContent += `"${formattedName}","${s.class || ''}","${s.schoolId || targetSchoolId || ''}","${s.username || ''}","${s.password || ''}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  const fileLabel = selectedClass ? `Class_${selectedClass}_Credentials` : 'Registered_Students_Credentials';
  link.setAttribute("download", `${fileLabel}_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showCustomModal({
    title: "Export Successful",
    message: `Successfully downloaded sorted CSV credentials for ${students.length} student(s)${selectedClass ? ' in ' + selectedClass : ''}.`,
    type: "success"
  });
};

// ==========================================================================
// SAAS-GRADE STUDENT PDF EXPORT (OPTIMIZED NAME SPACE & CLEAN HEADERS)
// ==========================================================================
window.downloadStudentPDF = async function() {
  const classSelect = document.getElementById('exportClassSelect');
  const selectedClass = classSelect ? classSelect.value.trim() : '';

  let students = [];
  let fetchedSchoolName = null;
  let fetchedSchoolLogo = null;
  let targetSchoolId = null;

  if (window.currentUser) {
    targetSchoolId = window.currentUser.schoolId || window.currentUser.schoolID || window.currentSchoolId || null;
  }

  if (window.db) {
    try {
      let query = window.db.collection('users').where('role', '==', 'Student');
      
      if (targetSchoolId) {
        query = query.where('schoolId', '==', targetSchoolId);
      }
      if (selectedClass) {
        query = query.where('class', '==', selectedClass);
      }

      const snap = await query.get();
      snap.forEach(doc => students.push(doc.data()));

      if (targetSchoolId) {
        const schoolDoc = await window.db.collection('schools').doc(targetSchoolId).get();
        if (schoolDoc.exists) {
          const schoolData = schoolDoc.data();
          fetchedSchoolName = schoolData.schoolName || schoolData.name;
          fetchedSchoolLogo = schoolData.logoUrl || schoolData.logo;
        }
      }
    } catch (err) {
      console.warn('Fallback to local storage for PDF export:', err);
    }
  }

  if (students.length === 0) {
    const users = JSON.parse(localStorage.getItem('portal_users')) || [];
    
    students = users.filter(u => {
      const isStudent = u.role === 'Student';
      const matchesSchool = !targetSchoolId || (u.schoolId || '').toLowerCase() === targetSchoolId.toLowerCase();
      const matchesClass = !selectedClass || (u.class || '').toUpperCase() === selectedClass.toUpperCase();
      return isStudent && matchesSchool && matchesClass;
    });
  }

  if (!fetchedSchoolName && window.currentUser) {
    fetchedSchoolName = window.currentUser.schoolName || window.currentUser.institutionName;
  }
  if (!fetchedSchoolLogo && window.currentUser) {
    fetchedSchoolLogo = window.currentUser.logoUrl || window.currentUser.schoolLogo;
  }

  const finalSchoolName = fetchedSchoolName || (targetSchoolId ? targetSchoolId.toUpperCase() : 'Academic Institution');
  const finalSchoolLogo = fetchedSchoolLogo || '';

  if (students.length === 0) {
    showCustomModal({
      title: "No Data Available",
      message: selectedClass ? `No registered students found for class ${selectedClass}.` : "No registered students found to export.",
      type: "info"
    });
    return;
  }

  // Helper function to capitalize each word in full names
  function formatTitleCase(str) {
    if (!str) return 'N/A';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  // Sort students: By Class first (if whole school), then Alphabetically by Full Name
  students.sort((a, b) => {
    const classA = (a.class || '').toLowerCase();
    const classB = (b.class || '').toLowerCase();
    
    if (!selectedClass && classA !== classB) {
      return classA.localeCompare(classB, undefined, { numeric: true, sensitivity: 'base' });
    }
    
    const nameA = (a.fullName || a.name || '').toLowerCase();
    const nameB = (b.fullName || b.name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups for this website to download PDF credentials.');
    return;
  }

  const reportTitle = selectedClass ? `Student Credentials Report — Class ${selectedClass}` : 'Complete School Student Credentials Report';
  const currentDate = new Date().toLocaleDateString();

  let rowsHTML = '';
  students.forEach((s, index) => {
    const formattedName = formatTitleCase(s.fullName || s.name);
    rowsHTML += `
      <tr>
        <td class="center">${index + 1}</td>
        <td class="nowrap"><strong>${formattedName}</strong></td>
        <td class="code user">${s.username || 'N/A'}</td>
        <td class="code pass">${s.password || 'N/A'}</td>
      </tr>
    `;
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${reportTitle}</title>
      <style>
        @page { size: A4; margin: 15mm; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
          color: #1e293b; 
          margin: 0; 
          padding: 20px 0;
          background: #ffffff;
        }
        .page-wrapper {
          width: 70%;
          margin: 0 auto;
        }
        .header { 
          text-align: center; 
          margin-bottom: 20px; 
          border-bottom: 2px solid #e2e8f0; 
          padding-bottom: 12px; 
        }
        .logo-container {
          margin-bottom: 8px;
        }
        .logo-container img {
          max-height: 60px;
          max-width: 180px;
          object-fit: contain;
        }
        .header h2 { margin: 0 0 4px 0; color: #0f172a; font-size: 20px; letter-spacing: -0.02em; text-transform: uppercase; }
        .header p { margin: 2px 0; color: #64748b; font-size: 12px; }
        
        /* Optimized Autofit Table with Full Space for Names */
        table { 
          width: 100%; 
          border-collapse: collapse; 
          table-layout: auto; 
          font-size: 11px; 
        }
        th, td { 
          padding: 8px 12px; 
          border: 1px solid #cbd5e1; 
          text-align: left; 
          vertical-align: middle;
        }
        th { 
          background: #f1f5f9; 
          color: #334155; 
          font-weight: 600; 
          text-transform: uppercase; 
          font-size: 10px;
          letter-spacing: 0.05em;
        }
        th.center, td.center { text-align: center; }
        td.nowrap { white-space: nowrap; }
        
        /* Alternating Row Colors */
        tbody tr:nth-child(even) { background-color: #f8fafc; }
        tbody tr:hover { background-color: #f1f5f9; }

        .code { font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace; font-size: 11px; }
        .user { color: #0284c7; font-weight: 500; }
        .pass { color: #dc2626; font-weight: 500; }

        .footer { 
          margin-top: 20px; 
          display: flex; 
          justify-content: space-between; 
          font-size: 10px; 
          color: #94a3b8; 
          border-top: 1px solid #e2e8f0;
          padding-top: 8px;
        }
        @media print {
          button.no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="page-wrapper">
        <div class="header">
          ${finalSchoolLogo ? `<div class="logo-container"><img src="${finalSchoolLogo}" alt="School Logo"></div>` : ''}
          <h2>${finalSchoolName}</h2>
          <p><strong>${reportTitle}</strong></p>
          <p>Generated on: ${currentDate} &bull; Total Records: ${students.length}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th class="center" style="width: 40px;">#</th>
              <th>Full Name</th>
              <th style="width: 140px;">Username</th>
              <th style="width: 140px;">Password</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>

        <div class="footer">
          <span>SAMCAM Solutions ICT Hub — Secure Credentials System</span>
          <span>Page 1 of 1</span>
        </div>

        <div style="text-align: center; margin-top: 20px;">
          <button class="no-print" onclick="window.print();" style="padding: 10px 24px; background: #0284c7; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">Print / Save as PDF</button>
        </div>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();

  showCustomModal({
    title: "PDF Ready",
    message: `Successfully prepared professional PDF report for ${students.length} student(s) at ${finalSchoolName}.`,
    type: "success"
  });
};

// ==========================================================================
// 3. CLEAN EVENT BINDINGS (PREVENTS DOUBLE-CLICK / MULTI-DOWNLOAD ISSUES)
// ==========================================================================
function initCredentialsControls() {
  const csvBtn = document.getElementById('downloadCsvBtn');
  if (csvBtn) {
    csvBtn.replaceWith(csvBtn.cloneNode(true));
    document.getElementById('downloadCsvBtn').addEventListener('click', window.downloadStudentCSV);
  }

  const pdfBtn = document.getElementById('downloadPdfBtn');
  if (pdfBtn) {
    pdfBtn.replaceWith(pdfBtn.cloneNode(true));
    document.getElementById('downloadPdfBtn').addEventListener('click', window.downloadStudentPDF);
  }

  const manageStudentsBtn = document.getElementById('openManageStudentsBtn');
  if (manageStudentsBtn && typeof openManageStudentsModal === 'function') {
    manageStudentsBtn.replaceWith(manageStudentsBtn.cloneNode(true));
    document.getElementById('openManageStudentsBtn').addEventListener('click', openManageStudentsModal);
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCredentialsControls);
} else {
  initCredentialsControls();
}

// ==========================================================================
// 2. MODAL MANAGEMENT & BULK ACTIONS
// ==========================================================================
window.openManageStudentsModal = function() {
  const modal = document.getElementById('manageStudentsModal');
  if (modal) {
    modal.style.display = 'flex';
  } else {
    console.error("Element #manageStudentsModal not found in DOM.");
  }
  window.editingUsername = null;
  window.currentStudentSubmissionsPage = 1;
  renderStudentModalTable();
};

window.closeManageStudentsModal = function() {
  const modal = document.getElementById('manageStudentsModal');
  if (modal) {
    modal.style.display = 'none';
  }
  window.editingUsername = null;
};

window.openStudentModal = window.openManageStudentsModal;
window.closeStudentModal = window.closeManageStudentsModal;

window.changeStudentPage = function(newPage) {
  window.currentStudentSubmissionsPage = newPage;
  renderStudentModalTable();
};

window.toggleSelectAllStudents = function(source) {
  const checkboxes = document.querySelectorAll('.student-checkbox');
  checkboxes.forEach(cb => cb.checked = source.checked);
  window.updateStudentBulkDeleteState();
};

window.updateStudentBulkDeleteState = function() {
  const checkboxes = document.querySelectorAll('.student-checkbox:checked');
  const bulkBtn = document.getElementById('studentBulkDeleteBtn');
  const selectAllMaster = document.getElementById('selectAllStudentsMaster');
  const allCheckboxes = document.querySelectorAll('.student-checkbox');
  
  if (bulkBtn) {
    if (checkboxes.length > 0) {
      bulkBtn.style.display = 'inline-flex';
      bulkBtn.innerHTML = `<i class="fa-solid fa-trash-can"></i> Delete (${checkboxes.length})`;
    } else {
      bulkBtn.style.display = 'none';
    }
  }

  if (selectAllMaster && allCheckboxes.length > 0) {
    selectAllMaster.checked = checkboxes.length === allCheckboxes.length;
    selectAllMaster.indeterminate = checkboxes.length > 0 && checkboxes.length < allCheckboxes.length;
  }
};

// ==========================================================================
// 3. ENHANCED SAAS RENDER TABLE WITH BULK SELECT & MICRO-ICONS
// ==========================================================================
window.renderStudentModalTable = async function() {
  const tbody = document.getElementById('studentModalTableBody');
  const searchInput = document.getElementById('studentSearchInput');
  const searchFilter = searchInput ? searchInput.value.toLowerCase().trim() : '';

  if (!tbody) return;

  const activeSchoolId = window.currentUser ? (window.currentUser.schoolId || window.currentUser.schoolID || window.currentSchoolId) : null;

  let students = [];
  if (window.db) {
    try {
      let query = window.db.collection('users').where('role', '==', 'Student');
      if (activeSchoolId) {
        query = query.where('schoolId', '==', activeSchoolId);
      }
      const snap = await query.get();
      snap.forEach(doc => students.push({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn('Fallback to local:', err);
    }
  }

  if (students.length === 0) {
    const localUsers = JSON.parse(localStorage.getItem('portal_users')) || [];
    students = localUsers.filter(u => u.role === 'Student' && (!activeSchoolId || (u.schoolId || '').toLowerCase() === activeSchoolId.toLowerCase()));
  }

  const filteredStudents = students.filter(u => (
    (u.fullName || '').toLowerCase().includes(searchFilter) ||
    (u.class || '').toLowerCase().includes(searchFilter) ||
    (u.schoolId || '').toLowerCase().includes(searchFilter) ||
    (u.username || '').toLowerCase().includes(searchFilter)
  ));

  const totalItems = filteredStudents.length;
  const itemsPerPage = window.ITEMS_PER_PAGE || 10;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  
  if (window.currentStudentSubmissionsPage > totalPages) window.currentStudentSubmissionsPage = totalPages;
  if (window.currentStudentSubmissionsPage < 1) window.currentStudentSubmissionsPage = 1;

  const startIndex = (window.currentStudentSubmissionsPage - 1) * itemsPerPage;
  const paginatedStudents = filteredStudents.slice(startIndex, startIndex + itemsPerPage);

  if (paginatedStudents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem; color:#64748b;"><i class="fa-solid fa-user-slash" style="font-size: 1.5rem; margin-bottom: 0.5rem; display:block;"></i>No matching students found.</td></tr>';
    if (typeof window.renderStudentPaginationControls === 'function') {
      window.renderStudentPaginationControls(0, 1);
    }
    return;
  }

  tbody.innerHTML = paginatedStudents.map((s) => {
    const identifier = s.schoolId || s.username || s.id;
    const isEditing = window.editingUsername === identifier;
    
    const checkColStyle = 'width: 40px; text-align: center; white-space: nowrap;';

    if (isEditing) {
      return `
        <tr>
          <td style="${checkColStyle}"><input type="checkbox" disabled style="opacity: 0.4;"></td>
          <td><input type="text" id="editFullName" value="${escapeHtml(s.fullName || '')}" style="width:100%; padding:4px 8px; border:1px solid #cbd5e1; border-radius:4px;"></td>
          <td>
            <select id="editClass" style="width:100%; padding:4px 8px; border:1px solid #cbd5e1; border-radius:4px;">
              <option value="S1" ${s.class === 'S1' ? 'selected' : ''}>S.1</option>
              <option value="S2" ${s.class === 'S2' ? 'selected' : ''}>S.2</option>
              <option value="S3" ${s.class === 'S3' ? 'selected' : ''}>S.3</option>
              <option value="S4" ${s.class === 'S4' ? 'selected' : ''}>S.4</option>
              <option value="S5" ${s.class === 'S5' ? 'selected' : ''}>S.5</option>
              <option value="S6" ${s.class === 'S6' ? 'selected' : ''}>S.6</option>
            </select>
          </td>
          <td><input type="text" id="editSchoolId" value="${escapeHtml(identifier)}" style="width:100%; padding:4px 8px; border:1px solid #cbd5e1; border-radius:4px;"></td>
          <td><input type="text" id="editPassword" value="${escapeHtml(s.password || '')}" style="width:100%; padding:4px 8px; border:1px solid #cbd5e1; border-radius:4px;"></td>
          <td style="display:flex; gap:0.35rem; align-items:center; justify-content:center;">
            <button onclick="saveStudentEdit('${escapeHtml(identifier)}')" title="Save Changes" style="width: 30px; height: 30px; background: #f0fdf4; color: #16a34a; border: none; border-radius: 6px; cursor: pointer;"><i class="fa-solid fa-check" style="font-size: 0.8rem;"></i></button>
            <button onclick="cancelStudentEdit()" title="Cancel" style="width: 30px; height: 30px; background: #f1f5f9; color: #64748b; border: none; border-radius: 6px; cursor: pointer;"><i class="fa-solid fa-xmark" style="font-size: 0.8rem;"></i></button>
          </td>
        </tr>
      `;
    }

    return `
      <tr>
        <td style="${checkColStyle}"><input type="checkbox" class="student-checkbox" value="${identifier}" onclick="updateStudentBulkDeleteState()" style="cursor: pointer; width: 15px; height: 15px; accent-color: #0ea5e9;"></td>
        <td><strong>${escapeHtml(s.fullName || '')}</strong></td>
        <td><span style="background: #e0f2fe; color: #0369a1; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">${escapeHtml(s.class || 'N/A')}</span></td>
        <td><code>${escapeHtml(identifier)}</code></td>
        <td><code>${escapeHtml(s.password || '')}</code></td>
        <td style="display:flex; gap:0.35rem; align-items:center; justify-content:center;">
          <button onclick="enableStudentEdit('${escapeHtml(identifier)}')" title="Edit Student" style="width: 30px; height: 30px; background: #eff6ff; color: #2563eb; border: none; border-radius: 6px; cursor: pointer;"><i class="fa-solid fa-pen-to-square" style="font-size: 0.8rem;"></i></button>
          <button onclick="deleteStudent('${escapeHtml(identifier)}')" title="Delete Student" style="width: 30px; height: 30px; background: #fef2f2; color: #dc2626; border: none; border-radius: 6px; cursor: pointer;"><i class="fa-solid fa-trash-can" style="font-size: 0.8rem;"></i></button>
        </td>
      </tr>
    `;
  }).join('');

  if (typeof window.renderStudentPaginationControls === 'function') {
    window.renderStudentPaginationControls(totalPages, window.currentStudentSubmissionsPage);
  }
};

// Advanced Pagination with Ellipsis (...) generator targeting #studentTablePagination
function renderStudentPaginationControls(totalPages, currentPage) {
  let pagContainer = document.getElementById('studentTablePagination');
  if (!pagContainer) return;

  if (totalPages <= 1) {
    pagContainer.innerHTML = '';
    return;
  }

  let pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    if (currentPage <= 4) {
      pages = [1, 2, 3, 4, 5, '...', totalPages];
    } else if (currentPage >= totalPages - 3) {
      pages = [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    } else {
      pages = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
    }
  }

  pagContainer.innerHTML = `
    <button type="button" onclick="changeStudentPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} class="page-btn"><i class="fa-solid fa-chevron-left"></i></button>
    ${pages.map(p => {
      if (p === '...') return `<span class="page-ellipsis">...</span>`;
      const isActive = p === currentPage;
      return `<button type="button" onclick="changeStudentPage(${p})" class="page-btn ${isActive ? 'active' : ''}">${p}</button>`;
    }).join('')}
    <button type="button" onclick="changeStudentPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} class="page-btn"><i class="fa-solid fa-chevron-right"></i></button>
  `;
}

window.enableStudentEdit = function(identifier) {
  editingUsername = identifier;
  renderStudentModalTable();
};

window.cancelStudentEdit = function() {
  editingUsername = null;
  renderStudentModalTable();
};

window.saveStudentEdit = async function(oldIdentifier) {
  const newFullName = document.getElementById('editFullName').value.trim();
  const newClass = document.getElementById('editClass').value;
  const newSchoolId = document.getElementById('editSchoolId').value.trim().toUpperCase();
  const newPassword = document.getElementById('editPassword').value.trim();

  if (!newFullName || !newSchoolId || !newPassword) return;

  const activeSchoolId = window.currentUser ? (window.currentUser.schoolId || window.currentUser.schoolID || window.currentSchoolId) : newSchoolId;

  const updatedData = { 
    fullName: newFullName, 
    class: newClass, 
    schoolId: activeSchoolId, 
    username: newSchoolId, 
    password: newPassword, 
    role: 'Student' 
  };

  if (window.db) {
    if (oldIdentifier.toLowerCase() !== newSchoolId.toLowerCase()) {
      await window.db.collection('users').doc(oldIdentifier.toLowerCase()).delete();
    }
    await window.db.collection('users').doc(newSchoolId.toLowerCase()).set(updatedData, { merge: true });
  }

  let localUsers = JSON.parse(localStorage.getItem('portal_users')) || [];
  const idx = localUsers.findIndex(u => (u.schoolId || u.username || '').toLowerCase() === oldIdentifier.toLowerCase());
  if (idx !== -1) {
    localUsers[idx] = updatedData;
  } else {
    localUsers.push(updatedData);
  }
  localStorage.setItem('portal_users', JSON.stringify(localUsers));

  editingUsername = null;
  renderStudentModalTable();
};

window.deleteStudent = async function(identifier) {
  if (!confirm(`Delete student with School ID "${identifier}"?`)) return;

  if (window.db) {
    await window.db.collection('users').doc(identifier.toLowerCase()).delete();
  }

  let localUsers = JSON.parse(localStorage.getItem('portal_users')) || [];
  localUsers = localUsers.filter(u => (u.schoolId || u.username || '').toLowerCase() !== identifier.toLowerCase());
  localStorage.setItem('portal_users', JSON.stringify(localUsers));

  renderStudentModalTable();
};

window.deleteAllStudents = async function() {
  if (confirm('Delete ALL registered students for this school?')) {
    const activeSchoolId = window.currentUser ? (window.currentUser.schoolId || window.currentUser.schoolID || window.currentSchoolId) : null;

    if (window.db) {
      let query = window.db.collection('users').where('role', '==', 'Student');
      if (activeSchoolId) {
        query = query.where('schoolId', '==', activeSchoolId);
      }
      const snap = await query.get();
      const batch = window.db.batch();
      snap.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }

    let localUsers = JSON.parse(localStorage.getItem('portal_users')) || [];
    localUsers = localUsers.filter(u => {
      const isTargetStudent = u.role === 'Student';
      if (!isTargetStudent) return true;
      if (activeSchoolId) {
        return (u.schoolId || '').toLowerCase() !== activeSchoolId.toLowerCase();
      }
      return false;
    });
    localStorage.setItem('portal_users', JSON.stringify(localUsers));

    renderStudentModalTable();
  }
};

// ==========================================================================
// ASSESSMENT CREATION & UPLOAD (SCOPED WITH SCHOOL ID)
// ==========================================================================
window.handleCreateAssessment = async function(e) {
  e.preventDefault();
  if (!currentUser || currentUser.role !== 'Teacher') return;

  const title = document.getElementById('testTitle').value;
  const targetClass = document.getElementById('targetClass').value;
  const description = document.getElementById('testDesc').value;
  const deadline = document.getElementById('testDeadline').value;
  const fileInput = document.getElementById('testFile');

  if (!fileInput || fileInput.files.length === 0) {
    showCustomModal({
      title: "Missing File",
      message: "Please select an assessment file to upload.",
      type: "warning"
    });
    return;
  }

  const file = fileInput.files[0];
  const activeSchoolId = currentUser.schoolId || currentUser.schoolID || window.currentSchoolId || 'default_school';
  
  try {
    console.log("Uploading file to Firebase Storage...");

    // 1. Create a Storage reference using firebase.storage() (scoped folder path for tenant isolation)
    const storageRef = firebase.storage().ref();
    const fileRef = storageRef.child(`assessments/${activeSchoolId}/${Date.now()}_${file.name}`);

    // 2. Upload file bytes
    const snapshot = await fileRef.put(file);
    
    // 3. Get the public download URL
    const downloadUrl = await snapshot.ref.getDownloadURL();

    // 4. Construct the assessment object with schoolId
    const newAssessment = {
      "id": Date.now(),
      "class": targetClass,
      "category": "Question Paper",
      "title": title,
      "description": description,
      "fileUrl": downloadUrl,
      "schoolId": activeSchoolId,
      "date": new Date().toISOString().split('T')[0],
      "deadline": deadline,
      "createdAt": new Date().toISOString()
    };

    // 5. Save to Firestore collection using firebase.firestore()
    await firebase.firestore().collection("portal_resources").add(newAssessment);

    // 6. Keep localStorage in sync (filtered or tagged with schoolId)
    const resources = JSON.parse(localStorage.getItem('portal_resources')) || [];
    resources.push(newAssessment);
    localStorage.setItem('portal_resources', JSON.stringify(resources));

    showCustomModal({
      title: "Success",
      message: "Assessment published successfully!",
      type: "success"
    });

    document.getElementById('assessmentForm').reset();
    if (typeof renderAssessments === 'function') renderAssessments();

  } catch (error) {
    console.error("Error uploading assessment:", error);
    showCustomModal({
      title: "Upload Failed",
      message: "Failed to upload assessment. Please check your network or console for details.",
      type: "error"
    });
  }
};

// ==========================================================================
// 5. PORTAL UI RENDERERS & CLASS FILTER DROPDOWN (SCOPED WITH SCHOOL ID)
// ==========================================================================
function updatePortalUI() {
  const loginSec = document.getElementById('loginSection');
  const dashSec = document.getElementById('dashboardSection');
  const teacherControls = document.getElementById('teacherControls');
  const teacherReports = document.getElementById('teacherReports');
  
  // New Admin UI Elements
  const staffRegModule = document.getElementById('adminStaffRegistrationModule');
  const manageStaffBtn = document.getElementById('openManageStaffBtn');
  
  // Library Manager Navbar Link Element
  const navLibraryManager = document.getElementById('navLibraryManager');

  if (!loginSec || !dashSec) return;

  if (!currentUser) {
    loginSec.style.display = 'block';
    dashSec.style.display = 'none';
    if (teacherControls) teacherControls.style.display = 'none';
    if (teacherReports) teacherReports.style.display = 'none';
    if (staffRegModule) staffRegModule.style.display = 'none';
    if (manageStaffBtn) manageStaffBtn.style.display = 'none';
    if (navLibraryManager) navLibraryManager.style.display = 'none';
    return;
  }

  loginSec.style.display = 'none';
  dashSec.style.display = 'block';

  const nameDisp = document.getElementById('userNameDisplay');
  if (nameDisp) nameDisp.textContent = currentUser.fullName;

  const roleBadge = document.getElementById('userRoleDisplay');
  if (roleBadge) {
    roleBadge.textContent = currentUser.role;
    roleBadge.className = `role-badge role-${currentUser.role.toLowerCase()}`;
  }

  const classDisp = document.getElementById('userClassDisplay');
  if (classDisp) classDisp.textContent = currentUser.class ? `(${currentUser.class})` : '';

  // Normalize role string to handle capitalization variations (e.g. "admin", "Admin", "ADMIN")
  const roleLower = (currentUser.role || '').toLowerCase();

  if (roleLower === 'teacher' || roleLower === 'admin' || roleLower === 'administrator') {
    if (teacherControls) teacherControls.style.display = 'block';
    if (teacherReports) teacherReports.style.display = 'grid';
    if (navLibraryManager) navLibraryManager.style.display = 'inline-flex'; // Reveal for teachers and admins
    if (typeof renderSubmissions === 'function') renderSubmissions();
  } else {
    if (teacherControls) teacherControls.style.display = 'none';
    if (teacherReports) teacherReports.style.display = 'none';
    if (navLibraryManager) navLibraryManager.style.display = 'none'; // Hide for students/others
  }

  // Admin-Specific Privileges (Staff Registration & Management Modal Trigger)
  if (roleLower === 'admin' || roleLower === 'administrator') {
    if (staffRegModule) staffRegModule.style.display = 'block';
    if (manageStaffBtn) manageStaffBtn.style.display = 'inline-flex';
  } else {
    if (staffRegModule) staffRegModule.style.display = 'none';
    if (manageStaffBtn) manageStaffBtn.style.display = 'none';
  }

  renderAssessments();
}

window.filterAssessmentsByClass = function() {
  renderAssessments();
};

// 1. Render Assessments (Async fetch from Firestore filtered by active schoolId with LocalStorage fallback)
async function renderAssessments() {
  const container = document.getElementById('assessmentsContainer');
  if (!container) return;

  const isStudent = currentUser && currentUser.role === 'Student';

  // Make the container and its parent wrapper stretch to full width for students, removing the narrow boxed card layout and white space on the right
  if (isStudent) {
    container.style.width = '100%';
    container.style.maxWidth = '100%';
    container.style.margin = '0';
    if (container.parentElement) {
      container.parentElement.style.width = '100%';
      container.parentElement.style.maxWidth = '100%';
      container.parentElement.style.background = 'transparent';
      container.parentElement.style.border = 'none';
      container.parentElement.style.boxShadow = 'none';
      container.parentElement.style.padding = '0';
    }
  } else {
    container.style.width = '';
    container.style.maxWidth = '';
    container.style.margin = '';
  }

  const activeSchoolId = currentUser ? (currentUser.schoolId || currentUser.schoolID || window.currentSchoolId) : null;

  let resources = [];
  try {
    let query = firebase.firestore().collection("portal_resources");
    if (activeSchoolId) {
      query = query.where("schoolId", "==", activeSchoolId);
    }
    const snapshot = await query.get();
    if (!snapshot.empty) {
      resources = snapshot.docs.map(doc => ({ firebaseDocId: doc.id, ...doc.data() }));
      localStorage.setItem('portal_resources', JSON.stringify(resources));
    } else {
      const localResources = JSON.parse(localStorage.getItem('portal_resources')) || [];
      resources = activeSchoolId ? localResources.filter(r => (r.schoolId || '').toLowerCase() === activeSchoolId.toLowerCase()) : localResources;
    }
  } catch (error) {
    console.warn("Offline or failed to fetch from Firestore, falling back to LocalStorage:", error);
    const localResources = JSON.parse(localStorage.getItem('portal_resources')) || [];
    resources = activeSchoolId ? localResources.filter(r => (r.schoolId || '').toLowerCase() === activeSchoolId.toLowerCase()) : localResources;
  }

  const submissions = JSON.parse(localStorage.getItem('portal_submissions')) || [];
  const now = new Date();

  let classFilterEl = document.getElementById('assessmentClassFilter');
  let selectedClassFilter = classFilterEl ? classFilterEl.value : 'ALL';

  let assessments = resources.filter(r => r.category === "Question Paper");
  
  if (isStudent) {
    assessments = assessments.filter(a => a.class === currentUser.class);
  } else if (selectedClassFilter && selectedClassFilter !== 'ALL') {
    assessments = assessments.filter(a => a.class === selectedClassFilter);
  }

  if (assessments.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 3rem 1rem; text-align: center; background: #ffffff; border: 1px dashed #cbd5e1; border-radius: 12px;">
        <i class="fa-solid fa-folder-open" style="font-size: 2rem; color: #94a3b8; margin-bottom: 0.75rem;"></i>
        <p style="color: #64748b; font-size: 0.95rem; font-weight: 500; margin: 0;">No active assessments available.</p>
      </div>`;
    return;
  }

  container.innerHTML = assessments.map(a => {
    const deadlineDate = new Date(a.deadline);
    const isExpired = now > deadlineDate;
    
    const currentStudentId = currentUser ? (currentUser.schoolId || currentUser.username) : null;
    const studentSub = isStudent 
      ? submissions.find(s => String(s.testId) === String(a.id) && (String(s.schoolId || s.studentId || s.username || '').toLowerCase() === String(currentStudentId || '').toLowerCase() || s.studentName === currentUser.fullName)) 
      : null;
    
    const safeTitle = encodeURIComponent(a.title);

    let actionHTML = '';
    
    // Student Actions (Strictly icon-only with tooltips)
    if (isStudent) {
        if (studentSub) {
            actionHTML = `
              <span style="color:#16a34a; font-size:0.85rem; font-weight:600; display:inline-flex; align-items:center; gap:0.35rem;">
                <i class="fa-solid fa-circle-check"></i> Submitted (${escapeHtml(studentSub.fileName)})
              </span>
            `;
            if (!isExpired) {
                actionHTML += `
                    <div style="display:flex; gap:0.35rem; align-items:center;">
                      <button type="button" onclick="openSubmissionModalWithDetails('${a.id}', '${safeTitle}')" class="btn-action btn-icon-only btn-edit" title="Replace Submission"><i class="fa-solid fa-arrows-rotate"></i></button>
                      <button type="button" onclick="cancelSubmission('${a.id}')" class="btn-action btn-icon-only btn-danger" title="Cancel Submission"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                `;
            } else {
                actionHTML += `<span style="font-size:0.75rem; color:#94a3b8; font-weight:500;">(Locked)</span>`;
            }
        } else {
            if (isExpired) {
                actionHTML = `
                  <button disabled class="btn-action btn-icon-only btn-disabled" title="Deadline Passed" aria-disabled="true">
                    <i class="fa-solid fa-lock"></i>
                  </button>
                `;
            } else {
                actionHTML = `
                  <button type="button" onclick="openSubmissionModalWithDetails('${a.id}', '${safeTitle}')" class="btn-action btn-icon-only btn-upload" title="Upload Answer">
                    <i class="fa-solid fa-file-arrow-up"></i>
                  </button>
                `;
            }
        }
    } 
    // Teacher / Admin Actions (Strictly icon-only with tooltips)
    else if (currentUser && (currentUser.role === 'Teacher' || currentUser.role === 'Admin' || currentUser.role === 'Administrator')) {
        actionHTML = `
            <div style="display:flex; gap:0.35rem; align-items:center;">
              <button type="button" onclick="openEditAssessmentModal('${a.id}')" class="btn-action btn-icon-only btn-edit" title="Edit Assessment"><i class="fa-solid fa-pen-to-square"></i></button>
              <button type="button" onclick="handleDeleteAssessment('${a.id}')" class="btn-action btn-icon-only btn-danger" title="Delete Assessment"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `;
    }

    return `
      <div class="test-card" data-assessment-id="${a.id}" style="width: 100%; margin-bottom: 1rem;">
        <div class="test-header">
          <span class="test-title">${escapeHtml(a.title)} <small style="color:#64748b;">(${escapeHtml(a.class)})</small></span>
          <span class="deadline-badge ${isExpired ? 'deadline-expired' : 'deadline-active'}" data-deadline="${a.deadline}">
            ${isExpired ? '<i class="fa-solid fa-clock"></i> Expired' : '<i class="fa-solid fa-hourglass-half"></i> Active until: ' + deadlineDate.toLocaleString()}
          </span>
        </div>
        <p style="font-size:0.85rem; color:#475569; margin:0.5rem 0 1rem 0; line-height:1.5;">${escapeHtml(a.description || 'No instructions provided.')}</p>
        <div class="test-actions" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; border-top:1px solid #f1f5f9; padding-top:0.75rem;">
          <a href="${a.fileUrl}" download class="btn-action btn-icon-only btn-download" title="Download Paper"><i class="fa-solid fa-file-arrow-down"></i></a>
          <div style="display:flex; align-items:center; gap:0.5rem;">
            ${actionHTML}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// 2. Open Edit Modal
function openEditAssessmentModal(assessmentId) {
  const resources = JSON.parse(localStorage.getItem('portal_resources')) || [];
  const assessment = resources.find(r => String(r.id) === String(assessmentId));
  
  if (!assessment) {
    showCustomModal({
      title: "Not Found",
      message: "Assessment not found.",
      type: "error"
    });
    return;
  }

  // Fill modal input fields
  document.getElementById('editTestId').value = assessment.id;
  document.getElementById('editTestTitle').value = assessment.title || '';
  document.getElementById('editTargetClass').value = assessment.class || 'S1';
  document.getElementById('editTestDesc').value = assessment.description || '';
  
  // Format date correctly for datetime-local input (YYYY-MM-DDTHH:mm)
  if (assessment.deadline) {
    const d = new Date(assessment.deadline);
    const isoString = d.toISOString().slice(0, 16);
    document.getElementById('editTestDeadline').value = isoString;
  }

  const modal = document.getElementById('editAssessmentModal');
  if (modal) modal.style.display = 'flex';
}

async function handleDeleteAssessment(assessmentId) {
  showCustomModal({
    title: "Delete Assessment",
    message: "Are you sure you want to delete this assessment? This will also remove associated student submissions permanently.",
    type: "warning",
    showCancel: true,
    onConfirm: async () => {
      try {
        const db = firebase.firestore();
        const activeSchoolId = currentUser ? (currentUser.schoolId || currentUser.schoolID || window.currentSchoolId) : null;
        
        // 1. Find and delete the matching document from Firestore scoped by schoolId
        let query = db.collection("portal_resources").where("id", "==", assessmentId);
        if (activeSchoolId) {
          query = query.where("schoolId", "==", activeSchoolId);
        }
        const querySnapshot = await query.get();
        
        if (!querySnapshot.empty) {
          const deletePromises = querySnapshot.docs.map(docSnap => docSnap.ref.delete());
          await Promise.all(deletePromises);
        } else {
          const allDocs = await db.collection("portal_resources").get();
          const deletePromises = [];
          allDocs.forEach(docSnap => {
            const data = docSnap.data();
            if (String(data.id) === String(assessmentId)) {
              deletePromises.push(docSnap.ref.delete());
            }
          });
          await Promise.all(deletePromises);
        }

        // 2. Update LocalStorage state
        let resources = JSON.parse(localStorage.getItem('portal_resources')) || [];
        resources = resources.filter(r => String(r.id) !== String(assessmentId));
        localStorage.setItem('portal_resources', JSON.stringify(resources));

        // 3. Clean up submissions tied to this test
        let submissions = JSON.parse(localStorage.getItem('portal_submissions')) || [];
        submissions = submissions.filter(s => String(s.testId) !== String(assessmentId));
        localStorage.setItem('portal_submissions', JSON.stringify(submissions));

        showCustomModal({
          title: "Success",
          message: "Assessment deleted successfully.",
          type: "success"
        });
        
        renderAssessments();
      } catch (error) {
        console.error("Error deleting assessment:", error);
        showCustomModal({
          title: "Error",
          message: "Failed to delete assessment completely from database. Check console for details.",
          type: "error"
        });
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const editForm = document.getElementById('editAssessmentForm');
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const id = document.getElementById('editTestId').value;
      const title = document.getElementById('editTestTitle').value;
      const targetClass = document.getElementById('editTargetClass').value;
      const description = document.getElementById('editTestDesc').value;
      const deadline = document.getElementById('editTestDeadline').value;
      const fileInput = document.getElementById('editTestFile');
      const activeSchoolId = currentUser ? (currentUser.schoolId || currentUser.schoolID || window.currentSchoolId) : 'default_school';

      let resources = JSON.parse(localStorage.getItem('portal_resources')) || [];
      let index = resources.findIndex(r => String(r.id) === String(id));

      if (index !== -1) {
        let fileUrl = resources[index].fileUrl;

        try {
          // If a new replacement file is attached, upload it to Firebase Storage with tenant isolation path
          if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const storageRef = firebase.storage().ref();
            const fileRef = storageRef.child(`assessments/${activeSchoolId}/${Date.now()}_${file.name}`);
            const snapshot = await fileRef.put(file);
            fileUrl = await snapshot.ref.getDownloadURL();
            resources[index].fileName = file.name;
          }

          // Update local resource attributes
          resources[index].title = title;
          resources[index].class = targetClass;
          resources[index].description = description;
          resources[index].deadline = deadline;
          resources[index].fileUrl = fileUrl;
          resources[index].schoolId = activeSchoolId;

          localStorage.setItem('portal_resources', JSON.stringify(resources));

          // Sync update to Firestore scoped by schoolId
          const querySnapshot = await firebase.firestore().collection("portal_resources").get();
          querySnapshot.forEach(async (docSnap) => {
            const data = docSnap.data();
            if (String(data.id) === String(id)) {
              await firebase.firestore().collection("portal_resources").doc(docSnap.id).update({
                title: title,
                class: targetClass,
                description: description,
                deadline: deadline,
                fileUrl: fileUrl,
                schoolId: activeSchoolId
              });
            }
          });

          // Hide modal
          const modal = document.getElementById('editAssessmentModal');
          if (modal) modal.style.display = 'none';

          showCustomModal({
            title: "Success",
            message: "Assessment updated successfully!",
            type: "success"
          });
          
          renderAssessments();

        } catch (error) {
          console.error("Error updating assessment:", error);
          showCustomModal({
            title: "Update Failed",
            message: "Failed to update assessment in Firebase.",
            type: "error"
          });
        }
      }
    });
  }

  // Close modal bindings
  const closeEditBtn = document.getElementById('closeEditAssessmentModalBtn');
  const cancelEditBtn = document.getElementById('cancelEditAssessmentBtn');
  const editModal = document.getElementById('editAssessmentModal');

  [closeEditBtn, cancelEditBtn].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        if (editModal) editModal.style.display = 'none';
      });
    }
  });
});

// Live Countdown Timer Update Helper
function updateCountdowns() {
  const badges = document.querySelectorAll('.deadline-badge[data-deadline]');
  const now = new Date();

  badges.forEach(badge => {
    const deadlineStr = badge.getAttribute('data-deadline');
    if (!deadlineStr) return;
    const deadlineDate = new Date(deadlineStr);
    const diff = deadlineDate - now;

    if (diff <= 0) {
      if (!badge.classList.contains('deadline-expired')) {
        badge.className = 'deadline-badge deadline-expired';
        badge.textContent = 'Expired';
        renderAssessments(); // Re-render to lock action buttons
      }
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / 1000 / 60) % 60);
    const secs = Math.floor((diff / 1000) % 60);

    let timeRemainingStr = '';
    if (days > 0) timeRemainingStr += `${days}d `;
    timeRemainingStr += `${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;

    badge.className = 'deadline-badge deadline-active';
    badge.innerHTML = `<i class="fa-regular fa-clock"></i> Ends in: ${timeRemainingStr}`;
  });
}

// ==========================================================================
// STUDENT SUBMISSION HANDLERS & SUBMISSION HISTORY (SCOPED WITH SCHOOL ID)
// ==========================================================================
window.handleFormSubmission = async function(event) {
  event.preventDefault();

  const nameEl = document.getElementById('studentName');
  const classEl = document.getElementById('studentClass');
  const titleEl = document.getElementById('submissionTestTitle');
  const testIdEl = document.getElementById('submissionTestId');
  const fileInput = document.getElementById('assignmentFile');

  if (!fileInput || !fileInput.files.length) {
    showCustomModal({
      title: "Missing File",
      message: "Please select a file to upload.",
      type: "warning"
    });
    return;
  }

  const testIdVal = testIdEl ? testIdEl.value : null;
  const activeSchoolId = currentUser ? (currentUser.schoolId || currentUser.schoolID || window.currentSchoolId || 'default_school') : 'default_school';

  // 1. Deadline Validation Check
  const cachedQuizzes = JSON.parse(localStorage.getItem('portal_quizzes_cache')) || [];
  const currentQuiz = cachedQuizzes.find(q => String(q.id) === String(testIdVal));

  if (currentQuiz && currentQuiz.deadline) {
    const deadlineDate = new Date(currentQuiz.deadline);
    if (new Date() > deadlineDate) {
      showCustomModal({
        title: "Deadline Passed",
        message: "The submission deadline for this assessment has passed. You can no longer submit work.",
        type: "error"
      });
      return;
    }
  }

  const file = fileInput.files[0];
  
  // 2. File Size Validation (Max 20 MB = 20 * 1024 * 1024 bytes)
  const MAX_FILE_SIZE = 20971520; 
  if (file.size > MAX_FILE_SIZE) {
    showCustomModal({
      title: "File Too Large",
      message: "File size exceeds the 20 MB limit. Please upload a smaller document.",
      type: "warning"
    });
    return;
  }

  const studentNameVal = nameEl ? nameEl.value.trim() : (currentUser ? currentUser.fullName : '');
  const studentSchoolId = currentUser ? (currentUser.schoolId || currentUser.schoolID || currentUser.username || '') : '';
  const submissionId = `sub_${testIdVal}_${(studentSchoolId || studentNameVal).toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}`;
  
  let fileDownloadUrl = '';

  // 3. Upload file to Firebase Storage with tenant isolation folder path
  try {
    if (window.firebase && window.firebase.storage) {
      const storageRef = window.firebase.storage().ref();
      const fileRef = storageRef.child(`submissions/${activeSchoolId}/${submissionId}_${file.name}`);
      const snapshot = await fileRef.put(file);
      fileDownloadUrl = await snapshot.ref.getDownloadURL();
    }
  } catch (storageErr) {
    console.error('Firebase Storage upload error:', storageErr);
    showCustomModal({
      title: "Upload Warning",
      message: "Cloud storage upload failed. Falling back to local data encoding.",
      type: "warning"
    });
  }

  // Fallback if Firebase Storage wasn't used or failed
  if (!fileDownloadUrl) {
    fileDownloadUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  }

  const newSubmission = {
    id: submissionId,
    testId: String(testIdVal),
    studentName: studentNameVal,
    schoolId: activeSchoolId,
    studentUsername: studentSchoolId,
    studentClass: classEl ? classEl.value.trim() : '',
    testTitle: titleEl ? titleEl.value.trim() : '',
    fileName: file.name,
    fileUrl: fileDownloadUrl,
    submittedAt: new Date().toISOString(),
    grade: null,
    feedback: null
  };

  // 4. Save submission details to Firestore Database
  if (window.db) {
    try {
      await window.db.collection('submissions').doc(submissionId).set(newSubmission, { merge: true });
    } catch (err) {
      console.error('Firestore save error:', err);
    }
  }

  // 5. Cache locally (filtered/synced)
  let localSubmissions = JSON.parse(localStorage.getItem('portal_submissions')) || [];
  localSubmissions.unshift(newSubmission);
  localStorage.setItem('portal_submissions', JSON.stringify(localSubmissions));

  // 6. Cleanup & UI Feedback
  const form = document.getElementById('assignmentForm');
  if (form) form.reset();
  if (typeof closeSubmissionModal === 'function') closeSubmissionModal();

  showCustomModal({
    title: "Success",
    message: "Assignment submitted successfully!",
    type: "success"
  });

  if (typeof renderAssessments === 'function') renderAssessments();
  if (currentUser && currentUser.role === 'Teacher' && typeof renderSubmissions === 'function') renderSubmissions();
};

window.cancelSubmission = async function(testId) {
  if (!currentUser || currentUser.role !== 'Student') return;

  showCustomModal({
    title: "Cancel Submission",
    message: "Are you sure you want to cancel your submission?",
    type: "warning",
    showCancel: true,
    onConfirm: async () => {
      const studentName = currentUser.fullName;
      const studentSchoolId = currentUser.schoolId || currentUser.schoolID || currentUser.username || '';

      if (window.db) {
        try {
          let snap = await window.db.collection('submissions').where('testId', '==', String(testId)).where('schoolId', '==', studentSchoolId).get();
          if (snap.empty) {
            snap = await window.db.collection('submissions').where('testId', '==', String(testId)).where('studentName', '==', studentName).get();
          }
          const batch = window.db.batch();
          snap.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
        } catch (err) {
          console.error('Firestore delete error:', err);
        }
      }

      let submissions = JSON.parse(localStorage.getItem('portal_submissions')) || [];
      submissions = submissions.filter(s => {
        const matchesTest = String(s.testId) === String(testId);
        const matchesSchoolId = studentSchoolId && (s.schoolId || s.studentUsername || '').toLowerCase() === studentSchoolId.toLowerCase();
        const matchesName = s.studentName && s.studentName.toLowerCase() === studentName.toLowerCase();
        return !(matchesTest && (matchesSchoolId || matchesName));
      });
      localStorage.setItem('portal_submissions', JSON.stringify(submissions));

      showCustomModal({
        title: "Cancelled",
        message: "Your submission has been successfully cancelled.",
        type: "success"
      });

      if (typeof renderAssessments === 'function') renderAssessments();
    }
  });
};

document.addEventListener('DOMContentLoaded', () => {
  const navHomeLink = document.getElementById('navHomeLink');
  if (navHomeLink) {
    navHomeLink.addEventListener('click', (e) => navigateTo(e, 'home'));
  }

  const navQuizLink = document.getElementById('navQuizLink');
  if (navQuizLink) {
    navQuizLink.addEventListener('click', (e) => navigateTo(e, 'quiz'));
  }

  // Forms and Buttons
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  const profilePicInput = document.getElementById('profilePicInput');
  if (profilePicInput) {
    profilePicInput.addEventListener('change', handleProfilePicUpload);
  }

  const updateAccountForm = document.getElementById('updateAccountForm');
  if (updateAccountForm) {
    updateAccountForm.addEventListener('submit', handleUpdateAccountDetails);
  }

  const registerStudentForm = document.getElementById('registerStudentForm');
  if (registerStudentForm) {
    registerStudentForm.addEventListener('submit', handleRegisterStudent);
  }

  const bulkImportBtn = document.getElementById('bulkImportBtn');
  if (bulkImportBtn) {
    bulkImportBtn.addEventListener('click', handleBulkImport);
  }

  const assessmentForm = document.getElementById('assessmentForm');
  if (assessmentForm) {
    assessmentForm.addEventListener('submit', handleCreateAssessment);
  }

  const filterAssessmentClass = document.getElementById('filterAssessmentClass');
  if (filterAssessmentClass) {
    filterAssessmentClass.addEventListener('change', filterAssessmentsByClass);
  }

  const downloadCsvBtn = document.getElementById('downloadCsvBtn');
  if (downloadCsvBtn) {
    downloadCsvBtn.addEventListener('click', downloadStudentCSV);
  }

  const openManageStudentsBtn = document.getElementById('openManageStudentsBtn');
  if (openManageStudentsBtn) {
    openManageStudentsBtn.addEventListener('click', openManageStudentsModal);
  }

  const assignmentForm = document.getElementById('assignmentForm');
  if (assignmentForm) {
    assignmentForm.addEventListener('submit', handleFormSubmission);
  }

  const studentSearchInput = document.getElementById('studentSearchInput');
  if (studentSearchInput) {
    studentSearchInput.addEventListener('keyup', () => {
      if (typeof studentCurrentPage !== 'undefined') studentCurrentPage = 1;
      if (typeof renderStudentModalTable === 'function') renderStudentModalTable();
    });
  }

  const deleteAllStudentsBtn = document.getElementById('deleteAllStudentsBtn');
  if (deleteAllStudentsBtn) {
    deleteAllStudentsBtn.addEventListener('click', deleteAllStudents);
  }

  const gradingForm = document.getElementById('gradingForm');
  if (gradingForm) {
    gradingForm.addEventListener('submit', saveStudentGrade);
  }

  // Modal Close Listeners
  const closeSubmissionModalBtn = document.getElementById('closeSubmissionModalBtn');
  if (closeSubmissionModalBtn && typeof closeSubmissionModal === 'function') closeSubmissionModalBtn.addEventListener('click', closeSubmissionModal);

  const cancelSubmissionBtn = document.getElementById('cancelSubmissionBtn');
  if (cancelSubmissionBtn && typeof closeSubmissionModal === 'function') cancelSubmissionBtn.addEventListener('click', closeSubmissionModal);

  const closeManageStudentsModalBtn = document.getElementById('closeManageStudentsModalBtn');
  if (closeManageStudentsModalBtn && typeof closeManageStudentsModal === 'function') closeManageStudentsModalBtn.addEventListener('click', closeManageStudentsModal);

  const closeGradingModalBtn = document.getElementById('closeGradingModalBtn');
  if (closeGradingModalBtn && typeof closeGradingModal === 'function') closeGradingModalBtn.addEventListener('click', closeGradingModal);

  const cancelGradingBtn = document.getElementById('cancelGradingBtn');
  if (cancelGradingBtn && typeof closeGradingModal === 'function') cancelGradingBtn.addEventListener('click', closeGradingModal);

  // Initial check on load
  if (typeof checkUserSession === 'function') {
    checkUserSession();
  }
});

// --- CORE UTILS & FUNCTIONS ---

function toggleMobileMenu() {
  const navActions = document.getElementById('authNavActions');
  const menuIcon = document.getElementById('menuToggleIcon');
  navActions.classList.toggle('mobile-active');
  if (navActions.classList.contains('mobile-active')) {
    menuIcon.className = "fa-solid fa-xmark";
  } else {
    menuIcon.className = "fa-solid fa-bars";
  }
}

function navigateTo(e, routeKey) {
  if (e) e.preventDefault();
  const urls = {
    home: 'index.html',
    quiz: 'quiz.html',
    portal: 'assessments.html'
  };
  const targetUrl = urls[routeKey] || 'index.html';
  window.history.pushState({ route: routeKey }, '', targetUrl);
  window.location.href = targetUrl;
}

function generatePaginationHTML(currentPage, totalPages, callbackName) {
  if (totalPages <= 1) return '';
  
  let html = `<button class="page-btn" onclick="${callbackName}(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>`;
  
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    html += `<button class="page-btn" onclick="${callbackName}(1)">1</button>`;
    if (startPage > 2) {
      html += `<span class="page-ellipsis">&hellip;</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="${callbackName}(${i})">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      html += `<span class="page-ellipsis">&hellip;</span>`;
    }
    html += `<button class="page-btn" onclick="${callbackName}(${totalPages})">${totalPages}</button>`;
  }

  html += `<button class="page-btn" onclick="${callbackName}(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>`;
  
  return html;
}

// ==========================================================================
// PROFILE & ACCOUNT SETTINGS LOGIC (SCOPED WITH SCHOOL ID FOR TENANT ISOLATION)
// ==========================================================================

function handleProfilePicUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const currentUser = JSON.parse(localStorage.getItem('portal_session') || localStorage.getItem('currentLoggedInUser'));
  if (!currentUser) return;

  const activeSchoolId = currentUser.schoolId || currentUser.schoolID || window.currentSchoolId || 'default_school';
  const identifier = currentUser.schoolId || currentUser.username;
  const filePath = `profile_pictures/${activeSchoolId}/${identifier}_${Date.now()}_${file.name}`;
  const fileRef = storageRef.child(filePath);

  showCustomModal({
    title: "Uploading",
    message: "Uploading profile picture...",
    type: "info"
  });

  fileRef.put(file).then((snapshot) => {
    return snapshot.ref.getDownloadURL();
  }).then((downloadURL) => {
    currentUser.profilePic = downloadURL;
    currentUser.schoolId = activeSchoolId;
    localStorage.setItem('portal_session', JSON.stringify(currentUser));
    localStorage.setItem('currentLoggedInUser', JSON.stringify(currentUser));

    const sessionKey = currentUser.schoolId ? "schoolId" : "username";
    const sessionVal = currentUser.schoolId || currentUser.username;
    
    // Query users/students collection matching schoolId and identifier for tenant isolation
    let query = db.collection("students").where("schoolId", "==", activeSchoolId).where(sessionKey, "==", sessionVal);
    return query.get();
  }).then((querySnapshot) => {
    if (!querySnapshot.empty) {
      querySnapshot.forEach((doc) => {
        const activeUser = JSON.parse(localStorage.getItem('portal_session') || localStorage.getItem('currentLoggedInUser'));
        doc.ref.update({ profilePic: activeUser.profilePic });
      });
    }
    
    showCustomModal({
      title: "Success",
      message: "Profile picture updated successfully!",
      type: "success"
    });
    
    loadUserProfileUI();
  }).catch((error) => {
    console.error("Error uploading profile picture: ", error);
    
    showCustomModal({
      title: "Upload Failed",
      message: "Failed to upload image.",
      type: "error"
    });
  });
}

function loadUserProfileUI() {
  const currentUser = JSON.parse(localStorage.getItem('portal_session') || localStorage.getItem('currentLoggedInUser'));
  if (!currentUser) return;

  // Set default fallback if profilePic is missing or empty
  const userAvatar = currentUser.profilePic && currentUser.profilePic.trim() !== "" 
    ? currentUser.profilePic 
    : "images/default-avatar.png";

  // Update UI elements safely
  const bannerPic = document.getElementById('bannerProfilePic');
  if (bannerPic) bannerPic.src = userAvatar;

  const previewPic = document.getElementById('profilePicPreview');
  if (previewPic) previewPic.src = userAvatar;

  const nameDisplay = document.getElementById('userNameDisplay');
  if (nameDisplay) nameDisplay.textContent = currentUser.fullName || currentUser.username;

  const fullNameEl = document.getElementById('profileFullName');
  if (fullNameEl) fullNameEl.textContent = currentUser.fullName || currentUser.username;

  const usernameDisplay = document.getElementById('profileUsernameDisplay');
  if (usernameDisplay) usernameDisplay.textContent = "@" + (currentUser.schoolId || currentUser.username);

  const updateUsernameEl = document.getElementById('updateUsername');
  if (updateUsernameEl) updateUsernameEl.value = currentUser.schoolId || currentUser.username;
  
  if(document.getElementById('userRoleDisplay')) {
    document.getElementById('userRoleDisplay').textContent = currentUser.role || "User";
  }
}

// --- AUTHENTICATION MOCK & SESSION UTILS (WITH TENANT ISOLATION) ---
function checkUserSession() {
    // Read from 'portal_session' to match where executeLogin() saves the user
    const sessionData = localStorage.getItem('portal_session') || sessionStorage.getItem('portal_session');
    const currentUser = sessionData ? JSON.parse(sessionData) : null;
    
    if (currentUser) {
        const loginSec = document.getElementById('loginSection');
        if (loginSec) loginSec.style.display = 'none';

        const dashSec = document.getElementById('dashboardSection');
        if (dashSec) dashSec.style.display = 'block';

        if (typeof loadUserProfileUI === 'function') {
            loadUserProfileUI();
        }

        const teacherControls = document.getElementById('teacherControls');
        const teacherReports = document.getElementById('teacherReports');

        // Check user role securely
        const role = (currentUser.role || currentUser.userType || '').trim().toLowerCase();
        if (role === 'teacher' || role === 'admin' || role === 'administrator' || role === 'instructor') {
            if (teacherControls) teacherControls.style.display = 'block';
            if (teacherReports) teacherReports.style.display = 'grid';
        } else {
            if (teacherControls) teacherControls.style.display = 'none';
            if (teacherReports) teacherReports.style.display = 'none';
        }
    } else {
        const loginSec = document.getElementById('loginSection');
        if (loginSec) loginSec.style.display = 'block';

        const dashSec = document.getElementById('dashboardSection');
        if (dashSec) dashSec.style.display = 'none';
    }
}

// Floating Toast Notification Helper
function showToast(message, type = 'error') {
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px; pointer-events: none;';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.style.cssText = `
    background: ${type === 'error' ? '#e74c3c' : '#2ecc71'};
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-family: inherit;
    font-size: 14px;
    pointer-events: auto;
    transition: opacity 0.3s ease, transform 0.3s ease;
    opacity: 0;
    transform: translateY(-10px);
  `;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function handleLogin(e) {
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }
  
  // Directly invoke your robust execution engine
  if (typeof window.executeLogin === 'function') {
    window.executeLogin();
  } else {
    console.error("executeLogin routine is not defined.");
  }
}


// ==========================================================================
// ACCOUNT SETTINGS & UPDATE LOGIC (SCOPED WITH TENANT ISOLATION)
// ==========================================================================
window.handleUpdateAccountDetails = function(event) {
  event.preventDefault();
  const newUsernameInput = document.getElementById('updateUsername').value.trim().toLowerCase();
  const currentPasswordInput = document.getElementById('currentPassword').value.trim();
  const newPassword = document.getElementById('updatePassword').value.trim();
  const confirmPassword = document.getElementById('confirmPassword').value.trim();
  
  const currentUser = JSON.parse(localStorage.getItem('portal_session') || localStorage.getItem('currentLoggedInUser'));

  if (!currentUser || (!currentUser.username && !currentUser.schoolId)) {
    showCustomModal({
      title: "Session Expired",
      message: "No active session found. Please sign in again.",
      type: "warning"
    });
    return;
  }

  // 1. Check if new passwords match when attempting to change it
  if (newPassword && newPassword !== confirmPassword) {
    showCustomModal({
      title: "Password Mismatch",
      message: "New passwords do not match! Please re-enter.",
      type: "warning"
    });
    return;
  }

  const activeSchoolId = currentUser.schoolId || currentUser.schoolID || window.currentSchoolId || 'default_school';
  const oldKey = currentUser.schoolId || currentUser.username;
  const userRef = db.collection("students").doc(oldKey);

  userRef.get().then((docSnapshot) => {
    let targetDoc = docSnapshot;
    
    // Fallback search if doc by oldKey doesn't exist, filtered by schoolId
    if (!targetDoc.exists) {
      return db.collection("students").where("schoolId", "==", activeSchoolId).where("schoolId", "==", oldKey).get().then((snap) => {
        if (!snap.empty) return snap.docs[0];
        return db.collection("students").where("schoolId", "==", activeSchoolId).where("username", "==", oldKey).get().then((snap2) => {
          if (!snap2.empty) return snap2.docs[0];
          return null;
        });
      });
    }
    return targetDoc;
  }).then((resolvedDoc) => {
    if (!resolvedDoc || !resolvedDoc.exists) {
      showCustomModal({
        title: "User Not Found",
        message: "User record not found in database.",
        type: "error"
      });
      return;
    }

    const userData = resolvedDoc.data();
    const actualDocRef = resolvedDoc.ref;

    // Verify current password matches database record
    if (userData.password !== currentPasswordInput) {
      showCustomModal({
        title: "Authentication Failed",
        message: "Incorrect current password! Changes rejected.",
        type: "error"
      });
      return;
    }

    const updatingIdentifier = newUsernameInput && newUsernameInput !== (userData.schoolId || userData.username).toLowerCase();
    const updatingPassword = Boolean(newPassword);

    if (!updatingIdentifier && !updatingPassword) {
      showCustomModal({
        title: "No Changes",
        message: "No changes detected.",
        type: "info"
      });
      return;
    }

    // SCENARIO A: Identifier (SchoolID/Username) is changing (Migrating Firestore Document ID with Tenant Isolation)
    if (updatingIdentifier) {
      db.collection("students").where("schoolId", "==", activeSchoolId).where("schoolId", "==", newUsernameInput).get().then((newDocSnap) => {
        if (!newDocSnap.empty) {
          showCustomModal({
            title: "Identifier Taken",
            message: "School ID or username is already taken. Choose another one.",
            type: "warning"
          });
          return;
        }

        const migratedData = { ...userData };
        if (migratedData.schoolId) {
          migratedData.schoolId = newUsernameInput;
        } else {
          migratedData.username = newUsernameInput;
        }
        
        if (updatingPassword) {
          migratedData.password = newPassword;
        }

        // 1. Create the new document with the new identifier under students collection
        db.collection("students").doc(newUsernameInput).set(migratedData)
          .then(() => {
            // 2. Forcefully delete the old document
            return actualDocRef.delete();
          })
          .then(() => {
            // 3. Clear local session & remembered details so they are forced to log in fresh
            localStorage.removeItem('portal_session');
            localStorage.removeItem('portal_remembered_user');
            localStorage.removeItem('portal_remembered_pass');

            showCustomModal({
              title: "Details Updated Successfully",
              message: "Your School ID/Username has been changed. Please sign in again with your new credentials.",
              type: "success"
            });

            // Delay reload slightly so the user can read the modal before being sent back to login
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          })
          .catch((err) => {
            console.error("Error migrating identifier and cleaning old record:", err);
            showCustomModal({
              title: "Update Failed",
              message: "Failed to complete record migration. Check console.",
              type: "error"
            });
          });
      });
    } 
    // SCENARIO B: Only Password is changing in place
    else {
      const updatePayload = {};
      if (updatingPassword) {
        updatePayload.password = newPassword;
      }

      actualDocRef.update(updatePayload).then(() => {
        showCustomModal({
          title: "Success",
          message: "Password updated successfully!",
          type: "success"
        });
        
        if (typeof clearFormAndFinish === 'function') clearFormAndFinish();
      }).catch((err) => {
        console.error("Error updating password:", err);
        showCustomModal({
          title: "Update Failed",
          message: "Failed to update password.",
          type: "error"
        });
      });
    }

  }).catch((error) => {
    console.error("Error accessing database:", error);
    showCustomModal({
      title: "Database Error",
      message: "Error processing request. Check console for details.",
      type: "error"
    });
  });
};

function clearFormAndFinish() {
  document.getElementById('currentPassword').value = '';
  document.getElementById('updatePassword').value = '';
  document.getElementById('confirmPassword').value = '';

  showCustomModal({
    title: "Success",
    message: "Account details and security credentials updated successfully!",
    type: "success"
  });

  if (typeof loadUserProfileUI === 'function') {
    loadUserProfileUI();
  }
}

// Placeholder wrappers for features
function handleRegisterStudent(e) { e.preventDefault(); }
function handleBulkImport() {}
function handleCreateAssessment(e) { e.preventDefault(); }
function filterAssessmentsByClass() {}
function downloadStudentCSV() {}
function openManageStudentsModal() { document.getElementById('manageStudentsModal').style.display = 'flex'; }
function closeManageStudentsModal() { document.getElementById('manageStudentsModal').style.display = 'none'; }
function handleFormSubmission(e) { e.preventDefault(); }
function deleteAllStudents() {}
function closeSubmissionModal() { document.getElementById('submissionModal').style.display = 'none'; }
function closeGradingModal() { document.getElementById('gradingModal').style.display = 'none'; }
function saveStudentGrade(e) { e.preventDefault(); }
function renderStudentModalTable() {}

/* ==========================================================================
   TEACHER GRADING & FEEDBACK MODULE
   ========================================================================== */
window.openGradingModal = function(submissionId) {
  let modal = document.getElementById('gradingModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'gradingModal';
    modal.className = 'modal-backdrop';
    modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); justify-content:center; align-items:center; z-index:1000;';
    modal.innerHTML = `
      <div class="modal-content" style="background:#fff; padding:2rem; border-radius:12px; width:90%; max-width:500px; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <h3 style="margin:0; color:#1e293b;"><i class="fa-solid fa-award"></i> Grade Student Submission</h3>
          <button type="button" onclick="closeGradingModal()" style="background:none; border:none; font-size:1.2rem; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <form id="gradingForm" onsubmit="saveSubmissionGrade(event)">
          <input type="hidden" id="gradingSubmissionId">
          <div style="margin-bottom:0.8rem;">
            <label style="display:block; font-size:0.85rem; font-weight:600; margin-bottom:0.2rem;">Student Name</label>
            <input type="text" id="modalStudentName" readonly style="width:100%; padding:0.5rem; background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; color:#475569;">
          </div>
          <div style="margin-bottom:0.8rem;">
            <label style="display:block; font-size:0.85rem; font-weight:600; margin-bottom:0.2rem;">Learner's Class</label>
            <input type="text" id="modalStudentClass" readonly style="width:100%; padding:0.5rem; background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; color:#475569;">
          </div>
          <div style="margin-bottom:0.8rem;">
            <label style="display:block; font-size:0.85rem; font-weight:600; margin-bottom:0.2rem;">Assessment Title</label>
            <input type="text" id="modalAssessmentTitle" readonly style="width:100%; padding:0.5rem; background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; color:#475569;">
          </div>
          <div style="margin-bottom:0.8rem;">
            <label style="display:block; font-size:0.85rem; font-weight:600; margin-bottom:0.2rem;">Score / Grade</label>
            <input type="text" id="gradeScoreInput" placeholder="e.g. 85/100 or Distinction" required style="width:100%; padding:0.6rem; border:1px solid #cbd5e1; border-radius:6px;">
          </div>
          <div style="margin-bottom:1rem;">
            <label style="display:block; font-size:0.85rem; font-weight:600; margin-bottom:0.2rem;">Teacher Feedback / Comments</label>
            <textarea id="gradeFeedbackInput" rows="3" placeholder="Provide constructive feedback..." style="width:100%; padding:0.6rem; border:1px solid #cbd5e1; border-radius:6px;"></textarea>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
            <button type="button" onclick="closeGradingModal()" class="btn-action btn-secondary" style="padding:0.5rem 1rem;">Cancel</button>
            <button type="submit" class="btn-action btn-upload" style="padding:0.5rem 1rem;">Save Grade & Feedback</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // Display modal immediately
  modal.style.display = 'flex';

  // Set initial fields
  document.getElementById('gradingSubmissionId').value = submissionId;
  document.getElementById('modalStudentName').value = 'Loading...';
  document.getElementById('modalStudentClass').value = 'Loading...';
  document.getElementById('modalAssessmentTitle').value = 'Loading...';
  document.getElementById('gradeScoreInput').value = '';
  document.getElementById('gradeFeedbackInput').value = '';

  // Fetch submission details asynchronously from Firestore or LocalStorage cache
  (async () => {
    let targetSub = null;
    if (window.db) {
      try {
        const docSnap = await window.db.collection('submissions').doc(submissionId).get();
        if (docSnap.exists) {
          targetSub = docSnap.data();
        }
      } catch (err) {
        console.warn('Firestore fetch error for grading modal, checking local cache:', err);
      }
    }

    if (!targetSub) {
      let submissions = JSON.parse(localStorage.getItem('portal_submissions')) || [];
      targetSub = submissions.find(s => s.id === submissionId);
    }

    if (targetSub) {
      document.getElementById('modalStudentName').value = targetSub.studentName || 'Unknown Student';
      document.getElementById('modalStudentClass').value = targetSub.studentClass || 'N/A';
      document.getElementById('modalAssessmentTitle').value = targetSub.testTitle || 'Untitled Assessment';
      document.getElementById('gradeScoreInput').value = targetSub.grade || '';
      document.getElementById('gradeFeedbackInput').value = targetSub.feedback || '';
    } else {
      document.getElementById('modalStudentName').value = 'Not Found';
      document.getElementById('modalStudentClass').value = 'Not Found';
      document.getElementById('modalAssessmentTitle').value = 'Not Found';
    }
  })();
};

window.closeGradingModal = function() {
  const modal = document.getElementById('gradingModal');
  if (modal) modal.style.display = 'none';
};

window.saveSubmissionGrade = async function(e) {
  e.preventDefault();
  const subId = document.getElementById('gradingSubmissionId').value;
  const grade = document.getElementById('gradeScoreInput').value.trim();
  const feedback = document.getElementById('gradeFeedbackInput').value.trim();

  // 1. Update Firestore Database
  if (window.db) {
    try {
      await window.db.collection('submissions').doc(subId).set({ grade, feedback }, { merge: true });
    } catch (err) {
      console.error('Firestore grade sync error:', err);
    }
  }

  // 2. Update LocalStorage Cache
  let submissions = JSON.parse(localStorage.getItem('portal_submissions')) || [];
  const idx = submissions.findIndex(s => s.id === subId);
  if (idx !== -1) {
    submissions[idx].grade = grade;
    submissions[idx].feedback = feedback;
    localStorage.setItem('portal_submissions', JSON.stringify(submissions));
  }

  showCustomModal({
    title: "Success",
    message: "Grade and feedback saved successfully!",
    type: "success"
  });

  closeGradingModal();
  renderSubmissions();
};

window.renderSubmissions = async function() {
  const container = document.getElementById('submissionsContainer');
  const paginationContainer = document.getElementById('submissionsPagination');
  if (!container) return;

  const currentUser = JSON.parse(localStorage.getItem('portal_session') || localStorage.getItem('currentLoggedInUser') || '{}');
  const activeSchoolId = currentUser ? (currentUser.schoolId || currentUser.schoolID || window.currentSchoolId) : null;

  let submissions = [];
  
  if (window.db) {
    try {
      let query = window.db.collection('submissions');
      if (activeSchoolId && currentUser.role !== 'admin') {
        query = query.where('schoolId', '==', activeSchoolId);
      }
      const snap = await query.get();
      snap.forEach(doc => submissions.push({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn('Firestore submissions fetch warning:', err);
    }
  }

  if (submissions.length === 0) {
    submissions = JSON.parse(localStorage.getItem('portal_submissions')) || [];
    if (activeSchoolId && currentUser && currentUser.role !== 'admin') {
      submissions = submissions.filter(s => (s.schoolId || '').toLowerCase() === activeSchoolId.toLowerCase());
    }
  }

  if (submissions.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem 1.5rem; color: #64748b;">
        <i class="fa-solid fa-folder-open" style="font-size: 2.2rem; margin-bottom: 0.75rem; color: #cbd5e1;"></i>
        <p style="font-size: 0.9rem; font-weight: 500; margin: 0;">No student work submitted yet.</p>
      </div>
    `;
    if (paginationContainer) paginationContainer.style.display = 'none';
    return;
  }

  submissions.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));

  let html = `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; border-top-left-radius: 8px; border-top-right-radius: 8px; font-size: 0.85rem; color: #475569;">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <input type="checkbox" id="selectAllSubmissions" onclick="toggleSelectAllSubmissions(this)" style="cursor: pointer; width: 16px; height: 16px; accent-color: #0ea5e9;" title="Select All">
        <span style="font-weight: 600; color: #1e293b;">Select All (${submissions.length})</span>
      </div>
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <button type="button" id="bulkDownloadBtn" onclick="downloadAllStudentSubmissions()" style="display: flex; align-items: center; gap: 0.4rem; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; padding: 0.35rem 0.75rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.2s;">
          <i class="fa-solid fa-file-zipper"></i> Download All as ZIP
        </button>
        <button type="button" id="bulkDeleteBtn" onclick="deleteSelectedSubmissions()" style="display: none; align-items: center; gap: 0.4rem; background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; padding: 0.35rem 0.75rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.2s;">
          <i class="fa-solid fa-trash-can"></i> Delete Selected
        </button>
      </div>
    </div>
    <div style="background: #ffffff; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; overflow: hidden;">
  `;

  html += submissions.map(sub => {
    const studentIdentifier = sub.schoolId || sub.studentUsername || sub.studentName || 'N/A';
    const formattedDate = sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    
    return `
    <div class="sub-item" data-id="${sub.id}" style="display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1rem; border-bottom: 1px solid #f1f5f9; gap: 1rem; transition: background 0.15s;">
      <div style="display: flex; align-items: center; gap: 1rem; flex: 1; min-width: 0;">
        <input type="checkbox" class="submission-checkbox" value="${sub.id}" data-url="${escapeHtml(sub.fileUrl || '')}" data-name="${escapeHtml(sub.studentName || 'Student')}_${escapeHtml(sub.fileName || 'submission')}" onclick="updateBulkDeleteState()" style="cursor: pointer; width: 16px; height: 16px; accent-color: #0ea5e9; flex-shrink: 0;">
        <div style="min-width: 0;">
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.2rem;">
            <strong style="color: #0f172a; font-size: 0.9rem;">${escapeHtml(sub.studentName || 'Unnamed Student')}</strong> 
            <span style="background: #e0f2fe; color: #0369a1; font-size: 0.7rem; padding: 1px 6px; border-radius: 4px; font-weight: 600;">${escapeHtml(sub.studentClass || 'N/A')}</span>
            <span style="color: #64748b; font-size: 0.75rem;">(${escapeHtml(studentIdentifier)})</span>
            ${sub.grade ? `<span style="background: #dcfce7; color: #166534; font-size: 0.7rem; padding: 1px 6px; border-radius: 4px; font-weight: 600;"><i class="fa-solid fa-award"></i> Grade: ${escapeHtml(sub.grade)}</span>` : ''}
          </div>
          <div style="color: #475569; font-size: 0.82rem; word-break: break-word; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <span><i class="fa-solid fa-file-lines" style="color: #0ea5e9;"></i> ${escapeHtml(sub.testTitle || 'Assignment')} - <em>${escapeHtml(sub.fileName || 'file')}</em></span>
            ${formattedDate ? `<span style="color: #94a3b8; font-size: 0.75rem;"><i class="fa-regular fa-clock"></i> ${formattedDate}</span>` : ''}
          </div>
        </div>
      </div>
      
      <div style="display: flex; gap: 0.35rem; align-items: center; flex-shrink: 0;">
        <a href="${sub.fileUrl || '#'}" download="${escapeHtml(sub.fileName || 'submission')}" target="_blank" rel="noopener noreferrer" title="Download File" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: #f1f5f9; color: #0284c7; border-radius: 6px; text-decoration: none; transition: background 0.2s;">
          <i class="fa-solid fa-download" style="font-size: 0.85rem;"></i>
        </a>
        <button type="button" onclick="openGradingModal('${sub.id}')" title="Grade Submission" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: #f0fdf4; color: #16a34a; border: none; border-radius: 6px; cursor: pointer; transition: background 0.2s;">
          <i class="fa-solid fa-star" style="font-size: 0.85rem;"></i>
        </button>
        <button type="button" onclick="deleteSingleSubmission('${sub.id}')" title="Delete Submission" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: #fef2f2; color: #dc2626; border: none; border-radius: 6px; cursor: pointer; transition: background 0.2s;">
          <i class="fa-solid fa-trash-can" style="font-size: 0.85rem;"></i>
        </button>
      </div>
    </div>
  `;
  }).join('');

  html += `</div>`;
  container.innerHTML = html;
  if (paginationContainer) paginationContainer.style.display = 'flex';
};

// Companion function using your exact showCustomModal implementation
window.downloadAllStudentSubmissions = async function() {
  if (!window.JSZip) {
    showCustomModal({
      title: "Library Error",
      message: "JSZip library is not loaded.",
      type: "error"
    });
    return;
  }

  const checkboxes = document.querySelectorAll('.submission-checkbox:checked');
  const targetCheckboxes = checkboxes.length > 0 ? checkboxes : document.querySelectorAll('.submission-checkbox');

  if (targetCheckboxes.length === 0) {
    showCustomModal({
      title: "No Submissions",
      message: "No submissions available to download.",
      type: "warning"
    });
    return;
  }

  const zip = new JSZip();
  const folder = zip.folder("Student_Submissions_Batch");
  
  const btn = document.getElementById('bulkDownloadBtn');
  const originalText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Packaging...`;
    btn.disabled = true;
  }

  let successCount = 0;

  for (const cb of targetCheckboxes) {
    const fileUrl = cb.getAttribute('data-url');
    const fileName = cb.getAttribute('data-name');
    
    if (fileUrl && fileUrl !== '#') {
      try {
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        const safeName = fileName.replace(/[/\\?%*:|"<>]/g, '-');
        folder.file(safeName, blob);
        successCount++;
      } catch (err) {
        console.error(`Failed to download file: ${fileName}`, err);
      }
    }
  }

  if (successCount === 0) {
    showCustomModal({
      title: "Download Failed",
      message: "Could not fetch any files for packaging.",
      type: "error"
    });
    if (btn) {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
    return;
  }

  const content = await zip.generateAsync({ type: "blob" });
  const blobUrl = URL.createObjectURL(content);
  
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `Student_Submissions_${Date.now()}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

  if (btn) {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }

  showCustomModal({
    title: "Success",
    message: `Successfully packaged and downloaded ${successCount} student submission(s) into a ZIP archive.`,
    type: "success"
  });
};

window.toggleSelectAllSubmissions = function(source) {
  const checkboxes = document.querySelectorAll('.submission-checkbox');
  checkboxes.forEach(cb => cb.checked = source.checked);
  window.updateBulkDeleteState();
};

window.updateBulkDeleteState = function() {
  const checkboxes = document.querySelectorAll('.submission-checkbox:checked');
  const bulkBtn = document.getElementById('bulkDeleteBtn');
  const selectAllMaster = document.getElementById('selectAllSubmissions');
  const allCheckboxes = document.querySelectorAll('.submission-checkbox');
  
  if (bulkBtn) {
    if (checkboxes.length > 0) {
      bulkBtn.style.display = 'inline-flex';
      bulkBtn.innerHTML = `<i class="fa-solid fa-trash-can"></i> Delete (${checkboxes.length})`;
    } else {
      bulkBtn.style.display = 'none';
    }
  }

  if (selectAllMaster && allCheckboxes.length > 0) {
    selectAllMaster.checked = checkboxes.length === allCheckboxes.length;
    selectAllMaster.indeterminate = checkboxes.length > 0 && checkboxes.length < allCheckboxes.length;
  }
};

window.deleteSingleSubmission = function(id) {
  showCustomModal({
    title: 'Confirm Deletion',
    message: "Are you sure you want to delete this learner's submission?",
    type: 'confirm',
    showCancel: true,
    onConfirm: async () => {
      try {
        if (window.db) {
          await window.db.collection('submissions').doc(id).delete();
        }
        let localSubs = JSON.parse(localStorage.getItem('portal_submissions')) || [];
        localSubs = localSubs.filter(s => s.id !== id);
        localStorage.setItem('portal_submissions', JSON.stringify(localSubs));

        showCustomModal({
          title: 'Success',
          message: 'Submission deleted successfully.',
          type: 'success'
        });
        window.renderSubmissions();
      } catch (err) {
        console.error("Error deleting submission:", err);
        showCustomModal({
          title: 'Error',
          message: 'Failed to delete submission.',
          type: 'error'
        });
      }
    }
  });
};

window.deleteSelectedSubmissions = function() {
  const checkedBoxes = document.querySelectorAll('.submission-checkbox:checked');
  if (checkedBoxes.length === 0) return;

  showCustomModal({
    title: 'Confirm Bulk Deletion',
    message: `Are you sure you want to delete ${checkedBoxes.length} selected submission(s)?`,
    type: 'confirm',
    showCancel: true,
    onConfirm: async () => {
      const idsToDelete = Array.from(checkedBoxes).map(cb => cb.value);

      try {
        if (window.db) {
          const batch = window.db.batch();
          idsToDelete.forEach(id => {
            const ref = window.db.collection('submissions').doc(id);
            batch.delete(ref);
          });
          await batch.commit();
        }

        let localSubs = JSON.parse(localStorage.getItem('portal_submissions')) || [];
        localSubs = localSubs.filter(s => !idsToDelete.includes(s.id));
        localStorage.setItem('portal_submissions', JSON.stringify(localSubs));

        showCustomModal({
          title: 'Success',
          message: `${idsToDelete.length} submissions deleted successfully.`,
          type: 'success'
        });
        window.renderSubmissions();
      } catch (err) {
        console.error("Error performing bulk deletion:", err);
        showCustomModal({
          title: 'Error',
          message: 'Failed to delete selected submissions.',
          type: 'error'
        });
      }
    }
  });
};


/* ==========================================================================
   STUDENT SUBMISSION LOCK & CARD VIEW HELPERS (30-Min Lock & Grades)
   ========================================================================== */
window.isSubmissionLocked = function(submittedAt) {
  if (!submittedAt) return false;
  const submissionTime = new Date(submittedAt).getTime();
  const currentTime = new Date().getTime();
  const thirtyMinutesInMs = 30 * 60 * 1000;
  return (currentTime - submissionTime) > thirtyMinutesInMs;
};

window.getStudentSubmissionCardHTML = function(sub, assessmentId) {
  if (!sub) {
    return `
      <div style="margin-top:1rem;">
        <button type="button" onclick="openUploadModal('${assessmentId}')" class="btn-action btn-upload" style="padding:0.4rem 0.8rem; font-size:0.8rem;">
          <i class="fa-solid fa-upload"></i> Submit Assignment
        </button>
      </div>
    `;
  }

  const locked = window.isSubmissionLocked(sub.submittedAt);

  return `
    <div style="margin-top:1rem; padding:0.75rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
      <span style="color:#16a34a; font-size:0.85rem; font-weight:600;">
        <i class="fa-solid fa-circle-check"></i> Submitted (${sub.fileName || 'file'})
      </span>

      <!-- Grade & Teacher Feedback Display on Card -->
      ${sub.grade ? `
        <div style="margin-top:0.5rem; background:#dcfce7; border:1px solid #bbf7d0; padding:0.5rem 0.75rem; border-radius:6px; color:#166534; font-size:0.85rem;">
          <strong><i class="fa-solid fa-award"></i> Grade:</strong> ${sub.grade}
          ${sub.feedback ? `<br><strong>Feedback:</strong> ${sub.feedback}` : ''}
        </div>
      ` : ''}

      <!-- Action Buttons with 30-Minute Time Lock -->
      <div style="display:flex; gap:0.5rem; margin-top:0.6rem; align-items:center; flex-wrap:wrap;">
        ${locked ? `
          <span style="color:#64748b; font-size:0.78rem; font-style:italic;">
            <i class="fa-solid fa-lock"></i> Locked (30-min editing window closed)
          </span>
        ` : `
          <button type="button" onclick="openUploadModal('${assessmentId}', '${sub.id}')" class="btn-action btn-upload" style="background:#eab308; color:#fff; padding:0.3rem 0.6rem; font-size:0.75rem;">
            <i class="fa-solid fa-rotate"></i> Replace
          </button>
          <button type="button" onclick="deleteSubmission('${sub.id}')" class="btn-action btn-danger" style="background:#dc2626; color:#fff; padding:0.3rem 0.6rem; font-size:0.75rem;">
            <i class="fa-solid fa-trash"></i> Delete
          </button>
        `}
      </div>
    </div>
  `;
};

/* ==========================================================================
   STUDENT PORTAL: VIEW OWN GRADES & FEEDBACK MODULE
   ========================================================================== */
window.renderStudentGrades = async function(currentStudentIdentifier) {
  const container = document.getElementById('studentGradesContainer');
  if (!container) return;

  const currentUser = JSON.parse(localStorage.getItem('portal_session') || localStorage.getItem('currentLoggedInUser'));
  const activeSchoolId = currentUser ? (currentUser.schoolId || currentUser.schoolID || window.currentSchoolId) : null;

  let submissions = [];
  
  if (window.db) {
    try {
      let queryRef = window.db.collection('submissions');
      if (activeSchoolId) {
        queryRef = queryRef.where('schoolId', '==', activeSchoolId);
      }
      let snap = await queryRef.where('studentUsername', '==', currentStudentIdentifier).get();
      if (snap.empty) {
        let queryRef2 = window.db.collection('submissions');
        if (activeSchoolId) queryRef2 = queryRef2.where('schoolId', '==', activeSchoolId);
        snap = await queryRef2.where('studentId', '==', currentStudentIdentifier).get();
      }
      snap.forEach(doc => submissions.push({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn('Firestore student grades fetch warning:', err);
    }
  }

  if (submissions.length === 0) {
    submissions = JSON.parse(localStorage.getItem('portal_submissions')) || [];
    submissions = submissions.filter(s => {
      const matchSchoolId = !activeSchoolId || (s.schoolId && s.schoolId.toLowerCase() === activeSchoolId.toLowerCase());
      const matchUsername = (s.schoolId && s.schoolId.toLowerCase() === currentStudentIdentifier.toLowerCase()) || 
                          (s.studentUsername && s.studentUsername.toLowerCase() === currentStudentIdentifier.toLowerCase()) || 
                          (s.studentId && s.studentId.toLowerCase() === currentStudentIdentifier.toLowerCase());
      return matchSchoolId && matchUsername;
    });
  }

  if (submissions.length === 0) {
    container.innerHTML = '<p style="color:#64748b; font-size:0.85rem;">No submissions found for your profile.</p>';
    return;
  }

  container.innerHTML = submissions.map(sub => `
    <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:1rem; margin-bottom:0.75rem; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem; flex-wrap:wrap; gap:0.5rem;">
        <div>
          <strong style="color:#1e293b; font-size:0.95rem;">${sub.testTitle}</strong><br>
          <span style="color:#64748b; font-size:0.8rem;">File: <em>${sub.fileName}</em></span>
        </div>
        <div>
          ${sub.grade 
            ? `<span style="background:#dcfce7; color:#16a34a; padding:0.25rem 0.6rem; border-radius:20px; font-size:0.8rem; font-weight:600;"><i class="fa-solid fa-award"></i> Grade: ${sub.grade}</span>`
            : `<span style="background:#fef3c7; color:#d97706; padding:0.25rem 0.6rem; border-radius:20px; font-size:0.8rem; font-weight:600;">Pending Review</span>`
          }
        </div>
      </div>
      ${sub.feedback ? `
        <div style="margin-top:0.5rem; background:#f8fafc; border-left:3px solid #2563eb; padding:0.5rem 0.75rem; font-size:0.85rem; color:#334155;">
          <strong>Teacher Feedback:</strong> ${sub.feedback}
        </div>
      ` : ''}
    </div>
  `).join('');
};

/* ==========================================================================
   MODAL TOGGLES
   ========================================================================== */
window.openSubmissionModal = function() {
  const modal = document.getElementById('submissionModal');
  if (modal) modal.style.display = 'flex';
};

window.closeSubmissionModal = function() {
  const modal = document.getElementById('submissionModal');
  if (modal) modal.style.display = 'none';
};

// ==========================================================================
// MODAL & PAGINATION UTILITIES (SCOPED WITH TENANT ISOLATION)
// ==========================================================================
window.openSubmissionModalWithDetails = function(testId, encodedTitle) {
  const decodedTitle = decodeURIComponent(encodedTitle);
  openSubmissionModal();

  const currentUser = JSON.parse(localStorage.getItem('portal_session') || localStorage.getItem('currentLoggedInUser'));
  if (currentUser) {
    const nameEl = document.getElementById('studentName');
    const classEl = document.getElementById('studentClass');
    if (nameEl) nameEl.value = currentUser.fullName || '';
    if (classEl) classEl.value = currentUser.class || '';
  }

  const titleEl = document.getElementById('submissionTestTitle');
  if (titleEl) titleEl.value = decodedTitle;

  let testIdEl = document.getElementById('submissionTestId');
  if (!testIdEl) {
    testIdEl = document.createElement('input');
    testIdEl.type = 'hidden';
    testIdEl.id = 'submissionTestId';
    const form = document.getElementById('assignmentForm');
    if (form) form.appendChild(testIdEl);
  }
  testIdEl.value = testId;
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderPaginationControls(totalItems, rowsPerPage, currentPage, containerElement, onPageChangeCallback) {
  if (!containerElement) return;
  containerElement.innerHTML = "";

  const totalPages = Math.ceil(totalItems / rowsPerPage);
  if (totalPages <= 1) return;

  // Previous Button
  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "page-btn";
  prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => onPageChangeCallback(currentPage - 1);
  containerElement.appendChild(prevBtn);

  // Page Numbers with Ellipsis logic
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  if (startPage > 1) {
    const firstBtn = document.createElement("button");
    firstBtn.type = "button";
    firstBtn.className = "page-btn";
    firstBtn.textContent = "1";
    firstBtn.onclick = () => onPageChangeCallback(1);
    containerElement.appendChild(firstBtn);

    if (startPage > 2) {
      const ellipsis = document.createElement("span");
      ellipsis.className = "page-ellipsis";
      ellipsis.textContent = "...";
      containerElement.appendChild(ellipsis);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const pageBtn = document.createElement("button");
    pageBtn.type = "button";
    pageBtn.className = `page-btn ${i === currentPage ? "active" : ""}`;
    pageBtn.textContent = i;
    pageBtn.onclick = () => onPageChangeCallback(i);
    containerElement.appendChild(pageBtn);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement("span");
      ellipsis.className = "page-ellipsis";
      ellipsis.textContent = "...";
      containerElement.appendChild(ellipsis);
    }

    const lastBtn = document.createElement("button");
    lastBtn.type = "button";
    lastBtn.className = "page-btn";
    lastBtn.textContent = totalPages;
    lastBtn.onclick = () => onPageChangeCallback(totalPages);
    containerElement.appendChild(lastBtn);
  }

  // Next Button
  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "page-btn";
  nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => onPageChangeCallback(currentPage + 1);
  containerElement.appendChild(nextBtn);
}

// Global Custom Dialog Helper
function showCustomModal({ title, message, type = 'info', showCancel = false, onConfirm, onCancel }) {
  const modal = document.getElementById('customModal');
  const iconEl = document.getElementById('customModalIcon');
  const titleEl = document.getElementById('customModalTitle');
  const msgEl = document.getElementById('customModalMessage');
  const actionsEl = document.getElementById('customModalActions');

  if (!modal) return;

  // Set Content
  titleEl.textContent = title;
  msgEl.textContent = message;

  // Style Icons & Colors based on Type
  let iconHtml = '';
  let btnColor = '#2563eb';

  if (type === 'success') {
    iconHtml = '<i class="fa-solid fa-circle-check" style="color: #16a34a;"></i>';
    btnColor = '#16a34a';
  } else if (type === 'error') {
    iconHtml = '<i class="fa-solid fa-triangle-exclamation" style="color: #dc2626;"></i>';
    btnColor = '#dc2626';
  } else if (type === 'warning' || type === 'confirm') {
    iconHtml = '<i class="fa-solid fa-circle-exclamation" style="color: #eab308;"></i>';
    btnColor = '#d97706';
  } else {
    iconHtml = '<i class="fa-solid fa-circle-info" style="color: #2563eb;"></i>';
  }

  iconEl.innerHTML = iconHtml;

  // Build Action Buttons
  actionsEl.innerHTML = '';
  
  if (showCancel) {
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-action btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => {
      modal.style.display = 'none';
      if (typeof onCancel === 'function') onCancel();
    };
    actionsEl.appendChild(cancelBtn);
  }

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn-action';
  confirmBtn.style.background = btnColor;
  confirmBtn.style.color = '#ffffff';
  confirmBtn.textContent = 'OK';
  confirmBtn.onclick = () => {
    modal.style.display = 'none';
    if (typeof onConfirm === 'function') onConfirm();
  };
  actionsEl.appendChild(confirmBtn);

  modal.style.display = 'flex';
}
