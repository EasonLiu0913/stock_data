(()=>{'use strict';

const PANEL='predictionFormulaBuilderPanel';
const FILTER='registeredTagStrategy__formula_builder';
const MIME='application/x-prediction-formula';
let seq=0;

const id=prefix=>`${prefix}_${Date.now().toString(36)}_${++seq}`;

function group(options={}){
  return {
    id:options.id||id('g'),
    type:'group',
    join:options.join==='OR'?'OR':'AND',
    negated:Boolean(options.negated),
    children:Array.isArray(options.children)?options.children:[],
  };
}

function tag(tagId,options={}){
  return {
    id:options.id||id('t'),
    type:'tag',
    tagId:String(tagId||''),
    join:options.join==='OR'?'OR':'AND',
    negated:Boolean(options.negated),
  };
}

function normalize(node,root=false){
  if(!node||typeof node!=='object') return root?group({id:'root'}):null;
  if(node.type==='tag') return node.tagId?tag(node.tagId,node):null;
  const normalized=group({
    id:root?'root':node.id,
    join:node.join,
    negated:root?false:node.negated,
  });
  normalized.children=(node.children||[]).map(child=>normalize(child)).filter(Boolean);
  if(normalized.children[0]) normalized.children[0].join='AND';
  return normalized;
}

function tagsOf(stock){
  return (Array.isArray(stock?.atomic_tags)
    ? stock.atomic_tags
    : Array.isArray(stock?.prediction_tags)
      ? stock.prediction_tags
      : []).map(String);
}

function evalGroup(currentGroup,stock){
  if(!currentGroup.children.length) return false;
  let part=evaluate(currentGroup.children[0],stock);
  const orParts=[];
  for(let index=1;index<currentGroup.children.length;index+=1){
    const child=currentGroup.children[index];
    const value=evaluate(child,stock);
    if(child.join==='OR'){
      orParts.push(part);
      part=value;
    }else{
      part=part&&value;
    }
  }
  orParts.push(part);
  return orParts.some(Boolean);
}

function evaluate(node,stock){
  let value=node?.type==='group'
    ? evalGroup(node,stock)
    : new Set(tagsOf(stock)).has(String(node?.tagId));
  return node?.negated?!value:value;
}

function find(root,nodeId,parent=null){
  if(root.id===nodeId) return {node:root,parent,index:parent?parent.children.indexOf(root):-1};
  if(root.type!=='group') return null;
  for(let index=0;index<root.children.length;index+=1){
    const child=root.children[index];
    if(child.id===nodeId) return {node:child,parent:root,index};
    if(child.type==='group'){
      const result=find(child,nodeId,root);
      if(result) return result;
    }
  }
  return null;
}

function contains(currentGroup,nodeId){
  return currentGroup.type==='group'&&currentGroup.children.some(child=>
    child.id===nodeId||(child.type==='group'&&contains(child,nodeId)));
}

function detach(root,nodeId){
  const found=find(root,nodeId);
  if(!found?.parent) return null;
  const [node]=found.parent.children.splice(found.index,1);
  if(found.parent.children[0]) found.parent.children[0].join='AND';
  return {node,parentId:found.parent.id,index:found.index};
}

function insert(root,groupId,index,node,preserve=false){
  const found=find(root,groupId);
  if(!found?.node||found.node.type!=='group'||!node) return false;
  const target=found.node;
  const targetIndex=Math.max(0,Math.min(Number(index)||0,target.children.length));
  if(node.type==='group'&&(node.id===target.id||contains(node,target.id))) return false;
  if(targetIndex===0) node.join='AND';
  else if(!preserve) node.join='AND';
  target.children.splice(targetIndex,0,node);
  if(target.children[0]) target.children[0].join='AND';
  return true;
}

function move(root,nodeId,groupId,index){
  if(nodeId==='root') return false;
  const source=find(root,nodeId);
  const target=find(root,groupId);
  if(!source?.parent||target?.node?.type!=='group') return false;
  if(source.node.type==='group'&&(source.node.id===groupId||contains(source.node,groupId))) return false;
  let targetIndex=Math.max(0,Math.min(Number(index)||0,target.node.children.length));
  if(source.parent.id===groupId&&source.index<targetIndex) targetIndex-=1;
  const originalJoin=source.node.join;
  const detached=detach(root,nodeId);
  if(!detached) return false;
  const sameParent=detached.parentId===groupId;
  source.node.join=sameParent?originalJoin:'AND';
  return insert(root,groupId,targetIndex,source.node,sameParent);
}

function remove(root,nodeId){
  return Boolean(detach(root,nodeId));
}

function locations(root,ids){
  const entries=[...ids].map(nodeId=>find(root,nodeId)).filter(Boolean);
  if(!entries.length||entries.some(entry=>!entry.parent)) return null;
  const parent=entries[0].parent;
  if(entries.some(entry=>entry.parent.id!==parent.id)) return null;
  entries.sort((left,right)=>left.index-right.index);
  for(let index=1;index<entries.length;index+=1){
    if(entries[index].index!==entries[index-1].index+1) return null;
  }
  return {parent,items:entries};
}

function wrap(root,ids){
  const selection=locations(root,ids);
  if(!selection) return null;
  const start=selection.items[0].index;
  const children=selection.parent.children.splice(start,selection.items.length);
  const join=children[0]?.join||'AND';
  if(children[0]) children[0].join='AND';
  const wrapped=group({join,children});
  selection.parent.children.splice(start,0,wrapped);
  if(selection.parent.children[0]) selection.parent.children[0].join='AND';
  return wrapped;
}

function ungroup(root,nodeId){
  const found=find(root,nodeId);
  if(!found?.parent||found.node.type!=='group'||found.node.negated) return false;
  const children=found.node.children.splice(0);
  if(children.length) children[0].join=found.node.join;
  found.parent.children.splice(found.index,1,...children);
  if(found.parent.children[0]) found.parent.children[0].join='AND';
  return true;
}

function cycle(node){
  if(node.join==='AND'&&!node.negated) node.join='OR';
  else if(node.join==='OR'&&!node.negated){node.join='AND';node.negated=true;}
  else if(node.join==='AND'&&node.negated) node.join='OR';
  else{node.join='AND';node.negated=false;}
}

const connector=node=>`${node.join==='OR'?'OR':'AND'}${node.negated?' NOT':''}`;

function formula(currentGroup,labels=new Map()){
  return (currentGroup.children||[]).map((child,index)=>{
    const prefix=index===0
      ? child.negated?'NOT ':''
      : `${child.join} ${child.negated?'NOT ':''}`;
    const value=child.type==='group'
      ? `(${formula(child,labels)||'空群組'})`
      : labels.get(child.tagId)||child.tagId;
    return `${prefix}${value}`.trim();
  }).join(' ');
}

function warnings(root){
  const output=[];
  function visit(currentGroup){
    if(!currentGroup.children.length) output.push('存在空群組，空群組不會命中。');
    if(currentGroup.id!=='root'&&currentGroup.children.length===1) output.push('有括號群組只有一個條件。');
    const duplicates=new Map();
    for(const child of currentGroup.children){
      if(child.type==='tag'){
        const states=duplicates.get(child.tagId)||[];
        states.push(child.negated);
        duplicates.set(child.tagId,states);
      }else{
        visit(child);
      }
    }
    for(const [tagId,states] of duplicates){
      if(states.length>1&&new Set(states).size>1) output.push(`${tagId} 與 NOT ${tagId} 同時存在。`);
      else if(states.length>1) output.push(`${tagId} 重複加入。`);
    }
  }
  visit(root);
  return output;
}

const API={
  FILTER,group,tag,normalize,tagsOf,evaluate,evalGroup,find,contains,detach,insert,move,remove,wrap,ungroup,cycle,connector,formula,warnings,
  createGroup:group,createTagNode:tag,normalizeNode:normalize,stockTagIds:tagsOf,evaluateNode:evaluate,evaluateGroup:evalGroup,
  findNode:find,containsNode:contains,detachNode:detach,insertNode:insert,moveNode:move,removeNode:remove,wrapNodes:wrap,
  ungroupNode:ungroup,cycleConnector:cycle,connectorLabel:connector,formulaText:formula,collectWarnings:warnings,
};
if(typeof module!=='undefined'&&module.exports) module.exports=API;
if(typeof window==='undefined'||typeof document==='undefined') return;
if(window.__predictionFormulaBuilderInstalled) return;
window.__predictionFormulaBuilderInstalled=true;

let data=null;
let defs=[];
let labels=new Map();
let counts={};
let tree=group({id:'root'});
let selected=new Set();
let history=[];
let historyIndex=-1;
let dragPayload=null;
let resultLimit=60;
let sheetState={mode:null,targetGroupId:'root',nodeId:null};
let toastTimer=null;
const dragDepth=new WeakMap();

const esc=value=>String(value??'').replace(/[&<>"']/g,character=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
}[character]));
const dateKey=()=>data?.forecast_date||(typeof currentDate!=='undefined'?currentDate:'latest');
const storeKey=()=>`predictionFormulaBuilder:${dateKey()}`;
const touchMode=()=>window.matchMedia?.('(pointer: coarse)').matches||window.innerWidth<=720;
const draggableAttribute=()=>touchMode()?'':'draggable="true"';

function save(){
  try{localStorage.setItem(storeKey(),JSON.stringify(tree));}catch{}
}

function load(){
  try{
    const stored=JSON.parse(localStorage.getItem(storeKey())||'null');
    if(stored) tree=normalize(stored,true);
  }catch{}
}

function snap(){
  const serialized=JSON.stringify(tree);
  if(history[historyIndex]===serialized) return;
  history=history.slice(0,historyIndex+1);
  history.push(serialized);
  if(history.length>80) history.shift();
  historyIndex=history.length-1;
  save();
}

function restore(index){
  if(index<0||index>=history.length) return;
  historyIndex=index;
  tree=normalize(JSON.parse(history[index]),true);
  selected.clear();
  save();
  render();
}

const matches=node=>(data?.stocks||[]).filter(stock=>evaluate(node,stock));

function mutate(keepSelection=false){
  if(!keepSelection) selected.clear();
  resultLimit=60;
  snap();
  render();
  if(typeof activeQuickFilter!=='undefined'&&activeQuickFilter===FILTER&&typeof renderStocks==='function') renderStocks();
}

function register(){
  if(typeof quickFilters==='undefined') return;
  quickFilters[FILTER]={
    label:'策略公式實驗',
    tag:'公式',
    test:stock=>tree.children.length&&evaluate(tree,stock),
  };
}

function showToast(message){
  const panel=document.getElementById(PANEL);
  const toast=panel?.querySelector('#pfToast');
  if(!toast) return;
  toast.querySelector('span').textContent=message;
  toast.hidden=false;
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{toast.hidden=true;},4500);
}

