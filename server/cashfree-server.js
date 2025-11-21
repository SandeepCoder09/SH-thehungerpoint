// server/cashfree-server.js
import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import fetch from "node-fetch";

// -----------------------------
// Convert private key from env
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

// -----------------------------
// Firebase Admin initialization
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
  console.error("🔥 Firebase init failed:", err.message);
}

// -----------------------------
// Helpers
// -----------------------------
const safeJson = (res, status, obj) => res.status(status).json(obj);

function requireAdminToken(req, res, next) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return safeJson(res, 401, { ok: false, error: "Unauthorized" });

  const token = auth.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch {
    return safeJson(res, 401, { ok: false, error: "Invalid token" });
  }
}

// -----------------------------
// Express setup
// -----------------------------
const app = express();
app.use(cors());
app.use(express.json());

app.get("/ping", (req, res) => res.send("Server Awake ✔"));

// -----------------------------
// Admin login system
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

// Update status
app.post("/admin/update-status", requireAdminToken, async (req, res) => {
  try {
    if (!db) return safeJson(res, 500, { ok: false, error: "Server error" });

    const { orderId, status } = req.body;
    if (!orderId || !status) return safeJson(res, 400, { ok: false, error: "Missing inputs" });

    await db.collection("orders").doc(orderId).update({ status });

    return safeJson(res, 200, { ok: true });

  } catch (err) {
    console.error("Status update error:", err);
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

// -----------------------------
// Cashfree — Create Order
// -----------------------------
app.post("/create-cashfree-order", async (req, res) => {
  try {
    const { amount, items, phone, email } = req.body;

    if (!amount || Number(amount) <= 0)
      return safeJson(res, 400, { ok: false, error: "Amount required" });

    const body = {
      order_amount: Number(amount),
      order_currency: "INR",
      customer_details: {
        customer_id: phone || "guest",
        customer_phone: phone || "9999999999",
        customer_email: email || "guest@example.com"
      }
    };

    const cfRes = await fetch("https://api.cashfree.com/pg/orders", {
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

    const orderId = data.order_id || data.data?.order_id;
    const session = data.payment_session_id || data.data?.payment_session_id;

    if (!orderId || !session) {
      return safeJson(res, 500, { ok: false, error: "Cashfree failed", raw: data });
    }

    return safeJson(res, 200, { ok: true, orderId, session, raw: data });

  } catch (err) {
    console.error("Cashfree create order error:", err);
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

// -----------------------------
// Cashfree — Verify Payment
// -----------------------------
app.post("/verify-cashfree-payment", async (req, res) => {
  try {
    const { orderId, items } = req.body;

    if (!orderId) return safeJson(res, 400, { ok: false, error: "orderId required" });

    const resp = await fetch(`https://api.cashfree.com/pg/orders/${orderId}`, {
      headers: {
        "x-api-version": "2022-09-01",
        "x-client-id": process.env.CF_APP_ID,
        "x-client-secret": process.env.CF_SECRET_KEY
      }
    });

    const data = await resp.json();

    if (data.order_status !== "PAID") {
      return safeJson(res, 200, { ok: false, error: "Payment not completed", raw: data });
    }

    const total = items.reduce((s, it) =>
      s + (Number(it.price || 0) * Number(it.qty || 1)), 0
    );

    // FIXED 🔥 — Firebase order ID MUST match Cashfree order ID
    const newOrderId = orderId;

    await db.collection("orders").doc(newOrderId).set({
      items,
      total,
      status: "paid",
      cashfree_order_id: orderId,
      createdAt: admin.firestore.Timestamp.now()
    });

    return safeJson(res, 200, { ok: true, orderId: newOrderId });

  } catch (err) {
    console.error("Cashfree verify error:", err);
    return safeJson(res, 500, { ok: false, error: "Server error" });
  }
});

// -----------------------------
// Start server
// -----------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 SH Cashfree server running on ${PORT}`));