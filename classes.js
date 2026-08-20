/* ==========================================================================
   SAMCAM SOLUTIONS - LIVE CLASSES & GOOGLE MEET ENGINE (ROLE & CLASS BASED)
   ========================================================================== */

/* ==========================================================================
   SAMCAM SOLUTIONS - LIVE CLASSES & GOOGLE MEET ENGINE (ROLE & CLASS BASED)
   ========================================================================== */

// Use the global db instance initialized in firebase-config.js
const db = window.db || (typeof firebase !== "undefined" ? firebase.firestore() : null);

// Google API Client configuration
const CLIENT_ID = '74940789582-42d2vlki0lr8bj734afchl8b42jo3b98.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

let tokenClient = null;
let allClasses = [];
let currentFilterClass = 'ALL';
let currentTab = 'upcoming'; // 'upcoming' or 'past'
let editingClassId = null; // Track if we are editing an existing class

window.addEventListener('portalSessionChanged', (e) => {
  syncLiveClassSession(e.detail);
});

document.addEventListener("DOMContentLoaded", () => {
  syncLiveClassSession();
  fetchClassesFromFirestore();
  injectExtraStyles();
  
  // Safely initialize Google Identity Services token client
  const checkGoogleLoaded = setInterval(() => {
    if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', 
      });
      clearInterval(checkGoogleLoaded);
    }
  }, 500);
});

/* ==========================================================================
   DYNAMIC STYLING INJECTION FOR BADGES, TABS & COUNTDOWNS
   ========================================================================== */
function injectExtraStyles() {
  if (document.getElementById('samcamClassesExtraStyles')) return;
  const style = document.createElement('style');
  style.id = 'samcamClassesExtraStyles';
  style.innerHTML = `
    @keyframes livePulse {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(1.05); }
      100% { opacity: 1; transform: scale(1); }
    }
    .badge-live-pulse {
      background: #fee2e2;
      color: #dc2626;
      border: 1px solid #fecaca;
      font-weight: 700;
      animation: livePulse 1.5s infinite ease-in-out;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .live-countdown {
      color: var(--warning-color, #eab308);
      font-size: 0.85rem;
      font-weight: 700;
      margin-top: 8px;
      font-family: monospace;
      background: var(--bg-chip, #f1f5f9);
      padding: 4px 8px;
      border-radius: 4px;
      display: inline-block;
    }
    .tab-toolbar {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      border-bottom: 1px solid var(--border-color, #e2e8f0);
      padding-bottom: 10px;
    }
    .tab-btn {
      background: transparent;
      border: none;
      padding: 8px 16px;
      font-weight: 600;
      cursor: pointer;
      color: var(--text-muted, #64748b);
      border-radius: 6px;
      transition: all 0.2s;
    }
    .tab-btn.active {
      background: var(--primary-color, #2563eb);
      color: #fff;
    }
    .teacher-action-menu {
      position: absolute;
      top: 15px;
      right: 15px;
      display: flex;
      gap: 6px;
    }
    .class-card {
      position: relative;
    }
    .class-desc {
      background: var(--bg-card-sub, rgba(0,0,0,0.02));
      border-left: 3px solid var(--primary-color, #2563eb);
      padding: 8px 12px;
      margin: 10px 0;
      font-size: 0.92rem;
      border-radius: 0 4px 4px 0;
    }
    .resource-links-box {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px dashed var(--border-color, #cbd5e1);
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .resource-chip {
      font-size: 0.8rem;
      padding: 4px 10px;
      background: var(--bg-chip, #f1f5f9);
      color: var(--text-main, #334155);
      border-radius: 4px;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border: 1px solid var(--border-color, #e2e8f0);
    }
    .resource-chip:hover {
      background: var(--primary-color, #2563eb);
      color: #fff;
    }
  `;
  document.head.appendChild(style);
}

/* ==========================================================================
   SESSION MANAGEMENT & ROLE DETECTION
   ========================================================================== */
