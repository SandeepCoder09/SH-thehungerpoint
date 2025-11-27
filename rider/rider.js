// rider/rider.js
import {
  db,
  doc,
  getDoc,
  updateDoc,
  collection,
  onSnapshot,
  storage,
  storageRef,
  uploadBytes,
  getDownloadURL,
  serverTimestamp
} from "./firebase.js";

import { connectSocket, getSocket } from "./socket-client.js";
import { startGPS, stopGPS } from "./rider-gps.js";

/* ---------- CONFIG / AUTH ---------- */
const API_BASE = window.SH?.API_BASE ?? "https://sh-thehungerpoint.onrender.com";
const riderId = localStorage.getItem("sh_rider_id");
const token   = localStorage.getItem("sh_rider_token");

if (!riderId || !token) {
  window.location.href = "./login.html";
}

/* ---------- DOM ---------- */
const avatarEl     = document.getElementById("riderAvatar");
const nameEl       = document.getElementById("riderName");
const emailEl      = document.getElementById("riderEmail");
const idEl         = document.getElementById("riderId");
const statusDot    = document.getElementById("statusDot");
const statusText   = document.getElementById("statusText");
const connStatus   = document.getElementById("connStatus");
const ordersWrap   = document.getElementById("orders");
const activeOrder  = document.getElementById("activeOrder");
const lastSeenEl   = document.getElementById("lastSeen");

const btnLogout    = document.getElementById("btnLogout");
const btnAccept    = document.getElementById("btnAccept");
const btnStart     = document.getElementById("btnStart");
const btnDeliver   = document.getElementById("btnDeliver");

const fileAvatar   = document.getElementById("fileAvatar");
const btnUpload    = document.getElementById("btnUploadAvatar");
const uploadMsg    = document.getElementById("uploadMsg");

/* ---------- MAP ---------- */
const map = L.map("map", { zoomControl: true }).setView([23.0, 82.0], 6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "" }).addTo(map);
let riderMarker = null;
let customerMarkers = new Map();

function setRiderMarker(lat, lng) {
  if (!riderMarker) riderMarker = L.marker([lat, lng], { title: "You" }).addTo(map);
  else riderMarker.setLatLng([lat, lng]);
}
function setCustomerMarker(orderId, lat, lng) {
  if (customerMarkers.has(orderId)) customerMarkers.get(orderId).setLatLng([lat, lng]);
  else {
    const m = L.marker([lat, lng], { title: "Customer" }).addTo(map);
    customerMarkers.set(orderId, m);
  }
}

/* ---------- STATE ---------- */
let socket = null;
let ordersState = {}; // orderId -> order object
let selectedOrderId = null;

/* ---------- UTIL ---------- */
function toast(msg, t=2200) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(()=> el.classList.add("hidden"), t);
}
function fmtTime(ts){
  if(!ts) return "—";
  try{ return new Date(ts).toLocaleString(); } catch(e){ return String(ts); }
}

/* ---------- PROFILE: load and show ---------- */
async function loadProfile(){
  try{
    const ref = doc(db, "riders", riderId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      console.warn("Rider doc not found:", riderId);
      nameEl.textContent = "Rider";
      emailEl.textContent = "";
      idEl.textContent = `ID: ${riderId}`;
      return;
    }
    const data = snap.data();

    // Support multiple possible field names for avatar
    const avatarUrl = data.avatar || data.photoURL || data.photo || data.avatarURL || null;

    nameEl.textContent = data.name || data.displayName || data.fullName || "Rider";
    emailEl.textContent = data.email || data.contact || "";
    idEl.textContent = `ID: ${riderId}`;

    if (avatarUrl) avatarEl.src = avatarUrl;
    else avatarEl.src = "/home/SH-Favicon.png";

    // show last seen
    if (data.lastSeen) lastSeenEl.textContent = fmtTime(data.lastSeen);
    else lastSeenEl.textContent = "—";

  } catch(err){
    console.error("loadProfile err",err);
  }
}

/* ---------- AUTO ONLINE/OFFLINE ---------- */
async function setOnlineStatus(isOnline){
  try{
    const ref = doc(db, "riders", riderId);
    await updateDoc(ref, {
      status: isOnline ? "online" : "offline",
      lastSeen: isOnline ? serverTimestamp() : serverTimestamp()
    });
    statusDot.classList.toggle("online", isOnline);
    statusDot.classList.toggle("offline", !isOnline);
    statusText.textContent = isOnline ? "Online" : "Offline";
    if(!isOnline){
      // update lastSeen readable field
      const snap = await getDoc(ref);
      if (snap.exists() && snap.data().lastSeen) lastSeenEl.textContent = fmtTime(snap.data().lastSeen.seconds ? snap.data().lastSeen.seconds*1000 : snap.data().lastSeen);
    }
  }catch(err){
    console.warn("setOnlineStatus failed",err);
  }
}

// auto-online when page visible; offline on unload
window.addEventListener("focus", ()=> setOnlineStatus(true));
window.addEventListener("visibilitychange", ()=> {
  if (document.hidden) setOnlineStatus(false);
  else setOnlineStatus(true);
});
window.addEventListener("beforeunload", ()=> {
  try { setOnlineStatus(false); stopGPS(); } catch(e){}
});

