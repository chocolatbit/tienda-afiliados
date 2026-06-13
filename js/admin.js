const Admin = {
  token: null,
  pendingProduct: null,
  loginModal: null,
  modal: null,
  form: null,
  listEl: null,
  countEl: null,
  closeBtn: null,

  init() {
    this.token = sessionStorage.getItem('afiliadospro_admin_token');
    this.loginModal = document.getElementById('adminLoginModal');
    this.modal = document.getElementById('adminModal');
    this.form = document.getElementById('adminForm');
    this.listEl = document.getElementById('adminList');
    this.countEl = document.getElementById('adminCount');
    this.closeBtn = document.getElementById('adminClose');
    this.loginCloseBtn = document.getElementById('adminLoginClose');

    var self = this;
    this.closeBtn.addEventListener('click', function() { self.close(); });
    this.loginCloseBtn.addEventListener('click', function() { self.closeLogin(); });
    this.modal.addEventListener('click', function(e) { if (e.target === self.modal) self.close(); });
    this.loginModal.addEventListener('click', function(e) { if (e.target === self.loginModal) self.closeLogin(); });
    this.form.addEventListener('submit', function(e) { self.onSubmit(e); });
    document.getElementById('adminLoginForm').addEventListener('submit', function(e) { self.onLogin(e); });
    document.getElementById('adminLogoutBtn').addEventListener('click', function() { self.logout(); });
    document.getElementById('fieldCategory').addEventListener('change', function() { self.renderList(); });
  },

  isLoggedIn() {
    return !!this.token;
  },

  showLogin() {
    document.getElementById('loginError').style.display = 'none';
    this.loginModal.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(function() { document.getElementById('adminUserInput').focus(); }, 100);
  },

  closeLogin() {
    this.loginModal.classList.remove('open');
    document.body.style.overflow = '';
    document.getElementById('adminLoginForm').reset();
    document.getElementById('loginError').style.display = 'none';
  },

  async onLogin(e) {
    e.preventDefault();
    var username = document.getElementById('adminUserInput').value.trim();
    var password = document.getElementById('adminPasswordInput').value;
    var btn = document.querySelector('#adminLoginForm .submit-btn');
    var errorEl = document.getElementById('loginError');

    if (!username || !password) {
      errorEl.textContent = 'Introduce usuario y contrase\u00F1a';
      errorEl.style.display = '';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Verificando...';
    errorEl.style.display = 'none';

    try {
      var res = await fetch(API_BASE + '/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password })
      });
      var data = await res.json();
      if (data.ok && data.token) {
        this.token = data.token;
        sessionStorage.setItem('afiliadospro_admin_token', data.token);
        this.closeLogin();
        this.open();
      } else {
        errorEl.textContent = data.error || 'Credenciales incorrectas';
        errorEl.style.display = '';
      }
    } catch (err) {
      errorEl.textContent = 'Error de conexi\u00F3n con el servidor';
      errorEl.style.display = '';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Iniciar sesi\u00F3n';
    }
  },

  open() {
    if (!this.isLoggedIn()) {
      this.showLogin();
      return;
    }
    this.resetPending();
    this.modal.classList.add('open');
    this.renderList();
    document.body.style.overflow = 'hidden';
    var urlInput = document.getElementById('fieldAmazonUrl');
    if (urlInput) setTimeout(function() { urlInput.focus(); }, 100);
  },

  close() {
    this.resetPending();
    this.modal.classList.remove('open');
    document.body.style.overflow = '';
  },

  logout() {
    this.token = null;
    sessionStorage.removeItem('afiliadospro_admin_token');
    this.close();
  },

  resetPending() {
    this.pendingProduct = null;
    var group = document.getElementById('imageUrlGroup');
    if (group) group.style.display = 'none';
    var btn = document.querySelector('.autofill-btn');
    if (btn) btn.textContent = 'Agregar';
  },

  addProduct(data) {
    var catEl = document.getElementById('fieldCategory');
    var cat = catEl ? catEl.value : '';
    Products.add(data);
    this.form.reset();
    if (catEl) catEl.value = cat;
    this.renderList();
    if (typeof App !== 'undefined') App.render();
  },

  async onSubmit(e) {
    e.preventDefault();
    var self = this;
    var btn = document.querySelector('.autofill-btn');
    var group = document.getElementById('imageUrlGroup');
    var imageInput = document.getElementById('fieldImageUrl');

    if (this.pendingProduct) {
      var imageUrl = imageInput ? imageInput.value.trim() : '';
      this.pendingProduct.image = imageUrl || '';
      this.addProduct(this.pendingProduct);
      showToast('\u2705 Producto agregado: ' + (this.pendingProduct.name || '').substring(0, 40));
      this.resetPending();
      if (group) group.style.display = 'none';
      return;
    }

    var urlInput = document.getElementById('fieldAmazonUrl');
    var url = urlInput ? urlInput.value.trim() : '';
    if (!url) {
      showToast('Pega la URL del producto en Amazon');
      return;
    }
    if (!url.toLowerCase().includes('amazon') && !url.toLowerCase().includes('amzn')) {
      showToast('Debe ser una URL de Amazon v\u00E1lida');
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Agregando...'; }

    try {
      var controller = new AbortController();
      var timeoutId = setTimeout(function() { controller.abort(); }, 20000);

      var res = await fetch(API_BASE + '/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': this.token
        },
        body: JSON.stringify({ url: url }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.status === 401) {
        showToast('\u274C Sesi\u00F3n expirada. Inicia sesi\u00F3n de nuevo.');
        this.logout();
        return;
      }
      if (!res.ok) {
        var errData = await res.json().catch(function() { return {}; });
        throw new Error(errData.error || 'Error del servidor (HTTP ' + res.status + ')');
      }

      var data = await res.json();
      var category = document.getElementById('fieldCategory').value;

      var productData = {
        name: data.name || 'Producto sin nombre',
        image: data.image || '',
        price: data.price || '',
        category: category,
        affiliateLink: data.affiliateLink || '',
        originalPrice: data.originalPrice || '',
        discountPercent: data.discountPercent || '',
        dealBadge: data.dealBadge || ''
};

function showConfirm(title, message, onConfirm) {
  var existing = document.querySelector('.confirm-overlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';

  var box = document.createElement('div');
  box.className = 'confirm-box';

  var h3 = document.createElement('h3');
  h3.textContent = title;
  box.appendChild(h3);

  var p = document.createElement('p');
  p.textContent = message;
  box.appendChild(p);

  var actions = document.createElement('div');
  actions.className = 'confirm-actions';

  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'confirm-cancel';
  cancelBtn.textContent = 'Cancelar';
  cancelBtn.addEventListener('click', function() { overlay.remove(); });

  var okBtn = document.createElement('button');
  okBtn.className = 'confirm-ok';
  okBtn.textContent = 'Eliminar';
  okBtn.addEventListener('click', function() {
    overlay.remove();
    if (typeof onConfirm === 'function') onConfirm();
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(okBtn);
  box.appendChild(actions);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });
}

      if (productData.image) {
        this.addProduct(productData);
        showToast('\u2705 Producto agregado: ' + (productData.name || '').substring(0, 40));
      } else {
        this.pendingProduct = productData;
        if (group) group.style.display = '';
        if (imageInput) { imageInput.value = ''; imageInput.focus(); }
        if (btn) { btn.disabled = false; btn.textContent = 'Confirmar'; }
        showToast('\u26A0\uFE0F No se encontr\u00F3 imagen. Pega la URL manualmente y confirma.');
      }
    } catch (err) {
      var msg = err.message || '';
      if (err.name === 'AbortError') {
        showToast('\u274C La solicitud al servidor tard\u00F3 demasiado.');
      } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        showToast('\u274C No se puede conectar con el servidor.');
      } else {
        showToast('\u274C ' + msg);
      }
    } finally {
      if (btn && !this.pendingProduct) {
        btn.disabled = false;
        btn.textContent = 'Agregar';
      }
    }
  },

  renderList() {
    var items = Products.getAll();
    if (!this.countEl) return;
    var catSelect = document.getElementById('fieldCategory');
    var selectedCat = catSelect ? catSelect.value : '';
    if (selectedCat) {
      items = items.filter(function(p) { return p.category === selectedCat; });
    }
    this.countEl.textContent = String(items.length);
    if (items.length === 0) {
      this.listEl.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;padding:8px 0;">No hay productos en esta categor\u00EDa.</div>';
      return;
    }
    var self = this;
    var html = '<div class="admin-cat-header">' + getCategoryLabel(selectedCat) + '</div>';
    for (var j = 0; j < items.length; j++) {
      var p = items[j];
      html += '<div class="admin-product-item">' +
        '<img src="' + escapeHtml(p.image) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=\'/placeholder.svg\'">' +
        '<div class="info">' +
          '<div class="name">' + escapeHtml(p.name) + '</div>' +
          '<div class="meta">' + escapeHtml(p.price) + ' \u00B7 ' + (p.subcategory || '') + '</div>' +
        '</div>' +
        '<button class="del-btn" data-id="' + p.id + '" title="Eliminar">&times;</button>' +
      '</div>';
    }
    this.listEl.innerHTML = html;
    this.listEl.querySelectorAll('.del-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        showConfirm('\u00BFEliminar este producto?', 'No se puede deshacer.', function() {
          Products.remove(btn.dataset.id);
          self.renderList();
          if (typeof App !== 'undefined') App.render();
        });
      });
    });
  }
};
