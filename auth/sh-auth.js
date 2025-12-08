// /auth/sh-auth.js
// Central Firebase Auth/Firestore helper for SH — The Hunger Point (Modular v10)
// ---------------------------------------------------------------
// ✓ Initializes Firebase using firebase-config.js
// ✓ Exposes global: window.SHAuth
// ✓ Provides: ready(), user, userDoc, requireAuth(), signOut()
// ✓ Live Firestore sync for users/{uid}
// ✓ Emits events: sh:auth-ready, sh:user-changed, sh:user-doc-updated
// ✓ Backwards compatible: window.auth, window.db, window.currentUser
// ---------------------------------------------------------------

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut as fbSignOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { firebaseConfig } from "/auth/firebase-config.js";

(function () {

  // Prevent double initialization
  if (window.SHAuth && window.SHAuth._initialized) {
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent("sh:auth-ready"));
    }, 0);
    return;
  }

  // -----------------------------------------------------
  // Firebase Init
  // -----------------------------------------------------
  const app = (getApps().length > 0) ? getApps()[0] : initializeApp(firebaseConfig);

  const auth = getAuth(app);
  const db = getFirestore(app);

  // Backwards compatibility for your old scripts
  window.app = app;
  window.auth = auth;
  window.db = db;

  // -----------------------------------------------------
  // Internal State
  // -----------------------------------------------------
  let currentUser = undefined; // undefined = first load, null = signed out
  let currentUserDoc = null;

  let userDocUnsub = null;
  let userDocRef = null;

  // -----------------------------------------------------
  // Helpers
  // -----------------------------------------------------
  function emit(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  }

  async function ensureUserDoc(uid, initial = {}) {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await setDoc(ref, {
        createdAt: serverTimestamp(),
        ...initial
      }, { merge: true });
    }

    return ref;
  }

  function watchUserDoc(uid) {
    if (userDocUnsub) {
      userDocUnsub();
      userDocUnsub = null;
    }

    if (!uid) {
      currentUserDoc = null;
      emit("sh:user-doc-updated", { doc: null });
      return;
    }

    userDocRef = doc(db, "users", uid);

    userDocUnsub = onSnapshot(userDocRef, (snap) => {
      if (!snap.exists()) {
        currentUserDoc = null;
        emit("sh:user-doc-updated", { doc: null });
        return;
      }
      currentUserDoc = { id: snap.id, ...snap.data() };
      emit("sh:user-doc-updated", { doc: currentUserDoc });
    });
  }

  // -----------------------------------------------------
  // onAuthStateChanged
  // -----------------------------------------------------
  onAuthStateChanged(auth, async (user) => {
    currentUser = user || null;
    window.currentUser = currentUser; // backwards compatibility

    emit("sh:user-changed", { user: currentUser });

    if (user) {
      await ensureUserDoc(user.uid, {
        email: user.email || null,
        name: user.displayName || null
      });
      watchUserDoc(user.uid);
    } else {
      watchUserDoc(null);
    }
  });

  // -----------------------------------------------------
  // SHAuth Public API
  // -----------------------------------------------------
  const SHAuth = {
    _initialized: true,

    get user() {
      return currentUser;
    },

    get userDoc() {
      return currentUserDoc;
    },

    get auth() {
      return auth;
    },

    get db() {
      return db;
    },

    // Ready promise
    async ready() {
      return new Promise((resolve) => {
        if (currentUser !== undefined) {
          resolve({ user: currentUser, doc: currentUserDoc });
          return;
        }

        const fn = (ev) => {
          document.removeEventListener("sh:user-changed", fn);
          resolve({ user: ev.detail.user, doc: currentUserDoc });
        };

        document.addEventListener("sh:user-changed", fn);
      });
    },

    // Require login
    async requireAuth(options = { redirect: true }) {
      await SHAuth.ready();
      if (currentUser) return true;

      if (options.redirect) {
        const next = encodeURIComponent(
          window.location.pathname + (window.location.search || "")
        );
        window.location.href = `/auth/login.html?next=${next}`;
      }

      return false;
    },

    // Create missing doc
    async ensureUserDoc(initial = {}) {
      if (!currentUser) return null;
      await ensureUserDoc(currentUser.uid, initial);
      return currentUserDoc;
    },

    // One-time fetch
    async getUserDocOnce() {
      if (!currentUser) return null;
      const ref = doc(db, "users", currentUser.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() };
    },

    // Logout
    async signOut() {
      try {
        await fbSignOut(auth);

        if (userDocUnsub) userDocUnsub();
        userDocUnsub = null;
        userDocRef = null;

        currentUser = null;
        currentUserDoc = null;

        emit("sh:user-changed", { user: null });
        emit("sh:user-doc-updated", { doc: null });

        return true;
      } catch (err) {
        console.error("SHAuth.signOut error:", err);
        return false;
      }
    }
  };

  // Global exposure
  window.SHAuth = SHAuth;

  // Announce ready
  setTimeout(() => emit("sh:auth-ready", { auth }), 0);

})();