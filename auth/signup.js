// signup.js — premium signup logic (Style A)
// Expects: auth and db globals from /auth/firebase-config.js

// small helper: wait for firebase auth & firestore objects to exist
async function waitForFirebase() {
  return new Promise((res) => {
    const check = () => {
      if (window.firebase && window.firebase.auth && window.firebase.firestore && typeof auth !== 'undefined' && typeof db !== 'undefined') res();
      else setTimeout(check, 60);
    };
    check();
  });
}

(async () => {
  await waitForFirebase();

  // elements
  const form = document.getElementById("signupForm");
  const googleBtn = document.getElementById("googleSignup");
  const toastEl = document.getElementById("toast");
  const toggleButtons = document.querySelectorAll(".toggle-pass");

  function showToast(msg, {success=false} = {}) {
    toastEl.textContent = msg;
    toastEl.style.background = success ? "linear-gradient(90deg,#2bbf7a,#109b57)" : "#111";
    toastEl.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(()=> toastEl.hidden = true, 2800);
  }

  // Password toggle for each .toggle-pass button
  toggleButtons.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const targetId = btn.getAttribute("data-target");
      const input = document.getElementById(targetId);
      if(!input) return;
      const isPwd = input.type === "password";
      input.type = isPwd ? "text" : "password";

      // swap inner svg between eye and eye-off
      if(isPwd){
        btn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="#444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.83 21.83 0 0 1 5.06-7.94"/>
            <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.83 21.83 0 0 1-2.26 3.95"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>`;
      } else {
        btn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="#444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>`;
      }
    });
  });

  // Signup submit handler
  form.addEventListener("submit", async (e)=>{
    e.preventDefault();

    const name = (document.getElementById("name").value||"").trim();
    const email = (document.getElementById("email").value||"").trim();
    const password = document.getElementById("password").value || "";
    const confirm = document.getElementById("confirm").value || "";
    const legal = document.getElementById("legalAgree").checked;

    if(!legal){
      showToast("You must accept Terms, Privacy & Refund to continue.");
      return;
    }
    if(!name || !email || password.length < 6){
      showToast("Please fill required fields (password min 6 chars).");
      return;
    }
    if(password !== confirm){
      showToast("Passwords do not match.");
      return;
    }

    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);

      // write to firestore users collection
      await db.collection("users").doc(cred.user.uid).set({
        name,
        email,
        acceptedPolicies: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      showToast("Account created successfully!", {success:true});

      // small delay so user sees toast
      setTimeout(()=> window.location.href = "/home/index.html", 900);

    } catch (err) {
      // map common Firebase messages if you want to show friendlier text
      showToast(err.message || "Signup error");
    }
  });

  // Google signup/login
  googleBtn.addEventListener("click", async ()=>{
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await auth.signInWithPopup(provider);

      // save new users
      if(result && result.additionalUserInfo && result.additionalUserInfo.isNewUser){
        await db.collection("users").doc(result.user.uid).set({
          name: result.user.displayName || "",
          email: result.user.email || "",
          acceptedPolicies: true,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      showToast("Welcome back!", {success:true});
      setTimeout(()=> window.location.href = "/home/index.html", 700);

    } catch (err) {
      showToast(err.message || "Google Sign-in failed");
    }
  });

})();