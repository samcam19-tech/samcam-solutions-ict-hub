// ==========================================================================
// 1. FIREBASE INITIALIZATION & MOCK DATA
// ==========================================================================
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

// ==========================================================================
// 2. STATE MANAGEMENT, REAL-TIME LISTENERS & SESSION HANDLING
// ==========================================================================
let globalThreads = [];
let activeThreadId = null;
let unsubscribeThreads = null;
let unsubscribeReplies = null;
let typingTimeout = null;

// Listen for live session changes broadcasted by global auth scripts
window.addEventListener('portalSessionChanged', (e) => {
  syncForumEngineSession(e.detail);
});

function syncForumEngineSession(user) {
  const session = getCurrentUserSession(user);
  console.log("Synced Forum Session:", session);

  const combinedCheck = `${session.role} ${session.name} ${session.userClass}`.toLowerCase();
  const isTeacherOrAdmin = combinedCheck.includes('teacher') || 
                           combinedCheck.includes('admin') || 
                           combinedCheck.includes('instructor') ||
                           combinedCheck.includes('staff');

  // Show or hide teacher-only action buttons
  document.querySelectorAll('.teacher-only').forEach(el => {
    el.style.display = isTeacherOrAdmin ? 'inline-flex' : 'none';
  });

  filterForumThreads();
}

// Initialize real-time forum listeners on load and sync initial session
document.addEventListener("DOMContentLoaded", () => {
  syncForumEngineSession();
  initRealtimeForumThreads();
});

// Helper function using robust schema fallbacks
function getCurrentUserSession(userParam) {
  let activeUser = userParam || window.currentUser;

  if (!activeUser) {
    const sessionData = localStorage.getItem('portal_session') || sessionStorage.getItem('portal_session');
    if (sessionData) {
      try {
        activeUser = JSON.parse(sessionData);
      } catch (e) {
        console.error("Error parsing portal_session from localStorage:", e);
        activeUser = null;
      }
    }
  }

  let role = '';
  let name = '';
  let userClass = 'Senior ICT';

  if (activeUser && typeof activeUser === 'object') {
    role = activeUser.role || activeUser.userType || activeUser.type || activeUser.accessLevel || '';
    name = activeUser.fullName || activeUser.name || activeUser.username || '';
    userClass = activeUser.class || activeUser.userClass || 'Senior ICT';
  }

  return {
    role: (role || '').trim().toLowerCase(),
    name: (name || '').trim(),
    userClass: (userClass || 'Senior ICT').trim()
  };
}

// Feature 1: Real-time Listener for Threads Feed
function initRealtimeForumThreads() {
  const feedContainer = document.getElementById('threadsFeedContainer');
  if (!feedContainer) return;

  if (!db) {
    feedContainer.innerHTML = `<div class="loading-state" style="color:#ef4444;">Database connection unavailable.</div>`;
    return;
  }

  if (unsubscribeThreads) unsubscribeThreads();

  unsubscribeThreads = db.collection('forum_threads')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      globalThreads = [];
      snapshot.forEach(doc => {
        globalThreads.push({ id: doc.id, ...doc.data() });
      });
      filterForumThreads();
    }, err => {
      console.error("Real-time thread error:", err);
      feedContainer.innerHTML = `<div class="loading-state" style="color:#ef4444;">Failed to sync live discussions.</div>`;
    });
}

// Render threads feed list
function renderThreadsList(threads) {
  const feedContainer = document.getElementById('threadsFeedContainer');
  if (!feedContainer) return;

  if (threads.length === 0) {
    feedContainer.innerHTML = `<div class="loading-state">No matching discussions found for your class level.</div>`;
    return;
  }

  let html = '';
  threads.forEach(thread => {
    const timeAgo = thread.createdAt && thread.createdAt.toDate 
      ? new Date(thread.createdAt.toDate()).toLocaleDateString() 
      : 'Recent';

    const isActive = activeThreadId === thread.id ? 'active' : '';
    const upvotesCount = (thread.upvotedBy || []).length;

    html += `
      <div class="thread-card ${isActive}" onclick="selectThread('${thread.id}')">
        <div class="thread-meta-top">
          <span class="class-badge">${escapeHtml(thread.classTarget || 'General')}</span>
          <span class="thread-time"><i class="fa-solid fa-thumbs-up"></i> ${upvotesCount} • ${timeAgo}</span>
        </div>
        <h4>${escapeHtml(thread.title)}</h4>
        <div class="thread-snippet">${formatRichContent(thread.body)}</div>
      </div>
    `;
  });

  feedContainer.innerHTML = html;
}

