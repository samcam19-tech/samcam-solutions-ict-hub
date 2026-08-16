let globalThreads = [];
let activeThreadId = null;

// Initialize forum data fetch on load
document.addEventListener("DOMContentLoaded", () => {
  fetchForumThreads();
});

// Fetch all discussion threads from Firestore
async function fetchForumThreads() {
  const feedContainer = document.getElementById('threadsFeedContainer');
  if (!feedContainer) return;

  if (!db) {
    feedContainer.innerHTML = `<div class="loading-state" style="color:#ef4444;">Database connection unavailable.</div>`;
    return;
  }

  try {
    const snapshot = await db.collection('forum_threads').orderBy('createdAt', 'desc').get();
    if (snapshot.empty) {
      feedContainer.innerHTML = `<div class="loading-state">No discussion questions posted yet.</div>`;
      return;
    }

    globalThreads = [];
    snapshot.forEach(doc => {
      globalThreads.push({ id: doc.id, ...doc.data() });
    });

    renderThreadsList(globalThreads);
  } catch (err) {
    console.error("Error loading discussion threads:", err);
    feedContainer.innerHTML = `<div class="loading-state" style="color:#ef4444;">Failed to load discussions.</div>`;
  }
}

// Render threads feed list
function renderThreadsList(threads) {
  const feedContainer = document.getElementById('threadsFeedContainer');
  if (!feedContainer) return;

  if (threads.length === 0) {
    feedContainer.innerHTML = `<div class="loading-state">No matching discussions found.</div>`;
    return;
  }

  let html = '';
  threads.forEach(thread => {
    const timeAgo = thread.createdAt && thread.createdAt.toDate 
      ? new Date(thread.createdAt.toDate()).toLocaleDateString() 
      : 'Recent';

    const isActive = activeThreadId === thread.id ? 'active' : '';

    html += `
      <div class="thread-card ${isActive}" onclick="selectThread('${thread.id}')">
        <div class="thread-meta-top">
          <span class="class-badge">${thread.classTarget || 'General'}</span>
          <span class="thread-time">${timeAgo}</span>
        </div>
        <h4>${escapeHtml(thread.title)}</h4>
        <div class="thread-snippet">${escapeHtml(thread.body)}</div>
      </div>
    `;
  });

  feedContainer.innerHTML = html;
}

// Filter threads by search query and class selection
function filterForumThreads() {
  const query = document.getElementById('forumSearchInput').value.toLowerCase();
  const selectedClass = document.getElementById('classFilterSelect').value;

  const filtered = globalThreads.filter(t => {
    const matchesQuery = t.title.toLowerCase().includes(query) || t.body.toLowerCase().includes(query);
    const matchesClass = !selectedClass || t.classTarget === selectedClass || t.classTarget === 'General';
    return matchesQuery && matchesClass;
  });

  renderThreadsList(filtered);
}

// Select a thread to view details and replies
async function selectThread(threadId) {
  activeThreadId = threadId;
  renderThreadsList(globalThreads); // Update active state border highlight

  const thread = globalThreads.find(t => t.id === threadId);
  const detailPane = document.getElementById('threadDetailPane');
  if (!thread || !detailPane) return;

  detailPane.innerHTML = `
    <div class="active-thread-header">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
        <span class="class-badge">${thread.classTarget || 'General'}</span>
        <span style="font-size:0.75rem; color:#64748b;">Posted by <strong>${escapeHtml(thread.authorName || 'Instructor')}</strong></span>
      </div>
      <h3>${escapeHtml(thread.title)}</h3>
      <div class="active-thread-body">${escapeHtml(thread.body)}</div>
    </div>

    <div class="replies-list-container" id="repliesListContainer">
      <div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading replies...</div>
    </div>

    <div class="reply-input-box">
      <textarea id="replyMessageInput" placeholder="Write your reply or feedback here..."></textarea>
      <button class="btn btn-primary" onclick="submitReply('${thread.id}')"><i class="fa-solid fa-paper-plane"></i> Reply</button>
    </div>
  `;

  loadThreadReplies(thread.id);
}

