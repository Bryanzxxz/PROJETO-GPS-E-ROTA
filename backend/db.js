require('dotenv').config();
const { Pool, types } = require('pg');

types.setTypeParser(20, function(val) {
  return parseInt(val, 10);
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

function adaptQuery(text) {
  let count = 1;
  return text.replace(/\?/g, () => `$${count++}`);
}

const db = {
  get: async (sql, params = []) => {
    const res = await pool.query(adaptQuery(sql), params);
    return res.rows[0];
  },
  all: async (sql, params = []) => {
    const res = await pool.query(adaptQuery(sql), params);
    return res.rows;
  },
  run: async (sql, params = []) => {
    const res = await pool.query(adaptQuery(sql), params);
    return { changes: res.rowCount };
  },
  exec: async (sql) => {
    await pool.query(sql);
  }
};

async function getDB() {
  return db;
}

async function initDB() {
  const sqliteToPgTypes = (str) => {
    return str.replace(/DATETIME/g, 'TIMESTAMP');
  };

  // Tabela de usuários
  await db.exec(sqliteToPgTypes(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      tipoDocumento TEXT NOT NULL,
      documento TEXT UNIQUE NOT NULL,
      telefone TEXT,
      empresa TEXT,
      senha TEXT NOT NULL,
      status TEXT NOT NULL,
      tipo TEXT NOT NULL,
      email_verificado INTEGER NOT NULL DEFAULT 0,
      codigo_verificacao TEXT,
      expiracao_codigo DATETIME,
      criadoEm DATETIME
    )
  `));

  // Tabela de notificações internas (admin)
  await db.exec(sqliteToPgTypes(`
    CREATE TABLE IF NOT EXISTS notificacoes (
      id TEXT PRIMARY KEY,
      tipo TEXT NOT NULL,
      usuario_id TEXT NOT NULL,
      nome_usuario TEXT NOT NULL,
      email_usuario TEXT NOT NULL,
      mensagem TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pendente',
      data_criacao DATETIME NOT NULL
    )
  `));

  // Tabela de técnicos em campo (tempo real — 1 registro por usuário)
  await db.exec(sqliteToPgTypes(`
    CREATE TABLE IF NOT EXISTS tecnicos_em_campo (
      id TEXT PRIMARY KEY,
      usuario_id TEXT UNIQUE NOT NULL,
      nome TEXT NOT NULL,
      rota TEXT DEFAULT '[]',
      cliente_atual TEXT,
      indice_atual INTEGER DEFAULT 0,
      status TEXT DEFAULT 'online',
      em_rota INTEGER DEFAULT 0,
      latitude REAL,
      longitude REAL,
      ultima_atualizacao DATETIME,
      data_dia TEXT NOT NULL
    )
  `));

  // Tabela de relatórios históricos
  await db.exec(sqliteToPgTypes(`
    CREATE TABLE IF NOT EXISTS relatorios (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL,
      nome TEXT NOT NULL,
      data TEXT NOT NULL,
      hora_inicio TEXT,
      hora_fim TEXT,
      rota TEXT DEFAULT '[]',
      clientes_atendidos INTEGER DEFAULT 0,
      total_clientes INTEGER DEFAULT 0
    )
  `));

  // Tabela de histórico de atendimentos concluídos (NOVO — incremental)
  await db.exec(sqliteToPgTypes(`
    CREATE TABLE IF NOT EXISTS historico_atendimentos (
      id TEXT PRIMARY KEY,
      tecnico_id TEXT NOT NULL,
      nome_tecnico TEXT NOT NULL,
      nome_cliente TEXT NOT NULL,
      data TEXT NOT NULL,
      hora TEXT NOT NULL,
      rota_id TEXT
    )
  `));

  return db;
}

module.exports = { getDB, initDB };
