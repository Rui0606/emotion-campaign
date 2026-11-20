/**
 * 【情緒宣導活動】報到 / 序號 / 完成紀錄 / 領取驗證 後端（Google Apps Script，綁定在報到試算表）
 *
 * 活動網頁（GitHub Pages）呼叫：
 *   POST {action:'register'}  參加者用手機自己報到 → 產生序號、發簡訊
 *   POST {action:'complete'}  完成活動（12 歲以上附問卷，未滿 12 歲不用）→ 標記「已完成」
 *   GET  ?action=verify&code= 輸入序號繼續（換裝置、共用平板）
 * 工作人員頁（直接開啟本 Web App 網址）：
 *   個人密碼登入 → 查詢序號／手機末3碼 → 確認領取；代為報到（沒有手機的人）
 *
 * ⚠️ 帳號密碼一律放在「專案設定 → 指令碼屬性」，不要寫在程式碼裡：
 *    MITAKE_USERNAME   三竹帳號
 *    MITAKE_PASSWORD   三竹密碼
 *    STAFF_ACCOUNTS    工作人員帳號，格式「代號:密碼,代號:密碼,...」
 *    MAX_CODES         （選填）序號發放上限，預設 300
 *
 * ⚠️ 名稱結尾有底線（例如 sendSms_）的函式是「私有函式」，外部無法透過網頁呼叫。
 *    會花費簡訊點數或改動資料的函式都必須是私有的，請勿移除底線。
 */

// ============ 設定 ============
const REG_SHEET_NAME = '報到名單';
const SURVEY_SHEET_NAME = '問卷回覆';
const CODE_PREFIX = 'SEM';
const DEFAULT_MAX_CODES = 300;
const TIME_ZONE = 'Asia/Taipei';
const MITAKE_DOMAIN = 'smsb2c.mitake.com.tw';

const SMS_TEMPLATE = `【修平科大 - 特殊教育宣導-給情緒喘口氣】
序號：{CODE}
領取時間：09:00-13:00
地點：微風廣場-資源教室攤位
備註：數量有限，發完為止
請勿轉發此訊息`;

const IDENTITIES = ['校內職員/老師', '學生', '來賓'];
const AGE = { adult: '12歲以上', child: '未滿12歲' };
const METHOD = { self: '網頁報到', staff: '代為報到' };
const DONE_MARK = '已完成';
const PICKED_MARK = '已領';

// 報到名單欄位（1-based）
const COL = {
  CODE: 1, TIME: 2, NAME: 3, IDENTITY: 4, AGE: 5, PHONE: 6, METHOD: 7, REG_BY: 8,
  SMS: 9, DONE: 10, DONE_AT: 11, PICKED: 12, PICKED_AT: 13, PICKED_BY: 14,
};
const HEADERS = ['序號', '報到時間', '姓名', '身分', '年齡組別', '手機', '報到方式', '代報經辦人',
  '簡訊狀態', '完成狀態', '完成時間', '領取狀態', '領取時間', '領取經辦人'];

// 問卷（匿名：不記錄姓名、手機、序號）
const SURVEY_HEADERS = ['送出時間', '身分', '性別', '1.協助特教學生的單位',
  '2.更認識情緒行為障礙(1-5)', '3.會尊重並理解身障同學(1-5)', '4.建議或鼓勵'];
const SURVEY_OPTIONS = { gender: ['生理男性', '生理女性'], q1: ['警衛室', '學發中心資源教室'] };

// ============ 初始設定（在編輯器手動執行一次；重複執行沒有影響）============

function setup() {
  const reg = getSheet_(REG_SHEET_NAME);
  reg.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  reg.setFrozenRows(1);
  reg.getRange(1, COL.CODE, reg.getMaxRows(), 1).setNumberFormat('@');
  reg.getRange(1, COL.PHONE, reg.getMaxRows(), 1).setNumberFormat('@');
  const survey = getSheet_(SURVEY_SHEET_NAME);
  survey.getRange(1, 1, 1, SURVEY_HEADERS.length).setValues([SURVEY_HEADERS]).setFontWeight('bold');
  survey.setFrozenRows(1);
  Logger.log('✅ 已建立／確認工作表：' + REG_SHEET_NAME + '、' + SURVEY_SHEET_NAME);

  const props = PropertiesService.getScriptProperties();
  ['MITAKE_USERNAME', 'MITAKE_PASSWORD', 'STAFF_ACCOUNTS'].forEach(k => {
    Logger.log((props.getProperty(k) ? '✅ 已設定 ' : '❌ 尚未設定 ') + k);
  });
  Logger.log('工作人員帳號數：' + Object.keys(getStaffAccounts_()).length);
}

