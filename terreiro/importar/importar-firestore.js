/**
 * SCRIPT DE IMPORTAÇÃO — posts_terreiro.json → Firestore
 * ────────────────────────────────────────────────────────
 * Pré-requisitos:
 *   node -v  (precisa ter Node.js instalado)
 *   npm install firebase-admin
 *
 * Como usar:
 *   1. Baixa a chave de serviço do Firebase:
 *      Console Firebase → Configurações do projeto → Contas de serviço
 *      → "Gerar nova chave privada" → salva como serviceAccountKey.json
 *      na mesma pasta deste ficheiro (terreiro/importar/)
 *
 *   2. Copia o ficheiro posts_terreiro.json para esta pasta também
 *
 *   3. Roda:  node importar-firestore.js
 */

const { initializeApp, cert }  = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const fs    = require("fs");
const path  = require("path");

// ── Configuração ──────────────────────────────────────────────────────────
const SERVICE_ACCOUNT_PATH = path.join(__dirname, "templopaituiamissu-firebase-adminsdk-fbsvc-01a493eda9.json");
const POSTS_JSON_PATH      = path.join(__dirname, "posts_terreiro.json");

// ── Inicializa Firebase Admin ──────────────────────────────────────────────
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── Filtros — descarta o que NÃO é conteúdo real ──────────────────────────
// sem filtro automático — importa tudo, curadoria manual no app
function ehComentario() { return false; }

// ── Regras de categorização ────────────────────────────────────────────────
// Cada categoria tem palavras-chave que detectamos no texto do post.
// A primeira categoria que der match ganha. Ajusta à vontade.
// Importa tudo como ensinamentos — categorização manual no app depois
const REGRAS_CATEGORIA = [
  {
    colecao: "ensinamentos",
    palavras: [],
    builder: (post, titulo, corpo) => ({
      titulo,
      conteudo: corpo,
      categoria: "Importado do Facebook",
      autor: "",
      criadoEm: FieldValue.serverTimestamp(),
    }),
  },
];

// ── Detecção de Orixá no texto ─────────────────────────────────────────────
const ORIXAS = [
  "Oxalá","Iemanjá","Oxum","Xangô","Ogum","Oxóssi","Omulu","Oxumarê",
  "Iansã","Nanã","Logunedê","Ossaim","Ibeji","Exu","Pomba Gira",
  "Caboclo","Preto Velho","Pretos Velhos","Criança","Erê",
];
function detectarOrixa(texto) {
  const t = texto.toLowerCase();
  for (const o of ORIXAS) {
    if (t.includes(o.toLowerCase())) return o;
  }
  return "";
}

// ── Categorias de ensinamento ──────────────────────────────────────────────
function detectarCategoriaEnsinamento(texto) {
  const t = texto.toLowerCase();
  if (t.includes("obsessor") || t.includes("espírito") || t.includes("mediunidade")) return "Mediunidade";
  if (t.includes("caridade") || t.includes("humildade") || t.includes("amor"))       return "Fundamentos";
  if (t.includes("umbanda") || t.includes("teologia") || t.includes("religião"))     return "Teologia";
  if (t.includes("ritual") || t.includes("gira") || t.includes("terreiro"))          return "Rituais";
  if (t.includes("orixá") || t.includes("orixa"))                                    return "Orixás";
  return "Geral";
}

// ── Extrai título e corpo de um post ──────────────────────────────────────
function extrairTituloCorpo(texto) {
  // Fix encoding Facebook (UTF-8 mal formatado)
  const textoFixo = texto
    .replace(/\\u00e3/g, "ã").replace(/\\u00e9/g, "é")
    .replace(/\\u00e1/g, "á").replace(/\\u00e2/g, "â")
    .replace(/\\u00ea/g, "ê").replace(/\\u00f3/g, "ó")
    .replace(/\\u00fa/g, "ú").replace(/\\u00e7/g, "ç")
    .replace(/\\u00ed/g, "í").replace(/\\u00f5/g, "õ");

  const linhas = textoFixo.split("\n").map(l => l.trim()).filter(Boolean);
  const titulo = linhas[0].substring(0, 120); // primeira linha = título (máx 120 chars)
  const corpo  = linhas.slice(1).join("\n").trim() || textoFixo;
  return { titulo, corpo };
}

// ── Categoriza um post ─────────────────────────────────────────────────────
function categorizar(post) {
  const { titulo, corpo } = extrairTituloCorpo(post.texto);
  return {
    colecao: "ensinamentos",
    doc: {
      titulo,
      conteudo: corpo,
      categoria: "Importado do Facebook",
      autor: "",
      criadoEm: FieldValue.serverTimestamp(),
    },
  };
}

// ── Modo dry-run: mostra o que seria importado sem gravar no Firestore ────
const DRY_RUN = process.argv.includes("--dry-run");

// ── Importação principal ──────────────────────────────────────────────────
async function importar() {
  if (!fs.existsSync(POSTS_JSON_PATH)) {
    console.error(`❌ Ficheiro não encontrado: ${POSTS_JSON_PATH}`);
    console.error("   Coloca o posts_terreiro.json na pasta terreiro/importar/");
    process.exit(1);
  }

  const raw   = JSON.parse(fs.readFileSync(POSTS_JSON_PATH, "utf8"));
  const posts = raw.posts || raw; // suporta array direto ou { posts: [...] }

  if (DRY_RUN) console.log("\n🔍 MODO DRY-RUN — nada será gravado no Firestore\n");
  console.log(`\n🕯️  Analisando ${posts.length} entradas...\n`);

  const contadores = { ensinamentos: 0, pontos: 0, ervas: 0, rezas: 0, ignorados: 0 };

  // Lotes de 400 (limite Firestore: 500 ops por batch)
  const LOTE = 400;
  for (let i = 0; i < posts.length; i += LOTE) {
    const fatia = posts.slice(i, i + LOTE);
    const batch = DRY_RUN ? null : db.batch();

    for (const post of fatia) {
      if (!post.texto || post.texto.trim().length < 30) {
        contadores.ignorados++;
        continue;
      }
      const resultado = categorizar(post);
      if (!resultado) { contadores.ignorados++; continue; }

      if (DRY_RUN) {
        console.log(`  [${resultado.colecao}] ${(resultado.doc.titulo || "").substring(0, 70)}`);
      } else {
        const ref = db.collection(resultado.colecao).doc();
        batch.set(ref, resultado.doc);
      }
      contadores[resultado.colecao]++;
    }

    if (!DRY_RUN) {
      await batch.commit();
      console.log(`  ✅ Lote ${Math.floor(i / LOTE) + 1} gravado (${Math.min(i + LOTE, posts.length)}/${posts.length})`);
    }
  }

  console.log("\n────────────────────────────────────────");
  if (DRY_RUN) {
    console.log("🔍 Dry-run concluído! Para importar de verdade, corre sem --dry-run");
  } else {
    console.log("🎉 Importação concluída!");
  }
  console.log(`   📖 Ensinamentos : ${contadores.ensinamentos}`);
  console.log(`   🎵 Pontos cantados: ${contadores.pontos}`);
  console.log(`   🌿 Ervas & Banhos : ${contadores.ervas}`);
  console.log(`   🙏 Rezas         : ${contadores.rezas}`);
  console.log(`   ⏭️  Ignorados      : ${contadores.ignorados}`);
  console.log("────────────────────────────────────────\n");
}

importar().catch(err => {
  console.error("❌ Erro na importação:", err.message);
  process.exit(1);
});
