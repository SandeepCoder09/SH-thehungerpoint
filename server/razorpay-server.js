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
const serviceAccount = {
  type: process.env.service_account,
  project_id: process.env.sh-the-hunger-point,
  private_key_id: process.env.a0433d7793ce1127041ab022d9f5a0c3f8648f81,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  client_email: process.env.firebase-adminsdk-fbsvc@sh-the-hunger-point.iam.gserviceaccount.com,
  client_id: process.env.113069436511916017152,
  auth_uri: process.env.https://oauth2.googleapis.com/token,
  token_uri: process.env.https://www.googleapis.com/oauth2/v1/certs,
  auth_provider_x509_cert_url: process.env.https://www.googleapis.com/oauth2/v1/certs,
  client_x509_cert_url: process.env.https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc@sh-the-hunger-point.iam.gserviceaccount.com,
  universe_domain: process.env.googleapis.com,
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
