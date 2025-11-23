/* rider/rider-gps.js - optimized GPS tracking */
// Exposes window.startGPS() and window.stopGPS()
const riderId = localStorage.getItem("riderId");

function buildLocationPayload(pos) {
  return {
    riderId,
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    speed: pos.coords.speed || 0,
    heading: pos.coords.heading || null,
    accuracy: pos.coords.accuracy,
    timestamp: Date.now(),
    orderId: localStorage.getItem("activeOrderId") || null
  };
}

function sendLocation(data) {
  if (window.socket && window.socket.connected) {
    window.socket.emit("rider:location", data);
  } else {
    // fallback: POST to API if socket not ready
    fetch((window.SH?.API_BASE ?? "") + "/track/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    }).catch(()=>{});
  }
}

let watchId = null;

function getSingleLocation() {
  if (!navigator.geolocation) {
    console.error("GPS not supported");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const payload = buildLocationPayload(pos);
      sendLocation(payload);
    },
    (err) => {
      console.warn("getCurrentPosition error", err);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function startContinuousTracking() {
  if (!navigator.geolocation) return;
  if (watchId !== null) return; // already running

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const payload = buildLocationPayload(pos);
      sendLocation(payload);
    },
    (err) => {
      console.warn("watchPosition error", err);
      // retry after short delay
      setTimeout(() => {
        if (watchId === null) startContinuousTracking();
      }, 5000);
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
  );
}

function startGPS() {
  if (!riderId) {
    console.error("No riderId, cannot start GPS");
    return;
  }
  getSingleLocation();
  startContinuousTracking();
  console.log("GPS started for", riderId);
}

function stopGPS() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    console.log("GPS stopped");
  }
}

window.startGPS = startGPS;
window.stopGPS = stopGPS;
