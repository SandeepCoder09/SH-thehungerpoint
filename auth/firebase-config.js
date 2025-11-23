// auth/firebase-config.js

async function loadFirebaseConfig() {
  try {
    const response = await fetch("/api/firebase-config");
    const firebaseConfig = await response.json();

    // Ensure Firebase initializes only once
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    window.auth = firebase.auth();
    window.db = firebase.firestore();

    console.log("Firebase initialized on page:", window.auth);
  } 
  catch (error) {
    console.error("Firebase config load failed:", error);
  }
}

loadFirebaseConfig();
