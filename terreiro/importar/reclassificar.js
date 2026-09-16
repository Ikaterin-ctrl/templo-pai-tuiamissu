/**
 * SCRIPT DE RECLASSIFICAÇÃO — Ensinamentos "Importado do Facebook"
 * ──────────────────────────────────────────────────────────────────
 * Lê todos os ensinamentos com categoria "Importado do Facebook"
 * e reclassifica automaticamente por palavras-chave.
 *
 * Como usar:
 *   node reclassificar.js --dry-run   → mostra o que vai mudar sem gravar
 *   node reclassificar.js             → aplica as mudanças no Firestore
 */

const { initializeApp, cert }          = require("firebase-admin/app");
const { getFirestore }                 = require("firebase-admin/firestore");
const fs   = require("fs");
const path = require("path");

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "templopaituiamissu-firebase-adminsdk-fbsvc-01a493eda9.json");
const DRY_RUN = process.argv.includes("--dry-run");

initializeApp({ credential: cert(JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8"))) });
const db = getFirestore();

// ── Regras de classificação — ordem importa (primeira que bater ganha) ─────
const REGRAS = [
  {
    categoria: "Banhos & Defumações",
    // mais específico — fica antes de Ervas para ter prioridade
    palavras: [
      "banho de ", "banho para", "tomar banho", "banho com",
      "defumação", "defumar", "defumador",
      "objetivo do banho", "receita de banho",
      "banho de descarrego", "banho de abertura", "banho de amor",
      "banho energético", "banho de limpeza",
    ],
  },
  {
    categoria: "Ervas & Plantas",
    // exige que seja o tema principal — evita "as ervas que me limpam" em comentários
    palavras: [
      "ervas quentes", "ervas frias", "ervas de limpeza",
      "manjericão", "arruda", "guiné", "alecrim", "lavanda", "cipó",
      "melissa", "rosa branca", "camomila", "eucalipto", "alfazema",
      "espada de são jorge", "comigo ninguém pode", "pinhão roxo",
      "erva cidreira", "capim limão", "hortelã",
      "misturar ervas", "pode misturar", "tipos de ervas",
    ],
  },
  {
    categoria: "Pedras & Cristais",
    palavras: [
      "pedra", "pedras", "cristal", "cristais", "quartzo",
      "ametista", "citrino", "turmalina", "obsidiana", "selenita",
      "labradorita", "lápis lazúli", "ágata", "jade", "malaquita",
      "pedra do sol", "pedra da lua", "orgonite", "mineral",
    ],
  },
  {
    categoria: "Velas & Oferendas",
    palavras: [
      "vela ", "velas ", "acender vela", "cor da vela",
      "vela branca", "vela vermelha", "vela azul", "vela amarela", "vela preta",
      "oferenda", "oferendas", "despacho", "ebó", "pemba",
      "ponto riscado", "azeite de dendê", "cachaça", "charuto",
      "cigarro de palha", "velas para ",
    ],
  },
  {
    categoria: "Glossário",
    palavras: [
      "significa ", "é um composto", "é um termo", "pode se referir",
      "karma e dharma", "deletério", "éter é", "transmutar significa",
      "egrégora", "triskle", "perispírito", "periéspírito",
    ],
  },
  {
    categoria: "Orixás",
    palavras: [
      "oxalá", "iemanjá", "oxum", "xangô", "ogum", "oxóssi", "oxossi",
      "omulu", "oxumarê", "iansã", "nanã", "logunedê", "ossaim",
      "exu", "pombagira", "pomba gira", "obá", "oba ", "orixá",
      "orixa", "linha de", "falange", "regente", "sustentador",
    ],
  },
  {
    categoria: "Mediunidade",
    palavras: [
      "médium", "medium", "incorpora", "incorporação", "incorporaçao",
      "desenvolvimento", "mediunidade", "chakra", "entidade",
      "perispírito", "periéspírito", "médiuns", "encorpor",
      "caboclo", "preto velho", "erê", "guia espiritual",
    ],
  },
  {
    categoria: "Práticas",
    palavras: [
      "gira", "atabaque", "ogã", "ogan", "preceito", "adereço",
      "aliança", "anel", "assentamento", "conga", "terreiro",
      "trabalho espiritual", "consulta", "antes da gira", "depois da gira",
    ],
  },
  {
    categoria: "Teologia",
    palavras: [
      "umbanda é", "umbanda sagrada", "fundamento", "caridade",
      "lei da ", "karma", "dharma", "livre arbítrio", "livre arbitrio",
      "reencarna", "encarna", "evolução espiritual", "espiritualidade",
      "deus ", "jesus", "oração", "prece", "fé ", "luz ",
      "umbandista", "religião", "kardec", "candomblé",
    ],
  },
  {
    categoria: "Reflexões",
    palavras: [],
  },
];

// ── Classifica um texto ────────────────────────────────────────────────────
function classificar(texto) {
  const t = texto.toLowerCase();
  for (const regra of REGRAS) {
    if (regra.palavras.length === 0) return regra.categoria; // fallback
    if (regra.palavras.some(p => t.includes(p))) return regra.categoria;
  }
  return "Reflexões";
}

// ── Principal ──────────────────────────────────────────────────────────────
async function reclassificar() {
  console.log(DRY_RUN
    ? "\n🔍 DRY-RUN — nada será gravado\n"
    : "\n🕯️  Reclassificando ensinamentos...\n"
  );

  // Busca todos os ensinamentos (incluindo os já classificados antes)
  const snap = await db.collection("ensinamentos").get();

  if (snap.empty) {
    console.log("✅ Nenhum ensinamento com categoria 'Importado do Facebook' encontrado.");
    console.log("   Todos já foram classificados!");
    return;
  }

  console.log(`📦 Encontrados ${snap.size} ensinamentos para reclassificar\n`);

  const contadores = {
    "Ervas & Plantas": 0, "Banhos & Defumações": 0, "Pedras & Cristais": 0,
    "Velas & Oferendas": 0, Glossário: 0, Orixás: 0,
    Mediunidade: 0, Práticas: 0, Teologia: 0, Reflexões: 0,
  };
  const batch = DRY_RUN ? null : db.batch();

  snap.forEach(docSnap => {
    const data = docSnap.data();
    const texto = (data.titulo || "") + " " + (data.conteudo || "");
    const novaCategoria = classificar(texto);

    contadores[novaCategoria]++;

    if (DRY_RUN) {
      console.log(`  [${novaCategoria.padEnd(12)}] ${(data.titulo || "").substring(0, 65)}`);
    } else {
      batch.update(docSnap.ref, { categoria: novaCategoria });
    }
  });

  if (!DRY_RUN) {
    await batch.commit();
  }

  console.log("\n────────────────────────────────────────");
  console.log(DRY_RUN ? "🔍 Resultado do dry-run:" : "🎉 Reclassificação concluída!");
  console.log(`   🌿 Ervas & Plantas    : ${contadores["Ervas & Plantas"]}`);
  console.log(`   🛁 Banhos & Defumações: ${contadores["Banhos & Defumações"]}`);
  console.log(`   💎 Pedras & Cristais  : ${contadores["Pedras & Cristais"]}`);
  console.log(`   🕯️  Velas & Oferendas  : ${contadores["Velas & Oferendas"]}`);
  console.log(`   📚 Glossário          : ${contadores["Glossário"]}`);
  console.log(`   ✨ Orixás             : ${contadores["Orixás"]}`);
  console.log(`   🔮 Mediunidade        : ${contadores["Mediunidade"]}`);
  console.log(`   🙏 Práticas           : ${contadores["Práticas"]}`);
  console.log(`   📖 Teologia           : ${contadores["Teologia"]}`);
  console.log(`   💭 Reflexões          : ${contadores["Reflexões"]}`);
  console.log("────────────────────────────────────────\n");

  if (DRY_RUN) {
    console.log("Para aplicar: node reclassificar.js");
  }
}

reclassificar().catch(err => {
  console.error("❌ Erro:", err.message);
  process.exit(1);
});
