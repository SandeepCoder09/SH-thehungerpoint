// /auth/login.js  (FULL v10 modular, imports the config and initializes)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import firebaseConfig from "/home/firebase-config.js";

// Initialize Firebase (login page must init itself)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM
const form = document.getElementById("loginForm");
const googleBtn = document.getElementById("googleLogin");
const toast = document.getElementById("toast");

function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  setTimeout(() => (toast.hidden = true), 2500);
}

// Email sign-in
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const pass = document.getElementById("password").value;

  try {
    // ensure auth persistence for same-device
    await setPersistence(auth, browserLocalPersistence);

    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const uid = cred.user.uid;

    // Rider detection: riders collection uses email as doc id (from your rules)
    const riderSnap = await getDoc(doc(db, "riders", email));
    if (riderSnap.exists()) {
      // Rider — redirect to rider panel
      window.location.href = "/rider/index.html";
      return;
    }

    // User detection
    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists()) {
      // create user doc
      await setDoc(doc(db, "users", uid), {
        email,
        createdAt: new Date()
      });
    }

    // Save for client-side cart logic
    localStorage.setItem("userId", uid);
    localStorage.setItem("userEmail", email);

    // Go to home
    window.location.href = "/home/index.html";

  } catch (err) {
    showToast("Firebase: " + (err.message || err.code || "Login failed"));
    console.error("Login error:", err);
  }
});

// Google sign-in
googleBtn.addEventListener("click", async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (!userSnap.exists()) {
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        createdAt: new Date()
      });
    }

    localStorage.setItem("userId", user.uid);
    localStorage.setItem("userEmail", user.email);

    window.location.href = "/home/index.html";
  } catch (err) {
    showToast("Google Login Error: " + (err.message || err.code));
    console.error("Google login error:", err);
  }
});
