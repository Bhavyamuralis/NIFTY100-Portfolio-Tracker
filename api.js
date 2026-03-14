/* ── api.js ── Data Layer ──────────────────────────────── */

// In-memory store (persisted to localStorage as fallback)
let STORE = {
  transactions: [],
  prices: {},
  navHistory: [],
  indexPrice: 0,
  lastFetched: null,
  usingSample: false,
};

// ── localStorage persistence ─────────────────────────────
function saveStore() {
  try {
    localStorage.setItem('portfolio_transactions', JSON.stringify(STORE.transactions));
    localStorage.setItem('portfolio_navHistory', JSON.stringify(STORE.navHistory));
    localStorage.setItem('portfolio_prices', JSON.stringify(STORE.prices));
  } catch(e) { console.warn('localStorage save failed', e); }
}

function loadStore() {
  try {
    const tx = localStorage.getItem('portfolio_transactions');
    if (tx) STORE.transactions = JSON.parse(tx);
    const nav = localStorage.getItem('portfolio_navHistory');
    if (nav) STORE.navHistory = JSON.parse(nav);
    const px = localStorage.getItem('portfolio_prices');
    if (px) STORE.prices = JSON.parse(px);
  } catch(e) { console.warn('localStorage load failed', e); }
}

// ── Fetch from Google Apps Script ───────────────────────
async function fetchFromAPI() {
  const url = CONFIG.apiUrl;
  if (!url) return false;
  try {
    const res = await fetch(`${url}?action=all`, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.transactions) STORE.transactions = data.transactions;
    if (data.prices)       STORE.prices = data.prices;
    if (data.navHistory)   STORE.navHistory = data.navHistory;
    if (data.indexPrice)   STORE.indexPrice = data.indexPrice;
    STORE.usingSample = false;
    saveStore();
    return true;
  } catch (e) {
    console.warn('API fetch failed:', e.message);
    return false;
  }
}

// ── Post transaction to Apps Script ─────────────────────
async function postTransaction(tx) {
  const url = CONFIG.apiUrl;
  if (url) {
    try {
      await fetch(`${url}?action=addTransaction`, {
        method: 'POST',
        body: JSON.stringify(tx),
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
      });
    } catch(e) { console.warn('Post failed, saved locally'); }
  }
  STORE.transactions.push(tx);
  saveStore();
}

// ── Load sample demo data ────────────────────────────────
function loadSampleData() {
  STORE.transactions = SAMPLE_TRANSACTIONS.map(t => ({...t}));
  STORE.prices = {...SAMPLE_PRICES};
  STORE.navHistory = generateNavHistory(13);
  STORE.indexPrice = 24150;
  STORE.usingSample = true;
  saveStore();
}

// ── Holdings calculation ──────────────────────────────────
function computeHoldings() {
  const qty = {};
  const totalCost = {};
  const costBasis = {};

  STORE.transactions.forEach(tx => {
    const s = tx.stock;
    const q = parseFloat(tx.qty) || 0;
    const p = parseFloat(tx.price) || 0;
    if (tx.action === 'BUY') {
      qty[s] = (qty[s] || 0) + q;
      totalCost[s] = (totalCost[s] || 0) + q * p;
    } else {
      qty[s] = (qty[s] || 0) - q;
      // reduce cost basis proportionally
      if (qty[s] <= 0) {
        qty[s] = 0;
        totalCost[s] = 0;
      } else {
        const oldAvg = totalCost[s] / (qty[s] + q);
        totalCost[s] = oldAvg * qty[s];
      }
    }
  });

  const holdings = [];
  for (const s in qty) {
    if (qty[s] > 0) {
      const q = qty[s];
      const avg = q > 0 ? totalCost[s] / q : 0;
      const ltp = STORE.prices[s] || avg || 0;
      const invested = q * avg;
      const current = q * ltp;
      const pnl = current - invested;
      const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
      holdings.push({ stock:s, qty:q, avgCost:avg, ltp, invested, current, pnl, pnlPct });
    }
  }
  return holdings.sort((a,b) => b.current - a.current);
}

// ── Portfolio summary ────────────────────────────────────
function computeSummary() {
  const holdings = computeHoldings();
  const portfolioValue = holdings.reduce((s,h) => s + h.current, 0);
  const totalInvested = holdings.reduce((s,h) => s + h.invested, 0);
  const pnl = portfolioValue - totalInvested;
  const pnlPct = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;

  // NAV
  const nav = CONFIG.totalUnits > 0 ? portfolioValue / CONFIG.totalUnits : CONFIG.initialNav;

  // Simple XIRR approximation from transactions
  const xirr = estimateXIRR();

  // Risk metrics
  const risk = computeRiskMetrics();

  return { portfolioValue, totalInvested, pnl, pnlPct, nav, xirr, holdings, ...risk };
}

