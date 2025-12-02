// auth/firebase-config.js — FINAL WORKING VERSION (NO API FETCH)

// ------------------------------------------------------
// 1. Your Firebase credentials (paste your actual values)
// ------------------------------------------------------
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MSG_ID",
  appId: "YOUR_APP_ID"
};

// ------------------------------------------------------
// 2. Initialize Firebase correctly
// ------------------------------------------------------
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// ------------------------------------------------------
// 3. Make Firebase services global for all pages
// ------------------------------------------------------
window.auth = firebase.auth();
window.db = firebase.firestore();
window.storage = firebase.storage();

// Keep user logged in
window.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

console.log("%cFirebase initialized successfully", "color: green; font-weight:bold;");
