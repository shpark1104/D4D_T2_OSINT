const IOC_COLOR_CLASS = {
  ipv4: "ioc-ipv4",
  domain: "ioc-domain",
  url: "ioc-url",
  email: "ioc-email",
  md5: "ioc-hash",
  sha1: "ioc-hash",
  sha256: "ioc-hash",
  btc_address: "ioc-wallet",
  eth_address: "ioc-wallet",
  telegram: "ioc-telegram",
  discord_id: "ioc-telegram",
  cve: "ioc-cve",
  mitre_attack_id: "ioc-cve"
};

const state = {
  session: null,
  pendingFiles: [],
  documents: { data: [], totalCount: 0, cursor: null },
  currentDoc: null,
  semanticHighlights: null,
  highlightMode: "ioc",
  filters: { module: "", sort: "recent" },
  stagedIocs: []
};

const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Lightweight term-based highlight for search-result snippets (M4). The full
// offset-accurate highlighting lives in buildHighlightHtml for the document
// viewer (M5a); snippets only need to mark the IOCs that matched this result.
function highlightTerms(text, terms) {
  let html = escapeHtml(text);
  for (const term of (terms || []).filter(Boolean)) {
    const pattern = new RegExp(escapeRegExp(escapeHtml(term)), "gi");
    html = html.replace(pattern, (match) => `<mark>${match}</mark>`);
  }
  return html;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Request failed");
  return data;
}

// --- Rail: IOCs / entities / quotas ---

function renderIocs() {
  const list = $("#iocList");
  const iocs = state.session ? state.session.iocs : [];
  if (!iocs.length) {
    list.className = "chips muted";
    list.textContent = "No IOC";
    return;
  }

  list.className = "chips";
  list.innerHTML = "";
  for (const ioc of iocs) {
    const chip = document.createElement("button");
    chip.className = `chip ${IOC_COLOR_CLASS[ioc.type] || "ioc-generic"}${ioc.queried ? " queried" : ""}`;
    chip.textContent = `${ioc.type}: ${ioc.value}`;
    chip.title = `${ioc.extraction_method} · confidence ${ioc.confidence}${ioc.queried ? " · 조회됨" : ""}\n드래그: 대기열에 추가 · 클릭: 즉시 단일 조회`;
    chip.draggable = true;
    chip.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("application/json", JSON.stringify({ type: ioc.type, value: ioc.value }));
      event.dataTransfer.effectAllowed = "copy";
    });
    chip.addEventListener("click", () => runSearch(ioc.value, ioc.type));
    list.appendChild(chip);
  }
}

// --- StealthMole query tray (drag IOC chips here, then run in a batch) ---

function renderStageTray() {
  const tray = $("#stageTray");
  const runBtn = $("#runQueryBtn");
  if (!state.stagedIocs.length) {
    tray.className = "stage-tray muted";
    tray.textContent = "왼쪽 IOC 칩을 여기로 드래그하세요";
    runBtn.disabled = true;
    return;
  }

  tray.className = "stage-tray";
  tray.innerHTML = "";
  for (const ioc of state.stagedIocs) {
    const chip = document.createElement("button");
    chip.className = `chip ${IOC_COLOR_CLASS[ioc.type] || "ioc-generic"}`;
    chip.textContent = `${ioc.type}: ${ioc.value} ×`;
    chip.title = "클릭하면 대기열에서 제거";
    chip.addEventListener("click", () => {
      state.stagedIocs = state.stagedIocs.filter((staged) => !(staged.type === ioc.type && staged.value === ioc.value));
      renderStageTray();
    });
    tray.appendChild(chip);
  }
  runBtn.disabled = false;
}

function stageIoc(ioc) {
  const exists = state.stagedIocs.some((staged) => staged.type === ioc.type && staged.value === ioc.value);
  if (!exists) state.stagedIocs.push(ioc);
  renderStageTray();
}

async function runStagedQuery() {
  if (!state.stagedIocs.length) return;
  const runBtn = $("#runQueryBtn");
  runBtn.disabled = true;
  runBtn.textContent = "조회 중...";
  try {
    await submitQuery({ iocs: state.stagedIocs });
    state.stagedIocs = [];
    renderStageTray();
  } catch (error) {
    alert(`StealthMole 조회 실패: ${error.message}`);
  } finally {
    runBtn.textContent = "StealthMole 조회 실행";
    runBtn.disabled = !state.stagedIocs.length;
  }
}

