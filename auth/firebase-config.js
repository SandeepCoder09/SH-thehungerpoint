// /auth/firebase-config.js — FINAL VERSION

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAyBMrrpmW0b7vhBCgaAObL0AOGeNrga_8",
  authDomain: "sh-the-hunger-point.firebaseapp.com",
  projectId: "sh-the-hunger-point",
  storageBucket: "sh-the-hunger-point.firebasestorage.app",
  messagingSenderId: "401237282420",
  appId: "1:401237282420:web:5162604a4bb2b9799b8b21",
  measurementId: "G-4KP3RJ15E9"
};

// Initialize Firebase (only once)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Make global for all pages
window.auth = firebase.auth();
window.db = firebase.firestore();
window.storage = firebase.storage();

// Keep user logged in even if page reloads
window.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(() => {
    console.log("%cFirebase initialized successfully", "color: green; font-weight: bold;");
  })
  .catch(err => {
    console.error("Firebase persistence error:", err);
  });
