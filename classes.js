/* ==========================================================================
   SAMCAM SOLUTIONS - LIVE CLASSES & GOOGLE MEET ENGINE (ROLE & CLASS BASED)
   ========================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyBcZxH7TTpejrFmF4ji0DS66xVfDVhZEfw",
  authDomain: "samcam-system.firebaseapp.com",
  projectId: "samcam-system",
  storageBucket: "samcam-system.firebasestorage.app",
  messagingSenderId: "74940789582",
  appId: "1:74940789582:web:f159688165a194e841241f",
  measurementId: "G-L2H4V8Y050"
};

// Initialize Firebase & Firestore
if (typeof firebase !== "undefined" && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = typeof firebase !== "undefined" ? firebase.firestore() : null;

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
  initTheme();
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
   DYNAMIC STYLING INJECTION FOR BADGES & TABS
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
  // If a user object is passed directly (e.g., from an event), use it
  if (userParam) return userParam;

  // Otherwise, retrieve from localStorage (Primary) or sessionStorage
  const sessionData = localStorage.getItem('portal_session') || sessionStorage.getItem('portal_session');
  
  if (sessionData) {
    try {
      return JSON.parse(sessionData);
    } catch (e) {
      console.error("Error parsing portal_session:", e);
    }
  }
  return null;
}

function syncLiveClassSession(user) {
  // 1. Get the session using the corrected helper
  const session = user || getCurrentUserSession();
  console.log("Synced Live Class Session:", session);

  // If no session exists, we should probably stop here or redirect to login
  if (!session) {
    console.warn("No active session found.");
    return;
  }

  // 2. Robust check for teacher permissions
  const roleStr = (session.role || '').toLowerCase();
  const isTeacherOrAdmin = roleStr.includes('teacher') || 
                           roleStr.includes('admin') || 
                           roleStr.includes('instructor') ||
                           roleStr.includes('staff');

  // 3. Update UI elements based on role
  document.querySelectorAll('.teacher-only').forEach(el => {
    el.style.display = isTeacherOrAdmin ? 'inline-flex' : 'none';
  });

  const subtitleEl = document.getElementById('pageSubtitle');
  if (subtitleEl) {
    if (isTeacherOrAdmin) {
      subtitleEl.textContent = "Schedule interactive video lessons, automatically generate Meet links, and manage live sessions.";
    } else {
      const studentClass = (session.userClass && session.userClass !== 'ALL') ? session.userClass : 'your class';
      subtitleEl.textContent = `View upcoming live video lessons and join scheduled sessions for ${studentClass}.`;
    }
  }

  // 4. Call the robust profile updater (from your existing profile logic)
  if (typeof updateNavProfile === 'function') {
    updateNavProfile(session);
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

  // Inject Tab bar dynamically above grid if not already present
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

  // Filter by user class level role
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

  // Separate into Upcoming/Live vs Past Sessions
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

  // Sort: Active live sessions first, then chronological
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
    const formattedDate = new Date(item.startTime).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const isLive = isClassLive(item.startTime, item.endTime);

    const card = document.createElement('div');
    card.className = 'class-card';
    if (isLive) card.style.borderColor = '#22c55e';

    // Teacher quick action controls (Edit / Delete)
    let teacherActionsHtml = '';
    if (isTeacherOrAdmin) {
      teacherActionsHtml = `
        <div class="teacher-action-menu">
          <button class="btn-icon-only" onclick="openEditModal('${item.id}')" title="Edit / Add Recordings" style="background: var(--bg-card, #fff); border: 1px solid var(--border-color); padding: 6px 10px; border-radius: 6px; cursor: pointer;"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="btn-icon-only" onclick="deleteClassSession('${item.id}')" title="Delete Session" style="background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; padding: 6px 10px; border-radius: 6px; cursor: pointer;"><i class="fa-solid fa-trash"></i></button>
        </div>
      `;
    }

    // Resource links snippet (Recordings / Handouts)
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

    // Generate .ics calendar download data URL
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
        <p class="class-desc">${item.description || 'No instructions provided.'}</p>
        <div class="class-details">
          <span><i class="fa-solid fa-user-tie"></i> Instructor: <strong>${item.instructorName}</strong></span>
          <span><i class="fa-regular fa-clock"></i> ${formattedDate}</span>
        </div>
        ${resourcesHtml}
      </div>
      <div class="class-footer" style="display: flex; gap: 8px; align-items: center; justify-content: space-between; margin-top: 15px;">
        <a href="${icsDataUrl}" download="${item.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics" class="resource-chip" title="Add to Google Calendar / Outlook"><i class="fa-solid fa-calendar-plus"></i> Add to Calendar</a>
        <a href="${item.meetUrl}" target="_blank" class="meet-btn">
          <i class="fa-solid fa-video"></i> ${isLive ? 'Join Active Meet' : 'Join Meet'}
        </a>
      </div>
    `;
    container.appendChild(card);
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

  // Add recording fields container dynamically if missing in modal form
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
  // Insert before modal footer
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
    // Updating existing class in Firestore without regenerating Meet link unless desired
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

  // Creating new class with Google Calendar API Meet Link generation
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
      // Real-time listener will automatically refresh the grid
    }).catch(err => {
      console.error("Error deleting session:", err);
      alert("Failed to delete session: " + err.message);
    });
  }
}

/* ==========================================================================
   THEME UTILITIES
   ========================================================================== */
