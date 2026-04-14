const { getDB } = require('./db.js');

async function cleanup() {
  try {
    const db = await getDB();
    
    // Deletar o registro específico do adm fantasma que ficou preso no rastreio
    const result = await db.run("DELETE FROM tecnicos_em_campo WHERE nome = 'Guarutoner Suprimentos'");
    console.log(`Registros removidos do rastreio: ${result.changes}`);
    
    // Limpeza geral: remove qualquer pessoa do rastreio que não seja do tipo 'tecnico' no banco principal
    const result2 = await db.run(`
        DELETE FROM tecnicos_em_campo 
        WHERE usuario_id NOT IN (SELECT id FROM users WHERE tipo = 'tecnico')
    `);
    console.log(`Limpeza geral concluída: ${result2.changes} registros removidos.`);

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

cleanup();
