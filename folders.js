const SUPABASE_URL='https://relmecpdjifmlmeyubof.supabase.co';
const SUPABASE_ANON_KEY='sb_publishable_6v7O6VP7oeT5hkxzeGGgGw_QZGWVmXA';
const db=supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id);
let albums=[],profiles=[],level='genres',selectedGenre='',selectedStyle='';

const safe=(value='')=>String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(Number(value)||0);
const creatorName=id=>profiles.find(p=>p.id===id)?.username||'Unknown';
const genreOf=a=>a.genre?.trim()||'Uncategorized';
const styleOf=a=>a.style?.trim()||'No Style Assigned';

async function start(){
  const {data:{session}}=await db.auth.getSession();
  if(!session){location.href='index.html';return}
  const [a,p]=await Promise.all([db.from('albums').select('*'),db.from('profiles').select('id,username')]);
  if(a.error){showError(a.error.message);return}
  albums=a.data||[];profiles=p.data||[];
  const name=creatorName(session.user.id);$('userName').textContent=name;$('avatar').textContent=name[0]?.toUpperCase()||'K';
  render();
}

function showError(message){$('folderEmpty').classList.remove('hidden');$('folderEmpty').querySelector('h3').textContent='Unable to load collection';$('folderEmpty').querySelector('p').textContent=message}
function groupBy(items,keyFn){return items.reduce((map,item)=>{const key=keyFn(item);if(!map.has(key))map.set(key,[]);map.get(key).push(item);return map},new Map())}
function folderCard(name,items,type){const value=items.reduce((sum,a)=>sum+Number(a.estimated_value||0),0);return `<button class="folder-card" data-type="${type}" data-name="${safe(name)}"><div class="folder-icon"></div><h2>${safe(name)}</h2><div class="folder-meta"><span>${items.length} album${items.length===1?'':'s'}</span><span class="folder-value">${money(value)}</span></div></button>`}

function render(){
  const q=$('folderSearch').value.trim().toLowerCase();
  $('folderGrid').innerHTML='';$('folderAlbums').innerHTML='';$('folderEmpty').classList.add('hidden');
  if(level==='genres')renderGenres(q);else if(level==='styles')renderStyles(q);else renderAlbums(q);
  renderBreadcrumbs();
}

function renderGenres(q){
  $('pageTitle').textContent='Genre Folders';$('pageSubtitle').textContent='Choose a genre, then open one of its styles.';
  const groups=[...groupBy(albums,genreOf)].filter(([name])=>name.toLowerCase().includes(q)).sort(([a],[b])=>a.localeCompare(b));
  $('folderGrid').innerHTML=groups.map(([name,items])=>folderCard(name,items,'genre')).join('');
  $('resultSummary').textContent=`${groups.length} genres · ${albums.length} albums`;
  toggleEmpty(groups.length);
}

function renderStyles(q){
  const genreAlbums=albums.filter(a=>genreOf(a)===selectedGenre);
  $('pageTitle').textContent=selectedGenre;$('pageSubtitle').textContent='Choose a style to see its albums.';
  const groups=[...groupBy(genreAlbums,styleOf)].filter(([name])=>name.toLowerCase().includes(q)).sort(([a],[b])=>a.localeCompare(b));
  const all=q?[]:[[`All ${selectedGenre}`,genreAlbums]];
  $('folderGrid').innerHTML=[...all,...groups].map(([name,items],i)=>folderCard(name,items,i===0&&!q?'all-style':'style')).join('');
  $('resultSummary').textContent=`${groups.length} styles · ${genreAlbums.length} albums`;
  toggleEmpty(groups.length);
}

function renderAlbums(q){
  let list=albums.filter(a=>genreOf(a)===selectedGenre&&(selectedStyle==='*'||styleOf(a)===selectedStyle));
  list=list.filter(a=>[a.artist,a.title,a.release_year,a.record_label,creatorName(a.user_id)].some(v=>String(v||'').toLowerCase().includes(q))).sort((a,b)=>a.artist.localeCompare(b.artist)||Number(a.release_year||9999)-Number(b.release_year||9999)||a.title.localeCompare(b.title));
  $('pageTitle').textContent=selectedStyle==='*'?selectedGenre:selectedStyle;$('pageSubtitle').textContent=`Albums in ${selectedGenre}${selectedStyle==='*'?'':` / ${selectedStyle}`}.`;
  $('folderAlbums').innerHTML=list.map(albumCard).join('');
  $('resultSummary').textContent=`${list.length} albums · ${money(list.reduce((s,a)=>s+Number(a.estimated_value||0),0))}`;
  toggleEmpty(list.length);
}

function albumCard(a){const condition=(a.vinyl_condition||'').match(/\((.*?)\)/)?.[1]||'—';const cover=a.cover_url?`<img src="${safe(a.cover_url)}" alt="Cover of ${safe(a.title)}" loading="lazy">`:'<div class="cover-placeholder"></div>';return `<article class="album-card"><div class="cover">${cover}</div><div class="card-body"><h3 title="${safe(a.title)}">${safe(a.title)}</h3><p class="artist">${safe(a.artist)}${a.release_year?` · ${a.release_year}`:''}</p><div class="tags"><span class="tag">${safe(genreOf(a))}</span><span class="tag">${safe(styleOf(a))}</span><span class="tag">${safe(condition)}</span></div><p class="entered-by">Entered by <strong>${safe(creatorName(a.user_id))}</strong></p><div class="card-meta"><span class="value">${money(a.estimated_value)}</span></div></div></article>`}
function toggleEmpty(count){$('folderEmpty').classList.toggle('hidden',count>0)}
function renderBreadcrumbs(){let html='<button data-level="genres">All Genres</button>';if(level!=='genres')html+=`<span>›</span><button data-level="styles">${safe(selectedGenre)}</button>`;if(level==='albums')html+=`<span>›</span><strong>${safe(selectedStyle==='*'?'All Albums':selectedStyle)}</strong>`;$('breadcrumbs').innerHTML=html}

$('folderGrid').addEventListener('click',e=>{const card=e.target.closest('.folder-card');if(!card)return;const type=card.dataset.type,name=card.dataset.name;if(type==='genre'){selectedGenre=name;level='styles'}else{selectedStyle=type==='all-style'?'*':name;level='albums'}$('folderSearch').value='';render();window.scrollTo({top:0,behavior:'smooth'})});
$('breadcrumbs').addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;level=button.dataset.level;if(level==='genres'){selectedGenre='';selectedStyle=''}else selectedStyle='';$('folderSearch').value='';render()});
$('folderSearch').addEventListener('input',render);
$('signOut').addEventListener('click',async()=>{await db.auth.signOut();location.href='index.html'});
start();
