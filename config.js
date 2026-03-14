/* ── config.js ── Portfolio Tracker Configuration ─────── */

const CONFIG = {
  // Google Apps Script web app URL (set via Settings page)
  apiUrl: localStorage.getItem('apiUrl') || '',

  // NAV calculation
  totalUnits: parseFloat(localStorage.getItem('totalUnits') || '50000'),
  initialNav: parseFloat(localStorage.getItem('initialNav') || '10'),
  riskFreeRate: parseFloat(localStorage.getItem('riskFreeRate') || '6.5'),

  // Auto-refresh interval in seconds
  refreshInterval: 60,
};

// ── NIFTY 100 target weights (top 30 by weight, illustrative) ──
const NIFTY100_WEIGHTS = {
  HDFCBANK:   8.5,
  RELIANCE:   7.8,
  ICICIBANK:  7.2,
  INFY:       5.4,
  TCS:        5.1,
  BHARTIARTL: 3.8,
  HINDUNILVR: 3.4,
  SBIN:       3.2,
  BAJFINANCE: 3.0,
  LT:         2.9,
  KOTAKBANK:  2.7,
  AXISBANK:   2.5,
  ASIANPAINT: 2.3,
  MARUTI:     2.2,
  TITAN:      2.1,
  WIPRO:      2.0,
  ONGC:       1.9,
  NESTLEIND:  1.8,
  ULTRACEMCO: 1.7,
  HCLTECH:    1.7,
  M_M:        1.6,
  POWERGRID:  1.5,
  NTPC:       1.4,
  SUNPHARMA:  1.3,
  ADANIPORTS: 1.2,
  TECHM:      1.2,
  TATAMOTORS: 1.1,
  HINDALCO:   1.0,
  JSWSTEEL:   1.0,
  GRASIM:     0.9,
};

// ── Sector mapping ──────────────────────────────────────
const SECTORS = {
  HDFCBANK:   'Banking',    ICICIBANK:  'Banking',
  SBIN:       'Banking',    KOTAKBANK:  'Banking',
  AXISBANK:   'Banking',    BAJFINANCE: 'NBFC',
  RELIANCE:   'Energy',     ONGC:       'Energy',
  NTPC:       'Energy',     POWERGRID:  'Utilities',
  INFY:       'IT',         TCS:        'IT',
  WIPRO:      'IT',         HCLTECH:    'IT',
  TECHM:      'IT',         LT:         'Capital Goods',
  BHARTIARTL: 'Telecom',    HINDUNILVR: 'FMCG',
  NESTLEIND:  'FMCG',       ASIANPAINT: 'Materials',
  ULTRACEMCO: 'Cement',     GRASIM:     'Cement',
  MARUTI:     'Auto',       TATAMOTORS: 'Auto',
  M_M:        'Auto',       TITAN:      'Consumer',
  SUNPHARMA:  'Pharma',     ADANIPORTS: 'Infra',
  HINDALCO:   'Metals',     JSWSTEEL:   'Metals',
};

// ── NIFTY 100 constituent list (for autocomplete) ────────
const NIFTY100_STOCKS = Object.keys(NIFTY100_WEIGHTS).concat([
  'ADANIENT','APOLLOHOSP','BAJAJ_AUTO','BAJAJFINSV','BPCL','BRITANNIA',
  'CIPLA','COALINDIA','DMART','DRREDDY','EICHERMOT','HDFCLIFE',
  'HEROMOTOCO','INDUSINDBK','ITC','LUPIN','PIDILITIND','SBILIFE',
  'SHREECEM','SIEMENS','TATACONSUM','TATASTEEL','TORNTPHARM','UPL','VEDL'
]);

