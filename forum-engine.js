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

  document.querySelectorAll('.teacher-only').forEach(el => {
    el.style.display = isTeacherOrAdmin ? 'inline-flex' : 'none';
  });

  updateClassFilterDropdown(session, isTeacherOrAdmin);
  filterForumThreads();
}

function updateClassFilterDropdown(session, isTeacherOrAdmin) {
  const classFilterSelect = document.getElementById('classFilterSelect');
  if (!classFilterSelect) return;

  const currentSelection = classFilterSelect.value;
  let optionsHtml = '';

  if (isTeacherOrAdmin) {
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
    const userCls = (session.userClass || 'S.1').trim();
    optionsHtml = `
      <option value="">All Available (${userCls} & General)</option>
      <option value="${escapeHtml(userCls)}">${escapeHtml(userCls)}</option>
      <option value="General">General</option>
    `;
  }

  classFilterSelect.innerHTML = optionsHtml;

  if (Array.from(classFilterSelect.options).some(opt => opt.value === currentSelection)) {
    classFilterSelect.value = currentSelection;
  } else {
    classFilterSelect.value = '';
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const savedFilter = localStorage.getItem('samcam_forum_class_filter');
  const classFilterSelect = document.getElementById('classFilterSelect');
  if (savedFilter && classFilterSelect) {
    classFilterSelect.value = savedFilter;
  }

  if (classFilterSelect) {
    classFilterSelect.addEventListener('change', (e) => {
      localStorage.setItem('samcam_forum_class_filter', e.target.value);
      filterForumThreads();
    });
  }

  syncForumEngineSession();
  initRealtimeForumThreads();
});

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

