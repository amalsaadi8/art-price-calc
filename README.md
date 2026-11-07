# Artwork Price Calculator · حاسبة تسعير الأعمال الفنية

A pricing calculator for **Arabic calligraphy on paper (framed)** and **oil, acrylic and watercolour paintings** on paper, canvas or panel. Bilingual (English / العربية, full RTL). No build step and no server: everything runs and is saved in your browser.

## Use it

Open `index.html` in any browser, or use the hosted version on GitHub Pages: **https://amalsaadi8.github.io/art-price-calc/**

The `.github/workflows/pages.yml` workflow runs the tests and publishes the site on every push. To turn it on once, go to **Settings → Pages → Build and deployment → Source: GitHub Actions**. (Pages on a private repository needs a paid GitHub plan; on a free plan, make the repository public first.)

## What it accounts for

| Section | Inputs |
|---|---|
| Artwork | Type (calligraphy / oil / acrylic / watercolour), surface (paper / canvas / panel), width × height in cm, **quantity** (copies of the same piece) |
| Consumables | Editable line items (qty × unit cost), with presets per medium: ink, qalam wear, gold leaf, ahar, paints, gesso, varnish, canvas, paper… |
| Your time | Hours × hourly rate, plus a studio-overhead share per piece |
| Frame | A framer's quote, **or** calculated from size: moulding per metre (with mitre and waste allowance), glass / acrylic / museum glazing per m², mat (passe-partout) per m², backing, fitting. Shows the final framed size |
| Packaging | Line items: bubble wrap, corners, art box, glassine, tape… |
| Delivery | Courier cost plus transit insurance (% of price), either charged to the buyer separately or included as free shipping |
| Pricing strategy | **Cost + profit markup**, **by size** (per cm² or per linear cm × a complexity/reputation multiplier), or **the higher of both**, plus an optional minimum price |
| Sales channel | Gallery/platform commission, payment fees, VAT, and rounding up (to 5, 10, 50…) |

## How the price is worked out

```
production cost = materials + labour + frame + packaging + overhead
cost-plus       = production cost × (1 + markup)
by size         = size × rate × complexity + materials + frame + packaging + overhead
net             = chosen method (or the minimum price, if that is higher)
price           = (net [+ delivery if free shipping]) / (1 − commission − fees [− insurance])
                  → rounded up, then VAT added
```

Commission and fees are *grossed up*, so after the gallery takes its cut you still get your full costs plus profit. The summary shows the cost breakdown, where every part of the price goes, profit margin, **effective hourly earnings**, and price per cm². It warns you if a price loses money or pays you below your hourly rate.

## Branded quotations: PDF and Excel

In **9 · Brand & quotation**, enter the client's name. Open **Your brand** once to upload your logo and set your studio name, tagline, main and accent colours, contact details, and the notes and terms printed on every quote. You can also apply your logo and colours to the app itself. Brand settings are saved in your browser and reused for every piece.

- **⬇ PDF quote**: an A4 client quotation with your logo and colours, quote number, date, validity, artwork description (medium, size, framing), subtotal, VAT, delivery and total. It's rendered by the browser itself, so Arabic text joins correctly. If a browser can't render it directly, the print dialog opens instead so you can choose "Save as PDF". There's an optional internal cost-breakdown section.
- **⬇ Excel**: a workbook with two sheets. **Quotation** is the client-facing, branded sheet with live formulas for VAT and totals. **Cost breakdown** is your internal sheet listing every material, labour, frame, packaging and overhead line, plus commission, fees, profit, margin and effective hourly rate. Arabic workbooks open in right-to-left view.

**Quantity:** materials, time, frame and packaging are counted per piece, and delivery is one shipment for the whole order (with free shipping, it's spread across the pieces). The quote shows quantity × unit price, and the Excel amount is a live `qty × unit price` formula.

Quote numbers are assigned automatically (`Q-2026-1001`, `Q-2026-1002`, …) and can be edited.

You can also save pieces, print the summary, copy a text summary, and export or import your saved pieces as JSON.

Defaults are AED and 5% VAT. You can change both in the app.

## Development

```bash
npm test
```

The pricing engine (`calc.js`) is pure JavaScript and covered by Node's built-in test runner (`test/calc.test.js`). The UI is in `index.html`, `app.js` and `styles.css`, the strings and material presets are in `i18n.js`, and branding and PDF/Excel export are in `quote.js`. `vendor/` holds [jsPDF](https://github.com/parallax/jsPDF) 2.5.2 and [ExcelJS](https://github.com/exceljs/exceljs) 4.4.0 (both MIT). They're loaded only when you export, so the site has no CDN dependency.
