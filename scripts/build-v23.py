"""V23 build: commercial PC/H5 UI layer on top of the frozen V22 single-file prototype.

Base: .work/v22-built.html (byte copy of the V22 delivery). Legacy transaction methods are retained; the optional MCN extension adds linked local business records; .work/mcn-business.* completes its commercial rules and V23 user surfaces; .work/wallet-promotion.* adds the USDT wallet and the recharge-based promotion model; .work/service-cycle.* adds cycle-settled service plans and the guild/platform dispute flow; .work/currency.js adds station pricing currencies, USDT settlement and versioned FX rates; .work/fashion-portraits.* renders the generated transparent adult portrait atlas across all three surfaces.
- Legacy #feRoot / #feModebar scoped CSS is neutralised (renamed) so the new design system
  has full control of PC/H5 surfaces; the legacy portrait atlas is replaced before this step.
- .work/v23.css is added as the last stylesheet; .work/v23.js is appended after the V22 layer.
"""
from pathlib import Path
import base64, hashlib, json, re, shutil, subprocess, tempfile

root = Path(__file__).resolve().parent.parent
temp_dir = root / '.work/tmp'
temp_dir.mkdir(parents=True, exist_ok=True)
base = (root / '.work/v22-built.html').read_text()


def usdt_first_phase(text: str) -> str:
    """Phase 1 prices and settles in USDT only: replace the legacy D demo currency in the frozen base."""
    money_old = "const money=n=>'D '+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});"
    assert text.count(money_old) == 1, 'money() definition changed'
    text = text.replace(money_old, money_old.replace("'D '+", "fxPricingCode()+' '+"))
    for pattern, repl, minimum in [
        (r"currency\s*:\s*'D'", "currency:'USDT'", 40), (r"\.currency='D'", ".currency='USDT'", 2),
        (r"\.currency==='D'", ".currency==='USDT'", 1), (r"\.currency\|\|'D'", ".currency||'USDT'", 1),
        (r"(?<=,)'D'(?=[,\]])", "'USDT'", 3)]:
        text, n = re.subn(pattern, repl, text)
        assert n >= minimum, (pattern, n)
    text, n = re.subn(r"(?<=>)D \$\{", "${fxPricingCode()} ${", text)
    assert n >= 1, ('price label', n)
    text, n = re.subn(r"(?<![A-Za-z0-9_])D (?=[0-9])", "USDT ", text)
    assert n >= 5, ('static D amounts', n)
    for old, new in [('D 为演示币种，支付不接入任何真实渠道。', '金额以 USDT 计价，支付不接入任何真实渠道。'),
                     ('D is a demo unit. No real payment channel is connected.', 'Amounts are in USDT. No real payment channel is connected.'),
                     ('D 演示币种', 'USDT'), ('D演示币种', 'USDT'), ('演示币 D', 'USDT'), ('（D）', '（USDT）'), (' (D)', ' (USDT)'), ('预算为演示币', '预算以 USDT 计'), ('金额均为演示币', '金额均以 USDT 计价'),
                     ('仅D演示币；正式经营币种待确认', '首期仅 USDT；其他币种按 D03 启用'), ('新站用D演示币', '新站用 USDT'),
                     ('D 演示币', 'USDT'), ('D演示币', 'USDT'), ('演示币种', 'USDT'), ('演示币', 'USDT'),
                     ('Demo credits', 'USDT'), ('demo credits', 'USDT'), ('Demo currency', 'USDT')]:
        text = text.replace(old, new)
    return text


def usdt_labels(js: str) -> str:
    """Replace hard-coded D amount labels in the MCN layer with the configured pricing currency."""
    js = js.replace("'D '+", "fxPricingCode()+' '+").replace(" D '+", " '+fxPricingCode()+' '+")
    js = re.sub(r"(?<=[\s>（(：:])D \$\{", "${fxPricingCode()} ${", js)
    assert not re.search(r"[ '>]D [$'0-9]", js), 'unconverted D label'
    return js


