const { ready, query, run, get } = require('../database/sqlite');
const bcrypt = require('bcryptjs');

// Converte linha do banco para o formato da API — nunca expõe a senha
function formatarUsuario(row) {
  if (!row) return null;
  return {
    id:        row.id,
    nome:      row.nome,
    email:     row.email,
    perfil:    row.perfil,   // 'Lider' | 'Gerente'
    ativo:     row.ativo === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const Usuario = {

  async findAll() {
    await ready;
    return query(
      'SELECT id, nome, email, perfil, ativo, created_at, updated_at FROM usuarios ORDER BY nome'
    ).map(formatarUsuario);
  },

  async findById(id) {
    await ready;
    return formatarUsuario(
      get('SELECT id, nome, email, perfil, ativo, created_at, updated_at FROM usuarios WHERE id = ?', [id])
    );
  },

  // Retorna a linha completa com senha (uso interno — login/autenticação)
  async findByEmail(email) {
    await ready;
    return get('SELECT * FROM usuarios WHERE email = ?', [email.toLowerCase().trim()]);
  },

  // Cria usuário com senha criptografada — perfil padrão é 'Lider' (app mobile)
  async create({ nome, email, senha, perfil = 'Lider' }) {
    await ready;
    const hash = await bcrypt.hash(senha, 10);
    const info = run(
      'INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)',
      [nome.trim(), email.toLowerCase().trim(), hash, perfil]
    );
    return this.findById(info.lastInsertRowid);
  },

  // Atualiza apenas os campos enviados — re-hash a senha somente se ela vier no payload
  async update(id, { nome, email, senha, perfil, ativo }) {
    await ready;
    const atual = get('SELECT * FROM usuarios WHERE id = ?', [id]);
    if (!atual) return null;

    const senhaFinal = senha ? await bcrypt.hash(senha, 10) : atual.senha;

    run(`
      UPDATE usuarios SET
        nome       = ?,
        email      = ?,
        senha      = ?,
        perfil     = ?,
        ativo      = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `, [
      nome   ?? atual.nome,
      email  ?? atual.email,
      senhaFinal,
      perfil ?? atual.perfil,
      ativo !== undefined ? (ativo ? 1 : 0) : atual.ativo,
      id,
    ]);

    return this.findById(id);
  },

  // Soft delete — desativa o usuário sem apagar do histórico de ordens
  async delete(id) {
    await ready;
    const info = run(
      "UPDATE usuarios SET ativo = 0, updated_at = datetime('now') WHERE id = ?",
      [id]
    );
    return info.changes > 0;
  },

  // Compara senha digitada com o hash salvo — retorna Promise<boolean>
  verificarSenha(senhaDigitada, hashSalvo) {
    return bcrypt.compare(senhaDigitada, hashSalvo);
  },
};

module.exports = Usuario;
