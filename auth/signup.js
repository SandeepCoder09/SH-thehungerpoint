// Wait for Firebase config to initialize
async function waitForAuth() {
  return new Promise(resolve => {
    const check = () => {
      if (window.auth) resolve();
      else setTimeout(check, 40);
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
    setTimeout(() => toast.hidden = true, 2600);
  }

  // Eye toggle function
  function togglePassword(inputId, openId, closeId) {
    const input = document.getElementById(inputId);
    const open = document.getElementById(openId);
    const close = document.getElementById(closeId);

    open.addEventListener("click", () => {
      input.type = "text";
      open.classList.add("hide");
      close.classList.remove("hide");
    });

    close.addEventListener("click", () => {
      input.type = "password";
      close.classList.add("hide");
      open.classList.remove("hide");
    });
  }

  togglePassword("password", "eyeOpen", "eyeClose");
  togglePassword("confirm", "eyeOpen2", "eyeClose2");

  // Submit Signup
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const pass = document.getElementById("password").value;
    const confirm = document.getElementById("confirm").value;
    const legal = document.getElementById("legalCheck").checked;

    if (!legal) return showToast("You must accept all policies.");
    if (pass !== confirm) return showToast("Passwords do not match.");

    try {
      const user = await auth.createUserWithEmailAndPassword(email, pass);

      await db.collection("users").doc(user.user.uid).set({
        name,
        email,
        createdAt: new Date()
      });

      showToast("Account created successfully!");

      setTimeout(() => {
        window.location.href = "/home/index.html";
      }, 900);

    } catch (err) {
      showToast(err.message);
    }
  });

  // GOOGLE Signup
  googleBtn.addEventListener("click", async () => {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await auth.signInWithPopup(provider);

      if (result.additionalUserInfo.isNewUser) {
        await db.collection("users").doc(result.user.uid).set({
          name: result.user.displayName,
          email: result.user.email,
          createdAt: new Date()
        });
      }

      window.location.href = "/home/index.html";

    } catch (err) {
      showToast(err.message);
    }
  });

})();
