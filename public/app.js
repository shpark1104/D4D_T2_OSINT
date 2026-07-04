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
  stagedIocs: [],
  walletAnalysis: null,
  selectedWallet: null,
  expandedWallets: new Set()
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

function isWalletIocType(type) {
  return type === "btc_address" || type === "eth_address" || type === "wallet_btc" || type === "wallet_eth";
}

function shortAddress(address) {
  const value = String(address || "");
  return value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

function edgeAmount(edge, network) {
  const raw = edge.valueNative || edge.valueBtc || edge.valueEth || "0";
  return `${raw} ${network === "bitcoin" ? "BTC" : "ETH"}`;
}

function edgeLabel(edge, network) {
  const count = edge.count || 1;
  return `${count} tx / ${edgeAmount(edge, network)}`;
}

function edgeTime(edge) {
  const value = edge.timestamp || edge.block_time || edge.time;
  if (!value) return "";
  if (typeof value === "number") return new Date(value * 1000).toLocaleString("ko-KR");
  return String(value);
}

function transactionMonth(tx) {
  const value = tx.timestamp || tx.block_time || tx.time;
  if (!value) return "unknown";
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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
    chip.addEventListener("click", () => {
      if (isWalletIocType(ioc.type)) analyzeWallet(ioc.value);
      else runSearch(ioc.value, ioc.type);
    });
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

// --- Wallet graph demo/submodule UI ---

function demoWalletAnalysis() {
  const data = window.WALLET_DEMO_DATA;
  if (data) {
    const copy = typeof structuredClone === "function" ? structuredClone(data) : JSON.parse(JSON.stringify(data));
    copy.observations = (copy.observations || []).map((item) =>
      item.type === "graph_view"
        ? {
            ...item,
            title: "Progressive 1-hop expansion",
            detail: "Initial view shows only the selected IOC wallet. Clicking a wallet reveals only its adjacent 1-hop wallets and edges."
          }
        : item
    );
    return copy;
  }

  const seed = "1BoatSLRHtKNngkdXEeobR76b53LETtpyT";
  return {
    address: seed,
    network: "bitcoin",
    depth: 2,
    mock: true,
    summary: { txCount: 1172, source: "Blockstream address stats" },
    graph: { nodes: [{ id: seed, label: shortAddress(seed), network: "bitcoin", depth: 0, role: "seed", txCount: 1172 }], edges: [] },
    layers: [{ depth: 0, addresses: [seed] }],
    transactions: [],
    observations: [],
    provider: "demo"
  };
}

function walletNodeDepth(analysis, address) {
  const node = (analysis.graph.nodes || []).find((item) => item.id === address);
  return node ? Number(node.depth || 0) : 0;
}

function getVisibleWalletGraph(analysis) {
  const maxDepth = Number($("#walletDepth").value || analysis.depth || 2);
  const sourceNodes = analysis.graph.nodes || [];
  const sourceEdges = analysis.graph.edges || [];
  const expanded = state.expandedWallets instanceof Set ? state.expandedWallets : new Set();
  const visibleIds = new Set([analysis.address]);
  const visibleEdgeIds = new Set();

  if (state.selectedWallet && walletNodeDepth(analysis, state.selectedWallet) <= maxDepth) {
    visibleIds.add(state.selectedWallet);
  }

  expanded.forEach((address) => {
    if (walletNodeDepth(analysis, address) > maxDepth) return;
    visibleIds.add(address);
    sourceEdges.forEach((edge) => {
      if (edge.source !== address && edge.target !== address) return;
      const sourceDepth = walletNodeDepth(analysis, edge.source);
      const targetDepth = walletNodeDepth(analysis, edge.target);
      if (sourceDepth > maxDepth || targetDepth > maxDepth) return;
      visibleIds.add(edge.source);
      visibleIds.add(edge.target);
      visibleEdgeIds.add(edge.id || `${edge.source}->${edge.target}`);
    });
  });

  const nodes = sourceNodes.filter((node) => visibleIds.has(node.id));
  const visibleNodeIds = new Set(nodes.map((node) => node.id));
  const edges = sourceEdges.filter((edge) => {
    const edgeId = edge.id || `${edge.source}->${edge.target}`;
    return visibleEdgeIds.has(edgeId) && visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target);
  });
  const hiddenNeighborCounts = new Map();

  nodes.forEach((node) => {
    const hidden = sourceEdges.filter((edge) => {
      if (edge.source !== node.id && edge.target !== node.id) return false;
      const other = edge.source === node.id ? edge.target : edge.source;
      const otherDepth = walletNodeDepth(analysis, other);
      return otherDepth <= maxDepth && !visibleNodeIds.has(other);
    }).length;
    hiddenNeighborCounts.set(node.id, hidden);
  });

  return { nodes, edges, hiddenNeighborCounts, maxDepth };
}

function renderWalletGraphSvg(analysis) {
  const graphView = getVisibleWalletGraph(analysis);
  const { nodes, edges, hiddenNeighborCounts } = graphView;
  const maxDepth = Math.max(2, graphView.maxDepth, ...nodes.map((node) => node.depth || 0));
  const width = 760;
  const columnGap = width / (maxDepth + 1);
  const grouped = new Map();

  nodes.forEach((node) => {
    const depth = node.depth || 0;
    if (!grouped.has(depth)) grouped.set(depth, []);
    grouped.get(depth).push(node);
  });

  const maxRows = Math.max(1, ...Array.from(grouped.values()).map((items) => items.length));
  const height = Math.max(280, maxRows * 92 + 88);
  const positions = new Map();

  for (let depth = 0; depth <= maxDepth; depth += 1) {
    const items = grouped.get(depth) || [];
    const x = Math.round(columnGap * depth + columnGap / 2);
    items.forEach((node, index) => {
      const y = Math.round(((index + 1) * height) / (items.length + 1));
      positions.set(node.id, { x, y, node });
    });
  }

  const edgeLines = edges
    .map((edge) => {
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);
      if (!source || !target) return "";
      const midX = Math.round((source.x + target.x) / 2);
      const path = `M ${source.x + 18} ${source.y} C ${midX} ${source.y}, ${midX} ${target.y}, ${target.x - 18} ${target.y}`;
      const labelX = Math.round((source.x + target.x) / 2);
      const labelY = Math.round((source.y + target.y) / 2) - 6;
      return `
        <path class="wallet-link" d="${path}" marker-end="url(#walletArrow)" />
        <text class="wallet-link-label" x="${labelX}" y="${labelY}">${escapeHtml(edgeLabel(edge, analysis.network))}</text>
      `;
    })
    .join("");

  const nodeCircles = nodes
    .map((node) => {
      const position = positions.get(node.id);
      if (!position) return "";
      const selected = state.selectedWallet === node.id ? " selected" : "";
      const className = `${node.role === "seed" ? "wallet-dot seed" : "wallet-dot"}${selected}`;
      const hiddenCount = hiddenNeighborCounts.get(node.id) || 0;
      return `
        <g class="wallet-svg-node" data-wallet="${escapeHtml(node.id)}" tabindex="0" role="button">
          <circle class="${className}" cx="${position.x}" cy="${position.y}" r="18"></circle>
          ${hiddenCount ? `<text class="wallet-expand-count" x="${position.x + 21}" y="${position.y - 18}">+${hiddenCount}</text>` : ""}
          <text class="wallet-svg-label" x="${position.x}" y="${position.y + 34}">${escapeHtml(node.label || shortAddress(node.id))}</text>
          <text class="wallet-svg-count" x="${position.x}" y="${position.y + 50}">${escapeHtml(String(node.txCount || ""))}${node.txCount ? " tx" : ""}</text>
        </g>
      `;
    })
    .join("");

  const depthLabels = Array.from({ length: maxDepth + 1 }, (_, depth) => {
    const x = Math.round(columnGap * depth + columnGap / 2);
    return `<text class="wallet-depth-label" x="${x}" y="24">${depth}-hop</text>`;
  }).join("");

  return `
    <svg class="wallet-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Wallet relationship graph">
      <defs>
        <marker id="walletArrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" class="wallet-arrow"></path>
        </marker>
      </defs>
      ${depthLabels}
      ${edgeLines}
      ${nodeCircles}
    </svg>
  `;
}

