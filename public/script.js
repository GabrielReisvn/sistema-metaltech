// DOM e javascript

const API = '/api';

//variaveis globais para amarzenar dados de pizzas e clientes, evitando múltiplas requisições 
let cPizzas   = [];
let cClientes = [];

let TOKEN          = localStorage.getItem('pz_token') || '';
let USUARIO_LOGADO = JSON.parse(localStorage.getItem('pz_usuario') || 'null');
let mesaEmFechamento = null;

// função para realizar login, requisitando email e senha e validando pela api
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

    // armazenando dados do usuário
    TOKEN = data.token;
    USUARIO_LOGADO = data.usuario;
    localStorage.setItem('pz_token', TOKEN);
    localStorage.setItem('pz_usuario', JSON.stringify(data.usuario));

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
  localStorage.removeItem('pz_token');
  localStorage.removeItem('pz_usuario');
  document.body.classList.remove('logado');
  document.getElementById('l-senha').value = '';
}

if (TOKEN && USUARIO_LOGADO) {
  aplicarPerfil(USUARIO_LOGADO);
  document.body.classList.add('logado');
}

// função para exibir mensagens temporarias (toasts) com diferentes tipos (ok, err, info)
function toast(msg, tipo = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `show ${tipo}`;
  setTimeout(() => el.className = '', 3000);
}
// funções para abrir e fechar modais, adicionando ou removendo a classe 'open' do elemento
function abrir(id)  { document.getElementById(id).classList.add('open'); }
function fechar(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-bg').forEach(bg =>
  bg.addEventListener('click', e => { if (e.target === bg) bg.classList.remove('open'); })
);

// função para formatar valores para moeda brasileira, convertendo ponto para vírgula e adicionando o prefixo 'R$'
function R$(v) {
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
}

// função para criar badges com diferentes estilos com base no status
function badge(s) {
  const r = {
    recebido:     '📥 Recebido',
    em_preparo:   '👨‍🍳 Em Preparo',
    saiu_entrega: '🛵 Saiu p/ Entrega',
    entregue:     '✅ Entregue',
    cancelado:    '❌ Cancelado',
  };
  return `<span class="badge b-${s}">${r[s] || s}</span>`;
}

// função para requisitar api
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

//função pra aplicar o perfil logado, mostrando ou escondendo elementos da interface conforme o perfil do usuário (Administrador, Garcom )
function aplicarPerfil(usuario) {
  document.getElementById('sb-nome').textContent   = usuario.nome;
  document.getElementById('sb-perfil').textContent = usuario.perfil;

  const perfil  = usuario.perfil;
  const isAdmin = perfil === 'Administrador';
  const isGar   = perfil === 'Garcom';

  // fuunção auxiliar para mostrar ou esconder elemento pelo id
  function show(id, visible, type = 'flex') {
    const el = document.getElementById(id);
    if (el) el.style.display = visible ? type : 'none';
  }
  // função auxiliar para mostrar ou esconder elemento passado diretamente
  function showEl(el, visible, type = 'flex') {
    if (el) el.style.display = visible ? type : 'none';
  }

  show('menu-usuarios',   isAdmin, 'block');
  show('btn-usuarios',    isAdmin, 'flex');
  show('sb-group-garcom', isGar,   'block');
  show('btn-nav-mesas',   isGar,   'flex');

  showEl(document.querySelector('[onclick*="clientes"]'),  !isGar);
  showEl(document.querySelector('[onclick*="pedidos"]'),   !isGar);
  showEl(document.querySelector('[onclick*="dashboard"]'), !isGar);
  showEl(document.querySelector('.sb-group'), !isGar, 'block');

  const labelPizzas = document.getElementById('nav-pizzas-label');
  if (labelPizzas) labelPizzas.textContent = isGar ? 'Cardápio' : 'Pizzas';

  const tituloPizzas = document.getElementById('pg-pizzas-titulo');
  const subPizzas    = document.getElementById('pg-pizzas-sub');
  if (tituloPizzas) tituloPizzas.textContent = isGar ? 'Cardápio' : 'Pizzas';
  if (subPizzas)    subPizzas.textContent    = isGar ? 'Pizzas disponíveis hoje' : 'Gerencie o cardápio';
  show('btn-nova-pizza', !isGar, 'inline-flex');

  show('stat-fat', !isGar, 'block');
  show('stat-cli', !isGar, 'block');

  if (isGar) {
    ir('mesas', document.getElementById('btn-nav-mesas'));
  } else {
    ir('dashboard', document.querySelector('[onclick*="dashboard"]'));
  }
}

