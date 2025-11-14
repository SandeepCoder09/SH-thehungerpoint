const db = firebase.firestore();
const table = document.getElementById("orderTable");
const ding = document.getElementById("ding");
let soundEnabled = false;

document.getElementById("enableSound").addEventListener("click", () => {
  soundEnabled = true;
  alert("Sound notifications enabled!");
});

function playSound() {
  if (soundEnabled) ding.play();
}

function renderOrder(id, data) {
  const items = data.items.map(i => `${i.name} × ${i.qty}`).join("<br>");
  const row = `
    <tr>
      <td>${id}</td>
      <td>${items}</td>
      <td>₹${data.total}</td>
      <td><span class="status">${data.status}</span></td>
      <td>
        <button class="update" onclick="updateStatus('${id}', 'Preparing')">Prep</button>
        <button class="update" onclick="updateStatus('${id}', 'Out for Delivery')">Out</button>
        <button class="update" onclick="updateStatus('${id}', 'Delivered')">Done</button>
      </td>
    </tr>
  `;
  return row;
}

async function updateStatus(id, status) {
  await db.collection("orders").doc(id).update({ status });
}

function loadOrders() {
  db.collection("orders").orderBy("createdAt", "desc").onSnapshot(snapshot => {
    let html = "";
    snapshot.docChanges().forEach(change => {
      if (change.type === "added" && soundEnabled) playSound();
    });
    snapshot.forEach(doc => {
      html += renderOrder(doc.id, doc.data());
    });
    table.innerHTML = html;
  });
}

loadOrders();
