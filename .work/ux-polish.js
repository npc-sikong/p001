/* ---------- UX polish (commercial-grade user end): help center, customer service, settings hub, legal pages, compact text, order layout; back-office lists newest first ---------- */
const UX={cat:'all',q:''};

/* Back-office tables: show newest records first so new submissions are on page 1. */
{const UX_TIME_KEYS=['createdAt','created','submittedAt','registeredAt','joined','joinedAt','at'];const uxTableBase=table;
 table=function(r,key,columns,options={}){const rows=options.rows||db[key]||[];if(options.keepOrder||rows.length<2)return uxTableBase(r,key,columns,options);
  const k=UX_TIME_KEYS.find(k=>rows.filter(x=>x&&x[k]).length>=rows.length*0.8);if(!k)return uxTableBase(r,key,columns,options);
  const sorted=rows.map((x,i)=>[x,i]).sort((a,b)=>String(b[0][k]||'').localeCompare(String(a[0][k]||''))||a[1]-b[1]).map(x=>x[0]);
  return uxTableBase(r,key,columns,{...options,rows:sorted});};}

/* ---------- Customer service tickets ---------- */
const UX_TICKET_CATS=['订单与服务','支付与钱包','账号与安全','投诉与建议','其他问题'];
function uxDB(){if(!db)return null;db.uxTickets||=[];db.uxPrefs||={};return db;}
function uxTickets(user){return uxDB().uxTickets.filter(t=>!user||t.user===user);}
function uxCommand(action,id,data={},backend=false){uxDB();const now=nowLabel();
 if(!backend){const u=feAuthUser();demand(u,'请先登录');
  if(action==='ticketCreate'){const cat=String(data.category||'');demand(UX_TICKET_CATS.includes(cat),'请选择问题类型');const text=String(data.content||'').trim();demand(text.length>=10&&text.length<=500,'请描述问题（10—500 字）');const order=String(data.order||'');if(order)demand(db.orders.some(o=>o.id===order&&(o.buyer===u.id||getBy('providers',o.provider)?.uid===u.id)),'只能关联本人的订单');demand(uxTickets(u.id).filter(t=>!['已解决','已关闭'].includes(t.status)).length<3,'你有 3 个处理中的工单，请等待回复后再提交');
   const t={id:uid('TK'),user:u.id,stationId:u.stationId,category:cat,order,content:text,status:'待处理',createdAt:now,updatedAt:now,handler:'',messages:[{by:'user',name:userName(u.id),text,at:now}]};db.uxTickets.unshift(t);return t.id;}
  const t=db.uxTickets.find(x=>x.id===id&&x.user===u.id);demand(t,'工单不存在');
  if(action==='ticketReply'){demand(!['已关闭'].includes(t.status),'工单已关闭');const text=String(data.text||'').trim();demand(text.length>=2&&text.length<=500,'请填写补充说明（2—500 字）');t.messages.push({by:'user',name:userName(u.id),text,at:now});if(t.status==='已解决')t.status='处理中';t.updatedAt=now;return t.id;}
  if(action==='ticketClose'){demand(t.status!=='已关闭','工单已关闭');t.status='已关闭';t.updatedAt=now;t.messages.push({by:'system',name:'系统',text:'用户已结束工单',at:now});return t.id;}
  demand(false,'未知操作');}
 const a=admin19Require(true);demand(FE.mode==='admin'||ADMIN19.backendDepth>0,'请在运营后台处理管理动作');demand(a.role==='admin','站长只读本站工单；回复由总站客服处理');
 const t=db.uxTickets.find(x=>x.id===id);demand(t,'工单不存在');demand(t.status!=='已关闭','用户已结束该工单');
 if(action==='staffReply'){const text=String(data.text||'').trim();demand(text.length>=4&&text.length<=800,'请填写回复内容（至少 4 字）');const status=String(data.status||'处理中');demand(['处理中','已解决'].includes(status),'状态无效');
  t.messages.push({by:'staff',name:'平台客服 · '+a.subject,text,at:now});t.status=status;t.handler=a.subject;t.updatedAt=now;v22Notify(t.user,t.stationId,`客服已回复你的工单（${t.category}）`,'ticket|'+t.id);audit('客服工单 · 回复',t.id,status);return t.id;}
 demand(false,'未知操作');}

