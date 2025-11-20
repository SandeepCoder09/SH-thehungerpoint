// Wait until Firebase config loads
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
    setTimeout(() => (toast.hidden = true), 2500);
  }

  // Eye Toggle Setup
  function setupToggle(fieldId, openId, closeId) {
    const field = document.getElementById(fieldId);
    const open = document.getElementById(openId);
    const close = document.getElementById(closeId);

    open.onclick = () => {
      field.type = "text";
      open.classList.add("hide");
      close.classList.remove("hide");
    };

    close.onclick = () => {
      field.type = "password";
      close.classList.add("hide");
      open.classList.remove("hide");
    };
  }

  setupToggle("password", "eyeOpen", "eyeClose");
  setupToggle("confirm", "eyeOpen2", "eyeClose2");

  // SUBMIT FORM
  form.addEventListener("submit", async e => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const pass = document.getElementById("password").value;
    const confirm = document.getElementById("confirm").value;
    const legal = document.getElementById("legalCheck").checked;

    if (!legal) return showToast("You must accept all legal policies.");
    if (pass !== confirm) return showToast("Passwords do not match.");

    try {
      const userCred = await auth.createUserWithEmailAndPassword(email, pass);

      await db.collection("users").doc(userCred.user.uid).set({
        name,
        email,
        createdAt: new Date()
      });

      showToast("Account created successfully!");

      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "/home/index.html";

      setTimeout(() => (window.location.href = next), 700);

    } catch (err) {
      showToast(err.message);
    }
  });

  // GOOGLE SIGNUP
  googleBtn.onclick = async () => {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const userCred = await auth.signInWithPopup(provider);

      if (userCred.additionalUserInfo.isNewUser) {
        await db.collection("users").doc(userCred.user.uid).set({
          name: userCred.user.displayName,
          email: userCred.user.email,
          createdAt: new Date()
        });
      }

      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "/home/index.html";

      window.location.href = next;

    } catch (err) {
      showToast(err.message);
    }
  };
})();
