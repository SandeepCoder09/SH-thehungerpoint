/* SETTINGS PAGE — Firebase COMPAT + FCM + Live User Data */

(function () {

  // DOM ELEMENTS
  const userName = document.getElementById("userName");
  const userEmail = document.getElementById("userEmail");
  const userAvatar = document.getElementById("userAvatar");

  const changePassword = document.getElementById("changePassword");
  const notifToggle = document.getElementById("notifToggle");
  const logoutBtn = document.getElementById("logoutBtn");

  // Toast System
  function toast(msg) {
    const c = document.getElementById("toast-container");
    if (!c) return alert(msg);

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

  let currentUser = null;
  let userDocRef = null;

  // -------------------------------------
  // LOAD USER DATA — FIREBASE COMPAT
  // -------------------------------------
  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "/auth/login.html";
      return;
    }

    currentUser = user;

    // Firestore reference
    userDocRef = firebase.firestore().collection("users").doc(user.uid);

    // Live snapshot
    userDocRef.onSnapshot((doc) => {
      if (!doc.exists) return;

      const data = doc.data();

      userName.textContent = data.name || "USER NAME";
      userEmail.textContent = user.email || "email@example.com";
      userAvatar.src = data.photoURL || "/home/SH-Favicon.png";

      // Restore FCM toggle
      notifToggle.checked = data.fcmEnabled === true;
    });
  });

  // -------------------------------------
  // CHANGE PASSWORD
  // -------------------------------------
  changePassword.onclick = async () => {
    if (!currentUser) return;

    try {
      await firebase.auth().sendPasswordResetEmail(currentUser.email);
      toast("Password reset link sent!");
    } catch (err) {
      console.error(err);
      toast("Failed to send reset email");
    }
  };

  // -------------------------------------
  // NOTIFICATIONS (FCM)
  // -------------------------------------
  const messaging = firebase.messaging();

  notifToggle.addEventListener("change", async () => {
    if (notifToggle.checked) {
      // Ask browser permission
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        notifToggle.checked = false;
        toast("Permission denied");
        return;
      }

      try {
        // Get FCM token
        const token = await messaging.getToken({
          vapidKey: "YOUR_FCM_VAPID_KEY_HERE"
        });

        if (!token) {
          notifToggle.checked = false;
          toast("Failed to get token");
          return;
        }

        // Save token in Firestore
        await userDocRef.set(
          {
            fcmEnabled: true,
            fcmTokens: firebase.firestore.FieldValue.arrayUnion(token)
          },
          { merge: true }
        );

        toast("Notifications Enabled");

      } catch (err) {
        console.error(err);
        notifToggle.checked = false;
        toast("Error enabling notifications");
      }

    } else {
      // Disable notifications
      await userDocRef.set({ fcmEnabled: false }, { merge: true });
      toast("Notifications Disabled");
    }
  });

  // -------------------------------------
  // LOGOUT
  // -------------------------------------
  logoutBtn.onclick = async () => {
    try {
      await firebase.auth().signOut();
      window.location.href = "/auth/login.html";
    } catch (err) {
      console.error(err);
      toast("Error logging out");
    }
  };

})();
