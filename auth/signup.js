// signup.js — SH The Hunger Point (same structure as login.js)

// Wait until Firebase config loads
async function waitForAuth() {
  return new Promise(resolve => {
    const check = () => {
      if (window.auth) resolve();
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

  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    setTimeout(() => toast.hidden = true, 2500);
  }

  // Password Eye toggle
  function setupToggle(fieldId, openId, closeId) {
    const field = document.getElementById(fieldId);
    const open = document.getElementById(openId);
    const close = document.getElementById(closeId);

    open.addEventListener("click", () => {
      field.type = "text";
      open.classList.add("hide");
      close.classList.remove("hide");
    });

    close.addEventListener("click", () => {
      field.type = "password";
      close.classList.add("hide");
      open.classList.remove("hide");
    });
  }

  setupToggle("password", "eyeOpen", "eyeClose");
  setupToggle("confirm", "eyeOpen2", "eyeClose2");

  // SIGNUP FORM SUBMIT
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const pass = document.getElementById("password").value;
    const confirm = document.getElementById("confirm").value;
    const legal = document.getElementById("legalCheck").checked;

    if (!legal) {
      showToast("You must accept all legal policies.");
      return;
    }

    if (pass !== confirm) {
      showToast("Passwords do not match.");
      return;
    }

    try {
      // Create user
      const userCred = await auth.createUserWithEmailAndPassword(email, pass);

      // Save user info in Firestore
      await db.collection("users").doc(userCred.user.uid).set({
        name,
        email,
        createdAt: new Date()
      });

      showToast("Account created successfully!");

      // Handle redirect logic
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "/home/index.html";

      setTimeout(() => {
        window.location.href = next;
      }, 700);

    } catch (err) {
      showToast(err.message);
    }
  });

  // GOOGLE SIGNUP
  googleBtn.addEventListener("click", async () => {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const userCred = await auth.signInWithPopup(provider);

      // Create account in Firestore if new user
      if (userCred.additionalUserInfo.isNewUser) {
        await db.collection("users").doc(userCred.user.uid).set({
          name: userCred.user.displayName,
          email: userCred.user.email,
          createdAt: new Date()
        });
      }

      // Redirect same way as login
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "/home/index.html";

      window.location.href = next;

    } catch (err) {
      showToast(err.message);
    }
  });

})();