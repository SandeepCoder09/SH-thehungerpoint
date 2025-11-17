const db = firebase.firestore();
const usersRef = db.collection("users");

// USER ID (you can store in localStorage on login)
const USER_ID = localStorage.getItem("USER_ID") || "demo-user";

function showToast(msg){
    alert(msg); // Replace with your toast system if needed
}

// Load existing data
async function loadProfile() {
  const doc = await usersRef.doc(USER_ID).get();
  if (!doc.exists) return;

  const data = doc.data();

  document.getElementById("fullName").value = data.fullName || "";
  document.getElementById("username").value = data.username || "";
  document.getElementById("phone").value = data.phone || "";
}

loadProfile();

// Save data
document.getElementById("saveProfile").addEventListener("click", async () => {
  const fullName = document.getElementById("fullName").value;
  const username = document.getElementById("username").value;
  const phone = document.getElementById("phone").value;
  const password = document.getElementById("password").value;

  if (!fullName || !username || !phone) {
    showToast("Please fill all required fields");
    return;
  }

  await usersRef.doc(USER_ID).set(
    {
      fullName,
      username,
      phone,
      ...(password ? { password: password } : {}) // only update password if user enters
    },
    { merge: true }
  );

  showToast("Profile updated successfully!");
});
