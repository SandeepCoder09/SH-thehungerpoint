// ================================
// SETTINGS PAGE MAIN SCRIPT (Circle-mask crop, 250x250 output)
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

  // Crop elements
  const input = document.getElementById("settingsPhotoInput");
  const modal = document.getElementById("settingsCropModal");
  const cropImg = document.getElementById("settingsCropImage");

  let cropper = null;

  // ---------- LOAD USER DATA ----------
  auth.onAuthStateChanged(async (user) => {
    if (!user) return;

    const snap = await db.collection("users").doc(user.uid).get();
    const d = snap.data() || {};

    hdrName.textContent = d.name || (user.displayName || "User Name");
    hdrEmail.textContent = user.email || "";
    hdrAvatar.src = d.photoURL || "/assets/default-user.png";

    if (d.pushEnabled) pushToggle.classList.add("on");
    else pushToggle.classList.remove("on");
  });

  // ---------- NAV ----------
  window.openProfile = () => location.href = "/profile/index.html";

  // ---------- LOGOUT ----------
  logoutItem.addEventListener("click", async () => {
    await auth.signOut();
    location.href = "/auth/login.html";
  });

  // ---------- PASSWORD SHEET ----------
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
      console.error(err);
      alert("Error: re-login may be required to change password.");
    }
  };

  // ---------- PUSH TOGGLE ----------
  window.togglePush = async (el) => {
    el.classList.toggle("on");
    const enabled = el.classList.contains("on");
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    await db.collection("users").doc(uid).set({ pushEnabled: enabled }, { merge: true });
  };

  // ---------- SETTINGS PHOTO PICKER ----------
  window.openSettingsPhotoPicker = () => input.click();

  input.addEventListener("change", function () {
    const file = this.files[0];
    if (!file) return;

    // create object url and load into img
    cropImg.src = URL.createObjectURL(file);
    modal.classList.add("show");

    cropImg.onload = () => {
      if (cropper) { cropper.destroy(); cropper = null; }

      // initialize cropper with options suitable for circle overlay
      cropper = new Cropper(cropImg, {
        viewMode: 1,
        dragMode: 'move',
        aspectRatio: 1,
        autoCropArea: 1,
        background: false,
        guides: false,
        center: true,
        zoomOnWheel: true,
        cropBoxResizable: false,
      });
    };
  });

  window.closeSettingsCropper = () => {
    modal.classList.remove("show");
    if (cropper) { cropper.destroy(); cropper = null; }
    input.value = "";
  };

  // ---------- Save: get square canvas, then create circular clipped canvas 250x250 ----------
  window.saveSettingsCroppedImage = async () => {
    if (!cropper) return;
    const user = auth.currentUser;
    if (!user) return alert("Not authenticated");

    // 1) get cropped square canvas (use 600px for quality)
    const squareSize = 600;
    const croppedCanvas = cropper.getCroppedCanvas({ width: squareSize, height: squareSize, imageSmoothingQuality: 'high' });

    // 2) create circular canvas 250x250 (final)
    const finalSize = 250;
    const circCanvas = document.createElement('canvas');
    circCanvas.width = finalSize;
    circCanvas.height = finalSize;
    const ctx = circCanvas.getContext('2d');

    // fill transparent background
    ctx.clearRect(0, 0, finalSize, finalSize);

    // draw circle clipping path
    ctx.save();
    ctx.beginPath();
    ctx.arc(finalSize/2, finalSize/2, finalSize/2, 0, Math.PI*2, true);
    ctx.closePath();
    ctx.clip();

    // draw the croppedSquare into the clipped circle, scaling down
    ctx.drawImage(croppedCanvas, 0, 0, squareSize, squareSize, 0, 0, finalSize, finalSize);

    ctx.restore();

    // Optional: draw a subtle white border outside (not inside clipped area)
    // We'll create a second canvas to add border as outer ring if desired.
    // For now we upload the circular PNG with transparency.

    // 3) convert to blob and upload
    circCanvas.toBlob(async (blob) => {
      if (!blob) return alert("Could not prepare image");

      try {
        const storageRef = firebase.storage().ref(`profile/${user.uid}.png`);

        // upload
        const uploadTask = storageRef.put(blob);

        // UI feedback
        hdrAvatar.style.opacity = 0.4;

        uploadTask.on('state_changed', (snap) => {
          const percent = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          hdrAvatar.title = `Uploading ${percent}%`;
        }, (err) => {
          console.error(err);
          alert("Upload failed");
          hdrAvatar.style.opacity = 1;
        }, async () => {
          const url = await storageRef.getDownloadURL();

          // write to Firestore
          await db.collection('users').doc(user.uid).set({
            photoURL: url,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          // update UI
          hdrAvatar.src = url;
          hdrAvatar.style.opacity = 1;

          // cleanup
          closeSettingsCropper();
        });
      } catch (e) {
        console.error(e);
        alert("Upload error");
        hdrAvatar.style.opacity = 1;
      }
    }, 'image/png', 0.95);
  };

})();