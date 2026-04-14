// ============================================================
// Guarutoner — SERVIDOR DE RASTREAMENTO + AUTENTICAÇÃO
// Backend Node.js + Express
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { initDB, getDB } = require('./db.js');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'adm@guarutoner.com.br';

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ============================================================
// NOTA: Rastreamento agora é 100% via DB (tecnicos_em_campo)
// Sem armazenamento em memória para evitar duplicatas
// ============================================================

// ============================================================
// CONFIGURAÇÃO DE E-MAIL (SMTP REAL — SEM FALLBACK)
// ============================================================
let transporter;

function setupEmail() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true';

  if (!host || !user || !pass) {
    console.error('  ❌ SMTP não configurado! Verifique SMTP_HOST, SMTP_USER e SMTP_PASS no .env');
    console.error('  ❌ Emails NÃO serão enviados.');
    return;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });

  // Verificar conexão SMTP ao iniciar
  transporter.verify()
    .then(() => console.log(`  📧 SMTP conectado com sucesso: ${host}:${port} (user: ${user})`))
    .catch(err => console.error(`  ❌ Falha na conexão SMTP: ${err.message}`));
}

// Iniciar email no ambiente global (para Vercel Serverless)
setupEmail();

async function enviarEmail(para, assunto, html) {
  if (!transporter) {
    console.error(`  ❌ [EMAIL] Transporter não configurado. Email NÃO enviado para: ${para}`);
    return false;
  }
  try {
    await transporter.sendMail({
      from: `"Guarutoner Sistema" <${process.env.SMTP_USER}>`,
      to: para,
      subject: assunto,
      html: html
    });
    console.log(`  ✅ [EMAIL] Email enviado com sucesso para: ${para} | Assunto: ${assunto}`);
    return true;
  } catch (err) {
    console.error(`  ❌ [EMAIL] Falha ao enviar email para: ${para}`);
    console.error(`     Erro: ${err.message}`);
    console.error(`     Código: ${err.code || 'N/A'}`);
    console.error(`     Resposta SMTP: ${err.response || 'N/A'}`);
    return false;
  }
}

// ============================================================
// VALIDAÇÕES
// ============================================================
function validarCPF(cpf) {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(cpf[9])) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(cpf[10])) return false;

  return true;
}

function validarCNPJ(cnpj) {
  cnpj = cnpj.replace(/\D/g, '');
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let soma = 0;
  for (let i = 0; i < 12; i++) soma += parseInt(cnpj[i]) * pesos1[i];
  let resto = soma % 11;
  if (parseInt(cnpj[12]) !== (resto < 2 ? 0 : 11 - resto)) return false;

  soma = 0;
  for (let i = 0; i < 13; i++) soma += parseInt(cnpj[i]) * pesos2[i];
  resto = soma % 11;
  if (parseInt(cnpj[13]) !== (resto < 2 ? 0 : 11 - resto)) return false;

  return true;
}

