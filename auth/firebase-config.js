// /auth/firebase-config.js
// Final, robust Firebase initializer for SH — uses compat libs (app/auth/firestore/storage).
// Paste this file to /auth/firebase-config.js and make sure your HTML loads the compat scripts.

(async function () {
  // Wait until the firebase compat library has loaded on the page
  async function waitForFirebaseGlobal(timeout = 5000) {
    const start = Date.now();
    while (typeof window.firebase === "undefined") {
      if (Date.now() - start > timeout) {
        throw new Error("Firebase library did not load in time.");
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  try {
    await waitForFirebaseGlobal();

    // your config (you provided these values)
    const firebaseConfig = {
      apiKey: "AIzaSyAyBMrrpmW0b7vhBCgaAObL0AOGeNrga_8",
      authDomain: "sh-the-hunger-point.firebaseapp.com",
      projectId: "sh-the-hunger-point",
      storageBucket: "sh-the-hunger-point.firebasestorage.app",
      messagingSenderId: "401237282420",
      appId: "1:401237282420:web:5162604a4bb2b9799b8b21",
      measurementId: "G-4KP3RJ15E9"
    };

    // Initialize app only once
    if (!firebase.apps || firebase.apps.length === 0) {
      firebase.initializeApp(firebaseConfig);
      // Optional: firebase.analytics() if you need it and measurementId present
      // if (firebase.analytics) firebase.analytics();
    }

    // Expose compat services globally (used by other scripts)
    window.auth = firebase.auth();
    window.db = firebase.firestore();
    window.storage = firebase.storage();

    // Use persistent local auth so users remain signed in across reloads
    try {
      await window.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    } catch (e) {
      console.warn("Unable to set auth persistence (nonfatal):", e);
    }

    console.log("%cFirebase initialized successfully", "color:green;font-weight:bold;");
  } catch (err) {
    console.error("%cFIREBASE LOAD ERROR:", "color:crimson;font-weight:bold;", err);
    // Friendly message for users in UI (keeps dev console helpful)
    alert("Unable to load Firebase configuration. Please try again later.");
  }
})();
