// /auth/firebase-config.js
// Firebase initialization for LOGIN / SIGNUP pages
// Works with Firebase Auth (email + OTP) + Firestore user data

// IMPORTANT:
// DO NOT remove apiKey – Firebase requires it for OTP.
// You can safely keep your real API key here because
// Firebase keys are PUBLIC and not secret.

// ---------------------------------------------
// 🔥 Firebase Config (replace the values)
// ---------------------------------------------
const firebaseConfig = {
  apiKey: window.ENV_API_KEY || "YOUR_API_KEY",
  authDomain: window.ENV_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
  projectId: window.ENV_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: window.ENV_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
  messagingSenderId: window.ENV_MSG_SENDER_ID || "YOUR_MSG_SENDER_ID",
  appId: window.ENV_APP_ID || "YOUR_APP_ID",
};

// ---------------------------------------------
// 🔥 Initialize Firebase (compat mode)
// ---------------------------------------------
firebase.initializeApp(firebaseConfig);

// ---------------------------------------------
// 🔥 Initialize Firebase Auth + Firestore
// ---------------------------------------------
const auth = firebase.auth();
const db = firebase.firestore();

// Allow persistent login (auto-login after refresh)
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .catch(console.error);

// ---------------------------------------------
// Export references globally
// ---------------------------------------------
window._auth = auth;
window._db = db;

console.log("Firebase (AUTH) initialized.");