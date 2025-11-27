/**
 * SH — Cashfree + Firebase Admin + Rider Login + Socket.IO
 * Hardened / improved version (keeps backwards compatibility)
 */

import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import fetch from "node-fetch";
import http from "http";
import { Server } from "socket.io";

/* -----------------------------------
   Helpers
----------------------------------- */
function rebuildPrivateKey(raw) {
  if (!raw) return null;
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

const requiredEnvs = [
  "FIREBASE_TYPE",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_PRIVATE_KEY_ID",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_CLIENT_EMAIL",
  "JWT_SECRET",
  "CF_APP_ID",
  "CF_SECRET_KEY"
];

requiredEnvs.forEach(k => {
  if (!process.env[k]) console.warn("⚠ Missing env:", k);
});

const CF_MODE = (process.env.CF_MODE || "production").toLowerCase();
const CF_BASE =
  CF_MODE === "sandbox"
    ? "https://sandbox.cashfree.com"
    : "https://api.cashfree.com";

const safeJson = (res, status, obj) => res.status(status).json(obj);

function requireAdminToken(req, res, next) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return safeJson(res, 401, { ok: false, error: "Unauthorized" });
  const token = auth.split(" ")[1];
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return safeJson(res, 401, { ok: false, error: "Invalid token" });
  }
}

