/* PROFILE PAGE — Uses SHAuth to load user + Firestore */

(function () {

  const pfAvatar = document.getElementById('pfAvatar');
  const changePhotoBtn = document.getElementById('changePhotoBtn');
  const photoInput = document.getElementById('photoInput');

  const cropModal = document.getElementById('cropModal');
  const cropImage = document.getElementById('cropImage');
  const cancelCrop = document.getElementById('cancelCrop');
  const saveCropped = document.getElementById('saveCropped');

  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const genderSelect = document.getElementById('gender');
  const phoneInput = document.getElementById('phone');
  const addressInput = document.getElementById('address');

  const displayName = document.getElementById('displayName');
  const displayEmail = document.getElementById('displayEmail');

  const saveBtn = document.getElementById('saveBtn');
  const resetPassBtn = document.getElementById('resetPassBtn');

  let croppedBlob = null;
  let cropper = null;

  // Load UI when SHAuth.userData arrives
  document.addEventListener("shauth-ready", () => {
    const u = SHAuth.user;
    const d = SHAuth.userData || {};

    emailInput.value = u.email;
    displayEmail.textContent = u.email;

    nameInput.value = d.name || "";
    genderSelect.value = d.gender || "";
    phoneInput.value = d.phone || "";
    addressInput.value = d.address || "";

    pfAvatar.src = d.photoURL || "/home/SH-Favicon.png";
    displayName.textContent = d.name || "Your name";
  });

  // CROPPER
  changePhotoBtn.addEventListener("click", () => photoInput.click());
  photoInput.addEventListener("change", (e) => {
    if (!e.target.files.length) return;
    cropImage.src = URL.createObjectURL(e.target.files[0]);

    cropModal.style.display = "flex";
    cropper = new Cropper(cropImage, { aspectRatio: 1, viewMode: 1 });
  });

  cancelCrop.onclick = () => closeCropper();

  function closeCropper() {
    cropModal.style.display = "none";
    if (cropper) cropper.destroy();
    cropper = null;
    croppedBlob = null;
  }

  saveCropped.onclick = () => {
    if (!cropper) return;

    cropper.getCroppedCanvas({ width: 600 }).toBlob((blob) => {
      croppedBlob = blob;
      pfAvatar.src = URL.createObjectURL(blob);
      closeCropper();
    });
  };

  // SAVE PROFILE
  saveBtn.onclick = async () => {
    const u = SHAuth.user;
    const ref = firebase.firestore().collection("users").doc(u.uid);

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    let photoURL = SHAuth.userData?.photoURL || null;

    // Upload new photo if selected
    if (croppedBlob) {
      const storageRef = firebase.storage().ref(`profiles/${u.uid}/${Date.now()}.jpg`);
      const uploadTask = storageRef.put(croppedBlob);
      await uploadTask;
      photoURL = await storageRef.getDownloadURL();
    }

    // Update Firestore
    const updated = {
      name: nameInput.value.trim(),
      gender: genderSelect.value,
      phone: phoneInput.value.trim(),
      address: addressInput.value.trim(),
      photoURL
    };

    await ref.set(updated, { merge: true });

    // Update Firebase Auth
    await u.updateProfile({
      displayName: updated.name,
      photoURL
    });

    saveBtn.disabled = false;
    saveBtn.textContent = "Save Profile";

    alert("Profile saved!");
  };

  resetPassBtn.onclick = async () => {
    await firebase.auth().sendPasswordResetEmail(SHAuth.user.email);
    alert("Password reset email sent!");
  };

})();