// -----------------------------------------------------------
// PROFILE PAGE — SH AUTH + FIRESTORE LIVE SYNC + CROP UPLOAD
// -----------------------------------------------------------

import {
  doc,
  onSnapshot,
  updateDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

document.addEventListener("sh:user-ready", (e) => {
  const user = e.detail;
  if (!user) return (window.location.href = "/auth/login.html");

  const db = window.SHAuth.db;
  const auth = window.SHAuth.auth;
  const storage = getStorage();

  const uid = user.uid;
  const userRef = doc(db, "users", uid);

  // DOM
  const pfAvatar = document.getElementById("pfAvatar");
  const displayName = document.getElementById("displayName");
  const displayEmail = document.getElementById("displayEmail");

  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const genderSelect = document.getElementById("gender");
  const phoneInput = document.getElementById("phone");
  const addressInput = document.getElementById("address");

  const saveBtn = document.getElementById("saveBtn");
  const resetPassBtn = document.getElementById("resetPassBtn");

  const photoInput = document.getElementById("photoInput");
  const changePhotoBtn = document.getElementById("changePhotoBtn");

  // Toast
  function toast(msg) {
    const c = document.getElementById("toast-container");
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => el.classList.add("show"), 30);
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 200);
    }, 2200);
  }

  // PRE-FILL EMAIL
  emailInput.value = user.email;
  displayEmail.textContent = user.email;

  // ------------------------------------------------
  // 📌 LIVE SYNC — AUTO LOAD PROFILE DATA
  // ------------------------------------------------
  onSnapshot(userRef, (snap) => {
    if (!snap.exists()) return;

    const data = snap.data();

    nameInput.value = data.name || "";
    genderSelect.value = data.gender || "";
    phoneInput.value = data.phone || "";
    addressInput.value = data.address || "";

    displayName.textContent = data.name || "Your name";
    pfAvatar.src = data.photoURL || "/home/SH-Favicon.png";
  });

  // ------------------------------------------------
  // 📌 PHOTO UPLOAD + CROPPER (same as before)
  // ------------------------------------------------
  let cropper = null;
  let croppedBlob = null;

  changePhotoBtn.onclick = () => photoInput.click();

  photoInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById("cropImage").src = URL.createObjectURL(file);
    openCropper();
  };

  function openCropper() {
    const modal = document.getElementById("cropModal");
    modal.style.display = "flex";

    if (cropper) cropper.destroy();

    cropper = new Cropper(document.getElementById("cropImage"), {
      aspectRatio: 1,
      viewMode: 1,
      autoCropArea: 1
    });
  }

  document.getElementById("cancelCrop").onclick = closeCropper;
  function closeCropper() {
    document.getElementById("cropModal").style.display = "none";
    if (cropper) cropper.destroy();
    cropper = null;
    croppedBlob = null;
    photoInput.value = "";
  }

  document.getElementById("saveCropped").onclick = () => {
    if (!cropper) return;
    cropper.getCroppedCanvas().toBlob((blob) => {
      croppedBlob = blob;
      pfAvatar.src = URL.createObjectURL(blob);
      closeCropper();
    }, "image/jpeg", 0.85);
  };

  // ------------------------------------------------
  // 📌 SAVE PROFILE
  // ------------------------------------------------
  saveBtn.onclick = async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
      let photoURL = null;

      if (croppedBlob) {
        const fileRef = ref(storage, `profiles/${uid}/${Date.now()}.jpg`);
        const uploadTask = uploadBytesResumable(fileRef, croppedBlob);

        uploadTask.on("state_changed", null, null, async () => {
          photoURL = await getDownloadURL(uploadTask.snapshot.ref);

          await updateDoc(userRef, { photoURL });
        });
      }

      await updateDoc(userRef, {
        name: nameInput.value.trim(),
        gender: genderSelect.value,
        phone: phoneInput.value.trim(),
        address: addressInput.value.trim(),
        ...(photoURL && { photoURL })
      });

      toast("Saved!");
    } catch (e) {
      toast("Save error");
    }

    saveBtn.disabled = false;
    saveBtn.textContent = "Save Profile";
  };

  // ------------------------------------------------
  // 📌 PASSWORD RESET
  // ------------------------------------------------
  resetPassBtn.onclick = async () => {
    try {
      await auth.sendPasswordResetEmail(user.email);
      toast("Password reset sent");
    } catch {
      toast("Error sending email");
    }
  };
});