// função para carregar as mesas, exibindo os pedidos ativos, total por mesa e opções de gerenciamento
async function carregarMesas(mesaFiltro = null) {
  const grid = document.getElementById('grid-mesas');
  grid.innerHTML = '<div class="spin-wrap"><div class="spin"></div> Carregando...</div>';

  document.getElementById('mesas-sub').textContent =
    `Olá, ${USUARIO_LOGADO?.nome}! Seus pedidos ativos.`;

  try {
    const url = `/pedidos?garcom=${USUARIO_LOGADO.id}`;
    const pedidos = await api('GET', url);

    const ativos = pedidos.filter(p => !['entregue','cancelado'].includes(p.status));

    document.getElementById('g-ped').textContent     = pedidos.length;
    document.getElementById('g-ped-sub').textContent = `${ativos.length} ativo(s)`;

    const mesasAtivas = new Set(ativos.map(p => p.mesa).filter(Boolean));
    document.getElementById('g-mesas').textContent   = mesasAtivas.size;
    document.getElementById('g-preparo').textContent = ativos.filter(p => p.status === 'em_preparo').length;
    document.getElementById('g-prontos').textContent = ativos.filter(p => p.status === 'saiu_entrega').length;

    const botoes = document.getElementById('mesa-botoes');
    botoes.innerHTML = Array.from({length: 10}, (_, i) => {
      const n      = i + 1;
      const temPed = mesasAtivas.has(n);
      const ativo  = mesaFiltro === n;
      return `
        <button class="btn btn-sm ${ativo ? 'btn-red' : temPed ? 'btn-green' : 'btn-ghost'}"
          onclick="carregarMesas(${n})"
          title="${temPed ? 'Mesa com pedido ativo' : 'Mesa livre'}">
          ${n}${temPed ? ' 🔴' : ''}
        </button>`;
    }).join('');

    const pedidosFiltrados = mesaFiltro
      ? ativos.filter(p => p.mesa === mesaFiltro)
      : ativos;

    if (!pedidosFiltrados.length) {
      grid.innerHTML = `
        <div class="empty" style="grid-column:1/-1">
          <span class="ei">🪑</span>
          Nenhum pedido ativo no momento.<br>
          <button class="btn btn-red" style="margin-top:12px" onclick="abrirPedidoMesa()">
            + Abrir primeiro pedido
          </button>
        </div>`;
      return;
    }

    const porMesa = {};
    pedidosFiltrados.forEach(p => {
      const key = p.mesa || 'balcão';
      if (!porMesa[key]) porMesa[key] = [];
      porMesa[key].push(p);
    });

    grid.innerHTML = Object.entries(porMesa).map(([mesa, peds]) => {
      const totalMesa  = peds.reduce((s, p) => s + (p.total || 0), 0);
      const todosItens = peds.flatMap(p => p.itens);
      const itensAgrup = {};
      todosItens.forEach(it => {
        const k = `${it.nomePizza} (${it.tamanho})`;
        itensAgrup[k] = (itensAgrup[k] || 0) + it.quantidade;
      });
      const statusAtual = peds[peds.length - 1]?.status;

      // HTML estatico mostrando dados e opções de gerenciamento da mesa
      return `
        <div class="mesa-card">
          <div class="mesa-card-head">
            <div>
              <div class="mesa-num">Mesa ${mesa}</div>
              <div style="font-size:.72rem;color:var(--muted);margin-top:2px">
                ${peds.length} pedido(s) · ${peds[0]?.cliente?.nome || 'Sem cadastro'}
              </div>
            </div>
            ${badge(statusAtual)}
          </div>
          <div class="mesa-card-body">
            ${Object.entries(itensAgrup).map(([nome, qtd]) => `
              <div class="mesa-item">
                <strong>${qtd}x ${nome}</strong>
              </div>`).join('')}
            <div class="mesa-total">
              <span style="color:var(--muted)">Total da mesa</span>
              <span style="color:var(--gold)">${R$(totalMesa)}</span>
            </div>
          </div>
          <div class="mesa-card-foot">
            <button class="btn btn-ghost btn-sm" style="flex:1"
              onclick="abrirPedidoMesa(${mesa})">
              + Item
            </button>
            <button class="btn btn-blue btn-sm"
              onclick="abrirStatus('${peds[peds.length-1]?._id}','${statusAtual}')">
              📝 Status
            </button>
            <button class="btn btn-green btn-sm"
              onclick="abrirFecharMesa(${mesa}, ${totalMesa}, '${peds.map(p=>p._id).join(',')}')">
              ✅ Fechar
            </button>
          </div>
        </div>`;
    }).join('');

  } catch (e) {
    grid.innerHTML = `<div class="empty" style="color:var(--red)">${e.message}</div>`;
  }
}

