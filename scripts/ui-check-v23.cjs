/* V23 UI flow check (optional, needs local Chrome + `npm i playwright-core`).
   Usage: node scripts/ui-check-v23.cjs http://127.0.0.1:8000/ pc|h5
   Env CHROME=/path/to/chrome overrides the default macOS Chrome location.
   Runs in a fresh browser profile; does not touch your own browser data. */
const { chromium } = require('playwright-core');
const fs = require('fs');
const url = process.argv[2] || 'http://127.0.0.1:8123/';
const mode = process.argv[3] || 'pc';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto(url); await page.waitForTimeout(600);
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload(); await page.waitForTimeout(600);
  await page.evaluate(m => feSetMode(m), mode);
  const st = () => page.evaluate(() => ({ page: FE.page, id: FE.id, toast: [...document.querySelectorAll('.v23-toast')].map(x => x.innerText).join('/') }));
  let failed = 0;
  const step = async (name, fn) => { try { await fn(); const s = await st(); console.log('OK  ', name, '→', s.page, s.id, s.toast ? '[' + s.toast + ']' : ''); } catch (e) { failed++; const s = await st(); console.log('FAIL', name, e.message.split('\n')[0], '@', s.page, s.toast);  } };
  const click = sel => page.locator(sel).first().click({ timeout: 3000 });
  const tab = async p => { if (mode === 'h5') { const sub = await page.evaluate(() => document.getElementById('feRoot').classList.contains('v23-sub')); if (sub) await click('.v23-appbar [data-fe="go"][data-id="home|"]'); await click(`.fe-bottom-nav [data-id="${p}|"]`); } else await click(`.v23-nav [data-id="${p}|"]`); };
  const shot = async () => {};
  // login via modebar account select
  await step('login as 顾言 via modebar', async () => { await page.selectOption('#feModebar select[data-fe-change="auth-user"]', 'U22-VIP'); await page.waitForTimeout(200); });
  await step('home → provider card', async () => { await tab('discover'); await click('.v23-card-media[data-id="provider|SP22-GAME"]'); });
  await step('voice preview toggles', async () => { await tab('discover'); await click('.v23-voice[data-id="SP22-GAME"]'); await page.waitForTimeout(300); const on = await page.evaluate(() => document.querySelector('.v23-voice[data-id="SP22-GAME"]').classList.contains('playing')); if (!on) throw new Error('not playing'); await click('.v23-voice[data-id="SP22-GAME"]'); });
  await step('open provider + follow', async () => { await click('.v23-card-media[data-id="provider|SP22-GAME"]'); await click('.v23-follow'); const t = await page.locator('.v23-follow').innerText(); if (!/已关注/.test(t)) throw new Error('follow label ' + t); });
  await step('consult from provider', async () => { await click(mode === 'h5' ? '.v22-profile-actions [data-v22-command="consult"]' : '.v23-phero-actions [data-v22-command="consult"]'); });
  await step('send consult message', async () => { await page.fill('form[data-v22-form="consultSend"] textarea[name="text"]', '你好，想约明晚 18:00 王者双排'); await click('form[data-v22-form="consultSend"] button[type="submit"]'); await page.waitForTimeout(150); const n = await page.locator('.v23-msg.self').count(); if (n < 1) throw new Error('no message'); });
  await shot('consult');
  await step('back to provider (app back / crumbs)', async () => { if (mode === 'h5') await click('[data-fe="v23Back"]'); else await click('.v23-crumbs button[data-id="messages|"]'); });
  await step('messages hub consult tab', async () => { await tab('messages'); await click('[data-fe="v23Tab"][data-id="consults"]'); const n = await page.locator('.v23-conv').count(); if (!n) throw new Error('no consult rows'); });
  await step('provider → book', async () => { await page.evaluate(() => feNavigate('provider', 'SP22-GAME')); await click(mode === 'h5' ? '.v22-profile-actions [data-fe="book"]' : '.v23-phero-actions [data-fe="book"]'); if ((await st()).page !== 'booking') throw new Error('not booking'); });
  await step('booking submit', async () => { const f = 'form[data-fe-form="booking"]'; await page.check(f + ' input[name="confirm"]'); await click(f + ' button[type="submit"]'); await page.waitForTimeout(200); if ((await st()).page !== 'pay') throw new Error('not pay page'); });
  await shot('pay');
  await step('pay success', async () => { await click('[data-fe="paySuccess"]'); await page.waitForTimeout(200); });
  await shot('after-pay');
  await step('orders list shows order', async () => { await tab('mine'); await click('[data-fe="v23Orders"][data-id^="buyer|全部"]'); const n = await page.locator('.fe-order-card').count(); if (!n) throw new Error('no order cards'); });
  await step('discover filter + only-online', async () => { await tab('discover'); if (mode === 'h5') { await click('.v23-filter-btn'); await page.waitForTimeout(100); const vis = await page.locator('.v23-sheet').count(); if (!vis) throw new Error('sheet not open'); await click('.v23-sheet [data-fe="filter"][data-id="category|CAT-GAME"]'); await click('.v23-sheet-foot [data-fe="v23Sheet"]'); } else await click('.v23-filter-panel [data-fe="filter"][data-id="category|CAT-GAME"]'); await click('.v23-toggle'); const n = await page.locator('.v23-card').count(); console.log('      cards after filter:', n); });
  await shot('discover');
  await step('match create', async () => { await page.evaluate(() => feNavigate('v22Match')); await page.selectOption('form[data-v22-form="matchCreate"] select[name="game"]', '王者荣耀'); await click('form[data-v22-form="matchCreate"] button[type="submit"]'); await page.waitForTimeout(150); if (!(await st()).id) throw new Error('no match id'); });
  await step('match search', async () => { await click('[data-v22-command="matchSearch"]'); await page.waitForTimeout(100); console.log('      candidates:', await page.locator('.v23-cand').count()); });
  await shot('match');
  await step('rooms: join seed room', async () => { await page.evaluate(() => feNavigate('v22Rooms')); await click('.v23-room[data-id="v22Room|ROOM22-SEED"]'); await click('[data-v22-command="roomJoin"]'); await page.waitForTimeout(100); const seats = await page.locator('.v23-seat').count(); if (seats !== 4) throw new Error('stage seats ' + seats); });
  await step('room: apply mic + message', async () => { await click('.v23-stage-actions [data-v22-command="roomApply"]'); await page.fill('form[data-v22-form="roomMessage"] input[name="text"]', '大家好～'); await click('form[data-v22-form="roomMessage"] button[type="submit"]'); await page.waitForTimeout(100); if (!(await page.locator('.v23-room-chat .v23-msg').count())) throw new Error('no room message'); });
  await shot('room');
  await step('VIP gate as 可可 (basic)', async () => { await page.selectOption('#feModebar select[data-fe-change="auth-user"]', 'U22-BASIC'); await page.evaluate(() => feNavigate('provider', 'SP22-GAME')); await click(mode === 'h5' ? '.v22-profile-actions [data-v22-command="consult"]' : '.v23-phero-actions [data-v22-command="consult"]'); await page.waitForTimeout(100); const t = await page.locator('.v23-toast.err').count(); if (!t) throw new Error('expected error toast'); });
  await step('logout from mine', async () => { await page.evaluate(() => feNavigate('mine')); await click('[data-fe="authLogout"]'); });
  await step('guest header shows login', async () => { await page.evaluate(() => feNavigate('home')); const n = await page.locator(mode === 'h5' ? '.v23-appbar [data-id="login|"]' : '.v23-top [data-id="login|"]').count(); if (!n) throw new Error('no login button'); });
  console.log('page errors:', errs.length ? errs : 'none');
  if (errs.length || failed) process.exitCode = 1;
  await browser.close();
})();
