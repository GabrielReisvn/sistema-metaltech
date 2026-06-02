const { ready, query, run, get } = require('../database/sqlite');

// ----------------------------------------------------------------
// FORMATADORES
// ----------------------------------------------------------------

function formatarMateriaPrima(row) {
  if (!row) return null;
  return {
    id:                 row.id,
    nome:               row.nome,
    codigo:             row.codigo,
    unidadeMedida:      row.unidade_medida,
    quantidadeEstoque:  row.quantidade_estoque,
    quantidadeMinima:   row.quantidade_minima,
    precoUnitario:      row.preco_unitario,
    fornecedor:         row.fornecedor,
    observacoes:        row.observacoes,
    // Flag calculada: true quando estoque atingiu ou passou do mínimo
    estoqueBaixo:       row.quantidade_estoque <= row.quantidade_minima,
    createdAt:          row.created_at,
    updatedAt:          row.updated_at,
  };
}

function formatarMovimentacao(row) {
  if (!row) return null;
  return {
    id:              row.id,
    materiaPrimaId:  row.materia_prima_id,
    materiaPrima:    row.mp_nome   || null,   
    ordemId:         row.ordem_id  || null,
    numeroOrdem:     row.num_ordem || null,   
    tipo:            row.tipo,               
    quantidade:      row.quantidade,
    observacoes:     row.observacoes,
    usuarioId:       row.usuario_id,
    usuarioNome:     row.usu_nome  || null,   
    createdAt:       row.created_at,
  };
}