/* ---------- Help center ---------- */
const UX_CATS=[['account','账号与会员','user'],['order','预约与订单','calendar'],['wallet','支付与钱包','wallet'],['after','售后与安全','shield'],['guild','公会与推广','users'],['provider','成为服务者','star']];
function uxFaq(){const s=mcnDB?.().settings||{},lv=(mcnDB?.().levels||[]).find(l=>l.status==='启用')||{pct:1},th=money(s.rechargeThreshold||100).replace(/\.00$/,'');
 return [
 ['account','如何注册和登录？','在“我的”点击登录或注册，选择所在分站并填写昵称即可。原型使用演示账号，无需密码。',['去注册','register'],()=>!feAuthUser()],
 ['account','VIP 会员有什么用？','有效 VIP 可以发帖、咨询、关注、立即找人和加入组队房；普通用户可以浏览、试听并直接预约服务。',['了解会员','vip']],
 ['account','怎么修改资料和界面语言？','在“我的 → 编辑资料”修改昵称、性别等；在“设置”里切换中文或英文。',['打开设置','settings']],
 ['order','怎么预约服务？','在服务者主页点“选择时间并预约”，选好服务期、结算周期和开始时间，确认后付款。',['去找服务者','discover']],
 ['order','服务期和结算周期是什么意思？','服务期是购买的总时长（如 7 天），下单时一次付清；结算周期是平台多久给服务者结算一次（如每 3 天）。'],
 ['order','开始前可以取消吗？','首次服务开始前（默认提前 2 小时）可以取消，费用全额退回钱包。服务开始后，合作正常不能无故取消。',['我的订单','orders']],
 ['order','服务不满意怎么办？','在订单详情点“申请中止”，选择原因并可上传图片。处理后，尚未结算的费用退回你的钱包。',['我的订单','orders']],
 ['wallet','怎么充值？','在“我的 → 钱包”点“充值”，选择金额和网络（TRC20 / ERC20），到账后即可用余额支付。',['去充值','walletRecharge']],
 ['wallet','余额可以提现吗？','推广分红和订单退款进入“可提现余额”，可以申请提现；充值本金默认只能消费。提现审核后出款，到账显示“已到账”。',['我的钱包','wallet']],
 ['wallet','退款会退到哪里？','所有订单退款都退回你的余额钱包，按你实际支付的金额计算。'],
 ['after','中止申请谁来处理？多久有结果？','默认由平台客服处理，每个环节 24 小时内给出结果；对结果不满意，可在 24 小时内申诉，平台复核为最终结果。'],
 ['after','遇到骚扰或不当行为怎么办？','在对方主页或会话里点“举报”或“拉黑”。拉黑后，双方不能再发起咨询、匹配或房间互动。'],
 ['after','我的资料和聊天记录安全吗？','聊天内容只有双方可见；平台只在处理举报时由授权人员查看相关记录，不公开你的联系方式。',['隐私政策','privacy']],
 ['guild','什么是有效推广？分红怎么算？',`好友用你的邀请码注册，累计充值满 ${th} 即为有效推广；好友用余额消费并确认完成后，你按等级获得 ${lv.pct}% 起的分红，每天 00:00 入账钱包。`,['会员推广','promotion']],
 ['guild','怎么加入或创建公会？','在“公会广场”申请加入，或在“公会中心”创建公会；签约后，成员订单按约定比例给公会分成。',['公会广场','guilds']],
 ['provider','怎么成为服务者？','在“我的 → 申请成为服务者”填写擅长的服务和服务地区，审核通过后即可上架服务、开放档期接单。',['去申请','apply'],()=>!feProvider()],
 ['provider','服务收益怎么结算？','每个结算周期结束后次日 00:00 自动结算到你的收益，可在“收益与提现”申请提现。',['收益与提现','earnings'],()=>!!feProvider()]
 ];}
{const uxHelpBase=FE_PAGES.help;FE_PAGES.help=function(...args){const legacy=uxHelpBase(...args),u=feAuthUser(),open=u?uxTickets(u.id).filter(t=>!['已解决','已关闭'].includes(t.status)).length:0;
 const items=uxFaq().map(([cat,q,a,act,cond])=>{const showAct=act&&(!cond||cond());return `<details class="ux-faq" data-cat="${cat}" data-text="${e((q+a).toLowerCase())}"><summary>${e(q)}</summary><div class="ux-faq-a"><p>${e(a)}</p>${showAct?feGoBtn(e(act[0])+' '+v23I('right'),act[1],'','small soft'):''}</div></details>`;}).join('');
 return `<section class="ux-help-hero"><h1>帮助中心</h1><p>常见问题、规则说明与在线客服</p><label class="ux-search">${v23I('search')}<input type="search" data-ux-help-search placeholder="搜索问题，例如：退款、提现、取消" aria-label="搜索帮助"></label></section>
 <div class="ux-cats" role="tablist" aria-label="问题分类"><button type="button" class="ux-cat on" data-ux-cat="all">${v23I('grid')}<span>全部</span></button>${UX_CATS.map(([k,l,i])=>`<button type="button" class="ux-cat" data-ux-cat="${k}">${v23I(i)}<span>${e(l)}</span></button>`).join('')}</div>
 <section class="ux-faqs">${items}<p class="ux-faq-empty" hidden>没有找到相关问题，可以换个关键词，或直接联系客服。</p></section>
 <section class="ux-contact"><span class="ux-contact-ico">${v23I('headset')}</span><div><b>没有找到答案？</b><p>客服会在 24 小时内回复${open?`，你有 ${open} 个工单正在处理`:''}</p></div>${feGoBtn('联系客服','support','','primary')}</section>
 <details class="ux-legacy"><summary>${v23I('doc')}完整规则与原型演示说明</summary><div class="ux-legacy-body">${legacy}</div></details>`;};}

