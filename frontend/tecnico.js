// ============================================================
// GUARUTONER — TÉCNICO (v2.1 — drag-and-drop + histórico)
// ============================================================

const API = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';
const GPS_INTERVAL = 5000; // 5 segundos

// Estado
const S = {
  usuario_id: null,
  nome: '',
  clientes: [],
  idx: 0,
  clienteAtual: null,
  emRota: false,
  lat: null,
  lng: null,
  watchId: null,
  gpsTimer: null
};

// ============================================================
// AUTH CHECK & INIT
// ============================================================
const userStr = localStorage.getItem('guarutoner_user');
if (!userStr) {
  window.location.href = 'index.html';
} else {
  const user = JSON.parse(userStr);
  if (user.tipo !== 'tecnico') {
    window.location.href = 'index.html';
  } else {
    // USAR O ID REAL DO USUÁRIO — nunca gerar ID aleatório
    S.usuario_id = user.id;
    S.nome = user.nome;

    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('userNameDisplay').textContent = user.nome;
      document.getElementById('btnLogout').addEventListener('click', () => {
        localStorage.removeItem('guarutoner_user');
        window.location.href = 'index.html';
      });

      // Iniciar sessão no servidor
      iniciarSessao();
    });
  }
}

// DOM
const $ = (s) => document.getElementById(s);

const dom = {
  toasts: $('toasts'),
  appHeader: $('appHeader'),
  gpsInd: $('gpsInd'),
  netInd: $('netInd'),
  viewRoute: $('viewRoute'),
  addClientCard: $('addClientCard'),
  inpCliente: $('inpCliente'),
  btnAdd: $('btnAdd'),
  clientList: $('clientList'),
  emptyMsg: $('emptyMsg'),
  btnStart: $('btnStart'),
  activePanel: $('activePanel'),
  curName: $('curName'),
  curCounter: $('curCounter'),
  btnNext: $('btnNext'),
  btnFinish: $('btnFinish'),
  listTitle: $('listTitle'),
  latVal: $('latVal'),
  lngVal: $('lngVal')
};

// ============================================================
// TOAST
// ============================================================
function toast(msg, type = 'info') {
  const d = document.createElement('div');
  d.className = `toast-item ${type}`;
  d.textContent = msg;
  dom.toasts.appendChild(d);
  setTimeout(() => d.remove(), 3500);
}

// ============================================================
// SESSÃO — Registrar/reconectar no servidor
// ============================================================
async function iniciarSessao() {
  try {
    const r = await fetch(`${API}/tecnico/iniciar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario_id: S.usuario_id,
        nome: S.nome
      })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.erro || 'Erro de conexão');

    if (data.reconectado && data.sessao) {
      // Restaurar estado completo da sessão salva no servidor
      const sessao = data.sessao;
      S.clientes = sessao.clientes || [];
      S.idx = sessao.indiceAtual || 0;
      S.emRota = sessao.emRota || false;
      S.clienteAtual = sessao.clienteAtual || null;

      // Atualizar a interface com o estado restaurado
      renderClients();

      if (S.emRota && S.clientes.length > 0) {
        dom.btnStart.style.display = 'none';
        dom.activePanel.style.display = '';
        dom.listTitle.textContent = "Edição e Fila";
        updateRouteUI();
      }

      toast(`Sessão restaurada, ${S.nome}!`, 'info');
      console.log(`[SESSÃO] Restaurada: ${S.clientes.length} clientes, idx=${S.idx}, emRota=${S.emRota}`);
    } else {
      toast(`Bem-vindo, ${S.nome}!`, 'ok');
    }

    console.log(`[SESSÃO] usuario_id: ${S.usuario_id} | reconectado: ${data.reconectado}`);

    // Iniciar GPS
    iniciarGPS();

  } catch (e) {
    console.error('[SESSÃO] Erro:', e);
    toast('Erro ao conectar com o servidor.', 'err');
    // Tenta GPS mesmo com erro de API
    iniciarGPS();
  }
}

// ============================================================
// GPS — Monitoramento contínuo
// ============================================================
function iniciarGPS() {
  if (!navigator.geolocation) {
    dom.gpsInd.classList.add('err');
    toast('GPS não suportado neste navegador.', 'err');
    return;
  }

  S.watchId = navigator.geolocation.watchPosition(
    (pos) => {
      S.lat = pos.coords.latitude;
      S.lng = pos.coords.longitude;
      dom.latVal.textContent = S.lat.toFixed(6);
      dom.lngVal.textContent = S.lng.toFixed(6);
      dom.gpsInd.classList.add('on');
      dom.gpsInd.classList.remove('err');
    },
    (err) => {
      dom.gpsInd.classList.remove('on');
      dom.gpsInd.classList.add('err');
      if (err.code === err.PERMISSION_DENIED) {
        toast('Permita o acesso ao GPS para utilizar o sistema.', 'err');
      }
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
  );

  // Enviar localização a cada 5 segundos
  enviarLocalizacao(); // enviar imediatamente
  S.gpsTimer = setInterval(enviarLocalizacao, GPS_INTERVAL);
}

// ============================================================
// ENVIAR LOCALIZAÇÃO (a cada 5s)
// ============================================================
async function enviarLocalizacao() {
  if (!S.usuario_id) return;
  try {
    const r = await fetch(`${API}/tecnico/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario_id: S.usuario_id,
        latitude: S.lat,
        longitude: S.lng,
        status: S.emRota ? `Atendendo: ${S.clienteAtual}` : 'online',
        clienteAtual: S.clienteAtual,
        listaClientes: S.clientes,
        indiceAtual: S.idx,
        emRota: S.emRota
      })
    });
    if (r.ok) {
      dom.netInd.classList.add('on');
      dom.netInd.classList.remove('err');
    } else {
      dom.netInd.classList.remove('on');
      dom.netInd.classList.add('err');
    }
  } catch {
    dom.netInd.classList.remove('on');
    dom.netInd.classList.add('err');
  }
}

