// Initialize Firebase config already loaded above as firebase-config.js

const auth = firebase.auth();
const db = firebase.firestore();

function showToast(msg){
  const t = document.getElementById("toast");
  t.innerText = msg;
  t.hidden = false;
  setTimeout(()=> t.hidden = true, 3000);
}

// TOGGLE EYE ICONS
document.querySelectorAll(".toggle-eye").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const field = document.getElementById(btn.dataset.target);

    if(field.type === "password"){
      field.type = "text";
      btn.querySelector("img").src = "/icons/eye.svg";
    } else {
      field.type = "password";
      btn.querySelector("img").src = "/icons/eye-off.svg";
    }
  });
});

// SIGNUP FORM
document.getElementById("signupForm").addEventListener("submit", async (e)=>{
  e.preventDefault();

  const name = name.value.trim();
  const email = document.getElementById("email").value.trim();
  const pass = document.getElementById("password").value;
  const confirm = document.getElementById("confirm").value;
  const legal = document.getElementById("legalCheck").checked;

  if(!legal){
    showToast("Please accept all legal policies.");
    return;
  }

  if(pass !== confirm){
    showToast("Passwords do not match.");
    return;
  }

  try{
    const userCred = await auth.createUserWithEmailAndPassword(email, pass);

    await db.collection("users").doc(userCred.user.uid).set({
      name,
      email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showToast("Account created successfully!");

    setTimeout(()=> window.location.href="/home/index.html", 1500);

  } catch(err){
    showToast(err.message);
  }
});

// GOOGLE SIGNUP
document.getElementById("googleSignup").addEventListener("click", async ()=>{
  try{
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
    showToast("Logged in with Google");
    setTimeout(()=> location.href="/home/index.html", 1500);
  }catch(e){
    showToast(e.message);
  }
});