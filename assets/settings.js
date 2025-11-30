// ================================
// SETTINGS PAGE MAIN SCRIPT
// ================================

// Wait for Firebase
function waitForFirebase() {
  return new Promise((resolve) => {
    const check = () => {
      if (window.firebase && window.auth && window.db) resolve();
      else setTimeout(check, 30);
    };
    check();
  });
}

(async () => {
  await waitForFirebase();

  // Elements
  const hdrName = document.getElementById("hdrName");
  const hdrEmail = document.getElementById("hdrEmail");
  const hdrAvatar = document.getElementById("hdrAvatar");
  const logoutItem = document.getElementById("logoutItem");
  const pwSheet = document.getElementById("pwSheet");
  const pushToggle = document.getElementById("pushToggle");

  // ---------- LOAD USER DATA ----------
  auth.onAuthStateChanged(async (user) => {
    if (!user) return;

    const snap = await db.collection("users").doc(user.uid).get();
    const d = snap.data() || {};

    hdrName.textContent = d.name || "User Name";
    hdrEmail.textContent = user.email;
    hdrAvatar.src = d.photoURL || "/assets/default-user.png";

    if (d.pushEnabled) pushToggle.classList.add("on");
  });

  // ---------- NAVIGATION ----------
  window.openProfile = () => {
    location.href = "/profile/index.html";
  };

  // ---------- LOGOUT ----------
  logoutItem.addEventListener("click", async () => {
    await auth.signOut();
    location.href = "/auth/login.html";
  });

  // ---------- CHANGE PASSWORD ----------
  window.openChangePassword = () => pwSheet.classList.add("active");
  window.closePwSheet = () => pwSheet.classList.remove("active");

  window.savePassword = async () => {
    const newPass = document.getElementById("newPass").value.trim();
    const pass2 = document.getElementById("confirmPass").value.trim();
    const user = auth.currentUser;

    if (!newPass || !pass2) return alert("Enter password");
    if (newPass !== pass2) return alert("Passwords do not match");

    try {
      await user.updatePassword(newPass);
      alert("Password updated");
      closePwSheet();
    } catch (err) {
      alert("Error: Login again to change password.");
    }
  };

  // ---------- PUSH NOTIFICATIONS ----------
  window.togglePush = async (el) => {
    el.classList.toggle("on");
    const enabled = el.classList.contains("on");
    await db.collection("users").doc(auth.currentUser.uid).set({ pushEnabled: enabled }, { merge: true });
  };

  // ---------- PROFILE PHOTO (INSIDE SETTINGS) ----------
  const input = document.getElementById("settingsPhotoInput");
  const modal = document.getElementById("settingsCropModal");
  const cropImg = document.getElementById("settingsCropImage");

  let cropper = null;

  window.openSettingsPhotoPicker = () => input.click();

  input.addEventListener("change", function () {
    const file = this.files[0];
    if (!file) return;

    cropImg.src = URL.createObjectURL(file);
    modal.classList.add("show");

    cropImg.onload = () => {
      if (cropper) cropper.destroy();
      cropper = new Cropper(cropImg, {
        aspectRatio: 1,
        viewMode: 1,
        autoCropArea: 1,
        background: false,
      });
    };
  });

  window.closeSettingsCropper = () => {
    modal.classList.remove("show");
    if (cropper) cropper.destroy();
    cropper = null;
    input.value = "";
  };

  window.saveSettingsCroppedImage = async () => {
    if (!cropper) return;

    const user = auth.currentUser;

    const canvas = cropper.getCroppedCanvas({
      width: 600,
      height: 600,
    });

    canvas.toBlob(async (blob) => {
      const ref = firebase.storage().ref(`profile/${user.uid}.jpg`);
      const upload = ref.put(blob);

      hdrAvatar.style.opacity = 0.4;

      upload.on("state_changed", null, null, async () => {
        const url = await ref.getDownloadURL();

        await db.collection("users").doc(user.uid).set({ photoURL: url }, { merge: true });

        hdrAvatar.src = url;
        hdrAvatar.style.opacity = 1;

        closeSettingsCropper();
      });
    }, "image/jpeg", 0.9);
  };

})();