// ── Sample portfolio data for demo ──────────────────────
const SAMPLE_TRANSACTIONS = [
  { date:'2024-01-15', stock:'RELIANCE',   action:'BUY',  qty:10, price:2450 },
  { date:'2024-01-15', stock:'HDFCBANK',   action:'BUY',  qty:20, price:1620 },
  { date:'2024-01-15', stock:'INFY',       action:'BUY',  qty:15, price:1750 },
  { date:'2024-01-20', stock:'TCS',        action:'BUY',  qty:8,  price:3900 },
  { date:'2024-02-01', stock:'ICICIBANK',  action:'BUY',  qty:30, price:1040 },
  { date:'2024-02-01', stock:'BAJFINANCE', action:'BUY',  qty:5,  price:6800 },
  { date:'2024-02-10', stock:'BHARTIARTL', action:'BUY',  qty:20, price:1200 },
  { date:'2024-02-15', stock:'HINDUNILVR', action:'BUY',  qty:10, price:2400 },
  { date:'2024-03-01', stock:'SBIN',       action:'BUY',  qty:40, price:760  },
  { date:'2024-03-05', stock:'LT',         action:'BUY',  qty:8,  price:3400 },
  { date:'2024-03-10', stock:'AXISBANK',   action:'BUY',  qty:25, price:1080 },
  { date:'2024-03-15', stock:'KOTAKBANK',  action:'BUY',  qty:12, price:1780 },
  { date:'2024-03-20', stock:'MARUTI',     action:'BUY',  qty:3,  price:11500},
  { date:'2024-04-01', stock:'TITAN',      action:'BUY',  qty:10, price:3600 },
  { date:'2024-04-05', stock:'WIPRO',      action:'BUY',  qty:25, price:560  },
  { date:'2024-04-10', stock:'ONGC',       action:'BUY',  qty:30, price:280  },
  { date:'2024-04-15', stock:'NESTLEIND',  action:'BUY',  qty:3,  price:24000},
  { date:'2024-05-01', stock:'ULTRACEMCO', action:'BUY',  qty:5,  price:9200 },
  { date:'2024-05-10', stock:'HCLTECH',    action:'BUY',  qty:15, price:1380 },
  { date:'2024-05-15', stock:'M_M',        action:'BUY',  qty:10, price:2100 },
  { date:'2024-06-01', stock:'RELIANCE',   action:'SELL', qty:2,  price:2700 },
  { date:'2024-06-15', stock:'POWERGRID',  action:'BUY',  qty:40, price:290  },
  { date:'2024-07-01', stock:'NTPC',       action:'BUY',  qty:35, price:350  },
  { date:'2024-07-10', stock:'SUNPHARMA',  action:'BUY',  qty:8,  price:1500 },
  { date:'2024-08-01', stock:'ADANIPORTS', action:'BUY',  qty:15, price:1400 },
  { date:'2024-08-15', stock:'TECHM',      action:'BUY',  qty:15, price:1350 },
  { date:'2024-09-01', stock:'TATAMOTORS', action:'BUY',  qty:20, price:1050 },
  { date:'2024-09-15', stock:'HINDALCO',   action:'BUY',  qty:30, price:680  },
  { date:'2024-10-01', stock:'JSWSTEEL',   action:'BUY',  qty:20, price:930  },
  { date:'2024-10-10', stock:'GRASIM',     action:'BUY',  qty:8,  price:2600 },
  { date:'2024-11-01', stock:'INFY',       action:'SELL', qty:5,  price:1920 },
  { date:'2024-12-01', stock:'HDFCBANK',   action:'BUY',  qty:10, price:1710 },
];

// ── Simulated live prices (used when no API configured) ─
const SAMPLE_PRICES = {
  RELIANCE:2890, HDFCBANK:1750, INFY:1880, TCS:4100,
  ICICIBANK:1150, BAJFINANCE:7200, BHARTIARTL:1380, HINDUNILVR:2550,
  SBIN:820, LT:3700, AXISBANK:1180, KOTAKBANK:1850, MARUTI:12200,
  TITAN:3900, WIPRO:590, ONGC:310, NESTLEIND:24500, ULTRACEMCO:9800,
  HCLTECH:1480, M_M:2350, POWERGRID:310, NTPC:370, SUNPHARMA:1650,
  ADANIPORTS:1480, TECHM:1420, TATAMOTORS:1100, HINDALCO:720,
  JSWSTEEL:980, GRASIM:2750,
};

// ── Simulated NAV history (12 months) ───────────────────
function generateNavHistory(months = 12) {
  const history = [];
  let nav = 10.0;
  let indexVal = 19500;
  const now = new Date();
  for (let i = months; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    const portfolioReturn = (Math.random() - 0.46) * 0.03;
    const indexReturn = (Math.random() - 0.47) * 0.025;
    nav = +(nav * (1 + portfolioReturn)).toFixed(4);
    indexVal = +(indexVal * (1 + indexReturn)).toFixed(2);
    history.push({
      date: d.toISOString().slice(0,7),
      nav,
      indexVal,
    });
  }
  return history;
}
