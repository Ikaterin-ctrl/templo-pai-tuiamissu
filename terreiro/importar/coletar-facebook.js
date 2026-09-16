/**
 * SCRIPT DE COLETA — GRUPO DO FACEBOOK (scroll automático + só posts)
 * ─────────────────────────────────────────────────────────────────────
 * Como usar:
 *   1. Abre o grupo do Facebook no Chrome
 *   2. Pressiona Cmd + Option + J  (abre o Console)
 *   3. Digita:  allow pasting  e pressiona Enter
 *   4. Cola este script inteiro e pressiona Enter
 *   5. Digita:  iniciarColeta()  e pressiona Enter
 *   6. Aguarda — o script scrolla sozinho, expande "Ver mais" e coleta só posts
 *   7. Quando terminar, digita:  baixarJSON()
 */

(function () {

  const postsColetados = new Map();
  let _scrollAtivo      = false;
  let _intervalId       = null;
  let _semNovidadeCount = 0;
  const SEM_NOVIDADE_LIMITE = 15;

  // ── Clica em todos os "Ver mais" e aguarda expansão ───────────────────────
  async function expandirVerMais() {
    const botoes = Array.from(document.querySelectorAll(
      'div[role="button"], span[role="button"]'
    )).filter(btn => {
      const txt = btn.innerText.trim().toLowerCase();
      return txt === "ver mais" || txt === "see more" || txt === "ver todo";
    });
    if (botoes.length === 0) return;
    botoes.forEach(btn => { try { btn.click(); } catch (_) {} });
    console.log(`🔓 Clicado em ${botoes.length} "Ver mais" — aguardando...`);
    await new Promise(r => setTimeout(r, 1500));
  }

  // ── Extrai texto completo de um article juntando todos os div[dir=auto] ───
  function extrairTextoDoArticle(article) {
    // Pega todos os div[dir="auto"] dentro do article
    const blocos = Array.from(article.querySelectorAll('div[dir="auto"]'));
    if (blocos.length === 0) return null;

    // Junta todos os textos, removendo duplicatas consecutivas
    const textos = [];
    let ultimo = "";
    for (const bloco of blocos) {
      const t = bloco.innerText.trim();
      if (!t || t === ultimo) continue;
      // Ignora se é sub-bloco de um já incluído (texto contido no anterior)
      if (ultimo && ultimo.includes(t)) continue;
      textos.push(t);
      ultimo = t;
    }

    return textos.join("\n").trim();
  }

  // ── Verifica se um article é um post principal (não comentário) ───────────
  function ehPostPrincipal(article) {
    // Articles de comentários ficam dentro de outros articles
    // O post principal é o article de nível mais alto
    const articlePai = article.parentElement
      ? article.parentElement.closest('[role="article"]')
      : null;
    if (articlePai) return false; // está aninhado → é comentário

    return true;
  }

  // ── Extrai data do article ────────────────────────────────────────────────
  function extrairData(article) {
    const dataEl = article.querySelector("a[href*='permalink'] abbr") ||
                   article.querySelector("abbr[data-utime]")          ||
                   article.querySelector("a[role='link'] abbr");
    return dataEl
      ? dataEl.getAttribute("title") || dataEl.innerText.trim()
      : new Date().toLocaleDateString("pt-BR");
  }

  // ── Coleta posts visíveis ─────────────────────────────────────────────────
  function coletar() {
    const antes = postsColetados.size;

    const articles = Array.from(document.querySelectorAll('[role="article"]'));

    for (const article of articles) {
      try {
        // Só posts de nível raiz
        if (!ehPostPrincipal(article)) continue;

        const texto = extrairTextoDoArticle(article);
        if (!texto || texto.length < 80) continue;

        // Ignora se ainda truncado
        if (texto.toLowerCase().endsWith("ver mais") || texto.toLowerCase().endsWith("see more")) continue;

        // Ignora textos que são claramente comentários (curtos e sem estrutura)
        const linhas = texto.split("\n").filter(l => l.trim().length > 0);
        if (linhas.length === 1 && texto.length < 150) continue;

        const chave = texto.substring(0, 100);
        if (!postsColetados.has(chave)) {
          const data = extrairData(article);
          postsColetados.set(chave, { texto, data });
        }
      } catch (_) {}
    }

    return postsColetados.size - antes;
  }

  // ── Um passo: expande, coleta, scrolla ────────────────────────────────────
  async function passo() {
    if (!_scrollAtivo) return;

    await expandirVerMais();
    const novos = coletar();

    if (novos > 0) {
      _semNovidadeCount = 0;
      console.log(`✅ +${novos} posts novos — total: ${postsColetados.size}`);
    } else {
      _semNovidadeCount++;
    }

    if (_semNovidadeCount >= SEM_NOVIDADE_LIMITE) {
      pararColeta();
      console.log(`\n🏁 Coleta finalizada! Total: ${postsColetados.size} posts`);
      console.log("   Digita:  baixarJSON()");
      return;
    }

    window.scrollBy({ top: 1200, behavior: "smooth" });
    _intervalId = setTimeout(passo, 4000);
  }

  // ── Iniciar ───────────────────────────────────────────────────────────────
  window.iniciarColeta = function () {
    if (_scrollAtivo) { console.warn("⚠️ Já está a correr."); return; }
    _scrollAtivo      = true;
    _semNovidadeCount = 0;
    console.log("──────────────────────────────────────────────");
    console.log("🕯️  Coleta iniciada — só posts, sem comentários");
    console.log("   Para parar: pararColeta()");
    console.log("   Para baixar: baixarJSON()");
    console.log("──────────────────────────────────────────────");
    passo();
  };

  // ── Parar ─────────────────────────────────────────────────────────────────
  window.pararColeta = function () {
    _scrollAtivo = false;
    if (_intervalId) { clearTimeout(_intervalId); _intervalId = null; }
    console.log(`⏹️  Pausado — ${postsColetados.size} posts coletados`);
    console.log("   Para continuar: iniciarColeta()");
    console.log("   Para baixar:    baixarJSON()");
  };

  // ── Baixar JSON ───────────────────────────────────────────────────────────
  window.baixarJSON = function () {
    pararColeta();
    if (postsColetados.size === 0) {
      console.warn("⚠️ Nenhum post coletado ainda.");
      return;
    }
    const lista = Array.from(postsColetados.values());
    const json  = JSON.stringify({ total: lista.length, posts: lista }, null, 2);
    const blob  = new Blob([json], { type: "application/json" });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement("a");
    a.href = url; a.download = "posts_terreiro.json"; a.click();
    URL.revokeObjectURL(url);
    console.log(`🎉 Baixado com ${lista.length} posts!`);
  };

  // ── Status ────────────────────────────────────────────────────────────────
  window.statusColeta = function () {
    console.log(`📦 Posts coletados: ${postsColetados.size} | Ativo: ${_scrollAtivo}`);
  };

  console.log("──────────────────────────────────────────────");
  console.log("🕯️  Script carregado! Para iniciar:");
  console.log("   iniciarColeta()");
  console.log("──────────────────────────────────────────────");

})();