function performDrop(groupId,index,payload){
  let changed=false;
  if(payload?.kind==='tag') changed=insert(tree,groupId,index,tag(payload.tagId));
  if(payload?.kind==='node') changed=move(tree,payload.nodeId,groupId,index);
  if(changed){
    mutate();
    showToast(payload.kind==='tag'?'已加入條件。':'已移動條件。');
  }
}

function moveWithinParent(nodeId,delta){
  const found=find(tree,nodeId);
  if(!found?.parent) return false;
  const nextIndex=found.index+delta;
  if(nextIndex<0||nextIndex>=found.parent.children.length) return false;
  return move(tree,nodeId,found.parent.id,nextIndex+(delta>0?1:0));
}

function collectGroups(root,pathLabel='最外層公式',output=[]){
  if(root.type!=='group') return output;
  output.push({id:root.id,label:pathLabel,node:root});
  let groupNumber=0;
  for(const child of root.children){
    if(child.type!=='group') continue;
    groupNumber+=1;
    collectGroups(child,`${pathLabel} › 括號 ${groupNumber}`,output);
  }
  return output;
}

function canMoveTo(nodeId,groupId){
  const source=find(tree,nodeId);
  const target=find(tree,groupId);
  if(!source?.parent||target?.node?.type!=='group') return false;
  return !(source.node.type==='group'&&(source.node.id===groupId||contains(source.node,groupId)));
}

