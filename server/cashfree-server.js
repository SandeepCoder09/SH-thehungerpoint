// server/cashfree-server.js
import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import fetch from "node-fetch";
import http from "http";
import { Server } from "socket.io";

/* -------------------------------------------------------
   Rebuild Key (fix \n issues on Render)
------------------------------------------------------- */
function rebuildPrivateKey(raw) {
  if (!raw) return null;
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

/* -------------------------------------------------------
   ENV CHECK
------------------------------------------------------- */
const requiredEnvs = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_PRIVATE_KEY_ID",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_CLIENT_EMAIL",
  "JWT_SECRET",
  "CF_MODE",              // sandbox | production
  "CF_APP_ID",
  "CF_SECRET_KEY"
];

requiredEnvs.forEach(key => {
  if (!process.env[key]) console.warn("⚠ Missing env:", key);
});

/* -------------------------------------------------------
   FIREBASE ADMIN INIT
------------------------------------------------------- */
let db = null;

try {
  const serviceAccount = {
    type: process.env.FIREBASE_TYPE || "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: rebuildPrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
  };

  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  db = admin.firestore();
  console.log("✅ Firebase Admin initialized");
} catch (err) {
  console.error("🔥 Firebase Init Failed:", err.message);
}

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */
const safeJson = (res, status, obj) => res.status(status).json(obj);

/* -------------------------------------------------------
   EXPRESS SETUP
------------------------------------------------------- */
const app = express();
app.use(cors());
app.use(express.json());

app.get("/ping", (req, res) => res.send("Server Running ✔"));

/* -------------------------------------------------------
   ADMIN LOGIN
------------------------------------------------------- */
app.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const doc = await db.collection("admins").doc(email).get();
    if (!doc.exists) return safeJson(res, 200, { ok: false, error: "Invalid credentials" });

    const adminData = doc.data();
    const hash = adminData.passwordHash || adminData.password;

    const match = await bcrypt.compare(password, hash);
    if (!match) return safeJson(res, 200, { ok: false, error: "Invalid credentials" });

    const token = jwt.sign({ email, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "7d" });

    return safeJson(res, 200, { ok: true, token });
  } catch (err) {
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

/* -------------------------------------------------------
   RIDER LOGIN
------------------------------------------------------- */
app.post("/rider/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const doc = await db.collection("riders").doc(email).get();
    if (!doc.exists) return safeJson(res, 200, { ok: false, error: "Invalid credentials" });

    const rider = doc.data();

    if (!rider.approved)
      return safeJson(res, 200, { ok: false, error: "Rider not approved" });

    const match = await bcrypt.compare(password, rider.password);
    if (!match) return safeJson(res, 200, { ok: false, error: "Incorrect password" });

    const token = jwt.sign(
      { riderId: email, role: "rider" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return safeJson(res, 200, { ok: true, riderId: email, token });

  } catch (err) {
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

/* -------------------------------------------------------
   CASHFREE — MODE SWITCH (MAIN FEATURE)
------------------------------------------------------- */
const CF_MODE = process.env.CF_MODE || "sandbox";

const CF_URL =
  CF_MODE === "production"
    ? "https://api.cashfree.com/pg/orders"
    : "https://sandbox.cashfree.com/pg/orders";

console.log(`💳 Cashfree Mode: ${CF_MODE.toUpperCase()}`);
console.log(`➡ API URL: ${CF_URL}`);

/* -------------------------------------------------------
   CASHFREE — CREATE ORDER
------------------------------------------------------- */
app.post("/create-cashfree-order", async (req, res) => {
  try {
    const { amount, phone, email } = req.body;

    const body = {
      order_amount: Number(amount),
      order_currency: "INR",
      customer_details: {
        customer_id: phone || "guest",
        customer_phone: phone,
        customer_email: email
      }
    };

    const cfRes = await fetch(CF_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-version": "2022-09-01",
        "x-client-id": process.env.CF_APP_ID,
        "x-client-secret": process.env.CF_SECRET_KEY
      },
      body: JSON.stringify(body)
    });

    const data = await cfRes.json();
    console.log("CF RESPONSE:", data);

    return safeJson(res, 200, {
      ok: true,
      orderId: data.order_id || data?.data?.order_id,
      session: data.payment_session_id || data?.data?.payment_session_id
    });

  } catch (err) {
    console.error("Cashfree Error:", err);
    return safeJson(res, 500, { ok: false, error: "Payment server error" });
  }
});

/* -------------------------------------------------------
   CASHFREE — VERIFY PAYMENT (optional)
------------------------------------------------------- */
app.post("/verify-cashfree-payment", async (req, res) => {
  return safeJson(res, 200, { ok: true, message: "Verification bypassed ✔" });
});

/* -------------------------------------------------------
   SOCKET.IO — LIVE RIDER TRACKING
------------------------------------------------------- */
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: "*" }
});

const lastPositions = new Map();

io.on("connection", socket => {
  console.log("🟢 Socket Connected:", socket.id);

  socket.on("rider:join", ({ riderId }) => {
    socket.data.riderId = riderId;
    console.log("🏍 Rider joined:", riderId);
  });

  socket.on("rider:location", data => {
    if (!data) return;
    lastPositions.set(data.riderId, data);

    io.emit("admin:riderLocation", data);
    io.to("order_" + data.orderId).emit("order:riderLocation", data);
  });

  socket.on("order:join", ({ orderId }) => {
    socket.join("order_" + orderId);
  });

  socket.on("disconnect", () => {
    console.log("🔴 Socket disconnected");
  });
});

/* -------------------------------------------------------
   START SERVER
------------------------------------------------------- */
const PORT = process.env.PORT || 10000;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
