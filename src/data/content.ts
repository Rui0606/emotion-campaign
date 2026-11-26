import { LocalizedString, QuizQuestion, BsrsQuestion, BsrsOption } from '../types';

export const BSRS_QUESTIONS: BsrsQuestion[] = [
  { 
    id: 'q1', 
    text: {
      zh: '睡眠困難，譬如難以入睡、易醒或早醒',
      en: 'Trouble sleeping (e.g., difficulty falling asleep, waking up easily or early)',
      vi: 'Khó ngủ (ví dụ: khó chìm vào giấc ngủ, dễ tỉnh giấc hoặc thức dậy sớm)'
    }
  },
  { 
    id: 'q2', 
    text: {
      zh: '感覺緊張不安',
      en: 'Feeling tense or anxious',
      vi: 'Cảm thấy căng thẳng hoặc lo âu'
    }
  },
  { 
    id: 'q3', 
    text: {
      zh: '覺得容易苦惱或動怒',
      en: 'Feeling easily annoyed or irritated',
      vi: 'Cảm thấy dễ bực bội hoặc tức giận'
    }
  },
  { 
    id: 'q4', 
    text: {
      zh: '感覺憂鬱、心情低落',
      en: 'Feeling depressed or down',
      vi: 'Cảm thấy trầm cảm hoặc buồn bã'
    }
  },
  { 
    id: 'q5', 
    text: {
      zh: '覺得比不上別人',
      en: 'Feeling inferior to others',
      vi: 'Cảm thấy thua kém người khác'
    }
  },
];

export const BSRS_SUICIDE_QUESTION: BsrsQuestion = { 
  id: 'q6', 
  text: {
    zh: '有自殺的想法',
    en: 'Having thoughts of suicide',
    vi: 'Có suy nghĩ tự tử'
  }
};

export const BSRS_OPTIONS: BsrsOption[] = [
  { 
    value: 0, 
    label: {
      zh: '完全沒有',
      en: 'Not at all',
      vi: 'Hoàn toàn không'
    }
  },
  { 
    value: 1, 
    label: {
      zh: '輕微',
      en: 'A little bit',
      vi: 'Nhẹ'
    }
  },
  { 
    value: 2, 
    label: {
      zh: '中等程度',
      en: 'Moderately',
      vi: 'Mức độ vừa'
    }
  },
  { 
    value: 3, 
    label: {
      zh: '厲害',
      en: 'Quite a bit',
      vi: 'Nặng'
    }
  },
  { 
    value: 4, 
    label: {
      zh: '非常厲害',
      en: 'Extremely',
      vi: 'Rất nặng'
    }
  },
];

export const UI_TEXT = {
  selectLanguage: "請選擇您的語言 / Please select your language / Vui lòng chọn ngôn ngữ của bạn",
  start: {
    zh: "開始閱讀",
    en: "Start Reading",
    vi: "Bắt đầu đọc",
  },
  goToQuiz: {
    zh: "開始小測驗",
    en: "Start Quiz",
    vi: "Bắt đầu làm bài kiểm tra",
  },
  submitQuiz: {
    zh: "看解答",
    en: "Show Answers",
    vi: "Xem đáp án",
  },
  nextStep: {
    zh: "完成第一關",
    en: "Finish Step 1",
    vi: "Hoàn thành chặng 1",
  }
};

