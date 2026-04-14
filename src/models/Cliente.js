// acesso ao banco de dados SQLite e funções auxiliares para manipulação dos dados
const { ready, query, run, get } = require('../database/sqlite');

// Função auxiliar para formatar os dados do banco no formato esperado pela API, convertendo o campo de endereço de JSON string para objeto
function formatarCliente(row) {
  if (!row) return null;
  return {
    _id:        row.id,
    id:         row.id,
    nome:       row.nome,
    telefone:   row.telefone,
    endereco:   JSON.parse(row.endereco || '{}'),
    observacoes: row.observacoes,
    ativo:      row.ativo === 1,
    createdAt:  row.created_at,
    updatedAt:  row.updated_at,
  };
}

// OBJETO DE MODELO DE CLIENTE COM MÉTODOS PARA CRUD E CONSULTAS ESPECÍFICAS
const Cliente = {

  async findAll(busca = '') {
    await ready;
    let rows;
    if (busca) {
      const t = `%${busca}%`;
      rows = query(
        'SELECT * FROM clientes WHERE ativo = 1 AND (nome LIKE ? OR telefone LIKE ?) ORDER BY nome',
        [t, t]
      );
    } else {
      rows = query('SELECT * FROM clientes WHERE ativo = 1 ORDER BY nome');
    }
    return rows.map(formatarCliente);
  },

  
  async findById(id) {
    await ready;
    return formatarCliente(get('SELECT * FROM clientes WHERE id = ?', [id]));
  },

  // Cria um novo cliente com os dados fornecidos, convertendo o campo de endereço para JSON string antes de inserir no banco
  async create({ nome, telefone, endereco = {}, observacoes = '' }) {
    await ready;
    const info = run(
      'INSERT INTO clientes (nome, telefone, endereco, observacoes) VALUES (?, ?, ?, ?)',
      [nome.trim(), telefone.trim(), JSON.stringify(endereco), observacoes]
    );
    return this.findById(info.lastInsertRowid);
  },

  // Atualiza um cliente existente com os dados fornecidos, convertendo o campo de endereço para JSON string antes de atualizar no banco
  async update(id, { nome, telefone, endereco, observacoes, ativo }) {
    await ready;
    const atual = get('SELECT * FROM clientes WHERE id = ?', [id]);
    if (!atual) return null;

    const endAtual = JSON.parse(atual.endereco || '{}');
    const endFinal = endereco ? { ...endAtual, ...endereco } : endAtual;

    run(`
      UPDATE clientes SET
        nome        = ?,
        telefone    = ?,
        endereco    = ?,
        observacoes = ?,
        ativo       = ?,
        updated_at  = datetime('now')
      WHERE id = ?
    `, [
      nome        ?? atual.nome,
      telefone    ?? atual.telefone,
      JSON.stringify(endFinal),
      observacoes ?? atual.observacoes,
      ativo !== undefined ? (ativo ? 1 : 0) : atual.ativo,
      id
    ]);

    return this.findById(id);
  },

  // Deleta um cliente (na verdade, marca como inativo), retornando true se o cliente foi deletado ou false se o cliente não for encontrado
  async delete(id) {
    await ready;
    const info = run('DELETE FROM clientes WHERE id = ?', [id]);
    return info.changes > 0;
  },
};

// EXPORTANDO O MODELO DE CLIENTE PARA USO NAS ROTAS E OUTRAS PARTES DO SISTEMA
module.exports = Cliente;
