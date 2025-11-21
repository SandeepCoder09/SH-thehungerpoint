// signup.js — SH The Hunger Point

// Wait for firebase from firebase-config.js
function waitFirebase() {
  return new Promise(resolve => {
    const check = () => {
      if (window.auth && window.db) resolve();
      else setTimeout(check, 30);
    };
    check();
  });
}

(async () => {
  await waitFirebase();

  const form = document.getElementById("signupForm");
  const toast = document.getElementById("toast");
  const googleBtn = document.getElementById("googleSignup");

  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    setTimeout(() => (toast.hidden = true), 2200);
  }

  // password toggle for any field
  function makeToggle(passId, openSvgId, slashSvgId, toggleBtnId) {
    const pass = document.getElementById(passId);
    const openSvg = document.getElementById(openSvgId);
    const slashSvg = document.getElementById(slashSvgId);
    const btn = document.getElementById(toggleBtnId);

    btn.addEventListener("click", () => {
      const show = pass.type === "password";
      pass.type = show ? "text" : "password";
      openSvg.classList.toggle("hidden", show);
      slashSvg.classList.toggle("hidden", !show);
    });
  }

  makeToggle("password", "eyeOpenPass", "eyeSlashPass", "togglePass");
  makeToggle("confirm", "eyeOpenConfirm", "eyeSlashConfirm", "toggleConfirm");

  // FORM
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const pass = document.getElementById("password").value;
    const conf = document.getElementById("confirm").value;
    const legal = document.getElementById("legalCheck").checked;

    if (!legal) return showToast("Please accept all policies");
    if (pass !== conf) return showToast("Passwords do not match");

    try {
      const cred = await auth.createUserWithEmailAndPassword(email, pass);

      await db.collection("users").doc(cred.user.uid).set({
        name,
        email,
        createdAt: new Date()
      });

      showToast("Account created!");

      setTimeout(() => {
        window.location.href = "/home/index.html";
      }, 800);

    } catch (err) {
      showToast(err.message);
    }
  });

  googleBtn.addEventListener("click", async () => {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await auth.signInWithPopup(provider);

      if (result.additionalUserInfo.isNewUser) {
        await db.collection("users").doc(result.user.uid).set({
          name: result.user.displayName,
          email: result.user.email,
          createdAt: new Date()
        });
      }

      window.location.href = "/home/index.html";

    } catch (err) {
      showToast(err.message);
    }
  });

})();