import { auth, db, ADMIN_EMAIL } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, addDoc, updateDoc, deleteDoc, getDocs, getDoc,
  doc, query, orderBy, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Auth ────────────────────────────────────────────────────
let _currentUser = null;
let _isAdmin     = false;
let _userRole    = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "index.html"; return; }
  _currentUser = user;
  _isAdmin     = user.email === ADMIN_EMAIL;
  if (!_isAdmin) {
    try {
      const memDoc = await getDoc(doc(db, "membros", user.uid));
      _userRole = memDoc.exists() ? (memDoc.data().role || null) : null;
    } catch (e) { _userRole = null; }
  } else {
    _userRole = "admin";
  }
  document.getElementById("user-name").textContent = user.displayName || user.email;
  aplicarPermissoes();
  init();
  loadNotifBadge(user.uid);
});

// ── Permissões ───────────────────────────────────────────────
const PERMISSOES = {
  "btn-novo-orixa":       ["admin"],
  "btn-nova-data":        ["admin"],
  "btn-novo-ensinamento": ["admin"],
  "btn-nova-erva":        ["admin"],
  "btn-nova-reza":        ["admin"],
  "btn-novo-ponto":       ["admin", "curimba"],
  "btn-nova-limpeza":     ["admin", "limpeza"],
  "btn-novo-evento":      ["admin"],
};

function podeEditar(role, modulo) {
  if (role === "admin") return true;
  if (modulo === "curimba") return role === "curimba";
  if (modulo === "limpeza") return role === "limpeza";
  return false;
}

function aplicarPermissoes() {
  Object.entries(PERMISSOES).forEach(([id, roles]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = roles.includes(_userRole) ? "" : "none";
  });
}

// ── Tema Claro / Noturno ─────────────────────────────────────
function initTema() {
  const salvo = localStorage.getItem("terreiro_tema") || "light";
  aplicarTema(salvo);

  const toggleDesktop = document.getElementById("theme-toggle-desktop");
  const toggleMobile = document.getElementById("theme-toggle-mobile");

  const alternar = () => {
    const atual = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    aplicarTema(atual);
    localStorage.setItem("terreiro_tema", atual);
  };

  if (toggleDesktop) toggleDesktop.addEventListener("click", alternar);
  if (toggleMobile) toggleMobile.addEventListener("click", alternar);
}

function aplicarTema(tema) {
  if (tema === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    document.querySelectorAll(".theme-icon").forEach(i => i.textContent = "☀️");
    document.querySelectorAll(".theme-label").forEach(l => l.textContent = "Modo Dia");
  } else {
    document.documentElement.removeAttribute("data-theme");
    document.querySelectorAll(".theme-icon").forEach(i => i.textContent = "🌙");
    document.querySelectorAll(".theme-label").forEach(l => l.textContent = "Modo Noite");
  }
}
initTema();

// ── Sidebar / nav & Bottom Bar ──────────────────────────────
document.getElementById("logout-btn").addEventListener("click", () => {
  signOut(auth).then(() => (window.location.href = "index.html"));
});
document.getElementById("btn-perfil").addEventListener("click", () => { window.location.href = "perfil.html"; });
document.getElementById("btn-notif").addEventListener("click", () => { window.location.href = "perfil.html"; });

function navegarPara(pageName) {
  document.querySelectorAll(".nav-item").forEach(n => {
    const match = n.dataset.page === pageName;
    n.classList.toggle("active", match);
    if (match) n.setAttribute("aria-current", "page");
    else n.removeAttribute("aria-current");
  });
  document.querySelectorAll(".bottom-nav-item").forEach(b => {
    b.classList.toggle("active", b.dataset.bpage === pageName);
  });
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const target = document.getElementById("page-" + pageName);
  if (target) target.classList.add("active");
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebar-overlay").classList.remove("open");
  const menuBtn = document.getElementById("menu-toggle");
  if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".nav-item[data-page]").forEach(item => {
  item.addEventListener("click", () => navegarPara(item.dataset.page));
});

document.querySelectorAll(".bottom-nav-item[data-bpage]").forEach(item => {
  item.addEventListener("click", () => navegarPara(item.dataset.bpage));
});

document.getElementById("menu-toggle").addEventListener("click", () => {
  const open = document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("sidebar-overlay").classList.toggle("open", open);
  document.getElementById("menu-toggle").setAttribute("aria-expanded", String(open));
});
document.getElementById("sidebar-overlay").addEventListener("click", () => {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebar-overlay").classList.remove("open");
  document.getElementById("menu-toggle").setAttribute("aria-expanded", "false");
});

// ── Helpers ──────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }
function fmtDate(str) {
  if (!str) return "";
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}

// ── Notificações badge ───────────────────────────────────────
async function loadNotifBadge(uid) {
  try {
    const snap = await getDocs(query(collection(db, "notificacoes"), where("uid","==",uid), where("lida","==",false)));
    const badge = document.getElementById("notif-badge");
    if (snap.size > 0) { badge.textContent = snap.size > 9 ? "9+" : snap.size; badge.hidden = false; }
    else { badge.hidden = true; }
  } catch (e) { /* silencioso */ }
}

// ── INIT ─────────────────────────────────────────────────────
async function init() {
  try {
    initDashboardAxeWidgets();
    await Promise.all([
      loadOrixas(), loadDatas(), loadPontos(), loadEventos(),
      loadLimpeza(), loadEnsinamentos(), loadErvas(), loadRezas(), loadGrupos()
    ]);
  } catch (err) {
    console.error("Erro ao carregar:", err);
    document.querySelectorAll('[aria-live="polite"]').forEach(el => {
      if (el.innerHTML.includes("Carregando"))
        el.innerHTML = `<p style="color:#8b1a1a; font-size:0.85rem;">Erro: ${err.code || err.message}</p>`;
    });
  }
}

// ══════════════════════════════════════════════════
// ORIXÁS
// ══════════════════════════════════════════════════
let _orixas = [], _orixaAtivo = null;

async function loadOrixas() {
  const snap = await getDocs(query(collection(db, "orixas"), orderBy("nome", "asc")));
  _orixas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderOrixasTabs(_orixas);
  document.getElementById("stat-orixas").textContent = _orixas.length;
}

function renderOrixasTabs(lista) {
  const bar = document.getElementById("orixa-tabs-bar");
  const panel = document.getElementById("orixa-detalhe-panel");
  if (!lista.length) {
    bar.innerHTML = `<div class="empty-state"><p>Nenhum Orixá cadastrado ainda.</p></div>`;
    panel.hidden = true;
    return;
  }
  bar.innerHTML = lista.map(o =>
    `<button class="orixa-tab-btn" role="tab" aria-selected="false" data-id="${o.id}">${o.nome}</button>`
  ).join("");
  bar.querySelectorAll(".orixa-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const o = _orixas.find(x => x.id === btn.dataset.id); if (!o) return;
      bar.querySelectorAll(".orixa-tab-btn").forEach(b => { b.classList.remove("active"); b.setAttribute("aria-selected","false"); });
      btn.classList.add("active"); btn.setAttribute("aria-selected","true");
      mostrarDetalhesOrixa(o);
    });
  });
  // selecionar o primeiro automaticamente
  bar.querySelector(".orixa-tab-btn").click();
}

function mostrarDetalhesOrixa(o) {
  _orixaAtivo = o;
  const panel = document.getElementById("orixa-detalhe-panel");
  document.getElementById("orixa-det-nome").textContent = o.nome;
  document.getElementById("orixa-det-saudacao").textContent = o.saudacao || "";
  document.getElementById("orixa-det-dominios").textContent = o.dominios || "—";
  document.getElementById("orixa-det-desc").textContent = o.desc || "—";
  document.getElementById("orixa-det-grid").innerHTML = [
    o.trono      ? `<div class="orixa-info-item"><div class="info-label">Trono</div><div class="info-value">${o.trono}</div></div>` : "",
    o.cores      ? `<div class="orixa-info-item"><div class="info-label">Cores</div><div class="info-value">${o.cores}</div></div>` : "",
    o.dia        ? `<div class="orixa-info-item"><div class="info-label">Dia</div><div class="info-value">${o.dia}</div></div>` : "",
    o.elemento   ? `<div class="orixa-info-item"><div class="info-label">Elemento</div><div class="info-value">${o.elemento}</div></div>` : "",
    o.oferendas  ? `<div class="orixa-info-item"><div class="info-label">Oferendas</div><div class="info-value">${o.oferendas}</div></div>` : "",
    o.dataFestiva? `<div class="orixa-info-item"><div class="info-label">Data Festiva</div><div class="info-value">${o.dataFestiva}</div></div>` : "",
    o.santo      ? `<div class="orixa-info-item"><div class="info-label">Santo Católico</div><div class="info-value">${o.santo}</div></div>` : "",
  ].join("");
  document.getElementById("orixa-det-acoes").style.display = _isAdmin ? "flex" : "none";

  // Relações inteligentes com Ervas e Pontos
  renderRelacoesOrixa(o.nome);

  panel.hidden = false;
}

function renderRelacoesOrixa(nomeOrixa) {
  const ervasEl = document.getElementById("orixa-det-ervas-list");
  const pontosEl = document.getElementById("orixa-det-pontos-list");
  if (!ervasEl || !pontosEl) return;

  const nomeNorm = (nomeOrixa || "").toLowerCase().trim();

  // 1. Filtrar Ervas associadas
  const ervasRel = _ervas.filter(e => {
    const o = (e.orixa || "").toLowerCase();
    const n = (e.nome || "").toLowerCase();
    const ing = (e.ingredientes || "").toLowerCase();
    return o.includes(nomeNorm) || n.includes(nomeNorm) || ing.includes(nomeNorm);
  });

  if (ervasRel.length) {
    ervasEl.innerHTML = ervasRel.slice(0, 4).map(e => `
      <div class="card" style="cursor:pointer; padding:0.75rem;" data-rel-erva="${e.id}">
        <strong style="font-size:0.88rem; color:var(--gold);">${e.nome}</strong>
        <p style="font-size:0.75rem; color:var(--muted);">${e.categoria || "Banho / Defumação"}</p>
      </div>
    `).join("");
    ervasEl.querySelectorAll("[data-rel-erva]").forEach(c => {
      c.addEventListener("click", () => {
        const erva = _ervas.find(x => x.id === c.dataset.relErva);
        if (erva) {
          _ervaAtiva = erva;
          document.getElementById("ver-erva-nome").textContent = erva.nome;
          document.getElementById("ver-erva-meta").textContent = [erva.categoria, erva.orixa].filter(Boolean).join(" · ");
          document.getElementById("ver-erva-ingredientes").textContent = erva.ingredientes||"—";
          document.getElementById("ver-erva-modo").textContent = erva.modo||"—";
          document.getElementById("ver-erva-obs").textContent = erva.obs||"";
          openModal("modal-ver-erva");
        }
      });
    });
  } else {
    ervasEl.innerHTML = `<p style="font-size:0.82rem; color:var(--muted);">Nenhum banho cadastrado especificamente para este Orixá.</p>`;
  }

  // 2. Filtrar Pontos associados
  const pontosRel = _pontos.filter(p => {
    const o = (p.orixa || "").toLowerCase();
    const l = (p.linha || "").toLowerCase();
    const t = (p.titulo || "").toLowerCase();
    const letTxt = (p.letra || "").toLowerCase();
    return o.includes(nomeNorm) || l.includes(nomeNorm) || t.includes(nomeNorm) || letTxt.includes(nomeNorm);
  });

  if (pontosRel.length) {
    pontosEl.innerHTML = pontosRel.slice(0, 4).map(p => `
      <div class="card" style="cursor:pointer; padding:0.75rem;" data-rel-ponto="${p.id}">
        <strong style="font-size:0.88rem; color:var(--gold);">${p.titulo}</strong>
        <p style="font-size:0.75rem; color:var(--muted);">${p.linha || "Ponto Cantado"}</p>
      </div>
    `).join("");
    pontosEl.querySelectorAll("[data-rel-ponto]").forEach(c => {
      c.addEventListener("click", () => {
        const ponto = _pontos.find(x => x.id === c.dataset.relPonto);
        if (ponto) {
          _pontoAtivo = ponto;
          document.getElementById("ver-ponto-titulo").textContent = ponto.titulo;
          document.getElementById("ver-ponto-orixa").textContent = ponto.orixa||"";
          document.getElementById("ver-ponto-linha").textContent = ponto.linha ? "Linha: "+ponto.linha : "";
          document.getElementById("ver-ponto-letra").textContent = ponto.letra||"";
          document.getElementById("ver-ponto-obs").textContent = ponto.obs ? "Obs: "+ponto.obs : "";
          openModal("modal-ver-ponto");
        }
      });
    });
  } else {
    pontosEl.innerHTML = `<p style="font-size:0.82rem; color:var(--muted);">Nenhum ponto cadastrado para este Orixá.</p>`;
  }
}

