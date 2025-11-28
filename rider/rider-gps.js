// /rider/rider-gps.js
import { getSocket } from "/rider/socket-client.js";

const DEFAULT_INTERVAL = 5000; // 5s

const RIDER_GPS = {
  _timer: null,
  _interval: DEFAULT_INTERVAL,
  running: false,

  async getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("Geolocation unsupported"));
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000
      });
    });
  },

  async sendOnce(extra = {}) {
    const s = getSocket();
    if (!s || !s.connected) return null;
    try {
      const pos = await this.getCurrentPosition();
      const payload = {
        riderId: localStorage.getItem("sh_rider_id") || localStorage.getItem("sh_rider_docid") || extra.riderId || null,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        speed: pos.coords.speed || null,
        accuracy: pos.coords.accuracy || null,
        timestamp: Date.now(),
        ...extra
      };
      s.emit("rider:location", payload);
      return payload;
    } catch (err) {
      throw err;
    }
  },

  start(intervalMs = DEFAULT_INTERVAL, extra = {}) {
    this._interval = Number(intervalMs) || DEFAULT_INTERVAL;
    if (this.running) return;
    this.running = true;

    // immediate
    this.sendOnce(extra).catch((e) => console.warn("RIDER_GPS immediate send failed", e));

    this._timer = setInterval(() => {
      this.sendOnce(extra).catch((e) => console.warn("RIDER_GPS send failed", e));
    }, this._interval);
  },

  stop() {
    this.running = false;
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }
};

export default RIDER_GPS;