// ----------------------------------------------------------------
// MODEL — MATÉRIAS-PRIMAS
// ----------------------------------------------------------------
const MateriaPrima = {

  // Lista todas as matérias-primas — opcionalmente filtra as com estoque baixo
  async findAll({ apenasEstoqueBaixo = false } = {}) {
    await ready;
    const sql = apenasEstoqueBaixo
      ? 'SELECT * FROM materias_primas WHERE quantidade_estoque <= quantidade_minima ORDER BY nome'
      : 'SELECT * FROM materias_primas ORDER BY nome';
    return query(sql).map(formatarMateriaPrima);
  },

  async findById(id) {
    await ready;
    return formatarMateriaPrima(
      get('SELECT * FROM materias_primas WHERE id = ?', [id])
    );
  },

  async findByCodigo(codigo) {
    await ready;
    return formatarMateriaPrima(
      get('SELECT * FROM materias_primas WHERE codigo = ?', [codigo])
    );
  },

  // Cria uma nova matéria-prima — codigo deve ser único
  async create({
    nome,
    codigo,
    unidadeMedida  = 'kg',
    quantidadeEstoque = 0,
    quantidadeMinima  = 0,
    precoUnitario  = 0,
    fornecedor     = '',
    observacoes    = '',
  }) {
    await ready;
    const info = run(
      `INSERT INTO materias_primas
         (nome, codigo, unidade_medida, quantidade_estoque,
          quantidade_minima, preco_unitario, fornecedor, observacoes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nome.trim(), codigo.trim().toUpperCase(), unidadeMedida,
       quantidadeEstoque, quantidadeMinima, precoUnitario,
       fornecedor.trim(), observacoes.trim()]
    );
    return this.findById(info.lastInsertRowid);
  },

  // Atualiza apenas os campos enviados (patch parcial)
  async update(id, {
    nome, codigo, unidadeMedida, quantidadeMinima,
    precoUnitario, fornecedor, observacoes,
  }) {
    await ready;
    const atual = get('SELECT * FROM materias_primas WHERE id = ?', [id]);
    if (!atual) return null;

    run(`
      UPDATE materias_primas SET
        nome               = ?,
        codigo             = ?,
        unidade_medida     = ?,
        quantidade_minima  = ?,
        preco_unitario     = ?,
        fornecedor         = ?,
        observacoes        = ?,
        updated_at         = datetime('now')
      WHERE id = ?
    `, [
      nome            ?? atual.nome,
      codigo          ?? atual.codigo,
      unidadeMedida   ?? atual.unidade_medida,
      quantidadeMinima ?? atual.quantidade_minima,
      precoUnitario   ?? atual.preco_unitario,
      fornecedor      ?? atual.fornecedor,
      observacoes     ?? atual.observacoes,
      id,
    ]);

    return this.findById(id);
  },

  // ----------------------------------------------------------------
  // MOVIMENTAÇÕES DE ESTOQUE
  // Registra entrada (compra/reposição) ou saída (consumo em ordem)
  // Atualiza o saldo de quantidade_estoque automaticamente
  // ----------------------------------------------------------------

  // Lista movimentações de uma matéria-prima específica
  async findMovimentacoes(materiaPrimaId, { limite = 50 } = {}) {
    await ready;
    const rows = query(
      `SELECT
         mv.*,
         mp.nome  AS mp_nome,
         op.numero_ordem AS num_ordem,
         u.nome   AS usu_nome
       FROM movimentacoes_estoque mv
       LEFT JOIN materias_primas   mp ON mp.id = mv.materia_prima_id
       LEFT JOIN ordens_producao   op ON op.id = mv.ordem_id
       LEFT JOIN usuarios          u  ON u.id  = mv.usuario_id
       WHERE mv.materia_prima_id = ?
       ORDER BY mv.created_at DESC
       LIMIT ?`,
      [materiaPrimaId, limite]
    );
    return rows.map(formatarMovimentacao);
  },

  // Lista todas as movimentações (visão geral do gerente)
  async findTodasMovimentacoes({ limite = 100 } = {}) {
    await ready;
    const rows = query(
      `SELECT
         mv.*,
         mp.nome  AS mp_nome,
         op.numero_ordem AS num_ordem,
         u.nome   AS usu_nome
       FROM movimentacoes_estoque mv
       LEFT JOIN materias_primas   mp ON mp.id = mv.materia_prima_id
       LEFT JOIN ordens_producao   op ON op.id = mv.ordem_id
       LEFT JOIN usuarios          u  ON u.id  = mv.usuario_id
       ORDER BY mv.created_at DESC
       LIMIT ?`,
      [limite]
    );
    return rows.map(formatarMovimentacao);
  },

  // Registra uma movimentação e atualiza o saldo do estoque
  async registrarMovimentacao({
    materiaPrimaId,
    tipo,             // 'entrada' | 'saida'
    quantidade,
    ordemId    = null,
    observacoes = '',
    usuarioId  = null,
  }) {
    await ready;

    if (!['entrada', 'saida'].includes(tipo)) {
      throw new Error('Tipo de movimentação inválido. Use "entrada" ou "saida".');
    }
    if (!quantidade || quantidade <= 0) {
      throw new Error('Quantidade deve ser maior que zero.');
    }

    const mp = get('SELECT * FROM materias_primas WHERE id = ?', [materiaPrimaId]);
    if (!mp) throw new Error(`Matéria-prima ID ${materiaPrimaId} não encontrada.`);

    // Impede saída maior do que o saldo disponível
    if (tipo === 'saida' && quantidade > mp.quantidade_estoque) {
      throw new Error(
        `Saldo insuficiente. Disponível: ${mp.quantidade_estoque} ${mp.unidade_medida}, ` +
        `solicitado: ${quantidade} ${mp.unidade_medida}.`
      );
    }

    // Calcula novo saldo
    const delta      = tipo === 'entrada' ? quantidade : -quantidade;
    const novoSaldo  = mp.quantidade_estoque + delta;

    // Persiste a movimentação
    const infoMov = run(
      `INSERT INTO movimentacoes_estoque
         (materia_prima_id, ordem_id, tipo, quantidade, observacoes, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [materiaPrimaId, ordemId, tipo, quantidade, observacoes.trim(), usuarioId]
    );

    // Atualiza o saldo na tabela de matérias-primas
    run(
      `UPDATE materias_primas
          SET quantidade_estoque = ?,
              updated_at = datetime('now')
        WHERE id = ?`,
      [novoSaldo, materiaPrimaId]
    );

    return {
      movimentacaoId: infoMov.lastInsertRowid,
      tipo,
      quantidade,
      saldoAnterior:  mp.quantidade_estoque,
      novoSaldo,
      estoqueBaixo:   novoSaldo <= mp.quantidade_minima,
    };
  },
};

module.exports = MateriaPrima;