function formatarDocumento(doc, tipo) {
  if (tipo === 'cnpj') {
    return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ============================================================
// ROTAS — CADASTRO E AUTENTICAÇÃO
// ============================================================

// POST /cadastro — Registrar novo usuário
app.post('/cadastro', async (req, res) => {
  try {
    const { nome, email, tipoDocumento, documento, senha, confirmarSenha, telefone, empresa, tipoConta } = req.body;
    const tipoDoc = tipoDocumento === 'cnpj' ? 'cnpj' : 'cpf';
    const tipoDocLabel = tipoDoc === 'cnpj' ? 'CNPJ' : 'CPF';
    const accType = tipoConta === 'gestor' ? 'gestor' : 'tecnico';

    // Validações
    const erros = [];
    if (!nome || !nome.trim()) erros.push('Nome é obrigatório.');
    if (!email || !validarEmail(email)) erros.push('E-mail inválido.');

    if (!documento) {
      erros.push(`${tipoDocLabel} é obrigatório.`);
    } else if (tipoDoc === 'cpf' && !validarCPF(documento)) {
      erros.push('CPF inválido.');
    } else if (tipoDoc === 'cnpj' && !validarCNPJ(documento)) {
      erros.push('CNPJ inválido.');
    }

    if (!senha || senha.length < 6) erros.push('Senha deve ter no mínimo 6 caracteres.');
    if (senha !== confirmarSenha) erros.push('As senhas não coincidem.');

    if (erros.length > 0) return res.status(400).json({ erros });

    const docLimpo = documento.replace(/\D/g, '');
    const emailLimpo = email.trim().toLowerCase();

    const db = await getDB();

    // Verificar duplicatas
    const existUser = await db.get('SELECT id, email_verificado, status FROM users WHERE email = ? OR documento = ?', [emailLimpo, docLimpo]);

    let isUpdate = false;
    let userId = uuidv4();

    if (existUser) {
      // Se já verificado E (aprovado ou pendente), bloquear
      if (existUser.email_verificado === 1 && existUser.status !== 'rejeitado') {
        return res.status(409).json({ erros: ['Este e-mail ou documento já está cadastrado e verificado.'] });
      }
      // Usuário rejeitado ou não verificado: permite sobrescrever
      isUpdate = true;
      userId = existUser.id;
    }

    const isAdmin = emailLimpo === ADMIN_EMAIL.toLowerCase();
    const senhaHash = await bcrypt.hash(senha, 10);

    // Configurações de status/verificação
    let status = isAdmin ? 'aprovado' : 'pendente';
    let emailVerificado = isAdmin ? 1 : 0;
    let codigoVerificacao = null;
    let expCodigo = null;

    if (!isAdmin) {
      // Gerar OTP 6 dígitos
      codigoVerificacao = Math.floor(100000 + Math.random() * 900000).toString();
      expCodigo = new Date(Date.now() + 5 * 60000).toISOString(); // 5 minutos
    }

    const telParsed = telefone ? telefone.replace(/\D/g, '') : null;
    const empParsed = empresa ? empresa.trim() : null;
    const dataIso = new Date().toISOString();

    if (isUpdate) {
      await db.run(`
        UPDATE users SET
          nome = ?, email = ?, tipoDocumento = ?, documento = ?, telefone = ?, empresa = ?, senha = ?, status = ?, tipo = ?, email_verificado = ?, codigo_verificacao = ?, expiracao_codigo = ?, criadoEm = ?
        WHERE id = ?
      `, [nome.trim(), emailLimpo, tipoDoc, docLimpo, telParsed, empParsed, senhaHash, status, accType, emailVerificado, codigoVerificacao, expCodigo, dataIso, userId]);
    } else {
      await db.run(`
        INSERT INTO users (id, nome, email, tipoDocumento, documento, telefone, empresa, senha, status, tipo, email_verificado, codigo_verificacao, expiracao_codigo, criadoEm)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [userId, nome.trim(), emailLimpo, tipoDoc, docLimpo, telParsed, empParsed, senhaHash, status, accType, emailVerificado, codigoVerificacao, expCodigo, dataIso]);
    }

    if (isAdmin) {
      console.log(`  [CADASTRO] ✅ Conta Admin criada/atualizada: ${emailLimpo}`);
      return res.json({ sucesso: true, reqOtp: false, mensagem: 'Conta administrativa criada e aprovada.' });
    }

    console.log(`  [CADASTRO] 📩 Novo usuário requer verificação: ${emailLimpo} - OTP: ${codigoVerificacao}`);

    // Enviar e-mail com OTP
    await enviarEmail(
      emailLimpo,
      'Seu Código de Verificação — Guarutoner',
      `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #00154d, #00277f); padding: 28px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">Guarutoner</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; text-align: center;">
          <h2 style="color: #00154d; margin-bottom: 12px;">Código de Verificação</h2>
          <p style="color: #334155; font-size: 15px; margin-bottom: 8px;">Olá, <strong>${nome.trim()}</strong>!</p>
          <p style="color: #334155; font-size: 14px; margin-bottom: 24px;">Para concluir seu registro, use o código abaixo:</p>
          <div style="font-size: 36px; font-weight: bold; letter-spacing: 10px; margin: 20px 0; color: #00154d; background: #f1f5f9; display: inline-block; padding: 16px 32px; border-radius: 12px; border: 2px dashed #cbd5e1;">${codigoVerificacao}</div>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 20px;">⏱ Este código expira em <strong>5 minutos</strong>.</p>
        </div>
        <div style="padding: 16px; text-align: center; border-radius: 0 0 12px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-top: none;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">Guarutoner Sistema © ${new Date().getFullYear()}</p>
        </div>
      </div>`
    );

    return res.json({ sucesso: true, reqOtp: true, mensagem: 'Código de verificação enviado para seu e-mail.' });

  } catch (err) {
    console.error('[ERRO] Cadastro:', err);
    return res.status(500).json({ erros: ['Erro interno do servidor.'] });
  }
});

// POST /verificar-email — Processa o OTP digitado pelo usuário
app.post('/verificar-email', async (req, res) => {
  try {
    const { email, codigo } = req.body;
    if (!email || !codigo) return res.status(400).json({ erro: 'Dados inválidos.' });

    const db = await getDB();
    const emailLimpo = email.trim().toLowerCase();

    const user = await db.get('SELECT * FROM users WHERE email = ?', [emailLimpo]);
    if (!user) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    if (user.email_verificado) return res.status(400).json({ erro: 'E-mail já verificado.' });

    // Verificar código e expiração
    if (user.codigo_verificacao !== codigo.trim()) {
      return res.status(400).json({ erro: 'Código inválido. Verifique e tente novamente.' });
    }

    if (new Date() > new Date(user.expiracao_codigo)) {
      return res.status(400).json({ erro: 'Código expirado. Solicite um novo código.' });
    }

    // Marcar e-mail como verificado
    await db.run('UPDATE users SET email_verificado = 1, codigo_verificacao = NULL, expiracao_codigo = NULL WHERE email = ?', [emailLimpo]);

    // Criar notificação para o admin
    const notifId = uuidv4();
    await db.run(`
      INSERT INTO notificacoes (id, tipo, usuario_id, nome_usuario, email_usuario, mensagem, status, data_criacao)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      notifId,
      'novo_usuario',
      user.id,
      user.nome,
      emailLimpo,
      'Novo usuário aguardando aprovação',
      'pendente',
      new Date().toISOString()
    ]);

    console.log(`  [OTP] ✅ E-mail verificado com sucesso: ${emailLimpo}`);
    console.log(`  [NOTIF] 🔔 Notificação criada para admin: ${user.nome} (${emailLimpo})`);

    return res.json({ sucesso: true, mensagem: 'E-mail verificado! Sua conta aguarda aprovação do administrador.' });
  } catch (err) {
    console.error('[ERRO] Verificação OTP:', err);
    return res.status(500).json({ erro: 'Erro interno.' });
  }
});

// POST /resend-otp — Reenviar código OTP
app.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ erro: 'E-mail não fornecido.' });

    const db = await getDB();
    const emailLimpo = email.trim().toLowerCase();

    const user = await db.get('SELECT * FROM users WHERE email = ?', [emailLimpo]);
    if (!user) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    if (user.email_verificado) return res.status(400).json({ erro: 'E-mail já verificado.' });

    const codigoVerificacao = Math.floor(100000 + Math.random() * 900000).toString();
    const expCodigo = new Date(Date.now() + 5 * 60000).toISOString(); // 5 minutos

    await db.run('UPDATE users SET codigo_verificacao = ?, expiracao_codigo = ? WHERE email = ?', [codigoVerificacao, expCodigo, emailLimpo]);

    console.log(`  [OTP] 📩 Código reenviado para: ${emailLimpo} - OTP: ${codigoVerificacao}`);

    await enviarEmail(
      emailLimpo,
      'Reenvio: Código de Verificação — Guarutoner',
      `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #00154d, #00277f); padding: 28px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">Guarutoner</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; text-align: center;">
          <h2 style="color: #00154d; margin-bottom: 12px;">Novo Código de Verificação</h2>
          <p style="color: #334155; font-size: 14px; margin-bottom: 24px;">Você solicitou o reenvio do código. Use o código abaixo:</p>
          <div style="font-size: 36px; font-weight: bold; letter-spacing: 10px; margin: 20px 0; color: #00154d; background: #f1f5f9; display: inline-block; padding: 16px 32px; border-radius: 12px; border: 2px dashed #cbd5e1;">${codigoVerificacao}</div>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 20px;">⏱ Este código expira em <strong>5 minutos</strong>.</p>
        </div>
        <div style="padding: 16px; text-align: center; border-radius: 0 0 12px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-top: none;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">Guarutoner Sistema © ${new Date().getFullYear()}</p>
        </div>
      </div>`
    );

    return res.json({ sucesso: true, mensagem: 'Um novo código foi enviado para seu e-mail.' });
  } catch (err) {
    console.error('[ERRO] Reenvio OTP:', err);
    return res.status(500).json({ erro: 'Erro ao reenviar o código.' });
  }
});

