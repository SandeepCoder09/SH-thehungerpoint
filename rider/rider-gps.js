// rider/rider-gps.js
// GPS helper — sends location over socket and updates lastSeen in Firestore.

import { getSocket } from "./socket-client.js";
import { doc, updateDoc } from "./firebase.js";

const DEFAULT_INTERVAL = 5000;

const RIDER_GPS = {
  running: false,
  timer: null,
  interval: DEFAULT_INTERVAL,

  async getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 });
    });
  },

  async sendOnce() {
    try {
      const pos = await this.getCurrentPosition();
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const riderDoc = localStorage.getItem("sh_rider_id");
      const payload = {
        riderId: riderDoc || null,
        lat, lng,
        timestamp: Date.now()
      };

      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit("rider:location", payload);
      }

      // update lastSeen in Firestore
      if (riderDoc) {
        try {
          await updateDoc(doc(window.__FIRESTORE_DB__, "riders", riderDoc), { lastSeen: Date.now(), status: "online" });
        } catch (e) {
          // updateDoc may fail if firestore object not wired to global - fallback to import
          try {
            // if firebase import exists, we use it; else ignore
            // this try/catch is defensive; rider.js will normally handle update
          } catch (_) {}
        }
      }

      return payload;
    } catch (err) {
      throw err;
    }
  },

  start(intervalMs = DEFAULT_INTERVAL) {
    if (this.running) return;
    this.running = true;
    this.interval = intervalMs;

    // immediate send
    this.sendOnce().catch((e) => console.warn("RIDER_GPS immediate send error", e));

    this.timer = setInterval(() => {
      this.sendOnce().catch((e) => console.warn("RIDER_GPS send error", e));
    }, this.interval);
  },

  stop() {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
};

window.RIDER_GPS = RIDER_GPS;
export default RIDER_GPS;
