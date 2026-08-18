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
      <option value="Senior 1">Senior 1</option>
      <option value="Senior 2">Senior 2</option>
      <option value="Senior 3">Senior 3</option>
      <option value="Senior 4">Senior 4</option>
      <option value="Senior 5">Senior 5</option>
      <option value="Senior 6">Senior 6</option>
    `;
  } else {
    const userCls = (session.userClass || 'Senior 1').trim();
    optionsHtml = `
      <option value="">All Available (${escapeHtml(userCls)} & General)</option>
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

// ==========================================================================
// 3. CUSTOM SYSTEM MODAL DIALOGS (REPLACING NATIVE ALERT & CONFIRM)
// ==========================================================================
let modalResolveCallback = null;

function showSystemAlert(message, title = "Notice") {
  return new Promise((resolve) => {
    const modal = document.getElementById('systemModal');
    if (!modal) {
      alert(message);
      resolve(true);
      return;
    }
    
    document.getElementById('systemModalTitleText').innerText = title;
    document.getElementById('systemModalMessage').innerText = message;
    
    const icon = document.getElementById('systemModalIcon');
    if (icon) {
      icon.className = "fa-solid fa-circle-info";
      icon.style.color = "#3b82f6";
    }

    const promptContainer = document.getElementById('systemModalPromptContainer');
    if (promptContainer) promptContainer.style.display = 'none';
    
    const cancelBtn = document.getElementById('systemModalCancelBtn');
    if (cancelBtn) cancelBtn.style.display = 'none';
    
    const okBtn = document.getElementById('systemModalOkBtn');
    if (okBtn) {
      okBtn.innerText = "OK";
      okBtn.className = "btn btn-sm btn-primary";
    }

    modal.style.display = 'flex';
    modalResolveCallback = () => resolve(true);
  });
}

function showSystemConfirm(message, title = "Confirm Action", confirmText = "Confirm", isDanger = false) {
  return new Promise((resolve) => {
    const modal = document.getElementById('systemModal');
    if (!modal) {
      const res = confirm(message);
      resolve(res);
      return;
    }

    document.getElementById('systemModalTitleText').innerText = title;
    document.getElementById('systemModalMessage').innerText = message;
    
    const icon = document.getElementById('systemModalIcon');
    if (icon) {
      icon.className = isDanger ? "fa-solid fa-triangle-exclamation" : "fa-solid fa-circle-question";
      icon.style.color = isDanger ? "#ef4444" : "#f59e0b";
    }

    const promptContainer = document.getElementById('systemModalPromptContainer');
    if (promptContainer) promptContainer.style.display = 'none';
    
    const cancelBtn = document.getElementById('systemModalCancelBtn');
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    
    const okBtn = document.getElementById('systemModalOkBtn');
    if (okBtn) {
      okBtn.innerText = confirmText;
      okBtn.className = isDanger ? "btn btn-sm btn-danger" : "btn btn-sm btn-primary";
    }

    modal.style.display = 'flex';
    modalResolveCallback = resolve;
  });
}

function closeSystemModal(result) {
  const modal = document.getElementById('systemModal');
  if (modal) modal.style.display = 'none';
  if (modalResolveCallback) {
    modalResolveCallback(result);
    modalResolveCallback = null;
  }
}

// ==========================================================================
// 4. THREADS & REAL-TIME FORUM LOGIC
// ==========================================================================

// Add this event listener or helper function to handle auto-resizing
document.addEventListener('input', function (event) {
  if (event.target && event.target.id === 'replyMessageInput') {
    event.target.style.height = 'auto';
    event.target.style.height = (event.target.scrollHeight) + 'px';
  }
});

