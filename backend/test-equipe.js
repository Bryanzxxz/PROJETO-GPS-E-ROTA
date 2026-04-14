const { getDB } = require('./db.js');

async function test() {
  const db = await getDB();
  const equipe = [];
  const usuarios = await db.all(
      "SELECT id, nome, email, tipo FROM users WHERE status = 'aprovado' ORDER BY nome ASC"
  );
  
  for (const u of usuarios) {
      let totalAtendimentos = 0;
      if (u.tipo === 'tecnico') {
        const count = await db.get(
          'SELECT COUNT(*) as total FROM historico_atendimentos WHERE tecnico_id = ?',
          [u.id]
        );
        totalAtendimentos = count ? count.total : 0;
      }
      equipe.push({
        id: u.id,
        nome: u.nome,
        email: u.email,
        tipo: u.tipo,
        totalAtendimentos
      });
  }
  
  console.log('EQUIPE:', equipe);

  const tecnicos = await db.all(
      'SELECT * FROM tecnicos_em_campo'
  );
  console.log('TECNICOS EM CAMPO:', tecnicos);
  
  process.exit(0);
}

test();
