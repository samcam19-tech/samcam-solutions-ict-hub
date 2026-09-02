/* ==========================================================================
   SAMCAM SOLUTIONS - ANNOUNCEMENTS ENGINE (SAFE LAZY-LOADED DB & SCHOOLID SCOPED)
   ========================================================================== */

// --- APPLICATION STATE ---
let announcementsList = [];
let showOnlyUnread = false; // Toggle state for clicking the badge counter
let currentSchoolId = ''; // Global schoolId tracking context for announcements

// Helper to safely retrieve the Firestore database instance at runtime
function getDb() {
  if (typeof window !== "undefined" && window.db) {
    return window.db;
  }
  if (typeof firebase !== "undefined" && firebase.firestore) {
    return firebase.firestore();
  }
  return null;
}

document.addEventListener("DOMContentLoaded", () => {
  // Extract schoolId from URL parameters or session if present, defaulting to 'stacon'
  const params = new URLSearchParams(window.location.search);
  if (params.has('schoolId')) {
    currentSchoolId = params.get('schoolId').toLowerCase().trim();
  } else {
    const session = getCurrentUserSession();
    if (session && (session.schoolId || session.schoolID || session.institutionId)) {
      currentSchoolId = (session.schoolId || session.schoolID || session.institutionId).toLowerCase().trim();
    } else {
      currentSchoolId = 'stacon';
    }
  }

  checkUserRolePermissions();
  
  const database = getDb();
  if (database) {
    loadAnnouncementsRealtime();
  } else {
    // Fallback if db is completely missing
    console.error("Firebase Firestore is not initialized.");
    const feed = document.getElementById('announcementsFeed');
    if (feed) {
      feed.innerHTML = '<div class="empty-state" style="color:red;">Firebase database is not initialized. Please check your configuration script.</div>';
    }
  }
});

// 1. Fetch & Listen to Firestore in Real-Time (Strictly scoped by schoolId)
function loadAnnouncementsRealtime() {
  const database = getDb();
  if (!database) return;
  
  let queryRef = database.collection('announcements').orderBy('createdAt', 'desc');

  if (currentSchoolId) {
    queryRef = queryRef.where('schoolId', '==', currentSchoolId);
  }

  queryRef.onSnapshot((snapshot) => {
    announcementsList = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      let formattedDate = 'Just now';
      if (data.createdAt) {
        if (typeof data.createdAt.toDate === 'function') {
          formattedDate = data.createdAt.toDate().toLocaleString([], {  
            dateStyle: 'medium',  
            timeStyle: 'short'  
          });
        } else {
          formattedDate = new Date(data.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
        }
      }

      announcementsList.push({
        id: doc.id,
        title: data.title,
        priority: data.priority || 'Normal',
        body: data.body || data.message || '',
        author: data.author || 'System Administrator',
        schoolId: data.schoolId || currentSchoolId || 'stacon',
        date: formattedDate
      });
    });

    updateUnreadBadgeCounter();
    filterAnnouncements();  
  }, (error) => {
    console.error("Error loading announcements: ", error);
    const feed = document.getElementById('announcementsFeed');
    if (feed) {
      feed.innerHTML = '<div class="empty-state" style="color:#ef4444;">Failed to load announcements from server. Check collection indices or rules.</div>';
    }
  });
}

