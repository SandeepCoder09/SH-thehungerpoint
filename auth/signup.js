// signup.js — SH The Hunger Point (FULLY FIXED)

// ------------------------------
// WAIT FOR FIREBASE TO INITIALIZE
// ------------------------------
async function waitForAuth() {
  return new Promise(resolve => {
    const check = () => {
      if (window.auth && window.db) {
        console.log("Firebase Ready:", window.auth);
        resolve();
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  });
}

(async () => {
  console.log("Waiting for Firebase...");
  await waitForAuth();
  console.log("Firebase Loaded ✔");


  // ------------------------------
  // FLOATING LABEL INPUTS
  // ------------------------------
  document.querySelectorAll(".input-group input").forEach(input => {
    const group = input.parentElement;

    const update = () => {
      if (input.value.trim() !== "") {
        group.classList.add("filled");
      } else {
        group.classList.remove("filled");
      }
    };

    input.addEventListener("input", update);
    update();
  });


  // ------------------------------
  // PASSWORD TOGGLE
  // ------------------------------
  function setupPasswordToggle(groupSelector) {
    const group = document.querySelector(groupSelector);
    if (!group) return;

    const input = group.querySelector("input");
    const openIcon = group.querySelector(".eye-open");
    const slashIcon = group.querySelector(".eye-slash");
    const toggleBtn = group.querySelector(".toggle");

    toggleBtn.addEventListener("click", () => {
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";

      openIcon.classList.toggle("hidden", !showing);
      slashIcon.classList.toggle("hidden", showing);
    });
  }

  setupPasswordToggle(".pass-group:nth-of-type(3)");
  setupPasswordToggle(".pass-group:nth-of-type(4)");


  // ------------------------------
  // TOAST MESSAGE
  // ------------------------------
  function showToast(message) {
    const t = document.getElementById("toast");
    t.textContent = message;
    t.hidden = false;
    setTimeout(() => t.hidden = true, 2500);
  }


  // ------------------------------
  // EMAIL + PASSWORD SIGNUP
  // ------------------------------
  const form = document.getElementById("signupForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirm = document.getElementById("confirm").value;

    if (!document.getElementById("legalCheck").checked) {
      return showToast("Please accept all terms.");
    }

    if (password !== confirm) {
      return showToast("Passwords do not match.");
    }

    try {
      console.log("Creating user...");
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
      console.error("Signup Error:", err);
      showToast(err.message);
    }
  });


  // ------------------------------
  // GOOGLE SIGNUP
  // ------------------------------
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
      console.error("Google Signup Error:", err);
      showToast(err.message);
    }
  });

})();
