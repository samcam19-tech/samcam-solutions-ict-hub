/* ==========================================================================
   GLOBAL VARIABLES & PORTAL INITIALIZATION
   ========================================================================== */
let allResources = [];
let currentClass = 'ALL';
let currentCategory = 'ALL';

// Root teacher account
const rootTeacher = {
  username: "admin",
  password: "admin",
  fullName: "Root Teacher / Admin",
  role: "Teacher"
};

// Base JSON for initial resources
const initialJSON = [
  {
    "id": 1,
    "class": "S4",
    "category": "Question Paper",
    "title": "Wakissha UCE ICT 2 MOCK 2026",
    "description": "Full practical paper instructions.",
    "fileUrl": "uploads/Wakissha UCE ICT 2 MOCK 2026.pdf",
    "date": "2026-08-05",
    "deadline": "2026-08-20T23:59"
  }
];

// Initialize LocalStorage structures
if (!localStorage.getItem('portal_users')) {
  localStorage.setItem('portal_users', JSON.stringify([rootTeacher]));
}
if (!localStorage.getItem('portal_resources')) {
  localStorage.setItem('portal_resources', JSON.stringify(initialJSON));
}
if (!localStorage.getItem('portal_submissions')) {
  localStorage.setItem('portal_submissions', JSON.stringify([]));
}

let currentUser = JSON.parse(localStorage.getItem('portal_session')) || null;
let editingUsername = null;

/* ==========================================================================
   DOM LOAD & EVENT INITIALIZATIONS
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  // 1. Fetch resource data from JSON (if grid exists on page)
  const resourceGrid = document.getElementById('resource-grid');
  if (resourceGrid) {
    fetch('data.json')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        allResources = data;
        renderCards();
      })
      .catch(error => {
        console.error("Error loading resources:", error);
        resourceGrid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 2.5rem; background: #fef2f2; border-radius: 12px; border: 1px solid #fecaca;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
            <p style="font-weight: 600;">Failed to load resource data.</p>
            <p style="font-size: 0.85rem; color: #991b1b;">Please check if data.json exists or is properly formatted.</p>
          </div>`;
      });
  }

  // 2. Initialize Assessment Portal UI
  updatePortalUI();
});

/* ==========================================================================
   RESOURCE GRID & FILTERING LOGIC
   ========================================================================== */
// HELPER: Detect file type and return appropriate Icon + Label + CSS class
function getFileTypeInfo(item) {
  let ext = '';

  if (item.fileType) {
    ext = item.fileType.toLowerCase().trim().replace('.', '');
  } else if (item.fileUrl) {
    const cleanUrl = item.fileUrl.split('?')[0].split('#')[0];
    ext = cleanUrl.substring(cleanUrl.lastIndexOf('.') + 1).toLowerCase();
  }

  switch (ext) {
    case 'pdf':
      return { label: 'PDF', icon: 'fa-file-pdf', tagClass: 'tag-pdf' };
    case 'doc':
    case 'docx':
      return { label: 'WORD', icon: 'fa-file-word', tagClass: 'tag-word' };
    case 'xls':
    case 'xlsx':
    case 'csv':
      return { label: 'EXCEL', icon: 'fa-file-excel', tagClass: 'tag-excel' };
    case 'ppt':
    case 'pptx':
      return { label: 'POWERPOINT', icon: 'fa-file-powerpoint', tagClass: 'tag-powerpoint' };
    case 'zip':
    case 'rar':
    case '7z':
      return { label: 'ZIP ARCHIVE', icon: 'fa-file-zipper', tagClass: 'tag-archive' };
    case 'accdb':
    case 'mdb':
      return { label: 'ACCESS DB', icon: 'fa-database', tagClass: 'tag-db' };
    case 'html':
    case 'htm':
      return { label: 'HTML', icon: 'fa-code', tagClass: 'tag-code' };
    default:
      return { label: ext ? ext.toUpperCase() : 'FILE', icon: 'fa-file-lines', tagClass: 'tag-default' };
  }
}

function filterClass(cls, btnElement) {
  currentClass = cls;
  updateActiveButtons('.filter-row:nth-child(1) .segment-btn', btnElement);
  renderCards();
}