// ── XIRR approximation (Newton-Raphson) ─────────────────
function estimateXIRR() {
  const flows = [];
  STORE.transactions.forEach(tx => {
    const d = new Date(tx.date);
    const amt = tx.action === 'BUY'
      ? -(parseFloat(tx.qty) * parseFloat(tx.price))
      :   parseFloat(tx.qty) * parseFloat(tx.price);
    flows.push({ d, amt });
  });
  if (flows.length === 0) return 0;

  // Add current portfolio value as terminal cash flow today
  const holdings = computeHoldings();
  const terminalValue = holdings.reduce((s,h) => s + h.current, 0);
  if (terminalValue > 0) flows.push({ d: new Date(), amt: terminalValue });

  // Newton-Raphson XIRR
  function npv(rate, flows) {
    const t0 = flows[0].d.getTime();
    return flows.reduce((sum, f) => {
      const t = (f.d.getTime() - t0) / (365.25 * 24 * 3600 * 1000);
      return sum + f.amt / Math.pow(1 + rate, t);
    }, 0);
  }

  let r = 0.1;
  for (let i = 0; i < 100; i++) {
    const f = npv(r, flows);
    const df = (npv(r + 1e-6, flows) - f) / 1e-6;
    if (Math.abs(df) < 1e-12) break;
    const r2 = r - f / df;
    if (Math.abs(r2 - r) < 1e-8) { r = r2; break; }
    r = r2;
    if (r < -0.999) r = -0.999;
  }
  return isFinite(r) ? r * 100 : 0;
}

// ── Risk Metrics ────────────────────────────────────────
function computeRiskMetrics() {
  const navHist = STORE.navHistory;
  if (!navHist || navHist.length < 3) {
    return { volatility: 0, sharpe: 0, maxDrawdown: 0, trackingError: 0, beta: 1, alpha: 0 };
  }

  const navs = navHist.map(h => h.nav);
  const idxs = navHist.map(h => h.indexVal || 24000);

  // Daily/monthly returns
  const pReturns = [];
  const iReturns = [];
  for (let i = 1; i < navs.length; i++) {
    pReturns.push((navs[i] - navs[i-1]) / navs[i-1]);
    iReturns.push((idxs[i] - idxs[i-1]) / idxs[i-1]);
  }

  const mean = arr => arr.reduce((s,v) => s+v, 0) / arr.length;
  const std = arr => {
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s,v) => s + (v-m)**2, 0) / arr.length);
  };

  // Annualised volatility (monthly returns × √12)
  const vol = std(pReturns) * Math.sqrt(12) * 100;

  // Annualised return
  const annReturn = mean(pReturns) * 12 * 100;

  // Sharpe
  const rfr = CONFIG.riskFreeRate;
  const sharpe = vol > 0 ? (annReturn - rfr) / vol : 0;

  // Max Drawdown
  let peak = -Infinity, maxDD = 0;
  navs.forEach(n => {
    if (n > peak) peak = n;
    const dd = (peak - n) / peak * 100;
    if (dd > maxDD) maxDD = dd;
  });

  // Tracking error
  const diffReturns = pReturns.map((r,i) => r - iReturns[i]);
  const trackErr = std(diffReturns) * Math.sqrt(12) * 100;

  // Beta
  const covPI = mean(pReturns.map((r,i) => (r - mean(pReturns)) * (iReturns[i] - mean(iReturns))));
  const varI = std(iReturns) ** 2;
  const beta = varI > 0 ? covPI / varI : 1;

  // Alpha (Jensen's)
  const iAnnReturn = mean(iReturns) * 12 * 100;
  const alpha = annReturn - (rfr + beta * (iAnnReturn - rfr));

  return {
    volatility: +vol.toFixed(1),
    sharpe: +sharpe.toFixed(2),
    maxDrawdown: +maxDD.toFixed(1),
    trackingError: +trackErr.toFixed(1),
    beta: +beta.toFixed(2),
    alpha: +alpha.toFixed(2),
    annReturn: +annReturn.toFixed(1),
  };
}

// ── Sector allocation ────────────────────────────────────
function computeSectorAllocation(holdings) {
  const total = holdings.reduce((s,h) => s + h.current, 0);
  const sectors = {};
  holdings.forEach(h => {
    const sec = SECTORS[h.stock] || 'Others';
    sectors[sec] = (sectors[sec] || 0) + h.current;
  });
  return Object.entries(sectors)
    .map(([name, val]) => ({ name, value: val, pct: total > 0 ? val/total*100 : 0 }))
    .sort((a,b) => b.pct - a.pct);
}

// ── Rebalancing suggestions ──────────────────────────────
function computeRebalance(holdings) {
  const total = holdings.reduce((s,h) => s + h.current, 0);
  return holdings.map(h => {
    const currentW = total > 0 ? h.current / total * 100 : 0;
    const targetW = NIFTY100_WEIGHTS[h.stock] || 1.0;
    const deviation = currentW - targetW;
    let action = 'HOLD';
    if (deviation > 2) action = 'SELL';
    else if (deviation < -2) action = 'BUY';
    const suggestedVal = Math.abs(deviation / 100) * total;
    const suggestedQty = h.ltp > 0 ? Math.round(suggestedVal / h.ltp) : 0;
    return { stock:h.stock, currentW:+currentW.toFixed(2), targetW, deviation:+deviation.toFixed(2), action, suggestedQty };
  });
}

// ── Delete transaction ───────────────────────────────────
function deleteTransaction(idx) {
  STORE.transactions.splice(idx, 1);
  saveStore();
}

// ── Simulate live price movements (±0.5% every refresh) ─
function jitterPrices() {
  if (!STORE.usingSample) return;
  for (const s in STORE.prices) {
    const change = 1 + (Math.random() - 0.5) * 0.01;
    STORE.prices[s] = +(STORE.prices[s] * change).toFixed(2);
  }
  // Also shift index price
  STORE.indexPrice = +(STORE.indexPrice * (1 + (Math.random() - 0.49) * 0.008)).toFixed(2);
}
