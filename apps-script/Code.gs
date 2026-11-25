/**
 * 【情緒宣導活動】報到 / 序號 / 完成紀錄 / 領取驗證 後端（Google Apps Script，綁定在報到試算表）
 *
 * 活動網頁（GitHub Pages）呼叫：
 *   POST {action:'register'}  參加者用手機自己報到 → 產生序號、發簡訊
 *   POST {action:'complete'}  完成活動（12 歲以上附問卷，未滿 12 歲不用）→ 標記「已完成」
 *   GET  ?action=verify&code= 輸入序號繼續（換裝置、共用平板）
 * 工作人員頁（直接開啟本 Web App 網址）：
 *   個人密碼登入 → 用序號（忘記時用姓名）查詢 → 確認領取；代為報到（沒有手機的人）
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
const DEFAULT_MAX_CODES = 500; // 序號 SEM001～SEM500；可用指令碼屬性 MAX_CODES 另外設定
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
  SMS: 9, DONE: 10, DONE_AT: 11, PICKED: 12, PICKED_AT: 13, PICKED_BY: 14, CARE: 15,
};
const HEADERS = ['序號', '報到時間', '姓名', '身分', '年齡組別', '手機', '報到方式', '代報經辦人',
  '簡訊狀態', '完成狀態', '完成時間', '領取狀態', '領取時間', '領取經辦人', '關懷註記'];
const CARE_MARK = '需追蹤關懷';

// 問卷（匿名：不記錄姓名、手機、序號）
const SURVEY_HEADERS = ['送出時間', '身分', '性別', '1.協助特教學生的單位',
  '2.更認識情緒行為障礙(1-5)', '3.會尊重並理解身障同學(1-5)', '4.建議或鼓勵', '年齡組別'];
const SURVEY_OPTIONS = { gender: ['生理男性', '生理女性'], q1: ['警衛室', '學發中心資源教室'] };

// ============ 活動當天時程與分工（小鈴鐺提醒）============
// 依「115年特教宣導活動流程」整理。who 只要寫名字的一部分，會比對登入帳號的名稱（STAFF_ACCOUNTS 的代號）。
// 改分工時只要改這裡，重新部署即可；時間格式 HH:mm。
const EVENT_DATE = '2026-12-05';
const GUIDE_URL = 'https://rui0606.github.io/emotion-campaign/guide.html'; // 操作示範動畫頁
const PRE_BRIEF = '12/4（五）中午 行前說明';
const SCHEDULE_ALL = [
  { start: '08:30', end: '09:00', title: '場佈（全體）', detail: '推車把備品運到微風廣場（植物、衛生紙、垃圾袋、簽到表、平板、筆電、延長線、膠帶）；張貼海報、擺植物；說明注意事項、測試' },
  { start: '09:00', end: '12:30', title: '活動進行', detail: '關卡一：簽到／認識情緒行為障礙　關卡二：心情溫度計　關卡三：回饋＋空氣鳳梨' },
  { start: '11:30', end: '12:30', title: '午餐時間', detail: '大家輪流吃便當，確認有人接手工作再去', meal: true },
  { start: '12:30', end: '13:00', title: '收拾', detail: '清點物品後，用推車把備品運回資源教室' },
];
const ST1 = '協助線上簽到，看到序號後協助抽情緒小卡';
const ST2 = '提醒參加者做心情溫度計；10 分以上（或第 6 題 2 分以上）帶去給心理師';
const COUNSEL = '高分者關懷輔導，在本系統「關懷登記」輸入序號註記；談完給通關碼（不願意也給）';
const ST3 = '核對序號與姓名後確認領取；回收代為報到者的驗證碼貼紙';
const LUNCH = { start: '11:00', end: '11:30', title: '拿便當', detail: '和另一位工讀生到校門口拿便當＋飲料，送到辦公室' };
const SCHEDULE_ROLES = [
  { who: '張珈瀞', items: [
    { start: '09:00', end: '10:00', title: '活動宣傳：招攬學生', detail: '每 1 小時和謝宇恆互換' },
    { start: '10:00', end: '11:00', title: '攝影', detail: '鼓勵參加者拿手板拍照' }, LUNCH] },
  { who: '謝宇恆', items: [
    { start: '09:00', end: '10:00', title: '攝影', detail: '鼓勵參加者拿手板拍照；每 1 小時和張珈瀞互換' },
    { start: '10:00', end: '11:00', title: '活動宣傳：招攬學生', detail: '' }, LUNCH] },
  { who: '楊宜縈', items: [{ start: '09:00', end: '12:30', title: '關卡一：場控', detail: ST1 + '；協助沒手機的人代為報到、用平板參加' }] },
  { who: '蔡依庭', items: [{ start: '11:00', end: '12:30', title: '關卡一：支援（同楊宜縈）', detail: ST1 + '；協助沒手機的人代為報到、用平板參加' }] },
  { who: '林昱誠', items: [{ start: '09:00', end: '12:30', title: '關卡一：簽到', detail: ST1 }] },
  { who: '藩氏雪幸', items: [{ start: '09:00', end: '12:30', title: '關卡一：簽到', detail: ST1 }] },
  { who: '劉雅萍', items: [{ start: '09:00', end: '12:30', title: '關卡二：場控', detail: ST2 }] },
  { who: '林柏瑋', items: [{ start: '09:00', end: '12:30', title: '關卡二：心情溫度計', detail: ST2 }] },
  { who: '武玉軍', items: [{ start: '09:00', end: '12:30', title: '關卡二：心情溫度計', detail: ST2 + '；協助心理師翻譯' }] },
  { who: '吳有城', items: [{ start: '09:00', end: '12:30', title: '關卡二：心理師', detail: COUNSEL }] },
  { who: '郭貞宜', items: [{ start: '11:00', end: '12:30', title: '關卡二：心理師（接手）', detail: COUNSEL }] },
  { who: '劉致遠', items: [{ start: '11:00', end: '12:30', title: '關卡二：心理師（接手）', detail: COUNSEL }] },
  { who: '張瑞芸', items: [{ start: '09:00', end: '12:30', title: '關卡三：場控', detail: ST3 }] },
  { who: '郭曉青', items: [{ start: '11:00', end: '12:30', title: '關卡三：支援（同張瑞芸）', detail: ST3 }] },
  { who: '粘鎧森', items: [{ start: '09:00', end: '12:30', title: '關卡三：發放空氣鳳梨', detail: '發植物並說明照顧方式；200 份發完改送資源教室小物' }] },
  { who: '詹芷安', items: [{ start: '09:00', end: '12:30', title: '機動支援', detail: '哪一關需要人手就去支援' }] },
];

function getScheduleFor_(name) {
  const mine = [];
  SCHEDULE_ROLES.forEach(r => { if (name && name.indexOf(r.who) !== -1) Array.prototype.push.apply(mine, r.items); });
  return { date: EVENT_DATE, pre: PRE_BRIEF, all: SCHEDULE_ALL, mine: mine };
}

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
  if (age === AGE.child) return { ok: false, error: 'child_staff' }; // 未滿 12 歲一律由工作人員代為報到
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
    // 12 歲以上必填問卷；兒童版也會送問卷（舊版網頁沒送時照樣完成）
    if (survey || !isChild) {
      const answers = validateSurvey_(survey);
      if (!answers) return { ok: false, error: 'invalid_survey' };
      const sheet = getSheet_(SURVEY_SHEET_NAME);
      ensureHeader_(sheet, SURVEY_HEADERS);
      sheet.appendRow([
        now_('yyyy/MM/dd HH:mm:ss'), found.values[COL.IDENTITY - 1],
        answers.gender, answers.q1, answers.q2, answers.q3, answers.q4, found.values[COL.AGE - 1],
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
  return name ? { ok: true, name: name, schedule: getScheduleFor_(name) } : { ok: false };
}

/**
 * mode 'code'（預設）：query 是序號，1、001、SEM001 都視為 SEM001
 * mode 'name'：忘記序號時用姓名查，部分文字也可以（例：輸入「小明」找到「王小明」），最多列 30 筆
 */
