// /assets/settings.js
(async function(){
  // wait for firebase config to load
  function wait() {
    return new Promise(res => {
      const ch = () => {
        if (window.firebase && window.auth && window.db) res();
        else setTimeout(ch, 30);
      };
      ch();
    });
  }
  await wait();

  const hdrName = document.getElementById('hdrName');
  const hdrEmail = document.getElementById('hdrEmail');
  const hdrAvatar = document.getElementById('hdrAvatar');
  const pushToggle = document.getElementById('pushToggle');
  const logoutItem = document.getElementById('logoutItem');

  // load user data
  auth.onAuthStateChanged(async user => {
    if (!user) { location.href = '/auth/login.html'; return; }
    hdrEmail.textContent = user.email || '';
    const uRef = db.collection('users').doc(user.uid);
    const snap = await uRef.get();
    if (snap.exists) {
      const d = snap.data();
      hdrName.textContent = d.name || (user.displayName || 'User');
      hdrAvatar.src = d.photoURL || '/assets/default-user.png';
      // push toggle preference
      const push = !!d.pushEnabled;
      if (push) pushToggle.classList.add('on'), pushToggle.setAttribute('aria-checked','true');
      else pushToggle.classList.remove('on'), pushToggle.setAttribute('aria-checked','false');
    } else {
      hdrName.textContent = user.displayName || 'User';
      hdrAvatar.src = '/assets/default-user.png';
    }
  });

  // functions opened by items
  window.openProfile = ()=> location.href = '/profile/index.html';
  window.openChangePassword = ()=> {
    // navigate to change password page (or trigger sheet)
    location.href = '/settings/change-password.html';
  };

  window.togglePush = async (el)=>{
    const user = auth.currentUser;
    if (!user) return alert('Not authenticated');
    const on = !el.classList.contains('on');
    el.classList.toggle('on', on);
    el.setAttribute('aria-checked', String(on));
    await db.collection('users').doc(user.uid).set({ pushEnabled: on }, { merge:true });
  };

  logoutItem.addEventListener('click', async () => {
    await auth.signOut();
    location.href = '/auth/login.html';
  });
})();