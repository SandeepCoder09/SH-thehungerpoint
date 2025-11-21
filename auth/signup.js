/* auth/signup.js
   Fully regenerated — robust + self-contained
   Expects:
   - firebase compat SDKs already loaded (app-compat, auth-compat, firestore-compat)
   - ideally /auth/firebase-config.js runs before this and sets `auth` and `db`
   If not, the script will try to initialize firebase itself if window.firebaseConfig exists.
*/

(() => {
  "use strict";

  /* ---------- SVG ICONS ---------- */
  const ICON_EYE = `
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="#555" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 5c-7.633 0-11 6.993-11 7s3.367 7 11 7 11-6.993 11-7-3.367-7-11-7zm0 
    12c-2.761 0-5-2.239-5-5 0-2.762 2.239-5 5-5s5 2.238 5 
    5c0 2.761-2.239 5-5 5zm0-8c-1.654 0-3 1.346-3 
    3 0 1.653 1.346 3 3 3s3-1.347 3-3c0-1.654-1.346-3-3-3z"/>
  </svg>`.trim();

  // simple single-line slash icon (used for "hidden" toggle)
  const ICON_SLASH = `
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <line x1="4" y1="20" x2="20" y2="4" stroke="#d10000" stroke-width="2.5" stroke-linecap="round" />
  </svg>`.trim();

  /* ---------- DOM helpers ---------- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function showToast(text, ms = 2600) {
    const t = $("#toast");
    if (!t) {
      console.warn("Toast missing:", text);
      return;
    }
    t.textContent = text;
    t.hidden = false;
    t.style.opacity = "1";
    clearTimeout(t._timeout);
    t._timeout = setTimeout(() => {
      t.hidden = true;
      t.style.opacity = "0";
    }, ms);
  }

  /* ---------- Ensure firebase (auth/db) ---------- */
  async function ensureFirebaseReady() {
    // if `auth` & `db` already set by your firebase-config.js, use them
    if (window.auth && window.db) return;

    // if firebase SDK exists and firebaseConfig is present, init here
    if (window.firebase && window.firebase.apps && window.firebaseConfig && !window.firebase.apps.length) {
      try {
        firebase.initializeApp(window.firebaseConfig);
      } catch (e) {
        // ignore if already initialized
      }
    }

    // wait until firebase.auth available
    const waitFor = (cond, timeout = 4000) => new Promise((resolve, reject) => {
      const start = Date.now();
      (function check() {
        if (cond()) return resolve();
        if (Date.now() - start > timeout) return reject(new Error("Timed out waiting for Firebase"));
        setTimeout(check, 50);
      })();
    });

    try {
      await waitFor(() => window.firebase && window.firebase.auth && window.firebase.firestore, 4000);
      // attach convenience globals if not present
      if (!window.auth) window.auth = firebase.auth();
      if (!window.db) window.db = firebase.firestore();
    } catch (err) {
      console.warn("Firebase not found or not ready:", err);
      // leave it — downstream callers will get a readable error when attempting auth ops
    }
  }

  /* ---------- Toggle password UI ---------- */
  function setupToggle(inputId, toggleId) {
    const input = document.getElementById(inputId);
    const toggle = document.getElementById(toggleId);
    if (!input || !toggle) return;
    toggle.innerHTML = ICON_EYE;
    toggle.setAttribute("role", "button");
    toggle.setAttribute("aria-label", "Show password");

    toggle.addEventListener("click", () => {
      if (input.type === "password") {
        input.type = "text";
        toggle.innerHTML = ICON_SLASH;
        toggle.setAttribute("aria-label", "Hide password");
      } else {
        input.type = "password";
        toggle.innerHTML = ICON_EYE;
        toggle.setAttribute("aria-label", "Show password");
      }
    });
  }

  /* ---------- Validation helpers ---------- */
  function isEmail(v) {
    return /\S+@\S+\.\S+/.test(v);
  }

  function disableButton(btn) {
    if (!btn) return;
    btn.disabled = true;
    btn.dataset.prev = btn.innerHTML;
    btn.innerHTML = "Please wait…";
    btn.classList.add("disabled");
  }
  function enableButton(btn) {
    if (!btn) return;
    btn.disabled = false;
    if (btn.dataset.prev) btn.innerHTML = btn.dataset.prev;
    btn.classList.remove("disabled");
  }

  /* ---------- Main init ---------- */
  async function init() {
    await ensureFirebaseReady();

    const form = $("#signupForm");
    const googleBtn = $("#googleSignup");
    const togglePass = $("#togglePass");
    const toggleConfirm = $("#toggleConfirm");
    const submitBtn = form?.querySelector('button[type="submit"]') || null;

    setupToggle("password", "togglePass");
    setupToggle("confirm", "toggleConfirm");

    if (!form) {
      console.error("Signup form not found");
      return;
    }

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      // basic guard
      if (submitBtn && submitBtn.disabled) return;

      const name = (document.getElementById("name")?.value || "").trim();
      const email = (document.getElementById("email")?.value || "").trim();
      const password = (document.getElementById("password")?.value || "");
      const confirm = (document.getElementById("confirm")?.value || "");
      const legal = !!document.getElementById("legalCheck")?.checked;

      if (!name) { showToast("Enter your name"); return; }
      if (!email || !isEmail(email)) { showToast("Enter a valid email"); return; }
      if (!password || password.length < 6) { showToast("Password must be at least 6 characters"); return; }
      if (password !== confirm) { showToast("Passwords do not match"); return; }
      if (!legal) { showToast("Please accept the policies"); return; }

      if (!window.auth) {
        showToast("Auth not ready. Contact admin.");
        return;
      }

      disableButton(submitBtn);

      try {
        const userCred = await window.auth.createUserWithEmailAndPassword(email, password);
        const uid = userCred?.user?.uid;
        if (!uid) throw new Error("Signup failed");

        // optional: update displayName
        try { await userCred.user.updateProfile({ displayName: name }); } catch(e){ /* ignore */ }

        // save user doc in Firestore
        if (window.db) {
          await window.db.collection("users").doc(uid).set({
            name,
            email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        }

        showToast("Account created — redirecting…", 1800);
        setTimeout(() => { window.location.href = "/home/index.html"; }, 1000);

      } catch (err) {
        const msg = (err && err.message) ? err.message : String(err);
        // friendly mapping for common firebase errors
        let friendly = msg;
        if (msg.includes("auth/email-already-in-use")) friendly = "Email already in use — try logging in";
        if (msg.includes("auth/invalid-email")) friendly = "Invalid email address";
        if (msg.includes("auth/weak-password")) friendly = "Password is too weak";
        showToast(friendly, 3000);
        console.error("Signup error:", err);
      } finally {
        enableButton(submitBtn);
      }
    });

    // Google signup/signin
    if (googleBtn) {
      googleBtn.addEventListener("click", async () => {
        if (!window.auth) { showToast("Auth not ready"); return; }
        disableButton(googleBtn);
        try {
          const provider = new firebase.auth.GoogleAuthProvider();
          const result = await window.auth.signInWithPopup(provider);

          // if new user, create doc
          const isNew = result?.additionalUserInfo?.isNewUser;
          const user = result?.user;
          if (isNew && user && window.db) {
            await window.db.collection("users").doc(user.uid).set({
              name: user.displayName || "",
              email: user.email || "",
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
          }

          window.location.href = "/home/index.html";
        } catch (err) {
          showToast(err?.message || "Google sign-in failed");
          console.error("Google sign-in", err);
        } finally {
          enableButton(googleBtn);
        }
      });
    }
  }

  // DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();