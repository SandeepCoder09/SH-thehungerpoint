let currentRider = null;
let map;
let riderMarker;

// LOGIN
document.getElementById("loginBtn").onclick = async () => {
  const email = riderEmail.value;
  const pass = riderPass.value;

  try {
    await firebase.auth().signInWithEmailAndPassword(email, pass);
  } catch (err) {
    return alert("Login failed");
  }
};

// LISTEN AUTH
firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) {
    document.getElementById("loginScreen").classList.add("active");
    document.getElementById("dashboardScreen").classList.remove("active");
    return;
  }

  currentRider = user;
  riderName.textContent = user.email;
  document.getElementById("loginScreen").classList.remove("active");
  document.getElementById("dashboardScreen").classList.add("active");

  loadRiderOrders();
  startLiveLocation();
});

// LOGOUT
logoutBtn.onclick = () => firebase.auth().signOut();

// LOAD ORDERS ASSIGNED TO RIDER
function loadRiderOrders() {
  firebase.firestore().collection("orders")
    .where("riderId", "==", currentRider.uid)
    .onSnapshot((snap) => {
      orderContainer.innerHTML = "";

      snap.forEach((doc) => {
        const order = doc.data();
        const div = document.createElement("div");
        div.className = "order-item";

        div.innerHTML = `
          <b>Order ID:</b> ${doc.id}<br>
          <b>Status:</b> ${order.status}<br>
          <button class="status-btn" onclick="updateStatus('${doc.id}', 'picked')">Picked Up</button>
          <button class="status-btn" onclick="updateStatus('${doc.id}', 'delivering')">Delivering</button>
          <button class="status-btn" onclick="updateStatus('${doc.id}', 'delivered')">Delivered</button>
        `;

        orderContainer.appendChild(div);
      });
    });
}

function updateStatus(id, status) {
  firebase.firestore().collection("orders").doc(id).update({
    status,
    updatedAt: new Date()
  });
}

// LIVE LOCATION SENDER
function startLiveLocation() {
  navigator.geolocation.watchPosition((pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    // save in rider profile
    firebase.firestore().collection("riders").doc(currentRider.uid).set({
      name: currentRider.email,
      currentLocation: { lat, lng },
      online: true
    }, { merge: true });

    // send to active orders
    firebase.firestore().collection("orders")
      .where("riderId", "==", currentRider.uid)
      .get()
      .then((snap) => {
        snap.forEach((doc) => {
          firebase.firestore().collection("orders").doc(doc.id).update({
            riderLocation: { lat, lng }
          });
        });
      });

    // Update map
    updateMap(lat, lng);
  });
}

function updateMap(lat, lng) {
  if (!map) {
    map = new google.maps.Map(document.getElementById("map"), {
      zoom: 16,
      center: { lat, lng }
    });

    riderMarker = new google.maps.Marker({
      map,
      position: { lat, lng },
      icon: "/assets/icons/rider.png"
    });
  }

  riderMarker.setPosition({ lat, lng });
  map.setCenter({ lat, lng });
}