// signup.js — SH System with correct config path + next=

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
  const toast = document.getElementById("toast");
  const googleBtn = document.getElementById("googleSignup");
  const createBtn = document.getElementById("createBtn");

  function showToast(msg, ok=false) {
    toast.textContent = msg;
    toast.style.background = ok
      ? "linear-gradient(90deg,#28cc72,#15a650)"
      : "linear-gradient(90deg,#E23744,#b71c1c)";
    toast.hidden = false;
    setTimeout(()=> toast.hidden=true, 2500);
  }

  // show/hide password
  document.querySelectorAll(".eye-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const id = btn.dataset.target;
      const input = document.getElementById(id);

      const show = input.type === "password";
      input.type = show ? "text" : "password";

      btn.innerHTML = show ? `
        <!-- eye-off -->
        <svg class="eye-svg" width="20" height="20" viewBox="0 0 24 24"
          fill="none" stroke="#E23744" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8
                   a21.83 21.83 0 0 1 5.06-7.94"/>
          <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8
                   a21.83 21.83 0 0 1-2.26 3.95"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>`
      :
      `
        <!-- eye-open -->
        <svg class="eye-svg" width="20" height="20" viewBox="0 0 24 24"
          fill="none" stroke="#E23744" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>`;
    });
  });

  // prevent double submit
  let sending = false;

  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    if (sending) return;
    sending = true;
    createBtn.disabled = true;

    const name = name.value.trim();
    const email = document.getElementById("email").value.trim();
    const pass = document.getElementById("password").value;
    const confirm = document.getElementById("confirm").value;
    const legal = document.getElementById("legalCheck").checked;

    if (!legal) {
      showToast("Please accept all legal policies.");
      sending = false;
      createBtn.disabled = false;
      return;
    }

    if (pass !== confirm) {
      showToast("Passwords do not match.");
      sending = false;
      createBtn.disabled = false;
      return;
    }

    try {
      const userCred = await auth.createUserWithEmailAndPassword(email, pass);

      await db.collection("users").doc(userCred.user.uid).set({
        name,
        email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      showToast("Account created!", true);

      const params = new URLSearchParams(location.search);
      const next = params.get("next") || "/home/index.html";

      setTimeout(()=> location.href = next, 900);

    } catch (err) {
      showToast(err.message);
      sending = false;
      createBtn.disabled = false;
    }
  });

  // GOOGLE SIGNUP
  googleBtn.addEventListener("click", async ()=>{
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await auth.signInWithPopup(provider);

      if (result.additionalUserInfo.isNewUser) {
        await db.collection("users").doc(result.user.uid).set({
          name: result.user.displayName,
          email: result.user.email,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      showToast("Google login success", true);

      const params = new URLSearchParams(location.search);
      const next = params.get("next") || "/home/index.html";
      setTimeout(()=> location.href = next, 700);

    } catch (err) {
      showToast(err.message);
    }
  });

})();
