// /auth/protect.js
// Global page protection using SHAuth system

(function () {

  function waitForSHAuth(timeout = 5000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      (function check() {
        if (window.SHAuth) return resolve();
        if (Date.now() - start > timeout) return reject("SHAuth not loaded");
        setTimeout(check, 30);
      })();
    });
  }

  async function init() {
    try {
      await waitForSHAuth();
      SHAuth.requireAuth();   // 🚀 THIS DOES EVERYTHING
    } catch (err) {
      console.error("protect.js failed:", err);
    }
  }

  init();

})();