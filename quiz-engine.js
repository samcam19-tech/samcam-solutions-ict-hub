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

// Fallback Mock Data
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

// Tracking duration metrics
let timeSpentSeconds = 0;
let totalQuizDurationSeconds = 0;

// Learner attempts registry (quizId -> resultRecord)
let learnerSubmissionsMap = {};
// Global collection of results for teacher inspection & Excel output
let globalTeacherResults = [];

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
async function syncQuizEngineSession(user) {
  currentUser = sanitizeUserSession(user);

  const userBadge = document.getElementById('userBadge');
  const teacherPanel = document.getElementById('teacherPanel');

  if (!currentUser) {
    if (userBadge) {
      userBadge.innerHTML = `<i class="fa-solid fa-user-clock"></i> Guest`;
    }
    if (teacherPanel) {
      teacherPanel.style.display = 'none';
    }
    return;
  }

  // Normalize role check
  const userRole = (currentUser.role || '').toLowerCase();
  const isAdminOrTeacher = userRole === 'admin' || userRole === 'teacher';

  // Update Badge in Header
  if (userBadge) {
    let badgeTag = userRole === 'admin' 
      ? 'Admin' 
      : (userRole === 'teacher' ? 'Teacher' : (currentUser.class || 'Student'));

    userBadge.innerHTML = `<i class="fa-solid fa-user-check"></i> ${currentUser.fullName || currentUser.username} <span style="background:#0284c7; color:#ffffff; padding:0.1rem 0.45rem; border-radius:4px; font-size:0.75rem; margin-left:0.35rem; font-weight:700;">${badgeTag}</span>`;
  }

  // Show Teacher / Admin Management Panel
  if (teacherPanel) {
    teacherPanel.style.display = isAdminOrTeacher ? 'block' : 'none';
    if (isAdminOrTeacher) setTimeout(fetchQuizResults, 200);
  }

  // Fetch student's prior submissions to mark completed quizzes inactive
  await fetchLearnerAttempts();
}

// ==========================================================================
// 3. INITIALIZATION ON DOM READY
// ==========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  try {
    let activeUser = window.currentUser;

    if (!activeUser) {
      const sessionData = localStorage.getItem('portal_session');
      if (sessionData) {
        try {
          activeUser = JSON.parse(sessionData);
        } catch (e) {
          console.error("Error parsing portal_session from localStorage:", e);
          activeUser = null;
        }
      }
    }

    await syncQuizEngineSession(activeUser);
    fetchActiveQuizzes();
  } catch (err) {
    console.error("Initialization Error in Quiz Engine:", err);
    syncQuizEngineSession(null);
  }
});

// ==========================================================================
// 4. LEARNER PREVIOUS ATTEMPTS SYNC
// ==========================================================================
async function fetchLearnerAttempts() {
  learnerSubmissionsMap = {};
  if (!currentUser || !db) return;

  try {
    const snapshot = await db.collection('quiz_results')
      .where('studentUsername', '==', currentUser.username)
      .get();

    snapshot.forEach(doc => {
      const res = doc.data();
      learnerSubmissionsMap[res.quizId] = { id: doc.id, ...res };
    });
  } catch (err) {
    console.error("Error retrieving learner attempts:", err);
  }
}

// ==========================================================================
// 5. INSTANT CACHE & REAL-TIME QUIZ SYNC ENGINE
// ==========================================================================
function fetchActiveQuizzes() {
  const quizListContainer = document.getElementById('quizList');
  if (!quizListContainer) return;

  quizListContainer.innerHTML = `
    <div style="grid-column: 1/-1; display:flex; justify-content:center; align-items:center; padding:2rem; background:#f8fafc; border-radius:8px; color:#64748b;">
      <i class="fa-solid fa-circle-notch fa-spin" style="margin-right:0.5rem; font-size:1.2rem; color:#2563eb;"></i> Loading available quizzes...
    </div>
  `;

  const cachedQuizzes = JSON.parse(localStorage.getItem('portal_quizzes_cache')) || [];
  if (cachedQuizzes.length > 0) {
    renderQuizCards(cachedQuizzes);
  }

  if (!db) {
    console.warn("Firestore not initialized. Using fallback data.");
    if (cachedQuizzes.length === 0) renderQuizCards(MOCK_QUIZZES);
    return;
  }

  db.collection('quizzes').onSnapshot((snapshot) => {
    const freshQuizzes = [];
    snapshot.forEach((doc) => {
      freshQuizzes.push({ id: doc.id, ...doc.data() });
    });

    const quizzesToDisplay = freshQuizzes.length > 0 ? freshQuizzes : MOCK_QUIZZES;
    localStorage.setItem('portal_quizzes_cache', JSON.stringify(quizzesToDisplay));
    renderQuizCards(quizzesToDisplay);
  }, (err) => {
    console.error("Firestore Listener Error:", err);
    if (cachedQuizzes.length === 0) renderQuizCards(MOCK_QUIZZES);
  });
}

