// /auth/protect.js
// Waits for window.auth (set by /auth/firebase-config.js) then protects pages.
// Place in /auth/protect.js (your HTML already loads it after firebase-config.js).

// Wait until window.auth is defined
function waitForAuth(timeout = 5000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function check() {
      if (window.auth) return resolve(window.auth);
      if (Date.now() - start > timeout) return reject(new Error("auth not available"));
      setTimeout(check, 50);
    })();
  });
}

(async () => {
  try {
    await waitForAuth();

    // Now attach state change listener
    auth.onAuthStateChanged((user) => {
      const currentPath = window.location.pathname || "/";
      // Do not redirect if we are already on an auth page
      const onAuthPage = currentPath.startsWith("/auth/") || currentPath.includes("/auth/");

      if (!user) {
        console.warn("User not logged in — redirecting to login (if not already on auth page).");

        if (!onAuthPage) {
          const encodedNext = encodeURIComponent(currentPath + (window.location.search || ""));
          window.location.href = `/auth/login.html?next=${encodedNext}`;
        }
        return;
      }

      // user is logged in: expose user object for other scripts and log
      window.currentUser = user;
      console.info("User logged in:", user.email || user.uid);
    });
  } catch (err) {
    // If auth never shows up, we don't want to crash the app — log the error
    console.error("protect.js: failed to initialize auth watcher:", err);
  }
})();
