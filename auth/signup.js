// =======================
// signup.js — SH The Hunger Point
// =======================

// Wait for Firebase Auth to load
async function waitForAuth() {
  return new Promise(resolve => {
    const check = () => {
      if (window.auth) resolve();
      else setTimeout(check, 40);
    };
    check();
  });
}

(async () => {
  await waitForAuth();

  // Elements
  const form = document.getElementById("signupForm");
  const googleBtn = document.getElementById("googleSignup");
  const toast = document.getElementById("toast");

  // ===== TOAST FUNCTION =====
  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    setTimeout(() => (toast.hidden = true), 2500);
  }

  // ===== SHOW/HIDE PASSWORD =====
  function setupToggle(inputId, openId, slashId) {
    const input = document.getElementById(inputId);
    const openIcon = document.getElementById(openId);
    const slashIcon = document.getElementById(slashId);

    const toggleWrapper = openIcon.parentElement;

    toggleWrapper.addEventListener("click", () => {
      const isHidden = input.type === "password";

      input.type = isHidden ? "text" : "password";

      openIcon.classList.toggle("hidden", !isHidden);
      slashIcon.classList.toggle("hidden", isHidden);
    });
  }

  setupToggle("password", "eyeOpenPass", "eyeSlashPass");
  setupToggle("confirm", "eyeOpenConfirm", "eyeSlashConfirm");

  // ===========================
  // FORM SUBMIT
  // ===========================
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const pass = document.getElementById("password").value;
    const confirm = document.getElementById("confirm").value;
    const legal = document.getElementById("legalCheck").checked;

    if (!legal) return showToast("Please accept all legal policies.");
    if (pass !== confirm) return showToast("Passwords do not match.");

    try {
      const userCred = await auth.createUserWithEmailAndPassword(email, pass);

      await db.collection("users").doc(userCred.user.uid).set({
        name,
        email,
        createdAt: new Date(),
      });

      showToast("Account created successfully!");

      setTimeout(() => {
        window.location.href = "/home/index.html";
      }, 800);
    } catch (err) {
      showToast(err.message);
    }
  });

  // ===========================
  // GOOGLE SIGNUP
  // ===========================
  googleBtn.addEventListener("click", async () => {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const userCred = await auth.signInWithPopup(provider);

      if (userCred.additionalUserInfo.isNewUser) {
        await db.collection("users").doc(userCred.user.uid).set({
          name: userCred.user.displayName,
          email: userCred.user.email,
          createdAt: new Date(),
        });
      }

      window.location.href = "/home/index.html";
    } catch (err) {
      showToast(err.message);
    }
  });
})();