function renderEntities() {
  const box = $("#entityList");
  const entities = state.session ? state.session.entities : [];
  if (!entities.length) {
    box.className = "muted";
    box.textContent = "No entity";
    return;
  }
  box.className = "";
  box.innerHTML = "";
  for (const entity of entities) {
    const row = document.createElement("div");
    row.className = "entity-row";
    row.innerHTML = `<strong>${escapeHtml(entity.type)}</strong>: ${escapeHtml(entity.value)}`;
    row.title = entity.reasoning || "";
    box.appendChild(row);
  }
}

async function refreshQuotas() {
  try {
    const quotas = await api("/api/quotas");
    const box = $("#quotaList");
    const entries = Object.entries(quotas);
    if (!entries.length) {
      box.className = "muted";
      box.textContent = "-";
      return;
    }
    box.className = "";
    box.innerHTML = entries
      .map(([module, q]) => `<div class="quota-row">${escapeHtml(module)}: ${q.used}/${q.allowed}</div>`)
      .join("");
  } catch {
    // quota display is best-effort
  }
}

// --- Chat / intake ---

function renderChatThread() {
  const box = $("#chatThread");
  const messages = state.session ? state.session.messages : [];
  if (!messages.length) {
    box.className = "chat-thread muted";
    box.textContent = "아직 업로드된 내용이 없습니다.";
    return;
  }
  box.className = "chat-thread";
  box.innerHTML = messages
    .map((message) => {
      const files = message.files.length
        ? `<div class="msg-files">${message.files.map((f) => `📎 ${escapeHtml(f.name)}`).join(" ")}</div>`
        : "";
      return `<div class="msg msg-${message.role}"><div class="msg-text">${escapeHtml(message.text)}</div>${files}</div>`;
    })
    .join("");
  box.scrollTop = box.scrollHeight;
}

function renderPendingFiles() {
  const box = $("#pendingFiles");
  if (!state.pendingFiles.length) {
    box.className = "muted";
    box.textContent = "첨부 파일 없음";
    return;
  }
  box.className = "";
  box.textContent = `첨부됨: ${state.pendingFiles.map((f) => f.name).join(", ")}`;
}

async function addFiles(fileList) {
  for (const file of Array.from(fileList || [])) {
    const content = await file.text().catch(() => "");
    state.pendingFiles.push({ name: file.name, content });
  }
  renderPendingFiles();
}

