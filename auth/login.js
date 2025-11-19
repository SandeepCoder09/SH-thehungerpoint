// login.js — SH The Hunger Point

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

  const form = document.getElementById("loginForm");
  const googleBtn = document.getElementById("googleLogin");
  const toast = document.getElementById("toast");

  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    setTimeout(() => toast.hidden = true, 2500);
  }

  // Email + Password Login
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const pass = document.getElementById("password").value;

    try {
      await auth.signInWithEmailAndPassword(email, pass);

      showToast("Login successful!");

      // If redirected from protected page
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "/home/index.html";

      setTimeout(() => {
        window.location.href = next;
      }, 700);

    } catch(err) {
      showToast(err.message);
    }
  });

  // Google Login
  googleBtn.addEventListener("click", async () => {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(provider);

      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "/home/index.html";

      window.location.href = next;

    } catch(err) {
      showToast(err.message);
    }
  });

})();