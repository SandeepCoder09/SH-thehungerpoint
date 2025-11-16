// menu.js — mobile sidebar toggle + active link handling
//-------------------------------------------------------

const toggleBtn = document.getElementById("menuToggle");
const sidebar = document.querySelector(".sidebar");
const navLinks = document.querySelectorAll(".sidebar nav a");

// Toggle sidebar on mobile
if (toggleBtn) {
  toggleBtn.addEventListener("click", () => {
    sidebar.classList.toggle("active");
  });
}

// Close sidebar when clicking outside (mobile only)
document.addEventListener("click", (e) => {
  if (window.innerWidth <= 850) {
    if (!sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
      sidebar.classList.remove("active");
    }
  }
});

// Set active link and change page header
document.addEventListener("DOMContentLoaded", () => {
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      // Remove old active class
      navLinks.forEach((l) => l.classList.remove("active"));
      
      // Add active to clicked
      link.classList.add("active");

      // Update page title if header exists
      const topbarTitle = document.querySelector(".topbar h1");
      if (topbarTitle) topbarTitle.textContent = link.textContent.trim();

      // Auto-close sidebar on mobile
      if (window.innerWidth <= 850) {
        sidebar.classList.remove("active");
      }

      // Handle logout
      if (link.id === "logoutBtn") {
        localStorage.removeItem("admin_jwt");
        window.location.href = "login.html";
      }
    });
  });
});