export const INTRO_CONTENT = {
  title: {
    zh: "115年修平特殊教育宣導-\n「給情緒喘口氣」",
    en: "2026 Hsiuping Special Education Campaign:\n\"Give Your Emotions a Breather\"",
    vi: "Tuyên truyền Giáo dục Đặc biệt Hsiuping 2026:\n\"Để Cảm Xúc Được Nghỉ Ngơi\"",
  },
  paragraphs: [
    {
      zh: "活動以「情緒行為障礙」為主要宣導內容，透過校園常見情境，引導師生理解：",
      en: "This event focuses on Emotional and Behavioral Disorders (EBD). Through common campus scenarios, it guides teachers and students to understand:",
      vi: "Hoạt động lấy \"Rối loạn Cảm xúc và Hành vi\" làm nội dung tuyên truyền chính. Thông qua các tình huống thường gặp trong trường học, chương trình giúp giảng viên và sinh viên hiểu rằng:",
    },
    {
      zh: "有些人可能會長期出現比較明顯的情緒或行為困難，例如容易焦慮、情緒起伏很大、容易生氣、衝動，或在人際互動上遇到較多困難。",
      en: "Some people may experience long-term emotional or behavioral difficulties, such as feeling anxious easily, experiencing significant mood swings, getting angry quickly, acting impulsively, or facing challenges in social interactions.",
      vi: "Một số người có thể gặp khó khăn kéo dài về cảm xúc hoặc hành vi, chẳng hạn như dễ lo âu, tâm trạng thay đổi thất thường, dễ nổi giận, bốc đồng, hoặc gặp nhiều khó khăn trong giao tiếp xã hội.",
    },
    {
      zh: "當這些情緒或行為持續一段時間，而且已經明顯影響到學習、生活、人際關係或適應時，就可能需要進一步的了解與支持。",
      en: "When these emotions or behaviors persist over time and significantly impact learning, daily life, interpersonal relationships, or campus adjustment, they may need further understanding and support.",
      vi: "Khi những cảm xúc hoặc hành vi này kéo dài và ảnh hưởng rõ rệt đến việc học tập, cuộc sống, mối quan hệ bạn bè hay khả năng thích nghi, họ có thể cần được thấu hiểu và hỗ trợ thêm.",
    },
    {
      zh: "這並不是單純的「愛生氣」、「不聽話」或「故意搗蛋」，也不是只要叫他「想開一點」就能解決，而是需要被理解，並給予適合的協助。",
      en: "This is not simply being \"bad-tempered,\" \"disobedient,\" or \"deliberately causing trouble,\" nor can it be resolved by simply telling someone to \"cheer up.\" Instead, they need understanding and appropriate support.",
      vi: "Đây không đơn thuần là \"nóng tính\", \"không nghe lời\" hay \"cố tình gây rối\", cũng không thể giải quyết chỉ bằng lời khuyên \"nghĩ thoáng ra\". Điều họ cần là sự thấu hiểu và sự hỗ trợ phù hợp.",
    }
  ]
};

export const QUIZ_INTRO: LocalizedString = {
  zh: "一、認識情緒行為障礙 : 接下來請回答 5 個小問題，測測看你對情緒行為障礙的認識有多少！不用擔心答錯，這不是考試，而是讓我們一起破除迷思、理解差異。答錯的題目會有解說，看完再挑戰一次，全部答對就能進入下一關。",
  en: "I. Understanding Emotional and Behavioral Disorders. Please answer the following 5 quick questions to test your knowledge about Emotional and Behavioral Disorders! Don't worry about getting answers wrong—this isn't a test. It is an opportunity for us to dispel myths and embrace our differences together. Each answer comes with an explanation—read them, try again, and once all 5 are correct you'll move on to the next stage.",
  vi: "I. Tìm hiểu về Rối loạn Cảm xúc và Hành vi. Hãy trả lời 5 câu hỏi ngắn dưới đây để kiểm tra mức độ hiểu biết của bạn về rối loạn cảm xúc và hành vi nhé! Đừng lo lắng nếu trả lời sai, đây không phải là một bài kiểm tra, mà là cơ hội để chúng ta cùng nhau xóa bỏ định kiến và thấu hiểu sự khác biệt. Mỗi câu đều có phần giải thích—hãy đọc rồi thử lại, khi trả lời đúng cả 5 câu bạn sẽ được qua chặng tiếp theo.",
};

// 求助專線（結果頁與心理師頁顯示，讓不在活動現場的人也找得到協助）
export const HELP_LINES: { number: string; name: LocalizedString; note: LocalizedString }[] = [
  {
    number: '1925',
    name: { zh: '安心專線', en: 'MOHW Mental Health Hotline', vi: 'Đường dây hỗ trợ tâm lý (Bộ Y tế)' },
    note: { zh: '24 小時・免付費', en: '24 hours · Toll-free', vi: '24 giờ · Miễn phí' },
  },
  {
    number: '1995',
    name: { zh: '生命線', en: 'Lifeline Taiwan', vi: 'Đường dây Sinh mệnh (Lifeline)' },
    note: { zh: '24 小時', en: '24 hours', vi: '24 giờ' },
  },
  {
    number: '1980',
    name: { zh: '張老師專線', en: 'Teacher Chang Hotline', vi: 'Đường dây Thầy Trương' },
    note: { zh: '依各地服務時間', en: 'Hours vary by region', vi: 'Giờ phục vụ tùy khu vực' },
  },
];

