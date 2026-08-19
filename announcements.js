// --- FIREBASE CONFIGURATION & SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyBcZxH7TTpejrFmF4ji0DS66xVfDVhZEfw",
  authDomain: "samcam-system.firebaseapp.com",
  projectId: "samcam-system",
  storageBucket: "samcam-system.firebasestorage.app",
  messagingSenderId: "74940789582",
  appId: "1:74940789582:web:f159688165a194e841241f",
  measurementId: "G-L2H4V8Y050"
};

if (typeof firebase !== "undefined" && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = typeof firebase !== "undefined" ? firebase.firestore() : null;
const storage = typeof firebase !== "undefined" && firebase.storage ? firebase.storage() : null;

// --- APPLICATION STATE ---
let announcementsList = [];
let showOnlyUnread = false; // Toggle state for clicking the badge counter

document.addEventListener("DOMContentLoaded", () => {
  checkUserRolePermissions();
  if (db) {
    loadAnnouncementsRealtime();
  } else {
    document.getElementById('announcementsFeed').innerHTML = 
      '<div class="empty-state" style="color:red;">Firebase database is not initialized.</div>';
  }
});

// 1. Fetch & Listen to Firestore in Real-Time
function loadAnnouncementsRealtime() {
  db.collection('announcements')
    .orderBy('createdAt', 'desc')
    .onSnapshot((snapshot) => {
      announcementsList = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        let formattedDate = 'Just now';
        if (data.createdAt) {
          formattedDate = data.createdAt.toDate().toLocaleString([], { 
            dateStyle: 'medium', 
            timeStyle: 'short' 
          });
        }

        announcementsList.push({
          id: doc.id,
          title: data.title,
          priority: data.priority,
          body: data.body,
          author: data.author,
          date: formattedDate
        });
      });
      
      updateUnreadBadgeCounter();
      filterAnnouncements(); 
    }, (error) => {
      console.error("Error loading announcements: ", error);
      document.getElementById('announcementsFeed').innerHTML = 
        '<div class="empty-state" style="color:#ef4444;">Failed to load announcements from server.</div>';
    });
}

// 2. Render List to DOM & Track Read Status
function renderAnnouncements(items) {
  const feed = document.getElementById('announcementsFeed');
  if (!feed) return;

  if (items.length === 0) {
    feed.innerHTML = '<div class="empty-state"><i class="fa-regular fa-folder-open fa-2x" style="margin-bottom:0.5rem;"></i><p>No matching announcements found.</p></div>';
    return;
  }

  const session = getCurrentUserSession();
  const combined = `${session.role || session.userType || ''} ${session.name || ''}`.toLowerCase();
  const isTeacherOrAdmin = combined.includes('teacher') || combined.includes('admin') || combined.includes('staff') || combined.includes('instructor');
  
  const readList = getReadAnnouncementsStorage();

  let html = '';
  items.forEach(item => {
    const isRead = readList.includes(item.id);
    let badgeClass = 'badge-general';
    let cardClass = '';
    
    if (item.priority === 'Urgent') {
      badgeClass = 'badge-urgent';
      cardClass = 'priority-urgent';
    } else if (item.priority === 'Exam') {
      badgeClass = 'badge-exam';
      cardClass = 'priority-warning';
    }

    if (!isRead) {
      cardClass += ' unread-notice';
    }

    html += `
      <div class="announcement-card ${cardClass}" onclick="markAnnouncementAsRead('${item.id}')">
        <div class="announcement-meta">
          <div>
            <span class="badge ${badgeClass}">${item.priority}</span>
            <span style="margin-left: 0.5rem;">Posted by <strong>${escapeHtml(item.author)}</strong></span>
            ${!isRead ? '<span style="color:var(--primary); font-weight:700; margin-left:0.5rem; font-size:0.7rem;">• UNREAD</span>' : ''}
          </div>
          <span><i class="fa-regular fa-clock"></i> ${item.date}</span>
        </div>
        <div class="announcement-title">${escapeHtml(item.title)}</div>
        <div class="announcement-body">${escapeHtml(item.body)}</div>
        <div class="announcement-footer">
          <span style="color: var(--text-muted); font-size: 0.75rem;">${isRead ? 'Read' : 'Click card to mark read'}</span>
          ${isTeacherOrAdmin ? `
            <button class="btn btn-danger-outline" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" onclick="event.stopPropagation(); deleteAnnouncement('${item.id}')">
              <i class="fa-solid fa-trash"></i> Delete
            </button>
          ` : ''}
        </div>
      </div>
    `;
  });

  feed.innerHTML = html;
}

