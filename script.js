/* ==========================================================================
   SAMCAM SOLUTIONS - ASSESSMENT PORTAL ENGINE (script.js)
   ========================================================================== */

// Shared Portal State
let currentUser = null;
let editingUsername = null;

// Default Administrator Credentials
const rootTeacher = {
  username: "admin",
  password: "admin",
  fullName: "Root Teacher / Admin",
  role: "Teacher"
};

// Default hardcoded admin / teacher fallback accounts
const HARDCODED_ACCOUNTS = [
  {
    fullName: "System Admin",
    class: "Staff",
    username: "admin",
    password: "admin123", // Customize your root admin password here
    role: "Teacher"
  }
];


// Default Seed Assessment
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

/* ==========================================================================
   INITIALIZATION & SESSION PERSISTENCE
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  // Ensure default root teacher exists in LocalStorage
  let users = JSON.parse(localStorage.getItem('portal_users')) || [];
  if (!users.some(u => u.username.toLowerCase() === rootTeacher.username.toLowerCase())) {
    users.unshift(rootTeacher);
    localStorage.setItem('portal_users', JSON.stringify(users));
  }

  if (!localStorage.getItem('portal_resources')) {
    localStorage.setItem('portal_resources', JSON.stringify(initialAssessments));
  }
  if (!localStorage.getItem('portal_submissions')) {
    localStorage.setItem('portal_submissions', JSON.stringify([]));
  }

  // Restore Active User Session
  currentUser = JSON.parse(localStorage.getItem('portal_session')) || null;

  // Render Initial View
  updatePortalUI();
});

/* ==========================================================================
   1. AUTHENTICATION MODULE (HARDCODED ROOT ADMIN + FIREBASE & LOCAL CACHE)
   ========================================================================== */
window.handleLogin = async function(e) {
  e.preventDefault();
  
  const userVal = document.getElementById('loginUsername').value.trim();
  const passVal = document.getElementById('loginPassword').value.trim();
  const errEl = document.getElementById('loginError');

  if (!userVal || !passVal) {
    if (errEl) {
      errEl.textContent = 'Please enter both username and password.';
      errEl.style.display = 'block';
    }
    return;
  }

  let foundUser = null;

  // 1. Check Hardcoded Root Accounts First (Always works even if cache/db is cleared)
  foundUser = HARDCODED_ACCOUNTS.find(
    u => u.username.toLowerCase() === userVal.toLowerCase() && u.password === passVal
  );

  // 2. Check Firebase Firestore Cloud Database (if not found in hardcoded list)
  if (!foundUser && window.db) {
    try {
      const docSnap = await window.db.collection('users').doc(userVal.toLowerCase()).get();
      
      if (docSnap.exists) {
        const cloudUser = docSnap.data();
        if (cloudUser.password === passVal) {
          foundUser = cloudUser;
        }
      } else {
        const querySnap = await window.db.collection('users')
          .where('username', '==', userVal)
          .limit(1)
          .get();

        if (!querySnap.empty) {
          const cloudUser = querySnap.docs[0].data();
          if (cloudUser.password === passVal) {
            foundUser = cloudUser;
          }
        }
      }
    } catch (err) {
      console.warn('Cloud login lookup failed, falling back to local storage:', err);
    }
  }

  // 3. Check Local Storage Fallback
  if (!foundUser) {
    const localUsers = JSON.parse(localStorage.getItem('portal_users')) || [];
    foundUser = localUsers.find(
      u => u.username.toLowerCase() === userVal.toLowerCase() && u.password === passVal
    );
  }

  // 4. Handle Login Success or Failure
  if (foundUser) {
    if (errEl) errEl.style.display = 'none';
    currentUser = foundUser;

    // Persist user session locally
    localStorage.setItem('portal_session', JSON.stringify(currentUser));
    
    // Ensure root admin or new user is mirrored in local storage array
    const localUsers = JSON.parse(localStorage.getItem('portal_users')) || [];
    if (!localUsers.some(u => u.username.toLowerCase() === currentUser.username.toLowerCase())) {
      localUsers.push(currentUser);
      localStorage.setItem('portal_users', JSON.stringify(localUsers));
    }

    // Clear login input fields
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';

    // Refresh UI state
    if (typeof updatePortalUI === 'function') {
      updatePortalUI();
    }
  } else {
    if (errEl) {
      errEl.textContent = 'Invalid username or password!';
      errEl.style.display = 'block';
    }
  }
};

