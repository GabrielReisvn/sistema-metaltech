// Modelo de dados para usuários do sistema (administradores, atendentes, etc).
// IMPORTANDO DEPENDÊNCIAS
const { ready, query, run, get } = require('../database/sqlite');
const bcrypt = require('bcryptjs');

// Função auxiliar para formatar os dados do banco no formato esperado pela API
function formatarUsuario(row) {
  if (!row) return null;
  return {
    _id:       row.id,
    id:        row.id,
    nome:      row.nome,
    email:     row.email,
    perfil:    row.perfil,
    ativo:     row.ativo === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// OBJETO DE MODELO DE USUÁRIO COM MÉTODOS PARA CRUD E VERIFICAÇÃO DE SENHA
const Usuario = {

  async findAll() {
    await ready;
    const rows = query(`
      SELECT id, nome, email, perfil, ativo, created_at, updated_at
      FROM usuarios ORDER BY created_at DESC
    `);
    return rows.map(formatarUsuario);
  },

  async findByEmail(email) {
    await ready;
    return get('SELECT * FROM usuarios WHERE email = ?', [email.toLowerCase().trim()]);
  },

  async findById(id) {
    await ready;
    const row = get(`
      SELECT id, nome, email, perfil, ativo, created_at, updated_at
      FROM usuarios WHERE id = ?
    `, [id]);
    return formatarUsuario(row);
  },

  // Cria um novo usuário com senha criptografada 
  async create({ nome, email, senha, perfil = 'Atendente' }) {
    await ready;
    const hash = await bcrypt.hash(senha, 10);
    const info = run(
      'INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)',
      [nome.trim(), email.toLowerCase().trim(), hash, perfil]
    );
    return this.findById(info.lastInsertRowid); // retornando o usuário recém-criado
  },

  // Atualiza usuario existente
  async update(id, { nome, email, senha, perfil, ativo }) {
    await ready;
    const atual = get('SELECT * FROM usuarios WHERE id = ?', [id]);
    if (!atual) return null;

    let senhaFinal = atual.senha;
    if (senha) senhaFinal = await bcrypt.hash(senha, 10);

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
      id
    ]);// atualizando usuário e retornando o usuário atualizado

    return this.findById(id);
  },

  // Deleta um usuário (na verdade, marca como inativo)
  async delete(id) {
    await ready;
    const info = run('DELETE FROM usuarios WHERE id = ?', [id]);
    return info.changes > 0;
  },
  // Verifica se a senha digitada corresponde ao hash salvo 
  verificarSenha(senhaDigitada, hashSalvo) {
    return bcrypt.compare(senhaDigitada, hashSalvo);
  },
};
// EXPORTANDO O MODELO DE USUÁRIO PARA USO NAS ROTAS E OUTRAS PARTES DO SISTEMA
module.exports = Usuario;