// POST /auth/login — Login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });

    const db = await getDB();
    const emailLimpo = email.trim().toLowerCase();

    const usuario = await db.get('SELECT * FROM users WHERE email = ?', [emailLimpo]);

    if (!usuario) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });

    const senhaOk = await bcrypt.compare(senha, usuario.senha);
    if (!senhaOk) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });

    if (usuario.email_verificado === 0) {
      return res.status(403).json({ erro: 'Seu e-mail ainda não foi verificado. Verifique antes de logar.', status: 'nao_verificado' });
    }

    if (usuario.status === 'rejeitado') {
      return res.status(403).json({ erro: 'Sua solicitação de acesso foi recusada pelo administrador.', status: 'rejeitado' });
    }

    if (usuario.status === 'pendente') {
      return res.status(403).json({ erro: 'Sua conta ainda está aguardando aprovação do administrador.', status: 'pendente' });
    }

    console.log(`  [LOGIN] ✅ ${usuario.nome} (${emailLimpo}) → ${usuario.tipo}`);

    return res.json({
      sucesso: true,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo
      }
    });

  } catch (err) {
    console.error('[ERRO] Login:', err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// ============================================================
// ROTAS — ADMINISTRAÇÃO (APROVAÇÕES / NOTIFICAÇÕES)
// ============================================================

// GET /admin/pendentes — Listar contas aguardando aprovação
app.get('/admin/pendentes', async (req, res) => {
  try {
    const adminEmail = req.query.adminEmail;
    if (!adminEmail || adminEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return res.status(403).json({ erro: 'Acesso negado: apenas a administração pode visualizar esta lista.' });
    }

    const db = await getDB();
    const pendentesRows = await db.all("SELECT id, nome, email, tipoDocumento, documento, telefone, empresa, criadoEm FROM users WHERE status = 'pendente' AND email_verificado = 1");

    const pendentes = pendentesRows.map(u => ({
      ...u,
      documento: formatarDocumento(u.documento, u.tipoDocumento)
    }));

    return res.json({ pendentes });
  } catch (err) {
    console.error('[ERRO] Buscar pendentes:', err);
    return res.status(500).json({ erro: 'Erro ao buscar pendentes' });
  }
});

// GET /admin/notificacoes — Listar notificações pendentes
app.get('/admin/notificacoes', async (req, res) => {
  try {
    const adminEmail = req.query.adminEmail;
    if (!adminEmail || adminEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return res.status(403).json({ erro: 'Acesso negado.' });
    }

    const db = await getDB();
    const notificacoes = await db.all("SELECT * FROM notificacoes WHERE status = 'pendente' ORDER BY data_criacao DESC");

    return res.json({ notificacoes, total: notificacoes.length });
  } catch (err) {
    console.error('[ERRO] Buscar notificações:', err);
    return res.status(500).json({ erro: 'Erro ao buscar notificações' });
  }
});

// POST /admin/resolver-conta — Aprovar ou recusar conta
app.post('/admin/resolver-conta', async (req, res) => {
  try {
    const { adminEmail, userId, action } = req.body;

    if (!adminEmail || adminEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return res.status(403).json({ erro: 'Acesso negado: privilégios insuficientes.' });
    }

    const db = await getDB();
    const usuario = await db.get('SELECT * FROM users WHERE id = ?', [userId]);

    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }

    if (action === 'aprovar') {
      // Atualizar status do usuário
      await db.run("UPDATE users SET status = 'aprovado' WHERE id = ?", [userId]);

      // Resolver notificações pendentes deste usuário
      await db.run("UPDATE notificacoes SET status = 'resolvido' WHERE usuario_id = ? AND status = 'pendente'", [userId]);

      console.log(`  [APROVAÇÃO] ✅ "${usuario.nome}" (${usuario.email}) aprovado via painel interno.`);

      // Enviar e-mail de aprovação
      await enviarEmail(
        usuario.email,
        'Sua conta foi aprovada — Guarutoner',
        `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #00154d, #00277f); padding: 28px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #fff; margin: 0; font-size: 22px;">Guarutoner</h1>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
            <h2 style="color: #16a34a; margin-bottom: 12px;">Conta Aprovada!</h2>
            <p style="color: #334155; font-size: 15px; margin-bottom: 24px;">
              Olá, <strong>${usuario.nome}</strong>!<br><br>
              Sua conta foi aprovada com sucesso.<br>
              Você já pode acessar o sistema Guarutoner.
            </p>
            <a href="${BASE_URL}" style="display: inline-block; background: linear-gradient(135deg, #00154d, #00277f); color: #fff; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(0,21,77,0.3);">Acessar o Sistema</a>
          </div>
          <div style="padding: 16px; text-align: center; border-radius: 0 0 12px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-top: none;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">Guarutoner Sistema © ${new Date().getFullYear()}</p>
          </div>
        </div>`
      );

      return res.json({ sucesso: true, mensagem: 'Conta aprovada com sucesso.' });

    } else if (action === 'recusar') {
      // Mudar status para "rejeitado" (não deleta)
      await db.run("UPDATE users SET status = 'rejeitado' WHERE id = ?", [userId]);

      // Resolver notificações pendentes deste usuário
      await db.run("UPDATE notificacoes SET status = 'resolvido' WHERE usuario_id = ? AND status = 'pendente'", [userId]);

      console.log(`  [RECUSA] ❌ "${usuario.nome}" (${usuario.email}) rejeitado via painel interno.`);

      // Enviar e-mail de rejeição
      await enviarEmail(
        usuario.email,
        'Solicitação de acesso — Guarutoner',
        `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #00154d, #00277f); padding: 28px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #fff; margin: 0; font-size: 22px;">Guarutoner</h1>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
            <h2 style="color: #dc2626; margin-bottom: 12px;">Solicitação Não Aprovada</h2>
            <p style="color: #334155; font-size: 15px; margin-bottom: 24px;">
              Olá, <strong>${usuario.nome}</strong>.<br><br>
              Infelizmente sua solicitação de acesso ao sistema Guarutoner não foi aprovada neste momento.<br><br>
              Caso acredite que houve um engano, entre em contato com a administração.
            </p>
          </div>
          <div style="padding: 16px; text-align: center; border-radius: 0 0 12px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-top: none;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">Guarutoner Sistema © ${new Date().getFullYear()}</p>
          </div>
        </div>`
      );

      return res.json({ sucesso: true, mensagem: 'Conta recusada. O usuário foi notificado por e-mail.' });

    } else {
      return res.status(400).json({ erro: 'Ação inválida.' });
    }
  } catch (err) {
    console.error('[ERRO] Resolver conta:', err);
    return res.status(500).json({ erro: 'Erro ao resolver conta' });
  }
});

// GET /aprovar — Aprovar conta via link (legado — corrigido para usar DB)
app.get('/aprovar', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.send(paginaHTML('❌', 'Parâmetro Inválido', 'E-mail não informado na URL.', '#dc2626'));
    }

    const emailLimpo = email.trim().toLowerCase();
    const db = await getDB();
    const usuario = await db.get('SELECT * FROM users WHERE email = ?', [emailLimpo]);

    if (!usuario) {
      return res.send(paginaHTML('❌', 'Usuário Não Encontrado', 'O e-mail informado não possui cadastro no sistema.', '#dc2626'));
    }

    if (usuario.status === 'aprovado') {
      return res.send(paginaHTML('ℹ️', 'Conta Já Aprovada', `A conta de <strong>${usuario.nome}</strong> já foi aprovada anteriormente.`, '#00154d'));
    }

    // Aprovar a conta
    await db.run("UPDATE users SET status = 'aprovado' WHERE id = ?", [usuario.id]);

    // Resolver notificações
    await db.run("UPDATE notificacoes SET status = 'resolvido' WHERE usuario_id = ? AND status = 'pendente'", [usuario.id]);

    console.log(`\n  [APROVAÇÃO] ✅ "${usuario.nome}" (${emailLimpo}) — aprovado via link\n`);

    // Enviar e-mail de confirmação ao usuário
    await enviarEmail(
      emailLimpo,
      'Sua conta foi aprovada — Guarutoner',
      `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #00154d, #00277f); padding: 28px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">Guarutoner</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
          <h2 style="color: #16a34a; margin-bottom: 12px;">Conta Aprovada!</h2>
          <p style="color: #334155; font-size: 15px; margin-bottom: 24px;">
            Olá, <strong>${usuario.nome}</strong>!<br><br>
            Sua conta foi aprovada com sucesso.<br>
            Agora você já pode acessar o sistema Guarutoner.
          </p>
          <a href="${BASE_URL}" style="display: inline-block; background: linear-gradient(135deg, #00154d, #00277f); color: #fff; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(0,21,77,0.3);">Acessar o Sistema</a>
        </div>
        <div style="padding: 16px; text-align: center; border-radius: 0 0 12px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-top: none;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">Guarutoner Sistema © ${new Date().getFullYear()}</p>
        </div>
      </div>`
    );

    return res.send(paginaHTML(
      '✅',
      'Conta Aprovada com Sucesso!',
      `<strong>${usuario.nome}</strong><br><span style="color:#64748b">${emailLimpo}</span><br><br>O usuário receberá um e-mail de confirmação e já pode acessar o sistema.`,
      '#16a34a'
    ));

  } catch (err) {
    console.error('[ERRO] Aprovação:', err);
    return res.status(500).send(paginaHTML('⚠️', 'Erro Interno', 'Ocorreu um erro ao processar a aprovação.', '#dc2626'));
  }
});