// Load real-time or snapshot replies for a specific thread
async function loadThreadReplies(threadId) {
  const repliesContainer = document.getElementById('repliesListContainer');
  if (!repliesContainer) return;

  try {
    const snapshot = await db.collection('forum_threads').doc(threadId).collection('replies').orderBy('submittedAt', 'asc').get();
    
    if (snapshot.empty) {
      repliesContainer.innerHTML = `<div class="loading-state" style="padding:1.5rem;">No replies yet. Be the first to contribute to this discussion!</div>`;
      return;
    }

    let html = '';
    snapshot.forEach(doc => {
      const rep = doc.data();
      const repTime = rep.submittedAt && rep.submittedAt.toDate 
        ? new Date(rep.submittedAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        : 'Just now';

      html += `
        <div class="reply-item">
          <div class="reply-meta">
            <span class="reply-author">${escapeHtml(rep.studentName)} <span style="font-weight:normal; color:#64748b;">(${rep.studentClass || 'Student'})</span></span>
            <span style="font-size:0.75rem; color:#64748b;">${repTime}</span>
          </div>
          <div class="reply-body">${escapeHtml(rep.replyBody)}</div>
        </div>
      `;
    });

    repliesContainer.innerHTML = html;
    repliesContainer.scrollTop = repliesContainer.scrollHeight;
  } catch (err) {
    console.error("Error loading replies:", err);
    repliesContainer.innerHTML = `<div class="loading-state" style="color:#ef4444;">Failed to load conversation replies.</div>`;
  }
}

// Submit a student/teacher reply
async function submitReply(threadId) {
  const inputEl = document.getElementById('replyMessageInput');
  if (!inputEl) return;
  const replyBody = inputEl.value.trim();

  if (!replyBody) {
    alert("Please enter a reply message before submitting.");
    return;
  }

  // Retrieve active user info from localStorage or session (fallback to defaults if testing)
  const studentName = localStorage.getItem('activeStudentName') || sessionStorage.getItem('userName') || 'Learner';
  const studentClass = localStorage.getItem('activeStudentClass') || sessionStorage.getItem('userClass') || 'Senior ICT';

  try {
    await db.collection('forum_threads').doc(threadId).collection('replies').add({
      studentName: studentName,
      studentClass: studentClass,
      replyBody: replyBody,
      submittedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    inputEl.value = '';
    loadThreadReplies(threadId);
  } catch (err) {
    console.error("Error submitting reply:", err);
    alert("Failed to post reply: " + err.message);
  }
}

// Modal Controls for Creating a New Discussion
function openNewThreadModal() {
  const modal = document.getElementById('newThreadModal');
  if (modal) modal.style.display = 'flex';
}

function closeNewThreadModal() {
  const modal = document.getElementById('newThreadModal');
  if (modal) modal.style.display = 'none';
  document.getElementById('newThreadForm').reset();
}

// Handle Teacher Creation of New Discussion
async function handleCreateThread(e) {
  e.preventDefault();

  const title = document.getElementById('threadTitleInput').value.trim();
  const classTarget = document.getElementById('threadClassInput').value;
  const body = document.getElementById('threadBodyInput').value.trim();
  const authorName = localStorage.getItem('userName') || 'ICT Instructor';

  if (!title || !body) return;

  try {
    const newDoc = {
      title,
      classTarget,
      body,
      authorName,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('forum_threads').add(newDoc);
    closeNewThreadModal();
    
    // Prepend and select the new thread
    globalThreads.unshift({ id: docRef.id, ...newDoc });
    renderThreadsList(globalThreads);
    selectThread(docRef.id);

  } catch (err) {
    console.error("Error creating discussion thread:", err);
    alert("Failed to create thread: " + err.message);
  }
}

// Utility to prevent XSS injection
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
}
