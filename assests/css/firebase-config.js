/* ==========================================================================
   SAMCAM SOLUTIONS - FIREBASE CONFIGURATION & INITIALIZATION
   ========================================================================== */

const firebaseConfig = {
  apiKey: window.env?.FIREBASE_API_KEY,
  authDomain: "samcam-system.firebaseapp.com",
  projectId: "samcam-system",
  storageBucket: "samcam-system.firebasestorage.app",
  messagingSenderId: "74940789582",
  appId: "1:74940789582:web:f159688165a194e841241f",
  measurementId: "G-L2H4V8Y050"
};

// Function to safely initialize once window/scripts are ready
function initializeSamcamFirebase() {
  if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    window.db = firebase.firestore();
    window.storageRef = firebase.storage().ref();
  } else {
    // Retry shortly if CDN is slow
    setTimeout(initializeSamcamFirebase, 50);
  }
}

// Run initialization
initializeSamcamFirebase();
