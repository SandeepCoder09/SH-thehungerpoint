// protect.js — SH The Hunger Point
// Protects pages from unauthenticated access

async function waitForFirebase() {
  return new Promise(resolve => {
    const check = () => {
      if (window.auth) resolve();
      else setTimeout(check, 50);
    };
    check();
  });
}

(async () => {
  await waitForFirebase();

  auth.onAuthStateChanged((user) => {
    if (!user) {
      // Redirect to login if not logged in
      const current = encodeURIComponent(window.location.pathname);
      window.location.href = `/auth/login.html?next=${current}`;
    }
  });
})();