# Templo Pai Tuiamissu — Grimório Digital

Plataforma web privada desenvolvida para os membros da corrente do **Templo Pai Tuiamissu**, terreiro de Umbanda Sagrada.

Reúne num só lugar tudo o que a casa precisa: consultar pontos cantados durante a gira, guardar ensinamentos dos guias, registar as propriedades das ervas e rezas, acompanhar o calendário de trabalhos espirituais e gerir a escala de limpeza do terreiro.

O acesso é restrito — novos membros solicitam entrada e o pai de santo aprova manualmente. Cada função (filho de santo, ogã, ekedi…) tem permissões diferentes dentro da plataforma.

Funciona como PWA instalável no celular, com suporte offline.

## Estrutura do repositório

```
.
├── terreiro/                  # Aplicação web (deploy direto no Firebase Hosting)
│   ├── index.html             # Tela de login / pedido de acesso
│   ├── dashboard.html         # App principal (SPA em páginas)
│   ├── admin.html             # Painel administrativo
│   ├── perfil.html            # Perfil do usuário
│   ├── seed.html              # Utilitário de seed de dados (uso interno)
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service Worker (cache offline)
│   ├── firestore.rules        # Regras de segurança do Firestore
│   ├── css/
│   │   └── style.css          # Estilos globais (tema claro + escuro)
│   ├── js/
│   │   ├── firebase-config.js # Inicialização do Firebase (config pública)
│   │   └── app.js             # Lógica completa da aplicação
│   └── importar/              # Scripts Node.js de importação de dados
│       ├── importar-firestore.js
│       ├── reclassificar.js
│       ├── coletar-facebook.js
│       ├── scroll-lento.js
│       ├── COMO-USAR.md
│       └── package.json
├── docs/                      # Documentos de referência (PDFs, imagens)
├── data/                      # Dados brutos exportados do Facebook (não versionados)
└── .gitignore
```

## Tecnologias

- **Frontend**: HTML5 + CSS3 + JavaScript (ES Modules) — sem framework
- **Backend**: Firebase (Authentication, Firestore, Hosting)
- **PWA**: Service Worker + Web App Manifest
- **Importação**: Node.js + `firebase-admin`

## Como rodar localmente

### Aplicação web

Basta servir a pasta `terreiro/` com qualquer servidor HTTP estático:

```bash
# Python (já instalado no macOS)
cd terreiro
python3 -m http.server 8080
# Acesse http://localhost:8080
```

> **Atenção**: a app usa módulos ES (`type="module"`) — abrir `index.html`
> diretamente como `file://` não funciona; é necessário um servidor HTTP.

### Scripts de importação

```bash
cd terreiro/importar
# Copie a chave de serviço para este diretório (NÃO commitar)
# cp ~/Downloads/templopaituiamissu-adminsdk.json .
npm run importar       # importa posts_terreiro.json → Firestore
npm run reclassificar  # reclassifica documentos existentes
```

## ⚠️ Segurança

| Arquivo | Status |
|---|---|
| `terreiro/js/firebase-config.js` | ✅ Config pública do SDK web — seguro para versionar |
| `terreiro/importar/*-adminsdk-*.json` | 🚫 **NUNCA versionar** — chave de serviço com acesso admin |
| `google-services.json` | 🚫 **NUNCA versionar** — credencial Android/GCP |

O `.gitignore` já protege esses arquivos. Se a chave de serviço tiver sido
exposta anteriormente, revogue-a imediatamente em
**Google Cloud Console → IAM → Contas de serviço**.

## Deploy

```bash
# Instale a Firebase CLI se ainda não tiver
npm install -g firebase-tools
firebase login
cd terreiro
firebase deploy --only hosting
```