async function analyze() {
  const message = $("#message").value;
  if (!message.trim() && !state.pendingFiles.length) return;

  const files = state.pendingFiles;
  $("#analyze").disabled = true;
  $("#analyze").textContent = "분석 중...";
  try {
    const session = await api(`/api/sessions/${state.session.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ message, files })
    });
    state.session = session;
    state.pendingFiles = [];
    $("#message").value = "";
    $("#title").textContent = session.title;
    renderPendingFiles();
    renderChatThread();
    renderIocs();
    renderEntities();
    await loadDocuments({ reset: true });
  } catch (error) {
    alert(`분석 실패: ${error.message}`);
  } finally {
    $("#analyze").disabled = false;
    $("#analyze").textContent = "분석 시작";
  }
}

// --- Results list (M4) ---

function renderResultsCount() {
  if (!state.documents.totalCount) {
    $("#resultsCount").textContent = "";
    return;
  }
  const byModule = Object.entries(state.session.moduleCounts || {})
    .map(([module, count]) => `${module}:${count}`)
    .join(" ");
  $("#resultsCount").textContent = `${state.documents.totalCount}건 (${byModule})`;
}

function renderResultsList() {
  const box = $("#resultsList");
  const docs = state.documents.data;
  if (!docs.length) {
    box.className = "results-list muted";
    box.textContent = "No reports yet";
    $("#loadMore").hidden = true;
    return;
  }

  box.className = "results-list";
  box.innerHTML = "";
  for (const doc of docs) {
    const card = document.createElement("div");
    card.className = "result";
    const snippet = (doc.content || "").slice(0, 220);
    card.innerHTML = `
      <div class="result-head">
        <strong>${escapeHtml(doc.title)}</strong>
        <span class="badge">${escapeHtml(doc.module.toUpperCase())}</span>
      </div>
      <div class="result-meta muted">${escapeHtml(doc.forum_name || "-")} · ${escapeHtml(doc.timestamp || "-")}</div>
      <p class="result-snippet">${highlightTerms(snippet, doc.matched_iocs)}${snippet.length === 220 ? "…" : ""}</p>
      <div class="result-tags">${(doc.matched_iocs || []).map((v) => `<span class="tag">${escapeHtml(v)}</span>`).join("")}</div>
    `;
    card.addEventListener("click", () => openDocument(doc.id));
    box.appendChild(card);
  }
  $("#loadMore").hidden = state.documents.cursor === null;
}

async function loadDocuments({ reset = false } = {}) {
  const cursor = reset ? 0 : state.documents.cursor || 0;
  const params = new URLSearchParams({
    module: state.filters.module,
    sort: state.filters.sort,
    cursor: String(cursor),
    limit: "20"
  });
  const page = await api(`/api/sessions/${state.session.id}/documents?${params.toString()}`);
  state.documents = reset ? page : { ...page, data: [...state.documents.data, ...page.data] };
  renderResultsList();
  renderResultsCount();
}

// --- Document viewer (M5a/M5b) ---

function buildHighlightHtml(text, iocSpans, semanticHighlights, mode) {
  const boundaries = new Set([0, text.length]);
  const spans = [];

  if (mode === "ioc" || mode === "all") {
    for (const ioc of iocSpans || []) {
      boundaries.add(ioc.offset.start);
      boundaries.add(ioc.offset.end);
      spans.push({ start: ioc.offset.start, end: ioc.offset.end, kind: "ioc", type: ioc.type, value: ioc.value });
    }
  }
  if ((mode === "semantic" || mode === "all") && semanticHighlights) {
    for (const highlight of semanticHighlights) {
      boundaries.add(highlight.offset.start);
      boundaries.add(highlight.offset.end);
      spans.push({
        start: highlight.offset.start,
        end: highlight.offset.end,
        kind: "semantic",
        category: highlight.category,
        rationale: highlight.rationale
      });
    }
  }

  const sorted = Array.from(boundaries).sort((a, b) => a - b);
  let html = "";
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const segStart = sorted[i];
    const segEnd = sorted[i + 1];
    if (segStart >= segEnd) continue;
    const segText = escapeHtml(text.slice(segStart, segEnd));
    const covering = spans.filter((s) => s.start <= segStart && s.end >= segEnd);
    if (!covering.length) {
      html += segText;
      continue;
    }
    const classes = covering
      .map((c) => (c.kind === "ioc" ? `hl-ioc ${IOC_COLOR_CLASS[c.type] || "ioc-generic"}` : `hl-semantic semantic-${c.category}`))
      .join(" ");
    const iocSpan = covering.find((c) => c.kind === "ioc");
    const title = covering
      .map((c) => (c.kind === "ioc" ? `${c.type}: ${c.value}` : `${c.category}: ${c.rationale}`))
      .join(" | ");
    const dataAttrs = iocSpan ? `data-ioc-type="${escapeHtml(iocSpan.type)}" data-ioc-value="${escapeHtml(iocSpan.value)}"` : "";
    html += `<span class="hl ${classes}" title="${escapeHtml(title)}" ${dataAttrs}>${segText}</span>`;
  }
  return html;
}

function renderDocumentViewer() {
  const doc = state.currentDoc;
  if (!doc) {
    $("#docTitle").textContent = "문서를 선택하세요";
    $("#docMeta").textContent = "";
    $("#document").textContent = "왼쪽 목록에서 문서를 클릭하면 여기에 표시됩니다.";
    return;
  }
  $("#docTitle").textContent = doc.title;
  $("#docMeta").textContent = `${doc.module.toUpperCase()} · ${doc.forum_name || "-"} · ${doc.timestamp || "-"}${doc.source_url ? " · " + doc.source_url : ""}`;
  $("#document").innerHTML = buildHighlightHtml(doc.content || "", doc.iocSpans, state.semanticHighlights, state.highlightMode);
}

async function openDocument(docId) {
  const doc = await api(`/api/sessions/${state.session.id}/documents/${encodeURIComponent(docId)}`);
  state.currentDoc = doc;
  state.semanticHighlights = null;
  renderDocumentViewer();
  if (state.highlightMode === "semantic" || state.highlightMode === "all") {
    await loadSemanticHighlights();
  }
}

async function loadSemanticHighlights() {
  if (!state.currentDoc) return;
  const data = await api(`/api/sessions/${state.session.id}/documents/${encodeURIComponent(state.currentDoc.id)}/semantic`);
  state.semanticHighlights = data.highlights;
  renderDocumentViewer();
}

async function setHighlightMode(mode) {
  state.highlightMode = mode;
  document.querySelectorAll(".hl-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.mode === mode));
  if ((mode === "semantic" || mode === "all") && state.currentDoc && !state.semanticHighlights) {
    await loadSemanticHighlights();
  } else {
    renderDocumentViewer();
  }
}

// --- Search (manual form, IOC chip click, IOC click-in-doc, drag-to-search) ---

// IOC-typed search: used by IOC chip clicks, in-document IOC clicks, and
// drag-to-search. Auto-routes across StealthMole modules via the IOC type.
async function runSearch(value, iocType) {
  const query = String(value || "").trim();
  if (!query || !state.session) return;
  await submitQuery(iocType ? { iocs: [{ type: iocType, value: query }] } : { query });
}

// Manual search form: user picked a specific StealthMole module directly,
// bypassing the IOC-type routing table.
async function runModuleSearch(value, module) {
  const query = String(value || "").trim();
  if (!query || !state.session) return;
  await submitQuery(module ? { module, query } : { query });
}

async function submitQuery(body) {
  await api(`/api/sessions/${state.session.id}/query`, {
    method: "POST",
    body: JSON.stringify(body)
  });
  state.session = await api(`/api/sessions/${state.session.id}`);
  renderIocs();
  await loadDocuments({ reset: true });
}

function hideSelectionMenu() {
  $("#selectionMenu").hidden = true;
}

function boot() {
  $("#analyze").addEventListener("click", analyze);

  $("#dropzone").addEventListener("click", () => $("#files").click());
  $("#dropzone").addEventListener("dragover", (event) => {
    event.preventDefault();
    $("#dropzone").classList.add("drag-over");
  });
  $("#dropzone").addEventListener("dragleave", () => $("#dropzone").classList.remove("drag-over"));
  $("#dropzone").addEventListener("drop", (event) => {
    event.preventDefault();
    $("#dropzone").classList.remove("drag-over");
    addFiles(event.dataTransfer.files);
  });
  $("#files").addEventListener("change", (event) => addFiles(event.target.files));

  $("#stageTray").addEventListener("dragover", (event) => {
    event.preventDefault();
    $("#stageTray").classList.add("drag-over");
  });
  $("#stageTray").addEventListener("dragleave", () => $("#stageTray").classList.remove("drag-over"));
  $("#stageTray").addEventListener("drop", (event) => {
    event.preventDefault();
    $("#stageTray").classList.remove("drag-over");
    const raw = event.dataTransfer.getData("application/json");
    if (!raw) return;
    try {
      stageIoc(JSON.parse(raw));
    } catch {
      // ignore malformed drag payloads
    }
  });
  $("#runQueryBtn").addEventListener("click", runStagedQuery);

  $("#searchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const service = $("#service").value;
    const query = $("#query").value;
    runModuleSearch(query, service || undefined);
  });

  $("#moduleFilter").addEventListener("change", (event) => {
    state.filters.module = event.target.value;
    loadDocuments({ reset: true });
  });
  $("#sortOrder").addEventListener("change", (event) => {
    state.filters.sort = event.target.value;
    loadDocuments({ reset: true });
  });
  $("#loadMore").addEventListener("click", () => loadDocuments({ reset: false }));

  document.querySelectorAll(".hl-btn").forEach((btn) => {
    btn.addEventListener("click", () => setHighlightMode(btn.dataset.mode));
  });

  $("#document").addEventListener("click", (event) => {
    const target = event.target.closest(".hl-ioc");
    if (!target) return;
    runSearch(target.dataset.iocValue, target.dataset.iocType);
  });

  $("#document").addEventListener("mouseup", (event) => {
    const text = window.getSelection().toString().trim();
    if (text.length < 3 || text.length > 200) {
      hideSelectionMenu();
      return;
    }
    const menu = $("#selectionMenu");
    menu.hidden = false;
    menu.style.left = `${event.pageX}px`;
    menu.style.top = `${event.pageY + 10}px`;
    $("#selectionSearchBtn").onclick = () => {
      runSearch(text);
      hideSelectionMenu();
    };
  });
  document.addEventListener("mousedown", (event) => {
    if (!event.target.closest("#selectionMenu") && !event.target.closest("#document")) hideSelectionMenu();
  });

  init().catch((error) => console.error(error));
}

async function init() {
  const health = await api("/api/health");
  $("#mode").textContent = `StealthMole: ${health.stealthmoleMock ? "mock" : "live"} · LLM: ${health.llmEnabled ? "on" : "off"}`;

  state.session = await api("/api/sessions", { method: "POST", body: JSON.stringify({ title: "New incident" }) });
  $("#title").textContent = state.session.title;
  renderChatThread();
  renderIocs();
  renderEntities();
  renderStageTray();
  await refreshQuotas();
  await loadDocuments({ reset: true });
}

boot();
