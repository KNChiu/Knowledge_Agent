// Thin fetch wrappers around the /api/* endpoints.

async function asJson(res) {
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

export async function listConcepts() {
  return asJson(await fetch("/api/concepts"));
}

export async function readConcept(file) {
  return asJson(await fetch(`/api/concepts/${encodeURIComponent(file)}`));
}

export async function updateConcept(file, content) {
  return asJson(
    await fetch(`/api/concepts/${encodeURIComponent(file)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }),
  );
}

export async function deleteConcept(file) {
  return asJson(await fetch(`/api/concepts/${encodeURIComponent(file)}`, { method: "DELETE" }));
}

export async function uploadFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  return asJson(await fetch("/api/upload", { method: "POST", body: fd }));
}

// Open the chat SSE stream; returns the Response so the caller can read the body.
export async function openChatStream(query) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  return res;
}
