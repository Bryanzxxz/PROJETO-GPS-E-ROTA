// ============================================================
// GUARUTONER — LOGIN + CADASTRO
// ============================================================

const API = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

document.addEventListener('DOMContentLoaded', () => {

  // ============================================================
  // DOM ELEMENTS
  // ============================================================
  const viewLogin = document.getElementById('viewLogin');
  const viewCadastro = document.getElementById('viewCadastro');
  const viewOTP = document.getElementById('viewOTP');
  const viewSucesso = document.getElementById('viewSucesso');

  // Login
  const loginEmail = document.getElementById('loginEmail');
  const loginSenha = document.getElementById('loginSenha');
  const btnLogin = document.getElementById('btnLogin');

  // Cadastro
  const cadNome = document.getElementById('cadNome');
  const cadEmail = document.getElementById('cadEmail');
  const cadTipo = document.getElementById('cadTipo');
  const cadDocumento = document.getElementById('cadDocumento');
  const cadSenha = document.getElementById('cadSenha');
  const cadConfirmar = document.getElementById('cadConfirmar');
  const cadTelefone = document.getElementById('cadTelefone');
  const cadEmpresa = document.getElementById('cadEmpresa');
  const btnCadastro = document.getElementById('btnCadastro');
  const btnDocCPF = document.getElementById('btnDocCPF');
  const btnDocCNPJ = document.getElementById('btnDocCNPJ');

  // Tipo de documento selecionado
  let tipoDocumento = 'cpf';

  // Navigation
  const linkCadastro = document.getElementById('linkCadastro');
  const linkLogin = document.getElementById('linkLogin');
  const linkVoltarLogin = document.getElementById('linkVoltarLogin');

  // ============================================================
  // VIEW SWITCHING
  // ============================================================
  function showView(view) {
    [viewLogin, viewCadastro, viewOTP, viewSucesso].forEach(v => v.classList.remove('active'));
    view.classList.add('active');
    clearAllErrors();
  }

  document.getElementById('linkCadastro').addEventListener('click', (e) => {
    e.preventDefault();
    clearAllErrors();
    showView(viewCadastro);
  });
  document.getElementById('linkLogin').addEventListener('click', (e) => {
    e.preventDefault();
    clearAllErrors();
    showView(viewLogin);
  });
  document.getElementById('linkVoltarLogin').addEventListener('click', (e) => {
    e.preventDefault();
    showView(viewLogin);
  });
  document.getElementById('linkBackLoginFromOtp').addEventListener('click', (e) => {
    e.preventDefault();
    showView(viewLogin);
  });

  // ============================================================
  // PASSWORD TOGGLES
  // ============================================================
  function setupPasswordToggle(btnId, inputId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;

    btn.addEventListener('click', () => {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.querySelector('.eye-open').style.display = isPassword ? 'none' : '';
      btn.querySelector('.eye-closed').style.display = isPassword ? '' : 'none';
    });
  }

  setupPasswordToggle('toggleLoginSenha', 'loginSenha');
  setupPasswordToggle('toggleCadSenha', 'cadSenha');
  setupPasswordToggle('toggleCadConfirmar', 'cadConfirmar');

  // ============================================================
  // DOCUMENT TYPE TOGGLE (CPF / CNPJ)
  // ============================================================
  function setDocType(tipo) {
    tipoDocumento = tipo;
    cadDocumento.value = '';
    clearError('cadDocumento');
    if (tipo === 'cpf') {
      cadDocumento.placeholder = '000.000.000-00';
      cadDocumento.maxLength = 14;
      btnDocCPF.classList.add('active');
      btnDocCNPJ.classList.remove('active');
    } else {
      cadDocumento.placeholder = '00.000.000/0000-00';
      cadDocumento.maxLength = 18;
      btnDocCPF.classList.remove('active');
      btnDocCNPJ.classList.add('active');
    }
    cadDocumento.focus();
  }

  btnDocCPF.addEventListener('click', () => setDocType('cpf'));
  btnDocCNPJ.addEventListener('click', () => setDocType('cnpj'));

  // ============================================================
  // INPUT MASKS
  // ============================================================
  function mascaraCPF(v) {
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 9) {
      v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    } else if (v.length > 6) {
      v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    } else if (v.length > 3) {
      v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    }
    return v;
  }

  function mascaraCNPJ(v) {
    if (v.length > 14) v = v.slice(0, 14);
    if (v.length > 12) {
      v = v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, '$1.$2.$3/$4-$5');
    } else if (v.length > 8) {
      v = v.replace(/(\d{2})(\d{3})(\d{3})(\d{1,4})/, '$1.$2.$3/$4');
    } else if (v.length > 5) {
      v = v.replace(/(\d{2})(\d{3})(\d{1,3})/, '$1.$2.$3');
    } else if (v.length > 2) {
      v = v.replace(/(\d{2})(\d{1,3})/, '$1.$2');
    }
    return v;
  }

  cadDocumento.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '');
    e.target.value = tipoDocumento === 'cpf' ? mascaraCPF(v) : mascaraCNPJ(v);
  });

  cadTelefone.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 6) {
      v = v.replace(/(\d{2})(\d{4,5})(\d{1,4})/, '($1) $2-$3');
    } else if (v.length > 2) {
      v = v.replace(/(\d{2})(\d{1,5})/, '($1) $2');
    } else if (v.length > 0) {
      v = v.replace(/(\d{1,2})/, '($1');
    }
    e.target.value = v;
  });

  // ============================================================
  // VALIDATION HELPERS
  // ============================================================
  function showError(fieldId, message) {
    const errEl = document.getElementById('err' + capitalize(fieldId));
    const input = document.getElementById(fieldId);
    if (errEl) {
      errEl.textContent = message;
      errEl.classList.add('visible');
    }
    if (input) input.classList.add('input-error');
  }

  function clearError(fieldId) {
    const errEl = document.getElementById('err' + capitalize(fieldId));
    const input = document.getElementById(fieldId);
    if (errEl) {
      errEl.textContent = '';
      errEl.classList.remove('visible');
    }
    if (input) input.classList.remove('input-error', 'input-success');
  }

  function clearAllErrors() {
    document.querySelectorAll('.field-error').forEach(el => {
      el.textContent = '';
      el.classList.remove('visible');
    });
    document.querySelectorAll('.input-error').forEach(el => {
      el.classList.remove('input-error');
    });
    document.querySelectorAll('.input-success').forEach(el => {
      el.classList.remove('input-success');
    });
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function validarEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

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

  function validarDocumento(valor) {
    return tipoDocumento === 'cpf' ? validarCPF(valor) : validarCNPJ(valor);
  }

  // ============================================================
  // LOADING STATE
  // ============================================================
  function setLoading(btn, loading) {
    const text = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.btn-loader');
    if (loading) {
      text.style.opacity = '0';
      loader.style.display = '';
      btn.disabled = true;
    } else {
      text.style.opacity = '1';
      loader.style.display = 'none';
      btn.disabled = false;
    }
  }

  // ============================================================
  // LOGIN
  // ============================================================
  async function handleLogin() {
    clearAllErrors();
    let hasError = false;

    const email = loginEmail.value.trim();
    const senha = loginSenha.value;

    if (!email) {
      showError('loginEmail', 'E-mail é obrigatório.');
      hasError = true;
    }
    if (!senha) {
      showError('loginSenha', 'Senha é obrigatória.');
      hasError = true;
    }

    if (hasError) return;

    setLoading(btnLogin, true);

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha })
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.status === 'pendente') {
          showToast(data.erro, 'err');
        } else if (data.status === 'rejeitado') {
          showToast(data.erro, 'err');
        } else if (data.status === 'nao_verificado') {
          window.tempRegisterEmail = email;
          showView(viewOTP);
          startResendTimer();
          showToast(data.erro, 'err');
        } else {
          showError('loginEmail', data.erro);
          showError('loginSenha', data.erro);
        }
        return;
      }

      const userData = {
        id: data.usuario.id,
        nome: data.usuario.nome,
        email: data.usuario.email,
        tipo: data.usuario.tipo,
        loginTime: new Date().toISOString()
      };

      // Salvar sessão no localStorage por tipo de conta (evitar conflito entre abas)
      const storageKey = data.usuario.tipo === 'gestor' ? 'guarutoner_gestor' : 'guarutoner_tecnico';
      localStorage.setItem(storageKey, JSON.stringify(userData));
      showToast(`Bem-vindo, ${data.usuario.nome}!`, 'ok');

      // Usar window.location.href ao invés de window.open para evitar
      // bloqueio de popup no iOS Safari. window.open('...', '_blank')
      // dentro de setTimeout é tratado como popup e silenciosamente bloqueado.
      const destino = data.usuario.tipo === 'gestor' ? 'gestor.html' : 'tecnico.html';

      setTimeout(() => {
        window.location.href = destino;
      }, 500);

    } catch (err) {
      showToast('Erro de conexão com o servidor.', 'err');
    } finally {
      setLoading(btnLogin, false);
    }
  }

  btnLogin.addEventListener('click', handleLogin);
  loginSenha.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });
  loginEmail.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });

  // ============================================================
  // CADASTRO
  // ============================================================
  async function handleCadastro() {
    clearAllErrors();
    let hasError = false;

    const nome = cadNome.value.trim();
    const email = cadEmail.value.trim();
    const tipoConta = cadTipo.value;
    const documento = cadDocumento.value;
    const senha = cadSenha.value;
    const confirmar = cadConfirmar.value;
    const telefone = cadTelefone.value;
    const empresa = cadEmpresa.value.trim();

    if (!nome) {
      showError('cadNome', 'Nome é obrigatório.');
      hasError = true;
    }
    if (!email) {
      showError('cadEmail', 'E-mail é obrigatório.');
      hasError = true;
    } else if (!validarEmail(email)) {
      showError('cadEmail', 'Formato de e-mail inválido.');
      hasError = true;
    }
    if (!documento) {
      showError('cadDocumento', 'Documento é obrigatório.');
      hasError = true;
    } else if (!validarDocumento(documento)) {
      showError('cadDocumento', 'Documento inválido.');
      hasError = true;
    }
    if (!senha) {
      showError('cadSenha', 'Senha é obrigatória.');
      hasError = true;
    } else if (senha.length < 6) {
      showError('cadSenha', 'A senha deve ter no mínimo 6 caracteres.');
      hasError = true;
    }
    if (!confirmar) {
      showError('cadConfirmar', 'Confirme a senha.');
      hasError = true;
    } else if (senha !== confirmar) {
      showError('cadConfirmar', 'As senhas não coincidem.');
      hasError = true;
    }

    if (hasError) return;

    setLoading(btnCadastro, true);

    try {
      const res = await fetch(`${API}/cadastro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          email,
          tipoConta,
          tipoDocumento,
          documento: documento.replace(/\D/g, ''),
          senha,
          confirmarSenha: confirmar,
          telefone: telefone || null,
          empresa: empresa || null
        })
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.erros && data.erros.length > 0) {
          data.erros.forEach(erro => showToast(erro, 'err'));
        } else {
          showToast(data.erro || 'Erro ao criar conta.', 'err');
        }
        return;
      }

      cadNome.value = '';
      cadEmail.value = '';
      cadDocumento.value = '';
      cadSenha.value = '';
      cadConfirmar.value = '';
      cadTelefone.value = '';
      cadEmpresa.value = '';
      setDocType('cpf');

      if (data.reqOtp) {
        window.tempRegisterEmail = email;
        showView(viewOTP);
        startResendTimer();
        showToast(data.mensagem, 'info');
      } else {
        document.getElementById('successMsg').textContent = data.mensagem;
        showView(viewSucesso);
        showToast('Conta criada!', 'ok');
      }

    } catch (err) {
      showToast('Erro de conexão com o servidor.', 'err');
    } finally {
      setLoading(btnCadastro, false);
    }
  }

  btnCadastro.addEventListener('click', handleCadastro);
  cadConfirmar.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleCadastro(); });

  // ============================================================
  // VERIFICAR OTP / REENVIAR
  // ============================================================
  let resendInterval = null;

  function startResendTimer() {
    const linkResend = document.getElementById('linkResendOTP');
    const timerText = document.getElementById('resendTimer');
    
    linkResend.style.display = 'none';
    timerText.style.display = 'inline';
    
    let timeLeft = 60;
    timerText.textContent = `(Aguarde ${timeLeft}s)`;
    
    if (resendInterval) clearInterval(resendInterval);
    resendInterval = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(resendInterval);
        timerText.style.display = 'none';
        linkResend.style.display = 'inline';
      } else {
        timerText.textContent = `(Aguarde ${timeLeft}s)`;
      }
    }, 1000);
  }

  document.getElementById('linkResendOTP').addEventListener('click', async (e) => {
    e.preventDefault();
    if (!window.tempRegisterEmail) return;

    try {
      const res = await fetch(`${API}/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: window.tempRegisterEmail })
      });
      const data = await res.json();
      
      if (!res.ok) {
        showToast(data.erro, 'err');
      } else {
        showToast('Novo código enviado!', 'info');
        startResendTimer();
      }
    } catch (err) {
      showToast('Erro de conexão com o servidor.', 'err');
    }
  });
  // ============================================================
  const otpCodigo = document.getElementById('otpCodigo');
  const btnVerificarOTP = document.getElementById('btnVerificarOTP');

  async function handleVerifyOTP() {
    clearError('otpCodigo');
    const codigo = otpCodigo.value.trim();

    if (!codigo || codigo.length !== 6) {
      showError('otpCodigo', 'Insira o código de 6 dígitos.');
      return;
    }

    if (!window.tempRegisterEmail) {
      showToast('Nenhum e-mail registrado na sessão. Volte ao login.', 'err');
      return;
    }

    setLoading(btnVerificarOTP, true);

    try {
      const res = await fetch(`${API}/verificar-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: window.tempRegisterEmail,
          codigo
        })
      });

      const data = await res.json();

      if (!res.ok) {
        showError('otpCodigo', data.erro);
        showToast(data.erro, 'err');
        return;
      }

      document.getElementById('successMsg').textContent = data.mensagem;
      showView(viewSucesso);
      otpCodigo.value = '';

    } catch (err) {
      showToast('Erro de conexão com o servidor.', 'err');
    } finally {
      setLoading(btnVerificarOTP, false);
    }
  }

  btnVerificarOTP.addEventListener('click', handleVerifyOTP);
  otpCodigo.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleVerifyOTP(); });

  // ============================================================
  // REAL-TIME FIELD VALIDATION (on blur)
  // ============================================================
  cadNome.addEventListener('blur', () => {
    clearError('cadNome');
    if (cadNome.value.trim()) cadNome.classList.add('input-success');
    else if (cadNome.value !== '') showError('cadNome', 'Nome é obrigatório.');
  });

  cadEmail.addEventListener('blur', () => {
    clearError('cadEmail');
    const v = cadEmail.value.trim();
    if (v && validarEmail(v)) cadEmail.classList.add('input-success');
    else if (v) showError('cadEmail', 'Formato de e-mail inválido.');
  });

  cadDocumento.addEventListener('blur', () => {
    clearError('cadDocumento');
    const v = cadDocumento.value;
    const label = tipoDocumento === 'cpf' ? 'CPF' : 'CNPJ';
    if (v && validarDocumento(v)) cadDocumento.classList.add('input-success');
    else if (v) showError('cadDocumento', `${label} inválido. Verifique os dígitos.`);
  });

  cadSenha.addEventListener('blur', () => {
    clearError('cadSenha');
    if (cadSenha.value.length >= 6) cadSenha.classList.add('input-success');
    else if (cadSenha.value) showError('cadSenha', 'Mínimo 6 caracteres.');
  });

  cadConfirmar.addEventListener('blur', () => {
    clearError('cadConfirmar');
    if (cadConfirmar.value && cadConfirmar.value === cadSenha.value) cadConfirmar.classList.add('input-success');
    else if (cadConfirmar.value) showError('cadConfirmar', 'As senhas não coincidem.');
  });

  // Clear errors on focus
  ['cadNome', 'cadEmail', 'cadDocumento', 'cadSenha', 'cadConfirmar', 'loginEmail', 'loginSenha'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('focus', () => clearError(id));
    }
  });
});

// ============================================================
// TOAST (global)
// ============================================================
function showToast(msg, type = 'info') {
  const box = document.getElementById('toasts');
  const d = document.createElement('div');
  d.className = `toast-item ${type}`;
  d.textContent = msg;
  box.appendChild(d);
  setTimeout(() => d.remove(), 4000);
}
