/**
 * 【情緒宣導活動】報到 / 兌換碼 / 領取驗證 後端（Google Apps Script，綁定在報到試算表）
 *
 * 功能：
 *  1. 活動網頁報到 API（doPost）：寫入「報到名單」→ 產生兌換碼 → 發送三竹簡訊 → 回傳兌換碼
 *  2. 兌換碼驗證 API（doGet ?action=verify&code=...）：活動網頁用來確認兌換碼有效
 *  3. 備用 Google 表單（onFormSubmit）：表單送出的資料同樣寫入「報到名單」
 *  4. 工作人員領取驗證頁（doGet 無參數）：需輸入工作人員密碼，可用手機末3碼或兌換碼查詢
 *
 * ⚠️ 帳號密碼一律放在「專案設定 → 指令碼屬性」，不要寫在程式碼裡：
 *    MITAKE_USERNAME   三竹帳號
 *    MITAKE_PASSWORD   三竹密碼
 *    STAFF_PIN         工作人員驗證頁密碼（建議 6 位數以上）
 *    MAX_CODES         （選填）兌換碼發放上限，預設 300
 *
 * ⚠️ 名稱結尾有底線（例如 sendSms_）的函式是「私有函式」，外部無法透過網頁呼叫。
 *    會花費簡訊點數或改動資料的函式都必須是私有的，請勿移除底線。
 */

// ============ 設定 ============
const REG_SHEET_NAME = '報到名單';      // 所有報到資料的工作表（setup() 會自動建立）
const FORM_SHEET_NAME = '表單回應 1';   // 備用 Google 表單連結的回應工作表名稱
const CODE_PREFIX = 'SEM';
const DEFAULT_MAX_CODES = 300;
const TIME_ZONE = 'Asia/Taipei';
const MITAKE_DOMAIN = 'smsb2c.mitake.com.tw';

const SMS_TEMPLATE = `【修平科大 - 特殊教育宣導-給情緒喘口氣】
兌換碼：{CODE}
領取時間：09:00-13:00
地點：微風廣場-資源教室攤位
備註：數量有限，發完為止
請勿轉發此訊息`;

// 報到名單欄位（1-based）
const COL = { TIME: 1, NAME: 2, IDENTITY: 3, PHONE: 4, CODE: 5, SMS: 6, PICKED: 7, PICKED_AT: 8, SOURCE: 9 };
const HEADERS = ['時間戳記', '姓名', '身分', '手機', '兌換碼', '簡訊狀態', '領取狀態', '領取時間', '來源'];
const PICKED_MARK = '已領';

// ============ 初始設定（在編輯器手動執行一次）============

/** 建立「報到名單」工作表與標題列，並把手機欄設為純文字（避免開頭的 0 被吃掉）。重複執行沒有影響。 */
function setup() {
  const sheet = getRegSheet_();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.getRange('D:E').setNumberFormat('@');
  Logger.log('✅ 已建立／確認工作表：' + REG_SHEET_NAME);
  const props = PropertiesService.getScriptProperties();
  ['MITAKE_USERNAME', 'MITAKE_PASSWORD', 'STAFF_PIN'].forEach(k => {
    Logger.log((props.getProperty(k) ? '✅ 已設定 ' : '❌ 尚未設定 ') + k);
  });
}

/** 查詢三竹剩餘點數，確認帳密正確（不會發送簡訊、不花點數）。結果請看執行紀錄。 */
function testConnection() {
  const { username, password } = getMitakeCredentials_();
  const url = 'https://' + MITAKE_DOMAIN + '/b2c/mtk/SmQuery';
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    payload: { username: username, password: password },
    muteHttpExceptions: true,
  });
  Logger.log('HTTP ' + res.getResponseCode() + '\n' + res.getContentText());
}

// ============ 網頁進入點 ============

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'verify') {
    return json_(verifyCode_(e.parameter.code));
  }
  return HtmlService.createHtmlOutput(getStaffPageHtml_())
    .setTitle('情緒宣導活動 - 領取驗證系統')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action === 'register') {
      return json_(registerParticipant_(body.name, body.identity, body.phone, '活動網頁'));
    }
    return json_({ ok: false, error: 'unknown_action' });
  } catch (err) {
    Logger.log('doPost 錯誤：' + err.message);
    return json_({ ok: false, error: 'server' });
  }
}

// ============ 備用 Google 表單 ============

