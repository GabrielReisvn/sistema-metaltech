// exportando a função de inicialização do banco de dados
const initSqlJs = require('sql.js');
// exportando a função nescessaria para ler e escrever arquivos no sistema, alem de manipular caminhos de arquivos
const fs        = require('fs');
const path      = require('path');

// Definindo o caminho para o arquivo do banco de dados SQLite, permitindo a configuração via variável de ambiente ou usando um caminho padrão dentro do projeto
const DB_PATH = process.env.DB_PATH
  || path.join(__dirname, '..', '..', 'Metaltech.db');

const state = { db: null };

// Função assíncrona para inicializar o banco de dados SQLite usando sql.js, criando as tabelas necessárias se elas ainda não existirem e habilitando o suporte a chaves estrangeiras para garantir a integridade referencial entre as tabelas. O banco é carregado a partir de um arquivo se ele existir, ou criado do zero caso contrário. Após a inicialização, o estado do banco é salvo em um arquivo para persistência dos dados. A função retorna uma promessa que resolve com a instância do banco de dados pronta para uso.
const ready = (async () => {
  const SQL = await initSqlJs();


  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    state.db = new SQL.Database(fileBuffer);
  } else {
    state.db = new SQL.Database();
  }

  const db = state.db;

  // Habilitando suporte a chaves estrangeiras para garantir a integridade referencial entre as tabelas
  db.run('PRAGMA foreign_keys = ON');

  // Tabela para armazenar os usuários do sistema, com campos para nome, email, senha (criptografada), perfil (Atendente ou Gerente), status de ativo/inativo e timestamps de criação e atualização
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      nome        TEXT    NOT NULL,
      email       TEXT    NOT NULL UNIQUE,
      senha       TEXT    NOT NULL,
      perfil      TEXT    NOT NULL DEFAULT 'Atendente',
      ativo       INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Tabela para armazenar os clientes, com campos para nome, telefone, endereço (armazenado como JSON), observações, status de ativo/inativo e timestamps de criação e atualização
  db.run(`
    CREATE TABLE IF NOT EXISTS clientes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      nome        TEXT    NOT NULL,
      telefone    TEXT    NOT NULL,
      endereco    TEXT    NOT NULL DEFAULT '{}',
      observacoes TEXT    NOT NULL DEFAULT '',
      ativo       INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Tabela para armazenar as pizzas, com campos para nome, descrição, ingredientes, preços por tamanho (armazenados como JSON), disponibilidade, categoria e timestamps de criação e atualização
  db.run(`
    CREATE TABLE IF NOT EXISTS pizzas (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      nome         TEXT    NOT NULL,
      descricao    TEXT    NOT NULL DEFAULT '',
      ingredientes TEXT    NOT NULL,
      precos       TEXT    NOT NULL DEFAULT '{"P":0,"M":0,"G":0}',
      disponivel   INTEGER NOT NULL DEFAULT 1,
      categoria    TEXT    NOT NULL DEFAULT 'tradicional',
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Tabela para armazenar os pedidos, com referências para o cliente e o garçom (usuário), além de informações como subtotal, taxa de entrega, total, forma de pagamento, status e outras observações
  db.run(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_pedido   INTEGER,
      cliente_id      INTEGER NOT NULL REFERENCES clientes(id),
      subtotal        REAL    NOT NULL DEFAULT 0,
      taxa_entrega    REAL    NOT NULL DEFAULT 0,
      total           REAL    NOT NULL DEFAULT 0,
      forma_pagamento TEXT    NOT NULL,
      troco           REAL    NOT NULL DEFAULT 0,
      status          TEXT    NOT NULL DEFAULT 'recebido',
      observacoes     TEXT    NOT NULL DEFAULT '',
      mesa            INTEGER,
      origem          TEXT    NOT NULL DEFAULT 'balcao',
      garcom_id       INTEGER REFERENCES usuarios(id),
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Tabela para armazenar os itens de cada pedido, com referências para o pedido e a pizza, além de informações específicas do item como nome da pizza, tamanho, quantidade, preço unitário e subtotal
  db.run(`
    CREATE TABLE IF NOT EXISTS itens_pedido (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id      INTEGER NOT NULL REFERENCES pedidos(id),
      pizza_id       INTEGER NOT NULL REFERENCES pizzas(id),
      nome_pizza     TEXT    NOT NULL,
      tamanho        TEXT    NOT NULL,
      quantidade     INTEGER NOT NULL DEFAULT 1,
      preco_unitario REAL    NOT NULL DEFAULT 0,
      subtotal       REAL    NOT NULL DEFAULT 0
    )
  `);

  salvar();

  console.log('SQLite (sql.js) conectado:', DB_PATH);
  return db;
})();


// Função para salvar o estado atual do banco de dados em um arquivo, convertendo os dados exportados para um buffer antes de escrever no sistema de arquivos
function salvar() {
  if (!state.db) return;
  const data = state.db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// Função para executar consultas SQL que retornam resultados, retornando um array de objetos representando as linhas resultantes
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


// Função para executar comandos SQL que modificam o banco (INSERT, UPDATE, DELETE), retornando informações sobre a última linha inserida e o número de linhas afetadas
function run(sql, params = []) {
  state.db.run(sql, params);
  const meta = query('SELECT last_insert_rowid() as id, changes() as changes');
  salvar();
  return {
    lastInsertRowid: meta[0]?.id,
    changes:         meta[0]?.changes,
  };
}

// Função para obter um único registro do banco, retornando o primeiro resultado ou null se não houver resultados
function get(sql, params = []) {
  const rows = query(sql, params);
  return rows[0] || null;
}

// EXPORTANDO AS FUNÇÕES DE ACESSO AO BANCO PARA USO NAS MODELS E OUTRAS PARTES DO SISTEMA
module.exports = { ready, query, run, get, salvar };
