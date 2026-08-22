/* ==========================================================================
   SAMCAM SOLUTIONS - ASSESSMENT PORTAL ENGINE (script.js)
   ========================================================================== */
// Shared Portal State
window.currentUser = null;
let editingUsername = null;
let currentStudentSubmissionsPage = 1;
const ITEMS_PER_PAGE = 5;

// --- FIREBASE SETUP ---
// Firebase is already initialized in firebase-config.js. 
// You can directly use window.db and window.storageRef across your scripts.

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
   1. AUTHENTICATION MODULE
   ========================================================================== */
window.executeLogin = async function() {
  const userEl = document.getElementById('loginUsername');
  const passEl = document.getElementById('loginPassword');
  const errEl = document.getElementById('loginError');

  if (!userEl || !passEl) return;

  const u = userEl.value.trim().toLowerCase();
  const p = passEl.value.trim();

  if (!u || !p) {
    if (errEl) {
      errEl.textContent = 'Please fill in both fields.';
      errEl.style.display = 'block';
    }
    return;
  }

  let foundUser = null;

  // 1. Primary Auth: Firebase Firestore
  if (window.db) {
    try {
      const snap = await window.db.collection('users').doc(u).get();
      if (snap.exists) {
        const userData = snap.data();
        if (userData.password === p) {
          // Normalize and enrich the user object with document ID as username
          foundUser = {
            username: snap.id,
            name: userData.fullName || userData.name || snap.id,
            role: userData.role || 'Student',
            userClass: userData.class || userData.userClass || '',
            profilePic: userData.profilePic || '',
            ...userData
          };
        }
      }
    } catch (err) {
      console.warn("Firestore lookup error:", err);
    }
  }

  // 2. Offline Fallback: LocalStorage users
  if (!foundUser) {
    try {
      const localUsers = JSON.parse(localStorage.getItem('portal_users')) || [];
      const match = localUsers.find(
        acc => (acc.username || '').toLowerCase() === u && acc.password === p
      );
      if (match) {
        foundUser = {
          username: match.username || u,
          name: match.fullName || match.name || match.username || u,
          role: match.role || 'Student',
          userClass: match.class || match.userClass || '',
          profilePic: match.profilePic || '',
          ...match
        };
      }
    } catch (e) {
      console.error("Error checking portal_users fallback:", e);
    }
  }

  // 3. Complete Login
  if (foundUser) {
    if (errEl) errEl.style.display = 'none';

    // Save to LocalStorage
    localStorage.setItem('portal_session', JSON.stringify(foundUser));
    
    // Broadcast to global window and all running scripts
    broadcastSessionUpdate(foundUser);

    userEl.value = '';
    passEl.value = '';

    // Reveal protected navigation links upon successful login
    const navActions = document.getElementById('authNavActions');
    if (navActions) {
      navActions.style.display = 'flex';
    }

    if (typeof updatePortalUI === 'function') updatePortalUI();
    
    // Clean up any trailing hashes like #login from the URL bar
    if (window.location.hash) {
      history.replaceState(null, document.title, window.location.pathname + window.location.search);
    }

    navigateToView('dashboard', true);
  } else {
    if (errEl) {
      errEl.textContent = 'Invalid username or password!';
      errEl.style.display = 'block';
    }
  }
};

window.handleLogin = function(e) {
  if (e && e.preventDefault) e.preventDefault();
  window.executeLogin();
};

