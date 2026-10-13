/* Real-click check: post images upload → back-office image review → user end; review switch off → images shown directly (needs local Chrome + playwright-core).
   Usage: NODE_PATH=<dir with playwright-core> node scripts/images-check.cjs http://127.0.0.1:8000/ pc|h5 [shotDir]
   The post's text review is an existing flow covered elsewhere; this check marks the text as approved directly. */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const url = process.argv[2] || 'http://127.0.0.1:8123/';
const mode = process.argv[3] || 'pc';
const shotDir = process.argv[4] || '';
const img = n => path.resolve(__dirname, '../artifacts/ux/after/h5', n);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const small = mode === 'h5' ? { width: 390, height: 844 } : { width: 1280, height: 900 };
  const p = await (await b.newContext({ viewport: small })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(url); await p.waitForTimeout(700);
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  await p.evaluate(m => feSetMode(m), mode); await p.waitForTimeout(200);
  let failed = 0, postId = '';
  const step = async (name, fn) => { try { const x = await fn(); console.log('OK  ', name, x || ''); } catch (e) { failed++; console.log('FAIL', name, '·', e.message.split('\n')[0]); } };
  const go = (pg, id = '') => p.evaluate(([pg, id]) => feNavigate(pg, id), [pg, id]);
  const login = id => p.selectOption('#feModebar select[data-fe-change="auth-user"]', id);
  const shot = async (name, full = true) => { if (!shotDir) return; fs.mkdirSync(shotDir, { recursive: true }); await p.screenshot({ path: `${shotDir}/${name}.jpg`, type: 'jpeg', quality: 80, fullPage: full }); };
  const toAdmin = async () => { await p.setViewportSize({ width: 1280, height: 900 }); await p.click('#feModebar [data-fe="mode"][data-id="admin"]'); await p.waitForTimeout(300); if (await p.$('#content input[name="backendPassword"]')) { await p.fill('#content input[name="backendPassword"]', 'DEMO_admin_2026'); await p.check('#content input[name="demoOnly"]'); await p.locator('#content button[type="submit"]').first().click(); await p.waitForTimeout(400); } if (!(await p.$('#sidebar [data-route="uxImages"]'))) { await p.click('#sidebar [data-act="ops11Group"][data-id="service"]'); await p.waitForTimeout(200); } await p.locator('#sidebar [data-route="uxImages"]').click(); await p.waitForTimeout(300); };
  const toUser = async user => { await p.click(`#feModebar [data-fe="mode"][data-id="${mode}"]`); await p.setViewportSize(small); await p.waitForTimeout(300); await login(user); };
  const compose = async (title, files) => {
    await go('needs'); await p.waitForTimeout(150); await p.locator('#feMain .uxf-publish > summary').click(); await p.locator('#feMain [data-fe="uxCompose"][data-id="post"]').click(); await p.waitForTimeout(250);
    const f = 'form[data-fe-form="post"]'; await p.setInputFiles(f + ' [data-pi-file]', files);
    await p.waitForFunction(([sel, n]) => document.querySelectorAll(sel + ' .pi-thumb').length === n, [f, files.length], { timeout: 8000 });
    await p.fill(f + ' [name="title"]', title); await p.selectOption(f + ' [name="post_purpose"]', '交流求助'); await p.fill(f + ' [name="content"]', title + '，分享几张照片。');
    for (const box of await p.locator(f + ' input[type="checkbox"][required]').all()) await box.check();
    return f;
  };
  await step('composer: upload 2 images, thumbnails appear, “设为封面” reorders', async () => {
    await login('U1001'); const f = await compose('周末看展随手拍', [img('home.jpg'), img('needs.jpg')]);
    const before = await p.evaluate(sel => JSON.parse(document.querySelector(sel + ' [name="piList"]').value).map(x => x.h), f);
    await p.locator(f + ' [data-pi-cover="1"]').click(); await p.waitForTimeout(100);
    const after = await p.evaluate(sel => JSON.parse(document.querySelector(sel + ' [name="piList"]').value).map(x => x.h), f);
    if (after[0] !== before[1]) throw new Error('cover not moved'); if (!(await p.locator(f + ' .pi-cover-tag').count())) throw new Error('no cover tag');
    if (mode === 'pc') await shot('pi-composer', false); else await shot('pi-composer', false);
    await p.locator(f + ' button[type="submit"]').click(); await p.waitForTimeout(300);
    const r = await p.evaluate(() => { const post = db.posts.find(x => x.author === 'U1001' && x.uxImages?.length); return post && { id: post.id, st: post.uxImages.map(i => i.status), flash: document.getElementById('feRoot')?.innerText || '' }; });
    if (!r || r.st.join() !== '待审核,待审核' || !/图片已提交审核/.test(r.flash)) throw new Error(JSON.stringify(r)); postId = r.id; return r.id + ' ' + r.st.join('/');
  });
  await step('my posts: cover uses my image with “图片审核中”', async () => {
    await p.evaluate(id => { getBy('posts', id).status = '已发布'; save(); }, postId);
    await go('mycontent'); await p.waitForTimeout(150); const c = p.locator(`#feMain .uxf-open[data-id="post|${postId}"]`);
    if (!(await c.locator('img').count()) || !/图片审核中/.test(await c.innerText())) throw new Error('own cover missing'); return 'ok';
  });
  await step('others do not see unreviewed images', async () => {
    await login('U22-VIP'); await go('needs'); await p.waitForTimeout(150);
    if (await p.locator(`#feMain .uxf-open[data-id="post|${postId}"] img`).count()) throw new Error('pending image public'); return 'text cover shown';
  });
  await step('back office 图片审核: approve one, reject one with a reason', async () => {
    await toAdmin(); await shot('pi-admin-review');
    const ids = await p.evaluate(id => getBy('posts', id).uxImages.map(i => i.id), postId);
    await p.locator(`#content form[data-pi-form="decide"][data-id="${ids[0]}"] button[value="approve"]`).click(); await p.waitForTimeout(250);
    const f2 = `#content form[data-pi-form="decide"][data-id="${ids[1]}"]`; await p.selectOption(f2 + ' [name="category"]', '与内容无关'); await p.fill(f2 + ' [name="note"]', '与帖子主题无关'); await p.locator(f2 + ' button[value="reject"]').click(); await p.waitForTimeout(250);
    const st = await p.evaluate(id => getBy('posts', id).uxImages.map(i => i.status + (i.reason ? ':' + i.reason : '')), postId);
    if (st[0] !== '已通过' || !st[1].startsWith('未通过:与内容无关')) throw new Error(st.join()); return st.join(' / ');
  });
  await step('user end: approved image becomes the cover; gallery shows only approved images', async () => {
    await toUser('U22-VIP'); await go('needs'); await p.waitForTimeout(150);
    if (!(await p.locator(`#feMain .uxf-open[data-id="post|${postId}"] img`).count())) throw new Error('cover not shown');
    await shot('pi-feed'); await p.locator(`#feMain .uxf-open[data-id="post|${postId}"]`).click(); await p.waitForTimeout(200);
    const n = await p.locator('#feMain .pi-gallery .pi-slide').count(); if (n !== 1) throw new Error('slides ' + n); await shot('pi-post'); return 'slides ' + n;
  });
  await step('back office: switch image review off (with reason)', async () => {
    await toAdmin(); const f = '#content form[data-pi-form="setting"]'; await p.check(f + ' input[name="enabled"][value="0"]'); await p.fill(f + ' [name="reason"]', '活动期间免审展示'); await p.locator(f + ' button[type="submit"]').click(); await p.waitForTimeout(250);
    if (await p.evaluate(() => db.uxImageReview.enabled)) throw new Error('still on'); return 'off';
  });
  await step('review off: a new post’s image is shown directly (marked 免审)', async () => {
    await toUser('U1001'); const f = await compose('关闭审核后的带图帖子', [img('home.jpg')]);
    if (!/上传后直接展示/.test(await p.locator(f + ' .pi-head').innerText())) throw new Error('hint not updated');
    await p.locator(f + ' button[type="submit"]').click(); await p.waitForTimeout(300);
    const r = await p.evaluate(old => { const post = db.posts.find(x => x.author === 'U1001' && x.uxImages?.length && x.id !== old); post.status = '已发布'; save(); return { id: post.id, st: post.uxImages[0].status, auto: post.uxImages[0].auto }; }, postId);
    if (r.st !== '已通过' || !r.auto) throw new Error(JSON.stringify(r));
    await login('U22-VIP'); await go('needs'); await p.waitForTimeout(150); if (!(await p.locator(`#feMain .uxf-open[data-id="post|${r.id}"] img`).count())) throw new Error('not shown'); return r.id;
  });
  console.log('page errors:', errs.length ? errs : 'none');
  await b.close(); process.exit(failed || errs.length ? 1 : 0);
})();
