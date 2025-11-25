// server/cashfree-server.js
/**
 * SH — Cashfree + Firebase Admin + Rider Login + Socket.IO
 * Hardened / improved version (keeps backwards compatibility)
 *
 * Requirements (env):
 * - FIREBASE_TYPE
 * - FIREBASE_PROJECT_ID
 * - FIREBASE_PRIVATE_KEY_ID
 * - FIREBASE_PRIVATE_KEY
 * - FIREBASE_CLIENT_EMAIL
 * - JWT_SECRET
 * - CF_APP_ID
 * - CF_SECRET_KEY
 * Optional:
 * - CF_MODE = "sandbox" or "production" (default: production)
 * - ADMIN_HELPER_TOKEN (string) -> protects /rider/create-test helper
 */

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

import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import fetch from "node-fetch";
import http from "http";
import { Server } from "socket.io";

// -----------------------------
// Helpers
// -----------------------------
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

const ADMIN_HELPER_TOKEN = process.env.ADMIN_HELPER_TOKEN || ""; // optional guard for create-test route

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

// -----------------------------
// Firebase admin init
// -----------------------------
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

// -----------------------------
// Express + Socket setup
// -----------------------------
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/ping", (req, res) => res.send("Server Awake ✔"));

// -----------------------------
// Admin login (unchanged)
// -----------------------------
app.post("/admin/login", async (req, res) => {
  try {
    if (!db) return safeJson(res, 500, { ok: false, error: "Server error" });

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

// -----------------------------
// Rider helpers: flexible lookup
// - Accepts email (doc id) OR phone (looks up document by phone field)
// - Accepts riders stored with `password` or `passwordHash`
// -----------------------------
async function findRiderByEmailOrPhone(identifier) {
  if (!db) return null;

  // try as doc id (email is often the doc id in his repo)
  try {
    const maybeDoc = await db.collection("riders").doc(identifier).get();
    if (maybeDoc.exists) return { id: maybeDoc.id, data: maybeDoc.data() };
  } catch (e) {
    // ignore
  }

  // try by phone field
  try {
    const q = await db.collection("riders").where("phone", "==", identifier).limit(1).get();
    if (!q.empty) {
      const d = q.docs[0];
      return { id: d.id, data: d.data() };
    }
  } catch (e) {
    // ignore
  }

  // try by email field (if doc id not email)
  try {
    const q2 = await db.collection("riders").where("email", "==", identifier).limit(1).get();
    if (!q2.empty) {
      const d = q2.docs[0];
      return { id: d.id, data: d.data() };
    }
  } catch (e) {
    // ignore
  }

  return null;
}

// -----------------------------
// Rider login (improved & tolerant)
// -----------------------------
app.post("/rider/login", async (req, res) => {
  try {
    if (!db) return safeJson(res, 500, { ok: false, error: "Server error" });

    const { email, password, phone } = req.body;
    const identifier = (email || phone || "").trim();
    if (!identifier || !password) return safeJson(res, 400, { ok: false, error: "Missing inputs" });

    const found = await findRiderByEmailOrPhone(identifier);
    if (!found) return safeJson(res, 200, { ok: false, error: "Invalid credentials" });

    const rider = found.data;
    const riderId = found.id;

    if (!rider.approved) return safeJson(res, 200, { ok: false, error: "Rider not approved yet" });

    const storedHash = rider.passwordHash || rider.password;
    if (!storedHash) return safeJson(res, 200, { ok: false, error: "Invalid credentials" });

    const match = await bcrypt.compare(password, storedHash);
    if (!match) return safeJson(res, 200, { ok: false, error: "Incorrect password" });

    const token = jwt.sign({ riderId, role: "rider" }, process.env.JWT_SECRET, { expiresIn: "7d" });

    return safeJson(res, 200, { ok: true, riderId, token });
  } catch (err) {
    console.error("Rider login failed:", err);
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

app.get("/rider/check", async (req, res) => {
  try {
    if (!db) return safeJson(res, 500, { ok: false, error: "Server error" });

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

// -----------------------------
// Optional helper to create a test rider quickly
// Protected by ADMIN_HELPER_TOKEN so it's not public.
// Use only for testing/development.
// -----------------------------
app.post("/rider/create-test", async (req, res) => {
  try {
    const token = req.headers["x-admin-helper-token"] || "";
    if (!ADMIN_HELPER_TOKEN || token !== ADMIN_HELPER_TOKEN) {
      return safeJson(res, 401, { ok: false, error: "Unauthorized" });
    }

    const { email, password, name = "Test Rider", phone = "" } = req.body;
    if (!email || !password) return safeJson(res, 400, { ok: false, error: "email & password required" });

    const hash = await bcrypt.hash(password, 10);
    const docRef = db.collection("riders").doc(email);

    await docRef.set({
      email,
      name,
      phone,
      password: hash,
      approved: true,
      createdAt: admin.firestore.Timestamp.now()
    });

    return safeJson(res, 200, { ok: true, message: "Test rider created", email });
  } catch (err) {
    console.error("create-test failed:", err);
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

// -----------------------------
// Cashfree: create order & verify
// - supports sandbox/production via CF_MODE
// -----------------------------
app.post("/create-cashfree-order", async (req, res) => {
  try {
    const { amount, items = [], phone, email } = req.body;
    if (!amount || Number(amount) <= 0) return safeJson(res, 400, { ok: false, error: "Amount required" });

    const payload = {
      order_amount: Number(amount),
      order_currency: "INR",
      customer_details: {
        customer_id: phone || (email ? email : "guest"),
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
    // robust extraction
    const orderId = data.order_id || data.data?.order_id || data.data?.order?.id;
    const session = data.payment_session_id || data.data?.payment_session_id || data.data?.session;

    if (!orderId || !session) {
      console.warn("Cashfree create: unexpected response", { status: cfRes.status, body: data });
      return safeJson(res, 500, { ok: false, error: "Cashfree failed", raw: data });
    }

    return safeJson(res, 200, { ok: true, orderId, session, raw: data });
  } catch (err) {
    console.error("Cashfree create order error:", err);
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

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
    // Cashfree returns order_status etc.
    const status = data.order_status || data.data?.order_status || data.status;
    if (String(status).toUpperCase() !== "PAID") {
      return safeJson(res, 200, { ok: false, error: "Payment not completed", raw: data });
    }

    // Here you can save the order to Firestore and return orderId matching CF order id
    // Keep behavior consistent with previous version:
    const newOrderId = orderId; // use Cashfree order id as Firestore doc id
    try {
      // Expect client to pass items, but fallback gracefully
      const items = req.body.items || [];
      const total = items.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 1), 0);

      await db.collection("orders").doc(newOrderId).set({
        items,
        total,
        status: "paid",
        cashfree_order_id: orderId,
        createdAt: admin.firestore.Timestamp.now()
      });
    } catch (e) {
      console.warn("Warning: failed to persist order to Firestore", e);
    }

    return safeJson(res, 200, { ok: true, orderId: newOrderId, raw: data });
  } catch (err) {
    console.error("Cashfree verify error:", err);
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

// -----------------------------
// Socket.IO — rider live tracking
// -----------------------------
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

const lastPositions = new Map();

io.on("connection", socket => {
  console.log("🟢 Socket connected", socket.id);

  socket.on("rider:join", ({ riderId }) => {
    socket.data.riderId = riderId;
    console.log("🏍 Rider joined:", riderId);
  });

  socket.on("rider:location", (data) => {
    try {
      if (!data || !data.riderId) return;
      lastPositions.set(data.riderId, data);

      // broadcast for admin dashboard
      io.emit("admin:riderLocation", data);

      // if order-specific, broadcast to that room
      if (data.orderId) {
        io.to("order_" + data.orderId).emit("order:riderLocation", data);
      }
    } catch (err) {
      console.error("rider:location handler error:", err);
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

// -----------------------------
// Start server
// -----------------------------
const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () => {
  console.log(`🚀 SH Cashfree + Tracking server running on ${PORT} (CF_MODE=${CF_MODE})`);
});