/** 查詢三竹剩餘點數，確認帳密正確（不發簡訊、不花點數）。結果請看執行紀錄。 */
function testConnection() {
  const cred = getMitakeCredentials_();
  const res = UrlFetchApp.fetch('https://' + MITAKE_DOMAIN + '/b2c/mtk/SmQuery', {
    method: 'post',
    payload: { username: cred.username, password: cred.password },
    muteHttpExceptions: true,
  });
  Logger.log('HTTP ' + res.getResponseCode() + '\n' + res.getContentText());
}

// ============ 網頁進入點 ============

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'verify') return json_(verifyCode_(p.code));
  return HtmlService.createHtmlOutput(getStaffPageHtml_())
    .setTitle('情緒宣導活動 - 工作人員')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action === 'register') return json_(registerSelf_(body));
    if (body.action === 'complete') return json_(completeActivity_(body.code, body.survey));
    return json_({ ok: false, error: 'unknown_action' });
  } catch (err) {
    Logger.log('doPost 錯誤：' + err.message);
    return json_({ ok: false, error: 'server' });
  }
}

// ============ 報到 ============

/** 參加者用手機自己報到：手機必填，同一支手機只能自己報到一次 */
function registerSelf_(body) {
  const name = cleanText_(body.name, 40);
  const identity = IDENTITIES.indexOf(body.identity) !== -1 ? body.identity : '';
  const age = AGE[body.age];
  const phone = normalizePhone_(body.phone);
  if (!name) return { ok: false, error: 'invalid_name' };
  if (!identity) return { ok: false, error: 'invalid_identity' };
  if (!age) return { ok: false, error: 'invalid_age' };
  if (!phone) return { ok: false, error: 'invalid_phone' };

  return withLock_(() => {
    const data = getSheet_(REG_SHEET_NAME).getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][COL.METHOD - 1] !== METHOD.self) continue;
      if (normalizePhone_(data[i][COL.PHONE - 1]) !== phone) continue;
      // 姓名相同視為本人重新開啟，回傳原本的序號；不同姓名則拒絕
      const sameName = String(data[i][COL.NAME - 1]).trim().toLowerCase() === name.toLowerCase();
      return sameName
        ? { ok: true, status: 'existing', code: String(data[i][COL.CODE - 1]), age: ageKey_(data[i][COL.AGE - 1]), completed: data[i][COL.DONE - 1] === DONE_MARK }
        : { ok: false, error: 'phone_taken' };
    }
    return createRow_(data, { name: name, identity: identity, age: age, phone: phone, method: METHOD.self, regBy: '' });
  }, afterCreate_);
}

/** 工作人員代為報到（沒有手機的人）：手機選填；有填才發簡訊；不檢查手機重複（家長手機可重複使用） */
function staffRegister(pin, form) {
  const staff = getStaffName_(pin);
  if (!staff) return { ok: false, error: 'auth' };
  form = form || {};
  const name = cleanText_(form.name, 40);
  const identity = IDENTITIES.indexOf(form.identity) !== -1 ? form.identity : '';
  const age = AGE[form.age];
  const rawPhone = String(form.phone || '').trim();
  const phone = rawPhone ? normalizePhone_(rawPhone) : '';
  if (!name) return { ok: false, error: '請填寫姓名' };
  if (!identity) return { ok: false, error: '請選擇身分' };
  if (!age) return { ok: false, error: '請選擇年齡' };
  if (rawPhone && !phone) return { ok: false, error: '手機格式不正確（09 開頭 10 碼），不填也可以' };

  return withLock_(() => {
    const data = getSheet_(REG_SHEET_NAME).getDataRange().getValues();
    return createRow_(data, { name: name, identity: identity, age: age, phone: phone, method: METHOD.staff, regBy: staff });
  }, afterCreate_);
}

