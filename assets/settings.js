/* ----------------------------------------------------
   SETTINGS PAGE — FULL WORKING JS
---------------------------------------------------- */

// Wait for Firebase to load
function waitFirebase() {
  return new Promise(resolve => {
    const check = () => {
      if (window.firebase && window.auth && window.db) resolve();
      else setTimeout(check, 40);
    };
    check();
  });
}

(async () => {
  await waitFirebase();

  const avatarImg = document.getElementById("avatarImg");
  const avatarEditBtn = document.getElementById("avatarEdit");
  const fileInput = document.getElementById("avatarFile");

  const cropModal = document.getElementById("cropModal");
  const cropArea = document.getElementById("cropArea");
  const cropSave = document.getElementById("cropSave");
  const cropCancel = document.getElementById("cropCancel");

  const userNameEl = document.getElementById("userName");
  const userEmailEl = document.getElementById("userEmail");

  let cropper = null;

  /* ----------------------------------------------
     LOAD USER DATA
  ---------------------------------------------- */
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      location.href = "/auth/login.html";
      return;
    }

    userEmailEl.textContent = user.email;

    const snap = await db.collection("users").doc(user.uid).get();
    const data = snap.data() || {};

    userNameEl.textContent = data.name || "User Name";

    if (data.photoURL) {
      avatarImg.src = data.photoURL;
    }
  });

  /* ----------------------------------------------
     OPEN FILE PICKER
  ---------------------------------------------- */
  avatarEditBtn.addEventListener("click", () => {
    fileInput.click();
  });

  /* ----------------------------------------------
     SHOW CROP UI
  ---------------------------------------------- */
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);

    cropModal.classList.add("active");
    cropArea.innerHTML = `<img id="cropImg" src="${url}">`;

    const img = document.getElementById("cropImg");

    setTimeout(() => {
      cropper = new Cropper(img, {
        aspectRatio: 1,
        viewMode: 2,
        dragMode: "move",
        guides: false,
        center: true,
        background: false,
        zoomable: true,
        scalable: false,
        autoCropArea: 1,
        ready() {
          const mask = document.createElement("div");
          mask.className = "circle-mask-250";
          cropArea.appendChild(mask);
        }
      });
    }, 200);
  });

  /* ----------------------------------------------
     SAVE CROPPED IMAGE
  ---------------------------------------------- */
  cropSave.addEventListener("click", async () => {
    if (!cropper) return;

    const canvas = cropper.getCroppedCanvas({
      width: 250,
      height: 250,
      imageSmoothingQuality: "high"
    });

    canvas.toBlob(async (blob) => {

      const user = auth.currentUser;
      const storageRef = firebase.storage().ref(`users/${user.uid}/profile.jpg`);

      await storageRef.put(blob);
      const url = await storageRef.getDownloadURL();

      await db.collection("users").doc(user.uid).update({
        photoURL: url,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      avatarImg.src = url;

      cropModal.classList.remove("active");
      cropper.destroy();
      cropper = null;
    });
  });

  /* ----------------------------------------------
     CANCEL CROP
  ---------------------------------------------- */
  cropCancel.addEventListener("click", () => {
    cropModal.classList.remove("active");
    if (cropper) cropper.destroy();
    cropper = null;
  });

  /* ----------------------------------------------
     LOGOUT
  ---------------------------------------------- */
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await auth.signOut();
    location.href = "/auth/login.html";
  });

  /* ----------------------------------------------
     PUSH NOTIFICATIONS (UI ONLY)
  ---------------------------------------------- */
  const toggle = document.getElementById("pushToggle");
  toggle.addEventListener("click", () => {
    toggle.classList.toggle("active");
    // (Optional) Save preference in Firestore
  });

})();