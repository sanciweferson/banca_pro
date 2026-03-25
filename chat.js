/* =========================================================
   CHAT DE AJUDA V2
========================================================= */
const HELP_CHAT_STORAGE_KEY = "bancapro_help_chat_v2";

const helpKnowledgeBase = [
  {
    keywords: ["banca", "banca inicial", "configurar banca", "saldo inicial", "começar"],
    answer:
`Para começar, vá em "Configurar" e defina a banca inicial.

Exemplo:
• banca = R$ 500

Depois disso, o sistema consegue calcular:
• saldo
• units
• risco
• métricas do dashboard`
  },
  {
    keywords: ["unit", "units", "unidade", "1 unit", "stake em units"],
    answer:
`Units medem o risco com base na banca.

Exemplo:
• banca = R$ 500
• 1 unit = 1%
• então 1 unit = R$ 5

Se você registrar R$ 20:
• isso equivale a 4 units`
  },
  {
    keywords: ["entrada simples", "simples", "registrar entrada", "nova entrada", "cadastro de entrada"],
    answer:
`Para registrar uma entrada simples, preencha:

• Evento / Time
• Categoria
• Mercado
• Odd
• Valor ou Units
• Observações (opcional)

Depois clique em registrar.

O sistema:
• desconta o valor do saldo na hora
• salva como pendente
• calcula retorno potencial`
  },
  {
    keywords: ["acumulada", "multipla", "múltipla", "seleções", "selecao"],
    answer:
`Na acumulada, você precisa:

1. adicionar pelo menos 2 seleções
2. preencher odd de cada seleção
3. conferir a odd total
4. informar o valor final
5. registrar

Se uma seleção perder:
• a acumulada perde

Se alguma for void:
• a odd é recalculada sem ela`
  },
  {
    keywords: ["saldo caiu", "meu saldo caiu", "saldo diminuiu", "descontou saldo", "tirou saldo"],
    answer:
`Isso normalmente não é erro.

Quando você registra uma entrada, o sistema desconta o stake imediatamente.

Depois, ao resolver:
• win → entra o retorno completo
• loss → não volta nada
• half win → volta stake + metade do lucro
• half loss → volta metade do stake
• void → volta todo o stake`
  },
  {
    keywords: ["win", "loss", "void", "half win", "half loss", "resolver entrada", "resultado"],
    answer:
`Significado dos resultados:

• Win = entrada ganha
• Loss = entrada perdida
• Half Win = meio ganho
• Half Loss = meia perda
• Void = entrada anulada

O Void devolve o stake inteiro.`
  },
  {
    keywords: ["roi", "retorno sobre investimento", "lucro percentual"],
    answer:
`ROI é o retorno sobre o total investido.

Em palavras simples:
ele mostra se, no conjunto das entradas resolvidas, você está tendo lucro ou prejuízo percentual.

É uma das métricas mais importantes do sistema.`
  },
  {
    keywords: ["win rate", "taxa de acerto", "porcentagem de acerto"],
    answer:
`Win rate é a taxa de acerto.

Exemplo:
• 10 entradas resolvidas
• 6 wins
• win rate = 60%

Mas cuidado:
win rate sozinho não mostra lucro.`
  },
  {
    keywords: ["drawdown", "queda da banca", "recuo da banca"],
    answer:
`Drawdown mostra a maior queda da banca depois de um topo.

Isso ajuda a medir a pior fase do histórico e o risco real da gestão.`
  },
  {
    keywords: ["historico", "histórico", "filtro", "buscar entrada", "tabela", "pesquisa"],
    answer:
`No histórico você pode:

• ver todas as entradas
• filtrar por status
• buscar por texto
• ordenar por data, odd, stake ou resultado
• exportar CSV e JSON`
  },
  {
    keywords: ["csv", "json", "backup", "exportar", "importar"],
    answer:
`Você pode usar:

• CSV → para planilha
• JSON → para backup completo

O JSON é melhor para restaurar dados depois.`
  },
  {
    keywords: ["risco", "stake alto", "alerta vermelho", "limite", "stop"],
    answer:
`Se aparecer alerta de risco, normalmente significa que a entrada está grande demais para a banca.

O sistema pode usar:
• % máxima por entrada
• máximo de units
• stop diário
• stop semanal`
  }
];

