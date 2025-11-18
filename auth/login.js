// login.js - Phone OTP (Firebase compat)
// Requires firebase-app-compat, firebase-auth-compat, firebase-firestore-compat loaded
// and auth/firebase-config.js to initialize firebase.

(function(){
  const $ = (s)=> document.querySelector(s);
  const toastEl = $('#toast');

  function showToast(msg, ms=2200){
    if(!toastEl) { console.log(msg); return; }
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(()=>{ toastEl.hidden = true; }, ms);
  }

  // Ensure firebase exists
  if(!window.firebase || !firebase.auth){
    showToast("Firebase not initialized. Check firebase-config.js");
    console.error("Firebase not initialized.");
    return;
  }

  // Elements
  const loginForm = $('#loginForm');
  const phoneInput = $('#phone');
  const sendOtpBtn = $('#sendOtpBtn');
  const sendStatus = $('#sendStatus');

  const otpForm = $('#otpForm');
  const otpInput = $('#otp');
  const verifyBtn = $('#verifyBtn');
  const otpStatus = $('#otpStatus');

  // Recaptcha verifier (invisible)
  let recaptchaVerifier;
  let confirmationResult;

  function initRecaptcha(){
    // render once
    if(recaptchaVerifier) return;
    recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
      size: 'invisible',
      callback: function(response){
        // reCAPTCHA solved, allow send
      }
    });
    recaptchaVerifier.render().catch(e=>console.warn("recaptcha render:",e));
  }

  initRecaptcha();

  function normalizePhone(phone){
    // remove non digits, expect 10 digits
    const digits = (phone || '').replace(/\D/g,'');
    if(digits.length === 10) return '+91' + digits;
    // if already in +91... or longer, return as is
    if(phone.startsWith('+')) return phone;
    return null;
  }

  loginForm?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    sendStatus.textContent = '';
    const raw = phoneInput.value.trim();
    const phone = normalizePhone(raw);
    if(!phone){ sendStatus.textContent = 'Enter a valid 10-digit phone.'; return; }

    try{
      sendOtpBtn.disabled = true;
      sendStatus.textContent = 'Sending OTP...';
      initRecaptcha();

      confirmationResult = await firebase.auth().signInWithPhoneNumber(phone, recaptchaVerifier);
      // show otp form
      otpForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
      sendStatus.textContent = `OTP sent to ${phone}.`;
      showToast('OTP sent');
    }catch(err){
      console.error('sendOtp error', err);
      // reset recaptcha on error
      if(recaptchaVerifier && recaptchaVerifier.clear) try{ recaptchaVerifier.clear(); recaptchaVerifier = null; }catch(e){}
      sendStatus.textContent = (err && err.message) || 'Failed to send OTP. Try again.';
      showToast(sendStatus.textContent, 4000);
    } finally {
      sendOtpBtn.disabled = false;
    }
  });

  otpForm?.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    otpStatus.textContent = '';
    const code = otpInput.value.trim();
    if(!code || code.length < 4) { otpStatus.textContent = 'Enter the 6-digit OTP'; return; }

    try{
      verifyBtn.disabled = true;
      otpStatus.textContent = 'Verifying...';
      const result = await confirmationResult.confirm(code);
      const user = result.user;
      // create minimal user doc in firestore if not present
      try{
        const db = firebase.firestore();
        const userRef = db.collection('users').doc(user.uid);
        const doc = await userRef.get();
        if(!doc.exists){
          await userRef.set({
            phone: user.phoneNumber || null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        } else {
          // optionally update last login
          await userRef.set({ lastSeen: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        }
      }catch(dbErr){
        console.warn('firestore save error', dbErr);
      }

      showToast('Signed in — redirecting...');
      // redirect to home
      setTimeout(()=> window.location.href = '/home/index.html', 900);
    }catch(err){
      console.error('verify error', err);
      otpStatus.textContent = err?.message || 'Invalid OTP';
      showToast(otpStatus.textContent, 3000);
      verifyBtn.disabled = false;
    }
  });

})();