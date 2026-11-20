type SoundType = 'click' | 'correct' | 'wrong' | 'success';

// 整個網頁共用一個 AudioContext（瀏覽器對同時存在的數量有上限，iPhone 尤其低）
let sharedCtx: AudioContext | null = null;

const getContext = (): AudioContext | null => {
  if (sharedCtx) return sharedCtx;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  sharedCtx = new Ctor();
  return sharedCtx;
};

const tone = (
  ctx: AudioContext,
  { type = 'sine', from, to, start = 0, duration, volume, ramp = 'exp' }: {
    type?: OscillatorType; from: number; to?: number; start?: number; duration: number; volume: number; ramp?: 'exp' | 'linear';
  },
) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  const t = ctx.currentTime + start;
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  if (to !== undefined) {
    if (ramp === 'exp') osc.frequency.exponentialRampToValueAtTime(to, t + duration);
    else osc.frequency.linearRampToValueAtTime(to, t + duration);
  }
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.start(t);
  osc.stop(t + duration + 0.02);
};

export const playSound = (type: SoundType) => {
  try {
    const ctx = getContext();
    if (!ctx) return;
    // 手機瀏覽器在背景或首次互動前會暫停音訊，需要喚醒
    if (ctx.state === 'suspended') void ctx.resume();

    if (type === 'click') {
      tone(ctx, { from: 400, to: 600, duration: 0.06, volume: 0.08 });
    } else if (type === 'correct') {
      tone(ctx, { from: 600, duration: 0.12, volume: 0.15 });
      tone(ctx, { from: 800, start: 0.1, duration: 0.2, volume: 0.15 });
    } else if (type === 'wrong') {
      tone(ctx, { type: 'triangle', from: 220, to: 140, duration: 0.3, volume: 0.15, ramp: 'linear' });
    } else if (type === 'success') {
      [523, 659, 784, 1047].forEach((freq, i) => {
        tone(ctx, { from: freq, start: i * 0.1, duration: 0.3, volume: 0.15 });
      });
    }
  } catch {
    // 音效只是加分項目，失敗時安靜略過
  }
};
