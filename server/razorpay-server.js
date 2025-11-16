// server/razorpay-server.js
// Production-style backend for SH — The Hunger Point
// Features:
//  - Robust Firebase Admin init (escaped private key support)
//  - Environment validation + clear logs
//  - Admin login (bcrypt + JWT)
//  - Admin token verify endpoint
//  - Protected admin endpoints (update order status)
//  - Razorpay create order + verify payment
//  - Health check /ping
//  - Clear structured logging

import express from "express";
import cors from "cors";
import Razorpay from "razorpay";
import crypto from "crypto";
import admin from "firebase-admin";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// -----------------------------
// Config / Env
// -----------------------------
const REQUIRED_ENVS = [
  "FIREBASE_TYPE",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_PRIVATE_KEY_ID",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_CLIENT_ID",
  "FIREBASE_AUTH_URI",
  "FIREBASE_TOKEN_URI",
  "FIREBASE_AUTH_PROVIDER_CERT_URL",
  "FIREBASE_CLIENT_CERT_URL",
  "FIREBASE_UNIVERSE_DOMAIN",
  "JWT_SECRET",
  "RZP_KEY_ID",
  "RZP_KEY_SECRET",
];

function checkEnvs() {
  const missing = REQUIRED_ENVS.filter((k) => !process.env[k]);
  if (missing.length) {
    console.warn("⚠️ Missing environment variables:", missing.join(", "));
  } else {
    console.log("✅ All required environment variables present.");
  }
}

// Ensure we run the check early
checkEnvs();

// -----------------------------
// Helpers
// -----------------------------
function rebuildPrivateKey(escapedKey) {
  // If the private key contains literal '\n' sequences, convert them to real newlines
  if (!escapedKey) return null;
  return escapedKey.includes("\\n") ? escapedKey.replace(/\\n/g, "\n") : escapedKey;
}

function safeJson(res, status, payload) {
  res.status(status).json(payload);
}

// -----------------------------
// Firebase Admin initialization (robust)
// -----------------------------
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

  if (!serviceAccount.private_key) {
    throw new Error("FIREBASE_PRIVATE_KEY is missing or not formatted correctly.");
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log("✅ Firebase Admin initialized successfully.");
} catch (err) {
  console.error("🔥 Firebase Admin initialization failed:", err && err.message ? err.message : err);
  // continue running to show errors in logs; endpoints will fail if db is undefined
}

const db = admin.firestore && typeof admin.firestore === "function" ? admin.firestore() : null;

// -----------------------------
// Razorpay client
// -----------------------------
const razorpay = new Razorpay({
  key_id: process.env.RZP_KEY_ID || "",
  key_secret: process.env.RZP_KEY_SECRET || "",
});

// -----------------------------
// Express app
// -----------------------------
const app = express();
app.use(cors());
app.use(express.json());

// Basic health check
app.get("/ping", (req, res) => res.send("Server Awake ✔"));

// -----------------------------
// Middleware: require admin JWT
// -----------------------------
function requireAdminToken(req, res, next) {
  const auth = req.headers.authorization || req.headers.Authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return safeJson(res, 401, { ok: false, error: "Unauthorized" });
  }
  const token = auth.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "");
    req.admin = decoded;
    return next();
  } catch (err) {
    console.warn("Invalid admin token:", err && err.message ? err.message : err);
    return safeJson(res, 401, { ok: false, error: "Invalid token" });
  }
}

