// ---------- camada de dados no localStorage ----------
const DB_USERS = 'imp_users_v1'
const DB_REQUESTS = 'imp_reqs_v1'
const DB_NOTIFS = 'imp_notifs_v1'
const MAX_FILE_MB = 3

function load(key){try{return JSON.parse(localStorage.getItem(key)||'[]')}catch(e){return []}}
function save(key,val){localStorage.setItem(key,JSON.stringify(val))}

// init demo admin if none
if(!load(DB_USERS).length){
  save(DB_USERS,[{id:1,name:'Protocolo',email:'protocolo@escola.local',pass:'123',type:'protocolo'}])
}

// utilities
function uid(prefix='id'){return prefix+'_'+Math.random().toString(36).slice(2,9)}
function now(){return new Date().toISOString()}

// auth
let session = null
function setSession(user){session=user; localStorage.setItem('imp_session', JSON.stringify(user)); renderUI()}
function clearSession(){session=null; localStorage.removeItem('imp_session'); renderUI()}
(function(){const s = localStorage.getItem('imp_session'); if(s) session=JSON.parse(s)})()

const el = id=>document.getElementById(id)

// registrar
el('btn-register').addEventListener('click',()=>{
  const name=el('reg-name').value.trim(); const email=el('reg-email').value.trim(); const pass=el('reg-pass').value; const turma=el('reg-turma').value.trim(); const type=el('reg-type').value
  if(!name||!email||!pass){alert('Preencha nome, email e senha');return}
  const users=load(DB_USERS)
  if(users.find(u=>u.email===email)){alert('Email já cadastrado');return}
  const u={id:uid('u'),name, email, pass, turma, type}
  users.push(u); save(DB_USERS,users); alert('Usuário salvo. Faça login.');
  el('reg-name').value='';el('reg-email').value='';el('reg-pass').value='';el('reg-turma').value='';
})

el('btn-login').addEventListener('click',()=>{
  const email=el('login-email').value.trim(); const pass=el('login-pass').value
  if(!email||!pass){alert('Preencha email e senha');return}
  const users=load(DB_USERS)
  const u=users.find(x=>x.email===email && x.pass===pass)
  if(!u){alert('Credenciais inválidas');return}
  setSession(u); el('btn-logout').style.display='inline-block'
})
el('btn-logout').addEventListener('click',()=>{clearSession(); el('btn-logout').style.display='none'})

el('btn-show-register').addEventListener('click',()=>{window.scrollTo(0,0); el('reg-name').focus()})

// requests
el('req-file').addEventListener('change',handleFile)
let lastFileData = null
function handleFile(ev){const f=ev.target.files[0]; if(!f){lastFileData=null; el('file-preview').textContent=''; return}
  if(f.size > MAX_FILE_MB*1024*1024){alert('Arquivo maior que '+MAX_FILE_MB+'MB'); ev.target.value=''; lastFileData=null; return}
  const reader=new FileReader(); reader.onload=()=>{ lastFileData={name:f.name, data:reader.result, type:f.type}; el('file-preview').textContent=f.name }
  reader.readAsDataURL(f)
}

el('btn-submit-req').addEventListener('click',()=>{
  if(!session){alert('Faça login primeiro'); return}
  const name=el('req-name').value.trim()||session.name
  const turma=el('req-turma').value.trim()||session.turma||''
  const qty=el('req-qty').value.trim(); const desc=el('req-desc').value.trim()
  if(!qty||isNaN(Number(qty))){alert('Informe a quantidade de folhas (número)'); return}
  if(!lastFileData){alert('Anexe um arquivo'); return}
  const reqs=load(DB_REQUESTS)
  const r={id:uid('r'), userId:session.id, name, turma, qty: Number(qty), desc, fileName:lastFileData.name, fileData:lastFileData.data, status:'pendente', createdAt:now(), doneAt:null}
  reqs.push(r); save(DB_REQUESTS, reqs)
  alert('Pedido cadastrado com sucesso')
  
  el('req-file').value=''; el('file-preview').textContent=''; lastFileData=null
  el('req-desc').value=''; el('req-qty').value=''
  renderUI()
})

// protocol actions
function markDone(reqId){const reqs=load(DB_REQUESTS); const r=reqs.find(x=>x.id===reqId); if(!r) return; r.status='concluida'; r.doneAt=now(); save(DB_REQUESTS, reqs);
  // gera a notiificaçao 
  const nots=load(DB_NOTIFS); nots.push({id:uid('n'), userId:r.userId, message:'Sua impressão "'+r.fileName+'" foi concluída.', createdAt:now(), seen:false}); save(DB_NOTIFS,nots);
  renderUI()
}

function cancelReq(reqId){const reqs=load(DB_REQUESTS); const idx=reqs.findIndex(x=>x.id===reqId); if(idx>-1){reqs.splice(idx,1); save(DB_REQUESTS,reqs); renderUI()}}