// Função auxiliar para gerar página HTML de status
function paginaHTML(emoji, titulo, mensagem, cor) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo} — Guarutoner</title>
  <link rel="icon" href="/icons/logo.jpg">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', sans-serif;
      display: flex; justify-content: center; align-items: center;
      min-height: 100vh; background: #f8fafc;
    }
    .card {
      text-align: center; padding: 48px 40px; background: white;
      border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.08);
      max-width: 480px; width: 90%; border: 1px solid #e2e8f0;
      animation: fadeUp 0.5s ease;
    }
    .emoji { font-size: 56px; margin-bottom: 20px; }
    h2 { color: ${cor}; margin-bottom: 14px; font-size: 22px; }
    p { color: #334155; font-size: 15px; line-height: 1.6; }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="emoji">${emoji}</div>
    <h2>${titulo}</h2>
    <p>${mensagem}</p>
  </div>
</body>
</html>`;
}

// ============================================================
// ROTA DE TESTE DE E-MAIL
// ============================================================
app.get('/test-email', async (req, res) => {
  try {
    const destino = process.env.SMTP_USER;
    if (!destino) {
      return res.status(500).json({ erro: 'SMTP_USER não configurado no .env' });
    }

    console.log(`  [TEST-EMAIL] 📧 Enviando e-mail de teste para: ${destino}`);

    const sucesso = await enviarEmail(
      destino,
      'Teste de E-mail — Guarutoner',
      `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #00154d, #00277f); padding: 28px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">Guarutoner</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 16px;">📧</div>
          <h2 style="color: #00154d; margin-bottom: 12px;">Teste de E-mail</h2>
          <p style="color: #334155; font-size: 15px;">Este é um e-mail de teste do sistema Guarutoner.</p>
          <p style="color: #334155; font-size: 14px; margin-top: 12px;">Se você recebeu este e-mail, o SMTP está funcionando corretamente! ✅</p>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">Enviado em: ${new Date().toLocaleString('pt-BR')}</p>
        </div>
        <div style="padding: 16px; text-align: center; border-radius: 0 0 12px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-top: none;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">Guarutoner Sistema © ${new Date().getFullYear()}</p>
        </div>
      </div>`
    );

    if (sucesso) {
      return res.json({ sucesso: true, mensagem: `E-mail de teste enviado com sucesso para ${destino}` });
    } else {
      return res.status(500).json({ erro: 'Falha ao enviar e-mail de teste. Verifique os logs do servidor.' });
    }
  } catch (err) {
    console.error('[ERRO] Teste de e-mail:', err);
    return res.status(500).json({ erro: 'Erro ao enviar e-mail de teste.' });
  }
});

// ============================================================
// UTILIDADES — DATA
// ============================================================
function hoje() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function agora() {
  return new Date().toISOString();
}

function horaAtual() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ============================================================
// ROTAS — RASTREAMENTO DE TÉCNICOS (DB-BACKED)
// ============================================================

// POST /tecnico/iniciar — Registrar/atualizar presença do técnico no dia
app.post('/tecnico/iniciar', async (req, res) => {
  try {
    const { usuario_id, nome } = req.body;
    if (!usuario_id || !nome) {
      return res.status(400).json({ erro: 'usuario_id e nome são obrigatórios.' });
    }

    const db = await getDB();
    const dataHoje = hoje();

    // Verificar se já existe registro para este usuário HOJE
    const existente = await db.get(
      'SELECT * FROM tecnicos_em_campo WHERE usuario_id = ? AND data_dia = ?',
      [usuario_id, dataHoje]
    );

    if (existente) {
      // Apenas atualizar status — NÃO criar novo registro
      await db.run(
        'UPDATE tecnicos_em_campo SET status = ?, ultima_atualizacao = ? WHERE usuario_id = ? AND data_dia = ?',
        ['online', agora(), usuario_id, dataHoje]
      );
      console.log(`  [TRACKING] ♻️ Técnico reconectado: "${nome}" (${usuario_id})`);
      return res.json({ sucesso: true, tecnicoId: existente.id, reconectado: true });
    }

    // Limpar registros de dias anteriores deste usuário
    await db.run('DELETE FROM tecnicos_em_campo WHERE usuario_id = ? AND data_dia != ?', [usuario_id, dataHoje]);

    // Criar registro ÚNICO para o dia
    const tecnicoId = uuidv4();
    await db.run(`
      INSERT INTO tecnicos_em_campo (id, usuario_id, nome, rota, cliente_atual, indice_atual, status, em_rota, latitude, longitude, ultima_atualizacao, data_dia)
      VALUES (?, ?, ?, '[]', NULL, 0, 'online', 0, NULL, NULL, ?, ?)
    `, [tecnicoId, usuario_id, nome, agora(), dataHoje]);

    console.log(`  [TRACKING] ✅ Técnico registrado: "${nome}" (${usuario_id}) → ${tecnicoId}`);
    return res.json({ sucesso: true, tecnicoId, reconectado: false });

  } catch (err) {
    console.error('[ERRO] Iniciar técnico:', err);
    return res.status(500).json({ erro: 'Erro interno.' });
  }
});

// POST /tecnico/location — Atualizar localização (GPS a cada 5s)
app.post('/tecnico/location', async (req, res) => {
  try {
    const { usuario_id, latitude, longitude, status, clienteAtual, listaClientes, indiceAtual, emRota } = req.body;

    if (!usuario_id) {
      return res.status(400).json({ erro: 'usuario_id é obrigatório.' });
    }

    const db = await getDB();
    const dataHoje = hoje();

    // Atualizar registro existente — NUNCA criar novo
    const result = await db.run(`
      UPDATE tecnicos_em_campo SET
        latitude = COALESCE(?, latitude),
        longitude = COALESCE(?, longitude),
        status = COALESCE(?, status),
        cliente_atual = ?,
        rota = ?,
        indice_atual = COALESCE(?, indice_atual),
        em_rota = COALESCE(?, em_rota),
        ultima_atualizacao = ?
      WHERE usuario_id = ? AND data_dia = ?
    `, [
      latitude, longitude, status,
      clienteAtual || null,
      JSON.stringify(listaClientes || []),
      indiceAtual != null ? indiceAtual : null,
      emRota != null ? (emRota ? 1 : 0) : null,
      agora(),
      usuario_id, dataHoje
    ]);

    if (result.changes === 0) {
      return res.status(404).json({ erro: 'Técnico não encontrado para hoje. Reinicie a sessão.' });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[ERRO] Location:', err);
    return res.status(500).json({ erro: 'Erro interno.' });
  }
});

// POST /tecnico/iniciar-rota — Técnico inicia rota (salva relatório)
app.post('/tecnico/iniciar-rota', async (req, res) => {
  try {
    const { usuario_id, nome, rota } = req.body;
    if (!usuario_id || !rota || !rota.length) {
      return res.status(400).json({ erro: 'Dados incompletos.' });
    }

    const db = await getDB();
    const dataHoje = hoje();

    // Atualizar técnico em campo
    await db.run(`
      UPDATE tecnicos_em_campo SET em_rota = 1, rota = ?, indice_atual = 0, cliente_atual = ?, ultima_atualizacao = ?
      WHERE usuario_id = ? AND data_dia = ?
    `, [JSON.stringify(rota), rota[0], agora(), usuario_id, dataHoje]);

    // Criar relatório do dia (se não existir)
    const relExistente = await db.get(
      'SELECT id FROM relatorios WHERE usuario_id = ? AND data = ?',
      [usuario_id, dataHoje]
    );

    if (!relExistente) {
      await db.run(`
        INSERT INTO relatorios (id, usuario_id, nome, data, hora_inicio, rota, total_clientes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [uuidv4(), usuario_id, nome || 'Técnico', dataHoje, horaAtual(), JSON.stringify(rota), rota.length]);
    } else {
      // Atualizar rota se já existia relatório
      await db.run(`
        UPDATE relatorios SET rota = ?, total_clientes = ?, hora_inicio = COALESCE(hora_inicio, ?)
        WHERE usuario_id = ? AND data = ?
      `, [JSON.stringify(rota), rota.length, horaAtual(), usuario_id, dataHoje]);
    }

    console.log(`  [ROTA] 🚀 "${nome}" iniciou rota com ${rota.length} clientes`);
    return res.json({ sucesso: true });
  } catch (err) {
    console.error('[ERRO] Iniciar rota:', err);
    return res.status(500).json({ erro: 'Erro interno.' });
  }
});