base = usdt_first_phase(base)
# Keep the frozen base untouched; replace only the profile's legacy manual language and notice.
profile_language_old = "feField('lang','偏好服务语言',feMe().feServiceLanguage||'简体中文','select',['简体中文','英语'])+feNotice('仅保存当前演示账号资料；不收集真实联系方式。')"
assert base.count(profile_language_old) == 1, 'profile language form changed'
base = base.replace(profile_language_old, 'pfLanguageField()')
# Replace the legacy six-person PNG atlas and seeded photo placeholders only.
# The frozen base, uploaded photos, subscription access and business data stay intact.
base, old_photo_count = re.subn(r'background-image:url\(data:image/png;base64,[A-Za-z0-9+/=]+\)', 'background-image:none', base)
assert old_photo_count == 1, ('legacy portrait atlas changed', old_photo_count)
base, media_photo_count = re.subn(r'<img class="c21-media( c21-backend-media)?" src="\$\{e\(c21Asset\(m\)\)\}" alt="[^"\n]*">', lambda m: '${fashionMediaPhoto(m,' + repr('c21-backend-media' if m.group(1) else '') + ')}', base)
assert media_photo_count == 3, ('subscription photo renderers changed', media_photo_count)
base = base.replace('<span class="avatar" style="width:52px;height:52px;font-size:22px">${e(u.name[0])}</span>', '${fashionAdminPortrait(u.id,52)}')
# Registration persists the optional field before the existing auth/attribution flow saves.
gender_register_old = "avatar:'默认头像（演示）',gender:'未填写',birthYear:'未采集',remark:'仅离线演示；18+ 为自我确认，非真实认证'"
assert base.count(gender_register_old) == 1, 'registration gender field changed'
base = base.replace(gender_register_old, gender_register_old.replace("gender:'未填写'", "gender:genderValue(fd.get('gender')),genderProfileVersion:1"))
for old, new in [
    ("['服务者 / 站点','状态','技能 / 话题','展示管理']", "['服务者 / 站点','性别','状态','技能 / 话题','展示管理']"),
    ("e(providerName(m.provider))+'<br>'+e(siteLabel(m.stationId)),e(m.online", "e(providerName(m.provider))+'<br>'+e(siteLabel(m.stationId)),genderBadge(m.provider),e(m.online"),
    ("<p>${e(siteLabel(m.stationId))} · ${e(m.topics)}", "<p>${genderBadge(m.provider)} ${e(siteLabel(m.stationId))} · ${e(m.topics)}"),
    ("<p>处理原因：${e(m.reason||'等待当前步骤完成')}</p>", "<p>服务者性别条件：${e(m.gender||'不限')}</p><p>处理原因：${e(m.reason||'等待当前步骤完成')}</p>"),
    ("providerName(c.provider)+' '+c.status", "providerName(c.provider)+'（'+genderOf(c.provider)+'） '+c.status"),
    ("v22MatchCandidates(m).map(p=>[p.id,p.name])", "v22MatchCandidates(m).map(p=>[p.id,p.name+' · '+genderOf(p)])")
]:
    assert base.count(old) == 1, ('gender related renderer changed', old[:60], base.count(old))
    base = base.replace(old, new)
