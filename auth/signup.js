// signup.js — SH The Hunger Point

// Wait until Firebase config finishes loading
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

  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    setTimeout(() => toast.hidden = true, 2500);
  }

  // Email + Password Signup
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const pass = document.getElementById("password").value;
    const confirm = document.getElementById("confirm").value;

    if (pass !== confirm) {
      showToast("Passwords do not match");
      return;
    }

    try {
      const result = await auth.createUserWithEmailAndPassword(email, pass);

      // Save user in Firestore
      await db.collection("users").doc(result.user.uid).set({
        name,
        email,
        createdAt: new Date()
      });

      showToast("Account created!");

      // Redirect to homepage
      setTimeout(() => {
        window.location.href = "/home/index.html";
      }, 700);

    } catch(err) {
      showToast(err.message);
    }
  });

  // Google Signup
  googleBtn.addEventListener("click", async () => {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await auth.signInWithPopup(provider);

      // Store only if new user
      if (result.additionalUserInfo.isNewUser) {
        await db.collection("users").doc(result.user.uid).set({
          name: result.user.displayName,
          email: result.user.email,
          createdAt: new Date()
        });
      }

      window.location.href = "/home/index.html";
    } catch(err) {
      showToast(err.message);
    }
  });

})();