async function selectThread(threadId) {
  activeThreadId = threadId;
  filterForumThreads();

  const thread = globalThreads.find(t => t.id === threadId);
  const detailPane = document.getElementById('threadDetailPane');
  if (!thread || !detailPane) return;

  const session = getCurrentUserSession();
  const userId = session.name || 'Anonymous';
  const role = (session.role || session.userType || session.type || '').toLowerCase();
  const isTeacherOrAdmin = role.includes('teacher') || role.includes('admin') || role.includes('instructor') || role.includes('staff');
  const isAuthor = thread.authorName === session.name;

  const hasUpvoted = (thread.upvotedBy || []).includes(userId);
  const upvotesCount = (thread.upvotedBy || []).length;
  const bookmarks = JSON.parse(localStorage.getItem(`samcam_bookmarks_${session.name}`) || '[]');
  const isBookmarked = bookmarks.includes(thread.id);

  detailPane.innerHTML = 
    '<div class="active-thread-header">' +
      '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; flex-wrap:wrap; gap:0.5rem;">' +
        '<span class="class-badge">' + escapeHtml(thread.classTarget || 'General') + '</span>' +
        '<div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">' +
          '<button class="btn btn-sm ' + (isBookmarked ? 'btn-primary' : 'btn-outline') + '" onclick="toggleBookmark(\'' + thread.id + '\')" title="Save for later">' +
            '<i class="fa-' + (isBookmarked ? 'solid' : 'regular') + ' fa-bookmark" aria-hidden="true"></i> ' + (isBookmarked ? 'Saved' : 'Save') +
          '</button>' +
          '<button class="btn btn-sm btn-outline" onclick="generateAiSummary(\'' + thread.id + '\')" title="AI Summary & Hint">' +
            '<i class="fa-solid fa-wand-magic-sparkles" style="color:#8b5cf6;" aria-hidden="true"></i> AI Assistant' +
          '</button>' +
          '<button class="btn btn-sm ' + (hasUpvoted ? 'btn-primary' : 'btn-outline') + '" onclick="toggleThreadUpvote(\'' + thread.id + '\')" title="Upvote discussion">' +
            '<i class="fa-solid fa-thumbs-up" aria-hidden="true"></i> <span id="threadUpvoteCount">' + upvotesCount + '</span>' +
          '</button>' +
          (isAuthor || isTeacherOrAdmin ? '<button class="btn btn-sm btn-outline" onclick="openEditThreadModal(\'' + thread.id + '\')" title="Edit Thread"><i class="fa-solid fa-pen-to-square"></i></button>' : '') +
          (isAuthor || isTeacherOrAdmin ? '<button class="btn btn-sm btn-outline" style="color:#ef4444; border-color:#fca5a5;" onclick="confirmDeleteThread(\'' + thread.id + '\')" title="Delete Thread"><i class="fa-solid fa-trash"></i></button>' : '') +
          '<span style="font-size:0.75rem; color:#64748b; margin-left:0.25rem;">Posted by <strong>' + escapeHtml(thread.authorName || 'Instructor') + '</strong></span>' +
        '</div>' +
      '</div>' +
      '<h3>' + escapeHtml(thread.title) + '</h3>' +
      '<div class="active-thread-body">' + formatRichContent(thread.body) + '</div>' +
      (thread.mediaUrl ? '<div style="margin-top:0.5rem;"><a href="' + thread.mediaUrl + '" target="_blank" class="btn btn-xs btn-outline"><i class="fa-solid fa-paperclip"></i> View Attached File / Screenshot</a></div>' : '') +
    '</div>' +

    '<div id="aiSummaryBox" style="display:none; background:#f5f3ff; border:1px solid #c4b5fd; padding:0.75rem; border-radius:6px; margin-bottom:1rem; font-size:0.85rem; color:#4c1d95;">' +
      '<div style="font-weight:bold; margin-bottom:0.25rem;"><i class="fa-solid fa-robot"></i> AI Summary & Hints</div>' +
      '<div id="aiSummaryContent">Analyzing discussion...</div>' +
    '</div>' +

    '<div class="replies-list-container" id="repliesListContainer">' +
      '<div class="skeleton-loader" style="width: 100%;"></div>' +
      '<div class="skeleton-loader" style="width: 80%;"></div>' +
      '<div class="skeleton-loader" style="width: 60%;"></div>' +
    '</div>' +

    '<div id="typingIndicator" style="font-size:0.75rem; color:#64748b; font-style:italic; padding:0 0.5rem 0.25rem 0.5rem; min-height:1.2rem;"></div>' +

    '<div style="display:flex; justify-content:space-between; align-items:center; padding:0 0.25rem; margin-bottom:0.25rem;">' +
      '<div class="comment-toolbar" style="display:flex; gap:0.4rem;">' +
        '<button type="button" class="btn btn-xs btn-outline" onclick="insertMarkdown(\'**\', \'**\')" title="Bold"><i class="fa-solid fa-bold"></i></button>' +
        '<button type="button" class="btn btn-xs btn-outline" onclick="insertMarkdown(\'*\', \'*\')" title="Italic"><i class="fa-solid fa-italic"></i></button>' +
        '<button type="button" class="btn btn-xs btn-outline" onclick="insertMarkdown(\'`\', \'`\')" title="Code"><i class="fa-solid fa-code"></i></button>' +
        '<button type="button" class="btn btn-xs btn-outline" onclick="insertMarkdown(\'\\n```\\n\', \'\\n```\\n\')" title="Code Block"><i class="fa-solid fa-file-code"></i></button>' +
      '</div>' +
      '<div class="input-tabs">' +
        '<button type="button" class="input-tab-btn active" id="writeTabBtn" onclick="switchInputTab(\'write\')">Write</button>' +
        '<button type="button" class="input-tab-btn" id="previewTabBtn" onclick="switchInputTab(\'preview\')">Preview</button>' +
      '</div>' +
    '</div>' +

    '<div class="reply-input-box" style="display:flex; flex-direction:column; gap:0.5rem;">' +
      '<textarea id="replyMessageInput" placeholder="Write your reply, code snippet or formula here (Use ```code``` for blocks)..." oninput="handleTypingInput(\'' + thread.id + '\')"></textarea>' +
      '<div style="display:flex; justify-content:flex-end; align-items:center;">' +
        '<button class="btn btn-primary" onclick="submitReplyOptimistic(\'' + thread.id + '\')"><i class="fa-solid fa-paper-plane"></i> Send</button>' +
      '</div>' +
    '</div>';

  loadThreadRepliesRealtime(thread.id);
  listenToTypingIndicator(thread.id);
}

function insertMarkdown(wrapperStart, wrapperEnd) {
  const textarea = document.getElementById('replyMessageInput');
  if (!textarea) return;
  
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selectedText = text.substring(start, end) || 'text';
  
  textarea.value = text.substring(0, start) + wrapperStart + selectedText + wrapperEnd + text.substring(end);
  textarea.focus();
  textarea.setSelectionRange(start + wrapperStart.length, start + wrapperStart.length + selectedText.length);
}

