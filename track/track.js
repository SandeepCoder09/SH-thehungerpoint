// /track/track.js

const ORDER_ID = window.ORDER_ID;
const USER_LAT = window.USER_LAT;
const USER_LNG = window.USER_LNG;

const socket = createSocket();
socket.emit("order:join", { orderId: ORDER_ID });

const map = L.map("map").setView([USER_LAT, USER_LNG], 14);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

const userMarker = L.marker([USER_LAT, USER_LNG]).addTo(map);

let riderMarker = null;
let line = null;

// Haversine formula
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcETA(distance, speed) {
  const fallback = 7.5;
  const s = speed > 0 ? speed : fallback;
  return Math.round(distance / s);
}

socket.on("order:riderLocation", (data) => {
  if (data.orderId !== ORDER_ID) return;

  const { lat, lng, speed, timestamp } = data;

  if (!riderMarker) {
    riderMarker = L.marker([lat, lng]).addTo(map);
  } else {
    riderMarker.setLatLng([lat, lng]);
  }

  const dist = haversine(lat, lng, USER_LAT, USER_LNG);
  const seconds = calcETA(dist, speed);

  document.getElementById("distance").innerText = (dist / 1000).toFixed(2) + " km";
  document.getElementById("eta").innerText = Math.round(seconds / 60) + " min";
  document.getElementById("rider-last-update").innerText = new Date(timestamp).toLocaleTimeString();

  if (!line) {
    line = L.polyline([[lat, lng], [USER_LAT, USER_LNG]]).addTo(map);
  } else {
    line.setLatLngs([[lat, lng], [USER_LAT, USER_LNG]]);
  }
});
