/* ── charts.js ── Chart.js Visualisations ─────────────── */

const CHART_COLORS = {
  accent:  '#4f9cf9',
  green:   '#7bc67e',
  red:     '#f97066',
  yellow:  '#f6c549',
  purple:  '#c084fc',
  orange:  '#fb923c',
  cyan:    '#22d3ee',
  pink:    '#f472b6',
  indigo:  '#818cf8',
  teal:    '#2dd4bf',
  border:  'rgba(255,255,255,0.07)',
  grid:    'rgba(255,255,255,0.05)',
};

const SECTOR_PALETTE = [
  CHART_COLORS.accent, CHART_COLORS.green, CHART_COLORS.yellow,
  CHART_COLORS.purple, CHART_COLORS.orange, CHART_COLORS.cyan,
  CHART_COLORS.pink,   CHART_COLORS.indigo, CHART_COLORS.teal,
  CHART_COLORS.red,
];

Chart.defaults.color = '#8a95a8';
Chart.defaults.borderColor = CHART_COLORS.grid;
Chart.defaults.font.family = "'DM Mono', monospace";
Chart.defaults.font.size = 11;

const charts = {};

// ── helper: destroy if exists ────────────────────────────
function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

// ── NAV History Line Chart ───────────────────────────────
function renderNavChart(navHistory, range) {
  let data = navHistory || STORE.navHistory || [];
  const now = new Date();
  if (range === '1M')  { const cut = new Date(now); cut.setMonth(cut.getMonth()-1);  data = data.filter(d => new Date(d.date) >= cut); }
  if (range === '3M')  { const cut = new Date(now); cut.setMonth(cut.getMonth()-3);  data = data.filter(d => new Date(d.date) >= cut); }
  if (range === '6M')  { const cut = new Date(now); cut.setMonth(cut.getMonth()-6);  data = data.filter(d => new Date(d.date) >= cut); }
  // 1Y = all

  const labels = data.map(d => d.date);
  const navVals = data.map(d => d.nav);
  const idxVals = data.map(d => {
    if (!d.indexVal) return null;
    // Normalise index to start at same NAV
    return null; // will be computed below
  });

  // Normalise index to same starting NAV
  const startNav = navVals[0] || 10;
  const startIdx = data[0]?.indexVal || 1;
  const normIdx = data.map(d => d.indexVal ? startNav * (d.indexVal / startIdx) : null);

  destroyChart('navChart');
  const ctx = document.getElementById('navChart');
  if (!ctx) return;

  charts.navChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Portfolio NAV',
          data: navVals,
          borderColor: CHART_COLORS.accent,
          backgroundColor: 'rgba(79,156,249,0.08)',
          fill: true,
          tension: 0.35,
          pointRadius: data.length > 24 ? 0 : 3,
          borderWidth: 2,
        },
        {
          label: 'NIFTY 100 (normalised)',
          data: normIdx,
          borderColor: CHART_COLORS.yellow,
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 1.5,
          borderDash: [4,3],
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 10, padding: 16 } },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ₹${ctx.parsed.y?.toFixed(2)}`,
          },
        },
      },
      scales: {
        x: { grid: { color: CHART_COLORS.grid }, ticks: { maxTicksLimit: 8 } },
        y: {
          grid: { color: CHART_COLORS.grid },
          ticks: { callback: v => '₹' + v.toFixed(2) },
        },
      },
    },
  });
}

// ── Sector Allocation Doughnut Chart ─────────────────────
function renderSectorChart(sectors) {
  destroyChart('sectorChart');
  const ctx = document.getElementById('sectorChart');
  if (!ctx || !sectors?.length) return;

  charts.sectorChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sectors.map(s => s.name),
      datasets: [{
        data: sectors.map(s => +s.pct.toFixed(2)),
        backgroundColor: SECTOR_PALETTE.slice(0, sectors.length),
        borderColor: '#111620',
        borderWidth: 2,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, padding: 10, font: { size: 10 } } },
        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed.toFixed(1)}%` } },
      },
    },
  });
}

