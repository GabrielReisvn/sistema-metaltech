// Funções de acesso ao banco de dados SQLite
const { ready, query, run, get } = require('../database/sqlite');

// ----------------------------------------------------------------
// QUERY BASE — traz dados da ordem + nome do cliente + nome do líder
// ----------------------------------------------------------------
const SELECT_ORDEM = `
  SELECT
    o.*,
    c.nome     AS cliente_nome,
    c.cnpj_cpf AS cliente_cnpj_cpf,
    c.telefone AS cliente_telefone,
    u.nome     AS lider_nome
  FROM ordens_producao o
  LEFT JOIN clientes  c ON c.id = o.cliente_id
  LEFT JOIN usuarios  u ON u.id = o.lider_id
`;

// ----------------------------------------------------------------
// FORMATADOR — converte linha do banco para o formato da API
// ----------------------------------------------------------------
function formatarOrdem(row, itens = []) {
  if (!row) return null;
  return {
    id:           row.id,
    numeroOrdem:  row.numero_ordem,
    cliente: {
      id:        row.cliente_id,
      nome:      row.cliente_nome,
      cnpjCpf:   row.cliente_cnpj_cpf,
      telefone:  row.cliente_telefone,
    },
    lider: {
      id:   row.lider_id,
      nome: row.lider_nome,
    },
    itens: itens.map(it => ({
      id:            it.id,
      produto:       it.produto_id,
      nomeProduto:   it.nome_produto,
      quantidade:    it.quantidade,
      precoUnitario: it.preco_unitario,
      subtotal:      it.subtotal,
      observacoes:   it.observacoes,
    })),
    status:       row.status,
    prioridade:   row.prioridade,
    prazoEntrega: row.prazo_entrega,
    total:        row.total,
    observacoes:  row.observacoes,
    iniciadoEm:   row.iniciado_em,
    finalizadoEm: row.finalizado_em,
    createdAt:    row.created_at,
    updatedAt:    row.updated_at,
  };
}

// ----------------------------------------------------------------
// TRANSIÇÕES DE STATUS PERMITIDAS
// Garante que o fluxo só ande para frente (ou cancele)
// ----------------------------------------------------------------
const TRANSICOES_VALIDAS = {
  aguardando:   ['em_producao', 'cancelado'],
  em_producao:  ['finalizado',  'cancelado'],
  finalizado:   [],
  cancelado:    [],
};

function transicaoValida(statusAtual, novoStatus) {
  return TRANSICOES_VALIDAS[statusAtual]?.includes(novoStatus) ?? false;
}

// ----------------------------------------------------------------
// MODEL
// ----------------------------------------------------------------
const OrdemProducao = {

  // Lista todas as ordens — opcionalmente filtra por líder ou status
  async findAll({ liderId, status } = {}) {
    await ready;

    let sql    = SELECT_ORDEM;
    const params = [];
    const where  = [];

    if (liderId) {
      where.push('o.lider_id = ?');
      params.push(liderId);
    }
    if (status) {
      where.push('o.status = ?');
      params.push(status);
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY o.created_at DESC';

    const rows = query(sql, params);
    return rows.map(row => {
      const itens = query('SELECT * FROM itens_ordem WHERE ordem_id = ?', [row.id]);
      return formatarOrdem(row, itens);
    });
  },

  // Busca uma ordem pelo ID com seus itens
  async findById(id) {
    await ready;
    const row = get(`${SELECT_ORDEM} WHERE o.id = ?`, [id]);
    if (!row) return null;
    const itens = query('SELECT * FROM itens_ordem WHERE ordem_id = ?', [id]);
    return formatarOrdem(row, itens);
  },

  // Cria uma nova ordem de produção, calcula total e gera número sequencial
  async create({ clienteId, liderId = null, itens, prazoEntrega, prioridade = 'normal', observacoes = '' }) {
    await ready;

    const Produto = require('./Produto');
    let total = 0;
    const itensProcessados = [];

    for (const item of itens) {
      const produto = await Produto.findById(item.produtoId);
      if (!produto) throw new Error(`Produto ID ${item.produtoId} não encontrado`);

      const precoUnitario = produto.precoUnitario || 0;
      const subtotal      = precoUnitario * item.quantidade;
      total              += subtotal;

      itensProcessados.push({
        produtoId:     produto.id,
        nomeProduto:   produto.nome,
        quantidade:    item.quantidade,
        precoUnitario,
        subtotal,
        observacoes:   item.observacoes || '',
      });
    }

    // Número sequencial à prova de concorrência: MAX + 1
    const ultima      = get('SELECT MAX(numero_ordem) AS ultimo FROM ordens_producao');
    const numeroOrdem = (ultima?.ultimo || 0) + 1;

    const infoOrdem = run(`
      INSERT INTO ordens_producao
        (numero_ordem, cliente_id, lider_id, prazo_entrega,
         prioridade, observacoes, total, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'aguardando')
    `, [numeroOrdem, clienteId, liderId, prazoEntrega,
        prioridade, observacoes, total]);

    const ordemId = infoOrdem.lastInsertRowid;

    for (const it of itensProcessados) {
      run(`
        INSERT INTO itens_ordem
          (ordem_id, produto_id, nome_produto, quantidade,
           preco_unitario, subtotal, observacoes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [ordemId, it.produtoId, it.nomeProduto, it.quantidade,
          it.precoUnitario, it.subtotal, it.observacoes]);
    }

    return this.findById(ordemId);
  },

  // Atualiza o status respeitando o fluxo: aguardando → em_producao → finalizado | cancelado
  // Registra automaticamente iniciado_em e finalizado_em
  async updateStatus(id, novoStatus) {
    await ready;

    const ordem = await this.findById(id);
    if (!ordem) throw new Error(`Ordem ID ${id} não encontrada`);

    if (!transicaoValida(ordem.status, novoStatus)) {
      throw new Error(
        `Transição inválida: "${ordem.status}" → "${novoStatus}". ` +
        `Permitidas: ${TRANSICOES_VALIDAS[ordem.status].join(', ') || 'nenhuma'}`
      );
    }

    // Registra timestamps de ciclo de vida
    let extraCampo  = '';
    let extraValor  = [];
    if (novoStatus === 'em_producao') {
      extraCampo = ", iniciado_em = datetime('now')";
    } else if (novoStatus === 'finalizado') {
      extraCampo = ", finalizado_em = datetime('now')";
    }

    run(
      `UPDATE ordens_producao
          SET status = ?, updated_at = datetime('now') ${extraCampo}
        WHERE id = ?`,
      [novoStatus, ...extraValor, id]
    );

    return this.findById(id);
  },

  // Atualiza o líder responsável pela ordem
  async atribuirLider(id, liderId) {
    await ready;
    const info = run(
      "UPDATE ordens_producao SET lider_id = ?, updated_at = datetime('now') WHERE id = ?",
      [liderId, id]
    );
    return info.changes > 0 ? this.findById(id) : null;
  },

  // Cancela e remove a ordem + seus itens (só permite se status for 'aguardando')
  async delete(id) {
    await ready;
    const ordem = await this.findById(id);
    if (!ordem) return false;
    if (ordem.status !== 'aguardando') {
      throw new Error(`Só é possível excluir ordens com status "aguardando". Status atual: "${ordem.status}"`);
    }
    run('DELETE FROM itens_ordem WHERE ordem_id = ?', [id]);
    const info = run('DELETE FROM ordens_producao WHERE id = ?', [id]);
    return info.changes > 0;
  },
};

module.exports = OrdemProducao;
