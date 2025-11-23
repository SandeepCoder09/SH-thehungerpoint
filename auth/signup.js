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

  /* -------------------------------
     FLOATING INPUT LABEL HANDLING
  -------------------------------- */
  document.querySelectorAll(".input-group input").forEach(input => {
    const group = input.parentElement;
    const check = () => {
      if (input.value.trim() !== "") {
        group.classList.add("filled");
      } else {
        group.classList.remove("filled");
      }
    };
    input.addEventListener("input", check);
    check();
  });


  /* -------------------------------
     PASSWORD VISIBILITY TOGGLE
  -------------------------------- */
  function setupPasswordToggle(groupSelector) {
    const group = document.querySelector(groupSelector);
    if (!group) return;

    const input = group.querySelector("input");
    const openIcon = group.querySelector(".eye-open");
    const slashIcon = group.querySelector(".eye-slash");
    const toggleBtn = group.querySelector(".toggle");

    toggleBtn.addEventListener("click", () => {
      const isHidden = input.type === "password";

      input.type = isHidden ? "text" : "password";
      openIcon.classList.toggle("hidden", isHidden);
      slashIcon.classList.toggle("hidden", !isHidden);
    });
  }

  setupPasswordToggle(".pass-group:nth-of-type(3)");
  setupPasswordToggle(".pass-group:nth-of-type(4)");


  /* -------------------------------
     TOAST
  -------------------------------- */
  function showToast(message) {
    const t = document.getElementById("toast");
    t.textContent = message;
    t.hidden = false;
    setTimeout(() => t.hidden = true, 2500);
  }


  /* -------------------------------
     FIREBASE SIGN UP
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
      }, 1000);

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
