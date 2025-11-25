// rider-gps.js
import { } from "./firebase.js";

const riderId = localStorage.getItem("riderId");

function buildLocationPayload(pos) {
  return {
    riderId,
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    speed: pos.coords.speed || 0,
    heading: pos.coords.heading || null,
    timestamp: Date.now(),
    orderId: localStorage.getItem("activeOrderId") || null
  };
}

function sendLocation(payload) {
  const API_BASE = window.SH?.API_BASE ?? "";

  if (window.socket && window.socket.connected) {
    window.socket.emit("rider:location", payload);
  } else {
    fetch(API_BASE + "/track/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(() => {});
  }
}

let watchId = null;

function startContinuousTracking() {
  if (watchId !== null) return;

  watchId = navigator.geolocation.watchPosition(
    (pos) => sendLocation(buildLocationPayload(pos)),
    () => {},
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
  );
}

function getSingleLocation() {
  navigator.geolocation.getCurrentPosition(
    (pos) => sendLocation(buildLocationPayload(pos)),
    () => {},
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

function startGPS() {
  if (!riderId) return;
  getSingleLocation();
  startContinuousTracking();
}

document.addEventListener("socket:connected", startGPS);

window.startGPS = startGPS;
window.stopGPS = () => {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
};