// POST /tecnico/finalizar-rota — Técnico finaliza rota
app.post('/tecnico/finalizar-rota', async (req, res) => {
  try {
    const { usuario_id, clientesAtendidos } = req.body;
    if (!usuario_id) {
      return res.status(400).json({ erro: 'usuario_id é obrigatório.' });
    }

    const db = await getDB();
    const dataHoje = hoje();

    // Atualizar técnico em campo
    await db.run(`
      UPDATE tecnicos_em_campo SET em_rota = 0, rota = '[]', cliente_atual = NULL, indice_atual = 0, status = 'online', ultima_atualizacao = ?
      WHERE usuario_id = ? AND data_dia = ?
    `, [agora(), usuario_id, dataHoje]);

    // Atualizar relatório com hora_fim e contagem
    await db.run(`
      UPDATE relatorios SET hora_fim = ?, clientes_atendidos = ?
      WHERE usuario_id = ? AND data = ?
    `, [horaAtual(), clientesAtendidos || 0, usuario_id, dataHoje]);

    const tecnico = await db.get('SELECT nome FROM tecnicos_em_campo WHERE usuario_id = ?', [usuario_id]);
    console.log(`  [ROTA] 🏁 "${tecnico?.nome || usuario_id}" finalizou rota (${clientesAtendidos || 0} atendimentos)`);

    return res.json({ sucesso: true });
  } catch (err) {
    console.error('[ERRO] Finalizar rota:', err);
    return res.status(500).json({ erro: 'Erro interno.' });
  }
});