document.addEventListener('keydown', function (event) {
  if (event.target && event.target.id === 'replyMessageInput') {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      // Trigger the submit button click if activeThreadId is present
      if (typeof activeThreadId !== 'undefined' && activeThreadId) {
        submitReply(activeThreadId);
      }
    }
  }
});


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
    </div>

    <div id="aiSummaryBox" style="display:none; background:#f5f3ff; border:1px solid #c4b5fd; padding:0.75rem; border-radius:6px; margin-bottom:1rem; font-size:0.85rem; color:#4c1d95;">
      <div style="font-weight:bold; margin-bottom:0.25rem;"><i class="fa-solid fa-robot"></i> AI Summary & Hints</div>
      <div id="aiSummaryContent">Analyzing discussion...</div>
    </div>

    <div class="replies-list-container" id="repliesListContainer">
      <div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading live replies...</div>
    </div>

    <div id="typingIndicator" style="font-size:0.75rem; color:#64748b; font-style:italic; padding:0 0.5rem 0.25rem 0.5rem; min-height:1.2rem;"></div>

    <div class="comment-input-wrapper">
      <textarea id="replyMessageInput" placeholder="Write your reply, code snippet or formula here (Use &#96;&#96;&#96;code&#96;&#96;&#96; for blocks)..." oninput="handleTypingInput('${thread.id}'); autoResizeTextarea(this);" rows="1"></textarea>
      <button type="button" class="btn-comment-submit" onclick="submitReply('${thread.id}')">
        <i class="fa-solid fa-paper-plane"></i> Send
      </button>
    </div>
  `;

  loadThreadRepliesRealtime(thread.id);
  listenToTypingIndicator(thread.id);
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

async function toggleBookmark(threadId) {
  const session = getCurrentUserSession();
  if (!session.name) {
    await showSystemAlert("Please sign in to bookmark discussions.", "Authentication Required");
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
    await showSystemAlert("Comment cannot be empty.", "Validation Warning");
    return;
  }

  try {
    await db.collection('forum_threads').doc(threadId).collection('replies').doc(replyId).update({
      replyBody: updatedBody,
      editedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error("Error updating comment:", err);
    await showSystemAlert("Failed to update comment: " + err.message, "Error");
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
    await showSystemAlert("You do not have permission to delete this comment.", "Access Denied");
    return;
  }

  const confirmed = await showSystemConfirm(
    "Are you sure you want to delete this comment? This action cannot be undone.", 
    "Delete Comment", 
    "Delete", 
    true
  );
  if (!confirmed) return;

  try {
    await db.collection('forum_threads').doc(threadId).collection('replies').doc(replyId).delete();
  } catch (err) {
    console.error("Error deleting comment:", err);
    await showSystemAlert("Failed to delete comment: " + err.message, "Error");
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
            <div class="reply-footer" style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem;">
              <div style="display:flex; gap:0.5rem; align-items:center;">
                <button class="btn btn-sm btn-outline" style="font-size:0.75rem;" onclick="toggleReplyUpvote('${threadId}', '${repId}')">
                  <i class="fa-solid fa-thumbs-up"></i> ${upvotes} Helpful
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
    await showSystemAlert("Please sign in to upvote discussions.", "Authentication Required");
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
    await showSystemAlert("Please sign in to vote.", "Authentication Required");
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
    await showSystemAlert("Failed to designate best answer.", "Error");
  }
}

function containsInappropriateContent(text) {
  const bannedKeywords = ['spam', 'abusekeyword1', 'abusekeyword2'];
  const lower = text.toLowerCase();
  return bannedKeywords.some(word => lower.includes(word));
}

async function submitReply(threadId) {
  const inputEl = document.getElementById('replyMessageInput');
  if (!inputEl) return;
  const replyBody = inputEl.value.trim();

  if (!replyBody) {
    await showSystemAlert("Please enter a reply message before submitting.", "Required Field");
    return;
  }

  if (containsInappropriateContent(replyBody)) {
    await showSystemAlert("Your reply contains flagged words that violate school forum guidelines. Please revise your message.", "Content Moderation");
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
    await showSystemAlert("Failed to post reply: " + err.message, "Error");
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

  escaped = escaped.replace(/```([\s\S]*?)```/g, '<pre style="background:#1e293b; color:#e2e8f0; padding:0.75rem; border-radius:6px; font-family:monospace; overflow-x:auto; margin:0.5rem 0;"><code>$1</code></pre>');
  escaped = escaped.replace(/`([^`]+)`/g, '<code style="background:#e2e8f0; padding:0.1rem 0.3rem; border-radius:4px; font-family:monospace; font-size:0.85em; color:#0f172a;">$1</code>');

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
    await showSystemAlert("Access Denied: Only teachers or administrators can post new discussion questions.", "Restricted Action");
    closeNewThreadModal();
    return;
  }

  const title = document.getElementById('threadTitleInput').value.trim();
  const classTarget = document.getElementById('threadClassInput').value;
  const body = document.getElementById('threadBodyInput').value.trim();
  const authorName = session.name || 'ICT Instructor';

  if (!title || !body) return;

  if (containsInappropriateContent(title) || containsInappropriateContent(body)) {
    await showSystemAlert("Thread title or content violates school content moderation standards.", "Content Moderation");
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
    await showSystemAlert("Failed to create thread: " + err.message, "Error");
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