document.getElementById("btn-novo-orixa").addEventListener("click", () => {
  document.getElementById("modal-orixa-title").textContent = "Novo Orixá";
  ["orixa-id","orixa-nome","orixa-saudacao","orixa-trono","orixa-cores","orixa-elemento","orixa-oferendas","orixa-data-festiva","orixa-santo","orixa-dominios","orixa-desc"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("orixa-dia").value = "";
  openModal("modal-orixa");
});
document.getElementById("btn-cancelar-orixa").addEventListener("click", () => closeModal("modal-orixa"));
document.getElementById("btn-salvar-orixa").addEventListener("click", async () => {
  const id = document.getElementById("orixa-id").value;
  const data = {
    nome: document.getElementById("orixa-nome").value.trim(),
    saudacao: document.getElementById("orixa-saudacao").value.trim(),
    trono: document.getElementById("orixa-trono").value.trim(),
    dia: document.getElementById("orixa-dia").value,
    cores: document.getElementById("orixa-cores").value.trim(),
    elemento: document.getElementById("orixa-elemento").value.trim(),
    oferendas: document.getElementById("orixa-oferendas").value.trim(),
    dataFestiva: document.getElementById("orixa-data-festiva").value.trim(),
    santo: document.getElementById("orixa-santo").value.trim(),
    dominios: document.getElementById("orixa-dominios").value.trim(),
    desc: document.getElementById("orixa-desc").value.trim(),
  };
  if (!data.nome) { alert("Informe o nome do Orixá."); return; }
  id ? await updateDoc(doc(db, "orixas", id), data) : await addDoc(collection(db, "orixas"), { ...data, criadoEm: serverTimestamp() });
  closeModal("modal-orixa"); await loadOrixas();
});
document.getElementById("btn-editar-orixa-detalhe").addEventListener("click", () => {
  const o = _orixaAtivo; if (!o) return;
  document.getElementById("modal-orixa-title").textContent = "Editar Orixá";
  document.getElementById("orixa-id").value = o.id;
  document.getElementById("orixa-nome").value = o.nome;
  document.getElementById("orixa-saudacao").value = o.saudacao || "";
  document.getElementById("orixa-trono").value = o.trono || "";
  document.getElementById("orixa-dia").value = o.dia || "";
  document.getElementById("orixa-cores").value = o.cores || "";
  document.getElementById("orixa-elemento").value = o.elemento || "";
  document.getElementById("orixa-oferendas").value = o.oferendas || "";
  document.getElementById("orixa-data-festiva").value = o.dataFestiva || "";
  document.getElementById("orixa-santo").value = o.santo || "";
  document.getElementById("orixa-dominios").value = o.dominios || "";
  document.getElementById("orixa-desc").value = o.desc || "";
  openModal("modal-orixa");
});
document.getElementById("btn-deletar-orixa-detalhe").addEventListener("click", async () => {
  if (!_orixaAtivo || !confirm(`Excluir Orixá "${_orixaAtivo.nome}"?`)) return;
  await deleteDoc(doc(db, "orixas", _orixaAtivo.id)); await loadOrixas();
});

// ══════════════════════════════════════════════════
// DATAS SAGRADAS
// ══════════════════════════════════════════════════
let _datas = [];
const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

async function loadDatas() {
  const snap = await getDocs(query(collection(db, "datasagradas"), orderBy("criadoEm", "desc")));
  _datas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderDatas();
}

function parseMes(dataStr) {
  if (!dataStr) return 99;
  const parts = dataStr.split("/");
  return parts.length >= 2 ? parseInt(parts[1], 10) : 99;
}

function renderDatas() {
  const el = document.getElementById("lista-datas");
  if (!_datas.length) { el.innerHTML = `<div class="empty-state"><p>Nenhuma data sagrada cadastrada ainda.</p></div>`; return; }
  const grupos = {};
  _datas.forEach(d => { const mes = parseMes(d.data); if (!grupos[mes]) grupos[mes] = []; grupos[mes].push(d); });
  el.innerHTML = Object.keys(grupos).map(Number).sort((a,b)=>a-b).map(mes => `
    <div class="datas-mes-grupo">
      <div class="datas-mes-titulo">${mes <= 12 ? MESES[mes-1] : "Sem mês definido"}</div>
      ${grupos[mes].map(d => `
        <div class="data-item">
          <div class="data-badge">${d.data || "—"}</div>
          <div class="data-info">
            <strong>${d.nome}</strong>
            <span>${[d.orixa, d.santo, d.tipo].filter(Boolean).join(" · ")}</span>
            ${d.desc ? `<p style="font-size:0.8rem;color:var(--muted);margin-top:.2rem;">${d.desc}</p>` : ""}
          </div>
          ${_isAdmin ? `<div class="data-actions">
            <button class="btn btn-secondary" style="font-size:.75rem;padding:.3rem .55rem;" data-edit-dt="${d.id}">Editar</button>
            <button class="btn btn-danger" style="font-size:.75rem;padding:.3rem .55rem;" data-del-dt="${d.id}">✕</button>
          </div>` : ""}
        </div>
      `).join("")}
    </div>
  `).join("");
  el.querySelectorAll("[data-edit-dt]").forEach(btn => btn.addEventListener("click", () => editarData(btn.dataset.editDt)));
  el.querySelectorAll("[data-del-dt]").forEach(btn => btn.addEventListener("click", () => deletarData(btn.dataset.delDt)));
}

document.getElementById("btn-nova-data").addEventListener("click", () => {
  document.getElementById("modal-data-title").textContent = "Nova Data Sagrada";
  ["data-id","data-nome","data-data","data-santo","data-desc"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("data-orixa").value = ""; document.getElementById("data-tipo").value = "";
  openModal("modal-data");
});
document.getElementById("btn-cancelar-data").addEventListener("click", () => closeModal("modal-data"));
document.getElementById("btn-salvar-data").addEventListener("click", async () => {
  const id = document.getElementById("data-id").value;
  const data = {
    nome: document.getElementById("data-nome").value.trim(),
    data: document.getElementById("data-data").value.trim(),
    orixa: document.getElementById("data-orixa").value,
    santo: document.getElementById("data-santo").value.trim(),
    tipo: document.getElementById("data-tipo").value,
    desc: document.getElementById("data-desc").value.trim(),
  };
  if (!data.nome) { alert("Informe o nome da data."); return; }
  id ? await updateDoc(doc(db, "datasagradas", id), data) : await addDoc(collection(db, "datasagradas"), { ...data, criadoEm: serverTimestamp() });
  closeModal("modal-data"); await loadDatas();
});
function editarData(id) {
  const d = _datas.find(x => x.id === id); if (!d) return;
  document.getElementById("modal-data-title").textContent = "Editar Data Sagrada";
  document.getElementById("data-id").value = d.id; document.getElementById("data-nome").value = d.nome;
  document.getElementById("data-data").value = d.data||""; document.getElementById("data-orixa").value = d.orixa||"";
  document.getElementById("data-santo").value = d.santo||""; document.getElementById("data-tipo").value = d.tipo||"";
  document.getElementById("data-desc").value = d.desc||""; openModal("modal-data");
}
async function deletarData(id) {
  const d = _datas.find(x => x.id === id);
  if (!d || !confirm(`Excluir "${d.nome}"?`)) return;
  await deleteDoc(doc(db, "datasagradas", id)); await loadDatas();
}

// ══════════════════════════════════════════════════
// PONTOS CANTADOS
// ══════════════════════════════════════════════════
let _pontos = [], _pontoAtivo = null;
let _apenasFavPontos = false;
let _linhaPontoAtiva = "";
let _fontSizePonto = 1.1; // rem

function getFavPontos() {
  try { return JSON.parse(localStorage.getItem("terreiro_fav_pontos") || "[]"); }
  catch(e) { return []; }
}
function toggleFavPonto(id) {
  let favs = getFavPontos();
  if (favs.includes(id)) favs = favs.filter(x => x !== id);
  else favs.push(id);
  localStorage.setItem("terreiro_fav_pontos", JSON.stringify(favs));
  return favs.includes(id);
}

async function loadPontos() {
  const snap = await getDocs(query(collection(db, "pontos"), orderBy("criadoEm", "desc")));
  _pontos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  filtrarPontos();
  document.getElementById("stat-pontos").textContent = _pontos.length;
}

function renderPontos(lista) {
  const el = document.getElementById("lista-pontos");
  const favs = getFavPontos();
  if (!lista.length) {
    el.innerHTML = `<div class="empty-state"><p>${_apenasFavPontos ? "Nenhum ponto marcado como favorito nesta categoria." : "Nenhum ponto encontrado."}</p></div>`;
    return;
  }
  el.innerHTML = lista.map(p => {
    const isFav = favs.includes(p.id);
    return `
    <div class="card" style="cursor:pointer;" data-id="${p.id}" data-tipo="ponto">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div class="card-title">${p.titulo}</div>
        <span style="color:${isFav ? '#e67e22' : 'var(--muted)'}; font-size:1.15rem;">${isFav ? '★' : '☆'}</span>
      </div>
      <div class="card-meta">${[p.orixa, p.linha].filter(Boolean).join(" · ")}</div>
      <div class="ponto-letra">${(p.letra||"").substring(0,120)}${(p.letra||"").length>120?"...":""}</div>
    </div>
  `}).join("");

  el.querySelectorAll("[data-tipo='ponto']").forEach(card => {
    card.addEventListener("click", () => {
      const p = _pontos.find(x => x.id === card.dataset.id); if (!p) return;
      _pontoAtivo = p;
      document.getElementById("ver-ponto-titulo").textContent = p.titulo;
      document.getElementById("ver-ponto-orixa").textContent = p.orixa||"";
      document.getElementById("ver-ponto-linha").textContent = p.linha ? "Linha: "+p.linha : "";
      document.getElementById("ver-ponto-letra").textContent = p.letra||"";
      document.getElementById("ver-ponto-obs").textContent = p.obs ? "Obs: "+p.obs : "";
      
      const favBtn = document.getElementById("btn-fav-ponto");
      const isFav = getFavPontos().includes(p.id);
      favBtn.classList.toggle("active", isFav);
      favBtn.textContent = isFav ? "★" : "☆";

      const pode = podeEditar(_userRole, "curimba");
      ["btn-editar-ponto-modal","btn-deletar-ponto-modal"].forEach(id => { document.getElementById(id).style.display = pode ? "" : "none"; });
      openModal("modal-ver-ponto");
    });
  });
}

function filtrarPontos() {
  const q = (document.getElementById("search-pontos")?.value || "").toLowerCase();
  const favs = getFavPontos();
  
  let resultado = _pontos.filter(p => {
    const matchBusca = !q || (p.titulo||"").toLowerCase().includes(q) ||
                             (p.orixa||"").toLowerCase().includes(q) ||
                             (p.linha||"").toLowerCase().includes(q) ||
                             (p.letra||"").toLowerCase().includes(q);
    
    const matchFav = !_apenasFavPontos || favs.includes(p.id);

    let matchLinha = true;
    if (_linhaPontoAtiva) {
      const textoCompleto = `${p.orixa||""} ${p.linha||""} ${p.titulo||""}`.toLowerCase();
      if (_linhaPontoAtiva === "Abertura / Defumação") {
        matchLinha = textoCompleto.includes("abertura") || textoCompleto.includes("defuma") || textoCompleto.includes("hino") || textoCompleto.includes("chamada");
      } else if (_linhaPontoAtiva === "Exu & Pomba Gira") {
        matchLinha = textoCompleto.includes("exu") || textoCompleto.includes("pomba") || textoCompleto.includes("laroyê") || textoCompleto.includes("tranca") || textoCompleto.includes("marabô");
      } else if (_linhaPontoAtiva === "Oxóssi & Caboclos") {
        matchLinha = textoCompleto.includes("oxóssi") || textoCompleto.includes("oxossi") || textoCompleto.includes("caboclo") || textoCompleto.includes("mata") || textoCompleto.includes("pena");
      } else if (_linhaPontoAtiva === "Xangô & Iansã") {
        matchLinha = textoCompleto.includes("xangô") || textoCompleto.includes("xango") || textoCompleto.includes("iansã") || textoCompleto.includes("iansa") || textoCompleto.includes("oyá") || textoCompleto.includes("trovão");
      } else if (_linhaPontoAtiva === "Iemanjá & Oxum") {
        matchLinha = textoCompleto.includes("iemanjá") || textoCompleto.includes("iemanja") || textoCompleto.includes("oxum") || textoCompleto.includes("mar") || textoCompleto.includes("rio") || textoCompleto.includes("sereia");
      } else if (_linhaPontoAtiva === "Pretos Velhos") {
        matchLinha = textoCompleto.includes("preto") || textoCompleto.includes("preta") || textoCompleto.includes("vovó") || textoCompleto.includes("vovô") || textoCompleto.includes("congo") || textoCompleto.includes("angola") || textoCompleto.includes("aruanda");
      } else if (_linhaPontoAtiva === "Baianos & Boiadeiros") {
        matchLinha = textoCompleto.includes("baiano") || textoCompleto.includes("baiana") || textoCompleto.includes("boiadeiro") || textoCompleto.includes("laço") || textoCompleto.includes("sertão") || textoCompleto.includes("zé");
      } else if (_linhaPontoAtiva === "Marinheiros") {
        matchLinha = textoCompleto.includes("marinheiro") || textoCompleto.includes("marujo") || textoCompleto.includes("maré") || textoCompleto.includes("navio");
      } else if (_linhaPontoAtiva === "Encerramento") {
        matchLinha = textoCompleto.includes("subida") || textoCompleto.includes("despedida") || textoCompleto.includes("encerramento") || textoCompleto.includes("fechamento");
      } else {
        matchLinha = textoCompleto.includes(_linhaPontoAtiva.toLowerCase());
      }
    }

    return matchBusca && matchFav && matchLinha;
  });

  renderPontos(resultado);
}

// Eventos de Linha de Pontos
document.querySelectorAll("#pontos-linhas-bar .filter-pill").forEach(pill => {
  pill.addEventListener("click", () => {
    document.querySelectorAll("#pontos-linhas-bar .filter-pill").forEach(p => p.classList.remove("active"));
    pill.classList.add("active");
    _linhaPontoAtiva = pill.dataset.linha;
    filtrarPontos();
  });
});

const btnFavPonto = document.getElementById("btn-fav-ponto");
if (btnFavPonto) {
  btnFavPonto.addEventListener("click", () => {
    if (!_pontoAtivo) return;
    const isFav = toggleFavPonto(_pontoAtivo.id);
    btnFavPonto.classList.toggle("active", isFav);
    btnFavPonto.textContent = isFav ? "★" : "☆";
    filtrarPontos();
  });
}

const btnFiltroFavPontos = document.getElementById("btn-filtro-fav-pontos");
if (btnFiltroFavPontos) {
  btnFiltroFavPontos.addEventListener("click", () => {
    _apenasFavPontos = !_apenasFavPontos;
    btnFiltroFavPontos.classList.toggle("active", _apenasFavPontos);
    btnFiltroFavPontos.classList.toggle("btn-primary", _apenasFavPontos);
    btnFiltroFavPontos.classList.toggle("btn-secondary", !_apenasFavPontos);
    filtrarPontos();
  });
}

// Controles de fonte da letra do ponto
document.getElementById("btn-fonte-maior")?.addEventListener("click", () => {
  if (_fontSizePonto < 1.8) {
    _fontSizePonto += 0.15;
    document.getElementById("ver-ponto-letra").style.fontSize = `${_fontSizePonto}rem`;
  }
});
document.getElementById("btn-fonte-menor")?.addEventListener("click", () => {
  if (_fontSizePonto > 0.85) {
    _fontSizePonto -= 0.15;
    document.getElementById("ver-ponto-letra").style.fontSize = `${_fontSizePonto}rem`;
  }
});

// ── Wake Lock (Manter Tela Acesa durante o Ponto) ──
let _wakeLock = null;
const btnWakeLock = document.getElementById("btn-wake-lock");
if (btnWakeLock) {
  btnWakeLock.addEventListener("click", async () => {
    if ('wakeLock' in navigator) {
      try {
        if (_wakeLock !== null) {
          await _wakeLock.release();
          _wakeLock = null;
          btnWakeLock.classList.remove("active");
          document.getElementById("label-wake-lock").textContent = "Manter Tela Acesa";
        } else {
          _wakeLock = await navigator.wakeLock.request('screen');
          btnWakeLock.classList.add("active");
          document.getElementById("label-wake-lock").textContent = "Tela Acesa (Ativo)";
          _wakeLock.addEventListener('release', () => {
            _wakeLock = null;
            btnWakeLock.classList.remove("active");
            document.getElementById("label-wake-lock").textContent = "Manter Tela Acesa";
          });
        }
      } catch (err) {
        console.warn("Wake lock error:", err);
      }
    } else {
      alert("Seu navegador não suporta a função de manter a tela acesa.");
    }
  });
}

// ── Auto-Scroll da Letra do Ponto ──
let _autoScrollTimer = null;
const btnAutoScroll = document.getElementById("btn-auto-scroll");
if (btnAutoScroll) {
  btnAutoScroll.addEventListener("click", () => {
    const modalEl = document.querySelector("#modal-ver-ponto .modal");
    if (!modalEl) return;
    if (_autoScrollTimer) {
      clearInterval(_autoScrollTimer);
      _autoScrollTimer = null;
      btnAutoScroll.classList.remove("active");
      document.getElementById("label-auto-scroll").textContent = "Auto-Scroll";
    } else {
      btnAutoScroll.classList.add("active");
      document.getElementById("label-auto-scroll").textContent = "Pausar Scroll";
      _autoScrollTimer = setInterval(() => {
        modalEl.scrollTop += 1;
        if (modalEl.scrollTop + modalEl.clientHeight >= modalEl.scrollHeight) {
          clearInterval(_autoScrollTimer);
          _autoScrollTimer = null;
          btnAutoScroll.classList.remove("active");
          document.getElementById("label-auto-scroll").textContent = "Auto-Scroll";
        }
      }, 50);
    }
  });
}

// ── Compartilhar no WhatsApp ──
const btnShareWhatsapp = document.getElementById("btn-share-whatsapp");
if (btnShareWhatsapp) {
  btnShareWhatsapp.addEventListener("click", () => {
    if (!_pontoAtivo) return;
    const msg = `🕯️ *${_pontoAtivo.titulo}*\n${_pontoAtivo.orixa ? "✨ Orixá: " + _pontoAtivo.orixa + "\n" : ""}${_pontoAtivo.linha ? "🌿 Linha: " + _pontoAtivo.linha + "\n\n" : "\n"}${_pontoAtivo.letra}\n\n_Templo Pai Tuiamissu — Umbanda Sagrada_`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  });
}

document.getElementById("search-pontos")?.addEventListener("input", filtrarPontos);
document.getElementById("btn-novo-ponto").addEventListener("click", () => {
  document.getElementById("modal-ponto-title").textContent = "Novo Ponto Cantado";
  ["ponto-id","ponto-titulo","ponto-linha","ponto-letra","ponto-obs"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("ponto-orixa").value = ""; openModal("modal-ponto");
});
document.getElementById("btn-cancelar-ponto").addEventListener("click", () => closeModal("modal-ponto"));
document.getElementById("btn-salvar-ponto").addEventListener("click", async () => {
  const id = document.getElementById("ponto-id").value;
  const data = {
    titulo: document.getElementById("ponto-titulo").value.trim(),
    orixa: document.getElementById("ponto-orixa").value,
    linha: document.getElementById("ponto-linha").value.trim(),
    letra: document.getElementById("ponto-letra").value.trim(),
    obs: document.getElementById("ponto-obs").value.trim(),
  };
  if (!data.titulo) { alert("Informe o título do ponto."); return; }
  id ? await updateDoc(doc(db, "pontos", id), data) : await addDoc(collection(db, "pontos"), { ...data, criadoEm: serverTimestamp() });
  closeModal("modal-ponto"); closeModal("modal-ver-ponto"); await loadPontos();
});
document.getElementById("btn-fechar-ver-ponto").addEventListener("click", () => closeModal("modal-ver-ponto"));
document.getElementById("btn-editar-ponto-modal").addEventListener("click", () => {
  const p = _pontoAtivo; if (!p) return;
  document.getElementById("modal-ponto-title").textContent = "Editar Ponto";
  document.getElementById("ponto-id").value = p.id; document.getElementById("ponto-titulo").value = p.titulo;
  document.getElementById("ponto-orixa").value = p.orixa||""; document.getElementById("ponto-linha").value = p.linha||"";
  document.getElementById("ponto-letra").value = p.letra||""; document.getElementById("ponto-obs").value = p.obs||"";
  closeModal("modal-ver-ponto"); openModal("modal-ponto");
});
document.getElementById("btn-deletar-ponto-modal").addEventListener("click", async () => {
  if (!_pontoAtivo || !confirm(`Excluir "${_pontoAtivo.titulo}"?`)) return;
  await deleteDoc(doc(db, "pontos", _pontoAtivo.id)); closeModal("modal-ver-ponto"); await loadPontos();
});

// ══════════════════════════════════════════════════
// CALENDÁRIO UNIFICADO (Giras, Orixás, Limpezas, Aniversários)
// ══════════════════════════════════════════════════
let _eventos = [];
let _calTipoAtivo = "";

async function loadEventos() {
  const snap = await getDocs(query(collection(db, "eventos"), orderBy("data", "asc")));
  _eventos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderCalendarioUnificado();
  renderProximosEventos();
  document.getElementById("stat-eventos").textContent = _eventos.length;
}

function getBadgeCalendario(tipo) {
  const t = (tipo || "").toLowerCase();
  if (t.includes("gira") || t.includes("festa")) return `<span class="cal-badge cal-badge-gira">🥁 ${tipo}</span>`;
  if (t.includes("orixá") || t.includes("orixa")) return `<span class="cal-badge cal-badge-orixa">🌊 ${tipo}</span>`;
  if (t.includes("limpeza") || t.includes("mutirão")) return `<span class="cal-badge cal-badge-limpeza">🧹 ${tipo}</span>`;
  if (t.includes("aniversário") || t.includes("aniversario")) return `<span class="cal-badge cal-badge-aniversario">🎂 ${tipo}</span>`;
  return `<span class="cal-badge" style="background:rgba(0,0,0,0.06); color:var(--text);">${tipo || "Evento"}</span>`;
}

function renderCalendarioUnificado() {
  const el = document.getElementById("lista-eventos");
  if (!el) return;

  // Unifica eventos diretos com as tarefas de limpeza e datas de orixás
  let unificados = [];

  // 1. Eventos cadastrados
  _eventos.forEach(ev => {
    unificados.push({
      id: ev.id,
      nome: ev.nome,
      data: ev.data,
      tipo: ev.tipo || "Gira",
      categoriaCal: categorizarTipoEvento(ev.tipo),
      desc: ev.desc || "",
      editavel: true
    });
  });

  // 2. Tarefas de limpeza como eventos do calendário
  _limpeza.forEach(lp => {
    if (lp.data) {
      unificados.push({
        id: "lp_" + lp.id,
        nome: `🧹 Limpeza: ${lp.tarefa}`,
        data: lp.data,
        tipo: "Limpeza",
        categoriaCal: "limpeza",
        desc: `${lp.resp ? "Responsável: " + lp.resp + " · " : ""}${lp.feito ? "Status: Concluído" : "Status: Pendente"}${lp.obs ? " · " + lp.obs : ""}`,
        editavel: false
      });
    }
  });

  // Ordenar cronologicamente
  unificados.sort((a, b) => (a.data || "").localeCompare(b.data || ""));

  // Filtrar por tipo
  if (_calTipoAtivo) {
    unificados = unificados.filter(item => item.categoriaCal === _calTipoAtivo);
  }

  if (!unificados.length) {
    el.innerHTML = `<div class="empty-state"><p>Nenhum evento encontrado nesta categoria.</p></div>`;
    return;
  }

  el.innerHTML = unificados.map(ev => `
    <div class="card" style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;margin-bottom:0.75rem;">
      <div style="flex:1;">
        <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap; margin-bottom:0.35rem;">
          <strong style="font-size:0.95rem; font-family:Georgia,serif; color:var(--gold);">${ev.nome}</strong>
          ${getBadgeCalendario(ev.tipo)}
        </div>
        <div class="card-meta">📅 ${fmtDate(ev.data)}</div>
        ${ev.desc ? `<p style="font-size:.83rem;color:var(--text-dim);margin-top:.25rem;line-height:1.5;">${ev.desc}</p>` : ""}
      </div>
      ${(ev.editavel && _isAdmin) ? `<div style="display:flex;gap:.4rem;flex-shrink:0;">
        <button class="btn btn-secondary" style="font-size:.75rem;padding:.3rem .55rem;" data-edit-ev="${ev.id}">Editar</button>
        <button class="btn btn-danger" style="font-size:.75rem;padding:.3rem .55rem;" data-del-ev="${ev.id}">✕</button>
      </div>` : ""}
    </div>
  `).join("");

  el.querySelectorAll("[data-edit-ev]").forEach(btn => btn.addEventListener("click", () => editarEvento(btn.dataset.editEv)));
  el.querySelectorAll("[data-del-ev]").forEach(btn => btn.addEventListener("click", () => deletarEvento(btn.dataset.delEv)));
}

function categorizarTipoEvento(tipo) {
  const t = (tipo || "").toLowerCase();
  if (t.includes("gira") || t.includes("festa")) return "gira";
  if (t.includes("orixá") || t.includes("orixa")) return "orixa";
  if (t.includes("limpeza") || t.includes("mutirão")) return "limpeza";
  if (t.includes("aniversário") || t.includes("aniversario")) return "aniversario";
  return "gira";
}

// Filtros do Calendário
document.querySelectorAll("#calendario-filtros-bar .filter-pill").forEach(pill => {
  pill.addEventListener("click", () => {
    document.querySelectorAll("#calendario-filtros-bar .filter-pill").forEach(p => p.classList.remove("active"));
    pill.classList.add("active");
    _calTipoAtivo = pill.dataset.calTipo;
    renderCalendarioUnificado();
  });
});

function renderProximosEventos() {
  const hoje = new Date().toISOString().substring(0,10);
  const proximos = _eventos.filter(e => e.data >= hoje).slice(0,5);
  const el = document.getElementById("proximos-eventos");
  const heroEl = document.getElementById("next-gira-hero");

  // Atualizar Hero da Próxima Gira na Home
  const proximaGira = _eventos.find(e => e.data >= hoje && ((e.tipo||"").toLowerCase().includes("gira") || (e.tipo||"").toLowerCase().includes("festa")));
  if (proximaGira && heroEl) {
    heroEl.style.display = "flex";
    document.getElementById("hero-gira-titulo").textContent = `🕯️ Próxima: ${proximaGira.nome}`;
    document.getElementById("hero-gira-desc").textContent = `Data: ${fmtDate(proximaGira.data)}${proximaGira.desc ? " — " + proximaGira.desc : ""}`;
    
    // Cálculo de dias restantes
    const diffTime = new Date(proximaGira.data + "T00:00:00") - new Date(hoje + "T00:00:00");
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    let labelDias = "Hoje!";
    if (diffDays === 1) labelDias = "Amanhã!";
    else if (diffDays > 1) labelDias = `Em ${diffDays} dias`;
    document.getElementById("hero-gira-dias").textContent = labelDias;
  } else if (heroEl) {
    heroEl.style.display = "none";
  }

  if (!el) return;
  if (!proximos.length) { el.innerHTML = `<p style="color:var(--muted);font-size:.85rem;">Sem eventos próximos marcados.</p>`; return; }
  el.innerHTML = proximos.map(ev => `
    <div class="event-item">
      <div class="event-date">${fmtDate(ev.data)}</div>
      <div class="event-info">
        <strong>${ev.nome}</strong>
        <span>${ev.tipo || "Gira"}</span>
      </div>
    </div>
  `).join("");
}

document.getElementById("btn-novo-evento").addEventListener("click", () => {
  document.getElementById("modal-evento-title").textContent = "Novo Evento";
  ["evento-id","evento-nome","evento-desc"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("evento-data").value = ""; document.getElementById("evento-tipo").value = "";
  openModal("modal-evento");
});
document.getElementById("btn-cancelar-evento").addEventListener("click", () => closeModal("modal-evento"));
document.getElementById("btn-salvar-evento").addEventListener("click", async () => {
  const id = document.getElementById("evento-id").value;
  const data = {
    nome: document.getElementById("evento-nome").value.trim(),
    data: document.getElementById("evento-data").value,
    tipo: document.getElementById("evento-tipo").value,
    desc: document.getElementById("evento-desc").value.trim(),
  };
  if (!data.nome) { alert("Informe o nome do evento."); return; }
  id ? await updateDoc(doc(db, "eventos", id), data) : await addDoc(collection(db, "eventos"), { ...data, criadoEm: serverTimestamp() });
  closeModal("modal-evento"); await loadEventos();
});
function editarEvento(id) {
  const ev = _eventos.find(x => x.id === id); if (!ev) return;
  document.getElementById("modal-evento-title").textContent = "Editar Evento";
  document.getElementById("evento-id").value = ev.id; document.getElementById("evento-nome").value = ev.nome;
  document.getElementById("evento-data").value = ev.data||""; document.getElementById("evento-tipo").value = ev.tipo||"";
  document.getElementById("evento-desc").value = ev.desc||""; openModal("modal-evento");
}
async function deletarEvento(id) {
  const ev = _eventos.find(x => x.id === id);
  if (!ev || !confirm(`Excluir "${ev.nome}"?`)) return;
  await deleteDoc(doc(db, "eventos", id)); await loadEventos();
}

// ══════════════════════════════════════════════════
// LIMPEZA
// ══════════════════════════════════════════════════
let _limpeza = [];
let _apenasMinhasTarefas = false;

async function loadLimpeza() {
  const snap = await getDocs(query(collection(db, "limpeza"), orderBy("data", "asc")));
  _limpeza = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderLimpeza();
  renderMinhasEscalasHome();
  document.getElementById("stat-limpeza").textContent = _limpeza.length;
}

function renderMinhasEscalasHome() {
  const el = document.getElementById("minhas-escalas-home");
  if (!el) return;
  if (!_currentUser) {
    el.innerHTML = `<p style="color:var(--muted);font-size:.85rem;">Faça login para ver suas escalas.</p>`;
    return;
  }
  const userEmail = (_currentUser.email || "").toLowerCase();
  const minhas = _limpeza.filter(t => !t.feito && (t.resp || "").toLowerCase().includes(userEmail));
  if (!minhas.length) {
    el.innerHTML = `<p style="color:var(--muted);font-size:.85rem;">Nenhuma tarefa pendente atribuída a você. Axé!</p>`;
    return;
  }
  el.innerHTML = minhas.slice(0, 4).map(t => `
    <div class="event-item">
      <div class="event-date">${fmtDate(t.data) || "Geral"}</div>
      <div class="event-info">
        <strong>${t.tarefa}</strong>
        <span>${t.freq || "Escala de Limpeza"}</span>
      </div>
    </div>
  `).join("");
}

function renderLimpeza() {
  const el = document.getElementById("lista-limpeza");
  let filtrada = _limpeza;
  if (_apenasMinhasTarefas && _currentUser) {
    const userEmail = (_currentUser.email || "").toLowerCase();
    filtrada = _limpeza.filter(t => (t.resp || "").toLowerCase().includes(userEmail));
  }
  if (!filtrada.length) {
    el.innerHTML = `<div class="empty-state"><p>${_apenasMinhasTarefas ? "Você não tem escalas de limpeza atribuídas no momento." : "Nenhuma tarefa cadastrada ainda."}</p></div>`;
    return;
  }
  el.innerHTML = filtrada.map(t => `
    <div class="card" style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;">
      <div style="flex:1;">
        <div class="card-title">${t.tarefa}</div>
        <div class="card-meta">${t.resp ? t.resp+" · " : ""}${fmtDate(t.data)}${t.freq ? " · "+t.freq : ""}</div>
        ${t.obs ? `<p style="font-size:.82rem;color:var(--muted);">${t.obs}</p>` : ""}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.5rem;flex-shrink:0;">
        <button class="btn limpe-status ${t.feito ? "status-feito":"status-pendente"}" data-toggle="${t.id}">
          ${t.feito ? "✓ Feito" : "Pendente"}
        </button>
        ${podeEditar(_userRole,"limpeza") ? `<div style="display:flex;gap:.4rem;">
          <button class="btn btn-secondary" style="font-size:.75rem;padding:.3rem .55rem;" data-edit-lp="${t.id}">Editar</button>
          <button class="btn btn-danger" style="font-size:.75rem;padding:.3rem .55rem;" data-del-lp="${t.id}">✕</button>
        </div>` : ""}
      </div>
    </div>
  `).join("");
  el.querySelectorAll("[data-toggle]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const t = _limpeza.find(x => x.id === btn.dataset.toggle); if (!t) return;
      await updateDoc(doc(db, "limpeza", t.id), { feito: !t.feito }); await loadLimpeza();
    });
  });
  el.querySelectorAll("[data-edit-lp]").forEach(btn => btn.addEventListener("click", () => editarLimpeza(btn.dataset.editLp)));
  el.querySelectorAll("[data-del-lp]").forEach(btn => btn.addEventListener("click", () => deletarLimpeza(btn.dataset.delLp)));
}

const btnMinhasTarefas = document.getElementById("btn-filtro-minhas-tarefas");
if (btnMinhasTarefas) {
  btnMinhasTarefas.addEventListener("click", () => {
    _apenasMinhasTarefas = !_apenasMinhasTarefas;
    btnMinhasTarefas.classList.toggle("active", _apenasMinhasTarefas);
    btnMinhasTarefas.classList.toggle("btn-primary", _apenasMinhasTarefas);
    btnMinhasTarefas.classList.toggle("btn-secondary", !_apenasMinhasTarefas);
    renderLimpeza();
  });
}

document.getElementById("btn-nova-limpeza").addEventListener("click", () => {
  document.getElementById("modal-limpeza-title").textContent = "Nova Tarefa de Limpeza";
  ["limpeza-id","limpeza-tarefa","limpeza-resp","limpeza-obs"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("limpeza-data").value = ""; document.getElementById("limpeza-freq").value = "";
  openModal("modal-limpeza");
});
document.getElementById("btn-cancelar-limpeza").addEventListener("click", () => closeModal("modal-limpeza"));
document.getElementById("btn-salvar-limpeza").addEventListener("click", async () => {
  const id = document.getElementById("limpeza-id").value;
  const data = {
    tarefa: document.getElementById("limpeza-tarefa").value.trim(),
    resp:   document.getElementById("limpeza-resp").value.trim(),
    data:   document.getElementById("limpeza-data").value,
    freq:   document.getElementById("limpeza-freq").value,
    obs:    document.getElementById("limpeza-obs").value.trim(),
  };
  if (!data.tarefa) { alert("Informe a tarefa."); return; }
  id ? await updateDoc(doc(db, "limpeza", id), data) : await addDoc(collection(db, "limpeza"), { ...data, feito: false, criadoEm: serverTimestamp() });
  if (data.resp) await notificarResponsavel(data.resp, data.tarefa, data.data);
  closeModal("modal-limpeza"); await loadLimpeza();
});
async function notificarResponsavel(email, tarefa, dataStr) {
  try {
    const snap = await getDocs(query(collection(db, "membros"), where("email","==",email)));
    if (snap.empty) return;
    const uid = snap.docs[0].id;
    await addDoc(collection(db, "notificacoes"), {
      uid, texto: `Tarefa de limpeza atribuída: "${tarefa}"${dataStr ? " para "+fmtDate(dataStr) : ""}.`, lida: false, criadoEm: serverTimestamp()
    });
    if (_currentUser && _currentUser.uid === uid) loadNotifBadge(uid);
  } catch (e) { /* silencioso */ }
}
function editarLimpeza(id) {
  const t = _limpeza.find(x => x.id === id); if (!t) return;
  document.getElementById("modal-limpeza-title").textContent = "Editar Tarefa";
  document.getElementById("limpeza-id").value = t.id; document.getElementById("limpeza-tarefa").value = t.tarefa;
  document.getElementById("limpeza-resp").value = t.resp||""; document.getElementById("limpeza-data").value = t.data||"";
  document.getElementById("limpeza-freq").value = t.freq||""; document.getElementById("limpeza-obs").value = t.obs||"";
  openModal("modal-limpeza");
}
async function deletarLimpeza(id) {
  const t = _limpeza.find(x => x.id === id);
  if (!t || !confirm(`Excluir "${t.tarefa}"?`)) return;
  await deleteDoc(doc(db, "limpeza", id)); await loadLimpeza();
}

// ══════════════════════════════════════════════════
// ENSINAMENTOS COM SUBCATEGORIAS
// ══════════════════════════════════════════════════
let _ensinamentos = [], _ensinamentoAtivo = null;
let _subcatEnsinamentoAtiva = "";

async function loadEnsinamentos() {
  const snap = await getDocs(query(collection(db, "ensinamentos"), orderBy("criadoEm", "desc")));
  _ensinamentos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  filtrarEnsinamentos();
  document.getElementById("stat-ensinamentos").textContent = _ensinamentos.length;
}

function renderEnsinamentos(lista) {
  const el = document.getElementById("lista-ensinamentos");
  if (!el) return;
  if (!lista.length) {
    el.innerHTML = `<div class="empty-state"><p>Nenhum ensinamento encontrado nesta subcategoria.</p></div>`;
    return;
  }
  el.innerHTML = lista.map(e => `
    <div class="card card-com-foto${e.autor === 'Pai Yolando' ? ' card-pai-yolando' : ''}" style="cursor:pointer;" data-id="${e.id}" data-tipo="ensinamento">
      ${e.foto ? `<img src="${e.foto}" class="card-foto-thumb" alt="${e.titulo}" onerror="this.style.display='none'" />` : ""}
      ${e.autor === 'Pai Yolando' ? `<div class="badge-pai-yolando">🕯️ Pai Yolando</div>` : ""}
      <div class="card-title">${e.titulo}</div>
      <div class="card-meta">${e.categoria || "Geral"}</div>
      <p style="font-size:.85rem;color:var(--text-dim);line-height:1.6;">${(e.conteudo||"").substring(0,120)}${(e.conteudo||"").length>120?"...":""}</p>
    </div>
  `).join("");

  el.querySelectorAll("[data-tipo='ensinamento']").forEach(card => {
    card.addEventListener("click", () => {
      const e = _ensinamentos.find(x => x.id === card.dataset.id); if (!e) return;
      _ensinamentoAtivo = e;
      document.getElementById("ver-ensinamento-titulo").textContent = e.titulo;
      const catEl = document.getElementById("ver-ensinamento-cat");
      catEl.textContent = e.categoria||"";
      const autorEl = document.getElementById("ver-ensinamento-autor");
      if (autorEl) { autorEl.textContent = e.autor || ""; autorEl.style.display = e.autor ? "" : "none"; }
      
      const fotoEl = document.getElementById("ver-ensinamento-foto");
      if (fotoEl) {
        if (e.foto) {
          fotoEl.src = e.foto;
          fotoEl.style.display = "block";
        } else {
          fotoEl.style.display = "none";
        }
      }

      document.getElementById("ver-ensinamento-conteudo").textContent = e.conteudo||"";
      ["btn-editar-ensinamento-modal","btn-deletar-ensinamento-modal"].forEach(id => {
        document.getElementById(id).style.display = _isAdmin ? "" : "none";
      });
      openModal("modal-ver-ensinamento");
    });
  });
}

function filtrarEnsinamentos() {
  const q = (document.getElementById("search-ensinamentos")?.value || "").toLowerCase();
  
  let resultado = _ensinamentos.filter(e => {
    const matchBusca = !q || (e.titulo||"").toLowerCase().includes(q) || (e.conteudo||"").toLowerCase().includes(q) || (e.categoria||"").toLowerCase().includes(q);
    
    let matchSubcat = true;
    if (_subcatEnsinamentoAtiva) {
      if (_subcatEnsinamentoAtiva === "Banhos") {
        matchSubcat = (e.categoria||"").toLowerCase().includes("banho") || (e.categoria||"").toLowerCase().includes("erva");
      } else if (_subcatEnsinamentoAtiva === "Teologia") {
        matchSubcat = (e.categoria||"").toLowerCase().includes("teologia") || (e.categoria||"").toLowerCase().includes("fundamento");
      } else if (_subcatEnsinamentoAtiva === "Práticas") {
        matchSubcat = (e.categoria||"").toLowerCase().includes("prática") || (e.categoria||"").toLowerCase().includes("ritual");
      } else {
        matchSubcat = (e.categoria||"").toLowerCase().includes(_subcatEnsinamentoAtiva.toLowerCase()) ||
                      (e.titulo||"").toLowerCase().includes(_subcatEnsinamentoAtiva.toLowerCase());
      }
    }

    return matchBusca && matchSubcat;
  });

  renderEnsinamentos(resultado);
}

// Subcategorias de Ensinamentos
document.querySelectorAll("#ensinamentos-subcats-bar .filter-pill").forEach(pill => {
  pill.addEventListener("click", () => {
    document.querySelectorAll("#ensinamentos-subcats-bar .filter-pill").forEach(p => p.classList.remove("active"));
    pill.classList.add("active");
    _subcatEnsinamentoAtiva = pill.dataset.subcat;
    filtrarEnsinamentos();
  });
});

document.getElementById("search-ensinamentos")?.addEventListener("input", filtrarEnsinamentos);
document.getElementById("btn-novo-ensinamento").addEventListener("click", () => {
  document.getElementById("modal-ensinamento-title").textContent = "Novo Ensinamento & História";
  ["ensinamento-id","ensinamento-titulo","ensinamento-conteudo","ensinamento-foto"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("ensinamento-cat").value = ""; openModal("modal-ensinamento");
});
document.getElementById("btn-cancelar-ensinamento").addEventListener("click", () => closeModal("modal-ensinamento"));
document.getElementById("btn-salvar-ensinamento").addEventListener("click", async () => {
  const id = document.getElementById("ensinamento-id").value;
  const data = {
    titulo: document.getElementById("ensinamento-titulo").value.trim(),
    categoria: document.getElementById("ensinamento-cat").value,
    foto: (document.getElementById("ensinamento-foto")?.value || "").trim(),
    conteudo: document.getElementById("ensinamento-conteudo").value.trim(),
  };
  if (!data.titulo) { alert("Informe o título."); return; }
  id ? await updateDoc(doc(db, "ensinamentos", id), data) : await addDoc(collection(db, "ensinamentos"), { ...data, criadoEm: serverTimestamp() });
  closeModal("modal-ensinamento"); closeModal("modal-ver-ensinamento"); await loadEnsinamentos();
});
document.getElementById("btn-fechar-ver-ensinamento").addEventListener("click", () => closeModal("modal-ver-ensinamento"));
document.getElementById("btn-editar-ensinamento-modal").addEventListener("click", () => {
  const e = _ensinamentoAtivo; if (!e) return;
  document.getElementById("modal-ensinamento-title").textContent = "Editar Ensinamento & História";
  document.getElementById("ensinamento-id").value = e.id;
  document.getElementById("ensinamento-titulo").value = e.titulo;
  document.getElementById("ensinamento-cat").value = e.categoria||"";
  const fotoInput = document.getElementById("ensinamento-foto");
  if (fotoInput) fotoInput.value = e.foto || "";
  document.getElementById("ensinamento-conteudo").value = e.conteudo||"";
  closeModal("modal-ver-ensinamento"); openModal("modal-ensinamento");
});
document.getElementById("btn-deletar-ensinamento-modal").addEventListener("click", async () => {
  if (!_ensinamentoAtivo || !confirm(`Excluir "${_ensinamentoAtivo.titulo}"?`)) return;
  await deleteDoc(doc(db, "ensinamentos", _ensinamentoAtivo.id)); closeModal("modal-ver-ensinamento"); await loadEnsinamentos();
});

// ══════════════════════════════════════════════════
// ERVAS & BANHOS
// ══════════════════════════════════════════════════
let _ervas = [], _ervaAtiva = null;

async function loadErvas() {
  const snap = await getDocs(query(collection(db, "ervas"), orderBy("criadoEm", "desc")));
  _ervas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderErvas(_ervas);
}

function renderErvas(lista) {
  const el = document.getElementById("lista-ervas");
  if (!lista.length) { el.innerHTML = `<div class="empty-state"><p>Nenhuma erva ou banho cadastrado ainda.</p></div>`; return; }
  el.innerHTML = lista.map(e => `
    <div class="card" style="cursor:pointer;" data-id="${e.id}" data-tipo="erva">
      <div class="card-title">${e.nome}</div>
      <div class="card-meta">${[e.categoria, e.orixa].filter(Boolean).join(" · ")}</div>
      ${e.ingredientes ? `<p style="font-size:.82rem;color:var(--muted);margin-top:.4rem;">${e.ingredientes.substring(0,100)}${e.ingredientes.length>100?"...":""}</p>` : ""}
      ${e.categoria ? `<span class="erva-tag">${e.categoria}</span>` : ""}
    </div>
  `).join("");
  el.querySelectorAll("[data-tipo='erva']").forEach(card => {
    card.addEventListener("click", () => {
      const e = _ervas.find(x => x.id === card.dataset.id); if (!e) return;
      _ervaAtiva = e;
      document.getElementById("ver-erva-nome").textContent = e.nome;
      document.getElementById("ver-erva-meta").textContent = [e.categoria, e.orixa].filter(Boolean).join(" · ");
      document.getElementById("ver-erva-ingredientes").textContent = e.ingredientes||"—";
      document.getElementById("ver-erva-modo").textContent = e.modo||"—";
      document.getElementById("ver-erva-obs").textContent = e.obs||"";
      ["btn-editar-erva-modal","btn-deletar-erva-modal"].forEach(id => { document.getElementById(id).style.display = _isAdmin ? "" : "none"; });
      openModal("modal-ver-erva");
    });
  });
}

function filtrarErvas() {
  const cat = document.getElementById("filtro-ervas").value.toLowerCase();
  const q = document.getElementById("search-ervas").value.toLowerCase();
  renderErvas(_ervas.filter(e => (!cat || (e.categoria||"").toLowerCase().includes(cat)) && (!q || e.nome.toLowerCase().includes(q) || (e.ingredientes||"").toLowerCase().includes(q))));
}
document.getElementById("filtro-ervas").addEventListener("change", filtrarErvas);
document.getElementById("search-ervas").addEventListener("input", filtrarErvas);

document.getElementById("btn-nova-erva").addEventListener("click", () => {
  document.getElementById("modal-erva-title").textContent = "Nova Erva / Banho";
  ["erva-id","erva-nome","erva-ingredientes","erva-modo","erva-obs"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("erva-cat").value = ""; document.getElementById("erva-orixa").value = "";
  openModal("modal-erva");
});
document.getElementById("btn-cancelar-erva").addEventListener("click", () => closeModal("modal-erva"));
document.getElementById("btn-salvar-erva").addEventListener("click", async () => {
  const id = document.getElementById("erva-id").value;
  const data = {
    nome: document.getElementById("erva-nome").value.trim(),
    categoria: document.getElementById("erva-cat").value,
    orixa: document.getElementById("erva-orixa").value,
    ingredientes: document.getElementById("erva-ingredientes").value.trim(),
    modo: document.getElementById("erva-modo").value.trim(),
    obs: document.getElementById("erva-obs").value.trim(),
  };
  if (!data.nome) { alert("Informe o nome."); return; }
  id ? await updateDoc(doc(db, "ervas", id), data) : await addDoc(collection(db, "ervas"), { ...data, criadoEm: serverTimestamp() });
  closeModal("modal-erva"); closeModal("modal-ver-erva"); await loadErvas();
});
document.getElementById("btn-fechar-ver-erva").addEventListener("click", () => closeModal("modal-ver-erva"));
document.getElementById("btn-editar-erva-modal").addEventListener("click", () => {
  const e = _ervaAtiva; if (!e) return;
  document.getElementById("modal-erva-title").textContent = "Editar Erva / Banho";
  document.getElementById("erva-id").value = e.id; document.getElementById("erva-nome").value = e.nome;
  document.getElementById("erva-cat").value = e.categoria||""; document.getElementById("erva-orixa").value = e.orixa||"";
  document.getElementById("erva-ingredientes").value = e.ingredientes||""; document.getElementById("erva-modo").value = e.modo||"";
  document.getElementById("erva-obs").value = e.obs||""; closeModal("modal-ver-erva"); openModal("modal-erva");
});
document.getElementById("btn-deletar-erva-modal").addEventListener("click", async () => {
  if (!_ervaAtiva || !confirm(`Excluir "${_ervaAtiva.nome}"?`)) return;
  await deleteDoc(doc(db, "ervas", _ervaAtiva.id)); closeModal("modal-ver-erva"); await loadErvas();
});

// ══════════════════════════════════════════════════
// REZAS & ORAÇÕES
// ══════════════════════════════════════════════════
let _rezas = [], _rezaAtiva = null;

async function loadRezas() {
  const snap = await getDocs(query(collection(db, "rezas"), orderBy("criadoEm", "desc")));
  _rezas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderRezas(_rezas);
}

function renderRezas(lista) {
  const el = document.getElementById("lista-rezas");
  if (!lista.length) { el.innerHTML = `<div class="empty-state"><p>Nenhuma reza ou oração cadastrada ainda.</p></div>`; return; }
  el.innerHTML = lista.map(r => `
    <div class="card" style="cursor:pointer;margin-bottom:.75rem;" data-id="${r.id}" data-tipo="reza">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;">
        <div>
          <div class="card-title">${r.titulo}</div>
          <div class="card-meta">${[r.categoria,r.orixa].filter(Boolean).join(" · ")}</div>
        </div>
        ${r.categoria ? `<span class="erva-tag">${r.categoria}</span>` : ""}
      </div>
      <div class="reza-card-texto">${(r.texto||"").substring(0,160)}${(r.texto||"").length>160?"...":""}</div>
    </div>
  `).join("");
  el.querySelectorAll("[data-tipo='reza']").forEach(card => {
    card.addEventListener("click", () => {
      const r = _rezas.find(x => x.id === card.dataset.id); if (!r) return;
      _rezaAtiva = r;
      document.getElementById("ver-reza-titulo").textContent = r.titulo;
      document.getElementById("ver-reza-meta").textContent = [r.categoria,r.orixa].filter(Boolean).join(" · ");
      document.getElementById("ver-reza-texto").textContent = r.texto||"";
      document.getElementById("ver-reza-ocasiao").textContent = r.ocasiao ? "Quando usar: "+r.ocasiao : "";
      ["btn-editar-reza-modal","btn-deletar-reza-modal"].forEach(id => { document.getElementById(id).style.display = _isAdmin ? "" : "none"; });
      openModal("modal-ver-reza");
    });
  });
}

function filtrarRezas() {
  const cat = document.getElementById("filtro-rezas").value.toLowerCase();
  const q = document.getElementById("search-rezas").value.toLowerCase();
  renderRezas(_rezas.filter(r => (!cat || (r.categoria||"").toLowerCase().includes(cat)) && (!q || r.titulo.toLowerCase().includes(q) || (r.texto||"").toLowerCase().includes(q))));
}
document.getElementById("filtro-rezas").addEventListener("change", filtrarRezas);
document.getElementById("search-rezas").addEventListener("input", filtrarRezas);

document.getElementById("btn-nova-reza").addEventListener("click", () => {
  document.getElementById("modal-reza-title").textContent = "Nova Reza / Oração";
  ["reza-id","reza-titulo","reza-texto","reza-ocasiao"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("reza-cat").value = ""; document.getElementById("reza-orixa").value = "";
  openModal("modal-reza");
});
document.getElementById("btn-cancelar-reza").addEventListener("click", () => closeModal("modal-reza"));
document.getElementById("btn-salvar-reza").addEventListener("click", async () => {
  const id = document.getElementById("reza-id").value;
  const data = {
    titulo: document.getElementById("reza-titulo").value.trim(),
    categoria: document.getElementById("reza-cat").value,
    orixa: document.getElementById("reza-orixa").value,
    texto: document.getElementById("reza-texto").value.trim(),
    ocasiao: document.getElementById("reza-ocasiao").value.trim(),
  };
  if (!data.titulo) { alert("Informe o título."); return; }
  id ? await updateDoc(doc(db, "rezas", id), data) : await addDoc(collection(db, "rezas"), { ...data, criadoEm: serverTimestamp() });
  closeModal("modal-reza"); closeModal("modal-ver-reza"); await loadRezas();
});
document.getElementById("btn-fechar-ver-reza").addEventListener("click", () => closeModal("modal-ver-reza"));
document.getElementById("btn-editar-reza-modal").addEventListener("click", () => {
  const r = _rezaAtiva; if (!r) return;
  document.getElementById("modal-reza-title").textContent = "Editar Reza / Oração";
  document.getElementById("reza-id").value = r.id; document.getElementById("reza-titulo").value = r.titulo;
  document.getElementById("reza-cat").value = r.categoria||""; document.getElementById("reza-orixa").value = r.orixa||"";
  document.getElementById("reza-texto").value = r.texto||""; document.getElementById("reza-ocasiao").value = r.ocasiao||"";
  closeModal("modal-ver-reza"); openModal("modal-reza");
});
document.getElementById("btn-deletar-reza-modal").addEventListener("click", async () => {
  if (!_rezaAtiva || !confirm(`Excluir "${_rezaAtiva.titulo}"?`)) return;
  await deleteDoc(doc(db, "rezas", _rezaAtiva.id)); closeModal("modal-ver-reza"); await loadRezas();
});

// ══════════════════════════════════════════════════
// GRUPOS
// ══════════════════════════════════════════════════
let _grupos = [], _grupoAtivo = null, _grupoMembros = [];

async function loadGrupos() {
  const snap = await getDocs(query(collection(db, "grupos"), orderBy("criadoEm", "desc")));
  _grupos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderGrupos();
}

function renderGrupos() {
  const el = document.getElementById("lista-grupos");
  if (!_grupos.length) { el.innerHTML = `<div class="empty-state"><p>Nenhum grupo criado ainda.</p></div>`; return; }
  el.innerHTML = _grupos.map(g => `
    <div class="card" style="cursor:pointer;" data-id="${g.id}" data-tipo="grupo">
      <div class="card-title">${g.nome}</div>
      ${g.desc ? `<div class="card-meta">${g.desc}</div>` : ""}
      <p style="font-size:.82rem;color:var(--muted);margin-top:.4rem;">${(g.membrosEmails||[]).length} membro(s)</p>
    </div>
  `).join("");
  el.querySelectorAll("[data-tipo='grupo']").forEach(card => {
    card.addEventListener("click", () => {
      const g = _grupos.find(x => x.id === card.dataset.id); if (!g) return;
      abrirModalEditarGrupo(g);
    });
  });
}

function renderGrupoMembros() {
  const ul = document.getElementById("grupo-membros-lista");
  ul.innerHTML = _grupoMembros.map((m, i) => `
    <li style="display:flex;align-items:center;justify-content:space-between;padding:.3rem 0;border-bottom:1px solid var(--border);font-size:.85rem;">
      <span>${m.email}</span>
      <button class="btn btn-danger" style="padding:.2rem .5rem;font-size:.72rem;" data-rm-idx="${i}">✕</button>
    </li>
  `).join("");
  ul.querySelectorAll("[data-rm-idx]").forEach(btn => {
    btn.addEventListener("click", () => { _grupoMembros.splice(parseInt(btn.dataset.rmIdx,10),1); renderGrupoMembros(); });
  });
}

document.getElementById("btn-grupo-add-membro").addEventListener("click", async () => {
  const inp = document.getElementById("grupo-email-add");
  const email = inp.value.trim().toLowerCase();
  if (!email) return;
  if (_grupoMembros.find(m => m.email === email)) { alert("E-mail já na lista."); return; }
  let uid = null;
  try {
    const snap = await getDocs(query(collection(db, "membros"), where("email","==",email)));
    if (!snap.empty) uid = snap.docs[0].id;
  } catch (e) { /* silencioso */ }
  _grupoMembros.push({ email, uid });
  inp.value = "";
  renderGrupoMembros();
});

document.getElementById("btn-novo-grupo").addEventListener("click", () => {
  _grupoAtivo = null; _grupoMembros = [];
  document.getElementById("modal-grupo-title").textContent = "Novo Grupo";
  ["grupo-id","grupo-nome","grupo-desc","grupo-email-add"].forEach(id => document.getElementById(id).value = "");
  renderGrupoMembros(); openModal("modal-grupo");
});

function abrirModalEditarGrupo(g) {
  _grupoAtivo = g;
  _grupoMembros = (g.membrosEmails||[]).map((email,i) => ({ email, uid: (g.membrosUids||[])[i]||null }));
  document.getElementById("modal-grupo-title").textContent = "Editar Grupo";
  document.getElementById("grupo-id").value = g.id; document.getElementById("grupo-nome").value = g.nome;
  document.getElementById("grupo-desc").value = g.desc||""; document.getElementById("grupo-email-add").value = "";
  renderGrupoMembros(); openModal("modal-grupo");
}

document.getElementById("btn-cancelar-grupo").addEventListener("click", () => closeModal("modal-grupo"));
document.getElementById("btn-salvar-grupo").addEventListener("click", async () => {
  const id = document.getElementById("grupo-id").value;
  const nome = document.getElementById("grupo-nome").value.trim();
  if (!nome) { alert("Informe o nome do grupo."); return; }
  const data = {
    nome, desc: document.getElementById("grupo-desc").value.trim(),
    membrosEmails: _grupoMembros.map(m => m.email),
    membrosUids: _grupoMembros.map(m => m.uid||null),
  };
  id ? await updateDoc(doc(db, "grupos", id), data) : await addDoc(collection(db, "grupos"), { ...data, criadoEm: serverTimestamp() });
  closeModal("modal-grupo"); await loadGrupos();
});

// ══════════════════════════════════════════════════
// NOVO: REGÊNCIA DO DIA, FASE DA LUA & SABEDORIA
// ══════════════════════════════════════════════════

const DIAS_ORIXAS = [
  { dia: "Domingo", orixa: "Nanã & Oxalá", icon: "🕊️", cor: "Branco e Lilás" },
  { dia: "Segunda-feira", orixa: "Exu & Omulu / Obaluaê", icon: "🔱", cor: "Preto, Vermelho e Branco/Preto" },
  { dia: "Terça-feira", orixa: "Ogum", icon: "⚔️", cor: "Azul escuro ou Vermelho" },
  { dia: "Quarta-feira", orixa: "Xangô & Iansã", icon: "⚡", cor: "Marrom e Amarelo/Coral" },
  { dia: "Quinta-feira", orixa: "Oxóssi & Logunan", icon: "🏹", cor: "Verde" },
  { dia: "Sexta-feira", orixa: "Oxalá", icon: "✨", cor: "Branco Imaculado" },
  { dia: "Sábado", orixa: "Iemanjá & Oxum", icon: "🌊", cor: "Azul claro e Dourado" }
];

const FRASES_SABEDORIA = [
  "O silêncio é a prece que a alma faz quando busca a sabedoria dos mais velhos.",
  "Quem tem fé em seus guias nunca caminha sozinho no escuro.",
  "A Umbanda é a manifestação do espírito para a caridade com amor e humildade.",
  "Firme o seu pensamento no bem, pois o que você emana retorna multiplicado.",
  "Na força das matas e no cantar das águas encontramos o alento do coração.",
  "Respeite o chão sagrado que pisa e a espiritualidade abrirá todos os seus caminhos.",
  "A paciência é o maior fundamento de quem veste branco e busca a evolução."
];

function calcularFaseDaLua(date = new Date()) {
  // Cálculo simplificado de fase lunar baseado no ciclo sinódico (29.53 dias)
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  let c = 0, e = 0, jd = 0, b = 0;
  if (m < 3) {
    // Ajuste de anos bissextos
  }
  // Algoritmo de Conway
  const year = y - (12 - m < 0 ? 0 : 0);
  const cycle = (year - 2000) * 11;
  const epact = (cycle + m + d) % 30;
  
  if (epact >= 0 && epact <= 3) return { nome: "Lua Nova", icon: "🌑", dica: "Ideal para novos começos, plantio espiritual e firmezas de início." };
  if (epact > 3 && epact < 13) return { nome: "Lua Crescente", icon: "🌓", dica: "Excelente para banhos de prosperidade, atração e fortalecimento de projetos." };
  if (epact >= 13 && epact <= 17) return { nome: "Lua Cheia", icon: "🌕", dica: "Poder máximo! Excelente para consagrações, banhos de amor e firmezas com Iemanjá e Oxum." };
  return { nome: "Lua Minguante", icon: "🌗", dica: "Perfeita para banhos de descarrego, banir energias densas e limpeza profunda." };
}

function initDashboardAxeWidgets() {
  const hoje = new Date();
  const diaSemana = hoje.getDay(); // 0 a 6
  const regencia = DIAS_ORIXAS[diaSemana];
  const lua = calcularFaseDaLua(hoje);

  // 1. Orixá do dia
  const elOrixaName = document.getElementById("today-orixa-name");
  const elOrixaIcon = document.getElementById("today-orixa-icon");
  if (elOrixaName && regencia) {
    elOrixaName.textContent = regencia.orixa;
    if (elOrixaIcon) elOrixaIcon.textContent = regencia.icon;
  }

  // 2. Fase da Lua
  const elMoonName = document.getElementById("today-moon-name");
  const elMoonIcon = document.getElementById("today-moon-icon");
  if (elMoonName && lua) {
    elMoonName.textContent = lua.nome;
    if (elMoonIcon) elMoonIcon.textContent = lua.icon;
  }

  // 3. Frase de Axé
  const elQuote = document.getElementById("daily-quote");
  if (elQuote) {
    const fraseIndex = Math.floor(Math.random() * FRASES_SABEDORIA.length);
    elQuote.textContent = `"${FRASES_SABEDORIA[fraseIndex]}"`;
  }

  // 4. Saudação Personalizada
  const elGreeting = document.getElementById("greeting-title");
  if (elGreeting && _currentUser) {
    const nome = (_currentUser.displayName || _currentUser.email || "").split("@")[0].split(" ")[0];
    const capitalizado = nome.charAt(0).toUpperCase() + nome.slice(1);
    elGreeting.textContent = `Saravá, ${capitalizado}! Que Oxalá abençoe seu dia.`;
  }
}

// ══════════════════════════════════════════════════
// AÇÕES RÁPIDAS (QUICK ACTIONS)
// ══════════════════════════════════════════════════

document.getElementById("qa-calc-banhos")?.addEventListener("click", () => {
  openModal("modal-calc-banhos");
  renderBanhoCalculado("descarrego");
});

document.getElementById("qa-random-ponto")?.addEventListener("click", () => {
  if (!_pontos || !_pontos.length) { alert("Nenhum ponto carregado no momento."); return; }
  const aleatorio = _pontos[Math.floor(Math.random() * _pontos.length)];
  _pontoAtivo = aleatorio;
  document.getElementById("ver-ponto-titulo").textContent = aleatorio.titulo;
  document.getElementById("ver-ponto-orixa").textContent = aleatorio.orixa||"";
  document.getElementById("ver-ponto-linha").textContent = aleatorio.linha ? "Linha: "+aleatorio.linha : "";
  document.getElementById("ver-ponto-letra").textContent = aleatorio.letra||"";
  document.getElementById("ver-ponto-obs").textContent = aleatorio.obs ? "Obs: "+aleatorio.obs : "";
  openModal("modal-ver-ponto");
});

document.getElementById("qa-ver-giras")?.addEventListener("click", () => {
  navegarPara("calendario");
});

document.getElementById("qa-minhas-limpezas")?.addEventListener("click", () => {
  navegarPara("limpeza");
  document.getElementById("btn-filtro-minhas-tarefas")?.click();
});

document.getElementById("btn-abrir-calc-banhos")?.addEventListener("click", () => {
  openModal("modal-calc-banhos");
  renderBanhoCalculado("descarrego");
});

document.getElementById("btn-fechar-calc-banhos")?.addEventListener("click", () => closeModal("modal-calc-banhos"));


// ══════════════════════════════════════════════════
// CALCULADORA / MONTADOR DE BANHOS DE ERVAS
// ══════════════════════════════════════════════════

const RECEITAS_BANHOS = {
  descarrego: {
    titulo: "Banho de Descarrego Pesado & Quebra de Demandas",
    ervas: [
      { nome: "Guiné", tipo: "quente" },
      { nome: "Arruda", tipo: "quente" },
      { nome: "Palha de Aho", tipo: "quente" },
      { nome: "Alecrim", tipo: "morna" }
    ],
    modoPreparo: "Ferva 2 litros de água mineral ou filtrada. Apague o fogo e adicione as ervas. Mantenha abafado por 15 a 20 minutos. Coe e deixe amornar.",
    aplicacao: "Tome seu banho de higiene normal primeiro. Em seguida, despeje este preparado EXCLUSIVAMENTE do pescoço para baixo, mentalizando a transmutação de todas as energias densas.",
    avisoOri: "NUNCA jogue ervas quentes na cabeça (coroa/ori). Apenas do pescoço para baixo."
  },
  abertura: {
    titulo: "Banho de Abertura de Caminhos & Oportunidades",
    ervas: [
      { nome: "Abre-Caminho", tipo: "morna" },
      { nome: "Louro (3 folhas)", tipo: "morna" },
      { nome: "Manjericão", tipo: "morna" },
      { nome: "Canela em Pau", tipo: "quente" }
    ],
    modoPreparo: "Ferva a água com a canela por 3 minutos. Desligue o fogo, adicione o abre-caminho, louro e manjericão. Macere suavemente com as mãos limpas e abafe.",
    aplicacao: "Despeje do pescoço para baixo pela manhã ou antes de compromissos importantes, pedindo a Pai Ogum e Pai Oxóssi que destranquem suas passadas.",
    avisoOri: null
  },
  calmaria: {
    titulo: "Banho de Paz, Calmaria & Firmeza de Coroa",
    ervas: [
      { nome: "Manjericão Branco", tipo: "fria" },
      { nome: "Camomila", tipo: "fria" },
      { nome: "Erva-Cidreira", tipo: "fria" },
      { nome: "Pétalas de Rosa Branca", tipo: "fria" }
    ],
    modoPreparo: "Em água fresca ou levemente morna, macere as ervas delicadamente com as mãos em prece, louvando Pai Oxalá e Mamãe Oxum. Não é necessário ferver.",
    aplicacao: "Pode ser tomado da CABEÇA AOS PÉS (incluindo coroa/ori). Proporciona sono tranquilo, clareza mental e paz de espírito.",
    avisoOri: "Livre para o Ori (cabeça). Banho de pura paz e acolhimento."
  },
  protecao: {
    titulo: "Banho de Blindagem Espiritual & Proteção de Ogum",
    ervas: [
      { nome: "Espada de São Jorge (picada)", tipo: "quente" },
      { nome: "Alecrim do Campo", tipo: "morna" },
      { nome: "Eucalipto", tipo: "quente" },
      { nome: "Lavanda / Alfazema", tipo: "morna" }
    ],
    modoPreparo: "Ferva a água, adicione a espada de São Jorge e o eucalipto por 2 minutos. Desligue, acrescente o alecrim e alfazema, abafando até esfriar.",
    aplicacao: "Despeje do pescoço para baixo às terças-feiras ou antes de giras de terreiro. Mentalize uma couraça azul e prateada ao seu redor.",
    avisoOri: "Do pescoço para baixo."
  },
  prosperidade: {
    titulo: "Banho de Fartura, Prosperidade & Ouro de Oxum",
    ervas: [
      { nome: "Calêndula", tipo: "morna" },
      { nome: "Girassol (pétalas)", tipo: "morna" },
      { nome: "Folhas de Pitangueira", tipo: "morna" },
      { nome: "Cravo da Índia (7 cravos)", tipo: "quente" }
    ],
    modoPreparo: "Ferva a água com os cravos. Desligue e adicione as flores e folhas de pitanga com uma colher de chá de mel de abelha. Abafe por 15 min.",
    aplicacao: "Despeje do pescoço para baixo, em dia ensolarado ou quinta-feira/sábado, emanando alegria, abundância e gratidão à espiritualidade.",
    avisoOri: null
  },
  amor: {
    titulo: "Banho de Autoestima, Amor Próprio & Atração Serena",
    ervas: [
      { nome: "Pétalas de Rosa Cor-de-Rosa", tipo: "morna" },
      { nome: "Erva-Doce", tipo: "fria" },
      { nome: "Jasmim", tipo: "fria" },
      { nome: "Manjericão de Folha Larga", tipo: "morna" }
    ],
    modoPreparo: "Infusão suave: despeje água fervente sobre os ingredientes e adicione algumas gotas de perfume de alfazema após amornar.",
    aplicacao: "Despeje do pescoço para baixo, respirando fundo e reconhecendo o seu valor sagrado e magnetismo divino.",
    avisoOri: null
  }
};

let _currentBanhoRecipe = RECEITAS_BANHOS.descarrego;

function renderBanhoCalculado(intentKey) {
  const rec = RECEITAS_BANHOS[intentKey] || RECEITAS_BANHOS.descarrego;
  _currentBanhoRecipe = rec;
  const card = document.getElementById("banho-recipe-card");
  if (!card) return;

  const ervasHTML = rec.ervas.map(e => `
    <span class="erva-chip ${e.tipo}">${e.nome} (${e.tipo.toUpperCase()})</span>
  `).join("");

  const avisoOriHTML = rec.avisoOri ? `
    <div class="banho-alert-ori">
      <span>⚠️</span>
      <strong>Atenção:</strong> ${rec.avisoOri}
    </div>
  ` : `
    <div style="background:rgba(39, 174, 96, 0.1); border:1px solid rgba(39, 174, 96, 0.3); color:var(--success); padding:0.6rem 0.8rem; border-radius:8px; font-size:0.8rem; margin-top:0.75rem;">
      <span>✨</span> Este preparado possui ervas suaves e pode ser vertido da cabeça aos pés.
    </div>
  `;

  card.innerHTML = `
    <h3>${rec.titulo}</h3>
    <p style="font-size:0.75rem; text-transform:uppercase; color:var(--muted); font-weight:700; margin-top:0.5rem;">Ervas Necessárias & Polaridade:</p>
    <div class="banho-ervas-chips">${ervasHTML}</div>
    <div style="margin-top:0.75rem;">
      <p style="font-size:0.78rem; font-weight:700; color:var(--gold); text-transform:uppercase;">Modo de Preparo:</p>
      <p style="font-size:0.85rem; color:var(--text); line-height:1.6;">${rec.modoPreparo}</p>
    </div>
    <div style="margin-top:0.75rem;">
      <p style="font-size:0.78rem; font-weight:700; color:var(--gold); text-transform:uppercase;">Como Aplicar:</p>
      <p style="font-size:0.85rem; color:var(--text); line-height:1.6;">${rec.aplicacao}</p>
    </div>
    ${avisoOriHTML}
  `;
}

document.querySelectorAll(".banho-intent-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".banho-intent-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderBanhoCalculado(btn.dataset.intent);
  });
});

document.getElementById("btn-share-banho-wa")?.addEventListener("click", () => {
  if (!_currentBanhoRecipe) return;
  const texto = `🌿 *${_currentBanhoRecipe.titulo}* (Templo Pai Tuiamissu)\n\n` +
    `*Ervas:* ${_currentBanhoRecipe.ervas.map(e => e.nome).join(", ")}\n\n` +
    `*Preparo:* ${_currentBanhoRecipe.modoPreparo}\n\n` +
    `*Aplicação:* ${_currentBanhoRecipe.aplicacao}\n\n` +
    (_currentBanhoRecipe.avisoOri ? `⚠️ *Cuidado:* ${_currentBanhoRecipe.avisoOri}\n\n` : '') +
    `_Saravá nosso sagrado!_`;
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, "_blank");
});


// ══════════════════════════════════════════════════
// BUSCA GLOBAL RÁPIDA (CMD+K / CTRL+K)
// ══════════════════════════════════════════════════

function abrirBuscaGlobal() {
  openModal("modal-global-search");
  const input = document.getElementById("global-search-input");
  if (input) {
    input.value = "";
    input.focus();
  }
  document.getElementById("global-search-results").innerHTML = `
    <p style="color:var(--muted); font-size:0.85rem; text-align:center; padding:1.5rem 0;">Digite ao menos 2 letras para pesquisar no Grimório...</p>
  `;
}

document.getElementById("btn-open-search")?.addEventListener("click", abrirBuscaGlobal);
document.getElementById("btn-fechar-global-search")?.addEventListener("click", () => closeModal("modal-global-search"));

// Atalho universal de teclado Ctrl+K ou Cmd+K
window.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    abrirBuscaGlobal();
  }
});

