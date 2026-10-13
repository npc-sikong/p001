/* Real-click check: home carousel + back-office settings, 小红书-style feed, image-card list pages (needs local Chrome + playwright-core).
   Usage: NODE_PATH=<dir with playwright-core> node scripts/feed-check.cjs http://127.0.0.1:8000/ pc|h5 [shotDir] */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const url = process.argv[2] || 'http://127.0.0.1:8123/';
const mode = process.argv[3] || 'pc';
const shotDir = process.argv[4] || '';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const ctx = await b.newContext({ viewport: mode === 'h5' ? { width: 390, height: 844 } : { width: 1280, height: 900 }, hasTouch: mode === 'h5' });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(url); await p.waitForTimeout(700);
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  await p.evaluate(m => feSetMode(m), mode); await p.waitForTimeout(200);
  await p.mouse.move(2, 2);
  let failed = 0;
  const step = async (name, fn) => { try { const x = await fn(); console.log('OK  ', name, x || ''); } catch (e) { failed++; console.log('FAIL', name, '·', e.message.split('\n')[0]); } };
  const go = (pg, id = '') => p.evaluate(([pg, id]) => feNavigate(pg, id), [pg, id]);
  const login = id => p.selectOption('#feModebar select[data-fe-change="auth-user"]', id);
  const idx = () => p.evaluate(() => Number(document.querySelector('[data-ux-carousel]')?.dataset.index));
  const shot = async name => { if (!shotDir) return; fs.mkdirSync(shotDir, { recursive: true }); if (mode === 'h5') { const h = await p.evaluate(() => { const m = document.querySelector('#feMain'); const st = document.createElement('style'); st.id = 'ux-shot'; st.textContent = `#feMain{overflow:visible!important;height:${m.scrollHeight}px!important;max-height:none!important}`; document.head.appendChild(st); const ph = m.closest('.fe-phone'); if (ph) { ph.style.height = 'auto'; ph.style.maxHeight = 'none'; } return m.scrollHeight + 200; }); await p.setViewportSize({ width: 390, height: Math.min(9000, h) }); await p.waitForTimeout(150); await p.screenshot({ path: `${shotDir}/${name}.jpg`, type: 'jpeg', quality: 80, fullPage: true }); await p.evaluate(() => { document.getElementById('ux-shot')?.remove(); const ph = document.querySelector('#feMain').closest('.fe-phone'); if (ph) { ph.style.height = ''; ph.style.maxHeight = ''; } }); await p.setViewportSize({ width: 390, height: 844 }); } else await p.screenshot({ path: `${shotDir}/${name}.jpg`, type: 'jpeg', quality: 80, fullPage: true }); };
  await step('home carousel: 4 slides, auto-advances after 5 s', async () => {
    await login('U22-VIP'); await go('home'); await p.waitForTimeout(200); await shot('home');
    const n = await p.locator('#feMain .ux-slide').count(); if (n !== 4) throw new Error('slides ' + n);
    const a = await idx(); await p.waitForTimeout(5600); const c = await idx(); if (c === a) throw new Error(`index stayed ${a}`); return `${a} → ${c}`;
  });
  await step(mode === 'h5' ? 'carousel: swipe left / dot click' : 'carousel: arrow next / dot click', async () => {
    const a = await idx();
    if (mode === 'h5') await p.evaluate(() => { const car = document.querySelector('[data-ux-carousel]'); const t = (x) => new Touch({ identifier: 1, target: car, clientX: x, clientY: 200 }); car.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [t(300)], changedTouches: [t(300)] })); car.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [t(120)] })); });
    else { await p.locator('#feMain .ux-carousel').hover(); await p.locator('#feMain .ux-bn-arrow.next').click(); }
    const c = await idx(); if (c !== (a + 1) % 4) throw new Error(`${a} → ${c}`);
    await p.locator('#feMain [data-ux-bn-dot="0"]').click(); if ((await idx()) !== 0) throw new Error('dot did not select slide 1'); await p.mouse.move(2, 2); return `${a} → ${c} → 0`;
  });
  await step('carousel CTA navigates and counts the click', async () => {
    await p.locator('#feMain .ux-slide[data-bn="BN-01"] [data-fe="go"]').first().click(); await p.waitForTimeout(200);
    const r = await p.evaluate(() => ({ page: FE.page, clicks: db.uxBanners.slides.find(s => s.id === 'BN-01').clicks })); if (r.page !== 'v22Match' || r.clicks !== 1) throw new Error(JSON.stringify(r)); return JSON.stringify(r);
  });
  await step('back office 首页轮播图: add a slide with a background image, disable another', async () => {
    if (mode === 'h5') await p.setViewportSize({ width: 1280, height: 900 });
    await p.click('#feModebar [data-fe="mode"][data-id="admin"]'); await p.waitForTimeout(300);
    if (await p.$('#content input[name="backendPassword"]')) { await p.fill('#content input[name="backendPassword"]', 'DEMO_admin_2026'); await p.check('#content input[name="demoOnly"]'); await p.locator('#content button[type="submit"]').first().click(); await p.waitForTimeout(400); }
    if (!(await p.$('#sidebar [data-route="uxBanners"]'))) { await p.click('#sidebar [data-act="ops11Group"][data-id="config"]'); await p.waitForTimeout(200); }
    await p.locator('#sidebar [data-route="uxBanners"]').click(); await p.waitForTimeout(300);
    const f = '#content form[data-ux-bn-form="save"]';
    await p.fill(f + ' [name="title"]', '夏日陪伴季'); await p.fill(f + ' [name="subtitle"]', '主题活动限时开启'); await p.selectOption(f + ' [name="theme"]', 'sunset');
    await p.fill(f + ' [name="cta1Label"]', '去看看'); await p.selectOption(f + ' [name="cta1Page"]', 'v22Activities');
    const img = path.resolve(__dirname, '../artifacts/ux/after/h5/help.jpg');
    if (fs.existsSync(img)) { await p.setInputFiles(f + ' [data-ux-bn-file]', img); await p.waitForFunction(sel => document.querySelector(sel + ' [name="image"]').value.startsWith('data:image/jpeg'), f); }
    await p.fill(f + ' [name="reason"]', '配置夏季运营活动'); await p.locator(f + ' button[type="submit"]').click(); await p.waitForTimeout(300);
    const r = await p.evaluate(() => { const s = db.uxBanners.slides.find(x => x.title === '夏日陪伴季'); return s && { image: s.image.slice(0, 15), theme: s.theme, page: s.cta1.page }; });
    if (!r) throw new Error('slide not saved');
    const row = '#content form[data-ux-bn-form="row"][data-id="BN-03"]'; await p.fill(row + ' [name="reason"]', '会员活动暂停'); await p.locator(row + ' button[value="toggle"]').click(); await p.waitForTimeout(250);
    const off = await p.evaluate(() => db.uxBanners.slides.find(x => x.id === 'BN-03').enabled); if (off) throw new Error('BN-03 still enabled');
    if (mode === 'pc') await p.screenshot({ path: shotDir ? `${shotDir}/admin-banners.jpg` : '/tmp/admin-banners.jpg', type: 'jpeg', quality: 80, fullPage: true });
    return JSON.stringify(r);
  });
  await step('user end shows the new slide (with image) and hides the disabled one', async () => {
    await p.click(`#feModebar [data-fe="mode"][data-id="${mode}"]`); if (mode === 'h5') await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300); await login('U22-VIP'); await go('home'); await p.waitForTimeout(200);
    const r = await p.evaluate(() => ({ titles: [...document.querySelectorAll('#feMain .ux-slide h1')].map(h => h.textContent), img: !!document.querySelector('#feMain .ux-slide.ux-has-img') }));
    if (!r.titles.includes('夏日陪伴季') || r.titles.includes('开通月度 VIP') || !r.img) throw new Error(JSON.stringify(r)); return r.titles.join(' / ');
  });
  await step('需求与社区: masonry feed, chip filter, search', async () => {
    await go('needs'); await p.waitForTimeout(200); await shot('needs');
    const cols = await p.locator('#feMain .uxf-col').count(), cards = await p.locator('#feMain .uxf-card').count();
    if (cols !== (mode === 'h5' ? 2 : 4) || cards < 18) throw new Error(`cols ${cols} cards ${cards}`);
    await p.locator('#feMain [data-fe="uxFeedChip"][data-id="学习打卡"]').click(); await p.waitForTimeout(150);
    const study = await p.locator('#feMain .uxf-card').count(); if (!(study > 0 && study < cards)) throw new Error('chip ' + study);
    await p.locator('#feMain [data-fe="uxFeedChip"][data-id="推荐"]').click(); await p.fill('#feMain [data-uxf-q]', '雅思'); await p.press('#feMain [data-uxf-q]', 'Enter'); await p.waitForTimeout(150);
    const q = await p.locator('#feMain .uxf-card').count(); if (q !== 1) throw new Error('search ' + q);
    await p.fill('#feMain [data-uxf-q]', ''); await p.press('#feMain [data-uxf-q]', 'Enter'); await p.waitForTimeout(150); return `${cards} cards, ${cols} cols, 学习打卡 ${study}`;
  });
  await step('like a post, open a card, publish menu opens the post composer', async () => {
    const like = p.locator('#feMain .uxf-like').first(), before = Number(await like.locator('span').innerText()); await like.click(); await p.waitForTimeout(150);
    const after = Number(await p.locator('#feMain .uxf-like.on span').first().innerText()); if (after !== before + 1) throw new Error(`${before} → ${after}`);
    await p.locator('#feMain .uxf-open').first().click(); await p.waitForTimeout(200); const pg = await p.evaluate(() => FE.page); if (!['post', 'need'].includes(pg)) throw new Error('opened ' + pg);
    await go('needs'); await p.waitForTimeout(150); await p.locator('#feMain .uxf-publish > summary').click(); await p.locator('#feMain [data-fe="uxCompose"][data-id="post"]').click(); await p.waitForTimeout(200);
    const d = await p.evaluate(() => ({ dialog: !!FE.dialog, tab: FE.needTab, visible: !!document.querySelector('.fe-dialog, .fe-dialog-mask') })); if (!d.dialog || d.tab !== '社区广场' || !d.visible) throw new Error(JSON.stringify(d));
    await p.evaluate(() => { FE.dialog = null; feRender(); }); return `like ${before} → ${after}, opened ${pg}`;
  });
  await step('image cards: activities, rooms, guild square, following', async () => {
    await p.evaluate(() => { try { v22Command('follow', 'SP22-GAME'); } catch { } save(); });
    const out = [];
    for (const [pg, sel] of [['v22Activities', '.uxf-act .uxf-cover'], ['v22Rooms', '.uxf-room .uxf-cover'], ['guilds', '.uxf-guild'], ['v22Following', '.uxf-follow .v23-card']]) { await go(pg); await p.waitForTimeout(150); const n = await p.locator('#feMain ' + sel).count(); if (!n) throw new Error(pg + ' has no image cards'); out.push(`${pg} ${n}`); await shot(pg); }
    return out.join(', ');
  });
  console.log('page errors:', errs.length ? errs : 'none');
  await b.close(); process.exit(failed || errs.length ? 1 : 0);
})();
