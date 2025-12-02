// login.js (Firebase v10 Modular)

import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const auth = window.auth;
const db = window.db;

const form = document.getElementById("loginForm");
const googleBtn = document.getElementById("googleLogin");
const toast = document.getElementById("toast");

function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  setTimeout(() => toast.hidden = true, 2500);
}

// ------------------------------
// EMAIL LOGIN
// ------------------------------
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const pass = document.getElementById("password").value;

  try {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    const uid = result.user.uid;

    await handleLogin(uid, email);

  } catch (err) {
    showToast(err.message);
  }
});

// ------------------------------
// GOOGLE LOGIN
// ------------------------------
googleBtn.addEventListener("click", async () => {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);

    const uid = result.user.uid;
    const email = result.user.email;

    await handleLogin(uid, email);

  } catch (err) {
    showToast(err.message);
  }
});

// ------------------------------
// HANDLE LOGIN TYPE
// ------------------------------
async function handleLogin(uid, email) {

  // 1) Check Rider
  const riderSnap = await getDoc(doc(db, "riders", email));
  if (riderSnap.exists()) {
    window.location.href = "/rider/index.html";
    return;
  }

  // 2) Check User
  const userSnap = await getDoc(doc(db, "users", uid));
  if (!userSnap.exists()) {
    await setDoc(doc(db, "users", uid), {
      email,
      createdAt: new Date()
    });
  }

  // Save UID for cart
  localStorage.setItem("userId", uid);
  localStorage.setItem("userEmail", email);

  window.location.href = "/home/index.html";
}
