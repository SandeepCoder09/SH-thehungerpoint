// ---------------------------
// SH - The Hunger Point Server
// ---------------------------

import express from "express";
import cors from "cors";
import Razorpay from "razorpay";
import crypto from "crypto";
import admin from "firebase-admin";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

// ---------------------------
// SERVER SETUP
// ---------------------------

const app = express();
app.use(express.json());
app.use(cors());

// ---------------------------
// FIREBASE ADMIN (Render ENV)
// ---------------------------

admin.initializeApp({
  credential: admin.credential.cert({
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
    universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
  }),
});

const db = admin.firestore();

// ---------------------------
// RAZORPAY SETUP
// ---------------------------

const razorpay = new Razorpay({
  key_id: process.env.RZP_KEY_ID,
  key_secret: process.env.RZP_KEY_SECRET,
});

// ---------------------------
// API ROUTES
// ---------------------------

// HEALTH CHECK (for cron-job)
app.get("/ping", (req, res) => {
  res.send("Server Awake ✔");
});

// ---------------------------
// 1) CREATE ORDER
// ---------------------------

app.post("/create-order", async (req, res) => {
  try {
    const { amount } = req.body;

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: "rcpt_" + Date.now(),
    });

    res.json({
      ok: true,
      order,
      key_id: process.env.RZP_KEY_ID,
    });
  } catch (err) {
    console.error("Order Error:", err);
    res.json({ ok: false, error: "Failed to create order" });
  }
});

// ---------------------------
// 2) VERIFY PAYMENT + SAVE ORDER
// ---------------------------

app.post("/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      items,
    } = req.body;

    const hmac = crypto.createHmac("sha256", process.env.RZP_KEY_SECRET);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.json({ ok: false, error: "Payment verification failed" });
    }

    const orderId = "ORD" + Date.now();

    await db.collection("orders").doc(orderId).set({
      orderId,
      items,
      razorpay_order_id,
      razorpay_payment_id,
      timestamp: Date.now(),
      status: "confirmed",
    });

    res.json({ ok: true, orderId });
  } catch (err) {
    console.error("Verify Error:", err);
    res.json({ ok: false, error: "Server error" });
  }
});

// ---------------------------
// 3) ADMIN LOGIN (NEW)
// ---------------------------

app.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const adminDoc = await db.collection("admins").doc(email).get();
    if (!adminDoc.exists)
      return res.json({ ok: false, error: "Invalid email or password" });

    const adminData = adminDoc.data();

    const match = await bcrypt.compare(password, adminData.passwordHash);
    if (!match)
      return res.json({ ok: false, error: "Invalid email or password" });

    const token = jwt.sign(
      { email: adminData.email, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ ok: true, token });
  } catch (err) {
    console.error("Admin Login Error:", err);
    res.json({ ok: false, error: "Server error" });
  }
});

// ---------------------------
// START SERVER
// ---------------------------

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 SH Hunger Server Running on PORT ${PORT}`);
});