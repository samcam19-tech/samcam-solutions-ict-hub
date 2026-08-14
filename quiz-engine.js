// 1. Firebase Configuration (Same as script.js)
const firebaseConfig = {
      apiKey: "AIzaSyBcZxH7TTpejrFmF4ji0DS66xVfDVhZEfw",
      authDomain: "samcam-system.firebaseapp.com",
      projectId: "samcam-system",
      storageBucket: "samcam-system.firebasestorage.app",
      messagingSenderId: "74940789582",
      appId: "1:74940789582:web:f159688165a194e841241f",
      measurementId: "G-L2H4V8Y050"
    };

// Initialize Firebase & Firestore
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// 2. STATE MANAGEMENT
let currentUser = null;
let activeQuizData = null;
let quizTimerInterval = null;
let builderQuestionCount = 0;

// 3. INITIALIZE PAGE ON LOAD
document.addEventListener("DOMContentLoaded", () => {
  // Read session stored from main portal login
  const sessionData = localStorage.getItem('portal_session');
  
  if (sessionData) {
    currentUser = JSON.parse(sessionData);
  } else {
    // Fallback default for testing if session doesn't exist
    currentUser = { username: "Guest", role: "student", class: "S4", fullName: "Student User" };
  }

  // Display user badge
  const userBadge = document.getElementById('userBadge');
  if (userBadge) {
    userBadge.innerHTML = `<i class="fa-solid fa-user"></i> ${currentUser.fullName || currentUser.username} (${currentUser.role === 'admin' ? 'Teacher' : currentUser.class || 'Student'})`;
  }

  // Show Teacher Builder Panel if Admin/Teacher
  if (currentUser.role === 'admin' || currentUser.role === 'teacher') {
    document.getElementById('teacherPanel').style.display = 'block';
  }

  // Fetch quizzes from Firestore
  fetchActiveQuizzes();
});

// ==========================================================================
// TEACHER / ADMIN: QUIZ BUILDER FUNCTIONS
// ==========================================================================

function toggleQuizBuilder() {
  const form = document.getElementById('createQuizForm');
  if (form.style.display === 'none' || form.style.display === '') {
    form.style.display = 'block';
    if (builderQuestionCount === 0) {
      addQuestionToBuilder(); // Add first question by default
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
  qCard.style.background = '#ffffff';

  qCard.innerHTML = `
    <div style="display:flex; justify-between: space-between; align-items:center; margin-bottom: 0.5rem;">
      <strong>Question #${builderQuestionCount}</strong>
      <button type="button" onclick="removeBuilderQuestion('${qCard.id}')" style="color:#ef4444; border:none; background:none; cursor:pointer;">
        <i class="fa-solid fa-trash"></i> Remove
      </button>
    </div>
    <input type="text" class="q-title" placeholder="Enter question text..." required style="width: 100%; padding: 0.5rem; margin-bottom: 0.75rem; border-radius: 4px; border: 1px solid #cbd5e1;">
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.75rem;">
      <input type="text" class="q-opt-0" placeholder="Option 1" required style="padding: 0.4rem; border-radius: 4px; border: 1px solid #cbd5e1;">
      <input type="text" class="q-opt-1" placeholder="Option 2" required style="padding: 0.4rem; border-radius: 4px; border: 1px solid #cbd5e1;">
      <input type="text" class="q-opt-2" placeholder="Option 3" required style="padding: 0.4rem; border-radius: 4px; border: 1px solid #cbd5e1;">
      <input type="text" class="q-opt-3" placeholder="Option 4" required style="padding: 0.4rem; border-radius: 4px; border: 1px solid #cbd5e1;">
    </div>

    <label style="font-size: 0.85rem; font-weight: 600;">Correct Option Index:</label>
    <select class="q-correct" required style="padding: 0.4rem; border-radius: 4px; border: 1px solid #cbd5e1;">
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
    fetchActiveQuizzes(); // Refresh list
  } catch (err) {
    console.error("Error creating quiz:", err);
    alert("Failed to save quiz: " + err.message);
  }
}

// ==========================================================================
// STUDENT: FETCH & RUN QUIZZES
// ==========================================================================

async function fetchActiveQuizzes() {
  const quizListContainer = document.getElementById('quizList');
  quizListContainer.innerHTML = "<p><i class='fa-solid fa-spinner fa-spin'></i> Loading quizzes...</p>";

  try {
    let query = db.collection('quizzes');
    
    // Filter by class for students
    if (currentUser.role === 'student' && currentUser.class) {
      query = query.where('targetClass', '==', currentUser.class);
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
        <div class="quiz-card">
          <div>
            <span class="quiz-badge">${q.targetClass || 'All Classes'}</span>
            <h4 style="margin-bottom: 0.5rem;">${q.title}</h4>
            <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem;">
              <i class="fa-solid fa-clock"></i> ${q.durationMinutes} Minutes | ${q.questions ? q.questions.length : 0} Questions
            </p>
          </div>
          <button onclick="startQuiz('${doc.id}')" class="btn-action">
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
    const doc = await db.collection('quizzes').doc(quizId).get();
    if (!doc.exists) {
      alert("Quiz not found.");
      return;
    }

    activeQuizData = { id: doc.id, ...doc.data() };

    // Update UI Runner View
    document.getElementById('activeQuizTitle').textContent = activeQuizData.title;
    document.getElementById('activeQuizClass').textContent = activeQuizData.targetClass || 'General';
    
    renderQuizQuestions(activeQuizData.questions);

    // Show Runner Section & Hide Available Quizzes Section
    document.getElementById('availableQuizzesContainer').style.display = 'none';
    if (document.getElementById('teacherPanel')) {
      document.getElementById('teacherPanel').style.display = 'none';
    }
    document.getElementById('quizRunner').style.display = 'block';

    // Start Timer
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
      <div class="question-item">
        <div class="question-text">${qIndex + 1}. ${q.question}</div>
        <div>
          ${q.options.map((opt, optIndex) => `
            <label class="option-label">
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

    display.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

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
    studentUsername: currentUser.username || "Anonymous",
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

    // Reset View
    document.getElementById('quizRunner').style.display = 'none';
    document.getElementById('availableQuizzesContainer').style.display = 'block';
    if (currentUser.role === 'admin' || currentUser.role === 'teacher') {
      document.getElementById('teacherPanel').style.display = 'block';
    }

    activeQuizData = null;
  } catch (err) {
    console.error("Error saving quiz result:", err);
    alert("Submission failed. Please check your internet connection.");
  }
}