function getCurrentUserSession(userParam) {
  let activeUser = userParam || window.currentUser;

  if (!activeUser) {
    const sessionData = localStorage.getItem('portal_session') || sessionStorage.getItem('portal_session');
    if (sessionData) {
      try {
        activeUser = JSON.parse(sessionData);
      } catch (e) {
        console.error("Error parsing portal_session from storage:", e);
        activeUser = null;
      }
    }
  }

  let role = '';
  let name = '';
  let userClass = 'ALL';

  if (activeUser && typeof activeUser === 'object') {
    role = activeUser.role || activeUser.userType || activeUser.type || activeUser.accessLevel || '';
    name = activeUser.fullName || activeUser.name || activeUser.username || '';
    userClass = activeUser.class || activeUser.userClass || 'ALL';
  }

  return {
    role: (role || '').trim().toLowerCase(),
    name: (name || '').trim(),
    userClass: (userClass || 'ALL').trim()
  };
}

/* ==========================================================================
   PROFILE UI UPDATER (FIRESTORE & SESSION SYNC)
   ========================================================================== */
window.updateProfileUIImages = function(user) {
  const activeUser = user || getCurrentUserSession();
  const defaultAvatar = "images/default-avatar.png";
  
  // Look for stored session details (where Firebase user document or profile link is cached)
  const storedSession = JSON.parse(localStorage.getItem('portal_session') || '{}');
  
  // Check multiple possible keys where the storage URL might be saved
  const userAvatar = activeUser.profilePic || activeUser.photoURL || activeUser.avatarUrl || 
                     storedSession.profilePic || storedSession.photoURL || storedSession.avatarUrl || 
                     defaultAvatar;

  const fullName = activeUser.name || storedSession.fullName || storedSession.name || "User";
  const username = storedSession.username || storedSession.handle || "user";

  const bannerPic = document.getElementById('bannerProfilePic');
  const nameDisplay = document.getElementById('userNameDisplay');
  const usernameDisplay = document.getElementById('profileUsernameDisplay');

  if (bannerPic) {
    // Directly apply the Firebase Storage URL link to the image source
    bannerPic.src = userAvatar;
    
    // Add an error fallback just in case an external storage link fails to load
    bannerPic.onerror = function() {
      this.src = defaultAvatar;
    };
  }

  if (nameDisplay) nameDisplay.textContent = fullName;
  if (usernameDisplay) usernameDisplay.textContent = "@" + username;
};

function syncLiveClassSession(user) {
  const session = getCurrentUserSession(user);
  
  // Automatically update navbar elements upon session sync
  window.updateProfileUIImages(session);

  const combinedCheck = `${session.role} ${session.name} ${session.userClass}`.toLowerCase();
  const isTeacherOrAdmin = combinedCheck.includes('teacher') || 
                           combinedCheck.includes('admin') || 
                           combinedCheck.includes('instructor') ||
                           combinedCheck.includes('staff') ||
                           session.role === 'teacher';

  document.querySelectorAll('.teacher-only').forEach(el => {
    el.style.display = isTeacherOrAdmin ? 'inline-flex' : 'none';
  });

  const subtitleEl = document.getElementById('pageSubtitle');
  if (subtitleEl) {
    if (isTeacherOrAdmin) {
      subtitleEl.textContent = "Schedule interactive video lessons, automatically generate Meet links, and manage live sessions.";
    } else {
      const studentClass = session.userClass !== 'ALL' ? session.userClass : 'your class';
      subtitleEl.textContent = `View upcoming live video lessons and join scheduled sessions for ${studentClass}.`;
    }
  }

  updateClassFilterInterface(session, isTeacherOrAdmin);
  renderClassesGrid();
}

function updateClassFilterInterface(session, isTeacherOrAdmin) {
  const filterGroup = document.getElementById('classFilterGroup');
  if (!filterGroup) return;
  filterGroup.style.display = isTeacherOrAdmin ? 'flex' : 'none';
}

/* ==========================================================================
   FIRESTORE DATA RETRIEVAL & RENDERING
   ========================================================================== */
function fetchClassesFromFirestore() {
  if (!db) return;
  db.collection("live_classes").orderBy("startTime", "asc").onSnapshot((snapshot) => {
    allClasses = [];
    snapshot.forEach((doc) => {
      allClasses.push({ id: doc.id, ...doc.data() });
    });
    renderClassesGrid();
  }, (error) => {
    console.error("Error fetching live classes: ", error);
  });
}

