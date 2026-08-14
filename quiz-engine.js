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

// Fallback Mock Data in case database connection drops or is empty
const MOCK_QUIZZES = [
  {
    id: "sample_01",
    title: "S.4 ICT Sample Assessment",
    targetClass: "S4",
    durationMinutes: 15,
    questions: [
      {
        id: 1,
        question: "Which component is considered the primary brain of a computer system?",
        options: ["Hard Disk Drive", "Central Processing Unit", "Random Access Memory", "Power Supply Unit"],
        correctAnswer: 1
      },
      {
        id: 2,
        question: "What function in spreadsheet applications is used to sum cell ranges conditionally?",
        options: ["SUM()", "COUNT()", "SUMIF()", "VLOOKUP()"],
        correctAnswer: 2
      }
    ]
  }
];

// ==========================================================================
// 2. STATE MANAGEMENT & SESSION HANDLING
// ==========================================================================
let currentUser = null;
let activeQuizData = null;
let quizTimerInterval = null;
let builderQuestionCount = 0;

// Listen for live session changes broadcasted by global auth scripts
window.addEventListener('portalSessionChanged', (e) => {
  syncQuizEngineSession(e.detail);
});

// Helper: Ensure session objects have safe, operational structure
function sanitizeUserSession(user) {
  if (!user) return null;
  return {
    ...user,
    username: user.username || "user",
    fullName: user.fullName || user.username || "Portal User",
    role: user.role || "Student",
    class: user.class || "General"
  };
}

// Synchronize user session state across UI badges and admin/teacher panels
function syncQuizEngineSession(user) {
  currentUser = sanitizeUserSession(user);

  const userBadge = document.getElementById('userBadge');
  const teacherPanel = document.getElementById('teacherPanel');

  if (!currentUser) {
    if (userBadge) userBadge.innerHTML = `<i class="fa-solid fa-user"></i> Guest`;
    if (teacherPanel) teacherPanel.style.display = 'none';
    return;
  }

  // Normalize role check (handles "Admin", "admin", "Teacher", "teacher")
  const userRole = (currentUser.role || '').toLowerCase();
  const isAdminOrTeacher = userRole === 'admin' || userRole === 'teacher';

  // Update Badge in Header
  if (userBadge) {
    let badgeTag = userRole === 'admin' 
      ? 'Admin' 
      : (userRole === 'teacher' ? 'Teacher' : (currentUser.class || 'Student'));

    userBadge.innerHTML = `<i class="fa-solid fa-user-check"></i> ${currentUser.fullName || currentUser.username} <span style="background:#0284c7; padding:0.1rem 0.4rem; border-radius:4px; font-size:0.75rem; margin-left:0.3rem;">${badgeTag}</span>`;
  }

  // Show Teacher / Admin Management Panel
  if (teacherPanel) {
    teacherPanel.style.display = isAdminOrTeacher ? 'block' : 'none';
    if (isAdminOrTeacher) setTimeout(fetchQuizResults, 200);
  }
}

// ==========================================================================
// 3. INITIALIZATION ON DOM READY
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  try {
    let activeUser = window.currentUser;
    if (!activeUser) {
      try {
        const sessionData = localStorage.getItem('portal_session');
        if (sessionData) activeUser = JSON.parse(sessionData);
      } catch (e) {
        console.error("Error reading portal_session:", e);
        activeUser = null;
      }
    }

    // Apply session and populate dashboard
    syncQuizEngineSession(activeUser);
    fetchActiveQuizzes();
  } catch (err) {
    console.error("Initialization Error in Quiz Engine:", err);
  }
});

