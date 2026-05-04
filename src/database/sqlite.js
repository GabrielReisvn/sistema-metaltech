const initSqlJs = require('sql.js');
const fs        = require('fs');
const path      = require('path');

// Caminho do banco configurável via variável de ambiente
const DB_PATH = process.env.DB_PATH
  || path.join(__dirname, '..', '..', 'Metaltech.db');

const state = { db: null };

// Inicializa o banco, cria tabelas se não existirem e carrega do arquivo se já existir
const ready = (async () => {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    state.db = new SQL.Database(fileBuffer);
  } else {
    state.db = new SQL.Database();
  }

  const db = state.db;

  db.run('PRAGMA foreign_keys = ON');

  // ----------------------------------------------------------------
  // USUÁRIOS
  // Perfis: 'Lider' (app mobile, registra ordens) | 'Gerente' (web admin, visão estratégica)
  // ----------------------------------------------------------------
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      nome        TEXT    NOT NULL,
      email       TEXT    NOT NULL UNIQUE,
      senha       TEXT    NOT NULL,
      perfil      TEXT    NOT NULL DEFAULT 'Lider'
                          CHECK(perfil IN ('Lider', 'Gerente')),
      ativo       INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ----------------------------------------------------------------
  // CLIENTES
  // Empresas ou pessoas que encomendam peças à MetalTech
  // ----------------------------------------------------------------
  db.run(`
    CREATE TABLE IF NOT EXISTS clientes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      nome        TEXT    NOT NULL,
      cnpj_cpf    TEXT    NOT NULL UNIQUE,
      telefone    TEXT    NOT NULL DEFAULT '',
      email       TEXT    NOT NULL DEFAULT '',
      endereco    TEXT    NOT NULL DEFAULT '{}',
      observacoes TEXT    NOT NULL DEFAULT '',
      ativo       INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ----------------------------------------------------------------
  // PRODUTOS (peças fabricadas)
  // Catálogo de peças que a MetalTech produz
  // ----------------------------------------------------------------
  db.run(`
    CREATE TABLE IF NOT EXISTS produtos (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      nome            TEXT    NOT NULL,
      descricao       TEXT    NOT NULL DEFAULT '',
      codigo          TEXT    NOT NULL UNIQUE,
      unidade_medida  TEXT    NOT NULL DEFAULT 'un',
      peso_estimado_kg REAL   NOT NULL DEFAULT 0,
      tempo_producao_h REAL   NOT NULL DEFAULT 0,
      preco_unitario  REAL    NOT NULL DEFAULT 0,
      categoria       TEXT    NOT NULL DEFAULT 'geral',
      disponivel      INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ----------------------------------------------------------------
  // MATÉRIAS-PRIMAS (estoque)
  // Materiais usados na fabricação das peças
  // ----------------------------------------------------------------
  db.run(`
    CREATE TABLE IF NOT EXISTS materias_primas (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      nome            TEXT    NOT NULL,
      codigo          TEXT    NOT NULL UNIQUE,
      unidade_medida  TEXT    NOT NULL DEFAULT 'kg',
      quantidade_estoque REAL NOT NULL DEFAULT 0,
      quantidade_minima  REAL NOT NULL DEFAULT 0,
      preco_unitario  REAL    NOT NULL DEFAULT 0,
      fornecedor      TEXT    NOT NULL DEFAULT '',
      observacoes     TEXT    NOT NULL DEFAULT '',
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ----------------------------------------------------------------
  // ORDENS DE PRODUÇÃO
  // Documento central do sistema — ciclo de vida de cada fabricação
  // Status: 'aguardando' → 'em_producao' → 'finalizado' | 'cancelado'
  // ----------------------------------------------------------------
  db.run(`
    CREATE TABLE IF NOT EXISTS ordens_producao (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_ordem    INTEGER NOT NULL UNIQUE,
      cliente_id      INTEGER NOT NULL REFERENCES clientes(id),
      lider_id        INTEGER REFERENCES usuarios(id),
      prazo_entrega   TEXT    NOT NULL,
      status          TEXT    NOT NULL DEFAULT 'aguardando'
                              CHECK(status IN ('aguardando','em_producao','finalizado','cancelado')),
      prioridade      TEXT    NOT NULL DEFAULT 'normal'
                              CHECK(prioridade IN ('baixa','normal','alta','urgente')),
      observacoes     TEXT    NOT NULL DEFAULT '',
      total           REAL    NOT NULL DEFAULT 0,
      iniciado_em     TEXT,
      finalizado_em   TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ----------------------------------------------------------------
  // ITENS DA ORDEM
  // Cada peça (produto) dentro de uma ordem de produção
  // ----------------------------------------------------------------
  db.run(`
    CREATE TABLE IF NOT EXISTS itens_ordem (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      ordem_id        INTEGER NOT NULL REFERENCES ordens_producao(id),
      produto_id      INTEGER NOT NULL REFERENCES produtos(id),
      nome_produto    TEXT    NOT NULL,
      quantidade      INTEGER NOT NULL DEFAULT 1,
      preco_unitario  REAL    NOT NULL DEFAULT 0,
      subtotal        REAL    NOT NULL DEFAULT 0,
      observacoes     TEXT    NOT NULL DEFAULT ''
    )
  `);

  // ----------------------------------------------------------------
  // MOVIMENTAÇÕES DE ESTOQUE
  // Rastreabilidade de entradas e saídas de matéria-prima
  // tipo: 'entrada' (compra/reposição) | 'saida' (uso em ordem)
  // ----------------------------------------------------------------
  db.run(`
    CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      materia_prima_id INTEGER NOT NULL REFERENCES materias_primas(id),
      ordem_id         INTEGER REFERENCES ordens_producao(id),
      tipo             TEXT    NOT NULL CHECK(tipo IN ('entrada','saida')),
      quantidade       REAL    NOT NULL,
      observacoes      TEXT    NOT NULL DEFAULT '',
      usuario_id       INTEGER REFERENCES usuarios(id),
      created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  salvar();

  console.log('SQLite (sql.js) conectado — FactoryTrack MetalTech:', DB_PATH);
  return db;
})();

// Persiste o banco em arquivo após cada modificação
function salvar() {
  if (!state.db) {
    console.warn('salvar() chamada antes do banco inicializar.');
    return;
  }
  const data = state.db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// Executa SELECT e retorna array de objetos
function query(sql, params = []) {
  const stmt    = state.db.prepare(sql);
  const results = [];
  stmt.bind(params);
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Executa INSERT / UPDATE / DELETE e retorna metadados
function run(sql, params = []) {
  state.db.run(sql, params);
  const meta = query('SELECT last_insert_rowid() as id, changes() as changes');
  salvar();
  return {
    lastInsertRowid: meta[0]?.id,
    changes:         meta[0]?.changes,
  };
}

// Retorna um único registro ou null
function get(sql, params = []) {
  const rows = query(sql, params);
  return rows[0] || null;
}

module.exports = { ready, query, run, get, salvar };