function renderQuizCards(quizzesList) {
  const quizListContainer = document.getElementById('quizList');
  if (!quizListContainer) return;

  const userRole = (currentUser && currentUser.role ? currentUser.role : '').toLowerCase();
  const isAdminOrTeacher = userRole === 'admin' || userRole === 'teacher';

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
    const attempt = learnerSubmissionsMap[q.id];

    if (attempt) {
      // Completed / Inactive State Card
      html += `
        <div class="quiz-card" style="border:1px solid #cbd5e1; padding:1.25rem; border-radius:10px; background:#f8fafc; opacity:0.95; display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
              <span style="background:#dcfce7; color:#15803d; padding:0.25rem 0.6rem; border-radius:20px; font-size:0.75rem; font-weight:700;">
                <i class="fa-solid fa-circle-check"></i> Attempted
              </span>
              <span style="font-size:0.75rem; color:#64748b; font-weight:600;">
                ${q.targetClass || 'All Classes'}
              </span>
            </div>
            <h4 style="margin:0 0 0.5rem 0; font-size:1.1rem; color:#0f172a; font-weight:600;">${q.title}</h4>
            
            <div style="background:#e0f2fe; border:1px solid #bae6fd; border-radius:6px; padding:0.6rem; margin-bottom:1rem; color:#0369a1; font-size:0.85rem;">
              <div><i class="fa-solid fa-award"></i> <strong>Score:</strong> ${attempt.percentage}% (${attempt.score}/${attempt.totalQuestions})</div>
              <div><i class="fa-solid fa-stopwatch"></i> <strong>Time Taken:</strong> ${formatSeconds(attempt.timeSpentSeconds)}</div>
            </div>
          </div>

          <button onclick="generateLearnerPDF('${q.id}')" class="btn btn-secondary" style="width:100%; justify-content:center; background:#475569;">
            <i class="fa-solid fa-file-pdf"></i> Download Result PDF
          </button>
        </div>
      `;
    } else {
      // Active Quiz Card
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
    }
  });

  quizListContainer.innerHTML = html;
}