/** 在鎖內呼叫：檢查上限、取「現有最大號碼 + 1」作為序號、寫入新列 */
function createRow_(data, f) {
  const maxCodes = Number(PropertiesService.getScriptProperties().getProperty('MAX_CODES')) || DEFAULT_MAX_CODES;
  if (data.length - 1 >= maxCodes) return { ok: false, error: 'full' };

  let maxNum = 0;
  for (let i = 1; i < data.length; i++) {
    const m = String(data[i][COL.CODE - 1]).match(/(\d+)$/);
    if (m) maxNum = Math.max(maxNum, Number(m[1]));
  }
  const code = CODE_PREFIX + String(maxNum + 1).padStart(3, '0');
  const row = data.length + 1;
  const sheet = getSheet_(REG_SHEET_NAME);
  const values = new Array(HEADERS.length).fill('');
  values[COL.CODE - 1] = code;
  values[COL.TIME - 1] = now_('yyyy/MM/dd HH:mm:ss');
  values[COL.NAME - 1] = f.name;
  values[COL.IDENTITY - 1] = f.identity;
  values[COL.AGE - 1] = f.age;
  values[COL.PHONE - 1] = f.phone;
  values[COL.METHOD - 1] = f.method;
  values[COL.REG_BY - 1] = f.regBy;
  values[COL.SMS - 1] = f.phone ? '發送中' : '（無手機）';
  sheet.getRange(row, 1, 1, HEADERS.length).setNumberFormat('@').setValues([values]);
  SpreadsheetApp.flush();
  return { ok: true, status: 'new', code: code, age: ageKey_(f.age), completed: false, _row: row, _phone: f.phone };
}

/** 鎖外執行：發簡訊並記錄結果（避免同時報到的人互相等待） */
function afterCreate_(result) {
  if (!result.ok || result.status !== 'new') return result;
  const row = result._row;
  const phone = result._phone;
  delete result._row;
  delete result._phone;
  if (!phone) return result;
  const sms = sendSms_(phone, result.code);
  getSheet_(REG_SHEET_NAME).getRange(row, COL.SMS).setValue(sms.ok ? '✓ 已發送' : '✗ 失敗（' + sms.detail + '）');
  result.sms = sms.ok;
  return result;
}

function verifyCode_(rawCode) {
  const code = normalizeCode_(rawCode);
  if (!code) return { ok: false };
  const found = findByCode_(code);
  if (!found) return { ok: false };
  return { ok: true, code: code, age: ageKey_(found.values[COL.AGE - 1]), completed: found.values[COL.DONE - 1] === DONE_MARK };
}

// ============ 完成活動（含匿名問卷）============

function completeActivity_(rawCode, survey) {
  const code = normalizeCode_(rawCode);
  if (!code) return { ok: false, error: 'not_found' };
  return withLock_(() => {
    const found = findByCode_(code);
    if (!found) return { ok: false, error: 'not_found' };
    if (found.values[COL.DONE - 1] === DONE_MARK) return { ok: true, status: 'already' };

    const isChild = ageKey_(found.values[COL.AGE - 1]) === 'child';
    if (!isChild) {
      const answers = validateSurvey_(survey);
      if (!answers) return { ok: false, error: 'invalid_survey' };
      getSheet_(SURVEY_SHEET_NAME).appendRow([
        now_('yyyy/MM/dd HH:mm:ss'), found.values[COL.IDENTITY - 1],
        answers.gender, answers.q1, answers.q2, answers.q3, answers.q4,
      ]);
    }
    getSheet_(REG_SHEET_NAME).getRange(found.row, COL.DONE, 1, 2).setValues([[DONE_MARK, now_('HH:mm')]]);
    SpreadsheetApp.flush();
    return { ok: true, status: 'done' };
  });
}