function renderWalletTransactions(analysis) {
  const selected = state.selectedWallet || analysis.address;
  const transactions = (analysis.transactions || analysis.graph.edges || []).filter(
    (tx) => tx.from === selected || tx.to === selected || tx.source === selected || tx.target === selected
  );
  if (!transactions.length) return '<div class="muted">No transactions</div>';

  return transactions
    .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
    .map((tx) => {
      const source = tx.from || tx.source;
      const target = tx.to || tx.target;
      const hop = Number(tx.depth || 0) + 1;
      const relationship = tx.relationship ? ` / ${tx.relationship}` : "";
      const count = tx.count ? ` / ${tx.count} tx` : "";
      return `
        <div class="wallet-tx">
          <span class="wallet-hop">${hop}-hop</span>
          <code>${escapeHtml(shortAddress(source))}</code>
          <span>-></span>
          <code>${escapeHtml(shortAddress(target))}</code>
          <strong>${escapeHtml(edgeAmount(tx, analysis.network))}</strong>
          <small>${escapeHtml(`${hop}-hop${relationship}${count}`)}</small>
          <small>${escapeHtml(tx.hash || tx.txHash || tx.id || "")}</small>
          <small>${escapeHtml(edgeTime(tx))}</small>
        </div>
      `;
    })
    .join("");
}