/* ---------- SOCKET ---------- */
async function initSocket(){
  socket = await connectSocket({ token: localStorage.getItem("sh_rider_token"), riderId });
  if (socket && socket.connected){
    connStatus.textContent = "connected";
    connStatus.style.color = "lightgreen";
  } else {
    connStatus.textContent = "disconnected";
    connStatus.style.color = "crimson";
  }

  socket.on("order:status", (p) => {
    if (!p || !p.orderId) return;
    ordersState[p.orderId] = ordersState[p.orderId] || {};
    ordersState[p.orderId].status = p.status;
    renderOrders();
  });

  socket.on("rider:location", (p) => {
    // optionally handle (not usually used here)
  });
}

/* ---------- ORDERS: listen Firestore & render ---------- */
const ordersCol = collection(db, "orders");
onSnapshot(ordersCol, (snap) => {
  snap.docChanges().forEach(ch => {
    const id = ch.doc.id;
    const data = ch.doc.data();
    ordersState[id] = { orderId: id, ...data };
  });
  renderOrders();
});

function renderOrders(){
  ordersWrap.innerHTML = "";
  const arr = Object.values(ordersState).sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
  if (!arr.length) { ordersWrap.innerHTML = "<div class='muted'>No orders</div>"; return; }

  for (const o of arr){
    // show unassigned + assigned to this rider
    if (o.riderId && o.riderId !== riderId && o.riderId !== null) continue;

    const div = document.createElement("div");
    div.className = "order-card";
    const items = (o.items||[]).map(i=> `${i.name}×${i.qty}`).join(", ");
    div.innerHTML = `<div><div style="font-weight:700">${o.orderId}</div><div class='small muted'>${o.status||'new'}</div><div class='small'>${items}</div></div>`;
    div.onclick = () => selectOrder(o.orderId);
    ordersWrap.appendChild(div);
  }
}

function selectOrder(orderId){
  selectedOrderId = orderId;
  activeOrder.textContent = orderId;
  const o = ordersState[orderId] || {};
  if (o.customerLoc) {
    setCustomerMarker(orderId, o.customerLoc.lat, o.customerLoc.lng);
  }
  if (riderMarker && o.customerLoc) {
    const group = new L.featureGroup([riderMarker, customerMarkers.get(orderId)]);
    map.fitBounds(group.getBounds().pad(0.25));
  }
}

/* ---------- ACTIONS ---------- */
btnAccept.addEventListener("click", async ()=>{
  if (!selectedOrderId) return toast("Select order first");
  try {
    await updateDoc(doc(db, "orders", selectedOrderId), { riderId, status: "accepted", acceptedAt: Date.now() });
    socket?.emit("order:status", { orderId: selectedOrderId, status: "accepted" });
    toast("Order accepted");
  } catch(e){ console.error(e); toast("Accept failed") }
});

btnStart.addEventListener("click", async ()=>{
  if (!selectedOrderId) return toast("Select order first");
  try {
    await updateDoc(doc(db, "orders", selectedOrderId), { status: "picked", pickedAt: Date.now() });
    socket?.emit("order:status", { orderId: selectedOrderId, status: "picked" });

    // start GPS with callback that emits via socket and updates map
    startGPS(selectedOrderId, (payload) => {
      setRiderMarker(payload.lat, payload.lng);
      socket?.emit("rider:location", payload);
    });

    toast("Trip started");
  } catch(e){ console.error(e); toast("Start trip failed") }
});

btnDeliver.addEventListener("click", async ()=>{
  if (!selectedOrderId) return toast("Select order first");
  try {
    stopGPS();
    await updateDoc(doc(db, "orders", selectedOrderId), { status: "delivered", deliveredAt: Date.now() });
    socket?.emit("order:status", { orderId: selectedOrderId, status: "delivered" });
    toast("Marked delivered");
  } catch(e){ console.error(e); toast("Deliver failed") }
});

btnLogout.addEventListener("click", async ()=>{
  try {
    await setOnlineOfflineAndLastSeen(false);
  } catch(e){/*ignore*/ }
  localStorage.removeItem("sh_rider_token");
  localStorage.removeItem("sh_rider_id");
  window.location.href = "./login.html";
});

/* helper used by logout/unload to set offline + lastSeen */
async function setOnlineOfflineAndLastSeen(isOnline){
  try{
    const ref = doc(db, "riders", riderId);
    await updateDoc(ref, { status: isOnline ? "online" : "offline", lastSeen: serverTimestamp() });
  }catch(e){ console.warn("setOnlineOfflineAndLastSeen err",e) }
}

/* ---------- PROFILE UPLOAD ---------- */
btnUpload.addEventListener("click", async ()=>{
  const f = fileAvatar.files && fileAvatar.files[0];
  if (!f) return uploadMsg.textContent = "Select a file first";
  uploadMsg.textContent = "Uploading...";
  try{
    const path = `riders/${riderId}/avatar_${Date.now()}`;
    const sRef = storageRef(storage, path);
    const snap = await uploadBytes(sRef, f);
    const url = await getDownloadURL(sRef);

    // update rider doc with avatar (supporting multiple possible field names)
    const ref = doc(db, "riders", riderId);
    await updateDoc(ref, { avatar: url, photoURL: url });

    avatarEl.src = url;
    uploadMsg.textContent = "Uploaded";
    toast("Profile photo updated");
  }catch(err){
    console.error("upload err",err);
    uploadMsg.textContent = "Upload failed";
  }
});

/* ---------- INIT: load profile, socket, set online ---------- */
(async function init(){
  await loadProfile();
  await initSocket();
  await setOnlineStatus(true);

  // try get current location once
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((p)=>{
      setRiderMarker(p.coords.latitude, p.coords.longitude);
      map.setView([p.coords.latitude, p.coords.longitude], 13);
    }, ()=>{}, { enableHighAccuracy: true });
  }
})();