// ============================================================
// HISTÓRICO — Registrar atendimento concluído
// ============================================================
async function registrarAtendimentoConcluido(nomeCliente) {
  try {
    await fetch(`${API}/tecnico/concluir-atendimento`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario_id: S.usuario_id,
        nome_tecnico: S.nome,
        nome_cliente: nomeCliente,
        rota_id: null
      })
    });
    console.log(`[HISTÓRICO] Atendimento concluído: ${nomeCliente}`);
  } catch (e) {
    console.error('[HISTÓRICO] Erro ao registrar:', e);
  }
}

// ============================================================
// CLIENTES (ADICIONAR / EXCLUIR)
// ============================================================
function addClient() {
  const nome = dom.inpCliente.value.trim();
  if (!nome) { toast('Informe o nome do cliente.', 'err'); return; }
  S.clientes.push(nome);
  dom.inpCliente.value = '';

  if (S.emRota && S.clientes.length === 1) {
    S.idx = 0;
    S.clienteAtual = nome;
    updateRouteUI();
  }

  renderClients();
  toast(`"${nome}" adicionado.`, 'info');
  enviarLocalizacao();
}

function removeClient(i) {
  if (S.emRota && i < S.idx) {
    toast('Este cliente já foi atendido e não pode ser removido.', 'err');
    return;
  }

  const removed = S.clientes.splice(i, 1)[0];

  // Ajustar índice se necessário
  if (S.emRota) {
    if (i < S.idx) {
      S.idx--;
    } else if (i === S.idx) {
      // Se removeu o cliente atual
      if (S.clientes.length === 0) {
        finishRoute();
        return;
      }
      if (S.idx >= S.clientes.length) {
        S.idx = S.clientes.length - 1;
      }
      S.clienteAtual = S.clientes[S.idx];
      updateRouteUI();
    }
  }

  renderClients();
  enviarLocalizacao();
}

// ============================================================
// DRAG & DROP — Reordenação por arraste (mouse + touch)
// ============================================================
let dragState = {
  active: false,
  startIndex: -1,
  currentIndex: -1,
  placeholder: null,
  draggedEl: null,
  clone: null,
  startY: 0,
  offsetY: 0,
  itemHeight: 0,
  listRect: null,
  items: []
};

function getEventY(e) {
  if (e.touches && e.touches.length > 0) return e.touches[0].clientY;
  if (e.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0].clientY;
  return e.clientY;
}

