export type Language = 'zh' | 'en' | 'vi';

export interface LocalizedString {
  zh: string;
  en: string;
  vi: string;
}

export interface QuizQuestion {
  id: string;
  iconName: string;
  gifPath?: string;
  question: LocalizedString;
  options: {
    id: string;
    text: LocalizedString;
  }[];
  correctAnswerId: string;
  explanation: LocalizedString;
}

export interface BsrsQuestion {
  id: string;
  text: LocalizedString;
}

export interface BsrsOption {
  value: number;
  label: LocalizedString;
}
