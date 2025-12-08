// /profile/profile.js
// Modular profile logic for SH — uses exported window.shAuth services or imports indirectly.
// This file expects to be loaded as type="module".

import { waitForAuth, auth, db, storage } from "/auth/sh-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import {
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

await waitForAuth().catch(() => { /* continue even if slow */ });

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

let cropper = null;
let croppedBlob = null;
let currentUser = null;
let userDocRef = null;

// Helper: simple toast
function toast(msg, d = 2200) {
  const container = document.getElementById("toast-container");
  if (!container) return alert(msg);
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.classList.add("show"), 20);
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 160);
  }, d);
}

// Protect: ensure user
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    // not logged in -> redirect to login
    window.location.href = "/auth/login.html";
    return;
  }
  currentUser = user;
  emailInput.value = user.email || "";
  displayEmail.textContent = user.email || "";

  userDocRef = doc(db, "users", user.uid);

  // Live snapshot
  const unsub = onSnapshot(userDocRef, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data() || {};
    nameInput.value = data.name || "";
    genderSelect.value = data.gender || "";
    phoneInput.value = data.phone || "";
    addressInput.value = data.address || "";

    displayName.textContent = data.name || (user.displayName || "Your name");
    displayEmail.textContent = user.email || "";
    if (data.photoURL) pfAvatar.src = data.photoURL;
    else pfAvatar.src = "/home/SH-Favicon.png";
  }, (err) => {
    console.error("profile onSnapshot err:", err);
  });
});

// Cropper handlers (UI)
changePhotoBtn.addEventListener("click", () => photoInput.click());
photoInput.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  // set blob to cropper image
  cropImage.src = URL.createObjectURL(file);
  openCropper();
});

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

cancelCrop.addEventListener("click", closeCropper);

function closeCropper() {
  cropModal.style.display = "none";
  cropModal.setAttribute("aria-hidden", "true");
  if (cropper) cropper.destroy();
  cropper = null;
  if (cropImage.src && cropImage.src.startsWith("blob:")) URL.revokeObjectURL(cropImage.src);
  croppedBlob = null;
  photoInput.value = "";
}

saveCropped.addEventListener("click", () => {
  if (!cropper) return;
  const canvas = cropper.getCroppedCanvas({ width: 600, height: 600, imageSmoothingQuality: "high" });
  canvas.toBlob((blob) => {
    croppedBlob = blob;
    pfAvatar.src = URL.createObjectURL(blob);
    closeCropper();
  }, "image/jpeg", 0.85);
});

// Save profile
saveBtn.addEventListener("click", async () => {
  if (!currentUser) return toast("User not logged in");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    let photoURL = null;

    if (croppedBlob) {
      progressWrap.classList.remove("hidden");
      uploadProgress.value = 0;
      const path = `profiles/${currentUser.uid}/${Date.now()}.jpg`;
      const sRef = storageRef(storage, path);
      const uploadTask = uploadBytesResumable(sRef, croppedBlob);

      await new Promise((resolve, reject) => {
        uploadTask.on("state_changed", (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          uploadProgress.value = pct;
          progressText.textContent = `Uploading: ${pct}%`;
        }, (err) => reject(err), async () => {
          photoURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve();
        });
      });
    }

    const updated = {
      name: (nameInput.value || "").trim(),
      phone: (phoneInput.value || "").trim(),
      address: (addressInput.value || "").trim(),
      gender: (genderSelect.value || "")
    };
    if (photoURL) updated.photoURL = photoURL;
    // Set in Firestore
    await setDoc(userDocRef, updated, { merge: true });

    // Update Firebase Auth profile if available
    try {
      await updateProfile(currentUser, {
        displayName: updated.name || currentUser.displayName || "",
        photoURL: updated.photoURL || currentUser.photoURL || null
      });
    } catch (e) { /* non-fatal */ }

    toast("Profile saved");
    croppedBlob = null;
    progressWrap.classList.add("hidden");
  } catch (err) {
    console.error("Profile save error:", err);
    toast("Save failed");
  }

  saveBtn.disabled = false;
  saveBtn.textContent = "Save Profile";
});

// Password reset
resetPassBtn.addEventListener("click", async () => {
  const email = emailInput.value;
  if (!email) return toast("Email missing");
  try {
    await auth.sendPasswordResetEmail(email);
    toast("Password reset sent");
  } catch (err) {
    console.error(err);
    toast("Failed to send reset email");
  }
});

// Back
if (backBtn) backBtn.addEventListener("click", () => history.back());

// Cart badge update (listen for cart changes)
function updateCartBadge() {
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem("sh_cart_v1")) || []; } catch (e) {}
  const count = cart.reduce((s, i) => s + (i.qty || 0), 0);
  const badge = document.getElementById("cartBadge");
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? "block" : "none";
  }
}
updateCartBadge();
document.addEventListener("cart-updated", updateCartBadge);