// Filter threads by search query, class dropdown selection, and student session restriction
function filterForumThreads() {
  const query = document.getElementById('forumSearchInput')?.value.toLowerCase() || '';
  const selectedClass = document.getElementById('classFilterSelect')?.value || '';
  const session = getCurrentUserSession();

  const combinedCheck = `${session.role} ${session.name}`.toLowerCase();
  const isTeacherOrAdmin = combinedCheck.includes('teacher') || 
                           combinedCheck.includes('admin') || 
                           combinedCheck.includes('instructor') ||
                           combinedCheck.includes('staff');

  const filtered = globalThreads.filter(t => {
    if (!isTeacherOrAdmin) {
      const target = (t.classTarget || 'General').trim().toLowerCase();
      const studentCls = (session.userClass || '').trim().toLowerCase();
      const matchesStudentClass = target === 'general' || target === studentCls;
      if (!matchesStudentClass) return false;
    }

    const matchesQuery = t.title.toLowerCase().includes(query) || t.body.toLowerCase().includes(query);
    const matchesClassDropdown = !selectedClass || t.classTarget === selectedClass || t.classTarget === 'General';

    return matchesQuery && matchesClassDropdown;
  });

  renderThreadsList(filtered);
}

// Select a thread to view details, replies, and presence indicators
async function selectThread(threadId) {
  activeThreadId = threadId;
  filterForumThreads();

  const thread = globalThreads.find(t => t.id === threadId);
  const detailPane = document.getElementById('threadDetailPane');
  if (!thread || !detailPane) return;

  const session = getCurrentUserSession();
  const userId = session.name || 'Anonymous';
  const hasUpvoted = (thread.upvotedBy || []).includes(userId);
  const upvotesCount = (thread.upvotedBy || []).length;

  detailPane.innerHTML = `
    <div class="active-thread-header">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
        <span class="class-badge">${escapeHtml(thread.classTarget || 'General')}</span>
        <div>
          <button class="btn btn-sm ${hasUpvoted ? 'btn-primary' : 'btn-outline'}" onclick="toggleThreadUpvote('${thread.id}')">
            <i class="fa-solid fa-thumbs-up"></i> <span id="threadUpvoteCount">${upvotesCount}</span>
          </button>
          <span style="font-size:0.75rem; color:#64748b; margin-left:0.5rem;">Posted by <strong>${escapeHtml(thread.authorName || 'Instructor')}</strong></span>
        </div>
      </div>
      <h3>${escapeHtml(thread.title)}</h3>
      <div class="active-thread-body">${formatRichContent(thread.body)}</div>
    </div>

    <div class="replies-list-container" id="repliesListContainer">
      <div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading live replies...</div>
    </div>

    <div id="typingIndicator" style="font-size:0.75rem; color:#64748b; font-style:italic; padding:0 0.5rem 0.25rem 0.5rem; min-height:1.2rem;"></div>

    <div class="reply-input-box">
      <textarea id="replyMessageInput" placeholder="Write your reply, code snippet or formula here (Use &#96;&#96;&#96;code&#96;&#96;&#96; for blocks)..." oninput="handleTypingInput('${thread.id}')"></textarea>
      <button class="btn btn-primary" onclick="submitReply('${thread.id}')"><i class="fa-solid fa-paper-plane"></i> Reply</button>
    </div>
  `;

  loadThreadRepliesRealtime(thread.id);
  listenToTypingIndicator(thread.id);
}