/**
 * 可安裝觸發條件：從試算表 →「提交表單時」執行。
 * 只接受真正的表單事件（必須有工作表 Range 物件），外部無法冒用來發簡訊。
 */
function onFormSubmit(e) {
  if (!e || !e.range || typeof e.range.getSheet !== 'function') return;
  if (e.range.getSheet().getName() !== FORM_SHEET_NAME) return;
  const values = e.values || [];
  const result = registerParticipant_(values[1], values[2], values[3], 'Google表單');
  Logger.log('表單報到：' + JSON.stringify(result));
}

// ============ 報到核心邏輯 ============

function registerParticipant_(rawName, rawIdentity, rawPhone, source) {
  const name = String(rawName || '').trim().slice(0, 40);
  const identity = String(rawIdentity || '').trim().slice(0, 40);
  const phone = normalizePhone_(rawPhone);
  if (!name) return { ok: false, error: 'invalid_name' };
  if (!identity) return { ok: false, error: 'invalid_identity' };
  if (!phone) return { ok: false, error: 'invalid_phone' };

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'busy' };

  let code;
  let row;
  try {
    const sheet = getRegSheet_();
    const data = sheet.getDataRange().getValues();

    // 同一支手機只能報到一次；姓名相同視為本人重新開啟，回傳原本的兌換碼
    for (let i = 1; i < data.length; i++) {
      if (normalizePhone_(data[i][COL.PHONE - 1]) === phone) {
        const sameName = String(data[i][COL.NAME - 1]).trim().toLowerCase() === name.toLowerCase();
        return sameName
          ? { ok: true, status: 'existing', code: String(data[i][COL.CODE - 1]) }
          : { ok: false, error: 'phone_taken' };
      }
    }

    const maxCodes = Number(PropertiesService.getScriptProperties().getProperty('MAX_CODES')) || DEFAULT_MAX_CODES;
    if (data.length - 1 >= maxCodes) return { ok: false, error: 'full' };

    // 取現有最大號碼 + 1（就算中途刪除某一列，也不會產生重複的兌換碼）
    let maxNum = 0;
    for (let i = 1; i < data.length; i++) {
      const m = String(data[i][COL.CODE - 1]).match(/(\d+)$/);
      if (m) maxNum = Math.max(maxNum, Number(m[1]));
    }
    row = data.length + 1;
    code = CODE_PREFIX + String(maxNum + 1).padStart(3, '0');
    const timestamp = Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy/MM/dd HH:mm:ss');
    sheet.getRange(row, COL.PHONE, 1, 2).setNumberFormat('@');
    sheet.getRange(row, 1, 1, HEADERS.length).setValues([[
      timestamp, name, identity, phone, code, '發送中', '', '', source,
    ]]);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  // 簡訊在鎖外發送，避免同時報到的人互相等待
  const sms = sendSms_(phone, code);
  getRegSheet_().getRange(row, COL.SMS).setValue(sms.ok ? '✓ 已發送' : '✗ 失敗（' + sms.detail + '）');
  return { ok: true, status: 'new', code: code, sms: sms.ok };
}

function verifyCode_(rawCode) {
  const code = normalizeCode_(rawCode);
  if (!code) return { ok: false };
  const codes = getRegSheet_().getRange(2, COL.CODE, Math.max(getRegSheet_().getLastRow() - 1, 1), 1).getValues();
  return { ok: codes.some(r => String(r[0]) === code), code: code };
}

// ============ 三竹簡訊 ============

function sendSms_(phone, code) {
  try {
    const { username, password } = getMitakeCredentials_();
    const res = UrlFetchApp.fetch('https://' + MITAKE_DOMAIN + '/b2c/mtk/SmSend?CharsetURL=UTF8', {
      method: 'post',
      payload: {
        username: username,
        password: password,
        dstaddr: phone,
        smbody: SMS_TEMPLATE.replace('{CODE}', code),
        clientid: Utilities.getUuid().replace(/-/g, '').slice(0, 20),
      },
      muteHttpExceptions: true,
      followRedirects: false,
    });
    const text = res.getContentText();
    const match = text.match(/statuscode=(\w+)/);
    const status = match ? match[1] : 'none';
    // 三竹 statuscode：0 預約、1/2 已送達業者、4 已送達手機 = 成功；其他（如 e 帳密錯誤、k 無效號碼）= 失敗
    const ok = res.getResponseCode() === 200 && ['0', '1', '2', '4'].indexOf(status) !== -1;
    if (!ok) Logger.log('簡訊失敗 ' + phone.slice(-3) + '：HTTP ' + res.getResponseCode() + ' ' + text);
    return { ok: ok, detail: 'statuscode=' + status };
  } catch (err) {
    Logger.log('簡訊例外：' + err.message);
    return { ok: false, detail: err.message.slice(0, 40) };
  }
}