// ==========================================================================
// 6. EDUCATOR CONTROL CENTER & EXCEL REPORTS
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
    resultsContainer.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#64748b; padding:1rem;">Live results database unreachable.</td></tr>`;
    return;
  }

  try {
    const snapshot = await db.collection('quiz_results').orderBy('submittedAt', 'desc').get();
    if (snapshot.empty) {
      resultsContainer.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#64748b; padding:1rem;">No submissions registered yet.</td></tr>`;
      return;
    }

    globalTeacherResults = [];
    let rowsHtml = '';

    snapshot.forEach(doc => {
      const res = { id: doc.id, ...doc.data() };
      globalTeacherResults.push(res);

      const submittedTime = res.submittedAt && res.submittedAt.toDate 
        ? new Date(res.submittedAt.toDate()).toLocaleString() 
        : 'Recently';

      rowsHtml += `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <!-- Column 1: Student Name -->
          <td style="padding:0.75rem; font-weight:600; color:#0f172a;">${res.studentName}</td>

          <!-- Column 2: Class -->
          <td style="padding:0.75rem; color:#475569; font-weight:500;">${res.studentClass || 'N/A'}</td>

          <!-- Column 3: Assessment Title -->
          <td style="padding:0.75rem; font-weight:500; color:#1e293b;">${res.quizTitle}</td>

          <!-- Column 4: Time Spent -->
          <td style="padding:0.75rem; font-size:0.85rem; color:#475569;">${formatSeconds(res.timeSpentSeconds)}</td>

          <!-- Column 5: Score (%) -->
          <td style="padding:0.75rem;">
            <span style="font-weight:700; color:${res.percentage >= 50 ? '#16a34a' : '#dc2626'}; background:${res.percentage >= 50 ? '#f0fdf4' : '#fef2f2'}; padding:0.2rem 0.5rem; border-radius:4px; font-size:0.85rem;">
              ${res.score}/${res.totalQuestions} (${res.percentage}%)
            </span>
          </td>

          <!-- Column 6: Submitted At -->
          <td style="padding:0.75rem; font-size:0.85rem; color:#64748b;">${submittedTime}</td>

          <!-- Column 7: Actions -->
          <td style="padding:0.75rem;">
            <button class="btn btn-secondary btn-sm" onclick="inspectLearnerSubmission('${doc.id}')" style="background:#0284c7; border:none; padding:0.25rem 0.6rem; font-size:0.75rem; border-radius:4px; color:#fff; cursor:pointer;">
              <i class="fa-solid fa-eye"></i> Inspect
            </button>
          </td>
        </tr>
      `;
    });
    resultsContainer.innerHTML = rowsHtml;
  } catch (err) {
    console.error("Error fetching submission results:", err);
    resultsContainer.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#ef4444; padding:1rem;">Failed to load submission results.</td></tr>`;
  }
}
// Teacher Response Inspection Modal
function inspectLearnerSubmission(docId) {
  const sub = globalTeacherResults.find(s => s.id === docId);
  if (!sub) return alert("Submission payload not located.");

  const modal = document.getElementById('inspectorModal');
  const studentTitle = document.getElementById('modalStudentName');
  const body = document.getElementById('modalResponseBody');

  if (!modal || !body) return;

  if (studentTitle) studentTitle.textContent = `${sub.studentName} - Responses Overview`;

  let html = `
    <div style="margin-bottom:1rem; padding:0.75rem; background:#f8fafc; border-radius:6px; font-size:0.85rem; border:1px solid #e2e8f0;">
      <div><strong>Assessment:</strong> ${sub.quizTitle}</div>
      <div><strong>Score:</strong> ${sub.percentage}% (${sub.score}/${sub.totalQuestions}) | <strong>Time Spent:</strong> ${formatSeconds(sub.timeSpentSeconds)}</div>
    </div>
  `;

  (sub.detailedResponses || []).forEach((item, idx) => {
    html += `
      <div style="padding:0.75rem; border-radius:6px; margin-bottom:0.75rem; border-left:4px solid ${item.isCorrect ? '#16a34a' : '#dc2626'}; background:${item.isCorrect ? '#f0fdf4' : '#fef2f2'}; font-size:0.85rem;">
        <div style="font-weight:600; color:#0f172a; margin-bottom:0.25rem;">Q${idx + 1}: ${item.questionText}</div>
        <div><strong>Selected:</strong> ${item.selectedOption}</div>
        ${!item.isCorrect ? `<div style="color:#dc2626; margin-top:0.25rem;"><strong>Correct Option:</strong> ${item.correctOption}</div>` : ''}
      </div>
    `;
  });

  body.innerHTML = html;
  modal.style.display = 'flex';
}

function closeInspectorModal() {
  const modal = document.getElementById('inspectorModal');
  if (modal) modal.style.display = 'none';
}

