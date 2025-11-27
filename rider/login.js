import { db, doc, getDoc } from "./firebase.js";

const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const msg = document.getElementById("msg");
const btn = document.getElementById("btnLogin");

btn.addEventListener("click", login);

async function login() {
  const email = emailEl.value.trim();
  const pass = passEl.value.trim();
  msg.textContent = "";

  if (!email || !pass) return msg.textContent = "Enter email & password";

  const riderRef = doc(db, "riders", email);
  const snap = await getDoc(riderRef);

  if (!snap.exists()) return msg.textContent = "Account not found";

  const r = snap.data();

  if (!r.approved) return msg.textContent = "Not approved by admin";
  if (pass !== r.passwordHash) return msg.textContent = "Wrong password";

  localStorage.setItem("sh_rider_email", email);
  localStorage.setItem("sh_rider_id", r.riderId);
  localStorage.setItem("sh_rider_name", r.name);

  // redirect
  window.location.href = "./index.html";
}
