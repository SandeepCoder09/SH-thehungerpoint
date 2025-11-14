// razorpay-server.js
require("dotenv").config();
const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");

const app = express();

// ------------------------------------------------------------
// 1️⃣ CORS — Allow GitHub Pages + anywhere (safe for now)
// ------------------------------------------------------------
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(bodyParser.json());

// ------------------------------------------------------------
// 2️⃣ Firebase Admin SDK Setup (using Render ENV variables)
// ------------------------------------------------------------
const serviceAccount = {
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
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ------------------------------------------------------------
// 3️⃣ Razorpay Credentials (from ENV variables)
// ------------------------------------------------------------
const razorpay = new Razorpay({
  key_id: process.env.RZP_KEY_ID,
  key_secret: process.env.RZP_KEY_SECRET
});

// ------------------------------------------------------------
// 4️⃣ Create Razorpay Order Route
// ------------------------------------------------------------
app.post("/create-order", async (req, res) => {
  try {
    const { amount } = req.body;

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: "receipt_" + Date.now()
    });

    res.json({
      ok: true,
      order,
      key_id: process.env.RZP_KEY_ID
    });
  } catch (err) {
    console.error("Create Order Error:", err);
    res.json({ ok: false, error: err });
  }
});

// ------------------------------------------------------------
// 5️⃣ Verify Payment Route
// ------------------------------------------------------------
const crypto = require("crypto");

app.post("/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      items
    } = req.body;

    const hmac = crypto.createHmac("sha256", process.env.RZP_KEY_SECRET);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const expectedSignature = hmac.digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.json({ ok: false, message: "Payment verification failed" });
    }

    // Save order to Firebase
    const ref = await db.collection("orders").add({
      razorpay_order_id,
      razorpay_payment_id,
      items,
      timestamp: Date.now()
    });

    res.json({ ok: true, orderId: ref.id });
  } catch (err) {
    console.error("Verify Payment Error:", err);
    res.json({ ok: false });
  }
});

// ------------------------------------------------------------
// 6️⃣ /ping Route — Used by Cron Job to keep server awake
// ------------------------------------------------------------
app.get("/ping", (req, res) => {
  res.send("Server Active ✔");
});

// ------------------------------------------------------------
// 7️⃣ Start Server
// ------------------------------------------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Razorpay Server Running on PORT: ${PORT}`);
});