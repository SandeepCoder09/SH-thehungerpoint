// signup.js — SH The Hunger Point

// Auto-mark filled inputs
document.querySelectorAll(".input-group input").forEach(input => {
  input.addEventListener("input", () => {
    if (input.value.trim() !== "") {
      input.parentElement.classList.add("filled");
    } else {
      input.parentElement.classList.remove("filled");
    }
  });
});

// Password toggles
function setupToggle(passId, openId, slashId) {
  const pass = document.getElementById(passId);
  const open = document.getElementById(openId);
  const slash = document.getElementById(slashId);

  document.getElementById("toggle" + passId.charAt(0).toUpperCase() + passId.slice(1))
    .addEventListener("click", () => {
      if (pass.type === "password") {
        pass.type = "text";
        open.classList.add("hidden");
        slash.classList.remove("hidden");
      } else {
        pass.type = "password";
        slash.classList.add("hidden");
        open.classList.remove("hidden");
      }
    });
}

setupToggle("password", "eyePassOpen", "eyePassSlash");
setupToggle("confirm", "eyeConfirmOpen", "eyeConfirmSlash");

// Toast
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.hidden = false;
  setTimeout(() => t.hidden = true, 2500);
}

// Firebase auth
const form = document.getElementById("signupForm");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirm = document.getElementById("confirm").value;

  if (!document.getElementById("legalCheck").checked)
    return showToast("Please accept all policies.");

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

// Google signup
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