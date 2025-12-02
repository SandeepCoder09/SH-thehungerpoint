import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const auth = window.auth;
const db = window.db;

const pfAvatar = document.getElementById("pfAvatar");
const changePhotoBtn = document.getElementById("changePhotoBtn");
const photoInput = document.getElementById("photoInput");

const nameField = document.getElementById("name");
const emailField = document.getElementById("email");
const genderField = document.getElementById("gender");
const phoneField = document.getElementById("phone");
const addressField = document.getElementById("address");

const saveBtn = document.getElementById("saveBtn");
const resetPassBtn = document.getElementById("resetPassBtn");

const cropModal = document.getElementById("cropModal");
const cropImage = document.getElementById("cropImage");

let cropper = null;
let objectUrl = null;

/* Load user */
auth.onAuthStateChanged(async (user) => {
  if (!user) return;

  emailField.value = user.email || "";

  const snap = await getDoc(doc(db, "users", user.uid));

  if (snap.exists()) {
    const data = snap.data();

    nameField.value = data.name || "";
    genderField.value = data.gender || "";
    phoneField.value = data.phone || "";
    addressField.value = data.address || "";
    pfAvatar.src = data.photoURL || "/home/SH-Favicon.png";
  } else {
    pfAvatar.src = "/home/SH-Favicon.png";
  }
});

/* Upload photo */
changePhotoBtn.addEventListener("click", () => photoInput.click());

photoInput.addEventListener("change", (e) => {
  const f = e.target.files?.[0];
  if (!f) return;

  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(f);

  cropImage.src = objectUrl;
  cropModal.classList.add("active");

  cropImage.onload = () => {
    if (cropper) cropper.destroy();
    cropper = new Cropper(cropImage, {
      aspectRatio: 1,
      viewMode: 1,
      autoCropArea: 1,
      background: false
    });
  };
});

window.closeCropper = () => {
  cropModal.classList.remove("active");
  if (cropper) cropper.destroy();
  cropper = null;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
};

/* Save cropped */
window.saveCroppedImage = async () => {
  if (!cropper) return alert("Cropper not ready");

  const user = auth.currentUser;
  if (!user) return;

  const canvas = cropper.getCroppedCanvas({ width: 600, height: 600 });

  const base64 = canvas.toDataURL("image/jpeg", 0.85);

  await setDoc(
    doc(db, "users", user.uid),
    { photoURL: base64 },
    { merge: true }
  );

  pfAvatar.src = base64 + "?t=" + Date.now();
  window.closeCropper();
  alert("Photo updated!");
};

/* Save details */
saveBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;

  await setDoc(
    doc(db, "users", user.uid),
    {
      name: nameField.value,
      gender: genderField.value,
      phone: phoneField.value,
      address: addressField.value
    },
    { merge: true }
  );

  alert("Profile saved!");
});

/* Reset password */
resetPassBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;

  try {
    await sendPasswordResetEmail(auth, user.email);
    alert("Reset email sent.");
  } catch {
    alert("Failed!");
  }
});