// 3. Search, Category & Unread Counter Filtering
function filterAnnouncements() {
  const query = document.getElementById('announcementSearch').value.toLowerCase();
  const priority = document.getElementById('priorityFilter').value;
  const readList = getReadAnnouncementsStorage();

  const filtered = announcementsList.filter(item => {
    const matchesQuery = item.title.toLowerCase().includes(query) || item.body.toLowerCase().includes(query);
    const matchesPriority = !priority || item.priority === priority;
    const matchesUnread = !showOnlyUnread || !readList.includes(item.id);
    return matchesQuery && matchesPriority && matchesUnread;
  });

  renderAnnouncements(filtered);
}

// 4. Notification Badge Click Interaction
function toggleUnreadFilter() {
  showOnlyUnread = !showOnlyUnread;
  const badgeContainer = document.querySelector('.notification-badge-container');
  
  if (showOnlyUnread) {
    badgeContainer.classList.add('active-filter');
  } else {
    badgeContainer.classList.remove('active-filter');
  }
  
  filterAnnouncements();
}

function updateUnreadBadgeCounter() {
  const readList = getReadAnnouncementsStorage();
  const unreadCount = announcementsList.filter(item => !readList.includes(item.id)).length;
  
  const counterEl = document.getElementById('unreadBadgeCount');
  if (counterEl) {
    counterEl.textContent = unreadCount;
    counterEl.style.display = unreadCount > 0 ? 'inline-block' : 'inline-block';
  }
}

function markAnnouncementAsRead(id) {
  let readList = getReadAnnouncementsStorage();
  if (!readList.includes(id)) {
    readList.push(id);
    const session = getCurrentUserSession();
    const key = `samcam_read_notices_${session.name || 'guest'}`;
    localStorage.setItem(key, JSON.stringify(readList));
    updateUnreadBadgeCounter();
    filterAnnouncements();
  }
}

function getReadAnnouncementsStorage() {
  const session = getCurrentUserSession();
  const key = `samcam_read_notices_${session.name || 'guest'}`;
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch (e) {
    return [];
  }
}

// 5. Modal & Firestore Actions
function openAnnouncementModal() { document.getElementById('announcementModal').style.display = 'flex'; }
function closeAnnouncementModal() { document.getElementById('announcementModal').style.display = 'none'; document.getElementById('announcementForm').reset(); }

async function handlePostAnnouncement(e) {
  e.preventDefault();
  const title = document.getElementById('annTitle').value.trim();
  const priority = document.getElementById('annPriority').value;
  const body = document.getElementById('annBody').value.trim();

  const session = getCurrentUserSession();
  const authorName = session.name || session.fullName || 'Staff Member';
  
  const submitBtn = document.getElementById('submitNoticeBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publishing...';

  try {
    await db.collection('announcements').add({
      title: title,
      priority: priority,
      body: body,
      author: authorName,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    closeAnnouncementModal();
  } catch (error) {
    console.error("Error writing document: ", error);
    alert("Failed to post announcement: " + error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Publish Notice';
  }
}

async function deleteAnnouncement(id) {
  if (confirm("Are you sure you want to delete this announcement permanently?")) {
    try {
      await db.collection('announcements').doc(id).delete();
    } catch (error) {
      console.error("Error removing document: ", error);
      alert("Failed to delete notice: " + error.message);
    }
  }
}

// Utilities
function getCurrentUserSession() {
  const sessionData = localStorage.getItem('portal_session') || sessionStorage.getItem('portal_session');
  if (sessionData) {
    try { return JSON.parse(sessionData); } catch (e) {}
  }
  return { name: 'Learner', role: 'Student' };
}

function checkUserRolePermissions() {
  const session = getCurrentUserSession();
  const combined = `${session.role || session.userType || ''} ${session.name || ''}`.toLowerCase();
  const isTeacherOrAdmin = combined.includes('teacher') || combined.includes('admin') || combined.includes('staff') || combined.includes('instructor');

  const postBtn = document.getElementById('newAnnouncementBtn');
  if (postBtn && isTeacherOrAdmin) {
    postBtn.style.display = 'inline-flex';
  }
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
}
