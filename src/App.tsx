import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, CheckCircle2, ChevronRight, ArrowRight, ShieldCheck, Globe2, Brain, ListTree, HeartHandshake, EyeOff, Users, Lightbulb, RotateCcw, X, Phone, Lock, Ticket, Loader2 } from 'lucide-react';
import { Language, QuizQuestion } from './types';
import { UI_TEXT, INTRO_CONTENT, QUIZ_INTRO, QUIZ_QUESTIONS, BSRS_QUESTIONS, BSRS_SUICIDE_QUESTION, BSRS_OPTIONS, HELP_LINES, SCHOOL_COUNSELING, CHECKIN_IDENTITIES } from './data/content';
import { playSound } from './utils/audio';
import { BACKUP_CHECKIN_FORM_URL, CHECKIN_ENABLED, CheckinError, normalizeCode, normalizePhone, registerCheckin, verifyCheckinCode } from './utils/checkin';

// --- Settings ---
const COUNSELOR_CODE = '1031';
const FEEDBACK_FORM_URL = 'https://forms.gle/myEPAbGQHhxUiGQZ7';
const STORAGE_KEY = 'hsiuping-emotion-campaign';
const STORAGE_TTL_MS = 2 * 60 * 60 * 1000; // 進度保留 2 小時，避免共用裝置留下前一位的結果

// 圖片路徑一律相對於網站根目錄（支援 GitHub Pages 子路徑）
const asset = (file: string) => `${import.meta.env.BASE_URL}assets/${file}`;

// --- Types ---
type Step = 'language' | 'checkin' | 'welcome' | 'quiz' | 'bsrs' | 'bsrs_result' | 'counselor' | 'feedback';
type ShuffledQuestion = { original: QuizQuestion; options: QuizQuestion['options'] };

interface SavedState {
  ts: number;
  lang: Language;
  step: Step;
  quizOrder: { id: string; opts: string[] }[];
  quizAnswers: Record<string, string>;
  showQuizResults: boolean;
  quizPassed: boolean;
  bsrsAnswers: Record<string, number>;
  counselorPassed: boolean;
  checkinCode: string;
}

const loadSaved = (): Partial<SavedState> => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as SavedState;
    if (!data.ts || Date.now() - data.ts > STORAGE_TTL_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return {};
    }
    return data;
  } catch {
    return {};
  }
};

const restoreQuiz = (order?: SavedState['quizOrder']): ShuffledQuestion[] => {
  if (!order || order.length !== QUIZ_QUESTIONS.length) return [];
  const result: ShuffledQuestion[] = [];
  for (const item of order) {
    const q = QUIZ_QUESTIONS.find(x => x.id === item.id);
    if (!q) return [];
    const opts = item.opts.map(id => q.options.find(o => o.id === id)).filter(Boolean) as QuizQuestion['options'];
    if (opts.length !== q.options.length) return [];
    result.push({ original: q, options: opts });
  }
  return result;
};

const shuffleArray = <T,>(arr: T[]): T[] => {
  const newArr = [...arr];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

// 題目與選項都洗牌，只把「以上都是／以上皆是」固定在最後
const buildShuffledQuiz = (): ShuffledQuestion[] =>
  shuffleArray(QUIZ_QUESTIONS).map(q => {
    const allOfAbove = q.options.find(opt => opt.text.zh.includes('以上都') || opt.text.zh.includes('以上皆'));
    const options = shuffleArray(q.options.filter(opt => opt !== allOfAbove));
    if (allOfAbove) options.push(allOfAbove);
    return { original: q, options };
  });

const iconMap: Record<string, React.ReactNode> = {
  Brain: <Brain className="w-12 h-12 text-teal-600" />,
  ListTree: <ListTree className="w-12 h-12 text-teal-600" />,
  HeartHandshake: <HeartHandshake className="w-12 h-12 text-teal-600" />,
  EyeOff: <EyeOff className="w-12 h-12 text-teal-600" />,
  Users: <Users className="w-12 h-12 text-teal-600" />,
};

const HTML_LANG: Record<Language, string> = { zh: 'zh-Hant-TW', en: 'en', vi: 'vi' };

const scrollToElement = (id: string, offset: number) => {
  const el = document.getElementById(id);
  if (!el) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const y = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top: y, behavior: 'smooth' });
};

const primaryBtn = 'w-full bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-semibold py-4 px-6 rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-md shadow-teal-900/10';

