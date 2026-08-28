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

// Offline Sync & Queue Constants
const OFFLINE_QUEUE_KEY = 'samcam_offline_mutation_queue';
let isOnlineStatus = navigator.onLine;

// Listen for network connectivity changes to flush queued offline actions
window.addEventListener('online', () => {
  isOnlineStatus = true;
  console.info("Network re-established. Flushing pending offline Firestore operations...");
  flushOfflineQueue();
});

window.addEventListener('offline', () => {
  isOnlineStatus = false;
  console.warn("Network connection lost. Operating in offline/fallback mode.");
});

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
  // If a user object is passed directly (e.g., from an event), normalize it and return
  if (userParam) {
    return {
      ...userParam,
      profilePic: userParam.profilePic || userParam.photoURL || userParam.avatar || userParam.image || ''
    };
  }

  // Otherwise, retrieve from localStorage (Primary) or sessionStorage
  const sessionData = localStorage.getItem('portal_session') || sessionStorage.getItem('portal_session');
  
  if (sessionData) {
    try {
      const parsed = JSON.parse(sessionData);
      // Normalize profile picture property across common naming conventions
      parsed.profilePic = parsed.profilePic || parsed.photoURL || parsed.avatar || parsed.image || '';
      return parsed;
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

  // 4. Call the robust profile updater and manually push profile picture to elements if needed
  if (typeof updateNavProfile === 'function') {
    updateNavProfile(session);
  } else {
    // Direct DOM fallback to guarantee the profile image updates instantly if IDs exist
    const profileImgElements = document.querySelectorAll('.user-profile-pic, #navProfilePic, #userAvatarImg');
    profileImgElements.forEach(img => {
      if (session.profilePic) {
        img.src = session.profilePic;
      }
    });
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
   OFFLINE STORAGE QUEUE & SYNC HELPERS
   ========================================================================== */
function queueOfflineOperation(operationType, collectionName, docId, payload) {
  try {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY)) || [];
    queue.push({
      id: 'op_' + Date.now() + Math.random().toString(36).substring(2, 7),
      type: operationType, // 'SET', 'UPDATE', 'DELETE'
      collection: collectionName,
      docId: docId,
      data: payload,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    console.info(`Operation queued successfully for offline sync [${operationType}] -> ${collectionName}/${docId}`);
  } catch (err) {
    console.error("Failed to persist offline operation queue to localStorage:", err);
  }
}

async function flushOfflineQueue() {
  if (!db || !navigator.onLine) return;
  
  let queue;
  try {
    queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY)) || [];
  } catch (e) {
    return;
  }

  if (queue.length === 0) return;

  const remainingQueue = [];
  for (const op of queue) {
    try {
      const ref = op.docId ? db.collection(op.collection).doc(op.docId) : db.collection(op.collection);
      if (op.type === 'SET') {
        await ref.set(op.data, { merge: true });
      } else if (op.type === 'UPDATE') {
        await ref.update(op.data);
      } else if (op.type === 'DELETE') {
        await ref.delete();
      }
      console.info(`Synced queued offline operation: ${op.id}`);
    } catch (err) {
      console.error(`Failed to sync queued operation ${op.id}. Retrying later.`, err);
      remainingQueue.push(op);
    }
  }

  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remainingQueue));
}

