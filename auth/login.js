// login.js — Prevent rider auto-login into user homepage

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
      const cred = await auth.signInWithEmailAndPassword(email, pass);
      const uid = cred.user.uid;

      // -------------------------------------
      // 1) Check if this login is for RIDER
      // -------------------------------------
      const riderRef = await db.collection("riders").doc(email).get();

      if (riderRef.exists) {
        window.location.href = "/rider/index.html";
        return;
      }

      // -------------------------------------
      // 2) Check if this login is for USER
      // -------------------------------------
      const userRef = await db.collection("users").doc(uid).get();

      if (userRef.exists) {
        window.location.href = "/home/index.html";
        return;
      }

      // -------------------------------------
      // 3) If not found in any → create as USER
      // -------------------------------------
      await db.collection("users").doc(uid).set({
        email,
        createdAt: new Date(),
      });

      window.location.href = "/home/index.html";

    } catch (err) {
      showToast(err.message);
    }
  });

})();
