// profile.js — manage profile, edit name, password reset, logout

async function waitForAuth(){
  return new Promise(res=>{
    const check=()=> (window.auth && window.db)? res(): setTimeout(check,50);
    check();
  });
}

(async()=>{
  await waitForAuth();

  const nameEl=document.getElementById("name");
  const emailEl=document.getElementById("email");
  const saveBtn=document.getElementById("saveBtn");
  const logoutBtn=document.getElementById("logoutBtn");
  const resetBtn=document.getElementById("resetPassBtn");
  const toast=document.getElementById("toast");

  function showToast(msg){
    toast.textContent=msg;
    toast.hidden=false;
    setTimeout(()=>toast.hidden=true,2500);
  }

  const user=auth.currentUser;
  if(user){
    loadUser(user);
  } else {
    auth.onAuthStateChanged(u=>u && loadUser(u));
  }

  async function loadUser(u){
    emailEl.value=u.email;

    if(u.displayName){
      nameEl.value=u.displayName;
    } else {
      const snap=await db.collection("users").doc(u.uid).get();
      if(snap.exists && snap.data().name){
        nameEl.value=snap.data().name;
      }
    }
  }

  saveBtn.addEventListener("click",async()=>{
    const newName=nameEl.value.trim();
    if(!newName) return showToast("Name cannot be empty.");

    try{
      const u=auth.currentUser;
      await u.updateProfile({displayName:newName});

      await db.collection("users").doc(u.uid).set({
        name:newName,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      },{merge:true});

      showToast("Profile updated");
    }catch(err){
      console.error(err);
      showToast("Failed to update");
    }
  });

  resetBtn.addEventListener("click",async()=>{
    try{
      await auth.sendPasswordResetEmail(emailEl.value);
      showToast("Reset link sent to your email");
    }catch(err){
      console.error(err);
      showToast(err.message);
    }
  });

  logoutBtn.addEventListener("click",async()=>{
    try{
      await auth.signOut();
      window.location.href="/auth/login.html";
    }catch(err){
      console.error(err);
      showToast("Logout failed");
    }
  });

})();
