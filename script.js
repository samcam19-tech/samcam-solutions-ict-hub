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
   1. AUTHENTICATION MODULE
   ========================================================================== */
window.handleLogin = function(e) {
  e.preventDefault();
  const userVal = document.getElementById('loginUsername').value.trim();
  const passVal = document.getElementById('loginPassword').value.trim();
  const errEl = document.getElementById('loginError');

  const users = JSON.parse(localStorage.getItem('portal_users')) || [];
  const foundUser = users.find(u => u.username.toLowerCase() === userVal.toLowerCase() && u.password === passVal);

  if (foundUser) {
    if (errEl) errEl.style.display = 'none';
    currentUser = foundUser;
    localStorage.setItem('portal_session', JSON.stringify(currentUser));
    
    // Clear input fields on successful login so they aren't pre-filled on logout
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
    
    updatePortalUI();
  } else {
    if (errEl) errEl.style.display = 'block';
  }
};

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
   2. STUDENT REGISTRATION & BULK IMPORT
   ========================================================================== */
window.handleRegisterStudent = function(e) {
  e.preventDefault();
  if (!currentUser || currentUser.role !== 'Teacher') return;

  const fullName = document.getElementById('regFullName').value.trim();
  const studentClass = document.getElementById('regClass').value;
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value.trim();

  const users = JSON.parse(localStorage.getItem('portal_users')) || [];

  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    alert('Username already exists! Please assign a unique username.');
    return;
  }

  users.push({
    fullName,
    class: studentClass,
    username,
    password,
    role: "Student"
  });

  localStorage.setItem('portal_users', JSON.stringify(users));
  alert(`Student "${fullName}" registered successfully for ${studentClass}!`);
  e.target.reset();
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

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "", blankrows: false });

      const users = JSON.parse(localStorage.getItem('portal_users')) || [];
      let addedCount = 0;

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

          while (users.some(u => u.username.toLowerCase() === finalUsername.toLowerCase())) {
            finalUsername = `${baseUsername}${counter}`;
            counter++;
          }

          users.push({
            fullName: rawName,
            class: targetClass,
            username: finalUsername,
            password: generateStrongPassword(),
            role: "Student"
          });

          addedCount++;
        }
      });

      localStorage.setItem('portal_users', JSON.stringify(users));
      alert(`Imported ${addedCount} student account(s) into ${targetClass}! Click "Download CSV" to retrieve credentials.`);
      fileInput.value = '';
    } catch (err) {
      console.error(err);
      alert('Error parsing file. Please verify it is a valid Excel or CSV file.');
    }
  };

  reader.readAsArrayBuffer(file);
};