// 報到身分選項：value 會寫入報到試算表「身分」欄，必須與 apps-script/Code.gs 的 IDENTITIES 一致
export const CHECKIN_IDENTITIES: { value: string; label: LocalizedString }[] = [
  { value: '校內職員/老師', label: { zh: '校內職員／老師', en: 'School staff / Teacher', vi: 'Nhân viên / Giáo viên trong trường' } },
  { value: '學生', label: { zh: '學生', en: 'Student', vi: 'Học sinh / Sinh viên' } },
  { value: '來賓', label: { zh: '來賓', en: 'Guest', vi: 'Khách quý' } },
];

// 性別（報到時填；value 必須與 Code.gs 的 GENDERS 一致，回饋問卷會從報到名單自動帶入）
export const CHECKIN_GENDERS: { value: string; label: LocalizedString }[] = [
  { value: '生理男性', label: { zh: '生理男性', en: 'Male', vi: 'Nam' } },
  { value: '生理女性', label: { zh: '生理女性', en: 'Female', vi: 'Nữ' } },
];

// 年齡組別：12 歲以上走大人版（含心情溫度計與問卷）；未滿 12 歲走兒童版（只有認識情緒 5 題）
export const CHECKIN_AGES: { value: 'adult' | 'child'; label: LocalizedString }[] = [
  { value: 'adult', label: { zh: '12歲以上', en: '12 or older', vi: 'Từ 12 tuổi trở lên' } },
  { value: 'child', label: { zh: '未滿12歲', en: 'Under 12', vi: 'Dưới 12 tuổi' } },
];

// 活動問卷（12 歲以上；匿名，value 必須與 Code.gs 的 SURVEY_OPTIONS 一致）
export const SURVEY = {
  title: { zh: '活動問卷', en: 'Event Survey', vi: 'Khảo sát hoạt động' } as LocalizedString,
  intro: {
    zh: '最後一步！這份問卷是匿名的，不會記錄你的姓名與手機。',
    en: 'Last step! This survey is anonymous—your name and phone number are not recorded.',
    vi: 'Bước cuối cùng! Khảo sát này là ẩn danh, không ghi lại tên và số điện thoại của bạn.',
  } as LocalizedString,
  gender: {
    question: { zh: '性別', en: 'Gender', vi: 'Giới tính' } as LocalizedString,
    options: [
      { value: '生理男性', label: { zh: '生理男性', en: 'Male', vi: 'Nam' } },
      { value: '生理女性', label: { zh: '生理女性', en: 'Female', vi: 'Nữ' } },
    ] as { value: string; label: LocalizedString }[],
  },
  q1: {
    question: {
      zh: '1. 校園中協助特殊教育學生的單位是？',
      en: '1. Which unit assists special education students on campus?',
      vi: '1. Đơn vị nào trong trường hỗ trợ học sinh giáo dục đặc biệt?',
    } as LocalizedString,
    options: [
      { value: '警衛室', label: { zh: '警衛室', en: 'Security Office', vi: 'Phòng bảo vệ' } },
      { value: '學發中心資源教室', label: { zh: '學發中心資源教室', en: 'S.D.C & Resource Room', vi: 'Phòng tài nguyên' } },
    ] as { value: string; label: LocalizedString }[],
  },
  q2: {
    zh: '2. 今天特教宣導讓我更加認識情緒行為障礙相關知識。',
    en: "2. Today's special education awareness activity helped me learn more about emotional and behavioral disorders.",
    vi: '2. Buổi tuyên truyền về giáo dục đặc biệt hôm nay giúp tôi hiểu thêm về các kiến thức liên quan đến rối loạn cảm xúc và hành vi.',
  } as LocalizedString,
  q3: {
    zh: '3. 如果未來有遇到身心障礙同學，我會尊重每位同學差異，嘗試理解他們的障礙。',
    en: '3. If I meet classmates with disabilities in the future, I will respect their differences and try to understand their challenges.',
    vi: '3. Nếu sau này tôi gặp bạn học có khuyết tật, tôi sẽ tôn trọng sự khác biệt của họ và cố gắng hiểu những khó khăn của họ.',
  } as LocalizedString,
  scaleLow: { zh: '非常不同意', en: 'Strongly disagree', vi: 'Rất không đồng ý' } as LocalizedString,
  scaleHigh: { zh: '非常同意', en: 'Strongly agree', vi: 'Rất đồng ý' } as LocalizedString,
  q4: {
    zh: '4. 今天活動建議或是給身心障礙同學的鼓勵（選填）',
    en: "4. Suggestions for today's event or words of encouragement for students with disabilities (optional)",
    vi: '4. Góp ý cho hoạt động hôm nay hoặc lời động viên gửi đến các bạn học sinh khuyết tật (không bắt buộc)',
  } as LocalizedString,
};

