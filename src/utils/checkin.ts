// 報到系統（Google Apps Script Web App）串接
// 網址可在建置時用環境變數 VITE_CHECKIN_API_URL 覆寫（測試用）
export const CHECKIN_API_URL: string =
  import.meta.env.VITE_CHECKIN_API_URL ||
  'https://script.google.com/a/macros/hust.edu.tw/s/AKfycbwKDO_NUSuS1AsXyEeeNqmMySlLs1wH1LDwOwoIqKdcHX0G6pYoSp7TyWiQoHyMIaEEGQ/exec';

export type AgeGroup = 'adult' | 'child';

export type CheckinError =
  | 'invalid_name' | 'invalid_identity' | 'invalid_age' | 'invalid_phone'
  | 'phone_taken' | 'full' | 'busy' | 'server' | 'network' | 'not_found' | 'invalid_survey';

export interface CheckinResult {
  ok: boolean;
  code?: string;
  status?: 'new' | 'existing';
  age?: AgeGroup;
  completed?: boolean;
  sms?: boolean;
  error?: CheckinError;
}

export interface SurveyAnswers {
  gender: string;
  q1: string;
  q2: number;
  q3: number;
  q4: string;
}

const TIMEOUT_MS = 20000;

// 預覽模式（建置時設 VITE_PREVIEW=1）：不連後端、不發簡訊，回傳假資料
const PREVIEW = import.meta.env.VITE_PREVIEW === '1';
let previewAge: AgeGroup = 'adult';

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

// 用 text/plain 送出，避免瀏覽器先送 CORS 預檢請求（Apps Script 不支援）
const post = (body: object) =>
  request(CHECKIN_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });

const toAge = (v: unknown): AgeGroup => (v === 'child' ? 'child' : 'adult');

export const registerCheckin = async (name: string, identity: string, age: AgeGroup, phone: string): Promise<CheckinResult> => {
  if (PREVIEW) { previewAge = age; return { ok: true, code: 'SEM000', status: 'new', age, completed: false, sms: false }; }
  try {
    const data = await post({ action: 'register', name, identity, age, phone });
    if (data && data.ok && data.code) {
      return { ok: true, code: String(data.code), status: data.status, age: toAge(data.age), completed: !!data.completed, sms: data.sms };
    }
    return { ok: false, error: (data && data.error) || 'server' };
  } catch {
    return { ok: false, error: 'network' };
  }
};

export const verifyCheckinCode = async (code: string): Promise<CheckinResult> => {
  if (PREVIEW) return { ok: true, code, status: 'existing', age: previewAge, completed: false };
  try {
    const data = await request(`${CHECKIN_API_URL}?action=verify&code=${encodeURIComponent(code)}`);
    if (data && data.ok) return { ok: true, code: String(data.code), status: 'existing', age: toAge(data.age), completed: !!data.completed };
    return { ok: false, error: 'not_found' };
  } catch {
    return { ok: false, error: 'network' };
  }
};

/** 完成活動：12 歲以上要附問卷；未滿 12 歲不用 */
export const completeActivity = async (code: string, survey?: SurveyAnswers): Promise<CheckinResult> => {
  if (PREVIEW) return { ok: true, completed: true };
  try {
    const data = await post({ action: 'complete', code, survey });
    if (data && data.ok) return { ok: true, completed: true };
    return { ok: false, error: (data && data.error) || 'server' };
  } catch {
    return { ok: false, error: 'network' };
  }
};
