// profile.js — auto-save & load full profile data

async function waitForAuth(){
  return new Promise(res=>{
    const check=()=> (window.auth && window.db && window.firebase)? res(): setTimeout(check,50);
    check();
  });
}

(async()=>{
  await waitForAuth();

  const nameEl = document.getElementById("name");
  const emailEl = document.getElementById("email");
  const phoneEl = document.getElementById("phone");
  const addressEl = document.getElementById("address");
  const photoImg = document.getElementById("photoImg");
  const photoInput = document.getElementById("photoInput");
  const changePhotoBtn = document.getElementById("changePhotoBtn");

  const saveBtn = document.getElementById("saveBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const resetBtn = document.getElementById("resetPassBtn");
  const toast = document.getElementById("toast");

  function showToast(msg){
    toast.textContent = msg;
    toast.hidden = false;
    setTimeout(()=>toast.hidden=true,2500);
  }

  const user = auth.currentUser;

  // Load profile data
  loadUserData(user);

  async function loadUserData(u){
    emailEl.value = u.email;

    const doc = await db.collection("users").doc(u.uid).get();

    if(doc.exists){
      const data = doc.data();
      nameEl.value = data.name || "";
      phoneEl.value = data.phone || "";
      addressEl.value = data.address || "";

      if(data.photoURL){
        photoImg.src = data.photoURL;
      }
    } else {
      // Auto create empty profile
      await db.collection("users").doc(u.uid).set({
        name: u.displayName || "",
        email: u.email,
        phone: "",
        address: "",
        photoURL: "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  }

  // Change profile photo
  changePhotoBtn.addEventListener("click", ()=>{
    photoInput.click();
  });

  photoInput.addEventListener("change", async (e)=>{
    const file = e.target.files[0];
    if(!file) return;

    const ref = firebase.storage().ref(`users/${auth.currentUser.uid}/profile.jpg`);
    await ref.put(file);
    const url = await ref.getDownloadURL();

    photoImg.src = url;

    await db.collection("users").doc(auth.currentUser.uid).update({
      photoURL: url
    });

    showToast("Photo updated!");
  });

  // Save full profile
  saveBtn.addEventListener("click", async ()=>{
    const u = auth.currentUser;

    const name = nameEl.value.trim();
    const phone = phoneEl.value.trim();
    const address = addressEl.value.trim();

    await u.updateProfile({ displayName: name });

    await db.collection("users").doc(u.uid).set({
      name,
      email: u.email,
      phone,
      address,
      photoURL: photoImg.src,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    },{ merge:true });

    showToast("Profile saved!");
  });

  // Reset password
  resetBtn.addEventListener("click", async ()=>{
    await auth.sendPasswordResetEmail(emailEl.value);
    showToast("Reset email sent!");
  });

  // Logout
  logoutBtn.addEventListener("click", async ()=>{
    await auth.signOut();
    window.location.href = "/auth/login.html";
  });

})();
