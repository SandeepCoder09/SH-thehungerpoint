// rider/socket-client.js
const API_BASE = window.SH?.API_BASE ?? "https://sh-thehungerpoint.onrender.com";
const SOCKET_URL = API_BASE; // same origin where socket.io server runs

let socket = null;

/**
 * connectSocket({ token, riderId })
 * resolves with socket instance (may be disconnected but created)
 */
export function connectSocket({ token, riderId } = {}) {
  return new Promise((resolve, reject) => {
    try {
      socket = io(SOCKET_URL, {
        transports: ["websocket"],
        auth: { token: token || null },
        query: { riderId: riderId || "" },
        reconnectionAttempts: 99
      });

      socket.on("connect", () => {
        socket.emit("rider:join", { riderId });
        resolve(socket);
      });

      socket.on("connect_error", (err) => {
        console.warn("socket connect_error", err);
      });

      // safety: resolve even if connection is slow
      setTimeout(() => {
        if (!socket) return reject(new Error("socket not created"));
        resolve(socket);
      }, 4000);
    } catch (err) {
      reject(err);
    }
  });
}

export function getSocket() {
  return socket;
}