function startDrag(e, index) {
  // Durante rota ativa: arrastar cliente atual + pendentes
  // Apenas concluídos ficam travados
  if (S.emRota && index < S.idx) return;

  e.preventDefault();

  const list = dom.clientList;
  const items = Array.from(list.querySelectorAll('.client-item'));
  const item = items[index];
  if (!item) return;

  const rect = item.getBoundingClientRect();
  const listRect = list.getBoundingClientRect();

  // Clone visual para arrastar
  const clone = item.cloneNode(true);
  clone.classList.add('drag-clone');
  clone.style.width = rect.width + 'px';
  clone.style.position = 'fixed';
  clone.style.left = rect.left + 'px';
  clone.style.top = rect.top + 'px';
  clone.style.zIndex = '9999';
  clone.style.pointerEvents = 'none';
  clone.style.transition = 'none';
  clone.style.opacity = '0.92';
  clone.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
  clone.style.transform = 'scale(1.03)';
  document.body.appendChild(clone);

  // Placeholder no lugar original
  item.style.opacity = '0.2';
  item.style.background = 'var(--blue-soft, #e0e7ff)';

  dragState = {
    active: true,
    startIndex: index,
    currentIndex: index,
    draggedEl: item,
    clone: clone,
    startY: getEventY(e),
    offsetY: getEventY(e) - rect.top,
    itemHeight: rect.height + 6, // incluir gap
    listRect: listRect,
    items: items
  };

  // Listeners globais
  document.addEventListener('mousemove', onDragMove, { passive: false });
  document.addEventListener('mouseup', onDragEnd);
  document.addEventListener('touchmove', onDragMove, { passive: false });
  document.addEventListener('touchend', onDragEnd);
  document.addEventListener('touchcancel', onDragEnd);
}

function onDragMove(e) {
  if (!dragState.active) return;
  e.preventDefault();

  const y = getEventY(e);
  const newTop = y - dragState.offsetY;
  dragState.clone.style.top = newTop + 'px';

  // Calcular novo índice baseado na posição Y
  const relY = y - dragState.listRect.top + dom.clientList.scrollTop;
  let newIdx = Math.floor(relY / dragState.itemHeight);

  // Limitar: não mover para antes do cliente atual + concluídos
  const minIdx = S.emRota ? S.idx : 0;
  newIdx = Math.max(minIdx, Math.min(S.clientes.length - 1, newIdx));

  if (newIdx !== dragState.currentIndex) {
    // Resetar estilos
    dragState.items.forEach((it, i) => {
      if (i !== dragState.startIndex) {
        it.style.transform = '';
        it.style.transition = 'transform 0.2s ease';
      }
    });

    // Mover outros itens visualmente
    dragState.items.forEach((it, i) => {
      if (i === dragState.startIndex) return;

      if (dragState.startIndex < newIdx) {
        // Arrastando para baixo
        if (i > dragState.startIndex && i <= newIdx) {
          it.style.transform = `translateY(-${dragState.itemHeight}px)`;
        }
      } else {
        // Arrastando para cima
        if (i >= newIdx && i < dragState.startIndex) {
          it.style.transform = `translateY(${dragState.itemHeight}px)`;
        }
      }
    });

    dragState.currentIndex = newIdx;
  }
}

function onDragEnd(e) {
  if (!dragState.active) return;

  // Limpar listeners
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
  document.removeEventListener('touchmove', onDragMove);
  document.removeEventListener('touchend', onDragEnd);
  document.removeEventListener('touchcancel', onDragEnd);

  // Remover clone
  if (dragState.clone) {
    dragState.clone.remove();
  }

  // Restaurar elemento original
  if (dragState.draggedEl) {
    dragState.draggedEl.style.opacity = '';
    dragState.draggedEl.style.background = '';
  }

  // Resetar transforms visuais
  dragState.items.forEach(it => {
    it.style.transform = '';
    it.style.transition = '';
  });

  const from = dragState.startIndex;
  const to = dragState.currentIndex;

  if (from !== to && from >= 0 && to >= 0) {
    // Reordenar array de clientes
    const [moved] = S.clientes.splice(from, 1);
    S.clientes.splice(to, 0, moved);

    // S.idx fica na MESMA POSIÇÃO — quem estiver lá vira o cliente atual
    // Arrastar NUNCA registra conclusão de atendimento
    if (S.emRota) {
      S.clienteAtual = S.clientes[S.idx];
      updateRouteUI();
    }

    renderClients();
    enviarLocalizacao();
  }

  dragState.active = false;
}