function groupLabel(groupId){
  return collectGroups(tree).find(item=>item.id===groupId)?.label||'公式群組';
}

function closeSheet(panel=document.getElementById(PANEL)){
  const sheet=panel?.querySelector('#pfMobileSheet');
  if(sheet) sheet.hidden=true;
  document.body.classList.remove('pf-sheet-open');
  sheetState={mode:null,targetGroupId:'root',nodeId:null};
}

function sheetTagMarkup(query=''){
  const normalized=query.trim().toLowerCase();
  const visible=defs.filter(definition=>!normalized||[definition.label,definition.tag_id,definition.category]
    .some(value=>String(value||'').toLowerCase().includes(normalized)));
  const categories=[...new Set(visible.map(definition=>definition.category||'other'))];
  return categories.map(category=>`<section><h4>${esc(category)}</h4>${visible
    .filter(definition=>(definition.category||'other')===category)
    .map(definition=>`<button type="button" data-a="sheet-tag" data-tag="${esc(definition.tag_id)}"><b>${esc(definition.label)}</b><span>${counts[definition.tag_id]?.calculation_status==='unable_to_calculate'?'N/A':Number(counts[definition.tag_id]?.count||0).toLocaleString('zh-TW')} 檔</span><small>${esc(definition.tag_id)}</small></button>`).join('')}</section>`).join('')||'<p class="pf-sheet-empty">找不到標籤</p>';
}

function renderSheet(panel){
  const sheet=panel.querySelector('#pfMobileSheet');
  if(!sheet||sheet.hidden) return;
  const title=sheet.querySelector('#pfSheetTitle');
  const subtitle=sheet.querySelector('#pfSheetSubtitle');
  const search=sheet.querySelector('#pfSheetSearch');
  const body=sheet.querySelector('#pfSheetBody');
  if(sheetState.mode==='add'){
    title.textContent='新增條件';
    subtitle.textContent=`加入至：${groupLabel(sheetState.targetGroupId)}`;
    search.hidden=false;
    body.innerHTML=sheetTagMarkup(search.value);
    return;
  }
  title.textContent='移至其他群組';
  subtitle.textContent='選擇條件的新位置；移入後預設使用 AND。';
  search.hidden=true;
  body.innerHTML=collectGroups(tree)
    .filter(item=>canMoveTo(sheetState.nodeId,item.id))
    .map(item=>`<button type="button" class="pf-sheet-target" data-a="sheet-group" data-gid="${esc(item.id)}"><b>${esc(item.label)}</b><small>${item.node.children.length} 項</small></button>`).join('')||'<p class="pf-sheet-empty">目前沒有其他可移入的群組。</p>';
}

function openSheet(panel,mode,options={}){
  sheetState={
    mode,
    targetGroupId:options.targetGroupId||'root',
    nodeId:options.nodeId||null,
  };
  const sheet=panel.querySelector('#pfMobileSheet');
  if(!sheet) return;
  const search=sheet.querySelector('#pfSheetSearch');
  search.value='';
  sheet.hidden=false;
  document.body.classList.add('pf-sheet-open');
  renderSheet(panel);
  if(mode==='add') setTimeout(()=>search.focus({preventScroll:true}),0);
}

function connHtml(node,index){
  if(index===0){
    return `<button class="pf-first ${node.negated?'on':''}" data-a="not" data-id="${esc(node.id)}">${node.negated?'NOT':'＋ NOT'}</button>`;
  }
  return `<button class="pf-conn ${node.join==='OR'?'or':'and'} ${node.negated?'not':''}" data-a="cycle" data-id="${esc(node.id)}">${esc(connector(node))}</button>`;
}

const slot=(groupId,index,text='放置於此，預設 AND')=>
  `<div class="pf-slot" data-g="${esc(groupId)}" data-i="${index}"><span>${esc(text)}</span></div>`;

