// site.js — mirror estático (sem React/Babel) da landing page Verbas Rescisórias.
// Reproduz em JS puro o mesmo comportamento do componente original (ver <template id="dc-source">).
(function () {
  "use strict";

  var TELEFONE = "551533470189";
  var MSG_PADRAO = "Oi, vim pelo site e quero uma análise da minha rescisão.";
  var ENDPOINT_PLANILHA = "https://script.google.com/macros/s/AKfycbzcjE8g-2IOQZiUPiBmBsO9Bb6HU6CxHbDokBmqAATXXmWJ3G3RvhTXHAWLN8LI5r1J/exec";

  function waLink(msg) {
    return "https://wa.me/" + TELEFONE + "?text=" + encodeURIComponent(msg || MSG_PADRAO);
  }

  // Prende o foco por Tab/Shift+Tab dentro de um diálogo aberto (a11y).
  function trapFocus(container, isOpen) {
    return function (e) {
      if (e.key !== "Tab" || !isOpen()) return;
      var focusables = container.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) return;
      var first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
  }

  function capturarUtm() {
    try {
      if (sessionStorage.getItem("lead_utm")) return;
      var q = new URLSearchParams(window.location.search);
      var utm = {
        utm_source: q.get("utm_source") || "",
        utm_medium: q.get("utm_medium") || "",
        utm_campaign: q.get("utm_campaign") || "",
        utm_term: q.get("utm_term") || "",
        utm_content: q.get("utm_content") || "",
        gclid: q.get("gclid") || "",
        fbclid: q.get("fbclid") || ""
      };
      sessionStorage.setItem("lead_utm", JSON.stringify(utm));
    } catch (err) {}
  }

  function enviarPlanilha(pendingMsg, nome, email, tel) {
    if (!ENDPOINT_PLANILHA) return;
    var utm = {};
    try { utm = JSON.parse(sessionStorage.getItem("lead_utm") || "{}"); } catch (err) {}
    var dados = Object.assign({
      nome: nome, email: email, whatsapp: tel, mensagem: pendingMsg || "",
      origem_form: "popup", pagina: window.location.href
    }, utm);
    var qs = Object.keys(dados).map(function (k) {
      return encodeURIComponent(k) + "=" + encodeURIComponent(dados[k] || "");
    }).join("&");
    try { new Image().src = ENDPOINT_PLANILHA + "?" + qs; } catch (err) {}
    try { fetch(ENDPOINT_PLANILHA, { method: "POST", mode: "no-cors", body: JSON.stringify(dados) }); } catch (err) {}
  }

  // ---------- Loader ----------
  function initLoader() {
    var loader = document.getElementById("loader");
    if (!loader) return;
    // Sem framework para "esconder", o loader não precisa mais de um atraso fixo
    // (isso só inflava o Speed Index): esconde assim que a página termina de
    // carregar, com um teto de segurança curto.
    var done = false;
    function esconder() {
      if (done) return;
      done = true;
      document.documentElement.style.overflow = "";
      loader.style.opacity = "0";
      loader.style.pointerEvents = "none";
      setTimeout(function () { loader.hidden = true; }, 200);
    }
    document.documentElement.style.overflow = "hidden";
    if (document.readyState === "complete") {
      esconder();
    } else {
      window.addEventListener("load", esconder);
      setTimeout(esconder, 800);
    }
  }

  // ---------- Popup WhatsApp (lead form) ----------
  var popup, popupTitulo, popupSub, popupErro, formEl, inputNome, inputTel, inputEmail;
  var pendingMsg = "";
  var popupTrigger = null;

  function abrirPopup(msg, titulo, sub, trigger) {
    popupTrigger = trigger || null;
    pendingMsg = msg || MSG_PADRAO;
    popupTitulo.textContent = titulo || "Vamos conversar?";
    popupSub.textContent = sub || "Deixe seu nome e WhatsApp — a mensagem já vai pronta.";
    popupErro.hidden = true;
    popup.hidden = false;
    var card = popup.querySelector(".tp-pop");
    popup.style.animation = "none"; card.style.animation = "none";
    void popup.offsetWidth;
    popup.style.animation = ""; card.style.animation = "";
    inputNome.focus();
  }

  function fecharPopup() {
    popup.hidden = true;
    if (popupTrigger) { popupTrigger.focus(); popupTrigger = null; }
  }

  function enviarPopup(e) {
    e.preventDefault();
    var nome = inputNome.value.trim();
    var tel = inputTel.value.trim();
    var email = inputEmail.value.trim();
    if (!nome || !tel) {
      popupErro.textContent = "Preciso do seu nome e WhatsApp para continuar.";
      popupErro.hidden = false;
      return;
    }
    enviarPlanilha(pendingMsg, nome, email, tel);
    window.open(waLink(pendingMsg), "_blank", "noopener,noreferrer");
    try { sessionStorage.setItem("popup_lead_enviado", "1"); } catch (err) {}
    fecharPopup();
    formEl.reset();
  }

  function wireWhatsapp() {
    document.addEventListener("click", function (ev) {
      var el = ev.target.closest && ev.target.closest("a[data-msg]");
      if (!el) return;
      ev.preventDefault();
      abrirPopup(el.getAttribute("data-msg"), null, null, el);
    });
  }

  function wireExitIntent() {
    if (window.innerWidth < 900) return;
    var jaMostrou = false;
    try {
      jaMostrou = sessionStorage.getItem("popup_exit_mostrado") === "1" ||
        sessionStorage.getItem("popup_lead_enviado") === "1";
    } catch (err) {}
    if (jaMostrou) return;
    setTimeout(function () {
      function onExit(ev) {
        if (ev.clientY > 0 || !popup.hidden) return;
        try { sessionStorage.setItem("popup_exit_mostrado", "1"); } catch (err) {}
        document.removeEventListener("mouseout", onExit);
        abrirPopup(
          "Olá! Antes de sair, gostaria de saber mais sobre minhas verbas rescisórias.",
          "Antes de você ir...",
          "Se ainda tem dúvidas, deixe seu contato — a gente te responde pelo WhatsApp."
        );
      }
      document.addEventListener("mouseout", onExit);
    }, 8000);
  }

  // ---------- Balão flutuante (frases rotativas) ----------
  function initBalao() {
    var balao = document.getElementById("balao");
    var balaoTitulo = document.getElementById("balao-titulo");
    var balaoSub = document.getElementById("balao-sub");
    var fecharBtn = document.getElementById("balao-fechar");
    if (!balao) return;
    var frases = [
      { t: "Foi demitido recentemente?", s: "Fale com um advogado e descubra se recebeu todas as verbas da rescisão." },
      { t: "FGTS não foi depositado?", s: "Isso pode ser cobrado judicialmente. Vamos analisar seu caso." },
      { t: "Não recebeu o aviso prévio?", s: "Essa e outras verbas podem ser cobradas na Justiça do Trabalho." },
      { t: "Fez horas extras nunca pagas?", s: "Horas extras e adicionais podem ser cobrados judicialmente." }
    ];
    var visivel = [7000, 9000, 6500, 8000];
    var oculto = [5000, 11000, 7000, 14000];
    var i = 0, encerrado = false;
    // visibility (não display/hidden) mantém o espaço reservado no flex column,
    // então o ciclo automático não empurra o botão de WhatsApp — evita CLS.
    function mostrarBalao(v) {
      balao.style.visibility = v ? "visible" : "hidden";
      balao.style.opacity = v ? "1" : "0";
      balao.style.pointerEvents = v ? "auto" : "none";
    }
    fecharBtn.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      encerrado = true;
      mostrarBalao(false);
    });
    function ciclo() {
      if (encerrado) return;
      setTimeout(function () {
        if (encerrado) return;
        mostrarBalao(false);
        setTimeout(function () {
          if (encerrado) return;
          i = (i + 1) % frases.length;
          balaoTitulo.textContent = frases[i].t;
          balaoSub.textContent = frases[i].s;
          mostrarBalao(true);
          ciclo();
        }, oculto[i % oculto.length]);
      }, visivel[i % visivel.length]);
    }
    ciclo();
  }

  // ---------- Lightbox da galeria do escritório ----------
  function initLightbox() {
    var lb = document.getElementById("lightbox");
    if (!lb) return;
    var lbImg = document.getElementById("lightbox-img");
    var lbTitulo = document.getElementById("lightbox-titulo");
    var lbLegenda = document.getElementById("lightbox-legenda");
    var card = lb.querySelector(".lb-card");

    var fecharBtn = document.getElementById("lightbox-fechar");
    var lastTrigger = null;

    function abrir(src, titulo, legenda, trigger) {
      lastTrigger = trigger || null;
      lbImg.src = src;
      lbImg.alt = titulo;
      lbTitulo.textContent = titulo;
      lbLegenda.textContent = legenda;
      lb.hidden = false;
      lb.classList.remove("lb-out"); card.classList.remove("lb-card-out");
      lb.classList.add("lb"); card.classList.add("lb-card");
      fecharBtn.focus();
    }
    function fechar() {
      lb.classList.add("lb-out"); card.classList.add("lb-card-out");
      setTimeout(function () { lb.hidden = true; if (lastTrigger) lastTrigger.focus(); }, 240);
    }
    document.querySelectorAll("[data-galeria]").forEach(function (el) {
      el.addEventListener("click", function () {
        var img = el.querySelector("img");
        abrir(img.currentSrc || img.src, el.getAttribute("data-titulo"), el.getAttribute("data-legenda"), el);
      });
    });
    lb.addEventListener("click", fechar);
    card.addEventListener("click", function (e) { e.stopPropagation(); });
    fecharBtn.addEventListener("click", function (e) { e.stopPropagation(); fechar(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !lb.hidden) fechar();
    });
    document.addEventListener("keydown", trapFocus(lb, function () { return !lb.hidden; }));
  }

  // ---------- "Vale a pena saber" — carrossel automático ----------
  function initVale() {
    var painel = document.getElementById("vale-panel");
    if (!painel) return;
    var cards = [
      { numero: "01", titulo: "Aviso prévio não pago ou pago a menor", texto: "Quando o empregador não cumpre o prazo do aviso ou paga um valor menor do que o devido, essa diferença costuma ser o primeiro sinal de rescisão incompleta." },
      { numero: "02", titulo: "FGTS com depósitos em atraso ou faltantes", texto: "É comum a empresa atrasar ou deixar de depositar o FGTS por meses seguidos. Um levantamento no extrato revela rapidamente esse tipo de falha." },
      { numero: "03", titulo: "Horas extras e adicionais não pagos", texto: "Horas extras, adicional noturno e adicional de insalubridade são verbas habituais que muitas vezes ficam de fora do cálculo da rescisão." },
      { numero: "04", titulo: "Multa de 40% do FGTS calculada errado", texto: "Na demissão sem justa causa, a empresa deve pagar 40% sobre todo o saldo do FGTS — um valor que frequentemente vem calculado errado ou não é pago." }
    ];
    var numeroBg = document.getElementById("vale-numero-bg");
    var itemEl = document.getElementById("vale-item");
    var tituloEl = document.getElementById("vale-titulo");
    var textoEl = document.getElementById("vale-texto");
    var barraEl = document.getElementById("vale-barra");
    var dotsWrap = document.getElementById("vale-dots");
    var index = 0, animando = false, timer;

    function render() {
      var c = cards[index];
      numeroBg.textContent = c.numero;
      tituloEl.textContent = c.titulo;
      textoEl.textContent = c.texto;
      itemEl.textContent = "Item " + c.numero + " de 04";
      barraEl.style.height = ((index + 1) / cards.length) * 100 + "%";
      Array.prototype.forEach.call(dotsWrap.children, function (dot, idx) {
        var pill = dot.firstElementChild;
        pill.style.width = idx === index ? "26px" : "6px";
        pill.style.background = idx === index ? "#1EA94F" : "rgba(255,255,255,0.25)";
      });
    }
    function ir(i) {
      if (animando) return;
      clearTimeout(timer);
      animando = true;
      painel.style.opacity = "0"; painel.style.transform = "translateY(8px)";
      setTimeout(function () {
        index = (i + cards.length) % cards.length;
        render();
        painel.style.opacity = "1"; painel.style.transform = "translateY(0)";
        animando = false;
        agendar();
      }, 260);
    }
    function agendar() {
      clearTimeout(timer);
      timer = setTimeout(function () { ir(index + 1); }, 6000);
    }
    cards.forEach(function (c, idx) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", "Ir para item " + c.numero);
      // Área de toque ampliada (min. 24x24) mantendo a pílula visual pequena por dentro.
      dot.style.cssText = "width:24px;height:24px;padding:0;border:none;background:none;cursor:pointer;display:flex;align-items:center;justify-content:center;";
      var pill = document.createElement("span");
      pill.style.cssText = "display:block;height:6px;border-radius:999px;transition:width .3s ease,background .3s ease;";
      dot.appendChild(pill);
      dot.addEventListener("click", function () { ir(idx); });
      dotsWrap.appendChild(dot);
    });
    document.getElementById("vale-anterior").addEventListener("click", function () { ir(index - 1); });
    document.getElementById("vale-proximo").addEventListener("click", function () { ir(index + 1); });
    render();
    agendar();
  }

  // ---------- Scroll reveal ----------
  function initReveal() {
    var sel = ".h2, .sec > div > div > p, .sec > div > p, .grid3 > div, .grid3 > img, .hero-img, .hero-img + div, .sec details, .sec a[href^='https://wa.me'], .sec > div > div > div, footer > div";
    document.querySelectorAll(".stack-sec .reveal:not(.stack-card)").forEach(function (el) {
      el.classList.add("reveal-solo");
    });
    var groups = Array.prototype.slice.call(document.querySelectorAll("section, footer"));
    groups.forEach(function (g) {
      var seen = [];
      var els = Array.prototype.slice.call(g.querySelectorAll(sel)).filter(function (e) {
        if (seen.indexOf(e) !== -1) return false;
        seen.push(e);
        return !e.closest(".mq") && !e.closest(".hero-in") && !e.closest(".stack-card");
      });
      els.forEach(function (el, i) {
        el.classList.add("reveal");
        el.style.transitionDelay = Math.min(i, 4) * 45 + "ms";
      });
    });
    var all = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
    var scroller = (function () {
      var n = all[0];
      while (n && n.parentElement) {
        n = n.parentElement;
        if (n.scrollHeight - n.clientHeight > 40) return n;
      }
      return null;
    })();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { root: scroller, rootMargin: "0px 0px 15% 0px", threshold: 0 });
    all.forEach(function (el) { io.observe(el); });
    var soloEls = Array.prototype.slice.call(document.querySelectorAll(".reveal-solo"));
    soloEls.forEach(function (el) { io.observe(el); });
    var podeRolar = scroller ? true : document.documentElement.scrollHeight - window.innerHeight > 40;
    setTimeout(function () {
      all.forEach(function (el) { el.classList.add("in"); });
      soloEls.forEach(function (el) { el.classList.add("in"); });
    }, podeRolar ? 3000 : 80);
  }

  // Botão flutuante só aparece depois que o visitante rola até a 2ª seção da LP.
  function initFlutuante() {
    var flutuante = document.getElementById("flutuante");
    var gatilho = document.getElementById("servicos");
    if (!flutuante || !gatilho) return;
    function revelar() {
      flutuante.hidden = false;
      requestAnimationFrame(function () { flutuante.style.opacity = "1"; });
    }
    if (!("IntersectionObserver" in window)) { revelar(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { revelar(); io.disconnect(); }
      });
    }, { rootMargin: "0px 0px -60% 0px", threshold: 0 });
    io.observe(gatilho);
  }

  function boot() {
    popup = document.getElementById("popup");
    popupTitulo = document.getElementById("popup-titulo");
    popupSub = document.getElementById("popup-sub");
    popupErro = document.getElementById("popup-erro");
    formEl = document.getElementById("popup-form");
    inputNome = document.getElementById("popup-nome");
    inputTel = document.getElementById("popup-tel");
    inputEmail = document.getElementById("popup-email");

    document.getElementById("popup-fechar1").addEventListener("click", fecharPopup);
    document.getElementById("popup-overlay").addEventListener("click", fecharPopup);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !popup.hidden) fecharPopup();
    });
    document.addEventListener("keydown", trapFocus(popup, function () { return !popup.hidden; }));
    formEl.addEventListener("submit", enviarPopup);

    initLoader();
    wireWhatsapp();
    wireExitIntent();
    capturarUtm();
    initFlutuante();
    initBalao();
    initLightbox();
    initVale();
    initReveal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
