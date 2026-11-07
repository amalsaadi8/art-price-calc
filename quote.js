/* Brand settings, app theming, and PDF / Excel quotation export. */
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

  const brand = Object.assign({
    name: '', tagline: '', logo: '', primary: '#8a5a2b', accent: '#b8892f', applyToApp: false,
    phone: '', email: '', website: '', instagram: '', terms: null, validDays: 14,
    pdfBreakdown: false, nextNo: 1001,
  }, load());
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

  // ---------- brand form ----------
  function writeBrandForm() {
    $$('[data-b]').forEach((el) => {
      const v = brand[el.dataset.b];
      if (el.type === 'checkbox') el.checked = !!v; else el.value = v ?? '';
    });
    $$('[data-code]').forEach((el) => { el.textContent = brand[el.dataset.code]; });
    $('#logoPreview').innerHTML = brand.logo ? `<img src="${brand.logo}" alt="">` : '<span>LOGO</span>';
    $('#logoRemove').hidden = !brand.logo;
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

  function bind() {
    const onInput = (e) => {
      const el = e.target; if (!el.dataset.b) return;
      brand[el.dataset.b] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? parseFloat(el.value) || 0 : el.value;
      const code = $(`[data-code="${el.dataset.b}"]`); if (code) code.textContent = el.value;
      save(); applyTheme();
    };
    document.addEventListener('input', onInput);
    document.addEventListener('change', onInput);

    $('#logoFile').addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try { brand.logo = await fileToPng(file, 480); save(); writeBrandForm(); applyTheme(); }
      catch { alert(t('logoTooBig')); }
      e.target.value = '';
    });
    $('#logoRemove').addEventListener('click', () => { brand.logo = ''; save(); writeBrandForm(); applyTheme(); });

    $('#pdfBtn').addEventListener('click', (e) => run(e.currentTarget, exportPdf));
    $('#xlsxBtn').addEventListener('click', (e) => run(e.currentTarget, exportXlsx));
    A.onLang.push(() => { applyTheme(); });
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

  function quoteData() {
    const st = A.state;
    if (!st.quoteNo) {
      const no = `Q-${new Date().getFullYear()}-${brand.nextNo++}`;
      save(); A.setField('quoteNo', no);
    }
    const r = A.result();
    const lang = A.lang;
    const fmtDate = (d) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en-GB',
      { calendar: 'gregory', numberingSystem: 'latn', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
    const today = new Date();
    const valid = new Date(today.getTime() + (brand.validDays || 14) * 86400000);
    const medium = { calligraphy: 'mCalligraphy', oil: 'mOil', acrylic: 'mAcrylic', watercolor: 'mWatercolor' }[st.medium];
    const support = { paper: 'sPaper', canvas: 'sCanvas', panel: 'sPanel' }[st.support];
    const cm = lang === 'ar' ? 'سم' : 'cm';
    const lines = [`${t(medium)} ${t('qOn')} ${t(support)}`, `${t('qSize')}: ${A.n2(r.width)} × ${A.n2(r.height)} ${cm}`];
    if (st.framed) {
      const extras = [];
      if (st.frame.mode === 'calc') {
        if (st.frame.glazing !== 'none') { const g = t({ glass: 'gGlass', acrylic: 'gAcrylic', museum: 'gMuseum' }[st.frame.glazing]); extras.push(lang === 'en' ? g.toLowerCase() : g); }
        if (st.frame.mat) extras.push(t('qMatShort'));
      }
      lines.push(t('qFramed') + (extras.length ? ` ${t('qWith')} ${extras.join(', ')}` : '') +
        (st.frame.mode === 'calc' ? ` · ${t('qFramedSize')} ${A.n2(r.frame.outerW)} × ${A.n2(r.frame.outerH)} ${cm}` : ''));
    }
    const contact = [brand.phone, brand.email, brand.website, brand.instagram && (brand.instagram.startsWith('@') ? brand.instagram : '@' + brand.instagram)].filter(Boolean);
    // ASCII-only filenames download reliably in every browser.
    const safe = (s) => String(s || '').normalize('NFKD').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return {
      st, r, lang, rtl: lang === 'ar', today: fmtDate(today), valid: fmtDate(valid),
      title: st.name || t('untitled'), lines, contact,
      filename: ['Quote', safe(st.quoteNo), safe(st.name)].filter(Boolean).join('_'),
      shipping: r.shippingCharge + r.shippingVat,
    };
  }

  // ---------- PDF ----------
  function quoteHtml(q) {
    const { r, st } = q;
    const P = brand.primary, ink = inkFor(P), tint = mix(P, '#ffffff', 0.9), Acc = brand.accent;
    const m = (v) => `<bdi dir="ltr">${esc(A.money(v))}</bdi>`;
    const font = q.rtl ? "'Noto Kufi Arabic', 'Inter', sans-serif" : "'Inter', 'Noto Kufi Arabic', sans-serif";
    const trow = (label, val, strong) => `<tr${strong ? ' class="grand"' : ''}><td>${label}</td><td>${val}</td></tr>`;
    let totals = trow(t('qSubtotal'), m(r.price));
    if (st.vatPct > 0) totals += trow(`${t('qVat')} (${A.n2(+st.vatPct)}%)`, m(r.vat));
    if (q.shipping > 0) totals += trow(t('qShipping'), m(q.shipping));
    totals += trow(t('qTotal'), m(r.buyerTotal), true);

    let internal = '';
    if (brand.pdfBreakdown) {
      const rows = [
        [t('cMaterials'), r.materials], [t('cLabor'), r.labor], [t('cFrame'), r.frame.total],
        [t('cPackaging'), r.packaging], [t('cOverhead'), r.overhead], [t('cTotal'), r.productionCost],
        [t('sCommission'), r.commission], [t('sFees'), r.paymentFee], [t('sProfit'), r.profit],
      ].filter(([, v], i) => v || i === 5 || i === 8);
      internal = `<div class="qd-internal"><h3>${t('qInternal')}</h3><table>${rows.map(([a, b]) => `<tr><td>${a}</td><td>${m(b)}</td></tr>`).join('')}
        <tr><td>${t('kMargin')}</td><td>${A.n2(r.marginPct)}%</td></tr></table></div>`;
    }

    return `
<div class="qd" dir="${q.rtl ? 'rtl' : 'ltr'}" lang="${q.lang}">
<style>
  .qd{width:794px;min-height:1120px;background:#fff;color:#1f1a14;font-family:${font};font-size:13px;line-height:1.55;display:flex;flex-direction:column;box-sizing:border-box}
  .qd *{box-sizing:border-box}
  .qd-head{background:${P};color:${ink};padding:34px 48px 30px;display:flex;justify-content:space-between;align-items:center;gap:24px}
  .qd-brand{display:flex;align-items:center;gap:16px}
  .qd-brand img{max-height:72px;max-width:150px;background:#fff;border-radius:8px;padding:6px}
  .qd-name{font-size:24px;font-weight:700;line-height:1.2}
  .qd-tag{opacity:.85;font-size:13px}
  .qd-title{text-align:end}
  .qd-h{font-size:28px;font-weight:700;line-height:1.2${q.rtl ? '' : ';letter-spacing:.04em;text-transform:uppercase'}}
  .qd-bar{height:6px;background:${Acc}}
  .qd-body{padding:32px 48px;flex:1}
  .qd-meta{display:flex;justify-content:space-between;gap:24px;margin-bottom:28px}
  .qd-meta .lbl{font-size:11px;color:#7a6f62${q.rtl ? '' : ';text-transform:uppercase;letter-spacing:.06em'}}
  .qd-meta .val{font-size:15px;font-weight:600}
  .qd-items{width:100%;border-collapse:collapse;margin-bottom:20px}
  .qd-items th{background:${P};color:${ink};font-weight:600;padding:10px 14px;text-align:start;font-size:12px}
  .qd-items th:last-child,.qd-items td:last-child{text-align:end;white-space:nowrap}
  .qd-items th:nth-child(2),.qd-items td:nth-child(2){text-align:center;width:60px}
  .qd-items td{padding:16px 14px;border-bottom:1px solid #e6ddcf;vertical-align:top}
  .qd-items .t{font-size:16px;font-weight:700;margin-bottom:4px}
  .qd-items .d{color:#5c5246}
  .qd-totals{margin-inline-start:auto;width:340px;border-collapse:collapse}
  .qd-totals td{padding:7px 14px}
  .qd-totals td:last-child{text-align:end;white-space:nowrap;font-weight:600}
  .qd-totals tr.grand td{background:${P};color:${ink};font-size:17px;font-weight:700;padding:12px 14px}
  .qd-ship{color:#7a6f62;font-size:12px;text-align:end;margin-top:6px}
  .qd-notes{margin-top:30px;background:${tint};border-inline-start:4px solid ${Acc};padding:14px 18px;border-radius:6px;white-space:pre-wrap}
  .qd-notes h3,.qd-internal h3{margin:0 0 6px;font-size:12px;color:${P}${q.rtl ? '' : ';text-transform:uppercase;letter-spacing:.06em'}}\n  .qd bdi{unicode-bidi:isolate}\n  .qd [dir=auto]{text-align:${q.rtl ? 'right' : 'left'}}
  .qd-internal{margin-top:24px;border:1px dashed #c9bba8;border-radius:6px;padding:14px 18px}
  .qd-internal table{width:100%;border-collapse:collapse}
  .qd-internal td{padding:3px 0;border-bottom:1px dotted #e6ddcf}
  .qd-internal td:last-child{text-align:end}
  .qd-foot{border-top:4px solid ${Acc};padding:16px 48px 22px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;font-size:12px;color:#5c5246}
  .qd-foot .c span{margin-inline-end:16px;white-space:nowrap;direction:ltr;unicode-bidi:isolate}
  .qd-foot .th{color:${P};font-weight:600}
</style>
  <div class="qd-head">
    <div class="qd-brand">
      ${brand.logo ? `<img src="${brand.logo}" alt="">` : ''}
      <div>${brand.name ? `<div class="qd-name" dir="auto">${esc(brand.name)}</div>` : ''}${brand.tagline ? `<div class="qd-tag" dir="auto">${esc(brand.tagline)}</div>` : ''}</div>
    </div>
    <div class="qd-title"><div class="qd-h">${t('qTitle')}</div><div>${t('qNo')} <bdi dir="ltr">${esc(st.quoteNo)}</bdi></div></div>
  </div>
  <div class="qd-bar"></div>
  <div class="qd-body">
    <div class="qd-meta">
      <div><div class="lbl">${t('qBillTo')}</div><div class="val" dir="auto">${esc(st.client) || '—'}</div></div>
      <div><div class="lbl">${t('qDate')}</div><div class="val">${q.today}</div></div>
      <div><div class="lbl">${t('qValid')}</div><div class="val">${q.valid}</div></div>
    </div>
    <table class="qd-items">
      <tr><th>${t('qDesc')}</th><th>${t('qQty')}</th><th>${t('qAmount')}</th></tr>
      <tr><td><div class="t" dir="auto">${esc(q.title)}</div><div class="d">${q.lines.map((l) => esc(l).replace(/([\d.,]+ × [\d.,]+ cm)/g, '<bdi dir="ltr">$1</bdi>')).join('<br>')}</div></td><td>1</td><td>${m(r.price)}</td></tr>
    </table>
    <table class="qd-totals">${totals}</table>
    ${st.shippingMode === 'included' ? `<div class="qd-ship">✓ ${t('qShipIncluded')}</div>` : ''}
    ${brand.terms ? `<div class="qd-notes"><h3>${t('qNotes')}</h3><div dir="auto">${esc(brand.terms)}</div></div>` : ''}
    ${internal}
  </div>
  <div class="qd-foot">
    <div class="c">${q.contact.map((c) => `<span>${esc(c)}</span>`).join('')}</div>
    <div class="th">${t('qThanks')}</div>
  </div>
</div>`;
  }

  // Google Fonts embedded as data URLs so the quote renders in the app's fonts.
  // Falls back silently to system fonts when offline.
  let fontCssPromise;
  function embeddedFonts() {
    if (!fontCssPromise) {
      fontCssPromise = (async () => {
        const css = await (await fetch('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Noto+Kufi+Arabic:wght@400;600;700&display=block')).text();
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
    return Promise.race([fontCssPromise, new Promise((r) => setTimeout(() => r(''), 8000))]);
  }

  /** Render the quote with the browser's own engine (perfect Arabic shaping) via SVG foreignObject. */
  async function renderQuote(q) {
    const W = 794, PAGE_H = 1123, SCALE = 2;
    const fontCss = await embeddedFonts();
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
    g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
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
    pdf.setProperties({ title: `${t('qTitle')} ${q.st.quoteNo}`, author: brand.name || '', creator: 'Artwork Price Calculator' });
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
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Noto+Kufi+Arabic:wght@400;600;700&display=swap">
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
    const ws = wb.addWorksheet(t('xQuote'), {
      views: [{ rightToLeft: q.rtl, showGridLines: false }],
      pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } },
    });
    ws.columns = [{ width: 18 }, { width: 46 }, { width: 8 }, { width: 20 }];
    for (let i = 1; i <= 5; i++) {
      ws.getRow(i).height = i === 5 ? 6 : 22;
      for (let c = 1; c <= 4; c++) ws.getCell(i, c).fill = fill(i === 5 ? ACC : P);
    }
    if (brand.logo) {
      const [w, h] = await imgSize(brand.logo);
      const hh = 82, ww = Math.min(125, (w / h) * hh);
      const id = wb.addImage({ base64: brand.logo, extension: 'png' });
      ws.addImage(id, { tl: { col: 0.1, row: 0.15 }, ext: { width: ww, height: Math.min(hh, (h / w) * ww) }, editAs: 'oneCell' });
    }
    const hc = (addr, value, font) => { const c = ws.getCell(addr); c.value = value; c.font = Object.assign({ color: { argb: INK } }, font); return c; };
    hc('B2', brand.name || '', { size: 18, bold: true }).alignment = { horizontal: align };
    hc('B3', brand.tagline || '', { size: 11 }).alignment = { horizontal: align };
    // Column A is the "start" side in both directions (Excel mirrors columns in RTL view).
    hc('D2', t('qTitle'), { size: 16, bold: true }).alignment = { horizontal: endAlign };
    hc('D3', `${t('qNo')} ${st.quoteNo}`, { size: 11 }).alignment = { horizontal: endAlign };

    let row = 7;
    [[t('qBillTo'), st.client || '—'], [t('qDate'), q.today], [t('qValid'), q.valid]].forEach(([k, v]) => {
      ws.getCell(row, 1).value = k; ws.getCell(row, 1).font = { color: { argb: 'FF7A6F62' }, size: 10 };
      ws.getCell(row, 2).value = v; ws.getCell(row, 2).font = { bold: true, size: 12 };
      row++;
    });
    row++;
    // items header
    ws.mergeCells(row, 1, row, 2);
    [[1, t('qDesc')], [3, t('qQty')], [4, t('qAmount')]].forEach(([c, v]) => {
      const cell = ws.getCell(row, c); cell.value = v; cell.font = { bold: true, color: { argb: INK } };
      cell.alignment = { horizontal: c === 3 ? 'center' : c === 4 ? endAlign : align, vertical: 'middle' };
    });
    for (let c = 1; c <= 4; c++) ws.getCell(row, c).fill = fill(P);
    ws.getRow(row).height = 24;
    row++;
    ws.mergeCells(row, 1, row, 2);
    const desc = ws.getCell(row, 1);
    desc.value = { richText: [{ text: q.title + '\n', font: { bold: true, size: 13 } }, { text: q.lines.join('\n'), font: { size: 10, color: { argb: 'FF5C5246' } } }] };
    desc.alignment = { wrapText: true, vertical: 'top', horizontal: align };
    ws.getCell(row, 3).value = 1; ws.getCell(row, 3).alignment = { horizontal: 'center', vertical: 'top' };
    const amt = ws.getCell(row, 4); amt.value = r.price; amt.numFmt = fmt; amt.alignment = { horizontal: endAlign, vertical: 'top' };
    ws.getRow(row).height = 18 * (q.lines.length + 1) + 8;
    for (let c = 1; c <= 4; c++) ws.getCell(row, c).border = { bottom: { style: 'thin', color: { argb: 'FFE6DDCF' } } };
    const itemRow = row;
    row += 2;

    const totalRow = (label, value, grand) => {
      ws.mergeCells(row, 2, row, 3);
      const l = ws.getCell(row, 2); l.value = label; l.alignment = { horizontal: endAlign };
      const v = ws.getCell(row, 4); v.value = value; v.numFmt = fmt; v.alignment = { horizontal: endAlign };
      v.font = { bold: true };
      if (grand) {
        [l, v].forEach((c) => { c.fill = fill(P); c.font = { bold: true, size: 13, color: { argb: INK } }; });
        ws.getCell(row, 3).fill = fill(P); ws.getRow(row).height = 24;
      }
      return row++;
    };
    const subRow = totalRow(t('qSubtotal'), { formula: `D${itemRow}`, result: r.price });
    const parts = [`D${subRow}`];
    if (st.vatPct > 0) parts.push(`D${totalRow(`${t('qVat')} (${A.n2(+st.vatPct)}%)`, { formula: `D${subRow}*${(+st.vatPct) / 100}`, result: r.vat })}`);
    if (q.shipping > 0) parts.push(`D${totalRow(t('qShipping'), q.shipping)}`);
    totalRow(t('qTotal'), { formula: parts.join('+'), result: r.buyerTotal }, true);
    if (st.shippingMode === 'included') { ws.getCell(row, 4).value = '✓ ' + t('qShipIncluded'); ws.getCell(row, 4).alignment = { horizontal: endAlign }; ws.getCell(row, 4).font = { size: 10, color: { argb: 'FF7A6F62' } }; row++; }
    row++;

    if (brand.terms) {
      const h = ws.getCell(row, 1); h.value = t('qNotes'); h.font = { bold: true, color: { argb: P }, size: 10 }; row++;
      ws.mergeCells(row, 1, row, 4);
      const n = ws.getCell(row, 1); n.value = brand.terms; n.alignment = { wrapText: true, vertical: 'top', horizontal: align };
      n.fill = fill(TINT); n.border = { [q.rtl ? 'right' : 'left']: { style: 'thick', color: { argb: ACC } } };
      ws.getRow(row).height = Math.max(30, 16 * Math.ceil(brand.terms.length / 85) + 10);
      row += 2;
    }
    ws.mergeCells(row, 1, row, 4);
    const f = ws.getCell(row, 1);
    f.value = [q.contact.join('   ·   '), t('qThanks')].filter(Boolean).join('\n');
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
    kv(t('mCostPlus'), r.methods.costPlus);
    kv(t('mSize'), r.methods.sizeBased);
    kv(t('qSubtotal'), r.price, true, true);
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

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = q.filename + '.xlsx';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // expose for tests
  window.ArtQuote = { brand, quoteHtml, quoteData, exportPdf, exportXlsx };

  writeBrandForm();
  applyTheme();
  bind();
})();
