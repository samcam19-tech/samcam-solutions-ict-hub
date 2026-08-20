/* ==========================================================================
   SAMCAM SOLUTIONS - LIVE CLASSES & GOOGLE MEET ENGINE (SESSION-BASED)
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
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Google API Client configuration
const CLIENT_ID = '74940789582-42d2vlki0lr8bj734afchl8b42jo3b98.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

// List of authorized Teacher/Admin emails
const AUTHORIZED_TEACHERS = [
  "samuel.akugizibwe95@gmail.com",
  "samuelakugizibwe23@gmail.com"
];

let tokenClient = null;
let allClasses = [];
let currentFilterClass = 'ALL';
let currentUser = null; // Holds the logged-in user data from storage

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  checkUserSession();
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
   USER SESSION CHECK (Integration with assessments login)
   ========================================================================== */
function checkUserSession() {
  // Adjust 'samcam_user' or 'currentUser' to match whatever key your assessment page uses
  const savedUser = localStorage.getItem('samcam_user') || localStorage.getItem('currentUser');
  
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
    } catch (e) {
      currentUser = { role: 'student', classLevel: savedUser }; // Fallback if stored as a plain string
    }
  } else {
    // Default fallback mock for testing if no session exists yet (treat as student or public)
    currentUser = { role: 'student', classLevel: 'Senior 3', name: 'Learner' };
  }

  const scheduleBtn = document.querySelector('button[onclick="openScheduleModal()"]');
  const filterGroup = document.getElementById('classFilterGroup');

  // If user is a student, lock their view to their specific class and hide teacher controls
  if (currentUser.role === 'student' || currentUser.type === 'student') {
    if (scheduleBtn) scheduleBtn.style.display = 'none'; // Hide scheduling button for learners
    if (filterGroup) filterGroup.style.display = 'none'; // Hide class filter buttons for learners
  }
}

/* ==========================================================================
   FIRESTORE DATA RETRIEVAL & RENDERING
   ========================================================================== */
function fetchClassesFromFirestore() {
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
  // Prevent students from changing filters
  if (currentUser && (currentUser.role === 'student' || currentUser.type === 'student')) {
    return;
  }

  currentFilterClass = cls;
  document.querySelectorAll('#classFilterGroup .segment-btn').forEach(btn => btn.classList.remove('active'));
  if (event) event.currentTarget.classList.add('active');
  renderClassesGrid();
}

function renderClassesGrid() {
  const container = document.getElementById('classes-grid');
  if (!container) return;

  container.innerHTML = '';

  let filtered = allClasses;

  // Enforce class restriction for students based on their session class level
  if (currentUser && (currentUser.role === 'student' || currentUser.type === 'student')) {
    const studentClass = currentUser.classLevel || currentUser.class;
    filtered = allClasses.filter(item => item.classLevel === studentClass);
  } else if (currentFilterClass !== 'ALL') {
    // Teachers/Admins use the filter bar
    filtered = allClasses.filter(item => item.classLevel === currentFilterClass);
  }

  if (filtered.length === 0) {
    const studentClass = currentUser?.classLevel || currentUser?.class || 'your class';
    const msg = (currentUser?.role === 'student' || currentUser?.type === 'student')
      ? `No scheduled live sessions found for ${studentClass}.`
      : 'No scheduled classes found.';
      
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
        <i class="fa-solid fa-calendar-xmark" style="font-size: 2.5rem; margin-bottom: 1rem;"></i>
        <h3>${msg}</h3>
        <p>Check back later for upcoming live sessions.</p>
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
   MODAL CONTROLS & SCHEDULING WORKFLOW
   ========================================================================== */
function openScheduleModal() {
  // Double-check authorization before showing modal
  if (!tokenClient) {
    alert("Google Identity Services is still loading. Please wait a moment.");
    return;
  }
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
    alert("Google Identity Services is still loading or blocked.");
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
      // Verify teacher email via userinfo
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { 'Authorization': `Bearer ${resp.access_token}` }
      });
      const userInfo = await userInfoRes.json();

      if (!AUTHORIZED_TEACHERS.includes(userInfo.email)) {
        alert(`Access Denied: (${userInfo.email}) is not authorized to schedule meetings.`);
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fa-solid fa-video"></i> Create Meet & Schedule`;
        return;
      }

      // Create Calendar Event & Meet Link
      const meetUrl = await createGoogleCalendarEvent(resp.access_token, {
        title, classLevel, instructorName, startTime, endTime, description
      });

      // Save to Firestore
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