function normalizeHelpText(text){
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getHelpAnswer(question){
  const text = normalizeHelpText(question);

  let bestMatch = null;
  let bestScore = 0;

  for(const item of helpKnowledgeBase){
    let score = 0;

    for(const keyword of item.keywords){
      const normalizedKeyword = normalizeHelpText(keyword);
      if(text.includes(normalizedKeyword)){
        score += normalizedKeyword.length;
      }
    }

    if(score > bestScore){
      bestScore = score;
      bestMatch = item;
    }
  }

  if(bestMatch) return bestMatch.answer;

  return `Não achei uma resposta exata para isso ainda.

Tente perguntar sobre:
• banca
• units
• entrada simples
• acumulada
• saldo
• ROI
• win / loss / void
• histórico
• backup`;
}

const helpChatToggle = document.getElementById("helpChatToggle");
const helpChatPanel = document.getElementById("helpChatPanel");
const helpChatClose = document.getElementById("helpChatClose");
const helpChatMessages = document.getElementById("helpChatMessages");
const helpChatForm = document.getElementById("helpChatForm");
const helpChatInput = document.getElementById("helpChatInput");
const helpChatSuggestions = document.getElementById("helpChatSuggestions");
const helpOpenGuide = document.getElementById("helpOpenGuide");
const helpClearChat = document.getElementById("helpClearChat");
const helpChatContextLabel = document.getElementById("helpChatContextLabel");

function getCurrentHelpContext(){
  const contexts = [
    {
      id: "dashboard",
      label: "ajuda do dashboard",
      suggestions: [
        "O que é ROI?",
        "O que é drawdown?",
        "Como ler o dashboard?",
        "Por que meu saldo mudou?"
      ],
      welcome: `Você está na área do dashboard.

Posso te ajudar com:
• ROI
• saldo
• drawdown
• métricas`
    },
    {
      id: "simples",
      label: "ajuda da entrada simples",
      suggestions: [
        "Como registrar entrada simples?",
        "Como funciona units?",
        "Por que meu saldo caiu?",
        "O que significa void?"
      ],
      welcome: `Você está na área de entrada simples.

Posso te ajudar com:
• cadastro
• stake
• units
• retorno potencial`
    },
    {
      id: "acumulada",
      label: "ajuda da acumulada",
      suggestions: [
        "Como funciona acumulada?",
        "Como calcular odd total?",
        "O que acontece se uma seleção perder?",
        "O que acontece se uma seleção for void?"
      ],
      welcome: `Você está na área de acumulada.

Posso te ajudar com:
• seleções
• odd total
• registro
• resolução`
    },
    {
      id: "apostas",
      label: "ajuda do histórico",
      suggestions: [
        "Como usar os filtros?",
        "Como buscar entradas?",
        "Como funciona win e loss?",
        "Como exportar CSV?"
      ],
      welcome: `Você está na área de histórico.

Posso te ajudar com:
• filtros
• busca
• resolução
• exportação`
    },
    {
      id: "config",
      label: "ajuda das configurações",
      suggestions: [
        "Como configurar a banca?",
        "Como funciona units?",
        "Como fazer backup?",
        "Como importar JSON?"
      ],
      welcome: `Você está na área de configurações.

Posso te ajudar com:
• banca inicial
• units
• risco
• backup`
    }
  ];

  const activePage = document.querySelector(".page.active");
  if(!activePage){
    return {
      label: "assistente do sistema",
      suggestions: [
        "Como configurar a banca?",
        "Como funciona units?",
        "Como registrar entrada simples?",
        "O que é ROI?"
      ],
      welcome: `Olá! Posso te ajudar com dúvidas sobre:

• banca inicial
• units
• entrada simples
• acumulada
• win / loss / void
• ROI
• histórico`
    };
  }

  const pageId = activePage.id.replace("page-", "");
  const found = contexts.find(ctx => ctx.id === pageId);

  if(found) return found;

  return {
    label: "assistente do sistema",
    suggestions: [
      "Como configurar a banca?",
      "Como funciona units?",
      "Como registrar entrada simples?",
      "O que é ROI?"
    ],
    welcome: `Olá! Posso te ajudar com dúvidas sobre o sistema.`
  };
}

function saveHelpChatHistory(){
  const messages = [...helpChatMessages.querySelectorAll(".help-msg")].map(msg => ({
    type: msg.classList.contains("help-msg-user") ? "user" : "bot",
    text: msg.querySelector(".help-bubble")?.textContent || ""
  }));

  localStorage.setItem(HELP_CHAT_STORAGE_KEY, JSON.stringify(messages));
}

function loadHelpChatHistory(){
  const raw = localStorage.getItem(HELP_CHAT_STORAGE_KEY);
  if(!raw) return false;

  try{
    const messages = JSON.parse(raw);
    if(!Array.isArray(messages) || !messages.length) return false;

    helpChatMessages.innerHTML = "";

    messages.forEach(msg => {
      appendHelpMessage(msg.text, msg.type, false);
    });

    return true;
  }catch{
    return false;
  }
}

function appendHelpMessage(text, type = "bot", saveHistory = true){
  const wrapper = document.createElement("div");
  wrapper.className = `help-msg help-msg-${type}`;

  const bubble = document.createElement("div");
  bubble.className = "help-bubble";
  bubble.textContent = text;

  wrapper.appendChild(bubble);
  helpChatMessages.appendChild(wrapper);
  helpChatMessages.scrollTop = helpChatMessages.scrollHeight;

  if(saveHistory){
    saveHelpChatHistory();
  }
}

function renderHelpSuggestions(){
  const context = getCurrentHelpContext();
  helpChatSuggestions.innerHTML = "";

  helpChatContextLabel.textContent = context.label;

  context.suggestions.forEach(question => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "help-suggestion";
    button.textContent = question;
    button.dataset.question = question;

    button.addEventListener("click", () => {
      openHelpChat();
      sendHelpQuestion(question);
    });

    helpChatSuggestions.appendChild(button);
  });
}

