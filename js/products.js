const Products = {
  items: [],

  load() {
    const stored = localStorage.getItem('afiliadospro_products');
    if (stored) {
      try {
        this.items = JSON.parse(stored);
        if (this.items.some(function(p) { return /^d\d+$/.test(p.id); })) {
          console.warn('[Products] Detectados IDs antiguos. Respaldando y migrando...');
          try { localStorage.setItem('afiliadospro_products_backup', stored); } catch(e) {}
          this.items = this.items.filter(function(p) { return !/^d\d+$/.test(p.id); });
        }
      } catch (e) {
        this.items = [];
      }
    } else {
      this.items = [];
    }
  },

  save() {
    localStorage.setItem('afiliadospro_products', JSON.stringify(this.items));
  },

  getAll() {
    return this.items;
  },

  getById(id) {
    return this.items.find(function(p) { return p.id === id; });
  },

  add(data) {
    var p = {
      id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      name: (data.name || '').trim(),
      image: (data.image || '').trim(),
      price: (data.price || '').trim(),
      originalPrice: data.originalPrice || '',
      discountPercent: data.discountPercent || '',
      dealBadge: data.dealBadge || '',
      affiliateLink: (data.affiliateLink || '').trim(),
      category: data.category || '',
      subcategory: data.subcategory || ''
    };
    this.items.unshift(p);
    this.save();
    return p;
  },

  remove(id) {
    this.items = this.items.filter(function(p) { return p.id !== id; });
    this.save();
  },

  extractASINfromLink(url) {
    var m = url.match(/(?:dp|product|gp\/product)\/([A-Z0-9]{10})/i);
    return m ? m[1] : null;
  },

  updateByASIN(asin, fields) {
    for (var i = 0; i < this.items.length; i++) {
      var a = this.extractASINfromLink(this.items[i].affiliateLink);
      if (a === asin) {
        for (var key in fields) {
          if (fields.hasOwnProperty(key)) {
            this.items[i][key] = fields[key];
          }
        }
        this.save();
        return true;
      }
    }
    return false;
  },

  updatePrices(updates) {
    for (var i = 0; i < updates.length; i++) {
      var u = updates[i];
      if (!u.price) continue;
      var p = this.getById(u.id);
      if (p) {
        p.price = u.price;
        if (u.originalPrice) p.originalPrice = u.originalPrice;
        if (u.discountPercent) p.discountPercent = u.discountPercent;
      }
    }
    this.save();
  }
};
