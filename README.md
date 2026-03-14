# NIFTY 100 Portfolio Tracker
## Complete Setup & Deployment Guide

A mutual-fund-style portfolio dashboard for tracking up to 30 stocks against the NIFTY 100 index.
Built with HTML/CSS/JS frontend + Google Sheets + Google Apps Script backend.

---

## Quick Start (Demo Mode)

Open `index.html` in any browser — it loads **sample data automatically** with simulated price movements. No backend needed.

---

## Full Setup: Google Sheets + Apps Script

### Step 1 — Create a Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) → **New spreadsheet**
2. Name it: `NIFTY100 Portfolio Tracker`

### Step 2 — Open Apps Script

1. In the sheet: **Extensions → Apps Script**
2. Delete all default code
3. Paste the entire contents of `apps-script.gs`
4. Save (Ctrl+S) and name the project: `Portfolio API`

### Step 3 — Run Initial Setup

1. In Apps Script, select function `setupSheets` from the dropdown
2. Click **Run** → Authorise when prompted
3. This creates all required sheets:
   - `Transactions` — trade log
   - `Holdings` — current positions
   - `MarketData` — live GOOGLEFINANCE prices
   - `Portfolio` — holdings × current price
   - `NAV` — portfolio NAV calculation
   - `NAVHistory` — monthly NAV log
   - `CashFlow` — XIRR input
   - `Index` — NIFTY 100 benchmark

### Step 4 — Deploy as Web App

1. In Apps Script: **Deploy → New deployment**
2. Select type: **Web app**
3. Description: `Portfolio API v1`
4. Execute as: **Me**
5. Who has access: **Anyone** (required for CORS)
6. Click **Deploy** → **Authorise access**
7. Copy the **Web App URL** (looks like `https://script.google.com/macros/s/ABC.../exec`)

### Step 5 — Connect the Dashboard

1. Open `index.html` in your browser
2. Navigate to **Settings** (sidebar)
3. Paste the Web App URL
4. Click **Save & Test Connection**
5. If successful, your live portfolio loads immediately

### Step 6 — Add Transactions

1. Click **+ Add Trade** from any page
2. Fill: Date / Stock / BUY or SELL / Quantity / Price
3. Stock names autocomplete from NIFTY 100 list
4. Each transaction automatically:
   - Posts to Google Sheets Transactions sheet
   - Recalculates Holdings
   - Updates Portfolio value
   - Logs new NAV snapshot

---

## Google Sheets Formula Reference

### Transactions Sheet (column F — Amount)
```
=IF(C2="BUY", -D2*E2, D2*E2)
```
BUY = negative (cash out), SELL = positive (cash in)

### MarketData Sheet (column B — Live Price)
```
=GOOGLEFINANCE("NSE:"&A2,"price")
```
Fetches live NSE price every 20 minutes (Google Finance limitation)

### Holdings Sheet
Calculated via Apps Script `updateHoldings()` function.
Or use SUMIF:
```
=SUMIF(Transactions!B:B, A2, Transactions!D:D) - SUMIF(Transactions!C:C&Transactions!B:B, "SELL"&A2, Transactions!D:D)
```

### Portfolio Value
```
=B2*C2        (each row)
=SUM(D:D)     (total)
```

### NAV
```
=PortfolioValue / TotalUnits
```
Default total units: 50,000 (configure in Settings)

### CashFlow Sheet — XIRR
```
=XIRR(B2:B100, A2:A100)
```
Include all investments as negative, withdrawals as positive, and add current portfolio value as a positive cash flow today.

### Index Sheet
```
=GOOGLEFINANCE("NSE:NIFTY 100","price")
```

---

## Folder Structure

```
portfolio-tracker/
├── index.html        — Main app shell (navigation, modals, view containers)
├── styles.css        — Dark theme styling (CSS variables, layout, components)
├── config.js         — Stock list, sector mapping, NIFTY100 weights, sample data
├── api.js            — Data layer: fetch, compute holdings/summary/XIRR/risk
├── charts.js         — Chart.js wrappers (NAV, sector, performance, drawdown)
├── app.js            — UI logic, event handlers, view rendering
└── apps-script.gs    — Google Apps Script API + Sheet setup (copy to Apps Script)
```

---

## Dashboard Features

### Portfolio Summary Cards
| Card | Description |
|------|-------------|
| Portfolio Value | Total current market value |
| Total Invested | Sum of all BUY transactions |
| NAV | Portfolio Value ÷ Total Units |
| XIRR | Internal rate of return (Newton-Raphson) |
| P&L | Unrealised profit/loss with % |
| NIFTY 100 | Live benchmark index price |

