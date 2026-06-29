// Sidebar concept browser: list, search/filter, open, edit, delete.

import * as api from "./api.js";
import { escapeHtml, toast, enhanceCodeBlocks } from "./ui.js";

const conceptList = document.getElementById("conceptList");
const searchInput = document.getElementById("searchInput");
const readingBody = document.getElementById("readingBody");
const readingTab = document.getElementById("readingTab");
const readingTabLabel = document.getElementById("readingTabLabel");
const readingActions = document.getElementById("readingActions");
const editBtn = document.getElementById("editBtn");
const deleteBtn = document.getElementById("deleteBtn");

let shell; // { showReading, showChat, closeReadingTab }
let allConcepts = []; // full list from the API (for client-side filtering)
let activeItem = null;
let currentFile = null; // the concept open in the reading view
let currentContent = ""; // its full markdown (incl. frontmatter)
let editing = false;

const renderMarkdown = (content) => {
  const body = content.replace(/^---[\s\S]*?---\r?\n?/, "");
  readingBody.innerHTML = marked.parse(body);
  enhanceCodeBlocks(readingBody);
};

export function initConcepts(s) {
  shell = s;
  searchInput.addEventListener("input", debounce(applyFilter, 120));
  editBtn.addEventListener("click", toggleEdit);
  deleteBtn.addEventListener("click", removeCurrent);
  loadConcepts();
}

export async function loadConcepts(selectFile) {
  try {
    allConcepts = await api.listConcepts();
    renderList();
    if (selectFile) {
      const item = [...conceptList.querySelectorAll(".concept-item")].find(
        (el) => el.dataset.file === selectFile,
      );
      item?.click();
    }
  } catch (err) {
    conceptList.innerHTML = `<div class="sidebar-msg error">Couldn't load concepts: ${escapeHtml(err.message)}</div>`;
  }
}

function renderList() {
  const q = searchInput.value.trim().toLowerCase();
  const matches = !q
    ? allConcepts
    : allConcepts.filter((c) => {
        const hay = [c.name, c.type, ...(c.tags ?? [])].join(" ").toLowerCase();
        return hay.includes(q);
      });

  conceptList.innerHTML = "";
  if (!allConcepts.length) {
    conceptList.innerHTML = '<div class="sidebar-msg">No concepts yet. Upload a file to start.</div>';
    return;
  }
  if (!matches.length) {
    conceptList.innerHTML = '<div class="sidebar-msg">No matches.</div>';
    return;
  }

  for (const c of matches) {
    const el = document.createElement("div");
    el.className = "concept-item";
    el.innerHTML = `
      <div class="concept-name">${escapeHtml(c.name ?? c.path)}</div>
      <div class="concept-type">${escapeHtml(c.type ?? "")}</div>`;
    el.dataset.file = c.path;
    if (c.path === currentFile) { el.classList.add("active"); activeItem = el; }
    el.addEventListener("click", () => openConcept(c.path, el));
    conceptList.appendChild(el);
  }
}

const applyFilter = () => renderList();

async function openConcept(file, el) {
  if (activeItem) activeItem.classList.remove("active");
  el.classList.add("active");
  activeItem = el;
  editing = false;

  const title = el.querySelector(".concept-name")?.textContent ?? file;
  readingTabLabel.textContent = title;
  readingTabLabel.title = title;
  readingTab.classList.add("show");
  readingActions.classList.add("show");
  shell.showReading();
  shell.closeDrawer?.();

  readingBody.innerHTML = '<div class="placeholder"><span>Loading…</span></div>';
  try {
    const { content } = await api.readConcept(file);
    currentFile = file;
    currentContent = content;
    setEditLabel(false);
    renderMarkdown(content);
  } catch (err) {
    readingBody.innerHTML = `<div class="placeholder"><span style="color:var(--danger)">${escapeHtml(err.message)}</span></div>`;
  }
}

function setEditLabel(isEditing) {
  editBtn.querySelector(".label-text").textContent = isEditing ? "View" : "Edit";
}

function toggleEdit() {
  if (!currentFile) return;
  editing = !editing;
  setEditLabel(editing);

  if (!editing) {
    renderMarkdown(currentContent);
    return;
  }

  readingBody.innerHTML = `
    <div class="editor-wrap">
      <textarea class="editor-area" id="editorArea" spellcheck="false"></textarea>
      <div class="editor-actions">
        <button type="button" class="icon-btn" id="editCancel">Cancel</button>
        <button type="button" class="icon-btn primary" id="editSave">Save</button>
      </div>
    </div>`;
  const area = document.getElementById("editorArea");
  area.value = currentContent;
  area.focus();
  document.getElementById("editCancel").addEventListener("click", toggleEdit);
  document.getElementById("editSave").addEventListener("click", () => saveCurrent(area.value));
}

async function saveCurrent(content) {
  try {
    await api.updateConcept(currentFile, content);
    currentContent = content;
    editing = false;
    setEditLabel(false);
    renderMarkdown(content);
    toast("Saved");
    loadConcepts(); // type/name may have changed in the frontmatter
  } catch (err) {
    toast(`Save failed: ${err.message}`, "error");
  }
}

async function removeCurrent() {
  if (!currentFile) return;
  if (!confirm(`Delete “${currentFile}”? This cannot be undone.`)) return;
  try {
    const file = currentFile;
    await api.deleteConcept(file);
    toast(`Deleted “${file}”`);
    currentFile = null;
    currentContent = "";
    activeItem = null;
    readingActions.classList.remove("show");
    shell.closeReadingTab();
    loadConcepts();
  } catch (err) {
    toast(`Delete failed: ${err.message}`, "error");
  }
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
