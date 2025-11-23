/* -------------------------------------------------------------
   SH Rider — Optimized GPS Tracking Script
------------------------------------------------------------- */

// SOCKET instance comes from /rider/socket-client.js
// Save riderId from localStorage
const riderId = localStorage.getItem("riderId");

// ===================================================================================
// 1) GPS START FUNCTION
// ===================================================================================
function startGPS() {
  if (!riderId) {
    console.error("❌ No riderId found. Cannot start GPS.");
    return;
  }

  console.log("📍 Starting GPS tracking for:", riderId);

  // Get initial location immediately
  getSingleLocation();

  // Start continuous tracking
  startContinuousTracking();
}


// ===================================================================================
// 2) GET SINGLE LOCATION (first fix)
// ===================================================================================
function getSingleLocation() {
  if (!navigator.geolocation) {
    alert("Your device does not support GPS.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const data = buildLocationPayload(pos);
      sendLocation(data);
    },
    (err) => {
      console.error("GPS Error:", err);
      alert("Please allow GPS to start tracking.");
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}


// ===================================================================================
// 3) CONTINUOUS TRACKING (watchPosition)
// ===================================================================================
let watchId = null;

function startContinuousTracking() {
  if (!navigator.geolocation) return;

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const data = buildLocationPayload(pos);
      sendLocation(data);
    },
    (err) => {
      console.warn("⚠ GPS watch error:", err);
      // Automatically try again after 5 seconds
      setTimeout(startContinuousTracking, 5000);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000,
    }
  );
}


// ===================================================================================
// 4) Build payload for server
// ===================================================================================
function buildLocationPayload(pos) {
  return {
    riderId: riderId,
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    speed: pos.coords.speed || 0,
    heading: pos.coords.heading || null,
    accuracy: pos.coords.accuracy,
    timestamp: Date.now(),
    // If you add order assignment later, include:
    orderId: localStorage.getItem("activeOrderId") || null
  };
}


// ===================================================================================
// 5) Send location to backend through socket.io
// ===================================================================================
function sendLocation(data) {
  if (!window.socket) {
    console.warn("Socket not ready, cannot send location.");
    return;
  }

  console.log("📤 Sending rider location:", data);
  window.socket.emit("rider:location", data);
}


// ===================================================================================
// 6) STOP GPS (optional]
// ===================================================================================
function stopGPS() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    console.log("🛑 GPS tracking stopped.");
  }
}


// Make functions globally available
window.startGPS = startGPS;
window.stopGPS = stopGPS;
