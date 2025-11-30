// /profile/profile.js
// Handles profile load/save, cropper modal, upload with progress overlay

// Wait for firebase
async function waitForFirebase() {
  return new Promise(resolve => {
    const check = () => {
      if (window.firebase && window.auth && window.db && window.firebase.storage) resolve();
      else setTimeout(check, 30);
    };
    check();
  });
}

(function(){
  document.addEventListener('DOMContentLoaded', async ()=> {
    await waitForFirebase();

    // Elements
    const photoImg = document.getElementById('photoImg');
    const avatarWrap = document.getElementById('avatarWrap') || document.getElementById('avatarWrap') ;
    const photoInput = document.getElementById('photoInput');
    const changePhotoBtn = document.getElementById('changePhotoBtn');
    const removePhotoBtn = document.getElementById('removePhotoBtn');

    const nameEl = document.getElementById('name');
    const emailEl = document.getElementById('email');
    const genderEl = document.getElementById('gender');
    const phoneEl = document.getElementById('phone');
    const addressEl = document.getElementById('address');

    const saveBtn = document.getElementById('saveBtn');
    const resetBtn = document.getElementById('resetPassBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    // cropper modal elements
    const cropperModal = document.getElementById('cropperModal');
    const cropperImage = document.getElementById('cropperImage');
    const closeCrop = document.getElementById('closeCrop');
    const cropSaveBtn = document.getElementById('cropSaveBtn');
    const zoomRange = document.getElementById('zoomRange');

    const changeSheet = document.getElementById('changeSheet');
    const sheetCancel = document.getElementById('sheetCancel');
    const sheetSave = document.getElementById('sheetSave');

    const overlay = document.querySelector('.avatar .overlay');

    let cropper = null;
    let currentFile = null;

    function showToast(msg){ 
      let t = document.getElementById('toast');
      if (!t) {
        t = document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t);
      }
      t.textContent = msg; t.hidden = false; setTimeout(()=> t.hidden = true, 2400);
    }

    // auth guard + load user
    auth.onAuthStateChanged(async (user)=>{
      if (!user) { location.href = '/auth/login.html'; return; }
      emailEl.value = user.email || '';
      const ref = db.collection('users').doc(user.uid);
      const snap = await ref.get();
      if (snap.exists) {
        const d = snap.data();
        nameEl.value = d.name || '';
        phoneEl.value = d.phone || '';
        addressEl.value = d.address || '';
        genderEl.value = d.gender || '';
        photoImg.src = d.photoURL || '/assets/default-user.png';
      } else {
        await ref.set({ name: user.displayName||'', email:user.email||'', phone:'', address:'', gender:'', photoURL:'', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        photoImg.src = '/assets/default-user.png';
      }
    });

    // open file chooser
    changePhotoBtn.addEventListener('click', ()=> photoInput.click());
    photoInput.addEventListener('change', async (e)=>{
      const file = e.target.files?.[0];
      if (!file) return;
      currentFile = file;
      // show modal and initialize cropper
      const url = URL.createObjectURL(file);
      cropperImage.src = url;
      cropperModal.classList.add('show');
      cropperModal.setAttribute('aria-hidden','false');

      // allow image to load
      cropperImage.onload = ()=> {
        if (cropper) { cropper.destroy(); cropper = null; }
        cropper = new Cropper(cropperImage, {
          viewMode:1,
          dragMode:'move',
          aspectRatio:1,
          background:false,
          guides:false,
          autoCropArea:1,
          rotatable:false,
          scalable:false,
          zoomOnWheel:true,
          cropBoxResizable:false,
          ready(){
            // center & set initial zoom value
            zoomRange.value = 1;
          }
        });
      };
    });

    closeCrop.addEventListener('click', ()=> {
      cropperModal.classList.remove('show');
      cropperModal.setAttribute('aria-hidden','true');
      if (cropper) { cropper.destroy(); cropper=null; }
      photoInput.value = '';
    });

    // zoom control
    zoomRange.addEventListener('input', ()=> {
      if (!cropper) return;
      const v = parseFloat(zoomRange.value);
      cropper.zoomTo(v);
    });

    // Crop & upload
    cropSaveBtn.addEventListener('click', async ()=> {
      if (!cropper) return;
      const canvas = cropper.getCroppedCanvas({ width: 720, height:720, imageSmoothingQuality:'high' });
      // convert to blob
      canvas.toBlob(async (blob) => {
        if (!blob) return showToast('Could not crop image');
        // preview immediately
        const previewUrl = URL.createObjectURL(blob);
        photoImg.src = previewUrl;

        // UI uploading state
        const avatarEl = document.querySelector('.avatar');
        avatarEl.classList.add('uploading');

        try {
          const user = auth.currentUser;
          if (!user) throw new Error('Not authenticated');
          const storageRef = firebase.storage().ref(`profile/${user.uid}.jpg`);
          // upload with progress
          const uploadTask = storageRef.put(blob);

          uploadTask.on('state_changed', snapshot=>{
            const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            // show loader text
            overlay.innerHTML = `<div class="loader"><div class="ring"></div><div class="text">${pct}%</div></div>`;
          });

          await uploadTask;
          const url = await storageRef.getDownloadURL();
          // save to firestore
          await db.collection('users').doc(user.uid).set({
            photoURL: url,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge:true });

          photoImg.src = url;
          showToast('Profile photo updated');
        } catch (err) {
          console.error(err);
          showToast('Upload failed');
        } finally {
          avatarEl.classList.remove('uploading');
          overlay.innerHTML = '';
          cropperModal.classList.remove('show');
          photoInput.value = '';
          if (cropper) { cropper.destroy(); cropper=null; }
        }
      }, 'image/jpeg', 0.9);
    });

    // Remove photo
    removePhotoBtn.addEventListener('click', async ()=>{
      if (!confirm('Remove profile photo?')) return;
      try {
        const user = auth.currentUser;
        if (!user) return showToast('Not logged in');
        const storageRef = firebase.storage().ref(`profile/${user.uid}.jpg`);
        await storageRef.delete().catch(()=>{});
        await db.collection('users').doc(user.uid).set({ photoURL:'', updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
        photoImg.src = '/assets/default-user.png';
        showToast('Photo removed');
      } catch(e){
        console.error(e);
        showToast('Could not remove');
      }
    });

    // Save profile data
    saveBtn.addEventListener('click', async ()=>{
      const user = auth.currentUser;
      if (!user) return showToast('Not authenticated');
      const payload = {
        name: nameEl.value.trim(),
        phone: phoneEl.value.trim(),
        address: addressEl.value.trim(),
        gender: genderEl.value || '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      saveBtn.disabled = true;
      const old = saveBtn.textContent;
      saveBtn.textContent = 'Saving...';
      try{
        await db.collection('users').doc(user.uid).set(payload, { merge:true });
        showToast('Profile saved');
      }catch(e){ console.error(e); showToast('Save failed'); }
      finally{ saveBtn.disabled=false; saveBtn.textContent = old; }
    });

    // reset password
    resetBtn.addEventListener('click', async ()=>{
      const em = emailEl.value;
      if (!em) return showToast('No email available');
      try { await auth.sendPasswordResetEmail(em); showToast('Reset email sent'); }
      catch(e){ console.error(e); showToast('Failed to send'); }
    });

    // logout
    logoutBtn.addEventListener('click', async ()=>{
      try { await auth.signOut(); location.href = '/auth/login.html'; } catch(e){ console.error(e); showToast('Logout failed'); }
    });

    // change password sheet open/close (also triggered from settings page)
    window.openChangePassword = ()=>{
      changeSheet.classList.add('show');
    };
    sheetCancel.addEventListener('click', ()=> changeSheet.classList.remove('show'));
    sheetSave.addEventListener('click', async ()=>{
      const np = document.getElementById('newPass').value || document.getElementById('newPass')?.value;
      const cp = document.getElementById('confirmPass').value || document.getElementById('confirmPass')?.value;
      if (!np || np !== cp) { showToast('Passwords must match'); return; }
      try {
        const user = auth.currentUser;
        await user.updatePassword(np);
        showToast('Password updated');
        changeSheet.classList.remove('show');
      } catch(e){ console.error(e); showToast('Update failed'); }
    });

  }); // DOMContentLoaded
})();