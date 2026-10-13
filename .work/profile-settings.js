/* Profile service language follows IP country. UI language and provider skills stay independent. */
const PF_IP_ENDPOINT='https://api.country.is/';
const PF_IP={mode:'auto',status:'idle',country:'',checkedAt:0,request:0,controller:null};
const PF_IP_PREVIEWS=[['auto','自动识别当前 IP'],['CN','演示：中国大陆'],['HK','演示：中国香港'],['TW','演示：中国台湾'],['US','演示：美国'],['SG','演示：新加坡'],['JP','演示：日本'],['failure','演示：识别失败']];
const PF_COUNTRY_NAMES={CN:'中国大陆',HK:'中国香港',MO:'中国澳门',TW:'中国台湾',US:'美国',GB:'英国',SG:'新加坡',JP:'日本',TH:'泰国',VN:'越南',MY:'马来西亚',PH:'菲律宾',AU:'澳大利亚',CA:'加拿大'};
function pfCountryCode(value){const country=String(value||'').trim().toUpperCase();return /^[A-Z]{2}$/.test(country)&&!['XX','ZZ'].includes(country)?country:'';}
function pfLanguageFor(country,allowed,defaultCode='zh-CN'){
 const desired=country?(['CN','HK','MO','TW'].includes(country)?'zh-CN':'en-US'):'';
 const fallback=allowed.includes(defaultCode)?defaultCode:allowed[0]||'zh-CN';
 return {code:desired&&allowed.includes(desired)?desired:fallback,restricted:!!desired&&!allowed.includes(desired)};
}
function pfLanguageState(){
 // Read the published snapshot directly: the legacy locale getter also refreshes derived account data.
 // Resolving a form field must stay read-only, including before a validation error or quota rollback.
 const intl=db.international,live=intl.releases.find(r=>r.id===intl.activeRelease)?.payload||intl;
 const u=FE_AUTH.signedIn?db.users.find(x=>x.id===FE.user):null,config=i6Config(u?.stationId||'ST-001',live);
 const allowed=config.supported.filter(code=>['zh-CN','en-US'].includes(code)&&i6Lang(code,live)?.enabled);
 const country=PF_IP.status==='ready'?PF_IP.country:'',resolved=pfLanguageFor(country,allowed,config.default);
 const label=resolved.code==='en-US'?'英语':'简体中文',preview=PF_IP.mode!=='auto';
 let detail=PF_IP.status==='ready'?`IP 地区：${PF_COUNTRY_NAMES[country]||country}`:PF_IP.status==='error'?'暂未识别 IP 地区，使用分站默认语言':'正在识别 IP 地区，暂用分站默认语言';
 if(resolved.restricted)detail+='；该地区语言尚未开放，使用分站默认语言';
 if(preview)detail='演示预览 · '+detail;
 return {...resolved,label,country,detail,preview};
}
function pfSyncLanguage(){
 // Pending detection is presentation only, so rendering a failed profile save cannot mutate its rollback.
 if(FE.mode==='admin'||!['ready','error'].includes(PF_IP.status)||FE.error)return;
 const u=feAuthUser();if(!u)return;
 const s=pfLanguageState();
 // The preview only paints the field; it is not a real detection result for the account.
 if(s.preview)return;
 if(u.feServiceLanguage!==s.label||u.feServiceLanguageMode!=='ip'){
  u.feServiceLanguage=s.label;u.feServiceLanguageMode='ip';
  save();
 }
}
function pfLanguageContents(){const s=pfLanguageState();return `<span class="pf-language-label">服务语言</span><div class="pf-language-value">${v23I('globe')}<strong>${e(s.label)}</strong><span class="pf-auto">按 IP 自动切换</span></div><small role="status" aria-live="polite">${e(s.detail)}</small><input type="hidden" name="lang" value="${e(s.label)}">`;}
function pfLanguageField(){return `<div class="pf-language" data-pf-language>${pfLanguageContents()}</div>`;}
function pfPaintLanguage(){
 pfSyncLanguage();
 // Only update this field: an asynchronous lookup must not discard an unsaved nickname or avatar upload.
 document.querySelectorAll('[data-pf-language]').forEach(el=>{el.innerHTML=pfLanguageContents();});
 if(FE.mode!=='admin')feLocalePaint();
}
async function pfDetectIP(force=false){
 if(PF_IP.mode!=='auto'||typeof fetch!=='function')return;
 if(!force&&(PF_IP.status==='loading'||Date.now()-PF_IP.checkedAt<300000))return;
 PF_IP.controller?.abort();const controller=new AbortController(),request=++PF_IP.request;
 Object.assign(PF_IP,{controller,status:'loading',country:'',checkedAt:Date.now()});pfPaintLanguage();
 const timeout=setTimeout(()=>controller.abort(),8000);
 try{
  const response=await fetch(PF_IP_ENDPOINT,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'});
  if(!response.ok)throw new Error('IP country unavailable');
  const data=await response.json(),country=pfCountryCode(data.country);
  if(!country)throw new Error('No IP country');
  if(request===PF_IP.request&&PF_IP.mode==='auto')Object.assign(PF_IP,{status:'ready',country});
 }catch{
  if(request===PF_IP.request&&PF_IP.mode==='auto')Object.assign(PF_IP,{status:'error',country:''});
 }finally{
  clearTimeout(timeout);
  if(request===PF_IP.request){PF_IP.controller=null;pfPaintLanguage();}
 }
}
function pfPreviewIP(mode){
 demand(PF_IP_PREVIEWS.some(([value])=>value===mode),'请选择有效的 IP 地区预览');
 PF_IP.controller?.abort();++PF_IP.request;
 Object.assign(PF_IP,{mode,controller:null,country:pfCountryCode(mode),status:mode==='auto'?'idle':mode==='failure'?'error':'ready',checkedAt:0});
 pfPaintLanguage();if(mode==='auto')void pfDetectIP(true);
}
{const before=feRender;feRender=function(...args){pfSyncLanguage();return before(...args);};}
{const before=feSubmit;feSubmit=function(type,id,fd){
 if(type==='profile')fd.set('lang',pfLanguageState().label);
 return before(type,id,fd);
};}
{const before=feBoot;feBoot=function(...args){const out=before(...args);void pfDetectIP();return out;};}
window.addEventListener('online',()=>{void pfDetectIP(true);});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void pfDetectIP();});
document.addEventListener('change',event=>{if(event.target.matches?.('[data-pf-ip-preview]'))pfPreviewIP(event.target.value);});

