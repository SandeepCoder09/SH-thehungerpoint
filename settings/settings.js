/* SETTINGS PAGE — Uses SHAuth data */

(function () {

  const userName = document.getElementById("userName");
  const userEmail = document.getElementById("userEmail");
  const userAvatar = document.getElementById("userAvatar");

  const changePassword = document.getElementById("changePassword");
  const notifToggle = document.getElementById("notifToggle");
  const logoutBtn = document.getElementById("logoutBtn");

  // Load UI when SHAuth has user data
  document.addEventListener("shauth-ready", () => {
    const u = SHAuth.user;
    const d = SHAuth.userData || {};

    userName.textContent = d.name || "USER NAME";
    userEmail.textContent = u.email;
    userAvatar.src = d.photoURL || "/home/SH-Favicon.png";

    notifToggle.checked = d.fcmEnabled === true;
  });

  // Change Password
  changePassword.onclick = async () => {
    await firebase.auth().sendPasswordResetEmail(SHAuth.user.email);
    alert("Password reset email sent!");
  };

  // Push Notifications
  const messaging = firebase.messaging();

  notifToggle.onchange = async () => {
    const u = SHAuth.user;
    const ref = firebase.firestore().collection("users").doc(u.uid);

    if (notifToggle.checked) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        notifToggle.checked = false;
        return;
      }

      const token = await messaging.getToken({
        vapidKey: "YOUR_VAPID_KEY"
      });

      await ref.set({
        fcmEnabled: true,
        fcmTokens: firebase.firestore.FieldValue.arrayUnion(token)
      }, { merge: true });

    } else {
      await ref.set({ fcmEnabled: false }, { merge: true });
    }
  };

  // Logout
  logoutBtn.onclick = async () => {
    await firebase.auth().signOut();
    window.location.href = "/auth/login.html";
  };

})();