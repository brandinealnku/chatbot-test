(() => {
  const existing = document.getElementById("smb-chatbot-widget-root");
  if (existing) return;

  const config = window.MyChatbotConfig || {};
  const chatbotId = config.chatbotId;
  const apiBaseUrl = (config.apiBaseUrl || "").replace(/\/$/, "") || window.location.origin;

  if (!chatbotId) {
    console.error("Chatbot widget: missing chatbotId in window.MyChatbotConfig");
    return;
  }

  const state = {
    open: false,
    bot: null,
    messages: []
  };

  const style = document.createElement("style");
  style.textContent = `
    #smb-chatbot-widget-root{
      all: initial;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .smb-chatbot-launcher{
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 2147483647;
      border: none;
      border-radius: 999px;
      padding: 14px 18px;
      cursor: pointer;
      color: #fff;
      font-weight: 700;
      box-shadow: 0 12px 30px rgba(0,0,0,.25);
    }
    .smb-chatbot-panel{
      position: fixed;
      right: 20px;
      bottom: 82px;
      width: min(380px, calc(100vw - 24px));
      height: 560px;
      background: #ffffff;
      border: 1px solid rgba(15,23,42,.12);
      border-radius: 18px;
      box-shadow: 0 20px 50px rgba(0,0,0,.22);
      z-index: 2147483647;
      overflow: hidden;
      display: none;
      color: #0f172a;
    }
    .smb-chatbot-top{
      color: #fff;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .smb-chatbot-title{font-weight: 800; font-size: 15px}
    .smb-chatbot-subtitle{font-size: 12px; opacity: .9}
    .smb-chatbot-close{
      border:none;background:rgba(255,255,255,.18);color:#fff;width:34px;height:34px;border-radius:999px;cursor:pointer;font-size:18px
    }
    .smb-chatbot-messages{
      height: 394px;
      overflow: auto;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: #f8fafc;
    }
    .smb-chatbot-bubble{
      max-width: 84%;
      padding: 11px 13px;
      border-radius: 14px;
      font-size: 14px;
      line-height: 1.4;
      white-space: pre-wrap;
    }
    .smb-chatbot-assistant{
      align-self: flex-start;
      background: #e2e8f0;
      color: #0f172a;
      border-top-left-radius: 6px;
    }
    .smb-chatbot-user{
      align-self: flex-end;
      color: #fff;
      border-top-right-radius: 6px;
    }
    .smb-chatbot-inputbar{
      border-top: 1px solid rgba(15,23,42,.08);
      padding: 12px;
      display: flex;
      gap: 8px;
      background: #fff;
    }
    .smb-chatbot-input{
      flex: 1;
      border: 1px solid rgba(15,23,42,.14);
      border-radius: 12px;
      padding: 12px;
      font: inherit;
      outline: none;
    }
    .smb-chatbot-send{
      border:none;border-radius:12px;color:#fff;padding:0 14px;cursor:pointer;font-weight:700
    }
    .smb-chatbot-lead{
      border-top:1px solid rgba(15,23,42,.08);
      padding:12px;
      background:#fff;
      display:none;
      gap:8px;
      flex-direction:column;
    }
    .smb-chatbot-lead input{
      border:1px solid rgba(15,23,42,.14);
      border-radius:12px;
      padding:10px;
      font: inherit;
    }
    .smb-chatbot-lead button{
      border:none;border-radius:12px;color:#fff;padding:11px 12px;cursor:pointer;font-weight:700
    }
  `;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.id = "smb-chatbot-widget-root";

  const launcher = document.createElement("button");
  launcher.className = "smb-chatbot-launcher";
  launcher.textContent = "Chat with us";

  const panel = document.createElement("div");
  panel.className = "smb-chatbot-panel";

  const top = document.createElement("div");
  top.className = "smb-chatbot-top";

  const topText = document.createElement("div");
  topText.innerHTML = `<div class="smb-chatbot-title">Website Assistant</div><div class="smb-chatbot-subtitle">Ready to help</div>`;

  const closeBtn = document.createElement("button");
  closeBtn.className = "smb-chatbot-close";
  closeBtn.innerHTML = "&times;";

  top.appendChild(topText);
  top.appendChild(closeBtn);

  const messagesEl = document.createElement("div");
  messagesEl.className = "smb-chatbot-messages";

  const leadEl = document.createElement("div");
  leadEl.className = "smb-chatbot-lead";

  const inputBar = document.createElement("div");
  inputBar.className = "smb-chatbot-inputbar";

  const input = document.createElement("input");
  input.className = "smb-chatbot-input";
  input.placeholder = "Type your message...";

  const sendBtn = document.createElement("button");
  sendBtn.className = "smb-chatbot-send";
  sendBtn.textContent = "Send";

  inputBar.appendChild(input);
  inputBar.appendChild(sendBtn);

  panel.appendChild(top);
  panel.appendChild(messagesEl);
  panel.appendChild(leadEl);
  panel.appendChild(inputBar);

  root.appendChild(launcher);
  root.appendChild(panel);
  document.body.appendChild(root);

  function getThemeColor() {
    return state.bot?.theme?.primaryColor || "#2563eb";
  }

  function applyTheme() {
    const color = getThemeColor();
    launcher.style.background = color;
    sendBtn.style.background = color;
    top.style.background = color;
  }

  function addMessage(role, text) {
    const bubble = document.createElement("div");
    bubble.className = `smb-chatbot-bubble ${role === "assistant" ? "smb-chatbot-assistant" : "smb-chatbot-user"}`;
    bubble.textContent = text;
    if (role === "user") {
      bubble.style.background = getThemeColor();
    }
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function maybeRenderLeadForm() {
    if (!state.bot?.leadCapture?.enabled || !state.bot?.leadCapture?.fields?.length) {
      leadEl.style.display = "none";
      return;
    }

    leadEl.innerHTML = "";
    const heading = document.createElement("div");
    heading.style.fontWeight = "800";
    heading.textContent = "Want follow-up?";
    leadEl.appendChild(heading);

    const inputs = {};
    state.bot.leadCapture.fields.forEach(fieldName => {
      const el = document.createElement("input");
      el.placeholder = fieldName;
      inputs[fieldName] = el;
      leadEl.appendChild(el);
    });

    const btn = document.createElement("button");
    btn.textContent = "Submit";
    btn.style.background = getThemeColor();
    btn.addEventListener("click", async () => {
      const fields = {};
      Object.entries(inputs).forEach(([key, inputEl]) => {
        fields[key] = inputEl.value.trim();
      });

      try {
        const res = await fetch(`${apiBaseUrl}/api/leads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatbotId,
            fields
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Lead submission failed.");
        addMessage("assistant", "Thanks — your details were submitted.");
        leadEl.style.display = "none";
      } catch (err) {
        addMessage("assistant", `Sorry — ${err.message}`);
      }
    });

    leadEl.appendChild(btn);
    leadEl.style.display = "flex";
  }

  async function loadBot() {
    const res = await fetch(`${apiBaseUrl}/api/chatbots/${encodeURIComponent(chatbotId)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load chatbot.");
    state.bot = data;

    topText.innerHTML = `<div class="smb-chatbot-title">${escapeHtml(data.businessName || "Website Assistant")}</div>
      <div class="smb-chatbot-subtitle">${escapeHtml(data.primaryGoal || "Ready to help")}</div>`;
    launcher.textContent = data.theme?.launcherText || "Chat with us";
    applyTheme();
    addMessage("assistant", `Hi! Welcome to ${data.businessName || "our business"}. How can I help today?`);
    maybeRenderLeadForm();
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    addMessage("user", text);
    state.messages.push({ role: "user", content: text });
    input.value = "";

    try {
      const res = await fetch(`${apiBaseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatbotId,
          messages: state.messages
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chat request failed.");

      addMessage("assistant", data.reply);
      state.messages.push({ role: "assistant", content: data.reply });
    } catch (err) {
      addMessage("assistant", `Sorry — ${err.message}`);
    }
  }

  launcher.addEventListener("click", () => {
    state.open = !state.open;
    panel.style.display = state.open ? "block" : "none";
  });

  closeBtn.addEventListener("click", () => {
    state.open = false;
    panel.style.display = "none";
  });

  sendBtn.addEventListener("click", sendMessage);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  });

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  loadBot().catch(err => {
    console.error(err);
    addMessage("assistant", `Widget failed to load: ${err.message}`);
    panel.style.display = "block";
    state.open = true;
  });
})();
