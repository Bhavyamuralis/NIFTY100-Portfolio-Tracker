/* ── app.js ── Main Application ───────────────────────── */

// ── Initialisation ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  loadStore();
  populateStockList();
  setupNavInput();
  buildSetupGuide();

  // Set today's date in transaction modal
  document.getElementById('txDate').value = new Date().toISOString().slice(0,10);

  // If no data, load sample
  if (STORE.transactions.length === 0) {
    loadSampleData();
    updateStatus('Showing sample data — connect Google Sheets in Settings');
  }

  await refreshDashboard();
  startAutoRefresh();
});

// ── Navigation ───────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const view = item.dataset.view;
    switchView(view);
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
  });
});

function switchView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById(`view-${view}`);
  if (el) el.classList.add('active');

  // Render view-specific content
  if (view === 'portfolio') renderHoldingsTable();
  if (view === 'transactions') renderTransactionsTable();
  if (view === 'analytics') renderAnalytics();
  if (view === 'rebalance') renderRebalance();
  if (view === 'settings') renderSettings();
}

// ── Auto-refresh countdown ───────────────────────────────
let refreshTimer, countdown = CONFIG.refreshInterval;

function startAutoRefresh() {
  clearInterval(refreshTimer);
  countdown = CONFIG.refreshInterval;
  refreshTimer = setInterval(async () => {
    countdown--;
    document.getElementById('countdown').textContent = countdown;
    if (countdown <= 0) {
      countdown = CONFIG.refreshInterval;
      await refreshDashboard(true);
    }
  }, 1000);
}

async function forceRefresh() {
  countdown = CONFIG.refreshInterval;
  await refreshDashboard(true);
}

// ── Main data refresh ────────────────────────────────────
async function refreshDashboard(tryApi = false) {
  if (tryApi && CONFIG.apiUrl) {
    const ok = await fetchFromAPI();
    if (!ok) jitterPrices();
  } else if (STORE.usingSample) {
    jitterPrices();
    // Append latest NAV snapshot
    const summary = computeSummary();
    const today = new Date().toISOString().slice(0,7);
    const last = STORE.navHistory[STORE.navHistory.length - 1];
    if (!last || last.date !== today) {
      STORE.navHistory.push({ date: today, nav: +summary.nav.toFixed(4), indexVal: STORE.indexPrice || 24150 });
    } else {
      last.nav = +summary.nav.toFixed(4);
      last.indexVal = STORE.indexPrice || 24150;
    }
  }

  renderDashboard();
  document.getElementById('lastUpdated').textContent =
    `Last updated: ${new Date().toLocaleTimeString()} ${STORE.usingSample ? '(Sample data)' : ''}`;
}

// ── Render dashboard cards & charts ─────────────────────
function renderDashboard() {
  const s = computeSummary();

  // Cards
  setCard('portfolioValue', fmt(s.portfolioValue), delta(s.pnl, s.pnlPct));
  setCard('totalInvested',  fmt(s.totalInvested), '');
  setCard('navValue',       '₹' + s.nav.toFixed(4), '');
  setCard('xirrValue',      s.xirr.toFixed(1) + '%', '', xirr_cls(s.xirr));
  setCard('pnlValue',       fmt(s.pnl, true), pctSpan(s.pnlPct));
  setCard('indexValue',     fmt(STORE.indexPrice || 24150), '');

  // Risk cards on dashboard
  document.getElementById('riskMetrics').innerHTML = `
    <div class="risk-item"><div class="risk-label">Volatility</div><div class="risk-val">${s.volatility}%</div></div>
    <div class="risk-item"><div class="risk-label">Sharpe</div><div class="risk-val ${s.sharpe>=1?'pos':s.sharpe<0?'neg':'neu'}">${s.sharpe}</div></div>
    <div class="risk-item"><div class="risk-label">Max DD</div><div class="risk-val neg">-${s.maxDrawdown}%</div></div>
    <div class="risk-item"><div class="risk-label">Track Err</div><div class="risk-val">${s.trackingError}%</div></div>
  `;

  // Charts
  renderNavChart(STORE.navHistory, currentNavRange);
  const sectors = computeSectorAllocation(s.holdings);
  renderSectorChart(sectors);
  renderPerfChart(STORE.navHistory);
}

