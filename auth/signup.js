// signup.js — login.js style + waitForAuth + next support

async function waitForAuth() {
  return new Promise(resolve => {
    const check = () => {
      if (window.auth && window.db) resolve();
      else setTimeout(check, 50);
    };
    check();
  });
}

(async () => {
  await waitForAuth();

  const form = document.getElementById("signupForm");
  const googleBtn = document.getElementById("googleSignup");
  const toast = document.getElementById("toast");
  const createBtn = document.getElementById("createBtn");

  function showToast(msg, {success=false} = {}) {
    toast.textContent = msg;
    toast.style.background = success ? "linear-gradient(90deg,#2bbf7a,#109b57)" : "linear-gradient(90deg,#E23744,#b71c1c)";
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(()=> toast.hidden = true, 2800);
  }

  // eye toggle inside inputs
  document.querySelectorAll(".eye-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const target = btn.getAttribute("data-target");
      const input = document.getElementById(target);
      if (!input) return;
      const wasPwd = input.type === "password";
      input.type = wasPwd ? "text" : "password";
      // swap icon to eye-off when visible (inline svg)
      btn.innerHTML = wasPwd
        ? `<svg class="eye-svg" viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#E23744" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.83 21.83 0 0 1 5.06-7.94"/><path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.83 21.83 0 0 1-2.26 3.95"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg class="eye-svg" viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#E23744" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
    });
  });

  // prevent double submits
  let loading = false;

  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    if (loading) return;
    loading = true;
    if (createBtn) createBtn.disabled = true;

    const name = (document.getElementById("name").value || "").trim();
    const email = (document.getElementById("email").value || "").trim();
    const pass = document.getElementById("password").value || "";
    const confirm = document.getElementById("confirm").value || "";
    const legal = document.getElementById("legalCheck").checked;

    if (!legal) {
      showToast("Please accept Terms, Privacy & Refund.");
      loading = false;
      if (createBtn) createBtn.disabled = false;
      return;
    }

    if (!name || !email || pass.length < 6) {
      showToast("Please complete required fields (password min 6).");
      loading = false;
      if (createBtn) createBtn.disabled = false;
      return;
    }

    if (pass !== confirm) {
      showToast("Passwords do not match.");
      loading = false;
      if (createBtn) createBtn.disabled = false;
      return;
    }

    try {
      const userCred = await auth.createUserWithEmailAndPassword(email, pass);

      // write user doc
      await db.collection("users").doc(userCred.user.uid).set({
        name,
        email,
        acceptedPolicies: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      showToast("Account created — redirecting...", {success:true});

      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "/home/index.html";

      setTimeout(()=> window.location.href = next, 900);

    } catch (err) {
      showToast(err.message || "Signup failed");
      loading = false;
      if (createBtn) createBtn.disabled = false;
    }
  });

  // google button
  googleBtn.addEventListener("click", async ()=>{
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await auth.signInWithPopup(provider);

      if (result && result.additionalUserInfo && result.additionalUserInfo.isNewUser) {
        await db.collection("users").doc(result.user.uid).set({
          name: result.user.displayName || "",
          email: result.user.email || "",
          acceptedPolicies: true,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      showToast("Signed in with Google", {success:true});
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "/home/index.html";
      setTimeout(()=> window.location.href = next, 700);

    } catch (err) {
      showToast(err.message || "Google sign-in failed");
    }
  });

})();