// ==========================================================================
// 4. INSTANT CACHE & REAL-TIME QUIZ SYNC ENGINE
// ==========================================================================
function fetchActiveQuizzes() {
  const quizListContainer = document.getElementById('quizList');
  if (!quizListContainer) return;

  // Loading Placeholder
  quizListContainer.innerHTML = `
    <div style="grid-column: 1/-1; display:flex; justify-content:center; align-items:center; padding:2rem; background:#f8fafc; border-radius:8px; color:#64748b;">
      <i class="fa-solid fa-circle-notch fa-spin" style="margin-right:0.5rem; font-size:1.2rem; color:#2563eb;"></i> Loading available quizzes...
    </div>
  `;

  // 1. Load from instant local storage cache
  const cachedQuizzes = JSON.parse(localStorage.getItem('portal_quizzes_cache')) || [];
  if (cachedQuizzes.length > 0) {
    renderQuizCards(cachedQuizzes);
  }

  // 2. Fallback to Mock Data if Firestore isn't connected
  if (!db) {
    console.warn("Firestore not initialized. Using fallback data.");
    if (cachedQuizzes.length === 0) renderQuizCards(MOCK_QUIZZES);
    return;
  }

  // 3. Real-time Firestore sync
  db.collection('quizzes').onSnapshot((snapshot) => {
    const freshQuizzes = [];
    snapshot.forEach((doc) => {
      freshQuizzes.push({ id: doc.id, ...doc.data() });
    });

    const quizzesToDisplay = freshQuizzes.length > 0 ? freshQuizzes : MOCK_QUIZZES;

    // Save to local cache
    localStorage.setItem('portal_quizzes_cache', JSON.stringify(quizzesToDisplay));

    // Render cards on UI
    renderQuizCards(quizzesToDisplay);
  }, (err) => {
    console.error("Firestore Listener Error:", err);
    if (cachedQuizzes.length === 0) {
      renderQuizCards(MOCK_QUIZZES);
    }
  });
}

function renderQuizCards(quizzesList) {
  const quizListContainer = document.getElementById('quizList');
  if (!quizListContainer) return;

  const userRole = (currentUser && currentUser.role ? currentUser.role : '').toLowerCase();
  const isAdminOrTeacher = userRole === 'admin' || userRole === 'teacher';

  // Filter quizzes by class scope (Admins & Teachers bypass filters)
  const filteredQuizzes = quizzesList.filter(q => {
    if (isAdminOrTeacher) return true;
    if (!currentUser || !currentUser.class) return true;
    const target = q.targetClass || 'All';
    return target === 'All' || target === currentUser.class;
  });

  if (filteredQuizzes.length === 0) {
    const currentClassText = currentUser && currentUser.class ? 'for class ' + currentUser.class : '';
    quizListContainer.innerHTML = `
      <div style="grid-column: 1/-1; background:#f1f5f9; text-align:center; padding:2rem; border-radius:8px; color:#475569;">
        <i class="fa-solid fa-folder-open" style="font-size:2rem; margin-bottom:0.5rem; color:#94a3b8;"></i>
        <p style="margin:0; font-weight:500;">No active quizzes assigned ${currentClassText}.</p>
      </div>
    `;
    return;
  }

  let html = '';
  filteredQuizzes.forEach(q => {
    const qCount = q.questions ? q.questions.length : 0;
    html += `
      <div class="quiz-card" style="border:1px solid #e2e8f0; padding:1.25rem; border-radius:10px; background:#ffffff; box-shadow:0 2px 4px rgba(0,0,0,0.04); display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
            <span style="background:#e0f2fe; color:#0369a1; padding:0.25rem 0.6rem; border-radius:20px; font-size:0.75rem; font-weight:700; text-transform:uppercase;">
              <i class="fa-solid fa-layer-group"></i> ${q.targetClass || 'All Classes'}
            </span>
            <span style="font-size:0.75rem; color:#64748b; font-weight:600;">
              <i class="fa-solid fa-clock" style="color:#f59e0b;"></i> ${q.durationMinutes} Mins
            </span>
          </div>
          <h4 style="margin:0 0 0.5rem 0; font-size:1.1rem; color:#0f172a; font-weight:600;">${q.title}</h4>
          <p style="font-size:0.85rem; color:#64748b; margin:0 0 1.25rem 0;">
            <i class="fa-solid fa-list-check"></i> ${qCount} Question${qCount === 1 ? '' : 's'} Included
          </p>
        </div>
        <button onclick="startQuiz('${q.id}')" class="btn btn-primary" style="width:100%; justify-content:center;">
          <i class="fa-solid fa-play"></i> Start Quiz
        </button>
      </div>
    `;
  });

  quizListContainer.innerHTML = html;
}