function switchInputTab(mode) {
  const textarea = document.getElementById('replyMessageInput');
  const previewPane = document.getElementById('markdownPreviewPane');
  const writeBtn = document.getElementById('writeTabBtn');
  const previewBtn = document.getElementById('previewTabBtn');

  if (mode === 'preview') {
    if (previewPane) {
      previewPane.innerHTML = (typeof formatRichContent === 'function') 
        ? formatRichContent(textarea ? textarea.value : '') || '*Nothing to preview yet.*'
        : (textarea ? textarea.value : '*Nothing to preview yet.*');
      previewPane.style.display = 'block';
    }
    if (textarea) textarea.style.display = 'none';
    if (writeBtn) writeBtn.classList.remove('active');
    if (previewBtn) previewBtn.classList.add('active');
  } else {
    if (previewPane) previewPane.style.display = 'none';
    if (textarea) {
      textarea.style.display = 'block';
      textarea.focus();
    }
    if (writeBtn) writeBtn.classList.add('active');
    if (previewBtn) previewBtn.classList.remove('active');
  }
}
function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = (el.scrollHeight) + 'px';
}

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

function setDirectReply(authorName, commentSnippet) {
  const inputEl = document.getElementById('replyMessageInput');
  if (!inputEl) return;
  const cleanSnippet = commentSnippet.length > 50 ? commentSnippet.substring(0, 50) + '...' : commentSnippet;
  inputEl.value = `> Replying to @${authorName}: "${cleanSnippet}"\n`;
  inputEl.focus();
}

