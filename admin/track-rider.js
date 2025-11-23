// /admin/track-rider.js

const socket = createSocket();
socket.emit("admin:join", { admin: true });

const map = L.map("map").setView([22.9734, 78.6569], 5);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

const riders = new Map();

function updateRider(data) {
  const { riderId, lat, lng, speed, orderId, timestamp } = data;
  if (!riderId) return;

  let rec = riders.get(riderId);

  if (!rec) {
    const marker = L.marker([lat, lng]).addTo(map);
    marker.bindPopup(`Rider: ${riderId}`);
    rec = { marker, last: data };
    riders.set(riderId, rec);
    document.getElementById("rider-count").textContent = riders.size;
  } else {
    rec.marker.setLatLng([lat, lng]);
    rec.last = data;
    rec.marker.bindPopup(`
      Rider: ${riderId}<br>
      Order: ${orderId || "-"}<br>
      Speed: ${speed || 0} m/s<br>
      Time: ${new Date(timestamp).toLocaleTimeString()}
    `);
  }
}

socket.on("admin:riderLocation", (data) => updateRider(data));

socket.on("admin:initialRiders", (list) => {
  (list || []).forEach(updateRider);
});
