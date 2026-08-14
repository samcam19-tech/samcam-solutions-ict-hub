// ==========================================================================
// 1. FIREBASE CONFIGURATION & INITIALIZATION
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
// 2. STATE MANAGEMENT & GLOBALS
// ==========================================================================
let currentUser = null;
let activeQuizData = null;
let quizTimerInterval = null;
let builderQuestionCount = 0;

// ==========================================================================
// 3. INITIALIZATION ON PAGE LOAD
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  try {
    const sessionData = localStorage.getItem('portal_session');
    
    if (sessionData) {
      currentUser = JSON.parse(sessionData);
    } else {
      currentUser = { username: "teacher", role: "Teacher", class: "S4", fullName: "Teacher / Admin" };
    }

    // Safely update user badge
    const userBadge = document.getElementById('userBadge');
    if (userBadge) {
      const roleText = (currentUser.role && currentUser.role.toLowerCase() === 'teacher') || currentUser.role === 'admin' 
        ? 'Teacher' 
        : (currentUser.class || 'Student');
      userBadge.innerHTML = `<i class="fa-solid fa-user"></i> ${currentUser.fullName || currentUser.username} (${roleText})`;
    }

    // Safely check role
    const userRole = (currentUser.role || '').toLowerCase();
    const isTeacher = userRole === 'teacher' || userRole === 'admin';
    
    const teacherPanel = document.getElementById('teacherPanel');
    if (isTeacher && teacherPanel) {
      teacherPanel.style.display = 'block';
      setTimeout(fetchQuizResults, 300); // Deferred execution to prevent render lag
    }

    // Initialize Quiz Data Fetching
    fetchActiveQuizzes();
  } catch (err) {
    console.error("Initialization Error:", err);
  }
});

// ==========================================================================
// 4. INSTANT CACHE + REAL-TIME QUIZ SYNC ENGINE
// ==========================================================================

function fetchActiveQuizzes() {
  const quizListContainer = document.getElementById('quizList');
  if (!quizListContainer) return;

  // STEP 1: Load from cache instantly (0ms UI render delay)
  const cachedQuizzes = JSON.parse(localStorage.getItem('portal_quizzes_cache')) || [];
  if (cachedQuizzes.length > 0) {
    renderQuizCards(cachedQuizzes);
  } else {
    quizListContainer.innerHTML = `<p style="padding:1rem; color:#64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Loading active quizzes...</p>`;
  }

  // STEP 2: Live Database Listener
  if (!db) {
    quizListContainer.innerHTML = `<p style="color:#ef4444; padding:1rem;">Firebase not loaded properly.</p>`;
    return;
  }

  db.collection('quizzes').onSnapshot((snapshot) => {
    const freshQuizzes = [];
    snapshot.forEach((doc) => {
      freshQuizzes.push({ id: doc.id, ...doc.data() });
    });

    // Update Local Storage Cache
    localStorage.setItem('portal_quizzes_cache', JSON.stringify(freshQuizzes));

    // Render updated cards
    renderQuizCards(freshQuizzes);
  }, (err) => {
    console.error("Firestore Listener Error:", err);
    if (cachedQuizzes.length === 0) {
      quizListContainer.innerHTML = `<p style="color:#ef4444; padding:1rem;">Error fetching quizzes. Please check database permissions.</p>`;
    }
  });
}

function renderQuizCards(quizzesList) {
  const quizListContainer = document.getElementById('quizList');
  if (!quizListContainer) return;

  const userRole = (currentUser && currentUser.role ? currentUser.role : '').toLowerCase();
  const isTeacher = userRole === 'teacher' || userRole === 'admin';

  // In-Memory Filter
  const filteredQuizzes = quizzesList.filter(q => {
    if (isTeacher) return true;
    if (!currentUser.class) return true;
    const target = q.targetClass || 'All';
    return target === 'All' || target === currentUser.class;
  });

  if (filteredQuizzes.length === 0) {
    quizListContainer.innerHTML = `<p style="grid-column: 1/-1; color: #64748b; padding:1rem;">No active quizzes found ${currentUser.class ? 'for class ' + currentUser.class : ''}.</p>`;
    return;
  }

  let html = '';
  filteredQuizzes.forEach(q => {
    html += `
      <div class="quiz-card" style="border:1px solid #e2e8f0; padding:1rem; border-radius:8px; background:#fff; margin-top:1rem; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <div>
          <span class="quiz-badge" style="background:#e0f2fe; color:#0369a1; padding:0.2rem 0.5rem; border-radius:4px; font-size:0.75rem; font-weight:600;">${q.targetClass || 'All Classes'}</span>
          <h4 style="margin: 0.5rem 0; font-size:1.1rem;">${q.title}</h4>
          <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem;">
            <i class="fa-solid fa-clock"></i> ${q.durationMinutes} Minutes | ${q.questions ? q.questions.length : 0} Questions
          </p>
        </div>
        <button onclick="startQuiz('${q.id}')" class="btn-action" style="padding:0.5rem 1rem; background:#2563eb; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:500;">
          <i class="fa-solid fa-play"></i> Start Quiz
        </button>
      </div>
    `;
  });

  quizListContainer.innerHTML = html;
}