// GET /tecnicos — Listar técnicos do dia atual (sem duplicatas)
app.get('/tecnicos', async (req, res) => {
  try {
    const db = await getDB();
    const dataHoje = hoje();

    const tecnicos = await db.all(
      'SELECT * FROM tecnicos_em_campo WHERE data_dia = ? ORDER BY ultima_atualizacao DESC',
      [dataHoje]
    );

    const lista = tecnicos.map(t => ({
      tecnicoId: t.id,
      usuario_id: t.usuario_id,
      nome: t.nome,
      listaClientes: JSON.parse(t.rota || '[]'),
      clienteAtual: t.cliente_atual,
      indiceAtual: t.indice_atual,
      status: t.status,
      emRota: t.em_rota === 1,
      localizacao: { lat: t.latitude, lng: t.longitude },
      ultimoUpdate: t.ultima_atualizacao
    }));

    return res.json({ total: lista.length, tecnicos: lista });
  } catch (err) {
    console.error('[ERRO] Listar técnicos:', err);
    return res.status(500).json({ erro: 'Erro interno.' });
  }
});

// GET /admin/relatorios — Listar relatórios (com filtros)
app.get('/admin/relatorios', async (req, res) => {
  try {
    const { adminEmail, data } = req.query;

    if (!adminEmail || adminEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return res.status(403).json({ erro: 'Acesso negado.' });
    }

    const db = await getDB();

    let relatorios;
    if (data) {
      relatorios = await db.all(
        'SELECT * FROM relatorios WHERE data = ? ORDER BY hora_inicio ASC',
        [data]
      );
    } else {
      // Últimos 30 dias
      relatorios = await db.all(
        'SELECT * FROM relatorios ORDER BY data DESC, hora_inicio ASC LIMIT 200'
      );
    }

    const lista = relatorios.map(r => ({
      ...r,
      rota: JSON.parse(r.rota || '[]')
    }));

    // Agrupar por dia
    const porDia = {};
    lista.forEach(r => {
      if (!porDia[r.data]) porDia[r.data] = [];
      porDia[r.data].push(r);
    });

    return res.json({ relatorios: lista, porDia });
  } catch (err) {
    console.error('[ERRO] Relatórios:', err);
    return res.status(500).json({ erro: 'Erro interno.' });
  }
});

