// protect.js - Prevent access if user is not logged in

// Wait until Firebase is ready
document.addEventListener("DOMContentLoaded", () => {
  firebase.auth().onAuthStateChanged((user) => {
    if (!user) {
      // User NOT logged in → redirect to login
      window.location.href = "/auth/login.html";
    }
  });
});
