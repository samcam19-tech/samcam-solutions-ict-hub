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

window.addEventListener('portalSessionChanged', (e) => {
  syncLiveClassSession(e.detail);
});

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  syncLiveClassSession();
  fetchClassesFromFirestore();
  
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
   SESSION MANAGEMENT & ROLE DETECTION (Unified with Forum Engine)
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

function syncLiveClassSession(user) {
  const session = getCurrentUserSession(user);
  console.log("Synced Live Class Session:", session);

  const combinedCheck = `${session.role} ${session.name} ${session.userClass}`.toLowerCase();
  const isTeacherOrAdmin = combinedCheck.includes('teacher') || 
                           combinedCheck.includes('admin') || 
                           combinedCheck.includes('instructor') ||
                           combinedCheck.includes('staff');

  // Toggle visibility of teacher-only elements (like the 'Schedule New Class' button/modal triggers)
  document.querySelectorAll('.teacher-only').forEach(el => {
    el.style.display = isTeacherOrAdmin ? 'inline-flex' : 'none';
  });

  // Update filter controls or automatically enforce class bounds for learners
  updateClassFilterInterface(session, isTeacherOrAdmin);
  renderClassesGrid();
}

function updateClassFilterInterface(session, isTeacherOrAdmin) {
  const filterGroup = document.getElementById('classFilterGroup');
  if (!filterGroup) return;

  if (isTeacherOrAdmin) {
    // Teachers see filter options or container
    filterGroup.style.display = 'flex';
  } else {
    // Learners are restricted to their own class, hide manual multi-class filter buttons if desired
    filterGroup.style.display = 'none';
  }
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
  const isTeacherOrAdmin = combinedCheck.includes('teacher') || combinedCheck.includes('admin') || combinedCheck.includes('instructor') || combinedCheck.includes('staff');

  // Prevent students from overriding their class filter
  if (!isTeacherOrAdmin) return;

  currentFilterClass = cls;
  document.querySelectorAll('#classFilterGroup .segment-btn').forEach(btn => btn.classList.remove('active'));
  if (event) event.currentTarget.classList.add('active');
  renderClassesGrid();
}

function renderClassesGrid() {
  const container = document.getElementById('classes-grid');
  if (!container) return;

  container.innerHTML = '';

  const session = getCurrentUserSession();
  const combinedCheck = `${session.role} ${session.name} ${session.userClass}`.toLowerCase();
  const isTeacherOrAdmin = combinedCheck.includes('teacher') || combinedCheck.includes('admin') || combinedCheck.includes('instructor') || combinedCheck.includes('staff');

  let filtered = allClasses;

  if (!isTeacherOrAdmin) {
    // Learners only view meetings matching their class level
    const studentClass = session.userClass;
    filtered = allClasses.filter(item => {
      const itemCls = (item.classLevel || '').trim().toLowerCase();
      return itemCls === 'general' || itemCls === studentClass.toLowerCase();
    });
  } else {
    // Teachers can use the active button/dropdown filter
    filtered = allClasses.filter(item => currentFilterClass === 'ALL' || item.classLevel === currentFilterClass);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
        <i class="fa-solid fa-calendar-xmark" style="font-size: 2.5rem; margin-bottom: 1rem;"></i>
        <h3>No scheduled classes found</h3>
        <p>${isTeacherOrAdmin ? 'Click "Schedule New Class" above to set up a live session.' : 'No live sessions currently scheduled for your class.'}</p>
      </div>
    `;
    return;
  }

  filtered.forEach(item => {
    const formattedDate = new Date(item.startTime).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const card = document.createElement('div');
    card.className = 'class-card';
    card.innerHTML = `
      <div>
        <div class="class-meta">
          <span class="tag">${item.classLevel}</span>
          <span class="tag" style="background: #dcfce7; color: #166534;">Live Session</span>
        </div>
        <h3 class="class-title">${item.title}</h3>
        <p class="class-desc">${item.description || 'No instructions provided.'}</p>
        <div class="class-details">
          <span><i class="fa-solid fa-user-tie"></i> Instructor: <strong>${item.instructorName}</strong></span>
          <span><i class="fa-regular fa-clock"></i> ${formattedDate}</span>
        </div>
      </div>
      <div class="class-footer">
        <small style="color: var(--text-muted);">Google Meet Integrated</small>
        <a href="${item.meetUrl}" target="_blank" class="meet-btn">
          <i class="fa-solid fa-video"></i> Join Meet
        </a>
      </div>
    `;
    container.appendChild(card);
  });
}

/* ==========================================================================
   MODAL CONTROLS
   ========================================================================== */
function openScheduleModal() {
  const modal = document.getElementById('scheduleModal');
  if (modal) modal.style.display = 'flex';
}

function closeScheduleModal(e) {
  if (e.target.id === 'scheduleModal') closeScheduleModalDirect();
}

function closeScheduleModalDirect() {
  const modal = document.getElementById('scheduleModal');
  if (modal) modal.style.display = 'none';
}

/* ==========================================================================
   GOOGLE MEET CREATION & SCHEDULING WORKFLOW
   ========================================================================== */
function handleScheduleSubmit(e) {
  e.preventDefault();
  
  const title = document.getElementById('classTitle').value;
  const classLevel = document.getElementById('classLevel').value;
  const instructorName = document.getElementById('instructorName').value;
  const startTime = document.getElementById('startTime').value;
  const endTime = document.getElementById('endTime').value;
  const description = document.getElementById('classDescription').value;

  const submitBtn = document.getElementById('submitClassBtn');
  
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
      // Direct REST API Call to Google Calendar with automatic Google Meet conference creation
      const meetUrl = await createGoogleCalendarEvent(resp.access_token, {
        title, classLevel, instructorName, startTime, endTime, description
      });

      // Save class data including generated Meet URL to Firestore
      await db.collection("live_classes").add({
        title,
        classLevel,
        instructorName,
        startTime,
        endTime,
        description,
        meetUrl,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      closeScheduleModalDirect();
      document.getElementById('scheduleForm').reset();
      alert("Class scheduled successfully with an automated Google Meet link!");
    } catch (err) {
      console.error("Error creating calendar event:", err);
      alert("Failed to create Google Calendar event. Check console for details.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i class="fa-solid fa-video"></i> Create Meet & Schedule`;
    }
  };

  tokenClient.requestAccessToken({ prompt: 'consent' });
}

async function createGoogleCalendarEvent(accessToken, classData) {
  const event = {
    'summary': `[${classData.classLevel}] ${classData.title} - Samcam ICT Hub`,
    'description': `${classData.description}\n\nInstructor: ${classData.instructorName}`,
    'start': { 'dateTime': new Date(classData.startTime).toISOString() },
    'end': { 'dateTime': new Date(classData.endTime).toISOString() },
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
