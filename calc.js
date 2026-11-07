/*
 * Artwork pricing engine — pure functions, no DOM.
 * Works in the browser (window.ArtCalc) and in Node (module.exports).
 *
 * All dimensions are in centimetres, all money in the user's currency.
 */
(function (root) {
  'use strict';

  const num = (v, d = 0) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : d;
  };
  const pct = (v) => num(v) / 100;
  const sum = (items) => (items || []).reduce((t, i) => t + num(i.cost) * num(i.qty, 1), 0);

  /** Round up to the nearest step (0 or blank = round to 2 decimals). */
  function roundUp(value, step) {
    step = num(step);
    if (step <= 0) return Math.ceil(value * 100 - 1e-6) / 100;
    return Math.ceil(value / step - 1e-9) * step;
  }

  /**
   * Frame cost from dimensions.
   * Moulding is sold per metre; mitred corners waste ~8 × moulding width,
   * plus a waste allowance. Glazing, mat and backing are priced per m².
   */
  function frameCost(width, height, f) {
    f = f || {};
    if (f.mode === 'fixed') {
      return { total: num(f.fixedCost), outerW: width, outerH: height, lines: [] };
    }
    const mat = f.mat ? num(f.matWidth) : 0;
    const innerW = width + 2 * mat;            // opening the moulding wraps
    const innerH = height + 2 * mat;
    const mw = num(f.mouldingWidth);
    const outerW = innerW + 2 * mw;
    const outerH = innerH + 2 * mw;

    const mouldingM = ((2 * (innerW + innerH) + 8 * mw) * (1 + pct(f.wastePct))) / 100;
    const areaM2 = (innerW * innerH) / 10000;

    const lines = [
      { key: 'moulding', qty: mouldingM, unit: 'm', cost: mouldingM * num(f.mouldingPerM) },
      { key: 'glazing', qty: areaM2, unit: 'm²', cost: f.glazing === 'none' ? 0 : areaM2 * num(f.glazingPerM2) },
      { key: 'mat', qty: f.mat ? areaM2 : 0, unit: 'm²', cost: f.mat ? areaM2 * num(f.matPerM2) : 0 },
      { key: 'backing', qty: areaM2, unit: 'm²', cost: areaM2 * num(f.backingPerM2) },
      { key: 'fitting', qty: 1, unit: '', cost: num(f.fittingCost) },
    ];
    return { total: lines.reduce((t, l) => t + l.cost, 0), outerW, outerH, lines };
  }

  /**
   * Main calculation.
   * Returns every intermediate figure so the UI can show a full breakdown.
   */
  function calculate(input) {
    const i = input || {};
    const w = num(i.width);
    const h = num(i.height);
    const areaCm2 = w * h;

    // ---- direct costs --------------------------------------------------
    const materials = sum(i.materials);
    const labor = num(i.hours) * num(i.hourlyRate);
    const frame = i.framed ? frameCost(w, h, i.frame) : { total: 0, outerW: w, outerH: h, lines: [] };
    const packaging = sum(i.packaging);
    const overhead = num(i.overhead);
    const productionCost = materials + labor + frame.total + packaging + overhead;

    // ---- pricing methods (net amount the artist should receive) --------
    const costPlus = productionCost * (1 + pct(i.markupPct));

    const sizeUnits = i.sizeMode === 'linear' ? w + h : areaCm2;
    const sizeArtValue = sizeUnits * num(i.sizeRate) * num(i.complexity, 1);
    // Size-based rate replaces labour + profit; physical costs pass through.
    const sizeBased = sizeArtValue + materials + frame.total + packaging + overhead;

    let net;
    switch (i.method) {
      case 'size': net = sizeBased; break;
      case 'cost': net = costPlus; break;
      default: net = Math.max(costPlus, sizeBased); // 'higher'
    }
    const minimum = num(i.minimumPrice);
    const raisedToMinimum = minimum > 0 && net < minimum;
    if (raisedToMinimum) net = minimum;

    // ---- selling price: gross-up for commission, fees, insurance -------
    const c = pct(i.commissionPct);
    const f = pct(i.paymentFeePct);
    const ins = pct(i.insurancePct);
    const deliveryCost = num(i.deliveryCost);
    const shippingIncluded = i.shippingMode === 'included';

    // Quantity: copies of the same piece. Per-piece costs scale; delivery is one shipment per order.
    const quantity = Math.max(1, Math.round(num(i.quantity, 1)));

    // When shipping is included, delivery + insurance (a % of price) come out of the price.
    const deductions = c + f + (shippingIncluded ? ins : 0);
    const invalid = deductions >= 1;
    const rawPrice = invalid
      ? NaN
      : (net + (shippingIncluded ? deliveryCost / quantity : 0)) / (1 - deductions);

    const price = invalid ? NaN : roundUp(rawPrice, i.roundTo); // pre-tax price per piece
    const subtotal = price * quantity;                            // pre-tax order value
    const insurance = subtotal * ins;
    const commission = subtotal * c;
    const paymentFee = subtotal * f;

    const vatRate = pct(i.vatPct);
    const vat = subtotal * vatRate;
    const priceWithVat = price * (1 + vatRate);                   // per piece
    const subtotalWithVat = subtotal + vat;

    const shippingCharge = shippingIncluded ? 0 : deliveryCost + insurance;
    const shippingVat = shippingCharge * vatRate;
    const buyerTotal = subtotalWithVat + shippingCharge + shippingVat;

    const deliveryBorneByArtist = shippingIncluded ? deliveryCost + insurance : 0;
    const orderCost = productionCost * quantity;
    const profit = subtotal - commission - paymentFee - orderCost - deliveryBorneByArtist;
    const hours = num(i.hours) * quantity;
    const takeHome = profit + labor * quantity; // what you earn for your time + profit

    return {
      width: w, height: h, areaCm2, quantity,
      materials, labor, frame, packaging, overhead, productionCost, orderCost,
      methods: { costPlus, sizeBased, sizeArtValue, chosen: net, raisedToMinimum },
      price, rawPrice, subtotal, commission, paymentFee, insurance,
      vat, priceWithVat, subtotalWithVat, shippingCharge, shippingVat, buyerTotal,
      deliveryCost, deliveryBorneByArtist,
      profit,
      marginPct: subtotal > 0 ? (profit / subtotal) * 100 : 0,
      effectiveHourly: hours > 0 ? takeHome / hours : null,
      pricePerCm2: areaCm2 > 0 ? price / areaCm2 : null,
      invalid,
    };
  }

  const api = { calculate, frameCost, roundUp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ArtCalc = api;
})(typeof window !== 'undefined' ? window : globalThis);