// ==========================================================================
// 5. TEACHER / ADMIN: QUIZ BUILDER & RESULTS TRACKER
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
  qCard.style.cssText = 'background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:1rem; margin-bottom:1rem;';

  qCard.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
      <strong>Question #${builderQuestionCount}</strong>
      <button type="button" onclick="removeBuilderQuestion('${qCard.id}')" style="color:#ef4444; border:none; background:none; cursor:pointer;">
        <i class="fa-solid fa-trash"></i> Remove
      </button>
    </div>
    <input type="text" class="q-title" placeholder="Enter question text..." required style="width:100%; padding:0.5rem; margin-bottom:0.75rem; border-radius:4px; border:1px solid #cbd5e1;">
    
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-bottom:0.75rem;">
      <input type="text" class="q-opt-0" placeholder="Option 1" required style="padding:0.4rem; border-radius:4px; border:1px solid #cbd5e1;">
      <input type="text" class="q-opt-1" placeholder="Option 2" required style="padding:0.4rem; border-radius:4px; border:1px solid #cbd5e1;">
      <input type="text" class="q-opt-2" placeholder="Option 3" required style="padding:0.4rem; border-radius:4px; border:1px solid #cbd5e1;">
      <input type="text" class="q-opt-3" placeholder="Option 4" required style="padding:0.4rem; border-radius:4px; border:1px solid #cbd5e1;">
    </div>

    <label style="font-size:0.85rem; font-weight:600;">Correct Option Index:</label>
    <select class="q-correct" required style="padding:0.4rem; border-radius:4px; border:1px solid #cbd5e1;">
      <option value="0">Option 1</option>
      <option value="1">Option 2</option>
      <option value="2">Option 3</option>
      <option value="3">Option 4</option>
    </select>
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
    alert("Please add at least one question.");
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
    createdBy: currentUser.username || "Teacher",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection('quizzes').add(quizDoc);
    alert("Quiz successfully created and published!");
    document.getElementById('createQuizForm').reset();
    document.getElementById('builderQuestionsContainer').innerHTML = '';
    builderQuestionCount = 0;
    toggleQuizBuilder();
  } catch (err) {
    console.error("Error creating quiz:", err);
    alert("Failed to save quiz: " + err.message);
  }
}

async function fetchQuizResults() {
  const resultsContainer = document.getElementById('teacherResultsTable');
  if (!resultsContainer) return;

  try {
    const snapshot = await db.collection('quiz_results').orderBy('submittedAt', 'desc').get();
    if (snapshot.empty) {
      resultsContainer.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#64748b; padding:1rem;">No quiz submissions yet.</td></tr>`;
      return;
    }

    let rowsHtml = '';
    snapshot.forEach(doc => {
      const res = doc.data();
      rowsHtml += `
        <tr>
          <td style="padding:0.75rem;"><strong>${res.studentName}</strong> (${res.studentClass})</td>
          <td style="padding:0.75rem;">${res.quizTitle}</td>
          <td style="padding:0.75rem;"><span style="font-weight:bold; color:${res.percentage >= 50 ? '#16a34a' : '#dc2626'};">${res.score}/${res.totalQuestions} (${res.percentage}%)</span></td>
          <td style="padding:0.75rem;">${res.submittedAt ? new Date(res.submittedAt.toDate()).toLocaleString() : 'Just now'}</td>
        </tr>
      `;
    });
    resultsContainer.innerHTML = rowsHtml;
  } catch (err) {
    console.error("Error loading results:", err);
  }
}

// ==========================================================================
// 6. STUDENT: RUN QUIZZES
// ==========================================================================

