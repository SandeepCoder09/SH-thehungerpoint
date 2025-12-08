/* -----------------------------------------------------------
   SH AUTH CONTROLLER (Global)
   Loads user → exposes SHAuth.user
   Provides SHAuth.requireAuth()
   Auto-fills Settings & Profile pages
------------------------------------------------------------ */

(function () {

  // Ensure Firebase is loaded
  if (!firebase?.auth) {
    console.error("Firebase not loaded before sh-auth.js");
    return;
  }

  const auth = firebase.auth();
  const db = firebase.firestore();

  const SHAuth = {
    user: null,       // Firebase User
    userData: null,   // Firestore user doc

    /**
     * Require login → redirect to login page if not logged in.
     */
    requireAuth() {
      auth.onAuthStateChanged(async (user) => {
        if (!user) {
          window.location.href = "/auth/login.html";
          return;
        }
        SHAuth.user = user;

        // Load Firestore user doc
        const snap = await db.collection("users").doc(user.uid).get();
        SHAuth.userData = snap.exists ? snap.data() : {};

        // Apply to UI automatically
        populateSettings();
        populateProfile();
      });
    },

    /**
     * Logout globally
     */
    async logout() {
      await auth.signOut();
      window.location.href = "/auth/login.html";
    }
  };

  window.SHAuth = SHAuth;

  /* ------------------------------------------------------
     AUTO-FILL: SETTINGS PAGE
  ------------------------------------------------------ */
  function populateSettings() {
    if (!document.querySelector(".settings-container")) return;

    const u = SHAuth.user;
    const d = SHAuth.userData || {};

    setText("userName", d.name || "User Name");
    setText("userEmail", u.email);
    setSrc("userAvatar", d.photoURL || "/home/SH-Favicon.png");
  }

  /* ------------------------------------------------------
     AUTO-FILL: PROFILE PAGE
  ------------------------------------------------------ */
  function populateProfile() {
    if (!document.querySelector(".profile-shell")) return;

    const u = SHAuth.user;
    const d = SHAuth.userData || {};

    setText("displayName", d.name || "Your name");
    setText("displayEmail", u.email);
    setSrc("pfAvatar", d.photoURL || "/home/SH-Favicon.png");

    setVal("name", d.name || "");
    setVal("email", u.email);
    setVal("gender", d.gender || "");
    setVal("phone", d.phone || "");
    setVal("address", d.address || "");
  }

  /* ------------------------------------------------------
     Helpers
  ------------------------------------------------------ */
  function setText(id, txt) {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  }

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  function setSrc(id, src) {
    const el = document.getElementById(id);
    if (el) el.src = src;
  }

})();