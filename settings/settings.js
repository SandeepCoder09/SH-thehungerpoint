(function () {

  const auth = firebase.auth();
  const db = firebase.firestore();

  const hdrAvatar = document.getElementById("hdrAvatar");
  const hdrAvatarBtn = document.getElementById("hdrAvatarBtn");
  const settingsPhotoInput = document.getElementById("settingsPhotoInput");

  const settingsCropModal = document.getElementById("settingsCropModal");
  const settingsCropImage = document.getElementById("settingsCropImage");

  const pwSheet = document.getElementById("pwSheet");
  const openChangePassBtn = document.getElementById("openChangePassBtn");
  const openProfileBtn = document.getElementById("openProfileBtn");

  const pushToggle = document.getElementById("pushToggle");
  const logoutItem = document.getElementById("logoutItem");

  const hdrName = document.getElementById("hdrName");
  const hdrEmail = document.getElementById("hdrEmail");

  let cropper = null;

  function showToast(msg) {
    alert(msg);
  }

  /* ---------------- Load User Data ---------------- */
  auth.onAuthStateChanged(async (user) => {
    if (!user) return;

    hdrEmail.textContent = user.email;

    const snap = await db.collection("users").doc(user.uid).get();
    if (!snap.exists) return;

    const d = snap.data();
    hdrName.textContent = d.name || "User";

    if (d.photoURL) hdrAvatar.src = d.photoURL;
    if (typeof d.notificationsEnabled !== "undefined") {
      if (d.notificationsEnabled) pushToggle.classList.add("active");
    }
  });

  /* ---------------- Avatar Upload ---------------- */
  hdrAvatarBtn.onclick = () => settingsPhotoInput.click();

  settingsPhotoInput.onchange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;

    settingsCropImage.src = URL.createObjectURL(f);
    settingsCropModal.classList.add("active");

    settingsCropImage.onload = () => {
      if (cropper) cropper.destroy();
      cropper = new Cropper(settingsCropImage, {
        aspectRatio: 1,
        viewMode: 1,
        autoCropArea: 1
      });
    };
  };

  window.closeSettingsCropper = () => {
    settingsCropModal.classList.remove("active");
    if (cropper) cropper.destroy();
    cropper = null;
  };

  window.saveSettingsCroppedImage = async () => {
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

    hdrAvatar.src = base64 + "?t=" + Date.now();
    window.closeSettingsCropper();
  };

  /* ---------------- Push Toggle ---------------- */
  pushToggle.onclick = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const newState = !pushToggle.classList.contains("active");
    pushToggle.classList.toggle("active");

    await db.collection("users").doc(user.uid).set(
      { notificationsEnabled: newState },
      { merge: true }
    );
  };

  /* ---------------- Password Sheet ---------------- */
  openChangePassBtn.onclick = () => pwSheet.classList.add("open");
  window.closePwSheet = () => pwSheet.classList.remove("open");

  window.savePassword = async () => {
    const user = auth.currentUser;
    if (!user) return;

    await auth.sendPasswordResetEmail(user.email);
    showToast("Reset email sent!");
    pwSheet.classList.remove("open");
  };

  /* ---------------- Navigation ---------------- */
  openProfileBtn.onclick = () => location.href = "/profile/index.html";

  /* ---------------- Logout ---------------- */
  logoutItem.onclick = async () => {
    await auth.signOut();
    location.href = "/auth/login.html";
  };

})();
