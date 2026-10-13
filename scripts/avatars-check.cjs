/* Real-click check: choose a default avatar, upload one, back-office approval, hide avatar (needs local Chrome + playwright-core).
   Usage: NODE_PATH=<dir with playwright-core> node scripts/avatars-check.cjs http://127.0.0.1:8000/ pc|h5 [shotDir] */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const url = process.argv[2] || 'http://127.0.0.1:8123/';
const mode = process.argv[3] || 'pc';
const shotDir = process.argv[4] || '';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const small = mode === 'h5' ? { width: 390, height: 844 } : { width: 1280, height: 900 };
  const p = await (await b.newContext({ viewport: small })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(url); await p.waitForTimeout(700);
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  await p.evaluate(m => feSetMode(m), mode); await p.waitForTimeout(200);
  let failed = 0;
  const step = async (name, fn) => { try { const x = await fn(); console.log('OK  ', name, x || ''); } catch (e) { failed++; console.log('FAIL', name, '·', e.message.split('\n')[0]); } };
  const go = (pg, id = '') => p.evaluate(([pg, id]) => feNavigate(pg, id), [pg, id]);
  const login = id => p.selectOption('#feModebar select[data-fe-change="auth-user"]', id);
  const shot = async (name, full = false) => { if (!shotDir) return; fs.mkdirSync(shotDir, { recursive: true }); await p.screenshot({ path: `${shotDir}/${name}.jpg`, type: 'jpeg', quality: 80, fullPage: full }); };
  const headAvatar = () => p.evaluate(() => document.querySelector('#feMain .v23-me-id .fe-avatar')?.innerHTML || '');
  const openPicker = async () => { await go('mine'); await p.waitForTimeout(150); await p.locator('#feMain .av-edit').first().click(); await p.waitForTimeout(200); if (!(await p.locator('[data-av-picker]').count())) throw new Error('picker not open'); };
  const submit = async () => { await p.locator('form[data-fe-form="profile"] button[type="submit"]').click(); await p.waitForTimeout(300); };
  await step('“我的”: tap the avatar → picker with 200 new avatars and 16 legacy choices; choose one and save', async () => {
    await login('U22-VIP'); await openPicker();
    const n = await p.locator('[data-av-picker] input[name="avatarChoice"][value^="preset:"]').count(); if (n !== 200) throw new Error('options ' + n);
    await p.locator('[data-av-picker] .av-opt:has(input[value="preset:16"])').click(); await p.waitForTimeout(80);
    if (!/data-av-preset="16"/.test(await p.locator('[data-av-preview]').innerHTML())) throw new Error('preview not updated');
    await shot('avatar-picker'); await submit(); if (!/data-av-preset="16"/.test(await headAvatar())) throw new Error('header avatar not changed'); return '200 options, chose #17';
  });
  await step('upload a photo: cropped preview; saved as “审核中” while the old avatar stays', async () => {
    await openPicker(); await p.setInputFiles('[data-av-file]', path.resolve(__dirname, '../artifacts/ux/after/h5/home.jpg'));
    await p.waitForFunction(() => document.querySelector('[data-av-picker] [name="avatarData"]').value.startsWith('data:image/jpeg'), null, { timeout: 8000 });
    if (!(await p.locator('[data-av-preview] img').count())) throw new Error('no upload preview'); if (!(await p.locator('[data-av-picker] input[value="upload"]').isChecked())) throw new Error('upload not selected');
    await submit(); const st = await p.evaluate(() => getBy('users', 'U22-VIP').avatarUpload?.status); if (st !== '待审核') throw new Error('status ' + st);
    if (!/data-av-preset="16"/.test(await headAvatar())) throw new Error('old avatar not kept'); return st;
  });
  await step('back office 图片审核: the avatar is in the queue (类型：头像) → approve', async () => {
    await p.setViewportSize({ width: 1280, height: 900 }); await p.click('#feModebar [data-fe="mode"][data-id="admin"]'); await p.waitForTimeout(300);
    if (await p.$('#content input[name="backendPassword"]')) { await p.fill('#content input[name="backendPassword"]', 'DEMO_admin_2026'); await p.check('#content input[name="demoOnly"]'); await p.locator('#content button[type="submit"]').first().click(); await p.waitForTimeout(400); }
    if (!(await p.$('#sidebar [data-route="uxImages"]'))) { await p.click('#sidebar [data-act="ops11Group"][data-id="service"]'); await p.waitForTimeout(200); }
    await p.locator('#sidebar [data-route="uxImages"]').click(); await p.waitForTimeout(300);
    if (!/类型：头像/.test(await p.locator('#content').innerText())) throw new Error('avatar not in queue'); if (mode === 'pc') await shot('avatar-review');
    const id = await p.evaluate(() => getBy('users', 'U22-VIP').avatarUpload.id); await p.locator(`#content form[data-pi-form="decide"][data-id="${id}"] button[value="approve"]`).click(); await p.waitForTimeout(250);
    const r = await p.evaluate(() => ({ st: getBy('users', 'U22-VIP').avatarUpload.status, choice: getBy('users', 'U22-VIP').avatarChoice })); if (r.st !== '已通过' || r.choice !== 'upload') throw new Error(JSON.stringify(r)); return JSON.stringify(r);
  });
  await step('user end now shows the uploaded avatar', async () => {
    await p.click(`#feModebar [data-fe="mode"][data-id="${mode}"]`); await p.setViewportSize(small); await p.waitForTimeout(300); await login('U22-VIP'); await go('mine'); await p.waitForTimeout(150);
    if (!/<img src="data:image\/jpeg/.test(await headAvatar())) throw new Error('uploaded avatar not shown'); await shot('avatar-mine'); return 'ok';
  });
  await step('choose “不展示” → generic default avatar', async () => {
    await openPicker(); await p.locator('[data-av-picker] .av-opt:has(input[value="none"])').click(); await submit();
    if (!/ops16-default-avatar/.test(await headAvatar())) throw new Error('not hidden'); return 'hidden';
  });
  console.log('page errors:', errs.length ? errs : 'none');
  await b.close(); process.exit(failed || errs.length ? 1 : 0);
})();