// ============================================================
// RENDERIZAR CLIENTES (com drag handle)
// ============================================================
function renderClients() {
  dom.emptyMsg.style.display = S.clientes.length ? 'none' : '';
  dom.btnStart.style.display = (!S.emRota && S.clientes.length) ? '' : 'none';

  dom.clientList.innerHTML = S.clientes.map((c, i) => {
    let cls = '';
    let mark = i + 1;
    let isDone = false;

    if (S.emRota) {
      if (i < S.idx) { cls = 'done'; mark = '✓'; isDone = true; }
      else if (i === S.idx) { cls = 'active'; mark = '►'; }
    }

    // Arrastar cliente atual + pendentes (concluídos ficam travados)
    const canDrag = !isDone;
    const dragHandle = canDrag ? `
      <div class="drag-handle" 
           onmousedown="startDrag(event, ${i})" 
           ontouchstart="startDrag(event, ${i})"
           title="Arrastar para reordenar">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="3" r="1.5"/>
          <circle cx="11" cy="3" r="1.5"/>
          <circle cx="5" cy="8" r="1.5"/>
          <circle cx="11" cy="8" r="1.5"/>
          <circle cx="5" cy="13" r="1.5"/>
          <circle cx="11" cy="13" r="1.5"/>
        </svg>
      </div>
    ` : '<div class="drag-handle disabled"></div>';

    const deleteBtn = isDone ? '' : `
      <button class="btn-act del" onclick="removeClient(${i})" title="Remover">✕</button>
    `;

    return `
      <div class="client-item ${cls} fade-in" data-index="${i}">
        ${dragHandle}
        <span class="num">${mark}</span>
        <span class="name">${c}</span>
        <div class="item-actions">
          ${deleteBtn}
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================
// ROTA — Iniciar / Avançar / Finalizar
// ============================================================
async function startRoute() {
  if (!S.clientes.length) return;
  S.emRota = true;
  S.idx = 0;
  S.clienteAtual = S.clientes[0];

  dom.btnStart.style.display = 'none';
  dom.activePanel.style.display = '';
  dom.listTitle.textContent = "Edição e Fila";

  updateRouteUI();
  renderClients();

  // Notificar servidor que a rota iniciou (para relatório)
  try {
    await fetch(`${API}/tecnico/iniciar-rota`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario_id: S.usuario_id,
        nome: S.nome,
        rota: S.clientes
      })
    });
  } catch (e) {
    console.error('[ROTA] Erro ao salvar início:', e);
  }

  enviarLocalizacao();
  toast('Rota iniciada!', 'ok');
}

async function nextClient() {
  // Registrar atendimento do cliente ATUAL como concluído
  const clienteConcluido = S.clientes[S.idx];
  if (clienteConcluido) {
    await registrarAtendimentoConcluido(clienteConcluido);
  }

  S.idx++;
  if (S.idx >= S.clientes.length) {
    finishRoute();
    return;
  }
  S.clienteAtual = S.clientes[S.idx];
  updateRouteUI();
  renderClients();
  enviarLocalizacao();
  toast(`Avançando para "${S.clienteAtual}"`, 'info');
}

async function finishRoute() {
  // Registrar último cliente como concluído (se estava em rota)
  if (S.emRota && S.idx < S.clientes.length) {
    const ultimoCliente = S.clientes[S.idx];
    if (ultimoCliente) {
      await registrarAtendimentoConcluido(ultimoCliente);
    }
  }

  const atendidos = S.idx + (S.emRota ? 1 : 0);

  S.emRota = false;
  S.clienteAtual = null;
  S.clientes = [];
  S.idx = 0;

  dom.activePanel.style.display = 'none';
  dom.listTitle.textContent = "Rota de Clientes";

  renderClients();

  // Notificar servidor que a rota finalizou (para relatório)
  try {
    await fetch(`${API}/tecnico/finalizar-rota`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario_id: S.usuario_id,
        clientesAtendidos: atendidos
      })
    });
  } catch (e) {
    console.error('[ROTA] Erro ao salvar finalização:', e);
  }

  enviarLocalizacao();
  toast('Rota finalizada com sucesso!', 'ok');
}

function updateRouteUI() {
  dom.curName.textContent = S.clienteAtual || '—';
  dom.curCounter.textContent = `Cliente ${S.idx + 1} de ${S.clientes.length}`;
  dom.btnNext.textContent = S.idx + 1 >= S.clientes.length ? 'Último cliente' : 'Próximo Cliente';
}

// ============================================================
// EVENTS
// ============================================================
dom.btnAdd.addEventListener('click', addClient);
dom.inpCliente.addEventListener('keydown', (e) => { if (e.key === 'Enter') addClient(); });
dom.btnStart.addEventListener('click', startRoute);
dom.btnNext.addEventListener('click', nextClient);
dom.btnFinish.addEventListener('click', finishRoute);

// Expor funções globais para o HTML
window.startDrag = startDrag;
window.removeClient = removeClient;

// ============================================================
// PWA — REGISTRAR SERVICE WORKER
// ============================================================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => { });
}