// Auto-restore session on page load
window.checkExistingSession = function() {
  const savedSession = localStorage.getItem('portal_session');
  if (savedSession) {
    try {
      currentUser = JSON.parse(savedSession);
      if (typeof updatePortalUI === 'function') {
        updatePortalUI();
      }
    } catch (err) {
      console.error('Error restoring session:', err);
      localStorage.removeItem('portal_session');
    }
  }
};

document.addEventListener('DOMContentLoaded', window.checkExistingSession);

window.handleLogout = function() {
  localStorage.removeItem('portal_session');
  currentUser = null;

  // Clear input fields
  const userEl = document.getElementById('loginUsername');
  const passEl = document.getElementById('loginPassword');
  const errEl = document.getElementById('loginError');

  if (userEl) userEl.value = '';
  if (passEl) passEl.value = '';
  
  // Optionally reset login error display state
  if (errEl) errEl.style.display = 'none';

  // If your form uses a parent <form> tag (e.g. id="loginForm"), you can also do:
  // const loginForm = document.getElementById('loginForm');
  // if (loginForm) loginForm.reset();

  updatePortalUI();
};

/* ==========================================================================
   2. STUDENT REGISTRATION & BULK IMPORT (FIREBASE FIRESTORE SYNC)
   ========================================================================== */

// Helper to save a single user permanently to Firebase Cloud Firestore and Local Cache
async function saveUserToCloud(userObj) {
  // 1. Sync to Local Storage Cache
  const localUsers = JSON.parse(localStorage.getItem('portal_users')) || [];
  const idx = localUsers.findIndex(u => u.username.toLowerCase() === userObj.username.toLowerCase());
  if (idx >= 0) {
    localUsers[idx] = userObj;
  } else {
    localUsers.push(userObj);
  }
  localStorage.setItem('portal_users', JSON.stringify(localUsers));

  // 2. Sync to Cloud Firestore (Doc ID = lowercase username to prevent duplicates)
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

// Single Student Registration
window.handleRegisterStudent = async function(e) {
  e.preventDefault();
  if (!currentUser || currentUser.role !== 'Teacher') return;

  const fullName = document.getElementById('regFullName').value.trim();
  const studentClass = document.getElementById('regClass').value;
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value.trim();

  // Check username collision in Firestore
  if (window.db) {
    try {
      const docSnap = await window.db.collection('users').doc(username.toLowerCase()).get();
      if (docSnap.exists) {
        alert('Username already exists in the system! Please assign a unique username.');
        return;
      }
    } catch (err) {
      console.warn('Could not verify username in Firestore, checking local storage:', err);
    }
  }

  // Fallback local username collision check
  const localUsers = JSON.parse(localStorage.getItem('portal_users')) || [];
  if (localUsers.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    alert('Username already exists! Please assign a unique username.');
    return;
  }

  const newUser = {
    fullName,
    class: studentClass,
    username,
    password,
    role: "Student"
  };

  await saveUserToCloud(newUser);

  alert(`Student "${fullName}" registered permanently for ${studentClass}!`);
  e.target.reset();

  if (typeof renderStudentModalTable === 'function') {
    renderStudentModalTable();
  }
};

function generateStrongPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < 8; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}

