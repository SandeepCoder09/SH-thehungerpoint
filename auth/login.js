// login.js — SH The Hunger Point (2025 Final Version)

// -----------------------------------------------------
// WAIT FOR FIREBASE AUTH TO LOAD
// -----------------------------------------------------
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
  console.log("Firebase Auth Loaded ✔");

  const form = document.getElementById("loginForm");
  const googleBtn = document.getElementById("googleLogin");
  const toast = document.getElementById("toast");

  // -----------------------------------------------------
  // TOAST MESSAGE SYSTEM
  // -----------------------------------------------------
  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    setTimeout(() => (toast.hidden = true), 2500);
  }

  // -----------------------------------------------------
  // EMAIL + PASSWORD LOGIN
  // -----------------------------------------------------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const pass = document.getElementById("password").value;

    // Basic validation
    if (!email || !email.includes("@")) {
      return showToast("Enter a valid email address.");
    }

    if (!pass) {
      return showToast("Password cannot be empty.");
    }

    try {
      // Firebase Auth Login
      await auth.signInWithEmailAndPassword(email, pass);

      showToast("Login successful!");

      // Handle protected redirect (example: "?next=/cart")
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "/home/index.html";

      setTimeout(() => {
        window.location.href = next;
      }, 700);

    } catch (err) {
      console.error("Login error:", err);

      // Friendlier error messages
      let msg = err.message;

      if (err.code === "auth/user-not-found") msg = "No account found with this email.";
      if (err.code === "auth/wrong-password") msg = "Incorrect password.";
      if (err.code === "auth/invalid-email") msg = "Invalid email format.";

      showToast(msg);
    }
  });

  // -----------------------------------------------------
  // GOOGLE LOGIN
  // -----------------------------------------------------
  googleBtn.addEventListener("click", async () => {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(provider);

      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "/home/index.html";

      window.location.href = next;

    } catch (err) {
      console.error("Google login error:", err);
      showToast(err.message);
    }
  });

})();
