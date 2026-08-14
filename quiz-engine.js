// 1. Firebase Configuration (Same as script.js)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

// Initialize Firebase & Firestore
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// 2. Load User Session from localStorage
const currentUser = JSON.parse(localStorage.getItem('portal_session'));

document.addEventListener("DOMContentLoaded", () => {
  if (!currentUser) {
    alert("Please log in through the main portal first.");
    window.location.href = "index.html";
    return;
  }
  
  fetchActiveQuizzes();
});

// 3. Fetch Quizzes for the Student's Class from Firestore
async function fetchActiveQuizzes() {
  const container = document.getElementById('quizList');
  if (!container) return;

  try {
    const snap = await db.collection('quizzes')
      .where('targetClass', '==', currentUser.class)
      .get();

    if (snap.empty) {
      container.innerHTML = "<p>No active quizzes for your class at the moment.</p>";
      return;
    }

    let html = '';
    snap.forEach(doc => {
      const quiz = doc.data();
      html += `
        <div class="quiz-card" style="border: 1px solid #cbd5e1; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
          <h4>${quiz.title}</h4>
          <p>Duration: ${quiz.durationMinutes} Minutes</p>
          <button onclick="startQuiz('${doc.id}')" class="btn-action">Start Quiz</button>
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (err) {
    console.error("Error fetching quizzes:", err);
  }
}
