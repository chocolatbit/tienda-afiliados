function sha256(str) {
  var buffer = new TextEncoder().encode(str);
  return crypto.subtle.digest('SHA-256', buffer).then(function(hash) {
    return Array.from(new Uint8Array(hash)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  });
}

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
      var hash = await sha256(password);
      if (username === ADMIN_USER && hash === ADMIN_PASSWORD_HASH) {
        this.token = 'local_' + hash.slice(0, 16);
        sessionStorage.setItem('afiliadospro_admin_token', this.token);
        this.closeLogin();
        this.open();
      } else {
        errorEl.textContent = 'Credenciales incorrectas';
        errorEl.style.display = '';
      }
    } catch (err) {
      errorEl.textContent = 'Error de conexi\u00F3n';
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

    var nameInput = document.getElementById('fieldName');
    var priceInput = document.getElementById('fieldPrice');
    var linkInput = document.getElementById('fieldAffiliateLink');
    var catSelect = document.getElementById('fieldCategory');

    var name = nameInput ? nameInput.value.trim() : '';
    var price = priceInput ? priceInput.value.trim() : '';
    var link = linkInput ? linkInput.value.trim() : '';

    if (!name || !link) {
      showToast('Completa el nombre y el enlace de afiliado');
      return;
    }

    var productData = {
      name: name,
      image: '',
      price: price,
      category: catSelect ? catSelect.value : '',
      affiliateLink: link,
      originalPrice: '',
      discountPercent: '',
      dealBadge: ''
    };

    this.addProduct(productData);
    showToast('\u2705 Producto agregado: ' + name.substring(0, 40));
    nameInput.value = '';
    priceInput.value = '';
    linkInput.value = '';
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
