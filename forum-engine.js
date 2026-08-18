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
const storage = typeof firebase !== "undefined" && firebase.storage ? firebase.storage() : null;

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

  updateClassFilterDropdown(session, isTeacherOrAdmin);
  filterForumThreads();
}

// Dynamically populate or restrict the class filter dropdown based on user role and class
function updateClassFilterDropdown(session, isTeacherOrAdmin) {
  const classFilterSelect = document.getElementById('classFilterSelect');
  if (!classFilterSelect) return;

  const currentSelection = classFilterSelect.value;
  let optionsHtml = '';

  if (isTeacherOrAdmin) {
    // Teachers and admins can filter across all classes
    optionsHtml = `
      <option value="">All Classes (General & Specific)</option>
      <option value="General">General</option>
      <option value="S.1">Senior One (S.1)</option>
      <option value="S.2">Senior Two (S.2)</option>
      <option value="S.3">Senior Three (S.3)</option>
      <option value="S.4">Senior Four (S.4)</option>
      <option value="S.5">Senior Five (S.5)</option>
      <option value="S.6">Senior Six (S.6)</option>
    `;
  } else {
    // Students are restricted to their own class and General
    const userCls = (session.userClass || 'S.1').trim();
    optionsHtml = `
      <option value="">All Available (${userCls} & General)</option>
      <option value="${escapeHtml(userCls)}">${escapeHtml(userCls)}</option>
      <option value="General">General</option>
    `;
  }

  classFilterSelect.innerHTML = optionsHtml;

  // Restore previous selection if still valid, otherwise default to empty
  if (Array.from(classFilterSelect.options).some(opt => opt.value === currentSelection)) {
    classFilterSelect.value = currentSelection;
  } else {
    classFilterSelect.value = '';
  }
}

