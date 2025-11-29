// protect.js — SH The Hunger Point
// Automatically redirects unauthenticated users to login page.

// ---------------------------------------------------------
// Wait for Firebase Auth to become ready
// ---------------------------------------------------------
async function waitForAuth() {
  return new Promise((resolve) => {
    const check = () => {
      if (window.auth) resolve();
      else setTimeout(check, 50);
    };
    check();
  });
}

// ---------------------------------------------------------
(async () => {
  await waitForAuth();

  auth.onAuthStateChanged((user) => {
    const currentPage = window.location.pathname;

    // If user NOT logged in → Redirect to login
    if (!user) {
      console.warn("User not logged in → redirecting...");

      const encodedNext = encodeURIComponent(currentPage);

      window.location.href = `/auth/login.html?next=${encodedNext}`;
      return;
    }

    console.log("User logged in:", user.email);
  });
})();
