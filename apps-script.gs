// ═══════════════════════════════════════════════════════════
// NIFTY 100 Portfolio Tracker — Google Apps Script Backend
// ───────────────────────────────────────────────────────────
// Deploy as: Web App → Execute as: Me → Access: Anyone
// ═══════════════════════════════════════════════════════════

const SS = SpreadsheetApp.getActiveSpreadsheet();

// ── CORS Headers ─────────────────────────────────────────
function addCORS(output) {
  return output
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── doGet: Main API dispatcher ───────────────────────────
function doGet(e) {
  const action = e.parameter.action || 'all';
  let result;

  try {
    switch (action) {
      case 'ping':         result = { status: 'ok', ts: new Date().toISOString() }; break;
      case 'transactions': result = getTransactions(); break;
      case 'portfolio':    result = getPortfolio(); break;
      case 'summary':      result = getSummary(); break;
      case 'nav':          result = getNavHistory(); break;
      case 'prices':       result = getPrices(); break;
      case 'all':          result = getAllData(); break;
      default:             result = { error: 'Unknown action' };
    }
  } catch (err) {
    result = { error: err.message };
  }

  return addCORS(
    ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON)
  );
}

// ── doPost: Add transaction ──────────────────────────────
function doPost(e) {
  const action = e.parameter.action || '';
  let result;

  try {
    if (action === 'addTransaction') {
      const tx = JSON.parse(e.postData.contents);
      result = addTransaction(tx);
    } else {
      result = { error: 'Unknown action' };
    }
  } catch (err) {
    result = { error: err.message };
  }

  return addCORS(
    ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON)
  );
}

// ═══════════════════════════════════════════════════════════
// DATA FUNCTIONS
// ═══════════════════════════════════════════════════════════

// ── Get all data in one call (efficient) ─────────────────
function getAllData() {
  return {
    transactions: getTransactions(),
    prices:       getPrices(),
    navHistory:   getNavHistory(),
    indexPrice:   getIndexPrice(),
    portfolio:    getPortfolio(),
    summary:      getSummary(),
  };
}

// ── Transactions ─────────────────────────────────────────
function getTransactions() {
  const sheet = SS.getSheetByName('Transactions');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h).toLowerCase().trim());
  return data.slice(1)
    .filter(row => row[0] !== '')
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        let v = row[i];
        if (v instanceof Date) v = Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        obj[h] = v;
      });
      return obj;
    });
}

function addTransaction(tx) {
  const sheet = SS.getSheetByName('Transactions');
  if (!sheet) throw new Error('Transactions sheet not found');

  const date  = tx.date   || '';
  const stock = (tx.stock || '').toUpperCase();
  const action= (tx.action|| 'BUY').toUpperCase();
  const qty   = parseFloat(tx.qty)   || 0;
  const price = parseFloat(tx.price) || 0;
  const amount= action === 'BUY' ? -(qty * price) : qty * price;

  sheet.appendRow([date, stock, action, qty, price, amount]);

  // Trigger holdings update
  updateHoldings();
  updatePortfolio();
  updateNAV();

  return { success: true, message: `${action} ${qty} ${stock} @ ₹${price} added` };
}

// ── Live prices from MarketData sheet ───────────────────
function getPrices() {
  const sheet = SS.getSheetByName('MarketData');
  if (!sheet) return {};
  const data = sheet.getDataRange().getValues();
  const prices = {};
  data.slice(1).forEach(row => {
    const symbol = String(row[0]).trim();
    const price  = parseFloat(row[1]) || 0;
    if (symbol && price > 0) prices[symbol] = price;
  });
  return prices;
}

// ── Portfolio holdings ───────────────────────────────────
function getPortfolio() {
  const sheet = SS.getSheetByName('Portfolio');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h).toLowerCase().trim());
  return data.slice(1).filter(r => r[0] !== '').map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

// ── Summary metrics ──────────────────────────────────────
function getSummary() {
  const navSheet = SS.getSheetByName('NAV');
  if (!navSheet) return {};
  const data = navSheet.getDataRange().getValues();
  const obj = {};
  data.forEach(row => {
    if (row[0] && row[1] !== '') obj[String(row[0]).trim()] = row[1];
  });
  return obj;
}

// ── NAV history ──────────────────────────────────────────
function getNavHistory() {
  const sheet = SS.getSheetByName('NAVHistory');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  return data.slice(1).filter(r => r[0] !== '').map(row => ({
    date: row[0] instanceof Date
      ? Utilities.formatDate(row[0], Session.getScriptTimeZone(), 'yyyy-MM')
      : String(row[0]),
    nav:      parseFloat(row[1]) || 0,
    indexVal: parseFloat(row[2]) || 0,
  }));
}