function mobileNodeActions(node,index,total){
  return `<div class="pf-mobile-actions"><button type="button" data-a="up" data-id="${esc(node.id)}" ${index<=0?'disabled':''} aria-label="上移">↑</button><button type="button" data-a="down" data-id="${esc(node.id)}" ${index>=total-1?'disabled':''} aria-label="下移">↓</button><button type="button" data-a="move" data-id="${esc(node.id)}">移至</button></div>`;
}

function nodeHtml(node,index,depth,parentId,total){
  if(node.type==='group') return groupHtml(node,index,depth,false,parentId,total);
  const isSelected=selected.has(node.id);
  return `${connHtml(node,index)}<article class="pf-node ${isSelected?'sel':''}" data-node-card="${esc(node.id)}"><label><input type="checkbox" data-a="select" data-id="${esc(node.id)}" ${isSelected?'checked':''}>選</label><span class="pf-grab" ${draggableAttribute()} data-drag-handle data-node="${esc(node.id)}" title="拖曳排序">⠿</span><div class="pf-node-copy"><b>${esc(labels.get(node.tagId)||node.tagId)}</b><small>${esc(node.tagId)}</small></div><button data-a="not" data-id="${esc(node.id)}" class="${node.negated?'on':''}">${node.negated?'取消 NOT':'NOT'}</button><button data-a="del" data-id="${esc(node.id)}" class="danger">移除</button>${mobileNodeActions(node,index,total)}</article>`;
}

function groupHtml(currentGroup,index,depth,root=false,parentId=null,total=1){
  const isSelected=selected.has(currentGroup.id);
  const children=currentGroup.children.map((child,childIndex)=>
    `${slot(currentGroup.id,childIndex)}${nodeHtml(child,childIndex,depth+1,currentGroup.id,currentGroup.children.length)}`).join('');
  const dragHandle=root?'':`<span class="pf-grab" ${draggableAttribute()} data-drag-handle data-node="${esc(currentGroup.id)}" title="拖曳群組">⠿</span>`;
  const mobileActions=root?'':mobileNodeActions(currentGroup,index,total);
  return `${root?'':connHtml(currentGroup,index)}<section class="pf-group ${root?'root':''} ${isSelected?'sel':''}" data-group="${esc(currentGroup.id)}"><header>${root?'<span class="pf-root">ROOT</span>':`<label><input type="checkbox" data-a="select" data-id="${esc(currentGroup.id)}" ${isSelected?'checked':''}>選</label>${dragHandle}`}<div><b>${root?'最外層公式':'括號群組'}</b><small>${currentGroup.children.length} 項｜符合 ${matches(currentGroup).length.toLocaleString('zh-TW')} 檔</small></div><nav>${root?'':`<button data-a="not" data-id="${esc(currentGroup.id)}" class="${currentGroup.negated?'on':''}">${currentGroup.negated?'NOT 群組':'設為 NOT'}</button>`}<button data-a="pick" data-gid="${esc(currentGroup.id)}">＋ 條件</button><button data-a="sub" data-gid="${esc(currentGroup.id)}">＋ ()</button>${root?'':`<button data-a="ungroup" data-id="${esc(currentGroup.id)}" ${currentGroup.negated?'disabled':''}>取消括號</button><button data-a="del" data-id="${esc(currentGroup.id)}" class="danger">移除</button>`}</nav>${mobileActions}</header><div class="pf-body">${children}${slot(currentGroup.id,currentGroup.children.length,currentGroup.children.length?'放在群組最後，預設 AND':'拖曳標籤，或點「＋ 條件」加入')}</div></section>`;
}

function library(panel){
  const query=panel.querySelector('#pfSearch').value.trim().toLowerCase();
  const visible=defs.filter(definition=>!query||[definition.label,definition.tag_id,definition.category]
    .some(value=>String(value||'').toLowerCase().includes(query)));
  const categories=[...new Set(visible.map(definition=>definition.category||'other'))];
  panel.querySelector('#pfLibrary').innerHTML=categories.map(category=>`<section><h4>${esc(category)}</h4>${visible
    .filter(definition=>(definition.category||'other')===category)
    .map(definition=>`<button type="button" ${draggableAttribute()} data-drag-handle data-a="quick-add" data-tag="${esc(definition.tag_id)}"><span class="pf-library-grab">⠿</span><b>${esc(definition.label)}</b><strong>${counts[definition.tag_id]?.calculation_status==='unable_to_calculate'?'N/A':Number(counts[definition.tag_id]?.count||0).toLocaleString('zh-TW')}</strong><small>${esc(definition.tag_id)}</small></button>`).join('')}</section>`).join('')||'<p>找不到標籤</p>';
}

function editor(panel){
  panel.querySelector('#pfTree').innerHTML=groupHtml(tree,0,0,true);
  const selection=locations(tree,selected);
  const wrapButton=panel.querySelector('[data-a="wrap"]');
  wrapButton.disabled=!selection;
  wrapButton.title=selection?'包成括號':'請選取同一層、連續的項目';
  panel.querySelector('[data-a="undo"]').disabled=historyIndex<=0;
  panel.querySelector('[data-a="redo"]').disabled=historyIndex>=history.length-1;
}

