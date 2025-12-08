// /profile/profile.js
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  onSnapshot,
  updateDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  ref,
  uploadBytesResumable,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Wait for auth
document.addEventListener("sh-user-ready", async ({ detail: user }) => {
  const auth = window.auth;
  const db = window.db;
  const storage = window.storage;

  // DOM
  const pfAvatar = document.getElementById("pfAvatar");
  const displayName = document.getElementById("displayName");
  const displayEmail = document.getElementById("displayEmail");

  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const genderInput = document.getElementById("gender");
  const phoneInput = document.getElementById("phone");
  const addressInput = document.getElementById("address");

  const saveBtn = document.getElementById("saveBtn");
  const resetBtn = document.getElementById("resetPassBtn");

  const cropModal = document.getElementById("cropModal");
  const cropImage = document.getElementById("cropImage");
  const photoInput = document.getElementById("photoInput");
  const changePhotoBtn = document.getElementById("changePhotoBtn");

  let cropper = null;
  let croppedBlob = null;

  // -----------------------------------------
  // LOAD USER SNAPSHOT
  // -----------------------------------------
  const userDocRef = doc(db, "users", user.uid);

  onSnapshot(userDocRef, (snap) => {
    if (!snap.exists()) return;

    const data = snap.data();

    nameInput.value = data.name || "";
    genderInput.value = data.gender || "";
    phoneInput.value = data.phone || "";
    addressInput.value = data.address || "";

    displayName.textContent = data.name || "Your name";
    displayEmail.textContent = user.email;
    emailInput.value = user.email;

    pfAvatar.src = data.photoURL || "/home/SH-Favicon.png";
  });

  // -----------------------------------------
  // PHOTO UPLOAD + CROPPER
  -----------------------------------------
  changePhotoBtn.onclick = () => photoInput.click();

  photoInput.onchange = () => {
    const file = photoInput.files[0];
    if (!file) return;

    cropImage.src = URL.createObjectURL(file);
    cropModal.style.display = "flex";

    if (cropper) cropper.destroy();
    cropper = new Cropper(cropImage, {
      aspectRatio: 1,
      autoCropArea: 1,
      viewMode: 1,
    });
  };

  document.getElementById("cancelCrop").onclick = () => {
    cropModal.style.display = "none";
    if (cropper) cropper.destroy();
  };

  document.getElementById("saveCropped").onclick = () => {
    cropper.getCroppedCanvas({
      width: 700,
      height: 700
    }).toBlob((blob) => {
      croppedBlob = blob;
      pfAvatar.src = URL.createObjectURL(blob);
      cropModal.style.display = "none";
      cropper.destroy();
    });
  };

  // -----------------------------------------
  // SAVE PROFILE
  // -----------------------------------------
  saveBtn.onclick = async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    let photoURL = null;

    // Upload new photo if needed
    if (croppedBlob) {
      const filePath = `profiles/${user.uid}/${Date.now()}.jpg`;
      const storageRef = ref(storage, filePath);

      const uploadTask = uploadBytesResumable(storageRef, croppedBlob);

      await new Promise((resolve, reject) => {
        uploadTask.on("state_changed", null, reject, async () => {
          photoURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve();
        });
      });
    }

    const updateData = {
      name: nameInput.value,
      gender: genderInput.value,
      phone: phoneInput.value,
      address: addressInput.value
    };

    if (photoURL) updateData.photoURL = photoURL;

    await updateDoc(userDocRef, updateData);

    if (updateData.name || updateData.photoURL) {
      await updateProfile(user, {
        displayName: updateData.name || user.displayName,
        photoURL: updateData.photoURL || user.photoURL
      });
    }

    croppedBlob = null;
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Profile";

    alert("Profile updated!");
  };

  // -----------------------------------------
  // PASSWORD RESET
  // -----------------------------------------
  resetBtn.onclick = async () => {
    await sendPasswordResetEmail(auth, user.email);
    alert("Password reset email sent!");
  };

});