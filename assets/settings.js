/* ======================================================
      SETTINGS.JS — FULL WORKING VERSION
======================================================*/

/* -------------------------------
      Firebase references
--------------------------------*/
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

/* -------------------------------
      UI Elements
--------------------------------*/
const hdrName = document.getElementById("hdrName");
const hdrEmail = document.getElementById("hdrEmail");
const hdrAvatar = document.getElementById("hdrAvatar");
const logoutItem = document.getElementById("logoutItem");
const pushToggle = document.getElementById("pushToggle");

const pwSheet = document.getElementById("pwSheet");
const newPass = document.getElementById("newPass");
const confirmPass = document.getElementById("confirmPass");

/* -------------------------------
      PHOTO CROP ELEMENTS
--------------------------------*/
const settingsPhotoInput = document.getElementById("settingsPhotoInput");
const settingsCropModal = document.getElementById("settingsCropModal");
const settingsCropImage = document.getElementById("settingsCropImage");

let settingsCropper = null;

/* ======================================================
      LOAD USER DATA
======================================================*/

auth.onAuthStateChanged(async (user) => {
    if (!user) return;

    hdrEmail.textContent = user.email;

    const docRef = db.collection("users").doc(user.uid);
    const snap = await docRef.get();

    if (snap.exists) {
        const data = snap.data();
        hdrName.textContent = data.name || "User";

        if (data.photoURL) {
            hdrAvatar.src = data.photoURL;
        }
    }
});

/* ======================================================
      CHANGE PASSWORD SHEET
======================================================*/

function openChangePassword() {
    pwSheet.classList.add("open");
}
window.openChangePassword = openChangePassword;

function closePwSheet() {
    pwSheet.classList.remove("open");
    newPass.value = "";
    confirmPass.value = "";
}
window.closePwSheet = closePwSheet;

async function savePassword() {
    const user = auth.currentUser;
    if (!user) return;

    if (!newPass.value.trim() || newPass.value !== confirmPass.value) {
        return alert("Passwords do not match.");
    }

    try {
        await user.updatePassword(newPass.value.trim());
        alert("Password updated successfully.");
        closePwSheet();
    } catch (err) {
        alert(err.message);
    }
}
window.savePassword = savePassword;

/* ======================================================
      LOGOUT
======================================================*/

logoutItem.addEventListener("click", async () => {
    await auth.signOut();
    window.location.href = "/auth/login.html";
});

/* ======================================================
      PUSH NOTIFICATIONS (LOCAL SAVE)
======================================================*/

pushToggle.addEventListener("click", () => {
    pushToggle.classList.toggle("active");
    const isOn = pushToggle.classList.contains("active");
    localStorage.setItem("pushEnabled", isOn ? "1" : "0");
});

// Load saved toggle state
if (localStorage.getItem("pushEnabled") === "1") {
    pushToggle.classList.add("active");
}

/* ======================================================
      PHOTO UPLOAD + CROPPER
======================================================*/

// When user clicks pencil
function openSettingsPhotoPicker() {
    settingsPhotoInput.click();
}
window.openSettingsPhotoPicker = openSettingsPhotoPicker;

// When file selected
settingsPhotoInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    settingsCropImage.src = url;

    if (settingsCropper) settingsCropper.destroy();

    settingsCropper = new Cropper(settingsCropImage, {
        aspectRatio: 1,
        viewMode: 1,
        dragMode: "move",
        autoCropArea: 1
    });

    settingsCropModal.classList.add("active");
});

/* Close cropping modal */
function closeSettingsCropper() {
    settingsCropModal.classList.remove("active");

    if (settingsCropper) {
        settingsCropper.destroy();
        settingsCropper = null;
    }
}
window.closeSettingsCropper = closeSettingsCropper;

/* Save cropped image */
async function saveSettingsCroppedImage() {
    const user = auth.currentUser;
    if (!user || !settingsCropper) return;

    const canvas = settingsCropper.getCroppedCanvas({
        width: 500,
        height: 500,
        fillColor: "#fff"
    });

    canvas.toBlob(async (blob) => {
        const ref = storage.ref(`profile/${user.uid}.jpg`);
        await ref.put(blob);

        const url = await ref.getDownloadURL();

        // Update Firestore
        await db.collection("users").doc(user.uid).set(
            { photoURL: url },
            { merge: true }
        );

        // Update UI
        hdrAvatar.src = url;

        closeSettingsCropper();
        alert("Profile photo updated!");
    }, "image/jpeg");
}
window.saveSettingsCroppedImage = saveSettingsCroppedImage;

/* ======================================================
      NAVIGATION
======================================================*/

function openProfile() {
    window.location.href = "/profile/index.html";
}
window.openProfile = openProfile;
