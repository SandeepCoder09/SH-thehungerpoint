// ===============================
// Firebase Config - SH The Hunger Point
// Corrected storageBucket (appspot.com)
// ===============================

const firebaseConfig = {
  apiKey: "AIzaSyAyBMrrpmW0b7vhBCgaAObL0AOGeNrga_8",
  authDomain: "sh-the-hunger-point.firebaseapp.com",
  projectId: "sh-the-hunger-point",
  storageBucket: "sh-the-hunger-point.appspot.com",  // <-- FIXED
  messagingSenderId: "401237282420",
  appId: "1:401237282420:web:5162604a4bb2b9799b8b21",
  measurementId: "G-4KP3RJ15E9"
};

// Initialize Firebase (compat for phone auth)
firebase.initializeApp(firebaseConfig);

// Optional: enable analytics only on supported browsers
try {
  if (firebase.analytics) firebase.analytics();
} catch (e) {
  console.log("Analytics not supported:", e);
}