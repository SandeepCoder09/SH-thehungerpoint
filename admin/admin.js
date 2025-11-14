// Block page if admin is not logged in
if (localStorage.getItem("adminAuth") !== "true") {
  window.location.href = "login.html";
}

const db = firebase.firestore();
const ordersDiv = document.getElementById("orders");

function renderOrder(order) {
  return `
    <div class="order-box">
      <p><b>Order ID:</b> ${order.orderId}</p>
      <p><b>Item:</b> ${order.items[0].name}</p>
      <p><b>Qty:</b> ${order.items[0].qty}</p>
      <p><b>Total:</b> ₹${order.amount}</p>
      <p><b>Time:</b> ${new Date(order.createdAt).toLocaleString()}</p>
      <hr/>
    </div>
  `;
}

db.collection("orders").orderBy("createdAt", "desc").onSnapshot(snapshot => {
  ordersDiv.innerHTML = "";
  snapshot.forEach(doc => {
    ordersDiv.innerHTML += renderOrder(doc.data());
  });
});

document.getElementById("logoutBtn").onclick = () => {
  localStorage.removeItem("adminAuth");
  window.location.href = "login.html";
};
