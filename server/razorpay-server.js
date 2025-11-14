// razorpay-server.js — MERGED AUTH + PAYMENT + FIRESTORE MANAGER

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Razorpay from "razorpay";
import crypto from "crypto";
import admin from "firebase-admin";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ---------------- FIREBASE ADMIN ------------------
if (!admin.apps.length) {
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
    }),
  });
}

const db = admin.firestore();

// ---------------- RAZORPAY INIT ------------------
const razorpay = new Razorpay({
  key_id: process.env.RZP_KEY_ID,
  key_secret: process.env.RZP_KEY_SECRET,
});

// ---------------- ADMIN AUTH SETTINGS ------------------
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || "super_secret_change_me";

// ---------------------------------------------------------------------
// 🔥 ROUTES START
// ---------------------------------------------------------------------

// HEALTH CHECK
app.get("/ping", (req, res) => res.json({ ok: true }));

// ---------------------------------------------------------------------
// 🔥 CREATE ORDER (PUBLIC) — used from user website
// ---------------------------------------------------------------------
app.post("/create-order", async (req, res) => {
  try {
    const { amount, items } = req.body;

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: "rcpt_" + Date.now(),
    });

    return res.json({
      ok: true,
      order,
      key_id: process.env.RZP_KEY_ID,
    });
  } catch (error) {
    console.error("Order creation failed:", error);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ---------------------------------------------------------------------
// 🔥 VERIFY PAYMENT (PUBLIC)
// ---------------------------------------------------------------------
app.post("/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      items,
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RZP_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.json({ ok: false, error: "Invalid signature" });
    }

    // Save order in Firestore
    const docRef = await db.collection("orders").add({
      createdAt: Date.now(),
      items,
      paymentId: razorpay_payment_id,
      status: "pending",
    });

    return res.json({ ok: true, orderId: docRef.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

// ---------------------------------------------------------------------
// 🔥 ADMIN LOGIN
// ---------------------------------------------------------------------
app.post("/admin/login", async (req, res) => {
  const { email, password } = req.body;

  if (email !== ADMIN_EMAIL)
    return res.status(403).json({ ok: false, error: "Invalid email" });

  const match = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if (!match)
    return res.status(401).json({ ok: false, error: "Incorrect password" });

  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "6h" });

  return res.json({ ok: true, token });
});

// ---------------------------------------------------------------------
// 🔥 MIDDLEWARE — VERIFY ADMIN JWT
// ---------------------------------------------------------------------
function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer "))
    return res.status(401).json({ ok: false, error: "Unauthorized" });

  try {
    const token = auth.split(" ")[1];
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ ok: false, error: "Invalid token" });
  }
}

// ---------------------------------------------------------------------
// 🔥 ADMIN VERIFY TOKEN
// ---------------------------------------------------------------------
app.get("/admin/verify", verifyToken, (req, res) => {
  res.json({ ok: true });
});

// ---------------------------------------------------------------------
// 🔥 ADMIN ORDER STATUS UPDATE
// ---------------------------------------------------------------------
app.post("/admin/update-status", verifyToken, async (req, res) => {
  const { orderId, status } = req.body;

  try {
    await db.collection("orders").doc(orderId).update({ status });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

// ---------------------------------------------------------------------
// 🔥 GET ALL ORDERS (ADMIN ONLY)
// ---------------------------------------------------------------------
app.get("/admin/orders", verifyToken, async (req, res) => {
  try {
    const snap = await db.collection("orders").orderBy("createdAt", "desc").get();
    const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ ok: true, list });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

// ---------------------------------------------------------------------
// 🔥 START SERVER
// ---------------------------------------------------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`🔥 SH HungerPoint Server running on port ${PORT}`)
);