// renderizar
function renderUI(){
  
  const ui = el('user-info'); if(session){ui.innerHTML=`<h3>${session.name}</h3><p class="muted">${session.email} — <strong>${session.type}</strong></p>`; el('btn-logout').style.display='inline-block'}else{ui.innerHTML=`<h3>Visitante</h3><p class="muted">Faça login para começar.</p>`; el('btn-logout').style.display='none'}

  // seçoes laterais
  el('login-section').style.display = session ? 'none':'block'
  el('dashboard-section').style.display = (session && session.type!=='protocolo') ? 'block':'none'
  el('protocol-section').style.display = (session && session.type==='protocolo') ? 'block':'none'

  
  const allReqs = load(DB_REQUESTS)
  const myReqs = session ? allReqs.filter(r=>r.userId===session.id) : []
  const myList = el('my-requests'); myList.innerHTML=''
  if(!myReqs.length) myList.innerHTML='<p class="muted">Nenhum pedido.</p>'
  myReqs.slice().reverse().forEach(r=>{
    const div = document.createElement('div'); div.className='request'
    div.innerHTML = `
      <div style="width:64px">${fileThumbnail(r)}</div>
      <div style="flex:1">
        <div><strong>${r.fileName}</strong> <span class="tiny">(${r.qty} folhas)</span></div>
        <div class="tiny">${r.turma} • ${new Date(r.createdAt).toLocaleString()}</div>
        <div class="muted">${r.desc||''}</div>
      </div>
      <div style="text-align:right">
        <div class="status ${r.status==='pendente'?'pending':'done'}">${r.status}</div>
        ${r.status==='pendente'?`<div style="margin-top:8px"><button onclick="downloadFile('${r.id}')">Baixar</button></div>`:''}
      </div>
    `
    myList.appendChild(div)
  })

  
  const queue = el('queue-list'); queue.innerHTML=''
  const pending = allReqs.filter(x=>x.status==='pendente')
  if(!pending.length) queue.innerHTML='<p class="muted">Fila vazia.</p>'
  pending.forEach(r=>{
    const item = document.createElement('div'); item.className='request'
    item.innerHTML = `
      <div class="file-thumb center">${r.fileName.split('.').pop().toUpperCase()}</div>
      <div style="flex:1">
        <div><strong>${r.fileName}</strong></div>
        <div class="tiny">${r.name} — ${r.turma} • ${r.qty} folhas</div>
      </div>
      <div style="text-align:right">
        <div class="tiny">${new Date(r.createdAt).toLocaleString()}</div>
        <div style="margin-top:8px"><button onclick="markDone('${r.id}')" class="primary">Marcar concluído</button> <button onclick="cancelReq('${r.id}')">Cancelar</button></div>
      </div>
    `
    queue.appendChild(item)
  })

  // Historico
  const history = el('history-list'); history.innerHTML=''
  const done = allReqs.filter(x=>x.status==='concluida')
  if(!done.length) history.innerHTML='<p class="muted">Sem histórico.</p>'
  done.slice().reverse().forEach(r=>{
    const d = document.createElement('div'); d.className='request'
    d.innerHTML = `
      <div class="file-thumb center">OK</div>
      <div style="flex:1">
        <div><strong>${r.fileName}</strong></div>
        <div class="tiny">${r.name} • ${r.turma} • ${r.qty} folhas</div>
        <div class="muted">Concluído em ${new Date(r.doneAt).toLocaleString()}</div>
      </div>
    `
    history.appendChild(d)
  })

  // Notificaçoes 
  const nots = load(DB_NOTIFS)
  const myNot = session ? nots.filter(n=>n.userId===session.id) : []
  const notEl = el('notifications'); notEl.innerHTML=''
  if(!myNot.length) notEl.innerHTML='<li class="muted">Sem notificações</li>'
  myNot.slice().reverse().forEach(n=>{ const li=document.createElement('li'); li.className='tiny'; li.textContent = `${new Date(n.createdAt).toLocaleString()} — ${n.message}`; notEl.appendChild(li) })

  
  el('total-requests').textContent = allReqs.length
  el('total-pending').textContent = allReqs.filter(x=>x.status==='pendente').length
}

function fileThumbnail(r){ if(r.fileData && r.fileData.startsWith('data:image')){ return `<img src="${r.fileData}" style="width:56px;height:56px;object-fit:cover;border-radius:6px">` } return `<div class="file-thumb center">${r.fileName.split('.').pop().toUpperCase()}</div>` }

window.markDone = markDone; window.cancelReq = cancelReq; window.downloadFile = function(id){const reqs=load(DB_REQUESTS); const r=reqs.find(x=>x.id===id); if(!r) return; const a=document.createElement('a'); a.href=r.fileData||'#'; a.download=r.fileName||'file'; document.body.appendChild(a); a.click(); a.remove();}


el('btn-view-queue').addEventListener('click',()=>{el('protocol-section').style.display='block'; el('dashboard-section').style.display='none'; el('login-section').style.display='none'})
el('btn-view-dashboard').addEventListener('click',()=>{el('dashboard-section').style.display='block'; el('protocol-section').style.display='none'; el('login-section').style.display='none'})
el('btn-view-history').addEventListener('click',()=>{el('dashboard-section').style.display='none'; el('protocol-section').style.display='none'; el('login-section').style.display='none'; /* show history in dashboard area by making dashboard visible if user */ })

// exportar csv
el('btn-export-csv').addEventListener('click',()=>{
  const reqs=load(DB_REQUESTS);
  if(!reqs.length){alert('Sem pedidos para exportar');return}
  const rows=[['id','nome','turma','quantidade','arquivo','status','data_pedido','data_conclusao']]
  reqs.forEach(r=>rows.push([r.id, r.name, r.turma, r.qty, r.fileName, r.status, r.createdAt, r.doneAt||'']))
  const csv = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob([csv],{type:'text/csv'}); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='impressoes.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
})

// chama a funçao princpal
renderUI()