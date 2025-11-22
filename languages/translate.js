// ===============================
// SH Project – Auto Hindi/English
// translate.js (Drop-in script)
// ===============================

(function () {
  // --- 1) Create hidden Google Translate container ---
  const container = document.createElement('div');
  container.id = 'google_translate_element';
  container.style.display = 'none';
  document.body.prepend(container);

  // --- 2) Google callback ---
  window.googleTranslateElementInit = function () {
    if (window.google && window.google.translate) {
      new window.google.translate.TranslateElement({
        pageLanguage: 'en',
        includedLanguages: 'en,hi',
        autoDisplay: false
      }, 'google_translate_element');
    }
  };

  // --- 3) Load Google Translate script dynamically ---
  const s = document.createElement('script');
  s.type = 'text/javascript';
  s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
  s.async = true;
  document.head.appendChild(s);

  // --- 4) Set Google translation cookie ---
  function setLangCookie(lang) {
    try {
      const domain =
        location.hostname === 'localhost' ||
        /^\d+\.\d+\.\d+\.\d+$/.test(location.hostname)
          ? location.hostname
          : '.' + location.hostname.replace(/^www\./, '');

      const value = '/en/' + lang;

      const expires = new Date();
      expires.setFullYear(expires.getFullYear() + 1);

      document.cookie =
        'googtrans=' +
        encodeURIComponent(value) +
        ';expires=' +
        expires.toUTCString() +
        ';path=/;domain=' +
        domain;

      // fallback cookie without domain
      document.cookie =
        'googtrans=' +
        encodeURIComponent(value) +
        ';expires=' +
        expires.toUTCString() +
        ';path=/';

    } catch (e) {
      console.warn('Cookie set error:', e);
    }
  }

  // --- 5) Public API: change language ---
  window.SHTranslate = {
    setLanguage(lang) {
      if (!lang) return;

      try {
        localStorage.setItem('sh_lang_pref', lang);
      } catch {}

      setLangCookie(lang);
      location.reload(); // must reload for Google Translate to apply
    },

    reset() {
      setLangCookie('en');
      location.reload();
    }
  };

  // --- 6) Auto-apply saved language on load ---
  (function () {
    try {
      const saved = localStorage.getItem('sh_lang_pref');
      if (saved && saved !== 'en') {
        const cookieSet = document.cookie.includes('googtrans=/en/' + saved);
        if (!cookieSet) setLangCookie(saved);
      }
    } catch {}
  })();
})();