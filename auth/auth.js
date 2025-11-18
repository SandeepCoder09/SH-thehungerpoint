// auth.js - signup flow with phone OTP (Firebase compat)
// It will create a Firestore user doc including displayName.
(function(){
  const $ = (s)=> document.querySelector(s);
  const toast = $('#toast');

  function showToast(msg, ms=2400){
    if(!toast){ console.log(msg); return; }
    toast.textContent = msg; toast.hidden = false;
    clearTimeout(showToast._t); showToast._t = setTimeout(()=> toast.hidden = true, ms);
  }

  if(!window.firebase || !firebase.auth){
    showToast("Firebase not initialized. Check firebase-config.js");
    console.error("Firebase not initialized.");
    return;
  }

  const signupForm = $('#signupForm');
  const fullName = $('#fullName');
  const phone = $('#phone');
  const sendOtpBtn = $('#sendOtpSign');

  const verifyForm = $('#verifySignupForm');
  const otpInput = $('#otpSignup');
  const confirmBtn = $('#confirmSignup');

  let recaptchaVerifier;
  let confirmationResult;

  function initRecaptcha(id){
    if(recaptchaVerifier) return;
    recaptchaVerifier = new firebase.auth.RecaptchaVerifier(id, {
      size: 'invisible'
    });
    recaptchaVerifier.render().catch(e=>console.warn('recap render', e));
  }

  initRecaptcha('recaptcha-signup');

  function normalizePhone(v){
    const d = (v||'').replace(/\D/g,'');
    if(d.length===10) return '+91'+d;
    if(v.startsWith('+')) return v;
    return null;
  }

  signupForm?.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const name = (fullName.value || '').trim();
    const p = (phone.value || '').trim();
    if(!name){ showToast('Enter your name'); return; }
    const phoneNorm = normalizePhone(p);
    if(!phoneNorm){ showToast('Enter valid 10-digit phone'); return; }
    sendOtpBtn.disabled = true;
    try{
      initRecaptcha('recaptcha-signup');
      confirmationResult = await firebase.auth().signInWithPhoneNumber(phoneNorm, recaptchaVerifier);
      // show verify form
      signupForm.classList.add('hidden');
      verifyForm.classList.remove('hidden');
      showToast('OTP sent');
    }catch(err){
      console.error('send otp', err);
      showToast(err.message || 'Failed to send OTP');
      if(recaptchaVerifier && recaptchaVerifier.clear) { try{ recaptchaVerifier.clear(); recaptchaVerifier = null; }catch(_){} }
    } finally { sendOtpBtn.disabled = false; }
  });

  verifyForm?.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const code = (otpInput.value||'').trim();
    if(code.length < 4) { showToast('Enter OTP'); return; }
    confirmBtn.disabled = true;
    try{
      const res = await confirmationResult.confirm(code);
      const user = res.user;
      // Save displayName (full name) into firebase user and firestore
      try{
        await user.updateProfile({ displayName: (fullName.value||'').trim() });
      }catch(e){ /* ignore */ }
      try{
        const db = firebase.firestore();
        await db.collection('users').doc(user.uid).set({
          name: (fullName.value||'').trim(),
          phone: user.phoneNumber || null,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }catch(e){
        console.warn('save user doc', e);
      }

      showToast('Account created — redirecting...');
      setTimeout(()=> window.location.href = '/home/index.html', 900);
    }catch(err){
      console.error('verify signup', err);
      showToast(err.message || 'OTP invalid');
      confirmBtn.disabled = false;
    }
  });
})();