// ── Portfolio vs Index Performance Bar Chart ─────────────
function renderPerfChart(navHistory) {
  destroyChart('perfChart');
  const ctx = document.getElementById('perfChart');
  if (!ctx) return;

  const periods = ['1W','1M','3M','6M','1Y'];
  const nav = navHistory || STORE.navHistory || [];

  function periodReturn(months, isWeek) {
    const cutoff = new Date();
    if (isWeek) cutoff.setDate(cutoff.getDate() - 7);
    else cutoff.setMonth(cutoff.getMonth() - months);

    const filtered = nav.filter(d => new Date(d.date) >= cutoff);
    if (filtered.length < 2) return { p: 0, i: 0 };
    const p0 = filtered[0].nav, p1 = filtered[filtered.length-1].nav;
    const i0 = filtered[0].indexVal || 1, i1 = filtered[filtered.length-1].indexVal || 1;
    return {
      p: ((p1-p0)/p0*100).toFixed(2),
      i: ((i1-i0)/i0*100).toFixed(2),
    };
  }

  const r1w = periodReturn(0, true);
  const r1m = periodReturn(1);
  const r3m = periodReturn(3);
  const r6m = periodReturn(6);
  const r1y = periodReturn(12);

  const pReturns = [r1w.p, r1m.p, r3m.p, r6m.p, r1y.p].map(Number);
  const iReturns = [r1w.i, r1m.i, r3m.i, r6m.i, r1y.i].map(Number);

  charts.perfChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: periods,
      datasets: [
        {
          label: 'Portfolio',
          data: pReturns,
          backgroundColor: pReturns.map(v => v >= 0 ? 'rgba(79,156,249,0.7)' : 'rgba(249,112,102,0.7)'),
          borderRadius: 4,
        },
        {
          label: 'NIFTY 100',
          data: iReturns,
          backgroundColor: iReturns.map(v => v >= 0 ? 'rgba(246,197,73,0.5)' : 'rgba(246,197,73,0.3)'),
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: 'index' },
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 10, padding: 14 } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(2)}%` } },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: CHART_COLORS.grid },
          ticks: { callback: v => v + '%' },
        },
      },
    },
  });
}

// ── Stock Allocation Horizontal Bar ──────────────────────
function renderAllocationChart(holdings) {
  destroyChart('allocationChart');
  const ctx = document.getElementById('allocationChart');
  if (!ctx || !holdings?.length) return;

  const total = holdings.reduce((s,h) => s + h.current, 0);
  const top = holdings.slice(0, 20);

  charts.allocationChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top.map(h => h.stock),
      datasets: [{
        data: top.map(h => +(h.current/total*100).toFixed(2)),
        backgroundColor: SECTOR_PALETTE[0],
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `Weight: ${ctx.parsed.x}%` } },
      },
      scales: {
        x: {
          grid: { color: CHART_COLORS.grid },
          ticks: { callback: v => v + '%' },
        },
        y: { grid: { display: false } },
      },
    },
  });
}

// ── Returns Comparison Chart (Analytics) ─────────────────
function renderReturnsChart(navHistory) {
  destroyChart('returnsChart');
  const ctx = document.getElementById('returnsChart');
  if (!ctx) return;
  // Same as perfChart but in analytics view
  renderPerfChartOn(ctx, navHistory, 'returnsChart');
}

function renderPerfChartOn(ctx, navHistory, key) {
  const nav = navHistory || STORE.navHistory || [];
  const periods = ['1W','1M','3M','6M','YTD','1Y'];

  function pReturn(days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const f = nav.filter(d => new Date(d.date) >= cutoff);
    if (f.length < 2) return { p:0, i:0 };
    const p = ((f[f.length-1].nav - f[0].nav)/f[0].nav*100);
    const i = ((f[f.length-1].indexVal - f[0].indexVal)/f[0].indexVal*100);
    return { p: +p.toFixed(2), i: +i.toFixed(2) };
  }

  const rs = [pReturn(7), pReturn(30), pReturn(90), pReturn(180), pReturn(180), pReturn(365)];
  const pR = rs.map(r => r.p);
  const iR = rs.map(r => r.i);

  charts[key] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: periods,
      datasets: [
        { label:'Portfolio', data: pR, backgroundColor:'rgba(79,156,249,0.75)', borderRadius:4 },
        { label:'NIFTY 100', data: iR, backgroundColor:'rgba(246,197,73,0.55)', borderRadius:4 },
      ],
    },
    options: {
      responsive:true,
      interaction:{ mode:'index' },
      plugins:{
        legend:{ position:'top', labels:{ boxWidth:10, padding:14 } },
        tooltip:{ callbacks:{ label: c => `${c.dataset.label}: ${c.parsed.y}%` } },
      },
      scales:{
        x:{ grid:{ display:false } },
        y:{ grid:{ color: CHART_COLORS.grid }, ticks:{ callback: v => v+'%' } },
      },
    },
  });
}

// ── Drawdown Chart ───────────────────────────────────────
function renderDrawdownChart(navHistory) {
  destroyChart('drawdownChart');
  const ctx = document.getElementById('drawdownChart');
  if (!ctx) return;

  const nav = navHistory || STORE.navHistory || [];
  let peak = -Infinity;
  const drawdowns = nav.map(d => {
    if (d.nav > peak) peak = d.nav;
    return peak > 0 ? -((peak - d.nav) / peak * 100) : 0;
  });

  charts.drawdownChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: nav.map(d => d.date),
      datasets: [{
        label: 'Drawdown %',
        data: drawdowns,
        borderColor: CHART_COLORS.red,
        backgroundColor: 'rgba(249,112,102,0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 1.5,
      }],
    },
    options: {
      responsive:true,
      plugins:{ legend:{ display:false } },
      scales:{
        x:{ grid:{ color: CHART_COLORS.grid }, ticks:{ maxTicksLimit:6 } },
        y:{
          grid:{ color: CHART_COLORS.grid },
          ticks:{ callback: v => v.toFixed(1)+'%' },
        },
      },
    },
  });
}

// ── current nav range ────────────────────────────────────
let currentNavRange = '1Y';
function setNavRange(range, btn) {
  currentNavRange = range;
  document.querySelectorAll('.chart-tabs .tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderNavChart(STORE.navHistory, range);
}