function validateSurvey_(s) {
  if (!s) return null;
  const q2 = Number(s.q2);
  const q3 = Number(s.q3);
  if (SURVEY_OPTIONS.gender.indexOf(s.gender) === -1) return null;
  if (SURVEY_OPTIONS.q1.indexOf(s.q1) === -1) return null;
  if (!(q2 >= 1 && q2 <= 5 && q2 % 1 === 0) || !(q3 >= 1 && q3 <= 5 && q3 % 1 === 0)) return null;
  // 開頭加 ' 避免被試算表當成公式
  const q4 = cleanText_(s.q4, 500).replace(/^[=+\-@]/, "'$&");
  return { gender: s.gender, q1: s.q1, q2: q2, q3: q3, q4: q4 };
}

// ============ 三竹簡訊 ============

function sendSms_(phone, code) {
  try {
    const cred = getMitakeCredentials_();
    const res = UrlFetchApp.fetch('https://' + MITAKE_DOMAIN + '/b2c/mtk/SmSend?CharsetURL=UTF8', {
      method: 'post',
      payload: {
        username: cred.username,
        password: cred.password,
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
    if (!ok) Logger.log('簡訊失敗（末3碼 ' + phone.slice(-3) + '）：HTTP ' + res.getResponseCode() + ' ' + text);
    return { ok: ok, detail: 'statuscode=' + status };
  } catch (err) {
    Logger.log('簡訊例外：' + err.message);
    return { ok: false, detail: String(err.message).slice(0, 40) };
  }
}

function getMitakeCredentials_() {
  const props = PropertiesService.getScriptProperties();
  const username = props.getProperty('MITAKE_USERNAME');
  const password = props.getProperty('MITAKE_PASSWORD');
  if (!username || !password) throw new Error('尚未在指令碼屬性設定 MITAKE_USERNAME / MITAKE_PASSWORD');
  return { username: username, password: password };
}

// ============ 工作人員（由工作人員頁 google.script.run 呼叫，每次都要帶密碼）============

function staffLogin(pin) {
  const name = getStaffName_(pin);
  return name ? { ok: true, name: name } : { ok: false };
}

/** query：序號（SEM012、12）或手機末3碼（如 400；剛好 3 位數字一律視為手機末3碼） */
function staffSearch(pin, query) {
  if (!getStaffName_(pin)) return { ok: false, error: 'auth' };
  const q = String(query || '').trim();
  const byPhone = /^\d{3}$/.test(q);
  const code = byPhone ? '' : normalizeCode_(q);
  if (!byPhone && !code) return { ok: false, error: 'format' };

  const data = getSheet_(REG_SHEET_NAME).getDataRange().getValues();
  const results = [];
  for (let i = 1; i < data.length; i++) {
    const v = data[i];
    const phone = normalizePhone_(v[COL.PHONE - 1]);
    const match = byPhone ? (phone && phone.slice(-3) === q) : String(v[COL.CODE - 1]) === code;
    if (match) results.push(toStaffView_(i + 1, v));
  }
  return { ok: true, results: results };
}

function staffConfirmPickup(pin, row) {
  const staff = getStaffName_(pin);
  if (!staff) return { ok: false, error: 'auth' };
  const sheet = getSheet_(REG_SHEET_NAME);
  row = Number(row);
  if (!(row >= 2 && row <= sheet.getLastRow() && row % 1 === 0)) return { ok: false, error: 'row' };

  return withLock_(() => {
    // 寫入前重新讀取，避免兩台裝置同時按下確認、或問卷剛好還沒完成
    const v = sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0];
    if (v[COL.PICKED - 1] === PICKED_MARK) return { ok: false, error: 'already', pickedAt: formatCell_(v[COL.PICKED_AT - 1]), pickedBy: String(v[COL.PICKED_BY - 1]) };
    if (v[COL.DONE - 1] !== DONE_MARK) return { ok: false, error: 'not_done' };
    const time = now_('HH:mm');
    sheet.getRange(row, COL.PICKED, 1, 3).setValues([[PICKED_MARK, time, staff]]);
    return { ok: true, pickedAt: time };
  });
}

function toStaffView_(row, v) {
  const phone = normalizePhone_(v[COL.PHONE - 1]);
  return {
    row: row,
    code: String(v[COL.CODE - 1]),
    name: String(v[COL.NAME - 1]),
    identity: String(v[COL.IDENTITY - 1]),
    age: String(v[COL.AGE - 1]),
    phone: phone ? maskPhone_(phone) : '（無）',
    method: String(v[COL.METHOD - 1]),
    done: v[COL.DONE - 1] === DONE_MARK,
    doneAt: formatCell_(v[COL.DONE_AT - 1]),
    picked: v[COL.PICKED - 1] === PICKED_MARK,
    pickedAt: formatCell_(v[COL.PICKED_AT - 1]),
    pickedBy: String(v[COL.PICKED_BY - 1]),
  };
}

function getStaffAccounts_() {
  const raw = PropertiesService.getScriptProperties().getProperty('STAFF_ACCOUNTS') || '';
  const accounts = {};
  raw.split(/[,\n]/).forEach(part => {
    const idx = part.lastIndexOf(':');
    if (idx <= 0) return;
    const name = part.slice(0, idx).trim();
    const pin = part.slice(idx + 1).trim();
    if (name && pin) accounts[pin] = name;
  });
  return accounts;
}

function getStaffName_(pin) {
  const name = getStaffAccounts_()[String(pin || '').trim()];
  if (!name) Utilities.sleep(800); // 放慢暴力猜測
  return name || '';
}

// ============ 小工具 ============

function getSheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function findByCode_(code) {
  const sheet = getSheet_(REG_SHEET_NAME);
  const last = sheet.getLastRow();
  if (last < 2) return null;
  const data = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][COL.CODE - 1]) === code) return { row: i + 2, values: data[i] };
  }
  return null;
}

