const App = {
  grid: null,
  paginationEl: null,
  navBtns: null,
  subNav: null,
  sectionTitle: null,
  themeToggle: null,
  amazonSearchLink: null,
  adminGear: null,

  state: {
    category: 'all',
    subcategory: 'inicio',
    search: '',
    page: 1,
    perPage: 12
  },

  chatSending: false,

  subcategories: {
    electronica: [
      { key: 'inicio', label: 'Inicio' },
      { key: '', label: 'Todo' },
      { key: 'minipc', label: 'Mini PC' },
      { key: 'ram', label: 'Memoria RAM' },
      { key: 'tarjetasgraficas', label: 'Tarjetas Gráficas' },
      { key: 'placabaseamd', label: 'Placa Base AMD' },
      { key: 'placabaseintel', label: 'Placa Base Intel' },
      { key: 'procesadoresamd', label: 'Procesadores AMD' },
      { key: 'procesadoresintel', label: 'Procesadores Intel' }
    ],
    moda: [
      { key: 'inicio', label: 'Inicio' },
      { key: '', label: 'Todo' },
      { key: 'hombre', label: 'Hombre' }
    ],
    hogar: [
      { key: 'inicio', label: 'Inicio' },
      { key: '', label: 'Todo' },
      { key: 'robotaspirador', label: 'Aspiradoras Robot' },
      { key: 'cocina', label: 'Cocina' },
      { key: 'aspiradoras', label: 'Aspiradoras Verticales/Mano' },
      { key: 'climatizacion', label: 'Climatización' },
      { key: 'iluminacion', label: 'Lámparas e Iluminación' },
      { key: 'decoracion', label: 'Decoración' },
      { key: 'muebles', label: 'Muebles' },
      { key: 'textil', label: 'Textiles y Ropa de Hogar' },
      { key: 'almacenaje', label: 'Almacenaje y Organización' },
      { key: 'bano', label: 'Baño' },
      { key: 'jardin', label: 'Jardín y Exterior' },
      { key: 'hogarinteligente', label: 'Hogar Inteligente' }
    ]
  },

  keyCount: 0,
  keyTimer: null,

  init() {
    this.grid = document.getElementById('productGrid');
    this.paginationEl = document.getElementById('pagination');
    this.navBtns = document.querySelectorAll('.nav-btn');
    this.subNav = document.getElementById('subNav');
    this.sectionTitle = document.getElementById('sectionTitle');
    this.themeToggle = document.getElementById('themeToggle');
    this.amazonSearchLink = document.getElementById('amazonSearchLink');
    this.adminGear = document.getElementById('adminGear');

    if (location.protocol === 'file:') {
      console.warn('Abierto con file:// — el servidor Express no est\u00e1 disponible');
    }

    Products.load();
    this.loadTheme();
    Admin.init();
    this.loadWidget();
    this.autoUpdatePrices();
    this.loadSeed();

    var inicioBtn = document.getElementById('navInicio');
    if (inicioBtn) {
      this.navBtns.forEach(function(b) { b.classList.remove('active'); });
      inicioBtn.classList.add('active');
    }

    this.render();
    this.bindEvents();
    this.bindChat();
  },

  bindEvents() {
    var self = this;

    var logo = document.querySelector('.logo');
    if (logo) {
      logo.addEventListener('click', function(e) {
        e.preventDefault();
        self.navBtns.forEach(function(b) { b.classList.remove('active'); });
        var inicioBtn = document.getElementById('navInicio');
        if (inicioBtn) inicioBtn.classList.add('active');
        self.state.category = 'all';
        self.state.subcategory = 'inicio';
        self.state.page = 1;
        self.renderSubNav();
        self.render();
      });
    }

    this.navBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        self.navBtns.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var cat = btn.dataset.category;
        self.state.category = cat === 'inicio' ? 'all' : cat;
        self.state.subcategory = cat === 'inicio' ? 'inicio' : '';
        self.state.page = 1;
        self.renderSubNav();
        self.render();
      });
    });

    this.themeToggle.addEventListener('click', function() { self.toggleTheme(); });
    if (this.adminGear) {
      this.adminGear.addEventListener('click', function() { Admin.open(); });
    }

    if (this.amazonSearchLink) {
      this.amazonSearchLink.addEventListener('click', function(e) {
        var term = self.state.search.trim();
        if (!term) {
          e.preventDefault();
          return;
        }
      });
    }

    var searchInput = document.getElementById('searchInput');
    var searchClear = document.getElementById('searchClearBtn');
    if (searchInput) {
      searchInput.addEventListener('input', function() {
        self.state.search = searchInput.value;
        self.state.page = 1;
        self.render();
        self.updateAmazonSearchLink();
        if (searchClear) searchClear.style.display = searchInput.value ? '' : 'none';
      });
    }
    if (searchClear) {
      searchClear.addEventListener('click', function() {
        searchInput.value = '';
        self.state.search = '';
        self.state.page = 1;
        self.render();
        self.updateAmazonSearchLink();
        searchClear.style.display = 'none';
        searchInput.focus();
      });
    }

    document.addEventListener('keydown', function(e) {
      if (e.key === 'a' || e.key === 'A') {
        var tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        self.keyCount++;
        if (self.keyCount >= 3) {
          self.keyCount = 0;
          Admin.open();
        }
        clearTimeout(self.keyTimer);
        self.keyTimer = setTimeout(function() { self.keyCount = 0; }, 600);
      }
      if (e.key === 'Escape') {
        if (Admin.modal && Admin.modal.classList.contains('open')) {
          Admin.close();
        }
        if (Admin.loginModal && Admin.loginModal.classList.contains('open')) {
          Admin.closeLogin();
        }
      }
    });
  },

  renderSubNav() {
    var subs = this.subcategories[this.state.category];
    if (!subs) {
      this.subNav.classList.remove('visible');
      this.subNav.innerHTML = '';
      return;
    }
    this.subNav.classList.add('visible');
    var self = this;
    var html = '';
    for (var i = 0; i < subs.length; i++) {
      var s = subs[i];
      html += '<button class="sub-btn' + (s.key === self.state.subcategory ? ' active' : '') + '" data-subkey="' + s.key + '">' + s.label + '</button>';
    }
    this.subNav.innerHTML = html;
    this.subNav.querySelectorAll('.sub-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        self.subNav.querySelectorAll('.sub-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        self.state.subcategory = btn.dataset.subkey;
        self.state.page = 1;
        self.render();
        self.updateAmazonSearchLink();
      });
    });
  },

  getFiltered() {
    var self = this;
    var list = Products.getAll();
    if (this.state.category !== 'all') {
      list = list.filter(function(p) { return p.category === self.state.category; });
    }
    if (this.state.subcategory) {
      list = list.filter(function(p) { return p.subcategory === self.state.subcategory; });
    }
    if (this.state.search.trim()) {
      var q = this.state.search.trim().toLowerCase();
      list = list.filter(function(p) { return p.name.toLowerCase().includes(q); });
    }
    return list;
  },

  render() {
    var self = this;
    if (this.state.subcategory === 'inicio') {
      this.renderInicio();
      return;
    }
    var layout = document.getElementById('inicioLayout');
    var sectionTitle = document.getElementById('sectionTitle');
    if (layout) layout.style.display = 'none';
    if (sectionTitle) sectionTitle.style.display = '';
    document.getElementById('mainLayout').style.display = 'flex';
    var filtered = this.getFiltered();
    var totalPages = Math.max(1, Math.ceil(filtered.length / this.state.perPage));
    if (this.state.page > totalPages) this.state.page = totalPages;
    var start = (this.state.page - 1) * this.state.perPage;
    var pageItems = filtered.slice(start, start + this.state.perPage);

    this.renderGrid(pageItems, filtered.length);
    this.renderPagination(totalPages);
    this.updateTitle(filtered.length);
    this.loadWidget();
    this.renderNativeBanner();
  },

  renderInicio() {
    var layout = document.getElementById('inicioLayout');
    var mainLayout = document.getElementById('mainLayout');
    var sectionTitle = document.getElementById('sectionTitle');
    var banner = document.querySelector('.amazon-native-banner');
    if (banner) banner.style.display = 'none';
    if (layout) layout.style.display = 'flex';
    if (mainLayout) mainLayout.style.display = 'none';
    if (sectionTitle) sectionTitle.style.display = 'none';
    this.loadWidget();
  },

  getChatReply(text) {
    var self = this;
    return new Promise(function(resolve) {
      var stopWords = ['busca','buscar','encuentra','encuentrame','quiero','necesito','recomiendame','recomendar','mejor','mejores','comprar','un','una','unos','unas','el','la','los','las','por','para','con','sin','que','de','del','en','y','o','a','e','i','u','lo','le','se','no','es','porfavor','por favor','gracias','hola','barato','barata','baratos','baratas','caro','cara','precio','euros','\u20AC','euro'];
      var clean = text.toLowerCase().replace(/[^\w\s\u00E1\u00E9\u00ED\u00F3\u00FA\u00F1]/gi, ' ').replace(/\d+\u20AC?/g, '').trim();
      var words = clean.split(/\s+/).filter(function(w) { return w.length > 1 && stopWords.indexOf(w) === -1; });

      if (words.length === 0) {
        resolve('\u00A1Hola! Puedes pedirme que busque productos en Amazon. Por ejemplo: <em>"busca un port\u00E1til gaming"</em> o <em>"recomi\u00E9ndame auriculares bluetooth"</em>.');
        return;
      }

      var keywords = encodeURIComponent(words.join(' '));
      var searchUrl = 'https://www.amazon.es/s?k=' + keywords + '&tag=2mideu-21';

      if (!HF_TOKEN) {
        resolve('\u00A1Claro! He preparado un enlace de b\u00FAsqueda en Amazon:<br><br><a href="' + searchUrl + '" target="_blank" rel="noopener noreferrer" class="chat-amazon-btn">Ver en Amazon.es &rarr;</a><br><br>Tambi\u00E9n puedes refinar con m\u00E1s detalles.');
        return;
      }

      var systemPrompt = 'Eres un asistente de compras en Amazon.es. Responde MUY BREVE, m\u00E1ximo 1 l\u00EDnea corta. Incluye SIEMPRE un enlace HTML como <a href="https://www.amazon.es/s?k=PALABRAS&tag=2mideu-21">Ver en Amazon</a>. Ejemplo: <a href="https://www.amazon.es/s?k=portatil+gaming&tag=2mideu-21">Ver en Amazon</a>';

      fetch('https://api-inference.huggingface.co/models/' + HF_MODEL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + HF_TOKEN },
        body: JSON.stringify({
          inputs: '<|system|>\n' + systemPrompt + '\n<|user|>\n' + text + '\n<|assistant|>\n',
          parameters: { max_new_tokens: 200, temperature: 0.5, return_full_text: false }
        }),
        signal: AbortSignal.timeout(15000)
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var reply = '';
        if (Array.isArray(data) && data[0] && data[0].generated_text) reply = data[0].generated_text.trim();
        else if (data.generated_text) reply = data.generated_text.trim();

        if (reply) {
          if (!reply.includes('tag=')) reply += (reply.includes('?') ? '&' : '?') + 'tag=2mideu-21';
          resolve(reply.replace(/\n/g, '<br>'));
        } else {
          resolve('\u00A1Claro! Busca en Amazon aqu\u00ED:<br><br><a href="' + searchUrl + '" target="_blank" rel="noopener noreferrer" class="chat-amazon-btn">Ver en Amazon.es &rarr;</a>');
        }
      })
      .catch(function() {
        resolve('\u00A1Claro! Busca en Amazon aqu\u00ED:<br><br><a href="' + searchUrl + '" target="_blank" rel="noopener noreferrer" class="chat-amazon-btn">Ver en Amazon.es &rarr;</a>');
      });
    });
  },

  bindChat() {
    var input = document.getElementById('chatInput');
    var btn = document.getElementById('chatSendBtn');
    var msgs = document.getElementById('chatMessages');
    if (!input || !btn || !msgs) return;

    const send = () => {
      var text = input.value.trim();
      if (!text || this.chatSending) return;
      input.value = '';
      this.chatSending = true;
      btn.disabled = true;

      msgs.innerHTML += '<div class="chat-msg user">' + escapeHtml(text) + '</div>';
      msgs.innerHTML += '<div class="chat-msg typing"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
      msgs.scrollTop = msgs.scrollHeight;

      var self = this;
      this.getChatReply(text).then(function(reply) {
        msgs.querySelector('.typing')?.remove();
        msgs.innerHTML += '<div class="chat-msg assistant">' + sanitizeHtml(reply) + '</div>';
        msgs.scrollTop = msgs.scrollHeight;
      }).finally(function() {
        self.chatSending = false;
        btn.disabled = false;
      });
    };

    btn.addEventListener('click', send);
    input.addEventListener('keydown', function(e) { if (e.key === 'Enter') send(); });
  },

  renderGrid(items, total) {
    if (items.length === 0) {
      this.grid.innerHTML =
        '<div class="empty-state">' +
          '<div class="icon">\uD83D\uDCE6</div>' +
          '<h2>No hay productos</h2>' +
          '<p>' + (total === 0
            ? 'Agrega productos desde el panel de administraci\u00F3n.'
            : 'Intenta con otros filtros.') + '</p>' +
        '</div>';
      return;
    }

    var self = this;
    var html = '';
    for (var i = 0; i < items.length; i++) {
      var p = items[i];
      html +=
        '<div class="product-card">' +
          '<div class="img-wrap">' +
            '<img src="' + escapeHtml(p.image) + '" alt="' + escapeHtml(p.name) + '" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=\'/placeholder.svg\'">' +
            '<span class="badge">Afiliado</span>' +
          '</div>' +
          '<div class="body">' +
            '<div class="category-tag">' + getCategoryLabel(p.category) + '</div>' +
            '<h3>' + escapeHtml(p.name) + '</h3>' +
            '<div class="price">' +
              '<span class="price-current">' + escapeHtml(p.price) + '</span>' +
              (p.originalPrice && p.originalPrice !== p.price ? '<span class="price-original">' + escapeHtml(p.originalPrice) + '</span>' : '') +
              (p.discountPercent ? '<span class="discount-badge">' + escapeHtml(p.discountPercent) + '</span>' : '') +
            '</div>' +
            (p.dealBadge ? '<div class="deal-badge">\uD83D\uDD25 ' + escapeHtml(p.dealBadge) + '</div>' : '') +
            '<div class="actions">' +
              '<a href="' + escapeHtml(p.affiliateLink) + '" target="_blank" rel="noopener noreferrer" class="btn-buy">Comprar en Amazon</a>' +
            '</div>' +
          '</div>' +
        '</div>';
    }
    this.grid.innerHTML = html;

    this.grid.querySelectorAll('.product-card').forEach(function(el, i) {
      el.classList.add('fade-up');
      el.style.transitionDelay = (i * 0.05) + 's';
      var obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });
      obs.observe(el);
    });
  },

  renderPagination(totalPages) {
    if (totalPages <= 1) {
      this.paginationEl.innerHTML = '';
      return;
    }

    var self = this;
    var html = '';
    html += '<button ' + (this.state.page === 1 ? 'disabled' : '') + ' data-page="' + (this.state.page - 1) + '">\u2190 Anterior</button>';
    for (var i = 1; i <= totalPages; i++) {
      html += '<button class="' + (i === this.state.page ? 'active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    html += '<button ' + (this.state.page === totalPages ? 'disabled' : '') + ' data-page="' + (this.state.page + 1) + '">Siguiente \u2192</button>';
    this.paginationEl.innerHTML = html;

    this.paginationEl.querySelectorAll('button[data-page]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var page = parseInt(btn.dataset.page, 10);
        if (page >= 1 && page <= totalPages) {
          self.state.page = page;
          self.render();
          var main = self.grid.closest('.main');
          if (main) main.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  },

  updateTitle(count) {
    var label = '';
    if (this.state.category !== 'all') {
      label = getCategoryLabel(this.state.category);
      if (this.state.search.trim()) {
        label += ' \u00BB "' + escapeHtml(this.state.search) + '"';
      }
    } else if (this.state.search.trim()) {
      label = 'Resultados para "' + escapeHtml(this.state.search) + '"';
    } else {
      label = 'Productos destacados';
    }
    this.sectionTitle.innerHTML = '<span class="highlight">' + label + '</span> <span style="font-size:0.8rem;font-weight:400;color:var(--text-muted)">(' + count + ')</span>';
  },

  loadFromData(data) {
    var seedAsins = {};
    for (var i = 0; i < data.length; i++) {
      var a = Products.extractASINfromLink(data[i].affiliateLink);
      if (a) seedAsins[a] = data[i];
    }
    var existing = Products.getAll();
    var keep = [];
    for (var i = 0; i < existing.length; i++) {
      var a = Products.extractASINfromLink(existing[i].affiliateLink);
      if (a && seedAsins[a]) continue;
      keep.push(existing[i]);
    }
    var all = keep.slice();
    for (var i = 0; i < data.length; i++) {
      all.push({
        id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        name: (data[i].name || '').trim(),
        image: (data[i].image || '').trim(),
        price: (data[i].price || '').trim(),
        originalPrice: data[i].originalPrice || '',
        discountPercent: data[i].discountPercent || '',
        dealBadge: data[i].dealBadge || '',
        affiliateLink: (data[i].affiliateLink || '').trim(),
        category: data[i].category || '',
        subcategory: data[i].subcategory || ''
      });
    }
    Products.items = all;
    Products.save();
    localStorage.setItem('afiliadospro_seeded', 'v14');
    this.render();
  },

  loadSeed() {
    var self = this;
    var seededVersion = localStorage.getItem('afiliadospro_seeded');
    if (seededVersion === 'v14') return;

    if (API_BASE) {
      fetch(API_BASE + '/api/seed')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (!data || !data.length) return;
          self.loadFromData(data);
        })
        .catch(function() {
          if (typeof FALLBACK_SEED_DATA !== 'undefined') {
            self.loadFromData(FALLBACK_SEED_DATA);
          }
        });
    } else {
      if (typeof FALLBACK_SEED_DATA !== 'undefined') {
        self.loadFromData(FALLBACK_SEED_DATA);
      }
    }
  },

  loadTheme() {
    var dark = localStorage.getItem('afiliadospro_dark');
    if (dark === 'true') {
      document.body.classList.add('dark');
      this.themeToggle.textContent = '\u2600\uFE0F';
    } else {
      document.body.classList.remove('dark');
      this.themeToggle.textContent = '\uD83C\uDF19';
    }
  },

  toggleTheme() {
    document.body.classList.toggle('dark');
    var isDark = document.body.classList.contains('dark');
    localStorage.setItem('afiliadospro_dark', String(isDark));
    this.themeToggle.textContent = isDark ? '\u2600\uFE0F' : '\uD83C\uDF19';
  },

  updateAmazonSearchLink() {
    var term = this.state.search.trim();
    if (!this.amazonSearchLink) return;
    if (this.state.category === 'moda' && this.state.subcategory === 'hombre' && !term) {
      this.amazonSearchLink.href = 'https://www.amazon.es/s?k=moda+masculina&tag=2mideu-21';
      this.amazonSearchLink.classList.add('visible');
      return;
    }
    if (term) {
      var encoded = encodeURIComponent(term);
      this.amazonSearchLink.href = 'https://www.amazon.es/s?k=' + encoded + '&tag=2mideu-21';
      this.amazonSearchLink.classList.add('visible');
    } else {
      this.amazonSearchLink.classList.remove('visible');
    }
  },

  autoUpdatePrices() {
    if (!API_BASE) return;
    var productsWithAsin = [];
    var all = Products.getAll();
    for (var i = 0; i < all.length; i++) {
      var asin = Products.extractASINfromLink(all[i].affiliateLink);
      if (asin) productsWithAsin.push({ id: all[i].id, asin: asin });
    }
    if (productsWithAsin.length === 0) return;

    var self = this;
    console.log('[App] Actualizando ' + productsWithAsin.length + ' precios...');
    showToast('\u23F3 Actualizando precios...');

    var adminToken = Admin.token || sessionStorage.getItem('afiliadospro_admin_token');
    var headers = { 'Content-Type': 'application/json' };
    if (adminToken) headers['x-admin-token'] = adminToken;

    fetch(API_BASE + '/api/update-prices', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ products: productsWithAsin })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.results && data.results.length > 0) {
        Products.updatePrices(data.results);
        self.render();
        var count = data.results.filter(function(r) { return r.price; }).length;
        if (count > 0) showToast('\u2705 ' + count + ' precios actualizados');
      }
    })
    .catch(function(err) {
      console.warn('[App] Error actualizando precios:', err);
    });
  },

  renderWidgetProducts(products, container) {
    if (products.length === 0) {
      container.innerHTML = '<div class="widget-placeholder"><div class="icon">\uD83D\uDCE6</div>No hay ofertas disponibles<br><small>Intenta m\u00E1s tarde</small></div>';
      return;
    }
    var html = '<div class="widget-title">\uD83D\uDD25 Ofertas en Amazon</div>';
    for (var i = 0; i < products.length; i++) {
      var p = products[i];
      html +=
        '<div class="widget-product">' +
          '<a href="' + escapeHtml(p.url) + '" target="_blank" rel="noopener noreferrer" class="widget-product-link">' +
            '<div class="widget-product-img-wrap">' +
              '<img src="' + escapeHtml(p.image) + '" alt="' + escapeHtml(p.title) + '" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=\'/placeholder.svg\'">' +
            '</div>' +
            '<div class="widget-product-info">' +
              '<div class="widget-product-name">' + escapeHtml(p.title) + '</div>' +
              '<div class="widget-product-price">' + escapeHtml(p.price) + '</div>' +
            '</div>' +
          '</a>' +
        '</div>';
    }
    container.innerHTML = html;
    container.querySelectorAll('.widget-product').forEach(function(el, i) {
      el.classList.add('fade-up');
      el.style.transitionDelay = (i * 0.08) + 's';
      var obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });
      obs.observe(el);
    });
  },

  loadWidget() {
    var container = document.getElementById('amazonWidgetContainer');
    if (!container) return;

    container.innerHTML = '<div class="widget-title">\uD83D\uDD25 Ofertas en Amazon</div>' +
      '<div id="widgetLoading" style="text-align:center;padding:20px;color:var(--text-muted);font-size:0.85rem;">Cargando ofertas...</div>';

    var self = this;
    var useDeals = API_BASE ? function(cb) {
      fetch(API_BASE + '/api/deals?count=10&category=Electronics')
        .then(function(r) { return r.json(); })
        .then(function(data) { cb(data.products || []); })
        .catch(function() { cb(null); });
    } : function(cb) { cb(null); };

    useDeals(function(products) {
      if (products && products.length > 0) {
        self.renderWidgetProducts(products, container);
      } else if (typeof FALLBACK_DEALS_DATA !== 'undefined') {
        self.renderWidgetProducts(FALLBACK_DEALS_DATA.slice(0, 10), container);
      } else {
        container.innerHTML = '<div class="widget-placeholder"><div class="icon">\uD83D\uDCE6</div>No hay ofertas disponibles<br><small>Intenta m\u00E1s tarde</small></div>';
      }
    });
  },

  renderNativeBanner() {
    var banner = document.querySelector('.amazon-native-banner');
    var container = document.getElementById('amazonNativeAd');
    if (!banner || !container) return;
    banner.style.display = '';
    var items = this.getFiltered();
    var picks = [];
    var pool = items.slice();
    for (var i = 0; i < 4 && pool.length > 0; i++) {
      var idx = Math.floor(Math.random() * pool.length);
      picks.push(pool[idx]);
      pool.splice(idx, 1);
    }
    if (picks.length === 0) {
      container.innerHTML = '<div class="widget-placeholder"><div class="icon">\uD83D\uDCE6</div>Sin productos disponibles</div>';
      return;
    }
    var html = '<div class="native-ad-grid">';
    for (var i = 0; i < picks.length; i++) {
      var p = picks[i];
      html +=
        '<a href="' + escapeHtml(p.affiliateLink) + '" target="_blank" rel="noopener noreferrer" class="native-ad-card">' +
          '<div class="native-ad-img-wrap">' +
            '<img src="' + escapeHtml(p.image) + '" alt="' + escapeHtml(p.name) + '" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=\'/placeholder.svg\'">' +
          '</div>' +
          '<div class="native-ad-info">' +
            '<div class="native-ad-name">' + escapeHtml(p.name) + '</div>' +
            '<div class="native-ad-price">' + escapeHtml(p.price) + '</div>' +
          '</div>' +
        '</a>';
    }
    html += '</div>';
    container.innerHTML = html;
  }
};