/* ---------- Support page ---------- */
FE_PAGES.support=function(){const u=feAuthUser();if(!u)return v23Empty('请先登录','登录后可以提交和查看客服工单',feGoBtn('去登录','login','','primary'));uxDB();
 const mine=uxTickets(u.id),orders=db.orders.filter(o=>o.buyer===u.id||getBy('providers',o.provider)?.uid===u.id).slice(0,20);
 const statusCls=s=>s==='待处理'?'amber':s==='处理中'?'blue':s==='已解决'?'green':'';
 const list=mine.length?mine.map(t=>{const fresh=t.messages.at(-1)?.by==='staff';return `<details class="ux-ticket" ${fresh||t.status==='处理中'?'open':''}><summary><span class="fe-pill ${statusCls(t.status)}">${e(t.status)}</span><b>${e(t.category)}</b>${fresh?'<span class="ux-new">新回复</span>':''}<small>${e(t.createdAt)}${t.order?' · '+e(t.order):''}</small></summary><div class="ux-thread">${t.messages.map(m=>`<div class="ux-msg ux-msg-${m.by}"><small>${e(m.name)} · ${e(m.at)}</small><p data-fe-user-content>${e(m.text)}</p></div>`).join('')}</div>${t.status==='已关闭'?'':`<form class="ux-reply" data-fe-form="uxTicketReply" data-id="${e(t.id)}"><input name="text" maxlength="500" placeholder="补充说明…" required>${'<button class="fe-btn small primary" type="submit">发送</button>'}</form><div class="ux-ticket-actions">${feBtn('结束工单','uxTicketClose',t.id,'small text')}</div>`}</details>`;}).join(''):`<p class="fe-small">还没有工单。</p>`;
 return v23Head('联系客服','描述你遇到的问题，客服会在 24 小时内回复')+`<div class="v23-two"><section class="v23-panel"><h3>${v23I('headset')}提交问题</h3><form data-fe-form="uxTicket">${feField('category','问题类型',UX_TICKET_CATS[0],'select',UX_TICKET_CATS.map(c=>[c,c]))}${feField('order','关联订单（可选）','','select',[['','不关联订单']].concat(orders.map(o=>[o.id,o.id+' · '+(getBy('products',o.product)?.name||'服务订单')])))}<label class="fe-field"><span>问题描述</span><textarea name="content" minlength="10" maxlength="500" required placeholder="请写清楚发生了什么、希望怎么处理（10—500 字）"></textarea></label><div class="fe-error" role="alert">${e(FE.error||'')}</div><button class="fe-btn primary" type="submit">提交工单</button></form></section><aside class="v23-panel"><h3>${v23I('order')}我的工单 · ${mine.length}</h3>${list}</aside></div>`;};

