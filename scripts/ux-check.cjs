/* Real-click UX check for the commercial-grade user end (needs local Chrome + playwright-core).
   Usage: NODE_PATH=<dir with playwright-core> node scripts/ux-check.cjs http://127.0.0.1:8000/ pc|h5 [shotDir] */
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
  const main = () => p.locator('#feMain');
  const shot = async name => { if (!shotDir) return; fs.mkdirSync(shotDir, { recursive: true }); if (mode === 'h5') { const h = await p.evaluate(() => { const m = document.querySelector('#feMain'); const st = document.createElement('style'); st.id = 'ux-shot'; st.textContent = `#feMain{overflow:visible!important;height:${m.scrollHeight}px!important;max-height:none!important}`; document.head.appendChild(st); const ph = m.closest('.fe-phone'); if (ph) { ph.style.height = 'auto'; ph.style.maxHeight = 'none'; } return m.scrollHeight + 200; }); await p.setViewportSize({ width: 390, height: Math.min(9000, h) }); await p.waitForTimeout(150); await p.screenshot({ path: `${shotDir}/${name}.jpg`, type: 'jpeg', quality: 80, fullPage: true }); await p.evaluate(() => { document.getElementById('ux-shot')?.remove(); const ph = document.querySelector('#feMain').closest('.fe-phone'); if (ph) { ph.style.height = ''; ph.style.maxHeight = ''; } }); await p.setViewportSize({ width: 390, height: 844 }); } else await p.screenshot({ path: `${shotDir}/${name}.jpg`, type: 'jpeg', quality: 80, fullPage: true }); };
  await step('help center: search “退款” filters questions; category “支付与钱包”; question expands', async () => {
    await login('U22-VIP'); await go('help'); await p.waitForTimeout(150); await shot('help');
    await p.fill('[data-ux-help-search]', '退款'); await p.waitForTimeout(100);
    const vis = await p.locator('.ux-faq:not([hidden])').count(), all = await p.locator('.ux-faq').count();
    if (!(vis > 0 && vis < all)) throw new Error(`search visible ${vis}/${all}`);
    await p.fill('[data-ux-help-search]', ''); await p.locator('[data-ux-cat="wallet"]').click(); await p.waitForTimeout(100);
    const cats = await p.evaluate(() => [...document.querySelectorAll('.ux-faq:not([hidden])')].map(d => d.dataset.cat));
    if (!cats.length || cats.some(c => c !== 'wallet')) throw new Error('category filter ' + cats.join(','));
    const q = p.locator('.ux-faq:not([hidden]) > summary').first(); await q.click(); await p.waitForTimeout(80);
    if (!(await p.locator('.ux-faq[open]').count())) throw new Error('faq did not open');
    return `${vis}/${all} matched; wallet ${cats.length}`;
  });
  let ticket = '';
  await step('联系客服: submit a ticket from the help center → listed as 待处理', async () => {
    await p.locator('#feMain [data-id="support|"]').first().click(); await p.waitForTimeout(200);
    if ((await p.evaluate(() => FE.page)) !== 'support') throw new Error('not on support page');
    await p.selectOption('form[data-fe-form="uxTicket"] select[name="category"]', '支付与钱包');
    await p.fill('form[data-fe-form="uxTicket"] textarea[name="content"]', '充值已到账但想确认能否提现充值本金');
    await p.locator('form[data-fe-form="uxTicket"] button[type="submit"]').click(); await p.waitForTimeout(250);
    ticket = await p.evaluate(() => db.uxTickets[0]?.id || '');
    const t = await main().innerText(); if (!ticket || !/待处理/.test(t)) throw new Error('ticket not listed'); await shot('support'); return ticket;
  });
  await step('back office: 客服工单 (sidebar) → reply “已解决” → status updated', async () => {
    await p.click('#feModebar [data-fe="mode"][data-id="admin"]'); await p.waitForTimeout(300);
    if (await p.$('#content input[name="backendPassword"]')) { await p.fill('#content input[name="backendPassword"]', 'DEMO_admin_2026'); await p.check('#content input[name="demoOnly"]'); await p.locator('#content button[type="submit"]').first().click(); await p.waitForTimeout(400); }
    const link = p.locator('aside, nav, #sidebar').locator('text=客服工单').first();
    if (await link.count()) await link.click(); else await p.evaluate(() => { route = 'supportTickets'; render(); });
    await p.waitForTimeout(300);
    const f = `#content form[data-ux-form="staffReply"][data-id="${ticket}"]`;
    await p.fill(f + ' textarea[name="text"]', '充值本金默认只能消费，分红与退款可以提现'); await p.selectOption(f + ' select[name="status"]', '已解决');
    await p.locator(f + ' button[type="submit"]').click(); await p.waitForTimeout(250);
    const s = await p.evaluate(id => db.uxTickets.find(t => t.id === id).status, ticket); if (s !== '已解决') throw new Error(s);
    return (await link.count()) ? 'via sidebar' : 'via route';
  });
  await step('user sees the reply in 我的工单', async () => {
    await p.click(`#feModebar [data-fe="mode"][data-id="${mode}"]`); await p.waitForTimeout(300); await login('U22-VIP'); await go('support'); await p.waitForTimeout(150);
    const t = await p.locator('.ux-ticket').first().innerText(); if (!/充值本金默认只能消费/.test(t) || !/已解决/.test(t)) throw new Error('reply not shown'); return 'ok';
  });
  await step('settings hub: notification switch toggles and persists', async () => {
    await go('settings'); await p.waitForTimeout(150); await shot('settings');
    const sw = p.locator('.ux-switch[data-id="promo"]'); const before = await sw.getAttribute('aria-checked');
    await sw.click(); await p.waitForTimeout(150);
    const after = await p.locator('.ux-switch[data-id="promo"]').getAttribute('aria-checked'); const saved = await p.evaluate(() => db.uxPrefs['U22-VIP']?.promo);
    if (before === after || String(saved) !== after) throw new Error(`${before} → ${after}, saved ${saved}`); return `${before} → ${after}`;
  });
  await step('register: 《用户协议》 opens as an overlay without leaving the form; demo note collapsed', async () => {
    await p.evaluate(() => { FE_AUTH.signedIn = false; FE.user = ''; feAuthSave(); }); await go('register'); await p.waitForTimeout(150);
    await p.fill('form[data-fe-form="authRegister"] input[name="nickname"]', '协议测试'); await p.locator('[data-ux-legal="agreement"]').first().click(); await p.waitForTimeout(120);
    const n = await p.locator('.ux-legal-overlay .ux-legal section').count(); if (n < 6) throw new Error('overlay sections ' + n);
    await p.locator('[data-ux-legal-close]').click(); await p.waitForTimeout(80);
    const kept = await p.inputValue('form[data-fe-form="authRegister"] input[name="nickname"]'); if (kept !== '协议测试') throw new Error('form input lost');
    if (!(await p.locator('#feMain details.ux-demo').count())) throw new Error('demo note not collapsed'); await shot('register'); return n + ' sections';
  });
  await step('order detail (provider): order content first, one share summary, reviews at the end', async () => {
    const id = await p.evaluate(() => { const fd = o => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; }; FE.user = 'U22-VIP'; FE_AUTH.signedIn = true; FE.side = 'buyer'; const r = v22Persist(() => wpCommand('rechargeCreate', '', { amount: 3000, network: 'TRC20' })); v22Persist(() => wpCommand('rechargeResult', r, { result: '成功' })); const pr = feProducts('SP22-GAME').find(x => x.period === '按天'); feSubmit('booking', pr.id, fd({ confirm: 'on', geoScope: 'any', start: pd8AddDays(TODAY, 1), time: '18:00', scTerm: '7', scCycle: '3' })); const d = db.feDrafts.find(x => x.user === 'U22-VIP' && x.status === '待支付'); v22Persist(() => wpCommand('pay', d.id)); save(); return db.feDrafts.find(x => x.id === d.id).order; });
    await login('U22-GAME'); await p.evaluate(() => { FE.side = 'provider'; }); await go('order', id); await p.waitForTimeout(200); await shot('order');
    const t = await main().innerText(); if (/本账单我的分成/.test(t)) throw new Error('per-bill share cards still shown');
    if ((await p.locator('#feMain .ux-share').count()) !== 1) throw new Error('share summary missing');
    const order = await p.evaluate(() => { const m = document.querySelector('#feMain'); const r = m.querySelector('.ux-order-reviews'), s = [...m.querySelectorAll('h3')].find(h => /周期结算服务/.test(h.textContent)); return !!r && !!s && (s.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING) > 0; });
    if (!order) throw new Error('reviews not after order content'); return id;
  });
  await step('discover: card price shows USDT', async () => { await login('U22-VIP'); await go('discover'); await p.waitForTimeout(150); const l = await p.locator('.v23-price small').first().innerText(); if (l.trim() !== 'USDT') throw new Error('label ' + l); await shot('discover'); return l; });
  await step('booking: rules shown as a checklist; no D labels', async () => { await go('booking', await p.evaluate(() => feProducts('SP22-GAME').find(x => x.period === '按天').id)); await p.waitForTimeout(150); const t = await main().innerText(); if (/\bD \d|D 为/.test(t)) throw new Error('D label'); if (!(await p.locator('#feMain .fe-rule-list li').count())) throw new Error('no rule list'); await shot('booking'); return 'ok'; });
  console.log('page errors:', errs.length ? errs : 'none');
  await b.close(); process.exit(failed || errs.length ? 1 : 0);
})();
