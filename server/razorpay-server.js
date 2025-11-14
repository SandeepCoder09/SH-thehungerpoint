// server/razorpay-server.js

require("dotenv").config();
const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const admin = require("firebase-admin");

const app = express();

/* --------------------------------------
   CORS FIX (works on Render + GitHub Pages)
--------------------------------------- */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(bodyParser.json());

/* --------------------------------------
   FIREBASE ADMIN INIT USING ENV VARIABLES
--------------------------------------- */
// FIREBASE ADMIN CONFIG USING ENV VARIABLES
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
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

/* --------------------------------------
   RAZORPAY INITIALIZATION
--------------------------------------- */
const razorpay = new Razorpay({
  key_id: process.env.RZP_KEY_ID,
  key_secret: process.env.RZP_KEY_SECRET,
});

/* --------------------------------------
   CREATE ORDER API
--------------------------------------- */
app.post("/create-order", async (req, res) => {
  try {
    const amount = req.body.amount * 100; // convert to paise

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: "receipt_" + new Date().getTime(),
    });

    res.send({
      ok: true,
      key_id: process.env.RZP_KEY_ID,
      order,
    });
  } catch (err) {
    console.log("Order error:", err);
    res.status(500).send({ ok: false, error: err });
  }
});

/* --------------------------------------
   VERIFY PAYMENT API
--------------------------------------- */
app.post("/verify-payment", async (req, res) => {
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
    return res.status(400).send({ ok: false, message: "Invalid signature" });
  }

  // Save order to Firebase
  const orderRef = await db.collection("orders").add({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    items,
    timestamp: Date.now(),
    status: "paid",
  });

  res.send({ ok: true, orderId: orderRef.id });
});

/* --------------------------------------
   START SERVER
--------------------------------------- */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🚀 Razorpay Server Running on PORT:", PORT);
});
