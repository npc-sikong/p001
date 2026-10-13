# -*- coding: utf-8 -*-
"""Package the current V23 local prototype and its reproducible MCN extension."""
from pathlib import Path
import hashlib
import json
import os
import re
import shutil
import urllib.request
import zipfile

root = Path(__file__).resolve().parent.parent
source_name = '陪伴服务平台_三端交互原型.html'
zip_name = '陪伴服务平台_公会与推广交付包.zip'


def digest(data):
    return hashlib.sha256(data).hexdigest()


source = (root / source_name).read_bytes()
assert source == (root / 'dist/index.html').read_bytes(), 'Source and dist differ'
assert (root / '使用说明.txt').read_bytes() == (root / 'dist/使用说明.txt').read_bytes(), 'Documentation differs'
prototype_url = os.environ.get('PROTOTYPE_URL', 'http://127.0.0.1:8000/')
with urllib.request.urlopen(prototype_url, timeout=10) as response:
    assert response.status == 200
    assert source == response.read(), 'Running HTTP output differs from source'

CHECKS = {'verify-v22': 'FINAL DELIVERY 26', 'verify-mcn': 'MCN DELIVERY CHECKS 46', 'verify-service': 'SERVICE ORDER CHECKS 11', 'verify-intl': 'INTL CHECKS 8',
          'verify-gender': 'TOTAL 25 gender checks passed', 'verify-demands': 'TOTAL 15 demand bidding checks passed', 'verify-reviews': 'TOTAL 22 mutual review checks passed',
          'verify-alignment': 'ALIGNMENT CHECKS 15', 'verify-ux': 'UX CHECKS 7', 'verify-feed': 'FEED CHECKS 11', 'verify-images': 'IMAGE CHECKS 8', 'verify-cards': 'CARD CHECKS 8', 'verify-avatars': 'AVATAR CHECKS 8'}
for name, line in CHECKS.items():
    log = (root / 'artifacts/checks' / (name + '.txt')).read_text(encoding='utf-8')
    assert line in log and '\nFAIL' not in '\n' + log, name
acceptance = json.loads((root / 'artifacts/mcn-browser-acceptance.json').read_text(encoding='utf-8'))
gallery = (root / 'artifacts/mcn-screenshots.html').read_text(encoding='utf-8')
assert len(acceptance['screenshots']) == 30
assert sorted(re.findall(r'<img src="([^"]+)"', gallery)) == sorted(acceptance['screenshots'])

artifact_names = acceptance['screenshots'] + [
    'mcn-screenshots.html', 'mcn-browser-acceptance.json',
    'mcn-checks.txt', 'mcn-existing-checks.txt', 'service-checks.txt', 'intl-checks.txt', 'mcn-admin-pages.json'
]
dist_artifacts = root / 'dist/artifacts'
dist_artifacts.mkdir(exist_ok=True)
for name in artifact_names:
    item = root / 'artifacts' / name
    assert item.is_file(), name
    shutil.copy2(item, dist_artifacts / name)

build_inputs = [
    '.work/v22-built.html', '.work/v23.js', '.work/v23.css',
    '.work/mcn-promotion.js', '.work/mcn-promotion.css', '.work/mcn-business.js', '.work/mcn-business.css',
    '.work/wallet-promotion.js', '.work/wallet-promotion.css', '.work/service-cycle.js', '.work/service-cycle.css', '.work/currency.js',
    '.work/fashion-portraits.js', '.work/fashion-portraits.css', '.work/gender.js', '.work/gender.css',
    '.work/demand-bidding.js', '.work/demand-bidding.css', '.work/mutual-reviews.js', '.work/mutual-reviews.css',
    '.work/ux-polish.js', '.work/ux-polish.css', '.work/ux-feed.js', '.work/ux-feed.css', '.work/post-images.js', '.work/post-images.css', '.work/ux-cards.js', '.work/ux-cards.css', '.work/avatars.js', '.work/avatars.css', 'assets/portraits/fashion-cast-atlas-20261010.png',
    'scripts/build-v23.py', 'scripts/package-mcn.py', 'scripts/ux-check.cjs', 'scripts/feed-check.cjs', 'scripts/images-check.cjs', 'scripts/cards-check.cjs', 'scripts/avatars-check.cjs', 'scripts/ui-check-v23.cjs',
] + [f'scripts/{name}.cjs' for name in CHECKS]
paths = [root / source_name, root / '使用说明.txt']
paths += [root / name for name in build_inputs]
paths += [root / 'artifacts' / name for name in artifact_names]
for folder in ['checks', 'ux', 'gender', 'reviews', 'requests', 'fashion']:
    paths += [path for path in (root / 'artifacts' / folder).rglob('*') if path.is_file() and not path.name.startswith('.')]
assert (root / 'artifacts/ux/index.html').is_file()
paths += [path for path in (root / 'dist').rglob('*') if path.is_file()]
doc_files = [path for path in (root / 'docs').rglob('*') if path.is_file() and not path.name.startswith('.')]
for required in ['README.md', '技术架构与技术选型.md', '陪伴服务平台_两端产品架构建议稿.md', '陪伴服务平台_完整产品规划_首稿原文对照.docx',
                 'modules/README.md', 'decisions/待定参数与决策记录.md', 'acceptance/原型业务检查清单.md', 'acceptance/页面与模块对照.md'] + [
                 f'modules/{name}.md' for name in ['01-账号与身份', '02-论坛与需求', '03-商品与交付', '04-订单与资金', '05-售后与申诉', '06-代理与分成', '07-公共能力']]:
    assert (root / 'docs' / required).is_file(), required
paths += doc_files

manifest = {
    'version': 'V23 avatar library and uploads, redesigned order cards and record rows, no station names on the user end, Chinese place and time-zone names, post images with an image-review switch, home carousel with back-office settings, 小红书-style community feed and image-card list pages; commercial-grade user end (help center, customer service tickets, settings hub, legal pages); front/back alignment checks; USDT-first phase, gender, demand bidding, mutual reviews, plus development docs',
    'date': '2026-10-12',
    'prototypeOnly': True,
    'sourceDistAndHttpEqual': True,
    'nodeChecks': {name: int(re.search(r'\d+', line).group()) for name, line in CHECKS.items()},
    'docs': len(doc_files),
    'screenshots': len(acceptance['screenshots']),
    'files': {
        str(path.relative_to(root)): {
            'bytes': path.stat().st_size,
            'sha256': digest(path.read_bytes())
        } for path in sorted(paths)
    }
}
manifest_path = root / 'artifacts/mcn-delivery-manifest.json'
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
paths.append(manifest_path)

zip_path = root / zip_name
temporary = root / (zip_name + '.tmp')
with zipfile.ZipFile(temporary, 'w', zipfile.ZIP_DEFLATED) as delivery:
    for path in sorted(set(paths)):
        delivery.write(path, str(path.relative_to(root)))
with zipfile.ZipFile(temporary) as delivery:
    assert delivery.testzip() is None, 'ZIP integrity check failed'
    for name, info in manifest['files'].items():
        assert digest(delivery.read(name)) == info['sha256'], name
    assert delivery.read(source_name) == delivery.read('dist/index.html')
temporary.replace(zip_path)
print('Source = dist = HTTP, SHA-256:', digest(source))
print('Business checks:', sum(manifest['nodeChecks'].values()), 'passed; screenshot assets:', len(acceptance['screenshots']), '; docs:', len(doc_files))
print('Verified ZIP:', zip_name, 'files:', len(set(paths)), 'bytes:', zip_path.stat().st_size)