/* -----------------------------------
   Firebase Admin Init
----------------------------------- */
let db = null;
try {
  const serviceAccount = {
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

  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  db = admin.firestore();
  console.log("✅ Firebase Admin initialized");
} catch (err) {
  console.error("🔥 Firebase init failed:", err.message || err);
}

/* -----------------------------------
   Express + Socket Setup
----------------------------------- */
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/ping", (req, res) => res.send("Server Awake ✔"));

/* -----------------------------------
   CREATE TEST ORDER (New Route)
----------------------------------- */
app.post("/create-test-order", async (req, res) => {
  try {
    if (!db) return res.status(500).json({ ok: false, error: "Firestore not initialized" });

    const ref = await db.collection("orders").add({
      items: [
        { name: "Momo", qty: 2, price: 10 },
        { name: "Tea", qty: 1, price: 10 }
      ],
      totalAmount: 30,
      status: "preparing",
      riderId: null,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    });

    await ref.update({ orderId: ref.id });

    return res.json({ ok: true, orderId: ref.id });
  } catch (error) {
    console.error("create-test-order error:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

/* -----------------------------------
   Dev helper: Make bcrypt hash
----------------------------------- */
app.get("/__makehash", async (req, res) => {
  try {
    const pw = req.query.pw || "";
    if (!pw) return res.json({ ok: false, error: "pw missing" });

    const hash = await bcrypt.hash(pw, 10);
    return res.json({ ok: true, pw, hash });
  } catch (err) {
    return res.json({ ok: false, error: err.message });
  }
});

/* -----------------------------------
   Admin login
----------------------------------- */
app.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return safeJson(res, 400, { ok: false, error: "Missing inputs" });

    const doc = await db.collection("admins").doc(email).get();
    if (!doc.exists) return safeJson(res, 200, { ok: false, error: "Invalid credentials" });

    const adminData = doc.data();
    const hash = adminData.passwordHash || adminData.password;
    const match = await bcrypt.compare(password, hash);
    if (!match) return safeJson(res, 200, { ok: false, error: "Invalid credentials" });

    const token = jwt.sign({ email: adminData.email, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "7d" });

    return safeJson(res, 200, { ok: true, token });
  } catch (err) {
    console.error("Admin login error:", err);
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

/* -----------------------------------
   Admin verify + approve rider
----------------------------------- */
app.get("/admin/verify", requireAdminToken, (req, res) => {
  return safeJson(res, 200, { ok: true, email: req.admin.email });
});

app.post("/admin/approve-rider", requireAdminToken, async (req, res) => {
  try {
    const { riderId } = req.body;
    if (!riderId) return safeJson(res, 400, { ok: false, error: "riderId required" });

    await db.collection("riders").doc(riderId).update({ approved: true });

    return safeJson(res, 200, { ok: true, message: "Rider approved" });
  } catch (err) {
    console.error("Approve rider error:", err);
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

/* -----------------------------------
   Rider Login
----------------------------------- */
async function findRiderByEmailOrPhone(identifier) {
  if (!db) return null;

  try {
    const doc = await db.collection("riders").doc(identifier).get();
    if (doc.exists) return { id: doc.id, data: doc.data() };
  } catch {}

  try {
    const q = await db.collection("riders").where("phone", "==", identifier).limit(1).get();
    if (!q.empty) return { id: q.docs[0].id, data: q.docs[0].data() };
  } catch {}

  try {
    const q = await db.collection("riders").where("email", "==", identifier).limit(1).get();
    if (!q.empty) return { id: q.docs[0].id, data: q.docs[0].data() };
  } catch {}

  return null;
}

app.post("/rider/login", async (req, res) => {
  try {
    const { email, password, phone } = req.body;
    const identifier = (email || phone || "").trim();
    if (!identifier || !password) return safeJson(res, 400, { ok: false, error: "Missing inputs" });

    const found = await findRiderByEmailOrPhone(identifier);
    if (!found) return safeJson(res, 200, { ok: false, error: "Invalid credentials" });

    const rider = found.data;
    const riderId = found.id;

    if (!rider.approved) return safeJson(res, 200, { ok: false, error: "Rider not approved yet" });

    const storedHash = rider.passwordHash || rider.password;
    const match = await bcrypt.compare(password, storedHash);
    if (!match) return safeJson(res, 200, { ok: false, error: "Incorrect password" });

    const token = jwt.sign({ riderId, role: "rider" }, process.env.JWT_SECRET, { expiresIn: "7d" });

    return safeJson(res, 200, { ok: true, riderId, token });
  } catch (err) {
    console.error("Rider login failed:", err);
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

/* -----------------------------------
   Rider checks
----------------------------------- */
app.get("/rider/check", async (req, res) => {
  try {
    const riderId = req.query.riderId || "";
    if (!riderId) return safeJson(res, 400, { ok: false, error: "riderId required" });

    const doc = await db.collection("riders").doc(riderId).get();
    if (!doc.exists) return safeJson(res, 200, { ok: false, error: "Rider not found" });

    if (!doc.data().approved) return safeJson(res, 200, { ok: false, error: "Not approved" });

    return safeJson(res, 200, { ok: true });
  } catch (err) {
    console.error("rider check failed:", err);
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

/* -----------------------------------
   Cashfree Payment — Create Order
----------------------------------- */
app.post("/create-cashfree-order", async (req, res) => {
  try {
    const { amount, items = [], phone, email } = req.body;
    if (!amount || Number(amount) <= 0)
      return safeJson(res, 400, { ok: false, error: "Amount required" });

    const payload = {
      order_amount: Number(amount),
      order_currency: "INR",
      customer_details: {
        customer_id: phone || email || "guest",
        customer_phone: phone || undefined,
        customer_email: email || undefined
      }
    };

    const cfRes = await fetch(`${CF_BASE}/pg/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-version": "2022-09-01",
        "x-client-id": process.env.CF_APP_ID,
        "x-client-secret": process.env.CF_SECRET_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await cfRes.json();

    const orderId =
      data.order_id ||
      data.data?.order_id ||
      data.data?.order?.id;

    const session =
      data.payment_session_id ||
      data.data?.payment_session_id ||
      data.data?.session;

    if (!orderId || !session) {
      return safeJson(res, 500, { ok: false, error: "Cashfree failed", raw: data });
    }

    return safeJson(res, 200, { ok: true, orderId, session, raw: data });

  } catch (err) {
    console.error("Cashfree create order error:", err);
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

/* -----------------------------------
   Cashfree Payment — Verify Payment
----------------------------------- */
app.post("/verify-cashfree-payment", async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return safeJson(res, 400, { ok: false, error: "orderId required" });

    const resp = await fetch(`${CF_BASE}/pg/orders/${orderId}`, {
      headers: {
        "x-api-version": "2022-09-01",
        "x-client-id": process.env.CF_APP_ID,
        "x-client-secret": process.env.CF_SECRET_KEY
      }
    });

    const data = await resp.json();
    const status =
      data.order_status ||
      data.data?.order_status ||
      data.status;

    if (String(status).toUpperCase() !== "PAID") {
      return safeJson(res, 200, { ok: false, error: "Payment not completed", raw: data });
    }

    try {
      await db.collection("orders").doc(orderId).set(
        {
          status: "paid",
          cashfree_order_id: orderId,
          updatedAt: admin.firestore.Timestamp.now()
        },
        { merge: true }
      );
    } catch (err) {
      console.warn("Firestore write failed:", err);
    }

    return safeJson(res, 200, { ok: true, orderId, raw: data });

  } catch (err) {
    console.error("Cashfree verify error:", err);
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

/* -----------------------------------
   Socket.IO – Rider live tracking
----------------------------------- */
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

const lastPositions = new Map();

io.on("connection", socket => {
  console.log("🟢 Socket connected:", socket.id);

  socket.on("rider:join", ({ riderId }) => {
    socket.data.riderId = riderId;
    console.log("🏍 Rider joined:", riderId);
  });

  socket.on("rider:location", (data) => {
    if (!data || !data.riderId) return;

    lastPositions.set(data.riderId, data);

    io.emit("admin:riderLocation", data);

    if (data.orderId) {
      io.to("order_" + data.orderId).emit("order:riderLocation", data);
    }
  });

  socket.on("order:join", ({ orderId }) => {
    socket.join("order_" + orderId);
  });

  socket.on("admin:join", () => {
    socket.emit("admin:initialRiders", Array.from(lastPositions.values()));
  });

  socket.on("disconnect", () => {
    console.log("🔴 Socket disconnected", socket.id);
  });
});

/* -----------------------------------
   Start Server
----------------------------------- */
const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () => {
  console.log(`🚀 SH Cashfree + Tracking server running on ${PORT} (CF_MODE=${CF_MODE})`);
});