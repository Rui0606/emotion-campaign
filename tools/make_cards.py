"""工作人員個人小卡（明信片 100×148mm，直式）產生器
用法：python3 make_cards.py cards.json out.html  → 再用 Chrome 列印成 PDF（A4，每頁 4 張，正反面分頁）
cards.json 格式：
{ "staff_url": "...", "guide_url": "...", "counselor_code": "1031",
  "people": [ {"name":"張瑞芸","role":"關卡三：場控＋主控","pin":"1234","counselor":false,
               "tasks":[["09:00–12:30","關卡三：場控＋主控"]]} ] }
"""
import json, sys, io, html
import qrcode, qrcode.image.svg

def qr_svg(url):
    img = qrcode.make(url, image_factory=qrcode.image.svg.SvgPathImage, border=1, box_size=10)
    s = img.to_string(encoding='unicode')
    return s[s.find('<svg'):]

E = html.escape
cfg = json.load(open(sys.argv[1], encoding='utf-8'))
people = cfg['people']
STAFF_QR = qr_svg(cfg['staff_url'])
GUIDE_QR = qr_svg(cfg['guide_url'])
SCHEDULE = [("12/3（四）中午", "行前說明"), ("12/5 08:30–09:00", "場佈（全體）"),
            ("09:00–12:30", "活動進行"), ("12:30–13:00", "🍱 午餐＋收拾")]

def front(p):
    tasks = ''.join(f'<tr><td>{E(t)}</td><td>{E(w)}</td></tr>' for t, w in p.get('tasks', []))
    code = (f'<div class="box code"><span>心理師通關碼</span><b>{E(cfg["counselor_code"])}</b>'
            f'<small>不可告訴參加者，對談結束後才給</small></div>') if p.get('counselor') else ''
    return f'''<div class="card front">
  <div class="ribbon">✳ 115年修平特殊教育宣導</div>
  <div class="ev">給情緒喘口氣</div>
  <div class="tag">STAFF 工作人員</div>
  <div class="name">{E(p["name"])}</div>
  <div class="role">{E(p.get("role", ""))}</div>
  <div class="box pin"><span>個人密碼</span><b>{E(p["pin"])}</b><small>只限本人使用，不可借人</small></div>
  {code}
  {f'<table class="tasks">{tasks}</table>' if tasks else ''}
  <div class="foot">12/5（六）微風廣場・資源教室攤位</div>
</div>'''

def back(p):
    sch = ''.join(f'<tr><td>{E(t)}</td><td>{E(w)}</td></tr>' for t, w in SCHEDULE)
    return f'''<div class="card back">
  <div class="qrtitle">📱 手機掃描，直接上工</div>
  <div class="qr big">{STAFF_QR}</div>
  <div class="qrlabel">工作人員系統<br><small>掃描 → 輸入正面的個人密碼</small></div>
  <div class="row">
    <div class="qr small">{GUIDE_QR}</div>
    <div class="qrlabel left">▶ 操作示範動畫<br><small>不會用時先看這個</small></div>
  </div>
  <table class="sch">{sch}</table>
  <div class="foot">登入後右上角 🔔 可看自己的工作與時程</div>
</div>'''

# A4 直式，每頁 2×2 張；背面左右鏡像（長邊翻頁雙面列印時對齊）
pages = []
for i in range(0, len(people), 4):
    grp = people[i:i + 4] + [None] * (4 - len(people[i:i + 4]))
    f = ''.join(front(p) if p else '<div class="card empty"></div>' for p in grp)
    mirrored = [grp[1], grp[0], grp[3], grp[2]]
    b = ''.join(back(p) if p else '<div class="card empty"></div>' for p in mirrored)
    pages.append(f'<section class="sheet">{f}</section><section class="sheet">{b}</section>')

