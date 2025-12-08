// /settings/settings.js
// Modular settings logic that loads user data and handles change password + notifications toggle.

import { auth, db, requireUser, sendPasswordResetEmail } from "/auth/sh-auth.js";
import {
  doc,
  onSnapshot,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// DOM
const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");
const userAvatar = document.getElementById("userAvatar");

const changePassword = document.getElementById("changePassword");
const notifToggle = document.getElementById("notifToggle");
const logoutBtn = document.getElementById("logoutBtn");

function toast(msg, dur = 2200) {
  const c = document.getElementById("toast-container");
  if (!c) return console.log("toast:", msg);
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.classList.add("show"), 20);
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 200);
  }, dur);
}

let userDocUnsub = null;
let currentUser = null;
let userDocRef = null;

// wait for user
requireUser((user) => {
  if (!user) return;
  currentUser = user;
  const uid = user.uid;
  userEmail.textContent = user.email || "—";

  userDocRef = doc(db, "users", uid);

  // live snapshot
  try { if (userDocUnsub) userDocUnsub(); } catch {}
  userDocUnsub = onSnapshot(userDocRef, (snap) => {
    if (!snap.exists()) {
      userName.textContent = user.displayName || "USER NAME";
      userAvatar.src = user.photoURL || "/home/SH-Favicon.png";
      return;
    }
    const d = snap.data() || {};
    userName.textContent = d.name || user.displayName || "USER NAME";
    userEmail.textContent = user.email || "—";
    userAvatar.src = d.photoURL || user.photoURL || "/home/SH-Favicon.png";

    // FCM state restore if present
    try {
      notifToggle.checked = d.fcmEnabled === true;
    } catch (e) {}
  }, (err) => {
    console.error("settings user snapshot error:", err);
  });
});

// change password -> send reset email
changePassword?.addEventListener("click", async () => {
  if (!currentUser) return toast("User not logged in");
  try {
    // use helper exported from sh-auth.js (modular)
    await sendPasswordResetEmail(currentUser.email);
    toast("Password reset link sent!");
  } catch (err) {
    console.error("changePassword error:", err);
    toast("Failed to send reset email");
  }
});

// Notifications toggle (attempts to use FCM; if not setup, store preference only)
notifToggle?.addEventListener("change", async () => {
  if (!currentUser) {
    notifToggle.checked = false;
    return toast("User not logged in");
  }

  const enabled = notifToggle.checked;

  // quick optimistic UI update & save flag to Firestore
  try {
    await setDoc(doc(db, "users", currentUser.uid), { fcmEnabled: !!enabled }, { merge: true });
    toast(enabled ? "Notifications enabled" : "Notifications disabled");
  } catch (err) {
    console.error("notif toggle error:", err);
    toast("Failed to update preference");
    notifToggle.checked = !enabled; // revert
  }
});

// logout
logoutBtn?.addEventListener("click", async () => {
  try {
    await auth.signOut();
    window.location.href = "/auth/login.html";
  } catch (err) {
    console.error("logout error:", err);
    toast("Logout failed");
  }
});