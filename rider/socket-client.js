// rider/socket-client.js
// Minimal socket helper for rider. Exports connectSocket() and getSocket()

const API_BASE = window.SH?.API_BASE ?? "https://sh-thehungerpoint.onrender.com";
const SOCKET_URL = API_BASE; // socket.io client will use same origin

let socket = null;

export async function connectSocket({ token, riderId } = {}) {
  return new Promise((resolve, reject) => {
    try {
      // connect and pass auth via query or auth object
      socket = io(SOCKET_URL, {
        transports: ["websocket"],
        auth: { token: token || null },
        query: { riderId: riderId || "" },
        reconnectionAttempts: 5
      });

      socket.on("connect", () => {
        // join rider room
        socket.emit("rider:join", { riderId });
        resolve(socket);
      });

      socket.on("connect_error", (err) => {
        console.warn("socket connect_error", err);
      });

      // small timeout: if not connected by 5s, still resolve/reject accordingly
      setTimeout(() => {
        if (!socket || !socket.connected) {
          // still not connected - but we allow the page to run and will reconnect automatically
          // resolve with current socket (may be disconnected)
          resolve(socket);
        }
      }, 5000);

    } catch (err) {
      reject(err);
    }
  });
}

export function getSocket() {
  return socket;
}