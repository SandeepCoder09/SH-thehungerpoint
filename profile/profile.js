/* PROFILE PAGE JS — Firebase COMPAT + Firestore Live Sync + Cropper */

(function () {

  // ----------------------------
  // DOM ELEMENTS
  // ----------------------------
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

  // ----------------------------
  // BOTTOM NAV ACTIVE
  // ----------------------------
  const path = window.location.pathname;
  document.querySelectorAll(".bottom-nav [data-nav]").forEach(el => {
    if (path.includes(el.dataset.nav)) el.classList.add("active");
  });

  // ----------------------------
  // CART BADGE
  // ----------------------------
  function updateCartBadge() {
    let cart = [];
    try { cart = JSON.parse(localStorage.getItem("sh_cart_v1")) || []; } catch (e) {}
    const count = cart.reduce((s, i) => s + (i.qty || 0), 0);
    const badge = document.getElementById("cartBadge");
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? "block" : "none";
    }
  }
  updateCartBadge();
  document.addEventListener("cart-updated", updateCartBadge);

  // ----------------------------
  // TOAST HELPER
  // ----------------------------
  function toast(message, duration = 3000) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    container.appendChild(el);

    setTimeout(() => el.classList.add("show"), 20);
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 250);
    }, duration);
  }

  // ----------------------------
  // CROPPER FUNCTIONALITY
  // ----------------------------
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

    if (cropper) cropper.destroy();
    cropper = new Cropper(cropImage, {
      aspectRatio: 1,
      viewMode: 1,
      autoCropArea: 1,
      background: false,
      movable: true,
      zoomable: true,
      responsive: true
    });
  }

  cancelCrop.addEventListener("click", closeCropper);

  function closeCropper() {
    cropModal.style.display = "none";
    cropModal.setAttribute("aria-hidden", "true");

    if (cropper) cropper.destroy();
    cropper = null;

    if (cropImage.src.startsWith("blob:")) URL.revokeObjectURL(cropImage.src);

    croppedBlob = null;
    photoInput.value = "";
  }

  saveCropped.addEventListener("click", () => {
    if (!cropper) return;

    const canvas = cropper.getCroppedCanvas({
      width: 600,
      height: 600,
      imageSmoothingQuality: "high"
    });

    canvas.toBlob((blob) => {
      croppedBlob = blob;
      pfAvatar.src = URL.createObjectURL(blob);
      closeCropper();
    }, "image/jpeg", 0.85);
  });

  // ----------------------------
  // FIREBASE AUTH + REALTIME USER DATA
  // ----------------------------
  let currentUser = null;
  let userDocRef = null;

  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "/auth/login.html";
      return;
    }

    currentUser = user;

    emailInput.value = user.email || "";
    displayEmail.textContent = user.email || "";

    // Connect Firestore document
    userDocRef = firebase.firestore().collection("users").doc(user.uid);

    // LIVE LISTENER — auto update UI when Firestore changes
    userDocRef.onSnapshot((doc) => {
      if (!doc.exists) return;

      const data = doc.data() || {};

      // Fill form
      nameInput.value = data.name || "";
      genderSelect.value = data.gender || "";
      phoneInput.value = data.phone || "";
      addressInput.value = data.address || "";

      // Display top section
      displayName.textContent = data.name || "Your name";
      displayEmail.textContent = user.email || "";

      // Photo
      if (data.photoURL) {
        pfAvatar.src = data.photoURL;
      } else {
        pfAvatar.src = "/home/SH-Favicon.png";
      }
    });
  });

  // ----------------------------
  // SAVE PROFILE TO FIRESTORE
  // ----------------------------
  saveBtn.addEventListener("click", async () => {
    if (!currentUser) return toast("User not logged in");

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
      let photoURL = null;

      // If a new cropped image exists → Upload it
      if (croppedBlob) {
        progressWrap.classList.remove("hidden");
        uploadProgress.value = 0;

        const storageRef = firebase.storage().ref();
        const filePath = `profiles/${currentUser.uid}/${Date.now()}.jpg`;
        const fileRef = storageRef.child(filePath);
        const uploadTask = fileRef.put(croppedBlob);

        await new Promise((resolve, reject) => {
          uploadTask.on("state_changed", (snap) => {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            uploadProgress.value = pct;
            progressText.textContent = `Uploading: ${pct}%`;
          }, reject, async () => {
            photoURL = await uploadTask.snapshot.ref.getDownloadURL();
            resolve();
          });
        });
      }

      // Prepare updated data
      const updatedData = {
        name: nameInput.value.trim(),
        phone: phoneInput.value.trim(),
        address: addressInput.value.trim(),
        gender: genderSelect.value
      };

      if (photoURL) updatedData.photoURL = photoURL;

      // Update Firestore
      await userDocRef.set(updatedData, { merge: true });

      // Update Firebase Auth profile (optional)
      try {
        await currentUser.updateProfile({
          displayName: updatedData.name,
          photoURL: updatedData.photoURL || null
        });
      } catch (err) {}

      toast("Profile saved");

      croppedBlob = null;
      progressWrap.classList.add("hidden");

    } catch (err) {
      console.error(err);
      toast("Save failed");
    }

    saveBtn.disabled = false;
    saveBtn.textContent = "Save Profile";
  });

  // ----------------------------
  // PASSWORD RESET
  // ----------------------------
  resetPassBtn.addEventListener("click", async () => {
    const email = emailInput.value;
    if (!email) return toast("Email missing");

    try {
      await firebase.auth().sendPasswordResetEmail(email);
      toast("Password reset sent");
    } catch (err) {
      console.error(err);
      toast("Failed to send reset email");
    }
  });

  // ----------------------------
  // BACK BUTTON
  // ----------------------------
  backBtn.addEventListener("click", () => history.back());

})();