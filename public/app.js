// App shell: view/tab switching, mobile drawer, file upload; wires modules.

import { initChat } from "./chat.js";
import { initConcepts, loadConcepts } from "./concepts.js";
import { toast } from "./ui.js";

const chatView = document.getElementById("chatView");
const readingView = document.getElementById("readingView");
const chatTab = document.getElementById("chatTab");
const readingTab = document.getElementById("readingTab");
const readingTabClose = document.getElementById("readingTabClose");
const readingActions = document.getElementById("readingActions");
const workspace = document.getElementById("workspace");
const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");
const scrim = document.getElementById("scrim");

// ── View switching ─────────────────────────
function showChat() {
  chatView.classList.add("active");
  readingView.classList.remove("active");
  chatTab.classList.add("active");
  readingTab.classList.remove("active");
}

function showReading() {
  readingView.classList.add("active");
  chatView.classList.remove("active");
  readingTab.classList.add("active");
  chatTab.classList.remove("active");
}

function closeReadingTab() {
  readingTab.classList.remove("show");
  readingActions.classList.remove("show");
  showChat();
}

chatTab.addEventListener("click", showChat);
readingTab.addEventListener("click", () => { if (readingTab.classList.contains("show")) showReading(); });
readingTabClose.addEventListener("click", (e) => { e.stopPropagation(); closeReadingTab(); });

// ── Mobile drawer ──────────────────────────
function openDrawer() { sidebar.classList.add("open"); workspace.classList.add("drawer-open"); }
function closeDrawer() { sidebar.classList.remove("open"); workspace.classList.remove("drawer-open"); }
menuBtn.addEventListener("click", () => (sidebar.classList.contains("open") ? closeDrawer() : openDrawer()));
scrim.addEventListener("click", closeDrawer);

const shell = { showChat, showReading, closeReadingTab, closeDrawer };

// ── File upload ────────────────────────────
const uploadZone = document.getElementById("uploadZone");
const fileInput = document.getElementById("fileInput");
const uploadLabel = uploadZone.querySelector(".upload-label");

fileInput.addEventListener("change", () => handleFiles(fileInput.files));
uploadZone.addEventListener("dragover", (e) => { e.preventDefault(); uploadZone.classList.add("drag-over"); });
uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("drag-over"));
uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadZone.classList.remove("drag-over");
  handleFiles(e.dataTransfer.files);
});

async function handleFiles(files) {
  if (!files || files.length === 0) return;
  uploadZone.classList.add("uploading");

  for (const file of Array.from(files)) {
    uploadLabel.textContent = `Uploading ${file.name}…`;
    try {
      const { file: saved } = await (await import("./api.js")).uploadFile(file);
      await loadConcepts(saved); // refresh list and open the new concept
      toast(`Saved “${saved}”`);
    } catch (err) {
      toast(`Upload failed: ${err.message}`, "error");
    }
  }

  uploadZone.classList.remove("uploading");
  uploadLabel.textContent = "↑ Upload file";
  fileInput.value = "";
}

// ── Boot ───────────────────────────────────
initChat(shell);
initConcepts(shell);