// ============ 兒童版（未滿 12 歲，只有中文）============

export const KIDS_INTRO = {
  title: '115年修平特殊教育宣導－\n「給情緒喘口氣」',
  paragraphs: [
    '每個人都有情緒：開心、生氣、難過、害怕、緊張……情緒沒有好壞之分，它們就像心裡的小天氣，有晴天，也會有下雨天。',
    '情緒來的時候，身體會先告訴我們：心跳變快、手心冒汗、想哭、想大叫。這時候先停下來、深呼吸，再說出「我現在覺得……」，就是照顧情緒的第一步。',
    '有些同學的情緒特別強烈，或是很難平靜下來。他們不是故意的，也不是壞孩子，多一點耐心和陪伴，或是請老師來幫忙，就是很棒的幫助。如果你自己的心情一直不好，也要記得告訴爸爸媽媽或老師喔！',
    '就像空氣鳳梨需要水和陽光，我們的情緒也需要被好好照顧。',
  ],
};

export const KIDS_QUIZ_INTRO = '一、認識情緒：接下來有 5 個小問題，來玩個小測驗吧！答錯也沒關係，這不是考試，主要是想讓大家更了解彼此喔！';

export interface KidsQuizQuestion {
  id: string;
  question: string;
  options: { id: string; text: string }[];
  correctAnswerId: string;
  explanation: string;
}

export const KIDS_QUIZ_QUESTIONS: KidsQuizQuestion[] = [
  {
    id: 'q1',
    question: '小美畫了好久的圖，被同學不小心打翻的水弄濕了，她覺得非常生氣，這時候她應該怎麼做最好？',
    options: [
      { id: 'A', text: '馬上大聲罵對方，也把對方的東西弄壞' },
      { id: 'B', text: '先深呼吸幾次，等心情平靜一點，再跟對方說「我很生氣，我不喜歡這樣」' },
      { id: 'C', text: '假裝沒事，但從此再也不跟這個同學玩' },
      { id: 'D', text: '躲到角落生悶氣，不理會任何人' },
    ],
    correctAnswerId: 'B',
    explanation: '生氣的時候，先讓身體停下來，在心裡默默深呼吸數到五。等冷靜一點，再用溫和、清楚的方式說出自己真正的感受，對方才會知道你的心情喔！',
  },
  {
    id: 'q2',
    question: '美美在下課時不小心跌倒了，擦破膝蓋在哭，這時候如果展現「同理心」，你會怎麼做？',
    options: [
      { id: 'A', text: '笑她膽子真小，跌倒有什麼好哭的' },
      { id: 'B', text: '裝作沒看見，繼續去玩自己的遊戲' },
      { id: 'C', text: '圍在旁邊看熱鬧，跟其他同學討論她' },
      { id: 'D', text: '走過去關心她，陪她去保健室或找老師幫忙' },
    ],
    correctAnswerId: 'D',
    explanation: '同理心就是試著感受對方的處境和心情，並給予溫暖的關懷。想像一下，如果是你自己跌倒受傷了，你會希望旁邊的同學怎麼對待你呢？',
  },
  {
    id: 'q3',
    question: '小安今天考試沒有考好，心裡覺得很沮喪、很難過，下面哪一種是「健康又適當」的情緒表達方式？',
    options: [
      { id: 'A', text: '把考卷撕得粉碎，丟在地上' },
      { id: 'B', text: '忍住眼淚悶在心裡，假裝一點都不在乎' },
      { id: 'C', text: '找信任的爸爸媽媽或老師說說自己的心情，並討論怎麼改進' },
      { id: 'D', text: '對著全班同學大吼大叫來發洩壓力' },
    ],
    correctAnswerId: 'C',
    explanation: '表達情緒不需要用破壞或壓抑的方式。找信任的人說說心情，既能釋放壓力，又能一起找到解決問題的辦法！',
  },
  {
    id: 'q4',
    question: '小華和小強都想玩同一顆籃球，兩人開始吵起來，下面哪一種做法可以讓「雙方都解決問題」？',
    options: [
      { id: 'A', text: '猜拳決定誰先玩，或是約定好輪流玩十分鐘' },
      { id: 'B', text: '誰力氣大、跑得快，球就歸誰' },
      { id: 'C', text: '把球搶過來藏起來，誰也別想玩' },
      { id: 'D', text: '大哭並跑去跟老師告狀，讓老師嚴厲處罰對方' },
    ],
    correctAnswerId: 'A',
    explanation: '遇到爭執時，試著找一個「大家都可以接受的公平方法」，而不是比力氣或獨占。可以先試著自己好好說，真的解決不了，再請老師幫忙喔！',
  },
  {
    id: 'q5',
    question: '當你覺得心跳很快、手心冒汗，甚至想握緊拳頭時，這通常是身體在告訴你，你正在經歷哪一種情緒？',
    options: [
      { id: 'A', text: '感到開心與放鬆' },
      { id: 'B', text: '覺得無聊想打瞌睡' },
      { id: 'C', text: '生氣或緊張' },
      { id: 'D', text: '感到悲傷想哭' },
    ],
    correctAnswerId: 'C',
    explanation: '心跳變快、手心冒汗、想握拳，都是身體在生氣或緊張時發出的「警報訊號」。多注意身體的變化（心跳、呼吸、肌肉緊繃），就能更早發現自己的情緒！',
  },
];

