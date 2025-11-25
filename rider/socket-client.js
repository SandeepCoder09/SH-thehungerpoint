// rider/socket-client.js
(function () {
  const API_BASE = window.SH?.API_BASE ?? "";
  const SOCKET_URL = API_BASE.replace(/^http/, "ws");

  if (!window.io) {
    console.warn("Socket.io not loaded");
    return;
  }

  const token = localStorage.getItem("riderToken");
  const riderId = localStorage.getItem("riderId");

  const socket = io(SOCKET_URL, {
    transports: ["websocket"],
    auth: { token: token ? `Bearer ${token}` : null },
    reconnectionAttempts: 10,
    reconnectionDelay: 1200
  });

  socket.on("connect", () => {
    console.log("Socket connected:", socket.id);
    if (riderId) socket.emit("rider:join", { riderId });
    document.dispatchEvent(new Event("socket:connected"));
  });

  socket.on("connect_error", (err) => {
    console.warn("Socket error:", err.message);
  });

  socket.on("disconnect", (reason) => {
    console.warn("Socket disconnected:", reason);
  });

  window.socket = socket;
})();
