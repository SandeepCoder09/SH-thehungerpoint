/**
 * SH — The Hunger Point
 * FINAL PRODUCTION SERVER (2025)
 * --------------------------------------------
 * - Firebase Admin (order DB)
 * - Cashfree v3 Order + Verify
 * - Admin Login
 * - Rider Login
 * - Socket.IO Live Tracking
 * --------------------------------------------
 */

import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import fetch from "node-fetch";
import http from "http";
import { Server } from "socket.io";

/* -------------------------------------------------
   Utility
------------------------------------------------- */

function rebuildPrivateKey(raw) {
  if (!raw) return null;
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

const safeJson = (res, status, obj) => res.status(status).json(obj);

/* -------------------------------------------------
   Environment Validation
------------------------------------------------- */

const required = [
  "FIREBASE_TYPE",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_PRIVATE_KEY_ID",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_CLIENT_EMAIL",
  "JWT_SECRET",
  "CF_APP_ID",
  "CF_SECRET_KEY"
];

required.forEach((k) => {
  if (!process.env[k]) console.warn("⚠ Missing ENV variable:", k);
});

/* -------------------------------------------------
   Cashfree Config
------------------------------------------------- */

const CF_MODE = (process.env.CF_MODE || "production").toLowerCase();

const CF_BASE =
  CF_MODE === "sandbox"
    ? "https://sandbox.cashfree.com"
    : "https://api.cashfree.com";

/* -------------------------------------------------
   Firebase Admin Init
------------------------------------------------- */

let db = null;

try {
  const creds = {
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: rebuildPrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
    universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN
  };

  admin.initializeApp({ credential: admin.credential.cert(creds) });
  db = admin.firestore();

  console.log("🔥 Firebase Admin initialized");
} catch (err) {
  console.error("❌ Firebase Admin Init Failed:", err);
}

/* -------------------------------------------------
   Express Init + CORS
------------------------------------------------- */

const app = express();

const ALLOWED = (process.env.CF_ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: function (origin, cb) {
      if (!origin) return cb(null, true);
      if (ALLOWED.length === 0) return cb(null, true);
      if (ALLOWED.includes(origin)) return cb(null, true);
      console.log("❌ Blocked by CORS:", origin);
      return cb(new Error("Not allowed by CORS"));
    }
  })
);

app.use(express.json({ limit: "1mb" }));

app.get("/ping", (req, res) => res.send("Server Awake ✔"));

/* -------------------------------------------------
   Admin Hash Generator
------------------------------------------------- */
app.get("/__makehash", async (req, res) => {
  if (!req.query.pw) return res.json({ ok: false, error: "pw missing" });
  const hash = await bcrypt.hash(req.query.pw, 10);
  res.json({ ok: true, hash });
});