css = (root / '.work/v23.css').read_text()
js = (root / '.work/v23.js').read_text()
extension_css = (root / '.work/mcn-promotion.css').read_text() if (root / '.work/mcn-promotion.css').exists() else ''
extension_js = (root / '.work/mcn-promotion.js').read_text() if (root / '.work/mcn-promotion.js').exists() else ''
extension_js = usdt_labels(extension_js)
business_css = (root / '.work/mcn-business.css').read_text() if (root / '.work/mcn-business.css').exists() else ''
business_js = (root / '.work/mcn-business.js').read_text() if (root / '.work/mcn-business.js').exists() else ''
wallet_css = (root / '.work/wallet-promotion.css').read_text() if (root / '.work/wallet-promotion.css').exists() else ''
wallet_js = (root / '.work/wallet-promotion.js').read_text() if (root / '.work/wallet-promotion.js').exists() else ''
service_css = (root / '.work/service-cycle.css').read_text() if (root / '.work/service-cycle.css').exists() else ''
service_js = (root / '.work/service-cycle.js').read_text() if (root / '.work/service-cycle.js').exists() else ''
currency_js = (root / '.work/currency.js').read_text() if (root / '.work/currency.js').exists() else ''
portrait_path = root / 'assets/portraits/fashion-cast-atlas-20261010.png'
portrait_bytes = portrait_path.read_bytes()
portrait_css = (root / '.work/fashion-portraits.css').read_text()
portrait_js = (root / '.work/fashion-portraits.js').read_text()
gender_css = (root / '.work/gender.css').read_text()
gender_js = (root / '.work/gender.js').read_text()
request_css = (root / '.work/demand-bidding.css').read_text()
request_js = (root / '.work/demand-bidding.js').read_text()
reviews_css = (root / '.work/mutual-reviews.css').read_text()
reviews_js = (root / '.work/mutual-reviews.js').read_text()
ux_css = (root / '.work/ux-polish.css').read_text()
ux_js = (root / '.work/ux-polish.js').read_text()
feed_css = (root / '.work/ux-feed.css').read_text()
feed_js = (root / '.work/ux-feed.js').read_text()
pimg_css = (root / '.work/post-images.css').read_text()
pimg_js = (root / '.work/post-images.js').read_text()
cards_css = (root / '.work/ux-cards.css').read_text()
cards_js = (root / '.work/ux-cards.js').read_text()
avatars_css = (root / '.work/avatars.css').read_text()
avatars_js = (root / '.work/avatars.js').read_text()
profile_css = (root / '.work/profile-settings.css').read_text()
profile_js = (root / '.work/profile-settings.js').read_text()
prototype_updates = json.loads((root / '.work/prototype-updates.json').read_text())
assert prototype_updates['version'] == 'V23'
assert prototype_updates['entries'] == sorted(prototype_updates['entries'], key=lambda x: x['date'], reverse=True)
assert profile_js.count('__PROTOTYPE_UPDATES__') == 1
profile_js = profile_js.replace('__PROTOTYPE_UPDATES__', json.dumps(prototype_updates, ensure_ascii=False).replace('</', '<\\/'))
update_lines = ['# 原型修改说明', '', f"当前版本：{prototype_updates['version']}。最新更新：{prototype_updates['entries'][0]['date']}。", '',
                '本文件与原型内“修改说明”由 `.work/prototype-updates.json` 同源生成。每次修改追加记录，并同步更新使用说明、相关模块规则与验收记录；版本号由项目负责人指定。', '']
for entry in prototype_updates['entries']:
    update_lines += [f"## {entry['date']} · {entry['title']}", '']
    update_lines += [f"- **{item['kind']}**：{item['text']}" for item in entry['items']]
    update_lines += ['', '相关文档：' + ' · '.join(f"[{doc['title']}]({'../' + doc['path']})" for doc in entry['docs']), '']
    for doc in entry['docs']:
        assert (root / doc['path']).is_file(), ('missing update document', doc['path'])
(root / 'docs/修改说明.md').write_text('\n'.join(update_lines), encoding='utf-8')
avatar_sheets = []
avatar_root = 'assets/portraits/default-library-centered-20261012'
avatar_manifest = json.loads((root / avatar_root / 'manifest.json').read_text())
avatar_geometry = []
for index, sheet in enumerate(avatar_manifest['sheets']):
    asset = f"{avatar_root}/{sheet['asset']}"
    content = (root / asset).read_bytes()
    assert hashlib.sha256(content).hexdigest() == sheet['sha256'], asset
    assert len(sheet['rowCropBounds']) == 5 and len(sheet['offsets']) == 40, asset
    marker = f'__AVATAR_SHEET_{index}__'
    assert avatars_css.count(marker) == 1, marker
    avatars_css = avatars_css.replace(marker, 'data:image/png;base64,' + base64.b64encode(content).decode('ascii'))
    avatar_sheets.append({'asset': asset, 'grid': [8, 5], 'count': 40,
                          'sha256': hashlib.sha256(content).hexdigest()})
    avatar_geometry.append({'width': sheet['width'], 'height': sheet['height'],
                            'rows': sheet['rowCropBounds'], 'offsets': sheet['offsets']})
assert avatars_js.count('__AVATAR_GEOMETRY__') == 1
avatars_js = avatars_js.replace('__AVATAR_GEOMETRY__', json.dumps(avatar_geometry, separators=(',', ':')))
assert portrait_css.count('__FASHION_ATLAS_DATA__') == 1
portrait_css = portrait_css.replace('__FASHION_ATLAS_DATA__', 'data:image/png;base64,' + base64.b64encode(portrait_bytes).decode('ascii'))