// Bulk Student Import from Excel / CSV
window.handleBulkImport = function() {
  if (!currentUser || currentUser.role !== 'Teacher') return;

  const fileInput = document.getElementById('bulkStudentFile');
  const targetClass = document.getElementById('bulkClass').value;

  if (!fileInput || !fileInput.files.length) {
    alert('Please select an Excel or CSV file to import.');
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = async function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "", blankrows: false });

      // Fetch existing users from Firestore to avoid duplicate usernames
      let systemUsers = [];
      if (window.db) {
        try {
          const snap = await window.db.collection('users').get();
          snap.forEach(doc => systemUsers.push(doc.data()));
        } catch (err) {
          console.warn('Failed to fetch users from Firestore, using local cache:', err);
          systemUsers = JSON.parse(localStorage.getItem('portal_users')) || [];
        }
      } else {
        systemUsers = JSON.parse(localStorage.getItem('portal_users')) || [];
      }

      let addedCount = 0;
      const savePromises = [];

      jsonRows.forEach((row, index) => {
        if (!row || row.length === 0) return;

        let rawName = "";
        for (let col = 0; col < row.length; col++) {
          let val = String(row[col] || '').trim();
          if (val && isNaN(val) && val.length > 1) {
            rawName = val;
            break;
          }
        }

        if (!rawName && row[0]) rawName = String(row[0]).trim();

        // Skip headers
        if (index === 0 && (
          rawName.toLowerCase().includes('name') ||
          rawName.toLowerCase().includes('student') ||
          rawName.toLowerCase().includes('s/n')
        )) return;

        if (rawName && isNaN(rawName)) {
          const nameParts = rawName.trim().split(/\s+/);
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

      alert(`Imported ${addedCount} student account(s) into ${targetClass} and saved permanently to Firebase! Click "Download CSV" to retrieve credentials.`);
      fileInput.value = '';

      if (typeof renderStudentModalTable === 'function') {
        renderStudentModalTable();
      }
    } catch (err) {
      console.error(err);
      alert('Error parsing or saving file data.');
    }
  };

  reader.readAsArrayBuffer(file);
};

