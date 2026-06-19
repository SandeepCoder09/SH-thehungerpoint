function loadUserCard() {
  const p = JSON.parse(localStorage.getItem("sh_profile") || "{}");
  if (p.name) document.getElementById("settName").textContent = p.name;
  if (p.email) document.getElementById("settEmail").textContent = p.email;
  if (p.avatar) {
    const img = document.getElementById("settAvatarImg");
    img.src = p.avatar;
    img.style.display = "block";
    document.getElementById("settAvatar").childNodes[0].textContent = "";
  }
}
function loadToggles() {
  const prefs = JSON.parse(localStorage.getItem("sh_prefs") || "{}");
  if (prefs.notif) document.getElementById("notifToggle").classList.add("on");
  if (prefs.email) document.getElementById("emailToggle").classList.add("on");
}
function toggleSetting(key) {
  const el = document.getElementById(key + "Toggle");
  el.classList.toggle("on");
  const prefs = JSON.parse(localStorage.getItem("sh_prefs") || "{}");
  prefs[key] = el.classList.contains("on");
  localStorage.setItem("sh_prefs", JSON.stringify(prefs));
}
function openPassModal() {
  document.getElementById("passModal").classList.add("open");
}
function closePassModal(e) {
  if (!e || e.target === document.getElementById("passModal"))
    document.getElementById("passModal").classList.remove("open");
}
function changePass() {
  alert("Password updated successfully!");
  closePassModal();
}
function showLogout() {
  document.getElementById("logoutConfirm").classList.add("open");
}
function closeLogout(e) {
  if (!e || e.target === document.getElementById("logoutConfirm"))
    document.getElementById("logoutConfirm").classList.remove("open");
}
function logout() {
  localStorage.removeItem("sh_profile");
  window.location.href = "../auth/auth.html";
}
function shareApp() {
  if (navigator.share)
    navigator
      .share({
        title: "SH - The Hunger Point",
        text: "Best momos in Fatehpur!",
        url: window.location.href,
      })
      .catch(() => {});
}
loadUserCard();
loadToggles();