// ==========================================================================
// 5. EDUCATOR CONTROL CENTER (QUIZ BUILDER & RESULTS TRACKER)
// ==========================================================================
function toggleQuizBuilder() {
  const form = document.getElementById('createQuizForm');
  if (!form) return;

  const isHidden = form.style.display === 'none' || form.style.display === '';
  form.style.display = isHidden ? 'block' : 'none';

  if (isHidden && builderQuestionCount === 0) {
    addQuestionToBuilder();
  }
}

function addQuestionToBuilder() {
  builderQuestionCount++;
  const container = document.getElementById('builderQuestionsContainer');
  if (!container) return;

  const qCard = document.createElement('div');
  qCard.className = 'question-item';
  qCard.id = `builderQ_${builderQuestionCount}`;
  qCard.style.cssText = 'background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:1rem; margin-bottom:1rem; box-shadow:0 1px 2px rgba(0,0,0,0.03);';

  qCard.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
      <strong style="color:#1e293b; font-size:0.95rem;">Question #${builderQuestionCount}</strong>
      <button type="button" onclick="removeBuilderQuestion('${qCard.id}')" style="color:#ef4444; border:none; background:none; cursor:pointer; font-size:0.85rem; font-weight:600;">
        <i class="fa-solid fa-trash"></i> Remove
      </button>
    </div>
    <input type="text" class="q-title" placeholder="Enter question text..." required style="width:100%; padding:0.6rem; margin-bottom:0.75rem; border-radius:6px; border:1px solid #cbd5e1; font-size:0.9rem;">
    
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-bottom:0.75rem;">
      <input type="text" class="q-opt-0" placeholder="Option 1" required style="padding:0.5rem; border-radius:4px; border:1px solid #cbd5e1; font-size:0.85rem;">
      <input type="text" class="q-opt-1" placeholder="Option 2" required style="padding:0.5rem; border-radius:4px; border:1px solid #cbd5e1; font-size:0.85rem;">
      <input type="text" class="q-opt-2" placeholder="Option 3" required style="padding:0.5rem; border-radius:4px; border:1px solid #cbd5e1; font-size:0.85rem;">
      <input type="text" class="q-opt-3" placeholder="Option 4" required style="padding:0.5rem; border-radius:4px; border:1px solid #cbd5e1; font-size:0.85rem;">
    </div>

    <div style="display:flex; align-items:center; gap:0.5rem; background:#f8fafc; padding:0.5rem; border-radius:6px; border:1px solid #f1f5f9;">
      <label style="font-size:0.85rem; font-weight:600; color:#475569;">Correct Option:</label>
      <select class="q-correct" required style="padding:0.3rem 0.5rem; border-radius:4px; border:1px solid #cbd5e1; font-size:0.85rem;">
        <option value="0">Option 1</option>
        <option value="1">Option 2</option>
        <option value="2">Option 3</option>
        <option value="3">Option 4</option>
      </select>
    </div>
  `;

  container.appendChild(qCard);
}

function removeBuilderQuestion(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.remove();
}

async function handleSaveQuiz(event) {
  event.preventDefault();

  const title = document.getElementById('builderTitle').value.trim();
  const targetClass = document.getElementById('builderClass').value;
  const duration = parseInt(document.getElementById('builderDuration').value, 10);

  const questionElements = document.querySelectorAll('#builderQuestionsContainer .question-item');
  if (questionElements.length === 0) {
    alert("Please add at least one question before saving.");
    return;
  }

  const questions = [];
  questionElements.forEach((qEl, idx) => {
    questions.push({
      id: idx + 1,
      question: qEl.querySelector('.q-title').value.trim(),
      options: [
        qEl.querySelector('.q-opt-0').value.trim(),
        qEl.querySelector('.q-opt-1').value.trim(),
        qEl.querySelector('.q-opt-2').value.trim(),
        qEl.querySelector('.q-opt-3').value.trim()
      ],
      correctAnswer: parseInt(qEl.querySelector('.q-correct').value, 10)
    });
  });

  const quizDoc = {
    title,
    targetClass,
    durationMinutes: duration,
    questions,
    createdBy: currentUser ? currentUser.username : "Admin",
    createdAt: firebase.firestore.FieldValue ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
  };

  try {
    if (db) {
      await db.collection('quizzes').add(quizDoc);
    } else {
      const cached = JSON.parse(localStorage.getItem('portal_quizzes_cache')) || MOCK_QUIZZES;
      cached.push({ id: `local_${Date.now()}`, ...quizDoc });
      localStorage.setItem('portal_quizzes_cache', JSON.stringify(cached));
      renderQuizCards(cached);
    }

    alert("Quiz created and published successfully!");
    document.getElementById('createQuizForm').reset();
    document.getElementById('builderQuestionsContainer').innerHTML = '';
    builderQuestionCount = 0;
    toggleQuizBuilder();
  } catch (err) {
    console.error("Error publishing quiz:", err);
    alert("Failed to save quiz: " + err.message);
  }
}

async function fetchQuizResults() {
  const resultsContainer = document.getElementById('teacherResultsTable');
  if (!resultsContainer) return;

  if (!db) {
    resultsContainer.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#64748b; padding:1rem;">Live results database unreachable.</td></tr>`;
    return;
  }

  try {
    const snapshot = await db.collection('quiz_results').orderBy('submittedAt', 'desc').get();
    if (snapshot.empty) {
      resultsContainer.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#64748b; padding:1rem;">No submissions registered yet.</td></tr>`;
      return;
    }

    let rowsHtml = '';
    snapshot.forEach(doc => {
      const res = doc.data();
      const submittedTime = res.submittedAt && res.submittedAt.toDate 
        ? new Date(res.submittedAt.toDate()).toLocaleString() 
        : 'Recently';

      rowsHtml += `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:0.75rem;"><strong>${res.studentName}</strong> <span style="font-size:0.8rem; color:#64748b;">(${res.studentClass})</span></td>
          <td style="padding:0.75rem; font-weight:500;">${res.quizTitle}</td>
          <td style="padding:0.75rem;">
            <span style="font-weight:700; color:${res.percentage >= 50 ? '#16a34a' : '#dc2626'}; background:${res.percentage >= 50 ? '#f0fdf4' : '#fef2f2'}; padding:0.2rem 0.5rem; border-radius:4px; font-size:0.85rem;">
              ${res.score}/${res.totalQuestions} (${res.percentage}%)
            </span>
          </td>
          <td style="padding:0.75rem; font-size:0.85rem; color:#64748b;">${submittedTime}</td>
        </tr>
      `;
    });
    resultsContainer.innerHTML = rowsHtml;
  } catch (err) {
    console.error("Error fetching submission results:", err);
    resultsContainer.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#ef4444; padding:1rem;">Failed to load submission results.</td></tr>`;
  }
}

