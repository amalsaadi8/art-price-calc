/* Installable app (PWA) + mobile-friendly file delivery (share sheet / download). */
(function () {
  'use strict';
  const t = (k) => (window.ArtApp ? window.ArtApp.t(k) : k);
  const $ = (s) => document.querySelector(s);

  // ---------- offline / install ----------
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const btn = $('#installBtn');
  let deferred = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferred = e;
    if (!standalone()) btn.hidden = false;
  });
  window.addEventListener('appinstalled', () => { btn.hidden = true; deferred = null; });
  if (isIOS && !standalone()) btn.hidden = false; // iOS has no install prompt: show instructions instead

  btn.addEventListener('click', async () => {
    if (deferred) {
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') btn.hidden = true;
      deferred = null;
    } else {
      $('#installHelp').showModal();
    }
  });
  $('#installHelpClose').addEventListener('click', () => $('#installHelp').close());

  // ---------- deliver exported files ----------
  const coarse = () => matchMedia('(pointer: coarse)').matches;
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  }
  async function share(file) {
    await navigator.share({ files: [file], title: file.name });
  }

  /**
   * On phones/tablets: open the share sheet (WhatsApp, Mail, Save to Files…).
   * If the browser needs a fresh tap (file took a moment to build), show a "ready" bar.
   * On computers: normal download.
   */
  async function deliver(blob, name) {
    const file = new File([blob], name, { type: blob.type });
    const canShare = coarse() && navigator.canShare && navigator.canShare({ files: [file] });
    if (!canShare) return download(blob, name);
    try { await share(file); }
    catch (err) {
      if (err && err.name === 'AbortError') return; // user closed the share sheet
      showReady(file, blob);
    }
  }

  let readyTimer;
  function showReady(file, blob) {
    const bar = $('#readyBar');
    $('#readyName').textContent = file.name;
    bar.hidden = false;
    $('#readyShare').onclick = async () => { bar.hidden = true; try { await share(file); } catch (e) { if (e.name !== 'AbortError') download(blob, file.name); } };
    $('#readyDownload').onclick = () => { bar.hidden = true; download(blob, file.name); };
    $('#readyClose').onclick = () => { bar.hidden = true; };
    clearTimeout(readyTimer);
    readyTimer = setTimeout(() => { bar.hidden = true; }, 60000);
  }

  window.ArtShare = { deliver, download };
})();
