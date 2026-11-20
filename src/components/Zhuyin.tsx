import { Fragment } from 'react';
import { KIDS_ZHUYIN } from '../data/kidsZhuyin';

const SIDE_TONES = 'ˊˇˋ';
const isHan = (c: string) => /[一-鿿]/.test(c);

/** 一個國字＋直排注音（注音在右邊，課本式） */
const Char = ({ c, z }: { c: string; z: string }) => {
  let body = z;
  let tone = '';
  let light = false;
  if (body.endsWith('˙') || body.startsWith('˙')) { light = true; body = body.replace('˙', ''); }
  if (SIDE_TONES.includes(body.slice(-1))) { tone = body.slice(-1); body = body.slice(0, -1); }
  const syms = [...body];
  return (
    <span className="zy-c">
      <span className="zy-h">{c}</span>
      <span className="zy-p" aria-hidden="true">
        {light && <span className="zy-n">˙</span>}
        {syms.map((s, i) => (
          <span key={i} className="zy-s">
            {s}
            {tone && i === syms.length - 1 && <span className="zy-t">{tone}</span>}
          </span>
        ))}
      </span>
    </span>
  );
};

/** 顯示兒童版文字；on 時加上注音（只認得 kidsZhuyin.ts 裡有的句子，其他照原樣顯示） */
export default function Zy({ text, on }: { text: string; on: boolean }) {
  const zs = on ? KIDS_ZHUYIN[text] : undefined;
  if (!zs) return <>{text}</>;

  // 把國字和後面緊接的標點包在一起，避免標點跑到行首
  const units: { c: string; z: string; tail: string }[] = [];
  const chars = [...text];
  chars.forEach((c, i) => {
    const prev = units[units.length - 1];
    if (isHan(c) && zs[i]) units.push({ c, z: zs[i], tail: '' });
    else if (prev && c !== '\n' && /[，。、：；！？…）」』]/.test(c)) prev.tail += c;
    else units.push({ c, z: '', tail: '' });
  });

  return (
    <>
      {units.map((u, i) =>
        u.z ? (
          <span key={i} className="zy-u"><Char c={u.c} z={u.z} />{u.tail}</span>
        ) : (
          <Fragment key={i}>{u.c}</Fragment>
        )
      )}
    </>
  );
}