CSS = '''
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
:root { --ink:#1f3770; --blue:#2a5bd7; --orange:#e5652a; --paper:#f5f8ff; --grid:#d6e2f7; }
body { font-family: 'Chiron GoRound TC','Noto Sans CJK TC','Noto Sans TC',sans-serif; color: var(--ink); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.sheet { width: 210mm; height: 297mm; display: grid; grid-template-columns: 100mm 100mm; grid-template-rows: 148mm 148mm; gap: 0; justify-content: center; align-content: center; page-break-after: always; }
.card { width: 100mm; height: 148mm; border: .3mm dashed #b8c4dc; padding: 6mm 6mm 5mm; position: relative; overflow: hidden;
  background-color: var(--paper); background-image: linear-gradient(var(--grid) .25mm, transparent .25mm), linear-gradient(90deg, var(--grid) .25mm, transparent .25mm); background-size: 5mm 5mm; display: flex; flex-direction: column; align-items: center; }
.card.empty { background: #fff; }
.ribbon { font-size: 3.2mm; font-weight: 700; color: var(--orange); background: #fff; border-top: .5mm solid var(--ink); border-bottom: .5mm solid var(--ink); padding: 1mm 6mm; clip-path: polygon(0 0,100% 0,calc(100% - 3mm) 50%,100% 100%,0 100%,3mm 50%); }
.ev { font-size: 7mm; font-weight: 700; color: var(--blue); -webkit-text-stroke: .25mm var(--ink); paint-order: stroke fill; margin-top: 2mm; }
.tag { margin-top: 3mm; font-size: 3mm; font-weight: 700; letter-spacing: .6mm; background: var(--ink); color: #fff; border-radius: 10mm; padding: .8mm 4mm; }
.name { font-size: 13mm; font-weight: 700; margin-top: 3mm; line-height: 1.1; }
.role { font-size: 4mm; font-weight: 700; color: var(--orange); margin-top: 1.5mm; text-align: center; min-height: 5mm; }
.box { width: calc(100% - 1mm); margin-right: 1mm; background: #fff; border: .6mm solid var(--ink); border-radius: 4mm; box-shadow: 1mm 1mm 0 var(--ink); margin-top: 4mm; padding: 2.5mm 3mm; display: grid; grid-template-columns: auto 1fr; align-items: center; column-gap: 3mm; }
.box span { font-size: 3.4mm; font-weight: 700; color: #5b6b8c; }
.box b { font-size: 10mm; letter-spacing: 2.5mm; text-align: right; color: var(--blue); }
.box small { grid-column: 1 / 3; font-size: 2.7mm; color: #8a97b3; }
.box.code b { color: var(--orange); }
.tasks, .sch { width: 100%; margin-top: 4mm; border-collapse: collapse; font-size: 3.2mm; background: #fff; border: .4mm solid var(--ink); border-radius: 3mm; }
.tasks td, .sch td { padding: 1.3mm 2mm; border-bottom: .3mm dashed var(--grid); vertical-align: top; }
.tasks td:first-child, .sch td:first-child { font-weight: 700; color: var(--blue); white-space: nowrap; }
.foot { position: absolute; bottom: 4.5mm; left: 0; right: 0; text-align: center; font-size: 3mm; color: #5b6b8c; font-weight: 700; }
.qrtitle { font-size: 5mm; font-weight: 700; margin-top: 1mm; }
.qr { background: #fff; border: .6mm solid var(--ink); border-radius: 4mm; box-shadow: 1mm 1mm 0 var(--ink); padding: 2mm; }
.qr svg { display: block; width: 100%; height: 100%; }
.qr.big { width: 52mm; height: 52mm; margin-top: 3mm; }
.qr.small { width: 20mm; height: 20mm; flex-shrink: 0; }
.qrlabel { text-align: center; font-weight: 700; font-size: 4mm; margin-top: 2mm; line-height: 1.35; }
.qrlabel small { font-size: 3mm; color: #5b6b8c; font-weight: 400; }
.qrlabel.left { text-align: left; margin-top: 0; }
.row { display: flex; gap: 3mm; align-items: center; margin-top: 3mm; width: 100%; }
@media screen { body { background: #ccd; } .sheet { background: #fff; margin: 8mm auto; box-shadow: 0 2mm 6mm rgba(0,0,0,.2); } }
'''
out = f'''<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"><title>工作人員個人小卡</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chiron+GoRound+TC:wght@400;700&display=swap">
<style>{CSS}</style></head><body>{''.join(pages)}</body></html>'''
open(sys.argv[2], 'w', encoding='utf-8').write(out)
print(len(people), 'cards,', len(pages) * 2, 'pages')
