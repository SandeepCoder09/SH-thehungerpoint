// Wait until Firebase config loads fully
async function waitForFirebase() {
  return new Promise(resolve => {
    const check = () => {
      if (window.auth && window.db) resolve();
      else setTimeout(check, 50);
    };
    check();
  });
}

(async () => {
  // Wait until firebase-config.js loads auth + db
  await waitForFirebase();

  console.log("Firebase ready:", auth, db);

  /* -------------------------------
     FLOATING INPUT LABEL HANDLING
  -------------------------------- */
  document.querySelectorAll(".input-group input").forEach(input => {
    const group = input.parentElement;

    function update() {
      if (input.value.trim() !== "") {
        group.classList.add("filled");
      } else {
        group.classList.remove("filled");
      }
    }

    input.addEventListener("input", update);
    update();
  });

  /* -------------------------------
     PASSWORD VISIBILITY TOGGLE
  -------------------------------- */
  function setupToggle(inputId, toggleId) {
    const input = document.getElementById(inputId);
    const toggle = document.getElementById(toggleId);
    const openIcon = toggle.querySelector(".eye-open");
    const slashIcon = toggle.querySelector(".eye-slash");

    toggle.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      openIcon.classList.toggle("hidden", show);
      slashIcon.classList.toggle("hidden", !show);
    });
  }

  setupToggle("password", "togglePass");
  setupToggle("confirm", "toggleConfirm");

  /* -------------------------------
     TOAST SYSTEM
  -------------------------------- */
  function showToast(message) {
    const t = document.getElementById("toast");
    t.textContent = message;
    t.hidden = false;
    setTimeout(() => (t.hidden = true), 2500);
  }

  /* -------------------------------
     SIGNUP WITH EMAIL
  -------------------------------- */
  const form = document.getElementById("signupForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirm = document.getElementById("confirm").value;

    if (!document.getElementById("legalCheck").checked)
      return showToast("Please accept all terms.");

    if (password !== confirm)
      return showToast("Passwords do not match.");

    try {
      const userCred = await auth.createUserWithEmailAndPassword(email, password);

      await db.collection("users").doc(userCred.user.uid).set({
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

  /* -------------------------------
     GOOGLE SIGNUP
  -------------------------------- */
  document.getElementById("googleSignup").addEventListener("click", async () => {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const res = await auth.signInWithPopup(provider);

      if (res.additionalUserInfo.isNewUser) {
        await db.collection("users").doc(res.user.uid).set({
          name: res.user.displayName,
          email: res.user.email,
          createdAt: new Date()
        });
      }

      window.location.href = "/home/index.html";

    } catch (err) {
      showToast(err.message);
    }
  });
})();