window.handleLogout = function() {
  // 1. Clear ALL possible session storage locations
  localStorage.removeItem('portal_session');
  localStorage.removeItem('currentLoggedInUser');
  sessionStorage.removeItem('portal_session');
  sessionStorage.removeItem('currentLoggedInUser');

  // 2. Clear global user memory states
  if (typeof broadcastSessionUpdate === 'function') {
    broadcastSessionUpdate(null);
  }
  window.currentUser = null;

  // 3. Reset input fields if present
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

  if (typeof updatePortalUI === 'function') updatePortalUI();

  // 5. Force a hard redirect or reload to clear cached DOM memory
  window.location.href = 'assessments.html'; 
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
    if (fullNameDisplay) fullNameDisplay.textContent = user.fullName || user.username || "User";
    if (usernameDisplay) usernameDisplay.textContent = "@" + (user.username || "");
    if (nameDisplay) nameDisplay.textContent = user.fullName || user.username || "User";
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
    if (!currentUser || !currentUser.username) {
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
      const filePath = `profile_pictures/${currentUser.username}_${Date.now()}.${fileExtension}`;
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

      // Update Firestore database document using the user's username as the document ID
      if (window.db) {
        const docId = currentUser.username;
        const userDocRef = window.db.collection('users').doc(docId);
        
        await userDocRef.set({ profilePic: downloadURL }, { merge: true });
        console.log("💾 Firestore user profilePic updated for document (username):", docId);
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
    openManageStaffBtn.addEventListener("click", openManageStaffModal);
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
});

// 1. Handle Registration of New Teachers / Admins
async function handleRegisterStaff(e) {
  e.preventDefault();

  const fullName = document.getElementById("staffFullName").value.trim();
  const role = document.getElementById("staffRole").value; // 'teacher' or 'admin'
  const username = document.getElementById("staffUsername").value.trim().toLowerCase();
  const password = document.getElementById("staffPassword").value.trim();

  if (!fullName || !role || !username || !password) {
    showCustomModal({
      title: "Missing Information",
      message: "Please fill in all required fields for staff registration.",
      type: "warning"
    });
    return;
  }

  try {
    // Check if username already exists in Firestore users collection
    const existingUser = await db.collection("users").where("username", "==", username).get();
    if (!existingUser.empty) {
      showCustomModal({
        title: "Username Taken",
        message: "This username is already taken. Please choose another username.",
        type: "warning"
      });
      return;
    }

    // Save staff/admin profile to Firestore
    await db.collection("users").add({
      fullName: fullName,
      role: role, // 'teacher' or 'admin'
      username: username,
      password: password, // Note: In production, hash passwords securely. Matches plain text logic of student portal.
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showCustomModal({
      title: "Success",
      message: `Successfully registered ${role.toUpperCase()} account for ${fullName}!`,
      type: "success"
    });

    document.getElementById("registerStaffForm").reset();

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
    const roleBadgeClass = staff.role === 'admin' ? 'role-admin' : 'role-teacher';

    tr.innerHTML = `
      <td>${globalIndex}</td>
      <td><input type="text" id="staff-name-${staff.id}" value="${escapeHtml(staff.fullName)}"></td>
      <td>
        <select id="staff-role-${staff.id}">
          <option value="teacher" ${staff.role === 'teacher' ? 'selected' : ''}>Teacher</option>
          <option value="admin" ${staff.role === 'admin' ? 'selected' : ''}>Admin</option>
        </select>
      </td>
      <td><input type="text" id="staff-user-${staff.id}" value="${escapeHtml(staff.username)}"></td>
      <td><input type="text" id="staff-pass-${staff.id}" value="${escapeHtml(staff.password)}"></td>
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
  const newUser = document.getElementById(`staff-user-${docId}`).value.trim().toLowerCase();
  const newPass = document.getElementById(`staff-pass-${docId}`).value.trim();

  if (!newName || !newUser || !newPass) {
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
      username: newUser,
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
    staff.fullName.toLowerCase().includes(query) ||
    staff.username.toLowerCase().includes(query) ||
    staff.role.toLowerCase().includes(query)
  );
  renderStaffTablePage(1, filtered);
}
/* ==========================================================================
   2. STUDENT REGISTRATION & BULK IMPORT
   ========================================================================== */
async function saveUserToCloud(userObj) {
  const localUsers = JSON.parse(localStorage.getItem('portal_users')) || [];
  const idx = localUsers.findIndex(u => u.username.toLowerCase() === userObj.username.toLowerCase());
  if (idx >= 0) {
    localUsers[idx] = userObj;
  } else {
    localUsers.push(userObj);
  }
  localStorage.setItem('portal_users', JSON.stringify(localUsers));

  if (window.db) {
    try {
      await window.db.collection('users').doc(userObj.username.toLowerCase()).set({
        fullName: userObj.fullName,
        class: userObj.class,
        username: userObj.username,
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
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value.trim();

  const localUsers = JSON.parse(localStorage.getItem('portal_users')) || [];
  if (localUsers.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    showCustomModal({
      title: "Username Exists",
      message: "Username already exists! Please assign a unique username.",
      type: "warning"
    });
    return;
  }

  const newUser = { fullName, class: studentClass, username, password, role: "Student" };
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

      jsonRows.forEach((row, index) => {
        if (!row || row.length === 0) return;
        let rawName = String(row[0] || '').trim();

        if (index === 0 && (rawName.toLowerCase().includes('name') || rawName.toLowerCase().includes('student'))) return;

        if (rawName && isNaN(rawName)) {
          const nameParts = rawName.split(/\s+/);
          let lastName = nameParts[nameParts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '');
          if (!lastName) lastName = "student";

          let baseUsername = lastName;
          let finalUsername = baseUsername;
          let counter = 1;

          while (systemUsers.some(u => u.username.toLowerCase() === finalUsername.toLowerCase())) {
            finalUsername = `${baseUsername}${counter}`;
            counter++;
          }

          const newUser = {
            fullName: rawName,
            class: targetClass,
            username: finalUsername,
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

window.downloadStudentCSV = async function() {
  let students = [];
  if (window.db) {
    try {
      const snap = await window.db.collection('users').where('role', '==', 'Student').get();
      snap.forEach(doc => students.push(doc.data()));
    } catch (err) {
      console.warn('Fallback to local storage:', err);
    }
  }

  if (students.length === 0) {
    const users = JSON.parse(localStorage.getItem('portal_users')) || [];
    students = users.filter(u => u.role === 'Student');
  }

  if (students.length === 0) {
    showCustomModal({
      title: "No Data",
      message: "No registered students found to export.",
      type: "info"
    });
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,Full Name,Class,Username,Password\n";
  students.forEach(s => {
    csvContent += `"${s.fullName}","${s.class}","${s.username}","${s.password}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "Registered_Students_Credentials.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};


/* ==========================================================================
   3. STUDENT MANAGEMENT MODAL & PAGINATION WITH ELLIPSIS
   ========================================================================== */
window.openManageStudentsModal = function() {
  const modal = document.getElementById('manageStudentsModal');
  if (modal) {
    modal.style.display = 'flex';
  } else {
    console.error("Element #manageStudentsModal not found in DOM.");
  }
  editingUsername = null;
  currentStudentSubmissionsPage = 1;
  renderStudentModalTable();
};

window.closeManageStudentsModal = function() {
  const modal = document.getElementById('manageStudentsModal');
  if (modal) {
    modal.style.display = 'none';
  }
  editingUsername = null;
};

window.openStudentModal = window.openManageStudentsModal;
window.closeStudentModal = window.closeManageStudentsModal;

window.changeStudentPage = function(newPage) {
  currentStudentSubmissionsPage = newPage;
  renderStudentModalTable();
};

window.renderStudentModalTable = async function() {
  const tbody = document.getElementById('studentModalTableBody');
  const searchInput = document.getElementById('studentSearchInput');
  const searchFilter = searchInput ? searchInput.value.toLowerCase().trim() : '';

  if (!tbody) return;

  let students = [];
  if (window.db) {
    try {
      const snap = await window.db.collection('users').where('role', '==', 'Student').get();
      snap.forEach(doc => students.push(doc.data()));
    } catch (err) {
      console.warn('Fallback to local:', err);
    }
  }

  if (students.length === 0) {
    const localUsers = JSON.parse(localStorage.getItem('portal_users')) || [];
    students = localUsers.filter(u => u.role === 'Student');
  }

  const filteredStudents = students.filter(u => (
    (u.fullName || '').toLowerCase().includes(searchFilter) ||
    (u.class || '').toLowerCase().includes(searchFilter) ||
    (u.username || '').toLowerCase().includes(searchFilter)
  ));

  const totalItems = filteredStudents.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
  if (currentStudentSubmissionsPage > totalPages) currentStudentSubmissionsPage = totalPages;
  if (currentStudentSubmissionsPage < 1) currentStudentSubmissionsPage = 1;

  const startIndex = (currentStudentSubmissionsPage - 1) * ITEMS_PER_PAGE;
  const paginatedStudents = filteredStudents.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  if (paginatedStudents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b;">No matching students found.</td></tr>';
    renderStudentPaginationControls(0, 1);
    return;
  }

  tbody.innerHTML = paginatedStudents.map((s, index) => {
    const absoluteIndex = startIndex + index + 1;
    const isEditing = editingUsername === s.username;
    
    // Fixed narrow width style for the # column to prevent stretching
    const indexColStyle = 'width: 50px; text-align: center; white-space: nowrap;';

    if (isEditing) {
      return `
        <tr>
          <td style="${indexColStyle}">${absoluteIndex}</td>
          <td><input type="text" id="editFullName" value="${s.fullName}"></td>
          <td>
            <select id="editClass">
              <option value="S1" ${s.class === 'S1' ? 'selected' : ''}>S.1</option>
              <option value="S2" ${s.class === 'S2' ? 'selected' : ''}>S.2</option>
              <option value="S3" ${s.class === 'S3' ? 'selected' : ''}>S.3</option>
              <option value="S4" ${s.class === 'S4' ? 'selected' : ''}>S.4</option>
              <option value="S5" ${s.class === 'S5' ? 'selected' : ''}>S.5</option>
              <option value="S6" ${s.class === 'S6' ? 'selected' : ''}>S.6</option>
            </select>
          </td>
          <td><input type="text" id="editUsername" value="${s.username}"></td>
          <td><input type="text" id="editPassword" value="${s.password}"></td>
          <td style="display:flex; gap:0.4rem;">
            <button onclick="saveStudentEdit('${s.username}')" class="btn-action btn-upload"><i class="fa-solid fa-check"></i></button>
            <button onclick="cancelStudentEdit()" class="btn-action btn-secondary"><i class="fa-solid fa-xmark"></i></button>
          </td>
        </tr>
      `;
    }

    return `
      <tr>
        <td style="${indexColStyle}">${absoluteIndex}</td>
        <td><strong>${s.fullName}</strong></td>
        <td>${s.class}</td>
        <td><code>${s.username}</code></td>
        <td><code>${s.password}</code></td>
        <td style="display:flex; gap:0.4rem;">
          <button onclick="enableStudentEdit('${s.username}')" class="btn-action btn-edit"><i class="fa-solid fa-pen-to-square"></i></button>
          <button onclick="deleteStudent('${s.username}')" class="btn-action btn-danger"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');

  renderStudentPaginationControls(totalPages, currentStudentSubmissionsPage);
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

window.enableStudentEdit = function(username) {
  editingUsername = username;
  renderStudentModalTable();
};

window.cancelStudentEdit = function() {
  editingUsername = null;
  renderStudentModalTable();
};

window.saveStudentEdit = async function(oldUsername) {
  const newFullName = document.getElementById('editFullName').value.trim();
  const newClass = document.getElementById('editClass').value;
  const newUsername = document.getElementById('editUsername').value.trim();
  const newPassword = document.getElementById('editPassword').value.trim();

  if (!newFullName || !newUsername || !newPassword) return;

  const updatedData = { fullName: newFullName, class: newClass, username: newUsername, password: newPassword, role: 'Student' };

  if (window.db) {
    if (oldUsername.toLowerCase() !== newUsername.toLowerCase()) {
      await window.db.collection('users').doc(oldUsername.toLowerCase()).delete();
    }
    await window.db.collection('users').doc(newUsername.toLowerCase()).set(updatedData, { merge: true });
  }

  let localUsers = JSON.parse(localStorage.getItem('portal_users')) || [];
  const idx = localUsers.findIndex(u => u.username.toLowerCase() === oldUsername.toLowerCase());
  if (idx !== -1) localUsers[idx] = updatedData;
  localStorage.setItem('portal_users', JSON.stringify(localUsers));

  editingUsername = null;
  renderStudentModalTable();
};

window.deleteStudent = async function(username) {
  if (!confirm(`Delete student "${username}"?`)) return;

  if (window.db) {
    await window.db.collection('users').doc(username.toLowerCase()).delete();
  }

  let localUsers = JSON.parse(localStorage.getItem('portal_users')) || [];
  localUsers = localUsers.filter(u => u.username.toLowerCase() !== username.toLowerCase());
  localStorage.setItem('portal_users', JSON.stringify(localUsers));

  renderStudentModalTable();
};

window.deleteAllStudents = async function() {
  if (confirm('Delete ALL registered students?')) {
    if (window.db) {
      const snap = await window.db.collection('users').where('role', '==', 'Student').get();
      const batch = window.db.batch();
      snap.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }

    let localUsers = JSON.parse(localStorage.getItem('portal_users')) || [];
    localUsers = localUsers.filter(u => u.role !== 'Student');
    localStorage.setItem('portal_users', JSON.stringify(localUsers));

    renderStudentModalTable();
  }
};

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
  
  try {
    console.log("Uploading file to Firebase Storage...");

    // 1. Create a Storage reference using firebase.storage()
    const storageRef = firebase.storage().ref();
    const fileRef = storageRef.child(`assessments/${Date.now()}_${file.name}`);

    // 2. Upload file bytes
    const snapshot = await fileRef.put(file);
    
    // 3. Get the public download URL
    const downloadUrl = await snapshot.ref.getDownloadURL();

    // 4. Construct the assessment object
    const newAssessment = {
      "id": Date.now(),
      "class": targetClass,
      "category": "Question Paper",
      "title": title,
      "description": description,
      "fileUrl": downloadUrl,
      "date": new Date().toISOString().split('T')[0],
      "deadline": deadline,
      "createdAt": new Date().toISOString()
    };

    // 5. Save to Firestore collection using firebase.firestore()
    await firebase.firestore().collection("portal_resources").add(newAssessment);

    // 6. Keep localStorage in sync
    const resources = JSON.parse(localStorage.getItem('portal_resources')) || [];
    resources.push(newAssessment);
    localStorage.setItem('portal_resources', JSON.stringify(resources));

    showCustomModal({
      title: "Success",
      message: "Assessment published successfully!",
      type: "success"
    });

    document.getElementById('assessmentForm').reset();
    renderAssessments();

  } catch (error) {
    console.error("Error uploading assessment:", error);
    showCustomModal({
      title: "Upload Failed",
      message: "Failed to upload assessment. Please check your network or console for details.",
      type: "error"
    });
  }
};

/* ==========================================================================
   5. PORTAL UI RENDERERS & CLASS FILTER DROPDOWN
   ========================================================================== */
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
    renderSubmissions();
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

// 1. Render Assessments (Async fetch from Firestore with LocalStorage fallback)
async function renderAssessments() {
  const container = document.getElementById('assessmentsContainer');
  if (!container) return;

  // Optional: Try fetching live data from Firestore first
  let resources = [];
  try {
    const snapshot = await firebase.firestore().collection("portal_resources").get();
    if (!snapshot.empty) {
      resources = snapshot.docs.map(doc => ({ firebaseDocId: doc.id, ...doc.data() }));
      // Keep localStorage synced with the latest fetched data
      localStorage.setItem('portal_resources', JSON.stringify(resources));
    } else {
      resources = JSON.parse(localStorage.getItem('portal_resources')) || [];
    }
  } catch (error) {
    console.warn("Offline or failed to fetch from Firestore, falling back to LocalStorage:", error);
    resources = JSON.parse(localStorage.getItem('portal_resources')) || [];
  }

  const submissions = JSON.parse(localStorage.getItem('portal_submissions')) || [];
  const now = new Date();

  // Class Filter Dropdown element check
  let classFilterEl = document.getElementById('assessmentClassFilter');
  let selectedClassFilter = classFilterEl ? classFilterEl.value : 'ALL';

  let assessments = resources.filter(r => r.category === "Question Paper");
  
  if (currentUser && currentUser.role === 'Student') {
    assessments = assessments.filter(a => a.class === currentUser.class);
  } else if (selectedClassFilter && selectedClassFilter !== 'ALL') {
    assessments = assessments.filter(a => a.class === selectedClassFilter);
  }

  if (assessments.length === 0) {
    container.innerHTML = `<p style="color:#64748b;">No active assessments available.</p>`;
    return;
  }

  container.innerHTML = assessments.map(a => {
    const deadlineDate = new Date(a.deadline);
    const isExpired = now > deadlineDate;
    
    const studentSub = (currentUser && currentUser.role === 'Student') 
      ? submissions.find(s => String(s.testId) === String(a.id) && s.studentName === currentUser.fullName) 
      : null;
    
    const safeTitle = encodeURIComponent(a.title);

    let actionHTML = '';
    
    // Student Actions
    if (currentUser && currentUser.role === 'Student') {
        if (studentSub) {
            actionHTML = `<span style="color:#16a34a; font-size:0.85rem; font-weight:600;"><i class="fa-solid fa-circle-check"></i> Submitted (${studentSub.fileName})</span>`;
            if (!isExpired) {
                actionHTML += `
                    <button type="button" onclick="openSubmissionModalWithDetails('${a.id}', '${safeTitle}')" class="btn-action btn-edit"><i class="fa-solid fa-arrows-rotate"></i> Replace</button>
                    <button type="button" onclick="cancelSubmission('${a.id}')" class="btn-action btn-danger"><i class="fa-solid fa-trash-can"></i></button>
                `;
            } else {
                actionHTML += `<span style="font-size:0.75rem; color:#94a3b8;">(Locked)</span>`;
            }
        } else {
            if (isExpired) {
                actionHTML = `<button disabled class="btn-action btn-disabled"><i class="fa-solid fa-lock"></i> Deadline Passed</button>`;
            } else {
                actionHTML = `<button type="button" onclick="openSubmissionModalWithDetails('${a.id}', '${safeTitle}')" class="btn-action btn-upload"><i class="fa-solid fa-file-arrow-up"></i> Upload Answer</button>`;
            }
        }
    } 
    // Teacher / Admin Actions (Uses assessment id)
    else if (currentUser && (currentUser.role === 'Teacher' || currentUser.role === 'Admin')) {
        actionHTML = `
            <button type="button" onclick="openEditAssessmentModal('${a.id}')" class="btn-action btn-edit"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
            <button type="button" onclick="handleDeleteAssessment('${a.id}')" class="btn-action btn-danger"><i class="fa-solid fa-trash-can"></i> Delete</button>
        `;
    }

    return `
      <div class="test-card" data-assessment-id="${a.id}">
        <div class="test-header">
          <span class="test-title">${a.title} <small style="color:#64748b;">(${a.class})</small></span>
          <span class="deadline-badge ${isExpired ? 'deadline-expired' : 'deadline-active'}" data-deadline="${a.deadline}">
            ${isExpired ? 'Expired' : 'Active until: ' + deadlineDate.toLocaleString()}
          </span>
        </div>
        <p style="font-size:0.85rem; color:#475569; margin:0.5rem 0;">${a.description || 'No instructions provided.'}</p>
        <div class="test-actions">
          <a href="${a.fileUrl}" download class="btn-action btn-download"><i class="fa-solid fa-file-arrow-down"></i> Download Paper</a>
          ${actionHTML}
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
        
        // 1. Find and delete the matching document from Firestore
        const querySnapshot = await db.collection("portal_resources").where("id", "==", assessmentId).get();
        
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

      let resources = JSON.parse(localStorage.getItem('portal_resources')) || [];
      let index = resources.findIndex(r => String(r.id) === String(id));

      if (index !== -1) {
        let fileUrl = resources[index].fileUrl;

        try {
          // If a new replacement file is attached, upload it to Firebase Storage
          if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const storageRef = firebase.storage().ref();
            const fileRef = storageRef.child(`assessments/${Date.now()}_${file.name}`);
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

          localStorage.setItem('portal_resources', JSON.stringify(resources));

          // Sync update to Firestore
          const querySnapshot = await firebase.firestore().collection("portal_resources").get();
          querySnapshot.forEach(async (docSnap) => {
            const data = docSnap.data();
            if (String(data.id) === String(id)) {
              await firebase.firestore().collection("portal_resources").doc(docSnap.id).update({
                title: title,
                class: targetClass,
                description: description,
                deadline: deadline,
                fileUrl: fileUrl
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

/* ==========================================================================
   STUDENT SUBMISSION HANDLERS & SUBMISSION HISTORY
   ========================================================================== */
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
  const submissionId = `sub_${testIdVal}_${studentNameVal.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}`;
  
  let fileDownloadUrl = '';

  // 3. Upload file to Firebase Storage if available, otherwise fallback to Data URL
  try {
    if (window.firebase && window.firebase.storage) {
      const storageRef = window.firebase.storage().ref();
      const fileRef = storageRef.child(`submissions/${submissionId}_${file.name}`);
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
    studentUsername: currentUser ? currentUser.username : '',
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

  // 5. Cache locally
  let localSubmissions = JSON.parse(localStorage.getItem('portal_submissions')) || [];
  localSubmissions.unshift(newSubmission);
  localStorage.setItem('portal_submissions', JSON.stringify(localSubmissions));

  // 6. Cleanup & UI Feedback
  const form = document.getElementById('assignmentForm');
  if (form) form.reset();
  closeSubmissionModal();

  showCustomModal({
    title: "Success",
    message: "Assignment submitted successfully!",
    type: "success"
  });

  renderAssessments();
  if (currentUser && currentUser.role === 'Teacher') renderSubmissions();
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

      if (window.db) {
        try {
          const snap = await window.db.collection('submissions').where('testId', '==', String(testId)).where('studentName', '==', studentName).get();
          const batch = window.db.batch();
          snap.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
        } catch (err) {
          console.error('Firestore delete error:', err);
        }
      }

      let submissions = JSON.parse(localStorage.getItem('portal_submissions')) || [];
      submissions = submissions.filter(s => !(String(s.testId) === String(testId) && s.studentName.toLowerCase() === studentName.toLowerCase()));
      localStorage.setItem('portal_submissions', JSON.stringify(submissions));

      showCustomModal({
        title: "Cancelled",
        message: "Your submission has been successfully cancelled.",
        type: "success"
      });

      renderAssessments();
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
      studentCurrentPage = 1;
      renderStudentModalTable();
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
  if (closeSubmissionModalBtn) closeSubmissionModalBtn.addEventListener('click', closeSubmissionModal);

  const cancelSubmissionBtn = document.getElementById('cancelSubmissionBtn');
  if (cancelSubmissionBtn) cancelSubmissionBtn.addEventListener('click', closeSubmissionModal);

  const closeManageStudentsModalBtn = document.getElementById('closeManageStudentsModalBtn');
  if (closeManageStudentsModalBtn) closeManageStudentsModalBtn.addEventListener('click', closeManageStudentsModal);

  const closeGradingModalBtn = document.getElementById('closeGradingModalBtn');
  if (closeGradingModalBtn) closeGradingModalBtn.addEventListener('click', closeGradingModal);

  const cancelGradingBtn = document.getElementById('cancelGradingBtn');
  if (cancelGradingBtn) cancelGradingBtn.addEventListener('click', closeGradingModal);

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

// --- PROFILE & ACCOUNT SETTINGS LOGIC ---

function handleProfilePicUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const currentUser = JSON.parse(localStorage.getItem('currentLoggedInUser'));
  if (!currentUser) return;

  const filePath = `profile_pictures/${currentUser.username}_${Date.now()}_${file.name}`;
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
    localStorage.setItem('currentLoggedInUser', JSON.stringify(currentUser));

    return db.collection("students").where("username", "==", currentUser.username).get();
  }).then((querySnapshot) => {
    if (!querySnapshot.empty) {
      querySnapshot.forEach((doc) => {
        doc.ref.update({ profilePic: JSON.parse(localStorage.getItem('currentLoggedInUser')).profilePic });
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
  const currentUser = JSON.parse(localStorage.getItem('currentLoggedInUser'));
  if (!currentUser) return;

  // Set default fallback if profilePic is missing or empty
  const userAvatar = currentUser.profilePic && currentUser.profilePic.trim() !== "" 
    ? currentUser.profilePic 
    : "images/default-avatar.png";

  // Update UI elements safely
  document.getElementById('bannerProfilePic').src = userAvatar;
  document.getElementById('profilePicPreview').src = userAvatar;
  document.getElementById('userNameDisplay').textContent = currentUser.fullName || currentUser.username;
  document.getElementById('profileFullName').textContent = currentUser.fullName || currentUser.username;
  document.getElementById('profileUsernameDisplay').textContent = "@" + currentUser.username;
  document.getElementById('updateUsername').value = currentUser.username;
  
  if(document.getElementById('userRoleDisplay')) {
    document.getElementById('userRoleDisplay').textContent = currentUser.role || "User";
  }
}

// --- AUTHENTICATION MOCK & SESSION UTILS ---
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
        if (role === 'teacher' || role === 'admin' || role === 'instructor') {
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

function handleLogin(e) {
  e.preventDefault();
  const user = document.getElementById('loginUsername').value.trim();
  const pass = document.getElementById('loginPassword').value.trim();

  // Basic authentication setup mock
  if (user === "admin" && pass === "admin123") {
    const adminUser = { username: "admin", fullName: "Administrator", role: "teacher" };
    localStorage.setItem('currentLoggedInUser', JSON.stringify(adminUser));
    checkUserSession();
  } else {
    db.collection("students").where("username", "==", user).where("password", "==", pass).get().then((snapshot) => {
      if (!snapshot.empty) {
        const studentData = snapshot.docs[0].data();
        localStorage.setItem('currentLoggedInUser', JSON.stringify({ ...studentData, role: 'student' }));
        checkUserSession();
      } else {
        document.getElementById('loginError').style.display = 'block';
      }
    });
  }
}

function handleLogout() {
  localStorage.removeItem('currentLoggedInUser');
  checkUserSession();
}

function handleUpdateAccountDetails(event) {
  event.preventDefault();
  const newUsername = document.getElementById('updateUsername').value.trim();
  const currentPasswordInput = document.getElementById('currentPassword').value.trim();
  const newPassword = document.getElementById('updatePassword').value.trim();
  const confirmPassword = document.getElementById('confirmPassword').value.trim();
  
  // FIXED: Using 'portal_session' which matches your login module key name
  const currentUser = JSON.parse(localStorage.getItem('portal_session') || localStorage.getItem('currentLoggedInUser'));

  if (!currentUser || !currentUser.username) {
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

  const oldUsernameId = currentUser.username;
  const userRef = db.collection("users").doc(oldUsernameId);

  userRef.get().then((docSnapshot) => {
    if (!docSnapshot.exists) {
      showCustomModal({
        title: "User Not Found",
        message: "User record not found in database.",
        type: "error"
      });
      return;
    }

    const userData = docSnapshot.data();

    // Verify current password matches database record
    if (userData.password !== currentPasswordInput) {
      showCustomModal({
        title: "Authentication Failed",
        message: "Incorrect current password! Changes rejected.",
        type: "error"
      });
      return;
    }

    const updatingUsername = newUsername && newUsername !== oldUsernameId;
    const updatingPassword = Boolean(newPassword);

    if (!updatingUsername && !updatingPassword) {
      showCustomModal({
        title: "No Changes",
        message: "No changes detected.",
        type: "info"
      });
      return;
    }

    // SCENARIO A: Username is changing (Since Username = Document ID)
    if (updatingUsername) {
      db.collection("users").doc(newUsername).get().then((newDocSnap) => {
        if (newDocSnap.exists) {
          showCustomModal({
            title: "Username Taken",
            message: "Username is already taken. Choose another one.",
            type: "warning"
          });
          return;
        }

        const migratedData = { ...userData };
        migratedData.username = newUsername;
        if (updatingPassword) {
          migratedData.password = newPassword;
        }

        db.collection("users").doc(newUsername).set(migratedData)
          .then(() => userRef.delete())
          .then(() => {
            currentUser.username = newUsername;
            localStorage.setItem('portal_session', JSON.stringify(currentUser));
            
            showCustomModal({
              title: "Success",
              message: "Account details updated successfully!",
              type: "success"
            });
            
            if (typeof clearFormAndFinish === 'function') clearFormAndFinish();
          })
          .catch((err) => {
            console.error("Error migrating username:", err);
            showCustomModal({
              title: "Update Failed",
              message: "Failed to update username. Check console.",
              type: "error"
            });
          });
      });
    } 
    // SCENARIO B: Only Password is changing
    else if (updatingPassword) {
      userRef.update({ password: newPassword }).then(() => {
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
}
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
window.openGradingModal = async function(submissionId) {
  let modal = document.getElementById('gradingModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'gradingModal';
    modal.className = 'modal-backdrop';
    modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); justify-content:center; align-items:center; z-index:1000;';
    modal.innerHTML = `
      <div class="modal-content" style="background:#fff; padding:2rem; border-radius:12px; width:90%; max-width:500px; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <h3 style="margin:0; color:#1e293b;">Grade Student Submission</h3>
          <button onclick="closeGradingModal()" style="background:none; border:none; font-size:1.2rem; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <form id="gradingForm" onsubmit="saveSubmissionGrade(event)">
          <input type="hidden" id="gradingSubmissionId">
          <div style="margin-bottom:1rem;">
            <label style="display:block; font-size:0.85rem; font-weight:600; margin-bottom:0.3rem;">Grade / Score</label>
            <input type="text" id="gradeScoreInput" placeholder="e.g. 85/100 or Distinction" required style="width:100%; padding:0.6rem; border:1px solid #cbd5e1; border-radius:6px;">
          </div>
          <div style="margin-bottom:1rem;">
            <label style="display:block; font-size:0.85rem; font-weight:600; margin-bottom:0.3rem;">Teacher Feedback / Comments</label>
            <textarea id="gradeFeedbackInput" rows="4" placeholder="Provide constructive feedback..." style="width:100%; padding:0.6rem; border:1px solid #cbd5e1; border-radius:6px;"></textarea>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
            <button type="button" onclick="closeGradingModal()" class="btn-action btn-secondary">Cancel</button>
            <button type="submit" class="btn-action btn-upload">Save Grade & Feedback</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  }

  document.getElementById('gradingSubmissionId').value = submissionId;
  
  // Fetch existing submission details from Firestore first, fallback to LocalStorage
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
    document.getElementById('gradeScoreInput').value = targetSub.grade || '';
    document.getElementById('gradeFeedbackInput').value = targetSub.feedback || '';
  } else {
    document.getElementById('gradeScoreInput').value = '';
    document.getElementById('gradeFeedbackInput').value = '';
  }

  modal.style.display = 'flex';
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
  if (!container) return;

  let submissions = [];
  
  // 1. Fetch live submissions from Firestore database
  if (window.db) {
    try {
      const snap = await window.db.collection('submissions').get();
      snap.forEach(doc => submissions.push({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn('Firestore submissions fetch warning:', err);
    }
  }

  // 2. Fallback to LocalStorage if Firestore returned nothing or failed
  if (submissions.length === 0) {
    submissions = JSON.parse(localStorage.getItem('portal_submissions')) || [];
  }

  if (submissions.length === 0) {
    container.innerHTML = '<p style="color:#64748b; font-size:0.85rem;">No student work submitted yet.</p>';
    return;
  }

  submissions.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));

  container.innerHTML = submissions.map(sub => `
    <div class="sub-item" style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem; border-bottom:1px solid #e2e8f0;">
      <div>
        <strong>${sub.studentName}</strong> <small style="color:#2563eb;">(${sub.studentClass})</small><br>
        <span style="color:#64748b; font-size:0.85rem;">${sub.testTitle} - <em>${sub.fileName}</em></span>
        ${sub.grade ? `<br><span style="color:#16a34a; font-size:0.8rem; font-weight:600;"><i class="fa-solid fa-award"></i> Grade: ${sub.grade}</span>` : ''}
      </div>
      <div style="display:flex; gap:0.4rem; align-items:center;">
        <a href="${sub.fileUrl}" download="${sub.fileName || 'submission'}" target="_blank" rel="noopener noreferrer" class="btn-action btn-download" style="padding:0.3rem 0.6rem; font-size:0.75rem;">
          <i class="fa-solid fa-download"></i> Get File
        </a>
        <button onclick="openGradingModal('${sub.id}')" class="btn-action btn-edit" style="padding:0.3rem 0.6rem; font-size:0.75rem;">
          <i class="fa-solid fa-star"></i> Grade
        </button>
      </div>
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

window.openSubmissionModalWithDetails = function(testId, encodedTitle) {
  const decodedTitle = decodeURIComponent(encodedTitle);
  openSubmissionModal();

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