/* ---------- Settings hub ---------- */
const UX_PREFS=[['orders','订单与售后通知','付款、预约、结算与中止处理结果'],['social','互动通知','咨询回复、关注上线与房间邀请'],['promo','活动与推荐','平台活动与服务者推荐']];
function uxPref(u,k){const p=uxDB().uxPrefs[u]||{};return k in p?p[k]:k!=='promo';}
function uxRow(icon,label,sub,right){return `<div class="ux-row">${v23I(icon)}<span><b>${e(label)}</b>${sub?`<small>${e(sub)}</small>`:''}</span>${right}</div>`;}
function uxLink(icon,label,sub,page){return `<button type="button" class="ux-row ux-row-link" data-fe="go" data-id="${e(page)}|">${v23I(icon)}<span><b>${e(label)}</b>${sub?`<small>${e(sub)}</small>`:''}</span>${v23I('right','ux-row-go')}</button>`;}
{const uxSettingsBase=FE_PAGES.settings;FE_PAGES.settings=function(...args){const base=uxSettingsBase(...args),u=feAuthUser();
 const account=u?`<section class="ux-set-card ux-set-me">${feAvatar(u.id)}<span><b>${e(userName(u.id))}</b><small>ID ${e(u.id)}</small></span>${feBtn(v23I('edit')+'编辑资料','profile','','small')}</section>
  <section class="ux-set-card"><h3>账号与安全</h3>${uxRow('user','登录账号',(u.account||u.id)+' · 演示账号登录','')}${uxLink('crown','会员状态',vipValid(u)?'月度 VIP · '+u.vipEnd+' 到期':'普通用户','vip')}${uxRow('logout','退出登录','退出后需重新选择演示账号',feBtn('退出','authLogout','','small'))}</section>
  <section class="ux-set-card"><h3>消息通知</h3>${UX_PREFS.map(([k,l,s])=>uxRow('bell',l,s,`<button type="button" class="ux-switch ${uxPref(u.id,k)?'on':''}" data-fe="uxPref" data-id="${k}" role="switch" aria-checked="${uxPref(u.id,k)}" aria-label="${e(l)}"><i></i></button>`)).join('')}</section>
  <section class="ux-set-card"><h3>隐私与互动</h3>${uxLink('shield','关注与拉黑管理','管理关注的服务者和已拉黑的账号','v22Following')}${uxLink('star','我的评价','我给出的和收到的评价','rvReviews')}</section>`:`<section class="ux-set-card ux-set-me">${v23I('user')}<span><b>未登录</b><small>登录后可管理资料、通知与隐私</small></span>${feGoBtn('登录 / 注册','login','','small primary')}</section>`;
 const help=`<section class="ux-set-card"><h3>帮助与协议</h3>${uxLink('help','帮助中心','常见问题与规则说明','help')}${u?uxLink('headset','联系客服','提交问题，24 小时内回复','support'):''}${uxLink('doc','用户协议','','agreement')}${uxLink('shield','隐私政策','','privacy')}${uxRow('spark','关于伴屿','版本 V23 · 交互原型','')}</section>`;
 return v23Head('设置','账号、通知、隐私与语言')+`<div class="ux-settings">${account}${help}</div><section class="ux-set-lang">${base.replace('设置与界面语言','界面语言')}</section>`;};}

/* ---------- Legal pages (template text pending legal review) ---------- */
const UX_LEGAL={agreement:['用户协议',[
 ['服务说明',['伴屿为用户与服务者提供信息展示、预约、支付托管与售后保障。','服务者为独立个人，按商品页约定的内容和时段提供服务。']],
 ['账号',['须年满 18 周岁；一人一个账号，不得出借或转让。','账号下的操作视为本人行为，请妥善保管登录方式。']],
 ['预约与支付',['首期以 USDT 计价；下单时一次付清整个服务期，平台按结算周期向服务者结算。','余额充值本金默认仅用于消费，分红与退款可申请提现。']],
 ['取消、中止与退款',['服务开始前可取消，全额退回钱包；开始后合作正常不能无故取消。','服务不达标可申请中止，尚未结算的费用按处理结果退回钱包。']],
 ['行为规范',['禁止违法内容、骚扰、诱导站外交易或私下转账。','违规账号可能被限制功能或封禁，处罚可申诉。']],
 ['推广与公会',['推广分红按平台公布的规则计算，只计直推关系；公会分成按签约比例从服务者收益中提取。']],
 ['争议处理',['售后申请默认由平台处理，处理结果可在 24 小时内申诉，平台复核为最终结果。']],
 ['协议变更',['协议更新会提前通知；继续使用即视为同意更新后的协议。']]]],
 privacy:['隐私政策',[
 ['我们收集的信息',['注册资料：昵称、所在分站、选填的性别；交易记录：订单、支付、退款与结算。','服务者另需提交入驻与技能材料。']],
 ['使用目的',['用于账号管理、预约匹配、支付结算、售后处理与安全风控。']],
 ['共享与披露',['仅向订单对方展示完成服务所需的信息；不出售个人信息。','法律要求或处理举报时，由授权人员按最小范围查阅。']],
 ['存储与安全',['正式版数据存储在加密的服务器中；本原型的数据只保存在当前浏览器。']],
 ['你的权利',['可以查询、更正个人资料，关闭通知，或申请注销账号。']],
 ['未成年人',['本服务不面向未满 18 周岁的用户。']],
 ['联系我们',['通过“帮助中心 → 联系客服”提交问题，我们会在 24 小时内回复。']]]]};
