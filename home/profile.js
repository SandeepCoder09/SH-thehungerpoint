// /profile/script.js
// Saves profile data to Firestore (collection "users" -> doc uid).
// If Firebase Auth is present and a user is signed in, it will try to use that auth user
// to update email/password where possible. Otherwise the script will create/use a
// generated uid in localStorage and store profile in Firestore under that uid.

// CONFIG: make sure /firebase-config.js exists and calls firebase.initializeApp({...})

const db = firebase.firestore();
const auth = firebase.auth ? firebase.auth() : null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const fullNameEl = $("#fullName");
const emailEl = $("#email");
const phoneEl = $("#phone");
const pwEl = $("#password");
const changePwBtn = $("#changePwBtn");
const saveBtn = $("#saveBtn");
const statusEl = $("#status");
const signoutBtn = $("#signoutBtn");

let uid = localStorage.getItem("user_uid") || null;
let authUser = null;

function toast(msg, t = 2200) {
  const c = document.getElementById("toast-container");
  if (!c) return console.log("toast:", msg);
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), t);
}

async function detectAuth() {
  if (!auth) return null;
  return new Promise((res) => {
    const unsub = auth.onAuthStateChanged(user => {
      unsub();
      res(user || null);
    });
  });
}

function genUID() {
  // simple random id for local-only users
  return "u_" + Math.random().toString(36).slice(2, 10);
}

async function init() {
  try {
    authUser = await detectAuth();

    if (authUser) {
      // if user authenticated, use auth uid
      uid = authUser.uid;
      // enable email/password operations
      pwEl.disabled = false;
      changePwBtn.disabled = false;
      $("#pwHint").textContent = "Signed-in via Firebase Auth — you can change password here.";
      signoutBtn.style.display = "inline-block";
    } else {
      // no auth - use or create local uid
      if (!uid) {
        uid = genUID();
        localStorage.setItem("user_uid", uid);
      }
      pwEl.disabled = true;
      changePwBtn.disabled = true;
      $("#pwHint").textContent = "Password change requires Firebase Authentication. (Enable Auth to let users change password securely.)";
      signoutBtn.style.display = "none";
    }

    await loadProfile();
  } catch (err) {
    console.error("init error", err);
    statusEl.textContent = "Initialization failed.";
  }
}

async function loadProfile() {
  statusEl.textContent = "Loading profile…";
  try {
    const docRef = db.collection("users").doc(uid);
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data();
      fullNameEl.value = data.displayName || "";
      emailEl.value = data.email || (authUser ? authUser.email : "");
      phoneEl.value = data.phone || "";
    } else {
      // if auth user present, prefill from auth
      if (authUser) {
        fullNameEl.value = authUser.displayName || "";
        emailEl.value = authUser.email || "";
      }
    }
    statusEl.textContent = "";
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Failed to load profile.";
  }
}

async function saveProfileToFirestore(payload) {
  const ref = db.collection("users").doc(uid);
  await ref.set(payload, { merge: true });
}

async function updateEmail(newEmail) {
  if (!authUser) throw new Error("No auth user present");
  await authUser.updateEmail(newEmail);
}

async function updatePasswordFlow(newPassword) {
  if (!authUser) throw new Error("No auth user present");
  // Attempt to update password — may require recent auth (reauthenticate)
  await authUser.updatePassword(newPassword);
}

profileForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  saveBtn.disabled = true;
  statusEl.textContent = "Saving…";

  const displayName = fullNameEl.value.trim();
  const email = emailEl.value.trim();
  const phone = phoneEl.value.trim();

  try {
    // 1) If auth user present and email changed -> try update auth email
    if (authUser && email && email !== authUser.email) {
      try {
        await updateEmail(email);
        toast("Authentication email updated.");
      } catch (e) {
        // common error: requires recent sign-in
        console.warn("updateEmail error", e);
        toast("Unable to update email — you may need to re-login to change email.");
      }
    }

    // 2) Save basic profile to Firestore
    const payload = {
      displayName,
      email,
      phone,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await saveProfileToFirestore(payload);

    // 3) Optionally update auth displayName if available
    if (authUser && displayName) {
      try {
        await authUser.updateProfile({ displayName });
      } catch (e) { console.warn("updateProfile failed", e); }
    }

    statusEl.textContent = "Saved ✓";
    toast("Profile saved");
  } catch (err) {
    console.error("save error", err);
    statusEl.textContent = "Save failed. See console.";
    toast("Save failed");
  } finally {
    saveBtn.disabled = false;
    setTimeout(()=> statusEl.textContent = "", 2500);
  }
});

// Password change button (only works when Firebase Auth is used)
changePwBtn.addEventListener("click", async () => {
  const val = pwEl.value.trim();
  if (!val) {
    toast("Enter a new password first");
    return;
  }
  changePwBtn.disabled = true;
  changePwBtn.textContent = "Updating…";
  try {
    await updatePasswordFlow(val);
    toast("Password updated successfully");
    pwEl.value = "";
  } catch (err) {
    console.error("pw update", err);
    // If requires recent login, inform user
    if (err && err.code === 'auth/requires-recent-login') {
      toast("Sensitive action: please sign-in again and retry.");
    } else {
      toast("Password update failed.");
    }
  } finally {
    changePwBtn.disabled = false;
    changePwBtn.textContent = "Change Password";
  }
});

// Sign out (if using Auth)
signoutBtn.addEventListener("click", async () => {
  if (!auth) return;
  try {
    await auth.signOut();
    toast("Signed out");
    // fallback: generate local uid and reload
    localStorage.removeItem("user_uid");
    setTimeout(() => location.reload(), 700);
  } catch (e) {
    console.error(e);
    toast("Sign out failed");
  }
});

// init
init();
