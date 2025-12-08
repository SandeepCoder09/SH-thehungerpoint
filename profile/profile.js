// /profile/profile.js
// Modular profile logic — uses /auth/sh-auth.js (modular Firebase v10).
// Expects CropperJS already loaded on the page (you include the CDN).

import { auth, db, storage, requireUser } from "/auth/sh-auth.js";
import {
  doc,
  onSnapshot,
  setDoc,
  getDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// DOM
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
const backBtn = document.getElementById('backBtn');

const progressWrap = document.getElementById('progressWrap');
const uploadProgress = document.getElementById('uploadProgress');
const progressText = document.getElementById('progressText');

function toast(msg, dur = 2500) {
  const container = document.getElementById("toast-container");
  if (!container) {
    console.log("toast:", msg);
    return;
  }
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.classList.add("show"), 20);
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 220);
  }, dur);
}

let cropper = null;
let croppedBlob = null;
let userDocUnsub = null;
let userDocRef = null;
let currentUser = null;

function openCropper() {
  cropModal.style.display = "flex";
  cropModal.setAttribute("aria-hidden", "false");
  if (cropper) cropper.destroy();
  cropper = new Cropper(cropImage, {
    aspectRatio: 1,
    viewMode: 1,
    autoCropArea: 1,
    background: false,
    movable: true,
    zoomable: true,
    responsive: true
  });
}

function closeCropper() {
  cropModal.style.display = "none";
  cropModal.setAttribute("aria-hidden", "true");
  if (cropper) cropper.destroy();
  cropper = null;
  if (cropImage.src && cropImage.src.startsWith("blob:")) URL.revokeObjectURL(cropImage.src);
  croppedBlob = null;
  photoInput.value = "";
}

// file select -> open cropper
changePhotoBtn?.addEventListener("click", () => photoInput.click());
photoInput?.addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  cropImage.src = URL.createObjectURL(f);
  openCropper();
});
cancelCrop?.addEventListener("click", closeCropper);

saveCropped?.addEventListener("click", () => {
  if (!cropper) return;
  const canvas = cropper.getCroppedCanvas({ width: 600, height: 600, imageSmoothingQuality: "high" });
  canvas.toBlob((blob) => {
    if (!blob) return toast("Failed to crop image");
    croppedBlob = blob;
    pfAvatar.src = URL.createObjectURL(blob);
    closeCropper();
  }, "image/jpeg", 0.85);
});

// Wait for logged in user then wire everything
requireUser(async (user) => {
  if (!user) {
    // requireUser will redirect to login — keep defensive
    return;
  }

  currentUser = user;
  const uid = user.uid;

  // set basic email fields
  emailInput.value = user.email || "";
  displayEmail.textContent = user.email || "";

  // firestore doc ref
  userDocRef = doc(db, "users", uid);

  // live snapshot
  try {
    if (userDocUnsub) userDocUnsub();
  } catch {}
  userDocUnsub = onSnapshot(userDocRef, (snap) => {
    if (!snap.exists()) {
      // ensure some UI defaults
      nameInput.value = user.displayName || "";
      displayName.textContent = user.displayName || "Your name";
      pfAvatar.src = user.photoURL || "/home/SH-Favicon.png";
      return;
    }
    const data = snap.data() || {};
    nameInput.value = data.name || user.displayName || "";
    genderSelect.value = data.gender || "";
    phoneInput.value = data.phone || "";
    addressInput.value = data.address || "";

    displayName.textContent = data.name || user.displayName || "Your name";
    displayEmail.textContent = user.email || "";
    if (data.photoURL) pfAvatar.src = data.photoURL;
    else pfAvatar.src = user.photoURL || "/home/SH-Favicon.png";
  }, (err) => {
    console.error("user doc snapshot error:", err);
  });

  // save handler
  saveBtn?.addEventListener("click", async () => {
    if (!currentUser) return toast("User not logged in");

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
      let photoURL = null;

      if (croppedBlob) {
        progressWrap.classList.remove("hidden");
        uploadProgress.value = 0;
        progressText.textContent = "Uploading: 0%";

        const path = `profiles/${uid}/${Date.now()}.jpg`;
        const r = storageRef(storage, path);
        const uploadTask = uploadBytesResumable(r, croppedBlob);

        await new Promise((resolve, reject) => {
          uploadTask.on("state_changed", (snap) => {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            uploadProgress.value = pct;
            progressText.textContent = `Uploading: ${pct}%`;
          }, (err) => {
            console.error("upload error:", err);
            reject(err);
          }, async () => {
            photoURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve();
          });
        });
      }

      const updated = {
        name: nameInput.value.trim(),
        phone: phoneInput.value.trim(),
        address: addressInput.value.trim(),
        gender: genderSelect.value || null,
        updatedAt: serverTimestamp()
      };
      if (photoURL) updated.photoURL = photoURL;
      await setDoc(userDocRef, updated, { merge: true });

      // Also update Auth profile (best-effort)
      try {
        if (auth.currentUser) {
          await auth.currentUser.updateProfile?.({
            displayName: updated.name || null,
            photoURL: updated.photoURL || null
          });
        }
      } catch (e) {
        // ignore
      }

      toast("Profile saved");
      croppedBlob = null;
      progressWrap.classList.add("hidden");
    } catch (err) {
      console.error("save profile error:", err);
      toast("Save failed");
    }

    saveBtn.disabled = false;
    saveBtn.textContent = "Save Profile";
  });

  // password reset button
  resetPassBtn?.addEventListener("click", async () => {
    if (!currentUser) return toast("User not logged in");
    try {
      await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"); // ensure functions available
      await auth.sendPasswordResetEmail?.(currentUser.email);
      toast("Password reset sent");
    } catch (err) {
      console.error("reset pass error:", err);
      // fallback to modular function exported in sh-auth
      try {
        const mod = await import("/auth/sh-auth.js");
        await mod.sendPasswordResetEmail(currentUser.email);
        toast("Password reset sent");
      } catch (err2) {
        toast("Failed to send reset email");
      }
    }
  });

  // back button
  backBtn?.addEventListener("click", () => history.back());

});