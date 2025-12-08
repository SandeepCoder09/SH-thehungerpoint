// /settings/settings.js
// Modular settings logic — uses window.shAuth services

import { waitForAuth, auth, db } from "/auth/sh-auth.js";
import {
  doc,
  onSnapshot,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

await waitForAuth().catch(() => { /* continue */ });

// DOM
const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");
const userAvatar = document.getElementById("userAvatar");
const changePassword = document.getElementById("changePassword");
const notifToggle = document.getElementById("notifToggle");
const logoutBtn = document.getElementById("logoutBtn");

function toast(msg) {
  const c = document.getElementById("toast-container");
  if (!c) return alert(msg);
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.classList.add("show"), 20);
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 200);
  }, 2200);
}

let currentUser = null;
let userDocRef = null;

auth.onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = "/auth/login.html";
    return;
  }
  currentUser = user;
  userDocRef = doc(db, "users", user.uid);

  onSnapshot(userDocRef, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data() || {};
    userName.textContent = data.name || "USER NAME";
    userEmail.textContent = user.email || "email@example.com";
    userAvatar.src = data.photoURL || "/home/SH-Favicon.png";
    notifToggle.checked = data.fcmEnabled === true;
  });
});

// change password
if (changePassword) {
  changePassword.addEventListener("click", async () => {
    if (!currentUser) return;
    try {
      await auth.sendPasswordResetEmail(currentUser.email);
      toast("Password reset link sent!");
    } catch (err) {
      console.error(err);
      toast("Failed to send reset email");
    }
  });
}

// notifications toggle (FCM)
let messaging = null;
try {
  // dynamic import of messaging only if available on the page
  // If messaging is not set up, toggling will only update Firestore flag.
  const mm = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js").catch(() => null);
  if (mm && mm.getMessaging) {
    const { getMessaging, getToken } = mm;
    messaging = getMessaging();
    // we won't request token here automatically
  }
} catch (e) {
  messaging = null;
}

if (notifToggle) {
  notifToggle.addEventListener("change", async () => {
    if (!userDocRef) return;
    if (notifToggle.checked) {
      try {
        if (!messaging) {
          // save only enabled flag
          await setDoc(userDocRef, { fcmEnabled: true }, { merge: true });
          toast("Notifications marked enabled (no FCM)");
          return;
        }

        // Request permission
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          notifToggle.checked = false;
          toast("Permission denied");
          return;
        }

        const { getToken } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js");
        // caller must replace with their actual VAPID key in production; here we try default placeholder
        const token = await getToken(messaging, { vapidKey: "YOUR_FCM_VAPID_KEY_HERE" });
        if (!token) {
          notifToggle.checked = false;
          toast("Unable to get token");
          return;
        }

        await setDoc(userDocRef, {
          fcmEnabled: true,
          fcmTokens: (window.firebase && window.firebase.firestore) ? window.firebase.firestore.FieldValue.arrayUnion(token) : undefined
        }, { merge: true });

        toast("Notifications enabled");
      } catch (err) {
        console.error(err);
        notifToggle.checked = false;
        toast("Error enabling notifications");
      }
    } else {
      try {
        await setDoc(userDocRef, { fcmEnabled: false }, { merge: true });
        toast("Notifications disabled");
      } catch (err) {
        console.error(err);
      }
    }
  });
}

// logout
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await auth.signOut();
      window.location.href = "/auth/login.html";
    } catch (err) {
      console.error(err);
      toast("Error logging out");
    }
  });
}