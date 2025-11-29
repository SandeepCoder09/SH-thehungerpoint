// FINAL FIXED profile.js

// Wait for Firebase Auth & Firestore to be ready
async function waitForFirebase() {
  return new Promise(resolve => {
    const check = () => {
      if (window.firebase && window.auth && window.db) resolve();
      else setTimeout(check, 30);
    };
    check();
  });
}

(async () => {
  await waitForFirebase();

  const nameEl = document.getElementById("name");
  const emailEl = document.getElementById("email");
  const phoneEl = document.getElementById("phone");
  const addressEl = document.getElementById("address");
  const photoImg = document.getElementById("photoImg");
  const photoInput = document.getElementById("photoInput");

  const saveBtn = document.getElementById("saveBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const resetBtn = document.getElementById("resetPassBtn");
  const changePhotoBtn = document.getElementById("changePhotoBtn");

  const toast = document.getElementById("toast");

  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    setTimeout(() => toast.hidden = true, 2500);
  }

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      console.log("No user → Redirecting");
      window.location.href = "/auth/login.html";
      return;
    }

    console.log("User detected:", user.email);

    emailEl.value = user.email;

    const userRef = db.collection("users").doc(user.uid);
    const snap = await userRef.get();

    // If Firestore doc doesn't exist → create it
    if (!snap.exists) {
      console.log("Creating empty profile");
      await userRef.set({
        name: user.displayName || "",
        email: user.email,
        phone: "",
        address: "",
        photoURL: "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    // Load Firestore data
    const data = snap.data();
    console.log("Loaded Firestore data:", data);

    nameEl.value = data.name || "";
    phoneEl.value = data.phone || "";
    addressEl.value = data.address || "";
    if (data.photoURL) photoImg.src = data.photoURL;
  });

  // Change photo
  changePhotoBtn.addEventListener("click", () => photoInput.click());

  photoInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const user = auth.currentUser;

    const storageRef = firebase.storage().ref(`users/${user.uid}/profile.jpg`);
    await storageRef.put(file);
    const url = await storageRef.getDownloadURL();

    photoImg.src = url;

    await db.collection("users").doc(user.uid).update({
      photoURL: url,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showToast("Photo updated!");
  });

  // Save button
  saveBtn.addEventListener("click", async () => {
    const user = auth.currentUser;

    await db.collection("users").doc(user.uid).set({
      name: nameEl.value.trim(),
      phone: phoneEl.value.trim(),
      address: addressEl.value.trim(),
      photoURL: photoImg.src,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    showToast("Profile saved!");
  });

  // Reset password
  resetBtn.addEventListener("click", async () => {
    await auth.sendPasswordResetEmail(emailEl.value);
    showToast("Reset email sent");
  });

  // Logout
  logoutBtn.addEventListener("click", async () => {
    await auth.signOut();
    window.location.href = "/auth/login.html";
  });

})();
