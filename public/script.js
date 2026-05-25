// ============================================================
// FACTORYTRACK — MetalTech · script.js
// ============================================================

const API = '/api';

// Cache local para evitar múltiplas requisições desnecessárias
let cProdutos = [];
let cClientes = [];
let cLideres  = [];

let TOKEN          = localStorage.getItem('mt_token')   || '';
let USUARIO_LOGADO = JSON.parse(localStorage.getItem('mt_usuario') || 'null');

// ============================================================
// AUTENTICAÇÃO
// ============================================================

async function fazerLogin() {
  const email = document.getElementById('l-email').value.trim();
  const senha = document.getElementById('l-senha').value;
  const btn   = document.getElementById('btn-login');
  const erro  = document.getElementById('login-erro');

  if (!email || !senha) {
    erro.style.display = 'block';
    erro.textContent   = 'Preencha e-mail e senha.';
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Entrando...';
  erro.style.display = 'none';

  try {
    const res  = await fetch(API + '/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, senha }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'Credenciais inválidas');

    TOKEN          = data.token;
    USUARIO_LOGADO = data.usuario;
    localStorage.setItem('mt_token',   TOKEN);
    localStorage.setItem('mt_usuario', JSON.stringify(data.usuario));

    aplicarPerfil(data.usuario);
    document.body.classList.add('logado');
  } catch (e) {
    erro.style.display = 'block';
    erro.textContent   = e.message;
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Entrar';
  }
}

// função para realizar logout, limpando os dados armazenados e atualizando a interface
function sair() {
  TOKEN = '';
  USUARIO_LOGADO = null;
  localStorage.removeItem('mt_token');
  localStorage.removeItem('mt_usuario');
  document.body.classList.remove('logado');
  document.getElementById('l-senha').value = '';
}

// Auto-login se já tiver sessão salva
if (TOKEN && USUARIO_LOGADO) {
  aplicarPerfil(USUARIO_LOGADO);
  document.body.classList.add('logado');
}

// ============================================================
// PERFIL E VISIBILIDADE DE MENU
// ============================================================

function aplicarPerfil(usuario) {
  document.getElementById('sb-nome').textContent   = usuario.nome;
  document.getElementById('sb-perfil').textContent = usuario.perfil;

  const isGerente = usuario.perfil === 'Gerente';

  show('menu-usuarios', isGerente, 'block');
  show('btn-usuarios',  isGerente, 'flex');
  show('btn-novo-produto', isGerente, 'inline-flex');

  // Gerente vai ao dashboard, Líder vai direto para ordens
  if (isGerente) {
    ir('dashboard', document.querySelector('[onclick*="dashboard"]'));
  } else {
    ir('ordens', document.querySelector('[onclick*="ordens"]'));
  }
}

// ============================================================
// UTILITÁRIOS
// ============================================================

function show(id, visible, type = 'flex') {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? type : 'none';
}

function toast(msg, tipo = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `show ${tipo}`;
  setTimeout(() => el.className = '', 3000);
}

function abrir(id)  { document.getElementById(id).classList.add('open'); }
function fechar(id) { document.getElementById(id).classList.remove('open'); }

// Fechar modal ao clicar no fundo escuro
document.querySelectorAll('.modal-bg').forEach(bg =>
  bg.addEventListener('click', e => { if (e.target === bg) bg.classList.remove('open'); })
);

// função para formatar valores para moeda brasileira, convertendo ponto para vírgula e adicionando o prefixo 'R$'
function R$(v) {
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
}

// Badges de status alinhados com os CHECK constraints do banco
function badgeStatus(s) {
  const r = {
    aguardando:  '⏳ Aguardando',
    em_producao: '🔄 Em Produção',
    finalizado:  '✅ Finalizado',
    cancelado:   '❌ Cancelado',
  };
  return `<span class="badge b-${s}">${r[s] || s}</span>`;
}

function badgePrioridade(p) {
  const r = {
    baixa:   '🟢 Baixa',
    normal:  '🔵 Normal',
    alta:    '🟡 Alta',
    urgente: '🔴 Urgente',
  };
  return `<span class="badge b-${p}">${r[p] || p}</span>`;
}

// Wrapper de fetch autenticado
async function api(method, url, body) {
  const opts = {
    method,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res  = await fetch(API + url, opts);
  const data = await res.json();

  if (res.status === 401) { sair(); throw new Error('Sessão expirada'); }
  if (!res.ok) throw new Error(data.erro || 'Erro na requisição');
  return data;
}

// ============================================================
// NAVEGAÇÃO
// ============================================================

function ir(pg, btn) {
  const perfil    = USUARIO_LOGADO?.perfil;
  const isGerente = perfil === 'Gerente';
  const isLider   = perfil === 'Lider';

  // Restrições de acesso
  if (pg === 'usuarios' && !isGerente) {
    toast('Acesso restrito a Gerentes', 'err'); return;
  }
  if (isLider && ['clientes', 'usuarios', 'estoque'].includes(pg)) {
    toast('Acesso não permitido para Líder', 'err'); return;
  }

  document.querySelectorAll('.secao').forEach(s => s.classList.remove('ativa'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('ativo'));
  const sec = document.getElementById('pg-' + pg);
  if (sec) sec.classList.add('ativa');
  if (btn) btn.classList.add('ativo');

  const loaders = {
    dashboard: carregarDashboard,
    ordens:    carregarOrdens,
    produtos:  carregarProdutos,
    clientes:  carregarClientes,
    estoque:   carregarEstoque,
    usuarios:  carregarUsuarios,
  };
  if (loaders[pg]) loaders[pg]();
}

// ============================================================
// DASHBOARD
// ============================================================

async function carregarDashboard() {
  const h = new Date().getHours();
  const s = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  document.getElementById('dash-sub').textContent =
    `${s}, ${USUARIO_LOGADO?.nome}! Visão geral da produção.`;

  try {
    const [produtos, clientes, ordens] = await Promise.all([
      api('GET', '/produtos'),
      api('GET', '/clientes'),
      api('GET', '/ordens'),
    ]);

    cProdutos = produtos;
    cClientes = clientes;

    document.getElementById('s-ordens').textContent = ordens.length;
    document.getElementById('s-cli').textContent    = clientes.length;
    document.getElementById('s-em-prod').textContent =
      ordens.filter(o => o.status === 'em_producao').length;
    document.getElementById('s-final').textContent  =
      ordens.filter(o => o.status === 'finalizado').length;
    document.getElementById('s-aguard').textContent =
      ordens.filter(o => o.status === 'aguardando').length;

    const pendentes = ordens.filter(o =>
      ['aguardando','em_producao'].includes(o.status)).length;
    document.getElementById('s-ordens-sub').textContent = `${pendentes} pendente(s)`;

    // Ordens recentes
    const elO = document.getElementById('dash-ordens');
    elO.innerHTML = ordens.slice(0, 8).map(o => `
      <div class="mini-row">
        <div>
          <div class="mn">
            #${String(o.numeroOrdem || '?').padStart(3,'0')} · ${o.cliente?.nome || '—'}
          </div>
          <div class="mc">${o.prazoEntrega || ''} · ${o.lider?.nome || 'Sem líder'}</div>
        </div>
        <div style="text-align:right">
          ${badgeStatus(o.status)}<br>
          <small style="color:var(--muted)">${R$(o.total)}</small>
        </div>
      </div>`).join('') ||
      '<div class="empty"><span class="ei">📋</span>Nenhuma ordem ainda</div>';

    // Produtos ativos
    const elP = document.getElementById('dash-produtos');
    elP.innerHTML = produtos.filter(p => p.disponivel).slice(0, 8).map(p => `
      <div class="mini-row">
        <span>🔩 ${p.nome}</span>
        <small style="color:var(--muted)">${R$(p.precoUnitario)}</small>
      </div>`).join('') ||
      '<div class="empty"><span class="ei">🔩</span>Nenhum produto</div>';

  } catch (e) { toast('Erro no dashboard: ' + e.message, 'err'); }
}

// ============================================================
// ORDENS DE PRODUÇÃO
// ============================================================

async function carregarOrdens() {
  const el = document.getElementById('tbl-ordens');
  el.innerHTML = '<div class="spin-wrap"><div class="spin"></div> Carregando...</div>';
  try {
    const status = document.getElementById('filtro-status')?.value || '';
    const url    = status ? `/ordens?status=${status}` : '/ordens';
    const ordens = await api('GET', url);

    if (!ordens.length) {
      el.innerHTML = '<div class="empty"><span class="ei">📋</span>Nenhuma ordem encontrada</div>';
      return;
    }

    el.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>#</th><th>Cliente</th><th>Prazo</th><th>Líder</th>
            <th>Prioridade</th><th>Total</th><th>Status</th><th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${ordens.map(o => `
            <tr>
              <td><strong style="color:var(--blue)">#${String(o.numeroOrdem||'?').padStart(3,'0')}</strong></td>
              <td>
                <strong>${o.cliente?.nome || '—'}</strong><br>
                <small style="color:var(--muted)">${o.cliente?.cnpjCpf || ''}</small>
              </td>
              <td style="font-size:.76rem">${o.prazoEntrega || '—'}</td>
              <td style="font-size:.76rem">${o.lider?.nome || '—'}</td>
              <td>${badgePrioridade(o.prioridade)}</td>
              <td><strong style="color:var(--gold)">${R$(o.total)}</strong></td>
              <td>${badgeStatus(o.status)}</td>
              <td>
                <div style="display:flex;gap:5px">
                  <button class="btn btn-blue btn-sm"
                    onclick="abrirStatus('${o.id}','${o.status}','${o.cliente?.nome || ''}')">
                    📝
                  </button>
                  <button class="btn btn-danger btn-sm"
                    onclick="deletarOrdem('${o.id}', '${o.numeroOrdem}')">
                    🗑️
                  </button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (e) {
    el.innerHTML = `<div class="empty" style="color:var(--red)">${e.message}</div>`;
  }
}

async function abrirOrdem() {
  try {
    if (!cProdutos.length) cProdutos = await api('GET', '/produtos?apenasDisponiveis=true');
    if (!cClientes.length) cClientes = await api('GET', '/clientes');
    cLideres = await api('GET', '/usuarios');
  } catch (e) { toast('Erro ao carregar dados', 'err'); return; }

  document.getElementById('m-ordem-t').textContent = 'Nova Ordem de Produção';
  document.getElementById('o-id').value     = '';
  document.getElementById('o-prazo').value  = '';
  document.getElementById('o-obs').value    = '';
  document.getElementById('o-prior').value  = 'normal';
  document.getElementById('o-total').textContent = 'R$ 0,00';

  document.getElementById('o-cli').innerHTML =
    '<option value="">— Selecione o cliente —</option>' +
    cClientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');

  document.getElementById('o-lider').innerHTML =
    '<option value="">— Sem líder —</option>' +
    cLideres.filter(u => u.ativo).map(u =>
      `<option value="${u.id}">${u.nome} (${u.perfil})</option>`).join('');

  document.getElementById('itens-ordem-lista').innerHTML = '';
  addItemOrdem();
  abrir('m-ordem');
}

function addItemOrdem() {
  const d    = document.createElement('div');
  d.className = 'item-row';
  const opts = cProdutos
    .filter(p => p.disponivel)
    .map(p => `<option value="${p.id}"
      data-preco="${p.precoUnitario || 0}"
      data-uni="${p.unidadeMedida || 'un'}">
      ${p.nome} (${p.codigo})</option>`).join('');

  d.innerHTML = `
    <select class="ip" onchange="recalcOrdem()">
      <option value="">Selecione a peça...</option>${opts}
    </select>
    <input class="iq" type="number" value="1" min="1" oninput="recalcOrdem()">
    <div class="iu" style="font-size:.75rem;color:var(--muted);text-align:center">un</div>
    <div class="is" style="font-size:.8rem;text-align:right;color:var(--muted)">R$ 0,00</div>
    <button class="btn-rm" onclick="this.parentElement.remove(); recalcOrdem()">×</button>`;
  document.getElementById('itens-ordem-lista').appendChild(d);
}

function recalcOrdem() {
  let total = 0;
  document.querySelectorAll('#itens-ordem-lista .item-row').forEach(row => {
    const sel   = row.querySelector('.ip');
    const opt   = sel.options[sel.selectedIndex];
    const preco = parseFloat(opt?.dataset?.preco || 0);
    const qtd   = parseInt(row.querySelector('.iq').value) || 0;
    const sub   = preco * qtd;
    total += sub;
    row.querySelector('.is').textContent = R$(sub);
    const uni = opt?.dataset?.uni || 'un';
    row.querySelector('.iu').textContent = uni;
  });
  document.getElementById('o-total').textContent = R$(total);
}

async function salvarOrdem() {
  const clienteId  = document.getElementById('o-cli').value;
  const prazo      = document.getElementById('o-prazo').value;
  if (!clienteId)  { toast('Selecione um cliente', 'err'); return; }
  if (!prazo)      { toast('Informe o prazo de entrega', 'err'); return; }

  const itens = [];
  let valido  = true;
  document.querySelectorAll('#itens-ordem-lista .item-row').forEach(row => {
    const produtoId = row.querySelector('.ip').value;
    if (!produtoId) { valido = false; return; }
    itens.push({
      produtoId,
      quantidade: parseInt(row.querySelector('.iq').value) || 1,
    });
  });

  if (!valido || !itens.length) {
    toast('Adicione ao menos uma peça válida', 'err'); return;
  }

  try {
    await api('POST', '/ordens', {
      clienteId,
      itens,
      prazoEntrega: prazo,
      prioridade:   document.getElementById('o-prior').value,
      observacoes:  document.getElementById('o-obs').value,
      liderId:      document.getElementById('o-lider').value || undefined,
    });
    toast('Ordem criada! 🏭');
    fechar('m-ordem');
    carregarOrdens();
  } catch (e) { toast('Erro: ' + e.message, 'err'); }
}

// Abre modal de status — mostra nome do cliente para contexto
function abrirStatus(id, statusAtual, nomeCliente = '') {
  document.getElementById('st-id').value  = id;
  document.getElementById('st-val').value = statusAtual;
  document.getElementById('st-info').textContent =
    nomeCliente ? `Ordem de: ${nomeCliente}` : '';
  abrir('m-status');
}

async function salvarStatus() {
  const id     = document.getElementById('st-id').value;
  const status = document.getElementById('st-val').value;
  try {
    await api('PATCH', '/ordens/' + id + '/status', { status });
    toast('Status atualizado!');
    fechar('m-status');
    carregarOrdens();
    // Atualiza dashboard se estiver visível
    if (document.getElementById('pg-dashboard')?.classList.contains('ativa')) {
      carregarDashboard();
    }
  } catch (e) { toast('Erro: ' + e.message, 'err'); }
}

async function deletarOrdem(id, numero) {
  if (!confirm(`Excluir Ordem #${numero}? Só é possível excluir ordens "aguardando".`)) return;
  try {
    await api('DELETE', '/ordens/' + id);
    toast('Ordem removida!');
    carregarOrdens();
  } catch (e) { toast('Erro: ' + e.message, 'err'); }
}

// ============================================================
// PRODUTOS / PEÇAS
// ============================================================

async function carregarProdutos() {
  const el = document.getElementById('tbl-produtos');
  el.innerHTML = '<div class="spin-wrap"><div class="spin"></div> Carregando...</div>';
  try {
    cProdutos = await api('GET', '/produtos');
    if (!cProdutos.length) {
      el.innerHTML = '<div class="empty"><span class="ei">🔩</span>Nenhum produto cadastrado</div>';
      return;
    }
    el.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Nome</th><th>Código</th><th>Categoria</th>
            <th>Unidade</th><th>Peso (kg)</th><th>Tempo (h)</th>
            <th>Preço Unit.</th><th>Status</th><th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${cProdutos.map(p => `
            <tr>
              <td>
                <strong>${p.nome}</strong><br>
                <small style="color:var(--muted)">${p.descricao || ''}</small>
              </td>
              <td style="font-size:.76rem;color:var(--muted)">${p.codigo}</td>
              <td><span class="badge b-cat">${p.categoria}</span></td>
              <td>${p.unidadeMedida}</td>
              <td>${p.pesoEstimadoKg ?? '—'}</td>
              <td>${p.tempoProducaoH ?? '—'}</td>
              <td><strong style="color:var(--gold)">${R$(p.precoUnitario)}</strong></td>
              <td>
                <span class="badge ${p.disponivel ? 'b-on' : 'b-off'}">
                  ${p.disponivel ? '✅ Disponível' : '❌ Inativo'}
                </span>
              </td>
              <td>
                <div style="display:flex;gap:5px">
                  <button class="btn btn-ghost btn-sm"
                    onclick="editarProduto(${p.id})">✏️</button>
                  <button class="btn btn-danger btn-sm"
                    onclick="deletarProduto(${p.id},'${p.nome}')">🗑️</button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (e) {
    el.innerHTML = `<div class="empty" style="color:var(--red)">${e.message}</div>`;
  }
}

function abrirProduto() {
  document.getElementById('m-produto-t').textContent = 'Nova Peça';
  ['p-id','p-nome','p-cod','p-uni','p-preco','p-peso','p-tempo','p-desc']
    .forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  document.getElementById('p-cat').value  = 'geral';
  document.getElementById('p-disp').value = 'true';
  abrir('m-produto');
}

function editarProduto(id) {
  const p = cProdutos.find(x => x.id === id);
  if (!p) return;
  document.getElementById('m-produto-t').textContent = 'Editar Peça';
  document.getElementById('p-id').value    = p.id;
  document.getElementById('p-nome').value  = p.nome;
  document.getElementById('p-cod').value   = p.codigo;
  document.getElementById('p-cat').value   = p.categoria;
  document.getElementById('p-uni').value   = p.unidadeMedida;
  document.getElementById('p-preco').value = p.precoUnitario;
  document.getElementById('p-peso').value  = p.pesoEstimadoKg;
  document.getElementById('p-tempo').value = p.tempoProducaoH;
  document.getElementById('p-desc').value  = p.descricao || '';
  document.getElementById('p-disp').value  = String(p.disponivel);
  abrir('m-produto');
}

async function salvarProduto() {
  const id   = document.getElementById('p-id').value;
  const nome = document.getElementById('p-nome').value.trim();
  const cod  = document.getElementById('p-cod').value.trim();
  if (!nome) { toast('Nome é obrigatório', 'err'); return; }
  if (!id && !cod) { toast('Código é obrigatório', 'err'); return; }

  const d = {
    nome,
    codigo:          cod || undefined,
    descricao:       document.getElementById('p-desc').value.trim(),
    categoria:       document.getElementById('p-cat').value,
    unidadeMedida:   document.getElementById('p-uni').value.trim() || 'un',
    precoUnitario:   parseFloat(document.getElementById('p-preco').value) || 0,
    pesoEstimadoKg:  parseFloat(document.getElementById('p-peso').value)  || 0,
    tempoProducaoH:  parseFloat(document.getElementById('p-tempo').value) || 0,
    disponivel:      document.getElementById('p-disp').value === 'true',
  };

  try {
    id ? await api('PUT',  '/produtos/' + id, d)
       : await api('POST', '/produtos', d);
    toast(id ? 'Produto atualizado!' : 'Produto criado!');
    fechar('m-produto');
    carregarProdutos();
  } catch (e) { toast('Erro: ' + e.message, 'err'); }
}

async function deletarProduto(id, nome) {
  if (!confirm(`Desativar "${nome}"?`)) return;
  try {
    await api('DELETE', '/produtos/' + id);
    toast('Produto desativado!');
    carregarProdutos();
  } catch (e) { toast('Erro: ' + e.message, 'err'); }
}

// ============================================================
// CLIENTES
// ============================================================

async function carregarClientes(busca = '') {
  const el = document.getElementById('tbl-clientes');
  el.innerHTML = '<div class="spin-wrap"><div class="spin"></div> Carregando...</div>';
  try {
    const url = busca
      ? `/clientes?busca=${encodeURIComponent(busca)}`
      : '/clientes';
    cClientes = await api('GET', url);

    if (!cClientes.length) {
      el.innerHTML = '<div class="empty"><span class="ei">🏭</span>Nenhum cliente</div>';
      return;
    }

    el.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Nome / Razão Social</th><th>CNPJ / CPF</th>
            <th>Telefone</th><th>E-mail</th><th>Observações</th><th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${cClientes.map(c => `
            <tr>
              <td><strong>${c.nome}</strong></td>
              <td style="font-size:.76rem">${c.cnpjCpf || '—'}</td>
              <td>${c.telefone || '—'}</td>
              <td style="font-size:.76rem">${c.email || '—'}</td>
              <td style="font-size:.76rem;color:var(--muted)">${c.observacoes || '—'}</td>
              <td>
                <div style="display:flex;gap:5px">
                  <button class="btn btn-ghost btn-sm"
                    onclick="editarCliente(${c.id})">✏️</button>
                  <button class="btn btn-danger btn-sm"
                    onclick="deletarCliente(${c.id},'${c.nome.replace(/'/g,"\\'")}')">🗑️</button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (e) {
    el.innerHTML = `<div class="empty" style="color:var(--red)">${e.message}</div>`;
  }
}

let _tBusca;
function buscarCli(v) {
  clearTimeout(_tBusca);
  _tBusca = setTimeout(() => carregarClientes(v), 400);
}

// função para abrir modal de criação ou edição de cliente, preenchendo os campos com os dados do cliente selecionado ou deixando em branco para novo cliente
function abrirCliente() {
  document.getElementById('m-cli-t').textContent = 'Novo Cliente';
  ['c-id','c-nome','c-cnpj','c-tel','c-email',
   'c-rua','c-num','c-bairro','c-cidade','c-cep','c-obs']
    .forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  abrir('m-cliente');
}

function editarCliente(id) {
  const c = cClientes.find(x => x.id === id);
  if (!c) return;
  document.getElementById('m-cli-t').textContent    = 'Editar Cliente';
  document.getElementById('c-id').value     = c.id;
  document.getElementById('c-nome').value   = c.nome;
  document.getElementById('c-cnpj').value   = c.cnpjCpf  || '';
  document.getElementById('c-tel').value    = c.telefone || '';
  document.getElementById('c-email').value  = c.email    || '';
  document.getElementById('c-rua').value    = c.endereco?.rua    || '';
  document.getElementById('c-num').value    = c.endereco?.numero || '';
  document.getElementById('c-bairro').value = c.endereco?.bairro || '';
  document.getElementById('c-cidade').value = c.endereco?.cidade || '';
  document.getElementById('c-cep').value    = c.endereco?.cep    || '';
  document.getElementById('c-obs').value    = c.observacoes      || '';
  abrir('m-cliente');
}

async function salvarCliente() {
  const id   = document.getElementById('c-id').value;
  const nome = document.getElementById('c-nome').value.trim();
  const cnpj = document.getElementById('c-cnpj').value.trim();
  if (!nome)       { toast('Nome é obrigatório', 'err');    return; }
  if (!id && !cnpj){ toast('CNPJ/CPF é obrigatório', 'err'); return; }

  const d = {
    nome,
    cnpjCpf:     cnpj || undefined,
    telefone:    document.getElementById('c-tel').value.trim(),
    email:       document.getElementById('c-email').value.trim(),
    endereco: {
      rua:    document.getElementById('c-rua').value.trim(),
      numero: document.getElementById('c-num').value.trim(),
      bairro: document.getElementById('c-bairro').value.trim(),
      cidade: document.getElementById('c-cidade').value.trim(),
      cep:    document.getElementById('c-cep').value.trim(),
    },
    observacoes: document.getElementById('c-obs').value.trim(),
  };

  try {
    id ? await api('PUT',  '/clientes/' + id, d)
       : await api('POST', '/clientes', d);
    toast(id ? 'Cliente atualizado!' : 'Cliente cadastrado!');
    fechar('m-cliente');
    carregarClientes();
  } catch (e) { toast('Erro: ' + e.message, 'err'); }
}

async function deletarCliente(id, nome) {
  if (!confirm(`Desativar "${nome}"?`)) return;
  try {
    await api('DELETE', '/clientes/' + id);
    toast('Cliente desativado!');
    carregarClientes();
  } catch (e) { toast('Erro: ' + e.message, 'err'); }
}

// ============================================================
// ESTOQUE — matérias-primas e movimentações
// ============================================================

async function carregarEstoque() {
  const el = document.getElementById('tbl-estoque');
  el.innerHTML = '<div class="spin-wrap"><div class="spin"></div> Carregando...</div>';
  try {
    const materias = await api('GET', '/materias-primas');
    if (!materias.length) {
      el.innerHTML = '<div class="empty"><span class="ei">📦</span>Nenhuma matéria-prima</div>';
      return;
    }
    el.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Nome</th><th>Código</th><th>Unidade</th>
            <th>Estoque</th><th>Mín.</th><th>Preço Unit.</th><th>Fornecedor</th><th>Alerta</th>
          </tr>
        </thead>
        <tbody>
          ${materias.map(m => {
            const baixo = m.quantidadeEstoque <= m.quantidadeMinima;
            return `
              <tr>
                <td><strong>${m.nome}</strong></td>
                <td style="font-size:.76rem;color:var(--muted)">${m.codigo}</td>
                <td>${m.unidadeMedida}</td>
                <td><strong style="color:${baixo ? 'var(--red)' : 'var(--green)'}">${m.quantidadeEstoque}</strong></td>
                <td style="color:var(--muted)">${m.quantidadeMinima}</td>
                <td>${R$(m.precoUnitario)}</td>
                <td style="font-size:.76rem">${m.fornecedor || '—'}</td>
                <td>${baixo
                  ? '<span class="badge b-cancelado">⚠️ Repor</span>'
                  : '<span class="badge b-finalizado">OK</span>'}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  } catch (e) {
    el.innerHTML = `<div class="empty" style="color:var(--red)">${e.message}</div>`;
  }
}

async function abrirMovimentacao() {
  try {
    const materias = await api('GET', '/materias-primas');
    const ordens   = await api('GET', '/ordens?status=em_producao');

    document.getElementById('mov-mp').innerHTML =
      materias.map(m =>
        `<option value="${m.id}">${m.nome} (${m.quantidadeEstoque} ${m.unidadeMedida})</option>`
      ).join('');

    document.getElementById('mov-ordem').innerHTML =
      '<option value="">— Nenhuma —</option>' +
      ordens.map(o =>
        `<option value="${o.id}">#${o.numeroOrdem} · ${o.cliente?.nome || ''}</option>`
      ).join('');

    ['mov-qtd','mov-obs'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('mov-tipo').value = 'entrada';
  } catch (e) { toast('Erro ao carregar dados', 'err'); return; }

  abrir('m-movimentacao');
}

async function salvarMovimentacao() {
  const mpId = document.getElementById('mov-mp').value;
  const qtd  = parseFloat(document.getElementById('mov-qtd').value);
  const tipo = document.getElementById('mov-tipo').value;
  if (!mpId)    { toast('Selecione a matéria-prima', 'err'); return; }
  if (!qtd > 0) { toast('Quantidade inválida', 'err'); return; }

  try {
    await api('POST', '/materias-primas/' + mpId + '/movimentacoes', {
      tipo,
      quantidade:  qtd,
      ordemId:     document.getElementById('mov-ordem').value || undefined,
      observacoes: document.getElementById('mov-obs').value.trim(),
    });
    toast(tipo === 'entrada' ? 'Entrada registrada! 📥' : 'Saída registrada! 📤');
    fechar('m-movimentacao');
    carregarEstoque();
  } catch (e) { toast('Erro: ' + e.message, 'err'); }
}

// ============================================================
// USUÁRIOS
// ============================================================

async function carregarUsuarios() {
  const el = document.getElementById('tbl-usuarios');
  el.innerHTML = '<div class="spin-wrap"><div class="spin"></div> Carregando...</div>';
  try {
    const us = await api('GET', '/usuarios');
    if (!us.length) {
      el.innerHTML = '<div class="empty"><span class="ei">🔐</span>Nenhum usuário</div>';
      return;
    }
    el.innerHTML = `
      <table>
        <thead>
          <tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Criado em</th><th>Ações</th></tr>
        </thead>
        <tbody>
          ${us.map(u => `
            <tr>
              <td><strong>${u.nome}</strong></td>
              <td>${u.email}</td>
              <td>
                <span class="badge ${u.perfil === 'Gerente' ? 'b-gerente' : 'b-lider'}">
                  ${u.perfil === 'Gerente' ? '👔 Gerente' : '🔧 Líder'}
                </span>
              </td>
              <td>
                <span class="badge ${u.ativo ? 'b-on' : 'b-off'}">
                  ${u.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </td>
              <td style="font-size:.73rem;color:var(--muted)">
                ${new Date(u.createdAt).toLocaleDateString('pt-BR')}
              </td>
              <td>
                <button class="btn btn-danger btn-sm"
                  onclick="deletarUsuario(${u.id},'${u.nome.replace(/'/g,"\\'")}')">
                  🗑️
                </button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (e) {
    el.innerHTML = `<div class="empty" style="color:var(--red)">${e.message}</div>`;
  }
}

function abrirUsuario() {
  ['u-nome','u-email','u-senha'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('u-perfil').value = 'Lider';
  abrir('m-usuario');
}

async function salvarUsuario() {
  const nome  = document.getElementById('u-nome').value.trim();
  const email = document.getElementById('u-email').value.trim();
  const senha = document.getElementById('u-senha').value;
  if (!nome || !email || !senha) { toast('Preencha todos os campos', 'err'); return; }

  try {
    await api('POST', '/usuarios', {
      nome, email, senha,
      perfil: document.getElementById('u-perfil').value,
    });
    toast('Usuário criado!');
    fechar('m-usuario');
    carregarUsuarios();
  } catch (e) { toast('Erro: ' + e.message, 'err'); }
}

async function deletarUsuario(id, nome) {
  if (!confirm(`Desativar "${nome}"?`)) return;
  try {
    await api('DELETE', '/usuarios/' + id);
    toast('Usuário desativado!');
    carregarUsuarios();
  } catch (e) { toast('Erro: ' + e.message, 'err'); }
}