function enableEditComment(threadId, replyId, currentBody) {
  const bodyDiv = document.getElementById(`reply-body-${replyId}`);
  if (!bodyDiv) return;

  bodyDiv.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:0.4rem; margin:0.3rem 0;">
      <textarea id="edit-textarea-${replyId}" style="width:100%; min-height:60px; padding:0.4rem; border:1px solid #cbd5e1; border-radius:4px; font-size:0.9rem;">${currentBody}</textarea>
      <div style="display:flex; gap:0.4rem;">
        <button class="btn btn-xs btn-primary" onclick="saveEditedComment('${threadId}', '${replyId}')"><i class="fa-solid fa-check"></i> Save</button>
        <button class="btn btn-xs btn-outline" onclick="cancelEditComment('${threadId}', '${replyId}', \`${escapeHtml(currentBody).replace(/\\/g, '\\\\').replace(/`/g, '\\`')}\`)">Cancel</button>
      </div>
    </div>
  `;
}

function cancelEditComment(threadId, replyId, originalBody) {
  const bodyDiv = document.getElementById(`reply-body-${replyId}`);
  if (bodyDiv) {
    bodyDiv.innerHTML = formatRichContent(originalBody);
  }
}

async function saveEditedComment(threadId, replyId) {
  const textarea = document.getElementById(`edit-textarea-${replyId}`);
  if (!textarea) return;
  const updatedBody = textarea.value.trim();

  if (!updatedBody) {
    alert("Comment cannot be empty.");
    return;
  }

  try {
    await db.collection('forum_threads').doc(threadId).collection('replies').doc(replyId).update({
      replyBody: updatedBody,
      editedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error("Error updating comment:", err);
    alert("Failed to update comment: " + err.message);
  }
}

async function deleteComment(threadId, replyId, authorName) {
  const session = getCurrentUserSession();
  const combinedCheck = `${session.role} ${session.name}`.toLowerCase();
  const isTeacherOrAdmin = combinedCheck.includes('teacher') || 
                           combinedCheck.includes('admin') || 
                           combinedCheck.includes('instructor') ||
                           combinedCheck.includes('staff');
  
  const isOwner = session.name && session.name.toLowerCase() === authorName.toLowerCase();

  if (!isTeacherOrAdmin && !isOwner) {
    alert("You do not have permission to delete this comment.");
    return;
  }

  if (!confirm("Are you sure you want to delete this comment?")) return;

  try {
    await db.collection('forum_threads').doc(threadId).collection('replies').doc(replyId).delete();
  } catch (err) {
    console.error("Error deleting comment:", err);
    alert("Failed to delete comment: " + err.message);
  }
}

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

        const isOwner = session.name && session.name.toLowerCase() === (rep.studentName || '').toLowerCase();
        const showActionButtons = isTeacherOrAdmin || isOwner;
        
        const editBtnHtml = showActionButtons ? `<button class="btn btn-xs btn-outline" style="font-size:0.7rem; padding:0.1rem 0.3rem;" onclick="enableEditComment('${threadId}', '${repId}', \`${escapeHtml(rep.replyBody).replace(/\\/g, '\\\\').replace(/`/g, '\\`')}\`)"><i class="fa-solid fa-pen"></i> Edit</button>` : '';
        const deleteBtnHtml = showActionButtons ? `<button class="btn btn-xs btn-outline" style="font-size:0.7rem; padding:0.1rem 0.3rem; color:#ef4444; border-color:#fca5a5;" onclick="deleteComment('${threadId}', '${repId}', '${escapeHtml(rep.studentName)}')"><i class="fa-solid fa-trash"></i> Delete</button>` : '';

        let mediaHtml = '';
        if (rep.mediaUrl) {
          if (rep.mediaUrl.includes('forum_audio') || rep.mediaUrl.includes('.webm') || rep.mediaUrl.includes('.mp3')) {
            mediaHtml = `<div style="margin-top:0.5rem; background:#f1f5f9; padding:0.5rem; border-radius:6px; display:inline-block; width:100%; max-width:340px;"><audio controls style="height:36px; width:100%; display:block;"><source src="${rep.mediaUrl}" type="audio/webm">Your browser does not support the audio element.</audio></div>`;
          } else {
            mediaHtml = `<div style="margin-top:0.4rem;"><a href="${rep.mediaUrl}" target="_blank" class="btn btn-xs btn-outline"><i class="fa-solid fa-paperclip"></i> View Attached File / Screenshot</a></div>`;
          }
        }

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
              <span style="font-size:0.75rem; color:#64748b;">${repTime} ${rep.editedAt ? '(Edited)' : ''}</span>
            </div>
            <div class="reply-body" id="reply-body-${repId}">${formatRichContent(rep.replyBody)}</div>
            ${mediaHtml}
            <div class="reply-footer" style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem;">
              <div style="display:flex; gap:0.5rem; align-items:center;">
                <button class="btn btn-sm btn-outline" style="font-size:0.75rem;" onclick="toggleReplyUpvote('${threadId}', '${repId}')">
                  <i class="fa-solid fa-thumbs-up"></i> ${(rep.upvotedBy || []).length} Helpful
                </button>
                <button class="btn btn-sm btn-outline" style="font-size:0.75rem;" onclick="setDirectReply('${escapeHtml(rep.studentName)}', '${escapeHtml(rep.replyBody)}')">
                  <i class="fa-solid fa-reply"></i> Reply
                </button>
              </div>
              <div style="display:flex; gap:0.3rem;">
                ${bestAnswerBtn}
                ${editBtnHtml}
                ${deleteBtnHtml}
              </div>
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

function containsInappropriateContent(text) {
  const bannedKeywords = ['spam', 'abusekeyword1', 'abusekeyword2'];
  const lower = text.toLowerCase();
  return bannedKeywords.some(word => lower.includes(word));
}

async function submitReplyOptimistic(threadId) {
  const inputEl = document.getElementById('replyMessageInput');
  const fileInput = document.getElementById('replyAttachmentInput');
  if (!inputEl) return;
  
  const replyBody = inputEl.value.trim();
  const hasFile = fileInput && fileInput.files && fileInput.files.length > 0;
  const hasAudio = typeof recordedAudioBlob !== 'undefined' && recordedAudioBlob !== null;

  // Helper for triggering your custom system modal correctly
  const showCustomAlert = (title, message) => {
    if (typeof showSystemModal === 'function') {
      showSystemModal({
        title: title,
        message: message,
        isPrompt: false,
        onConfirm: () => {}
      });
    } else if (typeof window.showSystemModal === 'function') {
      window.showSystemModal({
        title: title,
        message: message,
        isPrompt: false,
        onConfirm: () => {}
      });
    } else {
      console.warn(message); // Avoid blocking native alert if custom modal is missing
    }
  };

  // Only alert if truly nothing is provided
  if (!replyBody && !hasAudio && !hasFile) {
    showCustomAlert("Notice", "Please enter a reply message or attach a file/voice note before submitting.");
    return;
  }

  if (replyBody && typeof containsInappropriateContent === 'function' && containsInappropriateContent(replyBody)) {
    showCustomAlert("Content Warning", "Your reply contains flagged words that violate school forum guidelines. Please revise your message.");
    return;
  }

  const session = (typeof getCurrentUserSession === 'function') ? getCurrentUserSession() : {};
  const studentName = session.name || session.fullName || 'Learner';
  const studentClass = session.userClass || session.classLevel || 'Senior ICT';

  // Optimistic UI injection
  const container = document.getElementById('repliesListContainer');
  if (container) {
    const tempHtml = `
      <div class="reply-item optimistic-fade" style="opacity:0.7; padding:0.75rem; border-bottom:1px solid #e2e8f0;">
        <div style="font-size:0.75rem; color:#64748b; margin-bottom:0.25rem;"><strong>${escapeHtml(studentName)}</strong> (Sending...)</div>
        <div>${formatRichContent(replyBody || (hasAudio ? '🎤 [Voice Note]' : '[Attached File]'))}</div>
      </div>
    `;
    if (container.querySelector('.skeleton-loader') || container.querySelector('.loading-state')) {
      container.innerHTML = '';
    }
    container.insertAdjacentHTML('beforeend', tempHtml);
    container.scrollTop = container.scrollHeight;
  }

  try {
    let mediaUrl = '';

    if (typeof storage !== 'undefined' && storage) {
      if (hasFile) {
        const file = fileInput.files[0];
        const storageRef = storage.ref().child(`forum_attachments/${Date.now()}_${file.name}`);
        const snapshot = await storageRef.put(file);
        mediaUrl = await snapshot.ref.getDownloadURL();
      } else if (hasAudio) {
        const storageRef = storage.ref().child(`forum_audio/${Date.now()}_voicenote.webm`);
        const snapshot = await storageRef.put(recordedAudioBlob);
        mediaUrl = await snapshot.ref.getDownloadURL();
      }
    }

    const finalBody = replyBody || (hasAudio ? '🎤 [Voice Note]' : '[Attached File]');

    await db.collection('forum_threads').doc(threadId).collection('replies').add({
      studentName: studentName,
      studentClass: studentClass,
      replyBody: finalBody,
      mediaUrl: mediaUrl,
      upvotedBy: [],
      isBestAnswer: false,
      submittedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    inputEl.value = '';
    inputEl.style.height = 'auto';
    if (typeof switchInputTab === 'function') switchInputTab('write');
    if (fileInput) fileInput.value = '';
    if (typeof recordedAudioBlob !== 'undefined') recordedAudioBlob = null;
    
    const fileLabel = document.getElementById('attachmentFileName');
    if (fileLabel) fileLabel.innerHTML = '';
    
    const audioBtn = document.getElementById('recordAudioBtn');
    if (audioBtn) audioBtn.innerHTML = `<i class="fa-solid fa-microphone"></i> Voice Note`;

    if (typeof clearTypingIndicator === 'function') clearTypingIndicator(threadId);
  } catch (err) {
    console.error("Error submitting reply:", err);
    showCustomAlert("Submission Error", "Failed to post reply: " + err.message);
  }
}
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

function strSafe(val) {
  return val !== null && val !== undefined && String(val).trim() !== '';
}

function formatRichContent(text) {
  if (!strSafe(text)) return '';
  let escaped = escapeHtml(text);

  // Code blocks
  escaped = escaped.replace(/```([\s\S]*?)```/g, '<pre style="background:#1e293b; color:#e2e8f0; padding:0.75rem; border-radius:6px; font-family:monospace; overflow-x:auto; margin:0.5rem 0;"><code>$1</code></pre>');
  // Inline code
  escaped = escaped.replace(/`([^`]+)`/g, '<code style="background:#e2e8f0; padding:0.1rem 0.3rem; border-radius:4px; font-family:monospace; font-size:0.85em; color:#0f172a;">$1</code>');
  // Bold (**text**)
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italics (*text*)
  escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  return escaped.replace(/\n/g, '<br>');
}

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

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
}