// função para abrir pedidos da mesa, permitindo adicionar e gerenciar itens
async function abrirPedidoMesa(mesaNum = null) {
  try {
    if (!cPizzas.length)   cPizzas   = await api('GET', '/pizzas');
    if (!cClientes.length) cClientes = await api('GET', '/clientes');
  } catch (e) { toast('Erro ao carregar dados', 'err'); return; }

  document.getElementById('pm-cli').innerHTML =
    '<option value="">— Sem cadastro —</option>' +
    cClientes.map(c => `<option value="${c._id}">${c.nome} · ${c.telefone}</option>`).join('');

  document.getElementById('pm-mesa').value = mesaNum || '';
  document.getElementById('itens-mesa-lista').innerHTML = '';
  document.getElementById('pm-obs').value  = '';
  document.getElementById('pm-sub').textContent = 'R$ 0,00';
  document.getElementById('pm-tot').textContent = 'R$ 0,00';

  addItemMesa();
  abrir('m-pedido-mesa');
}

// função para adicionar um item ao pedido, criando linha com opções de seleção de pizza, tamanho, quantidade e preço
function addItemMesa() {
  const d = document.createElement('div');
  d.className = 'item-row';
  const opts = cPizzas.filter(p => p.disponivel)
    .map(p => `<option value="${p._id}"
      data-p="${p.precos?.P||0}" data-m="${p.precos?.M||0}" data-g="${p.precos?.G||0}">
      ${p.nome}</option>`).join('');
  d.innerHTML = `
    <select class="ip" onchange="recalcMesa()"><option value="">Selecione...</option>${opts}</select>
    <select class="it" onchange="recalcMesa()">
      <option value="P">P</option><option value="M">M</option><option value="G" selected>G</option>
    </select>
    <input class="iq" type="number" value="1" min="1" oninput="recalcMesa()">
    <div class="is" style="font-size:.8rem;text-align:right;color:var(--muted)">R$ 0,00</div>
    <button class="btn-rm" onclick="this.parentElement.remove();recalcMesa()">×</button>`;
  document.getElementById('itens-mesa-lista').appendChild(d);
}

// função para recalcular o preço total da mesa
function recalcMesa() {
  let sub = 0;
  document.querySelectorAll('#itens-mesa-lista .item-row').forEach(row => {
    const sel = row.querySelector('.ip');
    const tam = row.querySelector('.it').value.toLowerCase();
    const qtd = parseInt(row.querySelector('.iq').value) || 0;
    const pc  = parseFloat(sel.options[sel.selectedIndex]?.dataset?.[tam] || 0);
    const s   = pc * qtd; sub += s;
    row.querySelector('.is').textContent = R$(s);
  });
  document.getElementById('pm-sub').textContent = R$(sub);
  document.getElementById('pm-tot').textContent = R$(sub);
}

// Função salvando pedido da mesa, validando dados e enviando para api
async function salvarPedidoMesa() {
  const mesa = parseInt(document.getElementById('pm-mesa').value) || 0;
  if (!mesa || mesa < 1) { toast('Selecione a mesa', 'err'); return; }

  const cliId = document.getElementById('pm-cli').value || null;
  const itens = []; let valido = true;
  document.querySelectorAll('#itens-mesa-lista .item-row').forEach(row => {
    const pid = row.querySelector('.ip').value;
    if (!pid) { valido = false; return; }
    itens.push({
      pizza:      pid,
      tamanho:    row.querySelector('.it').value,
      quantidade: parseInt(row.querySelector('.iq').value) || 1,
    });
  });

  if (!valido || !itens.length) { toast('Adicione ao menos um item', 'err'); return; }

  let clienteId = cliId;
  if (!clienteId) {
    try {
      const todos = await api('GET', `/clientes?busca=Mesa ${mesa}`);
      const existe = todos.find(c => c.nome === `Mesa ${mesa}`);
      if (existe) {
        clienteId = existe._id;
      } else {
        const novo = await api('POST', '/clientes', { nome: `Mesa ${mesa}`, telefone: 'Mesa' });
        clienteId = novo._id;
        cClientes = [];
      }
    } catch (e) { toast('Erro ao registrar mesa', 'err'); return; }
  }

  try {
    await api('POST', '/pedidos', {
      cliente:        clienteId,
      itens,
      taxaEntrega:    0,
      formaPagamento: 'pix',
      observacoes:    document.getElementById('pm-obs').value,
      mesa,
      origem:         'mesa',
      garcom:         USUARIO_LOGADO?.id,
    });
    toast(`Pedido lançado na Mesa ${mesa}! 🍕`);
    fechar('m-pedido-mesa');
    carregarMesas();
  } catch (e) { toast('Erro: ' + e.message, 'err'); }
}

// função para abrir modal de fechamento da mesa, mostrando o total e opções de confirmação
function abrirFecharMesa(mesa, total, ids) {
  mesaEmFechamento = { mesa, total, ids: ids.split(',') };
  document.getElementById('fm-titulo').textContent = `Fechar Mesa ${mesa}`;
  document.getElementById('fm-total').textContent  = R$(total);
  document.getElementById('fm-resumo').innerHTML   =
    `<p style="font-size:.82rem;color:var(--muted)">
      ${mesaEmFechamento.ids.length} pedido(s) serão marcados como <strong style="color:var(--green)">Entregue</strong>.
    </p>`;
  abrir('m-fechar-mesa');
}

