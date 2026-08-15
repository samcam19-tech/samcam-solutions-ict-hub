// Track quiz currently being edited (null if creating a new one)
let editingQuizId = null;

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

// Fallback Mock Data with mixed question types (mcq and text)
const MOCK_QUIZZES = [
  {
    id: "sample_01",
    title: "S.4 ICT Sample Assessment",
    targetClass: "S4",
    durationMinutes: 15,
    questions: [
      {
        id: 1,
        type: "mcq",
        question: "Which component is considered the primary brain of a computer system?",
        options: ["Hard Disk Drive", "Central Processing Unit", "Random Access Memory", "Power Supply Unit"],
        correctAnswer: 1,
        marks: 1
      },
      {
        id: 2,
        type: "text",
        question: "What function in spreadsheet applications is used to sum cell ranges conditionally?",
        correctAnswer: "SUMIF()",
        marks: 1
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

// Helper formatting function for time display
function formatSeconds(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

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
// 5. INSTANT CACHE & REAL-TIME QUIZ SYNC ENGINE (With Randomization Support)
// ==========================================================================

// Helper: Fisher-Yates shuffle for question randomization (Feature 1)
function generateRandomizedQuiz(masterQuizDoc, limitCount = 10) {
  if (!masterQuizDoc.questions || masterQuizDoc.questions.length <= limitCount) {
    return masterQuizDoc; // Return as-is if pool is small
  }

  const shuffled = [...masterQuizDoc.questions].sort(() => 0.5 - Math.random());
  const selectedQuestions = shuffled.slice(0, limitCount);

  return {
    ...masterQuizDoc,
    questions: selectedQuestions,
    totalQuestions: selectedQuestions.length
  };
}

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

// --- Pagination State for Available Quizzes ---
let currentQuizzesPage = 1;
const quizzesPerPage = 6;
let globalFilteredQuizzes = []; // Stores filtered items globally for pagination use

// ==========================================================================
// RENDER QUIZ CARDS (Paginated Version)
// ==========================================================================
function renderQuizCards(quizzesList) {
  const quizListContainer = document.getElementById('quizList');
  const paginationContainer = document.getElementById('quizzesPagination');
  if (!quizListContainer) return;

  const userRole = (currentUser && currentUser.role ? currentUser.role : '').toLowerCase();
  const isAdminOrTeacher = userRole === 'admin' || userRole === 'teacher';

  // Filter quizzes based on user role and class
  globalFilteredQuizzes = quizzesList.filter(q => {
    if (isAdminOrTeacher) return true;
    if (!currentUser || !currentUser.class) return true;
    const target = q.targetClass || 'All';
    return target === 'All' || target === currentUser.class;
  });

  if (globalFilteredQuizzes.length === 0) {
    const currentClassText = currentUser && currentUser.class ? 'for class ' + currentUser.class : '';
    quizListContainer.innerHTML = `
      <div style="grid-column: 1/-1; background:#f1f5f9; text-align:center; padding:2rem; border-radius:8px; color:#475569;">
        <i class="fa-solid fa-folder-open" style="font-size:2rem; margin-bottom:0.5rem; color:#94a3b8;"></i>
        <p style="margin:0; font-weight:500;">No active quizzes assigned ${currentClassText}.</p>
      </div>
    `;
    if (paginationContainer) paginationContainer.style.display = 'none';
    return;
  }

  // Reset to page 1 on fresh render and display pagination bar
  currentQuizzesPage = 1;
  renderQuizCardsPage();
}

// Renders the specific slice of quiz cards for the current page
function renderQuizCardsPage() {
  const quizListContainer = document.getElementById('quizList');
  const paginationContainer = document.getElementById('quizzesPagination');
  
  if (!globalFilteredQuizzes || globalFilteredQuizzes.length === 0) {
    if (paginationContainer) paginationContainer.style.display = 'none';
    return;
  }

  if (paginationContainer) paginationContainer.style.display = 'flex';

  const totalPages = Math.ceil(globalFilteredQuizzes.length / quizzesPerPage) || 1;
  if (currentQuizzesPage > totalPages) currentQuizzesPage = totalPages;
  if (currentQuizzesPage < 1) currentQuizzesPage = 1;

  const start = (currentQuizzesPage - 1) * quizzesPerPage;
  const end = start + quizzesPerPage;
  const paginatedQuizzes = globalFilteredQuizzes.slice(start, end);

  const userRole = (currentUser && currentUser.role ? currentUser.role : '').toLowerCase();
  const isAdminOrTeacher = userRole === 'admin' || userRole === 'teacher';

  let html = '';
  paginatedQuizzes.forEach(q => {
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
              <div style="display:flex; gap:0.4rem; align-items:center;">
                <span style="font-size:0.75rem; color:#64748b; font-weight:600; margin-right:0.5rem;">
                  ${q.targetClass || 'All Classes'}
                </span>
                ${isAdminOrTeacher ? `
                  <button onclick="editQuiz('${q.id}')" title="Edit Quiz" style="background:#0284c7; border:none; color:#fff; padding:0.25rem 0.4rem; border-radius:4px; cursor:pointer; font-size:0.75rem;">
                    <i class="fa-solid fa-pen-to-square"></i>
                  </button>
                ` : ''}
              </div>
            </div>
            <h4 style="margin:0 0 0.5rem 0; font-size:1.1rem; color:#0f172a; font-weight:600;">${q.title}</h4>
            
            <div style="background:#e0f2fe; border:1px solid #bae6fd; border-radius:6px; padding:0.6rem; margin-bottom:1rem; color:#0369a1; font-size:0.85rem;">
              <div><i class="fa-solid fa-award"></i> <strong>Score:</strong> ${attempt.percentage}% (${attempt.score}/${attempt.totalQuestions})</div>
              <div><i class="fa-solid fa-stopwatch"></i> <strong>Time Taken:</strong> ${formatSeconds(attempt.timeSpentSeconds)}</div>
            </div>
          </div>

          <div style="display:flex; gap:0.5rem;">
            <button onclick="openReviewMode('${q.id}')" class="btn btn-outline" style="flex:1; justify-content:center; font-size:0.8rem; padding:0.5rem;">
              <i class="fa-solid fa-eye"></i> Review
            </button>
            <button onclick="generateLearnerPDF('${q.id}')" class="btn btn-secondary" style="flex:1; justify-content:center; background:#475569; font-size:0.8rem; padding:0.5rem;">
              <i class="fa-solid fa-file-pdf"></i> PDF
            </button>
          </div>
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
              <div style="display:flex; gap:0.4rem; align-items:center;">
                <span style="font-size:0.75rem; color:#64748b; font-weight:600; margin-right:0.5rem;">
                  <i class="fa-solid fa-clock" style="color:#f59e0b;"></i> ${q.durationMinutes} Mins
                </span>
                ${isAdminOrTeacher ? `
                  <button onclick="editQuiz('${q.id}')" title="Edit Quiz" style="background:#0284c7; border:none; color:#fff; padding:0.25rem 0.4rem; border-radius:4px; cursor:pointer; font-size:0.75rem;">
                    <i class="fa-solid fa-pen-to-square"></i>
                  </button>
                ` : ''}
              </div>
            </div>
            <h4 style="margin:0 0 0.5rem 0; font-size:1.1rem; color:#0f172a; font-weight:600;">${q.title}</h4>
            <p style="font-size:0.85rem; color:#64748b; margin:0 0 1.25rem 0;">
              <i class="fa-solid fa-list-check"></i> ${qCount} Question${qCount === 1 ? '' : 's'} Included
            </p>
          </div>
          
          <div style="display:flex; gap:0.5rem;">
            <button onclick="startQuiz('${q.id}')" class="btn btn-primary" style="flex:1; justify-content:center;">
              <i class="fa-solid fa-play"></i> Start Quiz
            </button>
            ${isAdminOrTeacher ? `
              <button onclick="renderTeacherAnalyticsModal('${q.id}', '${q.title.replace(/'/g, "\\'")}', allSubmissions)" class="btn btn-outline" style="padding:0.5rem;" title="View Analytics">
                <i class="fa-solid fa-chart-pie"></i>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }
  });

  quizListContainer.innerHTML = html;

  // Update Pagination Controls UI text & button states
  const infoEl = document.getElementById('quizzesPaginationInfo');
  const pageIndEl = document.getElementById('quizPageIndicator');
  const prevBtn = document.getElementById('quizPrevBtn');
  const nextBtn = document.getElementById('quizNextBtn');

  if (infoEl) infoEl.innerText = `Showing ${start + 1} to ${Math.min(end, globalFilteredQuizzes.length)} of ${globalFilteredQuizzes.length} quizzes`;
  if (pageIndEl) pageIndEl.innerText = `Page ${currentQuizzesPage} of ${totalPages}`;
  if (prevBtn) prevBtn.disabled = currentQuizzesPage === 1;
  if (nextBtn) nextBtn.disabled = currentQuizzesPage === totalPages;
}

// Triggered by Next / Prev buttons in HTML for Available Assessments
function changeQuizzesPage(direction) {
  currentQuizzesPage += direction;
  renderQuizCardsPage();
}

// ==========================================================================
// INTELLIGENT SHORT ANSWER EVALUATION ALGORITHM
// ==========================================================================
function evaluateShortAnswer(studentInput, correctAnswer) {
  if (!studentInput || !correctAnswer) return false;

  // 1. Normalize both strings: lowercase, remove punctuation, split into word tokens
  const cleanStudent = studentInput.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
  const cleanCorrect = correctAnswer.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();

  // Exact match shortcut
  if (cleanStudent === cleanCorrect) return true;

  const studentTokens = cleanStudent.split(/\s+/);
  const correctTokens = cleanCorrect.split(/\s+/);

  // 2. Keyword Intersection Check (checks if critical keywords are present)
  // Useful if the correct answer is a phrase like "Central Processing Unit" and they write "processing unit cpu"
  let matchedKeywords = 0;
  correctTokens.forEach(token => {
    if (token.length > 2 && studentTokens.includes(token)) {
      matchedKeywords++;
    }
  });

  // If most significant keywords (> 75%) match, consider it correct
  const keywordThreshold = Math.ceil(correctTokens.filter(t => t.length > 2).length * 0.75);
  if (keywordThreshold > 0 && matchedKeywords >= keywordThreshold) {
    return true;
  }

  // 3. Levenshtein Distance / Similarity Ratio for minor typos or single-word answers
  const similarity = calculateStringSimilarity(cleanStudent, cleanCorrect);
  return similarity >= 0.82; // 82% similarity tolerance for spelling variations
}

// Helper: Calculates normalized similarity score between 0 and 1
function calculateStringSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  if (longer.length === 0) return 1.0;
  
  const editDistance = getLevenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

// Helper: Computes standard Levenshtein edit distance
function getLevenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1  // deletion
          )
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// ==========================================================================
// 6. EDUCATOR CONTROL CENTER, DOCUMENT IMPORT & EXCEL REPORTS
// ==========================================================================

// --- Document Import & Parsing Engine ---
async function handleDocumentImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const fileName = file.name.toLowerCase();

  try {
    let textContent = "";

    if (fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
      textContent = await file.text();
    } else if (fileName.endsWith('.docx')) {
      // Basic text reader fallback for uploaded files
      textContent = await readDocxAsText(file);
    } else {
      alert("Please upload a .txt or .docx file containing structured questions.");
      return;
    }

    parseAndInjectQuestions(textContent);
    alert("Questions imported successfully from document!");
  } catch (err) {
    console.error("Error reading file:", err);
    alert("Failed to parse document: " + err.message);
  } finally {
    event.target.value = ''; // Reset file input
  }
}

async function readDocxAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      resolve(e.target.result);
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function parseAndInjectQuestions(rawText) {
  const blocks = rawText.split(/\n\s*\n/); // Split question blocks by double line breaks

  blocks.forEach(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;

    let questionText = "";
    let options = ["", "", "", ""];
    let correctIndex = 0;
    let qType = 'mcq';
    let textAnswerValue = "";

    lines.forEach((line, idx) => {
      if (idx === 0) {
        questionText = line.replace(/^(Q\d+[\.:]?|\d+[\.:])\s*/i, '');
      } else if (/^[A-D][\.:)]/i.test(line)) {
        const optLetter = line.charAt(0).toUpperCase();
        const optText = line.substring(2).trim();
        if (optLetter === 'A') options[0] = optText;
        if (optLetter === 'B') options[1] = optText;
        if (optLetter === 'C') options[2] = optText;
        if (optLetter === 'D') options[3] = optText;
      } else if (/^correct[\.:]?/i.test(line)) {
        const ansChar = line.replace(/^correct[\.:]?\s*/i, '').trim().toUpperCase();
        if (ansChar === 'B') correctIndex = 1;
        else if (ansChar === 'C') correctIndex = 2;
        else if (ansChar === 'D') correctIndex = 3;
        else correctIndex = 0;
      } else if (/^answer[\.:]?/i.test(line)) {
        // Explicitly capture lines starting with "answer:" or "answer."
        textAnswerValue = line.replace(/^answer[\.:]?\s*/i, '').trim();
      }
    });

    if (questionText) {
      const hasOptions = options.some(opt => opt !== "");
      if (!hasOptions) {
        qType = 'text';
        // If an explicit answer line wasn't matched separately, fall back to line 1 or strip prefixes
        if (!textAnswerValue && lines[1]) {
          textAnswerValue = lines[1].replace(/^answer[\.:]?\s*/i, "").trim();
        } else if (textAnswerValue) {
          textAnswerValue = textAnswerValue.replace(/^answer[\.:]?\s*/i, "").trim();
        }
      }

      // Inject directly into the builder form with cleaned text answer and empty array for accepted variations
      addQuestionToBuilder({
        type: qType,
        question: questionText,
        options: hasOptions ? options : undefined,
        correctAnswer: hasOptions ? correctIndex : textAnswerValue,
        acceptedAnswers: hasOptions ? [] : [textAnswerValue]
      });
    }
  });
}

// --- Quiz Builder Core ---
function toggleQuizBuilder() {
  const form = document.getElementById('createQuizForm');
  if (!form) return;

  const isHidden = form.style.display === 'none' || form.style.display === '';
  form.style.display = isHidden ? 'block' : 'none';

  if (isHidden) {
    editingQuizId = null;
    form.reset();
  }

  const container = document.getElementById('builderQuestionsContainer');
  if (isHidden && container && container.children.length === 0) {
    addQuestionToBuilder();
  }
}

function addQuestionToBuilder(existingData = {}) {
  builderQuestionCount++;
  const container = document.getElementById('builderQuestionsContainer');
  if (!container) return;

  const qIndex = container.children.length;
  const qType = existingData.type || 'mcq';
  const qText = existingData.question || '';
  const qMarks = existingData.marks || 1;

  const qCard = document.createElement('div');
  qCard.className = 'builder-question-card question-item';
  qCard.id = `builderQ_${builderQuestionCount}`;
  qCard.style.cssText = 'background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:1rem; margin-bottom:1rem; box-shadow:0 1px 2px rgba(0,0,0,0.03);';

  qCard.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
      <strong style="color:#1e293b; font-size:0.95rem;">Question #${builderQuestionCount}</strong>
      <div style="display: flex; gap: 0.75rem; align-items: center;">
        <select class="form-control q-type-select" onchange="toggleQuestionType(this, '${qCard.id}')" style="padding:0.2rem 0.4rem; border-radius:4px; border:1px solid #cbd5e1; font-size:0.8rem;">
          <option value="mcq" ${qType === 'mcq' ? 'selected' : ''}>Multiple Choice</option>
          <option value="text" ${qType === 'text' ? 'selected' : ''}>Short Answer / Text</option>
        </select>
        <button type="button" onclick="removeBuilderQuestion('${qCard.id}')" style="color:#ef4444; border:none; background:none; cursor:pointer; font-size:0.85rem; font-weight:600;">
          <i class="fa-solid fa-trash"></i> Remove
        </button>
      </div>
    </div>
    <input type="text" class="q-title" value="${qText}" placeholder="Enter question description..." required style="width:100%; padding:0.6rem; margin-bottom:0.75rem; border-radius:6px; border:1px solid #cbd5e1; font-size:0.9rem;">
    
    <div class="q-options-container" id="optionsContainer_${qCard.id}" style="display: ${qType === 'mcq' ? 'block' : 'none'};">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-bottom:0.75rem;">
        <input type="text" class="q-opt-0" value="${existingData.options ? existingData.options[0] || '' : ''}" placeholder="Option 1" style="padding:0.5rem; border-radius:4px; border:1px solid #cbd5e1; font-size:0.85rem;">
        <input type="text" class="q-opt-1" value="${existingData.options ? existingData.options[1] || '' : ''}" placeholder="Option 2" style="padding:0.5rem; border-radius:4px; border:1px solid #cbd5e1; font-size:0.85rem;">
        <input type="text" class="q-opt-2" value="${existingData.options ? existingData.options[2] || '' : ''}" placeholder="Option 3" style="padding:0.5rem; border-radius:4px; border:1px solid #cbd5e1; font-size:0.85rem;">
        <input type="text" class="q-opt-3" value="${existingData.options ? existingData.options[3] || '' : ''}" placeholder="Option 4" style="padding:0.5rem; border-radius:4px; border:1px solid #cbd5e1; font-size:0.85rem;">
      </div>
      <div style="display:flex; align-items:center; gap:0.5rem; background:#f8fafc; padding:0.5rem; border-radius:6px; border:1px solid #f1f5f9; margin-bottom:0.75rem;">
        <label style="font-size:0.85rem; font-weight:600; color:#475569;">Correct Option:</label>
        <select class="q-correct" style="padding:0.3rem 0.5rem; border-radius:4px; border:1px solid #cbd5e1; font-size:0.85rem;">
          <option value="0" ${existingData.correctAnswer === 0 ? 'selected' : ''}>Option 1</option>
          <option value="1" ${existingData.correctAnswer === 1 ? 'selected' : ''}>Option 2</option>
          <option value="2" ${existingData.correctAnswer === 2 ? 'selected' : ''}>Option 3</option>
          <option value="3" ${existingData.correctAnswer === 3 ? 'selected' : ''}>Option 4</option>
        </select>
      </div>
    </div>

    <div class="q-text-answer-container" id="textContainer_${qCard.id}" style="display: ${qType === 'text' ? 'block' : 'none'}; margin-bottom:0.75rem;">
      <label style="font-size:0.85rem; font-weight:600; color:#475569; display:block; margin-bottom:0.25rem;">Expected Correct Answer:</label>
      <input type="text" class="q-text-correct" value="${qType === 'text' ? (existingData.correctAnswer || '') : ''}" placeholder="Type exact expected answer for grading..." style="width:100%; padding:0.5rem; border-radius:4px; border:1px solid #cbd5e1; font-size:0.85rem;" />
    </div>
  `;

  container.appendChild(qCard);
}

// ==========================================================================
// QUIZ BUILDER MANAGEMENT & HANDLERS (Maintained & Fully Integrated)
// ==========================================================================

function toggleQuestionType(selectElement, cardId) {
  const card = document.getElementById(cardId);
  const optionsContainer = card.querySelector(`#optionsContainer_${cardId}`);
  const textContainer = card.querySelector(`#textContainer_${cardId}`);
  
  if (selectElement.value === 'text') {
    optionsContainer.style.display = 'none';
    textContainer.style.display = 'block';
  } else {
    optionsContainer.style.display = 'block';
    textContainer.style.display = 'none';
  }
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
    const typeSelect = qEl.querySelector('.q-type-select');
    const qType = typeSelect ? typeSelect.value : 'mcq';
    const qText = qEl.querySelector('.q-title').value.trim();

    if (qType === 'text') {
      const textCorrect = qEl.querySelector('.q-text-correct').value.trim();
      questions.push({
        id: idx + 1,
        type: 'text',
        question: qText,
        correctAnswer: textCorrect,
        marks: 1
      });
    } else {
      questions.push({
        id: idx + 1,
        type: 'mcq',
        question: qText,
        options: [
          qEl.querySelector('.q-opt-0').value.trim(),
          qEl.querySelector('.q-opt-1').value.trim(),
          qEl.querySelector('.q-opt-2').value.trim(),
          qEl.querySelector('.q-opt-3').value.trim()
        ],
        correctAnswer: parseInt(qEl.querySelector('.q-correct').value, 10),
        marks: 1
      });
    }
  });

  // Check original class if editing
  let originalQuizClass = null;
  if (editingQuizId) {
    const cachedQuizzes = JSON.parse(localStorage.getItem('portal_quizzes_cache')) || [];
    const existingOriginal = cachedQuizzes.find(q => q.id === editingQuizId);
    if (existingOriginal) {
      originalQuizClass = existingOriginal.targetClass;
    }
  }

  // Determine if target class changed during an edit
  const isClassChanged = editingQuizId && originalQuizClass && originalQuizClass !== targetClass;

  const quizDoc = {
    title,
    targetClass,
    durationMinutes: duration,
    questions,
    updatedAt: firebase.firestore.FieldValue ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
  };

  try {
    if (db) {
      if (editingQuizId && !isClassChanged) {
        // Same class: Update existing record normally
        await db.collection('quizzes').doc(editingQuizId).update(quizDoc);
        alert("Quiz updated successfully!");
      } else {
        // Brand new quiz or class changed: Keep old quiz and create a separate new record
        quizDoc.createdBy = currentUser ? currentUser.username : "Admin";
        quizDoc.createdAt = firebase.firestore.FieldValue ? firebase.firestore.FieldValue.serverTimestamp() : new Date();
        await db.collection('quizzes').add(quizDoc);

        if (isClassChanged) {
          alert(`Class changed from "${originalQuizClass}" to "${targetClass}". The original quiz remains intact, and a new quiz variant has been created for ${targetClass}!`);
        } else {
          alert("Quiz created and published successfully!");
        }
      }
    } else {
      // LocalStorage fallback handling
      let cached = JSON.parse(localStorage.getItem('portal_quizzes_cache')) || MOCK_QUIZZES;
      if (editingQuizId && !isClassChanged) {
        cached = cached.map(q => q.id === editingQuizId ? { ...q, ...quizDoc } : q);
        alert("Quiz updated locally!");
      } else {
        cached.push({ id: `local_${Date.now()}`, ...quizDoc });
        alert(isClassChanged ? "Class changed: Original quiz preserved and a new variant created!" : "Quiz created locally!");
      }
      localStorage.setItem('portal_quizzes_cache', JSON.stringify(cached));
      renderQuizCards(cached);
    }

    // Cleanup form and states
    editingQuizId = null;
    document.getElementById('createQuizForm').reset();
    document.getElementById('builderQuestionsContainer').innerHTML = '';
    builderQuestionCount = 0;
    toggleQuizBuilder();
  } catch (err) {
    console.error("Error saving quiz:", err);
    alert("Failed to save quiz: " + err.message);
  }
}

// ==========================================================================
// EDUCATOR RESULTS, OVERSIGHT & ANALYTICS DASHBOARD (Maintained & Enhanced)
// ==========================================================================

// Pagination State for Teacher Submissions
let currentSubmissionsPage = 1;
const submissionsPerPage = 10; // Change this if you want more or fewer rows per page

async function fetchQuizResults() {
  const resultsContainer = document.getElementById('teacherResultsTable');
  if (!resultsContainer) return;

  if (!db) {
    resultsContainer.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#64748b; padding:1rem;">Live results database unreachable.</td></tr>`;
    document.getElementById('submissionsPagination').style.display = 'none';
    return;
  }

  try {
    const snapshot = await db.collection('quiz_results').orderBy('submittedAt', 'desc').get();
    if (snapshot.empty) {
      resultsContainer.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#64748b; padding:1rem;">No submissions registered yet.</td></tr>`;
      document.getElementById('submissionsPagination').style.display = 'none';
      return;
    }

    globalTeacherResults = [];
    snapshot.forEach(doc => {
      globalTeacherResults.push({ id: doc.id, ...doc.data() });
    });

    // Render the first page of results
    currentSubmissionsPage = 1;
    renderSubmissionsTablePage();

  } catch (err) {
    console.error("Error fetching submission results:", err);
    resultsContainer.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#ef4444; padding:1rem;">Failed to load submission results.</td></tr>`;
    document.getElementById('submissionsPagination').style.display = 'none';
  }
}

// Renders the specific slice of rows for the current page
function renderSubmissionsTablePage() {
  const resultsContainer = document.getElementById('teacherResultsTable');
  const paginationContainer = document.getElementById('submissionsPagination');
  
  if (!globalTeacherResults || globalTeacherResults.length === 0) {
    resultsContainer.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#64748b; padding:1rem;">No submissions registered yet.</td></tr>`;
    if (paginationContainer) paginationContainer.style.display = 'none';
    return;
  }

  if (paginationContainer) paginationContainer.style.display = 'flex';

  const totalPages = Math.ceil(globalTeacherResults.length / submissionsPerPage) || 1;
  if (currentSubmissionsPage > totalPages) currentSubmissionsPage = totalPages;
  if (currentSubmissionsPage < 1) currentSubmissionsPage = 1;

  const start = (currentSubmissionsPage - 1) * submissionsPerPage;
  const end = start + submissionsPerPage;
  const paginatedItems = globalTeacherResults.slice(start, end);

  let rowsHtml = '';
  paginatedItems.forEach(res => {
    const submittedTime = res.submittedAt && res.submittedAt.toDate 
      ? new Date(res.submittedAt.toDate()).toLocaleString() 
      : 'Recently';

    rowsHtml += `
      <tr style="border-bottom:1px solid #f1f5f9;" id="submissionRow_${res.id}">
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

        <!-- Column 7: Actions (Icons Only) -->
        <td style="padding:0.75rem;">
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button class="btn btn-secondary btn-sm" onclick="inspectLearnerSubmission('${res.id}')" title="Inspect Submission" style="background:#0284c7; border:none; padding:0.35rem 0.5rem; font-size:0.85rem; border-radius:4px; color:#fff; cursor:pointer;">
              <i class="fa-solid fa-eye"></i>
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteQuizSubmission('${res.id}')" title="Delete Submission" style="background:#dc2626; border:none; padding:0.35rem 0.5rem; font-size:0.85rem; border-radius:4px; color:#fff; cursor:pointer;">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  resultsContainer.innerHTML = rowsHtml;

  // Update Pagination Controls UI text & button states
  const infoEl = document.getElementById('submissionsPaginationInfo');
  const pageIndEl = document.getElementById('subPageIndicator');
  const prevBtn = document.getElementById('subPrevBtn');
  const nextBtn = document.getElementById('subNextBtn');

  if (infoEl) infoEl.innerText = `Showing ${start + 1} to ${Math.min(end, globalTeacherResults.length)} of ${globalTeacherResults.length} entries`;
  if (pageIndEl) pageIndEl.innerText = `Page ${currentSubmissionsPage} of ${totalPages}`;
  if (prevBtn) prevBtn.disabled = currentSubmissionsPage === 1;
  if (nextBtn) nextBtn.disabled = currentSubmissionsPage === totalPages;
}

// Triggered by Next / Prev buttons in HTML
function changeSubmissionsPage(direction) {
  currentSubmissionsPage += direction;
  renderSubmissionsTablePage();
}

// --- Analytics & Visual Dashboard Integration ---
function renderTeacherAnalyticsModal(quizId, quizTitle, submissionsList) {
  let modal = document.getElementById('teacherAnalyticsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'teacherAnalyticsModal';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:none; justify-content:center; align-items:center; z-index:1000; padding:1rem;';
    modal.innerHTML = `
      <div style="background:#ffffff; border-radius:12px; width:100%; max-width:700px; max-height:90vh; overflow-y:auto; box-shadow:0 10px 25px rgba(0,0,0,0.1); padding:1.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; border-bottom:1px solid #e2e8f0; padding-bottom:0.75rem;">
          <h3 id="analyticsModalTitle" style="margin:0; font-size:1.25rem; color:#0f172a;">Quiz Analytics</h3>
          <button onclick="closeTeacherAnalyticsModal()" style="background:none; border:none; font-size:1.25rem; cursor:pointer; color:#64748b;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div id="analyticsModalContent"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const titleEl = document.getElementById('analyticsModalTitle');
  if (titleEl) titleEl.textContent = `Analytics: ${quizTitle}`;

  const relevantSubs = (submissionsList || globalTeacherResults).filter(s => s.quizId === quizId || s.quizTitle === quizTitle);
  const contentEl = document.getElementById('analyticsModalContent');

  if (relevantSubs.length === 0) {
    contentEl.innerHTML = `<p style="text-align:center; color:#64748b; padding:2rem;">No student attempts recorded for this assessment yet.</p>`;
  } else {
    const totalAttempts = relevantSubs.length;
    const avgScore = Math.round(relevantSubs.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / totalAttempts);
    const highestScore = Math.max(...relevantSubs.map(s => s.percentage || 0));
    const lowestScore = Math.min(...relevantSubs.map(s => s.percentage || 0));

    contentEl.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:0.75rem; margin-bottom:1.5rem;">
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:1rem; text-align:center;">
          <div style="font-size:0.75rem; color:#64748b; font-weight:600; text-transform:uppercase;">Total Attempts</div>
          <div style="font-size:1.5rem; font-weight:700; color:#0f172a; margin-top:0.25rem;">${totalAttempts}</div>
        </div>
        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:1rem; text-align:center;">
          <div style="font-size:0.75rem; color:#15803d; font-weight:600; text-transform:uppercase;">Average Score</div>
          <div style="font-size:1.5rem; font-weight:700; color:#16a34a; margin-top:0.25rem;">${avgScore}%</div>
        </div>
        <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:1rem; text-align:center;">
          <div style="font-size:0.75rem; color:#1d4ed8; font-weight:600; text-transform:uppercase;">Highest Score</div>
          <div style="font-size:1.5rem; font-weight:700; color:#2563eb; margin-top:0.25rem;">${highestScore}%</div>
        </div>
        <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:1rem; text-align:center;">
          <div style="font-size:0.75rem; color:#b91c1c; font-weight:600; text-transform:uppercase;">Lowest Score</div>
          <div style="font-size:1.5rem; font-weight:700; color:#dc2626; margin-top:0.25rem;">${lowestScore}%</div>
        </div>
      </div>
      <h4 style="margin:0 0 0.75rem 0; font-size:1rem; color:#1e293b;">Performance Breakdown</h4>
      <div style="max-height:250px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:6px;">
        <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
          <thead>
            <tr style="background:#f1f5f9; text-align:left; color:#475569;">
              <th style="padding:0.6rem;">Student</th>
              <th style="padding:0.6rem;">Class</th>
              <th style="padding:0.6rem;">Score</th>
              <th style="padding:0.6rem;">Time</th>
            </tr>
          </thead>
          <tbody>
            ${relevantSubs.map(s => `
              <tr style="border-top:1px solid #f1f5f9;">
                <td style="padding:0.6rem; font-weight:600; color:#0f172a;">${s.studentName}</td>
                <td style="padding:0.6rem; color:#64748b;">${s.studentClass || 'N/A'}</td>
                <td style="padding:0.6rem; font-weight:600; color:${s.percentage >= 50 ? '#16a34a' : '#dc2626'};">${s.percentage}%</td>
                <td style="padding:0.6rem; color:#64748b;">${formatSeconds(s.timeSpentSeconds)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  modal.style.display = 'flex';
}

function closeTeacherAnalyticsModal() {
  const modal = document.getElementById('teacherAnalyticsModal');
  if (modal) modal.style.display = 'none';
}

// Delete a student's submission from the oversight table
async function deleteQuizSubmission(docId) {
  if (!confirm("Are you sure you want to delete this student submission? This action cannot be undone.")) {
    return;
  }

  try {
    if (db) {
      await db.collection('quiz_results').doc(docId).delete();
    }

    // Remove from the global tracking array
    globalTeacherResults = globalTeacherResults.filter(s => s.id !== docId);

    // Remove the row dynamically from the HTML table without reloading
    const row = document.getElementById(`submissionRow_${docId}`);
    if (row) row.remove();

    // Check if table is empty now and show empty state if necessary
    const resultsContainer = document.getElementById('teacherResultsTable');
    if (resultsContainer && resultsContainer.children.length === 0) {
      resultsContainer.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#64748b; padding:1rem;">No submissions registered yet.</td></tr>`;
    }

  } catch (err) {
    console.error("Error deleting quiz submission:", err);
    alert("Failed to delete submission: " + err.message);
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
        <div><strong>Selected/Entered:</strong> ${item.selectedOption}</div>
        ${!item.isCorrect ? `<div style="color:#dc2626; margin-top:0.25rem;"><strong>Expected Answer:</strong> ${item.correctOption}</div>` : ''}
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
// ==========================================================================
// MULTI-SHEET EXCEL EXPORT (ROBUST GLOBAL CHECK)
// ==========================================================================
function exportResultsToExcel() {
  const XLSXLib = window.XLSX || window.XLSXStyle;

  if (!XLSXLib) {
    alert("SheetJS library is not loaded. Please ensure the Excel library script is included.");
    return;
  }

  if (!globalTeacherResults || globalTeacherResults.length === 0) {
    alert("No student results available to export.");
    return;
  }

  try {
    const wb = XLSXLib.utils.book_new();
    const groupedData = {};

    globalTeacherResults.forEach(res => {
      const className = res.studentClass || "Unassigned Class";
      const quizTitle = res.quizTitle || "General Quiz";

      if (!groupedData[className]) groupedData[className] = {};
      if (!groupedData[className][quizTitle]) groupedData[className][quizTitle] = [];

      let submittedStr = "Recently";
      if (res.submittedAt) {
        if (typeof res.submittedAt.toDate === 'function') {
          submittedStr = new Date(res.submittedAt.toDate()).toLocaleString();
        } else if (res.submittedAt instanceof Date) {
          submittedStr = res.submittedAt.toLocaleString();
        } else {
          submittedStr = String(res.submittedAt);
        }
      }

      groupedData[className][quizTitle].push({
        "Student Name": res.studentName || "N/A",
        "Class": className,
        "Assessment Title": quizTitle,
        "Score (%)": `${res.score || 0}/${res.totalQuestions || 0} (${res.percentage || 0}%)`,
        "Time Spent": typeof formatSeconds === 'function' ? formatSeconds(res.timeSpentSeconds) : `${res.timeSpentSeconds || 0}s`,
        "Submitted At": submittedStr
      });
    });

    Object.keys(groupedData).forEach(className => {
      Object.keys(groupedData[className]).forEach(quizTitle => {
        const rows = groupedData[className][quizTitle];
        const ws = XLSXLib.utils.json_to_sheet(rows);

        if (ws && ws['!ref']) {
          const range = XLSXLib.utils.decode_range(ws['!ref']);
          const colWidths = [];

          for (let C = range.s.c; C <= range.e.c; ++C) {
            let maxLen = 10;
            for (let R = range.s.r; R <= range.e.r; ++R) {
              const cellRef = XLSXLib.utils.encode_cell({ c: C, r: R });
              if (ws[cellRef] && ws[cellRef].v) {
                const val = String(ws[cellRef].v);
                if (val.length > maxLen) maxLen = val.length;
              }
            }
            colWidths.push({ wch: Math.max(maxLen + 4, 15) });
          }
          ws['!cols'] = colWidths;
        }

        let safeSheetName = `${className} - ${quizTitle}`.replace(/[:\\\/?*\[\]]/g, "");
        if (safeSheetName.length > 31) {
          safeSheetName = safeSheetName.substring(0, 31);
        }

        XLSXLib.utils.book_append_sheet(wb, ws, safeSheetName);
      });
    });

    const dateStr = new Date().toISOString().split('T')[0];
    XLSXLib.writeFile(wb, `Student_Quiz_Results_${dateStr}.xlsx`);
  } catch (err) {
    console.error("Excel Export Error:", err);
    alert("An error occurred while generating the Excel spreadsheet. Check console for details.");
  }
}

// Delete a student's submission from the oversight table
async function deleteQuizSubmission(docId) {
  if (!confirm("Are you sure you want to delete this student submission? This action cannot be undone.")) {
    return;
  }

  try {
    if (db) {
      await db.collection('quiz_results').doc(docId).delete();
    }

    // Remove from the global tracking array
    globalTeacherResults = globalTeacherResults.filter(s => s.id !== docId);

    // Remove the row dynamically from the HTML table without reloading
    const row = document.getElementById(`submissionRow_${docId}`);
    if (row) row.remove();

    // Check if table is empty now and show empty state if necessary
    const resultsContainer = document.getElementById('teacherResultsTable');
    if (resultsContainer && resultsContainer.children.length === 0) {
      resultsContainer.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#64748b; padding:1rem;">No submissions registered yet.</td></tr>`;
    }

  } catch (err) {
    console.error("Error deleting quiz submission:", err);
    alert("Failed to delete submission: " + err.message);
  }
}
// ==========================================================================
// EDIT QUIZ BUILDER POPULATION (Maintained & Fully Integrated)
// ==========================================================================

// Populate the builder form with existing quiz data for editing
function editQuiz(quizId) {
  const cachedQuizzes = JSON.parse(localStorage.getItem('portal_quizzes_cache')) || [];
  const quiz = cachedQuizzes.find(q => q.id === quizId);
  
  if (!quiz) {
    alert("Quiz data not found.");
    return;
  }

  editingQuizId = quiz.id;

  // Ensure the quiz builder panel is visible
  const form = document.getElementById('createQuizForm');
  if (form && (form.style.display === 'none' || form.style.display === '')) {
    form.style.display = 'block';
  }

  // Populate basic metadata fields
  const titleInput = document.getElementById('builderTitle');
  const classSelect = document.getElementById('builderClass');
  const durationInput = document.getElementById('builderDuration');

  if (titleInput) titleInput.value = quiz.title || '';
  if (classSelect) classSelect.value = quiz.targetClass || 'All';
  if (durationInput) durationInput.value = quiz.durationMinutes || 10;

  // Clear and reload questions into the builder
  const container = document.getElementById('builderQuestionsContainer');
  if (container) {
    container.innerHTML = '';
    builderQuestionCount = 0;
    
    if (quiz.questions && quiz.questions.length > 0) {
      quiz.questions.forEach(q => {
        addQuestionToBuilder(q);
      });
    } else {
      addQuestionToBuilder();
    }
  }

  // Scroll smoothly up to the builder form
  form.scrollIntoView({ behavior: 'smooth' });
}

// ==========================================================================
// 7. QUIZ RUNNER ENGINE (Maintained & Fully Integrated)
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
    const headerBackBtn = document.getElementById('runnerBackButton');
    if (headerBackBtn) headerBackBtn.style.display = 'inline-flex';

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

// ==========================================================================
// 8. TIMER, SUBMISSION & 9. PDF REPORT GENERATOR (Fully Integrated)
// ==========================================================================

function renderQuizQuestions(questions) {
  const container = document.getElementById('questionsList');
  if (!container) return;

  if (questions.length === 0) {
    container.innerHTML = `<p style="padding:1rem; color:#64748b;">No questions attached to this assessment.</p>`;
    return;
  }

  let html = '';
  questions.forEach((q, qIndex) => {
    let inputsHtml = '';
    
    if (q.type === 'text') {
      inputsHtml = `
        <div class="form-group" style="margin-top: 1rem;">
          <input type="text" class="form-control student-answer-input" name="q_${qIndex}" placeholder="Type your concise answer here..." style="width:100%; padding:0.6rem; border-radius:6px; border:1px solid #cbd5e1; font-size:0.9rem;" />
        </div>
      `;
    } else {
      inputsHtml = `<div class="options-list" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem;">`;
      (q.options || []).forEach((opt, optIndex) => {
        inputsHtml += `
          <label class="option-label" style="display:flex; align-items:center; gap:0.75rem; padding:0.6rem 0.8rem; background:#ffffff; border:1px solid #cbd5e1; border-radius:6px; cursor:pointer; font-size:0.9rem;">
            <input type="radio" name="q_${qIndex}" value="${optIndex}" style="accent-color:#2563eb;">
            <span>${opt}</span>
          </label>
        `;
      });
      inputsHtml += `</div>`;
    }

    html += `
      <div class="question-item" style="margin-bottom:1.5rem; padding:1.25rem; border:1px solid #e2e8f0; border-radius:8px; background:#fafafa;">
        <div class="question-text" style="font-weight:600; font-size:1rem; margin-bottom:0.5rem; color:#0f172a;">
          ${qIndex + 1}. ${q.question}
        </div>
        ${inputsHtml}
      </div>
    `;
  });

  container.innerHTML = html;
}

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

// ==========================================================================
// SUBMIT QUIZ WITH MULTI-ANSWER SCHEMES & TEACHER MODERATION QUEUE
// ==========================================================================
async function submitQuizToFirestore() {
  clearInterval(quizTimerInterval);

  if (!activeQuizData) return;

  let score = 0;
  const questions = activeQuizData.questions || [];
  const total = questions.length;

  const headerBackBtn = document.getElementById('runnerBackButton');
  if (headerBackBtn) headerBackBtn.style.display = 'none';

  const studentAnswers = [];
  const detailedResponses = [];
  let requiresTeacherReview = false;

  // Helper function to check multiple acceptable answer schemes
  const evaluateMultiAnswer = (studentInput, q) => {
    if (!studentInput) return { isCorrect: false, isPending: false };

    const cleanStudent = String(studentInput)
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
      .trim();

    // Gather all acceptable answers from array or fallback to correctAnswer string
    let acceptedList = [];
    if (Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length > 0) {
      acceptedList = q.acceptedAnswers;
    } else if (q.correctAnswer) {
      const raw = String(q.correctAnswer).replace(/^answer:\s*/i, "").trim();
      acceptedList = raw.includes(",") ? raw.split(",").map(s => s.trim()) : [raw];
    }

    // Check exact or normalized match against any allowed variation
    const matched = acceptedList.some(ans => {
      const cleanAns = String(ans)
        .replace(/^answer:\s*/i, "")
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
        .trim();
      return cleanStudent === cleanAns;
    });

    if (matched) {
      return { isCorrect: true, isPending: false };
    }

    // If no predefined match is found, flag it for teacher review instead of failing automatically
    return { isCorrect: false, isPending: true };
  };

  questions.forEach((q, idx) => {
    let isCorrect = false;
    let isPendingReview = false;
    let selectedOptionText = "Unanswered";

    if (q.type === 'text') {
      const inputEl = document.querySelector(`input[name="q_${idx}"]`);
      const val = inputEl ? inputEl.value.trim() : "";
      studentAnswers.push(val);
      selectedOptionText = val !== "" ? val : "Unanswered";
      
      if (val !== "") {
        const evalResult = evaluateMultiAnswer(val, q);
        isCorrect = evalResult.isCorrect;
        isPendingReview = evalResult.isPending;
        if (isPendingReview) requiresTeacherReview = true;
      }
    } else {
      const selected = document.querySelector(`input[name="q_${idx}"]:checked`);
      const answerIndex = selected ? parseInt(selected.value, 10) : -1;
      studentAnswers.push(answerIndex);

      selectedOptionText = answerIndex >= 0 && q.options ? q.options[answerIndex] : "Unanswered";
      if (answerIndex === q.correctAnswer) {
        isCorrect = true;
      }
    }

    if (isCorrect) score++;

    // Format display string for correct option(s)
    let displayCorrect = "";
    if (q.type === 'text') {
      if (Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length > 0) {
        displayCorrect = q.acceptedAnswers.join(" / ");
      } else {
        displayCorrect = String(q.correctAnswer || "").replace(/^answer:\s*/i, "").trim();
      }
    } else {
      displayCorrect = q.options ? q.options[q.correctAnswer] : '';
    }

    detailedResponses.push({
      questionText: q.question,
      selectedOption: selectedOptionText,
      correctOption: displayCorrect,
      isCorrect,
      isPendingReview: isPendingReview || false
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
    status: requiresTeacherReview ? "Pending Review" : "Graded",
    submittedAt: firebase.firestore.FieldValue ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
  };

  try {
    if (db) {
      await db.collection('quiz_results').add(resultRecord);
    }

    const reviewNote = requiresTeacherReview ? "\n*(Note: Some text answers are pending educator moderation)*" : "";
    alert(`Quiz Submitted Successfully!\nScore: ${score}/${total} (${percentage}%)\nTime Taken: ${formatSeconds(timeSpentSeconds)}${reviewNote}`);

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
// TEACHER MODERATION QUEUE & APPROVAL FUNCTIONS
// ==========================================================================
function renderTeacherModerationQueue(submissions) {
  const container = document.getElementById('teacherModerationContainer');
  if (!container) return;

  const pendingSubmissions = submissions.filter(sub => sub.status === "Pending Review");

  if (pendingSubmissions.length === 0) {
    container.innerHTML = `<p class="text-gray-500 text-sm">No short-answer responses currently require moderation.</p>`;
    return;
  }

  let html = `<h3 class="text-md font-bold mb-3 text-sky-700">Short-Answer Moderation Queue</h3>`;
  
  pendingSubmissions.forEach(sub => {
    html += `<div class="border border-gray-200 rounded p-4 mb-3 bg-white shadow-sm">
      <p class="font-semibold text-gray-800">${sub.studentName} (${sub.studentClass}) — Quiz: ${sub.quizTitle}</p>
      <div class="mt-2 space-y-2">`;

    sub.detailedResponses.forEach((resp, qIdx) => {
      if (resp.isPendingReview) {
        html += `<div class="bg-amber-50 border-l-4 border-amber-400 p-2 text-sm">
          <p class="font-medium text-gray-700">Q: ${resp.questionText}</p>
          <p class="text-gray-900 mt-1">Student Answer: <span class="font-bold underline">${resp.selectedOption}</span></p>
          <p class="text-gray-500 text-xs mt-1">Expected Scheme: ${resp.correctOption}</p>
          <div class="mt-2 flex gap-2">
            <button onclick="moderateAnswer('${sub.id}', ${qIdx}, true)" class="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700">Approve as Correct</button>
            <button onclick="moderateAnswer('${sub.id}', ${qIdx}, false)" class="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700">Keep Incorrect</button>
          </div>
        </div>`;
      }
    });

    html += `</div></div>`;
  });

  container.innerHTML = html;
}

async function moderateAnswer(resultId, questionIndex, approve) {
  if (!db) return;

  try {
    const docRef = db.collection('quiz_results').doc(resultId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) return;
    const data = docSnap.data();

    let newScore = data.score;
    const detailed = data.detailedResponses;

    if (detailed[questionIndex].isPendingReview) {
      detailed[questionIndex].isPendingReview = false;
      if (approve) {
        detailed[questionIndex].isCorrect = true;
        newScore += 1;
      } else {
        detailed[questionIndex].isCorrect = false;
      }
    }

    const stillPending = detailed.some(r => r.isPendingReview);
    const newPercentage = Math.round((newScore / data.totalQuestions) * 100);

    await docRef.update({
      score: newScore,
      percentage: newPercentage,
      detailedResponses: detailed,
      status: stillPending ? "Pending Review" : "Graded"
    });

    alert("Moderation updated successfully!");
    if (typeof fetchQuizResults === 'function') {
      fetchQuizResults();
    }
  } catch (err) {
    console.error("Error updating moderation status:", err);
    alert("Failed to save moderation action.");
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
    item.isCorrect ? "Pass" : "Fail"
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
      4: { cellWidth: 20, fontStyle: 'bold', halign: 'center' }
    },
    didParseCell: function(data) {
      if (data.column.index === 4 && data.cell.section === 'body') {
        if (data.cell.raw === 'Pass') {
          data.cell.styles.textColor = [22, 163, 74]; // Green for tick
        } else {
          data.cell.styles.textColor = [220, 38, 38]; // Red for cross
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
