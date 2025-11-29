// signup.js — SH The Hunger Point (2025 FINAL VERSION)

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

  await waitForFirebase();
  console.log("%cFirebase Ready (signup.js)", "color: green;");

  /* ----------------------------------------------
     FLOATING LABELS + AUTO-FILL FIX
  ---------------------------------------------- */
  function updateFloatingLabels() {
    document.querySelectorAll(".input-group input").forEach(input => {
      const group = input.parentElement;
      input.value.trim() !== ""
        ? group.classList.add("filled")
        : group.classList.remove("filled");
    });
  }

  document.addEventListener("input", updateFloatingLabels);
  window.addEventListener("DOMContentLoaded", updateFloatingLabels);


  /* ----------------------------------------------
     PASSWORD TOGGLE
  ---------------------------------------------- */
  function setupToggle(id) {
    const group = document.getElementById(id);
    if (!group) return;

    const input = group.querySelector("input");
    const openEye = group.querySelector(".eye-open");
    const slashEye = group.querySelector(".eye-slash");
    const btn = group.querySelector(".toggle");

    btn.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      openEye.classList.toggle("hidden", !show);
      slashEye.classList.toggle("hidden", show);
    });
  }

  setupToggle("passwordGroup");
  setupToggle("confirmGroup");


  /* ----------------------------------------------
     TOAST
  ---------------------------------------------- */
  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.hidden = false;
    setTimeout(() => (t.hidden = true), 2600);
  }


  /* ----------------------------------------------
     SIGNUP FORM
  ---------------------------------------------- */
  const form = document.getElementById("signupForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = nameEl.value.trim();
    const email = emailEl.value.trim();
    const pass = passEl.value;
    const confirm = confirmEl.value;
    const terms = legalCheck.checked;

    if (!email.includes("@") || !email.includes(".")) {
      return toast("Enter a valid email address.");
    }

    if (pass.length < 6) {
      return toast("Password must be at least 6 characters.");
    }

    if (pass !== confirm) {
      return toast("Passwords do not match.");
    }

    if (!terms) {
      return toast("Please accept the terms.");
    }

    try {
      const userCred = await auth.createUserWithEmailAndPassword(email, pass);

      await db.collection("users").doc(userCred.user.uid).set({
        name,
        email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      toast("Account created!");
      setTimeout(() => window.location.href = "/home/index.html", 1000);

    } catch (err) {
      console.error(err);
      toast(err.message);
    }
  });


  /* ----------------------------------------------
     GOOGLE SIGNUP
  ---------------------------------------------- */
  document.getElementById("googleSignup").addEventListener("click", async () => {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const res = await auth.signInWithPopup(provider);

      if (res.additionalUserInfo.isNewUser) {
        await db.collection("users").doc(res.user.uid).set({
          name: res.user.displayName,
          email: res.user.email,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      window.location.href = "/home/index.html";

    } catch (err) {
      console.error(err);
      toast(err.message);
    }
  });

})();