function initTheme() {
  const savedTheme = localStorage.getItem('portal_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('portal_theme', next);
    });
  }
}

/* ==========================================================================
   USER PROFILE & ATTENDANCE LOG FEATURES
   ========================================================================== */

function updateNavProfile(session) {
  if (!session) return;

  const nameEl = document.getElementById('navFullName');
  const userEl = document.getElementById('navUsername');
  const picEl = document.getElementById('navProfilePic');
  
  // 1. Get Full Name from the normalized session properties
  const displayName = session.name || session.fullName || 'User';
  
  // 2. Get Username directly from the stored session property
  const usernameVal = session.username || 'user';

  // Update Text Content
  if (nameEl) nameEl.textContent = displayName;
  
  if (userEl) {
    if (session.role) {
      // Capitalize the first letter (e.g., "teacher" -> "Teacher")
      const rawRole = session.role.trim();
      const capitalizedRole = rawRole.charAt(0).toUpperCase() + rawRole.slice(1).toLowerCase();
      
      // Use innerHTML to style the role in dark blue (e.g., #1e40af or a custom CSS variable)
      userEl.innerHTML = `@${usernameVal} • <span style="color: #1e40af; font-weight: 600;">${capitalizedRole}</span>`;
    } else {
      userEl.textContent = '@' + usernameVal;
    }
  }
  
  // 3. Resolve Profile Picture instantly with local fallback
  if (picEl) {
    const userAvatar = session.profilePic || session.photoUrl || session.avatar;
    
    if (userAvatar && userAvatar.trim() !== "") {
      picEl.src = userAvatar;
      picEl.onerror = () => {
        picEl.src = 'images/default-avatar.png';
      };
    } else {
      picEl.src = 'images/default-avatar.png';
    }
  }
}

// 2. Attendance Modal Controls
function openAttendanceModal() {
  const modal = document.getElementById('attendanceModal');
  if (modal) {
    modal.style.display = 'flex';
    fetchAttendanceLogs(); // Load data when opening
  }
}

function closeAttendanceModal(e) {
  if (e.target.id === 'attendanceModal') closeAttendanceModalDirect();
}

function closeAttendanceModalDirect() {
  const modal = document.getElementById('attendanceModal');
  if (modal) modal.style.display = 'none';
}

// 3. Fetch and Render Attendance Logs
function fetchAttendanceLogs() {
  const tbody = document.getElementById('attendanceTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Loading logs...</td></tr>';

  db.collection("attendance_logs")
    .orderBy("timestamp", "desc")
    .limit(50)
    .onSnapshot((snapshot) => {
      tbody.innerHTML = '';
      snapshot.forEach((doc) => {
        const log = doc.data();
        const date = log.timestamp?.toDate().toLocaleString() || 'N/A';
        const row = `<tr>
          <td style="padding: 10px; border-bottom: 1px solid var(--border-color);">${date}</td>
          <td style="padding: 10px; border-bottom: 1px solid var(--border-color);">${log.userName || 'Unknown'}</td>
          <td style="padding: 10px; border-bottom: 1px solid var(--border-color);">${log.userClass || 'N/A'}</td>
          <td style="padding: 10px; border-bottom: 1px solid var(--border-color);">${log.action || 'Joined Session'}</td>
        </tr>`;
        tbody.innerHTML += row;
      });
    });
}

// 4. Export Attendance to CSV
function exportAttendanceCSV() {
  db.collection("attendance_logs").get().then((snapshot) => {
    let csv = "Timestamp,User Name,Class,Action\n";
    snapshot.forEach((doc) => {
      const log = doc.data();
      csv += `"${log.timestamp?.toDate().toLocaleString()}","${log.userName}","${log.userClass}","${log.action}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'meeting_attendance_log.csv');
    a.click();
  });
}

function toggleMobileMenu() {
  const wrapper = document.getElementById('navCollapseWrapper');
  const toggleBtn = document.getElementById('mobileMenuToggle');
  if (!wrapper) return;

  wrapper.classList.toggle('show');
  
  // Switch hamburger icon to an 'X' (close) icon and back
  const icon = toggleBtn.querySelector('i');
  if (wrapper.classList.contains('show')) {
    icon.className = 'fa-solid fa-xmark';
  } else {
    icon.className = 'fa-solid fa-bars';
  }
}

