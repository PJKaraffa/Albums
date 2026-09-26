const SUPABASE_URL = 'https://relmecpdjifmlmeyubof.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_6v7O6VP7oeT5hkxzeGGgGw_QZGWVmXA';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
let albums = [], profiles = [], currentUser = null, signUpMode = false, pendingCoverFile = null, currentView = 'records';
const conditions = ['Poor (P)','Fair (F)','Good (G)','Good Plus (G+)','Very Good (VG)','Very Good Plus (VG+)','Near Mint (NM)','Mint (M)'];

function toast(message, error=false){const t=$('toast');t.textContent=message;t.className=`toast show${error?' error':''}`;setTimeout(()=>t.className='toast',2600)}
function money(value){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(Number(value)||0)}
function safe(value=''){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

async function start(){
  if(SUPABASE_URL.startsWith('YOUR_')) toast('Add your Supabase credentials in app.js',true);
  const {data:{session}}=await db.auth.getSession(); updateSession(session);
  db.auth.onAuthStateChange((_event,session)=>updateSession(session));
}
async function updateSession(session){
  $('authView').classList.toggle('hidden',!!session);$('appView').classList.toggle('hidden',!session);
  if(session){currentUser=session.user;await ensureProfile(session.user);const name=creatorName(session.user.id);$('userEmail').textContent=name;$('avatar').textContent=name[0].toUpperCase();await loadAlbums()}else currentUser=null;
}
$('authForm').addEventListener('submit',async e=>{e.preventDefault();const credentials={email:$('email').value,password:$('password').value};if(signUpMode)credentials.options={data:{username:$('username').value.trim()}};const {error}=signUpMode?await db.auth.signUp(credentials):await db.auth.signInWithPassword(credentials);if(error)return toast(error.message,true);if(signUpMode)toast('Account created. Check your email if confirmation is enabled.')});
$('toggleAuth').onclick=()=>{signUpMode=!signUpMode;$('usernameField').classList.toggle('hidden',!signUpMode);$('username').required=signUpMode;$('authTitle').textContent=signUpMode?'Create your account':'Welcome back';$('authCopy').textContent=signUpMode?'Join the Karaffa family collection.':'Sign in to open the Karaffa Vault.';$('authSubmit').textContent=signUpMode?'Create account':'Sign in';$('toggleAuth').textContent=signUpMode?'Already have an account? Sign in':'New here? Create an account'};
$('signOut').onclick=()=>db.auth.signOut();

async function ensureProfile(user){const username=user.user_metadata?.username||user.email.split('@')[0];await db.from('profiles').upsert({id:user.id,username},{onConflict:'id'});const {data}=await db.from('profiles').select('*');profiles=data||[]}
function creatorName(userId){return profiles.find(p=>p.id===userId)?.username||'Unknown'}
async function loadAlbums(){const [a,p]=await Promise.all([db.from('albums').select('*').order('artist'),db.from('profiles').select('*')]);if(a.error)return toast(a.error.message,true);albums=a.data||[];profiles=p.data||profiles;populateGenres();populateCollectors();render()}
function populateGenres(){const current=$('genreFilter').value;const genres=[...new Set(albums.map(a=>a.genre).filter(Boolean))].sort();$('genreFilter').innerHTML='<option value="">All genres</option>'+genres.map(g=>`<option>${safe(g)}</option>`).join('');$('genreFilter').value=current}
function populateCollectors(){const current=$('collectorFilter').value;const names=[...new Set(albums.map(a=>creatorName(a.user_id)))].sort();$('collectorFilter').innerHTML='<option value="">All collectors</option>'+names.map(n=>`<option>${safe(n)}</option>`).join('');$('collectorFilter').value=current}
function filteredAlbums(){
  const q=$('search').value.trim().toLowerCase(),genre=$('genreFilter').value,condition=$('conditionFilter').value,collector=$('collectorFilter').value;
  const out=albums.filter(a=>(!q||[a.artist,a.title,a.record_label,a.catalog_number,a.notes,creatorName(a.user_id)].some(v=>String(v||'').toLowerCase().includes(q)))&&(!genre||a.genre===genre)&&(!condition||a.vinyl_condition===condition)&&(!collector||creatorName(a.user_id)===collector));
  const sort=$('sort').value;return out.sort((a,b)=>sort==='title'?a.title.localeCompare(b.title):sort==='year_desc'?(b.release_year||0)-(a.release_year||0):sort==='value_desc'?(b.estimated_value||0)-(a.estimated_value||0):sort==='created_desc'?new Date(b.created_at)-new Date(a.created_at):a.artist.localeCompare(b.artist));
}
function render(){
  const list=filteredAlbums(),values=list.reduce((s,a)=>s+Number(a.estimated_value||0),0),grades=list.map(a=>conditions.indexOf(a.vinyl_condition)).filter(i=>i>=0);
  $('albumCount').textContent=list.length;$('totalValue').textContent=money(values);$('genreCount').textContent=new Set(list.map(a=>a.genre).filter(Boolean)).size;$('avgCondition').textContent=grades.length?conditions[Math.round(grades.reduce((a,b)=>a+b,0)/grades.length)].match(/\((.*?)\)/)?.[1]||'—':'—';
  $('recordsViewBtn').classList.toggle('active',currentView==='records');$('foldersViewBtn').classList.toggle('active',currentView==='folders');
  $('albumGrid').classList.toggle('hidden',currentView!=='records');$('folderGrid').classList.toggle('hidden',currentView!=='folders');$('emptyState').classList.toggle('hidden',list.length>0);
  if(currentView==='folders')return renderFolders(list);
  $('albumGrid').innerHTML=list.map(a=>`<article class="album-card"><div class="cover">${a.cover_url?`<img src="${safe(a.cover_url)}" alt="Cover of ${safe(a.title)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'cover-placeholder'}))">`:'<div class="cover-placeholder"></div>'}</div><div class="card-body"><h3 title="${safe(a.title)}">${safe(a.title)}</h3><p class="artist">${safe(a.artist)}${a.release_year?` · ${a.release_year}`:''}</p><div class="tags">${a.genre?`<span class="tag">${safe(a.genre)}</span>`:''}<span class="tag">${safe(a.format||'LP')}</span><span class="tag">${safe((a.vinyl_condition||'').match(/\((.*?)\)/)?.[1]||'—')}</span></div><p class="entered-by">Entered by <strong>${safe(creatorName(a.user_id))}</strong></p><div class="card-meta"><span class="value">${money(a.estimated_value)}</span><div class="card-actions">${a.user_id===currentUser?.id?`<button onclick="editAlbum('${a.id}')" title="Edit">✎</button><button class="delete" onclick="deleteAlbum('${a.id}')" title="Delete">⌫</button>`:''}</div></div></div></article>`).join('');
}
function renderFolders(list){
  const groups=new Map();list.forEach(a=>{const genre=a.genre||'Uncategorized';if(!groups.has(genre))groups.set(genre,[]);groups.get(genre).push(a)});
  $('folderGrid').innerHTML=[...groups].sort((a,b)=>a[0].localeCompare(b[0])).map(([genre,items])=>{const covers=items.filter(a=>a.cover_url).slice(0,3),value=items.reduce((sum,a)=>sum+Number(a.estimated_value||0),0);return `<button class="genre-folder" type="button" data-genre="${safe(genre)}"><span class="folder-tab"></span><span class="folder-covers">${covers.length?covers.map(a=>`<img src="${safe(a.cover_url)}" alt="" loading="lazy">`).join(''):'<span class="folder-record">♪</span>'}</span><span class="folder-info"><span><strong>${safe(genre)}</strong><small>${items.length} ${items.length===1?'album':'albums'}</small></span><b>${money(value)}</b></span></button>`}).join('');
  document.querySelectorAll('.genre-folder').forEach(folder=>folder.onclick=()=>{$('genreFilter').value=folder.dataset.genre==='Uncategorized'?'':folder.dataset.genre;currentView='records';render()});
}
$('recordsViewBtn').onclick=()=>{currentView='records';render()};
$('foldersViewBtn').onclick=()=>{currentView='folders';render()};
$('search').addEventListener('input',render);
['genreFilter','conditionFilter','collectorFilter','sort'].forEach(id=>{
  $(id).addEventListener('input',render);
  $(id).addEventListener('change',render);
});
function showCoverPreview(src=''){const img=$('coverPreview');img.classList.toggle('hidden',!src);$('coverPrompt').classList.toggle('hidden',!!src);if(src)img.src=src;else img.removeAttribute('src')}
function selectCover(file){if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type))return toast('Please choose a PNG, JPG, or WEBP image.',true);if(file.size>5*1024*1024)return toast('Cover images must be 5 MB or smaller.',true);pendingCoverFile=file;$('coverUrl').value='';showCoverPreview(URL.createObjectURL(file))}
async function uploadCover(userId){if(!pendingCoverFile)return $('coverUrl').value.trim()||null;const ext=(pendingCoverFile.name.split('.').pop()||pendingCoverFile.type.split('/')[1]||'jpg').replace(/[^a-z0-9]/gi,'');const path=`${userId}/${crypto.randomUUID()}.${ext}`;const {error}=await db.storage.from('album-covers').upload(path,pendingCoverFile,{contentType:pendingCoverFile.type,upsert:false});if(error)throw error;return db.storage.from('album-covers').getPublicUrl(path).data.publicUrl}
function openDialog(album={}){$('albumForm').reset();pendingCoverFile=null;$('albumId').value=album.id||'';$('dialogTitle').textContent=album.id?'Edit album':'Add an album';$('enteredBy').innerHTML=profiles.slice().sort((a,b)=>a.username.localeCompare(b.username)).map(p=>`<option value="${p.id}">${safe(p.username)}</option>`).join('');$('enteredBy').value=album.user_id||currentUser.id;const map={artist:'artist',title:'title',releaseYear:'release_year',genre:'genre',style:'style',format:'format',vinylCondition:'vinyl_condition',sleeveCondition:'sleeve_condition',recordLabel:'record_label',catalogNumber:'catalog_number',country:'country',purchasePrice:'purchase_price',estimatedValue:'estimated_value',acquiredDate:'acquired_date',location:'location',coverUrl:'cover_url',notes:'notes'};Object.entries(map).forEach(([id,key])=>{if(album[key]!=null)$(id).value=album[key]});showCoverPreview(album.cover_url||'');$('albumDialog').showModal()}
window.editAlbum=id=>openDialog(albums.find(a=>a.id===id));
window.deleteAlbum=async id=>{if(!confirm('Remove this album from your collection?'))return;const {error}=await db.from('albums').delete().eq('id',id);if(error)return toast(error.message,true);toast('Album removed');await loadAlbums()};
[$('addBtn'),$('addNav'),...document.querySelectorAll('.add-trigger')].forEach(b=>b.onclick=()=>openDialog());$('closeDialog').onclick=$('cancelBtn').onclick=()=>$('albumDialog').close();
$('chooseCover').onclick=()=>$('coverFile').click();$('coverDropZone').onclick=e=>{if(e.target.id==='coverDropZone'||e.target.id==='coverPrompt')$('coverFile').click()};$('coverFile').onchange=e=>selectCover(e.target.files[0]);
['dragenter','dragover'].forEach(type=>$('coverDropZone').addEventListener(type,e=>{e.preventDefault();$('coverDropZone').classList.add('dragging')}));['dragleave','drop'].forEach(type=>$('coverDropZone').addEventListener(type,e=>{e.preventDefault();$('coverDropZone').classList.remove('dragging');if(type==='drop')selectCover(e.dataTransfer.files[0])}));
document.addEventListener('paste',e=>{if(!$('albumDialog').open)return;const file=[...e.clipboardData.items].find(i=>i.type.startsWith('image/'))?.getAsFile();if(file){e.preventDefault();selectCover(file)}});
$('coverUrl').addEventListener('change',()=>{pendingCoverFile=null;showCoverPreview($('coverUrl').value.trim())});$('removeCover').onclick=()=>{pendingCoverFile=null;$('coverUrl').value='';showCoverPreview('')};
$('albumForm').addEventListener('submit',async e=>{e.preventDefault();const {data:{user}}=await db.auth.getUser();const id=$('albumId').value;let coverUrl;try{coverUrl=await uploadCover(user.id)}catch(error){return toast(`Cover upload failed: ${error.message}`,true)}const value={user_id:id?$('enteredBy').value:user.id,artist:$('artist').value.trim(),title:$('title').value.trim(),release_year:$('releaseYear').value||null,genre:$('genre').value.trim()||null,style:$('style').value.trim()||null,format:$('format').value,vinyl_condition:$('vinylCondition').value,sleeve_condition:$('sleeveCondition').value,record_label:$('recordLabel').value.trim()||null,catalog_number:$('catalogNumber').value.trim()||null,country:$('country').value.trim()||null,purchase_price:$('purchasePrice').value||null,estimated_value:$('estimatedValue').value||null,acquired_date:$('acquiredDate').value||null,location:$('location').value.trim()||null,cover_url:coverUrl,notes:$('notes').value.trim()||null};const {error}=id?await db.from('albums').update(value).eq('id',id):await db.from('albums').insert(value);if(error)return toast(error.message,true);$('albumDialog').close();toast(id?'Album updated':'Album added');await loadAlbums()});
$('exportBtn').onclick=()=>{const headers=['Artist','Album','Year','Genre','Format','Vinyl Condition','Sleeve Condition','Label','Catalog Number','Country','Purchase Price','Estimated Value','Acquired Date','Location','Notes'];const rows=filteredAlbums().map(a=>[a.artist,a.title,a.release_year,a.genre,a.format,a.vinyl_condition,a.sleeve_condition,a.record_label,a.catalog_number,a.country,a.purchase_price,a.estimated_value,a.acquired_date,a.location,a.notes]);const csv=[headers,...rows].map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const link=Object.assign(document.createElement('a'),{href:url,download:'lp-collection.csv'});link.click();URL.revokeObjectURL(url)};
start();
