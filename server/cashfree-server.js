// server/cashfree-server.js
import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import fetch from "node-fetch";

// -----------------------------
// Fix Private Key (Render issue)
// -----------------------------
function fixPrivateKey(raw) {
  return raw?.replace(/\\n/g, "\n");
}

// -----------------------------
// Check envs (good for debugging)
// -----------------------------
[
  "FIREBASE_PROJECT_ID",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_CLIENT_EMAIL",
  "JWT_SECRET",
  "CF_APP_ID",
  "CF_SECRET_KEY"
].forEach(k => {
  if (!process.env[k]) console.warn("⚠️ Missing ENV:", k);
});

// -----------------------------
// Firebase Admin Init
// -----------------------------
let db = null;

try {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: fixPrivateKey(process.env.FIREBASE_PRIVATE_KEY),
      client_email: process.env.FIREBASE_CLIENT_EMAIL
    })
  });

  db = admin.firestore();
  console.log("🔥 Firebase Admin Connected");
} catch (err) {
  console.error("❌ Firebase Init Error:", err);
}

// -----------------------------
// Express App
// -----------------------------
const app = express();
app.use(cors());
app.use(express.json());

// -----------------------------
// Test Route
// -----------------------------
app.get("/ping", (req, res) => res.send("Server OK ✔"));

// -----------------------------
// ADMIN AUTH
// -----------------------------
app.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const doc = await db.collection("admins").doc(email).get();
    if (!doc.exists) return res.json({ ok: false, error: "Invalid credentials" });

    const data = doc.data();
    const match = await bcrypt.compare(password, data.passwordHash);
    if (!match) return res.json({ ok: false, error: "Invalid credentials" });

    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({ ok: true, token });
  } catch (err) {
    console.error(err);
    res.json({ ok: false, error: "Server error" });
  }
});

// -----------------------------
// CREATE CASHFREE ORDER
// -----------------------------
app.post("/create-cashfree-order", async (req, res) => {
  try {
    const { amount, items, email, phone } = req.body;

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
    console.log("CF Create Response →", data);

    const orderId = data.order_id || data?.data?.order_id;
    const session = data.payment_session_id || data?.data?.payment_session_id;

    if (!orderId || !session) {
      return res.json({ ok: false, error: "Cashfree error", raw: data });
    }

    // TEMP order save (status = pending)
    await db.collection("tempOrders").doc(orderId).set({
      orderId,
      amount,
      items,
      email,
      phone,
      createdAt: admin.firestore.Timestamp.now(),
      status: "pending"
    });

    res.json({ ok: true, orderId, session });
  } catch (err) {
    console.error(err);
    res.json({ ok: false, error: "Server error" });
  }
});

// -----------------------------
// VERIFY PAYMENT AFTER SUCCESS
// -----------------------------
app.post("/verify-cashfree-payment", async (req, res) => {
  try {
    const { orderId } = req.body;

    const cf = await fetch(`https://api.cashfree.com/pg/orders/${orderId}`, {
      headers: {
        "x-api-version": "2022-09-01",
        "x-client-id": process.env.CF_APP_ID,
        "x-client-secret": process.env.CF_SECRET_KEY
      }
    });

    const data = await cf.json();
    console.log("CF Verify →", data);

    if (data.order_status !== "PAID") {
      return res.json({ ok: false, error: "Payment not completed" });
    }

    const temp = await db.collection("tempOrders").doc(orderId).get();
    const info = temp.data();

    const finalId = "ORD" + Date.now();

    await db.collection("orders").doc(finalId).set({
      orderId: finalId,
      cashfree_order_id: orderId,
      status: "paid",
      total: Number(data.order_amount),
      items: info.items,
      email: info.email,
      phone: info.phone,
      createdAt: admin.firestore.Timestamp.now()
    });

    res.json({ ok: true, orderId: finalId });
  } catch (err) {
    console.error(err);
    res.json({ ok: false, error: "Server error" });
  }
});

// -----------------------------
// CASHFREE WEBHOOK (AUTO VERIFY)
// -----------------------------
app.post("/cashfree-webhook", async (req, res) => {
  try {
    const event = req.body;

    const cfOrderId = event?.data?.order?.order_id;
    const status = event?.data?.order?.status;

    if (status !== "PAID") return res.json({ ok: true });

    const temp = await db.collection("tempOrders").doc(cfOrderId).get();
    if (!temp.exists) return res.json({ ok: true });

    const info = temp.data();
    const finalId = "ORD" + Date.now();

    await db.collection("orders").doc(finalId).set({
      orderId: finalId,
      cashfree_order_id: cfOrderId,
      items: info.items,
      email: info.email,
      phone: info.phone,
      total: info.amount,
      status: "paid",
      via: "webhook",
      createdAt: admin.firestore.Timestamp.now()
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.json({ ok: false });
  }
});

// -----------------------------
// START SERVER
// -----------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🚀 Server Running on PORT " + PORT);
});