function getMitakeCredentials_() {
  const props = PropertiesService.getScriptProperties();
  const username = props.getProperty('MITAKE_USERNAME');
  const password = props.getProperty('MITAKE_PASSWORD');
  if (!username || !password) throw new Error('尚未在指令碼屬性設定 MITAKE_USERNAME / MITAKE_PASSWORD');
  return { username: username, password: password };
}

// ============ 工作人員領取驗證（由網頁 google.script.run 呼叫，必須帶密碼）============

function staffLogin(pin) {
  return { ok: isStaff_(pin) };
}

/** query：手機末3碼（如 400）或兌換碼（如 SEM012、12） */
function staffSearch(pin, query) {
  if (!isStaff_(pin)) return { ok: false, error: 'auth' };
  const q = String(query || '').trim();
  const byPhone = /^\d{3}$/.test(q);
  const code = byPhone ? null : normalizeCode_(q);
  if (!byPhone && !code) return { ok: false, error: 'format' };

  const data = getRegSheet_().getDataRange().getValues();
  const results = [];
  for (let i = 1; i < data.length; i++) {
    const phone = normalizePhone_(data[i][COL.PHONE - 1]) || String(data[i][COL.PHONE - 1]);
    const rowCode = String(data[i][COL.CODE - 1]);
    if (byPhone ? phone.slice(-3) === q : rowCode === code) {
      results.push({
        row: i + 1,
        name: String(data[i][COL.NAME - 1]),
        identity: String(data[i][COL.IDENTITY - 1]),
        phone: maskPhone_(phone),
        code: rowCode,
        picked: data[i][COL.PICKED - 1] === PICKED_MARK,
        pickedAt: formatCell_(data[i][COL.PICKED_AT - 1]),
      });
    }
  }
  return { ok: true, results: results };
}

function staffConfirmPickup(pin, row) {
  if (!isStaff_(pin)) return { ok: false, error: 'auth' };
  const sheet = getRegSheet_();
  row = Number(row);
  if (!Number.isInteger(row) || row < 2 || row > sheet.getLastRow()) return { ok: false, error: 'row' };

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: 'busy' };
  try {
    // 寫入前再確認一次，避免兩台裝置同時按下確認
    const current = sheet.getRange(row, COL.PICKED, 1, 2).getValues()[0];
    if (current[0] === PICKED_MARK) return { ok: false, error: 'already', pickedAt: formatCell_(current[1]) };
    const time = Utilities.formatDate(new Date(), TIME_ZONE, 'HH:mm');
    sheet.getRange(row, COL.PICKED, 1, 2).setValues([[PICKED_MARK, time]]);
    return { ok: true, pickedAt: time };
  } finally {
    lock.releaseLock();
  }
}

function isStaff_(pin) {
  const expected = PropertiesService.getScriptProperties().getProperty('STAFF_PIN');
  if (!expected) return false;
  // 放慢暴力猜測
  if (String(pin || '') !== expected) {
    Utilities.sleep(800);
    return false;
  }
  return true;
}

// ============ 小工具 ============

function getRegSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(REG_SHEET_NAME) || ss.insertSheet(REG_SHEET_NAME);
}

/** 統一成 09 開頭 10 碼；接受 0912-345-678、+886912345678、912345678（開頭 0 被試算表吃掉）等格式 */
function normalizePhone_(raw) {
  let d = String(raw === undefined || raw === null ? '' : raw).replace(/\D/g, '');
  if (d.indexOf('886') === 0) d = d.slice(3);
  if (d.length === 9 && d[0] === '9') d = '0' + d;
  return /^09\d{8}$/.test(d) ? d : '';
}

/** SEM012、sem12、12 → SEM012 */
function normalizeCode_(raw) {
  const m = String(raw || '').trim().toUpperCase().match(/^(?:SEM)?\s*0*(\d{1,4})$/);
  return m ? CODE_PREFIX + m[1].padStart(3, '0') : '';
}

function maskPhone_(phone) {
  return phone.length === 10 ? phone.slice(0, 4) + '-***-' + phone.slice(7) : phone;
}

function formatCell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TIME_ZONE, 'HH:mm');
  return String(v || '');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ============ 工作人員頁面 ============