function renderMonthlyStats(analysis) {
  const selected = state.selectedWallet || analysis.address;
  const knownCounts = analysis.monthlyCounts && analysis.monthlyCounts[selected];
  if (knownCounts) {
    const entries = Array.isArray(knownCounts) ? knownCounts : Object.entries(knownCounts);
    return entries
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, count]) => `<div class="wallet-month"><span>${escapeHtml(month)}</span><strong>${count}</strong></div>`)
      .join("");
  }

  const transactions = (analysis.transactions || []).filter((tx) => tx.from === selected || tx.to === selected);
  const counts = new Map();
  transactions.forEach((tx) => {
    const month = transactionMonth(tx);
    counts.set(month, (counts.get(month) || 0) + 1);
  });

  if (!counts.size) return '<div class="muted">No monthly stats</div>';

  return Array.from(counts.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, count]) => `<div class="wallet-month"><span>${escapeHtml(month)}</span><strong>${count}</strong></div>`)
    .join("");
}

function selectedWalletSummaryDetails(analysis) {
  const selected = state.selectedWallet || analysis.address;
  const node = (analysis.graph.nodes || []).find((item) => item.id === selected);
  const stats = (analysis.nodeStats && analysis.nodeStats[selected]) || {};
  const localTxCount = (analysis.transactions || analysis.graph.edges || []).filter(
    (tx) => tx.from === selected || tx.to === selected || tx.source === selected || tx.target === selected
  ).length;
  const totalTxCount = stats.knownTransactionCount || (node && node.txCount) || localTxCount;
  const counterpartyText = stats.counterpartyCount ? `${stats.counterpartyCount} counterparties` : "counterparty count pending";
  const monthText = stats.monthsTracked ? `${stats.monthsTracked} monthly bucket(s)` : "monthly buckets from visible rows";

  return `
    <div class="wallet-selected">
      <span>${node ? `${node.depth}-hop` : "wallet"}</span>
      <code>${escapeHtml(selected)}</code>
      <strong>${localTxCount} visible row(s) / ${totalTxCount} known transaction(s)</strong>
      <small>${escapeHtml(`${counterpartyText} / ${monthText}`)}</small>
    </div>
  `;
}

function renderWalletSummaryStats(analysis) {
  const summary = analysis.summary || {};
  const items = [
    ["total tx", summary.txCount],
    ["fetched tx", summary.fetchedTransactionCount],
    ["relation rows", summary.relationRows],
    ["counterparties", summary.counterpartyCount],
    ["funded UTXO", summary.fundedTxoCount],
    ["spent UTXO", summary.spentTxoCount],
    ["received", summary.totalReceivedNative ? `${summary.totalReceivedNative} ${analysis.network === "bitcoin" ? "BTC" : "ETH"}` : ""],
    ["sent", summary.totalSentNative ? `${summary.totalSentNative} ${analysis.network === "bitcoin" ? "BTC" : "ETH"}` : ""],
    ["balance", summary.finalBalanceNative ? `${summary.finalBalanceNative} ${analysis.network === "bitcoin" ? "BTC" : "ETH"}` : ""]
  ].filter(([, value]) => value !== undefined && value !== "");

  if (!items.length) return "";

  return `
    <div class="wallet-summary-grid">
      ${items.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}
    </div>
  `;
}

