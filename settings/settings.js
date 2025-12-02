// /settings/settings.js — FINAL BASE64 VERSION (keeps original structure exactly)

(function () {
  // ---------- Helpers ----------
  function el(id) { return document.getElementById(id); }
  function q(sel) { return document.querySelector(sel); }

  function showToast(msg, timeout = 2500) {
    let t = document.createElement("div");
    t.textContent = msg;
    t.style.position = "fixed";
    t.style.bottom = "28px";
    t.style.left = "50%";
    t.style.transform = "translateX(-50%)";
    t.style.background = "#222";
    t.style.color = "#fff";
    t.style.padding = "10px 14px";
    t.style.borderRadius = "10px";
    t.style.zIndex = 99999;
    t.style.boxShadow = "0 10px 20px rgba(0,0,0,.2)";
    document.body.appendChild(t);
    setTimeout(() => { 
      t.style.opacity = "0"; 
      t.addEventListener("transitionend", () => t.remove()); 
    }, timeout);
  }

  // Wait for firebase auth + firestore to be available.
  async function waitForFirebase() {
    return new Promise((resolve) => {
      const check = () => {
        const hasAuth = !!window.auth;
        const hasDb = !!window.db;
        if (hasAuth && hasDb) resolve();
        else setTimeout(check, 50);
      };
      check();
    });
  }

  // ---------- DOM refs ----------
  const hdrAvatar = el("hdrAvatar");
  const hdrAvatarBtn = el("hdrAvatarBtn");
  const settingsPhotoInput = el("settingsPhotoInput");
  const settingsCropModal = el("settingsCropModal");
  const settingsCropImage = el("settingsCropImage");
  const pwSheet = el("pwSheet");
  const openChangePassBtn = el("openChangePassBtn");
  const openProfileBtn = el("openProfileBtn");
  const pushToggle = el("pushToggle");
  const logoutItem = el("logoutItem");
  const hdrName = el("hdrName");
  const hdrEmail = el("hdrEmail");

  // Cropper state
  let cropper = null;

  // ---------- Sheet ----------
  function openPwSheet() {
    pwSheet.classList.add("open");
    pwSheet.setAttribute("aria-hidden", "false");
  }
  function closePwSheet() {
    pwSheet.classList.remove("open");
    pwSheet.setAttribute("aria-hidden", "true");
  }

  // ---------- Cropper Modal ----------
  function openCropperModal() {
    settingsCropModal.classList.add("active");
    settingsCropModal.setAttribute("aria-hidden", "false");
  }
  function closeCropperModal() {
    settingsCropModal.classList.remove("active");
    settingsCropModal.setAttribute("aria-hidden", "true");

    if (cropper) {
      try { cropper.destroy(); } catch (e) {}
      cropper = null;
    }
    settingsCropImage.src = "";
  }

  // ---------- Image Selecting ----------
  async function onSettingsFileChange(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;

    settingsCropImage.src = URL.createObjectURL(f);

    openCropperModal();

    settingsCropImage.onload = () => {
      if (cropper) { try { cropper.destroy(); } catch (err) {} }

      cropper = new Cropper(settingsCropImage, {
        viewMode: 1,
        dragMode: 'move',
        aspectRatio: 1,
        background: false,
        responsive: true,
        autoCropArea: 1,
        zoomable: true,
        wheelZoomRatio: 0.1,
      });
    };
  }

  // ---------- SAVE CROPPED PHOTO AS BASE64 ----------
  async function saveSettingsCroppedImage() {
    if (!cropper) {
      showToast("Cropper not ready");
      return;
    }

    // Get cropped canvas
    const canvas = cropper.getCroppedCanvas({
      width: 500,
      height: 500,
      imageSmoothingQuality: "high"
    });

    if (!canvas) {
      showToast("Crop failed");
      return;
    }

    // Convert to Base64
    const base64 = canvas.toDataURL("image/jpeg", 0.85);

    const user = auth.currentUser;
    if (!user) {
      showToast("Not signed in");
      closeCropperModal();
      return;
    }

    try {
      // Save to Firestore directly
      await db.collection("users").doc(user.uid).set(
        {
          photoURL: base64,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      // Update UI instantly
      hdrAvatar.src = base64 + "?t=" + Date.now();

      showToast("Photo updated!");
      closeCropperModal();
    } catch (err) {
      console.error("SAVE BASE64 ERROR:", err);
      showToast("Failed to save photo");
      closeCropperModal();
    }
  }

  // ---------- Push Toggle ----------
  async function setPushToggle(active) {
    if (active) {
      pushToggle.classList.add("active");
      pushToggle.setAttribute("aria-checked", "true");
    } else {
      pushToggle.classList.remove("active");
      pushToggle.setAttribute("aria-checked", "false");
    }
  }

  async function togglePush() {
    const user = auth.currentUser;
    if (!user) return showToast("Login first");

    const current = pushToggle.classList.contains("active");
    const next = !current;

    setPushToggle(next);

    try {
      await db.collection("users").doc(user.uid).set(
        { notificationsEnabled: next },
        { merge: true }
      );
      showToast(next ? "Notifications enabled" : "Notifications disabled");
    } catch (err) {
      console.error(err);
      setPushToggle(current);
      showToast("Failed to save");
    }
  }

  // ---------- Save Password ----------
  async function savePassword() {
    const user = auth.currentUser;
    if (!user) return showToast("Not signed in");

    try {
      await auth.sendPasswordResetEmail(user.email);
      showToast("Reset email sent");
      closePwSheet();
    } catch (err) {
      showToast("Failed to send");
    }
  }

  // ---------- Logout ----------
  async function doLogout() {
    try {
      await auth.signOut();
      window.location.href = "/auth/login.html";
    } catch (err) {
      console.error(err);
      showToast("Logout failed");
    }
  }

  // ---------- Wire Events ----------
  function wireEvents() {
    if (hdrAvatarBtn) hdrAvatarBtn.onclick = () => settingsPhotoInput.click();

    if (settingsPhotoInput) settingsPhotoInput.addEventListener("change", onSettingsFileChange);

    // expose functions for inline HTML
    window.saveSettingsCroppedImage = saveSettingsCroppedImage;
    window.closeSettingsCropper = closeCropperModal;

    if (openChangePassBtn) openChangePassBtn.onclick = openPwSheet;
    window.closePwSheet = closePwSheet;
    window.savePassword = savePassword;

    if (openProfileBtn) openProfileBtn.onclick = () => location.href = "/profile/index.html";

    if (pushToggle) pushToggle.onclick = togglePush;

    if (logoutItem) logoutItem.onclick = doLogout;

    // Close modal by clicking background
    settingsCropModal.onclick = (ev) => {
      if (ev.target === settingsCropModal) closeCropperModal();
    };
  }

  // ---------- Main Bootstrap ----------
  (async function main() {
    await waitForFirebase();
    wireEvents();

    // ensure closed initially
    pwSheet.classList.remove("open");
    settingsCropModal.classList.remove("active");

    // Load header details
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        hdrName.textContent = "Guest";
        hdrEmail.textContent = "";
        return;
      }

      hdrEmail.textContent = user.email;

      const snap = await db.collection("users").doc(user.uid).get();
      if (!snap.exists) return;

      const data = snap.data();

      hdrName.textContent = data.name || "User";

      if (data.photoURL) {
        hdrAvatar.src = data.photoURL;
      }

      if (typeof data.notificationsEnabled !== "undefined") {
        setPushToggle(!!data.notificationsEnabled);
      }
    });
  })();
})();
