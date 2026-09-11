const BACKEND_URL = String(window.__BACKEND_URL__ || "").replace(/\/+$/, "");
let auth = localStorage.getItem("nix_admin_token") || "";
const $ = id => document.getElementById(id);

function apiUrl(path){ return BACKEND_URL + path; }
function showToast(text){ const t=$("toast"); t.textContent=text; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),2500); }
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

async function api(path,opts={}){
  const headers={...(opts.headers||{}),"Authorization":`Bearer ${auth}`,"Content-Type":"application/json"};
  const r=await fetch(apiUrl(path),{...opts,headers});
  const data=await r.json().catch(()=>({error:"Resposta inválida do backend."}));
  if(!r.ok) throw new Error(data.detail||data.error||`HTTP ${r.status}`);
  return data;
}

async function checkBackend(){
  if(!BACKEND_URL){
    $("connection").textContent="● BACKEND_URL não configurado";
    $("connection").className="connection err";
    $("backendStatus").textContent="Não configurado";
    return false;
  }
  try{
    const r=await fetch(apiUrl("/health"));
    if(!r.ok) throw new Error();
    $("connection").textContent="● Backend online";
    $("connection").className="connection ok";
    $("backendStatus").textContent="Online";
    $("apiDot").textContent="● Backend online";
    $("apiDot").className="status-pill ok";
    return true;
  }catch{
    $("connection").textContent="● Backend offline";
    $("connection").className="connection err";
    $("backendStatus").textContent="Offline";
    $("apiDot").textContent="● Backend offline";
    $("apiDot").className="status-pill err";
    return false;
  }
}

async function login(){
  $("loginMsg").textContent="";
  if(!(await checkBackend())){
    $("loginMsg").textContent="O backend ainda não está conectado ao Netlify.";
    $("loginMsg").className="message err";
    return;
  }
  try{
    const r=await fetch(apiUrl("/api/login"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:$("loginPass").value})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d.error||`HTTP ${r.status}`);
    auth=d.token; localStorage.setItem("nix_admin_token",auth);
    showApp(); showToast("Login realizado!");
  }catch(e){$("loginMsg").textContent=e.message;$("loginMsg").className="message err";}
}

function showApp(){ $("login").hidden=true; $("app").hidden=false; checkBackend(); tokenStatus(); }
function logout(){localStorage.removeItem("nix_admin_token");location.reload();}

async function tokenStatus(){
  try{
    const d=await api("/api/token/status");
    $("tokenStatus").textContent=d.configured?"Configurado ✓":"Não configurado";
    $("tokenStatus").className=d.configured?"ok":"err";
  }catch{$("tokenStatus").textContent="Indisponível";$("tokenStatus").className="err";}
}

async function saveToken(){
  try{
    const token=$("apiToken").value.trim();
    if(!token) throw new Error("Cole o token antes de salvar.");
    await api("/api/token",{method:"POST",body:JSON.stringify({token})});
    $("apiToken").value=""; await tokenStatus(); showToast("Token salvo com segurança.");
  }catch(e){$("tokenMsg").textContent=e.message;$("tokenMsg").className="message err";}
}

function modeChanged(){
  const br=$("mode").value==="br_padrao";
  $("brFields").hidden=!br;
  $("delay").max=br?20:10;
  if(!br && Number($("delay").value)>10) $("delay").value=10;
}

async function createRoom(){
  try{
    const mode=$("mode").value;
    const body={password:$("roomPass").value,start_delay_minutes:Number($("delay").value),config_type:mode,room_name:$("roomName").value,map_name:$("map").value};
    if(mode==="br_padrao"){body.equipe=$("team").value;body.espectadores=Number($("spec").value);}
    const d=await api("/api/rooms",{method:"POST",body:JSON.stringify(body)});
    $("session").value=d.session_id||"";$("statSession").textContent=d.session_id||"Criada";
    $("createOut").textContent=JSON.stringify(d,null,2);
    $("roomInfo").innerHTML=`<b>Sala:</b> ${esc(d.room_name||"—")}<br><b>Room ID:</b> ${esc(d.room_id||"—")}<br><b>Convite:</b> ${esc(d.invite_code||"—")}${d.invite_link?`<br><a target="_blank" rel="noopener" href="${esc(d.invite_link)}">Abrir convite</a>`:""}`;
    showToast("Sala criada!");
  }catch(e){$("createOut").textContent=e.message;}
}
function sid(){const v=$("session").value.trim();if(!v)throw new Error("Informe a Session ID.");return encodeURIComponent(v);}
async function loadMembers(){
  try{const d=await api(`/api/rooms/${sid()}/members?include_loadout=true`);$("members").innerHTML=(d.members||[]).map(m=>`<div class="member"><span><b>${esc(m.nickname)}</b><br><small>UID ${esc(m.player_uid)} · Time ${esc(m.team)} · ${esc(m.platform)}</small></span><button class="danger" onclick="kick('${esc(m.player_uid)}')">Expulsar</button></div>`).join("")||'<div class="empty">Nenhum jogador.</div>';}catch(e){$("members").textContent=e.message;}
}
async function kick(uid){if(!confirm("Expulsar este jogador?"))return;try{await api(`/api/rooms/${sid()}/kick`,{method:"POST",body:JSON.stringify({player_uid:uid})});await loadMembers();showToast("Jogador expulso.");}catch(e){alert(e.message);}}
async function startRoom(){try{$("resultOut").textContent=JSON.stringify(await api(`/api/rooms/${sid()}/start`,{method:"POST"}),null,2);showToast("Comando de início enviado.");}catch(e){$("resultOut").textContent=e.message;}}
async function result(){try{$("resultOut").textContent=JSON.stringify(await api(`/api/rooms/${sid()}/result`),null,2);}catch(e){$("resultOut").textContent=e.message;}}
async function releaseRoom(){if(!confirm("Encerrar a sala e liberar a sessão?"))return;try{$("resultOut").textContent=JSON.stringify(await api(`/api/rooms/${sid()}/release`,{method:"POST"}),null,2);showToast("Sala encerrada.");}catch(e){$("resultOut").textContent=e.message;}}
async function balance(){try{$("balanceOut").textContent=JSON.stringify(await api("/api/balance"),null,2);}catch(e){$("balanceOut").textContent=e.message;}}

$("loginPass").addEventListener("keydown",e=>{if(e.key==="Enter")login();});
modeChanged();
if(auth&&BACKEND_URL)showApp();else checkBackend();
