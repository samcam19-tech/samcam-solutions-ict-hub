/* ==========================================================================
   SAMCAM SOLUTIONS - ASSESSMENT PORTAL ENGINE (script.js)
   ========================================================================== */
// Shared Portal State
window.currentUser = null;
let editingUsername = null;
let currentStudentSubmissionsPage = 1;
const ITEMS_PER_PAGE = 5;

// --- FIREBASE INITIALIZATION ---
const firebaseConfig = {
  apiKey: "AIzaSyBcZxH7TTpejrFmF4ji0DS66xVfDVhZEfw",
  authDomain: "samcam-system.firebaseapp.com",
  projectId: "samcam-system",
  storageBucket: "samcam-system.firebasestorage.app",
  messagingSenderId: "74940789582",
  appId: "1:74940789582:web:f159688165a194e841241f",
  measurementId: "G-L2H4V8Y050"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
window.db = firebase.firestore();
const storageRef = firebase.storage().ref();

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
          foundUser = userData;
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
      foundUser = localUsers.find(
        acc => (acc.username || '').toLowerCase() === u && acc.password === p
      );
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
  localStorage.removeItem('portal_session');
  broadcastSessionUpdate(null);

  const userEl = document.getElementById('loginUsername');
  const passEl = document.getElementById('loginPassword');
  const errEl = document.getElementById('loginError');

  if (userEl) userEl.value = '';
  if (passEl) passEl.value = '';
  if (errEl) errEl.style.display = 'none';

  // Explicitly hide the authenticated navigation links on logout
  const authNavActions = document.getElementById('authNavActions');
  if (authNavActions) {
    authNavActions.style.display = 'none';
  }

  if (typeof updatePortalUI === 'function') updatePortalUI();
  navigateToView('login', true);
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
      alert("System configuration error: Session manager missing.");
      return;
    }

    const currentUser = loadSessionFromStorage();
    if (!currentUser || !currentUser.username) {
      console.warn("⚠️ No active user session found in storage.");
      alert("Please sign in again to update your profile picture.");
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

      // Update Firestore database document
      if (window.db) {
        const userDocRef = window.db.collection('users').doc(currentUser.username.toLowerCase());
        await userDocRef.update({ profilePic: downloadURL });
        console.log("💾 Firestore user profilePic updated.");
      }

      // Refresh UI images instantly
      if (typeof window.updateProfileUIImages === 'function') {
        window.updateProfileUIImages(currentUser);
      }
      
      alert("Profile picture updated successfully!");

    } catch (error) {
      console.error("❌ Error during profile picture upload process:", error);
      alert("Failed to upload profile picture: " + error.message);
    } finally {
      if (uploadLabel) {
        uploadLabel.innerHTML = originalLabelHTML;
        uploadLabel.style.pointerEvents = 'auto';
      }
      profilePicInput.value = '';
    }
  });
});

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
    alert('Username already exists! Please assign a unique username.');
    return;
  }

  const newUser = { fullName, class: studentClass, username, password, role: "Student" };
  await saveUserToCloud(newUser);

  alert(`Student "${fullName}" registered successfully!`);
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
    alert('Please select an Excel or CSV file to import.');
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
      alert(`Imported ${addedCount} student account(s) into ${targetClass}!`);
      fileInput.value = '';
      if (typeof renderStudentModalTable === 'function') renderStudentModalTable();
    } catch (err) {
      console.error(err);
      alert('Error parsing or saving file data.');
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
    alert('No registered students found to export.');
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
    if (isEditing) {
      return `
        <tr>
          <td>${absoluteIndex}</td>
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
        <td>${absoluteIndex}</td>
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

// Advanced Pagination with Ellipsis (...) generator
function renderStudentPaginationControls(totalPages, currentPage) {
  let pagContainer = document.getElementById('studentPaginationContainer');
  if (!pagContainer) {
    const tableContainer = document.querySelector('#manageStudentsModal .modal-body') || document.getElementById('studentModalTableBody');
    if (tableContainer) {
      pagContainer = document.createElement('div');
      pagContainer.id = 'studentPaginationContainer';
      pagContainer.style.cssText = 'display:flex; justify-content:center; align-items:center; gap:0.5rem; margin-top:1rem;';
      tableContainer.parentNode.appendChild(pagContainer);
    } else {
      return;
    }
  }

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
    <button onclick="changeStudentPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} class="btn-action btn-secondary"><i class="fa-solid fa-chevron-left"></i></button>
    ${pages.map(p => {
      if (p === '...') return `<span style="padding:0.4rem 0.6rem; color:#64748b;">...</span>`;
      const isActive = p === currentPage;
      return `<button onclick="changeStudentPage(${p})" class="btn-action ${isActive ? 'btn-upload' : 'btn-secondary'}" ${isActive ? 'style="background:#2563eb; color:#fff;"' : ''}>${p}</button>`;
    }).join('')}
    <button onclick="changeStudentPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} class="btn-action btn-secondary"><i class="fa-solid fa-chevron-right"></i></button>
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

/* ==========================================================================
   4. ASSESSMENT & SUBMISSION ENGINE
   ========================================================================== */
window.handleCreateAssessment = function(e) {
  e.preventDefault();
  if (!currentUser || currentUser.role !== 'Teacher') return;

  const title = document.getElementById('testTitle').value;
  const targetClass = document.getElementById('targetClass').value;
  const description = document.getElementById('testDesc').value;
  const deadline = document.getElementById('testDeadline').value;
  const fileInput = document.getElementById('testFile');
  const fileName = (fileInput && fileInput.files[0]) ? fileInput.files[0].name : "assessment.pdf";

  const resources = JSON.parse(localStorage.getItem('portal_resources')) || [];

  const newAssessment = {
    "id": Date.now(),
    "class": targetClass,
    "category": "Question Paper",
    "title": title,
    "description": description,
    "fileUrl": "uploads/" + fileName,
    "date": new Date().toISOString().split('T')[0],
    "deadline": deadline
  };

  resources.push(newAssessment);
  localStorage.setItem('portal_resources', JSON.stringify(resources));

  alert('Assessment published successfully!');
  e.target.reset();
  renderAssessments();
};

/* ==========================================================================
   5. PORTAL UI RENDERERS & CLASS FILTER DROPDOWN
   ========================================================================== */
function updatePortalUI() {
  const loginSec = document.getElementById('loginSection');
  const dashSec = document.getElementById('dashboardSection');
  const teacherControls = document.getElementById('teacherControls');
  const teacherReports = document.getElementById('teacherReports');

  if (!loginSec || !dashSec) return;

  if (!currentUser) {
    loginSec.style.display = 'block';
    dashSec.style.display = 'none';
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

  if (currentUser.role === 'Teacher') {
    if (teacherControls) teacherControls.style.display = 'block';
    if (teacherReports) teacherReports.style.display = 'grid';
    renderSubmissions();
  } else {
    if (teacherControls) teacherControls.style.display = 'none';
    if (teacherReports) teacherReports.style.display = 'none';
  }

  renderAssessments();
}

window.filterAssessmentsByClass = function() {
  renderAssessments();
};

function renderAssessments() {
  const container = document.getElementById('assessmentsContainer');
  if (!container) return;

  const resources = JSON.parse(localStorage.getItem('portal_resources')) || [];
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
window.handleFormSubmission = function(event) {
  event.preventDefault();

  const nameEl = document.getElementById('studentName');
  const classEl = document.getElementById('studentClass');
  const titleEl = document.getElementById('submissionTestTitle');
  const testIdEl = document.getElementById('submissionTestId');
  const fileInput = document.getElementById('assignmentFile');

  if (!fileInput || !fileInput.files.length) {
    alert("Please select a file to upload.");
    return;
  }

  const file = fileInput.files[0];
  if (file.size > 1048576) {
    alert("File size exceeds 1 MB. Please upload a smaller document.");
    return;
  }

  const reader = new FileReader();
  reader.onload = async function(e) {
    const fileDataUrl = e.target.result;
    const testIdVal = testIdEl ? testIdEl.value : null;
    const studentNameVal = nameEl ? nameEl.value.trim() : (currentUser ? currentUser.fullName : '');
    const submissionId = `sub_${testIdVal}_${studentNameVal.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}`;

    const newSubmission = {
      id: submissionId,
      testId: String(testIdVal),
      studentName: studentNameVal,
      studentUsername: currentUser ? currentUser.username : '',
      studentClass: classEl ? classEl.value.trim() : '',
      testTitle: titleEl ? titleEl.value.trim() : '',
      fileName: file.name,
      fileUrl: fileDataUrl,
      submittedAt: new Date().toISOString(),
      grade: null,
      feedback: null
    };

    if (window.db) {
      try {
        await window.db.collection('submissions').doc(submissionId).set(newSubmission, { merge: true });
      } catch (err) {
        console.error('Firestore save error:', err);
      }
    }

    let localSubmissions = JSON.parse(localStorage.getItem('portal_submissions')) || [];
    localSubmissions.unshift(newSubmission);
    localStorage.setItem('portal_submissions', JSON.stringify(localSubmissions));

    const form = document.getElementById('assignmentForm');
    if (form) form.reset();
    closeSubmissionModal();

    alert("Assignment submitted successfully!");
    renderAssessments();
    if (currentUser && currentUser.role === 'Teacher') renderSubmissions();
  };

  reader.readAsDataURL(file);
};

window.cancelSubmission = async function(testId) {
  if (!currentUser || currentUser.role !== 'Student') return;

  if (!confirm("Are you sure you want to cancel your submission?")) return;

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

  renderAssessments();
};


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
    assessmentForm.addEventListener('click', handleCreateAssessment); // Or standard submit handler
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

  // Initial check on load (Ensure checkUserSession exists or use broadcastSessionUpdate)
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

  alert("Uploading profile picture...");

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
    alert("Profile picture updated successfully!");
    loadUserProfileUI();
  }).catch((error) => {
    console.error("Error uploading profile picture: ", error);
    alert("Failed to upload image.");
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

function handleUpdateAccountDetails(event) {
  event.preventDefault();
  const newUsername = document.getElementById('updateUsername').value.trim();
  const currentPasswordInput = document.getElementById('currentPassword').value.trim();
  const newPassword = document.getElementById('updatePassword').value.trim();
  const confirmPassword = document.getElementById('confirmPassword').value.trim();
  
  const currentUser = JSON.parse(localStorage.getItem('currentLoggedInUser'));

  if (!currentUser) {
    alert("No active session found. Please sign in again.");
    return;
  }

  // 1. Check if new passwords match when attempting to change it
  if (newPassword && newPassword !== confirmPassword) {
    alert("New passwords do not match! Please re-enter.");
    return;
  }

  // 2. Query the correct 'users' collection using the document ID / username
  const userRef = db.collection("users").doc(currentUser.username);

  userRef.get().then((docSnapshot) => {
    if (!docSnapshot.exists) {
      alert("User record not found in database.");
      return;
    }

    const userData = docSnapshot.data();

    // Verify current password matches database record
    if (userData.password !== currentPasswordInput) {
      alert("Incorrect current password! Changes rejected.");
      return;
    }

    // Build update payload
    const updateData = {};
    
    // If username is changing, Firestore requires creating a new doc or keeping the same doc ID. 
    // Since document ID is the username here, changing the username field is straightforward:
    if (newUsername && newUsername !== currentUser.username) {
      updateData.username = newUsername;
    }

    if (newPassword) {
      updateData.password = newPassword;
    }

    // Perform database update on the user document
    userRef.update(updateData).then(() => {
      if (newUsername) {
        currentUser.username = newUsername;
      }
      localStorage.setItem('currentLoggedInUser', JSON.stringify(currentUser));
      
      // Clear password fields for security
      document.getElementById('currentPassword').value = '';
      document.getElementById('updatePassword').value = '';
      document.getElementById('confirmPassword').value = '';

      alert("Account details and security credentials updated successfully!");
      loadUserProfileUI();
    });

  }).catch((error) => {
    console.error("Error updating account details:", error);
    alert("Error updating account. Check console for details.");
  });
}

// --- AUTHENTICATION MOCK & SESSION UTILS ---
function checkUserSession() {
  const currentUser = JSON.parse(localStorage.getItem('currentLoggedInUser'));
  if (currentUser) {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('dashboardSection').style.display = 'block';
    loadUserProfileUI();

    if (currentUser.role === 'teacher') {
      document.getElementById('teacherControls').style.display = 'block';
      document.getElementById('teacherReports').style.display = 'grid';
    } else {
      document.getElementById('teacherControls').style.display = 'none';
      document.getElementById('teacherReports').style.display = 'none';
    }
  } else {
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('dashboardSection').style.display = 'none';
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
  
  // Load existing grade if available
  let submissions = JSON.parse(localStorage.getItem('portal_submissions')) || [];
  const sub = submissions.find(s => s.id === submissionId);
  if (sub) {
    document.getElementById('gradeScoreInput').value = sub.grade || '';
    document.getElementById('gradeFeedbackInput').value = sub.feedback || '';
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

  let submissions = JSON.parse(localStorage.getItem('portal_submissions')) || [];
  const idx = submissions.findIndex(s => s.id === subId);
  if (idx !== -1) {
    submissions[idx].grade = grade;
    submissions[idx].feedback = feedback;
    localStorage.setItem('portal_submissions', JSON.stringify(submissions));

    if (window.db) {
      try {
        await window.db.collection('submissions').doc(subId).set({ grade, feedback }, { merge: true });
      } catch (err) {
        console.error('Firestore grade sync error:', err);
      }
    }
  }

  alert('Grade and feedback saved successfully!');
  closeGradingModal();
  renderSubmissions();
};

window.renderSubmissions = async function() {
  const container = document.getElementById('submissionsContainer');
  if (!container) return;

  let submissions = [];
  if (window.db) {
    try {
      const snap = await window.db.collection('submissions').get();
      snap.forEach(doc => submissions.push(doc.data()));
    } catch (err) {
      console.warn('Firestore fallback:', err);
    }
  }

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
        <a href="${sub.fileUrl}" download="${sub.fileName || 'submission'}" class="btn-action btn-download" style="padding:0.3rem 0.6rem; font-size:0.75rem;">
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