async function confirmarFechamento() {
  if (!mesaEmFechamento) return;

  try {
    await Promise.all(
      mesaEmFechamento.ids.map(id =>
        api('PATCH', `/pedidos/${id}/status`, { status: 'entregue' })
      )
    );
    toast(`Mesa ${mesaEmFechamento.mesa} fechada! ✅`);
    fechar('m-fechar-mesa');
    mesaEmFechamento = null;
    carregarMesas();
  } catch (e) { toast('Erro: ' + e.message, 'err'); }
}

// função para navegar entre as seções da interface, aplicando restrições de acesso conforme o perfil do usuário
function ir(pg, btn) {
  const perfil = document.getElementById('sb-perfil').textContent;
  if (pg === 'usuarios' && perfil !== 'Administrador') {
    toast('Acesso restrito a Administradores', 'err'); return;
  }
  if (pg === 'mesas' && perfil !== 'Garcom') {
    toast('Área exclusiva para Garçom', 'err'); return;
  }
  if (perfil === 'Garcom' && !['mesas','pizzas'].includes(pg)) {
    toast('Acesso não permitido para Garçom', 'err'); return;
  }
  document.querySelectorAll('.secao').forEach(s => s.classList.remove('ativa'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('ativo'));
  document.getElementById('pg-' + pg).classList.add('ativa');
  if (btn) btn.classList.add('ativo');
  const loaders = {
    dashboard: carregarDashboard,
    pedidos:   carregarPedidos,
    pizzas:    carregarPizzas,
    clientes:  carregarClientes,
    usuarios:  carregarUsuarios,
    mesas:     carregarMesas,
  };
  if (loaders[pg]) loaders[pg]();
}

// função para carregar os dados do dashboard, exibindo resumos e estatísticas de pizzas, clientes e pedidos
async function carregarDashboard() {
  const h = new Date().getHours();
  const s = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  document.getElementById('dash-sub').textContent = `${s}! Aqui está o resumo.`;

  try {
    const [pizzas, clientes, pedidos] = await Promise.all([
      api('GET', '/pizzas'),
      api('GET', '/clientes'),
      api('GET', '/pedidos'),
    ]);

    cPizzas   = pizzas;
    cClientes = clientes;

    document.getElementById('s-piz').textContent = pizzas.length;
    document.getElementById('s-cli').textContent = clientes.length;
    document.getElementById('s-ped').textContent = pedidos.length;
    document.getElementById('s-ent').textContent =
      pedidos.filter(p => p.status === 'saiu_entrega').length;
    document.getElementById('s-fat').textContent =
      R$(pedidos.reduce((acc, p) => acc + (p.total || 0), 0));

    const pend = pedidos.filter(p => !['entregue','cancelado'].includes(p.status)).length;
    document.getElementById('s-ped-sub').textContent = `${pend} pendente(s)`;

    const elP = document.getElementById('dash-pedidos');
    elP.innerHTML = pedidos.slice(0, 8).map(p => `
      <div class="mini-row">
        <div>
          <div class="mn">#${String(p.numeroPedido || '?').padStart(3,'0')} · ${p.cliente?.nome || '—'}</div>
          <div class="mc">${new Date(p.createdAt).toLocaleString('pt-BR')}</div>
        </div>
        <div style="text-align:right">
          ${badge(p.status)}<br>
          <small style="color:var(--muted)">${R$(p.total)}</small>
        </div>
      </div>`).join('') ||
      '<div class="empty"><span class="ei">📋</span>Nenhum pedido ainda</div>';

    const elC = document.getElementById('dash-cardapio');
    elC.innerHTML = pizzas.filter(p => p.disponivel).slice(0, 8).map(p => `
      <div class="mini-row">
        <span>🍕 ${p.nome}</span>
        <small style="color:var(--muted)">${R$(p.precos?.G)}</small>
      </div>`).join('') ||
      '<div class="empty"><span class="ei">🍕</span>Nenhuma pizza</div>';

  } catch (e) { toast('Erro dashboard: ' + e.message, 'err'); }
}

// função para carregar as pizzas, exibindo em tabela com opções de edição e exclusão para cada pizza
async function carregarPizzas() {
  const el = document.getElementById('tbl-pizzas');
  el.innerHTML = '<div class="spin-wrap"><div class="spin"></div> Carregando...</div>';
  try {
    cPizzas = await api('GET', '/pizzas');
    if (!cPizzas.length) {
      el.innerHTML = '<div class="empty"><span class="ei">🍕</span>Nenhuma pizza</div>';
      return;
    }
    el.innerHTML = `
      <table>
        <thead>
          <tr><th>Nome</th><th>Categoria</th><th>Ingredientes</th><th>P</th><th>M</th><th>G</th><th>Status</th><th>Ações</th>
        </thead>
        <tbody>
          ${cPizzas.map(p => `
            <tr>
              <td><strong>${p.nome}</strong><br><small style="color:var(--muted)">${p.descricao || ''}</small></td>
              <td><span class="badge b-cat">${p.categoria || 'tradicional'}</span></td>
              <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.ingredientes}</td>
              <td>${R$(p.precos?.P)}</td>
              <td>${R$(p.precos?.M)}</td>
              <td><strong style="color:var(--gold)">${R$(p.precos?.G)}</strong></td>
              <td><span class="badge ${p.disponivel ? 'b-on' : 'b-off'}">${p.disponivel ? '✅ Disponível' : '❌ Off'}</span></td>
              <td><div style="display:flex;gap:5px"><button class="btn btn-ghost btn-sm" onclick="editarPizza('${p._id}')">✏️</button><button class="btn btn-danger btn-sm" onclick="deletarPizza('${p._id}','${p.nome}')">🗑️</button></div></td>
             </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (e) {
    el.innerHTML = `<div class="empty" style="color:var(--red)">${e.message}</div>`;
  }
}

// função para abrir modal de criação ou edição de pizza, preenchendo os campos com os dados da pizza selecionada ou deixando em branco para nova pizza
function abrirPizza() {
  document.getElementById('m-pizza-t').textContent = 'Nova Pizza';
  ['p-id','p-nome','p-ing','p-desc','p-pp','p-pm','p-pg']
    .forEach(id => document.getElementById(id).value = '');
  document.getElementById('p-cat').value  = 'tradicional';
  document.getElementById('p-disp').value = 'true';
  abrir('m-pizza');
}

// função para editar pizza, preenchendo os campos do modal com os dados da pizza selecionada para edição
function editarPizza(id) {
  const p = cPizzas.find(x => x._id === id);
  if (!p) return;
  document.getElementById('m-pizza-t').textContent = 'Editar Pizza';
  document.getElementById('p-id').value   = p._id;
  document.getElementById('p-nome').value = p.nome;
  document.getElementById('p-ing').value  = p.ingredientes;
  document.getElementById('p-desc').value = p.descricao || '';
  document.getElementById('p-pp').value   = p.precos?.P || '';
  document.getElementById('p-pm').value   = p.precos?.M || '';
  document.getElementById('p-pg').value   = p.precos?.G || '';
  document.getElementById('p-cat').value  = p.categoria || 'tradicional';
  document.getElementById('p-disp').value = String(p.disponivel);
  abrir('m-pizza');
}

// função para salvar pizza, validando os campos obrigatórios e enviando os dados para a api para criação ou atualização da pizza
async function salvarPizza() {
  const id   = document.getElementById('p-id').value;
  const nome = document.getElementById('p-nome').value.trim();
  const ing  = document.getElementById('p-ing').value.trim();
  if (!nome || !ing) { toast('Nome e ingredientes são obrigatórios', 'err'); return; }

  const d = {
    nome,
    ingredientes: ing,
    descricao:    document.getElementById('p-desc').value.trim(),
    precos: {
      P: parseFloat(document.getElementById('p-pp').value) || 0,
      M: parseFloat(document.getElementById('p-pm').value) || 0,
      G: parseFloat(document.getElementById('p-pg').value) || 0,
    },
    categoria:  document.getElementById('p-cat').value,
    disponivel: document.getElementById('p-disp').value === 'true',
  };

  try {
    id ? await api('PUT', '/pizzas/' + id, d) : await api('POST', '/pizzas', d);
    toast(id ? 'Pizza atualizada!' : 'Pizza criada!');
    fechar('m-pizza');
    carregarPizzas();
  } catch (e) { toast('Erro: ' + e.message, 'err'); }
}

// função para deletar pizza, solicitando confirmação do usuário e enviando requisição para api para exclusão da pizza selecionada
async function deletarPizza(id, nome) {
  if (!confirm(`Deletar "${nome}"?`)) return;
  try {
    await api('DELETE', '/pizzas/' + id);
    toast('Pizza deletada!');
    carregarPizzas();
  } catch (e) { toast('Erro: ' + e.message, 'err'); }
}

// função para carregar os clientes, exibindo em tabela com opções de edição e exclusão para cada cliente, e permitindo busca por nome ou telefone
async function carregarClientes(busca = '') {
  const el = document.getElementById('tbl-clientes');
  el.innerHTML = '<div class="spin-wrap"><div class="spin"></div> Carregando...</div>';
  try {
    const url = busca ? `/clientes?busca=${encodeURIComponent(busca)}` : '/clientes';
    cClientes = await api('GET', url);

    if (!cClientes.length) {
      el.innerHTML = '<div class="empty"><span class="ei">👥</span>Nenhum cliente</div>';
      return;
    }

    el.innerHTML = `
      <table>
        <thead><tr><th>Nome</th><th>Telefone</th><th>Endereço</th><th>Obs</th><th>Ações</th></tr></thead>
        <tbody>
          ${cClientes.map(c => `
            <tr>
              <td><strong>${c.nome}</strong></td>
              <td>${c.telefone}</td>
              <td style="font-size:.76rem;color:var(--muted)">${[c.endereco?.rua, c.endereco?.numero, c.endereco?.bairro, c.endereco?.cidade].filter(Boolean).join(', ') || '—'}</td>
              <td style="font-size:.76rem;color:var(--muted)">${c.observacoes || '—'}</td>
              <td><div style="display:flex;gap:5px"><button class="btn btn-ghost btn-sm" onclick="editarCliente('${c._id}')">✏️</button><button class="btn btn-danger btn-sm" onclick="deletarCliente('${c._id}','${c.nome}')">🗑️</button></div></td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (e) {
    el.innerHTML = `<div class="empty" style="color:var(--red)">${e.message}</div>`;
  }
}

let _t; // variavel para armazenar o timeout da busca, evitando chamadas excessivas à API enquanto o usuário digita
// função para buscar clientes, limpando o timeout anterior e definindo um novo para chamar a função de carregar clientes com o valor da busca após um pequeno atraso
function buscarCli(v) {
  clearTimeout(_t);
  _t = setTimeout(() => carregarClientes(v), 400);
}

// função para abrir modal de criação ou edição de cliente, preenchendo os campos com os dados do cliente selecionado ou deixando em branco para novo cliente
function abrirCliente() {
  document.getElementById('m-cli-t').textContent = 'Novo Cliente';
  ['c-id','c-nome','c-tel','c-rua','c-num','c-bairro','c-cidade','c-cep','c-comp','c-obs']
    .forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  abrir('m-cliente');
}

// função para editar cliente, preenchendo os campos do modal com os dados do cliente selecionado para edição
function editarCliente(id) {
  const c = cClientes.find(x => x._id === id);
  if (!c) return;
  document.getElementById('m-cli-t').textContent    = 'Editar Cliente';
  document.getElementById('c-id').value     = c._id;
  document.getElementById('c-nome').value   = c.nome;
  document.getElementById('c-tel').value    = c.telefone;
  document.getElementById('c-rua').value    = c.endereco?.rua || '';
  document.getElementById('c-num').value    = c.endereco?.numero || '';
  document.getElementById('c-bairro').value = c.endereco?.bairro || '';
  document.getElementById('c-cidade').value = c.endereco?.cidade || '';
  document.getElementById('c-cep').value    = c.endereco?.cep || '';
  document.getElementById('c-comp').value   = c.endereco?.complemento || '';
  document.getElementById('c-obs').value    = c.observacoes || '';
  abrir('m-cliente');
}

// função para salvar cliente, validando os campos obrigatórios e enviando os dados para a api para criação ou atualização do cliente
async function salvarCliente() {
  const id   = document.getElementById('c-id').value;
  const nome = document.getElementById('c-nome').value.trim();
  const tel  = document.getElementById('c-tel').value.trim();
  if (!nome || !tel) { toast('Nome e telefone são obrigatórios', 'err'); return; }

  const d = {
    nome,
    telefone: tel,
    endereco: {
      rua:         document.getElementById('c-rua').value.trim(),
      numero:      document.getElementById('c-num').value.trim(),
      bairro:      document.getElementById('c-bairro').value.trim(),
      cidade:      document.getElementById('c-cidade').value.trim(),
      cep:         document.getElementById('c-cep').value.trim(),
      complemento: document.getElementById('c-comp').value.trim(),
    },
    observacoes: document.getElementById('c-obs').value.trim(),
  };

  try {
    id ? await api('PUT', '/clientes/' + id, d) : await api('POST', '/clientes', d);
    toast(id ? 'Cliente atualizado!' : 'Cliente cadastrado!');
    fechar('m-cliente');
    carregarClientes();
  } catch (e) { toast('Erro: ' + e.message, 'err'); }
}

async function deletarCliente(id, nome) {
  if (!confirm(`Deletar "${nome}"?`)) return;
  try {
    await api('DELETE', '/clientes/' + id);
    toast('Cliente deletado!');
    carregarClientes();
  } catch (e) { toast('Erro: ' + e.message, 'err'); }
}

// função para carregar os pedidos, exibindo em tabela com detalhes do cliente, itens, valores, status e opções de gerenciamento para cada pedido
async function carregarPedidos() {
  const el = document.getElementById('tbl-pedidos');
  el.innerHTML = '<div class="spin-wrap"><div class="spin"></div> Carregando...</div>';
  try {
    const pedidos = await api('GET', '/pedidos');
    if (!pedidos.length) {
      el.innerHTML = '<div class="empty"><span class="ei">📋</span>Nenhum pedido</div>';
      return;
    }
    el.innerHTML = `
      <table>
        <thead>
          <tr><th>#</th><th>Cliente</th><th>Itens</th><th>Subtotal</th><th>Entrega</th><th>Total</th><th>Pagamento</th><th>Status</th><th>Data</th><th>Ações</th>
        </thead>
        <tbody>
          ${pedidos.map(p => `
            <tr>
              <td><strong style="color:var(--red)">#${String(p.numeroPedido||'?').padStart(3,'0')}</strong></td>
              <td><strong>${p.cliente?.nome || '—'}</strong><br><small style="color:var(--muted)">${p.cliente?.telefone || ''}</small></td>
              <td style="font-size:.76rem">${p.itens.map(it => `${it.quantidade}x ${it.nomePizza || '?'} (${it.tamanho})`).join('<br>')}</td>
              <td>${R$(p.subtotal)}</td><td>${R$(p.taxaEntrega)}</td>
              <td><strong style="color:var(--gold)">${R$(p.total)}</strong></td>
              <td style="font-size:.76rem">${(p.formaPagamento || '—').replace('_', ' ')}</td>
              <td>${badge(p.status)}</td>
              <td style="font-size:.7rem;color:var(--muted)">${new Date(p.createdAt).toLocaleString('pt-BR')}</td>
              <td><div style="display:flex;gap:5px"><button class="btn btn-blue btn-sm" onclick="abrirStatus('${p._id}','${p.status}')">📝</button><button class="btn btn-danger btn-sm" onclick="deletarPedido('${p._id}')">🗑️</button></div></td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (e) {
    el.innerHTML = `<div class="empty" style="color:var(--red)">${e.message}</div>`;
  }
}

// função para abrir modal de criação de pedido, permitindo selecionar cliente, adicionar itens, calcular valores e escolher forma de pagamento
async function abrirPedido() {
  try {
    if (!cPizzas.length)   cPizzas   = await api('GET', '/pizzas');
    if (!cClientes.length) cClientes = await api('GET', '/clientes');
  } catch (e) { toast('Erro ao carregar dados', 'err'); return; }

  document.getElementById('ped-cli').innerHTML =
    '<option value="">— Selecione o cliente —</option>' +
    cClientes.map(c => `<option value="${c._id}">${c.nome} · ${c.telefone}</option>`).join('');

  document.getElementById('itens-lista').innerHTML = '';
  document.getElementById('ped-taxa').value  = '0';
  document.getElementById('ped-obs').value   = '';
  document.getElementById('ped-pag').value   = 'pix';
  document.getElementById('ped-sub').textContent = 'R$ 0,00';
  document.getElementById('ped-tot').textContent = 'R$ 0,00';
  document.getElementById('wrap-troco').style.display = 'none';

  addItem();
  abrir('m-pedido');
}

// função para adicionar um item ao pedido, criando linha com opções de seleção de pizza, tamanho, quantidade e preço, e recalculando o total do pedido
function addItem() {
  const d = document.createElement('div');
  d.className = 'item-row';
  const opts = cPizzas
    .filter(p => p.disponivel)
    .map(p => `<option value="${p._id}" data-p="${p.precos?.P || 0}" data-m="${p.precos?.M || 0}" data-g="${p.precos?.G || 0}">${p.nome}</option>`).join('');

  d.innerHTML = `
    <select class="ip" onchange="recalc()"><option value="">Selecione...</option>${opts}</select>
    <select class="it" onchange="recalc()"><option value="P">P</option><option value="M">M</option><option value="G" selected>G</option></select>
    <input class="iq" type="number" value="1" min="1" oninput="recalc()">
    <div class="is" style="font-size:.8rem;text-align:right;color:var(--muted)">R$ 0,00</div>
    <button class="btn-rm" onclick="this.parentElement.remove(); recalc()">×</button>`;

  document.getElementById('itens-lista').appendChild(d);
}

// função para recalcular o subtotal e total do pedido, iterando sobre os itens adicionados, multiplicando o preço pela quantidade e somando ao subtotal, e aplicando a taxa de entrega para calcular o total final
function recalc() {
  let sub = 0;
  document.querySelectorAll('#itens-lista .item-row').forEach(row => {
    const sel = row.querySelector('.ip');
    const tam = row.querySelector('.it').value.toLowerCase();
    const qtd = parseInt(row.querySelector('.iq').value) || 0;
    const opt = sel.options[sel.selectedIndex];
    const pc  = parseFloat(opt?.dataset?.[tam] || 0);
    const s   = pc * qtd;
    sub += s;
    row.querySelector('.is').textContent = R$(s);
  });

  const taxa = parseFloat(document.getElementById('ped-taxa').value) || 0;
  document.getElementById('ped-sub').textContent = R$(sub);
  document.getElementById('ped-tot').textContent = R$(sub + taxa);
}

// função para mostrar ou ocultar o campo de troco dependendo do campo selecionado como dinheiro
function toggleTroco() {
  const pag = document.getElementById('ped-pag').value;
  document.getElementById('wrap-troco').style.display =
    pag === 'dinheiro' ? 'block' : 'none';
}

// função para salvar pedido, validando os campos obrigatórios, construindo o objeto de pedido com os dados do cliente, itens, valores e observações, e enviando para a api para criação do pedido
async function salvarPedido() {
  const cliId = document.getElementById('ped-cli').value;
  if (!cliId) { toast('Selecione um cliente', 'err'); return; }

  const itens = [];
  let valido = true;
  document.querySelectorAll('#itens-lista .item-row').forEach(row => {
    const pid = row.querySelector('.ip').value;
    if (!pid) { valido = false; return; }
    itens.push({
      pizza:      pid,
      tamanho:    row.querySelector('.it').value,
      quantidade: parseInt(row.querySelector('.iq').value) || 1,
    });
  });

  if (!valido || !itens.length) {
    toast('Adicione ao menos um item válido', 'err'); return;
  }

  try {
    await api('POST', '/pedidos', {
      cliente:        cliId,
      itens,
      taxaEntrega:    parseFloat(document.getElementById('ped-taxa').value) || 0,
      formaPagamento: document.getElementById('ped-pag').value,
      troco:          parseFloat(document.getElementById('ped-troco')?.value) || 0,
      observacoes:    document.getElementById('ped-obs').value,
    });
    toast('Pedido criado! 🍕');
    fechar('m-pedido');
    carregarPedidos();
  } catch (e) { toast('Erro: ' + e.message, 'err'); }
}

// fução para abrir modal de alteração de status do pedido, preenchendo os campos ocultos com o id e status atual do pedido selecionado para edição
function abrirStatus(id, status) {
  document.getElementById('st-id').value  = id;
  document.getElementById('st-val').value = status;
  abrir('m-status');
}

//função para salvar status do pedido. valida campos e envia requisição para atualização
async function salvarStatus() {
  const id     = document.getElementById('st-id').value;
  const status = document.getElementById('st-val').value;
  try {
    await api('PATCH', '/pedidos/' + id + '/status', { status });
    toast('Status atualizado!');
    fechar('m-status');
    carregarPedidos();
  } catch (e) { toast('Erro: ' + e.message, 'err'); }
}

// função para deletar pedido, solicita confirmação do usuario e envia requisição DELETE para api
async function deletarPedido(id) {
  if (!confirm('Deletar este pedido?')) return;
  try {
    await api('DELETE', '/pedidos/' + id);
    toast('Pedido deletado!');
    carregarPedidos();
  } catch (e) { toast('Erro: ' + e.message, 'err'); }
}

// função para carregar os usuários, exibindo em tabela com opções de exclusão para cada usuário, e restringindo acesso a esta seção apenas para administradores
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
        <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Criado em</th><th>Ações</th></tr></thead>
        <tbody>
          ${us.map(u => `
            <tr>
              <td><strong>${u.nome}</strong></td>
              <td>${u.email}</td>
              <td><span class="badge ${u.perfil === 'Administrador' ? 'b-admin' : 'b-atend'}">${u.perfil}</span></td>
              <td><span class="badge ${u.ativo ? 'b-on' : 'b-off'}">${u.ativo ? 'Ativo' : 'Inativo'}</span></td>
              <td style="font-size:.73rem;color:var(--muted)">${new Date(u.createdAt).toLocaleDateString('pt-BR')}</td>
              <td><button class="btn btn-danger btn-sm" onclick="deletarUsuario('${u._id}','${u.nome}')">🗑️</button></td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (e) {
    el.innerHTML = `<div class="empty" style="color:var(--red)">${e.message}</div>`;
  }
}

// função para abrir modal de criação de usuário, limpando os campos do formulário e definindo o perfil padrão como atendente, e restringindo acesso a esta função apenas para administradores
function abrirUsuario() {
  ['u-nome','u-email','u-senha'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('u-perfil').value = 'Atendente';
  abrir('m-usuario');
}

// função para salvar usuário, validando os campos obrigatórios e enviando os dados para a api para criação do usuário, e restringindo acesso a esta função apenas para administradores
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

// função para deletar usuário, solicitando confirmação do usuário e enviando requisição para api para exclusão do usuário selecionado, e restringindo acesso a esta função apenas para administradores
async function deletarUsuario(id, nome) {
  if (!confirm(`Deletar "${nome}"?`)) return;
  try {
    await api('DELETE', '/usuarios/' + id);
    toast('Usuário deletado!');
    carregarUsuarios();
  } catch (e) { toast('Erro: ' + e.message, 'err'); }
}
