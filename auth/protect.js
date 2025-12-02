// protect.js — SH The Hunger Point
// Secure page gate + safe auth loader (never blocks UI)

// ---------------------------------------------------------
// 1. Wait until Firebase is fully loaded
// ---------------------------------------------------------
function waitForFirebase() {
  return new Promise((resolve) => {
    const check = () => {
      if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0) {
        resolve();
      } else {
        setTimeout(check, 30);
      }
    };
    check();
  });
}

// ---------------------------------------------------------
// 2. Wait until firebase-config.js sets window.auth
// ---------------------------------------------------------
function waitForAuthObject() {
  return new Promise((resolve) => {
    const check = () => {
      if (window.auth) resolve();
      else setTimeout(check, 30);
    };
    check();
  });
}

// ---------------------------------------------------------
// 3. Main protection logic
// ---------------------------------------------------------
(async () => {
  try {
    // Ensure Firebase + auth are ready
    await waitForFirebase();
    await waitForAuthObject();

    // Now safe to use `auth`
    auth.onAuthStateChanged((user) => {
      const currentPage = window.location.pathname;

      if (!user) {
        console.warn("User not logged in — redirecting to login…");

        const encodedNext = encodeURIComponent(currentPage);

        window.location.href = `/auth/login.html?next=${encodedNext}`;
        return;
      }

      console.log("User logged in:", user.email);
    });

  } catch (err) {
    console.error("protect.js failed to initialize:", err);
  }
})();