def neutralise(sheet: str) -> str:
    out, i, n = [], 0, len(sheet)
    while i < n:
        j = sheet.find('{', i)
        if j < 0:
            out.append(sheet[i:]); break
        k = sheet.find('}', i)
        if 0 <= k < j:  # closing an @media block
            out.append(sheet[i:k + 1]); i = k + 1; continue
        prelude = sheet[i:j]
        head = prelude.strip()
        if head.startswith('@media') or head.startswith('@supports'):
            out.append(sheet[i:j + 1]); i = j + 1; continue
        if head.startswith('@'):  # keyframes / font-face: copy whole nested block
            depth, p = 0, j
            while p < n:
                if sheet[p] == '{': depth += 1
                elif sheet[p] == '}':
                    depth -= 1
                    if depth == 0: break
                p += 1
            out.append(sheet[i:p + 1]); i = p + 1; continue
        end = sheet.find('}', j)
        body = sheet[j:end + 1]
        if 'data:' not in body:
            prelude = re.sub(r'#feRoot(?![\w-])', '#feRootV22', prelude)
            prelude = re.sub(r'#feModebar(?![\w-])', '#feModebarV22', prelude)
        out.append(prelude + body); i = end + 1
    return ''.join(out)


head_end = base.index('</head>')
head = re.sub(r'(<style[^>]*>)(.*?)(</style>)', lambda m: m.group(1) + neutralise(m.group(2)) + m.group(3), base[:head_end], flags=re.S)
s = head + '<style id="v23-style">\n/* V23 STYLE START */\n' + css + '\n/* V23 STYLE END */\n</style>' + base[head_end:]

assert s.count('/* V22 END */\nboot();') == 1
s = s.replace('/* V22 END */\nboot();', '/* V22 END */\n/* V23 START */\n' + js + '\n/* V23 END */\n/* MCN AND PROMOTION START */\n' + extension_js + '\n/* MCN AND PROMOTION END */\n/* MCN BUSINESS START */\n' + business_js + '\n/* MCN BUSINESS END */\n/* WALLET PROMOTION START */\n' + wallet_js + '\n/* WALLET PROMOTION END */\n/* SERVICE CYCLE START */\n' + service_js + '\n/* SERVICE CYCLE END */\n/* CURRENCY START */\n' + currency_js + '\n/* CURRENCY END */\n/* FASHION PORTRAITS START */\n' + portrait_js + '\n/* FASHION PORTRAITS END */\nboot();')
s = s.replace('/* FASHION PORTRAITS END */\nboot();', '/* FASHION PORTRAITS END */\n/* GENDER START */\n' + gender_js + '\n/* GENDER END */\nboot();')
s = s.replace('/* GENDER END */\nboot();', '/* GENDER END */\n/* DEMAND BIDDING START */\n' + request_js + '\n/* DEMAND BIDDING END */\nboot();')
s = s.replace('/* DEMAND BIDDING END */\nboot();', '/* DEMAND BIDDING END */\n/* MUTUAL REVIEWS START */\n' + reviews_js + '\n/* MUTUAL REVIEWS END */\nboot();')
assert s.count('/* MUTUAL REVIEWS END */\nboot();') == 1
s = s.replace('/* MUTUAL REVIEWS END */\nboot();', '/* MUTUAL REVIEWS END */\n/* UX POLISH START */\n' + ux_js + '\n/* UX POLISH END */\nboot();')
assert s.count('/* UX POLISH END */\nboot();') == 1
s = s.replace('/* UX POLISH END */\nboot();', '/* UX POLISH END */\n/* UX FEED START */\n' + feed_js + '\n/* UX FEED END */\nboot();')
assert s.count('/* UX FEED END */\nboot();') == 1
s = s.replace('/* UX FEED END */\nboot();', '/* UX FEED END */\n/* POST IMAGES START */\n' + pimg_js + '\n/* POST IMAGES END */\nboot();')
assert s.count('/* POST IMAGES END */\nboot();') == 1
s = s.replace('/* POST IMAGES END */\nboot();', '/* POST IMAGES END */\n/* UX CARDS START */\n' + cards_js + '\n/* UX CARDS END */\nboot();')
assert s.count('/* UX CARDS END */\nboot();') == 1
s = s.replace('/* UX CARDS END */\nboot();', '/* UX CARDS END */\n/* AVATARS START */\n' + avatars_js + '\n/* AVATARS END */\nboot();')
assert s.count('/* AVATARS END */\nboot();') == 1
s = s.replace('/* AVATARS END */\nboot();', '/* AVATARS END */\n/* PROFILE SETTINGS START */\n' + profile_js + '\n/* PROFILE SETTINGS END */\nboot();')
s = s.replace('</head>', '<style id="mutual-reviews-style">\n' + reviews_css + '\n</style></head>', 1)
s = s.replace('</head>', '<style id="demand-bidding-style">\n' + request_css + '\n</style></head>', 1)
s = s.replace('</head>', '<style id="mcn-promotion-style">\n' + extension_css + '\n</style><style id="mcn-business-style">\n' + business_css + '\n</style><style id="wallet-promotion-style">\n' + wallet_css + '\n</style><style id="service-cycle-style">\n' + service_css + '\n</style><style id="fashion-portraits-style">\n' + portrait_css + '\n</style><style id="gender-style">\n' + gender_css + '\n</style></head>', 1)
s = s.replace('</head>', '<style id="ux-polish-style">\n' + ux_css + '\n</style></head>', 1)
s = s.replace('</head>', '<style id="ux-feed-style">\n' + feed_css + '\n</style></head>', 1)
s = s.replace('</head>', '<style id="post-images-style">\n' + pimg_css + '\n</style></head>', 1)
s = s.replace('</head>', '<style id="ux-cards-style">\n' + cards_css + '\n</style></head>', 1)
s = s.replace('</head>', '<style id="avatars-style">\n' + avatars_css + '\n</style></head>', 1)
s = s.replace('</head>', '<style id="profile-settings-style">\n' + profile_css + '\n</style></head>', 1)
s = s.replace('<title>产品完善版 · 陪伴服务平台｜总站 / PC / H5 · 第二十二版</title>', '<title>伴屿 · 陪伴服务平台｜运营后台 / PC / H5 · 第二十三版</title>')

