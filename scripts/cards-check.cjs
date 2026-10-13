/* Real-click check: order cards, record rows, no station names on the user end, Chinese time zones (needs local Chrome + playwright-core).
   Usage: NODE_PATH=<dir with playwright-core> node scripts/cards-check.cjs http://127.0.0.1:8000/ pc|h5 [shotDir] */
const { chromium } = require('playwright-core');
const fs = require('fs');
const url = process.argv[2] || 'http://127.0.0.1:8123/';
const mode = process.argv[3] || 'pc';
const shotDir = process.argv[4] || '';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const p = await (await b.newContext({ viewport: mode === 'h5' ? { width: 390, height: 844 } : { width: 1280, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(url); await p.waitForTimeout(700);
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  await p.evaluate(m => feSetMode(m), mode); await p.waitForTimeout(200);
  let failed = 0;
  const step = async (name, fn) => { try { const x = await fn(); console.log('OK  ', name, x || ''); } catch (e) { failed++; console.log('FAIL', name, '·', e.message.split('\n')[0]); } };
  const go = (pg, id = '') => p.evaluate(([pg, id]) => feNavigate(pg, id), [pg, id]);
  const login = id => p.selectOption('#feModebar select[data-fe-change="auth-user"]', id);
  const bad = () => p.evaluate(() => { const t = document.getElementById('feRoot').innerText; return [...new Set([...db.stations.map(s => s.name).filter(n => t.includes(n)), ...(t.match(/[A-Z][a-z]+\/[A-Za-z_]+|\bUTC\b(?![+\-−]\d)/g) || [])])]; });
  const shot = async name => { if (!shotDir) return; fs.mkdirSync(shotDir, { recursive: true }); if (mode === 'h5') { const h = await p.evaluate(() => { const m = document.querySelector('#feMain'); const st = document.createElement('style'); st.id = 'cc-shot'; st.textContent = `#feMain{overflow:visible!important;height:${m.scrollHeight}px!important;max-height:none!important}`; document.head.appendChild(st); const ph = m.closest('.fe-phone'); if (ph) { ph.style.height = 'auto'; ph.style.maxHeight = 'none'; } return m.scrollHeight + 200; }); await p.setViewportSize({ width: 390, height: Math.min(6000, h) }); await p.waitForTimeout(120); await p.screenshot({ path: `${shotDir}/${name}.jpg`, type: 'jpeg', quality: 80, fullPage: true }); await p.evaluate(() => { document.getElementById('cc-shot')?.remove(); const ph = document.querySelector('#feMain').closest('.fe-phone'); if (ph) { ph.style.height = ''; ph.style.maxHeight = ''; } }); await p.setViewportSize({ width: 390, height: 844 }); } else await p.screenshot({ path: `${shotDir}/${name}.jpg`, type: 'jpeg', quality: 80, fullPage: true }); };
  await step('my orders: new order cards, Chinese time zone, no station name; “确认服务” opens the order', async () => {
    await login('U1001'); await go('orders'); await p.waitForTimeout(200); await shot('orders');
    const n = await p.locator('#feMain .uc-card').count(); if (n < 3) throw new Error('cards ' + n);
    const parts = await p.evaluate(() => [...document.querySelectorAll('#feMain .uc-card')].every(c => c.querySelector('.uc-status') && c.querySelector('.uc-no') && c.querySelector('.uc-amt b') && c.querySelector('.uc-actions .primary')));
    if (!parts) throw new Error('card parts missing'); const t = await p.locator('#feMain').innerText(); if (!/北京时间/.test(t)) throw new Error('no Chinese time zone');
    const b1 = await bad(); if (b1.length) throw new Error('found ' + b1.join(','));
    await p.locator('#feMain .uc-actions .primary', { hasText: '确认服务' }).first().click(); await p.waitForTimeout(200);
    if ((await p.evaluate(() => FE.page)) !== 'order') throw new Error('did not open order'); return `${n} cards`;
  });
  await step('unpaid order uses the same card and “继续支付” goes to payment', async () => {
    await login('U22-VIP'); await p.evaluate(() => { const f = new FormData(); for (const [k, v] of Object.entries({ confirm: 'on', geoScope: 'any', start: pd8AddDays(TODAY, 3), time: '15:00' })) f.set(k, v); feSubmit('booking', feProducts('SP22-GAME')[0].id, f); save(); });
    await go('orders'); await p.waitForTimeout(200); const card = p.locator('#feMain .uc-card', { hasText: '待支付订单' }).first(); if (!(await card.count())) throw new Error('no draft card');
    await card.locator('.uc-actions .primary').click(); await p.waitForTimeout(200); if ((await p.evaluate(() => FE.page)) !== 'pay') throw new Error('not pay page'); return 'ok';
  });
  await step('provider orders show “去履约”; agent team orders and commission use the new cards and rows', async () => {
    await p.evaluate(() => { FE.user = 'U22-VIP'; FE_AUTH.signedIn = true; FE.side = 'buyer'; const r = v22Persist(() => wpCommand('rechargeCreate', '', { amount: 3000, network: 'TRC20' })); v22Persist(() => wpCommand('rechargeResult', r, { result: '成功' })); const f = new FormData(); for (const [k, v] of Object.entries({ confirm: 'on', geoScope: 'any', start: pd8AddDays(TODAY, 1), time: '18:00', scTerm: '7', scCycle: '3' })) f.set(k, v); feSubmit('booking', feProducts('SP22-GAME').find(x => x.period === '按天').id, f); const d = db.feDrafts.find(x => x.user === 'U22-VIP' && x.status === '待支付' && x.name && /按天/.test(x.name)) || db.feDrafts.find(x => x.user === 'U22-VIP' && x.status === '待支付'); v22Persist(() => wpCommand('pay', d.id)); save(); });
    await login('U22-GAME'); await p.evaluate(() => { FE.side = 'provider'; }); await go('orders'); await p.waitForTimeout(200);
    if (!(await p.locator('#feMain .uc-actions .primary', { hasText: '去履约' }).count())) throw new Error('no 去履约');
    await login('U-AGENT-AG-01'); await go('agentOrders'); await p.waitForTimeout(200); const a = await p.locator('#feMain .uc-card').count(); if (!a) throw new Error('agent cards'); await shot('agentOrders');
    await go('agentEarnings'); await p.waitForTimeout(200); const r = await p.locator('#feMain .uc-row').count(); if (!r) throw new Error('agent rows'); const b1 = await bad(); if (b1.length) throw new Error('found ' + b1.join(','));
    return `agent cards ${a}, rows ${r}`;
  });
  await step('no station names anywhere on the user end (sampled pages and roles)', async () => {
    const hits = [];
    for (const [user, side, pages] of [['U22-VIP', 'buyer', ['home', 'mine', 'settings', 'guilds', 'discover', 'wallet', 'promotion']], ['U22-GAME', 'provider', ['mine', 'earnings', 'services']], ['U-MCN-DEMO', 'buyer', ['mcn', 'mcnIncome', 'mcnTeam', 'mcnCases']], ['U-AGENT-AG-01', 'buyer', ['agent', 'agentTeam', 'agentProfile']]]) {
      await login(user); await p.evaluate(s => { if (s === 'provider') FE.side = 'provider'; }, side);
      for (const pg of pages) { await go(pg); await p.waitForTimeout(120); const b1 = await bad(); if (b1.length) hits.push(pg + ':' + b1.join('/')); if (await p.locator('#feRoot .v23-site').count()) hits.push(pg + ':header station badge'); }
    }
    if (hits.length) throw new Error(hits.join('; ')); return 'clean';
  });
  await step('register: no station field; new account joins the current station', async () => {
    await p.evaluate(() => { FE_AUTH.signedIn = false; FE.user = ''; feAuthSave(); }); await go('register'); await p.waitForTimeout(200);
    if (await p.locator('#feMain select[name="station"]').count()) throw new Error('station select shown');
    const f = 'form[data-fe-form="authRegister"]'; await p.fill(f + ' [name="nickname"]', '无分站新用户'); await p.fill(f + ' [name="account"]', 'no_station_user');
    for (const box of await p.locator(f + ' input[type="checkbox"][required]').all()) await box.check();
    await p.locator(f + ' button[type="submit"]').click(); await p.waitForTimeout(300);
    const st = await p.evaluate(() => getBy('users', FE.user)?.stationId); if (st !== 'ST-001') throw new Error('station ' + st); return st;
  });
  if (mode === 'h5') await step('H5: back-office style tables on the user end become stacked cards', async () => {
    await login('U-MCN-DEMO'); await go('mcnIncome'); await p.waitForTimeout(200); const n = await p.locator('#feMain table').count(), s = await p.locator('#feMain table.uc-stack').count();
    if (n !== s) throw new Error(`${s}/${n} stacked`); await shot('mcnIncome'); return `${s}/${n} tables stacked`;
  });
  console.log('page errors:', errs.length ? errs : 'none');
  await b.close(); process.exit(failed || errs.length ? 1 : 0);
})();
