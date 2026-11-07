const test = require('node:test');
const assert = require('node:assert/strict');
const { calculate, frameCost, roundUp } = require('../calc.js');

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

const base = {
  width: 50, height: 70, materials: [{ cost: 10, qty: 2 }], hours: 10, hourlyRate: 50,
  overhead: 20, framed: false, packaging: [{ cost: 5, qty: 1 }], shippingMode: 'separate',
  deliveryCost: 30, insurancePct: 0, method: 'cost', markupPct: 50, sizeMode: 'area',
  sizeRate: 0.1, complexity: 1, commissionPct: 0, paymentFeePct: 0, vatPct: 0, roundTo: 0,
};

test('roundUp', () => {
  assert.equal(roundUp(101, 10), 110);
  assert.equal(roundUp(110, 10), 110);
  assert.equal(roundUp(12.345, 0), 12.35);
});

test('cost-plus with no fees', () => {
  const r = calculate(base);
  close(r.productionCost, 20 + 500 + 5 + 20);
  close(r.price, 545 * 1.5);
  close(r.profit, 545 * 0.5);
  close(r.buyerTotal, 545 * 1.5 + 30);
});

test('commission and fees are grossed up so net is preserved', () => {
  const r = calculate({ ...base, commissionPct: 40, paymentFeePct: 3 });
  close(r.price - r.commission - r.paymentFee, 545 * 1.5, 0.01);
  assert.ok(r.profit >= 545 * 0.5 - 1e-9 && r.profit < 545 * 0.5 + 0.01);
});

test('free shipping folds delivery and insurance into the price', () => {
  const r = calculate({ ...base, shippingMode: 'included', insurancePct: 1 });
  assert.equal(r.shippingCharge, 0);
  close(r.price - r.deliveryCost - r.insurance, 545 * 1.5, 0.01);
  assert.ok(r.profit >= 545 * 0.5 - 1e-9 && r.profit < 545 * 0.5 + 0.01);
});

test('size-based passes physical costs through', () => {
  const r = calculate({ ...base, method: 'size', complexity: 1.5 });
  close(r.methods.sizeArtValue, 3500 * 0.1 * 1.5);
  close(r.price, 525 + 20 + 5 + 20);
  const lin = calculate({ ...base, method: 'size', sizeMode: 'linear', sizeRate: 2 });
  close(lin.methods.sizeArtValue, 240);
});

test('higher-of-both and minimum floor', () => {
  const r = calculate({ ...base, method: 'higher', sizeRate: 1 });
  close(r.methods.chosen, Math.max(r.methods.costPlus, r.methods.sizeBased));
  const m = calculate({ ...base, minimumPrice: 5000 });
  assert.ok(m.methods.raisedToMinimum);
  close(m.price, 5000);
});

test('VAT on artwork and shipping', () => {
  const r = calculate({ ...base, vatPct: 15 });
  close(r.vat, r.price * 0.15);
  close(r.buyerTotal, r.price * 1.15 + 30 * 1.15);
});

test('frame from dimensions', () => {
  const f = frameCost(50, 70, {
    mode: 'calc', mouldingPerM: 10, mouldingWidth: 3, glazing: 'glass', glazingPerM2: 100,
    mat: true, matWidth: 5, matPerM2: 20, backingPerM2: 10, fittingCost: 15, wastePct: 0,
  });
  // opening 60 x 80, moulding (2*140 + 24) cm = 3.04 m
  close(f.lines[0].qty, 3.04);
  close(f.total, 30.4 + 48 + 9.6 + 4.8 + 15);
  close(f.outerW, 66); close(f.outerH, 86);
  assert.equal(frameCost(50, 70, { mode: 'fixed', fixedCost: 120 }).total, 120);
});

test('invalid when deductions reach 100%', () => {
  const r = calculate({ ...base, commissionPct: 60, paymentFeePct: 40 });
  assert.ok(r.invalid);
});

test('quantity: per-piece costs scale, delivery is per order', () => {
  const one = calculate(base);
  const r = calculate({ ...base, quantity: 3, vatPct: 5 });
  assert.equal(r.quantity, 3);
  close(r.price, one.price);
  close(r.subtotal, one.price * 3);
  close(r.vat, r.subtotal * 0.05);
  close(r.buyerTotal, r.subtotal * 1.05 + 30 * 1.05);
  close(r.profit, 545 * 0.5 * 3);
  // free shipping spreads one delivery over all pieces
  const inc = calculate({ ...base, quantity: 3, shippingMode: 'included' });
  close(inc.subtotal - inc.deliveryCost, 545 * 1.5 * 3, 0.03);
  assert.equal(calculate({ ...base, quantity: 0 }).quantity, 1);
});
