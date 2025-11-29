// auth/firebase-config.js (FINAL FIXED VERSION)

async function loadFirebaseConfig() {
  try {
    const response = await fetch("/api/firebase-config", {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
      throw new Error("Failed to load Firebase config (API error)");
    }

    const firebaseConfig = await response.json();

    // Strong validation for config object
    if (!firebaseConfig || !firebaseConfig.apiKey) {
      throw new Error("Invalid Firebase config received");
    }

    // Initialize app only once
    if (!firebase.apps || firebase.apps.length === 0) {
      firebase.initializeApp(firebaseConfig);
    }

    // Make global
    window.auth = firebase.auth();
    window.db = firebase.firestore();

    // IMPORTANT: Keep users logged in
    await window.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    console.log("%cFirebase initialized successfully", "color: green; font-weight: bold;");
  } 
  catch (err) {
    console.error("%cFIREBASE LOAD ERROR:", "color: red; font-weight: bold;", err);
    alert("Unable to load Firebase configuration. Please try again later.");
  }
}

loadFirebaseConfig();
