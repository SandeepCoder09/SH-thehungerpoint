// rider/socket-client.js
// Simple socket wrapper. Exposes connectSocket() and getSocket().

import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js";

const SERVER_BASE = window.SH?.API_BASE || "https://sh-thehungerpoint.onrender.com";
let socket = null;

/**
 * Connect socket with token and riderDocId (doc id saved in localStorage).
 * Returns the socket when connected.
 */
export async function connectSocket({ token, riderDocId } = {}) {
  if (!token) throw new Error("Missing token for socket connect");

  // if already connected and same token -> return
  if (socket && socket.connected) return socket;

  socket = io(SERVER_BASE, {
    transports: ["websocket"],
    auth: {
      token
    },
    query: {
      riderDocId: riderDocId || localStorage.getItem("sh_rider_id") || ""
    },
    reconnectionAttempts: 999
  });

  // small helper events
  socket.on("connect_error", (err) => console.warn("Socket connect_error", err));
  socket.on("connect", () => console.log("Socket connected", socket.id));
  socket.on("disconnect", (r) => console.log("Socket disconnected", r));

  return new Promise((resolve, reject) => {
    socket.once("connect", () => resolve(socket));
    // fallback - resolve after 4s even if not fully connected
    setTimeout(() => resolve(socket), 4000);
  });
}

export function getSocket() {
  return socket;
}