function getCategoryLabel(cat) {
  var map = {
    electronica: 'Electr\u00F3nica',
    hogar: 'Hogar',
    moda: 'Moda',

  };
  return map[cat] || cat;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function sanitizeHtml(str) {
  if (typeof DOMPurify !== 'undefined') {
    return DOMPurify.sanitize(str, { ALLOWED_TAGS: ['a', 'b', 'i', 'em', 'strong', 'br', 'span', 'div', 'p', 'ul', 'ol', 'li', 'code', 'pre'], ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'class'] });
  }
  var div = document.createElement('div');
  div.innerHTML = str;
  function clean(node) {
    var out = [];
    for (var i = 0; i < node.childNodes.length; i++) {
      var n = node.childNodes[i];
      if (n.nodeType === 3) {
        out.push(escapeHtml(n.textContent));
      } else if (n.nodeType === 1) {
        var tag = n.tagName.toLowerCase();
        if (tag === 'br') {
          out.push('<br>');
        } else if (tag === 'a') {
          var href = n.getAttribute('href') || '';
          out.push('<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">' + clean(n) + '</a>');
        } else if (tag === 'em' || tag === 'b' || tag === 'i' || tag === 'strong') {
          out.push('<' + tag + '>' + clean(n) + '</' + tag + '>');
        } else {
          out.push(escapeHtml(n.textContent));
        }
      }
    }
    return out.join('');
  }
  return clean(div);
}