window.downloadStudentCSV = function() {
  const users = JSON.parse(localStorage.getItem('portal_users')) || [];
  const students = users.filter(u => u.role === 'Student');

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
   3. STUDENT MANAGEMENT MODAL CONTROLS
   ========================================================================== */
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

window.renderStudentModalTable = function() {
  const tbody = document.getElementById('studentModalTableBody');
  const searchInput = document.getElementById('studentSearchInput');
  const searchFilter = searchInput ? searchInput.value.toLowerCase().trim() : '';

  if (!tbody) return;

  const users = JSON.parse(localStorage.getItem('portal_users')) || [];
  const students = users.filter(u => u.role === 'Student' && (
    u.fullName.toLowerCase().includes(searchFilter) ||
    u.class.toLowerCase().includes(searchFilter) ||
    u.username.toLowerCase().includes(searchFilter)
  ));

  if (students.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b;">No matching student accounts found.</td></tr>';
    return;
  }

  tbody.innerHTML = students.map((s, index) => {
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

window.saveStudentEdit = function(oldUsername) {
  const newFullName = document.getElementById('editFullName').value.trim();
  const newClass = document.getElementById('editClass').value;
  const newUsername = document.getElementById('editUsername').value.trim();
  const newPassword = document.getElementById('editPassword').value.trim();

  if (!newFullName || !newUsername || !newPassword) {
    alert('All fields are required.');
    return;
  }

  let users = JSON.parse(localStorage.getItem('portal_users')) || [];

  if (newUsername.toLowerCase() !== oldUsername.toLowerCase() && users.some(u => u.username.toLowerCase() === newUsername.toLowerCase())) {
    alert('Username is already taken.');
    return;
  }

  const userIndex = users.findIndex(u => u.username === oldUsername);
  if (userIndex !== -1) {
    users[userIndex].fullName = newFullName;
    users[userIndex].class = newClass;
    users[userIndex].username = newUsername;
    users[userIndex].password = newPassword;

    localStorage.setItem('portal_users', JSON.stringify(users));
    editingUsername = null;
    renderStudentModalTable();
  }
};

window.deleteStudent = function(username) {
  if (!confirm(`Are you sure you want to delete student "${username}"?`)) return;

  let users = JSON.parse(localStorage.getItem('portal_users')) || [];
  users = users.filter(u => u.username !== username);

  localStorage.setItem('portal_users', JSON.stringify(users));
  renderStudentModalTable();
};

window.deleteAllStudents = function() {
  let users = JSON.parse(localStorage.getItem('portal_users')) || [];
  const studentCount = users.filter(u => u.role === 'Student').length;

  if (studentCount === 0) {
    alert('No student accounts to delete.');
    return;
  }

  if (confirm(`WARNING: Are you sure you want to delete ALL ${studentCount} registered students?`)) {
    users = users.filter(u => u.role !== 'Student');
    localStorage.setItem('portal_users', JSON.stringify(users));
    renderStudentModalTable();
    alert('All student accounts deleted.');
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
    const studentSub = (currentUser && currentUser.role === 'Student') ? submissions.find(s => s.testId === a.id && s.studentName === currentUser.fullName) : null;
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
            ` : `
              ${isExpired ? `
                <button disabled class="btn-action btn-disabled"><i class="fa-solid fa-lock"></i> Deadline Passed</button>
              ` : `
                <label class="btn-action btn-upload">
                  <i class="fa-solid fa-file-arrow-up"></i> Upload Answer
                  <input type="file" style="display:none;" onchange="handleStudentSubmission(${a.id}, decodeURIComponent('${safeTitle}'), this)">
                </label>
              `}
            `}
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

/* ==========================================================================
   STUDENT SUBMISSION HANDLER
   ========================================================================== */

function handleFormSubmission(event) {
  event.preventDefault();

  const nameEl = document.getElementById('studentName');
  const classEl = document.getElementById('studentClass');
  const titleEl = document.getElementById('testTitle');
  const fileInput = document.getElementById('assignmentFile');

  if (!fileInput.files || fileInput.files.length === 0) {
    alert("Please select a file to upload.");
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  // Convert uploaded file to Data URL so it can be downloaded later from localStorage
  reader.onload = function(e) {
    const fileDataUrl = e.target.result;

    const newSubmission = {
      id: Date.now(),
      studentName: nameEl.value.trim(),
      studentClass: classEl.value.trim(),
      testTitle: titleEl.value.trim(),
      fileName: file.name,
      fileUrl: fileDataUrl, // Data URL for direct downloading
      submittedAt: new Date().toISOString().split('T')[0]
    };

    // Save to localStorage
    const existing = JSON.parse(localStorage.getItem('portal_submissions')) || [];
    existing.unshift(newSubmission);
    localStorage.setItem('portal_submissions', JSON.stringify(existing));

    // Clear form & close modal
    document.getElementById('assignmentForm').reset();
    closeSubmissionModal();

    // Refresh rendering
    renderSubmissions();
  };

  reader.readAsDataURL(file);
}

/* ==========================================================================
   RENDER SUBMISSIONS LIST
   ========================================================================== */
function renderSubmissions() {
  const container = document.getElementById('submissionsContainer');
  if (!container) return;

  const submissions = JSON.parse(localStorage.getItem('portal_submissions')) || [];

  if (submissions.length === 0) {
    container.innerHTML = '<p style="color:#64748b; font-size:0.85rem;">No student work submitted yet.</p>';
    return;
  }

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
}

/* ==========================================================================
   MODAL TOGGLES
   ========================================================================== */
function openSubmissionModal() {
  const modal = document.getElementById('submissionModal');
  if (modal) modal.style.display = 'flex';
}

function closeSubmissionModal() {
  const modal = document.getElementById('submissionModal');
  if (modal) modal.style.display = 'none';
}
