// /rider/rider-gps.js

const RIDER_ID = window.RIDER_ID || "RIDER_1";
let ORDER_ID = window.ORDER_ID || null;

const EMIT_INTERVAL_MS = 3000;

const socket = createSocket();
socket.emit("rider:join", { riderId: RIDER_ID });

// Throttle function
function throttle(fn, time) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= time) {
      last = now;
      fn(...args);
    }
  };
}

function sendLocation(lat, lng, speed, accuracy) {
  const payload = {
    riderId: RIDER_ID,
    orderId: ORDER_ID,
    lat,
    lng,
    speed,
    accuracy,
    timestamp: new Date().toISOString(),
  };
  socket.emit("rider:location", payload);
}

// Live GPS tracking
if ("geolocation" in navigator) {
  navigator.geolocation.watchPosition(
    throttle((pos) => {
      const { latitude: lat, longitude: lng, accuracy, speed } = pos.coords;
      sendLocation(lat, lng, speed || 0, accuracy || 0);
    }, EMIT_INTERVAL_MS),
    (err) => console.error("GPS Error:", err),
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
  );
}
