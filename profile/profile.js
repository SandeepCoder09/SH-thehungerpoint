// profile.js — Firebase Auth + Firestore profile manager
// expects `/home/firebase-config.js` to initialize firebase app

const auth = firebase.auth();
const db = firebase.firestore();

// DOM
const displayNameEl = document.getElementById('displayName');
const displayEmailEl = document.getElementById('displayEmail');
const displayPhoneEl = document.getElementById('displayPhone');
const avatarImg = document.getElementById('avatarImg');

const editBtn = document.getElementById('editBtn');
const changePassBtn = document.getElementById('changePassBtn');
const logoutBtn = document.getElementById('logoutBtn');

const editModal = document.getElementById('editModal');
const inpName = document.getElementById('inpName');
const inpPhone = document.getElementById('inpPhone');
const saveProfile = document.getElementById('saveProfile');
const cancelEdit = document.getElementById('cancelEdit');

const passModal = document.getElementById('passModal');
const curPass = document.getElementById('curPass');
const newPass = document.getElementById('newPass');
const savePass = document.getElementById('savePass');
const cancelPass = document.getElementById('cancelPass');

const toast = document.getElementById('profileToast');

let currentUserDocRef = null;

function showToast(msg, time = 2500){
  if(!toast) return alert(msg);
  toast.textContent = msg; toast.classList.remove('hidden');
  setTimeout(()=> toast.classList.add('hidden'), time);
}

function openModal(el){ if(!el) return; el.classList.remove('hidden'); el.setAttribute('aria-hidden','false'); }
function closeModal(el){ if(!el) return; el.classList.add('hidden'); el.setAttribute('aria-hidden','true'); }

// Auth state listener
auth.onAuthStateChanged(async user => {
  if(!user) return window.location.href = '/home/login.html'; // redirect if not logged in

  // set basic fields
  displayEmailEl.textContent = user.email || '—';
  displayNameEl.textContent = user.displayName || 'Your Name';
  displayPhoneEl.textContent = user.phoneNumber || '—';
  if(user.photoURL) avatarImg.src = user.photoURL;

  // Firestore user doc
  try{
    currentUserDocRef = db.collection('users').doc(user.uid);
    const doc = await currentUserDocRef.get();
    if(doc.exists){
      const data = doc.data();
      if(data.name) { displayNameEl.textContent = data.name; inpName.value = data.name }
      if(data.phone) { displayPhoneEl.textContent = data.phone; inpPhone.value = data.phone }
      if(data.avatar) avatarImg.src = data.avatar;
    } else {
      // create initial doc
      await currentUserDocRef.set({ email: user.email || null, name: user.displayName || null, phone: user.phoneNumber || null, avatar: user.photoURL || null });
    }
  }catch(e){ console.error('firestore error', e); }
});

// Edit handlers
editBtn?.addEventListener('click', ()=> openModal(editModal));
cancelEdit?.addEventListener('click', ()=> closeModal(editModal));

saveProfile?.addEventListener('click', async ()=>{
  const name = inpName.value.trim();
  const phone = inpPhone.value.trim();
  const user = auth.currentUser;
  if(!user) return showToast('Not authenticated');

  try{
    // update auth profile (displayName)
    if(name) await user.updateProfile({ displayName: name });
    // update firestore doc
    if(currentUserDocRef) await currentUserDocRef.set({ name, phone }, { merge: true });

    // update UI
    displayNameEl.textContent = name || user.displayName || '—';
    displayPhoneEl.textContent = phone || '—';

    showToast('Profile updated');
    closeModal(editModal);
  }catch(e){ console.error(e); showToast('Update failed'); }
});

// Change password: for security we reauthenticate the user using current password
changePassBtn?.addEventListener('click', ()=> openModal(passModal));
cancelPass?.addEventListener('click', ()=> closeModal(passModal));

savePass?.addEventListener('click', async ()=>{
  const oldp = curPass.value; const newp = newPass.value;
  if(!oldp || !newp || newp.length < 6) return showToast('Enter valid passwords (min 6 chars)');
  const user = auth.currentUser; if(!user || !user.email) return showToast('Not authenticated');

  const cred = firebase.auth.EmailAuthProvider.credential(user.email, oldp);
  try{
    await user.reauthenticateWithCredential(cred);
    await user.updatePassword(newp);
    showToast('Password updated');
    curPass.value=''; newPass.value='';
    closeModal(passModal);
  }catch(e){ console.error(e); showToast('Password update failed'); }
});

// Logout
logoutBtn?.addEventListener('click', async ()=>{
  await auth.signOut(); window.location.href = '/home/login.html';
});

// Accessibility: escape closes modals
document.addEventListener('keydown', (e)=>{
  if(e.key==='Escape'){
    closeModal(editModal); closeModal(passModal);
  }
});