// Feature 1 & 3 & 4: Real-Time Replies with Upvoting and Best Answer Marking
function loadThreadRepliesRealtime(threadId) {
  const repliesContainer = document.getElementById('repliesListContainer');
  if (!repliesContainer) return;

  if (unsubscribeReplies) unsubscribeReplies();

  const session = getCurrentUserSession();
  const combinedCheck = `${session.role} ${session.name}`.toLowerCase();
  const isTeacherOrAdmin = combinedCheck.includes('teacher') || combinedCheck.includes('admin') || combinedCheck.includes('instructor') || combinedCheck.includes('staff');

  unsubscribeReplies = db.collection('forum_threads')
    .doc(threadId)
    .collection('replies')
    .orderBy('submittedAt', 'asc')
    .onSnapshot(snapshot => {
      if (snapshot.empty) {
        repliesContainer.innerHTML = `<div class="loading-state" style="padding:1.5rem;">No replies yet. Be the first to contribute!</div>`;
        return;
      }

      let html = '';
      snapshot.forEach(doc => {
        const rep = doc.data();
        const repId = doc.id;
        const repTime = rep.submittedAt && rep.submittedAt.toDate 
          ? new Date(rep.submittedAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
          : 'Just now';

        const upvotes = rep.upvotedBy ? rep.upvotedBy.length : 0;
        const isBest = rep.isBestAnswer ? `<span class="badge-best" style="background:#10b981; color:#fff; padding:0.1rem 0.5rem; border-radius:4px; font-size:0.7rem; margin-left:0.5rem;"><i class="fa-solid fa-check-circle"></i> Best Answer</span>` : '';
        const bestAnswerBtn = isTeacherOrAdmin && !rep.isBestAnswer ? `<button class="btn btn-xs btn-outline" style="font-size:0.7rem; padding:0.1rem 0.3rem;" onclick="markBestAnswer('${threadId}', '${repId}')">Mark Best</button>` : '';

        html += `
          <div class="reply-item ${rep.isBestAnswer ? 'best-answer-card' : ''}" style="${rep.isBestAnswer ? 'border-left: 4px solid #10b981; background: #f0fdf4;' : ''}">
            <div class="reply-meta">
              <span class="reply-author">${escapeHtml(rep.studentName)} <span style="font-weight:normal; color:#64748b;">(${escapeHtml(rep.studentClass || 'Student')})</span> ${isBest}</span>
              <span style="font-size:0.75rem; color:#64748b;">${repTime}</span>
            </div>
            <div class="reply-body">${formatRichContent(rep.replyBody)}</div>
            <div class="reply-footer" style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem;">
              <button class="btn btn-sm btn-outline" style="font-size:0.75rem;" onclick="toggleReplyUpvote('${threadId}', '${repId}')">
                <i class="fa-solid fa-thumbs-up"></i> ${upvotes} Helpful
              </button>
              ${bestAnswerBtn}
            </div>
          </div>
        `;
      });

      repliesContainer.innerHTML = html;
      repliesContainer.scrollTop = repliesContainer.scrollHeight;
    }, err => {
      console.error("Replies sync error:", err);
      repliesContainer.innerHTML = `<div class="loading-state" style="color:#ef4444;">Failed to sync replies.</div>`;
    });
}

// Feature 3: Upvote Thread
async function toggleThreadUpvote(threadId) {
  const session = getCurrentUserSession();
  const userId = session.name;
  if (!userId) {
    alert("Please sign in to upvote discussions.");
    return;
  }

  const threadRef = db.collection('forum_threads').doc(threadId);
  const thread = globalThreads.find(t => t.id === threadId);
  if (!thread) return;

  let upvotedBy = thread.upvotedBy || [];
  if (upvotedBy.includes(userId)) {
    upvotedBy = upvotedBy.filter(id => id !== userId);
  } else {
    upvotedBy.push(userId);
  }

  try {
    await threadRef.update({ upvotedBy });
  } catch (err) {
    console.error("Error updating upvote:", err);
  }
}

// Feature 3: Upvote Reply
async function toggleReplyUpvote(threadId, replyId) {
  const session = getCurrentUserSession();
  const userId = session.name;
  if (!userId) {
    alert("Please sign in to vote.");
    return;
  }

  const replyRef = db.collection('forum_threads').doc(threadId).collection('replies').doc(replyId);
  try {
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(replyRef);
      if (!doc.exists) return;
      let upvotedBy = doc.data().upvotedBy || [];
      if (upvotedBy.includes(userId)) {
        upvotedBy = upvotedBy.filter(id => id !== userId);
      } else {
        upvotedBy.push(userId);
      }
      transaction.update(replyRef, { upvotedBy });
    });
  } catch (err) {
    console.error("Error upvoting reply:", err);
  }
}