function results(panel){
  const rows=tree.children.length?matches(tree):[];
  const warningItems=warnings(tree);
  panel.querySelector('#pfCount').textContent=`${rows.length.toLocaleString('zh-TW')} 檔`;
  panel.querySelector('#pfTotal').textContent=`全部 ${(data?.stocks||[]).length.toLocaleString('zh-TW')} 檔`;
  panel.querySelector('#pfFormula').textContent=formula(tree,labels)||'尚未建立公式';
  panel.querySelector('#pfWarnings').innerHTML=warningItems.length
    ? warningItems.map(item=>`<div>⚠ ${esc([...labels].reduce((text,[key,value])=>text.replaceAll(key,value),item))}</div>`).join('')
    : '<div class="ok">公式結構正常。</div>';
  panel.querySelector('#pfRows').innerHTML=rows.slice(0,resultLimit).map(stock=>`<tr><td><a target="_blank" rel="noopener" href="https://tw.stock.yahoo.com/quote/${esc(stock.stock_code)}.TW/technical-analysis">${esc(stock.stock_name)} <b>${esc(stock.stock_code)}</b></a></td><td>${esc(stock.industry||'NA')}</td><td>${esc(stock.final_direction_label||'NA')}</td><td>${esc(tagsOf(stock).map(tagId=>labels.get(tagId)||tagId).join('、'))}</td></tr>`).join('')||'<tr><td colspan="4">目前沒有符合股票</td></tr>';
  const more=panel.querySelector('[data-a="more"]');
  more.hidden=rows.length<=resultLimit;
  more.textContent=`顯示更多（${Math.min(resultLimit,rows.length)} / ${rows.length}）`;
  const applyButton=panel.querySelector('[data-a="apply"]');
  applyButton.disabled=!tree.children.length;
  applyButton.textContent=typeof activeQuickFilter!=='undefined'&&activeQuickFilter===FILTER
    ? '已套用到底下股票清單'
    : '套用到底下股票清單';
}

function render(){
  const panel=document.getElementById(PANEL);
  if(!panel) return;
  library(panel);
  editor(panel);
  results(panel);
  register();
}

function apply(){
  register();
  if(typeof setQuickFilter!=='function') return;
  if(typeof activeQuickFilter!=='undefined'&&activeQuickFilter===FILTER){
    if(typeof renderStocks==='function') renderStocks();
  }else{
    setQuickFilter(FILTER);
  }
  document.getElementById('stockListTitle')?.scrollIntoView({behavior:'smooth'});
  render();
}

function clearDragState(panel){
  panel.classList.remove('is-dragging');
  panel.querySelectorAll('.pf-slot.over').forEach(slotElement=>slotElement.classList.remove('over'));
  dragPayload=null;
}

function bind(panel){
  panel.addEventListener('input',event=>{
    if(event.target.id==='pfSearch') library(panel);
    if(event.target.id==='pfSheetSearch') renderSheet(panel);
  });

  panel.addEventListener('change',event=>{
    if(event.target.dataset.a!=='select') return;
    if(event.target.checked) selected.add(event.target.dataset.id);
    else selected.delete(event.target.dataset.id);
    editor(panel);
  });

  panel.addEventListener('click',event=>{
    const button=event.target.closest('[data-a]');
    if(!button) return;
    const action=button.dataset.a;
    const node=find(tree,button.dataset.id)?.node;

    if(action==='quick-add'){
      if(insert(tree,'root',tree.children.length,tag(button.dataset.tag))){mutate();showToast('已加入至最外層公式。');}
    }else if(action==='root'){
      insert(tree,'root',tree.children.length,group());mutate();
    }else if(action==='sub'){
      const target=find(tree,button.dataset.gid)?.node;
      if(target?.type==='group'){insert(tree,target.id,target.children.length,group());mutate();}
    }else if(action==='pick'){
      openSheet(panel,'add',{targetGroupId:button.dataset.gid});
    }else if(action==='move'){
      openSheet(panel,'move',{nodeId:button.dataset.id});
    }else if(action==='sheet-tag'){
      const target=find(tree,sheetState.targetGroupId)?.node;
      if(target?.type==='group'&&insert(tree,target.id,target.children.length,tag(button.dataset.tag))){
        closeSheet(panel);mutate();showToast('已加入條件；需要時可按復原。');
      }
    }else if(action==='sheet-group'){
      const target=find(tree,button.dataset.gid)?.node;
      if(target?.type==='group'&&move(tree,sheetState.nodeId,target.id,target.children.length)){
        closeSheet(panel);mutate();showToast('已移至指定群組。');
      }
    }else if(action==='close-sheet'){
      closeSheet(panel);
    }else if(action==='up'&&moveWithinParent(button.dataset.id,-1)){
      mutate();showToast('已上移。');
    }else if(action==='down'&&moveWithinParent(button.dataset.id,1)){
      mutate();showToast('已下移。');
    }else if(action==='cycle'&&node){
      cycle(node);mutate();
    }else if(action==='not'&&node&&node.id!=='root'){
      node.negated=!node.negated;mutate();
    }else if(action==='del'&&remove(tree,button.dataset.id)){
      mutate();showToast('已移除；需要時可按復原。');
    }else if(action==='wrap'&&wrap(tree,selected)){
      mutate();
    }else if(action==='ungroup'&&ungroup(tree,button.dataset.id)){
      mutate();
    }else if(action==='undo'){
      restore(historyIndex-1);
    }else if(action==='redo'){
      restore(historyIndex+1);
    }else if(action==='toast-undo'){
      restore(historyIndex-1);
      panel.querySelector('#pfToast').hidden=true;
    }else if(action==='clear'){
      tree=group({id:'root'});mutate();
    }else if(action==='apply'){
      apply();
    }else if(action==='save'){
      save();button.textContent='已儲存';setTimeout(()=>{button.textContent='儲存草稿';},900);
    }else if(action==='copy'){
      navigator.clipboard?.writeText(formula(tree,labels));button.textContent='已複製';setTimeout(()=>{button.textContent='複製公式';},900);
    }else if(action==='more'){
      resultLimit+=60;results(panel);
    }
  });

  panel.addEventListener('dragstart',event=>{
    const handle=event.target.closest('[data-drag-handle]');
    if(!handle||touchMode()){
      event.preventDefault();
      return;
    }
    const tagButton=handle.closest('[data-tag]');
    dragPayload=tagButton
      ? {kind:'tag',tagId:tagButton.dataset.tag}
      : handle.dataset.node
        ? {kind:'node',nodeId:handle.dataset.node}
        : null;
    if(!dragPayload) return;
    const serialized=JSON.stringify(dragPayload);
    event.dataTransfer.effectAllowed='move';
    event.dataTransfer.setData(MIME,serialized);
    event.dataTransfer.setData('text/plain',serialized);
    panel.classList.add('is-dragging');
  });

  panel.addEventListener('dragenter',event=>{
    const slotElement=event.target.closest('.pf-slot');
    if(!slotElement) return;
    event.preventDefault();
    const depth=(dragDepth.get(slotElement)||0)+1;
    dragDepth.set(slotElement,depth);
    slotElement.classList.add('over');
  });

  panel.addEventListener('dragover',event=>{
    const slotElement=event.target.closest('.pf-slot');
    if(!slotElement) return;
    event.preventDefault();
    event.dataTransfer.dropEffect='move';
  });

  panel.addEventListener('dragleave',event=>{
    const slotElement=event.target.closest('.pf-slot');
    if(!slotElement) return;
    const depth=Math.max(0,(dragDepth.get(slotElement)||1)-1);
    dragDepth.set(slotElement,depth);
    if(depth===0) slotElement.classList.remove('over');
  });

  panel.addEventListener('drop',event=>{
    const slotElement=event.target.closest('.pf-slot');
    if(!slotElement) return;
    event.preventDefault();
    let payload=dragPayload;
    try{payload=JSON.parse(event.dataTransfer.getData(MIME)||event.dataTransfer.getData('text/plain'));}catch{}
    clearDragState(panel);
    performDrop(slotElement.dataset.g,Number(slotElement.dataset.i),payload);
  });

  panel.addEventListener('dragend',()=>clearDragState(panel));
  window.addEventListener('resize',()=>{
    if(!touchMode()) closeSheet(panel);
    render();
  },{passive:true});
}

