// PROFILE PAGE SCRIPT - loads user data, handles cropper & upload (circular PNG 250x250)

function waitForFirebaseProfile() {
  return new Promise((resolve) => {
    const check = () => {
      if (window.firebase && window.auth && window.db && window.storage) resolve();
      else setTimeout(check, 30);
    };
    check();
  });
}

(async () => {
  await waitForFirebaseProfile();

  // Elements
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

  // Helper toast (simple)
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

  // Auth state & load profile
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "/auth/login.html";
      return;
    }

    emailEl.value = user.email || "";

    const userRef = db.collection("users").doc(user.uid);
    const snap = await userRef.get();

    if (!snap.exists) {
      // create default
      await userRef.set({
        name: user.displayName || "",
        email: user.email,
        phone: "",
        address: "",
        photoURL: "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    const data = (await userRef.get()).data();

    nameEl.value = data.name || "";
    phoneEl.value = data.phone || "";
    addressEl.value = data.address || "";
    genderEl.value = data.gender || "";
    if (data.photoURL) pfAvatar.src = data.photoURL;
  });

  // Open file selector from pencil (profile page)
  changePhotoBtn.addEventListener("click", () => photoInput.click());

  // When user selects file -> open cropper modal
  photoInput.addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);

    // set crop image and show modal
    cropImage.src = url;
    cropModal.classList.add("show");

    // init cropper after image loads
    cropImage.onload = () => {
      if (cropper) {
        cropper.destroy();
        cropper = null;
      }
      cropper = new Cropper(cropImage, {
        aspectRatio: 1,
        viewMode: 1,
        dragMode: "move",
        autoCropArea: 1,
        background: false,
        responsive: true,
        guides: false,
        zoomOnWheel: true,
        cropBoxResizable: false,
      });
    };
  });

  // Close cropper
  window.closeCropper = () => {
    cropModal.classList.remove("show");
    if (cropper) { cropper.destroy(); cropper = null; }
    photoInput.value = "";
  };

  // Save cropped (circle PNG 250x250) and upload
  window.saveCroppedImage = async () => {
    if (!cropper) {
      toast("Cropper not ready");
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      toast("Not signed in");
      return;
    }

    try {
      // Get high-res square from Cropper
      const squareCanvas = cropper.getCroppedCanvas({
        width: 600,
        height: 600,
        imageSmoothingQuality: "high"
      });

      // Make circular canvas 250x250
      const finalSize = 250;
      const circ = document.createElement("canvas");
      circ.width = finalSize;
      circ.height = finalSize;
      const ctx = circ.getContext("2d");

      ctx.clearRect(0, 0, finalSize, finalSize);
      ctx.beginPath();
      ctx.arc(finalSize/2, finalSize/2, finalSize/2, 0, Math.PI*2);
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(squareCanvas, 0, 0, 600, 600, 0, 0, finalSize, finalSize);

      // Optionally add a subtle white border (uncomment if wanted)
      // ctx.globalCompositeOperation = 'destination-over';
      // ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      // ctx.lineWidth = 4;
      // ctx.beginPath();
      // ctx.arc(finalSize/2, finalSize/2, (finalSize/2)-2, 0, Math.PI*2);
      // ctx.stroke();

      // Convert to blob and upload
      circ.toBlob(async (blob) => {
        if (!blob) {
          toast("Failed to prepare image");
          return;
        }

        const storageRef = firebase.storage().ref(`profile/${user.uid}.png`);
        const uploadTask = storageRef.put(blob);

        // UI feedback
        pfAvatar.style.opacity = 0.45;

        uploadTask.on("state_changed",
          (snapshot) => {
            const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            pfAvatar.title = `Uploading ${percent}%`;
          },
          (err) => {
            console.error(err);
            toast("Upload failed");
            pfAvatar.style.opacity = 1;
          },
          async () => {
            const url = await storageRef.getDownloadURL();
            // Save to Firestore
            await db.collection("users").doc(user.uid).set({ photoURL: url, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });

            // Update UI
            pfAvatar.src = url;
            pfAvatar.style.opacity = 1;

            // cleanup
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

  // Save profile fields
  saveBtn.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) {
      toast("Not signed in");
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    await db.collection("users").doc(user.uid).set({
      name: nameEl.value.trim(),
      phone: phoneEl.value.trim(),
      address: addressEl.value.trim(),
      gender: genderEl.value,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    saveBtn.disabled = false;
    saveBtn.textContent = "Save Profile";
    toast("Profile saved");
  });

  // Reset password (send email)
  resetBtn.addEventListener("click", async () => {
    const email = emailEl.value;
    if (!email) return toast("Email unavailable");
    try {
      await auth.sendPasswordResetEmail(email);
      toast("Reset email sent");
    } catch (err) {
      console.error(err);
      toast("Could not send reset email");
    }
  });

})();