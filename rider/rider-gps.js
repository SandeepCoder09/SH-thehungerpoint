import { getSocket } from "./socket-client.js";

const RIDER_GPS = {
  running: false,
  watchId: null,

  start() {
    if (this.running) return;

    this.running = true;

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const s = getSocket();
        if (!s || !s.connected) return;

        const payload = {
          riderId: localStorage.getItem("sh_rider_id"),
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: Date.now()
        };

        s.emit("rider:location", payload);
      },
      (err) => console.warn("GPS error", err),
      { enableHighAccuracy: true, maximumAge: 2000 }
    );
  },

  stop() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.running = false;
  }
};

export default RIDER_GPS;