export default function App() {
  const [saved] = useState(loadSaved);

  const [lang, setLang] = useState<Language>(saved.lang ?? 'zh');
  const [currentStep, setCurrentStep] = useState<Step>(saved.step ?? 'language');

  // Quiz State
  const [shuffledQuiz, setShuffledQuiz] = useState<ShuffledQuestion[]>(() => restoreQuiz(saved.quizOrder));
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>(saved.quizAnswers ?? {});
  const [showQuizResults, setShowQuizResults] = useState(saved.showQuizResults ?? false);
  const [quizPassed, setQuizPassed] = useState(saved.quizPassed ?? false);
  const [quizError, setQuizError] = useState(false);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  // BSRS State
  const [bsrsAnswers, setBsrsAnswers] = useState<Record<string, number>>(saved.bsrsAnswers ?? {});
  const [bsrsError, setBsrsError] = useState(false);

  // Counselor Gate State
  const [counselorCode, setCounselorCode] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [counselorPassed, setCounselorPassed] = useState(saved.counselorPassed ?? false);

  const [showCareModal, setShowCareModal] = useState(false);

  // Check-in State（報到後取得兌換碼，才能進入闖關）
  const [checkinCode, setCheckinCode] = useState(saved.checkinCode ?? '');
  const [checkinMode, setCheckinMode] = useState<'register' | 'code'>('register');
  const [checkinName, setCheckinName] = useState('');
  const [checkinIdentity, setCheckinIdentity] = useState('');
  const [checkinPhone, setCheckinPhone] = useState('');
  const [checkinCodeInput, setCheckinCodeInput] = useState('');
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [checkinError, setCheckinError] = useState<CheckinError | 'form' | null>(null);
  const [checkinDone, setCheckinDone] = useState<{ code: string; status: 'new' | 'existing'; sms?: boolean } | null>(null);
  const hasCheckin = !CHECKIN_ENABLED || !!checkinCode;

  const pick = (zh: string, en: string, vi: string) => (lang === 'zh' ? zh : lang === 'en' ? en : vi);

  // --- Derived scores ---
  const allBsrsQuestions = [...BSRS_QUESTIONS, BSRS_SUICIDE_QUESTION];
  const bsrsComplete = allBsrsQuestions.every(q => bsrsAnswers[q.id] !== undefined);
  const totalBaseScore = BSRS_QUESTIONS.reduce((sum, q) => sum + (bsrsAnswers[q.id] || 0), 0);
  const suicideScore = bsrsAnswers[BSRS_SUICIDE_QUESTION.id] || 0;
  const needsCounselor = totalBaseScore >= 6 || suicideScore >= 2;

  // 防止用瀏覽器「上一頁／下一頁」跳過關卡
  const resolveStep = (step: Step): Step => {
    if (step !== 'language' && step !== 'checkin' && !hasCheckin) return 'checkin';
    switch (step) {
      case 'checkin': return CHECKIN_ENABLED ? 'checkin' : 'welcome';
      case 'bsrs': return quizPassed ? 'bsrs' : 'quiz';
      case 'bsrs_result': return bsrsComplete ? 'bsrs_result' : resolveStep('bsrs');
      case 'counselor': return bsrsComplete && needsCounselor ? 'counselor' : resolveStep('bsrs_result');
      case 'feedback': return bsrsComplete && (!needsCounselor || counselorPassed) ? 'feedback' : resolveStep('counselor');
      default: return step;
    }
  };

  // --- Effects ---
  // 讓手機的「返回」鍵回到上一關，而不是直接離開網頁
  useEffect(() => {
    window.history.replaceState({ step: currentStep }, '');
    const onPop = (e: PopStateEvent) => {
      const step = (e.state?.step as Step | undefined) ?? 'language';
      setShowCareModal(false);
      setCurrentStep(step);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const resolved = resolveStep(currentStep);
    if (resolved !== currentStep) {
      setCurrentStep(resolved);
      window.history.replaceState({ step: resolved }, '');
    }
  }, [currentStep, quizPassed, bsrsComplete, needsCounselor, counselorPassed, hasCheckin]);

  useEffect(() => {
    if (currentStep === 'quiz' && shuffledQuiz.length === 0) {
      setShuffledQuiz(buildShuffledQuiz());
    }
  }, [currentStep, shuffledQuiz.length]);

  useEffect(() => {
    document.documentElement.lang = HTML_LANG[lang];
  }, [lang]);

  // 暫存進度：切去填 Google 表單、或手機重新整理頁面後，不會從頭開始
  useEffect(() => {
    const data: SavedState = {
      ts: Date.now(),
      lang,
      step: currentStep,
      quizOrder: shuffledQuiz.map(q => ({ id: q.original.id, opts: q.options.map(o => o.id) })),
      quizAnswers,
      showQuizResults,
      quizPassed,
      bsrsAnswers,
      counselorPassed,
      checkinCode,
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // 無痕模式等情況可能無法寫入，略過即可
    }
  }, [lang, currentStep, shuffledQuiz, quizAnswers, showQuizResults, quizPassed, bsrsAnswers, counselorPassed, checkinCode]);

  useEffect(() => {
    if (!showCareModal) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setShowCareModal(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showCareModal]);

  // --- Handlers ---
  const goTo = (next: Step) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setCurrentStep(next);
    window.history.pushState({ step: next }, '');
  };

  const handleSelectLanguage = (selectedLang: Language) => {
    setLang(selectedLang);
    goTo(hasCheckin ? 'welcome' : 'checkin');
  };

  const handleCheckinRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checkinBusy) return;
    const phone = normalizePhone(checkinPhone);
    if (!checkinName.trim() || !checkinIdentity) {
      setCheckinError('form');
      return;
    }
    if (!phone) {
      setCheckinError('invalid_phone');
      return;
    }
    setCheckinBusy(true);
    setCheckinError(null);
    const result = await registerCheckin(checkinName.trim(), checkinIdentity, phone);
    setCheckinBusy(false);
    if (result.ok) {
      playSound('success');
      setCheckinCode(result.code!);
      setCheckinDone({ code: result.code!, status: result.status ?? 'new', sms: result.sms });
    } else {
      playSound('wrong');
      setCheckinError(result.error ?? 'server');
    }
  };

  const handleCheckinVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checkinBusy) return;
    const code = normalizeCode(checkinCodeInput);
    if (!code) {
      setCheckinError('not_found');
      return;
    }
    setCheckinBusy(true);
    setCheckinError(null);
    const result = await verifyCheckinCode(code);
    setCheckinBusy(false);
    if (result.ok) {
      playSound('success');
      setCheckinCode(result.code!);
      goTo('welcome');
    } else {
      playSound('wrong');
      setCheckinError(result.error ?? 'server');
    }
  };

  const resetQuiz = () => {
    setShuffledQuiz(buildShuffledQuiz());
    setQuizAnswers({});
    setShowQuizResults(false);
    setQuizPassed(false);
    setQuizError(false);
  };

  const handleGoHome = () => {
    setShuffledQuiz([]);
    setQuizAnswers({});
    setShowQuizResults(false);
    setQuizPassed(false);
    setQuizError(false);
    setBsrsAnswers({});
    setBsrsError(false);
    setCounselorCode('');
    setCodeError(false);
    setCounselorPassed(false);
    setShowCareModal(false);
    goTo('welcome');
  };

  const handleQuizSubmit = () => {
    const firstUnanswered = shuffledQuiz.find(q => quizAnswers[q.original.id] === undefined);
    if (firstUnanswered) {
      setQuizError(true);
      scrollToElement(`quiz-q-${firstUnanswered.original.id}`, 110);
      return;
    }
    setQuizError(false);

    const allCorrect = shuffledQuiz.every(q => quizAnswers[q.original.id] === q.original.correctAnswerId);
    playSound(allCorrect ? 'success' : 'wrong');
    setQuizPassed(allCorrect);
    setShowQuizResults(true);

    // 捲回第 1 題，方便從頭閱讀解說
    setTimeout(() => scrollToElement('quiz-top', 120), 100);
  };

  const handleQuizOptionSelect = (questionId: string, optionId: string) => {
    setQuizAnswers(prev => ({ ...prev, [questionId]: optionId }));
    setQuizError(false);
    playSound('click');
  };

  const handleBsrsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const firstUnanswered = allBsrsQuestions.find(q => bsrsAnswers[q.id] === undefined);
    if (firstUnanswered) {
      setBsrsError(true);
      scrollToElement(`bsrs-q-${firstUnanswered.id}`, 100);
      return;
    }
    setBsrsError(false);
    goTo('bsrs_result');
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (counselorCode === COUNSELOR_CODE) {
      setCodeError(false);
      setCounselorPassed(true);
      playSound('success');
      goTo('feedback');
    } else {
      setCodeError(true);
      playSound('wrong');
    }
  };

  // --- Shared pieces ---
  const renderLogo = (className: string) =>
    imgErrors.logo ? (
      <Heart className="w-1/2 h-1/2 text-teal-400" />
    ) : (
      <img
        src={asset('logo.webp')}
        alt={pick('活動標誌', 'Campaign logo', 'Logo chương trình')}
        className={className}
        onError={() => setImgErrors(prev => ({ ...prev, logo: true }))}
      />
    );

  const renderHelpResources = (tone: 'red' | 'orange') => (
    <div className={`text-left rounded-2xl border p-5 space-y-3 bg-white ${tone === 'red' ? 'border-red-200' : 'border-orange-200'}`}>
      <div className="flex items-center gap-2">
        <Phone className={`w-4 h-4 ${tone === 'red' ? 'text-red-500' : 'text-orange-500'}`} />
        <h3 className="font-bold text-gray-900 text-sm">
          {pick('隨時都可以找人聊聊', 'Someone is always here to listen', 'Luôn có người sẵn sàng lắng nghe bạn')}
        </h3>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">
        {pick(
          '如果現在不在活動現場，或之後想找人說說話，可以撥打以下專線：',
          'If you are not at the event now, or want to talk to someone later, you can call:',
          'Nếu bạn không có mặt tại sự kiện, hoặc muốn tâm sự sau này, bạn có thể gọi:'
        )}
      </p>
      <ul className="space-y-2">
        {HELP_LINES.map(line => (
          <li key={line.number}>
            <a
              href={`tel:${line.number}`}
              className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 hover:bg-teal-50 border border-gray-100 px-4 py-3 transition-colors"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-gray-900">{line.name[lang]}</span>
                <span className="block text-xs text-gray-500">{line.note[lang]}</span>
              </span>
              <span className="shrink-0 text-lg font-bold text-teal-700 tabular-nums">{line.number}</span>
            </a>
          </li>
        ))}
        {SCHOOL_COUNSELING.phone && (
          <li>
            <a
              href={`tel:+886${SCHOOL_COUNSELING.phone.replace(/\D/g, '').replace(/^0/, '')}${SCHOOL_COUNSELING.ext ? `,${SCHOOL_COUNSELING.ext}` : ''}`}
              className="flex items-center justify-between gap-3 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-100 px-4 py-3 transition-colors"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-gray-900">{SCHOOL_COUNSELING.name[lang]}</span>
                {SCHOOL_COUNSELING.location[lang] && <span className="block text-xs text-gray-500">{SCHOOL_COUNSELING.location[lang]}</span>}
              </span>
              <span className="shrink-0 text-right tabular-nums">
                <span className="block text-sm font-bold text-teal-700">{SCHOOL_COUNSELING.phone}</span>
                {SCHOOL_COUNSELING.ext && (
                  <span className="block text-xs font-semibold text-teal-600">
                    {pick('分機', 'ext.', 'máy lẻ')} {SCHOOL_COUNSELING.ext}
                  </span>
                )}
              </span>
            </a>
          </li>
        )}
      </ul>
    </div>
  );

  // --- Render Helpers ---
  const renderHeader = () => {
    if (currentStep === 'language') return null;
    const stepLabel: Record<Exclude<Step, 'language'>, string> = {
      checkin: pick('活動報到', 'Check-in', 'Điểm danh'),
      welcome: pick('準備開始', 'Ready', 'Sẵn sàng'),
      quiz: pick('第一關：知識挑戰', 'Step 1: Quiz', 'Chặng 1: Kiến thức'),
      bsrs: pick('第二關：心情溫度計', 'Step 2: BSRS-5', 'Chặng 2: BSRS-5'),
      bsrs_result: pick('檢測結果', 'Result', 'Kết quả'),
      counselor: pick('最後一步', 'Final Step', 'Bước cuối'),
      feedback: pick('最後一步', 'Final Step', 'Bước cuối'),
    };
    const progress: Record<Exclude<Step, 'language'>, string> = {
      checkin: '5%', welcome: '10%', quiz: '30%', bsrs: '60%', bsrs_result: '85%', counselor: '100%', feedback: '100%',
    };
    const step = currentStep as Exclude<Step, 'language'>;
    return (
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-white/60 mb-6 shadow-sm">
        <div className="max-w-md mx-auto px-4 py-3 flex justify-between items-center gap-3">
          <button
            onClick={handleGoHome}
            className="flex items-center gap-2.5 rounded-xl hover:opacity-80 transition-opacity"
          >
            <span className="w-10 h-10 bg-white rounded-xl flex items-center justify-center overflow-hidden border border-teal-100 shadow-sm">
              {renderLogo('w-full h-full object-contain p-1')}
            </span>
            <span className="font-bold text-teal-800 text-sm">{pick('回首頁', 'Home', 'Trang chủ')}</span>
          </button>

          <div className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1.5 rounded-full border border-teal-100 truncate">
            {stepLabel[step]}
          </div>
        </div>

        <div className="w-full bg-teal-50 h-1">
          <motion.div
            className="bg-gradient-to-r from-teal-400 to-emerald-500 h-full rounded-r-full"
            initial={false}
            animate={{ width: progress[step] }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
        </div>
      </header>
    );
  };

  const renderLanguageSelect = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      className="max-w-md mx-auto px-6 pt-14 pb-6 text-center space-y-10"
    >
      <div className="space-y-5">
        <div className="mx-auto w-32 h-32 bg-white rounded-[2rem] shadow-lg shadow-teal-900/10 flex items-center justify-center overflow-hidden">
          {renderLogo('w-full h-full object-contain p-3')}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-teal-700 tracking-wide">115年修平特殊教育宣導</p>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">給情緒喘口氣</h1>
        </div>
      </div>

      <div className="bg-white/90 rounded-3xl p-6 shadow-sm border border-white space-y-5">
        <div className="flex flex-col items-center gap-1.5 text-gray-600">
          <Globe2 className="w-5 h-5 text-teal-600" />
          <p className="text-sm font-medium leading-relaxed">
            {UI_TEXT.selectLanguage.split(' / ').map((line, i) => (
              <span key={i} className="block">{line}</span>
            ))}
          </p>
        </div>
        <div className="space-y-3">
          {([
            ['zh', '繁體中文', 'Traditional Chinese'],
            ['en', 'English', '英文'],
            ['vi', 'Tiếng Việt', '越南文 · Vietnamese'],
          ] as [Language, string, string][]).map(([code, label, sub]) => (
            <button
              key={code}
              onClick={() => handleSelectLanguage(code)}
              className="w-full bg-white border-2 border-gray-100 hover:border-teal-400 hover:bg-teal-50 active:bg-teal-100 py-3.5 px-5 rounded-2xl flex items-center justify-between transition-all group"
            >
              <span className="text-left">
                <span className="block font-semibold text-gray-900">{label}</span>
                <span className="block text-xs text-gray-400">{sub}</span>
              </span>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-teal-500 transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );

  const checkinErrorText = (error: CheckinError | 'form'): string => {
    switch (error) {
      case 'form':
      case 'invalid_name':
      case 'invalid_identity':
        return pick('請填寫姓名並選擇身分。', 'Please enter your name and choose your role.', 'Vui lòng nhập họ tên và chọn đối tượng.');
      case 'invalid_phone':
        return pick('請輸入正確的手機號碼（09 開頭共 10 碼）。', 'Please enter a valid Taiwan mobile number (10 digits starting with 09).', 'Vui lòng nhập số điện thoại di động Đài Loan hợp lệ (10 số, bắt đầu bằng 09).');
      case 'phone_taken':
        return pick(
          '這支手機已經報到過了。如果是你本人，請填寫和報到時相同的姓名，或改用「我已經有兌換碼」。',
          'This number has already checked in. If it is yours, enter the same name you used before, or choose "I already have a code".',
          'Số điện thoại này đã điểm danh. Nếu là bạn, hãy nhập đúng họ tên đã dùng trước đó, hoặc chọn "Tôi đã có mã".'
        );
      case 'full':
        return pick('兌換碼已全部發放完畢，請洽現場工作人員。', 'All codes have been issued. Please ask our staff.', 'Đã phát hết mã đổi quà. Vui lòng liên hệ nhân viên.');
      case 'not_found':
        return pick('查無此兌換碼，請確認簡訊上的兌換碼（例如 SEM012）。', 'Code not found. Please check the code in your SMS (e.g. SEM012).', 'Không tìm thấy mã. Vui lòng kiểm tra mã trong tin nhắn (ví dụ SEM012).');
      default:
        return pick('網路不穩或系統忙碌，請稍後再試一次。', 'Connection problem or system busy. Please try again.', 'Mạng không ổn định hoặc hệ thống đang bận. Vui lòng thử lại.');
    }
  };

  const renderCheckin = () => {
    const tabBtn = (mode: 'register' | 'code', label: string) => (
      <button
        type="button"
        onClick={() => { setCheckinMode(mode); setCheckinError(null); }}
        aria-pressed={checkinMode === mode}
        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${checkinMode === mode ? 'bg-white text-teal-800 shadow-sm' : 'text-gray-500 hover:text-teal-700'}`}
      >
        {label}
      </button>
    );
    const inputCls = 'w-full bg-white border-2 border-gray-100 focus:border-teal-400 focus:outline-none rounded-2xl px-4 py-3.5 text-base';
    const showBackup = checkinError === 'network' || checkinError === 'server' || checkinError === 'busy';

    const done = checkinDone ?? (checkinCode ? { code: checkinCode, status: 'existing' as const } : null);
    if (done) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
          className="max-w-md mx-auto px-6 pb-6 pt-2 space-y-6 text-center"
        >
          <div className="bg-gradient-to-br from-teal-500 to-emerald-600 rounded-[2rem] p-8 text-white shadow-xl shadow-teal-900/20 space-y-4">
            <Ticket className="w-12 h-12 mx-auto opacity-90" />
            <h2 className="text-2xl font-bold">
              {done.status === 'existing'
                ? pick('歡迎回來！', 'Welcome back!', 'Chào mừng bạn quay lại!')
                : pick('報到完成！', 'You’re checked in!', 'Điểm danh thành công!')}
            </h2>
            <div className="bg-white rounded-2xl py-5 px-4">
              <p className="text-xs font-semibold text-teal-700 tracking-wide">{pick('你的兌換碼', 'Your redemption code', 'Mã đổi quà của bạn')}</p>
              <p className="text-4xl font-black text-teal-800 tracking-[0.15em] tabular-nums mt-1">{done.code}</p>
            </div>
            <p className="text-sm text-teal-50 leading-relaxed">
              {done.status === 'new'
                ? pick('兌換碼也會用簡訊傳到你的手機。完成所有關卡後，憑兌換碼領取空氣鳳梨。', 'The code will also be sent to your phone by SMS. Finish all stages and show this code to get your air plant.', 'Mã cũng sẽ được gửi qua tin nhắn SMS. Hoàn thành tất cả các chặng và xuất trình mã này để nhận cây không khí.')
                : pick('這是你之前報到時取得的兌換碼。', 'This is the code from your earlier check-in.', 'Đây là mã từ lần điểm danh trước của bạn.')}
            </p>
          </div>
          <button onClick={() => goTo('welcome')} className={primaryBtn}>
            {pick('開始闖關', 'Start the activity', 'Bắt đầu')} <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
        className="max-w-md mx-auto px-6 pb-6 space-y-6"
      >
        <div className="text-center space-y-2 pt-2">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center">
            <Ticket className="w-8 h-8 text-teal-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{pick('活動報到', 'Event Check-in', 'Điểm danh sự kiện')}</h1>
          <p className="text-sm text-gray-600 leading-relaxed">
            {pick(
              '報到後會取得兌換碼，完成闖關就能憑碼領取空氣鳳梨！',
              'Check in to get your redemption code, then complete the activity to claim an air plant!',
              'Điểm danh để nhận mã đổi quà, hoàn thành hoạt động để nhận cây không khí!'
            )}
          </p>
        </div>

        <div className="flex gap-1 bg-teal-50/90 p-1 rounded-2xl border border-teal-100">
          {tabBtn('register', pick('我要報到', 'Check in', 'Điểm danh'))}
          {tabBtn('code', pick('我已經有兌換碼', 'I already have a code', 'Tôi đã có mã'))}
        </div>

        {checkinMode === 'register' ? (
          <form onSubmit={handleCheckinRegister} className="bg-white/95 rounded-3xl p-6 shadow-sm border border-white space-y-5" noValidate>
            <div className="space-y-2">
              <label htmlFor="ci-name" className="block text-sm font-semibold text-gray-800">{pick('姓名', 'Name', 'Họ tên')}</label>
              <input
                id="ci-name" type="text" autoComplete="name" maxLength={40}
                value={checkinName}
                onChange={e => { setCheckinName(e.target.value); setCheckinError(null); }}
                className={inputCls}
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="block text-sm font-semibold text-gray-800 mb-2">{pick('身分', 'Role', 'Đối tượng')}</legend>
              <div className="grid grid-cols-3 gap-2">
                {CHECKIN_IDENTITIES.map(opt => (
                  <label
                    key={opt.value}
                    className={`cursor-pointer text-center rounded-2xl border-2 px-2 py-3 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal-300 ${checkinIdentity === opt.value ? 'border-teal-500 bg-teal-50 text-teal-900' : 'border-gray-100 bg-white text-gray-700 hover:border-teal-200'}`}
                  >
                    <input
                      type="radio" name="ci-identity" value={opt.value} className="sr-only"
                      checked={checkinIdentity === opt.value}
                      onChange={() => { setCheckinIdentity(opt.value); setCheckinError(null); }}
                    />
                    {opt.label[lang]}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2">
              <label htmlFor="ci-phone" className="block text-sm font-semibold text-gray-800">{pick('手機號碼', 'Mobile number', 'Số điện thoại')}</label>
              <input
                id="ci-phone" type="tel" inputMode="numeric" autoComplete="tel" placeholder="09xxxxxxxx"
                value={checkinPhone}
                onChange={e => { setCheckinPhone(e.target.value.replace(/[^\d+\-\s]/g, '').slice(0, 16)); setCheckinError(null); }}
                className={`${inputCls} tracking-wider`}
              />
              <p className="text-xs text-gray-500">{pick('兌換碼會以簡訊傳送到這支手機。', 'Your code will be sent to this number by SMS.', 'Mã đổi quà sẽ được gửi qua SMS đến số này.')}</p>
            </div>

            {checkinError && (
              <div role="alert" className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-2xl text-sm leading-relaxed">
                {checkinErrorText(checkinError)}
                {showBackup && (
                  <a href={BACKUP_CHECKIN_FORM_URL} target="_blank" rel="noopener noreferrer" className="block mt-2 font-semibold underline">
                    {pick('改用備用報到表單 →', 'Use the backup check-in form →', 'Dùng biểu mẫu điểm danh dự phòng →')}
                  </a>
                )}
              </div>
            )}

            <button type="submit" disabled={checkinBusy} className={`${primaryBtn} disabled:opacity-70`}>
              {checkinBusy
                ? <><Loader2 className="w-5 h-5 animate-spin" /> {pick('報到中…', 'Checking in…', 'Đang điểm danh…')}</>
                : <>{pick('送出報到', 'Check in', 'Gửi điểm danh')} <ArrowRight className="w-5 h-5" /></>}
            </button>

            <p className="text-[11px] text-gray-400 leading-relaxed">
              {pick(
                '個資告知：修平科技大學學生發展中心蒐集你的姓名、身分與手機號碼，僅用於本次活動報到、發送兌換碼簡訊及領取核對，不作其他用途。',
                'Privacy notice: HUST Student Development Center collects your name, role and mobile number only for event check-in, sending your code by SMS and verifying gift pickup, and for no other purpose.',
                'Thông báo bảo mật: Trung tâm Phát triển Sinh viên HUST thu thập họ tên, đối tượng và số điện thoại của bạn chỉ để điểm danh, gửi mã qua SMS và xác nhận nhận quà, không dùng cho mục đích khác.'
              )}
            </p>
          </form>
        ) : (
          <form onSubmit={handleCheckinVerify} className="bg-white/95 rounded-3xl p-6 shadow-sm border border-white space-y-5" noValidate>
            <div className="space-y-2">
              <label htmlFor="ci-code" className="block text-sm font-semibold text-gray-800">
                {pick('輸入簡訊中的兌換碼', 'Enter the code from your SMS', 'Nhập mã trong tin nhắn SMS')}
              </label>
              <input
                id="ci-code" type="text" autoComplete="off" autoCapitalize="characters" placeholder="SEM012"
                value={checkinCodeInput}
                onChange={e => { setCheckinCodeInput(e.target.value.slice(0, 10)); setCheckinError(null); }}
                className={`${inputCls} text-center text-2xl font-bold tracking-[0.2em] uppercase`}
              />
            </div>
            {checkinError && (
              <div role="alert" className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-2xl text-sm leading-relaxed">
                {checkinErrorText(checkinError)}
              </div>
            )}
            <button type="submit" disabled={checkinBusy || !checkinCodeInput.trim()} className={`${primaryBtn} disabled:opacity-60`}>
              {checkinBusy
                ? <><Loader2 className="w-5 h-5 animate-spin" /> {pick('確認中…', 'Checking…', 'Đang kiểm tra…')}</>
                : <>{pick('確認兌換碼', 'Verify code', 'Xác nhận mã')} <ArrowRight className="w-5 h-5" /></>}
            </button>
          </form>
        )}
      </motion.div>
    );
  };

  const renderWelcome = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      className="max-w-md mx-auto px-6 pb-6 space-y-7"
    >
      <div className="flex justify-center pt-2">
        <div className="w-36 h-36 bg-white rounded-[2rem] shadow-lg shadow-teal-900/10 flex items-center justify-center overflow-hidden">
          {renderLogo('w-full h-full object-contain p-3')}
        </div>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-snug whitespace-pre-line text-center">
        {INTRO_CONTENT.title[lang]}
      </h1>

      <div className="bg-white/95 p-6 rounded-3xl border border-white shadow-sm space-y-4 text-gray-700 leading-relaxed text-[15px]">
        {INTRO_CONTENT.paragraphs.map((p, idx) => (
          <p key={idx}>{p[lang]}</p>
        ))}
      </div>

      <div className="flex items-start gap-2.5 bg-teal-50/90 border border-teal-100 rounded-2xl px-4 py-3 text-xs text-teal-900 leading-relaxed">
        <Lock className="w-4 h-4 shrink-0 mt-0.5 text-teal-600" />
        <p>
          {pick(
            '小測驗與心情溫度計的作答只在你的手機上計算，不會上傳或儲存，請放心填答。',
            'Your quiz and Emotion Thermometer answers are calculated only on your device. They are never uploaded or stored, so feel free to answer honestly.',
            'Câu trả lời bài kiểm tra và Nhiệt kế cảm xúc chỉ được tính trên thiết bị của bạn, không tải lên hay lưu trữ. Bạn cứ yên tâm trả lời.'
          )}
        </p>
      </div>

      <button onClick={() => goTo('quiz')} className={primaryBtn}>
        {UI_TEXT.goToQuiz[lang]} <ArrowRight className="w-5 h-5" />
      </button>

      <button
        onClick={() => goTo('language')}
        className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-teal-700 py-1"
      >
        <Globe2 className="w-4 h-4" /> 語言 / Language / Ngôn ngữ
      </button>
    </motion.div>
  );

  const renderQuiz = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="max-w-md mx-auto px-6 pb-20 space-y-8"
    >
      <div className="bg-white/90 p-5 rounded-3xl border border-teal-100 shadow-sm">
        <p className="text-gray-700 text-sm leading-relaxed font-medium">{QUIZ_INTRO[lang]}</p>
      </div>

      {quizError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-sm font-medium flex items-start gap-2"
        >
          <span className="mt-0.5">⚠️</span>
          <span>
            {pick(
              '您還有題目尚未作答，請確認 5 題都已選擇答案喔！',
              'You have unanswered questions. Please make sure all 5 questions are answered!',
              'Bạn vẫn còn câu hỏi chưa trả lời. Vui lòng đảm bảo đã chọn đáp án cho cả 5 câu hỏi!'
            )}
          </span>
        </motion.div>
      )}

      <div id="quiz-top" className="space-y-6">
        {shuffledQuiz.map((q, idx) => {
          const selected = quizAnswers[q.original.id];
          const isCorrect = selected === q.original.correctAnswerId;
          const showExp = showQuizResults;

          return (
            <div
              key={q.original.id}
              id={`quiz-q-${q.original.id}`}
              className={`bg-white rounded-3xl shadow-sm border overflow-hidden transition-colors duration-300 ${quizError && !selected ? 'border-red-400 ring-2 ring-red-100' : 'border-white'}`}
            >
              <div className="bg-gradient-to-br from-teal-50 to-emerald-50 py-6 flex justify-center items-center">
                <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center">
                  {iconMap[q.original.iconName]}
                </div>
              </div>

              <div className="p-5 space-y-5">
                <p className="font-semibold text-gray-900 text-base leading-relaxed">
                  <span className="text-teal-600 mr-2 font-bold">{idx + 1}.</span>
                  {q.original.question[lang]}
                </p>

                <div className="space-y-2.5">
                  {q.options.map(opt => {
                    const isSelected = selected === opt.id;
                    const isOptCorrect = opt.id === q.original.correctAnswerId;

                    let btnClass = 'flex items-center p-3.5 rounded-2xl border text-sm text-left transition-colors w-full ';
                    if (showExp) {
                      if (isOptCorrect) btnClass += 'border-green-500 bg-green-50 text-green-900';
                      else if (isSelected) btnClass += 'border-red-300 bg-red-50 text-red-900';
                      else btnClass += 'border-gray-200 text-gray-500 opacity-50';
                    } else if (isSelected) {
                      btnClass += 'border-teal-500 bg-teal-50 text-teal-900';
                    } else {
                      btnClass += 'border-gray-200 hover:bg-gray-50 text-gray-700 cursor-pointer';
                    }

                    return (
                      <motion.button
                        key={opt.id}
                        type="button"
                        disabled={showExp}
                        aria-pressed={isSelected}
                        onClick={() => handleQuizOptionSelect(q.original.id, opt.id)}
                        className={btnClass}
                        whileHover={!showExp ? { scale: 1.02, transition: { type: 'spring', stiffness: 300, damping: 15 } } : undefined}
                        whileTap={!showExp ? { scale: 0.98 } : undefined}
                      >
                        <span className={`w-5 h-5 shrink-0 rounded-full border mr-3 flex items-center justify-center
                          ${showExp && isOptCorrect ? 'border-green-500 bg-green-500 text-white' : ''}
                          ${showExp && isSelected && !isOptCorrect ? 'border-red-400 bg-red-400 text-white' : ''}
                          ${!showExp && isSelected ? 'border-teal-500 bg-teal-500' : 'border-gray-300'}
                        `}>
                          {!showExp && isSelected && <span className="w-2 h-2 bg-white rounded-full" />}
                          {showExp && isOptCorrect && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </span>
                        <span className="flex-1">{opt.text[lang]}</span>
                      </motion.button>
                    );
                  })}
                </div>

                {showExp && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    className={`mt-4 p-4 rounded-2xl text-sm leading-relaxed flex items-start gap-3 ${isCorrect ? 'bg-green-50 text-green-900' : 'bg-orange-50 text-orange-900'}`}
                  >
                    <Lightbulb className={`w-5 h-5 shrink-0 mt-0.5 ${isCorrect ? 'text-green-600' : 'text-orange-600'}`} />
                    <div>
                      <p className="font-bold mb-1">
                        {isCorrect ? pick('✅ 答對了！', '✅ Correct!', '✅ Đúng rồi!') : pick('❌ 答錯囉！', '❌ Incorrect!', '❌ Sai rồi!')}
                      </p>
                      <p>{q.original.explanation[lang]}</p>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!showQuizResults ? (
        <button onClick={handleQuizSubmit} className={`${primaryBtn} sticky bottom-6 shadow-lg shadow-teal-900/20 z-10`}>
          {UI_TEXT.submitQuiz[lang]} <CheckCircle2 className="w-5 h-5" />
        </button>
      ) : quizPassed ? (
        <button
          onClick={() => goTo('bsrs')}
          className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-4 px-6 rounded-2xl flex items-center justify-center gap-2 transition-colors sticky bottom-6 shadow-lg shadow-gray-900/20 z-10"
        >
          {UI_TEXT.nextStep[lang]} <ChevronRight className="w-5 h-5" />
        </button>
      ) : (
        <div className="sticky bottom-6 z-10 space-y-3">
          <div className="bg-white text-orange-700 p-3 rounded-2xl text-center text-sm font-medium shadow-lg border border-orange-200">
            {pick(
              '答錯也沒關係！看完解說再挑戰一次，全部答對就能進入下一關。',
              "No worries! Read the explanations and try again — get all 5 right to move on.",
              'Không sao cả! Hãy đọc phần giải thích và thử lại, trả lời đúng cả 5 câu để đi tiếp nhé.'
            )}
          </div>
          <button
            onClick={() => {
              resetQuiz();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 px-6 rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-orange-900/20"
          >
            {pick('重新測驗', 'Try Again', 'Thử lại')} <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      )}
    </motion.div>
  );

  const renderBsrs = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="max-w-md mx-auto px-6 pb-6 space-y-7"
    >
      <div className="bg-white/90 p-5 rounded-3xl border border-teal-100 shadow-sm space-y-2">
        <span className="text-teal-600 font-semibold text-sm tracking-wide">{pick('第二關', 'Step 2', 'Chặng 2')}</span>
        <h2 className="text-xl font-bold text-gray-900">
          {pick('簡式健康表 (BSRS-5)', 'Brief Symptom Rating Scale (BSRS-5)', 'Thang điểm đánh giá triệu chứng (BSRS-5)')}
        </h2>
        <p className="text-gray-600 text-sm leading-relaxed">
          {lang === 'zh' ? (
            <>請仔細回想在<span className="font-semibold text-gray-900">最近一星期中(包括今天)</span>，這些問題使您感到困擾或苦惱的程度。</>
          ) : lang === 'en' ? (
            <>Please think carefully about how much these issues have bothered or distressed you <span className="font-semibold text-gray-900">in the past week (including today)</span>.</>
          ) : (
            <>Vui lòng nghĩ lại xem <span className="font-semibold text-gray-900">trong tuần qua (bao gồm cả hôm nay)</span>, những vấn đề này đã làm phiền hoặc khiến bạn khổ tâm đến mức nào.</>
          )}
        </p>
      </div>

      {bsrsError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-sm font-medium flex items-start gap-2"
        >
          <span className="mt-0.5">⚠️</span>
          <span>
            {pick(
              '您還有題目尚未填寫完成，請確認每一題都有作答喔！',
              'You have unanswered questions. Please make sure to answer all of them!',
              'Bạn có câu hỏi chưa trả lời. Vui lòng đảm bảo trả lời tất cả các câu hỏi!'
            )}
          </span>
        </motion.div>
      )}

      <form onSubmit={handleBsrsSubmit} className="space-y-5">
        {allBsrsQuestions.map((q, idx) => (
          <fieldset
            key={q.id}
            id={`bsrs-q-${q.id}`}
            className={`bg-white p-5 rounded-3xl shadow-sm border transition-colors duration-300 ${bsrsError && bsrsAnswers[q.id] === undefined ? 'border-red-400 ring-2 ring-red-100' : 'border-white'}`}
          >
            <legend className="sr-only">{q.text[lang]}</legend>
            <p className="font-semibold text-gray-900 mb-4 text-[15px] leading-relaxed" aria-hidden="true">
              <span className="text-gray-400 mr-2">{idx + 1}.</span>
              {q.text[lang]}
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {BSRS_OPTIONS.map(opt => {
                const checked = bsrsAnswers[q.id] === opt.value;
                return (
                  <motion.label
                    key={opt.value}
                    className="flex flex-col items-center gap-1.5 cursor-pointer group"
                    whileHover={{ scale: 1.08, transition: { type: 'spring', stiffness: 300, damping: 15 } }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal-300 ${
                      checked ? 'border-teal-500 bg-teal-500 text-white shadow-md shadow-teal-900/20' : 'border-gray-200 text-gray-400 group-hover:border-teal-300'
                    }`}>
                      <input
                        type="radio"
                        name={q.id}
                        value={opt.value}
                        checked={checked}
                        className="sr-only"
                        onChange={() => {
                          setBsrsAnswers(prev => ({ ...prev, [q.id]: opt.value }));
                          setBsrsError(false);
                          playSound('click');
                        }}
                      />
                      <span className="text-sm font-semibold">{opt.value}</span>
                    </span>
                    <span className={`text-xs leading-tight text-center ${checked ? 'text-teal-700 font-semibold' : 'text-gray-500'}`}>
                      {opt.label[lang]}
                    </span>
                  </motion.label>
                );
              })}
            </div>
          </fieldset>
        ))}

        <button type="submit" className={`${primaryBtn} mt-2`}>
          {pick('送出檢測', 'Submit', 'Gửi')} <ChevronRight className="w-5 h-5" />
        </button>
      </form>
    </motion.div>
  );

  const renderBsrsResult = () => {
    type Tone = 'green' | 'yellow' | 'orange' | 'red';
    const toneStyles: Record<Tone, { color: string; bg: string; border: string }> = {
      green: { color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
      yellow: { color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
      orange: { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
      red: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
    };

    let tone: Tone = 'green';
    let title = pick('正常範圍', 'Normal', 'Bình thường');
    let desc = pick(
      '身心適應良好，心理健康狀況穩定。',
      'Good physical and mental adaptation, stable mental health.',
      'Thích ứng thể chất và tinh thần tốt, sức khỏe tâm thần ổn định.'
    );

    if (totalBaseScore >= 15) {
      tone = 'red';
      title = pick('重度情緒困擾', 'Severe Distress', 'Căng thẳng nặng');
      desc = pick(
        '情緒壓力已嚴重影響日常生活，強烈建議至精神科或身心科門診尋求醫療評估與治療。',
        'Emotional stress has severely affected daily life. Strongly recommended to seek medical evaluation and treatment from psychiatry or mental health clinics.',
        'Căng thẳng cảm xúc đã ảnh hưởng nghiêm trọng đến cuộc sống hàng ngày. Thực sự khuyên bạn nên tìm kiếm đánh giá y tế và điều trị từ phòng khám tâm thần.'
      );
    } else if (totalBaseScore >= 10) {
      tone = 'orange';
      title = pick('中度情緒困擾', 'Moderate Distress', 'Căng thẳng vừa');
      desc = pick(
        '壓力與情緒負荷較重，建議尋求心理諮商、心理輔導或身心專科資源協助。',
        'Heavy stress and emotional load. Recommended to seek psychological counseling or professional help.',
        'Áp lực và gánh nặng cảm xúc lớn. Khuyên bạn nên tìm kiếm tư vấn tâm lý hoặc sự giúp đỡ chuyên môn.'
      );
    } else if (totalBaseScore >= 6) {
      tone = 'yellow';
      title = pick('輕度情緒困擾', 'Mild Distress', 'Căng thẳng nhẹ');
      desc = pick(
        '處於壓力邊緣，建議適度運動、放鬆或找親友傾訴抒發情緒。',
        'On the edge of stress. Recommended to exercise, relax, or talk to friends and family.',
        'Đang ở mức ranh giới căng thẳng. Khuyên bạn nên tập thể dục, thư giãn hoặc trò chuyện với bạn bè, người thân.'
      );
    }

    // 第 6 題分數 >= 2 時，不論總分都以此為準
    if (suicideScore >= 2) {
      tone = 'red';
      title = pick('需要專業協助', 'Professional Help Needed', 'Cần trợ giúp chuyên môn');
      desc = pick(
        '雖然您的總分可能不高，但您在最後一題表達了較強烈的困擾。我們非常關心您的狀況，強烈建議您尋求專業協助。',
        'While your total score may not be high, you expressed significant distress in the final question. We strongly recommend seeking professional help.',
        'Mặc dù tổng điểm của bạn có thể không cao, nhưng bạn đã bày tỏ sự căng thẳng đáng kể ở câu hỏi cuối cùng. Chúng tôi thực sự khuyên bạn nên tìm kiếm sự trợ giúp chuyên môn.'
      );
    }

    const s = toneStyles[tone];

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="max-w-md mx-auto px-6 pb-6 pt-4 text-center space-y-6"
      >
        <h2 className="text-2xl font-bold text-gray-900">{pick('檢測結果', 'Your Result', 'Kết quả của bạn')}</h2>

        <div className={`border ${s.border} ${s.bg} p-8 rounded-3xl shadow-sm space-y-6`}>
          <div>
            <span className="text-sm font-medium text-gray-500 tracking-widest">
              {pick('檢測總分 (前五題)', 'Total Score (First 5 Qs)', 'Tổng điểm (5 câu đầu)')}
            </span>
            <div className={`text-6xl font-black ${s.color} my-2 tabular-nums`}>
              {totalBaseScore}
              <span className="text-xl font-bold text-gray-400"> / 20</span>
            </div>
            {suicideScore >= 2 && (
              <div className="text-sm font-bold text-red-600 mt-3 bg-red-100 py-1.5 px-4 rounded-full inline-block">
                {pick('★ 第6題：觸發關懷指標', '★ Q6: Care Indicator Triggered', '★ Câu 6: Kích hoạt chỉ báo chăm sóc')}
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-black/5 space-y-3">
            <h3 className={`text-xl font-bold ${s.color}`}>{title}</h3>
            <p className="text-gray-700 leading-relaxed text-sm">{desc}</p>
          </div>
        </div>

        {needsCounselor && renderHelpResources(tone === 'red' ? 'red' : 'orange')}

        <button onClick={() => goTo(needsCounselor ? 'counselor' : 'feedback')} className={primaryBtn}>
          {needsCounselor
            ? pick('了解後續建議', 'View Recommendations', 'Xem khuyến nghị')
            : pick('前往填寫回饋表單', 'Go to Feedback Form', 'Đi đến Biểu mẫu Phản hồi')}
          <ArrowRight className="w-5 h-5" />
        </button>
      </motion.div>
    );
  };

  const renderCounselor = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
      className="max-w-md mx-auto px-6 pb-6 text-center space-y-6"
    >
      <div className="bg-orange-50 border border-orange-200 p-7 rounded-3xl space-y-6 shadow-sm">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-sm">
            <ShieldCheck className="w-11 h-11 text-orange-500" />
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">
            {pick('我們關心您的狀況', 'We Care About You', 'Chúng tôi quan tâm đến bạn')}
          </h2>
          <p className="text-gray-700 text-sm leading-relaxed">
            {pick(
              '根據您的檢測結果，我們希望能提供您更多的支持。',
              'Based on your results, we would like to offer you more support.',
              'Dựa trên kết quả đánh giá, chúng tôi muốn cung cấp thêm hỗ trợ cho bạn.'
            )}
            <span className="font-bold text-orange-700 mt-2 block">
              {pick(
                '請尋求現場心理師／輔導老師的協助。',
                'Please seek assistance from the on-site counselor.',
                'Vui lòng tìm kiếm sự trợ giúp từ chuyên viên tư vấn tại chỗ.'
              )}
            </span>
          </p>
        </div>

        <form onSubmit={handleVerifyCode} className="pt-6 border-t border-orange-200/60 space-y-4">
          <label htmlFor="counselor-code" className="block text-xs text-gray-500 leading-relaxed">
            {pick(
              '對談結束後，請向心理師索取四位數通關密碼，以解鎖後續兌換流程。',
              'After the conversation, please ask the counselor for a 4-digit passcode to unlock the redemption process.',
              'Sau khi trò chuyện, vui lòng xin chuyên viên tư vấn mật mã 4 chữ số để mở khóa quy trình đổi quà.'
            )}
          </label>
          <input
            id="counselor-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            placeholder={pick('請輸入通關碼', 'Enter Passcode', 'Nhập mật mã')}
            value={counselorCode}
            onChange={e => {
              setCounselorCode(e.target.value.replace(/\D/g, '').slice(0, 4));
              setCodeError(false);
            }}
            className={`w-full bg-white text-center tracking-[0.5em] text-2xl font-semibold p-4 rounded-2xl border placeholder:text-base placeholder:tracking-normal placeholder:font-normal ${codeError ? 'border-red-400 bg-red-50 focus:ring-red-400' : 'border-gray-200 focus:ring-orange-400'} focus:outline-none focus:ring-2`}
          />
          {codeError && (
            <p className="text-red-500 text-sm" role="alert">
              {pick('密碼錯誤，請重新確認。', 'Incorrect passcode, please try again.', 'Mật mã sai, vui lòng kiểm tra lại.')}
            </p>
          )}
          <button
            type="submit"
            disabled={counselorCode.length !== 4}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-semibold py-4 px-6 rounded-2xl flex items-center justify-center gap-2 transition-colors"
          >
            {pick('驗證密碼並繼續', 'Verify and Continue', 'Xác minh và Tiếp tục')}
          </button>
        </form>
      </div>

      {renderHelpResources(suicideScore >= 2 || totalBaseScore >= 15 ? 'red' : 'orange')}
    </motion.div>
  );

  const renderFeedback = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="max-w-md mx-auto px-6 pb-6 pt-4 space-y-6"
    >
      <div className="w-full bg-gradient-to-br from-teal-500 to-emerald-600 p-8 rounded-[2rem] shadow-xl shadow-teal-900/20 text-white space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 bg-white opacity-10 rounded-full blur-xl" />

        <div className="relative z-10 flex flex-col items-center space-y-4">
          <motion.div
            className="relative w-32 h-32 flex items-center justify-center"
            animate={{ y: [-5, 5, -5] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          >
            <div className="absolute inset-0 bg-white/30 blur-2xl rounded-full" />
            {imgErrors.pine ? (
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-inner relative z-10">
                <HeartHandshake className="w-10 h-10 text-teal-600" />
              </div>
            ) : (
              <img
                src={asset('pine.webp')}
                alt={pick('空氣鳳梨', 'Air plant', 'Cây không khí')}
                className="w-full h-full object-contain relative z-10 drop-shadow-2xl"
                onError={() => setImgErrors(prev => ({ ...prev, pine: true }))}
              />
            )}
          </motion.div>

          <div className="space-y-2 text-center mt-2">
            <h2 className="text-3xl font-bold tracking-wider">{pick('最後一步', 'Final Step', 'Bước cuối cùng')}</h2>
            <p className="text-teal-50 font-medium tracking-wide">
              {pick('填寫回饋表單領取空氣鳳梨', 'Fill out the form to get your air plant', 'Điền vào biểu mẫu để nhận cây không khí')}
            </p>
          </div>
        </div>

        <div className="relative z-10 bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 text-center space-y-2 text-sm leading-relaxed">
          <p>
            {pick(
              '感謝您的參與！請點擊下方按鈕前往填寫活動滿意度問卷。',
              'Thank you for participating! Please click the button below to fill out the satisfaction survey.',
              'Cảm ơn bạn đã tham gia! Vui lòng nhấp vào nút bên dưới để điền vào cuộc khảo sát mức độ hài lòng.'
            )}
          </p>
          <p className="font-bold text-yellow-300 text-base">
            {pick(
              '完成表單後，請直接將「表單送出成功畫面」出示給工作人員，即可領取專屬空氣鳳梨！',
              'After completing the form, simply show the "Form Submitted" screen to the staff to claim your exclusive air plant!',
              'Sau khi hoàn thành biểu mẫu, chỉ cần đưa màn hình "Đã gửi biểu mẫu" cho nhân viên để nhận cây không khí độc quyền của bạn!'
            )}
          </p>
        </div>

        {checkinCode && (
          <div className="relative z-10 bg-white rounded-2xl px-5 py-4 text-center shadow-lg">
            <p className="text-xs font-semibold text-teal-700 tracking-wide">
              {pick('領取時請出示兌換碼', 'Show this code when claiming', 'Xuất trình mã đổi quà khi nhận')}
            </p>
            <p className="text-3xl font-black text-teal-800 tracking-[0.15em] tabular-nums mt-1">{checkinCode}</p>
          </div>
        )}

        <div className="relative z-10 pt-2">
          <button
            onClick={() => setShowCareModal(true)}
            className="w-full bg-white hover:bg-teal-50 text-teal-700 font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-lg"
          >
            {pick('前往填寫問卷', 'Go to Feedback Form', 'Đi đến Biểu mẫu Phản hồi')} <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <p className="text-gray-600 text-sm text-center">
        {pick('感謝您的參與，祝您有美好的一天！', 'Thank you for participating, have a wonderful day!', 'Cảm ơn bạn đã tham gia, chúc bạn một ngày tốt lành!')}
      </p>
    </motion.div>
  );

  const renderCareModal = () => (
    <AnimatePresence>
      {showCareModal && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setShowCareModal(false)}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="care-title"
            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl relative"
          >
            <button
              type="button"
              onClick={() => setShowCareModal(false)}
              aria-label={pick('關閉', 'Close', 'Đóng')}
              className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="text-center space-y-4">
              <h3 id="care-title" className="text-xl font-bold text-teal-800 px-8">
                {pick('帶我回家前...', 'Before you take me home...', 'Trước khi đưa tôi về nhà...')}
              </h3>
              <p className="text-sm text-gray-600">
                {pick('請先看看怎麼照顧我唷 🌱', 'Please read my care instructions 🌱', 'Vui lòng đọc hướng dẫn chăm sóc của tôi 🌱')}
              </p>

              <div className="bg-teal-50 rounded-2xl p-2 flex justify-center items-center">
                <img
                  src={asset('care.webp')}
                  alt={pick('空氣鳳梨照顧指南', 'Air plant care guide', 'Hướng dẫn chăm sóc cây không khí')}
                  className="max-h-[50vh] w-auto object-contain rounded-xl"
                />
              </div>

              <a
                href={FEEDBACK_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowCareModal(false)}
                className={`${primaryBtn} mt-4`}
              >
                {pick('我知道了，前往問卷', 'Got it, go to form', 'Tôi hiểu rồi, đến biểu mẫu')} <ArrowRight className="w-5 h-5" />
              </a>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const steps: Record<Step, () => React.ReactNode> = {
    language: renderLanguageSelect,
    checkin: renderCheckin,
    welcome: renderWelcome,
    quiz: renderQuiz,
    bsrs: renderBsrs,
    bsrs_result: renderBsrsResult,
    counselor: renderCounselor,
    feedback: renderFeedback,
  };

  return (
    <div className="min-h-screen font-sans text-gray-900 selection:bg-teal-100 selection:text-teal-900 pb-12 relative isolate overflow-x-clip">
      {/* 背景圖層：用 fixed 圖層取代 background-attachment: fixed（iPhone 不支援且會造成捲動卡頓） */}
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 bg-[#f3faf8] bg-cover bg-center"
        style={{ backgroundImage: `url("${asset('background.webp')}")` }}
      />
      <div aria-hidden="true" className="fixed inset-0 -z-10 bg-white/45" />

      {renderHeader()}
      <main>
        <AnimatePresence mode="wait">
          <div key={currentStep}>{steps[currentStep]()}</div>
        </AnimatePresence>
      </main>
      {renderCareModal()}
    </div>
  );
}