// Initialize real-time forum listeners on load and sync initial session
document.addEventListener("DOMContentLoaded", () => {
  // Restore saved filter from localStorage if available
  const savedFilter = localStorage.getItem('samcam_forum_class_filter');
  const classFilterSelect = document.getElementById('classFilterSelect');
  if (savedFilter && classFilterSelect) {
    classFilterSelect.value = savedFilter;
  }

  // Add change listener to persist filter selections across page refreshes
  if (classFilterSelect) {
    classFilterSelect.addEventListener('change', (e) => {
      localStorage.setItem('samcam_forum_class_filter', e.target.value);
      filterForumThreads();
    });
  }

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

  const session = getCurrentUserSession();
  const bookmarks = JSON.parse(localStorage.getItem(`samcam_bookmarks_${session.name}`) || '[]');

  let html = '';
  threads.forEach(thread => {
    const timeAgo = thread.createdAt && thread.createdAt.toDate 
      ? new Date(thread.createdAt.toDate()).toLocaleDateString() 
      : 'Recent';

    const isActive = activeThreadId === thread.id ? 'active' : '';
    const upvotesCount = (thread.upvotedBy || []).length;
    const isBookmarked = bookmarks.includes(thread.id);

    html += `
      <div class="thread-card ${isActive}" onclick="selectThread('${thread.id}')">
        <div class="thread-meta-top" style="display:flex; justify-content:space-between; align-items:center;">
          <span class="class-badge">${escapeHtml(thread.classTarget || 'General')}</span>
          <div>
            <button class="btn btn-xs btn-outline" style="border:none; padding:0.1rem 0.3rem;" onclick="event.stopPropagation(); toggleBookmark('${thread.id}')" title="Bookmark Thread">
              <i class="fa-${isBookmarked ? 'solid' : 'regular'} fa-bookmark" style="${isBookmarked ? 'color:#10b981;' : ''}"></i>
            </button>
            <span class="thread-time" style="margin-left:0.3rem;"><i class="fa-solid fa-thumbs-up"></i> ${upvotesCount} • ${timeAgo}</span>
          </div>
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
    const target = (t.classTarget || 'General').trim().toLowerCase();

    // Restrict students strictly to their class or General
    if (!isTeacherOrAdmin) {
      const studentCls = (session.userClass || '').trim().toLowerCase();
      const matchesStudentClass = target === 'general' || target === studentCls;
      if (!matchesStudentClass) return false;
    }

    const matchesQuery = t.title.toLowerCase().includes(query) || t.body.toLowerCase().includes(query);
    const matchesClassDropdown = !selectedClass || target === selectedClass.trim().toLowerCase();

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
  const bookmarks = JSON.parse(localStorage.getItem(`samcam_bookmarks_${session.name}`) || '[]');
  const isBookmarked = bookmarks.includes(thread.id);

  detailPane.innerHTML = `
    <div class="active-thread-header">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
        <span class="class-badge">${escapeHtml(thread.classTarget || 'General')}</span>
        <div>
          <button class="btn btn-sm ${isBookmarked ? 'btn-primary' : 'btn-outline'}" onclick="toggleBookmark('${thread.id}')" title="Save for later">
            <i class="fa-${isBookmarked ? 'solid' : 'regular'} fa-bookmark"></i> ${isBookmarked ? 'Saved' : 'Save'}
          </button>
          <button class="btn btn-sm btn-outline" onclick="generateAiSummary('${thread.id}')" title="AI Summary & Hint">
            <i class="fa-solid fa-wand-magic-sparkles" style="color:#8b5cf6;"></i> AI Assistant
          </button>
          <button class="btn btn-sm ${hasUpvoted ? 'btn-primary' : 'btn-outline'}" onclick="toggleThreadUpvote('${thread.id}')">
            <i class="fa-solid fa-thumbs-up"></i> <span id="threadUpvoteCount">${upvotesCount}</span>
          </button>
          <span style="font-size:0.75rem; color:#64748b; margin-left:0.5rem;">Posted by <strong>${escapeHtml(thread.authorName || 'Instructor')}</strong></span>
        </div>
      </div>
      <h3>${escapeHtml(thread.title)}</h3>
      <div class="active-thread-body">${formatRichContent(thread.body)}</div>
      ${thread.mediaUrl ? `<div style="margin-top:0.5rem;"><a href="${thread.mediaUrl}" target="_blank" class="btn btn-xs btn-outline"><i class="fa-solid fa-paperclip"></i> View Attached File / Screenshot</a></div>` : ''}
    </div>

    <!-- Feature 1: AI Summary Container -->
    <div id="aiSummaryBox" style="display:none; background:#f5f3ff; border:1px solid #c4b5fd; padding:0.75rem; border-radius:6px; margin-bottom:1rem; font-size:0.85rem; color:#4c1d95;">
      <div style="font-weight:bold; margin-bottom:0.25rem;"><i class="fa-solid fa-robot"></i> AI Summary & Hints</div>
      <div id="aiSummaryContent">Analyzing discussion...</div>
    </div>

    <div class="replies-list-container" id="repliesListContainer">
      <div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading live replies...</div>
    </div>

    <div id="typingIndicator" style="font-size:0.75rem; color:#64748b; font-style:italic; padding:0 0.5rem 0.25rem 0.5rem; min-height:1.2rem;"></div>

    <div class="reply-input-box" style="display:flex; flex-direction:column; gap:0.5rem;">
      <textarea id="replyMessageInput" placeholder="Write your reply, code snippet or formula here (Use &#96;&#96;&#96;code&#96;&#96;&#96; for blocks)..." oninput="handleTypingInput('${thread.id}')"></textarea>
      
      <!-- Feature 3: Multimedia Attachments Toolbar -->
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; gap:0.5rem; align-items:center;">
          <label class="btn btn-xs btn-outline" style="cursor:pointer; font-size:0.75rem;">
            <i class="fa-solid fa-image"></i> Add Image/File <input type="file" id="replyAttachmentInput" style="display:none;" onchange="previewAttachmentName()">
          </label>
          <span id="attachmentFileName" style="font-size:0.75rem; color:#64748b;"></span>
          <button type="button" class="btn btn-xs btn-outline" id="recordAudioBtn" onclick="toggleAudioRecording()" style="font-size:0.75rem;"><i class="fa-solid fa-microphone"></i> Voice Note</button>
        </div>
        <button class="btn btn-primary" onclick="submitReply('${thread.id}')"><i class="fa-solid fa-paper-plane"></i> Reply</button>
      </div>
    </div>
  `;

  loadThreadRepliesRealtime(thread.id);
  listenToTypingIndicator(thread.id);
}

// Feature 1: AI Summary & Hint Generator
async function generateAiSummary(threadId) {
  const box = document.getElementById('aiSummaryBox');
  const content = document.getElementById('aiSummaryContent');
  if (!box || !content) return;

  box.style.display = 'block';
  content.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Generating intelligent breakdown and hint...`;

  try {
    const thread = globalThreads.find(t => t.id === threadId);
    const repliesSnapshot = await db.collection('forum_threads').doc(threadId).collection('replies').get();
    
    let replyTexts = [];
    repliesSnapshot.forEach(doc => {
      replyTexts.push(doc.data().replyBody);
    });

    // Simulated Smart Synthesis or custom API call integration point
    setTimeout(() => {
      let summaryHtml = `<strong>Key Takeaways:</strong> ${thread.title} addresses core concepts in ${thread.classTarget || 'General'}.<br>`;
      if (replyTexts.length > 0) {
        summaryHtml += `<strong>Community Consensus:</strong> ${replyTexts.length} peer response(s) provided code snippets and discussions.<br>`;
        summaryHtml += `<em>Pedagogical Hint:</em> Review inline code definitions and verify syntax indentation before running compilation.`;
      } else {
        summaryHtml += `<em>Pedagogical Hint:</em> No peer replies yet! Be the first to break down the problem or share a hint.`;
      }
      content.innerHTML = summaryHtml;
    }, 800);
  } catch (err) {
    content.innerHTML = `<span style="color:#ef4444;">Unable to generate summary at this moment.</span>`;
  }
}

// Feature 2: Thread Bookmarking / Read Later
function toggleBookmark(threadId) {
  const session = getCurrentUserSession();
  if (!session.name) {
    alert("Please sign in to bookmark discussions.");
    return;
  }
  const key = `samcam_bookmarks_${session.name}`;
  let bookmarks = JSON.parse(localStorage.getItem(key) || '[]');

  if (bookmarks.includes(threadId)) {
    bookmarks = bookmarks.filter(id => id !== threadId);
  } else {
    bookmarks.push(threadId);
  }

  localStorage.setItem(key, JSON.stringify(bookmarks));
  filterForumThreads();
  if (activeThreadId === threadId) {
    selectThread(threadId);
  }
}

// Feature 3: Audio Recording State Variables & Handlers
let mediaRecorder = null;
let audioChunks = [];
let recordedAudioBlob = null;

function toggleAudioRecording() {
  const btn = document.getElementById('recordAudioBtn');
  const fileLabel = document.getElementById('attachmentFileName');

  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
      mediaRecorder.onstop = () => {
        recordedAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        fileLabel.innerHTML = `<i class="fa-solid fa-microphone-lines text-success"></i> Voice note recorded (ready to send)`;
        btn.innerHTML = `<i class="fa-solid fa-microphone"></i> Re-record`;
      };
      mediaRecorder.start();
      btn.innerHTML = `<i class="fa-solid fa-stop" style="color:red;"></i> Stop Recording`;
      fileLabel.innerHTML = `Recording voice note...`;
    }).catch(err => {
      alert("Microphone access denied or unsupported.");
    });
  } else {
    mediaRecorder.stop();
  }
}