function filterCategory(cat, btnElement) {
  currentCategory = cat;
  updateActiveButtons('.filter-row:nth-child(2) .segment-btn', btnElement);
  renderCards();
}

function searchResources() {
  renderCards();
}

function updateActiveButtons(selector, targetBtn) {
  const element = targetBtn || (window.event ? window.event.target : null);
  if (!element) return;
  
  document.querySelectorAll(selector).forEach(btn => btn.classList.remove('active'));
  element.classList.add('active');
}

function renderCards() {
  const container = document.getElementById('resource-grid');
  const countBadge = document.getElementById('resource-count');
  const searchInput = document.getElementById('searchInput');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  if (!container) return;
  container.innerHTML = '';

  const filtered = allResources.filter(item => {
    const matchesClass = currentClass === 'ALL' || item.class === currentClass;
    const matchesCat = currentCategory === 'ALL' || item.category === currentCategory;
    
    const titleMatch = (item.title || '').toLowerCase().includes(query);
    const descMatch = (item.description || '').toLowerCase().includes(query);
    const classMatch = (item.class || '').toLowerCase().includes(query);
    const catMatch = (item.category || '').toLowerCase().includes(query);
    const matchesSearch = !query || titleMatch || descMatch || classMatch || catMatch;

    return matchesClass && matchesCat && matchesSearch;
  });

  if (countBadge) {
    countBadge.textContent = `Showing ${filtered.length} ${filtered.length === 1 ? 'Resource' : 'Resources'}`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 3.5rem 1rem;">
        <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; color: #cbd5e1; margin-bottom: 0.75rem;"></i>
        <h3 style="font-size: 1.1rem; color: #0f172a; font-weight: 700;">No resources found</h3>
        <p style="font-size: 0.9rem;">Try adjusting your search query or switching your class/category filters.</p>
      </div>`;
    return;
  }

  filtered.forEach(item => {
    const isALevel = item.class === 'S5' || item.class === 'S6';
    const classTagStyle = isALevel ? 'tag-alevel' : 'tag-olevel';
    const fileInfo = getFileTypeInfo(item);

    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div>
        <div class="card-tags">
          <span class="tag ${classTagStyle}">${item.class}</span>
          <span class="tag tag-cat">${item.category}</span>
          <span class="tag ${fileInfo.tagClass}">${fileInfo.label}</span>
        </div>
        <h3 class="card-title">${item.title}</h3>
        <p class="card-description">${item.description || ''}</p>
      </div>

      <div class="card-footer">
        <span class="file-meta">
          <i class="fa-regular ${fileInfo.icon}"></i> ${fileInfo.label}
        </span>
        <a href="${item.fileUrl || item.downloadUrl || '#'}" target="_blank" class="download-btn" ${item.fileUrl ? 'download' : ''}>
          <i class="fa-solid fa-download"></i> Download
        </a>
      </div>
    `;
    container.appendChild(card);
  });
}

/* ==========================================================================
   AUTHENTICATION & SESSION MANAGEMENT
   ========================================================================== */
function handleLogin(event) {
  event.preventDefault();
  
  // 1. Trim whitespace and convert username to lowercase for matching
  const usernameInput = document.getElementById('loginUsername').value.trim().toLowerCase();
  const passwordInput = document.getElementById('loginPassword').value.trim();
  const errorElement = document.getElementById('loginError');

  // Retrieve saved students from localStorage
  const students = JSON.parse(localStorage.getItem('students')) || [];

  // 2. Check for Teacher / Admin hardcoded credentials first
  if (usernameInput === 'admin' && passwordInput === 'admin123') {
    // Handle teacher login...
    return;
  }

  // 3. Find matching student record (case-insensitive username check)
  const studentMatch = students.find(s => 
    s.username.toLowerCase() === usernameInput && s.password === passwordInput
  );

  if (studentMatch) {
    errorElement.style.display = 'none';
    
    // Save current session
    localStorage.setItem('currentUser', JSON.stringify({
      name: studentMatch.fullName,
      role: 'student',
      studentClass: studentMatch.class
    }));

    // Update UI & show dashboard
    showDashboard(studentMatch);
  } else {
    // Show error message
    errorElement.innerText = "Invalid username or password!";
    errorElement.style.display = 'block';
  }
}
function handleLogout() {
  localStorage.removeItem('portal_session');
  currentUser = null;
  updatePortalUI();
}

