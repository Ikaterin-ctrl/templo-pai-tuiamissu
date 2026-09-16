# Como importar os posts do Facebook para o Grimório

## O que estes ficheiros fazem

```
coletar-facebook.js   → roda no browser, coleta os posts do grupo
importar-firestore.js → roda no terminal, envia tudo para o Firestore
```

---

## PARTE 1 — Coletar os posts do Facebook

### Passo 1 — Abre o grupo
Vai para: https://www.facebook.com/groups/1384584341794482/

### Passo 2 — Abre o console do browser
- **Chrome no Mac:** pressiona **Cmd + Option + J** (abre direto no Console)
- **Chrome no Windows/Linux:** pressiona **F12** → clica na aba **"Console"**
- **Firefox no Mac:** pressiona **Cmd + Option + K**

### Passo 3 — Cola o script
1. Abre o ficheiro `coletar-facebook.js` com um editor de texto
2. Seleciona tudo (Cmd+A) e copia (Cmd+C)
3. Clica dentro da caixa do Console no browser
4. Cola (Cmd+V) e pressiona **Enter**

Deves ver esta mensagem:
```
🕯️  Script de coleta ativado!
   Scrolla a página para coletar posts.
   Quando terminar, digita:  baixarJSON()
```

### Passo 4 — Scrolla a página
Scrolla devagar para baixo. O script vai coletando automaticamente cada post que aparecer. No Console vais ver:
```
✅ Coletado [1]: Você pode estar chamando obsessores...
✅ Coletado [2]: Teologia básica da Umbanda...
📦 Total coletado até agora: 2 posts
```

### Passo 5 — Baixa o JSON
Quando chegares ao fim dos posts (ou onde quiseres parar), escreve no Console:
```
baixarJSON()
```
e pressiona Enter. O ficheiro **`posts_terreiro.json`** será baixado automaticamente.

---

## PARTE 2 — Importar para o Firestore

### Passo 1 — Verifica se tens o Node.js instalado
Abre o Terminal (Mac: Cmd+Espaço → "Terminal") e digita:
```bash
node -v
```
Se aparecer um número (ex: `v20.11.0`), está bom. Se não, baixa em: https://nodejs.org

### Passo 2 — Baixa a chave do Firebase
1. Vai para: https://console.firebase.google.com
2. Seleciona o projeto **templopaituiamissu**
3. Clica na engrenagem ⚙️ → **Configurações do projeto**
4. Aba **"Contas de serviço"**
5. Clica em **"Gerar nova chave privada"** → confirma
6. Salva o ficheiro baixado como **`serviceAccountKey.json`**
7. Move esse ficheiro para a pasta `terreiro/importar/`

⚠️ **IMPORTANTE:** Nunca partilhes nem envies esse ficheiro para ninguém. Dá acesso total ao teu banco de dados.

### Passo 3 — Coloca o JSON na pasta certa
Move o `posts_terreiro.json` (baixado na Parte 1) para a pasta `terreiro/importar/`

A pasta deve ficar assim:
```
terreiro/importar/
├── coletar-facebook.js       ← script do browser
├── importar-firestore.js     ← script de importação
├── posts_terreiro.json       ← ficheiro que baixaste
├── serviceAccountKey.json    ← chave do Firebase (não partilhar!)
└── COMO-USAR.md              ← este ficheiro
```

### Passo 4 — Instala a dependência
No Terminal, navega até à pasta:
```bash
cd "/Users/catarinacosta/Desktop/pasta sem título/terreiro/importar"
npm install firebase-admin
```

### Passo 5 — Roda a importação
```bash
node importar-firestore.js
```

Vais ver algo assim:
```
🕯️  Importando 87 posts para o Firestore...

  ✅ Lote 1 gravado (87/87)

────────────────────────────────────────
🎉 Importação concluída!
   📖 Ensinamentos   : 71
   🎵 Pontos cantados: 8
   🌿 Ervas & Banhos : 3
   🙏 Rezas          : 5
   ⏭️  Ignorados      : 0
────────────────────────────────────────
```

Abre o app do terreiro e os posts já aparecem nos módulos correspondentes!

---

## Como o script categoriza os posts

| Categoria | Palavras-chave detectadas |
|---|---|
| **Pontos Cantados** | "ponto cantado", "salve", "laroyê", "saravá", "xirê"... |
| **Ervas & Banhos** | "erva", "banho", "defumação", "folha", "arruda"... |
| **Rezas** | "oração", "reza", "pai nosso", "ave maria", "prece"... |
| **Ensinamentos** | tudo o que não encaixar nas anteriores |

Se um post for categorizado errado, podes editá-lo diretamente no app depois.

---

## Dúvidas?

- O script **não apaga** nada que já exista no Firestore — só adiciona
- Podes rodar várias vezes com JSON diferentes, não há duplicatas por design
- Para parar a coleta antes de terminar o grupo, usa `baixarJSON()` a qualquer momento
