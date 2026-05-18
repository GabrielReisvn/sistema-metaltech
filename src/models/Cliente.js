const { ready, query, run, get } = require('../database/sqlite');

// Converte linha do banco para o formato da API
// endereco é salvo como JSON string no banco
function formatarCliente(row) {
  if (!row) return null;
  return {
    id:          row.id,
    nome:        row.nome,
    cnpjCpf:     row.cnpj_cpf,
    telefone:    row.telefone,
    email:       row.email,
    endereco:    JSON.parse(row.endereco || '{}'),
    observacoes: row.observacoes,
    ativo:       row.ativo === 1,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

const Cliente = {

  // Lista clientes ativos — aceita busca por nome, cnpj_cpf ou telefone
  async findAll(busca = '') {
    await ready;
    if (busca) {
      const t = `%${busca}%`;
      return query(
        `SELECT * FROM clientes
          WHERE ativo = 1
            AND (nome LIKE ? OR cnpj_cpf LIKE ? OR telefone LIKE ?)
          ORDER BY nome`,
        [t, t, t]
      ).map(formatarCliente);
    }
    return query('SELECT * FROM clientes WHERE ativo = 1 ORDER BY nome').map(formatarCliente);
  },

  async findById(id) {
    await ready;
    return formatarCliente(get('SELECT * FROM clientes WHERE id = ?', [id]));
  },

  // Cria um novo cliente — cnpj_cpf é obrigatório e único
  async create({ nome, cnpjCpf, telefone = '', email = '', endereco = {}, observacoes = '' }) {
    await ready;
    const info = run(
      `INSERT INTO clientes (nome, cnpj_cpf, telefone, email, endereco, observacoes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nome.trim(), cnpjCpf.trim(), telefone.trim(), email.trim(),
       JSON.stringify(endereco), observacoes]
    );
    return this.findById(info.lastInsertRowid);
  },

  // Atualiza apenas os campos enviados (patch parcial)
  async update(id, { nome, cnpjCpf, telefone, email, endereco, observacoes, ativo }) {
    await ready;
    const atual = get('SELECT * FROM clientes WHERE id = ?', [id]);
    if (!atual) return null;

    const endAtual = JSON.parse(atual.endereco || '{}');
    const endFinal = endereco ? { ...endAtual, ...endereco } : endAtual;

    run(`
      UPDATE clientes SET
        nome        = ?,
        cnpj_cpf    = ?,
        telefone    = ?,
        email       = ?,
        endereco    = ?,
        observacoes = ?,
        ativo       = ?,
        updated_at  = datetime('now')
      WHERE id = ?
    `, [
      nome        ?? atual.nome,
      cnpjCpf     ?? atual.cnpj_cpf,
      telefone    ?? atual.telefone,
      email       ?? atual.email,
      JSON.stringify(endFinal),
      observacoes ?? atual.observacoes,
      ativo !== undefined ? (ativo ? 1 : 0) : atual.ativo,
      id,
    ]);

    return this.findById(id);
  },

  // Soft delete — marca como inativo, preserva histórico de ordens
  async delete(id) {
    await ready;
    const info = run(
      "UPDATE clientes SET ativo = 0, updated_at = datetime('now') WHERE id = ?",
      [id]
    );
    return info.changes > 0;
  },
};

module.exports = Cliente;
