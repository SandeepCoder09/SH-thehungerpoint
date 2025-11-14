// server/razorpay-server.js

require("dotenv").config();
const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const admin = require("firebase-admin");
const serviceAccount = require("./admin/serviceAccountKey.json");

const app = express();

// 1️⃣ CORS FIX
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(bodyParser.json());

// 2️⃣ Firebase Admin Initialization
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// 3️⃣ Razorpay Credentials
const RZP_KEY_ID = process.env.RZP_KEY_ID;
const RZP_KEY_SECRET = process.env.RZP_KEY_SECRET;

if (!RZP_KEY_ID || !RZP_KEY_SECRET) {
  console.log("❌ ERROR: Razorpay keys missing in .env");
  process.exit(1);
}

const razorpay = new Razorpay({
  key_id: RZP_KEY_ID,
  key_secret: RZP_KEY_SECRET
});

// 4️⃣ CREATE PAYMENT ORDER
app.post("/create-order", async (req, res) => {
  try {
    const { amount, items } = req.body;

    if (!amount || !items) {
      return res.status(400).json({ error: "Amount or items missing" });
    }

    const options = {
      amount: amount * 100,
      currency: "INR",
      receipt: "receipt_" + Date.now()
    };

    // Create order in Razorpay
    const order = await razorpay.orders.create(options);

    // Save to Firestore
    await db.collection("orders").add({
      items: items,
      total: amount,
      status: "Pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      razorpayOrderId: order.id
    });

    res.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency
    });

  } catch (error) {
    console.error("❌ Error creating order:", error);
    res.status(500).json({ error: "Order creation failed" });
  }
});


// 5️⃣ SERVER LISTENER
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 SH Hunger Backend running on port ${PORT}`);
});