function generateIcsDataUrl(item) {
  if (!item || !item.startTime || !item.endTime) return '#';

  const formatDate = (dateStr) => {
    return new Date(dateStr).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Samcam Solutions//Live Classes Engine//EN',
    'BEGIN:VEVENT',
    `UID:samcam_live_${item.id || Date.now()}@samcamsolutions.org`,
    `DTSTAMP:${formatDate(new Date())}`,
    `DTSTART:${formatDate(item.startTime)}`,
    `DTEND:${formatDate(item.endTime)}`,
    `SUMMARY:${item.title || 'Virtual ICT Lesson'}`,
    `DESCRIPTION:${(item.description || '').replace(/\n/g, '\\n')}\\n\\nJoin Meet: ${item.meetUrl || ''}`,
    `LOCATION:${item.meetUrl || 'Google Meet'}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  const icsFileContent = icsLines.join('\r\n');
  const blob = new Blob([icsFileContent], { type: 'text/calendar;charset=utf-8' });
  return URL.createObjectURL(blob);
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

// ==========================================
// 1. COUNTDOWN TIMER HELPERS & INTERVAL LOOP
// ==========================================
function getCountdownText(startTimeStr, endTimeStr) {
  const now = new Date().getTime();
  const start = new Date(startTimeStr).getTime();
  const end = new Date(endTimeStr).getTime();

  if (now >= start && now <= end) {
    return `<span class="live-badge-pulse"><i class="fa-solid fa-circle" style="font-size: 8px;"></i> LIVE NOW</span>`;
  }

  if (now > end) {
    return `<span style="color: var(--text-muted); font-weight: 500;">Session Ended</span>`;
  }

  const diff = start - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  // Helper to pad single digits with a leading zero
  const pad = (num) => String(num).padStart(2, '0');

  return `
    <div class="countdown-clock">
      <span class="countdown-label">Starts in:</span>
      <div class="countdown-boxes">
        ${days > 0 ? `<div class="time-box"><strong>${pad(days)}</strong><span>Days</span></div>` : ''}
        <div class="time-box"><strong>${pad(hours)}</strong><span>Hrs</span></div>
        <div class="time-box"><strong>${pad(minutes)}</strong><span>Mins</span></div>
        <div class="time-box"><strong>${pad(seconds)}</strong><span>Secs</span></div>
      </div>
    </div>
  `;
}

// Background loop to update all countdown elements on the screen every second
setInterval(() => {
  const countdownElements = document.querySelectorAll('.class-countdown-timer');
  countdownElements.forEach(el => {
    const start = el.getAttribute('data-start');
    const end = el.getAttribute('data-end');
    el.innerHTML = getCountdownText(start, end);
  });
}, 1000);


// ==========================================
// 2. UPDATED CLASSES GRID RENDERER
// ==========================================
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
    const isLive = isClassLive(item.startTime, item.endTime);
    const initialCountdown = getCountdownText(item.startTime, item.endTime);

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

    // Safely format the title to prevent syntax errors with quotes in inline handlers
    const safeTitle = (item.title || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

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
          <span><i class="fa-regular fa-clock"></i> <span class="class-countdown-timer" data-start="${item.startTime}" data-end="${item.endTime}">${initialCountdown}</span></span>
        </div>
        ${resourcesHtml}
      </div>
      <div class="class-footer" style="display: flex; gap: 8px; align-items: center; justify-content: space-between; margin-top: 15px;">
        <a href="${icsDataUrl}" download="${item.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics" class="resource-chip" title="Add to Google Calendar / Outlook"><i class="fa-solid fa-calendar-plus"></i> Add to Calendar</a>
        <button onclick="handleJoinAndLogAttendance('${item.id}', '${safeTitle}', '${item.classLevel}', '${item.meetUrl}')" class="meet-btn" style="border: none; cursor: pointer;">
          <i class="fa-solid fa-video"></i> ${isLive ? 'Join Active Meet' : 'Join Meet'}
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}
async function logStudentAttendance(classId, classTitle, classLevel) {
  const session = getCurrentUserSession();
  if (!session) {
    console.warn("No active session found for attendance logging.");
    return;
  }

  const userId = session.username || session.email || 'guest';
  const cleanClassId = classId || 'instant-meeting';
  
  // Create a unique composite document ID to prevent duplicate spam for the same class
  const attendanceDocId = `${cleanClassId}_${userId.replace(/[^a-zA-Z0-9]/g, '_')}`;

  const attendanceRecord = {
    userId: userId,
    userName: session.name || session.fullName || 'Learner',
    userRole: session.role || 'Student',
    userClass: session.userClass || session.class || 'N/A',
    classId: cleanClassId,
    classTitle: classTitle || 'Virtual Class',
    classLevel: classLevel || 'General',
    joinedAt: (typeof firebase !== 'undefined' && firebase.firestore) 
              ? firebase.firestore.FieldValue.serverTimestamp() 
              : new Date().toISOString()
  };

  const database = typeof getDb === 'function' ? getDb() : (window.db || null);
  if (database) {
    try {
      // Use .set() with merge: true instead of .add() to update existing log if they click twice
      await database.collection('attendance').doc(attendanceDocId).set(attendanceRecord, { merge: true });
      console.log("Attendance successfully synced to Firestore.");
    } catch (err) {
      console.error("Failed to log attendance to Firestore:", err);
      queueOfflineOperation('SET', 'attendance', attendanceDocId, attendanceRecord);
    }
  } else {
    queueOfflineOperation('SET', 'attendance', attendanceDocId, attendanceRecord);
  }

  // Local storage fallback backup
  try {
    const localLogs = JSON.parse(localStorage.getItem('samcam_attendance_logs')) || [];
    // Filter out previous entry for this same class if updating, then push fresh
    const filteredLogs = localLogs.filter(log => !(log.classId === cleanClassId && log.userId === userId));
    filteredLogs.push({ ...attendanceRecord, joinedAt: new Date().toISOString() });
    localStorage.setItem('samcam_attendance_logs', JSON.stringify(filteredLogs));
  } catch (e) {
    console.error("Failed to save local attendance backup:", e);
  }
}

async function handleJoinAndLogAttendance(classId, safeTitle, classLevel, meetUrl) {
  if (!meetUrl) {
    alert("Meeting link is not available.");
    return;
  }

  // 1. Open the meet window first
  const meetWindow = window.open(meetUrl, '_blank');

  // 2. Check for popup blockers
  if (!meetWindow || meetWindow.closed || typeof meetWindow.closed === 'undefined') {
    alert("Popup blocked! Please allow popups for this site to join the meeting.");
    return;
  }

  // 3. Prompt user to confirm they successfully entered the session
  const confirmed = confirm(
    `You are launching "${safeTitle}".\n\nClick OK once you have successfully entered the Google Meet room to record your official attendance.`
  );

  if (confirmed) {
    // 4. Log attendance using your robust function only after confirmation
    await logStudentAttendance(classId, safeTitle, classLevel);
    console.log("Attendance verified and recorded.");
  } else {
    console.log("User cancelled attendance logging.");
  }
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
   FIRESTORE SUBMIT / UPDATE / DELETE WORKFLOW (SCHOOLID MULTI-TENANT INTEGRATION)
   ========================================================================== */
function handleScheduleSubmit(e) {
  e.preventDefault();
  
  const session = getCurrentUserSession();
  const schoolId = session?.schoolId || session?.institutionId || 'standard_college_ntungamo';

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
    // Updating existing class in Firestore scoped by schoolId
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Updating...`;

    db.collection("live_classes").doc(editingClassId).update({
      schoolId,
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
        schoolId,
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
   USER PROFILE & ATTENDANCE LOG FEATURES (SCHOOLID SCOPED)
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

// 3. Fetch and Render Attendance Logs (Scoped by schoolId)
function fetchAttendanceLogs() {
  const tbody = document.getElementById('attendanceTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Loading logs...</td></tr>';

  const session = getCurrentUserSession();
  const schoolId = session?.schoolId || session?.institutionId;

  let query = db.collection("attendance_logs");
  if (schoolId) {
    query = query.where("schoolId", "==", schoolId);
  }

  query.orderBy("timestamp", "desc")
    .limit(50)
    .onSnapshot((snapshot) => {
      tbody.innerHTML = '';
      if (snapshot.empty) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--text-muted);">No attendance logs found for this school institution.</td></tr>';
        return;
      }
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
    }, (error) => {
      console.error("Error fetching attendance logs: ", error);
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: #dc2626;">Failed to load attendance logs. Indexing or permissions error.</td></tr>';
    });
}

// 4. Export Attendance to CSV (Scoped by schoolId)
function exportAttendanceCSV() {
  const session = getCurrentUserSession();
  const schoolId = session?.schoolId || session?.institutionId;

  let query = db.collection("attendance_logs");
  if (schoolId) {
    query = query.where("schoolId", "==", schoolId);
  }

  query.get().then((snapshot) => {
    let csv = "Timestamp,User Name,Class,Action\n";
    snapshot.forEach((doc) => {
      const log = doc.data();
      csv += `"${log.timestamp?.toDate().toLocaleString()}","${log.userName}","${log.userClass}","${log.action}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `meeting_attendance_log_${schoolId || 'general'}.csv`);
    a.click();
  }).catch(err => {
    console.error("Failed to export CSV:", err);
    alert("Export failed: " + err.message);
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