function mount(){
  const panel=document.createElement('section');
  panel.id=PANEL;
  panel.className='pf-panel';
  panel.innerHTML=`<header class="pf-head"><div><small>策略實驗工具｜條件樹</small><h2>策略公式實驗室</h2><p class="pf-desktop-copy">建立括號後，把標籤或既有群組拖到藍色放置區。新位置預設 AND；點擊連接詞可切換 AND、OR、AND NOT、OR NOT。</p><p class="pf-mobile-copy">點群組內的「＋ 條件」從底部選擇標籤；使用上移、下移或「移至」調整位置。</p></div><nav><button data-a="root">＋ 建立 ()</button><button data-a="wrap">包成 ()</button><button data-a="undo">復原</button><button data-a="redo">重做</button><button data-a="clear" class="danger">清空</button></nav></header><div class="pf-grid"><aside><h3>標籤庫</h3><p class="pf-library-help">桌機可拖曳；手機點一下會加入最外層。</p><input id="pfSearch" placeholder="搜尋標籤或 ID"><div id="pfLibrary"></div></aside><main><div class="pf-title"><h3>公式區</h3><span class="pf-desktop-copy">放置區決定括號內外與前後位置</span><span class="pf-mobile-copy">用群組按鈕加入；用箭頭排序</span></div><div id="pfTree"></div><footer><b>公式預覽</b><code id="pfFormula"></code><button data-a="copy">複製公式</button><button data-a="save">儲存草稿</button></footer></main><aside><div class="pf-kpi"><span>最終符合</span><strong id="pfCount">0 檔</strong><small id="pfTotal"></small></div><button class="pf-apply" data-a="apply">套用到底下股票清單</button><div id="pfWarnings"></div><div class="pf-table"><table><thead><tr><th>股票</th><th>產業</th><th>方向</th><th>命中標籤</th></tr></thead><tbody id="pfRows"></tbody></table></div><button data-a="more">顯示更多</button></aside></div><div id="pfMobileSheet" class="pf-sheet" hidden><button type="button" class="pf-sheet-backdrop" data-a="close-sheet" aria-label="關閉選擇器"></button><section class="pf-sheet-dialog" role="dialog" aria-modal="true" aria-labelledby="pfSheetTitle"><header><div><h3 id="pfSheetTitle">新增條件</h3><p id="pfSheetSubtitle"></p></div><button type="button" data-a="close-sheet" aria-label="關閉">×</button></header><input id="pfSheetSearch" type="search" placeholder="搜尋標籤或 ID"><div id="pfSheetBody" class="pf-sheet-body"></div></section></div><div id="pfToast" class="pf-toast" hidden><span></span><button type="button" data-a="toast-undo">復原</button></div>`;
  const anchor=document.getElementById('predictionTagStrategyPanel')
    ||document.getElementById('oversoldBetaReboundBanner')
    ||document.getElementById('marketEnvironmentBanner');
  anchor?.insertAdjacentElement('afterend',panel);
  bind(panel);
}

