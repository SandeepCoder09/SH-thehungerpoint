// rider/rider-gps.js
let gpsTimer = null;
let activeOrderId = null;
let lastSent = 0;
const GPS_INTERVAL = 2000; // 2s

/**
 * startGPS(orderId, onUpdate)
 * onUpdate(payload) will be called with { riderId, orderId, lat, lng, timestamp }
 */
export function startGPS(orderId, onUpdate) {
  activeOrderId = orderId;
  if (gpsTimer !== null) {
    console.log("GPS already running");
    return;
  }

  updateGPS(onUpdate); // immediate
  gpsTimer = setInterval(() => updateGPS(onUpdate), GPS_INTERVAL);
  console.log("GPS started for", orderId);
}

export function stopGPS() {
  if (gpsTimer !== null) {
    clearInterval(gpsTimer);
    gpsTimer = null;
    console.log("GPS stopped");
  }
  activeOrderId = null;
}

function updateGPS(onUpdate) {
  if (!navigator.geolocation) return console.warn("Geolocation unsupported");

  const now = Date.now();
  if (now - lastSent < GPS_INTERVAL) return;
  lastSent = now;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const payload = {
        riderId: localStorage.getItem("sh_rider_id"),
        orderId: activeOrderId,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: now
      };
      if (onUpdate) onUpdate(payload);
    },
    (err) => {
      console.warn("GPS error", err);
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
  );
}