function uxLegalBody(k){const [title,secs]=UX_LEGAL[k];return `<div class="ux-legal"><p class="ux-legal-tag">${v23I('doc')}示例文本 · 正式上线前须经法务审定 · 更新于 2026-10</p>${secs.map(([h,ps],i)=>`<section><h3><em>${i+1}</em>${e(h)}</h3><ul>${ps.map(p=>`<li>${e(p)}</li>`).join('')}</ul></section>`).join('')}</div>`;}
FE_PAGES.agreement=()=>v23Head('用户协议','使用伴屿前请阅读')+uxLegalBody('agreement');
FE_PAGES.privacy=()=>v23Head('隐私政策','我们如何收集、使用和保护你的信息')+uxLegalBody('privacy');
Object.assign(V23_PAGES,{help:['帮助中心',V23_PAGES.help?.[1]||'mine'],support:['联系客服','help'],agreement:['用户协议','settings'],privacy:['隐私政策','settings']});
for(const k of ['agreement','privacy'])FE_AUTH_PUBLIC.add(k);
{const uxRegisterBase=FE_PAGES.register;FE_PAGES.register=function(...args){return uxRegisterBase(...args).replace('<span>我已阅读并同意上述演示服务说明与隐私说明</span>','<span>我已阅读并同意<button type="button" class="ux-legal-link" data-ux-legal="agreement">《用户协议》</button>和<button type="button" class="ux-legal-link" data-ux-legal="privacy">《隐私政策》</button></span>');};}
{const uxLoginBase=FE_PAGES.login;FE_PAGES.login=function(...args){return uxLoginBase(...args)+`<p class="ux-legal-line">登录即表示同意<button type="button" class="ux-legal-link" data-ux-legal="agreement">《用户协议》</button>和<button type="button" class="ux-legal-link" data-ux-legal="privacy">《隐私政策》</button></p>`;};}

/* ---------- Order detail: main content first; one share summary instead of one card per bill ---------- */
let UX_SHARE=null;
{const uxShareBase=ops12ShareCard;ops12ShareCard=function(b){if(!UX_SHARE)return uxShareBase(b);const x=ops12OwnShare(b);if(!x)return '';UX_SHARE.push({b,x});return '<!--ux-share-->';};}
function uxShareSummary(list){const x=list[0].x,sum=k=>sumMoney(list.map(i=>i.x),k),same=list.every(i=>i.x.pct===x.pct&&i.x.version===x.version);
 return `<section class="fe-panel ux-share"><h3>我的分成${same?' · '+e(x.pct)+'%':''}</h3><p class="fe-small">${same?`${e(x.source)} · ${e(x.version)} · 成交快照${list.length>1?'（各期相同）':''}`:'各账单按成交时的比例快照计算'}</p><div class="ux-kpis">${[[money(sum('estimate')),'整期预计应得'],[money(sum('net')),'已确认净应得'],[money(sum('adjustment')),'退款冲减']].map(([v,l])=>`<div><small>${l}</small><b>${v}</b></div>`).join('')}</div>${list.length>1?`<details class="ux-more"><summary>按账单查看 · ${list.length} 期</summary><div class="ux-table-wrap"><table class="ux-table"><thead><tr><th>账单</th>${same?'':'<th>比例</th>'}<th>实付</th><th>已确认</th><th>预计应得</th><th>可提现</th></tr></thead><tbody>${list.map(({b,x})=>`<tr><td>${e(b.periodNo?('第 '+b.periodNo+' 期'):b.id)}</td>${same?'':`<td>${e(x.pct)}%</td>`}<td>${money(b.paid)}</td><td>${money(b.confirmed)}</td><td>${money(x.estimate)}</td><td>${money(balance(b))}</td></tr>`).join('')}</tbody></table></div></details>`:''}<p class="fe-small">未履约部分不开放提现；原比例用于后续核定和退款。</p></section>`;}
{const uxOrderBase=FE_PAGES.order;FE_PAGES.order=function(...args){UX_SHARE=[];let html;try{html=uxOrderBase(...args);}finally{var shares=UX_SHARE;UX_SHARE=null;}
 if(shares.length){let first=true;html=html.replace(/<!--ux-share-->/g,()=>{if(!first)return '';first=false;return uxShareSummary(shares);});}
 let o=null,panel='';try{o=feOwnOrder(FE.id);panel=o?rvOrderPanel(o):'';}catch{}
 if(panel&&html.startsWith(panel))html=html.slice(panel.length)+`<div class="ux-order-reviews">${panel}</div>`;
 return html;};}

