// Small shared UI helpers: escaping, toasts, clipboard, icons.

export function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const toastHost = document.getElementById("toastHost");

export function toast(message, kind = "") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = message;
  toastHost.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

export async function copyText(text, ok = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast(ok);
  } catch {
    toast("Couldn't copy to clipboard", "error");
  }
}

export const ICONS = {
  activity:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
    '<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h10"/></svg>',
  copy:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
    '<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V5a2 2 0 012-2h9a2 2 0 012 2v9a2 2 0 01-2 2h-2M5 8h9a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2v-9a2 2 0 012-2z"/></svg>',
};

// Wrap each <pre> produced by marked with a copy button.
export function enhanceCodeBlocks(root) {
  for (const pre of root.querySelectorAll("pre")) {
    if (pre.parentElement?.classList.contains("code-wrap")) continue;
    const wrap = document.createElement("div");
    wrap.className = "code-wrap";
    pre.replaceWith(wrap);
    wrap.appendChild(pre);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy-code";
    btn.innerHTML = `${ICONS.copy}<span>Copy</span>`;
    btn.addEventListener("click", () => copyText(pre.innerText, "Code copied"));
    wrap.appendChild(btn);
  }
}