function previewAttachmentName() {
  const fileInput = document.getElementById('replyAttachmentInput');
  const fileLabel = document.getElementById('attachmentFileName');
  if (fileInput && fileInput.files[0]) {
    fileLabel.innerText = fileInput.files[0].name;
  }
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

        // Feature 5: Gamification Badge Logic based on Upvotes
        let badgeHtml = '';
        if (upvotes >= 5) {
          badgeHtml = `<span style="background:#fef3c7; color:#d97706; padding:0.05rem 0.3rem; border-radius:3px; font-size:0.65rem; margin-left:0.3rem; font-weight:600;"><i class="fa-solid fa-medal"></i> Code Wizard</span>`;
        } else if (rep.isBestAnswer) {
          badgeHtml = `<span style="background:#e0e7ff; color:#4338ca; padding:0.05rem 0.3rem; border-radius:3px; font-size:0.65rem; margin-left:0.3rem; font-weight:600;"><i class="fa-solid fa-star"></i> Top Contributor</span>`;
        }

        html += `
          <div class="reply-item ${rep.isBestAnswer ? 'best-answer-card' : ''}" style="${rep.isBestAnswer ? 'border-left: 4px solid #10b981; background: #f0fdf4;' : ''}">
            <div class="reply-meta">
              <span class="reply-author">${escapeHtml(rep.studentName)} <span style="font-weight:normal; color:#64748b;">(${escapeHtml(rep.studentClass || 'Student')})</span> ${badgeHtml} ${isBest}</span>
              <span style="font-size:0.75rem; color:#64748b;">${repTime}</span>
            </div>
            <div class="reply-body">${formatRichContent(rep.replyBody)}</div>
            ${rep.mediaUrl ? `<div style="margin-top:0.4rem;"><a href="${rep.mediaUrl}" target="_blank" class="btn btn-xs btn-outline"><i class="fa-solid fa-paperclip"></i> Attachment / Voice Note</a></div>` : ''}
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

// Feature 4: Automated Content Moderation & Toxicity Filter Check
function containsInappropriateContent(text) {
  const bannedKeywords = ['spam', 'abusekeyword1', 'abusekeyword2']; // Expand as needed for institution policy
  const lower = text.toLowerCase();
  return bannedKeywords.some(word => lower.includes(word));
}

// Submit a student/teacher reply with attachments & moderation support
async function submitReply(threadId) {
  const inputEl = document.getElementById('replyMessageInput');
  if (!inputEl) return;
  const replyBody = inputEl.value.trim();

  if (!replyBody && !recordedAudioBlob && !document.getElementById('replyAttachmentInput')?.files[0]) {
    alert("Please enter a reply message or attach a file/voice note before submitting.");
    return;
  }

  // Feature 4 check
  if (containsInappropriateContent(replyBody)) {
    alert("Your reply contains flagged words that violate school forum guidelines. Please revise your message.");
    return;
  }

  const session = getCurrentUserSession();
  const studentName = session.name || 'Learner';
  const studentClass = session.userClass || 'Senior ICT';

  try {
    let mediaUrl = '';
    const fileInput = document.getElementById('replyAttachmentInput');

    if (storage && fileInput && fileInput.files[0]) {
      const file = fileInput.files[0];
      const storageRef = storage.ref().child(`forum_attachments/${Date.now()}_${file.name}`);
      const snapshot = await storageRef.put(file);
      mediaUrl = await snapshot.ref.getDownloadURL();
    } else if (storage && recordedAudioBlob) {
      const storageRef = storage.ref().child(`forum_audio/${Date.now()}_voicenote.webm`);
      const snapshot = await storageRef.put(recordedAudioBlob);
      mediaUrl = await snapshot.ref.getDownloadURL();
    }

    await db.collection('forum_threads').doc(threadId).collection('replies').add({
      studentName: studentName,
      studentClass: studentClass,
      replyBody: replyBody || '(Voice Note / Attachment)',
      mediaUrl: mediaUrl,
      upvotedBy: [],
      isBestAnswer: false,
      submittedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    inputEl.value = '';
    if (fileInput) fileInput.value = '';
    recordedAudioBlob = null;
    const fileLabel = document.getElementById('attachmentFileName');
    if (fileLabel) fileLabel.innerHTML = '';
    const audioBtn = document.getElementById('recordAudioBtn');
    if (audioBtn) audioBtn.innerHTML = `<i class="fa-solid fa-microphone"></i> Voice Note`;

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

// Handle Teacher Creation of New Discussion with Safety check
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

  if (containsInappropriateContent(title) || containsInappropriateContent(body)) {
    alert("Thread title or content violates school content moderation standards.");
    return;
  }

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
