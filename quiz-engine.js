// 1. Firebase Configuration (Matches script.js)
const firebaseConfig = {
  apiKey: "AIzaSyBcZxH7TTpejrFmF4ji0DS66xVfDVhZEfw",
  authDomain: "samcam-system.firebaseapp.com",
  projectId: "samcam-system",
  storageBucket: "samcam-system.firebasestorage.app",
  messagingSenderId: "74940789582",
  appId: "1:74940789582:web:f159688165a194e841241f",
  measurementId: "G-L2H4V8Y050"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// 2. STATE MANAGEMENT
let currentUser = null;
let activeQuizData = null;
let quizTimerInterval = null;
let builderQuestionCount = 0;

// 3. INITIALIZATION ON PAGE LOAD
document.addEventListener("DOMContentLoaded", () => {
  const sessionData = localStorage.getItem('portal_session');
  
  if (sessionData) {
    currentUser = JSON.parse(sessionData);
  } else {
    // Fallback default aligning with portal data standard
    currentUser = { username: "guest", role: "Student", class: "S4", fullName: "Guest Student" };
  }

  // Display user badge
  const userBadge = document.getElementById('userBadge');
  if (userBadge) {
    userBadge.innerHTML = `<i class="fa-solid fa-user"></i> ${currentUser.fullName || currentUser.username} (${currentUser.role === 'Teacher' ? 'Teacher' : currentUser.class || 'Student'})`;
  }

  // Unified Teacher Authorization Check
  const isTeacher = currentUser.role === 'Teacher' || currentUser.role === 'admin' || currentUser.role === 'teacher';
  
  if (isTeacher) {
    const teacherPanel = document.getElementById('teacherPanel');
    if (teacherPanel) teacherPanel.style.display = 'block';
    fetchQuizResults(); // Load student results table for teachers
  }

  fetchActiveQuizzes();
});

// ==========================================================================
// TEACHER / ADMIN: QUIZ BUILDER & RESULTS TRACKER
// ==========================================================================

function toggleQuizBuilder() {
  const form = document.getElementById('createQuizForm');
  if (form.style.display === 'none' || form.style.display === '') {
    form.style.display = 'block';
    if (builderQuestionCount === 0) {
      addQuestionToBuilder();
    }
  } else {
    form.style.display = 'none';
  }
}

function addQuestionToBuilder() {
  builderQuestionCount++;
  const container = document.getElementById('builderQuestionsContainer');

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
    fetchActiveQuizzes();
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
      resultsContainer.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#64748b;">No quiz submissions yet.</td></tr>`;
      return;
    }

    let rowsHtml = '';
    snapshot.forEach(doc => {
      const res = doc.data();
      rowsHtml += `
        <tr>
          <td><strong>${res.studentName}</strong> (${res.studentClass})</td>
          <td>${res.quizTitle}</td>
          <td><span style="font-weight:bold; color:${res.percentage >= 50 ? '#16a34a' : '#dc2626'};">${res.score}/${res.totalQuestions} (${res.percentage}%)</span></td>
          <td>${res.submittedAt ? new Date(res.submittedAt.toDate()).toLocaleString() : 'Just now'}</td>
        </tr>
      `;
    });
    resultsContainer.innerHTML = rowsHtml;
  } catch (err) {
    console.error("Error loading results:", err);
  }
}

// ==========================================================================
// STUDENT: FETCH & RUN QUIZZES
// ==========================================================================

async function fetchActiveQuizzes() {
  const quizListContainer = document.getElementById('quizList');
  if (!quizListContainer) return;
  quizListContainer.innerHTML = "<p><i class='fa-solid fa-spinner fa-spin'></i> Loading quizzes...</p>";

  try {
    let query = db.collection('quizzes');
    const isTeacher = currentUser.role === 'Teacher' || currentUser.role === 'admin' || currentUser.role === 'teacher';

    // Filter by class for students
    if (!isTeacher && currentUser.class) {
      query = query.where('targetClass', 'in', [currentUser.class, 'All']);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      quizListContainer.innerHTML = `<p style="grid-column: 1/-1; color: #64748b;">No active quizzes found ${currentUser.class ? 'for class ' + currentUser.class : ''}.</p>`;
      return;
    }

    let html = '';
    snapshot.forEach(doc => {
      const q = doc.data();
      html += `
        <div class="quiz-card" style="border:1px solid #e2e8f0; padding:1rem; border-radius:8px; background:#fff;">
          <div>
            <span class="quiz-badge" style="background:#e0f2fe; color:#0369a1; padding:0.2rem 0.5rem; border-radius:4px; font-size:0.75rem;">${q.targetClass || 'All Classes'}</span>
            <h4 style="margin: 0.5rem 0;">${q.title}</h4>
            <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem;">
              <i class="fa-solid fa-clock"></i> ${q.durationMinutes} Minutes | ${q.questions ? q.questions.length : 0} Questions
            </p>
          </div>
          <button onclick="startQuiz('${doc.id}')" class="btn-action" style="padding:0.5rem 1rem; background:#2563eb; color:#fff; border:none; border-radius:4px; cursor:pointer;">
            <i class="fa-solid fa-play"></i> Start Quiz
          </button>
        </div>
      `;
    });

    quizListContainer.innerHTML = html;
  } catch (err) {
    console.error("Error fetching quizzes:", err);
    quizListContainer.innerHTML = `<p style="color: #ef4444;">Error loading quizzes.</p>`;
  }
}

async function startQuiz(quizId) {
  try {
    // Check if student has already completed this quiz
    const existingResult = await db.collection('quiz_results')
      .where('quizId', '==', quizId)
      .where('studentUsername', '==', currentUser.username)
      .get();

    if (!existingResult.empty) {
      alert("You have already submitted this quiz. Multiple attempts are not permitted.");
      return;
    }

    const doc = await db.collection('quizzes').doc(quizId).get();
    if (!doc.exists) {
      alert("Quiz not found.");
      return;
    }

    activeQuizData = { id: doc.id, ...doc.data() };

    document.getElementById('activeQuizTitle').textContent = activeQuizData.title;
    document.getElementById('activeQuizClass').textContent = activeQuizData.targetClass || 'General';
    
    renderQuizQuestions(activeQuizData.questions);

    document.getElementById('availableQuizzesContainer').style.display = 'none';
    const teacherPanel = document.getElementById('teacherPanel');
    if (teacherPanel) teacherPanel.style.display = 'none';
    
    document.getElementById('quizRunner').style.display = 'block';

    startTimer(activeQuizData.durationMinutes);
  } catch (err) {
    console.error("Error starting quiz:", err);
  }
}

function renderQuizQuestions(questions) {
  const container = document.getElementById('questionsList');
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
// TIMER & AUTO-SUBMIT LOGIC
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

// ==========================================================================
// QUIZ SUBMISSION & INSTANT AUTO-GRADING
// ==========================================================================

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

    document.getElementById('quizRunner').style.display = 'none';
    document.getElementById('availableQuizzesContainer').style.display = 'block';
    
    const isTeacher = currentUser.role === 'Teacher' || currentUser.role === 'admin' || currentUser.role === 'teacher';
    if (isTeacher) {
      document.getElementById('teacherPanel').style.display = 'block';
      fetchQuizResults();
    }

    activeQuizData = null;
  } catch (err) {
    console.error("Error saving quiz result:", err);
    alert("Submission failed. Please check your internet connection.");
  }
}
