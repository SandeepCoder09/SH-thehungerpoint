// rider/socket-client.js
(function () {
  const API_BASE = window.SH?.API_BASE ?? "";
  const SOCKET_URL = API_BASE || window.location.origin;

  if (!window.io) {
    console.warn("socket.io client not loaded");
    return;
  }

  const token = localStorage.getItem("riderToken");
  const riderId = localStorage.getItem("riderId");

  // connect to server with websocket transport
  const socket = io(SOCKET_URL, {
    transports: ["websocket"],
    auth: { token } // server may ignore but harmless
  });

  socket.on("connect", () => {
    console.log("socket connected", socket.id);
    if (riderId) socket.emit("rider:join", { riderId });
  });

  socket.on("connect_error", (err) => {
    console.warn("Socket connect error:", err);
  });

  // server -> client messages (optional)
  socket.on("order:assigned", (payload) => {
    console.log("Order assigned:", payload);
    // you can update UI here
  });

  window.socket = socket;
})();
