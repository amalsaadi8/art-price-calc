/* UI wiring for the artwork price calculator. */
(function () {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };
  const clone = (o) => JSON.parse(JSON.stringify(o));

  let lang = store.get('artcalc.lang', 'en');
  let currency = store.get('artcalc.currency', 'AED');
  const t = (k) => (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k;

  function presetItems(list) {
    return list.map((p) => ({ name: p[lang] || p.en, qty: p.qty, cost: p.cost }));
  }
  // Translate untouched preset item names when the language changes.
  function translateItems(items) {
    const all = [...Object.values(PRESETS.materials).flat(), ...Object.values(PRESETS.support), ...PRESETS.packaging];
    items.forEach((it) => {
      const p = all.find((x) => x.en === it.name || x.ar === it.name);
      if (p) it.name = p[lang];
    });
  }
  function materialsFor(medium, support) {
    return presetItems([PRESETS.support[support], ...PRESETS.materials[medium]]);
  }

  function defaults() {
    return {
      name: '', client: '', quoteNo: '', quantity: 1, medium: 'calligraphy', support: 'paper', width: 50, height: 70,
      materials: materialsFor('calligraphy', 'paper'),
      hours: 10, hourlyRate: 50, overhead: 20,
      framed: true,
      frame: {
        mode: 'calc', fixedCost: 0, mouldingPerM: 25, mouldingWidth: 3, glazing: 'glass',
        glazingPerM2: 60, mat: true, matWidth: 6, matPerM2: 40, backingPerM2: 15,
        fittingCost: 20, wastePct: 10,
      },
      packaging: presetItems(PRESETS.packaging),
      shippingMode: 'separate', deliveryCost: 35, insurancePct: 1,
      method: 'higher', markupPct: 50, sizeMode: 'area', sizeRate: 0.25, complexity: 1,
      minimumPrice: 0,
      commissionPct: 0, paymentFeePct: 2.5, vatPct: 5, roundTo: 10,
    };
  }

  let state = Object.assign(defaults(), store.get('artcalc.current', {}));
  state.frame = Object.assign(defaults().frame, state.frame || {});

  // ---------- path helpers ----------
  const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function setPath(o, p, v) {
    const ks = p.split('.'); const last = ks.pop();
    ks.reduce((a, k) => (a[k] = a[k] || {}), o)[last] = v;
  }

  // ---------- formatting ----------
  function money(v) {
    if (!Number.isFinite(v)) return '—';
    const loc = 'en-US'; // Western digits, matching the input fields
    const dec = Math.abs(v) < 100 && v % 1 !== 0 ? 2 : (v % 1 === 0 ? 0 : 2);
    return new Intl.NumberFormat(loc, { minimumFractionDigits: dec, maximumFractionDigits: 2 }).format(v) + ' ' + currency;
  }
  const n2 = (v) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(v);

  // ---------- form binding ----------
  function writeForm() {
    $$('[data-k]').forEach((el) => {
      const v = getPath(state, el.dataset.k);
      if (el.type === 'checkbox') el.checked = !!v;
      else if (el.type === 'radio') el.checked = String(v) === el.value;
      else el.value = v == null ? '' : v;
    });
    renderList('materials');
    renderList('packaging');
  }

  function readField(el) {
    const k = el.dataset.k;
    let v;
    if (el.type === 'checkbox') v = el.checked;
    else if (el.type === 'radio') { if (!el.checked) return; v = el.value; }
    else if (el.type === 'number' || el.type === 'range') v = el.value === '' ? '' : parseFloat(el.value);
    else v = el.value;
    setPath(state, k, v);
  }

  function renderList(key) {
    const box = $(`[data-list="${key}"]`);
    box.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'item head';
    head.innerHTML = `<span>${t('itemName')}</span><span>${t('qty')}</span><span>${t('unitCost')}</span><span></span><span></span>`;
    box.appendChild(head);
    state[key].forEach((it, idx) => {
      const row = document.createElement('div');
      row.className = 'item';
      row.innerHTML = `
        <input type="text" aria-label="${t('itemName')}" value="${escapeAttr(it.name)}" data-f="name">
        <input type="number" aria-label="${t('qty')}" min="0" step="any" value="${it.qty}" data-f="qty">
        <input type="number" aria-label="${t('unitCost')}" min="0" step="any" value="${it.cost}" data-f="cost">
        <span class="line-total">${money((+it.qty || 0) * (+it.cost || 0))}</span>
        <button type="button" class="icon" aria-label="${t('remove')}" title="${t('remove')}">×</button>`;
      row.addEventListener('input', (e) => {
        const f = e.target.dataset.f; if (!f) return;
        it[f] = f === 'name' ? e.target.value : (e.target.value === '' ? '' : parseFloat(e.target.value));
        $('.line-total', row).textContent = money((+it.qty || 0) * (+it.cost || 0));
        update();
      });
      $('button', row).addEventListener('click', () => { state[key].splice(idx, 1); renderList(key); update(); });
      box.appendChild(row);
    });
  }
  function escapeAttr(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  function applyVisibility() {
    $$('[data-show]').forEach((el) => {
      const cond = el.dataset.show;
      let ok;
      const m = cond.match(/^([\w.]+)(!?=)(.+)$/);
      if (m) {
        const v = String(getPath(state, m[1]));
        ok = m[2] === '=' ? v === m[3] : v !== m[3];
      } else ok = !!getPath(state, cond);
      el.hidden = !ok;
    });
  }

  // ---------- i18n ----------
  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = t('appTitle');
    $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    $('#langToggle').textContent = t('langBtn');
    renderList('materials');
    renderList('packaging');
    renderSaved();
  }

  // ---------- output ----------
  function row(label, value, cls = '') {
    return `<tr class="${cls}"><td>${label}</td><td>${value}</td></tr>`;
  }

  function update() {
    applyVisibility();
    $$('.cur').forEach((el) => {
      el.textContent = currency + (el.hasAttribute('data-suffix-size') ? (state.sizeMode === 'linear' ? t('perCm') : t('perCm2')) : '');
    });
    $('#complexityOut').textContent = '×' + (+state.complexity || 1).toFixed(2);

    const r = ArtCalc.calculate(state);

    // frame detail
    if (state.framed && state.frame.mode === 'calc') {
      $('#frameOut').innerHTML =
        `<strong>${t('frameOuter')}:</strong> ${n2(r.frame.outerW)} × ${n2(r.frame.outerH)} cm<br>` +
        r.frame.lines.filter((l) => l.cost > 0)
          .map((l) => `${t('fl_' + l.key)}: ${l.unit ? n2(l.qty) + ' ' + l.unit + ' — ' : ''}${money(l.cost)}`).join(' · ') +
        ` — <strong>${money(r.frame.total)}</strong>`;
    }

    // headline
    $('#printMeta').textContent = `${state.name || t('untitled')} — ${n2(r.width)} × ${n2(r.height)} cm`;
    $('#outPrice').textContent = money(state.vatPct > 0 ? r.priceWithVat : r.price);
    const sub = [];
    if (state.vatPct > 0) sub.push(`${money(r.price)} ${t('exVat')} · ${money(r.priceWithVat)} ${t('inclVat')}`);
    if (r.quantity > 1) sub.push(`${t('perPiece')} · ${t('orderTotal')} ×${r.quantity}: <strong>${money(state.vatPct > 0 ? r.subtotalWithVat : r.subtotal)}</strong>`);
    if (r.shippingCharge > 0) sub.push(`${t('plusShipping')} ${money(r.shippingCharge + r.shippingVat)} → ${t('buyerPays')} <strong>${money(r.buyerTotal)}</strong>`);
    $('#outPriceSub').innerHTML = sub.join('<br>');

    // warnings
    const warn = [];
    if (!(r.width > 0 && r.height > 0) && state.method !== 'cost') warn.push(t('wNoSize'));
    if (r.invalid) warn.push(t('wInvalid'));
    else if (r.profit < -0.005) warn.push(t('wLoss'));
    else if (r.effectiveHourly != null && r.effectiveHourly < (+state.hourlyRate || 0) - 0.005) warn.push(t('wLowHourly'));
    $('#warnings').innerHTML = warn.map((w) => `<p class="warn">⚠ ${w}</p>`).join('');

    // cost breakdown
    const parts = [
      ['cMaterials', r.materials, 'c1'], ['cLabor', r.labor, 'c2'], ['cFrame', r.frame.total, 'c3'],
      ['cPackaging', r.packaging, 'c4'], ['cOverhead', r.overhead, 'c5'],
    ];
    const tot = r.productionCost || 1;
    $('#costBar').innerHTML = parts.filter((p) => p[1] > 0)
      .map((p) => `<span class="${p[2]}" style="flex:${p[1] / tot}" title="${t(p[0])}"></span>`).join('');
    $('#costTable').innerHTML = parts.map((p) => row(`<i class="dot ${p[2]}"></i>${t(p[0])}`, money(p[1]))).join('') +
      row(t('cTotal'), money(r.productionCost), 'total');

    // split of price
    $('#splitTable').innerHTML = r.invalid ? '' :
      (r.commission ? row(t('sCommission'), money(r.commission)) : '') +
      (r.paymentFee ? row(t('sFees'), money(r.paymentFee)) : '') +
      row(r.quantity > 1 ? `${t('sCosts')} (×${r.quantity})` : t('sCosts'), money(r.orderCost)) +
      (r.deliveryBorneByArtist ? row(t('sDelivery'), money(r.deliveryBorneByArtist)) : '') +
      row(t('sProfit'), money(r.profit), 'total ' + (r.profit < 0 ? 'neg' : 'pos'));

    // methods
    const used = r.methods.chosen;
    const mark = (v) => (!r.methods.raisedToMinimum && Math.abs(v - used) < 1e-6 ? ` <em class="tag">${t('mUsed')}</em>` : '');
    $('#methodTable').innerHTML =
      row(t('mCostPlus') + mark(r.methods.costPlus), money(r.methods.costPlus)) +
      row(t('mSize') + mark(r.methods.sizeBased), money(r.methods.sizeBased)) +
      (r.methods.raisedToMinimum ? row(t('mMinimum') + ` <em class="tag">${t('mUsed')}</em>`, money(used)) : '');

    // KPIs
    const k = [
      [t('kMargin'), r.invalid ? '—' : n2(r.marginPct) + '%'],
      [t('kHourly'), r.effectiveHourly == null || r.invalid ? '—' : money(r.effectiveHourly)],
      [t('kPerCm2'), r.pricePerCm2 == null || r.invalid ? '—' : money(r.pricePerCm2)],
    ];
    if (r.shippingCharge > 0) k.push([t('kShipping'), money(r.shippingCharge)]);
    $('#kpis').innerHTML = k.map(([a, b]) => `<div><span>${a}</span><strong>${b}</strong></div>`).join('');

    store.set('artcalc.current', state);
    return r;
  }

  // ---------- saved pieces ----------
  const savedKey = 'artcalc.pieces';
  function renderSaved() {
    const list = store.get(savedKey, []);
    const ul = $('#savedList');
    if (!list.length) { ul.innerHTML = `<li class="empty">${t('noSaved')}</li>`; return; }
    ul.innerHTML = '';
    list.slice().reverse().forEach((p) => {
      const li = document.createElement('li');
      const r = ArtCalc.calculate(p.state);
      li.innerHTML = `<div><strong></strong><small>${n2(p.state.width)}×${n2(p.state.height)} cm · ${money(p.state.vatPct > 0 ? r.priceWithVat : r.price)}</small></div>
        <span><button type="button" class="btn small" data-a="load">${t('load')}</button>
        <button type="button" class="btn small ghost" data-a="del">${t('del')}</button></span>`;
      $('strong', li).textContent = p.state.name || t('untitled');
      li.addEventListener('click', (e) => {
        const a = e.target.dataset.a;
        if (a === 'load') { state = Object.assign(defaults(), clone(p.state)); writeForm(); update(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        if (a === 'del' && confirm(t('delConfirm'))) { store.set(savedKey, store.get(savedKey, []).filter((x) => x.id !== p.id)); renderSaved(); }
      });
      ul.appendChild(li);
    });
  }

  function flash(btn, msg) {
    const old = btn.textContent; btn.textContent = msg; btn.disabled = true;
    setTimeout(() => { btn.textContent = old; btn.disabled = false; }, 1400);
  }

  function summaryText() {
    const r = ArtCalc.calculate(state);
    const lines = [
      `${state.name || t('untitled')} — ${n2(state.width)} × ${n2(state.height)} cm`,
      `${t('cMaterials')}: ${money(r.materials)}`,
      `${t('cLabor')}: ${money(r.labor)} (${n2(state.hours)} h × ${money(+state.hourlyRate || 0)})`,
      state.framed ? `${t('cFrame')}: ${money(r.frame.total)}` : null,
      `${t('cPackaging')}: ${money(r.packaging)}`,
      `${t('cOverhead')}: ${money(r.overhead)}`,
      `${t('cTotal')}: ${money(r.productionCost)}`,
      `${t('suggestedPrice')}: ${money(r.price)} ${t('exVat')}${state.vatPct > 0 ? ` / ${money(r.priceWithVat)} ${t('inclVat')}` : ''}${r.quantity > 1 ? ` (${t('perPiece')})` : ''}`,
      r.quantity > 1 ? `${t('orderTotal')} ×${r.quantity}: ${money(r.subtotal)} ${t('exVat')}${state.vatPct > 0 ? ` / ${money(r.subtotalWithVat)} ${t('inclVat')}` : ''}` : null,
      r.shippingCharge > 0 ? `${t('kShipping')}: ${money(r.shippingCharge + r.shippingVat)} → ${t('buyerPays')}: ${money(r.buyerTotal)}` : null,
      `${t('sProfit')}: ${money(r.profit)} (${n2(r.marginPct)}%)`,
    ];
    return lines.filter(Boolean).join('\n');
  }

  // ---------- events ----------
  function init() {
    $('#currency').value = currency;
    writeForm();
    applyLang();
    update();

    $('#form').addEventListener('input', (e) => { if (e.target.dataset.k) { readField(e.target); update(); } });
    $('#form').addEventListener('change', (e) => { if (e.target.dataset.k) { readField(e.target); update(); } });

    $$('[data-add]').forEach((b) => b.addEventListener('click', () => {
      state[b.dataset.add].push({ name: '', qty: 1, cost: 0 });
      renderList(b.dataset.add); update();
      const inputs = $$(`[data-list="${b.dataset.add}"] input[data-f="name"]`); inputs[inputs.length - 1].focus();
    }));

    $('#loadPreset').addEventListener('click', () => {
      if (state.materials.length && !confirm(t('presetConfirm'))) return;
      state.materials = materialsFor(state.medium, state.support);
      renderList('materials'); update();
    });

    // Sensible surface + frame defaults when the medium changes.
    $('#medium').addEventListener('change', (e) => {
      state.medium = e.target.value;
      if (state.medium === 'oil' || state.medium === 'acrylic') {
        if (state.support === 'paper') state.support = 'canvas';
        state.frame.glazing = 'none'; state.frame.mat = false;
      } else {
        state.support = 'paper'; state.frame.glazing = 'glass'; state.frame.mat = true;
      }
      writeForm(); update();
    });

    $('#currency').addEventListener('change', (e) => { currency = e.target.value; store.set('artcalc.currency', currency); writeForm(); update(); renderSaved(); });
    $('#langToggle').addEventListener('click', () => { lang = lang === 'en' ? 'ar' : 'en'; store.set('artcalc.lang', lang);
      translateItems(state.materials); translateItems(state.packaging); applyLang();
      window.ArtApp.onLang.forEach((fn) => fn()); update(); });

    $('#saveBtn').addEventListener('click', (e) => {
      const list = store.get(savedKey, []);
      const existing = list.find((p) => p.state.name && p.state.name === state.name);
      if (existing) { existing.state = clone(state); existing.date = Date.now(); }
      else list.push({ id: Date.now().toString(36), date: Date.now(), state: clone(state) });
      store.set(savedKey, list); renderSaved(); flash(e.target, t('savedOk'));
    });
    $('#printBtn').addEventListener('click', () => window.print());
    $('#copyBtn').addEventListener('click', async (e) => {
      try { await navigator.clipboard.writeText(summaryText()); flash(e.target, t('copied')); }
      catch { prompt('', summaryText()); }
    });
    $('#resetBtn').addEventListener('click', () => {
      if (!confirm(t('resetConfirm'))) return;
      const keep = state; state = defaults();
      // keep the artist's business settings
      ['hourlyRate', 'overhead', 'markupPct', 'sizeMode', 'sizeRate', 'commissionPct', 'paymentFeePct', 'vatPct', 'roundTo', 'insurancePct', 'shippingMode', 'minimumPrice']
        .forEach((k) => { state[k] = keep[k]; });
      state.frame = Object.assign(state.frame, keep.frame);
      state.packaging = clone(keep.packaging);
      writeForm(); update();
    });

    $('#exportBtn').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(store.get(savedKey, []), null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'artwork-prices.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    $('#importFile').addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!Array.isArray(data)) throw new Error('bad');
        const list = store.get(savedKey, []);
        const ids = new Set(list.map((p) => p.id));
        const add = data.filter((p) => p && p.state && !ids.has(p.id));
        store.set(savedKey, list.concat(add)); renderSaved(); alert(`${add.length} ${t('importOk')}`);
      } catch { alert(t('importFail')); }
      e.target.value = '';
    });
  }

  // Small API for quote.js (brand + PDF/Excel export).
  window.ArtApp = {
    get state() { return state; },
    get lang() { return lang; },
    get currency() { return currency; },
    t, money, n2,
    result: () => ArtCalc.calculate(state),
    setField(k, v) { setPath(state, k, v); writeForm(); update(); },
    onLang: [],
  };

  init();
})();