async function snapshot(date){
  const compact=String(date||'').replaceAll('-','').replaceAll('/','');
  if(!/^20\d{6}$/.test(compact)) return null;
  try{
    const response=await fetch(`../data_prediction_analysis/strategy-snapshots/live_snapshot/${compact}.json`,{cache:'no-store'});
    return response.ok?await response.json():null;
  }catch{return null;}
}

async function init(){
  for(let index=0;index<240;index+=1){
    if(typeof dashboard!=='undefined'&&dashboard){
      data=dashboard;
      let registry=data.tag_registry||data.tag_strategy_registry?.tags||[];
      let classifications=data.tag_classifications||{};
      if(!registry.length){
        const storedSnapshot=await snapshot(data.forecast_date||(typeof currentDate!=='undefined'?currentDate:''));
        if(storedSnapshot){
          registry=storedSnapshot.tag_registry||storedSnapshot.strategy_registry?.tags||[];
          classifications=storedSnapshot.tag_classifications||{};
          data={...data,...storedSnapshot,stocks:data.stocks||storedSnapshot.stocks||[]};
        }
      }
      defs=registry.filter(definition=>definition.enabled!==false&&definition.fixed_display!==false);
      labels=new Map(defs.map(definition=>[String(definition.tag_id),definition.label||definition.tag_id]));
      counts=classifications;
      load();
      snap();
      mount();
      register();
      render();
      return;
    }
    await new Promise(resolve=>setTimeout(resolve,50));
  }
}