// ── Index price ──────────────────────────────────────────
function getIndexPrice() {
  const sheet = SS.getSheetByName('Index');
  if (!sheet) return 0;
  return parseFloat(sheet.getRange('B1').getValue()) || 0;
}

// ═══════════════════════════════════════════════════════════
// SHEET FORMULAS & SETUP
// ═══════════════════════════════════════════════════════════

// ── Build all sheets ─────────────────────────────────────
function setupSheets() {
  createTransactionsSheet();
  createMarketDataSheet();
  createHoldingsSheet();
  createPortfolioSheet();
  createNAVSheet();
  createNAVHistorySheet();
  createCashFlowSheet();
  createIndexSheet();
  SpreadsheetApp.flush();
  Browser.msgBox('✓ All sheets created! Add your stocks to MarketData and start trading.');
}

function createTransactionsSheet() {
  let s = SS.getSheetByName('Transactions');
  if (!s) s = SS.insertSheet('Transactions');
  s.clearContents();
  s.getRange('A1:F1').setValues([['Date','Stock','Action','Quantity','Price','Amount']]);
  s.getRange('A1:F1').setFontWeight('bold').setBackground('#1a237e').setFontColor('#ffffff');
  // Amount formula for row 2
  s.getRange('F2').setFormula('=IF(C2="BUY",-D2*E2,D2*E2)');
  s.setColumnWidth(1, 100); s.setColumnWidth(2, 120);
  s.setColumnWidth(3, 80); s.setColumnWidth(4, 80);
  s.setColumnWidth(5, 100); s.setColumnWidth(6, 120);
}

function createMarketDataSheet() {
  let s = SS.getSheetByName('MarketData');
  if (!s) s = SS.insertSheet('MarketData');
  s.clearContents();
  s.getRange('A1:B1').setValues([['Stock','Price']]);
  s.getRange('A1:B1').setFontWeight('bold').setBackground('#1b5e20').setFontColor('#ffffff');

  // Pre-fill NIFTY 100 top stocks
  const stocks = [
    'HDFCBANK','RELIANCE','ICICIBANK','INFY','TCS','BHARTIARTL','HINDUNILVR',
    'SBIN','BAJFINANCE','LT','KOTAKBANK','AXISBANK','ASIANPAINT','MARUTI',
    'TITAN','WIPRO','ONGC','NESTLEIND','ULTRACEMCO','HCLTECH','M_M',
    'POWERGRID','NTPC','SUNPHARMA','ADANIPORTS','TECHM','TATAMOTORS','HINDALCO','JSWSTEEL','GRASIM'
  ];

  stocks.forEach((stock, i) => {
    const row = i + 2;
    s.getRange(`A${row}`).setValue(stock);
    s.getRange(`B${row}`).setFormula(`=GOOGLEFINANCE("NSE:"&A${row},"price")`);
  });
  s.setColumnWidth(1, 120); s.setColumnWidth(2, 100);
}

function createHoldingsSheet() {
  let s = SS.getSheetByName('Holdings');
  if (!s) s = SS.insertSheet('Holdings');
  s.clearContents();
  s.getRange('A1:B1').setValues([['Stock','Quantity']]);
  s.getRange('A1:B1').setFontWeight('bold').setBackground('#4a148c').setFontColor('#ffffff');
}

function createPortfolioSheet() {
  let s = SS.getSheetByName('Portfolio');
  if (!s) s = SS.insertSheet('Portfolio');
  s.clearContents();
  s.getRange('A1:D1').setValues([['Stock','Quantity','Price','Value']]);
  s.getRange('A1:D1').setFontWeight('bold').setBackground('#e65100').setFontColor('#ffffff');
}

function createNAVSheet() {
  let s = SS.getSheetByName('NAV');
  if (!s) s = SS.insertSheet('NAV');
  s.clearContents();
  s.getRange('A1:B6').setValues([
    ['Metric','Value'],
    ['Portfolio Value', 0],
    ['Total Units', 50000],
    ['NAV', '=B2/B3'],
    ['Initial NAV', 10],
    ['NAV Change %', '=(B4-B5)/B5*100'],
  ]);
  s.getRange('A1:B1').setFontWeight('bold').setBackground('#006064').setFontColor('#ffffff');
}

function createNAVHistorySheet() {
  let s = SS.getSheetByName('NAVHistory');
  if (!s) s = SS.insertSheet('NAVHistory');
  s.clearContents();
  s.getRange('A1:C1').setValues([['Date','NAV','IndexValue']]);
  s.getRange('A1:C1').setFontWeight('bold').setBackground('#1a237e').setFontColor('#ffffff');
}