function ensureHelpWelcomeMessage(){
  if(helpChatMessages.children.length > 0) return;

  const context = getCurrentHelpContext();
  appendHelpMessage(context.welcome, "bot");
}

function openHelpChat(){
  renderHelpSuggestions();
  helpChatPanel.classList.add("open");
  helpChatPanel.setAttribute("aria-hidden", "false");

  const loaded = loadHelpChatHistory();
  if(!loaded){
    ensureHelpWelcomeMessage();
  }

  helpChatInput.focus();
}

function closeHelpChat(){
  helpChatPanel.classList.remove("open");
  helpChatPanel.setAttribute("aria-hidden", "true");
}

function sendHelpQuestion(question){
  const cleanQuestion = question.trim();
  if(!cleanQuestion) return;

  appendHelpMessage(cleanQuestion, "user");

  setTimeout(() => {
    const answer = getHelpAnswer(cleanQuestion);
    appendHelpMessage(answer, "bot");
  }, 180);
}

function clearHelpChat(){
  localStorage.removeItem(HELP_CHAT_STORAGE_KEY);
  helpChatMessages.innerHTML = "";
  ensureHelpWelcomeMessage();
}

helpChatToggle.addEventListener("click", () => {
  if(helpChatPanel.classList.contains("open")){
    closeHelpChat();
  }else{
    openHelpChat();
  }
});

helpChatClose.addEventListener("click", closeHelpChat);

helpChatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const question = helpChatInput.value;
  if(!question.trim()) return;

  sendHelpQuestion(question);
  helpChatInput.value = "";
});

helpClearChat.addEventListener("click", clearHelpChat);

helpOpenGuide.addEventListener("click", () => {
  window.open("guia.html", "_blank");
});

/* atualiza sugestões quando trocar de aba */
const originalGoPage = typeof goPage === "function" ? goPage : null;

if(originalGoPage){
  goPage = function(id, btn){
    originalGoPage(id, btn);
    renderHelpSuggestions();

    if(helpChatMessages.children.length === 0){
      ensureHelpWelcomeMessage();
    }
  };
}

/* inicializa */
renderHelpSuggestions();
ensureHelpWelcomeMessage();