// ============================================================
// ROTAS — HISTÓRICO DE ATENDIMENTOS (NOVO — INCREMENTAL)
// ============================================================

// POST /tecnico/concluir-atendimento — Registrar atendimento concluído
app.post('/tecnico/concluir-atendimento', async (req, res) => {
  try {
    const { usuario_id, nome_tecnico, nome_cliente, rota_id } = req.body;
    if (!usuario_id || !nome_tecnico || !nome_cliente) {
      return res.status(400).json({ erro: 'Dados incompletos.' });
    }

    const db = await getDB();
    const dataHoje = hoje();
    const horaAgora = horaAtual();
    const id = uuidv4();

    await db.run(`
      INSERT INTO historico_atendimentos (id, tecnico_id, nome_tecnico, nome_cliente, data, hora, rota_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, usuario_id, nome_tecnico, nome_cliente, dataHoje, horaAgora, rota_id || null]);

    console.log(`  [HISTÓRICO] ✅ Atendimento registrado: "${nome_tecnico}" → "${nome_cliente}" às ${horaAgora}`);
    return res.json({ sucesso: true, id });
  } catch (err) {
    console.error('[ERRO] Concluir atendimento:', err);
    return res.status(500).json({ erro: 'Erro interno.' });
  }
});

// GET /admin/historico-atendimentos — Listar histórico agrupado por data/técnico
app.get('/admin/historico-atendimentos', async (req, res) => {
  try {
    const { adminEmail, data } = req.query;

    if (!adminEmail || adminEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return res.status(403).json({ erro: 'Acesso negado.' });
    }

    const db = await getDB();

    let registros;
    if (data) {
      registros = await db.all(
        'SELECT * FROM historico_atendimentos WHERE data = ? ORDER BY hora ASC',
        [data]
      );
    } else {
      registros = await db.all(
        'SELECT * FROM historico_atendimentos ORDER BY data DESC, hora ASC LIMIT 500'
      );
    }

    // Agrupar por data → técnico
    const porDia = {};
    registros.forEach(r => {
      if (!porDia[r.data]) porDia[r.data] = {};
      if (!porDia[r.data][r.tecnico_id]) {
        porDia[r.data][r.tecnico_id] = {
          tecnico_id: r.tecnico_id,
          nome_tecnico: r.nome_tecnico,
          atendimentos: []
        };
      }
      porDia[r.data][r.tecnico_id].atendimentos.push({
        id: r.id,
        nome_cliente: r.nome_cliente,
        hora: r.hora,
        rota_id: r.rota_id
      });
    });

    return res.json({ registros, porDia });
  } catch (err) {
    console.error('[ERRO] Histórico atendimentos:', err);
    return res.status(500).json({ erro: 'Erro interno.' });
  }
});

// GET /admin/equipe — Listar equipe com contagem de atendimentos
app.get('/admin/equipe', async (req, res) => {
  try {
    const { adminEmail } = req.query;

    if (!adminEmail || adminEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return res.status(403).json({ erro: 'Acesso negado.' });
    }

    const db = await getDB();

    // Buscar usuários aprovados (sem duplicatas — por ID único)
    const usuarios = await db.all(
      "SELECT id, nome, email, tipo FROM users WHERE status = 'aprovado' ORDER BY nome ASC"
    );

    // Para cada técnico, contar atendimentos no histórico
    const equipe = [];
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

    return res.json({ equipe });
  } catch (err) {
    console.error('[ERRO] Equipe:', err);
    return res.status(500).json({ erro: 'Erro interno.' });
  }
});

// ============================================================
// RESET DIÁRIO AUTOMÁTICO (00:00)
// ============================================================
let ultimoDiaVerificado = hoje();

function verificarResetDiario() {
  const diaAtual = hoje();
  if (diaAtual !== ultimoDiaVerificado) {
    console.log(`\n  [RESET] 🔄 Novo dia detectado: ${diaAtual}`);
    console.log(`  [RESET] Limpando técnicos do dia anterior (${ultimoDiaVerificado})...`);
    ultimoDiaVerificado = diaAtual;

    getDB().then(async db => {
      // Relatórios de técnicos que ficaram sem hora_fim
      await db.run(`
        UPDATE relatorios SET hora_fim = '23:59:59'
        WHERE data = ? AND hora_fim IS NULL
      `, [diaAtual === hoje() ? '' : ultimoDiaVerificado]);

      // Limpar registros antigos
      const deleted = await db.run(
        'DELETE FROM tecnicos_em_campo WHERE data_dia != ?',
        [diaAtual]
      );

      console.log(`  [RESET] ✅ ${deleted.changes || 0} registros antigos removidos.\n`);
    }).catch(err => console.error('[ERRO] Reset diário:', err));
  }
}

// Verificar a cada minuto
setInterval(verificarResetDiario, 60000);

// GET /health
app.get('/health', async (req, res) => {
  try {
    const db = await getDB();
    const countUsers = await db.get('SELECT COUNT(*) as c FROM users');
    const countNotif = await db.get("SELECT COUNT(*) as c FROM notificacoes WHERE status = 'pendente'");
    const countTecnicos = await db.get(
      'SELECT COUNT(*) as c FROM tecnicos_em_campo WHERE data_dia = ?',
      [hoje()]
    );
    const countRelatorios = await db.get('SELECT COUNT(*) as c FROM relatorios');

    res.json({
      status: 'online',
      diaAtual: hoje(),
      tecnicosHoje: countTecnicos.c,
      usuariosDB: countUsers.c,
      notificacoesPendentes: countNotif.c,
      totalRelatorios: countRelatorios.c
    });
  } catch (err) {
    res.status(500).json({ erro: 'Error DB' });
  }
});

// ============================================================
// INICIAR
// ============================================================
async function iniciar() {
  await initDB();

  // Limpar técnicos de dias anteriores ao iniciar
  const db = await getDB();
  const deleted = await db.run('DELETE FROM tecnicos_em_campo WHERE data_dia != ?', [hoje()]);
  if (deleted.changes > 0) {
    console.log(`  🧹 ${deleted.changes} registros de dias anteriores removidos.`);
  }

  app.listen(PORT, () => {
    console.log(`\n  ════════════════════════════════════════════`);
    console.log(`  ║  GUARUTONER — Servidor Ativo             ║`);
    console.log(`  ════════════════════════════════════════════`);
    console.log(`  🌐 Sistema  → ${BASE_URL}`);
    console.log(`  📱 Técnico  → ${BASE_URL}/tecnico.html`);
    console.log(`  📊 Gestor   → ${BASE_URL}/gestor.html`);
    console.log(`  📧 Admin    → ${ADMIN_EMAIL}`);
    console.log(`  🧪 Teste    → ${BASE_URL}/test-email`);
    console.log(`  📅 Dia      → ${hoje()}`);
    console.log(`  ════════════════════════════════════════════\n`);
  });
}

if (require.main === module) {
  iniciar();
}

module.exports = app;

