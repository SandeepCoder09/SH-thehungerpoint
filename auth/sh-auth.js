// /auth/sh-auth.js
// Modular Firebase initializer + small auth helper for your app.
// Exports: requireUser(callback) and getCurrentUser() (also sets window.auth/window.db)

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { firebaseConfig } from "/auth/firebase-config.js";

// Initialize Firebase app if not already initialized
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Expose modular auth & db on window for legacy scripts that expect window.auth/window.db
const auth = getAuth(app);
const db = getFirestore(app);
window.auth = auth;
window.db = db;

/**
 * requireUser(cb)
 * - cb receives the firebase user object when signed-in.
 * - If user is already signed in, cb is invoked synchronously (but scheduled).
 * - If not signed in, redirects to /auth/login.html (keeps current path in `next` param).
 */
export function requireUser(cb, opts = {}) {
  // opts.allowRedirect (default true) - set false if caller wants to handle redirect itself
  const allowRedirect = opts.allowRedirect !== false;

  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        if (allowRedirect) {
          const current = location.pathname + (location.search || "");
          const encoded = encodeURIComponent(current);
          location.href = `/auth/login.html?next=${encoded}`;
          // don't resolve — page will navigate
        } else {
          // resolve null so caller can handle
          unsub();
          resolve(null);
        }
        return;
      }

      // Attach to window for any non-module code
      window.currentUser = user;

      // Small async dispatch so caller behaves uniformly
      setTimeout(() => {
        try { cb && cb(user); } catch (e) { console.error(e); }
        unsub();
        resolve(user);
      }, 0);
    });
  });
}

// convenience getter
export function getCurrentUser() {
  return auth.currentUser || window.currentUser || null;
}

// also export auth/db for modules that want them
export { auth, db };