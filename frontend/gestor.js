// ============================================================
// GUARUTONER — GESTOR (v2 — sem duplicatas + relatórios)
// ============================================================

const API = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';
const REFRESH_RATE = 20000; // 20 segundos

// AUTH CHECK
const userStr = localStorage.getItem('guarutoner_gestor') || localStorage.getItem('guarutoner_user');
if (!userStr) {
  window.location.href = 'index.html';
} else {
  const user = JSON.parse(userStr);
  if (user.tipo !== 'gestor') {
    window.location.href = 'index.html';
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('userNameDisplay').textContent = user.nome;
      document.getElementById('btnLogout').addEventListener('click', () => {
        localStorage.removeItem('guarutoner_gestor');
        localStorage.removeItem('guarutoner_user');
        window.location.href = 'index.html';
      });
    });
  }
}

// DOM
const $ = (s) => document.getElementById(s);
const dom = {
  techList: $('techList'),
  statTot: $('statTot'),
  statR: $('statR'),
  statF: $('statF'),
  toasts: $('toasts')
};

function toast(msg, type = 'info') {
  const d = document.createElement('div');
  d.className = `toast-item ${type}`;
  d.textContent = msg;
  dom.toasts.appendChild(d);
  setTimeout(() => d.remove(), 3500);
}

