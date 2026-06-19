function switchTab(t) {
  ["login", "register"].forEach((x) => {
    document
      .getElementById("tab" + x.charAt(0).toUpperCase() + x.slice(1))
      .classList.toggle("active", x === t);
    document
      .getElementById("panel" + x.charAt(0).toUpperCase() + x.slice(1))
      .classList.toggle("active", x === t);
  });
}
function toggleP(id) {
  const i = document.getElementById(id);
  i.type = i.type === "password" ? "text" : "password";
}
function checkStrength(v) {
  let s = 0;
  if (v.length >= 8) s++;
  if (/[A-Z]/.test(v)) s++;
  if (/[0-9]/.test(v)) s++;
  if (/[^A-Za-z0-9]/.test(v)) s++;
  const f = document.getElementById("strengthFill");
  const c = ["transparent", "#EF4444", "#F59E0B", "#3B82F6", "#22C55E"][s];
  f.style.width = s * 25 + "%";
  f.style.background = c;
}
function doLogin(e) {
  e.preventDefault();
  const p = {
    email: document.getElementById("loginId").value,
    name: "Guest User",
  };
  localStorage.setItem("sh_profile", JSON.stringify(p));
  window.location.href = "../home/index.html";
}
function doRegister(e) {
  e.preventDefault();
  const p = {
    name:
      document.getElementById("regFirst").value +
      " " +
      document.getElementById("regLast").value,
    email: document.getElementById("regEmail").value,
    phone: document.getElementById("regPhone").value,
  };
  localStorage.setItem("sh_profile", JSON.stringify(p));
  window.location.href = "../home/index.html";
}
function googleLogin() {
  window.location.href = "../home/index.html";
}
