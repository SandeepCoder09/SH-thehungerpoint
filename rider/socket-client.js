// /rider/socket-client.js
// small wrapper around socket.io client to centralize connection

const API_BASE = window.SH?.API_BASE ?? "https://sh-thehungerpoint.onrender.com";
const SOCKET_URL = API_BASE.replace(/^http/, "ws").replace(/\/$/, "");

let socket = null;

export async function connectSocket(opts = {}) {
  // opts: { riderId?, token? }
  if (socket && socket.connected) return socket;

  // lazy-load socket.io client (script is already included on pages usually).
  if (typeof io === "undefined") {
    throw new Error("socket.io client (io) is missing. Include CDN script before modules.");
  }

  // build auth payload (optional)
  const auth = {};
  if (opts.token) auth.token = opts.token;
  if (opts.riderId) auth.riderId = opts.riderId;

  socket = io(SOCKET_URL, {
    transports: ["websocket"],
    auth,
    reconnectionAttempts: 99,
    timeout: 10000
  });

  return new Promise((resolve, reject) => {
    const onConnect = () => {
      cleanup();
      resolve(socket);
    };
    const onError = (err) => {
      cleanup();
      reject(err || new Error("socket connect error"));
    };
    function cleanup() {
      socket.off("connect", onConnect);
      socket.off("connect_error", onError);
      socket.off("error", onError);
    }
    socket.on("connect", onConnect);
    socket.on("connect_error", onError);
    socket.on("error", onError);
  });
}

export function getSocket() {
  return socket;
}