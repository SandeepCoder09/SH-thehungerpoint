// rider/rider-gps.js
// High-accuracy 2-second GPS module for new rider.js + socket system

import { getSocket } from "./socket-client.js";

let gpsTimer = null;
let activeOrderId = null;
let lastSent = 0;

const GPS_INTERVAL = 2000; // 2 seconds

/**
 * Start GPS tracking for the selected order
 */
export function startGPS(orderId, onUpdate) {
  activeOrderId = orderId;

  if (gpsTimer !== null) {
    console.log("GPS already running");
    return;
  }

  console.log("🚀 GPS started for order:", orderId);

  // Send first update immediately
  updateGPS(onUpdate);

  // Then auto-update every 2 seconds
  gpsTimer = setInterval(() => updateGPS(onUpdate), GPS_INTERVAL);
}

/**
 * Stop GPS tracking
 */
export function stopGPS() {
  if (gpsTimer !== null) {
    clearInterval(gpsTimer);
    gpsTimer = null;
    console.log("🛑 GPS stopped");
  }
  activeOrderId = null;
}

/**
 * Internal function — sends one GPS update
 */
async function updateGPS(onUpdate) {
  if (!navigator.geolocation) {
    console.warn("❌ Geolocation not supported");
    return;
  }

  const now = Date.now();
  if (now - lastSent < GPS_INTERVAL) return;
  lastSent = now;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      const payload = {
        riderId: localStorage.getItem("sh_rider_id"),
        orderId: activeOrderId,
        lat,
        lng,
        timestamp: now
      };

      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit("rider:location", payload);
      }

      // Update rider map marker (callback from rider.js)
      if (onUpdate) onUpdate(payload);
    },
    (err) => {
      console.warn("GPS ERR:", err);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000
    }
  );
}