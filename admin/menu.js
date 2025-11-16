// -----------------------------
// MOBILE SIDEBAR MENU TOGGLE
// -----------------------------

const toggleBtn = document.getElementById("menuToggle");
const sidebar = document.querySelector(".sidebar");

// Open / Close Sidebar
toggleBtn.addEventListener("click", () => {
  sidebar.classList.toggle("active");
});

// Auto-close when clicking outside (mobile)
document.addEventListener("click", (e) => {
  if (window.innerWidth <= 850) {
    if (!sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
      sidebar.classList.remove("active");
    }
  }
});
