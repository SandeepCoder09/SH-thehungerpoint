/* SETTINGS PAGE — Firebase COMPAT + FCM + Live User Data */

(function () {

  // DOM
  const userName = document.getElementById("userName");
  const userEmail = document.getElementById("userEmail");
  const userAvatar = document.getElementById("userAvatar");

  const openProfile = document.getElementById("openProfile");
  const changePassword = document.getElementById("changePassword");
  const openFaqs = document.getElementById("openFaqs");
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

  let currentUser = null;
  let userDocRef = null;

  // -------------------------------------
  // LOAD USER DATA FROM FIRESTORE (LIVE)
  // -------------------------------------
  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "/auth/login.html";
      return;
    }

    currentUser = user;
    userDocRef = firebase.firestore().collection("users").doc(user.uid);

    // Live updates
    userDocRef.onSnapshot((doc) => {
      if (!doc.exists) return;

      const data = doc.data();
      userName.textContent = data.name || "USER NAME";
      userEmail.textContent = user.email || "example@email.com";
      userAvatar.src = data.photoURL || "/home/SH-Favicon.png";

      // Restore FCM toggle
      notifToggle.checked = data.fcmEnabled === true;
    });
  });

  // -------------------------------------
  // NAVIGATION
  // -------------------------------------
  openProfile.onclick = () => {
    window.location.href = "/profile/index.html";
  };

  changePassword.onclick = async () => {
    if (!currentUser) return;

    try {
      await firebase.auth().sendPasswordResetEmail(currentUser.email);
      toast("Password reset link sent!");
    } catch (err) {
      toast("Failed to send reset email");
    }
  };

  openFaqs.onclick = () => {
    window.location.href = "/settings/faqs.html";
  };

  // -------------------------------------
  // FCM REAL NOTIFICATIONS
  // -------------------------------------
  const messaging = firebase.messaging();

  notifToggle.addEventListener("change", async () => {
    if (notifToggle.checked) {
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        notifToggle.checked = false;
        toast("Permission denied");
        return;
      }

      // Get FCM token
      try {
        const token = await messaging.getToken({
          vapidKey: "BDvFl7D2Z7SkLkq8G8JHqJl...your-vapid-key..."
        });

        if (!token) {
          toast("Unable to get token");
          notifToggle.checked = false;
          return;
        }

        // Save token
        await userDocRef.set({
          fcmEnabled: true,
          fcmTokens: firebase.firestore.FieldValue.arrayUnion(token)
        }, { merge: true });

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
    await firebase.auth().signOut();
    window.location.href = "/auth/login.html";
  };

})();