{const uxEarningsBase=FE_PAGES.earnings;FE_PAGES.earnings=function(...args){UX_SHARE=[];let html;try{html=uxEarningsBase(...args);}finally{var shares=UX_SHARE;UX_SHARE=null;}
 if(shares.length){let first=true;html=html.replace(/<!--ux-share-->/g,()=>{if(!first)return '';first=false;return uxShareSummary(shares);});}return html;};}
{const UX_AGENT_NOTE='仅总站可变更关系；不显示服务者私人联系方式、实名材料或消费记录。';const uxAgentTeamBase=FE_PAGES.agentTeam;FE_PAGES.agentTeam=function(...args){const html=uxAgentTeamBase(...args);if(!html.includes(UX_AGENT_NOTE))return html;const body=html.split('<br>'+UX_AGENT_NOTE).join('');const i=body.indexOf('<section');return i<0?body:body.slice(0,i)+`<p class="ux-note">${v23I('shield')}服务者归属只能由总站变更；这里不显示服务者的私人联系方式、实名材料或消费记录。</p>`+body.slice(i);};}

/* ---------- Actions and forms ---------- */
{const uxActionBase=feAction;feAction=function(action,id='',target=null){
 if(action==='uxPref'){const u=feAuthUser();if(!u)return feNavigate('login');uxDB();const p=db.uxPrefs[u.id]||(db.uxPrefs[u.id]={});p[id]=!uxPref(u.id,id);save();FE.flash=p[id]?'已开启通知':'已关闭通知';return feRender();}
 if(action==='uxTicketClose'){try{v22Persist(()=>uxCommand('ticketClose',id));FE.flash='工单已结束';}catch(err){FE.flash='未完成：'+err.message;}return feRender();}
 return uxActionBase(action,id,target);};}
{const uxSubmitBase=feSubmit;feSubmit=function(type,id,fd){
 if(type==='uxTicket'){const out=v22Persist(()=>uxCommand('ticketCreate','',Object.fromEntries(fd)));FE.flash='工单已提交，客服会在 24 小时内回复';FE.error='';feNavigate('support');return out;}
 if(type==='uxTicketReply'){const out=v22Persist(()=>uxCommand('ticketReply',id,Object.fromEntries(fd)));FE.flash='已发送补充说明';FE.error='';feRender();return out;}
 return uxSubmitBase(type,id,fd);};}

/* ---------- Back office: customer service tickets ---------- */
function uxAdminTickets(){const a=admin19Require(),admin=a.role==='admin';uxDB();const own=db.stations.filter(s=>admin||s.ownerId===a.subject).map(s=>s.id),rows=db.uxTickets.filter(t=>admin||own.includes(t.stationId));
 const n=s=>rows.filter(t=>t.status===s).length;
 return pageHead('客服工单','用户在“帮助中心 → 联系客服”提交的问题；24 小时内回复，回复后用户收到通知。')+`<div class="mcn-surface" data-admin-no-translate>`+mcnStats([['待处理',n('待处理')],['处理中',n('处理中')],['已解决',n('已解决')],['已关闭',n('已关闭')]])
 +mcnPanel('工单列表',rows.length?rows.map(t=>`<details class="ux-admin-ticket" ${t.status==='待处理'?'open':''}><summary>${mcnTag(t.status,t.status==='待处理')}<b>${e(t.id)}</b><span>${e(userName(t.user))} · ${e(siteLabel(t.stationId))} · ${e(t.category)}${t.order?' · 订单 '+e(t.order):''}</span><small>${e(t.createdAt)}${t.handler?' · 处理人 '+e(t.handler):''}</small></summary><div class="ux-thread">${t.messages.map(m=>`<div class="ux-msg ux-msg-${m.by}"><small>${e(m.name)} · ${e(m.at)}</small><p>${e(m.text)}</p></div>`).join('')}</div>${admin&&t.status!=='已关闭'?`<form class="mcn-form" data-ux-form="staffReply" data-id="${e(t.id)}">${mcnField('text','回复内容','','textarea')}${mcnField('status','处理后状态','处理中','select',[['处理中','处理中（等待用户补充）'],['已解决','已解决']])}<div class="mcn-form-error" role="alert"></div><button class="btn primary" type="submit">发送回复</button></form>`:admin?'':'<p class="mcn-rule-note">站长只读；回复由总站客服处理。</p>'}</details>`).join(''):'<p>暂无工单。</p>')+'</div>';}