// ==========================================================================
// 6. QUIZ RUNNER ENGINE
// ==========================================================================
async function startQuiz(quizId) {
  try {
    if (!currentUser) {
      alert("Please log in to attempt an assessment.");
      return;
    }

    // Check duplicate attempts in Firestore
    if (db) {
      const existingResult = await db.collection('quiz_results')
        .where('quizId', '==', quizId)
        .where('studentUsername', '==', currentUser.username)
        .get();

      if (!existingResult.empty) {
        alert("You have already submitted an entry for this quiz.");
        return;
      }
    }

    const cachedQuizzes = JSON.parse(localStorage.getItem('portal_quizzes_cache')) || MOCK_QUIZZES;
    let foundQuiz = cachedQuizzes.find(q => q.id === quizId);

    if (!foundQuiz && db) {
      const doc = await db.collection('quizzes').doc(quizId).get();
      if (doc.exists) {
        foundQuiz = { id: doc.id, ...doc.data() };
      }
    }

    if (!foundQuiz) {
      alert("Unable to locate quiz details.");
      return;
    }

    activeQuizData = foundQuiz;

    const titleEl = document.getElementById('activeQuizTitle');
    const classEl = document.getElementById('activeQuizClass');
    if (titleEl) titleEl.textContent = activeQuizData.title;
    if (classEl) classEl.textContent = activeQuizData.targetClass || 'General';
    
    renderQuizQuestions(activeQuizData.questions || []);

    const quizzesContainer = document.getElementById('availableQuizzesContainer');
    if (quizzesContainer) quizzesContainer.style.display = 'none';
    
    const teacherPanel = document.getElementById('teacherPanel');
    if (teacherPanel) teacherPanel.style.display = 'none';
    
    const runner = document.getElementById('quizRunner');
    if (runner) runner.style.display = 'block';

    startTimer(activeQuizData.durationMinutes || 10);
  } catch (err) {
    console.error("Error launching quiz session:", err);
  }
}