// ── Holdings Table ───────────────────────────────────────
function renderHoldingsTable() {
  const holdings = computeHoldings();
  const total = holdings.reduce((s,h) => s + h.current, 0);
  const tbody = document.getElementById('holdingsTbody');
  document.getElementById('holdingsCount').textContent = `${holdings.length} positions`;

  tbody.innerHTML = holdings.map(h => `
    <tr>
      <td><span class="stock-badge">${h.stock}</span></td>
      <td style="color:var(--secondary);font-size:11px">${SECTORS[h.stock]||'Others'}</td>
      <td class="num">${h.qty.toLocaleString('en-IN')}</td>
      <td class="num" style="font-family:var(--mono)">₹${h.avgCost.toFixed(2)}</td>
      <td class="num" style="font-family:var(--mono)">₹${h.ltp.toFixed(2)}</td>
      <td class="num" style="font-family:var(--mono)">${fmt(h.invested)}</td>
      <td class="num" style="font-family:var(--mono)">${fmt(h.current)}</td>
      <td class="num ${h.pnl>=0?'pos':'neg'}" style="font-family:var(--mono)">${fmt(h.pnl, true)}</td>
      <td class="num ${h.pnlPct>=0?'pos':'neg'}">${h.pnlPct.toFixed(2)}%</td>
      <td class="num">
        <div class="weight-bar-wrap">
          ${(h.current/total*100).toFixed(1)}%
          <div class="weight-bar" style="width:${Math.min(h.current/total*100*2,60)}px"></div>
        </div>
      </td>
    </tr>
  `).join('');

  renderAllocationChart(holdings);
}

// ── Filter holdings ──────────────────────────────────────
function filterHoldings() {
  const q = document.getElementById('holdingsSearch').value.toUpperCase();
  document.querySelectorAll('#holdingsTbody tr').forEach(row => {
    row.style.display = row.textContent.toUpperCase().includes(q) ? '' : 'none';
  });
}

// ── Transactions Table ───────────────────────────────────
function renderTransactionsTable() {
  const tbody = document.getElementById('txTbody');
  const txs = [...STORE.transactions].reverse();
  document.getElementById('txCount').textContent = `${txs.length} transactions`;

  tbody.innerHTML = txs.map((tx, ri) => {
    const i = STORE.transactions.length - 1 - ri;
    const amt = tx.action === 'BUY'
      ? -(tx.qty * tx.price)
      :   tx.qty * tx.price;
    return `
      <tr>
        <td style="font-family:var(--mono);font-size:12px">${tx.date}</td>
        <td><span class="stock-badge">${tx.stock}</span></td>
        <td><span class="action-${tx.action.toLowerCase()}">${tx.action}</span></td>
        <td class="num">${tx.qty.toLocaleString('en-IN')}</td>
        <td class="num" style="font-family:var(--mono)">₹${parseFloat(tx.price).toFixed(2)}</td>
        <td class="num ${amt>=0?'pos':'neg'}" style="font-family:var(--mono)">${fmt(amt,true)}</td>
        <td><button class="del-btn" onclick="deleteTx(${i})" title="Delete">✕</button></td>
      </tr>
    `;
  }).join('');
}

function filterTransactions() {
  const q = document.getElementById('txSearch').value.toUpperCase();
  const f = document.getElementById('txFilter').value;
  document.querySelectorAll('#txTbody tr').forEach(row => {
    const txt = row.textContent.toUpperCase();
    const matchQ = !q || txt.includes(q);
    const matchF = !f || txt.includes(f);
    row.style.display = (matchQ && matchF) ? '' : 'none';
  });
}

function deleteTx(i) {
  if (!confirm('Delete this transaction?')) return;
  deleteTransaction(i);
  renderTransactionsTable();
  renderDashboard();
}

