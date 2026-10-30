export const CARDS = [
 {id:'anchor',group:'build',name:'Анкерная опора',short:'Анкерная',desc:'Начало и конец линии, поворот, пересечение дороги или реки.',target:'node'},
 {id:'intermediate',group:'build',name:'Промежуточная опора',short:'Промежуточная',desc:'Прямой участок линии между анкерными опорами.',target:'node'},
 {id:'up',group:'build',name:'Повышающий трансформатор',short:'Повышающий',desc:'Установите на электростанцию: повышает напряжение перед передачей.',target:'source'},
 {id:'down',group:'build',name:'Понижающий трансформатор',short:'Понижающий',desc:'Установите на подстанцию: понижает напряжение перед подачей потребителям.',target:'station'},
 {id:'reinforce',group:'protect',name:'Усиление опоры',short:'Усиление опоры',desc:'Защищает опору от карты «Обрыв деревьев».',target:'node'},
 {id:'ice',group:'protect',name:'Система ПА',short:'Система ПА',desc:'Противообледенительная автоматика защищает опору от снегопада.',target:'node'},
 {id:'diagnostics',group:'protect',name:'Диагностика и мониторинг',short:'Диагностика',desc:'Защищает установленный трансформатор от аварии.',target:'transformer'},
 {id:'employee',group:'protect',name:'Сотрудник компании',short:'Сотрудник',desc:'Защищает подстанцию от внеплановой проверки.',target:'station'},
 {id:'trees',group:'event',name:'Обрыв деревьев',short:'Обрыв деревьев',desc:'Повреждает опору, если на ней нет карты «Усиление опоры».',target:'node',shield:'reinforce'},
 {id:'snow',group:'event',name:'Снегопад',short:'Снегопад',desc:'Повреждает опору, если на ней нет карты «Система ПА».',target:'node',shield:'ice'},
 {id:'accident',group:'event',name:'Авария на трансформаторе',short:'Авария',desc:'Повреждает трансформатор без диагностики и мониторинга.',target:'transformer',shield:'diagnostics'},
 {id:'inspection',group:'event',name:'Внеплановая проверка',short:'Проверка',desc:'Прерывает работу подстанции, если на ней нет сотрудника компании.',target:'station',shield:'employee'}
];
export const initialState=()=>({placed:{},up:false,down:{},protections:{},damaged:{}});
export const clone=s=>JSON.parse(JSON.stringify(s));
export function applyCard(state,cardId,target,data){
 const card=CARDS.find(c=>c.id===cardId); if(!card)return {error:'Сначала выберите карточку.'};
 const node=data.nodes.find(n=>n.id===target), ps=data.stations.find(n=>n.id===target), source=target==='source';
 const existing=node?state.placed[target]:source?state.up:ps?state.down[target]:false;
 if(card.target==='node'&&!node)return {error:'Эту карточку нужно положить на белый кружок с опорой ЛЭП.'};
 if(card.target==='source'&&!source)return {error:'Повышающий трансформатор устанавливается на электростанции.'};
 if(card.target==='station'&&!ps)return {error:'Эту карточку нужно положить на подстанцию.'};
 if(card.target==='transformer'&&(!source&&!ps))return {error:'Выберите трансформатор на электростанции или подстанции.'};
 if(card.group!=='build'&&!existing)return {error:node?'Сначала установите здесь опору.':'Сначала установите на объект трансформатор.'};
 if(card.group!=='build'&&state.damaged[target])return {error:'Объект уже повреждён. Сначала восстановите его синей карточкой.'};
 const next=clone(state);
 if(card.group==='build'){
  const wasDamaged=!!next.damaged[target];
  if(node)next.placed[target]=cardId;else if(source)next.up=true;else next.down[target]=true;
  delete next.damaged[target];
  return {state:next,message:wasDamaged?'Оборудование восстановлено. Если цепь исправна, питание вернётся.':card.name+': установлено.'};
 }
 if(card.group==='protect'){
  const shields=next.protections[target]||[];
  if(shields.includes(cardId))return {error:'Эта защита уже установлена на объекте.'};
  next.protections[target]=[...shields,cardId];
  return {state:next,message:card.name+': объект защищён. Одна карта защиты отражает одну соответствующую ситуацию.'};
 }
 const shields=next.protections[target]||[];
 if(shields.includes(card.shield)){
  next.protections[target]=shields.filter(x=>x!==card.shield);
  return {state:next,message:'Защита сработала! Объект продолжает работать. Использованная зелёная карта снята.',event:'blocked',target};
 }
 next.damaged[target]=cardId;
 return {state:next,message:card.name+': объект повреждён. Замените его соответствующей синей карточкой, чтобы восстановить питание.',event:'damaged',target};
}
export function evaluate(state,data){
 const nodes=Object.fromEntries(data.nodes.map(n=>[n.id,n]));
 const isActive=id=>!!state.placed[id]&&!state.damaged[id];
 const adj=Object.fromEntries(data.nodes.map(n=>[n.id,[]]));
 const issues=new Set();
 const edges=data.edges.filter(e=>{
  if(!isActive(e.a)||!isActive(e.b))return false;
  if(e.crossing&&(state.placed[e.a]!=='anchor'||state.placed[e.b]!=='anchor')){if(state.placed[e.a]!=='anchor')issues.add(e.a);if(state.placed[e.b]!=='anchor')issues.add(e.b);return false;}
  adj[e.a].push(e.b);adj[e.b].push(e.a);return true;
 });
 const pathTo=(ps)=>{
  if(!state.up||state.damaged.source||!state.down[ps.id]||state.damaged[ps.id])return null;
  const queue=data.sourceLinks.filter(id=>isActive(id)&&state.placed[id]==='anchor').map(id=>({prev:null,id,path:[id]}));
  const visited=new Set();
  for(let i=0;i<queue.length;i++){
   const {prev,id,path}=queue[i],key=(prev||'source')+'>'+id;if(visited.has(key))continue;visited.add(key);
   if(ps.links.includes(id)&&state.placed[id]==='anchor')return path;
   for(const next of adj[id]){
    if(path.includes(next))continue;
    if(state.placed[id]==='intermediate'){
     if(!prev)continue;
     const a=nodes[prev],b=nodes[id],c=nodes[next];
     if(!((a.c===b.c&&b.c===c.c)||(a.r===b.r&&b.r===c.r))){issues.add(id);continue;}
    }
    queue.push({prev:id,id:next,path:[...path,next]});
   }
  }
  return null;
 };
 const paths={};data.stations.forEach(ps=>{const p=pathTo(ps);if(p)paths[ps.id]=p;});
 const energized=new Set(Object.values(paths).flat());
 for(const id of data.sourceLinks)if(isActive(id)&&state.placed[id]!=='anchor')issues.add(id);
 for(const ps of data.stations)if(state.down[ps.id])for(const id of ps.links)if(isActive(id)&&state.placed[id]!=='anchor')issues.add(id);
 return {paths,energized,issues,edges,powered:Object.keys(paths).length};
}