function renderQuizQuestions(questions) {
  const container = document.getElementById('questionsList');
  if (!container) return;

  if (questions.length === 0) {
    container.innerHTML = `<p style="padding:1rem; color:#64748b;">No questions attached to this assessment.</p>`;
    return;
  }

  let html = '';
  questions.forEach((q, qIndex) => {
    html += `
      <div class="question-item" style="margin-bottom:1.5rem; padding:1.25rem; border:1px solid #e2e8f0; border-radius:8px; background:#fafafa;">
        <div class="question-text" style="font-weight:600; font-size:1rem; margin-bottom:1rem; color:#0f172a;">
          ${qIndex + 1}. ${q.question}
        </div>
        <div style="display:flex; flex-direction:column; gap:0.6rem;">
          ${q.options.map((opt, optIndex) => `
            <label class="option-label" style="display:flex; align-items:center; gap:0.75rem; padding:0.6rem 0.8rem; background:#ffffff; border:1px solid #cbd5e1; border-radius:6px; cursor:pointer; font-size:0.9rem;">
              <input type="radio" name="q_${qIndex}" value="${optIndex}" style="accent-color:#2563eb;">
              <span>${opt}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// ==========================================================================
// 7. TIMER & SUBMISSION ENGINE
// ==========================================================================
function startTimer(durationMinutes) {
  let secondsRemaining = durationMinutes * 60;
  const display = document.getElementById('quizTimer');

  clearInterval(quizTimerInterval);

  quizTimerInterval = setInterval(() => {
    const mins = Math.floor(secondsRemaining / 60);
    const secs = secondsRemaining % 60;

    if (display) {
      display.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    if (secondsRemaining <= 0) {
      clearInterval(quizTimerInterval);
      alert("Time has elapsed. Your answers are automatically submitting...");
      submitQuizToFirestore();
    }

    secondsRemaining--;
  }, 1000);
}

async function submitQuizToFirestore() {
  clearInterval(quizTimerInterval);

  if (!activeQuizData) return;

  let score = 0;
  const questions = activeQuizData.questions || [];
  const total = questions.length;
  const studentAnswers = [];

  questions.forEach((q, idx) => {
    const selected = document.querySelector(`input[name="q_${idx}"]:checked`);
    const answerIndex = selected ? parseInt(selected.value, 10) : -1;
    
    studentAnswers.push(answerIndex);

    if (answerIndex === q.correctAnswer) {
      score++;
    }
  });

  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  const resultRecord = {
    quizId: activeQuizData.id,
    quizTitle: activeQuizData.title,
    studentUsername: currentUser ? currentUser.username : "anonymous",
    studentName: currentUser ? (currentUser.fullName || currentUser.username) : "Anonymous Student",
    studentClass: currentUser ? (currentUser.class || "N/A") : "N/A",
    score,
    totalQuestions: total,
    percentage,
    answers: studentAnswers,
    submittedAt: firebase.firestore.FieldValue ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
  };

  try {
    if (db) {
      await db.collection('quiz_results').add(resultRecord);
    }

    alert(`Quiz Submitted Successfully!\nScore: ${score}/${total} (${percentage}%)`);

    // Reset view to dashboard
    const runner = document.getElementById('quizRunner');
    const quizzesContainer = document.getElementById('availableQuizzesContainer');
    if (runner) runner.style.display = 'none';
    if (quizzesContainer) quizzesContainer.style.display = 'block';
    
    const userRole = (currentUser && currentUser.role ? currentUser.role : '').toLowerCase();
    const isAdminOrTeacher = userRole === 'teacher' || userRole === 'admin';
    const teacherPanel = document.getElementById('teacherPanel');
    if (isAdminOrTeacher && teacherPanel) {
      teacherPanel.style.display = 'block';
      fetchQuizResults();
    }

    activeQuizData = null;
  } catch (err) {
    console.error("Error submitting quiz:", err);
    alert("Submission completed locally, but cloud backup failed. Check connection.");
  }
}