PAGE.supportTickets=uxAdminTickets;ROUTE_NAMES.supportTickets='客服工单';ROUTE_GROUP.supportTickets='service';
OPS11_NAV.find(g=>g[0]==='service')?.[3].push(['supportTickets','客服工单']);
if(typeof STATION_NAV!=='undefined'&&!STATION_NAV.some(x=>(Array.isArray(x)?x[0]:x)==='supportTickets'))STATION_NAV.splice(STATION_NAV.length-1,0,['supportTickets','本站客服工单']);
{const uxReadBase=canRead;canRead=function(r){if(r==='supportTickets'){const a=admin19Bound();return !!a&&(a.role==='admin'||isStationOwner());}return uxReadBase(r);};}
for(const key of ['pd8Work','opsInbox'])if(PAGE[key]){const prev=PAGE[key];PAGE[key]=()=>{const a=admin19Bound(),own=a&&a.role!=='admin'?db.stations.filter(s=>s.ownerId===a.subject).map(s=>s.id):null,open=(uxDB().uxTickets||[]).filter(t=>t.status==='待处理'&&(!own||own.includes(t.stationId))).length;return prev()+(open?mcnPanel('待处理客服工单',`<p>${open} 个工单等待回复（24 小时内）。</p>`+linkTo('supportTickets','进入客服工单')):'');};}
MCN_HELP.supportTickets={purpose:'处理用户在帮助中心提交的客服工单：查看问题与关联订单，回复并更新状态。',roles:'总站客服回复与更新状态；站长只读本站工单。',flow:'用户提交 → 待处理 → 客服回复（处理中 / 已解决）→ 用户收到通知，可补充说明或结束工单。',links:['orders','scCases','reports'],fields:{状态:'待处理、处理中、已解决、已关闭（用户结束）。',处理人:'最近一次回复的客服账号。',关联订单:'用户提交时选择的本人订单，可为空。'}};
MCN_HELP['front:support']=MCN_HELP['front:support']||{purpose:'提交问题并查看客服回复',roles:'登录用户',flow:'选择类型 → 描述问题 → 提交 → 等待回复',links:[],fields:{}};
document.addEventListener('submit',ev=>{const f=ev.target;if(!f.dataset?.uxForm)return;ev.preventDefault();if(!f.reportValidity())return;try{v22Persist(()=>uxCommand(f.dataset.uxForm,f.dataset.id||'',Object.fromEntries(new FormData(f)),true));toast('已回复并通知用户');render();}catch(err){const box=f.querySelector('.mcn-form-error');if(box)box.textContent=err.message;}});

/* ---------- Help search / category filter, legal overlay ---------- */
function uxFilterFaq(){const root=document.getElementById('feMain');if(!root)return;let shown=0;for(const d of root.querySelectorAll('.ux-faq')){const ok=(UX.cat==='all'||d.dataset.cat===UX.cat)&&(!UX.q||d.dataset.text.includes(UX.q));d.hidden=!ok;if(ok)shown++;if(UX.q&&ok)d.open=true;}const empty=root.querySelector('.ux-faq-empty');if(empty)empty.hidden=shown>0;for(const b of root.querySelectorAll('[data-ux-cat]'))b.classList.toggle('on',b.dataset.uxCat===UX.cat);}
document.addEventListener('input',ev=>{if(!ev.target.matches?.('[data-ux-help-search]'))return;UX.q=ev.target.value.trim().toLowerCase();uxFilterFaq();});
document.addEventListener('click',ev=>{const c=ev.target.closest?.('[data-ux-cat]');if(c){UX.cat=c.dataset.uxCat;uxFilterFaq();return;}
 const l=ev.target.closest?.('[data-ux-legal]');if(l){ev.preventDefault();ev.stopPropagation();const k=l.dataset.uxLegal,box=document.createElement('div');box.className='ux-legal-overlay';box.innerHTML=`<div class="ux-legal-sheet" role="dialog" aria-modal="true" aria-label="${e(UX_LEGAL[k][0])}"><header><b>${e(UX_LEGAL[k][0])}</b><button type="button" class="fe-btn small" data-ux-legal-close>关闭</button></header><div class="ux-legal-scroll">${uxLegalBody(k)}</div></div>`;(document.getElementById('feRoot')||document.body).appendChild(box);return;}
 if(ev.target.closest?.('[data-ux-legal-close]')||ev.target.classList?.contains('ux-legal-overlay')){ev.target.closest('.ux-legal-overlay')?.remove();}},true);

