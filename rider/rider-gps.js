// rider/rider-gps.js
// GPS helper — separate module (option A). Exposes window.RIDER_GPS with start/stop/getCurrentPosition/sendOnce
import { getSocket } from "./socket-client.js";

const DEFAULT_INTERVAL = 5000; // ms

const RIDER_GPS = {
  watchId: null,
  timer: null,
  interval: DEFAULT_INTERVAL,
  running: false,

  async getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
    });
  },

  start(intervalMs = DEFAULT_INTERVAL) {
    this.interval = intervalMs;
    if (this.running) return;
    this.running = true;

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
  },

  async sendOnce() {
    const socket = getSocket();
    if (!socket || !socket.connected) {
      // no socket, skip
      return;
    }
    try {
      const pos = await this.getCurrentPosition();
      const payload = {
        riderId: localStorage.getItem("sh_rider_id"),
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        timestamp: Date.now()
      };
      socket.emit("rider:location", payload);
      return payload;
    } catch (err) {
      throw err;
    }
  }
};

window.RIDER_GPS = RIDER_GPS;
export default RIDER_GPS;