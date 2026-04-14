const { getDB } = require('./db.js');

async function test() {
  const db = await getDB();
  const users = await db.all("SELECT * FROM users");
  console.log('All users:', users);

  const pendentesRows = await db.all("SELECT id, nome, email, tipoDocumento, documento, telefone, empresa, criadoEm FROM users WHERE status = 'pendente' AND email_verificado = 1");
  console.log('Pendentes:', pendentesRows);

  process.exit(0);
}

test();
