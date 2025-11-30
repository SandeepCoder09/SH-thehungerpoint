// profile/profile.js
// Modern user profile (for USERS only, includes gender field)

async function waitForFirebase() {
  return new Promise(resolve => {
    const check = () => {
      if (window.firebase && window.auth && window.db) resolve();
      else setTimeout(check, 30);
    };
    check();
  });
}

(function () {
  // run on load after firebase scripts + config
  document.addEventListener("DOMContentLoaded", async () => {
    await waitForFirebase();

    // Elements
    const nameEl = document.getElementById("name");
    const emailEl = document.getElementById("email");
    const phoneEl = document.getElementById("phone");
    const addressEl = document.getElementById("address");
    const genderEl = document.getElementById("gender");

    const photoImg = document.getElementById("photoImg");
    const photoInput = document.getElementById("photoInput");
    const changePhotoBtn = document.getElementById("changePhotoBtn");
    const removePhotoBtn = document.getElementById("removePhotoBtn");

    const saveBtn = document.getElementById("saveBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const resetBtn = document.getElementById("resetPassBtn");

    const toast = document.getElementById("toast");

    function showToast(msg) {
      toast.textContent = msg;
      toast.hidden = false;
      toast.style.opacity = "1";
      setTimeout(() => {
        try { toast.hidden = true } catch (e) {}
      }, 2500);
    }

    // Protect.js should redirect if not authenticated, but also guard here:
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = "/auth/login.html";
        return;
      }

      emailEl.value = user.email || "";

      const userRef = db.collection("users").doc(user.uid);
      try {
        const snap = await userRef.get();
        if (!snap.exists) {
          // create an initial simple profile for USERS
          await userRef.set({
            name: user.displayName || "",
            email: user.email || "",
            phone: "",
            address: "",
            gender: "",
            photoURL: "",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          // reload document after creation
          const newSnap = await userRef.get();
          dataToUI(newSnap.data());
          return;
        }
        dataToUI(snap.data());
      } catch (err) {
        console.error("Error fetching profile:", err);
        showToast("Failed to load profile");
      }
    });

    function dataToUI(data = {}) {
      nameEl.value = data.name || "";
      phoneEl.value = data.phone || "";
      addressEl.value = data.address || "";
      genderEl.value = data.gender || "";
      if (data.photoURL) photoImg.src = data.photoURL;
      else photoImg.src = "/profile/default-user.png";
    }

    // Photo change flow
    changePhotoBtn.addEventListener("click", () => photoInput.click());

    photoInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const user = auth.currentUser;
      if (!user) return showToast("Not authenticated");

      const storageRef = firebase.storage().ref(`users/${user.uid}/profile.jpg`);
      try {
        const uploadTask = await storageRef.put(file);
        const url = await storageRef.getDownloadURL();
        photoImg.src = url;

        await db.collection("users").doc(user.uid).set({
          photoURL: url,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        showToast("Photo updated");
      } catch (err) {
        console.error("Upload failed", err);
        showToast("Photo upload failed");
      }
    });

    removePhotoBtn.addEventListener("click", async () => {
      const user = auth.currentUser;
      if (!user) return showToast("Not authenticated");

      // Remove from storage (best-effort) and clear URL in Firestore
      try {
        const storageRef = firebase.storage().ref(`users/${user.uid}/profile.jpg`);
        // try delete; ignore errors (may not exist)
        await storageRef.delete().catch(() => { /* ignore */ });

        await db.collection("users").doc(user.uid).set({
          photoURL: "",
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        photoImg.src = "/profile/default-user.png";
        showToast("Photo removed");
      } catch (err) {
        console.error("Remove failed", err);
        showToast("Could not remove photo");
      }
    });

    // Save profile
    saveBtn.addEventListener("click", async () => {
      const user = auth.currentUser;
      if (!user) return showToast("Not authenticated");

      const payload = {
        name: nameEl.value.trim(),
        phone: phoneEl.value.trim(),
        address: addressEl.value.trim(),
        gender: genderEl.value || "",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      try {
        await db.collection("users").doc(user.uid).set(payload, { merge: true });
        showToast("Profile saved");
      } catch (err) {
        console.error("Save failed", err);
        showToast("Failed to save");
      }
    });

    // Reset password
    resetBtn.addEventListener("click", async () => {
      const email = emailEl.value;
      if (!email) return showToast("No email available");
      try {
        await auth.sendPasswordResetEmail(email);
        showToast("Reset email sent");
      } catch (err) {
        console.error(err);
        showToast("Failed to send reset email");
      }
    });

    // Logout
    logoutBtn.addEventListener("click", async () => {
      try {
        await auth.signOut();
        window.location.href = "/auth/login.html";
      } catch (err) {
        console.error("Sign-out error", err);
        showToast("Logout failed");
      }
    });

  }); // DOMContentLoaded
})();