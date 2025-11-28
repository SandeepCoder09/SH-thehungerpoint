// /rider/socket-client.js
// small wrapper around socket.io client to centralize connection

const API_BASE = window.SH?.API_BASE ?? "https://sh-thehungerpoint.onrender.com";
const SOCKET_URL = API_BASE.replace(/^http/, "ws").replace(/\/$/, "");

let socket = null;

export async function connectSocket(opts = {}) {
  // opts: { riderId?, token? }
  if (socket && socket.connected) return socket;

  // ensure socket.io client present
  if (typeof io === "undefined") {
    throw new Error("socket.io client (io) is missing. Include CDN script before modules.");
  }

  // prefer token/riderId from args, else fallback to localStorage
  const token = opts.token || localStorage.getItem("sh_rider_token") || null;
  const riderId = opts.riderId || localStorage.getItem("sh_rider_id") || localStorage.getItem("sh_rider_docid") || null;

  const auth = {};
  if (token) auth.token = token;
  if (riderId) auth.riderId = riderId;

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
