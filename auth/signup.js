// signup.js — SH The Hunger Point

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

setupPasswordToggle(".pass-group:nth-of-type(3)"); // password
setupPasswordToggle(".pass-group:nth-of-type(4)"); // confirm password


/* -------------------------------
   TOAST MESSAGE
-------------------------------- */
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.hidden = false;

  toast.style.opacity = "1";
  toast.style.transform = "translateX(-50%) translateY(0)";

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(10px)";
  }, 2200);

  setTimeout(() => {
    toast.hidden = true;
  }, 2600);
}


/* -------------------------------
   FIREBASE SETUP
-------------------------------- */
const form = document.getElementById("signupForm");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirm = document.getElementById("confirm").value;
  const legal = document.getElementById("legalCheck");

  if (!legal.checked) return showToast("Please accept all terms.");

  if (password !== confirm) return showToast("Passwords do not match.");

  try {
    const userCred = await auth.createUserWithEmailAndPassword(email, password);

    await db.collection("users").doc(userCred.user.uid).set({
      name,
      email,
      createdAt: new Date()
    });

    showToast("Account created successfully!");

    setTimeout(() => {
      window.location.href = "/home/index.html";
    }, 1200);

  } catch (error) {
    showToast(error.message);
  }
});


/* -------------------------------
   GOOGLE SIGN UP
-------------------------------- */
document.getElementById("googleSignup").addEventListener("click", async () => {
  const provider = new firebase.auth.GoogleAuthProvider();

  try {
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