async function startQuiz(quizId) {
  try {
    const existingResult = await db.collection('quiz_results')
      .where('quizId', '==', quizId)
      .where('studentUsername', '==', currentUser.username)
      .get();

    if (!existingResult.empty) {
      alert("You have already submitted this quiz. Multiple attempts are not permitted.");
      return;
    }

    const cachedQuizzes = JSON.parse(localStorage.getItem('portal_quizzes_cache')) || [];
    let foundQuiz = cachedQuizzes.find(q => q.id === quizId);

    if (!foundQuiz) {
      const doc = await db.collection('quizzes').doc(quizId).get();
      if (!doc.exists) {
        alert("Quiz not found.");
        return;
      }
      foundQuiz = { id: doc.id, ...doc.data() };
    }

    activeQuizData = foundQuiz;

    const titleEl = document.getElementById('activeQuizTitle');
    const classEl = document.getElementById('activeQuizClass');
    if (titleEl) titleEl.textContent = activeQuizData.title;
    if (classEl) classEl.textContent = activeQuizData.targetClass || 'General';
    
    renderQuizQuestions(activeQuizData.questions);

    const quizzesContainer = document.getElementById('availableQuizzesContainer');
    if (quizzesContainer) quizzesContainer.style.display = 'none';
    
    const teacherPanel = document.getElementById('teacherPanel');
    if (teacherPanel) teacherPanel.style.display = 'none';
    
    const runner = document.getElementById('quizRunner');
    if (runner) runner.style.display = 'block';

    startTimer(activeQuizData.durationMinutes);
  } catch (err) {
    console.error("Error starting quiz:", err);
  }
}

function renderQuizQuestions(questions) {
  const container = document.getElementById('questionsList');
  if (!container) return;

  let html = '';
  questions.forEach((q, qIndex) => {
    html += `
      <div class="question-item" style="margin-bottom:1.5rem; padding:1rem; border-bottom:1px solid #e2e8f0;">
        <div class="question-text" style="font-weight:600; margin-bottom:0.75rem;">${qIndex + 1}. ${q.question}</div>
        <div style="display:flex; flex-direction:column; gap:0.5rem;">
          ${q.options.map((opt, optIndex) => `
            <label class="option-label" style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
              <input type="radio" name="q_${qIndex}" value="${optIndex}">
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
// 7. TIMER & SUBMISSION
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
      alert("Time is up! Your quiz will now be submitted automatically.");
      submitQuizToFirestore();
    }

    secondsRemaining--;
  }, 1000);
}

async function submitQuizToFirestore() {
  clearInterval(quizTimerInterval);

  if (!activeQuizData) return;

  let score = 0;
  const total = activeQuizData.questions.length;
  const studentAnswers = [];

  activeQuizData.questions.forEach((q, idx) => {
    const selected = document.querySelector(`input[name="q_${idx}"]:checked`);
    const answerIndex = selected ? parseInt(selected.value, 10) : -1;
    
    studentAnswers.push(answerIndex);

    if (answerIndex === q.correctAnswer) {
      score++;
    }
  });

  const percentage = Math.round((score / total) * 100);

  const resultRecord = {
    quizId: activeQuizData.id,
    quizTitle: activeQuizData.title,
    studentUsername: currentUser.username || "anonymous",
    studentName: currentUser.fullName || currentUser.username,
    studentClass: currentUser.class || "N/A",
    score,
    totalQuestions: total,
    percentage,
    answers: studentAnswers,
    submittedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection('quiz_results').add(resultRecord);

    alert(`Quiz Submitted Successfully!\nYour Score: ${score}/${total} (${percentage}%)`);

    const runner = document.getElementById('quizRunner');
    const quizzesContainer = document.getElementById('availableQuizzesContainer');
    if (runner) runner.style.display = 'none';
    if (quizzesContainer) quizzesContainer.style.display = 'block';
    
    const userRole = (currentUser && currentUser.role ? currentUser.role : '').toLowerCase();
    const isTeacher = userRole === 'teacher' || userRole === 'admin';
    const teacherPanel = document.getElementById('teacherPanel');
    if (isTeacher && teacherPanel) {
      teacherPanel.style.display = 'block';
      fetchQuizResults();
    }

    activeQuizData = null;
  } catch (err) {
    console.error("Error saving quiz result:", err);
    alert("Submission failed. Please check your internet connection.");
  }
}
