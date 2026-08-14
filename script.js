/* ==========================================================================
   SAMCAM SOLUTIONS - ASSESSMENT PORTAL ENGINE (script.js)
   ========================================================================== */

// Shared Portal State
window.currentUser = null;
let editingUsername = null;

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
  window.dispatchEvent(new CustomEvent('portalSessionChanged', { detail: user }));
}

/* ==========================================================================
   INITIALIZATION & SESSION PERSISTENCE
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
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

  // 3. Refresh UI
  if (typeof updatePortalUI === 'function') {
    updatePortalUI();
  }
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

    if (typeof updatePortalUI === 'function') updatePortalUI();
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

  if (typeof updatePortalUI === 'function') updatePortalUI();
};

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
  if (!currentUser || currentUser.role !== 'Teacher') return;

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
  if (!currentUser || currentUser.role !== 'Teacher') return;

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
   3. STUDENT MANAGEMENT MODAL
   ========================================================================== */
window.openManageStudentsModal = function() {
  const modal = document.getElementById('manageStudentsModal');
  if (modal) {
    modal.style.display = 'flex';
  } else {
    console.error("Element #manageStudentsModal not found in DOM.");
  }
  editingUsername = null;
  renderStudentModalTable();
};

window.closeManageStudentsModal = function() {
  const modal = document.getElementById('manageStudentsModal');
  if (modal) {
    modal.style.display = 'none';
  }
  editingUsername = null;
};

// Backwards compatibility alias in case old handlers are referenced
window.openStudentModal = window.openManageStudentsModal;
window.closeStudentModal = window.closeManageStudentsModal;

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

  if (filteredStudents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b;">No matching students found.</td></tr>';
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
            <button onclick="saveStudentEdit('${s.username}')" class="btn-action btn-upload"><i class="fa-solid fa-check"></i></button>
            <button onclick="cancelStudentEdit()" class="btn-action btn-secondary"><i class="fa-solid fa-xmark"></i></button>
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
          <button onclick="enableStudentEdit('${s.username}')" class="btn-action btn-edit"><i class="fa-solid fa-pen-to-square"></i></button>
          <button onclick="deleteStudent('${s.username}')" class="btn-action btn-danger"><i class="fa-solid fa-trash"></i></button>
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
   5. PORTAL UI RENDERERS
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
              <span style="color:#16a34a; font-size:0.85rem; font-weight:600;"><i class="fa-solid fa-circle-check"></i> Submitted (${studentSub.fileName})</span>
              ${!isExpired ? `
                <button type="button" onclick="openSubmissionModalWithDetails('${a.id}', '${safeTitle}')" class="btn-action btn-edit"><i class="fa-solid fa-arrows-rotate"></i> Replace</button>
                <button type="button" onclick="cancelSubmission('${a.id}')" class="btn-action btn-danger"><i class="fa-solid fa-trash-can"></i></button>
              ` : `<span style="font-size:0.75rem; color:#94a3b8;">(Locked)</span>`}
            ` : `
              ${isExpired ? `<button disabled class="btn-action btn-disabled"><i class="fa-solid fa-lock"></i> Deadline Passed</button>` : `
                <button type="button" onclick="openSubmissionModalWithDetails('${a.id}', '${safeTitle}')" class="btn-action btn-upload"><i class="fa-solid fa-file-arrow-up"></i> Upload Answer</button>
              `}
            `}
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

/* ==========================================================================
   STUDENT SUBMISSION HANDLERS
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

    if (window.db) {
      try {
        await window.db.collection('submissions').doc(submissionId).set(newSubmission, { merge: true });
      } catch (err) {
        console.error('Firestore save error:', err);
      }
    }

    let localSubmissions = JSON.parse(localStorage.getItem('portal_submissions')) || [];
    localSubmissions = localSubmissions.filter(s => !(String(s.testId) === String(testIdVal) && s.studentName.toLowerCase() === studentNameVal.toLowerCase()));
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
  const submissionId = `sub_${testId}_${studentName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

  if (window.db) {
    try {
      await window.db.collection('submissions').doc(submissionId).delete();
    } catch (err) {
      console.error('Firestore delete error:', err);
    }
  }

  let submissions = JSON.parse(localStorage.getItem('portal_submissions')) || [];
  submissions = submissions.filter(s => !(String(s.testId) === String(testId) && s.studentName.toLowerCase() === studentName.toLowerCase()));
  localStorage.setItem('portal_submissions', JSON.stringify(submissions));

  renderAssessments();
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
        <span style="color:#64748b; font-size:0.85rem;">${sub.testTitle}</span>
      </div>
      <a href="${sub.fileUrl}" download="${sub.fileName || 'submission'}" class="btn-action btn-download" style="padding:0.3rem 0.6rem; font-size:0.75rem;">
        <i class="fa-solid fa-download"></i> Get File
      </a>
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

  // FIXED TARGET FIELD ID
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
