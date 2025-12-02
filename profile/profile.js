const auth = firebase.auth();
const db = firebase.firestore();

const pfAvatar = document.getElementById("pfAvatar");
const changePhotoBtn = document.getElementById("changePhotoBtn");
const photoInput = document.getElementById("photoInput");
const cropModal = document.getElementById("cropModal");
const cropImage = document.getElementById("cropImage");

const nameField = document.getElementById("name");
const emailField = document.getElementById("email");
const genderField = document.getElementById("gender");
const phoneField = document.getElementById("phone");
const addressField = document.getElementById("address");

const saveBtn = document.getElementById("saveBtn");
const resetPassBtn = document.getElementById("resetPassBtn");

let cropper = null;

/* Load user data */
auth.onAuthStateChanged(async (user) => {
  if (!user) return location.href = "/auth/login.html";

  emailField.value = user.email;

  const snap = await db.collection("users").doc(user.uid).get();
  if (!snap.exists) return;

  const d = snap.data();
  nameField.value = d.name || "";
  genderField.value = d.gender || "";
  phoneField.value = d.phone || "";
  addressField.value = d.address || "";
  if (d.photoURL) pfAvatar.src = d.photoURL;
});

/* Avatar Upload */
changePhotoBtn.onclick = () => photoInput.click();

photoInput.onchange = (e) => {
  const f = e.target.files?.[0];
  if (!f) return;

  cropImage.src = URL.createObjectURL(f);
  cropModal.classList.add("active");

  cropImage.onload = () => {
    if (cropper) cropper.destroy();
    cropper = new Cropper(cropImage, {
      aspectRatio: 1,
      viewMode: 1,
      autoCropArea: 1
    });
  };
};

window.closeCropper = () => {
  cropModal.classList.remove("active");
  if (cropper) cropper.destroy();
  cropper = null;
};

window.saveCroppedImage = async () => {
  const user = auth.currentUser;
  if (!user || !cropper) return;

  const base64 = cropper.getCroppedCanvas({
    width: 500,
    height: 500
  }).toDataURL("image/jpeg", 0.85);

  await db.collection("users").doc(user.uid).set(
    { photoURL: base64 },
    { merge: true }
  );

  pfAvatar.src = base64 + "?t=" + Date.now();
  window.closeCropper();
};

/* Save profile */
saveBtn.onclick = async () => {
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

  alert("Profile saved!");
};

/* Reset password */
resetPassBtn.onclick = async () => {
  const user = auth.currentUser;
  if (!user) return;

  await auth.sendPasswordResetEmail(user.email);
  alert("Reset email sent");
};
