// signup.js — creates Firebase user and a Firestore user doc
// expects firebase compat SDKs loaded and /home/firebase-config.js to initialize firebase

// small helpers
const $ = (s) => document.querySelector(s);
const toastContainer = document.getElementById('toast-container');

function showToast(msg, ms = 2400) {
  if (!toastContainer) {
    console.log('toast:', msg);
    return;
  }
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  toastContainer.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

function setError(msg) {
  const el = $('#error');
  if (el) el.textContent = msg || '';
}

function validPhone(p) {
  // accept 10 digit indian phone (simple)
  return /^\d{10}$/.test(p);
}

// DOM
const form = $('#signupForm');
const submitBtn = $('#submitBtn');
const togglePw = $('#togglePw');

togglePw?.addEventListener('click', () => {
  const pw = $('#password');
  if (!pw) return;
  if (pw.type === 'password') {
    pw.type = 'text';
    togglePw.textContent = '🙈';
  } else {
    pw.type = 'password';
    togglePw.textContent = '👁️';
  }
});

// Signup flow
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  setError('');
  submitBtn.disabled = true;

  const name = ($('#fullName')?.value || '').trim();
  const phone = ($('#phone')?.value || '').trim();
  const email = ($('#email')?.value || '').trim();
  const password = ($('#password')?.value || '');
  const confirm = ($('#confirmPassword')?.value || '');

  // basic validation
  if (!name) { setError('Enter your name'); submitBtn.disabled = false; return; }
  if (!validPhone(phone)) { setError('Enter a valid 10-digit phone'); submitBtn.disabled = false; return; }
  if (!email) { setError('Enter email'); submitBtn.disabled = false; return; }
  if (password.length < 6) { setError('Password must be at least 6 characters'); submitBtn.disabled = false; return; }
  if (password !== confirm) { setError('Passwords do not match'); submitBtn.disabled = false; return; }

  try {
    // Create user with Firebase Auth (compat)
    const userCred = await firebase.auth().createUserWithEmailAndPassword(email, password);
    const user = userCred.user;
    if (!user) throw new Error('Signup failed');

    // Update displayName (optional)
    await user.updateProfile({ displayName: name }).catch(()=>{});

    // Save user profile in Firestore
    const db = firebase.firestore();
    await db.collection('users').doc(user.uid).set({
      name,
      phone,
      email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    showToast('Account created — redirecting…', 1800);

    // redirect to home after short delay
    setTimeout(() => {
      // ensure user is signed in and go to home
      window.location.href = '/home/index.html';
    }, 1200);

  } catch (err) {
    console.error('Signup error', err);
    // friendly messages
    let msg = err?.message || 'Signup failed';
    if (msg.includes('auth/email-already-in-use')) msg = 'Email already in use. Try login';
    if (msg.includes('auth/invalid-email')) msg = 'Invalid email address';
    if (msg.includes('auth/weak-password')) msg = 'Password is too weak';
    setError(msg);
    showToast(msg, 3000);
    submitBtn.disabled = false;
  }
});