/** fn 在鎖內執行；after（選填）在鎖釋放後以 fn 的結果執行 */
function withLock_(fn, after) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'busy' };
  let result;
  try {
    result = fn();
  } finally {
    lock.releaseLock();
  }
  return after ? after(result) : result;
}

function ageKey_(label) {
  return label === AGE.child ? 'child' : 'adult';
}

function cleanText_(raw, max) {
  return String(raw === undefined || raw === null ? '' : raw).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
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
  return phone.slice(0, 4) + '-***-' + phone.slice(7);
}

function now_(fmt) {
  return Utilities.formatDate(new Date(), TIME_ZONE, fmt);
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
  const identityButtons = IDENTITIES.map(v => '<button type="button" class="opt" data-group="identity" data-value="' + v + '">' + v + '</button>').join('');
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, 'Segoe UI', 'Microsoft JhengHei', sans-serif; background: linear-gradient(135deg, #f0fdfa 0%, #e8f4f8 100%); min-height: 100vh; padding: 20px 14px; color: #1f2937; }
  .container { background: #fff; border-radius: 20px; box-shadow: 0 4px 20px rgba(13,148,136,.12); max-width: 480px; margin: 0 auto; padding: 24px 20px; }
  h1 { color: #0f766e; font-size: 21px; text-align: center; }
  .sub { color: #6b7280; font-size: 13px; text-align: center; margin: 4px 0 18px; }
  .who { font-size: 13px; color: #0f766e; text-align: center; margin-bottom: 14px; }
  .tabs { display: flex; gap: 4px; background: #f0fdfa; padding: 4px; border-radius: 14px; margin-bottom: 18px; }
  .tab { flex: 1; background: none; color: #6b7280; min-height: 42px; padding: 8px; font-size: 15px; }
  .tab.on { background: #fff; color: #115e59; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .row { display: flex; gap: 10px; }
  input { flex: 1; width: 100%; padding: 13px 14px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 17px; min-width: 0; }
  input:focus { outline: none; border-color: #14b8a6; }
  .center { text-align: center; letter-spacing: 1px; }
  button { padding: 13px 18px; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; min-height: 50px; }
  .primary { background: #0d9488; color: #fff; }
  .primary:disabled, .confirm:disabled { background: #d1d5db; cursor: not-allowed; }
  .confirm { background: #16a34a; color: #fff; flex: 2; }
  .ghost { background: #f3f4f6; color: #4b5563; flex: 1; }
  .full { width: 100%; }
  label.lbl { display: block; font-size: 14px; font-weight: 600; margin: 14px 0 6px; }
  .opts { display: flex; gap: 8px; flex-wrap: wrap; }
  .opt { flex: 1; min-width: 30%; background: #fff; border: 2px solid #e5e7eb; color: #374151; font-size: 14px; min-height: 46px; padding: 8px; }
  .opt.on { border-color: #14b8a6; background: #f0fdfa; color: #115e59; }
  .hint { font-size: 13px; color: #6b7280; margin-top: 8px; text-align: center; }
  .msg { padding: 13px; border-radius: 12px; margin-top: 16px; font-size: 15px; line-height: 1.5; }
  .msg.info { background: #f0fdfa; color: #115e59; }
  .msg.error { background: #fef2f2; color: #b91c1c; }
  .msg.success { background: #f0fdf4; color: #15803d; font-weight: 600; }
  .item { border: 2px solid #e5e7eb; border-radius: 12px; padding: 12px 14px; margin-top: 10px; cursor: pointer; text-align: left; }
  .item.sel { border-color: #14b8a6; background: #f0fdfa; }
  .card { background: #f9fafb; border-radius: 12px; padding: 4px 14px; margin-top: 14px; border: 1px solid #e5e7eb; }
  .kv { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed #e5e7eb; gap: 12px; align-items: center; }
  .kv:last-child { border-bottom: none; }
  .k { color: #6b7280; font-weight: 600; white-space: nowrap; }
  .v { font-weight: 600; text-align: right; word-break: break-all; }
  .big { color: #0f766e; font-size: 22px; letter-spacing: 1px; }
  .tag { padding: 4px 10px; border-radius: 999px; font-size: 13px; }
  .tag.no { background: #fef3c7; color: #92400e; }
  .tag.yes { background: #dcfce7; color: #166534; }
  .actions { display: flex; gap: 10px; margin-top: 14px; }
  .codebox { text-align: center; background: #f0fdfa; border-radius: 16px; padding: 18px; margin-top: 16px; }
  .codebox .code { font-size: 40px; font-weight: 800; color: #115e59; letter-spacing: 3px; }
  .hidden { display: none; }
  .logout { background: none; color: #9ca3af; font-size: 13px; min-height: 0; padding: 14px 0 0; width: 100%; font-weight: 400; }
</style>
</head>
<body>
<div class="container">
  <h1>📋 工作人員系統</h1>
  <p class="sub">修平科大 - 特殊教育宣導「給情緒喘口氣」</p>

  <div id="loginView">
    <div class="row">
      <input id="pinInput" class="center" type="password" inputmode="numeric" autocomplete="off" placeholder="個人密碼">
      <button class="primary" id="loginBtn">登入</button>
    </div>
  </div>

  <div id="mainView" class="hidden">
    <p class="who" id="who"></p>
    <div class="tabs">
      <button class="tab on" data-tab="pickup">領取查詢</button>
      <button class="tab" data-tab="register">代為報到</button>
    </div>

    <div id="pickupTab">
      <div class="row">
        <input id="queryInput" class="center" type="text" inputmode="numeric" autocomplete="off" placeholder="序號 或 手機末3碼">
        <button class="primary" id="searchBtn">搜尋</button>
      </div>
      <p class="hint">序號可只輸入數字，例：12 = SEM012；剛好 3 位數字（例：400）視為手機末3碼</p>
      <div id="out"></div>
    </div>

    <div id="registerTab" class="hidden">
      <label class="lbl" for="rName">姓名</label>
      <input id="rName" type="text" maxlength="40" autocomplete="off">
      <label class="lbl">身分</label>
      <div class="opts">${identityButtons}</div>
      <label class="lbl">年齡</label>
      <div class="opts">
        <button type="button" class="opt" data-group="age" data-value="adult">12歲以上</button>
        <button type="button" class="opt" data-group="age" data-value="child">未滿12歲</button>
      </div>
      <label class="lbl" for="rPhone">手機（選填，有填才會發簡訊）</label>
      <input id="rPhone" type="tel" inputmode="numeric" autocomplete="off" placeholder="09xxxxxxxx">
      <button class="primary full" id="registerBtn" style="margin-top:18px">送出代為報到</button>
      <div id="regOut"></div>
    </div>

    <button class="logout" id="logoutBtn">登出</button>
  </div>
</div>

<script>
  var pin = sessionStorage.getItem('staffPin') || '';
  var staffName = sessionStorage.getItem('staffName') || '';
  var results = [];
  var choice = { identity: '', age: '' };
  var $ = function (id) { return document.getElementById(id); };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;   // 一律用 textContent，避免插入惡意內容
    return n;
  }
  function msg(box, text, type) {
    box.innerHTML = '';
    box.appendChild(el('div', 'msg ' + type, text));
  }
  function call(fn, args, onOk, box) {
    var runner = google.script.run
      .withSuccessHandler(function (r) {
        if (r && r.error === 'auth') { alert('登入已失效，請重新登入'); logout(); return; }
        onOk(r);
      })
      .withFailureHandler(function (err) { msg(box || $('out'), '連線失敗，請再試一次（' + (err && err.message) + '）', 'error'); });
    runner[fn].apply(runner, args);
  }

  // ---------- 登入 ----------
  function showMain() {
    $('loginView').classList.add('hidden');
    $('mainView').classList.remove('hidden');
    $('who').textContent = '目前登入：' + staffName;
    $('queryInput').focus();
  }
  function login() {
    var value = $('pinInput').value.trim();
    if (!value) return;
    $('loginBtn').disabled = true;
    google.script.run.withSuccessHandler(function (r) {
      $('loginBtn').disabled = false;
      if (r && r.ok) {
        pin = value; staffName = r.name;
        sessionStorage.setItem('staffPin', pin); sessionStorage.setItem('staffName', staffName);
        showMain();
      } else { $('pinInput').value = ''; alert('密碼錯誤'); }
    }).withFailureHandler(function () { $('loginBtn').disabled = false; alert('連線失敗，請再試一次'); }).staffLogin(value);
  }
  function logout() {
    sessionStorage.removeItem('staffPin'); sessionStorage.removeItem('staffName');
    location.reload();
  }

  // ---------- 分頁 ----------
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
    t.onclick = function () {
      Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (x) { x.classList.toggle('on', x === t); });
      $('pickupTab').classList.toggle('hidden', t.dataset.tab !== 'pickup');
      $('registerTab').classList.toggle('hidden', t.dataset.tab !== 'register');
    };
  });

  // ---------- 領取查詢 ----------
  function search() {
    var q = $('queryInput').value.trim();
    if (!q) return;
    msg($('out'), '搜尋中…', 'info');
    $('searchBtn').disabled = true;
    call('staffSearch', [pin, q], function (r) {
      $('searchBtn').disabled = false;
      if (!r.ok) { msg($('out'), '格式不正確：請輸入序號（如 12 或 SEM012）或手機末3碼', 'error'); return; }
      results = r.results;
      if (!results.length) { msg($('out'), '查無資料', 'error'); return; }
      if (results.length === 1) { select(0); return; }
      renderList(-1);
    });
  }

  function renderList(selected) {
    var out = $('out');
    out.innerHTML = '';
    out.appendChild(el('div', 'msg info', '找到 ' + results.length + ' 筆，請參加者說出姓名後選擇：'));
    results.forEach(function (s, i) {
      var item = el('div', 'item' + (selected === i ? ' sel' : ''));
      item.appendChild(el('strong', '', s.name + '（' + s.identity + '・' + s.age + '）'));
      item.appendChild(el('div', 'hint', s.code + '・' + s.phone + (s.picked ? '・已領取' : s.done ? '・已完成' : '・未完成')));
      item.style.textAlign = 'left';
      item.onclick = function () { select(i); };
      out.appendChild(item);
    });
  }

  function kv(card, k, v, cls) {
    var row = el('div', 'kv');
    row.appendChild(el('span', 'k', k));
    if (typeof v === 'string') row.appendChild(el('span', 'v ' + (cls || ''), v)); else row.appendChild(v);
    card.appendChild(row);
  }

  function select(i) {
    if (results.length > 1) renderList(i); else $('out').innerHTML = '';
    var s = results[i];
    var card = el('div', 'card');
    kv(card, '序號', s.code, 'big');
    kv(card, '姓名', s.name);
    kv(card, '身分／年齡', s.identity + '・' + s.age);
    kv(card, '手機', s.phone);
    kv(card, '報到方式', s.method);
    kv(card, '活動完成', el('span', 'tag ' + (s.done ? 'yes' : 'no'), s.done ? '✓ 已完成 ' + s.doneAt : '未完成'));
    kv(card, '領取狀態', el('span', 'tag ' + (s.picked ? 'yes' : 'no'), s.picked ? '✓ 已領取 ' + s.pickedAt + ' ' + s.pickedBy : '未領取'));
    $('out').appendChild(card);

    if (s.picked) { $('out').appendChild(el('div', 'msg error', '此人已領取，無法重複領取')); return; }
    if (!s.done) { $('out').appendChild(el('div', 'msg error', '尚未完成活動（12歲以上需完成問卷；未滿12歲需完成小測驗），請參加者完成後再來領取')); }
    $('out').appendChild(el('div', 'msg info', '請參加者說出姓名，與上方姓名核對一致再確認'));
    var actions = el('div', 'actions');
    var ok = el('button', 'confirm', '✓ 確認領取');
    ok.disabled = !s.done;
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
      if (r.ok) { msg($('out'), '✓ ' + s.code + ' ' + s.name + ' 領取成功（' + r.pickedAt + '）', 'success'); setTimeout(reset, 2000); }
      else if (r.error === 'already') { msg($('out'), '此人已於 ' + r.pickedAt + ' 由 ' + r.pickedBy + ' 確認領取，無法重複領取', 'error'); }
      else if (r.error === 'not_done') { msg($('out'), '尚未完成活動，無法領取', 'error'); }
      else { msg($('out'), '更新失敗，請再試一次', 'error'); btn.disabled = false; btn.textContent = '✓ 確認領取'; }
    });
  }

  function reset() {
    $('queryInput').value = '';
    $('out').innerHTML = '';
    results = [];
    $('queryInput').focus();
  }

  // ---------- 代為報到 ----------
  Array.prototype.forEach.call(document.querySelectorAll('.opt'), function (b) {
    b.onclick = function () {
      choice[b.dataset.group] = b.dataset.value;
      Array.prototype.forEach.call(document.querySelectorAll('.opt[data-group="' + b.dataset.group + '"]'), function (x) { x.classList.toggle('on', x === b); });
    };
  });

  function register() {
    var form = { name: $('rName').value.trim(), identity: choice.identity, age: choice.age, phone: $('rPhone').value.trim() };
    if (!form.name || !form.identity || !form.age) { msg($('regOut'), '請填寫姓名，並選擇身分與年齡', 'error'); return; }
    $('registerBtn').disabled = true;
    msg($('regOut'), '報到中…', 'info');
    call('staffRegister', [pin, form], function (r) {
      $('registerBtn').disabled = false;
      if (!r.ok) {
        var text = r.error === 'full' ? '序號已全部發放完畢' : r.error === 'busy' ? '系統忙碌，請再試一次' : r.error;
        msg($('regOut'), text, 'error');
        return;
      }
      var box = $('regOut');
      box.innerHTML = '';
      var cb = el('div', 'codebox');
      cb.appendChild(el('div', 'hint', form.name + '・' + (form.age === 'child' ? '未滿12歲（兒童版，不做心情溫度計）' : '12歲以上')));
      cb.appendChild(el('div', 'code', r.code));
      cb.appendChild(el('div', 'hint', '請告訴參加者序號，在平板或家長手機選「我已經有序號」輸入' + (r.sms === true ? '（簡訊已發送）' : r.sms === false ? '（簡訊發送失敗）' : '')));
      box.appendChild(cb);
      $('rName').value = ''; $('rPhone').value = '';
      choice = { identity: '', age: '' };
      Array.prototype.forEach.call(document.querySelectorAll('.opt'), function (x) { x.classList.remove('on'); });
    }, $('regOut'));
  }

  $('loginBtn').onclick = login;
  $('pinInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') login(); });
  $('searchBtn').onclick = search;
  $('queryInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') search(); });
  $('registerBtn').onclick = register;
  $('logoutBtn').onclick = logout;
  if (pin && staffName) showMain();
</script>
</body>
</html>`;
}