function bindWalletGraphEvents() {
  document.querySelectorAll(".wallet-svg-node").forEach((node) => {
    const select = () => {
      const wallet = node.getAttribute("data-wallet");
      state.selectedWallet = wallet;
      state.expandedWallets.add(wallet);
      renderWalletPanel();
    };
    node.addEventListener("click", select);
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select();
      }
    });
  });
}

function renderWalletPanel() {
  const box = $("#walletPanel");
  if (!box) return;

  if (!state.walletAnalysis) {
    box.className = "muted";
    box.textContent = "No wallet selected";
    return;
  }

  const analysis = state.walletAnalysis;
  if (!state.selectedWallet) state.selectedWallet = analysis.address;
  if (!(state.expandedWallets instanceof Set)) state.expandedWallets = new Set();
  const graphView = getVisibleWalletGraph(analysis);
  const renderedObservations = (analysis.observations || [])
    .map((item) => `<div class="wallet-observation"><strong>${escapeHtml(item.title)}</strong><br />${escapeHtml(item.detail)}</div>`)
    .join("");

  box.className = "wallet-graph";
  box.innerHTML = [
    `<p><strong>${escapeHtml(analysis.network)}</strong> / ${analysis.mock ? "demo" : "live"} / ${graphView.nodes.length}/${analysis.graph.nodes.length} node(s), ${graphView.edges.length}/${analysis.graph.edges.length} edge(s), ${state.expandedWallets.size} expanded</p>`,
    renderWalletSummaryStats(analysis),
    renderWalletGraphSvg(analysis),
    selectedWalletSummaryDetails(analysis),
    `<h2>Monthly Counts</h2><div class="wallet-months">${renderMonthlyStats(analysis)}</div>`,
    `<h2>Selected Node Transactions</h2><div class="wallet-transactions">${renderWalletTransactions(analysis)}</div>`,
    renderedObservations ? `<h2>Observations</h2><div class="wallet-observations">${renderedObservations}</div>` : ""
  ].join("");
  bindWalletGraphEvents();
}

async function analyzeWallet(address) {
  const depth = Number($("#walletDepth").value || 2);
  state.walletAnalysis = null;
  state.selectedWallet = null;
  state.expandedWallets = new Set();
  $("#walletPanel").className = "muted";
  $("#walletPanel").textContent = "Loading wallet graph";

  try {
    const data = await api("/api/wallet/analyze", {
      method: "POST",
      body: JSON.stringify({ address, depth })
    });
    state.walletAnalysis = data;
    state.selectedWallet = data.address;
    renderWalletPanel();
  } catch (error) {
    $("#walletPanel").className = "muted";
    $("#walletPanel").textContent = error.message;
  }
}

// --- Search (manual form, IOC chip click, IOC click-in-doc, drag-to-search) ---

// IOC-typed search: used by IOC chip clicks, in-document IOC clicks, and
// drag-to-search. Auto-routes across StealthMole modules via the IOC type.
async function runSearch(value, iocType) {
  const query = String(value || "").trim();
  if (!query || !state.session) return;
  if (isWalletIocType(iocType)) {
    await analyzeWallet(query);
    return;
  }
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
  $("#walletDemo").addEventListener("click", () => {
    state.walletAnalysis = demoWalletAnalysis();
    state.selectedWallet = state.walletAnalysis.address;
    state.expandedWallets = new Set();
    renderWalletPanel();
  });
  $("#walletDepth").addEventListener("change", renderWalletPanel);

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
  renderWalletPanel();
  if (new URLSearchParams(window.location.search).get("walletDemo") === "1") {
    state.walletAnalysis = demoWalletAnalysis();
    state.selectedWallet = state.walletAnalysis.address;
    state.expandedWallets = new Set();
    renderWalletPanel();
  }
  await refreshQuotas();
  await loadDocuments({ reset: true });
}

boot();
