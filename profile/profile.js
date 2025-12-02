/* ======================================================
   profile.js  — FINAL BASE64 VERSION (no Firebase Storage)
   Same structure, same UI, same cropper.
======================================================*/

const auth = window.auth || firebase.auth();
const db = window.db || firebase.firestore();

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

/* Wait for firebase ready */
function waitForFirebase() {
  return new Promise(res => {
    const check = () => {
      if (window.auth && window.db) res();
      else setTimeout(check, 30);
    };
    check();
  });
}

(async () => {
  await waitForFirebase();

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "/auth/login.html";
      return;
    }

    emailField.value = user.email || "";
    const doc = await db.collection("users").doc(user.uid).get();

    if (doc.exists) {
      const data = doc.data();
      nameField.value = data.name || "";
      genderField.value = data.gender || "";
      phoneField.value = data.phone || "";
      addressField.value = data.address || "";
      pfAvatar.src = data.photoURL || "/home/SH-Favicon.png";
    } else {
      pfAvatar.src = "/home/SH-Favicon.png";
    }
  });
})();

/* Open file picker */
changePhotoBtn.addEventListener("click", () => photoInput.click());

/* File selected → cropper */
photoInput.addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;

  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(f);

  if (cropper) {
    cropper.destroy();
    cropper = null;
  }

  cropImage.src = "";
  cropModal.classList.add("active");
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
        dragMode: "move",
      });
    },
    { once: true }
  );
});

/* Close cropper */
function closeCropper() {
  cropModal.classList.remove("active");
  if (cropper) {
    cropper.destroy();
    cropper = null;
  }
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
}
window.closeCropper = closeCropper;

/* SAVE CROPPED PHOTO AS BASE64 */
async function saveCroppedImage() {
  if (!cropper) return alert("Cropper not ready");
  const user = auth.currentUser;
  if (!user) return;

  const canvas = cropper.getCroppedCanvas({
    width: 600,
    height: 600,
    fillColor: "#fff",
  });

  // Convert to Base64 instead of blob upload
  const base64 = canvas.toDataURL("image/jpeg", 0.85);

  try {
    // Save Base64 to Firestore
    await db.collection("users").doc(user.uid).set(
      { photoURL: base64 },
      { merge: true }
    );

    // Update UI instantly
    pfAvatar.src = base64 + "?t=" + Date.now();

    closeCropper();
    alert("Photo updated!");
  } catch (err) {
    console.error("Photo save error:", err);
    alert("Failed to update photo");
  }
}
window.saveCroppedImage = saveCroppedImage;

/* Save profile data */
saveBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;

  await db.collection("users").doc(user.uid).set(
    {
      name: nameField.value,
      gender: genderField.value,
      phone: phoneField.value,
      address: addressField.value,
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
    await auth.sendPasswordResetEmail(user.email);
    alert("Reset email sent.");
  } catch (err) {
    console.error(err);
    alert("Failed to send reset email");
  }
});
