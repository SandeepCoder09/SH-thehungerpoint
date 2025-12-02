/* settings.js — full working code for Settings page
   - uses CropperJS
   - uploads to Firebase Storage
   - updates Firestore users/{uid}.photoURL
   - implements push toggle, logout, openProfile, change password sheet
*/

(function () {
  // small helper to wait for firebase config/protect to prepare auth/db
  function waitFirebase() {
    return new Promise((resolve) => {
      const check = () => {
        if (window.firebase && window.auth && window.db) resolve();
        else setTimeout(check, 30);
      };
      check();
    });
  }

  // Expose some functions globally (HTML uses onclick attributes)
  window.openSettingsPhotoPicker = function () {
    const input = document.getElementById("settingsPhotoInput");
    if (input) input.click();
  };

  window.openProfile = function () {
    window.location.href = "/profile/index.html";
  };

  window.openChangePassword = function () {
    const sheet = document.getElementById("pwSheet");
    if (!sheet) return;
    sheet.classList.add("open");
    sheet.setAttribute("aria-hidden", "false");
  };

  window.closePwSheet = function () {
    const sheet = document.getElementById("pwSheet");
    if (!sheet) return;
    sheet.classList.remove("open");
    sheet.setAttribute("aria-hidden", "true");
  };

  window.savePassword = async function () {
    const newPass = document.getElementById("newPass").value.trim();
    const confirmPass = document.getElementById("confirmPass").value.trim();
    if (!newPass || newPass.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }
    if (newPass !== confirmPass) {
      alert("Passwords do not match");
      return;
    }
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in");
      await user.updatePassword(newPass);
      alert("Password updated");
      closePwSheet();
    } catch (e) {
      console.error(e);
      alert("Could not change password. You may need to re-login and try again.");
    }
  };

  // Settings cropper functions (declared at top so other functions can call)
  let cropper = null;
  let currentFileObjectURL = null;

  // Start main
  waitFirebase().then(() => {
    const hdrAvatar = document.getElementById("hdrAvatar");
    const hdrName = document.getElementById("hdrName");
    const hdrEmail = document.getElementById("hdrEmail");

    const fileInput = document.getElementById("settingsPhotoInput");
    const cropModal = document.getElementById("settingsCropModal");
    const cropImg = document.getElementById("settingsCropImage");

    const pushToggle = document.getElementById("pushToggle");
    const logoutItem = document.getElementById("logoutItem");

    // Auth
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = "/auth/login.html";
        return;
      }

      hdrEmail.textContent = user.email || "";
      // load profile doc
      try {
        const snap = await db.collection("users").doc(user.uid).get();
        const data = snap.exists ? snap.data() : null;
        hdrName.textContent = (data && data.name) ? data.name : (user.displayName || "User Name");
        if (data && data.photoURL) hdrAvatar.src = data.photoURL;
      } catch (e) {
        console.error("load profile failed", e);
      }
    });

    // push toggle
    if (pushToggle) {
      pushToggle.addEventListener("click", async () => {
        pushToggle.classList.toggle("on");
        const on = pushToggle.classList.contains("on");
        pushToggle.setAttribute("aria-pressed", String(on));
        // Optionally save to Firestore user preferences:
        try {
          const user = auth.currentUser;
          if (user) {
            await db.collection("users").doc(user.uid).set({ pushNotifications: on }, { merge: true });
          }
        } catch (e) {
          console.error("save push pref", e);
        }
      });
    }

    // logout
    if (logoutItem) {
      logoutItem.addEventListener("click", async () => {
        try {
          await auth.signOut();
          window.location.href = "/auth/login.html";
        } catch (e) {
          console.error("logout failed", e);
        }
      });
    }

    // File input: show cropper modal
    if (fileInput) {
      fileInput.addEventListener("change", (ev) => {
        const f = ev.target.files && ev.target.files[0];
        if (!f) return;

        // cleanup old objectURL
        if (currentFileObjectURL) {
          URL.revokeObjectURL(currentFileObjectURL);
          currentFileObjectURL = null;
        }

        currentFileObjectURL = URL.createObjectURL(f);
        cropImg.src = currentFileObjectURL;

        // show modal
        cropModal.classList.add("active");
        cropModal.setAttribute("aria-hidden", "false");

        // init cropper after image loads
        cropImg.onload = () => {
          if (cropper) {
            cropper.destroy();
            cropper = null;
          }
          cropper = new Cropper(cropImg, {
            aspectRatio: 1,
            viewMode: 1,
            autoCropArea: 1,
            background: false,
            guides: false,
            zoomOnWheel: true,
            movable: true,
            dragMode: "move"
          });
        };
      });
    }

    // global functions to close and save
    window.closeSettingsCropper = function () {
      if (cropper) {
        cropper.destroy();
        cropper = null;
      }
      if (cropModal) {
        cropModal.classList.remove("active");
        cropModal.setAttribute("aria-hidden", "true");
      }
      if (fileInput) fileInput.value = "";
      if (currentFileObjectURL) {
        URL.revokeObjectURL(currentFileObjectURL);
        currentFileObjectURL = null;
      }
    };

    window.saveSettingsCroppedImage = async function () {
      if (!cropper) return alert("No image selected");
      try {
        const square = cropper.getCroppedCanvas({ width: 600, height: 600, imageSmoothingQuality: "high" });

        // create circular canvas 250x250
        const size = 250;
        const circleCanvas = document.createElement("canvas");
        circleCanvas.width = size;
        circleCanvas.height = size;
        const ctx = circleCanvas.getContext("2d");

        ctx.clearRect(0, 0, size, size);
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        ctx.drawImage(square, 0, 0, 600, 600, 0, 0, size, size);

        circleCanvas.toBlob(async (blob) => {
          if (!blob) return alert("Failed to prepare image");

          const user = auth.currentUser;
          if (!user) return alert("Not signed in");

          const ref = firebase.storage().ref(`profile/${user.uid}.png`);
          const uploadTask = ref.put(blob);

          hdrAvatar.style.opacity = 0.45;

          uploadTask.on("state_changed",
            (snap) => {
              // progress (optional)
            },
            (err) => {
              console.error(err);
              alert("Upload failed");
              hdrAvatar.style.opacity = 1;
            },
            async () => {
              const url = await ref.getDownloadURL();
              await db.collection("users").doc(user.uid).set({ photoURL: url, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
              hdrAvatar.src = url;
              hdrAvatar.style.opacity = 1;
              closeSettingsCropper();
            }
          );
        }, "image/png", 0.95);
      } catch (e) {
        console.error(e);
        alert("Could not save image");
      }
    };

  }).catch(err => {
    console.error("firebase wait failed", err);
  });

})();
