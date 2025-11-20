async function showToast(msg) {
  const t = document.getElementById("toast");
  t.innerText = msg;
  t.hidden = false;
  setTimeout(() => t.hidden = true, 3000);
}

// Eye toggles
function setupToggle(passId, openId, closeId) {
  const pass = document.getElementById(passId);
  const open = document.getElementById(openId);
  const close = document.getElementById(closeId);

  open.onclick = () => {
    pass.type = "text";
    open.classList.add("hide");
    close.classList.remove("hide");
  };

  close.onclick = () => {
    pass.type = "password";
    close.classList.add("hide");
    open.classList.remove("hide");
  };
}

setupToggle("password", "eyeOpen", "eyeClose");
setupToggle("confirm", "eyeOpen2", "eyeClose2");

document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const pass = document.getElementById("password").value;
  const confirm = document.getElementById("confirm").value;
  const legal = document.getElementById("legalCheck").checked;

  if (pass !== confirm)
    return showToast("Passwords do not match");

  if (!legal)
    return showToast("You must accept all legal conditions");

  try {
    const userCred = await firebase.auth().createUserWithEmailAndPassword(email, pass);
    await firebase.firestore().collection("users").doc(userCred.user.uid).set({
      name,
      email,
      createdAt: Date.now()
    });

    showToast("Account created! Redirecting...");
    setTimeout(() => {
      window.location.href = "../home/index.html";
    }, 1200);

  } catch (err) {
    showToast(err.message);
  }
});

// Google Signup
document.getElementById("googleSignup").addEventListener("click", async () => {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await firebase.auth().signInWithPopup(provider);
    window.location.href = "../home/index.html";
  } catch (err) {
    showToast(err.message);
  }
});