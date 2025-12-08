// /settings/settings.js
import {
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  onSnapshot,
  updateDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Wait for authenticated user
document.addEventListener("sh-user-ready", ({ detail: user }) => {

  const db = window.db;
  const auth = window.auth;

  const userDocRef = doc(db, "users", user.uid);

  // DOM
  const userName = document.getElementById("userName");
  const userEmail = document.getElementById("userEmail");
  const userAvatar = document.getElementById("userAvatar");
  const notifToggle = document.getElementById("notifToggle");
  const changePassword = document.getElementById("changePassword");
  const logoutBtn = document.getElementById("logoutBtn");

  // -----------------------------------------
  // LIVE USER DATA
  // -----------------------------------------
  onSnapshot(userDocRef, (snap) => {
    if (!snap.exists()) return;

    const data = snap.data();

    userName.textContent = data.name || "USER NAME";
    userEmail.textContent = user.email;
    userAvatar.src = data.photoURL || "/home/SH-Favicon.png";
    notifToggle.checked = data.fcmEnabled === true;
  });

  // -----------------------------------------
  // CHANGE PASSWORD
  // -----------------------------------------
  changePassword.onclick = async () => {
    await sendPasswordResetEmail(auth, user.email);
    alert("Password reset link sent to your email");
  };

  // -----------------------------------------
  // NOTIFICATION ENABLE
  // -----------------------------------------
  notifToggle.onchange = async () => {
    await updateDoc(userDocRef, {
      fcmEnabled: notifToggle.checked
    });

    alert(notifToggle.checked ? "Notifications Enabled" : "Notifications Disabled");
  };

  // -----------------------------------------
  // LOGOUT
  // -----------------------------------------
  logoutBtn.onclick = async () => {
    await auth.signOut();
    window.location.href = "/auth/login.html";
  };

});