function staffSearch(pin, query, mode) {
  if (!getStaffName_(pin)) return { ok: false, error: 'auth' };
  const byName = mode === 'name';
  const nameQ = byName ? String(query || '').replace(/\s+/g, '').toLowerCase() : '';
  const code = byName ? '' : normalizeCode_(query);
  if (byName ? !nameQ : !code) return { ok: false, error: 'format' };

  const data = getSheet_(REG_SHEET_NAME).getDataRange().getValues();
  const results = [];
  for (let i = 1; i < data.length && results.length < 30; i++) {
    const v = data[i];
    const match = byName
      ? String(v[COL.NAME - 1]).replace(/\s+/g, '').toLowerCase().indexOf(nameQ) !== -1
      : String(v[COL.CODE - 1]) === code;
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

/** 心理師關懷登記：用序號查，只回傳序號與姓名（不含手機、不含分數） */
function staffCareLookup(pin, query) {
  if (!getStaffName_(pin)) return { ok: false, error: 'auth' };
  const code = normalizeCode_(query);
  if (!code) return { ok: false, error: 'format' };
  const found = findByCode_(code);
  if (!found) return { ok: true, result: null };
  return { ok: true, result: { row: found.row, code: code, name: String(found.values[COL.NAME - 1]), care: String(found.values[COL.CARE - 1] || '') } };
}

function staffCareMark(pin, row) {
  const staff = getStaffName_(pin);
  if (!staff) return { ok: false, error: 'auth' };
  const sheet = getSheet_(REG_SHEET_NAME);
  row = Number(row);
  if (!(row >= 2 && row <= sheet.getLastRow() && row % 1 === 0)) return { ok: false, error: 'row' };
  return withLock_(() => {
    ensureHeader_(sheet, HEADERS);
    const mark = CARE_MARK + '（' + now_('HH:mm') + ' ' + staff + '）';
    sheet.getRange(row, COL.CARE).setValue(mark);
    return { ok: true, care: mark };
  });
}

/** 舊的工作表少了新欄位標題時補上 */
function ensureHeader_(sheet, headers) {
  const cell = sheet.getRange(1, headers.length);
  if (!cell.getValue()) cell.setValue(headers[headers.length - 1]).setFontWeight('bold');
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
<meta name="color-scheme" content="light only">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chiron+GoRound+TC:wght@400;700&display=swap">
<style>
  /* 海報風格：方格紙 × 鈷藍 × 橘，與活動網頁一致 */
  :root { --ink: #1f3770; --blue: #2a5bd7; --blue-50: #eef4ff; --blue-100: #dbe7ff; --orange: #e5652a; --paper: #f5f8ff; --grid: #d6e2f7; color-scheme: light only; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Chiron GoRound TC', 'Noto Sans TC', 'Microsoft JhengHei', system-ui, sans-serif; min-height: 100vh; padding: 20px 14px 40px; color: var(--ink); word-break: keep-all; overflow-wrap: anywhere;
    background-color: var(--paper); background-image: linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px); background-size: 22px 22px; }
  .container { background: #fff; border: 2px solid var(--ink); border-radius: 22px; box-shadow: 5px 5px 0 var(--ink); max-width: 480px; margin: 0 auto; padding: 22px 20px; position: relative; }
  .ribbon { display: block; width: fit-content; margin: 0 auto 8px; padding: 5px 26px; background: #fff; color: var(--orange); font-weight: 700; font-size: 13px;
    border-top: 2px solid var(--ink); border-bottom: 2px solid var(--ink); clip-path: polygon(0 0, 100% 0, calc(100% - 12px) 50%, 100% 100%, 0 100%, 12px 50%); }
  h1 { color: var(--blue); font-size: 26px; text-align: center; font-weight: 700; -webkit-text-stroke: 1px var(--ink); paint-order: stroke fill; text-shadow: 2px 2px 0 #fff, 3px 3px 0 var(--ink); letter-spacing: 1px; }
  .sub { color: #5b6b8c; font-size: 13px; text-align: center; margin: 6px 0 18px; }
  .who { font-size: 14px; color: var(--ink); font-weight: 700; }
  .topbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
  .tabs { display: flex; gap: 4px; background: var(--blue-50); padding: 4px; border-radius: 14px; margin-bottom: 18px; border: 2px solid var(--ink); }
  .tab { flex: 1; background: none; color: #5b6b8c; min-height: 42px; padding: 8px; font-size: 15px; box-shadow: none; border: none; }
  .tab.on { background: var(--blue); color: #fff; }
  .row { display: flex; gap: 10px; }
  input { flex: 1; width: 100%; padding: 13px 14px; border: 2px solid var(--ink); border-radius: 12px; font-size: 17px; min-width: 0; font-family: inherit; color: var(--ink); -webkit-text-fill-color: var(--ink); background: #fff; caret-color: var(--blue); }
  input::placeholder { color: #8a97b3; -webkit-text-fill-color: #8a97b3; }
  input:focus { outline: 3px solid var(--blue-100); }
  .center { text-align: center; letter-spacing: 1px; }
  button { font-family: inherit; padding: 13px 18px; border: 2px solid var(--ink); border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer; min-height: 50px; box-shadow: 3px 3px 0 var(--ink); transition: transform .1s, box-shadow .1s; color: var(--ink); background: #fff; }
  button:active:not(:disabled) { transform: translate(3px, 3px); box-shadow: 0 0 0 var(--ink); }
  .primary { background: var(--blue); color: #fff; }
  .primary:disabled, .confirm:disabled { background: #cfd6e4; color: #6b7a99; cursor: not-allowed; }
  .confirm { background: #2f9e5b; color: #fff; flex: 2; }
  .ghost { background: #fff; color: var(--ink); flex: 1; }
  .full { width: 100%; }
  label.lbl { display: block; font-size: 14px; font-weight: 700; margin: 14px 0 6px; }
  .opts { display: flex; gap: 8px; flex-wrap: wrap; }
  .opt { flex: 1; min-width: 30%; background: #fff; color: var(--ink); font-size: 14px; min-height: 46px; padding: 8px; box-shadow: 2px 2px 0 var(--ink); }
  .opt.on { background: var(--blue-50); color: var(--blue); }
  .opt.on::before { content: '✳ '; color: var(--orange); }
  .hint { font-size: 13px; color: #5b6b8c; margin-top: 8px; text-align: center; line-height: 1.5; }
  .msg { padding: 13px; border-radius: 12px; margin-top: 16px; font-size: 15px; line-height: 1.5; border: 2px solid; }
  .msg.info { background: var(--blue-50); color: var(--ink); border-color: var(--blue-100); }
  .msg.error { background: #fff1ee; color: #b42318; border-color: #f5b5a6; }
  .msg.success { background: #ecfbf1; color: #1d7a45; font-weight: 700; border-color: #9fdcb8; }
  .item { border: 2px solid var(--ink); border-radius: 12px; padding: 12px 14px; margin-top: 10px; cursor: pointer; text-align: left; }
  .item.sel { background: var(--blue-50); box-shadow: 3px 3px 0 var(--ink); }
  .card { background: #fff; border-radius: 14px; padding: 4px 14px; margin-top: 14px; border: 2px solid var(--ink); }
  .kv { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 2px dashed var(--grid); gap: 12px; align-items: center; }
  .kv:last-child { border-bottom: none; }
  .k { color: #5b6b8c; font-weight: 700; white-space: nowrap; }
  .v { font-weight: 700; text-align: right; word-break: break-all; }
  .big { color: var(--blue); font-size: 22px; letter-spacing: 1px; }
  .tag { padding: 4px 10px; border-radius: 999px; font-size: 13px; border: 2px solid; }
  .tag.no { background: #fff6e8; color: #a14a12; border-color: #f3c58f; }
  .tag.yes { background: #ecfbf1; color: #1d7a45; border-color: #9fdcb8; }
  .actions { display: flex; gap: 10px; margin-top: 14px; }
  .codebox { text-align: center; background: var(--blue-50); border: 2px solid var(--ink); border-radius: 16px; padding: 18px; margin-top: 16px; }
  .codebox .code { font-size: 40px; font-weight: 800; color: var(--blue); letter-spacing: 3px; }
  .hidden { display: none !important; }
  .guide { display: block; text-align: center; margin-top: 16px; font-size: 14px; font-weight: 700; color: var(--blue); text-decoration: none; border: 2px dashed var(--blue-100); border-radius: 12px; padding: 10px; background: var(--blue-50); }
  .logout { background: none; color: #8a97b3; font-size: 13px; min-height: 0; padding: 14px 0 0; width: 100%; font-weight: 400; border: none; box-shadow: none; }
  /* 小鈴鐺 */
  .bell { position: relative; min-height: 44px; padding: 6px 14px; font-size: 15px; background: #fff; flex-shrink: 0; }
  .bell .dot { position: absolute; top: -8px; right: -8px; min-width: 22px; height: 22px; padding: 0 5px; border-radius: 999px; background: var(--orange); color: #fff; font-size: 12px; line-height: 18px; border: 2px solid var(--ink); }
  .bell.ring { animation: ring 1.2s ease-in-out 3; }
  @keyframes ring { 0%,100% { transform: rotate(0); } 15% { transform: rotate(14deg); } 30% { transform: rotate(-12deg); } 45% { transform: rotate(8deg); } 60% { transform: rotate(-5deg); } }
  .nowbar { display: flex; gap: 10px; align-items: flex-start; background: #fff6e8; border: 2px solid var(--ink); border-radius: 14px; padding: 10px 12px; margin-bottom: 14px; font-size: 14px; line-height: 1.5; cursor: pointer; }
  .nowbar b { color: var(--orange); }
  .sheet-bg { position: fixed; inset: 0; background: rgba(31,55,112,.35); z-index: 50; display: flex; align-items: flex-end; justify-content: center; }
  .sheet { background: var(--paper); width: 100%; max-width: 520px; max-height: 86vh; overflow-y: auto; border: 2px solid var(--ink); border-bottom: none; border-radius: 22px 22px 0 0; padding: 18px 16px 28px; }
  .sheet h2 { font-size: 19px; color: var(--ink); display: flex; justify-content: space-between; align-items: center; }
  .sheet h3 { font-size: 14px; color: var(--orange); margin: 16px 0 8px; letter-spacing: 1px; }
  .sheet .close { min-height: 38px; padding: 4px 14px; font-size: 14px; }
  .tl { background: #fff; border: 2px solid var(--ink); border-radius: 12px; padding: 10px 12px; margin-bottom: 8px; }
  .tl .t { font-weight: 700; color: var(--blue); font-size: 13px; margin-bottom: 2px; }
  .tl .ti { font-weight: 700; font-size: 15px; }
  .tl .d { font-size: 13px; color: #5b6b8c; margin-top: 2px; line-height: 1.5; }
  .tl.now { background: #fff6e8; box-shadow: 3px 3px 0 var(--orange); border-color: var(--orange); }
  .tl.now .t::after { content: '現在'; margin-left: 8px; background: var(--orange); color: #fff; border-radius: 999px; padding: 1px 8px; font-size: 12px; }
  .tl.past { opacity: .5; }
  .tl.meal .t::before { content: '🍱 '; }
  .note { font-size: 13px; color: #5b6b8c; background: #fff; border: 2px dashed var(--grid); border-radius: 12px; padding: 10px 12px; line-height: 1.5; }
  .toast { position: fixed; left: 50%; top: 16px; transform: translateX(-50%); z-index: 60; background: var(--orange); color: #fff; font-weight: 700; padding: 12px 18px; border: 2px solid var(--ink); border-radius: 14px; box-shadow: 3px 3px 0 var(--ink); max-width: 92vw; text-align: center; cursor: pointer; }
</style>
</head>
<body>
<div class="container">
  <span class="ribbon">✳ 115年修平特殊教育宣導</span>
  <h1>工作人員系統</h1>
  <p class="sub">「給情緒喘口氣」活動現場用</p>

  <div id="loginView">
    <div class="row">
      <input id="pinInput" class="center" type="password" inputmode="numeric" autocomplete="off" placeholder="個人密碼">
      <button class="primary" id="loginBtn">登入</button>
    </div>
    <a class="guide" href="${GUIDE_URL}" target="_blank" rel="noopener">▶ 第一次用？看操作示範動畫</a>
  </div>

  <div id="mainView" class="hidden">
    <div class="topbar">
      <p class="who" id="who"></p>
      <button type="button" class="bell" id="bellBtn" aria-label="今日提醒">🔔 提醒<span class="dot hidden" id="bellDot"></span></button>
    </div>
    <div class="nowbar hidden" id="nowBar"></div>
    <div class="tabs">
      <button class="tab on" data-tab="pickup">領取查詢</button>
      <button class="tab" data-tab="register">代為報到</button>
      <button class="tab" data-tab="care">關懷登記</button>
    </div>

    <div id="pickupTab">
      <div class="opts" style="margin-bottom:10px">
        <button type="button" class="opt on" data-mode="code">用序號查</button>
        <button type="button" class="opt" data-mode="name">忘記序號？用姓名查</button>
      </div>
      <div class="row">
        <input id="queryInput" class="center" type="text" inputmode="numeric" autocomplete="off" placeholder="序號，例：1 或 001">
        <button class="primary" id="searchBtn">搜尋</button>
      </div>
      <div class="hint" id="searchHint"></div>
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

    <div id="careTab" class="hidden">
      <p class="hint" style="text-align:left;margin:0 0 12px">心理師用：輸入參加者序號，確認姓名是本人後，登記「需追蹤關懷」。系統只記錄註記，不存分數，也不顯示手機。</p>
      <div class="row">
        <input id="careInput" class="center" type="text" inputmode="numeric" autocomplete="off" placeholder="序號，例：12">
        <button class="primary" id="careBtn">查詢</button>
      </div>
      <div id="careOut"></div>
    </div>

    <a class="guide" href="${GUIDE_URL}" target="_blank" rel="noopener">▶ 操作示範動畫</a>
    <button class="logout" id="logoutBtn">登出</button>
  </div>
</div>

<script>
  var pin = sessionStorage.getItem('staffPin') || '';
  var staffName = sessionStorage.getItem('staffName') || '';
  var schedule = null;
  try { schedule = JSON.parse(sessionStorage.getItem('staffSchedule') || 'null'); } catch (e) { schedule = null; }
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
    $('who').textContent = '👋 ' + staffName;
    $('queryInput').focus();
    refreshReminders(true);
  }
  function login() {
    var value = $('pinInput').value.trim();
    if (!value) return;
    $('loginBtn').disabled = true;
    google.script.run.withSuccessHandler(function (r) {
      $('loginBtn').disabled = false;
      if (r && r.ok) {
        pin = value; staffName = r.name; schedule = r.schedule || null;
        sessionStorage.setItem('staffPin', pin); sessionStorage.setItem('staffName', staffName);
        sessionStorage.setItem('staffSchedule', JSON.stringify(schedule));
        showMain();
      } else { $('pinInput').value = ''; alert('密碼錯誤'); }
    }).withFailureHandler(function () { $('loginBtn').disabled = false; alert('連線失敗，請再試一次'); }).staffLogin(value);
  }
  function logout() {
    sessionStorage.removeItem('staffPin'); sessionStorage.removeItem('staffName'); sessionStorage.removeItem('staffSchedule');
    location.reload();
  }

  // ---------- 分頁 ----------
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
    t.onclick = function () {
      Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (x) { x.classList.toggle('on', x === t); });
      $('pickupTab').classList.toggle('hidden', t.dataset.tab !== 'pickup');
      $('registerTab').classList.toggle('hidden', t.dataset.tab !== 'register');
      $('careTab').classList.toggle('hidden', t.dataset.tab !== 'care');
    };
  });

  // ---------- 領取查詢 ----------
  var searchMode = 'code';
  var HINTS = {
    code: '序號只要輸入數字，前面的 0 和 SEM 可打可不打：\\n1、001、SEM001 都是 SEM001；45、045 都是 SEM045；120 就是 SEM120',
    name: '輸入姓名或其中幾個字（例：輸入「小明」也找得到「王小明」）。同名時請核對身分與年齡後再選擇'
  };
  function setMode(mode) {
    searchMode = mode;
    Array.prototype.forEach.call(document.querySelectorAll('.opt[data-mode]'), function (x) { x.classList.toggle('on', x.dataset.mode === mode); });
    var input = $('queryInput');
    input.value = '';
    input.setAttribute('inputmode', mode === 'code' ? 'numeric' : 'text');
    input.placeholder = mode === 'code' ? '序號，例：1 或 001' : '參加者姓名';
    $('searchHint').textContent = HINTS[mode];
    $('out').innerHTML = '';
    input.focus();
  }
  Array.prototype.forEach.call(document.querySelectorAll('.opt[data-mode]'), function (b) {
    b.onclick = function () { setMode(b.dataset.mode); };
  });
  $('searchHint').style.whiteSpace = 'pre-line';
  $('searchHint').textContent = HINTS.code;

  function search() {
    var q = $('queryInput').value.trim();
    if (!q) return;
    msg($('out'), '搜尋中…', 'info');
    $('searchBtn').disabled = true;
    call('staffSearch', [pin, q, searchMode], function (r) {
      $('searchBtn').disabled = false;
      if (!r.ok) {
        msg($('out'), searchMode === 'code' ? '序號格式不正確：請只輸入數字（例：1、001、120），或改用姓名查' : '請輸入姓名', 'error');
        return;
      }
      results = r.results;
      if (!results.length) {
        msg($('out'), searchMode === 'code' ? '查無此序號，請再確認數字，或改用「忘記序號？用姓名查」' : '查無此姓名，請確認字是否正確（可只輸入其中幾個字）', 'error');
        return;
      }
      if (results.length === 1) { select(0); return; }
      renderList(-1);
    });
  }

  function renderList(selected) {
    var out = $('out');
    out.innerHTML = '';
    out.appendChild(el('div', 'msg info', '找到 ' + results.length + ' 筆' + (results.length >= 30 ? '（只列前 30 筆，請輸入更完整的姓名）' : '') + '，請核對姓名、身分與年齡後選擇：'));
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
    if (!s.done) { $('out').appendChild(el('div', 'msg error', '尚未完成活動（12歲以上需完成問卷；未滿12歲需完成小測驗和回饋問卷），請參加者完成後再來領取')); }
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
  Array.prototype.forEach.call(document.querySelectorAll('.opt[data-group]'), function (b) {
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
      cb.appendChild(el('div', 'hint', '請告訴參加者序號，先用家長手機（沒有再用平板）選「我已經有序號」輸入' + (r.sms === true ? '（簡訊已發送）' : r.sms === false ? '（簡訊發送失敗）' : '')));
      box.appendChild(cb);
      $('rName').value = ''; $('rPhone').value = '';
      choice = { identity: '', age: '' };
      Array.prototype.forEach.call(document.querySelectorAll('.opt[data-group]'), function (x) { x.classList.remove('on'); });
    }, $('regOut'));
  }

  // ---------- 小鈴鐺：活動當天時程與個人分工 ----------
  function nowDate() { return window.__STAFF_NOW__ ? new Date(window.__STAFF_NOW__) : new Date(); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toMin(hm) { var p = hm.split(':'); return Number(p[0]) * 60 + Number(p[1]); }
  function today() { var d = nowDate(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function nowMin() { var d = nowDate(); return d.getHours() * 60 + d.getMinutes(); }
  function status(it) {
    if (!schedule || today() !== schedule.date) return '';
    var m = nowMin();
    if (m >= toMin(it.end)) return 'past';
    if (m >= toMin(it.start)) return 'now';
    return '';
  }
  function currentItems() {
    if (!schedule) return [];
    return schedule.mine.concat(schedule.all).filter(function (it) { return status(it) === 'now'; });
  }
  var seen = {};
  try { seen = JSON.parse(sessionStorage.getItem('staffSeen') || '{}'); } catch (e) { seen = {}; }
  function keyOf(it) { return it.start + it.title; }
  function refreshReminders(first) {
    var bell = $('bellBtn'), dot = $('bellDot'), bar = $('nowBar');
    if (!schedule) { bell.classList.add('hidden'); bar.classList.add('hidden'); return; }
    bell.classList.remove('hidden');
    var cur = currentItems();
    var mineNow = cur.filter(function (it) { return schedule.mine.indexOf(it) !== -1; });
    var fresh = cur.filter(function (it) { return !seen[keyOf(it)]; });
    dot.textContent = fresh.length;
    dot.classList.toggle('hidden', !fresh.length);
    if (fresh.length && !first) { bell.classList.remove('ring'); void bell.offsetWidth; bell.classList.add('ring'); chime(); }
    // 午餐時間跳出提示（每個人只跳一次）
    cur.forEach(function (it) {
      if (it.meal && !seen['toast' + keyOf(it)]) { seen['toast' + keyOf(it)] = 1; saveSeen(); toast('🍱 ' + it.start + ' 午餐時間到了！大家輪流吃便當喔'); }
    });
    var show = mineNow.length ? mineNow[0] : cur[0];
    if (show) {
      bar.innerHTML = '';
      bar.appendChild(el('span', '', '⏰'));
      var box = el('div', '');
      var b = el('b', '', '現在 ' + show.start + '–' + show.end + '：' + show.title);
      box.appendChild(b);
      if (show.detail) box.appendChild(el('div', '', show.detail));
      bar.appendChild(box);
      bar.classList.remove('hidden');
    } else bar.classList.add('hidden');
  }
  function saveSeen() { try { sessionStorage.setItem('staffSeen', JSON.stringify(seen)); } catch (e) {} }
  function toast(text) {
    var t = el('div', 'toast', text);
    t.onclick = function () { t.remove(); };
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 12000);
  }
  function tlItem(it) {
    var st = status(it);
    var row = el('div', 'tl' + (st ? ' ' + st : '') + (it.meal ? ' meal' : ''));
    row.appendChild(el('div', 't', it.start + '–' + it.end));
    var body = el('div', '');
    body.appendChild(el('div', 'ti', it.title));
    if (it.detail) body.appendChild(el('div', 'd', it.detail));
    row.appendChild(body);
    return row;
  }
  function openSheet() {
    currentItems().forEach(function (it) { seen[keyOf(it)] = 1; });
    saveSeen();
    refreshReminders(true);
    var bg = el('div', 'sheet-bg');
    var sh = el('div', 'sheet');
    var h = el('h2', '', '🔔 今日提醒');
    var x = el('button', 'close', '關閉');
    x.onclick = function () { bg.remove(); };
    h.appendChild(x);
    sh.appendChild(h);
    var d = schedule.date.split('-');
    if (schedule.pre) sh.appendChild(el('div', 'note', '📌 ' + schedule.pre));
    if (today() !== schedule.date) sh.appendChild(el('div', 'note', '活動日是 ' + Number(d[1]) + '/' + Number(d[2]) + '（六）。當天會自動標出「現在」的時段，換時段時小鈴鐺會響。'));
    sh.appendChild(el('h3', '', '✳ 我的工作（' + staffName + '）'));
    if (schedule.mine.length) schedule.mine.forEach(function (it) { sh.appendChild(tlItem(it)); });
    else sh.appendChild(el('div', 'note', '沒有找到你的個人分工，請依照現場主控安排。'));
    sh.appendChild(el('h3', '', '✳ 全體時程'));
    schedule.all.forEach(function (it) { sh.appendChild(tlItem(it)); });
    bg.appendChild(sh);
    bg.onclick = function (e) { if (e.target === bg) bg.remove(); };
    document.body.appendChild(bg);
  }
  // ---------- 關懷登記（心理師） ----------
  function careSearch() {
    var q = $('careInput').value.trim();
    var box = $('careOut');
    if (!q) return;
    msg(box, '查詢中…', 'info');
    call('staffCareLookup', [pin, q], function (r) {
      if (!r.ok) { msg(box, '序號格式不對，請輸入數字（例：12）', 'error'); return; }
      if (!r.result) { msg(box, '查無此序號，請再確認一次', 'error'); return; }
      var x = r.result;
      box.innerHTML = '';
      var card = el('div', 'card');
      kv(card, '序號', x.code, 'big');
      kv(card, '姓名', x.name);
      kv(card, '關懷註記', x.care || '（尚未登記）');
      box.appendChild(card);
      if (x.care) { box.appendChild(el('div', 'msg info', '這位已經登記過了，不用重複登記。')); return; }
      box.appendChild(el('div', 'msg info', '請參加者說出姓名，確認是本人再登記。'));
      var b = el('button', 'confirm full', '✓ 登記需追蹤關懷');
      b.style.marginTop = '12px';
      b.onclick = function () {
        b.disabled = true;
        call('staffCareMark', [pin, x.row], function (m) {
          if (m.ok) { msg(box, '✓ ' + x.code + ' ' + x.name + ' 已登記：' + m.care, 'success'); $('careInput').value = ''; }
          else { b.disabled = false; msg(box, '登記失敗，請再試一次', 'error'); }
        }, box);
      };
      box.appendChild(b);
    }, box);
  }
  $('careBtn').onclick = careSearch;
  $('careInput').onkeydown = function (e) { if (e.key === 'Enter') careSearch(); };

  // ---------- 提示音＋震動（網頁開著時；iPhone 不支援震動） ----------
  var audioCtx = null;
  function unlockAudio() {
    try {
      if (!audioCtx) { var AC = window.AudioContext || window.webkitAudioContext; if (AC) audioCtx = new AC(); }
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}
  }
  document.addEventListener('click', unlockAudio, { once: true });
  document.addEventListener('touchstart', unlockAudio, { once: true });
  function chime() {
    try {
      unlockAudio();
      if (audioCtx) {
        var t = audioCtx.currentTime;
        [0, 0.28].forEach(function (d, i) {
          var o = audioCtx.createOscillator(), g = audioCtx.createGain();
          o.type = 'sine'; o.frequency.value = i ? 1175 : 880;
          g.gain.setValueAtTime(0.0001, t + d);
          g.gain.exponentialRampToValueAtTime(0.35, t + d + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.25);
          o.connect(g); g.connect(audioCtx.destination);
          o.start(t + d); o.stop(t + d + 0.27);
        });
      }
    } catch (e) {}
    try { if (navigator.vibrate) navigator.vibrate([250, 120, 250]); } catch (e) {}
  }

  $('bellBtn').onclick = openSheet;
  $('nowBar').onclick = openSheet;
  setInterval(function () { if (pin) refreshReminders(false); }, 30000);

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
