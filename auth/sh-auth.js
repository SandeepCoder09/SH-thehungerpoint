/**
 * sh-auth.js
 * Compatible helper for both Firebase Modular (v9+) and Compat (v8) SDKs.
 *
 * Exposes window.SHAuth with:
 *  - onAuthReady(cb)
 *  - getUserData()
 *  - signOut()
 *  - requireAuth(redirectUrl)
 *
 * Emits DOM events:
 *  - 'sh-auth-ready'  => detail: { user, userDoc }
 *  - 'sh-auth-changed' => detail: { user, userDoc }
 *  - 'sh-auth-logout'
 *
 * Place this after your firebase config script (so firebase / window.auth / window.db are available).
 */

(function () {
  if (window.SHAuth) return; // don't double-init

  const E = (name, detail) =>
    document.dispatchEvent(new CustomEvent(name, { detail }));

  // Helpers to detect SDK style
  const hasCompat = !!(window.firebase && window.firebase.auth && window.firebase.firestore);
  const hasModular = !!(window.auth && window.db); // set by your bootstrap (home/index.html does this)

  // internal state
  let currentUser = null;
  let currentUserDoc = null;
  let unsubscribeUserDoc = null;
  let authUnsubscribe = null;

  // convenience wrappers for Firestore / Auth depending on SDK style
  // --- compat helpers ---
  async function compatGetUserDoc(uid) {
    try {
      const snap = await window.firebase.firestore().collection("users").doc(uid).get();
      return snap.exists ? snap.data() : null;
    } catch (err) {
      console.error("compatGetUserDoc error", err);
      return null;
    }
  }

  function compatWatchUserDoc(uid, onChange) {
    const ref = window.firebase.firestore().collection("users").doc(uid);
    const unsub = ref.onSnapshot((snap) => {
      onChange(snap.exists ? snap.data() : null);
    }, (err) => {
      console.error("compatWatchUserDoc error", err);
    });
    return unsub;
  }

  async function compatSignOut() {
    return window.firebase.auth().signOut();
  }

  function compatOnAuthStateChanged(cb) {
    return window.firebase.auth().onAuthStateChanged(cb);
  }

  // --- modular helpers ---
  // expects: window.auth (Auth), window.db (Firestore)
  async function modularGetUserDoc(uid) {
    try {
      const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js").catch(()=>({}));
      if (!getDoc || !doc) {
        // fallback: we may already have window.db with methods
        try {
          const snap = await window.db.collection("users").doc(uid).get();
          return snap.exists ? snap.data() : null;
        } catch (e) {
          console.error("modularGetUserDoc fallback error", e);
          return null;
        }
      }
      const dref = doc(window.db, "users", uid);
      const snap = await getDoc(dref);
      return snap.exists() ? snap.data() : null;
    } catch (err) {
      console.error("modularGetUserDoc error", err);
      return null;
    }
  }

  function modularWatchUserDoc(uid, onChange) {
    // try to import onSnapshot/doc
    return (async () => {
      try {
        const { onSnapshot, doc } = await import("https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js");
        const dref = doc(window.db, "users", uid);
        return onSnapshot(dref, (snap) => onChange(snap.exists() ? snap.data() : null), (err) => console.error("modularWatchUserDoc error", err));
      } catch (err) {
        // fallback to polling once (less ideal)
        console.warn("modularWatchUserDoc fallback to polling", err);
        let cancelled = false;
        (async function poll() {
          if (cancelled) return;
          const data = await modularGetUserDoc(uid);
          onChange(data);
          setTimeout(poll, 3000);
        })();
        return () => { cancelled = true; };
      }
    })();
  }

  async function modularSignOut() {
    // window.auth is the modular Auth instance
    return window.auth.signOut ? window.auth.signOut() : Promise.reject(new Error("modular signOut not available"));
  }

  function modularOnAuthStateChanged(cb) {
    // modular onAuthStateChanged is available from firebase/auth JS; but we may not want to import again
    if (window.firebase && window.firebase.auth) {
      // compat present as well
      return window.firebase.auth().onAuthStateChanged(cb);
    }
    if (window.auth && typeof window.auth === "object" && typeof window.auth.onAuthStateChanged === "function") {
      return window.auth.onAuthStateChanged(cb);
    }
    // final fallback: poll
    let cancelled = false;
    (async function poll() {
      if (cancelled) return;
      const user = window.auth && window.auth.currentUser ? window.auth.currentUser : null;
      cb(user);
      setTimeout(poll, 1500);
    })();
    return () => { cancelled = true; };
  }

  // internal: stop listening previous doc snapshot
  function stopUserDocWatch() {
    if (!unsubscribeUserDoc) return;
    try {
      // modular watcher may be a Promise that resolves to unsubscribe
      if (typeof unsubscribeUserDoc === "function") {
        unsubscribeUserDoc();
      } else if (unsubscribeUserDoc && typeof unsubscribeUserDoc.then === "function") {
        unsubscribeUserDoc.then((u) => { try { u && u(); } catch (e) {} });
      }
    } catch (e) {}
    unsubscribeUserDoc = null;
  }

  // load user doc and setup watcher
  async function setupUser(user) {
    stopUserDocWatch();
    currentUser = user;
    currentUserDoc = null;

    if (!user) {
      E("sh-auth-changed", { user: null, userDoc: null });
      return;
    }

    const uid = user.uid || user.uid || user.uid === 0 ? user.uid : (user.uid || user.phoneNumber || user.email || null);

    try {
      if (hasCompat) {
        currentUserDoc = await compatGetUserDoc(user.uid);
        // watch live
        unsubscribeUserDoc = compatWatchUserDoc(user.uid, (doc) => {
          currentUserDoc = doc;
          E("sh-auth-ready", { user, userDoc: doc });
          E("sh-auth-changed", { user, userDoc: doc });
        });
      } else if (hasModular) {
        currentUserDoc = await modularGetUserDoc(user.uid);
        // watch
        unsubscribeUserDoc = await modularWatchUserDoc(user.uid);
        // modularWatch returns an unsubscribe function (or we handled fallback)
        // if it resolved to a function we need to capture it
        if (typeof unsubscribeUserDoc.then === "function") {
          // if it returned a promise above, we already handled it in modularWatchUserDoc
        }
        E("sh-auth-ready", { user, userDoc: currentUserDoc });
        E("sh-auth-changed", { user, userDoc: currentUserDoc });
      } else {
        // no firestore available; just fire events with auth user
        currentUserDoc = null;
        E("sh-auth-ready", { user, userDoc: null });
        E("sh-auth-changed", { user, userDoc: null });
      }
    } catch (err) {
      console.error("setupUser error", err);
      E("sh-auth-ready", { user, userDoc: null });
      E("sh-auth-changed", { user, userDoc: null });
    }
  }

  // initialize auth listener (single entrypoint)
  function initAuthListener() {
    if (authUnsubscribe) return; // already listening

    if (hasCompat) {
      authUnsubscribe = compatOnAuthStateChanged(async (user) => {
        if (!user) {
          stopUserDocWatch();
          currentUser = null;
          currentUserDoc = null;
          E("sh-auth-changed", { user: null, userDoc: null });
          return;
        }
        await setupUser(user);
      });
      return;
    }

    if (hasModular) {
      authUnsubscribe = modularOnAuthStateChanged(async (user) => {
        if (!user) {
          stopUserDocWatch();
          currentUser = null;
          currentUserDoc = null;
          E("sh-auth-changed", { user: null, userDoc: null });
          return;
        }
        await setupUser(user);
      });
      return;
    }

    // fallback: no firebase present
    console.warn("sh-auth: no firebase detected on window (compat or modular).");
  }

  // Public API
  const API = {
    // Call cb(user, userDoc) when auth ready (immediately if already ready)
    onAuthReady(cb) {
      if (typeof cb !== "function") return;
      initAuthListener();
      // call immediately if we already have user
      if (currentUser !== null) {
        cb(currentUser, currentUserDoc);
        return;
      }
      // wait for 'sh-auth-ready' next occurrence
      const h = (e) => {
        cb(e.detail.user, e.detail.userDoc);
        document.removeEventListener("sh-auth-ready", h);
      };
      document.addEventListener("sh-auth-ready", h);
    },

    // get latest user doc (fires request)
    async getUserData() {
      if (!currentUser) return null;
      if (hasCompat) {
        const d = await compatGetUserDoc(currentUser.uid);
        currentUserDoc = d;
        return d;
      }
      if (hasModular) {
        const d = await modularGetUserDoc(currentUser.uid);
        currentUserDoc = d;
        return d;
      }
      return null;
    },

    // sign out user
    async signOut() {
      try {
        if (hasCompat) await compatSignOut();
        else if (hasModular) await modularSignOut();
        stopUserDocWatch();
        currentUser = null;
        currentUserDoc = null;
        E("sh-auth-logout", {});
        E("sh-auth-changed", { user: null, userDoc: null });
      } catch (err) {
        console.error("SHAuth.signOut error:", err);
        throw err;
      }
    },

    // require auth on current page (if not authenticated -> redirect)
    requireAuth(redirectUrl = "/auth/login.html") {
      initAuthListener();
      if (currentUser) return true;
      // if not ready yet, wait a short time then redirect
      const t = setTimeout(() => {
        if (!currentUser) window.location.href = redirectUrl;
      }, 1200);

      // if user appears before timeout, clear redirect
      const handler = (e) => {
        clearTimeout(t);
        document.removeEventListener("sh-auth-ready", handler);
      };
      document.addEventListener("sh-auth-ready", handler);
    },

    // quick getter
    get currentUser() { return currentUser; },
    get currentUserDoc() { return currentUserDoc; },

    // low-level: start listener (auto-started by onAuthReady/requireAuth)
    _start() { initAuthListener(); }
  };

  // attach to window
  window.SHAuth = API;

  // start listening immediately (safe)
  try { initAuthListener(); } catch (e) {}

  // expose a convenience global event for legacy scripts (sh-user-ready)
  document.addEventListener("sh-auth-ready", (ev) => {
    // also emit old event name for backwards compatibility
    document.dispatchEvent(new CustomEvent("sh-user-ready", { detail: ev.detail }));
  });

})();