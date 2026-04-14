const { initDB } = require('./db.js');

async function test() {
  try {
    console.log('Iniciando banco de dados...');
    await initDB();
    console.log('Banco inicializado com sucesso (tabelas criadas)!');
    process.exit(0);
  } catch (error) {
    console.error('Erro ao inicializar:', error);
    process.exit(1);
  }
}

test();
