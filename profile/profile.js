/* profile.js — full working for profile page
   - loads user doc
   - lets user change photo (cropper), save profile fields, reset password
*/

(function () {
  function waitFirebase() {
    return new Promise((resolve) => {
      const check = () => {
        if (window.firebase && window.auth && window.db) resolve();
        else setTimeout(check, 30);
      };
      check();
    });
  }

  // Expose closeCropper/saveCroppedImage globally (used by HTML)
  window.closeCropper = null;
  window.saveCroppedImage = null;

  waitFirebase().then(() => {
    const pfAvatar = document.getElementById("pfAvatar");
    const changePhotoBtn = document.getElementById("changePhotoBtn");
    const photoInput = document.getElementById("photoInput");
    const cropModal = document.getElementById("cropModal");
    const cropImage = document.getElementById("cropImage");

    const nameEl = document.getElementById("name");
    const emailEl = document.getElementById("email");
    const genderEl = document.getElementById("gender");
    const phoneEl = document.getElementById("phone");
    const addressEl = document.getElementById("address");

    const saveBtn = document.getElementById("saveBtn");
    const resetBtn = document.getElementById("resetPassBtn");

    let cropper = null;
    let objectUrl = null;

    function toast(msg) {
      if (!document.getElementById("pfToast")) {
        const d = document.createElement("div");
        d.id = "pfToast";
        d.style.position = "fixed";
        d.style.bottom = "24px";
        d.style.left = "50%";
        d.style.transform = "translateX(-50%)";
        d.style.background = "rgba(0,0,0,0.85)";
        d.style.color = "#fff";
        d.style.padding = "10px 14px";
        d.style.borderRadius = "10px";
        d.style.zIndex = 100000;
        document.body.appendChild(d);
      }
      const elm = document.getElementById("pfToast");
      elm.textContent = msg;
      elm.style.opacity = 1;
      setTimeout(() => (elm.style.opacity = 0), 2200);
    }

    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = "/auth/login.html";
        return;
      }

      emailEl.value = user.email || "";

      try {
        const snap = await db.collection("users").doc(user.uid).get();
        const data = snap.exists ? snap.data() : null;

        nameEl.value = data && data.name ? data.name : (user.displayName || "");
        phoneEl.value = data && data.phone ? data.phone : "";
        addressEl.value = data && data.address ? data.address : "";
        genderEl.value = data && data.gender ? data.gender : "";

        if (data && data.photoURL) {
          pfAvatar.src = data.photoURL;
        } else {
          // default app favicon as default
          pfAvatar.src = "/home/SH-Favicon.png";
        }
      } catch (e) {
        console.error("load profile failed", e);
      }
    });

    // open file picker
    if (changePhotoBtn) changePhotoBtn.addEventListener("click", () => {
      if (photoInput) photoInput.click();
    });

    if (photoInput) {
      photoInput.addEventListener("change", (ev) => {
        const f = ev.target.files && ev.target.files[0];
        if (!f) return;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(f);

        cropImage.src = objectUrl;
        cropModal.classList.add("show");

        cropImage.onload = () => {
          if (cropper) {
            cropper.destroy();
            cropper = null;
          }
          cropper = new Cropper(cropImage, {
            aspectRatio: 1,
            viewMode: 1,
            autoCropArea: 1,
            background: false,
            guides: false,
            movable: true,
            zoomable: true
          });
        };
      });
    }

    window.closeCropper = function () {
      if (cropper) { cropper.destroy(); cropper = null; }
      if (cropModal) cropModal.classList.remove("show");
      if (photoInput) photoInput.value = "";
      if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    };

    window.saveCroppedImage = async function () {
      if (!cropper) return toast("Cropper not ready");
      const user = auth.currentUser;
      if (!user) return toast("Not signed in");

      try {
        const squareCanvas = cropper.getCroppedCanvas({ width: 600, height: 600, imageSmoothingQuality: "high" });

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
        ctx.drawImage(squareCanvas, 0, 0, 600, 600, 0, 0, size, size);

        circleCanvas.toBlob(async (blob) => {
          if (!blob) return toast("Failed to prepare image");

          const storageRef = firebase.storage().ref(`profile/${user.uid}.png`);
          const uploadTask = storageRef.put(blob);

          pfAvatar.style.opacity = 0.45;

          uploadTask.on("state_changed",
            () => {},
            (err) => {
              console.error(err);
              toast("Upload failed");
              pfAvatar.style.opacity = 1;
            },
            async () => {
              const url = await storageRef.getDownloadURL();
              await db.collection("users").doc(user.uid).set({ photoURL: url, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
              pfAvatar.src = url;
              pfAvatar.style.opacity = 1;
              closeCropper();
              toast("Photo updated");
            }
          );
        }, "image/png", 0.95);

      } catch (e) {
        console.error(e);
        toast("Unexpected error");
      }
    };

    // Save profile details
    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (!user) return toast("Not signed in");
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";

        try {
          await db.collection("users").doc(user.uid).set({
            name: nameEl.value.trim(),
            phone: phoneEl.value.trim(),
            address: addressEl.value.trim(),
            gender: genderEl.value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          toast("Profile saved");
        } catch (e) {
          console.error(e);
          toast("Could not save profile");
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = "Save Profile";
        }
      });
    }

    // Reset password
    if (resetBtn) {
      resetBtn.addEventListener("click", async () => {
        const email = emailEl.value;
        if (!email) return toast("Email not available");
        try {
          await auth.sendPasswordResetEmail(email);
          toast("Reset email sent");
        } catch (e) {
          console.error(e);
          toast("Could not send reset email");
        }
      });
    }

  }).catch(err => console.error("firebase wait failed", err));

})();
