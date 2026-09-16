/**
 * SCRIPT DE SCROLL LENTO — simula leitura humana
 * ────────────────────────────────────────────────
 * Como usar em qualquer página:
 *   1. Abre a página no Chrome
 *   2. Pressiona Cmd + Option + J  (abre o Console)
 *   3. Digita:  allow pasting  e pressiona Enter
 *   4. Cola este script inteiro e pressiona Enter
 *   5. Digita:  iniciarScroll()  e pressiona Enter
 *
 * Comandos disponíveis:
 *   iniciarScroll()   — inicia o scroll lento
 *   pararScroll()     — pausa onde está
 *   statusScroll()    — mostra progresso
 */

(function () {

  let _ativo     = false;
  let _timeoutId = null;
  let _alvo      = null; // elemento que tem o scroll real

  // ── Configurações (podes ajustar à vontade) ───────────────────────────────
  const CONFIG = {
    pixelsPorPasso : 80,     // quanto scrolla de cada vez (px)
    intervaloMs    : 800,    // tempo entre cada passo (ms) — 800ms = devagar
    chancePausa    : 0.05,   // 5% de chance de parar a cada passo (simula distração)
    pausaMinMs     : 15000,  // pausa mínima: 15s
    pausaMaxMs     : 90000,  // pausa máxima: 1m30s
  };

  // ── Detecta o elemento que realmente tem scroll ───────────────────────────
  function detectarAlvo() {
    // Tenta o elemento sob o cursor primeiro
    // Depois percorre todos os elementos à procura do que tem scrollHeight > clientHeight
    const candidatos = Array.from(document.querySelectorAll("*")).filter(el => {
      const s = el.scrollHeight - el.clientHeight;
      if (s < 200) return false;
      const style = getComputedStyle(el);
      return style.overflowY === "auto" || style.overflowY === "scroll";
    });

    // Ordena pelo maior scrollHeight (provavelmente o container principal)
    candidatos.sort((a, b) => b.scrollHeight - a.scrollHeight);

    if (candidatos.length > 0) {
      console.log(`🎯 Container de scroll encontrado: <${candidatos[0].tagName.toLowerCase()}> scrollHeight=${candidatos[0].scrollHeight}px`);
      return candidatos[0];
    }

    // Fallback: usa window
    console.log("🎯 Usando scroll da janela (window)");
    return window;
  }

  // ── Lê posição atual e total do alvo ──────────────────────────────────────
  function getPosicao() {
    if (_alvo === window) {
      return {
        atual: window.scrollY + window.innerHeight,
        total: document.documentElement.scrollHeight,
      };
    }
    return {
      atual: _alvo.scrollTop + _alvo.clientHeight,
      total: _alvo.scrollHeight,
    };
  }

  // ── Progresso ─────────────────────────────────────────────────────────────
  function progresso() {
    const { atual, total } = getPosicao();
    return Math.min(100, Math.round((atual / total) * 100));
  }

  // ── Um passo de scroll ────────────────────────────────────────────────────
  function passo() {
    if (!_ativo) return;

    const { atual, total } = getPosicao();

    // Verifica se chegou ao fim
    if (atual >= total - 50) {
      console.log("🏁 Chegou ao fim da página!");
      pararScroll();
      return;
    }

    // Sorteio de pausa (simula humano que parou pra ler)
    if (Math.random() < CONFIG.chancePausa) {
      const duracao = Math.floor(
        CONFIG.pausaMinMs + Math.random() * (CONFIG.pausaMaxMs - CONFIG.pausaMinMs)
      );
      const minutos  = Math.floor(duracao / 60000);
      const segundos = Math.floor((duracao % 60000) / 1000);
      console.log(`☕ Pausando por ${minutos}m${segundos}s... (${progresso()}% lido)`);
      _timeoutId = setTimeout(passo, duracao);
      return;
    }

    // Scrolla um passo suave no elemento correto
    if (_alvo === window) {
      window.scrollBy({ top: CONFIG.pixelsPorPasso, behavior: "smooth" });
    } else {
      _alvo.scrollBy({ top: CONFIG.pixelsPorPasso, behavior: "smooth" });
    }

    // Agenda próximo passo com pequena variação aleatória (mais humano)
    const variacao = (Math.random() - 0.5) * 300; // ±150ms
    _timeoutId = setTimeout(passo, CONFIG.intervaloMs + variacao);
  }

  // ── Iniciar ───────────────────────────────────────────────────────────────
  window.iniciarScroll = function () {
    if (_ativo) {
      console.warn("⚠️ Scroll já está ativo.");
      return;
    }
    _alvo  = detectarAlvo();
    _ativo = true;
    console.log("────────────────────────────────────────");
    console.log("📖 Scroll lento iniciado!");
    console.log(`   ${CONFIG.pixelsPorPasso}px a cada ~${CONFIG.intervaloMs}ms`);
    console.log("   Pausas aleatórias de ~2 min ao longo da leitura");
    console.log("   Para parar: pararScroll()");
    console.log("────────────────────────────────────────");
    passo();
  };

  // ── Parar ─────────────────────────────────────────────────────────────────
  window.pararScroll = function () {
    _ativo = false;
    if (_timeoutId) { clearTimeout(_timeoutId); _timeoutId = null; }
    console.log(`⏹️  Scroll pausado — ${progresso()}% da página lida`);
    console.log("   Para continuar: iniciarScroll()");
  };

  // ── Status ────────────────────────────────────────────────────────────────
  window.statusScroll = function () {
    console.log(`📖 Progresso: ${progresso()}% da página`);
    console.log(`🔄 Ativo: ${_ativo}`);
  };

  console.log("────────────────────────────────────────");
  console.log("📖 Script de scroll lento carregado!");
  console.log("   Para iniciar, digita:  iniciarScroll()");
  console.log("────────────────────────────────────────");

})();
