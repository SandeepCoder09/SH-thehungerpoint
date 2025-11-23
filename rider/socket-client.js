// /rider/socket-client.js

const BACKEND_URL = window.SOCKET_BACKEND || window.location.origin;

function createSocket(authToken) {
  const socket = io(BACKEND_URL, {
    transports: ['websocket'],
    auth: authToken ? { token: authToken } : undefined,
  });

  socket.on("connect", () => console.log("Socket connected:", socket.id));
  socket.on("disconnect", (reason) => console.log("Socket disconnected:", reason));
  socket.on("connect_error", (err) => console.error("Socket error:", err));

  return socket;
}
