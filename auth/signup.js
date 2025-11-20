// signup.js — SH The Hunger Point

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

  const form = document.getElementById("signupForm");
  const googleBtn = document.getElementById("googleSignup");
  const toast = document.getElementById("toast");

  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    setTimeout(() => toast.hidden = true, 2500);
  }

  // Toggle password visibility
  function togglePassword(fieldId, toggleId) {
    const field = document.getElementById(fieldId);
    const toggle = document.getElementById(toggleId);

    toggle.addEventListener("click", () => {
      if (field.type === "password") {
        field.type = "text";
        toggle.textContent = "🔒";
      } else {
        field.type = "password";
        toggle.textContent = "🔓";
      }
    });
  }

  togglePassword("password", "togglePass");
  togglePassword("confirm", "toggleConfirm");

  // FORM SUBMIT
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
        createdAt: new Date()
      });

      showToast("Account created successfully!");

      setTimeout(() => {
        window.location.href = "/home/index.html";
      }, 800);

    } catch (err) {
      showToast(err.message);
    }
  });

  // GOOGLE SIGNUP
  googleBtn.addEventListener("click", async () => {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const userCred = await auth.signInWithPopup(provider);

      if (userCred.additionalUserInfo.isNewUser) {
        await db.collection("users").doc(userCred.user.uid).set({
          name: userCred.user.displayName,
          email: userCred.user.email,
          createdAt: new Date()
        });
      }

      window.location.href = "/home/index.html";

    } catch (err) {
      showToast(err.message);
    }
  });

})();