/* One change log feeds the in-prototype explanation and the generated latest document. */
const PF_UPDATES=__PROTOTYPE_UPDATES__;
function pfUpdatesButton(){return '<button type="button" data-pf-updates>修改说明</button>';}
{const before=feModebar;feModebar=function(...args){const out=before(...args),tools=document.querySelector('#feModebar .v23-mb-tools');
 if(tools){tools.insertAdjacentHTML('beforeend',`${FE.mode==='admin'?'':`<label class="pf-ip-preview"><span>IP 地区预览</span><select data-pf-ip-preview aria-label="IP 地区预览（演示工具）">${PF_IP_PREVIEWS.map(([value,label])=>`<option value="${value}" ${PF_IP.mode===value?'selected':''}>${label}</option>`).join('')}</select></label>`}${pfUpdatesButton()}`);}
 return out;
};}
{const before=feDialogView;feDialogView=function(...args){let html=before(...args);if(FE.dialog?.type==='profile')html=html.replace('</h2>','</h2>'+pfUpdatesButton());return html;};}
function pfUpdatesBody(){return `<p class="pf-updated">当前原型 ${e(PF_UPDATES.version)} · 更新于 ${e(PF_UPDATES.entries[0].date)}</p>${PF_UPDATES.entries.map(entry=>`<article class="pf-update-entry"><small>${e(entry.date)}</small><h3>${e(entry.title)}</h3><ul>${entry.items.map(item=>`<li><span class="pf-change-kind">${e(item.kind)}</span>${e(item.text)}</li>`).join('')}</ul><div class="pf-update-docs">${entry.docs.map(doc=>`<a href="${e(doc.path)}" target="_blank" rel="noopener">${e(doc.title)} ↗</a>`).join('')}</div></article>`).join('')}<p class="pf-update-foot">每次修改同步更新本页、使用说明、相关模块规则与验收记录。版本号由项目负责人指定。</p><a href="docs/修改说明.md" target="_blank" rel="noopener">查看完整修改说明文档 ↗</a>`;}
function pfOpenUpdates(){
 document.getElementById('pf-updates-dialog')?.remove();const dialog=document.createElement('dialog');
 dialog.id='pf-updates-dialog';dialog.className='pf-updates-dialog';dialog.setAttribute('aria-labelledby','pf-updates-title');
 dialog.innerHTML=`<header><div><small>原型更新记录</small><h2 id="pf-updates-title">修改说明</h2></div><button type="button" data-pf-close aria-label="关闭修改说明">×</button></header><div class="pf-updates-body">${pfUpdatesBody()}</div>`;
 document.body.appendChild(dialog);dialog.querySelector('[data-pf-close]').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
}
document.addEventListener('click',event=>{if(event.target.closest?.('[data-pf-updates]')){event.preventDefault();pfOpenUpdates();}});
{const before=mcnHelpMeta;mcnHelpMeta=function(key){const meta=before(key);if(!/^front:(mine|settings|help)$/.test(key))return meta;
 return {...meta,fields:{...meta.fields,'头像选择':'默认头像直接以图片展示，不显示编号；支持筛选、分页、点击预览，也可上传图片，保存后生效。','服务语言':'根据访问 IP 所在国家/地区自动切换。中国大陆、香港、澳门、台湾使用简体中文，其他地区使用英语；仅采用本站已发布语言，识别失败使用分站默认语言。','修改说明':'预览工具栏及编辑资料弹窗可查看最新修改说明与对应文档；每次原型修改同步维护。'}};
};}
Object.assign(FE_LOCALE_EN,{'按 IP 自动切换':'Automatic by IP','IP 地区预览':'IP country preview','正在识别 IP 地区，暂用分站默认语言':'Detecting IP country; using station default for now','暂未识别 IP 地区，使用分站默认语言':'IP country unavailable; using station default','修改说明':'Changes','已选择默认头像，保存后生效':'Default avatar selected; save to apply','已选择原有头像，保存后生效':'Original avatar selected; save to apply'});
