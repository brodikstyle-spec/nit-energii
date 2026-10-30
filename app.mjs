import {CARDS,initialState,clone,applyCard,evaluate} from './engine.mjs';
const data=await fetch('map-data.json').then(r=>{if(!r.ok)throw Error('Не удалось загрузить карту');return r.json();});
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let state=initialState(),selected='anchor',group='build',history=[],hint=false,showErrors=false,dragCard=null;
const svg=$('#overlay'),NS='http://www.w3.org/2000/svg';
const route=['n3-1','n2-1','n1-1','n0-1'];
const titles={build:'Оборудование',protect:'Защита объектов',event:'Нештатные ситуации'};
const inspector=document.createElement('aside');
inspector.id='object-inspector';inspector.className='object-inspector';inspector.setAttribute('role','tooltip');inspector.hidden=true;document.body.append(inspector);
let inspectedId=null,inspectorAnchor=null,inspectorHideTimer=null;
function hideInspector(){clearTimeout(inspectorHideTimer);inspector.hidden=true;inspectedId=null;$$('[aria-describedby="object-inspector"]').forEach(g=>g.removeAttribute('aria-describedby'));}
function scheduleInspectorHide(){clearTimeout(inspectorHideTimer);inspectorHideTimer=setTimeout(hideInspector,180);}
function positionInspector(){
 if(!inspectorAnchor)return;
 const width=inspector.offsetWidth,height=inspector.offsetHeight,gap=16,margin=12;
 let x=inspectorAnchor.right+gap;
 if(x+width>window.innerWidth-margin)x=inspectorAnchor.left-width-gap;
 x=Math.max(margin,Math.min(x,window.innerWidth-width-margin));
 const y=Math.max(margin,Math.min(inspectorAnchor.top-25,window.innerHeight-height-margin));
 inspector.style.left=x+'px';inspector.style.top=y+'px';
}
function showInspector(id,g){
 clearTimeout(inspectorHideTimer);
 const baseCard=state.placed[id]||(id==='source'&&state.up?'up':state.down[id]?'down':null);
 if(!baseCard){hideInspector();return;}
 inspectedId=id;inspectorAnchor=g.getBoundingClientRect();
 $$('[aria-describedby="object-inspector"]').forEach(n=>n.removeAttribute('aria-describedby'));g.setAttribute('aria-describedby',inspector.id);
 const ps=data.stations.find(p=>p.id===id),node=data.nodes.find(n=>n.id===id),damage=state.damaged[id],shields=state.protections[id]||[];
 const result=evaluate(state,data),powered=node?result.energized.has(id):id==='source'?result.powered>0:!!result.paths[id];
 inspector.replaceChildren();
 const head=document.createElement('div');head.className='inspector-heading';
 const title=document.createElement('strong');title.textContent=ps?ps.name:id==='source'?'Электростанция':'Опора ЛЭП';
 const status=document.createElement('span');status.className='inspector-status '+(damage?'damaged':powered?'powered':'');status.textContent=damage?'Повреждено':powered?'Под напряжением':'Без питания';head.append(title,status);inspector.append(head);
 const list=document.createElement('div');list.className='inspector-cards';
 const entries=[{id:baseCard,label:'Оборудование',kind:'build'},...shields.map(id=>({id,label:'Защита',kind:'protect'})),...(damage?[{id:damage,label:'Причина повреждения',kind:'event'}]:[])];
 inspector.style.width=Math.max(250,entries.length*123+34)+'px';
 for(const entry of entries){
  const card=CARDS.find(c=>c.id===entry.id);if(!card)continue;
  const figure=document.createElement('figure');figure.className='inspector-card '+entry.kind;
  const label=document.createElement('span');label.className='inspector-card-label';label.textContent=entry.label;
  const image=document.createElement('img');image.src=''+card.id+'.webp';image.alt=card.name;image.draggable=false;
  const caption=document.createElement('figcaption');caption.textContent=card.name;
  figure.append(label,image,caption);list.append(figure);
 }
 inspector.append(list);
 const note=document.createElement('p');note.className='inspector-note';note.textContent=damage?'Для ремонта установите оборудование заново синей карточкой.':shields.length?'Защита установлена. Каждая зелёная карта отражает одну соответствующую ситуацию.':'Защита не установлена. Добавьте подходящую зелёную карточку.';inspector.append(note);
 inspector.hidden=false;positionInspector();
}
inspector.addEventListener('pointerenter',()=>clearTimeout(inspectorHideTimer));inspector.addEventListener('pointerleave',scheduleInspectorHide);
function repositionInspector(){if(inspector.hidden||!inspectedId)return;const g=$$('[data-target]').find(n=>n.dataset.target===inspectedId);if(g){inspectorAnchor=g.getBoundingClientRect();positionInspector();}else hideInspector();}
document.addEventListener('keydown',e=>{if(e.key==='Escape')hideInspector();});window.addEventListener('resize',repositionInspector);window.addEventListener('scroll',repositionInspector,{passive:true});
function el(tag,attrs={},parent=svg){const n=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));parent.append(n);return n;}
function say(message,type='info'){$('#feedback').className='feedback '+(type==='info'?'':type);$('#feedback p').textContent=message;$('#feedback .feedback-icon').textContent=type==='success'?'✓':type==='error'?'!':'i';}
function save(){history.push(clone(state));if(history.length>100)history.shift();}
function palette(){
 $('#palette-title').textContent=titles[group];$('#cards').setAttribute('aria-labelledby','tab-'+group);$('#palette-count').textContent='4 карточки';
 $('#cards').replaceChildren();
 for(const card of CARDS.filter(c=>c.group===group)){
  const b=document.createElement('button');b.className='card';b.dataset.group=group;b.setAttribute('aria-pressed',String(selected===card.id));b.draggable=true;b.title=card.desc;b.setAttribute('aria-label',card.name+'. '+card.desc);
  b.innerHTML='<span class="choose">✓</span><img src="'+card.id+'.webp" alt="" draggable="false"><strong>'+card.name+'</strong>';
  b.addEventListener('click',()=>{selected=card.id;palette();});
  b.addEventListener('dragstart',e=>{selected=card.id;dragCard=card.id;e.dataTransfer.setData('text/plain',card.id);e.dataTransfer.effectAllowed='copy';setTimeout(palette,0);});
  b.addEventListener('dragend',()=>{dragCard=null;$$('.drop-hover').forEach(n=>n.classList.remove('drop-hover'));});
  $('#cards').append(b);
 }
 if(group==='build'){
  const b=document.createElement('button');b.className='remove-tool';b.textContent='− Убрать оборудование';b.setAttribute('aria-pressed',String(selected==='remove'));b.addEventListener('click',()=>{selected='remove';palette();});$('#cards').append(b);
 }
 const c=CARDS.find(c=>c.id===selected);$('#selection-note').replaceChildren();const strong=document.createElement('strong');strong.textContent=c?c.short:'Убрать оборудование';$('#selection-note').append(strong,document.createTextNode(c?c.desc:'Нажмите на установленную опору или трансформатор.'));
 $$('.tabs button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.group===group)));
}
function use(target){
 if(selected==='remove'){
  const exists=state.placed[target]||(target==='source'?state.up:state.down[target]);
  if(!exists){say('На этом месте пока нет оборудования.','error');return;}
  save();delete state.placed[target];if(target==='source')state.up=false;else delete state.down[target];delete state.protections[target];delete state.damaged[target];say('Оборудование убрано. При необходимости последнее действие можно отменить.');render();return;
 }
 const before=evaluate(state,data).powered,result=applyCard(state,selected,target,data);
 if(result.error){say(result.error,'error');return;}
 save();state=result.state;showErrors=false;
 const after=evaluate(state,data).powered;
 let message=result.message;
 if(after>before)message='Свет зажёгся! Исправная сеть снабжает '+after+' из 4 районов. Теперь можно установить защиту и проверить нештатные ситуации.';
 if(after<before)message+=' Питание прервалось: часть окон погасла.';
 say(message,result.event==='damaged'?'error':after>before||result.event==='blocked'?'success':'info');
 if(result.event){$('#board').classList.remove('event-flash');requestAnimationFrame(()=>$('#board').classList.add('event-flash'));}
 render();
}
function events(g,id){
 g.setAttribute('role','button');g.setAttribute('tabindex','0');
 g.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')showInspector(id,g);});g.addEventListener('pointerleave',scheduleInspectorHide);
 g.addEventListener('focus',()=>showInspector(id,g));g.addEventListener('blur',scheduleInspectorHide);
 g.addEventListener('click',()=>use(id));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();use(id);}});
 g.addEventListener('dragover',e=>{hideInspector();e.preventDefault();g.classList.add('drop-hover');e.dataTransfer.dropEffect='copy';});
 g.addEventListener('dragleave',()=>g.classList.remove('drop-hover'));
 g.addEventListener('drop',e=>{e.preventDefault();const card=e.dataTransfer.getData('text/plain')||dragCard;if(CARDS.some(c=>c.id===card)){selected=card;palette();use(id);}});
}
function badge(g,id,x,y){
 const protections=state.protections[id]||[];
 if(protections.length){el('circle',{cx:x,cy:y,r:12,class:'shield-badge'},g);const t=el('text',{x,y:y+6,class:'badge-text'},g);t.textContent=protections.length>1?String(protections.length):'✓';}
 if(state.damaged[id]){el('circle',{cx:x,cy:y,r:13,class:'damage-badge'},g);const t=el('text',{x,y:y+6,class:'badge-text'},g);t.textContent='!';}
}
function pylon(g,type){
 const anchor=type==='anchor';const d=anchor?'M-15 24 L0-26 L15 24 M-10 8 H10 M-8-3 H8 M-5-14 H5 M-10 8 L8-3 M10 8 L-8-3 M-15 24 L10 8 M15 24 L-10 8 M-20-13 H20 M-17-6 H17':'M-9 24 L0-25 L9 24 M-6 7 H6 M-4-6 H4 M-6 7 L6 24 M6 7 L-6 24 M-18-15 H18 M-14-9 H14';
 el('path',{d,class:'pylon'},g);el('circle',{cx:20,cy:22,r:9,fill:anchor?'#07579b':'#849ba9',stroke:'white','stroke-width':1.5},g);const t=el('text',{x:20,y:26,'text-anchor':'middle',fill:'white','font-size':11,'font-family':'Arial','font-weight':'bold'},g);t.textContent=anchor?'А':'П';
}
function endpointLine(node,object){
 if(object.id==='source')return `M495 452 L${node.x} 452 L${node.x} ${node.y}`;
 return `M${node.x} ${node.y} L${object.x} ${node.y} L${object.x} ${object.y}`;
}
function render(){
 const result=evaluate(state,data),byId=Object.fromEntries(data.nodes.map(n=>[n.id,n]));svg.replaceChildren();
 const lines=el('g',{'aria-hidden':'true'});
 for(const edge of data.edges){
  if(!state.placed[edge.a]||!state.placed[edge.b])continue;
  const a=byId[edge.a],b=byId[edge.b];const lit=Object.values(result.paths).some(p=>p.some((n,i)=>i<p.length-1&&((n===a.id&&p[i+1]===b.id)||(n===b.id&&p[i+1]===a.id))));
  const invalid=edge.crossing&&(state.placed[a.id]!=='anchor'||state.placed[b.id]!=='anchor');
  el('path',{d:`M${a.x} ${a.y} L${b.x} ${b.y}`,class:lit?'power-line flow':invalid?'bad-line':'dead-line'},lines);
 }
 for(const id of data.sourceLinks){if(state.up&&state.placed[id]){const lit=Object.values(result.paths).some(p=>p[0]===id);el('path',{d:endpointLine(byId[id],{id:'source'}),class:lit?'power-line flow':'dead-line'},lines);}}
 for(const ps of data.stations){for(const id of ps.links){if(state.down[ps.id]&&state.placed[id]){const lit=result.paths[ps.id]?.at(-1)===id;el('path',{d:endpointLine(byId[id],ps),class:lit?'power-line flow':'dead-line'},lines);}}}
 const windows=el('g',{'aria-hidden':'true'});
 for(const w of data.windows){const lit=!!result.paths[w.ps];el('rect',{x:w.x-.3,y:w.y-.3,width:w.w+.6,height:w.h+.6,fill:lit?'#ffda53':'#365764',class:lit?'window-light':''},windows);}
 for(const n of data.nodes){
  const exists=state.placed[n.id],damaged=!!state.damaged[n.id],powered=result.energized.has(n.id);
  const g=el('g',{transform:`translate(${n.x} ${n.y})`,class:'target'+(damaged?' damaged':'')+(powered?' powered':'')+(showErrors&&result.issues.has(n.id)?' show-error':''),'data-target':n.id,'aria-label':`Место ЛЭП: ряд ${n.r+1}, столбец ${n.c+1}. ${exists?(exists==='anchor'?'Анкерная':'Промежуточная')+' опора'+(damaged?', повреждена':''):'Пусто'}`});
  const title=el('title',{},g);title.textContent=(exists?CARDS.find(c=>c.id===exists).name:'Место для опоры')+(state.protections[n.id]?.length?' · Защита: '+state.protections[n.id].map(id=>CARDS.find(c=>c.id===id).short).join(', '):'');
  if(exists){el('rect',{x:-29,y:-32,width:58,height:64,rx:8,class:'node-back'},g);pylon(g,exists);badge(g,n.id,24,-27);}
  if(hint&&route.includes(n.id))el('circle',{cx:0,cy:0,r:34,class:'hint-ring'},g);
  el('circle',{cx:0,cy:0,r:37,class:'node-hit'},g);events(g,n.id);
 }
 const objects=[{id:'source',name:'Электростанция',x:495,y:452,up:true},...data.stations];
 for(const o of objects){
  const active=o.id==='source'?state.up:state.down[o.id],damaged=!!state.damaged[o.id],powered=o.id==='source'?result.powered>0:!!result.paths[o.id];
  const w=o.id==='source'?176:155,h=85;
  const g=el('g',{class:'target object-target'+(damaged?' damaged':'')+(powered?' powered':''),'data-target':o.id,'aria-label':o.name+'. '+(active?(o.id==='source'?'Повышающий':'Понижающий')+' трансформатор установлен'+(damaged?', повреждён':''):'Место для трансформатора')});
  el('rect',{x:o.x-w/2,y:o.y-h/2,width:w,height:h,rx:9,class:'object-hit'},g);
  if(active){el('image',{href:''+(o.id==='source'?'up':'down')+'.webp',x:o.x-26,y:o.y-37,width:52,height:74,class:'transformer-card','pointer-events':'none'},g);badge(g,o.id,o.x+42,o.y-31);}
  else {el('rect',{x:o.x-69,y:o.y+34,width:138,height:25,rx:6,fill:'#07579bdc','pointer-events':'none'},g);const text=el('text',{x:o.x,y:o.y+51,'text-anchor':'middle',class:'target-label'},g);text.textContent=o.id==='source'?'↑ Трансформатор':'↓ Трансформатор';}
  if(hint&&(o.id==='source'||o.id==='ps1'))el('rect',{x:o.x-w/2-5,y:o.y-h/2-5,width:w+10,height:h+10,rx:11,class:'hint-ring'},g);
  const title=el('title',{},g);title.textContent=o.name+(state.protections[o.id]?.length?' · Защита: '+state.protections[o.id].map(id=>CARDS.find(c=>c.id===id).short).join(', '):'');events(g,o.id);
 }
 $('#power-count').textContent=result.powered;$('#power-track').style.width=(result.powered*25)+'%';$('#bulb').classList.toggle('on',result.powered>0);
 $('#power-message').textContent=result.powered===4?'Все районы получают электроэнергию. Проверьте надёжность вашей сети.':result.powered>0?'Питание есть. Защитите линию или подключите следующий район.':'Соберите первую исправную цепь, чтобы зажечь окна.';
 const steps={up:state.up&&!state.damaged.source,line:Object.keys(state.placed).length>0,down:Object.entries(state.down).some(([id,on])=>on&&!state.damaged[id]),power:result.powered>0};
 $$('.steps li').forEach(li=>{li.classList.toggle('done',steps[li.dataset.step]);li.querySelector('.step-num').textContent=steps[li.dataset.step]?'✓':String(['up','line','down','power'].indexOf(li.dataset.step)+1);});$('#undo').disabled=!history.length;
 $('#hint').classList.toggle('active',hint);$('#hint').setAttribute('aria-pressed',String(hint));
 if(inspectedId){const g=$$('[data-target]').find(n=>n.dataset.target===inspectedId);if(g)showInspector(inspectedId,g);else hideInspector();}
}
$$('.tabs button').forEach(b=>b.addEventListener('click',()=>{group=b.dataset.group;selected=CARDS.find(c=>c.group===group).id;palette();say(group==='protect'?'Выберите зелёную карточку и работающий объект. Щит покажет установленную защиту.':group==='event'?'Выберите красную карточку, затем подходящий объект. Следите за линией и окнами.':'Выберите оборудование и место на карте.');}));
$('#undo').addEventListener('click',()=>{if(history.length){state=history.pop();showErrors=false;say('Последнее действие отменено.');render();}});
$('#reset').addEventListener('click',()=>{save();state=initialState();hint=false;showErrors=false;group='build';selected='anchor';palette();say('Карта готова к новому строительству. Начните с трансформаторов или опор.');render();});
$('#hint').addEventListener('click',()=>{hint=!hint;if(hint)say('Пунктиром отмечен один из путей к подстанции 1. На этой короткой линии используйте анкерные опоры: есть концы линии и пересечение дороги. Установите оба трансформатора.');else say('Подсказка скрыта. Можно выбрать свой маршрут.');render();});
$('#demo').addEventListener('click',()=>{save();state.up=true;delete state.damaged.source;state.down.ps1=true;delete state.damaged.ps1;route.forEach(id=>{state.placed[id]='anchor';delete state.damaged[id];});hint=false;showErrors=false;say('Пример готов: повышающий трансформатор → линия с анкерными опорами → понижающий трансформатор → потребители. Теперь попробуйте защиту и нештатные ситуации.','success');render();});
$('#check').addEventListener('click',()=>{
 const r=evaluate(state,data);showErrors=true;render();
 if(r.powered){say('Есть '+r.powered+' исправных цепей. Свет в окнах подтверждает подачу питания. '+(r.issues.size?'На других участках есть опоры, требующие проверки: они отмечены красным.':'Теперь проверьте работу защиты.'),'success');return;}
 if(Object.keys(state.damaged).length){say('В сети есть повреждённое оборудование со знаком «!». Для ремонта установите нужную синюю карточку заново.','error');return;}
 if(!state.up){say('Не хватает повышающего трансформатора на электростанции. Выберите его синюю карточку и нажмите на электростанцию.','error');return;}
 if(!Object.values(state.down).some(Boolean)){say('Не хватает понижающего трансформатора на подстанции. Он нужен перед подачей энергии потребителям.','error');return;}
 if(r.issues.size){say('Проверьте отмеченные красным опоры: на концах линии, поворотах и по обе стороны пересечения дороги или реки нужны анкерные опоры.','error');return;}
 say('Цепь пока не замкнута. Соединяйте соседние кружки по горизонтали или вертикали, без пропусков, от электростанции до выбранной подстанции. Кнопка «Подсказка» покажет один из путей.','error');
});
$('#help-button').addEventListener('click',()=>$('#help').showModal());$$('.close-dialog').forEach(b=>b.addEventListener('click',()=>$('#help').close()));
$('#help').addEventListener('click',e=>{if(e.target===$('#help')){const r=$('#help').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('#help').close();}});
palette();render();