document.getElementById("global-search-input")?.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase().trim();
  const resContainer = document.getElementById("global-search-results");
  if (!resContainer) return;

  if (query.length < 2) {
    resContainer.innerHTML = `<p style="color:var(--muted); font-size:0.85rem; text-align:center; padding:1.5rem 0;">Digite ao menos 2 letras para pesquisar no Grimório...</p>`;
    return;
  }

  const results = [];

  // 1. Pontos
  (_pontos || []).forEach(p => {
    if ((p.titulo||"").toLowerCase().includes(query) || (p.letra||"").toLowerCase().includes(query) || (p.orixa||"").toLowerCase().includes(query)) {
      results.push({ tipo: "Ponto Cantado", titulo: p.titulo, subtitulo: p.orixa || p.linha, item: p, handler: () => {
        closeModal("modal-global-search");
        _pontoAtivo = p;
        document.getElementById("ver-ponto-titulo").textContent = p.titulo;
        document.getElementById("ver-ponto-orixa").textContent = p.orixa||"";
        document.getElementById("ver-ponto-linha").textContent = p.linha ? "Linha: "+p.linha : "";
        document.getElementById("ver-ponto-letra").textContent = p.letra||"";
        document.getElementById("ver-ponto-obs").textContent = p.obs ? "Obs: "+p.obs : "";
        openModal("modal-ver-ponto");
      }});
    }
  });

  // 2. Orixás
  (_orixas || []).forEach(o => {
    if ((o.nome||"").toLowerCase().includes(query) || (o.saudacao||"").toLowerCase().includes(query) || (o.dominios||"").toLowerCase().includes(query)) {
      results.push({ tipo: "Orixá", titulo: o.nome, subtitulo: o.saudacao || o.dominios, item: o, handler: () => {
        closeModal("modal-global-search");
        navegarPara("orixas");
        const btn = document.querySelector(`.orixa-tab-btn[data-id="${o.id}"]`);
        if (btn) btn.click();
      }});
    }
  });

  // 3. Ervas
  (_ervas || []).forEach(ev => {
    if ((ev.nome||"").toLowerCase().includes(query) || (ev.ingredientes||"").toLowerCase().includes(query) || (ev.categoria||"").toLowerCase().includes(query)) {
      results.push({ tipo: "Erva / Banho", titulo: ev.nome, subtitulo: ev.categoria || ev.orixa, item: ev, handler: () => {
        closeModal("modal-global-search");
        _ervaAtiva = ev;
        document.getElementById("ver-erva-nome").textContent = ev.nome;
        document.getElementById("ver-erva-meta").textContent = [ev.categoria, ev.orixa].filter(Boolean).join(" · ");
        document.getElementById("ver-erva-ingredientes").textContent = ev.ingredientes||"—";
        document.getElementById("ver-erva-modo").textContent = ev.modo||"—";
        document.getElementById("ver-erva-obs").textContent = ev.obs||"";
        openModal("modal-ver-erva");
      }});
    }
  });

  // 4. Rezas
  (_rezas || []).forEach(r => {
    if ((r.titulo||"").toLowerCase().includes(query) || (r.texto||"").toLowerCase().includes(query)) {
      results.push({ tipo: "Reza / Oração", titulo: r.titulo, subtitulo: r.categoria || r.orixa, item: r, handler: () => {
        closeModal("modal-global-search");
        _rezaAtiva = r;
        document.getElementById("ver-reza-titulo").textContent = r.titulo;
        document.getElementById("ver-reza-meta").textContent = [r.categoria, r.orixa].filter(Boolean).join(" · ");
        document.getElementById("ver-reza-texto").textContent = r.texto||"—";
        document.getElementById("ver-reza-ocasiao").textContent = r.ocasiao ? "Quando usar: "+r.ocasiao : "";
        openModal("modal-ver-reza");
      }});
    }
  });

  // 5. Eventos / Giras
  (_eventos || []).forEach(ev => {
    if ((ev.nome||"").toLowerCase().includes(query) || (ev.desc||"").toLowerCase().includes(query)) {
      results.push({ tipo: "Evento / Gira", titulo: ev.nome, subtitulo: `${ev.data ? formatarData(ev.data) : ''} · ${ev.tipo||''}`, item: ev, handler: () => {
        closeModal("modal-global-search");
        navegarPara("calendario");
      }});
    }
  });

  if (!results.length) {
    resContainer.innerHTML = `<p style="color:var(--muted); font-size:0.85rem; text-align:center; padding:1.5rem 0;">Nenhum resultado encontrado para "<strong>${query}</strong>".</p>`;
    return;
  }

  resContainer.innerHTML = results.slice(0, 15).map((r, idx) => `
    <div class="global-search-item" data-idx="${idx}">
      <div class="global-search-item-info">
        <strong>${r.titulo}</strong>
        <span>${r.subtitulo || ''}</span>
      </div>
      <span class="global-search-item-badge">${r.tipo}</span>
    </div>
  `).join("");

  resContainer.querySelectorAll(".global-search-item").forEach(itemEl => {
    itemEl.addEventListener("click", () => {
      const idx = parseInt(itemEl.dataset.idx, 10);
      if (results[idx] && results[idx].handler) results[idx].handler();
    });
  });
});

// ══════════════════════════════════════════════════
// REGISTRO DE SERVICE WORKER (PWA & OFFLINE)
// ══════════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      console.log('Grimório PWA Service Worker registrado com sucesso:', reg.scope);
    }).catch((err) => {
      console.log('Falha ao registrar Service Worker:', err);
    });
  });
}