// Export Registered Students CSV (Fetches from Cloud/Local)
window.downloadStudentCSV = async function() {
  let students = [];

  // 1. Fetch from Firestore if available
  if (window.db) {
    try {
      const snap = await window.db.collection('users').where('role', '==', 'Student').get();
      snap.forEach(doc => students.push(doc.data()));
    } catch (err) {
      console.warn('Failed to fetch students from Cloud for CSV export, falling back to local storage:', err);
    }
  }

  // 2. Fallback to Local Storage if cloud returned empty or failed
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
   3. STUDENT MANAGEMENT MODAL CONTROLS (FIREBASE FIRESTORE SYNC)
   ========================================================================== */
let editingUsername = null;

window.openStudentModal = function() {
  const modal = document.getElementById('studentModal');
  if (modal) modal.style.display = 'flex';
  editingUsername = null;
  renderStudentModalTable();
};

window.closeStudentModal = function() {
  const modal = document.getElementById('studentModal');
  if (modal) modal.style.display = 'none';
  editingUsername = null;
};

// Asynchronous Render to fetch live student data from Firestore
window.renderStudentModalTable = async function() {
  const tbody = document.getElementById('studentModalTableBody');
  const searchInput = document.getElementById('studentSearchInput');
  const searchFilter = searchInput ? searchInput.value.toLowerCase().trim() : '';

  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b;">Loading students from database...</td></tr>';

  let students = [];

  // 1. Fetch live records from Cloud Firestore
  if (window.db) {
    try {
      const snap = await window.db.collection('users').where('role', '==', 'Student').get();
      snap.forEach(doc => students.push(doc.data()));
      
      // Update local storage cache to stay in sync
      const allLocalUsers = JSON.parse(localStorage.getItem('portal_users')) || [];
      const nonStudents = allLocalUsers.filter(u => u.role !== 'Student');
      localStorage.setItem('portal_users', JSON.stringify([...nonStudents, ...students]));
    } catch (err) {
      console.warn('Failed to fetch students from Firestore, falling back to local storage:', err);
    }
  }

  // 2. Fallback to Local Storage if Firestore returned empty or failed
  if (students.length === 0) {
    const localUsers = JSON.parse(localStorage.getItem('portal_users')) || [];
    students = localUsers.filter(u => u.role === 'Student');
  }

  // 3. Filter based on search query
  const filteredStudents = students.filter(u => (
    (u.fullName || '').toLowerCase().includes(searchFilter) ||
    (u.class || '').toLowerCase().includes(searchFilter) ||
    (u.username || '').toLowerCase().includes(searchFilter)
  ));

  if (filteredStudents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b;">No matching student accounts found.</td></tr>';
    return;
  }

  tbody.innerHTML = filteredStudents.map((s, index) => {
    const isEditing = editingUsername === s.username;
    if (isEditing) {
      return `
        <tr>
          <td>${index + 1}</td>
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
            <button onclick="saveStudentEdit('${s.username}')" class="btn-icon-only btn-upload" title="Save"><i class="fa-solid fa-check"></i></button>
            <button onclick="cancelStudentEdit()" class="btn-icon-only btn-secondary" title="Cancel"><i class="fa-solid fa-xmark"></i></button>
          </td>
        </tr>
      `;
    }

    return `
      <tr>
        <td>${index + 1}</td>
        <td><strong>${s.fullName}</strong></td>
        <td>${s.class}</td>
        <td><code>${s.username}</code></td>
        <td><code>${s.password}</code></td>
        <td style="display:flex; gap:0.4rem;">
          <button onclick="enableStudentEdit('${s.username}')" class="btn-icon-only btn-edit" title="Edit Student"><i class="fa-solid fa-pen-to-square"></i></button>
          <button onclick="deleteStudent('${s.username}')" class="btn-icon-only btn-danger" title="Delete Student"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');
};

window.enableStudentEdit = function(username) {
  editingUsername = username;
  renderStudentModalTable();
};

window.cancelStudentEdit = function() {
  editingUsername = null;
  renderStudentModalTable();
};

// Save Student Edits to Firestore + Local Cache
window.saveStudentEdit = async function(oldUsername) {
  const newFullName = document.getElementById('editFullName').value.trim();
  const newClass = document.getElementById('editClass').value;
  const newUsername = document.getElementById('editUsername').value.trim();
  const newPassword = document.getElementById('editPassword').value.trim();

  if (!newFullName || !newUsername || !newPassword) {
    alert('All fields are required.');
    return;
  }

  // Check username uniqueness if changed
  if (newUsername.toLowerCase() !== oldUsername.toLowerCase()) {
    if (window.db) {
      try {
        const docSnap = await window.db.collection('users').doc(newUsername.toLowerCase()).get();
        if (docSnap.exists) {
          alert('Username is already taken by another account.');
          return;
        }
      } catch (err) {
        console.warn('Could not verify username uniqueness in cloud:', err);
      }
    }
  }

  const updatedData = {
    fullName: newFullName,
    class: newClass,
    username: newUsername,
    password: newPassword,
    role: 'Student'
  };

  // Update in Firebase Firestore
  if (window.db) {
    try {
      // If username changed, delete old document ID and create new one
      if (oldUsername.toLowerCase() !== newUsername.toLowerCase()) {
        await window.db.collection('users').doc(oldUsername.toLowerCase()).delete();
      }
      await window.db.collection('users').doc(newUsername.toLowerCase()).set(updatedData, { merge: true });
    } catch (err) {
      console.error('Error updating student in Firestore:', err);
      alert('Failed to update record on cloud database.');
      return;
    }
  }

  // Sync with Local Storage
  let localUsers = JSON.parse(localStorage.getItem('portal_users')) || [];
  const idx = localUsers.findIndex(u => u.username.toLowerCase() === oldUsername.toLowerCase());
  if (idx !== -1) {
    localUsers[idx] = updatedData;
  } else {
    localUsers.push(updatedData);
  }
  localStorage.setItem('portal_users', JSON.stringify(localUsers));

  editingUsername = null;
  renderStudentModalTable();
};

// Delete single student from Firestore + Local Cache
window.deleteStudent = async function(username) {
  if (!confirm(`Are you sure you want to delete student "${username}"?`)) return;

  if (window.db) {
    try {
      await window.db.collection('users').doc(username.toLowerCase()).delete();
    } catch (err) {
      console.error('Error deleting student from Firestore:', err);
      alert('Could not delete student from cloud database.');
      return;
    }
  }

  let localUsers = JSON.parse(localStorage.getItem('portal_users')) || [];
  localUsers = localUsers.filter(u => u.username.toLowerCase() !== username.toLowerCase());
  localStorage.setItem('portal_users', JSON.stringify(localUsers));

  renderStudentModalTable();
};

// Bulk delete all students from Firestore + Local Cache
window.deleteAllStudents = async function() {
  let localUsers = JSON.parse(localStorage.getItem('portal_users')) || [];
  
  if (confirm('WARNING: Are you sure you want to delete ALL registered students from the cloud and local storage?')) {
    if (window.db) {
      try {
        const snap = await window.db.collection('users').where('role', '==', 'Student').get();
        const batch = window.db.batch();
        snap.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      } catch (err) {
        console.error('Error performing bulk deletion in Firestore:', err);
        alert('Failed to complete bulk deletion on cloud.');
        return;
      }
    }

    // Clear students from Local Storage
    localUsers = localUsers.filter(u => u.role !== 'Student');
    localStorage.setItem('portal_users', JSON.stringify(localUsers));

    renderStudentModalTable();
    alert('All student accounts deleted successfully.');
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

window.handleStudentSubmission = function(testId, testTitle, fileInput) {
  if (!fileInput || !fileInput.files.length) return;

  const fileName = fileInput.files[0].name;
  const submissions = JSON.parse(localStorage.getItem('portal_submissions')) || [];

  const newSubmission = {
    id: Date.now(),
    testId: testId,
    testTitle: testTitle,
    studentName: currentUser.fullName,
    studentClass: currentUser.class,
    fileName: fileName,
    fileUrl: "uploads/submissions/" + fileName,
    submittedAt: new Date().toLocaleString()
  };

  submissions.push(newSubmission);
  localStorage.setItem('portal_submissions', JSON.stringify(submissions));

  alert(`Submitted answer file for: ${testTitle}`);
  renderAssessments();
  if (currentUser.role === 'Teacher') renderSubmissions();
};

/* ==========================================================================
   5. PORTAL UI RENDERERS
   ========================================================================== */
function updatePortalUI() {
  const loginSec = document.getElementById('loginSection');
  const dashSec = document.getElementById('dashboardSection');
  const teacherControls = document.getElementById('teacherControls');
  const teacherReports = document.getElementById('teacherReports');
  const viewPanel = document.getElementById('assessmentsViewPanel');

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
    if (viewPanel && viewPanel.parentElement) {
      viewPanel.parentElement.style.gridTemplateColumns = '1fr 2fr';
    }
    renderSubmissions();
  } else {
    if (teacherControls) teacherControls.style.display = 'none';
    if (teacherReports) teacherReports.style.display = 'none';
    if (viewPanel && viewPanel.parentElement) {
      viewPanel.parentElement.style.gridTemplateColumns = '1fr';
    }
  }

  renderAssessments();
}

function renderAssessments() {
  const container = document.getElementById('assessmentsContainer');
  if (!container) return;

  const resources = JSON.parse(localStorage.getItem('portal_resources')) || [];
  const submissions = JSON.parse(localStorage.getItem('portal_submissions')) || [];
  const now = new Date();

  let assessments = resources.filter(r => r.category === "Question Paper");
  if (currentUser && currentUser.role === 'Student') {
    assessments = assessments.filter(a => a.class === currentUser.class);
  }

  if (assessments.length === 0) {
    container.innerHTML = `<p style="color:#64748b;">No active assessments available ${currentUser && currentUser.role === 'Student' ? 'for ' + currentUser.class : ''}.</p>`;
    return;
  }

  container.innerHTML = assessments.map(a => {
    const deadlineDate = new Date(a.deadline);
    const isExpired = now > deadlineDate;
    
    // Check submission status by test ID and student name
    const studentSub = (currentUser && currentUser.role === 'Student') 
      ? submissions.find(s => String(s.testId) === String(a.id) && s.studentName === currentUser.fullName) 
      : null;
    
    // Safely encode title for inline onclick execution
    const safeTitle = encodeURIComponent(a.title);

    return `
      <div class="test-card">
        <div class="test-header">
          <span class="test-title">${a.title} <small style="color:#64748b;">(${a.class})</small></span>
          <span class="deadline-badge ${isExpired ? 'deadline-expired' : 'deadline-active'}">
            ${isExpired ? 'Expired' : 'Active until: ' + deadlineDate.toLocaleString()}
          </span>
        </div>
        <p style="font-size:0.85rem; color:#475569; margin:0.5rem 0;">${a.description || 'No instructions provided.'}</p>
        <div class="test-actions">
          <a href="${a.fileUrl}" download class="btn-action btn-download"><i class="fa-solid fa-file-arrow-down"></i> Download Paper</a>

          ${(currentUser && currentUser.role === 'Student') ? `
            ${studentSub ? `
              <!-- SUBMITTED STATE -->
              <span style="color:#16a34a; font-size:0.85rem; font-weight:600; display:inline-flex; align-items:center; gap:0.3rem;">
                <i class="fa-solid fa-circle-check"></i> Submitted (${studentSub.fileName})
              </span>
              
              ${!isExpired ? `
                <!-- RESUBMIT / CANCEL ACTIONS BEFORE DEADLINE -->
                <button type="button" onclick="openSubmissionModalWithDetails('${a.id}', '${safeTitle}')" class="btn-action btn-edit" title="Replace uploaded file">
                  <i class="fa-solid fa-arrows-rotate"></i> Replace File
                </button>
                <button type="button" onclick="cancelSubmission('${a.id}')" class="btn-action btn-danger" style="padding:0.4rem 0.6rem; font-size:0.8rem;" title="Unsubmit file">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              ` : `
                <span style="font-size:0.75rem; color:#94a3b8; margin-left:0.5rem;">(Locked - Deadline passed)</span>
              `}
            ` : `
              <!-- NOT SUBMITTED YET STATE -->
              ${isExpired ? `
                <button disabled class="btn-action btn-disabled"><i class="fa-solid fa-lock"></i> Deadline Passed</button>
              ` : `
                <button type="button" onclick="openSubmissionModalWithDetails('${a.id}', '${safeTitle}')" class="btn-action btn-upload">
                  <i class="fa-solid fa-file-arrow-up"></i> Upload Answer
                </button>
              `}
            `}
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

/* ==========================================================================
   STUDENT SUBMISSION HANDLERS (FIREBASE FIRESTORE SYNC)
   ========================================================================== */

window.handleFormSubmission = function(event) {
  event.preventDefault();

  const nameEl = document.getElementById('studentName');
  const classEl = document.getElementById('studentClass');
  
  // Handled either submissionTestTitle or testTitle from modal fix
  const titleEl = document.getElementById('submissionTestTitle') || document.getElementById('testTitle');
  const testIdEl = document.getElementById('submissionTestId');
  const fileInput = document.getElementById('assignmentFile');

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    alert("Please select a file to upload.");
    return;
  }

  const file = fileInput.files[0];
  
  // Note: Large files (>1MB) in DataURL format can exceed Firestore document limits.
  if (file.size > 1048576) {
    alert("File size exceeds 1 MB. Please upload a smaller document.");
    return;
  }

  const reader = new FileReader();

  reader.onload = async function(e) {
    const fileDataUrl = e.target.result;
    const testIdVal = testIdEl ? testIdEl.value : null;
    const studentNameVal = nameEl ? nameEl.value.trim() : (currentUser ? currentUser.fullName : '');
    const submissionId = `sub_${testIdVal}_${studentNameVal.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

    const newSubmission = {
      id: submissionId,
      testId: String(testIdVal),
      studentName: studentNameVal,
      studentUsername: currentUser ? currentUser.username : '',
      studentClass: classEl ? classEl.value.trim() : '',
      testTitle: titleEl ? titleEl.value.trim() : '',
      fileName: file.name,
      fileUrl: fileDataUrl,
      submittedAt: new Date().toISOString()
    };

    // 1. Sync to Firebase Firestore
    if (window.db) {
      try {
        await window.db.collection('submissions').doc(submissionId).set(newSubmission, { merge: true });
      } catch (err) {
        console.error('Error uploading submission to Cloud Firestore:', err);
        alert('Warning: Could not save submission online. Saving locally...');
      }
    }

    // 2. Sync to Local Storage Cache (Overwrite previous entry for same test & student)
    let localSubmissions = JSON.parse(localStorage.getItem('portal_submissions')) || [];
    if (testIdVal && studentNameVal) {
      localSubmissions = localSubmissions.filter(s => 
        !(String(s.testId) === String(testIdVal) && s.studentName.toLowerCase() === studentNameVal.toLowerCase())
      );
    }
    localSubmissions.unshift(newSubmission);
    localStorage.setItem('portal_submissions', JSON.stringify(localSubmissions));

    // Reset Form & Close Modal
    const form = document.getElementById('assignmentForm');
    if (form) form.reset();
    
    if (typeof closeSubmissionModal === 'function') {
      closeSubmissionModal();
    }

    alert("Assignment submitted successfully!");

    // Re-render UI
    if (typeof renderAssessments === 'function') renderAssessments();
    if (typeof renderSubmissions === 'function') renderSubmissions();
  };

  reader.readAsDataURL(file);
};

/**
 * Allows a student to cancel / unsubmit their file directly before deadline
 */
window.cancelSubmission = async function(testId) {
  if (!currentUser || currentUser.role !== 'Student') return;

  const confirmCancel = confirm("Are you sure you want to cancel and delete your current submission for this assessment?");
  if (!confirmCancel) return;

  const studentName = currentUser.fullName;
  const submissionId = `sub_${testId}_${studentName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

  // 1. Remove from Firebase Firestore
  if (window.db) {
    try {
      await window.db.collection('submissions').doc(submissionId).delete();
    } catch (err) {
      console.error('Error deleting submission from Cloud Firestore:', err);
    }
  }

  // 2. Remove from Local Storage Cache
  let submissions = JSON.parse(localStorage.getItem('portal_submissions')) || [];
  submissions = submissions.filter(s => 
    !(String(s.testId) === String(testId) && s.studentName.toLowerCase() === studentName.toLowerCase())
  );
  localStorage.setItem('portal_submissions', JSON.stringify(submissions));

  // Refresh views
  if (typeof renderAssessments === 'function') renderAssessments();
  if (typeof renderSubmissions === 'function') renderSubmissions();
};

/* ==========================================================================
   RENDER SUBMISSIONS LIST (FIREBASE FIRESTORE SYNC)
   ========================================================================== */
window.renderSubmissions = async function() {
  const container = document.getElementById('submissionsContainer');
  if (!container) return;

  container.innerHTML = '<p style="color:#64748b; font-size:0.85rem;"><i class="fa-solid fa-spinner fa-spin"></i> Loading submitted work...</p>';

  let submissions = [];

  // 1. Fetch live submissions from Firebase Firestore
  if (window.db) {
    try {
      const snap = await window.db.collection('submissions').get();
      snap.forEach(doc => submissions.push(doc.data()));

      // Sync local storage cache with cloud data
      localStorage.setItem('portal_submissions', JSON.stringify(submissions));
    } catch (err) {
      console.warn('Failed to load submissions from cloud, falling back to local storage:', err);
    }
  }

  // 2. Fallback to Local Storage if Firestore returned empty or failed
  if (submissions.length === 0) {
    submissions = JSON.parse(localStorage.getItem('portal_submissions')) || [];
  }

  // 3. Filter submissions if user is a Student (Students only see their own work, Teachers see all)
  if (currentUser && currentUser.role === 'Student') {
    submissions = submissions.filter(s => 
      s.studentName.toLowerCase() === currentUser.fullName.toLowerCase() ||
      (s.studentUsername && s.studentUsername.toLowerCase() === currentUser.username.toLowerCase())
    );
  }

  if (submissions.length === 0) {
    container.innerHTML = '<p style="color:#64748b; font-size:0.85rem;">No student work submitted yet.</p>';
    return;
  }

  // Sort newest submissions first
  submissions.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));

  container.innerHTML = submissions.map(sub => `
    <div class="sub-item" style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem; border-bottom:1px solid #e2e8f0;">
      <div>
        <strong>${sub.studentName}</strong> <small style="color:#2563eb;">(${sub.studentClass})</small><br>
        <span style="color:#64748b; font-size:0.85rem;">${sub.testTitle}</span>
      </div>
      <a href="${sub.fileUrl}" download="${sub.fileName || 'submission'}" class="btn-action btn-download" style="padding:0.3rem 0.6rem; font-size:0.75rem; text-decoration:none;">
        <i class="fa-solid fa-download"></i> Get File
      </a>
    </div>
  `).join('');
};

/* ==========================================================================
   MODAL TOGGLES & HELPERS
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
  
  // 1. Open the Modal View
  openSubmissionModal();

  // 2. Pre-fill student credentials if logged in
  if (currentUser) {
    const nameEl = document.getElementById('studentName');
    const classEl = document.getElementById('studentClass');
    if (nameEl) nameEl.value = currentUser.fullName || '';
    if (classEl) classEl.value = currentUser.class || '';
  }

  // 3. Pre-fill Assessment Metadata
  const titleEl = document.getElementById('testTitle');
  if (titleEl) {
    titleEl.value = decodedTitle;
  }

  // 4. Store test ID (create hidden input dynamically if not in HTML)
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
