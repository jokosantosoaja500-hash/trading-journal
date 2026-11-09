/**
 * Pro Trading Journal & SOP Manager - Google Apps Script Backend
 * 
 * SETUP:
 * 1. Salin semua isi di bawah ke https://script.google.com -> Projects baru
 * 2. Edit `ALLOWED_TOKENS` dengan token rahasia yang kamu gunakan
 * 3. Deploy -> New Deployment -> Select type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone (tanpa login)
 * 4. Klik Deploy, salin URL-nya ke aplikasi (modal Konfigurasi Drive)
 * 
 * ENDPOINT:
 *   GET /?action=ping          -> pong
 *   GET /?action=load&token=.. -> {"ok":true,"data":{...}} atau error
 *   POST /                      body: {action:"save", token:"...", data:{...}}
 */

var ALLOWED_TOKENS = ['journal-trader-secret']; // ganti sesuai konfigurasi
var MAX_HISTORY_DAYS = 30; // hapus history lama demi performa

function doGet(e) {
  var resp = { ok: false, error: 'Not found' };
  if (!e.parameters || !e.parameters.action) return buildResponse(resp);

  switch(e.parameters.action[0]) {
    case 'ping':
      resp = { ok: true, msg: 'pong', time: new Date().toISOString() };
      break;
    case 'load':
      if (verifyToken(e.parameters.token)) {
        resp = loadState();
      } else {
        resp = { ok: false, error: 'Unauthorized' };
      }
      break;
    default:
      resp = { ok: false, error: 'Unknown action: ' + e.parameters.action[0] };
  }
  return buildResponse(resp);
}

function doPost(e) {
  var req = parseBody(e);
  if (!req) return buildResponse({ ok: false, error: 'Bad request' });

  var resp;
  switch(req.action) {
    case 'save':
      if (!verifyToken(req.token)) {
        resp = { ok: false, error: 'Unauthorized' };
      } else {
        resp = saveState(req.data);
      }
      break;
    case 'ping':
      resp = { ok: true, msg: 'pong' };
      break;
    default:
      resp = { ok: false, error: 'Unknown action: ' + req.action };
  }
  return buildResponse(resp);
}

/* ---- helpers ---- */
function buildResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function verifyToken(t) {
  return ALLOWED_TOKENS.indexOf(t) !== -1;
}

function getState() {
  try {
    return JSON.parse(PropertiesService.getScriptProperties().getProperty('journal') || '{}');
  } catch(err) {
    return {};
  }
}

function saveToStore(data) {
  PropertiesService.getScriptProperties().setProperty('journal', JSON.stringify(data));
  PropertiesService.getScriptProperties().setProperty('updatedAt', new Date().toISOString());
  appendHistory('saved', data.transactions ? data.transactions.length : 0);
}

function loadState() {
  var s = getState();
  return { ok: true, data: s };
}

function saveState(data) {
  saveToStore(data);
  return { ok: true, msg: 'Saved', updatedAt: new Date().toISOString() };
}

function appendHistory(action, size) {
  try {
    var entries = PropertiesService.getScriptProperties().getProperty('history');
    var arr = entries ? JSON.parse(entries) : [];
    arr.unshift({ ts: new Date().toISOString(), action: action, trades: size });
    while (arr.length > MAX_HISTORY_DAYS * 2) arr.pop();
    PropertiesService.getScriptProperties().setProperty('history', JSON.stringify(arr));
  } catch(err) {}
}

function parseBody(e) {
  try {
    if (!e.postData) return null;
    return JSON.parse(e.postData.contents);
  } catch(err) {
    try {
      return e.postData ? { action: 'save', token: e.postData.parameters && e.postData.parameters.token,
        data: e.postData.contents } : null;
    } catch(e2) { return null; }
  }
}

// Setup guide untuk admin pertama kali
function onInstall() {
  onOpen();
}

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Trading Journal').addItem('Open App', 'openSetupGuide').addToUi();
}

function openSetupGuide() {
  var html = '<h2>Trading Journal &amp; SOP Manager</h2>'+
    '<p>Buka <a href="'+ScriptApp.getServiceUrl()+'" target="_blank">Web App</a> di tab baru.</p>'+
    '<p>Dan buka aplikasi di HP untuk mengatur sync dengan URL tersebut.</p>';
  HtmlService.createHtmlOutput(html).setTitle('Setup').setWidth(400).setHeight(250);
}
