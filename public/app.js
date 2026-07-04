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

const DRAG_IOC = "application/x-d4d-ioc";
const DRAG_NODE = "application/x-d4d-node";
const BTC_ADDRESS_PATTERN = /^(?:[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{25,59})$/;
const ETH_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

const state = {
  session: null,
  llmEnabled: false,
  pendingFiles: [],
  documents: { allData: [], data: [], totalCount: 0, cursor: null, moduleCounts: {} },
  resultsMessage: "조회 결과 없음",
  interestIocs: [],
  searchIoc: null,
  interestNodes: [],
  currentDoc: null,
  currentView: null,
  currentNode: null,
  semanticHighlights: null,
  semanticEnabled: true,
  walletGraph: null,
  relationships: [],
  relationshipLookup: null
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

function shortText(value, length = 96) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

function iocKey(ioc) {
  return `${ioc.type}:${String(ioc.value || "").toLowerCase()}`;
}

function nodeKey(node) {
  return `${node.module || "node"}:${node.id}`;
}

function nodeTypeLabel(node) {
  return node.kind === "evidence" ? "근거자료" : node.module || "node";
}

async function api(path, options = {}) {
  const { headers, ...fetchOptions } = options;
  const response = await fetch(path, {
    ...fetchOptions,
    headers: { "Content-Type": "application/json", ...(headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.detail || "Request failed");
    error.status = response.status;
    error.detail = data.detail;
    throw error;
  }
  return data;
}

async function createSession() {
  state.session = await api("/api/sessions", { method: "POST", body: JSON.stringify({ title: "New incident" }) });
  return state.session;
}

async function sessionApi(pathForSession, options = {}) {
  if (!state.session?.id) await createSession();
  try {
    return await api(pathForSession(state.session.id), options);
  } catch (error) {
    if (error.status !== 404 || error.detail !== "Session not found") throw error;
    console.warn("Session was lost on the server; creating a fresh session and retrying once.");
    await createSession();
    return api(pathForSession(state.session.id), options);
  }
}

function setDrag(event, type, payload) {
  event.dataTransfer.setData(type, JSON.stringify(payload));
  event.dataTransfer.setData("text/plain", payload.value || payload.title || payload.id || "");
  event.dataTransfer.effectAllowed = "copy";
}

function readDrag(event, type) {
  const raw = event.dataTransfer.getData(type);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function hasDragType(event, type) {
  return Array.from(event.dataTransfer.types || []).includes(type);
}

function makeDropTarget(element, dragType, onDrop) {
  element.addEventListener("dragover", (event) => {
    if (!hasDragType(event, dragType)) return;
    event.preventDefault();
    event.stopPropagation();
    element.classList.add("drag-over");
  });
  element.addEventListener("dragleave", () => element.classList.remove("drag-over"));
  element.addEventListener("drop", (event) => {
    const payload = readDrag(event, dragType);
    if (!payload) return;
    event.preventDefault();
    event.stopPropagation();
    element.classList.remove("drag-over");
    onDrop(payload);
  });
}

function makeSearchPanelDropTarget(element) {
  element.addEventListener("dragover", (event) => {
    const hasFiles = Array.from(event.dataTransfer.types || []).includes("Files");
    if (!hasFiles && !hasDragType(event, DRAG_IOC)) return;
    event.preventDefault();
    element.classList.add("drag-over");
  });

  element.addEventListener("dragleave", (event) => {
    if (element.contains(event.relatedTarget)) return;
    element.classList.remove("drag-over");
  });

  element.addEventListener("drop", (event) => {
    const ioc = readDrag(event, DRAG_IOC);
    const files = event.dataTransfer.files;
    if (!ioc && !files.length) return;
    event.preventDefault();
    element.classList.remove("drag-over");

    if (files.length) {
      addFiles(files);
      return;
    }
    setSearchIoc(ioc);
  });
}

function chipClass(type) {
  return IOC_COLOR_CLASS[type] || "ioc-generic";
}

function setViewerLoading(isLoading, text = "처리 중...") {
  const overlay = $("#viewerLoading");
  if (!overlay) return;
  $("#viewerLoadingText").textContent = text;
  overlay.hidden = !isLoading;
}

function renderSemanticToggleStatus() {
  const toggle = $("#semanticToggle");
  const status = $("#semanticToggleStatus");
  if (!toggle || !status) return;
  if (!state.llmEnabled) {
    status.textContent = "OPENAI_API_KEY 없음";
    return;
  }
  status.textContent = state.semanticEnabled ? "의미 구절 밑줄 표시" : "의미 밑줄 숨김";
}

function renderCurrentNodeAction() {
  const addButton = $("#addCurrentNodeBtn");
  if (addButton) {
    addButton.disabled = !state.currentNode;
    addButton.textContent = "+";
    addButton.title = state.currentNode ? "관심 노드 추가" : "표시 중인 노드 없음";
    addButton.setAttribute("aria-label", "관심 노드 추가");
  }
}

// --- Left widgets: analyst-selected IOCs / nodes ---

function addInterestIoc(ioc) {
  if (!ioc || !ioc.value) return;
  const normalized = { type: ioc.type || "keyword", value: String(ioc.value).trim() };
  if (!normalized.value) return;
  if (!state.interestIocs.some((item) => iocKey(item) === iocKey(normalized))) {
    state.interestIocs.push(normalized);
  }
  renderInterestIocs();
}

function removeInterestIoc(ioc) {
  state.interestIocs = state.interestIocs.filter((item) => iocKey(item) !== iocKey(ioc));
  if (state.searchIoc && iocKey(state.searchIoc) === iocKey(ioc)) {
    state.searchIoc = null;
  }
  renderInterestIocs();
  renderSearchTarget();
}

async function copyText(value) {
  const text = String(value || "");
  if (!text) return;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const input = document.createElement("textarea");
  input.value = text;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

function renderInterestIocs() {
  const list = $("#interestIocList");
  const relationshipButton = $("#extractRelationshipsBtn");
  if (relationshipButton) relationshipButton.disabled = !state.interestIocs.length;
  $("#interestIocCount").textContent = String(state.interestIocs.length);
  if (!state.interestIocs.length) {
    list.className = "watch-list drop-target muted";
    list.textContent = "가운데 뷰어의 IOC 하이라이트를 클릭해서 등록";
    return;
  }

  list.className = "watch-list drop-target";
  list.innerHTML = "";
  for (const ioc of state.interestIocs) {
    const row = document.createElement("div");
    row.className = `watch-item ${chipClass(ioc.type)}`;
    row.draggable = true;
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(ioc.type)}</strong>
        <span>${escapeHtml(ioc.value)}</span>
      </div>
      <div class="watch-actions vertical">
        <button class="remove-ioc-btn" type="button" title="제거">x</button>
        <button class="copy-ioc-btn" type="button" title="복사" aria-label="복사">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="9" y="9" width="11" height="11" rx="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
      </div>
    `;
    row.addEventListener("dragstart", (event) => setDrag(event, DRAG_IOC, ioc));
    row.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      setSearchIoc(ioc);
    });
    row.querySelector(".remove-ioc-btn").addEventListener("click", (event) => {
      event.stopPropagation();
      removeInterestIoc(ioc);
    });
    row.querySelector(".copy-ioc-btn").addEventListener("click", (event) => {
      event.stopPropagation();
      copyText(ioc.value).catch((error) => alert(`복사 실패: ${error.message}`));
    });
    list.appendChild(row);
  }
}

function makeNodePayload(doc) {
  return {
    id: doc.id,
    module: doc.module,
    title: doc.title || "(untitled)",
    forum_name: doc.forum_name || "",
    timestamp: doc.timestamp || "",
    query_ioc: doc.query_ioc || null
  };
}

function addInterestNode(node) {
  if (!node || !node.id) return;
  if (!state.interestNodes.some((item) => nodeKey(item) === nodeKey(node))) {
    state.interestNodes.push(node);
  }
  renderInterestNodes();
  renderCurrentNodeAction();
}

function removeInterestNode(node) {
  state.interestNodes = state.interestNodes.filter((item) => nodeKey(item) !== nodeKey(node));
  renderInterestNodes();
}

function applyNodeRename(node, title) {
  if (!node || !title) return;
  const nextTitle = title.trim();
  if (!nextTitle) return;
  const key = nodeKey(node);

  for (const item of state.interestNodes) {
    if (nodeKey(item) === key) item.title = nextTitle;
  }
  if (state.currentNode && nodeKey(state.currentNode) === key) {
    state.currentNode.title = nextTitle;
    if (state.currentView) state.currentView.title = nextTitle;
  }
  if (state.currentDoc && nodeKey(makeNodePayload(state.currentDoc)) === key) {
    state.currentDoc.title = nextTitle;
  }
  renderInterestNodes();
  renderViewer();
}

function renameNode(node) {
  if (!node) return;
  const nextTitle = window.prompt("새 이름", node.title || "");
  if (nextTitle === null) return;
  applyNodeRename(node, nextTitle);
}

function renderInterestNodes() {
  const list = $("#interestNodeList");
  $("#interestNodeCount").textContent = String(state.interestNodes.length);
  if (!state.interestNodes.length) {
    list.className = "watch-list drop-target muted";
    list.textContent = "오른쪽 검색 결과를 드래그해서 등록";
    return;
  }

  list.className = "watch-list drop-target";
  list.innerHTML = "";
  for (const node of state.interestNodes) {
    const row = document.createElement("div");
    row.className = "watch-item node-item";
    row.draggable = true;
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(nodeTypeLabel(node))}</strong>
        <span>${escapeHtml(shortText(node.title, 72))}</span>
      </div>
      <div class="watch-actions">
        <button class="rename-node-btn" type="button" title="이름 변경" aria-label="이름 변경">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
          </svg>
        </button>
        <button class="remove-node-btn" type="button" title="제거">x</button>
      </div>
    `;
    row.addEventListener("dragstart", (event) => setDrag(event, DRAG_NODE, node));
    row.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      openInterestNode(node).catch((error) => alert(`노드 열기 실패: ${error.message}`));
    });
    row.querySelector(".rename-node-btn").addEventListener("click", () => renameNode(node));
    row.querySelector(".remove-node-btn").addEventListener("click", () => removeInterestNode(node));
    list.appendChild(row);
  }
}

// --- Evidence intake and IOC candidate highlighting ---

function renderPendingFiles() {
  const box = $("#pendingFiles");
  if (!state.pendingFiles.length) {
    box.className = "muted";
    box.textContent = "첨부 파일 없음";
    return;
  }
  box.className = "";
  box.textContent = `첨부 ${state.pendingFiles.map((file) => file.name).join(", ")}`;
}

async function addFiles(fileList) {
  for (const file of Array.from(fileList || [])) {
    const content = await file.text().catch(() => "");
    state.pendingFiles.push({ name: file.name, content });
  }
  renderPendingFiles();
}

function buildSourceView(message, files, iocs) {
  const sources = [];
  if (String(message || "").trim()) {
    sources.push({ name: "message", label: "붙여넣은 분석 근거 자료", content: message });
  }
  for (const file of files || []) {
    if (file.content) sources.push({ name: file.name, label: file.name, content: file.content });
  }

  let content = "";
  const iocSpans = [];
  for (const source of sources) {
    const header = `${content ? "\n\n" : ""}--- ${source.label} ---\n`;
    content += header;
    const sourceStart = content.length;
    content += source.content;

    for (const ioc of iocs || []) {
      if (ioc.source_file !== source.name || !ioc.offset) continue;
      iocSpans.push({
        ...ioc,
        offset: {
          start: sourceStart + ioc.offset.start,
          end: sourceStart + ioc.offset.end
        }
      });
    }
  }

  return {
    kind: "source",
    title: "분석 근거 자료",
    meta: `분석 근거 ${sources.length}건, IOC 후보 ${iocSpans.length}건`,
    content: content || "분석할 원문이 없습니다.",
    iocSpans
  };
}

function makeEvidenceNode(view, session) {
  const lastMessage = session.messages?.[session.messages.length - 1];
  return {
    id: lastMessage?.id || `evidence:${Date.now()}`,
    kind: "evidence",
    module: "evidence",
    title: view.title,
    meta: view.meta,
    content: view.content,
    iocSpans: view.iocSpans || [],
    timestamp: lastMessage?.createdAt || new Date().toISOString()
  };
}

async function analyzeSources() {
  const message = $("#message").value;
  if (!message.trim() && !state.pendingFiles.length) return;

  const files = state.pendingFiles;
  $("#analyze").disabled = true;
  $("#analyze").textContent = "제출 중...";
  setViewerLoading(true, state.llmEnabled ? "자료 제출 중... OpenAI 보조 분석 실행 중" : "자료 제출 중...");
  try {
    const session = await sessionApi((sessionId) => `/api/sessions/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify({ message, files })
    });
    state.session = session;
    state.currentDoc = null;
    state.semanticHighlights = null;
    state.currentView = buildSourceView(message, files, session.iocs);
    state.currentNode = makeEvidenceNode(state.currentView, session);
    addInterestNode(state.currentNode);
    state.pendingFiles = [];
    $("#message").value = "";
    renderPendingFiles();
    renderViewer();
    clearWalletGraph();
    if (state.semanticEnabled) {
      await loadSemanticHighlights();
    }
  } catch (error) {
    alert(`자료 제출 실패: ${error.message}`);
  } finally {
    setViewerLoading(false);
    $("#analyze").disabled = false;
    $("#analyze").textContent = "자료 제출";
  }
}

// --- Single search target ---

function setSearchIoc(ioc) {
  if (!ioc || !ioc.value) return;
  const normalized = { type: ioc.type || "keyword", value: String(ioc.value).trim() };
  if (!normalized.value) return;
  state.searchIoc = normalized;
  $("#query").value = normalized.value;
  $("#service").value = "";
  renderSearchTarget();
}

function clearSearchIocIfInputChanged() {
  const query = $("#query").value.trim();
  if (state.searchIoc && query !== state.searchIoc.value) {
    state.searchIoc = null;
    renderSearchTarget();
  }
}

function renderSearchTarget() {
  const target = $("#singleSearchTarget");
  if (!target) return;
  if (!state.searchIoc) {
    target.className = "single-search-target drop-target muted";
    target.textContent = "관심 IOC를 드롭하거나 클릭하면 검색창에 입력됩니다.";
    return;
  }
  target.className = `single-search-target drop-target ${chipClass(state.searchIoc.type)}`;
  target.innerHTML = `
    <strong>${escapeHtml(state.searchIoc.type)}</strong>
    <span>${escapeHtml(state.searchIoc.value)}</span>
  `;
}

async function runKeywordSearch() {
  const query = $("#query").value.trim();
  const module = $("#service").value;
  if (!query) return;
  if (!module && state.searchIoc && query === state.searchIoc.value) {
    await submitQuery({ iocs: [state.searchIoc] });
    return;
  }
  if (state.searchIoc && query !== state.searchIoc.value) {
    state.searchIoc = null;
    renderSearchTarget();
  }
  await submitQuery(module ? { module, query } : { query });
}

// --- Results list: metadata first, lazy full node/document fetch on click ---

function highlightTerms(text, terms) {
  let html = escapeHtml(text);
  for (const term of (terms || []).filter(Boolean)) {
    const pattern = new RegExp(escapeRegExp(escapeHtml(term)), "gi");
    html = html.replace(pattern, (match) => `<mark>${match}</mark>`);
  }
  return html;
}

function renderResultsCount() {
  if (!state.documents.totalCount) {
    $("#resultsCount").textContent = "";
    return;
  }
  const byModule = Object.entries(state.documents.moduleCounts || {})
    .map(([module, count]) => `${module}:${count}`)
    .join(" ");
  $("#resultsCount").textContent = `${state.documents.totalCount}건 ${byModule ? `(${byModule})` : ""}`;
}

function renderResultsList() {
  const box = $("#resultsList");
  const docs = state.documents.data;
  if (!docs.length) {
    box.className = "results-list muted";
    box.textContent = state.resultsMessage;
    $("#loadMore").hidden = true;
    return;
  }

  box.className = "results-list";
  box.innerHTML = "";
  for (const doc of docs) {
    const card = document.createElement("article");
    card.className = "result-card";
    card.draggable = true;
    const snippet = shortText(doc.content || "", 190);
    const sourceLink = doc.source_url
      ? `<a class="source-link" href="${escapeHtml(doc.source_url)}" target="_blank" rel="noreferrer">source</a>`
      : "";
    card.innerHTML = `
      <div class="result-head">
        <strong>${escapeHtml(doc.title || "(untitled)")}</strong>
        <span class="badge">${escapeHtml(String(doc.module || "").toUpperCase())}</span>
      </div>
      <div class="result-meta">${escapeHtml(doc.forum_name || "-")} · ${escapeHtml(doc.timestamp || "-")} · 클릭 시 노드 전문 조회 ${sourceLink}</div>
      <p>${highlightTerms(snippet, doc.matched_iocs)}</p>
      <div class="result-tags">${(doc.matched_iocs || []).map((value) => `<span>${escapeHtml(value)}</span>`).join("")}</div>
    `;
    card.addEventListener("dragstart", (event) => setDrag(event, DRAG_NODE, makeNodePayload(doc)));
    card.addEventListener("click", () => openDocument(doc.id));
    card.querySelectorAll("a").forEach((link) => link.addEventListener("click", (event) => event.stopPropagation()));
    box.appendChild(card);
  }
  $("#loadMore").hidden = true;
}

function clearSearchResults(message = "조회 결과 없음") {
  state.resultsMessage = message;
  state.documents = { allData: [], data: [], totalCount: 0, cursor: null, moduleCounts: {} };
  renderResultsList();
  renderResultsCount();
}

function docsFromQueryResponse(queryResponse) {
  const byId = new Map();
  for (const result of queryResponse.results || []) {
    for (const item of result.results || []) {
      const id = `${result.module}:${item.id}`;
      const existing = byId.get(id);
      const matchedIocs = existing
        ? Array.from(new Set([...existing.matched_iocs, result.query_ioc?.value].filter(Boolean)))
        : [result.query_ioc?.value].filter(Boolean);
      byId.set(id, {
        id,
        module: result.module,
        query_ioc: result.query_ioc,
        title: item.title,
        content: item.content,
        source_url: item.source_url,
        timestamp: item.timestamp,
        forum_name: item.forum_name,
        author_alias: item.author_alias,
        indicators_tagged: item.indicators_tagged,
        raw_response: item.raw_response,
        matched_iocs: matchedIocs
      });
    }
  }
  return Array.from(byId.values());
}

function applyCurrentResultFilters() {
  const docs = [...state.documents.allData];

  const moduleCounts = {};
  for (const doc of docs) {
    moduleCounts[doc.module] = (moduleCounts[doc.module] || 0) + 1;
  }

  state.documents = {
    ...state.documents,
    data: docs,
    totalCount: docs.length,
    cursor: null,
    moduleCounts
  };
  state.resultsMessage = state.documents.allData.length ? "현재 조회 결과 없음" : "조회 결과 없음";
  renderResultsList();
  renderResultsCount();
}

function setSearchResultsFromQuery(queryResponse) {
  state.documents = {
    allData: docsFromQueryResponse(queryResponse),
    data: [],
    totalCount: 0,
    cursor: null,
    moduleCounts: {}
  };
  applyCurrentResultFilters();
}

// --- Wallet graph ---

function getWalletIocFromQuery(body) {
  const iocs = Array.isArray(body.iocs) ? body.iocs : [];
  const wallet = iocs.find(
    (ioc) => ["btc_address", "eth_address"].includes(ioc.type) && String(ioc.value || "").trim()
  );
  if (wallet) return { type: wallet.type, value: String(wallet.value).trim() };

  const directQuery = String(body.query || "").trim();
  if (BTC_ADDRESS_PATTERN.test(directQuery)) {
    return { type: "btc_address", value: directQuery };
  }
  if (ETH_ADDRESS_PATTERN.test(directQuery)) {
    return { type: "eth_address", value: directQuery };
  }
  return null;
}

function clearWalletGraph() {
  state.walletGraph = null;
  if (window.WalletGraph) window.WalletGraph.clear($("#walletGraph"));
}

async function loadWalletNeighbors(address, type) {
  if (type !== "btc_address") {
    throw new Error("Ethereum transaction graph is not configured yet");
  }
  return api(`/api/wallet/btc/neighbors?address=${encodeURIComponent(address)}&limit=5`);
}

function renderWalletGraph(graph) {
  state.walletGraph = graph;
  window.WalletGraph.render($("#walletGraph"), graph, {
    loadNeighbors: loadWalletNeighbors,
    onAddressClick: (address, type) => {
      renderWalletGraphForQuery({ type, value: address }, { results: [] });
    }
  });
}

function renderWalletGraphForQuery(walletIoc, queryResponse = { results: [] }, options = {}) {
  if (!window.WalletGraph || !walletIoc) return;
  const sameGraph =
    state.walletGraph &&
    String(state.walletGraph.address || "").toLowerCase() === String(walletIoc.value || "").toLowerCase();
  const graph = options.preserveExisting && sameGraph ? state.walletGraph : window.WalletGraph.build(walletIoc.value, []);
  if (Object.prototype.hasOwnProperty.call(options, "expanded")) {
    graph.expanded = Boolean(options.expanded);
  }
  renderWalletGraph(graph);
}

function addWalletIocToGraph(ioc) {
  if (!ioc || ioc.type !== "btc_address" || !BTC_ADDRESS_PATTERN.test(String(ioc.value || "").trim())) return;
  const address = String(ioc.value).trim();
  const graph = state.walletGraph || window.WalletGraph.build(address, []);
  window.WalletGraph.addSeed(graph, address);
  renderWalletGraph(graph);
}

function makeWalletGraphDropTarget(element) {
  element.addEventListener("dragover", (event) => {
    if (!hasDragType(event, DRAG_IOC)) return;
    event.preventDefault();
    event.stopPropagation();
    $("#walletGraph").hidden = false;
    element.classList.add("wallet-drag-over");
    $("#walletGraph").classList.add("drag-over");
  });

  element.addEventListener("dragleave", (event) => {
    if (element.contains(event.relatedTarget)) return;
    element.classList.remove("wallet-drag-over");
    $("#walletGraph").classList.remove("drag-over");
    if (!state.walletGraph) clearWalletGraph();
  });

  element.addEventListener("drop", (event) => {
    const ioc = readDrag(event, DRAG_IOC);
    event.preventDefault();
    event.stopPropagation();
    element.classList.remove("wallet-drag-over");
    $("#walletGraph").classList.remove("drag-over");
    if (!ioc || ioc.type !== "btc_address") {
      if (!state.walletGraph) clearWalletGraph();
      return;
    }
    addWalletIocToGraph(ioc);
  });
}

// --- Viewer ---

function buildHighlightHtml(text, iocSpans, semanticHighlights) {
  const boundaries = new Set([0, text.length]);
  const spans = [];

  for (const ioc of iocSpans || []) {
    if (!ioc.offset) continue;
    boundaries.add(ioc.offset.start);
    boundaries.add(ioc.offset.end);
    spans.push({ start: ioc.offset.start, end: ioc.offset.end, kind: "ioc", type: ioc.type, value: ioc.value });
  }

  if (semanticHighlights) {
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
    const covering = spans.filter((span) => span.start <= segStart && span.end >= segEnd);
    if (!covering.length) {
      html += segText;
      continue;
    }

    const classes = covering
      .map((span) =>
        span.kind === "ioc"
          ? `hl-ioc ${chipClass(span.type)}`
          : `hl-semantic semantic-${span.category || "technique"}`
      )
      .join(" ");
    const iocSpan = covering.find((span) => span.kind === "ioc");
    const title = covering
      .map((span) => (span.kind === "ioc" ? `${span.type}: ${span.value}` : `${span.category}: ${span.rationale}`))
      .join(" | ");
    const dataAttrs = iocSpan
      ? `data-ioc-type="${escapeHtml(iocSpan.type)}" data-ioc-value="${escapeHtml(iocSpan.value)}"`
      : "";
    html += `<span class="hl ${classes}" title="${escapeHtml(title)}" ${dataAttrs}>${segText}</span>`;
  }
  return html;
}

function renderViewer() {
  const view = state.currentView;
  if (!view) {
    $("#docTitle").textContent = "분석 근거 자료를 투입하세요";
    $("#docMeta").textContent = "";
    $("#document").textContent = "오른쪽 검색 위젯에 로그/문서/메모를 넣으면 IOC 후보가 색상별로 하이라이트됩니다.";
    renderCurrentNodeAction();
    return;
  }

  $("#docTitle").textContent = view.title;
  $("#docMeta").textContent = view.meta || "";
  $("#document").innerHTML = buildHighlightHtml(
    view.content || "",
    view.iocSpans || [],
    state.semanticEnabled ? state.semanticHighlights : null
  );
  renderCurrentNodeAction();
}

async function openDocument(docId) {
  setViewerLoading(true, "노드 전문 조회 중...");
  try {
    const doc = await sessionApi(
      (sessionId) => `/api/sessions/${sessionId}/documents/${encodeURIComponent(docId)}`
    );
    state.currentDoc = doc;
    state.currentNode = makeNodePayload(doc);
    state.semanticHighlights = null;
    state.currentView = {
      kind: "document",
      title: doc.title || "(untitled)",
      meta: `${String(doc.module || "").toUpperCase()} · ${doc.forum_name || "-"} · ${doc.timestamp || "-"}`,
      content: doc.content || "",
      iocSpans: doc.iocSpans || []
    };
    renderViewer();
    if (state.semanticEnabled) {
      await loadSemanticHighlights();
    }
  } finally {
    setViewerLoading(false);
  }
}

async function openInterestNode(node) {
  if (node.kind === "evidence") {
    state.currentDoc = null;
    state.currentNode = node;
    state.semanticHighlights = node.semanticHighlights || null;
    state.currentView = {
      kind: "source",
      title: node.title || "분석 근거 자료",
      meta: node.meta || "",
      content: node.content || "",
      iocSpans: node.iocSpans || []
    };
    clearWalletGraph();
    renderViewer();
    if (state.semanticEnabled && !state.semanticHighlights) {
      await loadSemanticHighlights();
    }
    return;
  }
  await openDocument(node.id);
}

function addCurrentNodeToInterest() {
  if (!state.currentNode) return;
  addInterestNode(state.currentNode);
}

async function loadSemanticHighlights() {
  if (!state.currentView || !state.semanticEnabled) return;
  setViewerLoading(true, state.llmEnabled ? "OpenAI 의미 하이라이트 분석 중..." : "의미 하이라이트 확인 중...");
  try {
    const data = state.currentDoc
      ? await sessionApi(
          (sessionId) => `/api/sessions/${sessionId}/documents/${encodeURIComponent(state.currentDoc.id)}/semantic`
        )
      : await sessionApi((sessionId) => `/api/sessions/${sessionId}/semantic`, {
          method: "POST",
          body: JSON.stringify({ text: state.currentView.content || "" })
        });
    state.semanticHighlights = data.highlights;
    if (state.currentNode) {
      state.currentNode.semanticHighlights = data.highlights;
      for (const node of state.interestNodes) {
        if (nodeKey(node) === nodeKey(state.currentNode)) node.semanticHighlights = data.highlights;
      }
    }
    renderViewer();
  } finally {
    setViewerLoading(false);
  }
}

async function setSemanticEnabled(enabled) {
  state.semanticEnabled = enabled && state.llmEnabled;
  const toggle = $("#semanticToggle");
  if (toggle) toggle.checked = state.semanticEnabled;
  renderSemanticToggleStatus();
  if (state.semanticEnabled && state.currentView && !state.semanticHighlights) {
    await loadSemanticHighlights();
  } else {
    renderViewer();
  }
}

async function submitQuery(body, options = {}) {
  const walletIoc = getWalletIocFromQuery(body);
  clearSearchResults("조회 중...");
  if (walletIoc) {
    renderWalletGraphForQuery(walletIoc, { results: [] }, { preserveExisting: true });
  } else {
    setViewerLoading(true, "검색 결과 조회 중...");
  }
  try {
    const queryResponse = await sessionApi((sessionId) => `/api/sessions/${sessionId}/query`, {
      method: "POST",
      body: JSON.stringify(body)
    });
    state.session = await sessionApi((sessionId) => `/api/sessions/${sessionId}`);
    renderInterestIocs();
    setSearchResultsFromQuery(queryResponse);
    if (walletIoc) {
      const graphOptions = { preserveExisting: true };
      if (options.expandWalletGraph !== undefined) graphOptions.expanded = options.expandWalletGraph;
      renderWalletGraphForQuery(walletIoc, { results: [] }, graphOptions);
    } else {
      clearWalletGraph();
    }
  } catch (error) {
    clearSearchResults(`조회 실패: ${error.message}`);
    throw error;
  } finally {
    if (!walletIoc) setViewerLoading(false);
  }
}

// --- Relationship candidates popup ---

const RELATIONSHIP_STATUS_LABELS = {
  weak_candidate: "약한 후보",
  review_needed: "검토 필요",
  probable_same_cluster: "동일 클러스터 가능",
  rejected: "제외",
  confirmed_by_analyst: "분석가 확인"
};

const RELATIONSHIP_LABELS = {
  same_identifier_observed: "동일 식별자 관측",
  appeared_with: "동일 결과 내 동시 관측",
  possible_same_actor: "동일 행위자 가능성",
  repeated_alias_cluster: "반복 alias 클러스터"
};

function relationshipLabel(value) {
  return RELATIONSHIP_LABELS[value] || value || "관계 후보";
}

function relationshipStatusOptions(current) {
  return Object.entries(RELATIONSHIP_STATUS_LABELS)
    .map(
      ([value, label]) =>
        `<option value="${escapeHtml(value)}" ${value === current ? "selected" : ""}>${escapeHtml(label)}</option>`
    )
    .join("");
}

function relationshipReason(candidate) {
  if (candidate.reason) return candidate.reason;
  const evidence = candidate.evidence?.[0] || "주요 증거 없음";
  if (candidate.score >= 0.75) {
    return "강한 식별자 또는 반복 증거가 겹쳐 같은 활동 클러스터일 가능성이 높습니다. " + evidence;
  }
  if (candidate.score >= 0.5) {
    return "같은 문서 또는 검색 결과에서 연결 단서가 관측되어 분석가 검토가 필요합니다. " + evidence;
  }
  return "연결 단서는 약하지만 관련 맥락에 함께 등장해 낮은 우선순위 후보로 표시됩니다. " + evidence;
}

function openRelationshipModal() {
  const modal = $("#relationshipModal");
  if (modal) modal.hidden = false;
}

function closeRelationshipModal() {
  const modal = $("#relationshipModal");
  if (modal) modal.hidden = true;
}

function renderRelationshipModal(relationships = state.relationships) {
  const list = $("#relationshipList");
  const summary = $("#relationshipSummary");
  if (!list || !summary) return;

  const count = relationships.length;
  const lookedUp = state.relationshipLookup?.lookedUpCount || 0;
  const lookupResults = state.relationshipLookup?.lookupResultCount || 0;
  const lookupText = lookedUp
    ? `새 StealthMole 조회 ${lookedUp}개, 모듈 응답 ${lookupResults}건`
    : "새 StealthMole 조회 없음";
  summary.textContent = count
    ? `관심 IOC ${state.interestIocs.length}개 기준 관계 후보 ${count}건 · ${lookupText}`
    : `관심 IOC ${state.interestIocs.length}개 기준으로 표시할 관계 후보가 없습니다. · ${lookupText}`;

  if (!count) {
    list.className = "relationship-list muted";
    list.textContent = state.interestIocs.length
      ? "조회된 결과 문서에서 관심 IOC와 연결되는 alias, 지갑, 이메일, 도메인 단서를 찾지 못했습니다."
      : "관심 IOC를 등록한 뒤 관계를 추출하세요.";
    return;
  }

  list.className = "relationship-list";
  list.innerHTML = "";
  for (const candidate of relationships) {
    const card = document.createElement("article");
    card.className = `relationship-card status-${candidate.status || "weak_candidate"}`;
    card.innerHTML = `
      <div class="relationship-card-head">
        <div class="relationship-pair">
          <strong>${escapeHtml(candidate.subject)}</strong>
          <span>${escapeHtml(relationshipLabel(candidate.relation))}</span>
          <strong>${escapeHtml(candidate.object)}</strong>
        </div>
        <span class="score-badge">${Math.round(Number(candidate.score || 0) * 100)}%</span>
      </div>
      <p class="relationship-reason">${escapeHtml(relationshipReason(candidate))}</p>
      <div class="relationship-review-row">
        <label>
          <span>검토 상태</span>
          <select data-relationship-status-id="${escapeHtml(candidate.id)}">
            ${relationshipStatusOptions(candidate.status)}
          </select>
        </label>
      </div>
      <ul class="relationship-evidence">
        ${(candidate.evidence || []).slice(0, 4).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
      <div class="relationship-sources">${(candidate.sources || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
    `;
    list.appendChild(card);
  }
}

async function extractRelationshipsForInterestIocs() {
  if (!state.interestIocs.length) {
    state.relationships = [];
    state.relationshipLookup = null;
    renderRelationshipModal();
    openRelationshipModal();
    return;
  }

  const button = $("#extractRelationshipsBtn");
  const previousText = button?.textContent || "관계 추출";
  if (button) {
    button.disabled = true;
    button.textContent = "조회/추출 중...";
  }
  try {
    const data = await sessionApi((sessionId) => `/api/sessions/${sessionId}/relationships`, {
      method: "POST",
      body: JSON.stringify({ iocs: state.interestIocs })
    });
    state.relationships = data.relationships || [];
    state.relationshipLookup = {
      lookedUpCount: Array.isArray(data.lookedUp) ? data.lookedUp.length : 0,
      lookupResultCount: Array.isArray(data.lookupResults) ? data.lookupResults.length : 0
    };
    state.session = await sessionApi((sessionId) => `/api/sessions/${sessionId}`);
    if (state.session) state.session.relationships = state.relationships;
    renderInterestIocs();
    renderRelationshipModal();
    openRelationshipModal();
  } catch (error) {
    alert(`관계 추출 실패: ${error.message}`);
  } finally {
    const nextButton = $("#extractRelationshipsBtn");
    if (nextButton) {
      nextButton.textContent = previousText;
      nextButton.disabled = !state.interestIocs.length;
    }
  }
}

async function updateRelationshipReview(relationshipId, status) {
  if (!relationshipId || !status) return;
  const updated = await sessionApi(
    (sessionId) => `/api/sessions/${sessionId}/relationships/${encodeURIComponent(relationshipId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status })
    }
  );
  state.relationships = state.relationships.map((candidate) => (candidate.id === updated.id ? updated : candidate));
  renderRelationshipModal();
}

// --- Quota / boot ---

async function refreshQuotas() {
  try {
    const quotas = await api("/api/quotas");
    const entries = Object.entries(quotas);
    const box = $("#quotaList");
    if (!entries.length) {
      box.className = "quota-list muted";
      box.textContent = "-";
      return;
    }
    box.className = "quota-list";
    box.innerHTML = entries.map(([module, q]) => `<div>${escapeHtml(module)}: ${q.used}/${q.allowed}</div>`).join("");
  } catch {
    // Best-effort display.
  }
}

function hideSelectionMenu() {
  $("#selectionMenu").hidden = true;
}

function boot() {
  makeSearchPanelDropTarget($("#searchPanel"));
  makeWalletGraphDropTarget($(".viewer-panel"));

  $("#sourceDropzone").addEventListener("click", () => $("#files").click());
  $("#sourceDropzone").addEventListener("dragover", (event) => {
    event.preventDefault();
    event.stopPropagation();
    $("#sourceDropzone").classList.add("drag-over");
  });
  $("#sourceDropzone").addEventListener("dragleave", () => $("#sourceDropzone").classList.remove("drag-over"));
  $("#sourceDropzone").addEventListener("drop", (event) => {
    event.preventDefault();
    event.stopPropagation();
    $("#sourceDropzone").classList.remove("drag-over");
    addFiles(event.dataTransfer.files);
  });
  $("#files").addEventListener("change", (event) => addFiles(event.target.files));
  $("#analyze").addEventListener("click", analyzeSources);

  makeDropTarget($("#singleSearchTarget"), DRAG_IOC, setSearchIoc);
  makeDropTarget($("#interestIocList"), DRAG_IOC, addInterestIoc);
  makeDropTarget($("#interestNodeList"), DRAG_NODE, addInterestNode);
  $("#query").addEventListener("input", clearSearchIocIfInputChanged);
  $("#service").addEventListener("change", () => {
    if (!state.searchIoc) return;
    state.searchIoc = null;
    renderSearchTarget();
  });

  $("#keywordForm").addEventListener("submit", (event) => {
    event.preventDefault();
    runKeywordSearch().catch((error) => alert(`검색 실패: ${error.message}`));
  });

  $("#loadMore").addEventListener("click", () => applyCurrentResultFilters());

  $("#semanticToggle").addEventListener("change", (event) => {
    setSemanticEnabled(event.target.checked).catch((error) => alert(`LLM 하이라이팅 실패: ${error.message}`));
  });
  $("#addCurrentNodeBtn").addEventListener("click", addCurrentNodeToInterest);
  $("#extractRelationshipsBtn").addEventListener("click", extractRelationshipsForInterestIocs);
  $("#closeRelationshipModal").addEventListener("click", closeRelationshipModal);
  $("#relationshipModal").addEventListener("mousedown", (event) => {
    if (event.target.id === "relationshipModal") closeRelationshipModal();
  });
  $("#relationshipList").addEventListener("change", (event) => {
    const target = event.target.closest("[data-relationship-status-id]");
    if (!target) return;
    updateRelationshipReview(target.dataset.relationshipStatusId, target.value).catch((error) =>
      alert(`관계 후보 상태 변경 실패: ${error.message}`)
    );
  });

  $("#document").addEventListener("click", (event) => {
    const target = event.target.closest(".hl-ioc");
    if (!target) return;
    addInterestIoc({ type: target.dataset.iocType, value: target.dataset.iocValue });
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
      $("#query").value = text;
      state.searchIoc = null;
      renderSearchTarget();
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
  state.llmEnabled = health.llmEnabled;
  state.semanticEnabled = health.llmEnabled;
  $("#semanticToggle").checked = state.semanticEnabled;
  $("#semanticToggle").disabled = !health.llmEnabled;
  renderSemanticToggleStatus();
  $("#mode").textContent = `StealthMole: ${health.stealthmoleMock ? "mock" : "live"} · LLM: ${
    health.llmEnabled ? "on" : "off"
  }`;
  await createSession();
  renderPendingFiles();
  renderInterestIocs();
  renderInterestNodes();
  renderSearchTarget();
  renderViewer();
  await refreshQuotas();
  clearSearchResults();
}

boot();
