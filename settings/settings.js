// /settings/settings.js
// Full script for Settings page — handles header avatar, cropper, password sheet, toggles, logout.

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
    setTimeout(() => { t.style.opacity = "0"; t.addEventListener("transitionend", () => t.remove()); }, timeout);
  }

  // Wait for firebase auth + firestore to be available.
  async function waitForFirebase() {
    return new Promise((resolve) => {
      const check = () => {
        // firebase compat libs define firebase; the project's bootstrap sets window.auth and window.db.
        const hasAuth = !!(window.auth || (window.firebase && window.firebase.auth && window.firebase.auth()));
        const hasDb = !!(window.db || (window.firebase && window.firebase.firestore && window.firebase.firestore()));
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

  // Safety: ensure elements exist
  if (!settingsCropModal || !settingsCropImage) {
    console.warn("Cropper DOM missing - skipping cropper setup.");
  }

  // ---------- Show / hide utilities ----------
  function openPwSheet() {
    if (!pwSheet) return;
    pwSheet.classList.add("open");
    pwSheet.setAttribute("aria-hidden", "false");
  }
  function closePwSheet() {
    if (!pwSheet) return;
    pwSheet.classList.remove("open");
    pwSheet.setAttribute("aria-hidden", "true");
  }

  function openCropperModal() {
    settingsCropModal.classList.add("active");
    settingsCropModal.setAttribute("aria-hidden", "false");
  }
  function closeCropperModal() {
    settingsCropModal.classList.remove("active");
    settingsCropModal.setAttribute("aria-hidden", "true");
    // destroy cropper
    if (cropper) {
      try { cropper.destroy(); } catch(e) {}
      cropper = null;
    }
    // clear img src
    settingsCropImage.src = "";
  }

  // ---------- Avatar crop / upload ----------
  async function onSettingsFileChange(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    settingsCropImage.src = url;

    // show modal
    openCropperModal();

    // init cropper after image loads
    settingsCropImage.onload = () => {
      // destroy previous
      if (cropper) {
        try { cropper.destroy(); } catch (err) {}
      }

      // Create CropperJS — prefer square and allow moving; we'll get a square canvas and mask it visually.
      cropper = new Cropper(settingsCropImage, {
        viewMode: 1,
        dragMode: 'move',
        aspectRatio: 1,
        autoCropArea: 1,
        background: false,
        responsive: true,
        movable: true,
        zoomable: true,
        wheelZoomRatio: 0.1,
      });
    };
  }

  async function saveSettingsCroppedImage() {
    if (!cropper) {
      showToast("Cropper not ready");
      return;
    }

    // get a square canvas — scaled to 600 for good quality
    const canvas = cropper.getCroppedCanvas({ width: 600, height: 600, imageSmoothingQuality: "high" });
    if (!canvas) { showToast("Crop failed"); return; }

    // convert to blob
    canvas.toBlob(async (blob) => {
      if (!blob) { showToast("Failed to create image"); return; }

      try {
        const user = (window.auth && window.auth.currentUser) || (window.firebase && window.firebase.auth && window.firebase.auth().currentUser);
        if (!user) {
          showToast("Not signed in");
          closeCropperModal();
          return;
        }
        const uid = user.uid;

        // storage ref (compat or modular + fallback)
        const storageRef = (window.firebase && window.firebase.storage) ? window.firebase.storage().ref(`profile/${uid}.jpg`) : null;

        if (!storageRef && !(window.firebase && window.firebase.storage)) {
          showToast("Storage not available");
          closeCropperModal();
          return;
        }

        // Upload using compat SDK path
        // NOTE: projects sometimes expose window.firebase; this works for compat.
        const uploadTask = storageRef.put(blob);

        // show a small progress toast
        showToast("Uploading profile photo...");

        uploadTask.on('state_changed',
          (snap) => {
            // optional: could compute percentage
          },
          (err) => {
            console.error("Upload failed:", err);
            showToast("Upload failed");
          },
          async () => {
            // success
            const url = await storageRef.getDownloadURL();

            // update Firestore user doc
            const db = window.db || (window.firebase && window.firebase.firestore && window.firebase.firestore());
            if (db) {
              // compat Firestore
              try {
                await db.collection("users").doc(uid).set({ photoURL: url, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
              } catch (err) {
                console.warn("Firestore update failed:", err);
              }
            }

            // update header avatar(s)
            try {
              // update header display
              hdrAvatar.src = url + "?_=" + Date.now();
            } catch (e){}

            showToast("Photo updated!");
            closeCropperModal();
          }
        );

      } catch (err) {
        console.error(err);
        showToast("Upload error");
        closeCropperModal();
      }
    }, "image/jpeg", 0.9);
  }

  // ---------- Push toggle ----------
  async function setPushToggle(active) {
    if (!pushToggle) return;
    if (active) {
      pushToggle.classList.add("active");
      pushToggle.setAttribute("aria-checked", "true");
    } else {
      pushToggle.classList.remove("active");
      pushToggle.setAttribute("aria-checked", "false");
    }
  }

  async function togglePush() {
    const user = (window.auth && window.auth.currentUser) || (window.firebase && window.firebase.auth && window.firebase.auth().currentUser);
    if (!user) {
      showToast("You must be signed in");
      return;
    }
    const uid = user.uid;
    const db = window.db || (window.firebase && window.firebase.firestore && window.firebase.firestore());
    if (!db) {
      showToast("Database not available");
      return;
    }

    const current = pushToggle.classList.contains("active");
    const next = !current;
    // update UI immediately
    setPushToggle(next);

    try {
      await db.collection("users").doc(uid).set({ notificationsEnabled: !!next }, { merge: true });
      showToast(next ? "Notifications enabled" : "Notifications disabled");
    } catch (err) {
      console.error("Failed to save toggle:", err);
      // revert UI
      setPushToggle(current);
      showToast("Failed to save");
    }
  }

  // ---------- Change password ----------
  async function savePassword() {
    // We'll use sendPasswordResetEmail for safety (user will confirm via email)
    const user = (window.auth && window.auth.currentUser) || (window.firebase && window.firebase.auth && window.firebase.auth().currentUser);
    if (!user) {
      showToast("Please sign in first");
      return;
    }
    try {
      const email = user.email;
      if (!email) { showToast("No email available"); return; }
      (window.auth && window.auth.sendPasswordResetEmail) ?
        await window.auth.sendPasswordResetEmail(email) :
        await window.firebase.auth().sendPasswordResetEmail(email);

      showToast("Reset email sent");
      closePwSheet();
    } catch (err) {
      console.error("Reset email error:", err);
      showToast("Failed to send reset email");
    }
  }

  // ---------- Logout ----------
  async function doLogout() {
    try {
      if (window.auth && window.auth.signOut) {
        await window.auth.signOut();
      } else if (window.firebase && window.firebase.auth) {
        await window.firebase.auth().signOut();
      }
      // Redirect to login
      window.location.href = "/auth/login.html";
    } catch (err) {
      console.error(err);
      showToast("Logout failed");
    }
  }

  // ---------- Wire up initial UI events ----------
  function wireEvents() {
    // avatar pencil
    if (hdrAvatarBtn && settingsPhotoInput) {
      hdrAvatarBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        settingsPhotoInput.click();
      });
    }

    if (settingsPhotoInput) settingsPhotoInput.addEventListener("change", onSettingsFileChange);

    // cropper save / cancel buttons are inline in HTML with onclick to the global names.
    // we need to expose the functions globally so those onclick="" can call them:
    window.saveSettingsCroppedImage = saveSettingsCroppedImage;
    window.closeSettingsCropper = closeCropperModal;

    // Change password sheet open/close
    if (openChangePassBtn) {
      openChangePassBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openPwSheet();
      });
    }
    // global functions for inline HTML
    window.closePwSheet = closePwSheet;
    window.savePassword = savePassword;

    // profile navigation
    if (openProfileBtn) openProfileBtn.addEventListener("click", () => { window.location.href = "/profile/index.html"; });

    // push toggle
    if (pushToggle) {
      pushToggle.addEventListener("click", (e) => {
        e.preventDefault();
        togglePush();
      });
    }

    // logout
    if (logoutItem) logoutItem.addEventListener("click", (e) => { e.preventDefault(); doLogout(); });

    // close cropper modal when background clicked (but not when clicking inside content)
    if (settingsCropModal) {
      settingsCropModal.addEventListener("click", (ev) => {
        if (ev.target === settingsCropModal) closeCropperModal();
      });
    }
  }

  // ---------- Main bootstrap ----------
  (async function main() {
    await waitForFirebase();
    wireEvents();

    // ensure sheet is hidden on load — defensive
    if (pwSheet) {
      pwSheet.classList.remove("open");
      pwSheet.setAttribute("aria-hidden", "true");
    }
    if (settingsCropModal) {
      settingsCropModal.classList.remove("active");
      settingsCropModal.setAttribute("aria-hidden", "true");
    }

    // Fill header with user info when auth becomes available
    const authImpl = window.auth || (window.firebase && window.firebase.auth && window.firebase.auth());
    const db = window.db || (window.firebase && window.firebase.firestore && window.firebase.firestore());

    // If the project uses auth.onAuthStateChanged from window.auth, use that; otherwise fallback to firebase.auth()
    const onAuthStateChanged = (authImpl && authImpl.onAuthStateChanged) ? authImpl.onAuthStateChanged.bind(authImpl) :
      ((window.firebase && window.firebase.auth) ? window.firebase.auth().onAuthStateChanged.bind(window.firebase.auth()) : null);

    if (!onAuthStateChanged) {
      console.warn("Auth onAuthStateChanged not available; attempting immediate user read.");
      const userImmediate = (authImpl && authImpl.currentUser) || (window.firebase && window.firebase.auth && window.firebase.auth().currentUser);
      if (userImmediate) {
        populateHeader(userImmediate);
      }
      return;
    }

    onAuthStateChanged(async (user) => {
      if (!user) {
        // If not logged in, the protect.js will redirect; but keep UI safe
        hdrName.textContent = "Guest";
        hdrEmail.textContent = "Not signed in";
        setPushToggle(false);
        return;
      }

      // Set header
      populateHeader(user);

      // Load notification preference
      try {
        if (db) {
          const doc = await db.collection("users").doc(user.uid).get();
          if (doc && doc.exists) {
            const data = doc.data();
            if (data && typeof data.notificationsEnabled !== "undefined") setPushToggle(!!data.notificationsEnabled);
            if (data && data.photoURL) {
              hdrAvatar.src = data.photoURL;
            }
            if (data && data.name) hdrName.textContent = data.name;
          }
        }
      } catch (err) {
        console.warn("Failed to load user preferences:", err);
      }
    });

    // populate header fallback
    function populateHeader(user) {
      try {
        hdrName.textContent = user.displayName || (user.email ? user.email.split("@")[0] : "User Name");
        hdrEmail.textContent = user.email || "";
        // attempt to get photoURL from Firestore if not present on user object
        if (user.photoURL) hdrAvatar.src = user.photoURL;
      } catch (err) {
        console.warn("Populate header failed:", err);
      }
    }
  })();

})();
