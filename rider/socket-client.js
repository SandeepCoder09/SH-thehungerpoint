// /rider/socket-client.js
// Lightweight socket wrapper for rider pages (exports connectSocket & getSocket)

import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js";

let socket = null;

export async function connectSocket({ token = "", riderId = "", url } = {}) {
  // url fallback
  const API_BASE = window.SH?.API_BASE ?? "https://sh-thehungerpoint.onrender.com";
  const SOCKET_URL = (url || API_BASE).replace(/^http/, "ws");

  return new Promise((resolve, reject) => {
    try {
      socket = io(SOCKET_URL, {
        transports: ["websocket"],
        auth: { token },
        reconnectionAttempts: 99
      });

      socket.on("connect", () => {
        // join rider room if riderId available
        if (riderId) socket.emit("rider:join", { riderId });
        resolve(socket);
      });

      socket.on("connect_error", (err) => {
        console.warn("Socket connect_error", err);
      });

      // expose disconnect errors as well
      socket.on("disconnect", (r) => {
        // noop
      });
    } catch (err) {
      reject(err);
    }
  });
}

export function getSocket() {
  return socket;
}