// Formatar data relativa
function timeAgo(iso) {
  if (!iso) return '—';
  const s = Math.floor((new Date() - new Date(iso)) / 1000);
  if (s < 10) return 'Agora';
  if (s < 60) return `Há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `Há ${m}min`;
  return new Date(iso).toLocaleTimeString('pt-BR');
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

// ============================================================
// ABAS — Mapa / Relatórios
// ============================================================
let abaAtiva = 'mapa';

function trocarAba(aba) {
  abaAtiva = aba;
  document.querySelectorAll('.sidebar-list li').forEach(li => li.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  if (aba === 'mapa') {
    document.getElementById('tabMapa').classList.add('active');
    document.getElementById('contentMapa').classList.add('active');
    setTimeout(() => map && map.invalidateSize(), 100);
  } else if (aba === 'relatorios') {
    document.getElementById('tabRelatorios').classList.add('active');
    document.getElementById('contentRelatorios').classList.add('active');
    carregarRelatorios();
  } else if (aba === 'equipe') {
    document.getElementById('tabEquipe').classList.add('active');
    document.getElementById('contentEquipe').classList.add('active');
    carregarEquipe();
  }

  // Fechar sidebar no mobile após clique
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.querySelector('.sidebar-backdrop');
  if (window.innerWidth <= 900 && sidebar) {
    sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
  }
}

// ============================================================
// MAPA - LEAFLET + ANIMAÇÃO SUAVE
// ============================================================
let map;
const markers = {};
const markerPositions = {}; // Para animação suave

const techIcon = L.divIcon({
  className: 'custom-pin',
  html: `
    <svg width="36" height="44" viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-20%" y="-10%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.3"/>
        </filter>
      </defs>
      <path d="M18 0C8.06 0 0 8.06 0 18c0 11.62 18 26 18 26s18-14.38 18-26C36 8.06 27.94 0 18 0z" fill="#00154d" filter="url(#shadow)"/>
      <circle cx="18" cy="18" r="7" fill="#ffffff"/>
      <circle cx="18" cy="18" r="4" fill="#0066cc"/>
    </svg>
  `,
  iconSize: [36, 44],
  iconAnchor: [18, 44],
  popupAnchor: [0, -44]
});

const techIconRota = L.divIcon({
  className: 'custom-pin pulse-pin',
  html: `
    <svg width="36" height="44" viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadowR" x="-20%" y="-10%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.3"/>
        </filter>
      </defs>
      <path d="M18 0C8.06 0 0 8.06 0 18c0 11.62 18 26 18 26s18-14.38 18-26C36 8.06 27.94 0 18 0z" fill="#16a34a" filter="url(#shadowR)"/>
      <circle cx="18" cy="18" r="7" fill="#ffffff"/>
      <circle cx="18" cy="18" r="4" fill="#22c55e"/>
    </svg>
  `,
  iconSize: [36, 44],
  iconAnchor: [18, 44],
  popupAnchor: [0, -44]
});

function initMap() {
  map = L.map('map').setView([-23.5505, -46.6333], 12);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);
}

// Animação suave do marcador (interpola entre posição atual e nova)
function animateMarker(markerId, newLat, newLng, duration = 1000) {
  const marker = markers[markerId];
  if (!marker) return;

  const startPos = marker.getLatLng();
  const startLat = startPos.lat;
  const startLng = startPos.lng;

  // Se a distância é muito pequena, não animar
  const dist = Math.abs(newLat - startLat) + Math.abs(newLng - startLng);
  if (dist < 0.000001) return;

  // Se a distância é muito grande (teleporte), mover direto
  if (dist > 0.1) {
    marker.setLatLng([newLat, newLng]);
    return;
  }

  const startTime = performance.now();

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease out quad
    const eased = 1 - (1 - progress) * (1 - progress);

    const lat = startLat + (newLat - startLat) * eased;
    const lng = startLng + (newLng - startLng) * eased;

    marker.setLatLng([lat, lng]);

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

function updateMap(tecnicos) {
  let bounds = [];

  tecnicos.forEach(t => {
    const lat = t.localizacao?.lat;
    const lng = t.localizacao?.lng;
    if (lat == null || lng == null) return;

    bounds.push([lat, lng]);
    const icon = t.emRota ? techIconRota : techIcon;

    const popupContent = `
      <div style="font-family: 'Inter', sans-serif; min-width: 160px;">
        <strong style="color: #00154d; font-size: 14px;">${t.nome}</strong><br>
        <span style="display: inline-block; margin: 4px 0; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; background: ${t.emRota ? '#dcfce7' : '#e0e7ff'}; color: ${t.emRota ? '#16a34a' : '#00154d'};">
          ${t.emRota ? '🚗 Em Rota' : '⏸ Livre'}
        </span><br>
        ${t.clienteAtual ? `<span style="font-size: 12px; color: #334155;">📍 ${t.clienteAtual}</span><br>` : ''}
        <span style="font-size: 11px; color: #94a3b8;">Atualizado: ${timeAgo(t.ultimoUpdate)}</span>
      </div>
    `;

    if (markers[t.usuario_id]) {
      // Atualizar marcador existente com animação suave
      animateMarker(t.usuario_id, lat, lng);
      markers[t.usuario_id].setPopupContent(popupContent);
      markers[t.usuario_id].setIcon(icon);
    } else {
      // Criar novo marcador
      markers[t.usuario_id] = L.marker([lat, lng], { icon })
        .addTo(map)
        .bindPopup(popupContent);
    }
  });

  // Remover marcadores de técnicos que não estão mais online
  const activeIds = tecnicos.map(t => t.usuario_id);
  Object.keys(markers).forEach(id => {
    if (!activeIds.includes(id)) {
      map.removeLayer(markers[id]);
      delete markers[id];
    }
  });

  // Centralizar na primeira carga
  if (bounds.length > 0 && !window.mapCentered) {
    map.fitBounds(bounds, { padding: [50, 50] });
    window.mapCentered = true;
  }
}

// ============================================================
// TÉCNICOS — Cards
// ============================================================
function renderTechCard(t) {
  const badgeCls = t.emRota ? 'badge-blue' : 'badge-green';
  const badgeTxt = t.emRota ? 'Em Rota' : 'Livre';

  let routeHtml = '';
  if (t.emRota && t.listaClientes && t.listaClientes.length) {
    const items = t.listaClientes.map((c, i) => {
      let cls = '';
      let m = i + 1;
      if (i < t.indiceAtual) { cls = 'done'; m = '✓'; }
      else if (i === t.indiceAtual) { cls = 'cur'; m = '►'; }
      return `<div class="tc-route-item ${cls}"><span>${m}</span> ${c}</div>`;
    }).join('');

    routeHtml = `
      <div class="tc-route">
        <div class="tc-route-title">Rota (${t.indiceAtual}/${t.listaClientes.length})</div>
        ${items}
      </div>
    `;
  }

  const lat = t.localizacao?.lat != null ? t.localizacao.lat.toFixed(5) : '—';
  const lng = t.localizacao?.lng != null ? t.localizacao.lng.toFixed(5) : '—';

  return `
    <div class="tech-card" onclick="centerOnTech('${t.usuario_id}')">
      <div class="tc-top">
        <div class="tc-name">${t.nome}</div>
        <div class="badge ${badgeCls}">${badgeTxt}</div>
      </div>
      <div class="tc-row"><span class="tc-label">Destino Atual</span><span class="tc-val">${t.clienteAtual || '—'}</span></div>
      <div class="tc-row"><span class="tc-label">Latitude</span><span class="tc-val" style="font-family:monospace">${lat}</span></div>
      <div class="tc-row"><span class="tc-label">Longitude</span><span class="tc-val" style="font-family:monospace">${lng}</span></div>
      <div class="tc-row"><span class="tc-label">Atualizado</span><span class="tc-val">${timeAgo(t.ultimoUpdate)}</span></div>
      ${routeHtml}
    </div>
  `;
}

function centerOnTech(id) {
  if (markers[id]) {
    map.flyTo(markers[id].getLatLng(), 16, { duration: 1.2 });
    markers[id].openPopup();
  }
}

async function fetchTecnicos() {
  try {
    const r = await fetch(`${API}/tecnicos`);
    if (!r.ok) throw new Error('API erro');
    const data = await r.json();

    const tk = data.tecnicos || [];

    // Stats
    const tot = tk.length;
    const rota = tk.filter(t => t.emRota).length;

    dom.statTot.textContent = tot;
    dom.statR.textContent = rota;
    dom.statF.textContent = tot - rota;

    // Lista
    if (tot === 0) {
      dom.techList.innerHTML = `<div class="empty-panel"><div class="big">📭</div><div>Nenhum técnico ativo hoje.</div></div>`;
    } else {
      dom.techList.innerHTML = tk.map(renderTechCard).join('');
    }

    // Mapa
    updateMap(tk);

  } catch (err) {
    console.error('Fetch err:', err);
  }
}

// ============================================================
// RELATÓRIOS — HISTÓRICO DE ATENDIMENTOS
// ============================================================
async function carregarRelatorios() {
  const container = document.getElementById('relatoriosContent');
  if (!container) return;

  container.innerHTML = '<div class="loading-relatorios">Carregando histórico...</div>';

  try {
    const user = JSON.parse(localStorage.getItem('guarutoner_gestor') || localStorage.getItem('guarutoner_user'));
    const url = `${API}/admin/historico-atendimentos?adminEmail=${encodeURIComponent(user.email)}`;

    const r = await fetch(url);
    if (!r.ok) {
      container.innerHTML = '<div class="empty-relatorios">Acesso negado ou erro ao carregar.</div>';
      return;
    }

    const data = await r.json();
    const porDia = data.porDia || {};
    const dias = Object.keys(porDia).sort((a, b) => b.localeCompare(a));

    if (dias.length === 0) {
      container.innerHTML = `
        <div class="empty-relatorios">
          <div class="empty-icon">📋</div>
          <div class="empty-text">Nenhum atendimento registrado</div>
          <div class="empty-sub">Os atendimentos serão registrados automaticamente quando técnicos concluírem clientes em suas rotas.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = dias.map(dia => {
      const tecnicos = porDia[dia];
      const tecnicosList = Object.values(tecnicos);
      const totalAtendimentos = tecnicosList.reduce((s, t) => s + t.atendimentos.length, 0);

      const tecnicosHtml = tecnicosList.map(t => {
        const atendimentosHtml = t.atendimentos.map(a => `
          <div class="historico-item">
            <span class="historico-cliente">${a.nome_cliente}</span>
            <span class="historico-hora">concluído às ${a.hora}</span>
          </div>
        `).join('');

        return `
          <div class="historico-tecnico">
            <div class="historico-tecnico-header">
              <span class="historico-tecnico-icon">👤</span>
              <strong>Técnico: ${t.nome_tecnico}</strong>
              <span class="stat-pill" style="margin-left: auto;">${t.atendimentos.length} atendimento${t.atendimentos.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="historico-lista">
              ${atendimentosHtml}
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="relatorio-dia fade-in">
          <div class="relatorio-dia-header">
            <div class="relatorio-dia-titulo">
              <span class="relatorio-dia-icon">📅</span>
              ${formatDateShort(dia)}
            </div>
            <div class="relatorio-dia-stats">
              <span class="stat-pill">${tecnicosList.length} técnico${tecnicosList.length > 1 ? 's' : ''}</span>
              <span class="stat-pill green">${totalAtendimentos} atendimento${totalAtendimentos !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <div class="historico-dia-body">
            ${tecnicosHtml}
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Erro relatórios:', err);
    container.innerHTML = '<div class="empty-relatorios">Erro ao carregar relatórios.</div>';
  }
}

// ============================================================
// EQUIPE — Listar membros com contagem de atendimentos
// ============================================================
async function carregarEquipe() {
  const container = document.getElementById('equipeContent');
  if (!container) return;

  container.innerHTML = '<div class="loading-relatorios">Carregando equipe...</div>';

  try {
    const user = JSON.parse(localStorage.getItem('guarutoner_gestor') || localStorage.getItem('guarutoner_user'));
    const url = `${API}/admin/equipe?adminEmail=${encodeURIComponent(user.email)}`;

    const r = await fetch(url);
    if (!r.ok) {
      container.innerHTML = '<div class="empty-relatorios">Acesso negado ou erro ao carregar.</div>';
      return;
    }

    const data = await r.json();
    const equipe = data.equipe || [];

    if (equipe.length === 0) {
      container.innerHTML = `
        <div class="empty-relatorios">
          <div class="empty-icon">👥</div>
          <div class="empty-text">Nenhum membro na equipe</div>
          <div class="empty-sub">Usuários aprovados aparecerão aqui.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = '<div class="equipe-grid">' + equipe.map(m => {
      const isTecnico = m.tipo === 'tecnico';
      const tipoLabel = isTecnico ? 'Técnico' : 'Gestor';
      const tipoCls = isTecnico ? 'tipo-tecnico' : 'tipo-gestor';
      const avatarEmoji = isTecnico ? '🔧' : '📊';

      const statsHtml = isTecnico ? `
        <div class="equipe-stat">
          <span class="equipe-stat-num">${m.totalAtendimentos}</span>
          <span class="equipe-stat-label">atendimentos concluídos</span>
        </div>
      ` : '';

      return `
        <div class="equipe-card fade-in">
          <div class="equipe-card-top">
            <div class="equipe-avatar">${avatarEmoji}</div>
            <div class="equipe-info">
              <div class="equipe-nome">${m.nome}</div>
              <div class="equipe-tipo ${tipoCls}">${tipoLabel}</div>
            </div>
          </div>
          ${statsHtml}
        </div>
      `;
    }).join('') + '</div>';

  } catch (err) {
    console.error('Erro equipe:', err);
    container.innerHTML = '<div class="empty-relatorios">Erro ao carregar equipe.</div>';
  }
}

// ============================================================
// ADMIN: APROVAÇÕES PENDENTES
// ============================================================
let isAdmin = false;
const ADMIN_CHECK_EMAIL = 'adm@guarutoner.com.br';
const btnNotificacoes = $('btnNotificacoes');
const badgeNotificacoes = $('badgeNotificacoes');
const modalAprovacoes = $('modalAprovacoes');
const btnFecharModal = $('btnFecharModal');
const listaAprovacoes = $('listaAprovacoes');

if (userStr) {
  const user = JSON.parse(userStr);
  isAdmin = user.email.toLowerCase() === ADMIN_CHECK_EMAIL;
}

if (isAdmin) {
  btnNotificacoes.style.display = 'flex';

  btnNotificacoes.addEventListener('click', () => {
    modalAprovacoes.style.display = 'flex';
    fetchAprovacoes();
  });

  btnFecharModal.addEventListener('click', () => {
    modalAprovacoes.style.display = 'none';
  });

  modalAprovacoes.addEventListener('click', (e) => {
    if (e.target === modalAprovacoes) {
      modalAprovacoes.style.display = 'none';
    }
  });
}

async function fetchAprovacoes() {
  if (!isAdmin) return;
  try {
    const user = JSON.parse(localStorage.getItem('guarutoner_gestor') || localStorage.getItem('guarutoner_user'));
    const r = await fetch(`${API}/admin/pendentes?adminEmail=${encodeURIComponent(user.email)}`);
    if (!r.ok) return;
    const data = await r.json();

    const count = data.pendentes ? data.pendentes.length : 0;

    if (count > 0) {
      badgeNotificacoes.textContent = count;
      badgeNotificacoes.style.display = 'flex';
      btnNotificacoes.classList.add('has-notifications');
    } else {
      badgeNotificacoes.style.display = 'none';
      btnNotificacoes.classList.remove('has-notifications');
    }

    if (modalAprovacoes.style.display === 'flex') {
      if (count === 0) {
        listaAprovacoes.innerHTML = `
          <div class="empty-aprovacoes">
            <div class="empty-icon">✅</div>
            <div class="empty-text">Nenhuma solicitação pendente</div>
            <div class="empty-sub">Todas as solicitações foram processadas.</div>
          </div>
        `;
      } else {
        listaAprovacoes.innerHTML = data.pendentes.map(p => `
          <div class="aprovacao-item">
            <div class="aprovacao-info">
              <h3>${p.nome}</h3>
              <p class="aprovacao-email">${p.email}</p>
              <p class="aprovacao-doc"><strong>${p.tipoDocumento.toUpperCase()}:</strong> ${p.documento}</p>
              <p class="aprovacao-data">📅 ${formatDate(p.criadoEm)}</p>
            </div>
            <div class="aprovacao-actions">
              <button class="btn-aprovar" onclick="resolverConta('${p.id}', 'aprovar')">
                <span>✓</span> Aprovar
              </button>
              <button class="btn-recusar" onclick="resolverConta('${p.id}', 'recusar')">
                <span>✕</span> Rejeitar
              </button>
            </div>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Erro buscar aprovações', err);
  }
}

window.resolverConta = async function(userId, action) {
  try {
    const user = JSON.parse(localStorage.getItem('guarutoner_gestor') || localStorage.getItem('guarutoner_user'));
    const r = await fetch(`${API}/admin/resolver-conta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminEmail: user.email, userId, action })
    });

    const data = await r.json();
    if (!r.ok) throw new Error(data.erro);

    toast(data.mensagem, action === 'aprovar' ? 'ok' : 'err');
    fetchAprovacoes();
  } catch (err) {
    toast('Erro: ' + err.message, 'err');
  }
}

// ============================================================
// INICIALIZAR
// ============================================================
window.onload = () => {
  initMap();
  fetchTecnicos();
  setInterval(fetchTecnicos, REFRESH_RATE);

  if (isAdmin) {
    fetchAprovacoes();
    setInterval(fetchAprovacoes, REFRESH_RATE);
  }

  // Configurar abas do sidebar
  document.getElementById('tabMapa')?.addEventListener('click', () => trocarAba('mapa'));
  document.getElementById('tabRelatorios')?.addEventListener('click', () => trocarAba('relatorios'));
  document.getElementById('tabEquipe')?.addEventListener('click', () => trocarAba('equipe'));

  // Configurar menu mobile
  const btnMenuMobile = document.getElementById('btnMenuMobile');
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';
  document.body.appendChild(backdrop);

  function toggleSidebar() {
    if (sidebar) sidebar.classList.toggle('open');
    backdrop.classList.toggle('open');
  }

  if (btnMenuMobile) btnMenuMobile.addEventListener('click', toggleSidebar);
  backdrop.addEventListener('click', toggleSidebar);
};