/* ---------- Compact long explanatory text after each user-end render ---------- */
const UX_DEMO_RE=/(离线交互原型|本地交互原型|本地模拟|只用于演示|仅用于演示|不连接任何认证服务|请勿输入真实|不接入真实|仅为演示|演示环境)/;
function uxLead(t){const m=t.match(/^(.{8,34}?)[。；;！!？?]/);return m?m[1]:t.slice(0,26);}
function uxCompact(){if(FE.mode==='admin')return;const main=document.getElementById('feMain');if(!main)return;
 for(const el of [...main.querySelectorAll('p,small,.fe-notice,.mcn-rule-note')]){
  if(!el.isConnected||el.closest('details,summary,.fe-error,[role="alert"],[role="status"],table,.v23-row,.v23-member,button,.fe-dialog,.ux-help-hero,.ux-faqs,.ux-contact,.ux-legal,.ux-settings,.fe-card,.v23-card,.v23-hero,.v23-page-head,.fe-footer,.v23-footer,label'))continue;
  if(el.querySelector('button,a,input,select,textarea,details'))continue;const t=el.textContent.replace(/\s+/g,' ').trim();if(t.length<24)continue;
  const dataLike=(t.match(/ · /g)||[]).length>=2||(t.match(/USDT\s?\d/g)||[]).length>=2;
  const demo=UX_DEMO_RE.test(t),long=t.length>=72&&!dataLike&&/[。；]/.test(t)&&el.matches('.mcn-rule-note,p.fe-small,.fe-notice');if(!demo&&!long)continue;
  const d=document.createElement('details');d.className=demo?'ux-demo':'ux-more';const s=document.createElement('summary');s.textContent=demo?'演示说明':uxLead(t)+'…';d.appendChild(s);el.parentNode.insertBefore(d,el);d.appendChild(el);}}
{const uxRenderBase=feRender;feRender=function(...args){const out=uxRenderBase(...args);try{uxCompact();if(FE.page==='help'){UX.q='';UX.cat='all';}}catch(err){console.warn('uxCompact',err);}return out;};}

Object.assign(FE_LOCALE_EN,{'帮助中心':'Help center','常见问题、规则说明与在线客服':'FAQ, rules and customer service','全部':'All','账号与会员':'Account & membership','预约与订单':'Booking & orders','支付与钱包':'Payments & wallet','售后与安全':'Aftercare & safety','公会与推广':'Guilds & referrals','成为服务者':'Become a provider','没有找到答案？':'Still need help?','联系客服':'Contact support','完整规则与原型演示说明':'Full rules and prototype notes','提交问题':'Submit a request','问题类型':'Category','关联订单（可选）':'Related order (optional)','问题描述':'Description','提交工单':'Submit','我的工单':'My requests','结束工单':'Close request','发送':'Send','设置':'Settings','账号、通知、隐私与语言':'Account, notifications, privacy and language','账号与安全':'Account & security','登录账号':'Sign-in account','会员状态':'Membership','退出登录':'Sign out','退出':'Sign out','消息通知':'Notifications','订单与售后通知':'Orders & aftercare','互动通知':'Interactions','活动与推荐':'Events & recommendations','隐私与互动':'Privacy & interactions','关注与拉黑管理':'Following & blocked','我的评价':'My reviews','帮助与协议':'Help & legal','用户协议':'Terms of service','隐私政策':'Privacy policy','关于伴屿':'About Banyu','演示说明':'Prototype note','我的分成':'My share','整期预计应得':'Expected for the term','已确认净应得':'Confirmed net','退款冲减':'Refund deductions','演示环境':'Demo environment'});
