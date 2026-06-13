const CookiesManager = {
  storageKey: 'afiliadospro_cookies',
  storageAvailable: true,

  check() {
    try {
      const consent = this.getConsent();
      if (!consent) {
        this.showBanner();
        return;
      }
      this.applyConsent(consent);
    } catch (e) {
      this.showBanner();
    }
  },

  applyConsent(consent) {
    var imgs = document.querySelectorAll('img[data-src-consent]');
    for (var i = 0; i < imgs.length; i++) {
      if (consent.marketing) {
        imgs[i].src = imgs[i].dataset.srcConsent;
      }
    }
    var iframes = document.querySelectorAll('iframe[data-src-consent]');
    for (var i = 0; i < iframes.length; i++) {
      if (consent.marketing) {
        iframes[i].src = iframes[i].dataset.srcConsent;
      }
    }
  },

  getConsent() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        try { return JSON.parse(stored); } catch (e) { return null; }
      }
    } catch (e) {
      this.storageAvailable = false;
    }
    return null;
  },

  saveConsent(consent) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(consent));
    } catch (e) {}
  },

  acceptAll() {
    const consent = { necessary: true, marketing: true, timestamp: Date.now() };
    this.saveConsent(consent);
    this.hideBanner();
  },

  acceptNecessary() {
    const consent = { necessary: true, marketing: false, timestamp: Date.now() };
    this.saveConsent(consent);
    this.hideBanner();
  },

  showBanner() {
    const banner = document.getElementById('cookieBanner');
    if (banner) banner.classList.add('show');
  },

  hideBanner() {
    const banner = document.getElementById('cookieBanner');
    if (banner) {
      banner.classList.remove('show');
      banner.classList.add('hide');
      setTimeout(function() { banner.style.display = 'none'; }, 400);
    }
  },

  revoke() {
    try { localStorage.removeItem(this.storageKey); } catch (e) {}
    const banner = document.getElementById('cookieBanner');
    if (banner) {
      banner.style.display = '';
      banner.classList.remove('hide');
      this.showBanner();
    }
  },

  openPolicy() {
    const modal = document.getElementById('cookiePolicyModal');
    if (modal) {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  },

  closePolicy() {
    const modal = document.getElementById('cookiePolicyModal');
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
  }
};

document.addEventListener('DOMContentLoaded', function() {
  if (location.search === '?reset-cookies') {
    try { localStorage.removeItem(CookiesManager.storageKey); } catch (e) {}
    history.replaceState(null, '', location.pathname);
  }
  CookiesManager.check();

  const acceptAllBtn = document.getElementById('cookieAcceptAll');
  const acceptNecessaryBtn = document.getElementById('cookieAcceptNecessary');
  const policyClose = document.getElementById('cookiePolicyClose');
  const policyModal = document.getElementById('cookiePolicyModal');

  if (acceptAllBtn) acceptAllBtn.addEventListener('click', function() { CookiesManager.acceptAll(); });
  if (acceptNecessaryBtn) acceptNecessaryBtn.addEventListener('click', function() { CookiesManager.acceptNecessary(); });
  if (policyClose) policyClose.addEventListener('click', function() { CookiesManager.closePolicy(); });
  if (policyModal) {
    policyModal.addEventListener('click', function(e) {
      if (e.target === policyModal) CookiesManager.closePolicy();
    });
  }

  document.querySelectorAll('[data-cookie-action="policy"]').forEach(function(el) {
    el.addEventListener('click', function(e) { e.preventDefault(); CookiesManager.openPolicy(); });
  });

  document.querySelectorAll('[data-cookie-action="revoke"]').forEach(function(el) {
    el.addEventListener('click', function(e) { e.preventDefault(); CookiesManager.revoke(); });
  });
});
