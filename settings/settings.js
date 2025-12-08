// --------------------------------------------
// SETTINGS PAGE — SH AUTH + FIRESTORE LIVE DATA
// --------------------------------------------

import {
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  getMessaging,
  getToken
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

// Wait for sh-auth.js to load user
document.addEventListener("sh:user-ready", (e) => {
  const user = e.detail;
  if (!user) {
    window.location.href = "/auth/login.html";
    return;
  }

  const db = window.SHAuth.db; // Firestore from sh-auth.js
  const uid = user.uid;

  // DOM
  const userName = document.getElementById("userName");
  const userEmail = document.getElementById("userEmail");
  const userAvatar = document.getElementById("userAvatar");
  const changePassword = document.getElementById("changePassword");
  const notifToggle = document.getElementById("notifToggle");
  const logoutBtn = document.getElementById("logoutBtn");

  // Toast
  function toast(msg) {
    const c = document.getElementById("toast-container");
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => el.classList.add("show"), 30);
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 200);
    }, 2200);
  }

  // -------------------------------
  // LIVE USER DATA FROM FIRESTORE
  // -------------------------------
  const userRef = doc(db, "users", uid);

  onSnapshot(userRef, (snap) => {
    const data = snap.data() || {};

    userName.textContent = data.name || "USER NAME";
    userEmail.textContent = user.email || "email@example.com";
    userAvatar.src = data.photoURL || "/home/SH-Favicon.png";

    notifToggle.checked = data.fcmEnabled === true;
  });

  // -------------------------------
  // PASSWORD RESET
  // -------------------------------
  changePassword.onclick = async () => {
    try {
      await window.SHAuth.auth.sendPasswordResetEmail(user.email);
      toast("Password reset link sent!");
    } catch (err) {
      toast("Failed to send reset email");
    }
  };

  // -------------------------------
  // NOTIFICATIONS (FCM)
  // -------------------------------
  const messaging = getMessaging();

  notifToggle.addEventListener("change", async () => {
    if (notifToggle.checked) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        notifToggle.checked = false;
        toast("Permission denied");
        return;
      }

      try {
        const token = await getToken(messaging, {
          vapidKey: "YOUR_FCM_VAPID_KEY_HERE"
        });

        if (!token) {
          notifToggle.checked = false;
          return toast("Failed to get token");
        }

        await updateDoc(userRef, {
          fcmEnabled: true,
          fcmTokens: arrayUnion(token)
        });

        toast("Notifications enabled");

      } catch {
        notifToggle.checked = false;
        toast("Token error");
      }

    } else {
      await updateDoc(userRef, { fcmEnabled: false });
      toast("Notifications disabled");
    }
  });

  // -------------------------------
  // LOGOUT
  // -------------------------------
  logoutBtn.onclick = async () => {
    await window.SHAuth.auth.signOut();
    window.location.href = "/auth/login.html";
  };
});