function showToast(msg) {
  var container = document.getElementById('toastContainer');
  if (!container) return;
  var el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = escapeHtml(msg);
  container.appendChild(el);
  setTimeout(function() {
    el.classList.add('out');
    setTimeout(function() { el.remove(); }, 400);
  }, 2500);
}

// ── Scroll Animations ──
function initScrollAnimations() {
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.amazon-native-banner, .widget-product').forEach(function(el) {
    el.classList.add('fade-up');
    observer.observe(el);
  });
}

// ── Hero Parallax ──
function initHeroParallax() {
  var hero = document.getElementById('hero');
  if (!hero) return;
  window.addEventListener('scroll', function() {
    var rect = hero.getBoundingClientRect();
    if (rect.bottom > 0 && rect.top < window.innerHeight) {
      var offset = rect.top * 0.3;
      hero.style.backgroundPosition = 'center ' + (offset * -1) + 'px';
    }
  }, { passive: true });
}

// ── Server Check ──
function checkServer() {
  if (!API_BASE) {
    console.log('[App] Modo sin servidor - usando datos locales');
    return;
  }
  fetch(API_BASE + '/api/config', { method: 'GET' })
    .then(function(r) {
      if (!r.ok) throw new Error();
      return r.json();
    })
    .then(function(config) {
      var tag = config.tag || '';
      if (tag) console.log('[Server] Conectado. Tag afiliado: ' + tag);
    })
    .catch(function() {
      console.warn('[Server] No disponible');
    });
}

document.addEventListener('DOMContentLoaded', function() {
  App.init();
  initScrollAnimations();
  initHeroParallax();
  checkServer();
});
