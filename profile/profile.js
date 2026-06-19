function toggleP(id) {
  const i = document.getElementById(id);
  i.type = i.type === "password" ? "text" : "password";
}

function loadProfile() {
  const p = JSON.parse(localStorage.getItem("sh_profile") || "{}");
  if (p.name) {
    document.getElementById("fullName").value = p.name;
    document.getElementById("dispName").textContent = p.name;
  }
  if (p.email) {
    document.getElementById("email").value = p.email;
    document.getElementById("dispEmail").textContent = p.email;
  }
  if (p.phone) document.getElementById("phone").value = p.phone;
  if (p.gender) document.getElementById("gender").value = p.gender;
  if (p.address) document.getElementById("address").value = p.address;
  if (p.avatar) {
    const img = document.getElementById("avatarImg");
    img.src = p.avatar;
    img.style.display = "block";
    document.getElementById("avatar").firstChild.textContent = "";
  }

  const orders = JSON.parse(localStorage.getItem("sh_orders") || "[]");
  const spent = orders.reduce((s, o) => s + o.total, 0);
  document.getElementById("statOrders").textContent = orders.length;
  document.getElementById("statSpent").textContent = spent;
}

function saveProfile(e) {
  e.preventDefault();
  const name = document.getElementById("fullName").value;
  const email = document.getElementById("email").value;
  const p = {
    name,
    email,
    phone: document.getElementById("phone").value,
    gender: document.getElementById("gender").value,
    address: document.getElementById("address").value,
  };
  const existing = JSON.parse(localStorage.getItem("sh_profile") || "{}");
  localStorage.setItem("sh_profile", JSON.stringify({ ...existing, ...p }));
  if (name) document.getElementById("dispName").textContent = name;
  if (email) document.getElementById("dispEmail").textContent = email;
  const s = document.getElementById("saveSuccess");
  s.style.display = "block";
  setTimeout(() => (s.style.display = "none"), 3000);
}

function handlePhoto(input) {
  const file = input.files[0];
  if (!file) return;
  const bar = document.getElementById("uploadBar");
  const fill = document.getElementById("uploadFill");
  bar.style.display = "block";
  let prog = 0;
  const iv = setInterval(() => {
    prog += 10;
    fill.style.width = prog + "%";
    if (prog >= 100) {
      clearInterval(iv);
      bar.style.display = "none";
    }
  }, 60);
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = document.getElementById("avatarImg");
    img.src = e.target.result;
    img.style.display = "block";
    document.getElementById("avatar").childNodes[0].textContent = "";
    const p = JSON.parse(localStorage.getItem("sh_profile") || "{}");
    p.avatar = e.target.result;
    localStorage.setItem("sh_profile", JSON.stringify(p));
  };
  reader.readAsDataURL(file);
}
loadProfile();