const style=document.createElement('style');
style.textContent=`
.pf-panel{margin:0 0 14px;border:1px solid #cbd5e1;border-left:6px solid #7c3aed;background:#fff;border-radius:9px;padding:16px;box-sizing:border-box}
.pf-head{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap}.pf-head small{font-weight:900;color:#6d28d9}.pf-head h2{margin:3px 0}.pf-head p{margin:5px 0;color:#64748b;font-size:13px}.pf-head nav,.pf-group nav{display:flex;gap:6px;flex-wrap:wrap}
.pf-panel button{border:1px solid #cbd5e1;background:#fff;border-radius:6px;padding:7px 9px;font:inherit;font-size:11px;font-weight:900;cursor:pointer;touch-action:manipulation}.pf-panel button:disabled{opacity:.4}.pf-panel .danger{color:#b91c1c;border-color:#fecaca}
.pf-grid{display:grid;grid-template-columns:minmax(210px,.7fr) minmax(420px,1.6fr) minmax(260px,.9fr);gap:10px;margin-top:12px}.pf-grid>aside,.pf-grid>main{border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:10px;min-width:0}.pf-grid h3{margin:0;font-size:15px}.pf-grid>aside:first-child{max-height:720px;overflow:auto}.pf-grid input{width:100%;margin:8px 0}.pf-library-help{margin:4px 0;color:#64748b;font-size:10px}
.pf-grid aside section h4,.pf-sheet-body section h4{margin:10px 0 5px;color:#64748b;font-size:11px}.pf-grid aside section>button{display:grid;grid-template-columns:auto 1fr auto;gap:3px 6px;width:100%;text-align:left;margin:5px 0;cursor:grab}.pf-grid aside section>button small{grid-column:2/-1;color:#94a3b8;overflow-wrap:anywhere}.pf-library-grab{color:#94a3b8}
.pf-title{display:flex;justify-content:space-between;gap:8px}.pf-title span{font-size:10px;color:#64748b}.pf-mobile-copy{display:none}
.pf-group{position:relative;border:1px solid #c4b5fd;background:#fff;border-radius:8px;padding:9px;margin:5px 0;box-sizing:border-box}.pf-group.root{border-color:#94a3b8;background:#f8fafc}.pf-group.sel,.pf-node.sel{outline:2px solid #7c3aed}.pf-group>header{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.pf-group>header>div{flex:1}.pf-group header b,.pf-group header small{display:block}.pf-group header small{font-size:10px;color:#64748b}.pf-root{background:#ede9fe;color:#5b21b6;border-radius:999px;padding:3px 7px;font-size:10px;font-weight:900}.pf-body{padding-left:8px;border-left:1px dashed #c4b5fd}
.pf-node{display:grid;grid-template-columns:auto auto minmax(0,1fr) auto auto;align-items:center;gap:6px;border:1px solid #cbd5e1;background:#fff;border-radius:7px;padding:8px;cursor:default;box-sizing:border-box}.pf-node small{display:block;color:#94a3b8;overflow-wrap:anywhere}.pf-node label,.pf-group label{font-size:10px;color:#64748b}.pf-grab{color:#94a3b8;cursor:grab;padding:7px;margin:-7px;user-select:none}.pf-grab:active{cursor:grabbing}.pf-node-copy{min-width:0}
.pf-conn,.pf-first{display:block;margin:5px auto;border:0!important;border-radius:999px!important}.pf-conn.and{background:#dbeafe;color:#1d4ed8}.pf-conn.or{background:#ffedd5;color:#c2410c}.pf-conn.not,.pf-first.on,.pf-node button.on,.pf-group button.on{box-shadow:0 0 0 2px #fecaca;color:#b91c1c}
.pf-slot{position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:38px;min-height:38px;box-sizing:border-box;border:1px dashed transparent;border-radius:7px;text-align:center;color:#64748b;background:transparent;transition:border-color .12s ease,background-color .12s ease,color .12s ease}.pf-slot span{font-size:10px;font-weight:900;opacity:0;visibility:hidden;transition:opacity .12s ease}.pf-panel.is-dragging .pf-slot{border-color:#bfdbfe;background:#f8fbff}.pf-panel.is-dragging .pf-slot span,.pf-slot:hover span,.pf-slot.over span{opacity:1;visibility:visible}.pf-slot:hover,.pf-slot.over{border-color:#2563eb;background:#eff6ff;color:#1d4ed8}.pf-slot::after{content:"";position:absolute;inset:3px;border-radius:5px;pointer-events:none}.pf-slot.over::after{box-shadow:inset 0 0 0 2px rgba(37,99,235,.18)}
.pf-grid footer{margin-top:8px;border-top:1px solid #e2e8f0;padding-top:8px}.pf-grid footer code{display:block;background:#0f172a;color:#e2e8f0;padding:8px;margin:5px 0;border-radius:6px;white-space:pre-wrap}.pf-kpi{background:#ede9fe;border-radius:8px;padding:10px}.pf-kpi span,.pf-kpi strong,.pf-kpi small{display:block}.pf-kpi strong{font-size:24px}.pf-apply{width:100%;margin:7px 0;background:#6d28d9!important;color:#fff}.pf-warnings,#pfWarnings{display:grid;gap:4px;font-size:10px;color:#9a3412}.pf-warnings>div,#pfWarnings>div{border:1px solid #fed7aa;background:#fff7ed;border-radius:5px;padding:5px}.pf-warnings .ok,#pfWarnings .ok{border-color:#bbf7d0;background:#f0fdf4;color:#166534}.pf-table{max-height:470px;overflow:auto;margin-top:7px;border:1px solid #e2e8f0;background:#fff}.pf-table table{min-width:570px}.pf-table th,.pf-table td{font-size:10px;padding:6px}.pf-table td:last-child{white-space:normal;min-width:220px}
.pf-mobile-actions{display:none}.pf-sheet[hidden],.pf-toast[hidden]{display:none}.pf-sheet{position:fixed;inset:0;z-index:10000}.pf-sheet-backdrop{position:absolute!important;inset:0;border:0!important;border-radius:0!important;background:rgba(15,23,42,.46)!important}.pf-sheet-dialog{position:absolute;left:0;right:0;bottom:0;max-height:82vh;display:flex;flex-direction:column;background:#fff;border-radius:18px 18px 0 0;padding:14px;box-shadow:0 -18px 50px rgba(15,23,42,.22)}.pf-sheet-dialog>header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.pf-sheet-dialog h3{margin:0;font-size:18px}.pf-sheet-dialog p{margin:3px 0 0;color:#64748b;font-size:12px}.pf-sheet-dialog>header>button{font-size:22px;line-height:1;padding:5px 10px}.pf-sheet-body{overflow:auto;padding:4px 0 18px}.pf-sheet-body section>button,.pf-sheet-target{display:grid;grid-template-columns:1fr auto;gap:3px 10px;width:100%;text-align:left;margin:6px 0;padding:11px!important}.pf-sheet-body section>button small{grid-column:1/-1;color:#94a3b8}.pf-sheet-target small{color:#64748b}.pf-sheet-empty{padding:24px 8px;text-align:center;color:#64748b}.pf-toast{position:fixed;left:50%;bottom:18px;z-index:10020;transform:translateX(-50%);display:flex;align-items:center;gap:12px;max-width:calc(100vw - 28px);background:#0f172a;color:#fff;border-radius:999px;padding:9px 11px 9px 16px;box-shadow:0 12px 30px rgba(15,23,42,.28);font-size:12px;font-weight:800}.pf-toast button{color:#c4b5fd;border-color:#475569;background:#1e293b}.pf-sheet-open{overflow:hidden}
@media(max-width:1150px){.pf-grid{grid-template-columns:240px 1fr}.pf-grid>aside:last-child{grid-column:1/-1}}
@media(max-width:720px),(pointer:coarse){.pf-panel{padding:11px;border-left-width:4px}.pf-grid{grid-template-columns:1fr}.pf-grid>aside:last-child{grid-column:auto}.pf-grid>aside:first-child{max-height:none}.pf-desktop-copy{display:none!important}.pf-mobile-copy{display:block}.pf-node{grid-template-columns:auto minmax(0,1fr) auto auto;padding:9px}.pf-node>label,.pf-node>.pf-grab,.pf-group>header>label,.pf-group>header>.pf-grab{display:none}.pf-node .pf-mobile-actions{grid-column:1/-1}.pf-mobile-actions{display:flex;gap:6px;flex-wrap:wrap}.pf-mobile-actions button{min-height:38px;flex:1}.pf-group>header>.pf-mobile-actions{flex-basis:100%}.pf-group nav{width:100%}.pf-group nav button{flex:1;min-height:40px}.pf-slot{height:46px;min-height:46px;border-color:#e2e8f0;background:#fff}.pf-slot span{opacity:1;visibility:visible;color:#94a3b8}.pf-grid aside section>button{cursor:pointer;min-height:48px}.pf-library-grab{display:none}.pf-head nav{width:100%}.pf-head nav button{flex:1;min-height:40px}.pf-sheet-dialog{max-height:86vh;padding-bottom:max(14px,env(safe-area-inset-bottom))}.pf-toast{bottom:max(14px,env(safe-area-inset-bottom))}}
`;
document.head.appendChild(style);
init().catch(console.error);
})();