/* -------------------------------------------------
   Admin Login
------------------------------------------------- */
app.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return safeJson(res, 400, { ok: false, error: "Missing inputs" });

    const snap = await db.collection("admins").doc(email).get();
    if (!snap.exists) return safeJson(res, 200, { ok: false, error: "Invalid credentials" });

    const adminData = snap.data();
    const hash = adminData.passwordHash || adminData.password;

    const ok = await bcrypt.compare(password, hash);
    if (!ok) return safeJson(res, 200, { ok: false, error: "Invalid credentials" });

    const token = jwt.sign({ email, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "7d" });

    return safeJson(res, 200, { ok: true, token });
  } catch (err) {
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

/* -------------------------------------------------
   Rider Login
------------------------------------------------- */

async function findRider(identifier) {
  const d = await db.collection("riders").doc(identifier).get();
  if (d.exists) return { id: d.id, data: d.data() };

  const q1 = await db.collection("riders").where("phone", "==", identifier).limit(1).get();
  if (!q1.empty) return { id: q1.docs[0].id, data: q1.docs[0].data() };

  const q2 = await db.collection("riders").where("email", "==", identifier).limit(1).get();
  if (!q2.empty) return { id: q2.docs[0].id, data: q2.docs[0].data() };

  const q3 = await db.collection("riders").where("riderId", "==", identifier).limit(1).get();
  if (!q3.empty) return { id: q3.docs[0].id, data: q3.docs[0].data() };

  return null;
}

app.post("/rider/login", async (req, res) => {
  try {
    const { email, phone, riderId, password } = req.body;
    const identifier = (email || phone || riderId || "").trim();

    if (!identifier || !password)
      return safeJson(res, 400, { ok: false, error: "Missing inputs" });

    const found = await findRider(identifier);
    if (!found)
      return safeJson(res, 200, { ok: false, error: "Invalid credentials" });

    const rider = found.data;
    const hash = rider.passwordHash || rider.password;

    const ok = await bcrypt.compare(password, hash);
    if (!ok)
      return safeJson(res, 200, { ok: false, error: "Incorrect password" });

    if (!rider.approved)
      return safeJson(res, 200, { ok: false, error: "Rider not approved" });

    const token = jwt.sign(
      {
        riderId: rider.riderId || found.id,
        name: rider.name,
        email: rider.email
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return safeJson(res, 200, {
      ok: true,
      token,
      riderId: rider.riderId,
      email: rider.email,
      name: rider.name
    });
  } catch (err) {
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

/* -------------------------------------------------
   Cashfree — Create Order (v3 FIXED)
------------------------------------------------- */
app.post("/create-cashfree-order", async (req, res) => {
  try {
    const { amount, phone, email } = req.body;

    if (!amount || Number(amount) <= 0)
      return safeJson(res, 400, { ok: false, error: "Amount required" });

    const payload = {
      order_amount: Number(amount),
      order_currency: "INR",
      customer_details: {
        customer_id: phone ? `uid_${phone}` : "guest01",
        customer_phone: "9999999999",
        customer_email: email || "guest@sh.com"
      }
    };

    const cf = await fetch(`${CF_BASE}/pg/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-version": "2022-09-01",
        "x-client-id": process.env.CF_APP_ID,
        "x-client-secret": process.env.CF_SECRET_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await cf.json();
    console.log("CASHFREE RAW:", data);

    const orderId = data.order_id || data.data?.order_id;
    const paymentSessionId = data.payment_session_id || data.data?.payment_session_id;

    if (!orderId || !paymentSessionId) {
      return safeJson(res, 500, {
        ok: false,
        error: "Cashfree v3 failed",
        raw: data
      });
    }

    return safeJson(res, 200, {
      ok: true,
      orderId,
      payment_session_id: paymentSessionId
    });

  } catch (err) {
    console.error(err);
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

/* -------------------------------------------------
   Cashfree — Verify Payment
------------------------------------------------- */
app.post("/verify-cashfree-payment", async (req, res) => {
  try {
    const { orderId, items = [] } = req.body;

    if (!orderId)
      return safeJson(res, 400, { ok: false, error: "orderId required" });

    const r = await fetch(`${CF_BASE}/pg/orders/${orderId}`, {
      headers: {
        "x-api-version": "2022-09-01",
        "x-client-id": process.env.CF_APP_ID,
        "x-client-secret": process.env.CF_SECRET_KEY
      }
    });

    const data = await r.json();
    const status =
      data.order_status ||
      data.data?.order_status ||
      data.status;

    if (String(status).toUpperCase() !== "PAID")
      return safeJson(res, 200, { ok: false, error: "Payment not completed" });

    const total = items.reduce((s, i) => s + i.qty * i.price, 0);

    await db.collection("orders").doc(orderId).set(
      {
        orderId,
        items,
        totalAmount: total,
        status: "paid",
        riderId: null,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      },
      { merge: true }
    );

    return safeJson(res, 200, { ok: true, orderId });
  } catch (err) {
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

/* -------------------------------------------------
   Active Orders (Admin Panel)
------------------------------------------------- */
app.get("/admin/active-orders", async (req, res) => {
  try {
    const arr = [];
    const snap = await db.collection("orders").get();

    snap.forEach((d) => {
      const x = d.data();
      arr.push({
        orderId: d.id,
        status: x.status || "new",
        riderId: x.riderId || null,
        customerName: x.customerName || null,
        riderLat: x.riderLoc?.lat || null,
        riderLng: x.riderLoc?.lng || null,
        customerLat: x.customerLoc?.lat || null,
        customerLng: x.customerLoc?.lng || null
      });
    });

    return res.json(arr);
  } catch (err) {
    return res.status(500).json({ ok: false });
  }
});

/* -------------------------------------------------
   Socket.IO Live Tracking
------------------------------------------------- */

const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  socket.on("rider:join", ({ riderId }) => {
    socket.data.riderId = riderId;
  });

  socket.on("rider:location", async (data) => {
    if (!data || !data.riderId) return;

    io.emit("admin:riderLocation", data);

    if (data.orderId) {
      io.to("order_" + data.orderId).emit("order:riderLocation", data);

      await db
        .collection("orders")
        .doc(data.orderId)
        .set(
          {
            riderLoc: { lat: data.lat, lng: data.lng },
            updatedAt: admin.firestore.Timestamp.now()
          },
          { merge: true }
        );
    }
  });

  socket.on("order:status", async (p) => {
    if (!p?.orderId) return;

    io.emit("order:status", p);

    await db
      .collection("orders")
      .doc(p.orderId)
      .set(
        { status: p.status, updatedAt: admin.firestore.Timestamp.now() },
        { merge: true }
      );
  });

  socket.on("order:join", ({ orderId }) => socket.join("order_" + orderId));

  socket.on("disconnect", () => console.log("🔴 Socket disconnected:", socket.id));
});

/* -------------------------------------------------
   Server Start
------------------------------------------------- */

const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () =>
  console.log(`🚀 SH Server running on ${PORT} | Mode: ${CF_MODE}`)
);
