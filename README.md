# 🛰️ Guarutoner — Sistema de Rastreamento SaaS

Um sistema profissional e moderno para gerenciar equipes técnicas em campo com rastreamento GPS e mapa em tempo real.

## 🌟 Arquitetura

O sistema é dividido em três camadas integradas:
1.  **Backend:** API Node.js (Express) que mantém o estado da frota na memória.
2.  **Frontend Gestor (Web):** Dashboard estilo SaaS com mapa iterativo utilizando a biblioteca Leaflet de código aberto.
3.  **Frontend Técnico (PWA):** Aplicativo instalável com interface mobile-first, Service Worker e envio passivo contínuo do GPS via `watchPosition`.

## 📁 Estrutura de Arquivos
```
Projeto GPS e ROTA/
├── backend/
│   ├── package.json
│   ├── server.js          # API + Servidor estático
│   └── node_modules/
├── frontend/
│   ├── index.html         # Redirect
│   ├── manifest.json      # Configuração para PWA
│   ├── sw.js              # Service Worker
│   ├── shared.css         # Design system, botões, tema
│   ├── gestor.html/.css/.js    # Dashboard Painel Web
│   ├── tecnico.html/.css/.js   # App PWA mobile
│   └── icons/             # Ícones e Logo
└── README.md              # Documentação
```

## 🚀 Como Executar Localmente

### 1. Iniciar Servidor

Via terminal:
```bash
cd "C:\Users\User\Desktop\Projeto GPS e ROTA\backend"
npm install
node server.js
```

O backend abrirá na porta `3000`.

### 2. Acessar Módulos

As interfaces podem ser acessadas pelo mesmo servidor:

*   **App do Técnico:** `http://localhost:3000/tecnico.html`
*   **Painel do Gestor:** `http://localhost:3000/gestor.html`

*Dica para teste: Em rede local Wi-Fi, descubra seu IP (ex: `192.168.0.100`) e abra no celular acessando `http://192.168.0.100:3000/tecnico.html` para testar o GPS real. Não esqueça de alterar a variável `API` nos arquivos javascript para apontar para seu IP.*

## ⚙️ Regras de Negócio e Funcionalidades

### Técnico
*   **Login Automatizado:** Apenas fornecendo um nome.
*   **GPS Híbrido Automático:** Sem botão de disparar GPS. Ao logar e o aparelho permitir a localização, o sistema chama a API nativa do navegador `watchPosition` a cada atualização contínua e repassa para o servidor silenciosamente.
*   **Roteamento Direto:**
    *   Técnico cria a lista de locais/clientes.
    *   Clica em "Iniciar Rota".
    *   Módulo apenas avança ("Próximo Cliente") até a rota finalizar. O gestor infere os tempos gastos através do histórico e posições.

### Gestor
*   **Atualização 20s:** O painel puxa o json da API a cada 20 segundos e atualiza em tela e no mapa.
*   **Leaflet Maps:** Utiliza cartografia Leaflet acoplada via CDN com mapas visuais do OSM e navegação.
*   **Visão Rápida:** Sidebar esquerda provê as estatísticas ao vivo da equipe alocada em campo e livre.

## 🌐 Deploy em Produção (Render/Vercel)

1.  Hospede o conteúdo inteiro em um repositório Git.
2.  **Backend (Ex: Render.com):** Crie um *Web Service*, configure o *Build Command* para `cd backend && npm install` e o *Start Command* para `node server.js`. Acesse as rotas na sua URL gerada tipo `https://api.guarutoner.onrender.com`.
3.  **Frontend (Ex: Vercel):** Crie um projeto estático do diretório `frontend/`. Adote URLs customizadas. O manifest garantirá que ele atua como PWA em Androids.
4.  Certifique-se de trocar os valores de const `API = 'http://localhost:3000';` nos arquivos para as novas rotas.
