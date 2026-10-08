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

assert 'MCN DELIVERY CHECKS 46' in (root / 'artifacts/mcn-checks.txt').read_text(encoding='utf-8')
assert 'FINAL DELIVERY 26' in (root / 'artifacts/mcn-existing-checks.txt').read_text(encoding='utf-8')
assert 'SERVICE ORDER CHECKS 11' in (root / 'artifacts/service-checks.txt').read_text(encoding='utf-8')
assert 'INTL CHECKS 8' in (root / 'artifacts/intl-checks.txt').read_text(encoding='utf-8')
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
    '.work/mcn-promotion.js', '.work/mcn-promotion.css',
    '.work/mcn-business.js', '.work/mcn-business.css',
    '.work/wallet-promotion.js', '.work/wallet-promotion.css',
    '.work/service-cycle.js', '.work/service-cycle.css',
    '.work/service-cycle.js', '.work/service-cycle.css',
    '.work/service-cycle.js', '.work/service-cycle.css', '.work/currency.js',
    'scripts/build-v23.py', 'scripts/verify-v22.cjs', 'scripts/verify-mcn.cjs', 'scripts/verify-service.cjs', 'scripts/verify-intl.cjs',
    'scripts/package-mcn.py'
]
paths = [root / source_name, root / '使用说明.txt']
paths += [root / name for name in build_inputs]
paths += [root / 'artifacts' / name for name in artifact_names]
paths += [path for path in (root / 'dist').rglob('*') if path.is_file()]
doc_files = [path for path in (root / 'docs').rglob('*') if path.is_file() and not path.name.startswith('.')]
for required in ['README.md', '技术架构与技术选型.md', '陪伴服务平台_两端产品架构建议稿.md', '陪伴服务平台_完整产品规划_首稿原文对照.docx',
                 'modules/README.md', 'decisions/待定参数与决策记录.md', 'acceptance/原型业务检查清单.md', 'acceptance/页面与模块对照.md'] + [
                 f'modules/{name}.md' for name in ['01-账号与身份', '02-论坛与需求', '03-商品与交付', '04-订单与资金', '05-售后与申诉', '06-代理与分成', '07-公共能力']]:
    assert (root / 'docs' / required).is_file(), required
paths += doc_files

manifest = {
    'version': 'V23 cycle-settled service orders, configurable dispute routing (default platform), MCN, recharge-based promotion, USDT wallet, multi-currency (station pricing currency + USDT settlement), plus reviewed development docs',
    'date': '2026-10-06',
    'prototypeOnly': True,
    'sourceDistAndHttpEqual': True,
    'nodeChecks': {'serviceOrders': 11, 'newMcn': 46, 'existingV22': 26, 'intl': 8},
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
print('Business checks: 11 + 46 + 26 + 8 passed; screenshot assets:', len(acceptance['screenshots']), '; docs:', len(doc_files))
print('Verified ZIP:', zip_name, 'files:', len(set(paths)), 'bytes:', zip_path.stat().st_size)
