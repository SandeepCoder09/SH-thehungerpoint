/* ======================================================
   settings.js  — loads user, handles avatar cropper,
   push toggle, logout, change password sheet.
======================================================*/

const auth = window.auth || firebase.auth();
const db = window.db || firebase.firestore();
const storage = window.storage || firebase.storage();

/* DOM */
const hdrName = document.getElementById("hdrName");
const hdrEmail = document.getElementById("hdrEmail");
const hdrAvatar = document.getElementById("hdrAvatar");
const hdrAvatarBtn = document.getElementById("hdrAvatarBtn");
const settingsPhotoInput = document.getElementById("settingsPhotoInput");
const settingsCropModal = document.getElementById("settingsCropModal");
const settingsCropImage = document.getElementById("settingsCropImage");
const pushToggle = document.getElementById("pushToggle");
const logoutItem = document.getElementById("logoutItem");
const openProfileBtn = document.getElementById("openProfileBtn");
const openChangePassBtn = document.getElementById("openChangePassBtn");

let settingsCropper = null;
let tempObjectUrl = null;

/* Wait for auth to be ready (protect.js sets window.auth/window.db) */
function waitForAuthReady() {
  return new Promise((res) => {
    const check = () => {
      if ((window.auth || firebase.auth()) && (window.db || firebase.firestore())) res();
      else setTimeout(check, 50);
    };
    check();
  });
}

(async () => {
  await waitForAuthReady();

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "/auth/login.html";
      return;
    }

    hdrEmail.textContent = user.email || "";
    const doc = await db.collection("users").doc(user.uid).get();
    if (doc.exists) {
      const data = doc.data();
      hdrName.textContent = data.name || "User";
      hdrAvatar.src = data.photoURL || "/home/SH-Favicon.png";
    } else {
      hdrName.textContent = user.displayName || "User";
      hdrAvatar.src = "/home/SH-Favicon.png";
    }
  });
})();

/* ------------------------------
   Avatar button → open file picker
------------------------------*/
hdrAvatarBtn.addEventListener("click", () => settingsPhotoInput.click());

/* ------------------------------
   File picked → init cropper
------------------------------*/
settingsPhotoInput.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  if (tempObjectUrl) URL.revokeObjectURL(tempObjectUrl);
  tempObjectUrl = URL.createObjectURL(file);

  // destroy previous
  if (settingsCropper) {
    settingsCropper.destroy();
    settingsCropper = null;
  }

  settingsCropImage.src = tempObjectUrl;

  // ensure image load then init cropper
  settingsCropImage.addEventListener("load", () => {
    settingsCropper = new Cropper(settingsCropImage, {
      aspectRatio: 1,
      viewMode: 1,
      autoCropArea: 1,
      background: false,
      movable: true,
      zoomable: true,
      guides: false
    });

    settingsCropModal.classList.add("active");
  }, { once: true });
});

/* ------------------------------
   Close cropper modal
------------------------------*/
function closeSettingsCropper() {
  settingsCropModal.classList.remove("active");
  if (settingsCropper) {
    settingsCropper.destroy();
    settingsCropper = null;
  }
  if (tempObjectUrl) {
    URL.revokeObjectURL(tempObjectUrl);
    tempObjectUrl = null;
  }
}
window.closeSettingsCropper = closeSettingsCropper;

/* ------------------------------
   Save cropped and upload
------------------------------*/
async function saveSettingsCroppedImage() {
  const user = auth.currentUser;
  if (!user || !settingsCropper) return alert("Cropper not ready");

  const canvas = settingsCropper.getCroppedCanvas({ width: 600, height: 600, fillColor: '#fff' });

  canvas.toBlob(async (blob) => {
    const ref = storage.ref(`profile/${user.uid}.jpg`);
    await ref.put(blob);
    const url = await ref.getDownloadURL();

    await db.collection("users").doc(user.uid).set({ photoURL: url }, { merge: true });

    hdrAvatar.src = url;
    closeSettingsCropper();
    alert("Profile photo updated!");
  }, "image/jpeg", 0.9);
}
window.saveSettingsCroppedImage = saveSettingsCroppedImage;

/* ------------------------------
   Push toggle (localStorage)
------------------------------*/
pushToggle.addEventListener("click", () => {
  pushToggle.classList.toggle("active");
  const on = pushToggle.classList.contains("active");
  pushToggle.setAttribute("aria-checked", on ? "true" : "false");
  localStorage.setItem("sh_push", on ? "1" : "0");
});
if (localStorage.getItem("sh_push") === "1") {
  pushToggle.classList.add("active");
  pushToggle.setAttribute("aria-checked", "true");
}

/* ------------------------------
   Logout
------------------------------*/
logoutItem.addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "/auth/login.html";
});

/* ------------------------------
   Navigation helpers
------------------------------*/
openProfileBtn.addEventListener("click", () => window.location.href = "/profile/index.html");

/* ------------------------------
   Change password sheet controls are in site-global settings.js (see protect)
------------------------------*/
