/* PROFILE PAGE JS (Firebase COMPAT + Cropper) */

(function () {

  // ---------------------
  // DOM REFERENCES
  // ---------------------
  const pfAvatar = document.getElementById('pfAvatar');
  const changePhotoBtn = document.getElementById('changePhotoBtn');
  const photoInput = document.getElementById('photoInput');

  const cropModal = document.getElementById('cropModal');
  const cropImage = document.getElementById('cropImage');
  const cancelCrop = document.getElementById('cancelCrop');
  const saveCropped = document.getElementById('saveCropped');

  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const genderSelect = document.getElementById('gender');
  const phoneInput = document.getElementById('phone');
  const addressInput = document.getElementById('address');

  const displayName = document.getElementById('displayName');
  const displayEmail = document.getElementById('displayEmail');

  const saveBtn = document.getElementById('saveBtn');
  const resetPassBtn = document.getElementById('resetPassBtn');
  const backBtn = document.getElementById('backBtn');

  const progressWrap = document.getElementById('progressWrap');
  const uploadProgress = document.getElementById('uploadProgress');
  const progressText = document.getElementById('progressText');


  // ---------------------
  // BOTTOM NAV ACTIVE
  // ---------------------
  const path = window.location.pathname;
  document.querySelectorAll(".bottom-nav [data-nav]").forEach(el => {
    if (path.includes(el.dataset.nav)) el.classList.add("active");
  });

  // ---------------------
  // CART BADGE
  // ---------------------
  function updateCartBadge() {
    let cart = [];
    try {
      cart = JSON.parse(localStorage.getItem("sh_cart_v1")) || [];
    } catch (e) {}
    const count = cart.reduce((s, i) => s + (i.qty || 0), 0);
    const badge = document.getElementById("cartBadge");
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? "block" : "none";
    }
  }
  updateCartBadge();
  document.addEventListener("cart-updated", updateCartBadge);


  // ---------------------
  // TOAST
  // ---------------------
  function toast(msg, duration = 3000) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    container.appendChild(el);

    setTimeout(() => el.classList.add("show"), 20);
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 250);
    }, duration);
  }


  // ---------------------
  // CROPPER
  // ---------------------
  let cropper = null;
  let croppedBlob = null;

  changePhotoBtn.addEventListener("click", () => photoInput.click());

  photoInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    cropImage.src = URL.createObjectURL(file);
    openCropper();
  });

  function openCropper() {
    cropModal.style.display = "flex";
    cropModal.setAttribute("aria-hidden", "false");

    cropper && cropper.destroy();
    cropper = new Cropper(cropImage, {
      aspectRatio: 1,
      viewMode: 1,
      autoCropArea: 1,
      background: false,
      movable: true,
      zoomable: true,
      responsive: true,
    });
  }

  cancelCrop.addEventListener("click", closeCropper);

  function closeCropper() {
    cropModal.style.display = "none";
    cropModal.setAttribute("aria-hidden", "true");

    if (cropper) cropper.destroy();
    cropper = null;

    if (cropImage.src && cropImage.src.startsWith("blob:")) {
      URL.revokeObjectURL(cropImage.src);
    }
    photoInput.value = "";
    croppedBlob = null;
  }

  saveCropped.addEventListener("click", () => {
    if (!cropper) return;
    const canvas = cropper.getCroppedCanvas({
      width: 600,
      height: 600,
      imageSmoothingQuality: "high",
    });

    canvas.toBlob((blob) => {
      croppedBlob = blob;
      pfAvatar.src = URL.createObjectURL(blob);
      closeCropper();
    }, "image/jpeg", 0.85);
  });


  // ---------------------
  // FIREBASE COMPAT LOGIC
  // ---------------------
  let currentUser = null;
  let userDocRef = null;
  let lastData = {};

  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
      try { window.location.href = "/auth/login.html"; } catch (e) {}
      return;
    }

    currentUser = user;
    emailInput.value = user.email || "";
    displayEmail.textContent = user.email || "";

    userDocRef = firebase.firestore().collection("users").doc(user.uid);

    try {
      const snap = await userDocRef.get();
      if (snap.exists) {
        lastData = snap.data();
        applyUserData(lastData);
      } else {
        applyUserData({});
      }
    } catch (err) {
      console.error("Firestore fetch error:", err);
    }
  });


  function applyUserData(data) {
    nameInput.value = data.name || "";
    genderSelect.value = data.gender || "";
    phoneInput.value = data.phone || "";
    addressInput.value = data.address || "";

    displayName.textContent =
      data.name || (currentUser && currentUser.displayName) || "Your name";

    if (data.photoURL) {
      pfAvatar.src = data.photoURL;
    } else if (currentUser && currentUser.photoURL) {
      pfAvatar.src = currentUser.photoURL;
    }
  }


  // ---------------------
  // SAVE PROFILE
  // ---------------------
  saveBtn.addEventListener("click", async () => {
    if (!currentUser) return toast("Not authenticated");

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
      let photoURL = lastData.photoURL || currentUser.photoURL || null;

      // Upload cropped image
      if (croppedBlob) {
        progressWrap.classList.remove("hidden");
        uploadProgress.value = 0;
        progressText.textContent = "Uploading: 0%";

        const storageRef = firebase.storage().ref();
        const filePath = `profiles/${currentUser.uid}/${Date.now()}.jpg`;
        const fileRef = storageRef.child(filePath);
        const uploadTask = fileRef.put(croppedBlob);

        await new Promise((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snap) => {
              const pct = Math.round(
                (snap.bytesTransferred / snap.totalBytes) * 100
              );
              uploadProgress.value = pct;
              progressText.textContent = `Uploading: ${pct}%`;
            },
            (err) => reject(err),
            async () => {
              photoURL = await uploadTask.snapshot.ref.getDownloadURL();
              resolve();
            }
          );
        });
      }

      const payload = {
        name: nameInput.value.trim(),
        gender: genderSelect.value,
        phone: phoneInput.value.trim(),
        address: addressInput.value.trim(),
      };

      if (photoURL) payload.photoURL = photoURL;

      await userDocRef.set(payload, { merge: true });

      try {
        await currentUser.updateProfile({
          displayName: payload.name,
          photoURL: payload.photoURL,
        });
      } catch (e) {}

      toast("Profile saved");
      progressText.textContent = "Saved ✓";

      setTimeout(() => {
        progressWrap.classList.add("hidden");
      }, 800);

      croppedBlob = null;

    } catch (err) {
      console.error("Save error:", err);
      toast("Save failed — see console");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Profile";
    }
  });


  // ---------------------
  // RESET PASSWORD
  // ---------------------
  resetPassBtn.addEventListener("click", async () => {
    const email = emailInput.value;
    if (!email) return toast("Email missing");

    try {
      await firebase.auth().sendPasswordResetEmail(email);
      toast("Password reset email sent");
    } catch (err) {
      console.error("Reset error:", err);
      toast("Failed to send reset email");
    }
  });


  // ---------------------
  // BACK BUTTON
  // ---------------------
  backBtn.addEventListener("click", () => history.back());


})();