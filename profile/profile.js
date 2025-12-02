/* -------------------------------------------
   PROFILE PAGE SCRIPT
------------------------------------------- */

// Firebase references
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// DOM elements
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

// Cropper modal
const cropModal = document.getElementById("cropModal");
const cropImage = document.getElementById("cropImage");

let cropper = null;
let objectUrl = null;

/* -------------------------------------------
   LOAD USER PROFILE
------------------------------------------- */
auth.onAuthStateChanged(async (user) => {
  if (!user) return;

  emailField.value = user.email;

  const doc = await db.collection("users").doc(user.uid).get();

  if (doc.exists) {
    const u = doc.data();

    nameField.value = u.name || "";
    genderField.value = u.gender || "";
    phoneField.value = u.phone || "";
    addressField.value = u.address || "";

    pfAvatar.src = u.photoURL || "/home/SH-Favicon.png";
  } else {
    pfAvatar.src = "/home/SH-Favicon.png";
  }
});

/* -------------------------------------------
   OPEN FILE PICKER
------------------------------------------- */
if (changePhotoBtn) {
  changePhotoBtn.addEventListener("click", () => {
    photoInput.click();
  });
}

/* -------------------------------------------
   START CROPPER (FIXED VERSION)
------------------------------------------- */
if (photoInput) {
  photoInput.addEventListener("change", (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;

    // Clean previous blob URL
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);

    // Reset current image/cropper
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }

    cropImage.src = "";
    cropModal.classList.add("show");

    // Load image
    cropImage.src = objectUrl;

    cropImage.addEventListener(
      "load",
      () => {
        cropper = new Cropper(cropImage, {
          aspectRatio: 1,
          viewMode: 1,
          autoCropArea: 1,
          background: false,
          guides: false,
          movable: true,
          zoomable: true,
          dragMode: "move"
        });
      },
      { once: true }
    );
  });
}

/* -------------------------------------------
   CLOSE CROPPER
------------------------------------------- */
function closeCropper() {
  cropModal.classList.remove("show");
  if (cropper) cropper.destroy();
  cropper = null;
}
window.closeCropper = closeCropper;

/* -------------------------------------------
   SAVE CROPPED IMAGE
------------------------------------------- */
async function saveCroppedImage() {
  if (!cropper) {
    alert("Cropper not ready");
    return;
  }

  const user = auth.currentUser;
  if (!user) return;

  const canvas = cropper.getCroppedCanvas({
    width: 400,
    height: 400,
    imageSmoothingQuality: "high"
  });

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9)
  );

  const ref = storage.ref(`profile/${user.uid}.jpg`);

  await ref.put(blob);
  const url = await ref.getDownloadURL();

  // Update Firestore
  await db.collection("users").doc(user.uid).update({
    photoURL: url
  });

  // Update UI
  pfAvatar.src = url;

  closeCropper();
}
window.saveCroppedImage = saveCroppedImage;

/* -------------------------------------------
   SAVE PROFILE FIELDS
------------------------------------------- */
if (saveBtn) {
  saveBtn.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) return;

    await db.collection("users").doc(user.uid).set(
      {
        name: nameField.value,
        gender: genderField.value,
        phone: phoneField.value,
        address: addressField.value
      },
      { merge: true }
    );

    alert("Profile updated successfully.");
  });
}

/* -------------------------------------------
   PASSWORD RESET EMAIL
------------------------------------------- */
if (resetPassBtn) {
  resetPassBtn.addEventListener("click", () => {
    const user = auth.currentUser;
    if (!user) return;

    auth.sendPasswordResetEmail(user.email);
    alert("Password reset email sent.");
  });
}
