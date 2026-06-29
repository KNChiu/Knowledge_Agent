// Chat thread: send queries, stream SSE, render markdown, copy messages.

import * as api from "./api.js";
import { escapeHtml, copyText, enhanceCodeBlocks, ICONS } from "./ui.js";

const chatView = document.getElementById("chatView");
const chatThread = document.getElementById("chatThread");
const chatPlaceholder = document.getElementById("chatPlaceholder");
const queryInput = document.getElementById("queryInput");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");

let shell; // { showChat }

const TOOL_LABELS = {
  list_concepts: "Browsing the knowledge base",
  read_concept: "Reading a concept",
  write_concept: "Saving a concept",
};

export function initChat(s) {
  shell = s;
  sendBtn.addEventListener("click", sendQuery);
  clearBtn.addEventListener("click", clearConversation);
  queryInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendQuery(); }
  });
}

function ensureThread() {
  if (chatThread.style.display === "none") {
    chatPlaceholder.style.display = "none";
    chatThread.style.display = "";
    clearBtn.classList.add("show");
  }
}

function clearConversation() {
  chatThread.innerHTML = "";
  chatThread.style.display = "none";
  chatPlaceholder.style.display = "";
  clearBtn.classList.remove("show");
  shell.showChat();
  queryInput.focus();
}

function toolLine(name) {
  return `<div class="tool-line">${ICONS.activity}<span>${escapeHtml(TOOL_LABELS[name] ?? name)}</span></div>`;
}

function appendMessage(role, html, tools = []) {
  ensureThread();
  const msg = document.createElement("div");
  msg.className = `chat-msg ${role}`;
  for (const t of tools) msg.insertAdjacentHTML("beforeend", toolLine(t));

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = html;
  msg.appendChild(bubble);
  chatThread.appendChild(msg);
  chatView.scrollTop = chatView.scrollHeight;
  return bubble;
}

function addCopyButton(msg, getText) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "msg-copy";
  btn.innerHTML = `${ICONS.copy}<span>Copy</span>`;
  btn.addEventListener("click", () => copyText(getText()));
  msg.appendChild(btn);
}

function appendThinking() {
  ensureThread();
  const msg = document.createElement("div");
  msg.className = "chat-msg agent";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = '<div class="thinking"><span></span><span></span><span></span></div>';
  msg.appendChild(bubble);
  chatThread.appendChild(msg);
  chatView.scrollTop = chatView.scrollHeight;
  return msg;
}

async function sendQuery() {
  const query = queryInput.value.trim();
  if (!query) return;

  shell.showChat();
  queryInput.value = "";
  sendBtn.disabled = true;
  appendMessage("user", escapeHtml(query));

  const toolCalls = [];
  let pending = appendThinking();
  let bubble = null;
  let rawText = "";

  const finish = () => {
    if (bubble) {
      bubble.classList.remove("streaming");
      enhanceCodeBlocks(bubble);
      addCopyButton(bubble.parentElement, () => rawText);
    }
    if (pending) { pending.remove(); pending = null; }
    sendBtn.disabled = false;
    queryInput.focus();
  };

  try {
    const res = await api.openChatStream(query);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });

      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";

      for (const part of parts) {
        const eventMatch = part.match(/^event: (\w+)/m);
        const dataMatch = part.match(/^data: (.*)/m);
        if (!eventMatch || !dataMatch) continue;

        const event = eventMatch[1];
        const data = JSON.parse(dataMatch[1]);

        if (event === "tool") {
          toolCalls.push(data);
          if (pending && !bubble) {
            pending.querySelector(".bubble").innerHTML =
              toolLine(data) +
              '<div class="thinking" style="margin-top:6px"><span></span><span></span><span></span></div>';
          }
        } else if (event === "text") {
          rawText += data;
          if (!bubble) {
            if (pending) { pending.remove(); pending = null; }
            bubble = appendMessage("agent", "", toolCalls.splice(0));
          }
          bubble.innerHTML = marked.parse(rawText);
          bubble.classList.add("streaming");
          chatView.scrollTop = chatView.scrollHeight;
        } else if (event === "error") {
          if (pending) { pending.remove(); pending = null; }
          const b = appendMessage("agent", "", toolCalls.splice(0));
          b.classList.add("error");
          b.textContent = `Error: ${data}`;
        }
      }
    }
    finish();
  } catch (err) {
    if (pending) { pending.remove(); pending = null; }
    const b = appendMessage("agent", "");
    b.classList.add("error");
    b.textContent = `Request failed: ${err.message}`;
    finish();
  }
}
