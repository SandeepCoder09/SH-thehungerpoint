// ================================
// SETTINGS PAGE MAIN SCRIPT
// ================================

// Wait for Firebase
function waitForFirebase() {
  return new Promise((resolve) => {
    const check = () => {
      if (window.firebase && window.auth && window.db) resolve();
      else setTimeout(check, 30);
    };
    check();
  });
}

(async () => {
  await waitForFirebase();

  // Elements
  const hdrName = document.getElementById("hdrName");
  const hdrEmail = document.getElementById("hdrEmail");
  const hdrAvatar = document.getElementById("hdrAvatar");
  const logoutItem = document.getElementById("logoutItem");
  const pwSheet = document.getElementById("pwSheet");
  const pushToggle = document.getElementById("pushToggle");

  // -----------------------------
  // AUTH STATE
  // -----------------------------
  auth.onAuthStateChanged(async (user) => {
    if (!user) return;

    // Load user from Firestore
    const snap = await db.collection("users").doc(user.uid).get();
    const d = snap.data() || {};

    hdrName.textContent = d.name || "User Name";
    hdrEmail.textContent = user.email;
    hdrAvatar.src = d.photoURL || "/assets/default-user.png";

    // Load push toggle
    if (d.pushEnabled) {
      pushToggle.classList.add("on");
    }
  });

  // -----------------------------
  // NAVIGATION
  // -----------------------------
  window.openProfile = () => {
    window.location.href = "/profile/index.html";
  };

  // -----------------------------
  // LOGOUT
  // -----------------------------
  logoutItem.addEventListener("click", async () => {
    await auth.signOut();
    window.location.href = "/auth/login.html";
  });

  // -----------------------------
  // OPEN CHANGE PASSWORD SHEET
  // -----------------------------
  window.openChangePassword = () => {
    pwSheet.classList.add("active");
  };

  window.closePwSheet = () => {
    pwSheet.classList.remove("active");
  };

  // -----------------------------
  // SAVE NEW PASSWORD
  // -----------------------------
  window.savePassword = async () => {
    const newPass = document.getElementById("newPass").value.trim();
    const pass2 = document.getElementById("confirmPass").value.trim();
    const user = auth.currentUser;

    if (!newPass || !pass2) return alert("Enter password");
    if (newPass !== pass2) return alert("Passwords do not match");

    try {
      await user.updatePassword(newPass);
      alert("Password updated");
      closePwSheet();
    } catch (err) {
      console.error(err);
      alert("Error: You must re-login to change password.");
    }
  };

  // -----------------------------
  // PUSH NOTIFICATION TOGGLE
  // -----------------------------
  window.togglePush = async (el) => {
    el.classList.toggle("on");

    const enabled = el.classList.contains("on");
    const uid = auth.currentUser.uid;

    await db.collection("users").doc(uid).set(
      {
        pushEnabled: enabled,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  };
})();