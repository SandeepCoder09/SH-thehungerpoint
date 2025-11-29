// forgot.js — SH The Hunger Point

// Wait for Firebase to load
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

  const form = document.getElementById("forgotForm");
  const toast = document.getElementById("toast");

  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    setTimeout(() => (toast.hidden = true), 2600);
  }

  // Send Reset Email
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();

    if (!email.includes("@")) {
      return showToast("Enter a valid email.");
    }

    try {
      await auth.sendPasswordResetEmail(email);
      showToast("Reset link sent! Check your email.");

      setTimeout(() => {
        window.location.href = "/auth/login.html";
      }, 1800);

    } catch (err) {
      console.error(err);

      let msg = err.message;
      if (err.code === "auth/user-not-found") msg = "No user found with this email.";
      if (err.code === "auth/invalid-email") msg = "Invalid email format.";

      showToast(msg);
    }
  });

})();
