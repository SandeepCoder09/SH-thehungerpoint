// ===============================
// WAIT FOR FIREBASE INITIALIZATION
// ===============================
async function waitForAuth() {
  return new Promise(resolve => {
    const check = () => {
      if (window.auth && window.db) resolve();
      else setTimeout(check, 40);
    };
    check();
  });
}

// ===============================
// SVG ICON DATA
// ===============================
const ICON_EYE = `
<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="#666" viewBox="0 0 24 24">
  <path d="M12 5c-7.633 0-11 6.993-11 7s3.367 7 11 7 11-6.993 11-7-3.367-7-11-7zm0 
  12c-2.761 0-5-2.239-5-5 0-2.762 2.239-5 5-5s5 2.238 5 
  5c0 2.761-2.239 5-5 5zm0-8c-1.654 0-3 1.346-3 
  3 0 1.653 1.346 3 3 3s3-1.347 3-3c0-1.654-1.346-3-3-3z"/>
</svg>`;

const ICON_EYE_OFF = `
<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="#d10000" viewBox="0 0 24 24">
  <path d="M1.707 3.293l19 19-1.414 1.414-3.249-3.249C14.856 
  21.145 13.469 21.5 12 21.5c-7.633 0-11-6.993-11-7 
  0-.591 1.454-3.626 4.727-5.727L.293 4.707 
  1.707 3.293zM12 7.5c-1.139 0-2.2.394-3.036 1.053l7.483 
  7.483C17.606 14.2 18 13.139 18 12c0-2.761-2.239-5-5-5z"/>
</svg>`;

// ===============================
// SHOW TOAST
// ===============================
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.hidden = false;
  setTimeout(() => t.hidden = true, 2500);
}

// ===============================
// TOGGLE PASSWORD VISIBILITY
// ===============================
function setupToggle(inputId, iconId, toggleWrapperId) {
  const input = document.getElementById(inputId);
  const wrapper = document.getElementById(toggleWrapperId);

  wrapper.addEventListener("click", () => {
    if (input.type === "password") {
      input.type = "text";
      wrapper.innerHTML = ICON_EYE_OFF;
      wrapper.classList.add("active");
    } else {
      input.type = "password";
      wrapper.innerHTML = ICON_EYE;
      wrapper.classList.remove("active");
    }
  });
}

// ===============================
// MAIN SIGNUP FLOW
// ===============================
(async () => {
  await waitForAuth();

  const form = document.getElementById("signupForm");
  const googleBtn = document.getElementById("googleSignup");

  // Setup password toggles
  setupToggle("password", "icon-pass", "togglePass");
  setupToggle("confirm", "icon-confirm", "toggleConfirm");

  // ===============================
  // SUBMIT FORM
  // ===============================
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const pass = password.value;
    const confirmPass = confirmPassword.value;
    const legal = legalCheck.checked;

    if (!legal) return showToast("Please accept all legal policies.");
    if (pass !== confirmPass) return showToast("Passwords do not match.");

    try {
      const userCred = await auth.createUserWithEmailAndPassword(email, pass);

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

  // ===============================
  // GOOGLE SIGNUP
  // ===============================
  googleBtn.addEventListener("click", async () => {
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

      window.location.href = "/home/index.html";

    } catch (err) {
      showToast(err.message);
    }
  });

})();