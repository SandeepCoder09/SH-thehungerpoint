// Replace the config object below with your Firebase project's config.
// Save this file as auth/firebase-config.js and include it before auth JS.
if (!window.firebase) {
  console.error("firebase SDK not loaded. Make sure you include firebase scripts in the page.");
} else {
  // Example:
  const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "SENDER_ID",
    appId: "APP_ID"
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
}