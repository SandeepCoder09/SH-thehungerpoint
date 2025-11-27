// /rider/rider-gps.js
// Rider GPS helper — starts/stops periodic location sends via socket

import { getSocket } from "./socket-client.js";

const DEFAULT_INTERVAL = 5000; // ms

const RIDER_GPS = {
  timer: null,
  interval: DEFAULT_INTERVAL,
  running: false,

  async getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
    });
  },

  async sendOnce({ riderId, orderId } = {}) {
    const sock = getSocket();
    if (!sock || !sock.connected) return;
    try {
      const pos = await this.getCurrentPosition();
      const payload = {
        riderId,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        timestamp: Date.now(),
        orderId: orderId || null
      };
      sock.emit("rider:location", payload);
      return payload;
    } catch (err) {
      throw err;
    }
  },

  start({ riderId, orderId, intervalMs } = {}) {
    if (this.running) return;
    this.running = true;
    this.interval = intervalMs || DEFAULT_INTERVAL;
    // immediate send
    this.sendOnce({ riderId, orderId }).catch((e) => console.warn("gps sendOnce err", e));
    this.timer = setInterval(() => {
      this.sendOnce({ riderId, orderId }).catch((e) => console.warn("gps periodic err", e));
    }, this.interval);
  },

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
  }
};

export default RIDER_GPS;