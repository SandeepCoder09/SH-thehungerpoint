/**
 * SH — Cashfree + Firebase Admin + Rider Login + Socket.IO
 * FINAL STABLE SERVER FILE (2025)
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

// Required ENV Keys
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

// Cashfree mode
const CF_MODE = (process.env.CF_MODE || "production").toLowerCase();
const CF_BASE =
  CF_MODE === "sandbox"
    ? "https://sandbox.cashfree.com"
    : "https://api.cashfree.com";

const safeJson = (res, status, obj) => res.status(status).json(obj);

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
   Express Init
----------------------------------- */

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/ping", (req, res) => res.send("Server Awake ✔"));

/* -----------------------------------
   Create Test Order (for admin)
----------------------------------- */
app.post("/create-test-order", async (req, res) => {
  try {
    if (!db) return safeJson(res, 500, { ok: false, error: "Firestore not initialized" });

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

    return safeJson(res, 200, { ok: true, orderId: ref.id });
  } catch (err) {
    console.error("create-test-order error:", err);
    return safeJson(res, 500, { ok: false, error: err.message });
  }
});

/* -----------------------------------
   Dev Helper — Create bcrypt hash
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
   Admin Login
----------------------------------- */
app.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return safeJson(res, 400, { ok: false, error: "Missing inputs" });

    const doc = await db.collection("admins").doc(email).get();
    if (!doc.exists)
      return safeJson(res, 200, { ok: false, error: "Invalid credentials" });

    const adminData = doc.data();
    const storedHash = adminData.passwordHash || adminData.password;

    const match = await bcrypt.compare(password, storedHash);
    if (!match)
      return safeJson(res, 200, { ok: false, error: "Invalid credentials" });

    const token = jwt.sign(
      { email: adminData.email, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return safeJson(res, 200, { ok: true, token });
  } catch (err) {
    console.error("Admin login error:", err);
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

/* -----------------------------------
   Admin verify
----------------------------------- */
function requireAdminToken(req, res, next) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer "))
    return safeJson(res, 401, { ok: false, error: "Unauthorized" });

  const token = auth.split(" ")[1];
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return safeJson(res, 401, { ok: false, error: "Invalid token" });
  }
}

app.get("/admin/verify", requireAdminToken, (req, res) => {
  return safeJson(res, 200, { ok: true, email: req.admin.email });
});

/* -----------------------------------
   Rider Login Helper
----------------------------------- */
async function findRider(identifier) {
  if (!db) return null;

  // 1 — doc ID
  try {
    const d = await db.collection("riders").doc(identifier).get();
    if (d.exists) return { id: d.id, data: d.data() };
  } catch {}

  // 2 — phone
  try {
    const q = await db.collection("riders").where("phone", "==", identifier).limit(1).get();
    if (!q.empty) return { id: q.docs[0].id, data: q.docs[0].data() };
  } catch {}

  // 3 — email
  try {
    const q = await db.collection("riders").where("email", "==", identifier).limit(1).get();
    if (!q.empty) return { id: q.docs[0].id, data: q.docs[0].data() };
  } catch {}

  // 4 — riderId (SH_RD_01)
  try {
    const q = await db.collection("riders").where("riderId", "==", identifier).limit(1).get();
    if (!q.empty) return { id: q.docs[0].id, data: q.docs[0].data() };
  } catch {}

  return null;
}

/* -----------------------------------
   Rider Login (Final)
----------------------------------- */
app.post("/rider/login", async (req, res) => {
  try {
    const { email, phone, password, riderId } = req.body;

    const identifier = (email || phone || riderId || "").trim();
    if (!identifier || !password)
      return safeJson(res, 400, { ok: false, error: "Missing inputs" });

    const found = await findRider(identifier);
    if (!found)
      return safeJson(res, 200, { ok: false, error: "Invalid credentials" });

    const rider = found.data;
    const storedHash = rider.passwordHash || rider.password;

    const match = await bcrypt.compare(password, storedHash);
    if (!match)
      return safeJson(res, 200, { ok: false, error: "Incorrect password" });

    if (!rider.approved)
      return safeJson(res, 200, { ok: false, error: "Rider not approved yet" });

    // JWT token
    const token = jwt.sign(
      {
        riderId: rider.riderId || found.id,
        email: rider.email,
        name: rider.name
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
    console.error("Rider login failed:", err);
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

/* -----------------------------------
   Cashfree — Create Order
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

    return safeJson(res, 200, { ok: true, orderId, session });
  } catch (err) {
    console.error("Cashfree order error:", err);
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

/* -----------------------------------
   Cashfree — Verify Payment
----------------------------------- */
app.post("/verify-cashfree-payment", async (req, res) => {
  try {
    const { orderId, items = [] } = req.body;
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
      return safeJson(res, 200, { ok: false, error: "Payment not completed" });
    }

    // Save paid order to Firestore
    const total = items.reduce(
      (sum, it) => sum + Number(it.price) * Number(it.qty),
      0
    );

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
    console.error("Cashfree verify error:", err);
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

/* -----------------------------------
   ADMIN — Get Active Orders
----------------------------------- */
app.get("/admin/active-orders", async (req, res) => {
  try {
    const snap = await db.collection("orders").get();
    const list = [];

    snap.forEach((d) => {
      const o = d.data();
      list.push({
        orderId: d.id,
        riderId: o.riderId || null,
        customerId: o.customerId || null,
        customerName: o.customerName || null,
        status: o.status || "new",
        riderLat: o.riderLoc?.lat || null,
        riderLng: o.riderLoc?.lng || null,
        customerLat: o.customerLoc?.lat || null,
        customerLng: o.customerLoc?.lng || null
      });
    });

    return res.json(list);
  } catch (err) {
    console.error("active-orders error:", err);
    return res.status(500).json({ ok: false });
  }
});

/* -----------------------------------
   SOCKET.IO — Live Tracking
----------------------------------- */
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

const lastPositions = new Map();

io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  socket.on("rider:join", ({ riderId }) => {
    socket.data.riderId = riderId;
    console.log("🏍 Rider joined:", riderId);
  });

  socket.on("rider:location", async (data) => {
    if (!data || !data.riderId) return;

    lastPositions.set(data.riderId, data);
    io.emit("admin:riderLocation", data);

    if (data.orderId) {
      io.to("order_" + data.orderId).emit("order:riderLocation", data);

      // save inside Firestore
      try {
        await db.collection("orders").doc(data.orderId).set(
          {
            riderLoc: { lat: data.lat, lng: data.lng },
            updatedAt: admin.firestore.Timestamp.now()
          },
          { merge: true }
        );
      } catch (err) {
        console.error("FS riderLoc error", err);
      }
    }
  });

  socket.on("order:status", async (p) => {
    if (!p || !p.orderId) return;

    io.emit("order:status", p);

    try {
      await db.collection("orders").doc(p.orderId).set(
        {
          status: p.status,
          updatedAt: admin.firestore.Timestamp.now()
        },
        { merge: true }
      );
    } catch (err) {
      console.error("FS status update error", err);
    }
  });

  socket.on("order:join", ({ orderId }) => {
    socket.join("order_" + orderId);
  });

  socket.on("disconnect", () => {
    console.log("🔴 Socket disconnected:", socket.id);
  });
});

/* -----------------------------------
   START SERVER
----------------------------------- */
const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () => {
  console.log(`🚀 SH Server running on port ${PORT} (Mode: ${CF_MODE})`);
});