/* ==========================================================================
   STUDENT REGISTRATION & IMPORT FUNCTIONS
   ========================================================================== */
function handleRegisterStudent(e) {
  e.preventDefault();
  if (!currentUser || currentUser.role !== 'Teacher') return;

  const fullName = document.getElementById('regFullName').value.trim();
  const studentClass = document.getElementById('regClass').value;
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value.trim();

  const users = JSON.parse(localStorage.getItem('portal_users')) || [];

  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    alert('Username already exists! Please choose another.');
    return;
  }

  const newStudent = {
    fullName,
    class: studentClass,
    username,
    password,
    role: "Student"
  };

  users.push(newStudent);
  localStorage.setItem('portal_users', JSON.stringify(users));

  alert(`Student ${fullName} registered for ${studentClass}!`);
  e.target.reset();
}

function generateStrongPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let pwd = "";
  for (let i = 0; i < 8; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}

function handleBulkImport() {
  if (!currentUser || currentUser.role !== 'Teacher') return;

  const fileInput = document.getElementById('bulkStudentFile');
  const targetClass = document.getElementById('bulkClass').value;

  if (!fileInput.files.length) {
    alert('Please select an Excel or CSV file to import.');
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = function(e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    
    const jsonRows = XLSX.utils.sheet_to_json(firstSheet, { 
      header: 1, 
      defval: "", 
      blankrows: false 
    });

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

      if (index === 0 && (
        rawName.toLowerCase().includes('name') || 
        rawName.toLowerCase().includes('student') || 
        rawName.toLowerCase().includes('s/n') || 
        rawName.toLowerCase().includes('no.')
      )) {
        return;
      }

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

        const generatedPassword = generateStrongPassword();

        users.push({
          fullName: rawName,
          class: targetClass,
          username: finalUsername,
          password: generatedPassword,
          role: "Student"
        });

        addedCount++;
      }
    });

    localStorage.setItem('portal_users', JSON.stringify(users));
    alert(`Successfully imported ${addedCount} student account(s) for ${targetClass}! Click "Download CSV" to retrieve credentials.`);
    fileInput.value = '';
  };

  reader.readAsArrayBuffer(file);
}

