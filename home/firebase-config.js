// firebase-config.js (ES module - Firebase v10)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBAR2bTveqOertBkpt95YId9hDPrg6S9_E",
  authDomain: "sh-the-hunger-point.firebaseapp.com",
  projectId: "sh-the-hunger-point",
  storageBucket: "sh-the-hunger-point.appspot.com",
  messagingSenderId: "312843485011",
  appId: "1:312843485011:web:347c18ee0ad022a1beaba6"
};

// Initialize app
const app = initializeApp(firebaseConfig);

// Auth (use local persistence so session survives refresh)
const auth = getAuth(app);
try {
  // top-level await is allowed in modules — ensures persistence is set before other code runs
  await setPersistence(auth, browserLocalPersistence);
  console.log("Firebase Auth persistence set: browserLocalPersistence");
} catch (err) {
  console.warn("Could not set persistence:", err);
}

// Firestore
const db = getFirestore(app);

console.log("🔥 Firebase v10 initialized — auth + firestore ready");

// Export for other modules (script.js will import these)
export { auth, db };