// ── Analytics ────────────────────────────────────────────
function renderAnalytics() {
  const s = computeSummary();
  document.getElementById('aVolatility').textContent = s.volatility + '%';
  document.getElementById('aSharpe').textContent = s.sharpe;
  document.getElementById('aDrawdown').textContent = '-' + s.maxDrawdown + '%';
  document.getElementById('aTracking').textContent = s.trackingError + '%';
  document.getElementById('aBeta').textContent = s.beta;
  document.getElementById('aAlpha').textContent = s.alpha + '%';

  // Colour
  el('aSharpe').className = 'card-value ' + (s.sharpe >= 1 ? 'pos' : s.sharpe < 0 ? 'neg' : '');
  el('aAlpha').className  = 'card-value ' + (s.alpha  >= 0 ? 'pos' : 'neg');

  renderReturnsChart(STORE.navHistory);
  renderDrawdownChart(STORE.navHistory);
}

// ── Rebalance ────────────────────────────────────────────
function renderRebalance() {
  const holdings = computeHoldings();
  const rows = computeRebalance(holdings);
  const tbody = document.getElementById('rebalanceTbody');
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td><span class="stock-badge">${r.stock}</span></td>
      <td class="num">${r.currentW}%</td>
      <td class="num">${r.targetW}%</td>
      <td class="num ${r.deviation > 0 ? 'dev-pos' : 'dev-neg'}">${r.deviation > 0 ? '+' : ''}${r.deviation}%</td>
      <td><span class="action-${r.action === 'BUY' ? 'strong-buy' : r.action === 'SELL' ? 'strong-sell' : 'hold'}">${r.action}</span></td>
      <td class="num">${r.suggestedQty > 0 ? r.suggestedQty + ' shares' : '—'}</td>
    </tr>
  `).join('');
}

// ── Settings ─────────────────────────────────────────────
function renderSettings() {
  document.getElementById('apiUrl').value = CONFIG.apiUrl || '';
  document.getElementById('totalUnits').value = CONFIG.totalUnits;
  document.getElementById('initialNav').value = CONFIG.initialNav;
  document.getElementById('riskFreeRate').value = CONFIG.riskFreeRate;
}

function saveSettings() {
  const url = document.getElementById('apiUrl').value.trim();
  CONFIG.apiUrl = url;
  localStorage.setItem('apiUrl', url);
  testConnection(url);
}

async function testConnection(url) {
  const el = document.getElementById('connStatus');
  el.className = 'conn-status';
  el.textContent = 'Testing…';
  if (!url) { el.className = 'conn-status conn-err'; el.textContent = '✗ No URL provided'; return; }
  try {
    const res = await fetch(`${url}?action=ping`, { mode: 'cors' });
    if (res.ok) {
      el.className = 'conn-status conn-ok';
      el.textContent = '✓ Connected successfully';
      await fetchFromAPI();
      renderDashboard();
    } else throw new Error('HTTP ' + res.status);
  } catch(e) {
    el.className = 'conn-status conn-err';
    el.textContent = `✗ Connection failed: ${e.message}`;
  }
}

function saveConfig() {
  CONFIG.totalUnits = parseFloat(document.getElementById('totalUnits').value);
  CONFIG.initialNav = parseFloat(document.getElementById('initialNav').value);
  CONFIG.riskFreeRate = parseFloat(document.getElementById('riskFreeRate').value);
  localStorage.setItem('totalUnits', CONFIG.totalUnits);
  localStorage.setItem('initialNav', CONFIG.initialNav);
  localStorage.setItem('riskFreeRate', CONFIG.riskFreeRate);
  renderDashboard();
  updateStatus('Configuration saved');
}

function loadSampleData() {
  // from api.js
  window.loadSampleData && window.loadSampleData();
  // call the function defined in api.js
  STORE.transactions = SAMPLE_TRANSACTIONS.map(t => ({...t}));
  STORE.prices = {...SAMPLE_PRICES};
  STORE.navHistory = generateNavHistory(13);
  STORE.indexPrice = 24150;
  STORE.usingSample = true;
  saveStore();
  renderDashboard();
  updateStatus('Sample data loaded');
}

function clearData() {
  if (!confirm('Clear all portfolio data?')) return;
  STORE.transactions = [];
  STORE.prices = {};
  STORE.navHistory = [];
  STORE.indexPrice = 0;
  STORE.usingSample = false;
  saveStore();
  localStorage.removeItem('portfolio_transactions');
  localStorage.removeItem('portfolio_navHistory');
  localStorage.removeItem('portfolio_prices');
  renderDashboard();
  updateStatus('All data cleared');
}

// ── Add Transaction Modal ────────────────────────────────
function showAddTransaction() {
  document.getElementById('txModal').classList.remove('hidden');
  document.getElementById('txDate').value = new Date().toISOString().slice(0,10);
  document.getElementById('txStock').value = '';
  document.getElementById('txQty').value = '';
  document.getElementById('txPrice').value = '';
  document.getElementById('txAmount').value = '';
  document.getElementById('txError').classList.add('hidden');
}

function closeTxModal() {
  document.getElementById('txModal').classList.add('hidden');
}

function setupNavInput() {
  const qty = document.getElementById('txQty');
  const price = document.getElementById('txPrice');
  const action = document.getElementById('txAction');
  const amount = document.getElementById('txAmount');
  function recalc() {
    const q = parseFloat(qty.value) || 0;
    const p = parseFloat(price.value) || 0;
    if (q && p) {
      const v = q * p;
      amount.value = (action.value === 'BUY' ? '-' : '+') + fmt(v);
    } else {
      amount.value = '';
    }
  }
  qty.addEventListener('input', recalc);
  price.addEventListener('input', recalc);
  action.addEventListener('change', recalc);

  // Auto-fill price from prices store
  document.getElementById('txStock').addEventListener('input', e => {
    const s = e.target.value.toUpperCase().replace('-','_');
    if (STORE.prices[s]) {
      document.getElementById('txPrice').value = STORE.prices[s];
      recalc();
    }
  });
}

async function addTransaction() {
  const errEl = document.getElementById('txError');
  errEl.classList.add('hidden');

  const tx = {
    date:   document.getElementById('txDate').value,
    stock:  document.getElementById('txStock').value.toUpperCase().trim().replace('-','_'),
    action: document.getElementById('txAction').value,
    qty:    parseFloat(document.getElementById('txQty').value),
    price:  parseFloat(document.getElementById('txPrice').value),
  };

  if (!tx.date || !tx.stock || !tx.qty || !tx.price) {
    errEl.textContent = 'Please fill in all fields.';
    errEl.classList.remove('hidden');
    return;
  }
  if (tx.qty <= 0 || tx.price <= 0) {
    errEl.textContent = 'Quantity and price must be positive.';
    errEl.classList.remove('hidden');
    return;
  }

  // Validate SELL qty
  if (tx.action === 'SELL') {
    const holdings = computeHoldings();
    const holding = holdings.find(h => h.stock === tx.stock);
    if (!holding || holding.qty < tx.qty) {
      errEl.textContent = `Insufficient holdings. You hold ${holding?.qty || 0} shares of ${tx.stock}.`;
      errEl.classList.remove('hidden');
      return;
    }
  }

  await postTransaction(tx);

  // Update sample price if using sample
  if (STORE.usingSample) STORE.prices[tx.stock] = tx.price;

  closeTxModal();
  renderDashboard();
  // Refresh current view table if visible
  const activeView = document.querySelector('.view.active')?.id;
  if (activeView === 'view-portfolio') renderHoldingsTable();
  if (activeView === 'view-transactions') renderTransactionsTable();
  updateStatus(`${tx.action} ${tx.qty} ${tx.stock} @ ₹${tx.price} added`);
}

// Close modal on overlay click
document.getElementById('txModal').addEventListener('click', e => {
  if (e.target.id === 'txModal') closeTxModal();
});

// ── Setup Guide ──────────────────────────────────────────
function buildSetupGuide() {
  const steps = [
    {
      title: 'Create a Google Sheet',
      desc: 'Go to sheets.google.com and create a new spreadsheet. Create 6 sheets: <code>Transactions</code>, <code>Holdings</code>, <code>MarketData</code>, <code>Portfolio</code>, <code>NAV</code>, <code>CashFlow</code>.',
    },
    {
      title: 'Set up the Transactions sheet',
      desc: 'Columns: <code>Date | Stock | Action | Quantity | Price | Amount</code>. In cell F2 enter: <code>=IF(C2="BUY",-D2*E2,D2*E2)</code>',
    },
    {
      title: 'Set up the MarketData sheet',
      desc: 'Column A: stock symbols (e.g. RELIANCE). Column B formula: <code>=GOOGLEFINANCE("NSE:"&A2,"price")</code> — this fetches live NSE prices.',
    },
    {
      title: 'Set up the Holdings & Portfolio sheets',
      desc: 'Holdings: <code>=SUMIF(Transactions!B:B,A2,Transactions!D:D)</code> to sum BUYs minus SELLs. Portfolio Value: <code>=B2*C2</code> per row.',
    },
    {
      title: 'Set up NAV sheet',
      desc: 'Cell B2: <code>=Portfolio!D_total / 50000</code> where 50000 is your total units. Track NAV history manually or via script.',
    },
    {
      title: 'Open Apps Script',
      desc: 'In your Google Sheet: <code>Extensions → Apps Script</code>. Paste the code from <code>apps-script.gs</code> provided in this package.',
    },
    {
      title: 'Deploy as Web App',
      desc: 'In Apps Script: <code>Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone</code>. Copy the web app URL.',
    },
    {
      title: 'Connect to this dashboard',
      desc: 'Paste the web app URL into the field above and click "Save & Test Connection". Your live portfolio will appear automatically.',
    },
  ];

  document.getElementById('setupGuide').innerHTML = steps.map((s,i) => `
    <div class="step">
      <div class="step-num">${i+1}</div>
      <div class="step-content">
        <div class="step-title">${s.title}</div>
        <div class="step-desc">${s.desc}</div>
      </div>
    </div>
  `).join('');
}

function populateStockList() {
  const dl = document.getElementById('stockList');
  if (!dl) return;
  dl.innerHTML = NIFTY100_STOCKS.map(s => `<option value="${s}">`).join('');
}

// ── Utilities ────────────────────────────────────────────
function fmt(n, signed = false) {
  const abs = Math.abs(n);
  let s;
  if (abs >= 1e7) s = '₹' + (abs/1e7).toFixed(2) + 'Cr';
  else if (abs >= 1e5) s = '₹' + (abs/1e5).toFixed(2) + 'L';
  else s = '₹' + abs.toLocaleString('en-IN', {minimumFractionDigits:0, maximumFractionDigits:0});
  if (signed) return (n >= 0 ? '+' : '-') + s;
  return (n < 0 ? '-' : '') + s;
}

function delta(val, pct) {
  const cls = val >= 0 ? 'pos' : 'neg';
  const sign = val >= 0 ? '+' : '';
  return `<span class="${cls}">${sign}${fmt(val,true)} (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)</span>`;
}

function pctSpan(pct) {
  const cls = pct >= 0 ? 'pos' : 'neg';
  return `<span class="${cls}">${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%</span>`;
}

function xirr_cls(x) { return x >= 12 ? 'pos' : x >= 0 ? 'neu' : 'neg'; }

function setCard(id, val, deltaHtml, extraCls = '') {
  const valEl = document.getElementById(id);
  const deltaEl = document.getElementById(id + 'Delta') || document.getElementById(id.replace('Value','Change')) || null;
  if (valEl) { valEl.textContent = val; if (extraCls) valEl.className = 'card-value ' + extraCls; }
  if (deltaEl) deltaEl.innerHTML = deltaHtml;
}

function el(id) { return document.getElementById(id); }

function updateStatus(msg) {
  document.getElementById('lastUpdated').textContent = msg;
  setTimeout(() => {
    document.getElementById('lastUpdated').textContent =
      `Last updated: ${new Date().toLocaleTimeString()} ${STORE.usingSample ? '(Sample data)':''}`;
  }, 3000);
}