function getStaffPageHtml_() {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, 'Segoe UI', 'Microsoft JhengHei', sans-serif; background: linear-gradient(135deg, #f0fdfa 0%, #e8f4f8 100%); min-height: 100vh; display: flex; justify-content: center; align-items: flex-start; padding: 24px 16px; color: #1f2937; }
  .container { background: #fff; border-radius: 20px; box-shadow: 0 4px 20px rgba(13,148,136,.12); max-width: 480px; width: 100%; padding: 28px 22px; }
  h1 { color: #0f766e; font-size: 22px; text-align: center; margin-bottom: 4px; }
  .sub { color: #6b7280; font-size: 14px; text-align: center; margin-bottom: 22px; }
  .row { display: flex; gap: 10px; }
  input { flex: 1; padding: 14px 16px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 18px; text-align: center; letter-spacing: 1px; min-width: 0; }
  input:focus { outline: none; border-color: #14b8a6; }
  button { padding: 14px 20px; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; min-height: 52px; }
  .primary { background: #0d9488; color: #fff; }
  .primary:disabled, .confirm:disabled { background: #d1d5db; cursor: not-allowed; }
  .confirm { background: #16a34a; color: #fff; flex: 2; }
  .ghost { background: #f3f4f6; color: #4b5563; flex: 1; }
  .hint { font-size: 13px; color: #6b7280; margin-top: 8px; text-align: center; }
  .msg { padding: 14px; border-radius: 12px; margin-top: 18px; font-size: 15px; }
  .msg.info { background: #f0fdfa; color: #115e59; }
  .msg.error { background: #fef2f2; color: #b91c1c; }
  .msg.success { background: #f0fdf4; color: #15803d; font-weight: 600; }
  .item { border: 2px solid #e5e7eb; border-radius: 12px; padding: 14px; margin-top: 10px; cursor: pointer; }
  .item.sel { border-color: #14b8a6; background: #f0fdfa; }
  .card { background: #f9fafb; border-radius: 12px; padding: 6px 16px; margin-top: 16px; border: 1px solid #e5e7eb; }
  .kv { display: flex; justify-content: space-between; padding: 11px 0; border-bottom: 1px dashed #e5e7eb; gap: 12px; }
  .kv:last-child { border-bottom: none; }
  .k { color: #6b7280; font-weight: 600; }
  .v { font-weight: 600; text-align: right; word-break: break-all; }
  .code { color: #0f766e; font-size: 20px; }
  .tag { padding: 4px 10px; border-radius: 999px; font-size: 13px; }
  .tag.no { background: #fef3c7; color: #92400e; }
  .tag.yes { background: #dcfce7; color: #166534; }
  .actions { display: flex; gap: 10px; margin-top: 16px; }
  .hidden { display: none; }
  .logout { background: none; color: #9ca3af; font-size: 13px; min-height: 0; padding: 12px 0 0; width: 100%; font-weight: 400; }
</style>
</head>
<body>
<div class="container">
  <h1>📋 領取驗證系統</h1>
  <p class="sub">修平科大 - 特殊教育宣導「給情緒喘口氣」</p>

  <div id="loginView">
    <div class="row">
      <input id="pinInput" type="password" inputmode="numeric" autocomplete="off" placeholder="工作人員密碼">
      <button class="primary" id="loginBtn">登入</button>
    </div>
  </div>

  <div id="mainView" class="hidden">
    <div class="row">
      <input id="queryInput" type="text" autocomplete="off" placeholder="兌換碼或手機末3碼">
      <button class="primary" id="searchBtn">搜尋</button>
    </div>
    <p class="hint">例：SEM012、12（兌換碼）或 400（手機末3碼）</p>
    <div id="out"></div>
    <button class="logout" id="logoutBtn">登出</button>
  </div>
</div>

<script>
  var pin = sessionStorage.getItem('staffPin') || '';
  var results = [];
  var selected = null;
  var $ = function (id) { return document.getElementById(id); };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;   // 一律用 textContent，避免插入惡意內容
    return n;
  }
  function msg(text, type) {
    var out = $('out');
    out.innerHTML = '';
    out.appendChild(el('div', 'msg ' + type, text));
  }
  function call(fn, args, onOk) {
    var runner = google.script.run
      .withSuccessHandler(onOk)
      .withFailureHandler(function (err) { msg('連線失敗，請再試一次（' + (err && err.message) + '）', 'error'); });
    runner[fn].apply(runner, args);
  }

  function showMain() {
    $('loginView').classList.add('hidden');
    $('mainView').classList.remove('hidden');
    $('queryInput').focus();
  }
  function login() {
    var value = $('pinInput').value.trim();
    if (!value) return;
    $('loginBtn').disabled = true;
    call('staffLogin', [value], function (r) {
      $('loginBtn').disabled = false;
      if (r && r.ok) { pin = value; sessionStorage.setItem('staffPin', pin); showMain(); }
      else { $('pinInput').value = ''; alert('密碼錯誤'); }
    });
  }
  function logout() {
    sessionStorage.removeItem('staffPin');
    location.reload();
  }

  function search() {
    var q = $('queryInput').value.trim();
    if (!q) return;
    msg('搜尋中…', 'info');
    $('searchBtn').disabled = true;
    call('staffSearch', [pin, q], function (r) {
      $('searchBtn').disabled = false;
      if (!r.ok && r.error === 'auth') { alert('登入已失效，請重新登入'); logout(); return; }
      if (!r.ok) { msg('格式不正確：請輸入兌換碼（如 SEM012）或手機末3碼', 'error'); return; }
      results = r.results;
      selected = null;
      if (!results.length) { msg('查無資料', 'error'); return; }
      if (results.length === 1) { select(0); return; }
      renderList();
    });
  }

  function renderList() {
    var out = $('out');
    out.innerHTML = '';
    out.appendChild(el('div', 'msg info', '找到 ' + results.length + ' 筆，請選擇：'));
    results.forEach(function (s, i) {
      var item = el('div', 'item' + (selected === i ? ' sel' : ''));
      item.appendChild(el('strong', '', s.name + '（' + s.identity + '）'));
      item.appendChild(el('div', 'hint', s.code + '・' + s.phone + (s.picked ? '・已領取' : '')));
      item.style.textAlign = 'left';
      item.onclick = function () { select(i); };
      out.appendChild(item);
    });
  }

  function select(i) {
    selected = i;
    if (results.length > 1) renderList(); else $('out').innerHTML = '';
    var s = results[i];
    var card = el('div', 'card');
    [['姓名', s.name], ['身分', s.identity], ['手機', s.phone]].forEach(function (p) {
      var kv = el('div', 'kv'); kv.appendChild(el('span', 'k', p[0])); kv.appendChild(el('span', 'v', p[1])); card.appendChild(kv);
    });
    var codeRow = el('div', 'kv'); codeRow.appendChild(el('span', 'k', '兌換碼')); codeRow.appendChild(el('span', 'v code', s.code)); card.appendChild(codeRow);
    var st = el('div', 'kv'); st.appendChild(el('span', 'k', '領取狀態'));
    st.appendChild(el('span', 'tag ' + (s.picked ? 'yes' : 'no'), s.picked ? '✓ 已領取 ' + s.pickedAt : '未領取'));
    card.appendChild(st);
    $('out').appendChild(card);

    if (s.picked) { $('out').appendChild(el('div', 'msg error', '此人已領取，無法重複領取')); return; }
    var actions = el('div', 'actions');
    var ok = el('button', 'confirm', '✓ 確認領取');
    var again = el('button', 'ghost', '重新搜尋');
    ok.onclick = function () { confirmPickup(s, ok); };
    again.onclick = reset;
    actions.appendChild(ok); actions.appendChild(again);
    $('out').appendChild(actions);
  }

  function confirmPickup(s, btn) {
    btn.disabled = true;
    btn.textContent = '處理中…';
    call('staffConfirmPickup', [pin, s.row], function (r) {
      if (r.ok) { msg('✓ ' + s.name + ' 領取成功（' + r.pickedAt + '）', 'success'); setTimeout(reset, 1800); }
      else if (r.error === 'already') { msg('此人已於 ' + r.pickedAt + ' 領取，無法重複領取', 'error'); }
      else if (r.error === 'auth') { alert('登入已失效，請重新登入'); logout(); }
      else { msg('更新失敗，請再試一次', 'error'); btn.disabled = false; btn.textContent = '✓ 確認領取'; }
    });
  }

  function reset() {
    $('queryInput').value = '';
    $('out').innerHTML = '';
    results = []; selected = null;
    $('queryInput').focus();
  }

  $('loginBtn').onclick = login;
  $('pinInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') login(); });
  $('searchBtn').onclick = search;
  $('queryInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') search(); });
  $('logoutBtn').onclick = logout;
  if (pin) showMain();
</script>
</body>
</html>`;
}