### Charts
- **NAV History** — Line chart with 1M/3M/6M/1Y range selector. Overlays normalised NIFTY 100.
- **Sector Allocation** — Doughnut chart by sector (Banking, IT, Energy, etc.)
- **Portfolio vs NIFTY 100** — Bar chart comparing returns for 1W/1M/3M/6M/1Y
- **Stock Allocation** — Horizontal bar showing top 20 holdings by weight
- **Drawdown Chart** — Peak-to-trough decline over time

### Risk Metrics (Analytics Page)
| Metric | Formula |
|--------|---------|
| Volatility | σ(monthly returns) × √12 × 100 |
| Sharpe Ratio | (Annual Return − Risk-Free Rate) ÷ Volatility |
| Max Drawdown | Max (Peak − Current) / Peak × 100 |
| Tracking Error | σ(Portfolio return − Index return) × √12 × 100 |
| Beta | Cov(Rp, Ri) / Var(Ri) |
| Alpha | Rp − [Rf + β(Ri − Rf)] |

### Rebalancing Page
Compares current weights vs NIFTY 100 target weights.
- BUY if underweight by >2%
- SELL if overweight by >2%
- Shows suggested share quantity to rebalance

---

## Deployment Options

### Option A: Static file (local)
```bash
# Simply open index.html in Chrome/Firefox/Edge
# Works fully offline in demo mode
```

### Option B: GitHub Pages (free hosting)
```bash
# 1. Create a GitHub repository
git init
git add .
git commit -m "NIFTY100 Portfolio Tracker"
git remote add origin https://github.com/YOUR_USERNAME/portfolio-tracker.git
git push -u origin main

# 2. Settings → Pages → Branch: main → Save
# Your dashboard will be live at: https://YOUR_USERNAME.github.io/portfolio-tracker
```

### Option C: Netlify (drag & drop)
1. Go to [netlify.com](https://netlify.com) → **Add new site → Deploy manually**
2. Drag the `portfolio-tracker/` folder into the upload area
3. Done — live URL provided instantly

---

## NIFTY 100 Tracking Note

Tracking NIFTY 100 with only 30 stocks **will create tracking error** because:

| Scenario | Impact |
|----------|--------|
| HDFC Bank (11% index weight) held at 4% | Diverges when HDFCBANK moves |
| PSU banks rally without holding them | Index outperforms your portfolio |
| IT sector correction | Portfolio more exposed if overweight IT |

The dashboard **measures** your tracking error on the Analytics page. A tracking error of <5% is considered good for a 30-stock replica.

**Recommended approach:**
- Hold the top 10 index constituents at ~60% of portfolio
- Cover remaining 40% across remaining sectors
- Rebalance quarterly using the Rebalance page

---

## Configuring Live Price Refresh

Google Sheets GOOGLEFINANCE formula refreshes prices every ~20 minutes.
This dashboard re-fetches from your Apps Script API every **60 seconds**.

To change the refresh interval:
```javascript
// In config.js
CONFIG.refreshInterval = 60; // seconds
```

---

## Adding New Stocks

1. Add the stock symbol to `MarketData` sheet in Google Sheets
2. The GOOGLEFINANCE formula will auto-fetch prices
3. Add transactions via **+ Add Trade** button

For unlisted/custom symbols:
```javascript
// In config.js, add to SECTORS mapping:
SECTORS['NEWSTOCK'] = 'Sector Name';

// Add to NIFTY100_WEIGHTS if tracking against index:
NIFTY100_WEIGHTS['NEWSTOCK'] = 0.5; // target weight %
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Connection failed" in Settings | Re-deploy Apps Script as new deployment; ensure "Anyone" access |
| GOOGLEFINANCE shows N/A | Some symbols need prefix, try `NSE:SYMBOL` or `BSE:SYMBOL` |
| Charts not rendering | Check browser console; ensure Chart.js CDN loads |
| Prices not updating | GOOGLEFINANCE has a ~20min delay; this is a Google limitation |
| XIRR shows 0% | Add at least one BUY transaction with historical date |

---

## Browser Support

| Browser | Support |
|---------|---------|
| Chrome 90+ | ✓ Full |
| Firefox 88+ | ✓ Full |
| Edge 90+ | ✓ Full |
| Safari 14+ | ✓ Full |
| Mobile (iOS/Android) | ✓ Responsive |

---

*Built for personal portfolio tracking. Not financial advice.*
