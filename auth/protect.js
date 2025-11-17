// auth/protect.js — reuse on any page that must be protected
(function () {
  const safeRedirect = () => location.replace('/auth/login.html');

  if (!window.firebase || !firebase.auth) {
    console.warn('Firebase missing — redirecting to login.');
    return safeRedirect();
  }

  firebase.auth().onAuthStateChanged(user => {
    if (!user) {
      try { 
        localStorage.setItem('redirect_after_login', location.pathname + location.search); 
      } catch(e){}
      safeRedirect();
    }
  });

  // fallback safety
  setTimeout(() => {
    if (!firebase.auth().currentUser) {
      try { 
        localStorage.setItem('redirect_after_login', location.pathname + location.search); 
      } catch(e){}
      safeRedirect();
    }
  }, 2000);
})();