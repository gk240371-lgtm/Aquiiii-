
async function checkNixToken(){
  const el=document.getElementById("nixStatus");
  if(!el) return;
  try{
    const r=await fetch(apiUrl("/api/token/status"));
    const d=await r.json();
    el.textContent=d.configured
      ? "Nix API: conectada ao Render ✓"
      : "Nix API: token não configurado no Render ✗";
  }catch(e){
    el.textContent="Nix API: backend offline ✗";
  }
}
const BACKEND_URL = String(window.__BACKEND_URL__ || "").replace(/\/+$/, "");
const $ = id => document.getElementById(id);

function apiUrl(path){ return BACKEND_URL + path; }
function showToast(text){ const t=$("toast"); t.textContent=text; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),2500); }
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

async function api(path,opts={}){
  const headers={...(opts.headers||{})};
  if(opts.body && !headers["Content-Type"]) headers["Content-Type"]="application/json";
  const r=await fetch(apiUrl(path),{...opts,headers});
  const data=await r.json().catch(()=>({error:"Resposta inválida do backend."}));
  if(!r.ok) throw new Error(data.detail||data.error||`HTTP ${r.status}`);
  return data;
}

async function checkBackend(){
  try{
    const r=await fetch(apiUrl("/health"),{cache:"no-store"});
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error();
    $("connection").textContent="● Backend online";
    $("connection").className="connection ok";
    $("backendStatus").textContent="Online";
    $("apiDot").textContent="● Backend online";
    $("apiDot").className="status-pill ok";
    $("tokenStatus").textContent=d.nix_token_configured?"Configurado ✓":"Não configurado";
    $("tokenStatus").className=d.nix_token_configured?"ok":"err";
    return true;
  }catch{
    $("connection").textContent="● Backend offline";
    $("connection").className="connection err";
    $("backendStatus").textContent="Offline";
    $("apiDot").textContent="● Backend offline";
    $("apiDot").className="status-pill err";
    $("tokenStatus").textContent="Indisponível";
    $("tokenStatus").className="err";
    return false;
  }
}

function modeChanged(){
  const br=$("mode").value==="br_padrao";
  $("brFields").hidden=!br;
  $("ouroField").hidden=br;
  $("delay").max=br?20:10;
  if(!br && Number($("delay").value)>10) $("delay").value=10;
}

async function createRoom(){
  const btn=$("createBtn"); btn.disabled=true;
  $("createOut").textContent="Criando sala...";
  try{
    const mode=$("mode").value;
    const body={
      password:$("roomPass").value,
      start_delay_minutes:Number($("delay").value),
      config_type:mode,
      room_name:$("roomName").value,
      map_name:$("map").value
    };
    if(mode!=="br_padrao") body["1500_ouro"]=$("ouro1500").checked;
    if(mode==="br_padrao"){body.equipe=$("team").value;body.espectadores=Number($("spec").value);}
    const d=await api("/api/rooms",{method:"POST",body:JSON.stringify(body)});
    $("session").value=d.session_id||"";
    $("statSession").textContent=d.session_id||"Criada";
    $("createOut").textContent=JSON.stringify(d,null,2);
    $("roomInfo").innerHTML=`
      <div class="result-grid">
        <div><small>Session ID</small><b>${esc(d.session_id||"—")}</b></div>
        <div><small>Room ID</small><b>${esc(d.room_id||"—")}</b></div>
        <div><small>Senha</small><b>${esc(d.password||body.password||"—")}</b></div>
        <div><small>Status</small><b>${esc(d.status||"—")}</b></div>
        <div><small>Convite</small><b>${esc(d.invite_code||"—")}</b></div>
      </div>
      ${d.invite_link?`<a class="invite" target="_blank" rel="noopener" href="${esc(d.invite_link)}">🔗 Abrir convite no Free Fire</a>`:""}`;
    showToast("Sala criada! ID e senha exibidos.");
  }catch(e){ $("createOut").textContent=e.message; showToast("Erro ao criar sala"); }
  finally{btn.disabled=false;}
}

function sid(){const v=$("session").value.trim();if(!v)throw new Error("Informe a Session ID.");return encodeURIComponent(v);}

async function roomStatus(){try{$("resultOut").textContent=JSON.stringify(await api(`/api/rooms/${sid()}`),null,2);}catch(e){$("resultOut").textContent=e.message;}}
async function loadMembers(){
  try{
    const d=await api(`/api/rooms/${sid()}/members?include_loadout=true`);
    $("members").innerHTML=(d.members||[]).map(m=>`<div class="member"><span><b>${esc(m.nickname)}</b><br><small>UID ${esc(m.player_uid)} · Time ${esc(m.team)} · ${esc(m.platform)}</small></span><button class="danger" onclick="kick('${esc(m.player_uid)}')">Expulsar</button></div>`).join("")||'<div class="empty">Nenhum jogador.</div>';
  }catch(e){$("members").textContent=e.message;}
}
async function kick(uid){if(!confirm("Expulsar este jogador?"))return;try{await api(`/api/rooms/${sid()}/kick`,{method:"POST",body:JSON.stringify({player_uid:uid})});await loadMembers();showToast("Jogador expulso.");}catch(e){alert(e.message);}}
async function startRoom(){try{$("resultOut").textContent=JSON.stringify(await api(`/api/rooms/${sid()}/start`,{method:"POST"}),null,2);showToast("Comando de início enviado.");}catch(e){$("resultOut").textContent=e.message;}}
async function result(){try{$("resultOut").textContent=JSON.stringify(await api(`/api/rooms/${sid()}/result`),null,2);}catch(e){$("resultOut").textContent=e.message;}}
async function releaseRoom(){if(!confirm("Encerrar a sala e liberar a sessão?"))return;try{$("resultOut").textContent=JSON.stringify(await api(`/api/rooms/${sid()}/release`,{method:"POST"}),null,2);showToast("Sala encerrada.");}catch(e){$("resultOut").textContent=e.message;}}
async function balance(){try{$("balanceOut").textContent=JSON.stringify(await api("/api/balance"),null,2);}catch(e){$("balanceOut").textContent=e.message;}}

window.addEventListener("error",e=>console.error(e.error||e.message));
window.addEventListener("unhandledrejection",e=>console.error(e.reason));
modeChanged();
checkBackend();

checkNixToken();