// 學校諮商單位資訊：填入後會顯示在求助資源區塊；phone 留空則不顯示
// phone 填總機（國內格式），ext 填分機；手機點擊撥號時會自動接上分機
export const SCHOOL_COUNSELING: { name: LocalizedString; phone: string; ext: string; location: LocalizedString } = {
  name: { zh: '修平科技大學 學生發展中心', en: 'HUST Student Development Center', vi: 'Trung tâm Phát triển Sinh viên HUST' },
  phone: '04-2496-1100',
  ext: '6260',
  location: {
    zh: '東魯樓 E111',
    en: 'Donglu Building E0110, E0111',
    vi: 'Tòa Donglu, phòng E0110, E0111',
  },
};

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    iconName: 'Brain',
    question: {
      zh: "下列哪一項比較符合「情緒行為障礙」可能出現的情況？",
      en: "Which of the following best describes what may occur in \"Emotional and Behavioral Disorders\" (EBD)?",
      vi: "Câu nào sau đây thể hiện đúng nhất tình trạng có thể xảy ra ở người mắc \"Rối loạn Cảm xúc và Hành vi\"?",
    },
    options: [
      { id: 'A', text: { zh: "偶爾因為心情不好而生氣", en: "Getting angry occasionally due to being in a bad mood", vi: "Thỉnh thoảng tức giận vì tâm trạng không tốt" } },
      { id: 'B', text: { zh: "故意搗蛋、不遵守規定", en: "Deliberately causing trouble and disobeying rules", vi: "Cố tình gây rối, không tuân thủ quy định" } },
      { id: 'C', text: { zh: "長期出現明顯的情緒或行為困難，並影響學習、生活或人際適應", en: "Long-term, noticeable emotional or behavioral difficulties that affect learning, daily life, or social adjustment", vi: "Xuất hiện khó khăn rõ rệt về cảm xúc hoặc hành vi kéo dài, ảnh hưởng đến học tập, cuộc sống hoặc khả năng thích nghi xã hội" } },
      { id: 'D', text: { zh: "只是不喜歡跟別人說話", en: "Simply disliking talking to others", vi: "Chỉ là không thích nói chuyện với người khác" } },
    ],
    correctAnswerId: 'C',
    explanation: {
      zh: "情緒行為障礙並不是偶爾的情緒不好，而是情緒或行為困難持續一段時間，且已明顯影響生活適應，需要進一步的理解與支持。",
      en: "EBD is not simply an occasional bad mood. It involves emotional or behavioral difficulties that persist over time and significantly impact daily functioning, requiring further understanding and support.",
      vi: "Rối loạn cảm xúc và hành vi không đơn thuần là tâm trạng không tốt trong một thời gian ngắn, mà là các khó khăn kéo dài một thời gian, ảnh hưởng rõ rệt đến cuộc sống và có thể cần sự thấu hiểu và hỗ trợ phù hợp."
    }
  },
  {
    id: 'q2',
    iconName: 'ListTree',
    question: {
      zh: "常見的情緒行為障礙有哪些呢？",
      en: "What are common types of Emotional and Behavioral Disorders?",
      vi: "Các dạng Rối loạn Cảm xúc và Hành vi thường gặp là gì?",
    },
    options: [
      { id: 'A', text: { zh: "注意力缺陷過動症（ADHD）", en: "Attention-Deficit/Hyperactivity Disorder (ADHD)", vi: "Rối loạn giảm chú ý tăng động (ADHD)" } },
      { id: 'B', text: { zh: "精神性疾患", en: "Psychotic disorders", vi: "Rối loạn tâm thần" } },
      { id: 'C', text: { zh: "焦慮性疾患", en: "Anxiety disorders", vi: "Rối loạn lo âu" } },
      { id: 'D', text: { zh: "以上都是", en: "All of the above", vi: "Tất cả các phương án trên" } },
    ],
    correctAnswerId: 'D',
    explanation: {
      zh: "情緒障礙之症狀包括精神性疾患、情感性疾患、畏懼性疾患、焦慮性疾患、注意力缺陷過動症、或有其他持續性之情緒或行為問題者。",
      en: "Emotional and behavioral disorders may include psychotic disorders, mood disorders, phobic disorders, anxiety disorders, Attention-Deficit/Hyperactivity Disorder (ADHD), and other persistent emotional/behavioral problems.",
      vi: "Rối loạn cảm xúc và hành vi có thể bao gồm rối loạn tâm thần, rối loạn khí sắc, rối loạn ám ảnh sợ hãi, rối loạn lo âu, Rối loạn tăng động giảm chú ý hoặc các vấn đề cảm xúc/hành vi kéo dài khác."
    }
  },
  {
    id: 'q3',
    iconName: 'HeartHandshake',
    question: {
      zh: "當身邊的同學出現明顯情緒困擾時，哪一種做法比較適當？",
      en: "When a classmate near you shows obvious emotional distress, which approach is most appropriate?",
      vi: "Khi một bạn học có biểu hiện khó khăn rõ rệt về cảm xúc, cách xử lý nào sau đây là phù hợp nhất?",
    },
    options: [
      { id: 'A', text: { zh: "告訴他「不要想太多」", en: "Tell them \"don't overthink it\"", vi: "Nói với bạn ấy: \"Đừng nghĩ nhiều quá\"" } },
      { id: 'B', text: { zh: "要他自己冷靜，不要影響別人", en: "Ask them to calm down by themselves so they don't affect others", vi: "Yêu cầu bạn ấy tự bình tĩnh, tránh làm ảnh hưởng đến người khác" } },
      { id: 'C', text: { zh: "先給他適當的空間，並在需要時陪伴或協助尋求支持", en: "Give them appropriate space first, and offer companionship or help them seek support when needed", vi: "Trước tiên hãy cho bạn ấy không gian phù hợp, đồng thời đồng hành hoặc hỗ trợ bạn ấy tìm kiếm sự giúp đỡ khi cần" } },
      { id: 'D', text: { zh: "當作沒看到，避免刺激他", en: "Pretend not to see it to avoid triggering them", vi: "Coi như không thấy để tránh kích động bạn ấy" } },
    ],
    correctAnswerId: 'C',
    explanation: {
      zh: "每個人的需求不同，有時需要安靜的空間，有時需要有人陪伴。給予適當支持，而不是急著評斷或要求他馬上恢復正常。",
      en: "Everyone’s needs are different. Sometimes a person may need quiet space, while at other times they may need companionship. Offer appropriate support rather than rushing to judge or expecting them to return to normal immediately.",
      vi: "Nhu cầu của mỗi người là khác nhau, đôi khi cần không gian yên tĩnh, đôi khi lại cần có người đồng hành. Hãy trao sự hỗ trợ phù hợp thay vì vội vàng phán xét hoặc yêu cầu họ phải trở lại bình thường ngay lập tức."
    }
  },
  {
    id: 'q4',
    iconName: 'EyeOff',
    question: {
      zh: "關於情緒行為障礙，下列哪一項正確？",
      en: "Regarding Emotional and Behavioral Disorders, which of the following is correct?",
      vi: "Về Rối loạn Cảm xúc và Hành vi, phát biểu nào sau đây là đúng?",
    },
    options: [
      { id: 'A', text: { zh: "一眼就能看出來", en: "You can tell immediately just by looking", vi: "Nhìn qua là có thể nhận ra ngay" } },
      { id: 'B', text: { zh: "有情緒行為障礙的人一定會常常發脾氣，找麻煩", en: "People with EBD always lose their temper and cause trouble", vi: "Người bị rối loạn cảm xúc và hành vi nhất định sẽ thường xuyên nổi giận, gây rắc rối" } },
      { id: 'C', text: { zh: "每個人的表現都一樣", en: "Everyone shows the exact same symptoms", vi: "Biểu hiện của mỗi người đều giống nhau" } },
      { id: 'D', text: { zh: "有些困難不容易從外表看出來，每個人的表現與需求也可能不同", en: "Some difficulties are not easily visible from the outside, and each person's expressions and needs may differ", vi: "Một số khó khăn không dễ nhận biết qua vẻ bề ngoài, biểu hiện và nhu cầu của mỗi người có thể khác nhau" } },
    ],
    correctAnswerId: 'D',
    explanation: {
      zh: "有些學生外表看起來與其他人沒有不同，但可能在情緒調節、人際互動或學習適應上需要更多支持。看不見，不代表不存在。",
      en: "Some students look no different from anyone else on the outside, but they may need extra support with emotional regulation, social interaction, or academic adjustment. Just because a difficulty is not visible does not mean it does not exist.",
      vi: "Một số sinh viên nhìn bề ngoài không khác gì người khác, nhưng họ có thể cần hỗ trợ nhiều hơn trong việc điều chỉnh cảm xúc, giao tiếp xã hội hoặc thích nghi học tập. Không nhìn thấy không có nghĩa là khó khăn đó không tồn tại."
    }
  },
  {
    id: 'q5',
    iconName: 'Users',
    question: {
      zh: "如果你發現身邊的同學有情緒或行為上的困擾，你認為最重要的是？",
      en: "If you notice a classmate experiencing emotional or behavioral difficulties, what do you think is most important?",
      vi: "Nếu phát hiện bạn học xung quanh gặp khó khăn về cảm xúc hoặc hành vi, bạn nghĩ điều gì là quan trọng nhất?",
    },
    options: [
      { id: 'A', text: { zh: "要求他跟大家一樣", en: "Demand that they be like everyone else", vi: "Yêu cầu bạn ấy phải giống như mọi người" } },
      { id: 'B', text: { zh: "貼上「難相處」或「問題學生」的標籤", en: "Label them as \"difficult\" or a \"problem student\"", vi: "Dán nhãn là \"khó gần\" hoặc \"sinh viên cá biệt\"" } },
      { id: 'C', text: { zh: "理解每個人的差異，並提供適合的支持", en: "Understand individual differences and provide appropriate support", vi: "Thấu hiểu sự khác biệt của mỗi người và cung cấp sự hỗ trợ phù hợp" } },
      { id: 'D', text: { zh: "只要告訴他「想開一點」就好", en: "Simply tell them to \"cheer up\"", vi: "Chỉ cần bảo bạn ấy \"nghĩ thoáng ra\" là được" } },
    ],
    correctAnswerId: 'C',
    explanation: {
      zh: "每個人的需求不同，適合的支持方式也不一樣。理解差異、減少標籤，才能讓校園成為更友善的環境。",
      en: "Everyone's needs are different, and the right form of support varies. Understanding differences and reducing labels can help create a more friendly and inclusive campus environment.",
      vi: "Nhu cầu của mỗi người là khác nhau và cách hỗ trợ phù hợp cũng khác nhau. Thấu hiểu sự khác biệt và giảm bớt việc dán nhãn có thể giúp môi trường học đường trở nên thân thiện và hòa nhập hơn."
    }
  }
];
