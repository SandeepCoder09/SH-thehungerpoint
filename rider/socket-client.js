let socket = null;

export function getSocket() {
  return socket;
}

export async function connectSocket({ token, riderId }) {
  return new Promise((resolve, reject) => {
    socket = io("https://sh-thehungerpoint.onrender.com", {
      transports: ["websocket"],
      auth: { token, riderId }
    });

    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", reject);
  });
}