// Generate Excel Spreadsheet for Teachers
function exportResultsToExcel() {
  if (globalTeacherResults.length === 0) {
    return alert("No student results available to export.");
  }

  if (typeof XLSX === 'undefined') {
    return alert("SheetJS library not detected. Ensure sheetjs CDN script is included in HTML.");
  }

  const exportRows = globalTeacherResults.map(s => ({
    "Student Name": s.studentName,
    "Username": s.studentUsername,
    "Class": s.studentClass || "N/A",
    "Assessment Title": s.quizTitle,
    "Score Obtained": s.score,
    "Total Questions": s.totalQuestions,
    "Percentage Score (%)": s.percentage,
    "Time Spent": formatSeconds(s.timeSpentSeconds),
    "Submission Date": s.submittedAt && s.submittedAt.toDate ? new Date(s.submittedAt.toDate()).toLocaleString() : 'N/A'
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Student Scores");

  XLSX.writeFile(workbook, `Assessment_Scores_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ==========================================================================
// 7. QUIZ RUNNER ENGINE
// ==========================================================================
async function startQuiz(quizId) {
  try {
    if (!currentUser) {
      alert("Please log in to attempt an assessment.");
      return;
    }

    if (learnerSubmissionsMap[quizId]) {
      alert("You have already submitted an entry for this quiz.");
      return;
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
// 8. TIMER & SUBMISSION ENGINE
// ==========================================================================
function startTimer(durationMinutes) {
  totalQuizDurationSeconds = durationMinutes * 60;
  let secondsRemaining = totalQuizDurationSeconds;
  timeSpentSeconds = 0;

  const display = document.getElementById('quizTimer');
  clearInterval(quizTimerInterval);

  quizTimerInterval = setInterval(() => {
    secondsRemaining--;
    timeSpentSeconds++;

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
  }, 1000);
}

async function submitQuizToFirestore() {
  clearInterval(quizTimerInterval);

  if (!activeQuizData) return;

  let score = 0;
  const questions = activeQuizData.questions || [];
  const total = questions.length;

  const studentAnswers = [];
  const detailedResponses = [];

  questions.forEach((q, idx) => {
    const selected = document.querySelector(`input[name="q_${idx}"]:checked`);
    const answerIndex = selected ? parseInt(selected.value, 10) : -1;
    
    studentAnswers.push(answerIndex);

    const isCorrect = answerIndex === q.correctAnswer;
    if (isCorrect) score++;

    detailedResponses.push({
      questionText: q.question,
      selectedOption: answerIndex >= 0 ? q.options[answerIndex] : "Unanswered",
      correctOption: q.options[q.correctAnswer],
      isCorrect
    });
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
    timeSpentSeconds,
    answers: studentAnswers,
    detailedResponses,
    submittedAt: firebase.firestore.FieldValue ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
  };

  try {
    if (db) {
      await db.collection('quiz_results').add(resultRecord);
    }

    alert(`Quiz Submitted Successfully!\nScore: ${score}/${total} (${percentage}%)\nTime Taken: ${formatSeconds(timeSpentSeconds)}`);

    // Reset view to dashboard
    const runner = document.getElementById('quizRunner');
    const quizzesContainer = document.getElementById('availableQuizzesContainer');
    if (runner) runner.style.display = 'none';
    if (quizzesContainer) quizzesContainer.style.display = 'block';

    // Refresh Learner Attempts & Re-render Dashboard Cards
    await fetchLearnerAttempts();
    fetchActiveQuizzes();

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

// ==========================================================================
// 9. LEARNER PDF REPORT GENERATOR (jsPDF)
// ==========================================================================
function generateLearnerPDF(quizId) {
  const attempt = learnerSubmissionsMap[quizId];
  if (!attempt) return alert("No attempt record found for this assessment.");

  if (typeof window.jspdf === 'undefined') {
    return alert("jsPDF library not loaded. Ensure jsPDF scripts are included in html.");
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Header Graphic
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 32, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text("ASSESSMENT PERFORMANCE SLIP", 14, 20);

  // Meta Specs
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  doc.text(`Learner Name: ${attempt.studentName}`, 14, 42);
  doc.text(`Class/Stream: ${attempt.studentClass || 'N/A'}`, 14, 48);
  doc.text(`Assessment Title: ${attempt.quizTitle}`, 14, 54);

  doc.text(`Final Score: ${attempt.percentage}% (${attempt.score}/${attempt.totalQuestions})`, 120, 42);
  doc.text(`Time Spent: ${formatSeconds(attempt.timeSpentSeconds)}`, 120, 48);
  doc.text(`Date Generated: ${new Date().toLocaleDateString()}`, 120, 54);

  doc.setDrawColor(226, 232, 240);
  doc.line(14, 60, 196, 60);

  const tableData = (attempt.detailedResponses || []).map((item, idx) => [
    idx + 1,
    item.questionText,
    item.selectedOption,
    item.correctOption,
    item.isCorrect ? "CORRECT" : "INCORRECT"
  ]);

  doc.autoTable({
    startY: 65,
    head: [['#', 'Question Prompt', 'Your Choice', 'Correct Option', 'Status']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 65 },
      2: { cellWidth: 45 },
      3: { cellWidth: 45 },
      4: { cellWidth: 20, fontStyle: 'bold' }
    },
    didParseCell: function(data) {
      if (data.column.index === 4 && data.cell.section === 'body') {
        if (data.cell.raw === 'CORRECT') {
          data.cell.styles.textColor = [22, 163, 74];
        } else {
          data.cell.styles.textColor = [220, 38, 38];
        }
      }
    }
  });

  doc.save(`${attempt.studentName.replace(/\s+/g, '_')}_Result_Slip.pdf`);
}

// ==========================================================================
// 10. TIME FORMATTING HELPERS
// ==========================================================================
function formatSeconds(totalSecs) {
  if (!totalSecs || isNaN(totalSecs)) return '0s';
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
