const { getDB } = require('./db.js');

async function fix() {
  try {
    const db = await getDB();
    const result = await db.run("DELETE FROM users WHERE email = 'adm@guarutoner.com.br'");
    console.log(`Deletados: ${result.changes}`);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

fix();