s = s.replace('陪伴服务平台｜总站 / PC / H5 · 第二十二版', '陪伴服务平台｜总站 / PC / H5 · 第二十三版')

for script in re.findall(r'<script[^>]*>(.*?)</script>', s, re.S):
    with tempfile.NamedTemporaryFile(mode='w', suffix='.js', dir=temp_dir, encoding='utf-8') as f:
        f.write(script); f.flush(); subprocess.run(['node', '--check', f.name], check=True)

src = root / '陪伴服务平台_三端交互原型.html'
s = s.replace('（D）', '（USDT）')  # phase 1: every amount label is USDT
src.write_text(s)
(root / 'dist').mkdir(exist_ok=True)
shutil.copy2(src, root / 'dist/index.html')
shutil.copy2(root / '使用说明.txt', root / 'dist/使用说明.txt')
for document in (root / 'docs').rglob('*.md'):
    target = root / 'dist' / document.relative_to(root)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(document, target)
shutil.copytree(root / 'assets/portraits', root / 'dist/assets/portraits', dirs_exist_ok=True)
(root / 'dist/.nojekyll').write_text('', encoding='utf-8')
(root / 'dist/build-info.json').write_text(json.dumps({
    'version': 'V23', 'prototypeOnly': True,
    'genderProfileVersion': 1,
    'demandBiddingVersion': 1,
    'mutualReviewsVersion': 2,
    'profileSettingsVersion': 1,
    'prototypeUpdatedAt': prototype_updates['entries'][0]['date'],
    'avatarLibrary': {'version': 3, 'newChoices': 200, 'legacyChoices': 16,
                      'transparent': True, 'embedded': True, 'generator': 'built-in imagegen',
                      'minimumHeadroomPercent': 12, 'geometry': avatar_geometry,
                      'sheets': avatar_sheets},
    'indexBytes': src.stat().st_size,
    'indexSha256': hashlib.sha256(src.read_bytes()).hexdigest(),
    'portraits': {'count': 16, 'grid': [4, 4], 'width': 1254, 'height': 1254,
                 'transparent': True, 'generator': 'built-in imagegen',
                 'asset': 'assets/portraits/fashion-cast-atlas-20261010.png',
                 'sha256': hashlib.sha256(portrait_bytes).hexdigest()}
}, indent=2) + '\n', encoding='utf-8')
print('V23 built:', len(s.encode('utf-8')), 'bytes; syntax checked; dist synced')
