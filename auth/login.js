// login.js — Firebase v10 ES Modules

import {
  getAuth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";

const form = document.getElementById("loginForm");
const googleBtn = document.getElementById("googleLogin");
const toast = document.getElementById("toast");

function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  setTimeout(() => (toast.hidden = true), 2500);
}

// -----------------------------------------
// EMAIL + PASSWORD LOGIN
// -----------------------------------------
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const pass = document.getElementById("password").value;

  try {
    await setPersistence(auth, browserLocalPersistence);

    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const uid = cred.user.uid;

    // Check rider login
    const riderSnap = await getDoc(doc(db, "riders", email));
    if (riderSnap.exists()) {
      window.location.href = "/rider/index.html";
      return;
    }

    // Check existing user
    const userSnap = await getDoc(doc(db, "users", uid));
    if (userSnap.exists()) {
      localStorage.setItem("userId", uid);
      localStorage.setItem("userEmail", email);
      window.location.href = "/home/index.html";
      return;
    }

    // Create user if not exists
    await setDoc(doc(db, "users", uid), {
      email,
      createdAt: new Date(),
    });

    localStorage.setItem("userId", uid);
    localStorage.setItem("userEmail", email);

    window.location.href = "/home/index.html";

  } catch (err) {
    showToast("Firebase: " + err.message);
  }
});

// -----------------------------------------
// GOOGLE LOGIN
// -----------------------------------------
googleBtn.addEventListener("click", async () => {
  try {
    const provider = new GoogleAuthProvider();
    await setPersistence(auth, browserLocalPersistence);

    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    const userSnap = await getDoc(doc(db, "users", user.uid));

    if (!userSnap.exists()) {
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        createdAt: new Date(),
      });
    }

    localStorage.setItem("userId", user.uid);
    localStorage.setItem("userEmail", user.email);

    window.location.href = "/home/index.html";

  } catch (err) {
    showToast("Google Login Error: " + err.message);
  }
});