function filterClass(cls, event) {
  const session = getCurrentUserSession();
  const combinedCheck = `${session.role} ${session.name} ${session.userClass}`.toLowerCase();
  const isTeacherOrAdmin = combinedCheck.includes('teacher') || combinedCheck.includes('admin') || combinedCheck.includes('instructor') || combinedCheck.includes('staff') || session.role === 'teacher';

  if (!isTeacherOrAdmin) return;

  currentFilterClass = cls;
  document.querySelectorAll('#classFilterGroup .segment-btn').forEach(btn => btn.classList.remove('active'));
  if (event) event.currentTarget.classList.add('active');
  renderClassesGrid();
}

function switchClassTab(tabName, event) {
  currentTab = tabName;
  document.querySelectorAll('.tab-toolbar .tab-btn').forEach(btn => btn.classList.remove('active'));
  if (event) event.currentTarget.classList.add('active');
  renderClassesGrid();
}

function isClassLive(startTime, endTime) {
  const now = new Date();
  return now >= new Date(startTime) && now <= new Date(endTime);
}

function renderClassesGrid() {
  const container = document.getElementById('classes-grid');
  if (!container) return;

  let tabToolbar = document.getElementById('classesTabToolbar');
  if (!tabToolbar) {
    tabToolbar = document.createElement('div');
    tabToolbar.id = 'classesTabToolbar';
    tabToolbar.className = 'tab-toolbar';
    tabToolbar.innerHTML = `
      <button class="tab-btn active" onclick="switchClassTab('upcoming', event)"><i class="fa-solid fa-calendar-days"></i> Upcoming & Live Classes</button>
      <button class="tab-btn" onclick="switchClassTab('past', event)"><i class="fa-solid fa-box-archive"></i> Past Sessions & Recordings</button>
    `;
    container.parentNode.insertBefore(tabToolbar, container);
  }

  container.innerHTML = '';

  const session = getCurrentUserSession();
  const combinedCheck = `${session.role} ${session.name} ${session.userClass}`.toLowerCase();
  const isTeacherOrAdmin = combinedCheck.includes('teacher') || combinedCheck.includes('admin') || combinedCheck.includes('instructor') || combinedCheck.includes('staff') || session.role === 'teacher';

  let filtered = allClasses;

  if (!isTeacherOrAdmin) {
    const studentClass = session.userClass;
    filtered = allClasses.filter(item => {
      const itemCls = (item.classLevel || '').trim().toLowerCase();
      return itemCls === 'general' || itemCls === studentClass.toLowerCase();
    });
  } else {
    filtered = allClasses.filter(item => currentFilterClass === 'ALL' || item.classLevel === currentFilterClass);
  }

  const now = new Date();

  filtered = filtered.filter(item => {
    const isLive = isClassLive(item.startTime, item.endTime);
    const isFuture = new Date(item.startTime) > now;
    const isPast = new Date(item.endTime) < now && !isLive;

    if (currentTab === 'upcoming') {
      return isLive || isFuture;
    } else {
      return isPast;
    }
  });

  filtered.sort((a, b) => {
    const aLive = isClassLive(a.startTime, a.endTime);
    const bLive = isClassLive(b.startTime, b.endTime);
    if (aLive && !bLive) return -1;
    if (!aLive && bLive) return 1;
    return new Date(a.startTime) - new Date(b.startTime);
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
        <i class="fa-solid fa-calendar-xmark" style="font-size: 2.5rem; margin-bottom: 1rem;"></i>
        <h3>No ${currentTab === 'upcoming' ? 'upcoming or live' : 'past'} classes found</h3>
        <p>${isTeacherOrAdmin ? 'Click "Schedule New Class" above to set up a live session.' : 'No sessions currently available in this view.'}</p>
      </div>
    `;
    return;
  }

  filtered.forEach(item => {
    const startDate = new Date(item.startTime);
    const formattedDate = startDate.toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const isLive = isClassLive(item.startTime, item.endTime);
    const timeDiffHours = (startDate - now) / (1000 * 60 * 60);
    const showCountdown = !isLive && timeDiffHours > 0 && timeDiffHours <= 24;

    const card = document.createElement('div');
    card.className = 'class-card';
    if (isLive) card.style.borderColor = '#22c55e';

    let teacherActionsHtml = '';
    if (isTeacherOrAdmin) {
      teacherActionsHtml = `
        <div class="teacher-action-menu">
          <button class="btn-icon-only" onclick="openEditModal('${item.id}')" title="Edit / Add Recordings" style="background: var(--bg-card, #fff); border: 1px solid var(--border-color); padding: 6px 10px; border-radius: 6px; cursor: pointer;"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="btn-icon-only" onclick="deleteClassSession('${item.id}')" title="Delete Session" style="background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; padding: 6px 10px; border-radius: 6px; cursor: pointer;"><i class="fa-solid fa-trash"></i></button>
        </div>
      `;
    }

    let resourcesHtml = '';
    if (item.recordingUrl || item.handoutUrl) {
      resourcesHtml = `<div class="resource-links-box">`;
      if (item.recordingUrl) {
        resourcesHtml += `<a href="${item.recordingUrl}" target="_blank" class="resource-chip"><i class="fa-solid fa-video"></i> Watch Recording</a>`;
      }
      if (item.handoutUrl) {
        resourcesHtml += `<a href="${item.handoutUrl}" target="_blank" class="resource-chip"><i class="fa-solid fa-file-pdf"></i> Lesson Notes / PDF</a>`;
      }
      resourcesHtml += `</div>`;
    }

    const icsDataUrl = generateIcsDataUrl(item);

    card.innerHTML = `
      ${teacherActionsHtml}
      <div>
        <div class="class-meta">
          <span class="tag">${item.classLevel}</span>
          ${isLive ? '<span class="tag badge-live-pulse"><i class="fa-solid fa-circle" style="font-size:8px;"></i> LIVE NOW</span>' : '<span class="tag" style="background: #dcfce7; color: #166534;">Scheduled</span>'}
          ${item.admissionType === 'restricted' ? '<span class="tag" style="background: #fee2e2; color: #991b1b;">Restricted Access</span>' : ''}
        </div>
        <h3 class="class-title">${item.title}</h3>
        <div class="class-desc"><strong>Pre-Class Brief:</strong> ${item.description || 'No specific instructions provided.'}</div>
        ${showCountdown ? `<div class="live-countdown" data-start="${item.startTime}"><i class="fa-solid fa-stopwatch"></i> Starts in: calculating...</div>` : ''}
        <div class="class-details" style="margin-top: 10px;">
          <span><i class="fa-solid fa-user-tie"></i> Instructor: <strong>${item.instructorName}</strong></span>
          <span><i class="fa-regular fa-clock"></i> ${formattedDate}</span>
        </div>
        ${resourcesHtml}
      </div>
      <div class="class-footer" style="display: flex; gap: 8px; align-items: center; justify-content: space-between; margin-top: 15px;">
        <a href="${icsDataUrl}" download="${item.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics" class="resource-chip" title="Add to Google Calendar / Outlook"><i class="fa-solid fa-calendar-plus"></i> Add to Calendar</a>
        <a href="${item.meetUrl}" target="_blank" class="meet-btn" onclick="logAttendance('${item.id}')">
          <i class="fa-solid fa-video"></i> ${isLive ? 'Join Active Meet' : 'Join Meet'}
        </a>
      </div>
    `;
    container.appendChild(card);
  });

  startCountdownInterval();
}

/* ==========================================================================
   AUTOMATION: LIVE COUNTDOWN & ATTENDANCE LOGGING
   ========================================================================== */
function startCountdownInterval() {
  if (window.samcamCountdownTimer) clearInterval(window.samcamCountdownTimer);
  window.samcamCountdownTimer = setInterval(() => {
    document.querySelectorAll('.live-countdown').forEach(el => {
      const startTime = new Date(el.getAttribute('data-start')).getTime();
      const now = new Date().getTime();
      const diff = startTime - now;

      if (diff <= 0) {
        el.innerHTML = "<span style='color: #22c55e;'>Session starting right now!</span>";
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        el.innerHTML = `<i class="fa-solid fa-stopwatch"></i> Starts in: ${hours}h ${minutes}m ${seconds}s`;
      }
    });
  }, 1000);
}

function logAttendance(classId) {
  const session = getCurrentUserSession();
  if (!db || !session.name) return;

  db.collection("live_classes").doc(classId).collection("attendance").add({
    studentName: session.name,
    studentRole: session.role,
    studentClass: session.userClass,
    joinedAt: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(err => {
    console.error("Error writing attendance log:", err);
  });
}

/* ==========================================================================
   CALENDAR .ICS GENERATOR
   ========================================================================== */
function generateIcsDataUrl(item) {
  const formatDateIcs = (isoStr) => {
    return new Date(isoStr).toISOString().replace(/-|:|\.\d+/g, '');
  };

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Samcam Solutions//ICT Hub Live Classes//EN',
    'BEGIN:VEVENT',
    `UID:samcam-class-${item.id}@samcam.com`,
    `DTSTAMP:${formatDateIcs(new Date().toISOString())}`,
    `DTSTART:${formatDateIcs(item.startTime)}`,
    `DTEND:${formatDateIcs(item.endTime || new Date(new Date(item.startTime).getTime() + 3600000).toISOString())}`,
    `SUMMARY:[${item.classLevel}] ${item.title} - Samcam ICT Hub`,
    `DESCRIPTION:${(item.description || '').replace(/\n/g, '\\n')}\\n\\nInstructor: ${item.instructorName}\\nJoin Link: ${item.meetUrl}`,
    `URL:${item.meetUrl}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  return 'data:text/calendar;charset=utf8,' + encodeURIComponent(icsContent);
}

/* ==========================================================================
   MODAL CONTROLS & TEACHER EDIT / SCHEDULE WORKFLOW
   ========================================================================== */
function openScheduleModal() {
  editingClassId = null;
  const modal = document.getElementById('scheduleModal');
  if (modal) modal.style.display = 'flex';
  
  const form = document.getElementById('scheduleForm');
  if (form) form.reset();

  ensureRecordingFieldsInModal();

  const modeSelect = document.getElementById('meetingMode');
  if (modeSelect) {
    modeSelect.value = 'instant';
    toggleMeetingMode();
  }
}

function ensureRecordingFieldsInModal() {
  const form = document.getElementById('scheduleForm');
  if (!form || document.getElementById('extraResourcesSection')) return;

  const div = document.createElement('div');
  div.id = 'extraResourcesSection';
  div.innerHTML = `
    <div class="form-row" style="margin-top: 15px; border-top: 1px solid var(--border-color); padding-top: 15px;">
      <div class="form-group">
        <label>Recording Link (YouTube / Drive - Optional)</label>
        <input type="url" id="recordingUrlInput" placeholder="https://youtube.com/...">
      </div>
      <div class="form-group">
        <label>Handout / Notes PDF Link (Optional)</label>
        <input type="url" id="handoutUrlInput" placeholder="https://drive.google.com/...">
      </div>
    </div>
  `;
  const footer = form.querySelector('.modal-footer');
  form.insertBefore(div, footer);
}

function openEditModal(classId) {
  editingClassId = classId;
  const item = allClasses.find(c => c.id === classId);
  if (!item) return;

  const modal = document.getElementById('scheduleModal');
  if (modal) modal.style.display = 'flex';
  ensureRecordingFieldsInModal();

  document.getElementById('classTitle').value = item.title || '';
  document.getElementById('classLevel').value = item.classLevel || 'S1';
  document.getElementById('instructorName').value = item.instructorName || '';
  document.getElementById('classDescription').value = item.description || '';
  document.getElementById('admissionType').value = item.admissionType || 'open';
  
  const modeSelect = document.getElementById('meetingMode');
  if (modeSelect) {
    modeSelect.value = item.meetingMode || 'scheduled';
    toggleMeetingMode();
  }

  if (item.startTime) {
    document.getElementById('startTime').value = item.startTime.substring(0, 16);
  }
  if (item.endTime) {
    document.getElementById('endTime').value = item.endTime.substring(0, 16);
  }

  if (document.getElementById('recordingUrlInput')) {
    document.getElementById('recordingUrlInput').value = item.recordingUrl || '';
  }
  if (document.getElementById('handoutUrlInput')) {
    document.getElementById('handoutUrlInput').value = item.handoutUrl || '';
  }

  const submitBtn = document.getElementById('submitClassBtn');
  if (submitBtn) submitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Update Class Session`;
}

function toggleMeetingMode() {
  const modeSelect = document.getElementById('meetingMode');
  if (!modeSelect) return;
  
  const mode = modeSelect.value;
  const container = document.getElementById('dateTimeFieldsContainer');
  const startInput = document.getElementById('startTime');
  const endInput = document.getElementById('endTime');
  const submitBtn = document.getElementById('submitClassBtn');

  if (mode === 'instant') {
    if (container) container.style.display = 'none';
    if (startInput) startInput.removeAttribute('required');
    if (endInput) endInput.removeAttribute('required');
    if (submitBtn && !editingClassId) submitBtn.innerHTML = `<i class="fa-solid fa-video"></i> Create & Launch Instant Meet`;
  } else {
    if (container) container.style.display = 'flex';
    if (startInput) startInput.setAttribute('required', 'true');
    if (endInput) endInput.setAttribute('required', 'true');
    if (submitBtn && !editingClassId) submitBtn.innerHTML = `<i class="fa-solid fa-video"></i> Schedule Meet & Save`;
  }
}

function closeScheduleModal(e) {
  if (e.target.id === 'scheduleModal') closeScheduleModalDirect();
}

function closeScheduleModalDirect() {
  const modal = document.getElementById('scheduleModal');
  if (modal) modal.style.display = 'none';
  editingClassId = null;
}

/* ==========================================================================
   FIRESTORE SUBMIT / UPDATE / DELETE WORKFLOW
   ========================================================================== */
function handleScheduleSubmit(e) {
  e.preventDefault();
  
  const title = document.getElementById('classTitle').value;
  const classLevel = document.getElementById('classLevel').value;
  const instructorName = document.getElementById('instructorName').value;
  const description = document.getElementById('classDescription').value;
  const meetingMode = document.getElementById('meetingMode').value;
  const admissionType = document.getElementById('admissionType').value;
  
  const recordingUrl = document.getElementById('recordingUrlInput') ? document.getElementById('recordingUrlInput').value.trim() : '';
  const handoutUrl = document.getElementById('handoutUrlInput') ? document.getElementById('handoutUrlInput').value.trim() : '';

  let startDate, endDate;

  if (meetingMode === 'instant' && !editingClassId) {
    startDate = new Date();
    endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  } else {
    const startTimeVal = document.getElementById('startTime').value;
    const endTimeVal = document.getElementById('endTime').value;
    
    startDate = new Date(startTimeVal);
    endDate = new Date(endTimeVal);

    if (isNaN(startDate.getTime())) {
      alert("Please provide a valid Start Date & Time.");
      return;
    }

    if (isNaN(endDate.getTime()) || endDate <= startDate) {
      endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    }
  }

  const submitBtn = document.getElementById('submitClassBtn');
  
  if (editingClassId) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Updating...`;

    db.collection("live_classes").doc(editingClassId).update({
      title,
      classLevel,
      instructorName,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      description,
      admissionType,
      meetingMode,
      recordingUrl,
      handoutUrl,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
      alert("Class updated successfully!");
      closeScheduleModalDirect();
      document.getElementById('scheduleForm').reset();
    }).catch(err => {
      console.error("Error updating class:", err);
      alert("Failed to update class: " + err.message);
    }).finally(() => {
      submitBtn.disabled = false;
    });
    return;
  }

  if (!tokenClient) {
    alert("Google Identity Services is still loading or blocked. Please wait a moment and try again.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Generating Meet...`;

  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) {
      alert("Authentication failed. Unable to generate Google Meet link.");
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i class="fa-solid fa-video"></i> Create Meet & Schedule`;
      return;
    }

    try {
      const meetUrl = await createGoogleCalendarEvent(resp.access_token, {
        title, classLevel, instructorName, 
        startTime: startDate.toISOString(), 
        endTime: endDate.toISOString(), 
        description,
        admissionType
      });

      await db.collection("live_classes").add({
        title,
        classLevel,
        instructorName,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        description,
        meetUrl,
        admissionType,
        meetingMode,
        recordingUrl,
        handoutUrl,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      closeScheduleModalDirect();
      document.getElementById('scheduleForm').reset();
      
      if (meetingMode === 'instant') {
        alert("Instant meeting created successfully! Launching Google Meet...");
        window.open(meetUrl, '_blank');
      } else {
        alert("Class scheduled successfully with an automated Google Meet link!");
      }
    } catch (err) {
      console.error("Error creating calendar event:", err);
      alert("Failed to create Google Calendar event: " + err.message);
    } finally {
      submitBtn.disabled = false;
      toggleMeetingMode();
    }
  };

  tokenClient.requestAccessToken({ prompt: 'consent' });
}

async function createGoogleCalendarEvent(accessToken, classData) {
  const restrictionNote = classData.admissionType === 'restricted' 
    ? "\n\n🔒 [Access Policy: Restricted - Attendees will wait in the knocking room until admitted by the instructor]." 
    : "\n\n🔓 [Access Policy: Open entry for class participants].";

  const startIso = classData.startTime instanceof Date ? classData.startTime.toISOString() : new Date(classData.startTime).toISOString();
  const endIso = classData.endTime instanceof Date ? classData.endTime.toISOString() : new Date(classData.endTime).toISOString();

  const event = {
    'summary': `[${classData.classLevel}] ${classData.title} - Samcam ICT Hub`,
    'description': `${classData.description}${restrictionNote}\n\nInstructor: ${classData.instructorName}`,
    'start': { 'dateTime': startIso },
    'end': { 'dateTime': endIso },
    'conferenceData': {
      'createRequest': {
        'requestId': 'samcam-' + Math.random().toString(36).substring(2, 9),
        'conferenceSolutionKey': { 'type': 'hangoutsMeet' }
      }
    }
  };

  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(event)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Failed to create calendar event via API.");
  }

  const meetLink = data.hangoutLink;
  if (!meetLink) throw new Error("Google Meet link was not returned by the API.");
  return meetLink;
}

function deleteClassSession(classId) {
  if (confirm("Are you sure you want to delete this class session? This action cannot be undone.")) {
    db.collection("live_classes").doc(classId).delete().then(() => {
    }).catch(err => {
      console.error("Error deleting session:", err);
      alert("Failed to delete session: " + err.message);
    });
  }
}

async function exportAttendanceReport(classId, format) {
  const attendanceRef = db.collection("live_classes").doc(classId).collection("attendance");
  const snapshot = await attendanceRef.orderBy("joinedAt", "desc").get();
  
  if (snapshot.empty) {
    alert("No attendance data found for this session.");
    return;
  }

  const attendanceData = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      name: data.studentName || "N/A",
      role: data.studentRole || "N/A",
      class: data.studentClass || "N/A",
      time: data.joinedAt ? data.joinedAt.toDate().toLocaleString() : "N/A"
    };
  });

  if (format === 'csv') {
    // Generate CSV for Excel
    let csvContent = "data:text/csv;charset=utf-8,Name,Role,Class,Joined At\n";
    attendanceData.forEach(row => {
      csvContent += `${row.name},${row.role},${row.class},"${row.time}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendance_${classId}.csv`);
    document.body.appendChild(link);
    link.click();
  } 
  else if (format === 'pdf') {
    // Generate PDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.text("Attendance Report", 14, 15);
    doc.autoTable({
      head: [['Name', 'Role', 'Class', 'Joined At']],
      body: attendanceData.map(r => [r.name, r.role, r.class, r.time]),
      startY: 20
    });
    
    doc.save(`attendance_${classId}.pdf`);
  }
}

