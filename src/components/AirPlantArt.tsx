// 澆水的空氣鳳梨插畫（手繪貼紙風格，純 SVG，原創）
const INK = '#1f3770';

const leaf = (bx: number, by: number, deg: number, len: number, w: number) => {
  const r = (deg * Math.PI) / 180;
  const tx = bx + len * Math.cos(r);
  const ty = by - len * Math.sin(r);
  const px = -Math.sin(r) * w;
  const py = -Math.cos(r) * w;
  const mx = bx + (tx - bx) * 0.45;
  const my = by + (ty - by) * 0.45;
  return `M${bx},${by} Q${mx + px},${my + py} ${tx},${ty} Q${mx - px},${my - py} ${bx},${by}Z`;
};

const LEAVES: [number, number, string][] = [
  [160, 46, '#a9cfa0'], [20, 46, '#a9cfa0'], [140, 54, '#8fc08a'], [40, 54, '#8fc08a'],
  [118, 58, '#b8d9ae'], [62, 58, '#b8d9ae'], [92, 62, '#9cc795'],
];

export default function AirPlantArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 170" className={className} role="img" aria-label="澆水的空氣鳳梨插畫">
      <g stroke={INK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {/* 雲 */}
        <path d="M188 30c-2-10 12-16 19-9 4-9 20-8 21 3 9-1 13 11 4 15h-40c-7 0-9-6-4-9z" fill="#fff" />
        {/* 草地 */}
        <path d="M30 150c30-14 170-14 200 0z" fill="#7fbf6a" />
        {/* 澆水壺 */}
        <g transform="rotate(25 70 52)">
          <rect x="34" y="34" width="56" height="40" rx="12" fill="#f08a3c" />
          <path d="M90 50l34-12 3 7-34 14z" fill="#f08a3c" />
          <path d="M122 34l10-3 2 12-9 3z" fill="#f6b27a" />
          <path d="M42 34c0-16 40-16 40 0" fill="none" />
          <circle cx="52" cy="54" r="5" fill="#fff7ea" />
        </g>
        {/* 水滴 */}
        <g fill="#5d8ff0">
          <path d="M140 74c4 6 5 9 2 12s-8 0-7-4 3-5 5-8z" />
          <path d="M152 92c3 5 4 8 2 10s-7 0-6-3 2-4 4-7z" />
          <path d="M133 100c3 5 4 8 2 10s-7 0-6-3 2-4 4-7z" />
        </g>
        {/* 空氣鳳梨葉子 */}
        {LEAVES.map(([deg, len, fill], i) => (
          <path key={i} d={leaf(150, 122, deg, len, 7)} fill={fill} />
        ))}
        {/* 小盆子 */}
        <path d="M124 120h52l-6 28h-40z" fill="#fff7ea" />
        <path d="M120 116h60v8h-60z" fill="#fff7ea" />
      </g>
      {/* 盆子表情 */}
      <circle cx="141" cy="132" r="2.2" fill={INK} />
      <circle cx="159" cy="132" r="2.2" fill={INK} />
      <path d="M145 137q5 4 10 0" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="135" cy="137" r="3" fill="#f6a5a0" opacity=".8" />
      <circle cx="165" cy="137" r="3" fill="#f6a5a0" opacity=".8" />
      {/* 星號點綴 */}
      <g fill="#f08a3c" fontFamily="sans-serif" fontWeight="700">
        <text x="214" y="96" fontSize="22">✳</text>
        <text x="18" y="118" fontSize="16">✳</text>
      </g>
    </svg>
  );
}
