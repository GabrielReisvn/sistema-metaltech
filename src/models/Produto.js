const { ready, query, run, get } = require('../database/sqlite');

// Converte linha do banco para o formato da API
function formatarProduto(row) {
  if (!row) return null;
  return {
    id:              row.id,
    nome:            row.nome,
    descricao:       row.descricao,
    codigo:          row.codigo,
    unidadeMedida:   row.unidade_medida,
    pesoEstimadoKg:  row.peso_estimado_kg,
    tempoProducaoH:  row.tempo_producao_h,
    precoUnitario:   row.preco_unitario,
    categoria:       row.categoria,
    disponivel:      row.disponivel === 1,
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
  };
}

const Produto = {

  // Lista produtos — filtra por categoria ou disponibilidade se informado
  async findAll({ categoria, apenasDisponiveis = false } = {}) {
    await ready;
    const where  = [];
    const params = [];

    if (categoria) {
      where.push('categoria = ?');
      params.push(categoria);
    }
    if (apenasDisponiveis) {
      where.push('disponivel = 1');
    }

    const clausula = where.length ? 'WHERE ' + where.join(' AND ') : '';
    return query(
      `SELECT * FROM produtos ${clausula} ORDER BY categoria, nome`,
      params
    ).map(formatarProduto);
  },

  async findById(id) {
    await ready;
    return formatarProduto(get('SELECT * FROM produtos WHERE id = ?', [id]));
  },

  async findByCodigo(codigo) {
    await ready;
    return formatarProduto(get('SELECT * FROM produtos WHERE codigo = ?', [codigo]));
  },

  // Cria uma nova peça no catálogo — codigo deve ser único
  async create({ nome, descricao = '', codigo, unidadeMedida = 'un', pesoEstimadoKg = 0,
                 tempoProducaoH = 0, precoUnitario = 0, categoria = 'geral', disponivel = true }) {
    await ready;
    const info = run(
      `INSERT INTO produtos
         (nome, descricao, codigo, unidade_medida, peso_estimado_kg,
          tempo_producao_h, preco_unitario, categoria, disponivel)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nome.trim(), descricao.trim(), codigo.trim().toUpperCase(),
       unidadeMedida, pesoEstimadoKg, tempoProducaoH,
       precoUnitario, categoria, disponivel ? 1 : 0]
    );
    return this.findById(info.lastInsertRowid);
  },

  // Atualiza apenas os campos enviados (patch parcial)
  async update(id, { nome, descricao, codigo, unidadeMedida, pesoEstimadoKg,
                     tempoProducaoH, precoUnitario, categoria, disponivel }) {
    await ready;
    const atual = get('SELECT * FROM produtos WHERE id = ?', [id]);
    if (!atual) return null;

    run(`
      UPDATE produtos SET
        nome             = ?,
        descricao        = ?,
        codigo           = ?,
        unidade_medida   = ?,
        peso_estimado_kg = ?,
        tempo_producao_h = ?,
        preco_unitario   = ?,
        categoria        = ?,
        disponivel       = ?,
        updated_at       = datetime('now')
      WHERE id = ?
    `, [
      nome           ?? atual.nome,
      descricao      ?? atual.descricao,
      codigo         ?? atual.codigo,
      unidadeMedida  ?? atual.unidade_medida,
      pesoEstimadoKg ?? atual.peso_estimado_kg,
      tempoProducaoH ?? atual.tempo_producao_h,
      precoUnitario  ?? atual.preco_unitario,
      categoria      ?? atual.categoria,
      disponivel !== undefined ? (disponivel ? 1 : 0) : atual.disponivel,
      id,
    ]);

    return this.findById(id);
  },

  // Soft delete — marca como indisponível, preserva histórico de ordens
  async delete(id) {
    await ready;
    const info = run(
      "UPDATE produtos SET disponivel = 0, updated_at = datetime('now') WHERE id = ?",
      [id]
    );
    return info.changes > 0;
  },
};

module.exports = Produto;