function createCashFlowSheet() {
  let s = SS.getSheetByName('CashFlow');
  if (!s) s = SS.insertSheet('CashFlow');
  s.clearContents();
  s.getRange('A1:B1').setValues([['Date','CashFlow']]);
  s.getRange('A1:B1').setFontWeight('bold').setBackground('#880e4f').setFontColor('#ffffff');
  // XIRR formula placeholder
  s.getRange('D1').setValue('XIRR');
  s.getRange('D2').setFormula('=XIRR(B2:B100,A2:A100)');
}

function createIndexSheet() {
  let s = SS.getSheetByName('Index');
  if (!s) s = SS.insertSheet('Index');
  s.clearContents();
  s.getRange('A1:B1').setValues([['Index','Price']]);
  s.getRange('A1:B1').setFontWeight('bold').setBackground('#311b92').setFontColor('#ffffff');
  s.getRange('A2').setValue('NIFTY 100');
  s.getRange('B2').setFormula('=GOOGLEFINANCE("NSE:NIFTY 100","price")');
  // Also store in B1 for easy API access
  s.getRange('B1').setFormula('=B2');
}

// ═══════════════════════════════════════════════════════════
// COMPUTED UPDATES (called after each transaction)
// ═══════════════════════════════════════════════════════════

function updateHoldings() {
  const txSheet = SS.getSheetByName('Transactions');
  const holdSheet = SS.getSheetByName('Holdings');
  if (!txSheet || !holdSheet) return;

  const txData = txSheet.getDataRange().getValues().slice(1).filter(r => r[0] !== '');
  const holdings = {};

  txData.forEach(row => {
    const stock  = String(row[1]).trim();
    const action = String(row[2]).trim().toUpperCase();
    const qty    = parseFloat(row[3]) || 0;
    if (!stock) return;
    holdings[stock] = (holdings[stock] || 0) + (action === 'BUY' ? qty : -qty);
  });

  holdSheet.clearContents();
  holdSheet.getRange('A1:B1').setValues([['Stock','Quantity']]);
  holdSheet.getRange('A1:B1').setFontWeight('bold').setBackground('#4a148c').setFontColor('#ffffff');

  let row = 2;
  for (const [stock, qty] of Object.entries(holdings)) {
    if (qty > 0) {
      holdSheet.getRange(row, 1, 1, 2).setValues([[stock, qty]]);
      row++;
    }
  }
}

function updatePortfolio() {
  const holdSheet    = SS.getSheetByName('Holdings');
  const mktSheet     = SS.getSheetByName('MarketData');
  const portSheet    = SS.getSheetByName('Portfolio');
  if (!holdSheet || !mktSheet || !portSheet) return;

  const holdings = holdSheet.getDataRange().getValues().slice(1).filter(r => r[0] !== '');
  const mktData  = mktSheet.getDataRange().getValues().slice(1);
  const priceMap = {};
  mktData.forEach(r => { if (r[0]) priceMap[String(r[0]).trim()] = parseFloat(r[1]) || 0; });

  portSheet.clearContents();
  portSheet.getRange('A1:D1').setValues([['Stock','Quantity','Price','Value']]);
  portSheet.getRange('A1:D1').setFontWeight('bold').setBackground('#e65100').setFontColor('#ffffff');

  let totalValue = 0;
  holdings.forEach((row, i) => {
    const stock = String(row[0]).trim();
    const qty   = parseFloat(row[1]) || 0;
    const price = priceMap[stock] || 0;
    const value = qty * price;
    totalValue += value;
    portSheet.getRange(i + 2, 1, 1, 4).setValues([[stock, qty, price, value]]);
  });

  // Write total
  const lastRow = holdings.length + 2;
  portSheet.getRange(lastRow, 3).setValue('TOTAL');
  portSheet.getRange(lastRow, 4).setValue(totalValue);
  portSheet.getRange(lastRow, 3, 1, 2).setFontWeight('bold');
}

function updateNAV() {
  const portSheet = SS.getSheetByName('Portfolio');
  const navSheet  = SS.getSheetByName('NAV');
  if (!portSheet || !navSheet) return;

  const data = portSheet.getDataRange().getValues();
  const totalRow = data[data.length - 1];
  const totalValue = parseFloat(totalRow[3]) || 0;

  navSheet.getRange('B2').setValue(totalValue);
  SpreadsheetApp.flush();

  // Append to NAV history
  const histSheet = SS.getSheetByName('NAVHistory');
  if (histSheet) {
    const nav      = navSheet.getRange('B4').getValue();
    const indexPx  = getIndexPrice();
    const today    = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    histSheet.appendRow([today, nav, indexPx]);
  }
}

// ── Time-driven trigger: update portfolio every hour ─────
function createTrigger() {
  // Run this once to set up hourly refresh
  ScriptApp.newTrigger('updatePortfolio')
    .timeBased()
    .everyHours(1)
    .create();

  ScriptApp.newTrigger('updateNAV')
    .timeBased()
    .everyHours(1)
    .create();
}