// 2. Render List to DOM & Track Read Status
function renderAnnouncements(items) {
  const feed = document.getElementById('announcementsFeed');
  if (!feed) return;

  if (items.length === 0) {
    feed.innerHTML = '<div class="empty-state"><i class="fa-regular fa-folder-open fa-2x" style="margin-bottom:0.5rem;"></i><p>No matching announcements found for this institution.</p></div>';
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
    const itemSchoolId = item.schoolId || currentSchoolId || 'stacon';

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

    // Escape parameters safely for inline handler injection
    const escapedTitle = escapeHtml(item.title).replace(/'/g, "\\'");
    const escapedBody = escapeHtml(item.body).replace(/'/g, "\\'").replace(/\n/g, '\\n');
    const escapedAuthor = escapeHtml(item.author).replace(/'/g, "\\'");

    html += `
      <div class="announcement-card ${cardClass}" onclick="openReadAnnouncementModal('${item.id}', '${escapedTitle}', '${item.priority}', '${escapedBody}', '${escapedAuthor}', '${item.date}')">
        <div class="announcement-meta">
          <div>
            <span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; margin-right: 0.5rem;"><i class="fa-solid fa-school"></i> ${itemSchoolId.toUpperCase()}</span>
            <span class="badge ${badgeClass}">${item.priority}</span>
            <span style="margin-left: 0.5rem;">Posted by <strong>${escapeHtml(item.author)}</strong></span>
            ${!isRead ? '<span style="color:var(--primary); font-weight:700; margin-left:0.5rem; font-size:0.7rem;">• UNREAD</span>' : ''}
          </div>
          <span><i class="fa-regular fa-clock"></i> ${item.date}</span>
        </div>
        <div class="announcement-title">${escapeHtml(item.title)}</div>
        <div class="announcement-body">${escapeHtml(item.body)}</div>
        
        <!-- Appended Official Contact Footer -->
        <div style="margin-top: 1.25rem; padding-top: 0.75rem; border-top: 1px solid var(--border-color, #e2e8f0); font-size: 0.78rem; color: var(--text-muted, #64748b); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
          <div style="display: flex; gap: 1.25rem;">
            <span><i class="fa-solid fa-envelope" style="color: var(--primary); margin-right: 4px;"></i> info@samcamsolution.org</span>
            <span><i class="fa-solid fa-phone" style="color: var(--primary); margin-right: 4px;"></i> 0703999089</span>
          </div>
          <span style="color: var(--text-muted); font-size: 0.75rem;">${isRead ? 'Read' : 'Click to read full notice'}</span>
        </div>

        <div class="announcement-footer" style="margin-top: 0.5rem; justify-content: flex-end;">
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
  const searchInput = document.getElementById('announcementSearch');
  const priorityFilter = document.getElementById('priorityFilter');
  if (!searchInput || !priorityFilter) return;

  const query = searchInput.value.toLowerCase();
  const priority = priorityFilter.value;
  const readList = getReadAnnouncementsStorage();

  const filtered = announcementsList.filter(item => {
    const matchesQuery = item.title.toLowerCase().includes(query) || item.body.toLowerCase().includes(query);
    const matchesPriority = !priority || item.priority === priority;
    const matchesUnread = !showOnlyUnread || !readList.includes(item.id);
    const matchesSchool = !currentSchoolId || (item.schoolId && item.schoolId.toLowerCase() === currentSchoolId) || item.schoolId === 'global';
    return matchesQuery && matchesPriority && matchesUnread && matchesSchool;
  });

  renderAnnouncements(filtered);
}

// 4. Notification Badge Click Interaction
function toggleUnreadFilter() {
  showOnlyUnread = !showOnlyUnread;
  const badgeContainer = document.querySelector('.notification-badge-container');

  if (badgeContainer) {
    if (showOnlyUnread) {
      badgeContainer.classList.add('active-filter');
    } else {
      badgeContainer.classList.remove('active-filter');
    }
  }

  filterAnnouncements();
}

function updateUnreadBadgeCounter() {
  const readList = getReadAnnouncementsStorage();
  const unreadCount = announcementsList.filter(item => !readList.includes(item.id)).length;

  const counterEl = document.getElementById('unreadBadgeCount');
  if (counterEl) {
    counterEl.textContent = unreadCount;
    counterEl.style.display = 'inline-block';
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

// 5. Modal & Read View Handlers
function openAnnouncementModal() { 
  const modal = document.getElementById('announcementModal');
  if (modal) modal.style.display = 'flex'; 
}

function closeAnnouncementModal() { 
  const modal = document.getElementById('announcementModal');
  const form = document.getElementById('announcementForm');
  if (modal) modal.style.display = 'none'; 
  if (form) form.reset(); 
}

function openReadAnnouncementModal(id, title, priority, body, author, date) {
  markAnnouncementAsRead(id);

  const modal = document.getElementById('readAnnouncementModal');
  if (!modal) return;

  const tagEl = document.getElementById('readModalCategoryTag');
  const titleEl = document.getElementById('readModalTitle');
  const metaEl = document.getElementById('readModalDateAuthor');
  const bodyEl = document.getElementById('readModalBody');

  if (tagEl) {
    tagEl.textContent = priority;
    tagEl.style.background = priority === 'Urgent' ? '#fee2e2' : (priority === 'Exam' ? '#fef3c7' : '#e0f2fe');
    tagEl.style.color = priority === 'Urgent' ? '#991b1b' : (priority === 'Exam' ? '#92400e' : '#0369a1');
  }

  if (titleEl) titleEl.textContent = title;
  if (metaEl) {
    metaEl.innerHTML = `<span><i class="fa-solid fa-user"></i> Posted by <strong>${author}</strong></span><span><i class="fa-regular fa-clock"></i> ${date}</span>`;
  }
  if (bodyEl) {
    bodyEl.innerHTML = `
      <div>${body.replace(/\\n/g, '<br>')}</div>
      <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border-color, #e2e8f0); font-size: 0.82rem; color: var(--text-muted, #64748b); display: flex; gap: 1.5rem; flex-wrap: wrap;">
        <span><i class="fa-solid fa-envelope" style="color: var(--primary); margin-right: 6px;"></i> Official Inquiry: <strong>info@samcamsolution.org</strong></span>
        <span><i class="fa-solid fa-phone" style="color: var(--primary); margin-right: 6px;"></i> Helpline: <strong>0703999089</strong></span>
      </div>
    `;
  }

  modal.style.display = 'flex';
}

function closeReadModal() {
  const modal = document.getElementById('readAnnouncementModal');
  if (modal) modal.style.display = 'none';
}

function closeReadModalOutside(event) {
  const modal = document.getElementById('readAnnouncementModal');
  if (event.target === modal) {
    closeReadModal();
  }
}

async function handlePostAnnouncement(e) {
  e.preventDefault();
  
  const database = getDb();
  if (!database) {
    alert("Database connection is not available.");
    return;
  }

  const titleInput = document.getElementById('annTitle');
  const priorityInput = document.getElementById('annPriority');
  const bodyInput = document.getElementById('annBody');
  const submitBtn = document.getElementById('submitNoticeBtn');
  
  if (!titleInput || !priorityInput || !bodyInput || !submitBtn) return;

  const title = titleInput.value.trim();
  const priority = priorityInput.value;
  const body = bodyInput.value.trim();

  const session = getCurrentUserSession();
  const authorName = session.name || session.fullName || 'System Administrator';
  const noticeSchoolId = currentSchoolId || session.schoolId || session.schoolID || session.institutionId || 'stacon';

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publishing...';

  try {
    // Aligns with Firestore schema: author, body, createdAt, priority, schoolId, title
    await database.collection('announcements').add({
      title: title,
      priority: priority,
      body: body,
      author: authorName,
      schoolId: noticeSchoolId.toLowerCase(),
      createdAt: (typeof firebase !== 'undefined' && firebase.firestore) 
                 ? firebase.firestore.FieldValue.serverTimestamp() 
                 : new Date().toISOString()
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
  const database = getDb();
  if (!database) return;
  
  if (confirm("Are you sure you want to delete this announcement permanently?")) {
    try {
      await database.collection('announcements').doc(id).delete();
    } catch (error) {
      console.error("Error removing document: ", error);
      alert("Failed to delete notice: " + error.message);
    }
  }
}

// Utilities
function getCurrentUserSession() {
  try {
    const sessionData = localStorage.getItem('portal_session') || sessionStorage.getItem('portal_session');
    if (sessionData) { 
      return JSON.parse(sessionData); 
    }
  } catch (e) {}
  return { name: 'Learner', role: 'Student', schoolId: 'stacon' };
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
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}
