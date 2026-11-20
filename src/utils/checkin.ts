// 報到系統（Google Apps Script Web App）串接
// 網址可在建置時用環境變數 VITE_CHECKIN_API_URL 覆寫（測試用）；留空字串則整個報到關卡會關閉
export const CHECKIN_API_URL: string =
  import.meta.env.VITE_CHECKIN_API_URL ??
  'https://script.google.com/a/macros/hust.edu.tw/s/AKfycbwKDO_NUSuS1AsXyEeeNqmMySlLs1wH1LDwOwoIqKdcHX0G6pYoSp7TyWiQoHyMIaEEGQ/exec';

// 網頁報到失敗時的備用 Google 表單
export const BACKUP_CHECKIN_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSdjchFJX6OyqKN3NFDI6tJlzNalZiAeKYWCy6SUArcwQdVnNQ/viewform';

export const CHECKIN_ENABLED = CHECKIN_API_URL.length > 0;

export type CheckinError =
  | 'invalid_name' | 'invalid_identity' | 'invalid_phone'
  | 'phone_taken' | 'full' | 'busy' | 'server' | 'network' | 'not_found';

export interface CheckinResult {
  ok: boolean;
  code?: string;
  status?: 'new' | 'existing';
  sms?: boolean;
  error?: CheckinError;
}

const TIMEOUT_MS = 20000;

/** 與 Apps Script 的 normalizePhone_ 規則相同：統一成 09 開頭 10 碼，不合格回傳空字串 */
export const normalizePhone = (raw: string): string => {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('886')) d = d.slice(3);
  if (d.length === 9 && d[0] === '9') d = '0' + d;
  return /^09\d{8}$/.test(d) ? d : '';
};

/** SEM012、sem12、12 → SEM012 */
export const normalizeCode = (raw: string): string => {
  const m = raw.trim().toUpperCase().match(/^(?:SEM)?\s*0*(\d{1,4})$/);
  return m ? 'SEM' + m[1].padStart(3, '0') : '';
};

const request = async (input: string, init?: RequestInit): Promise<any> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(input, { ...init, signal: controller.signal, redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
};

export const registerCheckin = async (name: string, identity: string, phone: string): Promise<CheckinResult> => {
  try {
    // 用 text/plain 送出，避免瀏覽器先送 CORS 預檢請求（Apps Script 不支援）
    const data = await request(CHECKIN_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'register', name, identity, phone }),
    });
    if (data && data.ok && data.code) return { ok: true, code: String(data.code), status: data.status, sms: data.sms };
    return { ok: false, error: (data && data.error) || 'server' };
  } catch {
    return { ok: false, error: 'network' };
  }
};

export const verifyCheckinCode = async (code: string): Promise<CheckinResult> => {
  try {
    const data = await request(`${CHECKIN_API_URL}?action=verify&code=${encodeURIComponent(code)}`);
    if (data && data.ok) return { ok: true, code: String(data.code), status: 'existing' };
    return { ok: false, error: 'not_found' };
  } catch {
    return { ok: false, error: 'network' };
  }
};
