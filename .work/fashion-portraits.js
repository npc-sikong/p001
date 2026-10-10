/* Generated adult fashion atlas. Presentation only; no profile or transaction data migration. */
const FASHION_SEEDED_PORTRAITS=Object.freeze({
 'U1001':0,'U1002':4,'U1003':1,'U1004':5,'U1005':2,'U1006':3,
 'U1007':12,'U1008':6,'U1009':8,'U1010':13,'U1011':14,'U1012':11,
 'U-PD8-ALT':12,'U-FE-GAME-A':7,'U-FE-GAME-B':3,
 'U-FE-CHAT-A':10,'U-FE-CHAT-B':6,'U-FE-STUDY-B':8,
 'U22-VIP':12,'U22-VIP2':1,'U22-BASIC':0,'U22-EXPIRED':15,
 'U22-GAME':14,'U22-CHAT':9,'U-MCN-DEMO':13,'U-MCN-OTHER':11,
 'U-AGENT-AG-01':6,'U-AGENT-AG-02':1,'U-AGENT-AG-03':3
});
function fashionPerson(id){
 const provider=getBy('providers',id),user=getBy('users',provider?.uid||id);
 return {key:user?.id||provider?.uid||String(id||'guest'),user};
}
function fashionPortraitIndex(id){
 const {key,user}=fashionPerson(id);
 if(Object.hasOwn(FASHION_SEEDED_PORTRAITS,key))return FASHION_SEEDED_PORTRAITS[key];
 const hash=[...key].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0),gender=String(user?.gender||'');
 const choices=gender==='女'?[0,1,2,3,8,9,10,11]:gender==='男'?[4,5,6,7,12,13,14,15]:Array.from({length:16},(_,i)=>i);
 return choices[hash%choices.length];
}
fePortrait=function(id){
 const {user}=fashionPerson(id);
 if(id==='anonymous'||user&&(user.ops16PublicAvatar===false||user.avatar===''))return ops16DefaultPortrait();
 const n=fashionPortraitIndex(id),tones=['#e3e9f1','#eee8df','#e5e4eb','#f3e0e8','#e2e5e9','#dde5ee','#eeeae2','#e4e7e9','#ece4ed','#e3e3ed','#f0e2e0','#e9e3eb','#e5e7ed','#e9e4ec','#e1e8ef','#e4e3e9'];
 return `<span class="fe-photo fashion-photo" role="img" aria-label="18岁成年虚构人物 · 韩系日系时尚写真" data-fashion-person="${n}" style="--fashion-x:${n%4*100/3}%;--fashion-y:${Math.floor(n/4)*100/3}%;--fashion-tone:${tones[n]}"><span class="fashion-cell" aria-hidden="true"></span></span>`;
};
function fashionAdminPortrait(id,size=34){return `<span class="avatar fashion-admin-avatar" style="width:${size}px;height:${size}px">${fePortrait(id)}</span>`;}
const fashionMainCellBefore=mainCell;
mainCell=function(label,id,avatar=false){
 if(!avatar)return fashionMainCellBefore(label,id,avatar);
 const p=getBy('providers',id),u=getBy('users',p?.uid||id)||db.users.find(x=>x.name===label);
 if(!u&&!p)return fashionMainCellBefore(label,id,avatar);
 return `<div class="main-cell">${fashionAdminPortrait(u?.id||p.id)}<div><strong>${e(label)}</strong><div class="secondary mono">${e(id)}</div></div></div>`;
};
function fashionMediaPhoto(m,extra=''){
 // Actual local uploads and approved media assets keep their original content.
 if(m.data||C21_ASSETS[m.assetKey]?.data)return `<img class="c21-media ${e(extra)}" src="${e(c21Asset(m))}" alt="${e(m.title||'本地照片')}">`;
 return `<div class="c21-media fashion-album ${e(extra)}" aria-label="${e(m.title||'时尚写真')} · 合成的成年虚构人物">${fePortrait(m.provider)}</div>`;
}
