const auth = firebase.auth();

// 👉 Replace with your admin email
const ADMIN_EMAIL = "YOUR_ADMIN_EMAIL@gmail.com";

document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const pass = document.getElementById("password").value;

  try {
    const user = await auth.signInWithEmailAndPassword(email, pass);

    if (email !== ADMIN_EMAIL) {
      alert("Unauthorized user!");
      auth.signOut();
      return;
    }

    // Save login
    localStorage.setItem("adminAuth", "true");

    window.location.href = "index.html";
  } catch (err) {
    document.getElementById("errorMsg").innerText = err.message;
  }
});
