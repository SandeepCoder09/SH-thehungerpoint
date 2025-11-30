// ======================================
// PROFILE PAGE MAIN SCRIPT
// ======================================

// Wait for Firebase initialization
function waitForFirebase() {
  return new Promise((resolve) => {
    const check = () => {
      if (window.firebase && window.auth && window.db && window.storage) resolve();
      else setTimeout(check, 30);
    };
    check();
  });
}

(async () => {
  await waitForFirebase();

  // Elements
  const avatar = document.getElementById("pfAvatar");
  const nameEl = document.getElementById("name");
  const emailEl = document.getElementById("email");
  const genderEl = document.getElementById("gender");
  const phoneEl = document.getElementById("phone");
  const addressEl = document.getElementById("address");

  const saveBtn = document.getElementById("saveBtn");
  const resetBtn = document.getElementById("resetPassBtn");

  const photoInput = document.getElementById("photoInput");
  const changePhotoBtn = document.getElementById("changePhotoBtn");

  // Crop elements
  const cropModal = document.getElementById("cropModal");
  const cropImage = document.getElementById("cropImage");

  let cropper = null;
  let uploadedFile = null;

  // --------------------------------------
  // AUTH → LOAD USER PROFILE DATA
  // --------------------------------------
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      location.href = "/auth/login.html";
      return;
    }

    emailEl.value = user.email;

    const ref = db.collection("users").doc(user.uid);
    const snap = await ref.get();

    if (snap.exists) {
      const d = snap.data();
      nameEl.value = d.name || "";
      genderEl.value = d.gender || "";
      phoneEl.value = d.phone || "";
      addressEl.value = d.address || "";
      avatar.src = d.photoURL || "/assets/default-user.png";
    }
  });

  // --------------------------------------
  // OPEN FILE PICKER
  // --------------------------------------
  changePhotoBtn.addEventListener("click", () => {
    photoInput.click();
  });

  // --------------------------------------
  // WHEN USER SELECTS IMAGE → Open Cropper
  // --------------------------------------
  photoInput.addEventListener("change", function () {
    const file = this.files[0];
    if (!file) return;

    uploadedFile = file;

    const imageURL = URL.createObjectURL(file);
    cropImage.src = imageURL;

    cropModal.classList.add("show");

    cropImage.onload = () => {
      if (cropper) cropper.destroy();

      cropper = new Cropper(cropImage, {
        aspectRatio: 1,
        viewMode: 1,
        dragMode: "move",
        background: false,
        responsive: true,
        autoCropArea: 1,
      });
    };
  });

  // --------------------------------------
  // CLOSE CROPPER
  // --------------------------------------
  window.closeCropper = () => {
    cropModal.classList.remove("show");
    if (cropper) cropper.destroy();
    cropper = null;
    photoInput.value = "";
  };

  // --------------------------------------
  // SAVE CROPPED IMAGE → Upload to Firebase
  // --------------------------------------
  window.saveCroppedImage = async () => {
    if (!cropper) return;

    const user = auth.currentUser;
    if (!user) return;

    const canvas = cropper.getCroppedCanvas({
      width: 600,
      height: 600,
      imageSmoothingQuality: "high",
    });

    canvas.toBlob(async (blob) => {
      const storageRef = firebase.storage().ref(`profile/${user.uid}.jpg`);

      const uploadTask = storageRef.put(blob);

      // Show upload % on avatar
      avatar.style.opacity = 0.4;

      uploadTask.on(
        "state_changed",
        (snap) => {
          const pct = Math.round(
            (snap.bytesTransferred / snap.totalBytes) * 100
          );
          avatar.title = `Uploading ${pct}%`;
        },
        (err) => {
          alert("Upload failed");
          console.error(err);
        },
        async () => {
          const url = await uploadTask.snapshot.ref.getDownloadURL();

          // Save URL to Firestore
          await db
            .collection("users")
            .doc(user.uid)
            .set(
              {
                photoURL: url,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );

          avatar.src = url;
          avatar.style.opacity = 1;

          closeCropper();
        }
      );
    }, "image/jpeg", 0.9);
  };

  // --------------------------------------
  // SAVE PROFILE BUTTON
  // --------------------------------------
  saveBtn.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) return;

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    await db
      .collection("users")
      .doc(user.uid)
      .set(
        {
          name: nameEl.value.trim(),
          phone: phoneEl.value.trim(),
          gender: genderEl.value,
          address: addressEl.value.trim(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    saveBtn.disabled = false;
    saveBtn.textContent = "Save Profile";
  });

  // --------------------------------------
  // RESET PASSWORD EMAIL
  // --------------------------------------
  resetBtn.addEventListener("click", async () => {
    const email = emailEl.value;
    if (!email) return alert("No email found!");

    await auth.sendPasswordResetEmail(email);
    alert("Reset email sent!");
  });
})();