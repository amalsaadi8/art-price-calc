/* Brand settings, quote designer, app theming, and PDF / Excel quotation export. */
(function () {
  'use strict';

  const A = window.ArtApp;
  const t = A.t;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const KEY = 'artcalc.brand';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(brand)); }
    catch { /* quota (large logo) or storage disabled: keep working in memory */ }
  };

  // Fonts offered in the designer (Google Fonts css2 specs; weights must exist for each family).
  const FONTS = {
    'Noto Kufi Arabic': { spec: 'Noto+Kufi+Arabic:wght@400;600;700', ar: true },
    'Cairo': { spec: 'Cairo:wght@400;600;700', ar: true },
    'Tajawal': { spec: 'Tajawal:wght@400;500;700', ar: true },
    'Almarai': { spec: 'Almarai:wght@400;700', ar: true },
    'Noto Naskh Arabic': { spec: 'Noto+Naskh+Arabic:wght@400;600;700', ar: true },
    'Amiri': { spec: 'Amiri:wght@400;700', ar: true },
    'Reem Kufi': { spec: 'Reem+Kufi:wght@400;600;700', ar: true },
    'El Messiri': { spec: 'El+Messiri:wght@400;600;700', ar: true },
    'Aref Ruqaa': { spec: 'Aref+Ruqaa:wght@400;700', ar: true },
    'Inter': { spec: 'Inter:wght@400;600;700' },
    'Playfair Display': { spec: 'Playfair+Display:wght@400;600;700' },
    'Cormorant Garamond': { spec: 'Cormorant+Garamond:wght@400;600;700' },
    'Lora': { spec: 'Lora:wght@400;600;700' },
    'Montserrat': { spec: 'Montserrat:wght@400;600;700' },
  };

  const DESIGN = {
    template: 'banner', titleText: '', quoteLang: 'app',
    logoSize: 72, logoBox: true, radius: 6, textSize: 13,
    inkAuto: true, headerInk: '#ffffff', paper: '#ffffff', textColor: '#1f1a14',
    headFont: 'auto', bodyFont: 'auto',
    showClient: true, showTagline: true, showValidity: true, showNotes: true, showContact: true, showThanks: true,
    thanksText: '',
  };
  const brand = Object.assign({
    name: '', tagline: '', logo: '', primary: '#8a5a2b', accent: '#b8892f', applyToApp: false,
    phone: '', email: '', website: '', instagram: '', terms: null, validDays: 14,
    pdfBreakdown: false, nextNo: 1001,
  }, DESIGN, load());
  if (brand.terms == null) brand.terms = t('defaultTerms');

  // ---------- colour helpers ----------
  function hexToRgb(h) {
    const m = /^#?([0-9a-f]{6})$/i.exec(h || '');
    const n = m ? parseInt(m[1], 16) : 0x8a5a2b;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const toHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const mix = (hex, withHex, amt) => {
    const a = hexToRgb(hex), b = hexToRgb(withHex);
    return toHex(a.map((v, i) => v + (b[i] - v) * amt));
  };
  function inkFor(hex) {
    const [r, g, b] = hexToRgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#1f1a14' : '#ffffff';
  }
  const argb = (hex) => 'FF' + hexToRgb(hex).map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ---------- quote language ----------
  /** Resolve the quote's language: primary language, and whether labels are bilingual. */
  function quoteLang() {
    const ql = brand.quoteLang;
    const primary = ql === 'en' || ql === 'ar' ? ql : A.lang;
    return { primary, other: primary === 'ar' ? 'en' : 'ar', bi: ql === 'bi' };
  }
  const tr = (key, lang) => (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;

  // ---------- fonts ----------
  function resolvedFonts(primary) {
    const auto = primary === 'ar' ? 'Noto Kufi Arabic' : 'Inter';
    const head = brand.headFont in FONTS ? brand.headFont : auto;
    const body = brand.bodyFont in FONTS ? brand.bodyFont : auto;
    return { head, body, families: [...new Set([head, body, 'Noto Kufi Arabic', 'Inter'])] };
  }
  const fontsHref = (fams) => 'https://fonts.googleapis.com/css2?' + fams.map((f) => 'family=' + FONTS[f].spec).join('&') + '&display=swap';
  const stack = (f) => `'${f}', 'Noto Kufi Arabic', 'Inter', sans-serif`;
  function ensureFontLink(fams) {
    let link = $('#qdFonts');
    if (!link) { link = document.createElement('link'); link.rel = 'stylesheet'; link.id = 'qdFonts'; document.head.appendChild(link); }
    const href = fontsHref(fams);
    if (link.href !== href) link.href = href;
  }

  // ---------- brand / designer form ----------
  function fillFontSelects() {
    $$('select[data-b="headFont"], select[data-b="bodyFont"]').forEach((sel) => {
      sel.innerHTML = `<option value="auto">${esc(t('fAuto'))}</option>` + Object.keys(FONTS)
        .map((f) => `<option value="${f}">${f}${FONTS[f].ar ? ' — عربي' : ''}</option>`).join('');
      sel.value = brand[sel.dataset.b];
    });
  }

  function writeBrandForm() {
    $$('[data-b]').forEach((el) => {
      const v = brand[el.dataset.b];
      if (el.type === 'checkbox') el.checked = !!v;
      else if (el.type === 'radio') el.checked = String(v) === el.value;
      else el.value = v ?? '';
    });
    $$('[data-code]').forEach((el) => { el.textContent = brand[el.dataset.code]; });
    $$('[data-out]').forEach((el) => { el.textContent = brand[el.dataset.out] + (el.dataset.unit || ''); });
    $$('.logo-preview').forEach((el) => { el.innerHTML = brand.logo ? `<img src="${brand.logo}" alt="">` : '<span>LOGO</span>'; });
    $$('.logo-remove').forEach((el) => { el.hidden = !brand.logo; });
    $('#headerInk').disabled = !!brand.inkAuto;
  }

  function applyTheme() {
    const root = document.documentElement.style;
    const mark = $('#brandMark');
    const on = brand.applyToApp;
    ['--accent', '--accent-ink', '--gold'].forEach((v) => root.removeProperty(v));
    if (on) {
      root.setProperty('--accent', brand.primary);
      root.setProperty('--accent-ink', inkFor(brand.primary));
      root.setProperty('--gold', brand.accent);
    }
    if (on && brand.logo) { mark.innerHTML = `<img src="${brand.logo}" alt="">`; mark.classList.add('has-logo'); }
    else { mark.textContent = '✒'; mark.classList.remove('has-logo'); }
    $('#appName').textContent = on && brand.name ? brand.name : t('appTitle');
  }

  // ---------- live preview ----------
  let previewTimer;
  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 80);
  }
  function renderPreview() {
    const dlg = $('#designer');
    if (!dlg || !dlg.open) return;
    const q = quoteData(true);
    ensureFontLink(resolvedFonts(q.lang).families);
    const sheet = $('#dzSheet');
    sheet.innerHTML = quoteHtml(q);
    const page = sheet.firstElementChild;
    const fit = () => {
      const w = sheet.parentElement.clientWidth;
      const s = Math.min(1, w / 794);
      page.style.transform = `scale(${s})`;
      sheet.style.height = page.offsetHeight * s + 'px';
    };
    fit();
    requestAnimationFrame(fit);
    if (document.fonts) document.fonts.ready.then(fit);
  }

  function bind() {
    const onInput = (e) => {
      const el = e.target; if (!el.dataset.b) return;
      let v;
      if (el.type === 'checkbox') v = el.checked;
      else if (el.type === 'radio') { if (!el.checked) return; v = el.value; }
      else if (el.type === 'number' || el.type === 'range') v = parseFloat(el.value) || 0;
      else v = el.value;
      brand[el.dataset.b] = v;
      const code = $(`[data-code="${el.dataset.b}"]`); if (code) code.textContent = el.value;
      const out = $(`[data-out="${el.dataset.b}"]`); if (out) out.textContent = el.value + (out.dataset.unit || '');
      if (el.dataset.b === 'inkAuto') $('#headerInk').disabled = v;
      save(); applyTheme(); schedulePreview();
    };
    document.addEventListener('input', onInput);
    document.addEventListener('change', onInput);

    $$('.logo-file').forEach((inp) => inp.addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try { brand.logo = await fileToPng(file, 480); save(); writeBrandForm(); applyTheme(); schedulePreview(); }
      catch { alert(t('logoTooBig')); }
      e.target.value = '';
    }));
    $$('.logo-remove').forEach((b) => b.addEventListener('click', () => {
      brand.logo = ''; save(); writeBrandForm(); applyTheme(); schedulePreview();
    }));

    const dlg = $('#designer');
    $$('[data-open-designer]').forEach((b) => b.addEventListener('click', () => {
      writeBrandForm(); dlg.showModal(); renderPreview();
    }));
    $('#dzClose').addEventListener('click', () => dlg.close());
    $('#dzDone').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // backdrop
    window.addEventListener('resize', schedulePreview);
    $('#dzReset').addEventListener('click', () => {
      if (!confirm(t('resetDesignConfirm'))) return;
      Object.assign(brand, DESIGN); save(); writeBrandForm(); fillFontSelects(); schedulePreview();
    });

    $('#pdfBtn').addEventListener('click', (e) => run(e.currentTarget, exportPdf));
    $('#xlsxBtn').addEventListener('click', (e) => run(e.currentTarget, exportXlsx));
    $('#dzPdf').addEventListener('click', (e) => run(e.currentTarget, exportPdf));
    $('#dzXlsx').addEventListener('click', (e) => run(e.currentTarget, exportXlsx));
    A.onLang.push(() => { applyTheme(); fillFontSelects(); schedulePreview(); });
  }

  /** Downscale any image (PNG/JPG/SVG/WebP) to a PNG data URL, max `max` px on the long side. */
  function fileToPng(file, max) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.naturalWidth || max, img.naturalHeight || max));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round((img.naturalWidth || max) * s));
        c.height = Math.max(1, Math.round((img.naturalHeight || max) * s));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/png'));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
      img.src = url;
    });
  }
  const imgSize = (src) => new Promise((res) => {
    const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.onerror = () => res([1, 1]); i.src = src;
  });

  // ---------- shared quote data ----------
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if ($(`script[src="${src}"]`)) return resolve();
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = () => reject(new Error(src + ' failed to load'));
      document.head.appendChild(s);
    });
  }

  async function run(btn, fn) {
    const old = btn.textContent; btn.textContent = t('preparing'); btn.disabled = true;
    try { await fn(); }
    catch (err) { console.error(err); alert(t('exportFail') + ' ' + err.message); }
    finally { btn.textContent = old; btn.disabled = false; }
  }

  /** Everything the PDF and Excel quotes need. `preview` never assigns a quote number. */
  function quoteData(preview) {
    const st = A.state;
    if (!st.quoteNo && !preview) {
      const no = `Q-${new Date().getFullYear()}-${brand.nextNo++}`;
      save(); A.setField('quoteNo', no);
    }
    const quoteNo = st.quoteNo || `Q-${new Date().getFullYear()}-${brand.nextNo}`;
    const r = A.result();
    const ql = quoteLang();
    const lang = ql.primary;
    const T = (k) => tr(k, lang);
    const fmtDate = (d) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en-GB',
      { calendar: 'gregory', numberingSystem: 'latn', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
    const today = new Date();
    const valid = new Date(today.getTime() + (brand.validDays || 14) * 86400000);
    const medium = { calligraphy: 'mCalligraphy', oil: 'mOil', acrylic: 'mAcrylic', watercolor: 'mWatercolor' }[st.medium];
    const support = { paper: 'sPaper', canvas: 'sCanvas', panel: 'sPanel' }[st.support];
    const cm = lang === 'ar' ? 'سم' : 'cm';
    const lines = [`${T(medium)} ${T('qOn')} ${T(support)}`, `${T('qSize')}: ${A.n2(r.width)} × ${A.n2(r.height)} ${cm}`];
    if (st.framed) {
      const extras = [];
      if (st.frame.mode === 'calc') {
        if (st.frame.glazing !== 'none') { const g = T({ glass: 'gGlass', acrylic: 'gAcrylic', museum: 'gMuseum' }[st.frame.glazing]); extras.push(lang === 'en' ? g.toLowerCase() : g); }
        if (st.frame.mat) extras.push(T('qMatShort'));
      }
      lines.push(T('qFramed') + (extras.length ? ` ${T('qWith')} ${extras.join(', ')}` : '') +
        (st.frame.mode === 'calc' ? ` · ${T('qFramedSize')} ${A.n2(r.frame.outerW)} × ${A.n2(r.frame.outerH)} ${cm}` : ''));
    }
    // Piece name in the quote's language; the other language appears underneath when bilingual.
    const nameEn = (st.name || '').trim(), nameAr = (st.nameAr || '').trim();
    const title = (lang === 'ar' ? nameAr || nameEn : nameEn || nameAr) || T('untitled');
    const other = lang === 'ar' ? nameEn : nameAr;
    const contact = brand.showContact ? [brand.phone, brand.email, brand.website,
      brand.instagram && (brand.instagram.startsWith('@') ? brand.instagram : '@' + brand.instagram)].filter(Boolean) : [];
    // ASCII-only filenames download reliably in every browser.
    const safe = (s) => String(s || '').normalize('NFKD').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return {
      st, r, lang, ql, T, rtl: lang === 'ar', today: fmtDate(today), valid: fmtDate(valid), quoteNo,
      title, altTitle: ql.bi && other && other !== title ? other : '',
      lines, contact,
      docTitle: brand.titleText || T('qTitle'),
      thanks: brand.showThanks ? (brand.thanksText || T('qThanks')) : '',
      filename: ['Quote', safe(quoteNo), safe(nameEn)].filter(Boolean).join('_'),
      shipping: r.shippingCharge + r.shippingVat,
    };
  }

  // ---------- PDF / preview document ----------
  function quoteHtml(q) {
    const { r, st, ql } = q;
    const tpl = ['banner', 'minimal', 'elegant'].includes(brand.template) ? brand.template : 'banner';
    const P = brand.primary, Acc = brand.accent;
    const paper = brand.paper || '#ffffff', text = brand.textColor || '#1f1a14';
    const ink = brand.inkAuto ? inkFor(P) : brand.headerInk;
    const muted = mix(text, paper, 0.42), line = mix(text, paper, 0.86), tint = mix(P, paper, 0.9);
    const R = Math.max(0, +brand.radius || 0), fs = Math.min(16, Math.max(11, +brand.textSize || 13));
    const logoH = Math.min(160, Math.max(32, +brand.logoSize || 72));
    const fonts = resolvedFonts(q.lang);
    const caps = q.rtl ? '' : ';text-transform:uppercase;letter-spacing:.05em';
    const m = (v) => `<bdi dir="ltr">${esc(A.money(v))}</bdi>`;
    // Label in the quote language, plus the other language underneath when bilingual.
    const L = (k, extra = '') => esc(q.T(k)) + extra + (ql.bi ? `<span class="qd-alt">${esc(tr(k, ql.other))}</span>` : '');
    const trow = (label, val, strong) => `<tr${strong ? ' class="grand"' : ''}><td>${label}</td><td>${val}</td></tr>`;
    let totals = trow(L('qSubtotal'), m(r.subtotal));
    if (st.vatPct > 0) totals += trow(L('qVat', ` <bdi>(${A.n2(+st.vatPct)}%)</bdi>`), m(r.vat));
    if (q.shipping > 0) totals += trow(L('qShipping'), m(q.shipping));
    totals += trow(L('qTotal'), m(r.buyerTotal), true);

    let internal = '';
    if (brand.pdfBreakdown) {
      const T = q.T;
      const rows = [
        [T('cMaterials'), r.materials], [T('cLabor'), r.labor], [T('cFrame'), r.frame.total],
        [T('cPackaging'), r.packaging], [T('cOverhead'), r.overhead], [T('cTotal'), r.productionCost],
        ...(r.quantity > 1 ? [[`${T('orderCost')} (×${r.quantity})`, r.orderCost]] : []),
        [T('sCommission'), r.commission], [T('sFees'), r.paymentFee], [T('sProfit'), r.profit],
      ].filter(([l, v]) => v || l === T('cTotal') || l === T('sProfit'));
      internal = `<div class="qd-internal"><h3>${esc(T('qInternal'))}</h3><table>${rows.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${m(b)}</td></tr>`).join('')}
        <tr><td>${esc(T('kMargin'))}</td><td>${A.n2(r.marginPct)}%</td></tr></table></div>`;
    }

    // Template-specific styling
    const tplCss = {
      banner: `
        .qd-head{background:${P};color:${ink}}
        .qd-bar{height:6px;background:${Acc}}
        .qd-items th{background:${P};color:${ink}}
        .qd-totals tr.grand td{background:${P};color:${ink}}`,
      minimal: `
        .qd-head{background:${paper};color:${text};padding-bottom:22px}
        .qd-name,.qd-h{color:${P}}
        .qd-bar{height:2px;background:${Acc};margin:0 48px}
        .qd-items th{background:none;color:${P};border-bottom:2px solid ${P}}
        .qd-totals tr.grand td{background:none;color:${P};border-top:2px solid ${P}}`,
      elegant: `
        .qd-head{background:${paper};color:${text};flex-direction:column;text-align:center;gap:14px;padding-bottom:20px}
        .qd-brand{flex-direction:column;gap:10px}
        .qd-name{color:${P};font-size:28px}
        .qd-title{text-align:center;border-top:3px double ${Acc};border-bottom:3px double ${Acc};padding:8px 40px}
        .qd-h{color:${P};font-size:20px}
        .qd-bar{display:none}
        .qd-meta{text-align:center}
        .qd-items th{background:${tint};color:${P}}
        .qd-totals tr.grand td{background:${P};color:${ink}}
        .qd-foot{flex-direction:column;align-items:center;text-align:center;border-top:3px double ${Acc}}`,
    }[tpl];

    const showTag = brand.showTagline && brand.tagline;
    const meta = [
      brand.showClient ? `<div><div class="lbl">${L('qBillTo')}</div><div class="val" dir="auto">${esc(st.client) || '—'}</div></div>` : '',
      `<div><div class="lbl">${L('qDate')}</div><div class="val">${q.today}</div></div>`,
      brand.showValidity ? `<div><div class="lbl">${L('qValid')}</div><div class="val">${q.valid}</div></div>` : '',
    ].join('');

    return `
<div class="qd qd-${tpl}" dir="${q.rtl ? 'rtl' : 'ltr'}" lang="${q.lang}">
<style>
  .qd{width:794px;min-height:1120px;background:${paper};color:${text};font-family:${stack(fonts.body)};font-size:${fs}px;line-height:1.55;display:flex;flex-direction:column;box-sizing:border-box}
  .qd *{box-sizing:border-box}
  .qd bdi{unicode-bidi:isolate}
  .qd [dir=auto]{text-align:${q.rtl ? 'right' : 'left'}}
  .qd-alt{display:block;font-size:.78em;font-weight:400;opacity:.78;text-transform:none;letter-spacing:0}
  .qd-head{padding:34px 48px 30px;display:flex;justify-content:space-between;align-items:center;gap:24px}
  .qd-brand{display:flex;align-items:center;gap:16px}
  .qd-brand img{max-height:${logoH}px;max-width:${Math.round(logoH * 2.2)}px;${brand.logoBox ? `background:#fff;padding:6px;border-radius:${Math.min(R + 2, 16)}px` : ''}}
  .qd-name,.qd-h{font-family:${stack(fonts.head)}}
  .qd-name{font-size:24px;font-weight:700;line-height:1.25}
  .qd-tag{opacity:.85;font-size:.95em}
  .qd-title{text-align:end}
  .qd-h{font-size:28px;font-weight:700;line-height:1.2${caps}}
  .qd-body{padding:32px 48px;flex:1}
  .qd-meta{display:flex;justify-content:space-between;gap:24px;margin-bottom:28px}
  .qd-meta .lbl{font-size:.82em;color:${muted}${caps}}
  .qd-meta .val{font-size:1.12em;font-weight:600}
  .qd-items{width:100%;border-collapse:separate;border-spacing:0;margin-bottom:20px}
  .qd-items th{font-weight:600;padding:10px 14px;text-align:start;font-size:.92em;vertical-align:bottom}
  .qd-items th:first-child{border-start-start-radius:${R}px;border-end-start-radius:${R}px}
  .qd-items th:last-child{border-start-end-radius:${R}px;border-end-end-radius:${R}px}
  .qd-items th:nth-child(n+3),.qd-items td:nth-child(n+3){text-align:end;white-space:nowrap}
  .qd-items th:nth-child(2),.qd-items td:nth-child(2){text-align:center;width:64px}
  .qd-items td{padding:16px 14px;border-bottom:1px solid ${line};vertical-align:top}
  .qd-items .t{font-family:${stack(fonts.head)};font-size:1.25em;font-weight:700;margin-bottom:2px}
  .qd-items .ta{color:${muted};font-weight:600;margin-bottom:4px}
  .qd-items .d{color:${muted}}
  .qd-totals{margin-inline-start:auto;width:360px;border-collapse:separate;border-spacing:0}
  .qd-totals td{padding:7px 14px;vertical-align:middle}
  .qd-totals td:last-child{text-align:end;white-space:nowrap;font-weight:600}
  .qd-totals tr.grand td{font-size:1.3em;font-weight:700;padding:12px 14px}
  .qd-totals tr.grand td:first-child{border-start-start-radius:${R}px;border-end-start-radius:${R}px}
  .qd-totals tr.grand td:last-child{border-start-end-radius:${R}px;border-end-end-radius:${R}px}
  .qd-ship{color:${muted};font-size:.92em;text-align:end;margin-top:6px}
  .qd-notes{margin-top:30px;background:${tint};border-inline-start:4px solid ${Acc};padding:14px 18px;border-radius:${R}px;white-space:pre-wrap}
  .qd-notes h3,.qd-internal h3{margin:0 0 6px;font-size:.92em;color:${P}${caps}}
  .qd-internal{margin-top:24px;border:1px dashed ${mix(text, paper, 0.7)};border-radius:${R}px;padding:14px 18px}
  .qd-internal table{width:100%;border-collapse:collapse}
  .qd-internal td{padding:3px 0;border-bottom:1px dotted ${line}}
  .qd-internal td:last-child{text-align:end}
  .qd-foot{border-top:4px solid ${Acc};padding:16px 48px 22px;display:flex;justify-content:space-between;gap:10px 16px;flex-wrap:wrap;font-size:.92em;color:${muted}}
  .qd-foot .c span{margin-inline-end:16px;white-space:nowrap;direction:ltr;unicode-bidi:isolate}
  .qd-foot .th{color:${P};font-weight:600}
  ${tplCss}
</style>
  <div class="qd-head">
    <div class="qd-brand">
      ${brand.logo ? `<img src="${brand.logo}" alt="">` : ''}
      <div>${brand.name ? `<div class="qd-name" dir="auto">${esc(brand.name)}</div>` : ''}${showTag ? `<div class="qd-tag" dir="auto">${esc(brand.tagline)}</div>` : ''}</div>
    </div>
    <div class="qd-title"><div class="qd-h">${esc(q.docTitle)}${ql.bi && !brand.titleText ? `<span class="qd-alt">${esc(tr('qTitle', ql.other))}</span>` : ''}</div><div>${esc(q.T('qNo'))} <bdi dir="ltr">${esc(q.quoteNo)}</bdi></div></div>
  </div>
  <div class="qd-bar"></div>
  <div class="qd-body">
    <div class="qd-meta">${meta}</div>
    <table class="qd-items">
      <tr><th>${L('qDesc')}</th><th>${L('qQty')}</th><th>${L('qUnit')}</th><th>${L('qAmount')}</th></tr>
      <tr><td><div class="t" dir="auto">${esc(q.title)}</div>${q.altTitle ? `<div class="ta" dir="auto">${esc(q.altTitle)}</div>` : ''}<div class="d">${q.lines.map((l) => esc(l).replace(/([\d.,]+ × [\d.,]+ cm)/g, '<bdi dir="ltr">$1</bdi>')).join('<br>')}</div></td><td>${r.quantity}</td><td>${m(r.price)}</td><td><strong>${m(r.subtotal)}</strong></td></tr>
    </table>
    <table class="qd-totals">${totals}</table>
    ${st.shippingMode === 'included' ? `<div class="qd-ship">✓ ${esc(q.T('qShipIncluded'))}</div>` : ''}
    ${brand.showNotes && brand.terms ? `<div class="qd-notes"><h3>${L('qNotes')}</h3><div dir="auto">${esc(brand.terms)}</div></div>` : ''}
    ${internal}
  </div>
  ${q.contact.length || q.thanks ? `<div class="qd-foot">
    <div class="c">${q.contact.map((c) => `<span>${esc(c)}</span>`).join('')}</div>
    ${q.thanks ? `<div class="th" dir="auto">${esc(q.thanks)}</div>` : ''}
  </div>` : ''}
</div>`;
  }

  // Google Fonts embedded as data URLs so the PDF uses the chosen fonts.
  // Falls back silently to system fonts when offline.
  const fontCache = {};
  function embeddedFonts(fams) {
    const href = fontsHref(fams);
    if (!fontCache[href]) {
      fontCache[href] = (async () => {
        const css = await (await fetch(href.replace('display=swap', 'display=block'))).text();
        const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*{[^}]*})/g)]
          .filter((m) => m[1] === 'arabic' || m[1] === 'latin').map((m) => m[2]);
        const toData = async (url) => {
          const blob = await (await fetch(url)).blob();
          return new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
        };
        const out = await Promise.all(blocks.map(async (b) => {
          const url = (b.match(/url\((https:[^)]+)\)/) || [])[1];
          return url ? b.replace(url, await toData(url)) : '';
        }));
        return out.join('\n');
      })().catch(() => '');
    }
    return Promise.race([fontCache[href], new Promise((r) => setTimeout(() => r(''), 10000))]);
  }

  /** Render the quote with the browser's own engine (perfect Arabic shaping) via SVG foreignObject. */
  async function renderQuote(q) {
    const W = 794, PAGE_H = 1123, SCALE = 2;
    const fams = resolvedFonts(q.lang).families;
    ensureFontLink(fams);
    const fontCss = await embeddedFonts(fams);
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;pointer-events:none';
    host.innerHTML = quoteHtml(q);
    const el = host.firstElementChild;
    if (fontCss) { const st = document.createElement('style'); st.textContent = fontCss; el.prepend(st); }
    document.body.appendChild(host);
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const H = Math.max(PAGE_H, Math.ceil(el.scrollHeight / PAGE_H) * PAGE_H);
    el.style.minHeight = H + 'px';
    const xhtml = new XMLSerializer().serializeToString(el);
    host.remove();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject x="0" y="0" width="100%" height="100%">${xhtml}</foreignObject></svg>`;
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = W * SCALE; canvas.height = H * SCALE;
    const g = canvas.getContext('2d');
    g.fillStyle = brand.paper || '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { canvas, W, H, PAGE_H, SCALE };
  }

  async function exportPdf() {
    const q = quoteData();
    await loadScript('vendor/jspdf.umd.min.js');
    let pages;
    try {
      const { canvas, W, H, PAGE_H, SCALE } = await renderQuote(q);
      pages = [];
      for (let y = 0; y < H; y += PAGE_H) {
        const c = document.createElement('canvas');
        c.width = W * SCALE; c.height = PAGE_H * SCALE;
        c.getContext('2d').drawImage(canvas, 0, y * SCALE, c.width, c.height, 0, 0, c.width, c.height);
        pages.push(c.toDataURL('image/jpeg', 0.95)); // throws if the browser tainted the canvas
      }
    } catch (err) {
      console.warn('Direct PDF rendering unavailable, using print dialog', err);
      return printQuote(q);
    }
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    pdf.setProperties({ title: `${q.docTitle} ${q.quoteNo}`, author: brand.name || '', creator: 'Artwork Price Calculator' });
    pages.forEach((src, i) => { if (i) pdf.addPage(); pdf.addImage(src, 'JPEG', 0, 0, 210, 297); });
    pdf.save(q.filename + '.pdf');
  }

  /** Fallback: the browser's print dialog, where "Save as PDF" is available everywhere. */
  function printQuote(q) {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(frame);
    const d = frame.contentDocument;
    d.open();
    d.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(q.filename)}</title>
      <link rel="stylesheet" href="${fontsHref(resolvedFonts(q.lang).families)}">
      <style>@page{size:A4;margin:0}html,body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}.qd{width:210mm!important;min-height:297mm!important}</style>
      </head><body>${quoteHtml(q)}</body></html>`);
    d.close();
    const go = () => { frame.contentWindow.focus(); frame.contentWindow.print(); setTimeout(() => frame.remove(), 60000); };
    (d.fonts ? d.fonts.ready : Promise.resolve()).then(() => setTimeout(go, 300));
  }

  // ---------- Excel ----------
  async function exportXlsx() {
    const q = quoteData();
    await loadScript('vendor/exceljs.min.js');
    const { r, st } = q;
    const cur = A.currency;
    const fmt = `#,##0.00 "${cur}"`;
    const P = argb(brand.primary), INK = argb(inkFor(brand.primary)), ACC = argb(brand.accent);
    const TINT = argb(mix(brand.primary, '#ffffff', 0.9));
    const fill = (c) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: c } });
    const align = q.rtl ? 'right' : 'left';
    const endAlign = q.rtl ? 'left' : 'right';

    const wb = new window.ExcelJS.Workbook();
    wb.creator = brand.name || 'Artwork Price Calculator';
    wb.created = new Date();

    // ----- Sheet 1: client quotation -----
    const LX = (k, sep = ' / ') => (q.ql.bi ? `${q.T(k)}${sep}${tr(k, q.ql.other)}` : q.T(k));
    const tpl = brand.template;
    const HEADFILL = tpl === 'banner' ? P : null;                 // minimal/elegant: plain header
    const HEADTXT = tpl === 'banner' ? INK : P;
    const THFILL = tpl === 'banner' ? P : tpl === 'elegant' ? TINT : null;
    const THTXT = tpl === 'banner' ? INK : P;
    const GRANDFILL = tpl === 'minimal' ? null : P;
    const GRANDTXT = tpl === 'minimal' ? P : INK;
    const ws = wb.addWorksheet(q.T('xQuote').slice(0, 31), {
      views: [{ rightToLeft: q.rtl, showGridLines: false }],
      pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } },
    });
    ws.columns = [{ width: 16 }, { width: 40 }, { width: 8 }, { width: 17 }, { width: 19 }];
    for (let i = 1; i <= 5; i++) {
      ws.getRow(i).height = i === 5 ? 6 : 22;
      for (let c = 1; c <= 5; c++) { const f0 = i === 5 ? ACC : HEADFILL; if (f0) ws.getCell(i, c).fill = fill(f0); }
    }
    if (brand.logo) {
      const [w, h] = await imgSize(brand.logo);
      const hh = 82, ww = Math.min(125, (w / h) * hh);
      const id = wb.addImage({ base64: brand.logo, extension: 'png' });
      ws.addImage(id, { tl: { col: 0.1, row: 0.15 }, ext: { width: ww, height: Math.min(hh, (h / w) * ww) }, editAs: 'oneCell' });
    }
    const hc = (addr, value, font) => { const c = ws.getCell(addr); c.value = value; c.font = Object.assign({ color: { argb: HEADTXT } }, font); return c; };
    hc('B2', brand.name || '', { size: 18, bold: true }).alignment = { horizontal: align };
    hc('B3', brand.showTagline ? brand.tagline || '' : '', { size: 11 }).alignment = { horizontal: align };
    // Column A is the "start" side in both directions (Excel mirrors columns in RTL view).
    hc('E2', q.ql.bi && !brand.titleText ? LX('qTitle') : q.docTitle, { size: 16, bold: true }).alignment = { horizontal: endAlign };
    hc('E3', `${q.T('qNo')} ${q.quoteNo}`, { size: 11 }).alignment = { horizontal: endAlign };

    let row = 7;
    [brand.showClient && [LX('qBillTo', '\n'), st.client || '—'], [LX('qDate', '\n'), q.today], brand.showValidity && [LX('qValid', '\n'), q.valid]].filter(Boolean).forEach(([k, v]) => {
      ws.getCell(row, 1).value = k; ws.getCell(row, 1).font = { color: { argb: 'FF7A6F62' }, size: 10 };
      ws.getCell(row, 1).alignment = { wrapText: true, vertical: 'middle' }; ws.getCell(row, 2).alignment = { vertical: 'middle' };
      if (q.ql.bi) ws.getRow(row).height = 30;
      ws.getCell(row, 2).value = v; ws.getCell(row, 2).font = { bold: true, size: 12 };
      row++;
    });
    row++;
    // items header
    ws.mergeCells(row, 1, row, 2);
    [[1, LX('qDesc', '\n')], [3, LX('qQty', '\n')], [4, LX('qUnit', '\n')], [5, LX('qAmount', '\n')]].forEach(([c, v]) => {
      const cell = ws.getCell(row, c); cell.value = v; cell.font = { bold: true, color: { argb: THTXT } };
      cell.alignment = { wrapText: true, horizontal: c === 3 ? 'center' : c >= 4 ? endAlign : align, vertical: 'middle' };
    });
    for (let c = 1; c <= 5; c++) {
      const cell = ws.getCell(row, c);
      if (THFILL) cell.fill = fill(THFILL); else cell.border = { bottom: { style: 'medium', color: { argb: P } } };
    }
    ws.getRow(row).height = q.ql.bi ? 34 : 24;
    row++;
    ws.mergeCells(row, 1, row, 2);
    const desc = ws.getCell(row, 1);
    desc.value = { richText: [{ text: q.title + '\n', font: { bold: true, size: 13 } },
      ...(q.altTitle ? [{ text: q.altTitle + '\n', font: { bold: true, size: 11, color: { argb: 'FF7A6F62' } } }] : []),
      { text: q.lines.join('\n'), font: { size: 10, color: { argb: 'FF5C5246' } } }] };
    desc.alignment = { wrapText: true, vertical: 'top', horizontal: align };
    ws.getCell(row, 3).value = r.quantity; ws.getCell(row, 3).alignment = { horizontal: 'center', vertical: 'top' };
    const unit = ws.getCell(row, 4); unit.value = r.price; unit.numFmt = fmt; unit.alignment = { horizontal: endAlign, vertical: 'top' };
    const amt = ws.getCell(row, 5); amt.value = { formula: `C${row}*D${row}`, result: r.subtotal }; amt.numFmt = fmt;
    amt.alignment = { horizontal: endAlign, vertical: 'top' }; amt.font = { bold: true };
    ws.getRow(row).height = 18 * (q.lines.length + (q.altTitle ? 2 : 1)) + 8;
    for (let c = 1; c <= 5; c++) ws.getCell(row, c).border = { bottom: { style: 'thin', color: { argb: 'FFE6DDCF' } } };
    const itemRow = row;
    row += 2;

    const totalRow = (label, value, grand) => {
      ws.mergeCells(row, 2, row, 4);
      const l = ws.getCell(row, 2); l.value = label; l.alignment = { horizontal: endAlign };
      const v = ws.getCell(row, 5); v.value = value; v.numFmt = fmt; v.alignment = { horizontal: endAlign };
      v.font = { bold: true };
      if (grand) {
        [l, v].forEach((c) => {
          if (GRANDFILL) c.fill = fill(GRANDFILL); else c.border = { top: { style: 'medium', color: { argb: P } } };
          c.font = { bold: true, size: 13, color: { argb: GRANDTXT } };
        });
        if (GRANDFILL) { ws.getCell(row, 3).fill = fill(GRANDFILL); ws.getCell(row, 4).fill = fill(GRANDFILL); }
        ws.getRow(row).height = 24;
      }
      return row++;
    };
    const subRow = totalRow(LX('qSubtotal'), { formula: `E${itemRow}`, result: r.subtotal });
    const parts = [`E${subRow}`];
    if (st.vatPct > 0) parts.push(`E${totalRow(`${LX('qVat')} (${A.n2(+st.vatPct)}%)`, { formula: `E${subRow}*${(+st.vatPct) / 100}`, result: r.vat })}`);
    if (q.shipping > 0) parts.push(`E${totalRow(LX('qShipping'), q.shipping)}`);
    totalRow(LX('qTotal'), { formula: parts.join('+'), result: r.buyerTotal }, true);
    if (st.shippingMode === 'included') { ws.getCell(row, 5).value = '✓ ' + q.T('qShipIncluded'); ws.getCell(row, 5).alignment = { horizontal: endAlign }; ws.getCell(row, 5).font = { size: 10, color: { argb: 'FF7A6F62' } }; row++; }
    row++;

    if (brand.showNotes && brand.terms) {
      const h = ws.getCell(row, 1); h.value = LX('qNotes'); h.font = { bold: true, color: { argb: P }, size: 10 }; row++;
      ws.mergeCells(row, 1, row, 5);
      const n = ws.getCell(row, 1); n.value = brand.terms; n.alignment = { wrapText: true, vertical: 'top', horizontal: align };
      n.fill = fill(TINT); n.border = { [q.rtl ? 'right' : 'left']: { style: 'thick', color: { argb: ACC } } };
      ws.getRow(row).height = Math.max(30, 16 * Math.ceil(brand.terms.length / 85) + 10);
      row += 2;
    }
    ws.mergeCells(row, 1, row, 5);
    const f = ws.getCell(row, 1);
    f.value = [q.contact.join('   ·   '), q.thanks].filter(Boolean).join('\n');
    f.font = { size: 10, color: { argb: P } }; f.alignment = { wrapText: true, horizontal: 'center' };
    f.border = { top: { style: 'thick', color: { argb: ACC } } };
    ws.getRow(row).height = 34;

    // ----- Sheet 2: internal cost breakdown -----
    const cs = wb.addWorksheet(t('xCosts'), {
      views: [{ rightToLeft: q.rtl, state: 'frozen', ySplit: 1 }],
      pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    cs.columns = [{ width: 18 }, { width: 36 }, { width: 12 }, { width: 16 }, { width: 18 }];
    const hdr = cs.addRow([t('xSection'), t('xItem'), t('qty'), t('unitCost'), t('qAmount')]);
    hdr.eachCell((c) => { c.fill = fill(P); c.font = { bold: true, color: { argb: INK } }; });
    const sectionRows = [];
    const addLine = (sec, name, qty, unit) => {
      const rr = cs.addRow([sec, name, qty, unit]);
      const n = rr.number;
      rr.getCell(5).value = { formula: `C${n}*D${n}`, result: (+qty || 0) * (+unit || 0) };
      rr.getCell(4).numFmt = fmt; rr.getCell(5).numFmt = fmt;
      sectionRows.push(n);
    };
    st.materials.forEach((it) => addLine(t('cMaterials'), it.name, +it.qty || 0, +it.cost || 0));
    addLine(t('cLabor'), `${A.n2(+st.hours || 0)} ${t('hoursUnit')} × ${t('hourlyRate')}`, +st.hours || 0, +st.hourlyRate || 0);
    if (st.framed) {
      if (st.frame.mode === 'fixed') addLine(t('cFrame'), t('frameQuote'), 1, r.frame.total);
      else r.frame.lines.filter((l) => l.cost > 0).forEach((l) =>
        addLine(t('cFrame'), t('fl_' + l.key) + (l.unit ? ` (${l.unit})` : ''), +l.qty.toFixed(3), l.qty ? l.cost / l.qty : l.cost));
    }
    st.packaging.forEach((it) => addLine(t('cPackaging'), it.name, +it.qty || 0, +it.cost || 0));
    addLine(t('cOverhead'), t('cOverhead'), 1, r.overhead);
    const first = sectionRows[0], last = sectionRows[sectionRows.length - 1];
    const pc = cs.addRow(['', t('cTotal')]);
    pc.getCell(5).value = { formula: `SUM(E${first}:E${last})`, result: r.productionCost };
    pc.getCell(5).numFmt = fmt; pc.font = { bold: true };
    pc.eachCell((c) => { c.fill = fill(TINT); c.border = { top: { style: 'thin', color: { argb: P } } }; });
    cs.addRow([]);
    const kv = (label, value, isMoney = true, bold = false) => {
      const rr = cs.addRow(['', label, '', '', value]);
      if (isMoney) rr.getCell(5).numFmt = fmt;
      if (bold) rr.font = { bold: true };
    };
    if (r.quantity > 1) {
      kv(t('quantity'), r.quantity, false);
      kv(t('orderCost'), r.orderCost, true, true);
    }
    kv(t('mCostPlus'), r.methods.costPlus);
    kv(t('mSize'), r.methods.sizeBased);
    kv(t('qUnit'), r.price);
    kv(t('qSubtotal'), r.subtotal, true, true);
    if (r.commission) kv(`${t('sCommission')} (${A.n2(+st.commissionPct)}%)`, r.commission);
    if (r.paymentFee) kv(`${t('sFees')} (${A.n2(+st.paymentFeePct)}%)`, r.paymentFee);
    if (r.deliveryBorneByArtist) kv(t('sDelivery'), r.deliveryBorneByArtist);
    if (r.vat) kv(t('qVat'), r.vat);
    if (r.shippingCharge) kv(t('kShipping'), r.shippingCharge + r.shippingVat);
    kv(t('buyerPays'), r.buyerTotal, true, true);
    kv(t('sProfit'), r.profit, true, true);
    kv(t('kMargin'), r.marginPct / 100, false);
    cs.lastRow.getCell(5).numFmt = '0.0%';
    if (r.effectiveHourly != null) kv(t('kHourly'), r.effectiveHourly);

    const fonts = resolvedFonts(q.lang);
    if (brand.bodyFont !== 'auto' || brand.headFont !== 'auto') {
      wb.eachSheet((sheet) => sheet.eachRow((rw) => rw.eachCell((c) => {
        const head = sheet === ws && (c.address === 'B2' || c.address === 'E2');
        c.font = Object.assign({}, c.font, { name: head ? fonts.head : fonts.body });
      })));
    }

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = q.filename + '.xlsx';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // expose for tests
  window.ArtQuote = { brand, quoteHtml, quoteData, exportPdf, exportXlsx };

  fillFontSelects();
  writeBrandForm();
  applyTheme();
  bind();
})();
