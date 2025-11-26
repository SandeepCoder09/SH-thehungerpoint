/* Track-order script (Leaflet + Socket) */

const SERVER_SOCKET = "https://sh-thehungerpoint.onrender.com"; // your server
const params = new URLSearchParams(window.location.search);
const orderId = params.get('orderId') || null;

const $ = (s) => document.querySelector(s);

let map, riderMarker, userMarker;
let socket;

/* init map after leaflet loads */
function initMap() {
  try {
    map = L.map('map', { zoomControl: false }).setView([25.15, 82.58], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: ''
    }).addTo(map);
  } catch (err) {
    console.error('Map init failed', err);
    document.getElementById('map').style.background = '#ddd';
  }
}

/* add or update markers */
function addOrUpdateRider(lat,lng) {
  if (!map) return;
  if (!riderMarker) {
    riderMarker = L.marker([lat,lng], {
      icon: L.icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png', iconSize: [38,38] })
    }).addTo(map);
  } else riderMarker.setLatLng([lat,lng]);
  map.panTo([lat,lng], { animate: true, duration: 0.6 });
}

function addOrUpdateUser(lat,lng) {
  if (!map) return;
  if (!userMarker) {
    userMarker = L.marker([lat,lng], {
      icon: L.icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png', iconSize: [34,34] })
    }).addTo(map);
  } else userMarker.setLatLng([lat,lng]);
}

/* update UI status and timeline */
function setStatus(status, eta) {
  const st = (status||'preparing').toLowerCase();
  const statusText = st === 'out_for_delivery' ? 'Out for Delivery' : (st === 'delivered' ? 'Delivered' : 'Preparing');
  $('#orderStatus').textContent = statusText;
  $('#etaText').textContent = (eta ? (eta + ' min') : '— min');

  // timeline
  const stepMap = { preparing:1, out_for_delivery:2, delivered:3 };
  const step = stepMap[st] || 1;
  [1,2,3].forEach(n => {
    const el = document.getElementById('step'+n);
    if (!el) return;
    if (n <= step) el.classList.add('active'); else el.classList.remove('active');
  });
}

/* load order from firestore and init markers */
async function loadOrder() {
  if (!orderId) return alert('Order id missing');
  if (typeof firebase === 'undefined' || !firebase.firestore) {
    console.warn('Firebase missing');
    return;
  }
  try {
    const doc = await firebase.firestore().collection('orders').doc(orderId).get();
    if (!doc.exists) return alert('Order not found');

    const data = doc.data();
    // items
    $('#itemsList').innerHTML = (data.items||[]).map(i => `${i.name} × ${i.qty}`).join('<br>');
    // status
    setStatus(data.status, data.eta);

    // user location if provided
    if (data.userLocation && data.userLocation.lat && data.userLocation.lng) {
      addOrUpdateUser(data.userLocation.lat, data.userLocation.lng);
      if (map) map.fitBounds([[data.userLocation.lat, data.userLocation.lng]], { maxZoom: 15 });
    }
  } catch (err) {
    console.error('loadOrder failed', err);
  }
}

/* socket connection to receive rider updates for order */
function startSocket() {
  try {
    socket = io(SERVER_SOCKET, { transports: ['websocket', 'polling'] });
    socket.on('connect', () => {
      if (orderId) socket.emit('order:join', { orderId });
    });

    socket.on('order:riderLocation', (data) => {
      if (!data) return;
      if (data.orderId && String(data.orderId) !== String(orderId)) return;
      if (data.lat && data.lng) addOrUpdateRider(data.lat, data.lng);
      if (data.status) setStatus(data.status, data.eta);
    });

    socket.on('connect_error', (err) => console.warn('socket err', err));
  } catch (err) {
    console.warn('socket failed', err);
  }
}

/* init */
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadOrder();
  startSocket();

  // optional actions
  $('#callBtn').onclick = () => window.location.href = 'tel:+911234567890';
  $('#helpBtn').onclick = () => alert('Contact support at +91 12345 67890');
});