// server/cashfree-server.js
// Production-ready backend for SH — The Hunger Point
// - Firebase Admin initialization
// - JWT admin authentication
// - Admin login + verify + update status
// - Cashfree create order + verify payment
// - Health check

import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import fetch from "node-fetch";   // required for Cashfree API calls

// -----------------------------
// Environment variables required:
// -----------------------------

  FIREBASE_TYPE
  FIREBASE_PROJECT_ID
  FIREBASE_PRIVATE_KEY_ID
  FIREBASE_PRIVATE_KEY
  FIREBASE_CLIENT_EMAIL
  FIREBASE_CLIENT_ID
  FIREBASE_AUTH_URI
  FIREBASE_TOKEN_URI
  FIREBASE_AUTH_PROVIDER_CERT_URL
  FIREBASE_CLIENT_CERT_URL
  FIREBASE_UNIVERSE_DOMAIN
  JWT_SECRET
  CF_APP_ID
  CF_SECRET_KEY


// -----------------------------
const safeJson = (res, status, obj) => res.status(status).json(obj);

function rebuildPrivateKey(rawKey) {
  if (!rawKey) return null;
  return rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;
}

// -----------------------------
// Firebase Admin Init
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
    universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  db = admin.firestore();
  console.log("✅ Firebase Admin initialized.");
} catch (err) {
  console.error("🔥 Firebase Admin init failed:", err);
}

// -----------------------------
// Express init
// -----------------------------
const app = express();
app.use(cors());
app.use(express.json());

app.get("/ping", (req, res) => res.send("Server Awake ✔"));

// -----------------------------
// Middleware: Admin Auth
// -----------------------------
function requireAdminToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return safeJson(res, 401, { ok: false, error: "Unauthorized" });
  }
  try {
    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch {
    return safeJson(res, 401, { ok: false, error: "Invalid token" });
  }
}

// -----------------------------
// Admin Login
// -----------------------------
app.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const doc = await db.collection("admins").doc(email).get();
    if (!doc.exists) return safeJson(res, 200, { ok: false, error: "Invalid email or password" });

    const adminData = doc.data();
    const match = await bcrypt.compare(password, adminData.passwordHash);

    if (!match) return safeJson(res, 200, { ok: false, error: "Invalid email or password" });

    const token = jwt.sign({ email, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "7d" });

    return safeJson(res, 200, { ok: true, token });
  } catch (err) {
    console.error("Admin login error:", err);
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

// -----------------------------
// Admin Token Verify
// -----------------------------
app.get("/admin/verify", requireAdminToken, (req, res) => {
  return safeJson(res, 200, { ok: true, email: req.admin.email });
});

// -----------------------------
// Admin Update Order Status
// -----------------------------
app.post("/admin/update-status", requireAdminToken, async (req, res) => {
  try {
    const { orderId, status } = req.body;

    await db.collection("orders").doc(orderId).update({ status });

    return safeJson(res, 200, { ok: true });
  } catch (err) {
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

// -----------------------------
// CASHFREE: CREATE ORDER
// /create-order
// -----------------------------
app.post("/create-order", async (req, res) => {
  try {
    const { amount, items, phone, email } = req.body;

    if (!amount) return safeJson(res, 400, { ok: false, error: "amount required" });

    const body = {
      order_amount: Number(amount),
      order_currency: "INR",
      customer_details: {
        customer_id: phone || "guest",
        customer_phone: phone || "9999999999",
        customer_email: email || "guest@email.com",
      },
      order_meta: {
        return_url: "https://sh-the-hunger-point.vercel.app/payment-success",
      },
    };

    const cfRes = await fetch("https://api.cashfree.com/pg/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-version": "2022-09-01",
        "x-client-id": process.env.CF_APP_ID,
        "x-client-secret": process.env.CF_SECRET_KEY,
      },
      body: JSON.stringify(body),
    });

    const data = await cfRes.json();

    return safeJson(res, 200, { ok: true, data });
  } catch (err) {
    console.error("Cashfree create order error:", err);
    return safeJson(res, 500, { ok: false, error: "Cashfree order failed" });
  }
});

// -----------------------------
// CASHFREE: VERIFY PAYMENT
// /verify-payment
// -----------------------------
app.post("/verify-payment", async (req, res) => {
  try {
    const { orderId, items } = req.body;

    const resp = await fetch(`https://api.cashfree.com/pg/orders/${orderId}`, {
      headers: {
        "x-api-version": "2022-09-01",
        "x-client-id": process.env.CF_APP_ID,
        "x-client-secret": process.env.CF_SECRET_KEY,
      },
    });

    const data = await resp.json();

    if (data.order_status !== "PAID") {
      return safeJson(res, 200, { ok: false, error: "Payment not completed" });
    }

    const total =
      items && Array.isArray(items)
        ? items.reduce((s, it) => s + it.price * it.qty, 0)
        : 0;

    const newOrderId = "ORD" + Date.now();

    await db.collection("orders").doc(newOrderId).set({
      orderId: newOrderId,
      items,
      amount: total,
      cashfree_order_id: orderId,
      timestamp: Date.now(),
      status: "paid",
    });

    return safeJson(res, 200, { ok: true, orderId: newOrderId });
  } catch (err) {
    console.error("Cashfree verify payment error:", err);
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

// -----------------------------
// START SERVER
// -----------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`🚀 SH Cashfree Server running on port ${PORT}`)
);