// -----------------------------
// Route: Admin Login
// POST /admin/login
// Body: { email, password }
// -----------------------------
app.post("/admin/login", async (req, res) => {
  try {
    if (!db) {
      console.error("DB not initialized in /admin/login");
      return safeJson(res, 500, { ok: false, error: "Server error" });
    }

    const { email, password } = req.body || {};
    if (!email || !password) {
      return safeJson(res, 400, { ok: false, error: "Email and password required" });
    }

    const doc = await db.collection("admins").doc(email).get();
    if (!doc.exists) {
      return safeJson(res, 200, { ok: false, error: "Invalid email or password" });
    }

    const adminData = doc.data();
    const passwordHash = adminData.passwordHash || adminData.password || "";

    const match = await bcrypt.compare(password, passwordHash);
    if (!match) {
      return safeJson(res, 200, { ok: false, error: "Invalid email or password" });
    }

    const token = jwt.sign({ email: adminData.email, role: "admin" }, process.env.JWT_SECRET || "", {
      expiresIn: "7d",
    });

    return safeJson(res, 200, { ok: true, token });
  } catch (err) {
    console.error("Admin Login Error:", err && err.message ? err.message : err);
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

// -----------------------------
// Route: Verify admin token (used by admin UI)
// GET /admin/verify  (or POST if you prefer token in body)
// Header: Authorization: Bearer <token>
// -----------------------------
app.get("/admin/verify", requireAdminToken, (req, res) => {
  return safeJson(res, 200, { ok: true, email: req.admin.email, role: req.admin.role });
});

// -----------------------------
// Route: Admin update order status (protected)
// POST /admin/update-status
// Body: { orderId, status }
// -----------------------------
app.post("/admin/update-status", requireAdminToken, async (req, res) => {
  try {
    if (!db) return safeJson(res, 500, { ok: false, error: "Server error" });

    const { orderId, status } = req.body || {};
    if (!orderId || !status) return safeJson(res, 400, { ok: false, error: "orderId and status required" });

    await db.collection("orders").doc(orderId).update({ status });
    return safeJson(res, 200, { ok: true });
  } catch (err) {
    console.error("Update status error:", err && err.message ? err.message : err);
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

// -----------------------------
// Route: Create Razorpay order (frontend)
// POST /create-order
// Body: { amount, items }
// -----------------------------
app.post("/create-order", async (req, res) => {
  try {
    const { amount, items } = req.body || {};
    if (!amount || Number(amount) <= 0) return safeJson(res, 400, { ok: false, error: "amount required" });

    const rzpOrder = await razorpay.orders.create({
      amount: Math.round(Number(amount) * 100), // ₹ -> paise
      currency: "INR",
      receipt: "rcpt_" + Date.now(),
    });

    return safeJson(res, 200, { ok: true, order: rzpOrder, key_id: process.env.RZP_KEY_ID });
  } catch (err) {
    console.error("Create order error:", err && err.message ? err.message : err);
    return safeJson(res, 500, { ok: false, error: "Failed to create order" });
  }
});

// -----------------------------
// Route: Verify Razorpay payment
// POST /verify-payment
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, items }
// -----------------------------
app.post("/verify-payment", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, items } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return safeJson(res, 400, { ok: false, error: "Missing payment fields" });
    }

    const hmac = crypto.createHmac("sha256", process.env.RZP_KEY_SECRET || "");
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpay_signature) {
      console.warn("Payment verification failed (signature mismatch).");
      return safeJson(res, 200, { ok: false, error: "Payment verification failed" });
    }

    const orderId = "ORD" + Date.now();
    const total =
      items && Array.isArray(items) ? items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 1)), 0) : 0;

    if (!db) {
      console.error("DB not initialized when saving order.");
      return safeJson(res, 500, { ok: false, error: "Server error" });
    }

    await db.collection("orders").doc(orderId).set({
      orderId,
      items,
      amount: total,
      razorpay_order_id,
      razorpay_payment_id,
      timestamp: Date.now(),
      status: "paid",
    });

    return safeJson(res, 200, { ok: true, orderId });
  } catch (err) {
    console.error("Verify payment error:", err && err.message ? err.message : err);
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

// -----------------------------
// Start server
// -----------------------------
const PORT = Number(process.env.PORT) || 10000;
app.listen(PORT, () => {
  console.log(`🚀 SH Hunger Server running on port ${PORT}`);
});