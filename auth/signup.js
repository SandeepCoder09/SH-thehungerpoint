// signup.js

const $ = (s) => document.querySelector(s);
const toast = $("#toast");

function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  setTimeout(() => (toast.hidden = true), 3000);
}

async function createUserProfile(user, name) {
  await db.collection("users").doc(user.uid).set({
    uid: user.uid,
    name: name,
    email: user.email,
    provider: "password",
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
  });
}

document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = $("#name").value.trim();
  const email = $("#email").value.trim();
  const password = $("#password").value;
  const confirm = $("#confirm").value;

  if (password !== confirm) {
    showToast("Passwords do not match");
    return;
  }

  try {
    const result = await auth.createUserWithEmailAndPassword(email, password);

    await result.user.updateProfile({ displayName: name });

    await createUserProfile(result.user, name);

    showToast("Account created! Redirecting...");
    setTimeout(() => (window.location = "/"), 1300);

  } catch (err) {
    showToast(err.message);
  }
});

// Google Signup
document.getElementById("googleSignup").addEventListener("click", async () => {
  const provider = new firebase.auth.GoogleAuthProvider();

  try {
    const result = await auth.signInWithPopup(provider);

    await db.collection("users").doc(result.user.uid).set({
      uid: result.user.uid,
      name: result.user.displayName,
      email: result.user.email,
      provider: "google",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    showToast("Welcome!");
    setTimeout(() => (window.location = "/"), 1000);

  } catch (err) {
    showToast(err.message);
  }
});