// Feature 3: Teacher Marks Best Answer
async function markBestAnswer(threadId, replyId) {
  const repliesRef = db.collection('forum_threads').doc(threadId).collection('replies');
  try {
    const snapshot = await repliesRef.get();
    const batch = db.batch();
    snapshot.forEach(doc => {
      batch.update(doc.ref, { isBestAnswer: doc.id === replyId });
    });
    await batch.commit();
  } catch (err) {
    console.error("Error setting best answer:", err);
    alert("Failed to designate best answer.");
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

  const session = getCurrentUserSession();
  const studentName = session.name || 'Learner';
  const studentClass = session.userClass || 'Senior ICT';

  try {
    await db.collection('forum_threads').doc(threadId).collection('replies').add({
      studentName: studentName,
      studentClass: studentClass,
      replyBody: replyBody,
      upvotedBy: [],
      isBestAnswer: false,
      submittedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    inputEl.value = '';
    clearTypingIndicator(threadId);
  } catch (err) {
    console.error("Error submitting reply:", err);
    alert("Failed to post reply: " + err.message);
  }
}

// Feature 4: Typing Indicator Handlers
function handleTypingInput(threadId) {
  const session = getCurrentUserSession();
  const name = session.name || 'Someone';
  const typingRef = db.collection('forum_threads').doc(threadId).collection('presence').doc('typing');

  typingRef.set({ user: name, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});

  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    clearTypingIndicator(threadId);
  }, 3000);
}

function clearTypingIndicator(threadId) {
  db.collection('forum_threads').doc(threadId).collection('presence').doc('typing').delete().catch(() => {});
}

function listenToTypingIndicator(threadId) {
  db.collection('forum_threads').doc(threadId).collection('presence').doc('typing')
    .onSnapshot(doc => {
      const indicatorEl = document.getElementById('typingIndicator');
      if (!indicatorEl) return;
      if (!doc.exists) {
        indicatorEl.innerHTML = '';
        return;
      }
      const data = doc.data();
      const session = getCurrentUserSession();
      if (data.user && data.user !== session.name) {
        indicatorEl.innerHTML = `<i class="fa-solid fa-pen-nib fa-bounce"></i> ${escapeHtml(data.user)} is typing a response...`;
      } else {
        indicatorEl.innerHTML = '';
      }
    });
}

// Utility: Safe String Check Helper
function strSafe(val) {
  return val !== null && val !== undefined && String(val).trim() !== '';
}

// Feature 2: Rich Text & Code Snippets Formatting Helper
function formatRichContent(text) {
  if (!strSafe(text)) return '';
  let escaped = escapeHtml(text);

  // Format Code Blocks ```code```
  escaped = escaped.replace(/```([\s\S]*?)```/g, '<pre style="background:#1e293b; color:#e2e8f0; padding:0.75rem; border-radius:6px; font-family:monospace; overflow-x:auto; margin:0.5rem 0;"><code>$1</code></pre>');

  // Format Inline Code `code`
  escaped = escaped.replace(/`([^`]+)`/g, '<code style="background:#e2e8f0; padding:0.1rem 0.3rem; border-radius:4px; font-family:monospace; font-size:0.85em; color:#0f172a;">$1</code>');

  // Convert line breaks to HTML breaks
  return escaped.replace(/\n/g, '<br>');
}

// Modal Controls for Creating a New Discussion
function openNewThreadModal() {
  const modal = document.getElementById('newThreadModal');
  if (modal) modal.style.display = 'flex';
}

function closeNewThreadModal() {
  const modal = document.getElementById('newThreadModal');
  if (modal) modal.style.display = 'none';
  const form = document.getElementById('newThreadForm');
  if (form) form.reset();
}

// Handle Teacher Creation of New Discussion
async function handleCreateThread(e) {
  e.preventDefault();

  const session = getCurrentUserSession();
  const combinedCheck = `${session.role} ${session.name}`.toLowerCase();
  const isTeacherOrAdmin = combinedCheck.includes('teacher') || 
                           combinedCheck.includes('admin') || 
                           combinedCheck.includes('instructor') ||
                           combinedCheck.includes('staff');

  if (!isTeacherOrAdmin) {
    alert("Access Denied: Only teachers or administrators can post new discussion questions.");
    closeNewThreadModal();
    return;
  }

  const title = document.getElementById('threadTitleInput').value.trim();
  const classTarget = document.getElementById('threadClassInput').value;
  const body = document.getElementById('threadBodyInput').value.trim();
  const authorName = session.name || 'ICT Instructor';

  if (!title || !body) return;

  try {
    const newDoc = {
      title,
      classTarget,
      body,
      authorName,
      upvotedBy: [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('forum_threads').add(newDoc);
    closeNewThreadModal();
    selectThread(docRef.id);
  } catch (err) {
    console.error("Error creating discussion thread:", err);
    alert("Failed to create thread: " + err.message);
  }
}

// Utility to prevent XSS injection (Safely handles null, undefined, and numbers)
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
}