function downloadStudentCSV() {
  const users = JSON.parse(localStorage.getItem('portal_users')) || [];
  const students = users.filter(u => u.role === 'Student');

  if (students.length === 0) {
    alert('No registered students to export.');
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
}

/* ==========================================================================
   STUDENT MANAGEMENT MODAL & EDIT CONTROLS
   ========================================================================== */
function openStudentModal() {
  const modal = document.getElementById('studentModal');
  if (modal) modal.style.display = 'flex';
  editingUsername = null;
  renderStudentModalTable();
}

function closeStudentModal() {
  const modal = document.getElementById('studentModal');
  if (modal) modal.style.display = 'none';
  editingUsername = null;
}

function renderStudentModalTable() {
  const tbody = document.getElementById('studentModalTableBody');
  if (!tbody) return;

  const searchInput = document.getElementById('studentSearchInput');
  const searchFilter = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const users = JSON.parse(localStorage.getItem('portal_users')) || [];
  const students = users.filter(u => u.role === 'Student' && (
    u.fullName.toLowerCase().includes(searchFilter) ||
    u.class.toLowerCase().includes(searchFilter) ||
    u.username.toLowerCase().includes(searchFilter)
  ));

  if (students.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b;">No student accounts found.</td></tr>';
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
}

function enableStudentEdit(username) {
  editingUsername = username;
  renderStudentModalTable();
}

function cancelStudentEdit() {
  editingUsername = null;
  renderStudentModalTable();
}

function saveStudentEdit(oldUsername) {
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
    alert('The new username is already taken. Please enter a unique username.');
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
}

function deleteStudent(username) {
  if (!confirm(`Are you sure you want to delete the account for "${username}"?`)) return;

  let users = JSON.parse(localStorage.getItem('portal_users')) || [];
  users = users.filter(u => u.username !== username);

  localStorage.setItem('portal_users', JSON.stringify(users));
  renderStudentModalTable();
}

function deleteAllStudents() {
  let users = JSON.parse(localStorage.getItem('portal_users')) || [];
  const studentCount = users.filter(u => u.role === 'Student').length;

  if (studentCount === 0) {
    alert('No registered student records to delete.');
    return;
  }

  if (confirm(`WARNING: Are you sure you want to delete ALL ${studentCount} registered student account(s)? This action cannot be undone.`)) {
    users = users.filter(u => u.role !== 'Student');
    localStorage.setItem('portal_users', JSON.stringify(users));
    renderStudentModalTable();
    alert('All student accounts have been successfully deleted.');
  }
}

/* ==========================================================================
   ASSESSMENTS & SUBMISSIONS MANAGEMENT
   ========================================================================== */
function handleCreateAssessment(e) {
  e.preventDefault();
  if (!currentUser || currentUser.role !== 'Teacher') return;

  const title = document.getElementById('testTitle').value;
  const targetClass = document.getElementById('targetClass').value;
  const description = document.getElementById('testDesc').value;
  const deadline = document.getElementById('testDeadline').value;
  const fileInput = document.getElementById('testFile');
  const fileName = fileInput.files[0] ? fileInput.files[0].name : "assessment.pdf";

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

  alert('Assessment successfully created!');
  document.getElementById('assessmentForm').reset();
  renderAssessments();
}

function handleStudentSubmission(testId, testTitle, fileInput) {
  if (!fileInput.files.length) return;
  
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

  alert(`Submitted work for: ${testTitle}`);
  renderAssessments();
  if (currentUser.role === 'Teacher') renderSubmissions();
}

/* ==========================================================================
   UI RENDERING FUNCTIONS FOR PORTAL & SUBMISSIONS
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

  const userNameDisplay = document.getElementById('userNameDisplay');
  if (userNameDisplay) userNameDisplay.textContent = currentUser.fullName;

  const roleBadge = document.getElementById('userRoleDisplay');
  if (roleBadge) {
    roleBadge.textContent = currentUser.role;
    roleBadge.className = `role-badge role-${currentUser.role.toLowerCase()}`;
  }
  
  const userClassDisplay = document.getElementById('userClassDisplay');
  if (userClassDisplay) {
    userClassDisplay.textContent = currentUser.class ? `(${currentUser.class})` : '';
  }

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
    container.innerHTML = `<p style="color:#64748b;">No active assessments found ${currentUser && currentUser.role === 'Student' ? 'for ' + currentUser.class : ''}.</p>`;
    return;
  }

  container.innerHTML = assessments.map(a => {
    const deadlineDate = new Date(a.deadline);
    const isExpired = now > deadlineDate;
    const studentSub = (currentUser && currentUser.role === 'Student') ? submissions.find(s => s.testId === a.id && s.studentName === currentUser.fullName) : null;

    return `
      <div class="test-card">
        <div class="test-header">
          <span class="test-title">${a.title} <small style="color:#64748b;">(${a.class})</small></span>
          <span class="deadline-badge ${isExpired ? 'deadline-expired' : 'deadline-active'}">
            ${isExpired ? 'Expired' : 'Active until: ' + deadlineDate.toLocaleString()}
          </span>
        </div>
        <p style="font-size:0.85rem; color:#475569; margin:0.5rem 0;">${a.description || 'No description provided.'}</p>
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
                  <input type="file" style="display:none;" onchange="handleStudentSubmission(${a.id}, '${a.title.replace(/'/g, "\\'")}', this)">
                </label>
              `}
            `}
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderSubmissions() {
  const container = document.getElementById('submissionsContainer');
  if (!container) return;

  const submissions = JSON.parse(localStorage.getItem('portal_submissions')) || [];

  if (submissions.length === 0) {
    container.innerHTML = '<p style="color:#64748b; font-size:0.85rem;">No student work submitted yet.</p>';
    return;
  }

  container.innerHTML = submissions.map(sub => `
    <div class="sub-item">
      <div>
        <strong>${sub.studentName}</strong> <small>(${sub.studentClass})</small><br>
        <span style="color:#64748b;">${sub.testTitle}</span>
      </div>
      <a href="${sub.fileUrl}" download class="btn-action btn-download" style="padding:0.3rem 0.6rem; font-size:0.75rem;">
        <i class="fa-solid fa-download"></i> Get File
      </a>
    </div>
  `).join('');
}
