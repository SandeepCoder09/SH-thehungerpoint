// track.js — User Tracking Page (Firestore + Google Maps + Directions)
// Assumptions:
// - You have /auth/firebase-config.js that initializes firebase
// - Each order document lives in "orders" collection and has fields:
//    customerLocation: { lat: number, lng: number }
//    riderLocation: { lat: number, lng: number }   (optional until assigned)
//    restaurantLocation: { lat: number, lng: number }
//    riderId: string
//    status: string
//    riderName: string (optional)
// - The page expects ?orderId=ORDER_ID in the URL; if absent it asks user to enter / shows placeholder.

let map, directionsRenderer, directionsService;
let riderMarker = null, customerMarker = null, shopMarker = null;
let routePolyline = null;
let smoothingTimer = null;

// Helper: read orderId from URL ?orderId=...
function getOrderIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('orderId');
}

const orderId = getOrderIdFromURL();
const orderIdLabel = document.getElementById('orderIdLabel');
const orderStatusEl = document.getElementById('orderStatus');
const riderNameEl = document.getElementById('riderName');
const etaEl = document.getElementById('eta');
const distanceTextEl = document.getElementById('distanceText');

if (!orderId) {
  orderIdLabel.textContent = "No orderId provided in URL";
  alert('Open this page with ?orderId=YOUR_ORDER_ID (e.g. /track/index.html?orderId=abc123)');
} else {
  orderIdLabel.textContent = orderId;
  init();
}

// Initialize map + listeners
function init() {
  // initialize map centered roughly
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 26.4499, lng: 80.3319 },
    zoom: 14,
    gestureHandling: 'greedy'
  });

  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({
    suppressMarkers: true,
    polylineOptions: { strokeColor: '#E23744', strokeWeight: 5, strokeOpacity: 0.9 }
  });
  directionsRenderer.setMap(map);

  // Listen for order doc updates
  const orderRef = firebase.firestore().collection('orders').doc(orderId);
  orderRef.onSnapshot(doc => {
    if (!doc.exists) {
      console.warn('Order not found:', orderId);
      return;
    }
    const data = doc.data();
    updateOrderUI(data);
    updateLocationsOnMap(data);
  });

  // Allow user to share their current location with one click
  document.getElementById('detectLocation').addEventListener('click', () => {
    if (!navigator.geolocation) return alert('Geolocation not supported');
    navigator.geolocation.getCurrentPosition(pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      // Save customer location to order doc (so admin/rider see it)
      firebase.firestore().collection('orders').doc(orderId).update({
        customerLocation: { lat, lng },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(() => {
        console.log('Customer location saved');
      }).catch(err => console.error(err));
    }, err => {
      alert('Please allow location permission');
    }, { enableHighAccuracy: true });
  });
}

// Update small UI fields
function updateOrderUI(data) {
  orderStatusEl.textContent = data.status || '—';
  riderNameEl.textContent = data.riderName || (data.riderId ? data.riderId : '—');
}

// Update or create markers and recompute route/ETA
function updateLocationsOnMap(data) {
  // Shop (restaurant)
  if (data.restaurantLocation) {
    const pos = { lat: data.restaurantLocation.lat, lng: data.restaurantLocation.lng };
    if (!shopMarker) {
      shopMarker = new google.maps.Marker({
        position: pos,
        map,
        title: 'Restaurant',
        icon: '/assets/icons/shop.svg'
      });
    } else shopMarker.setPosition(pos);
  }

  // Customer
  if (data.customerLocation) {
    const pos = { lat: data.customerLocation.lat, lng: data.customerLocation.lng };
    if (!customerMarker) {
      customerMarker = new google.maps.Marker({
        position: pos,
        map,
        title: 'You',
        icon: '/assets/icons/customer.svg'
      });
    } else customerMarker.setPosition(pos);
  }

  // Rider
  if (data.riderLocation) {
    const pos = { lat: data.riderLocation.lat, lng: data.riderLocation.lng };
    if (!riderMarker) {
      riderMarker = new google.maps.Marker({
        position: pos,
        map,
        title: 'Rider',
        icon: '/assets/icons/rider.svg'
      });
    } else {
      // Smoothly animate marker movement
      animateMarkerTo(riderMarker, pos);
    }
  }

  // Fit map to markers if possible
  fitMapToMarkers();

  // If both rider and customer present compute route + ETA
  if (data.riderLocation && data.customerLocation) {
    computeRouteAndETA(data.riderLocation, data.customerLocation);
  } else if (data.riderLocation && data.restaurantLocation) {
    // rider -> shop route if customer not set yet
    computeRouteAndETA(data.riderLocation, data.restaurantLocation);
  } else {
    // clear route
    directionsRenderer.set('directions', null);
    etaEl.textContent = 'ETA: —';
    distanceTextEl.textContent = '—';
  }
}

// Fit map so markers are visible but not too zoomed
function fitMapToMarkers() {
  const bounds = new google.maps.LatLngBounds();
  let any = false;
  [shopMarker, customerMarker, riderMarker].forEach(m => {
    if (m && m.getPosition) {
      bounds.extend(m.getPosition());
      any = true;
    }
  });
  if (any) {
    map.fitBounds(bounds, 120);
  }
}

// Compute route + ETA using Google Directions API
function computeRouteAndETA(originLoc, destLoc) {
  const origin = new google.maps.LatLng(originLoc.lat, originLoc.lng);
  const destination = new google.maps.LatLng(destLoc.lat, destLoc.lng);

  directionsService.route({
    origin,
    destination,
    travelMode: google.maps.TravelMode.DRIVING,
    drivingOptions: { departureTime: new Date() }
  }, (result, status) => {
    if (status === 'OK' && result) {
      directionsRenderer.setDirections(result);

      // Grab first route leg for ETA & distance
      const leg = result.routes[0].legs[0];
      etaEl.textContent = `ETA: ${leg.duration.text}`;
      distanceTextEl.textContent = `${leg.distance.text}`;
    } else {
      console.warn('Directions failed:', status);
      etaEl.textContent = `ETA: —`;
      distanceTextEl.textContent = `—`;
    }
  });
}

/* Smooth marker movement */
function animateMarkerTo(marker, newPos) {
  if (!marker.__animInterval) marker.__animInterval = null;
  const start = marker.getPosition();
  const end = new google.maps.LatLng(newPos.lat, newPos.lng);

  // stop existing
  if (marker.__animInterval) {
    clearInterval(marker.__animInterval);
    marker.__animInterval = null;
  }

  const steps = 20;
  let step = 0;
  const latDelta = (end.lat() - start.lat()) / steps;
  const lngDelta = (end.lng() - start.lng()) / steps;

  marker.__animInterval = setInterval(() => {
    step++;
    const lat = start.lat() + latDelta * step;
    const lng = start.lng() + lngDelta * step;
    marker.setPosition({ lat, lng });

    if (step >= steps) {
      clearInterval(marker.__animInterval);
      marker.__animInterval = null;
    }
  }, 40); // 20 * 40ms = 800ms smooth move
}