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

const SERVICE_LABELS = {
  "": { ko: "auto", en: "auto" },
  tt: { ko: "TT · 텔레그램", en: "TT · Telegram" },
  cl: { ko: "CL · 계정 유출", en: "CL · credential leaks" },
  cb: { ko: "CB · 콤보 계정", en: "CB · combo credentials" },
  cds: { ko: "CDS · 감염기기 유출", en: "CDS · compromised devices" },
  rm: { ko: "RM · 랜섬웨어", en: "RM · ransomware" },
  gm: { ko: "GM · 정부기관 모니터링", en: "GM · government monitoring" },
  lm: { ko: "LM · 기업 유출 모니터링", en: "LM · enterprise leak monitoring" }
};

const TEXT = {
  ko: {
    stageStatusHeading: "처리 단계",
    uploadedFiles: "업로드 파일",
    extractedIoc: "추출 IOC",
    entityHeading: "Entity (LLM)",
    sessionLabel: "CTI 분석 세션",
    queryPlaceholder: "IOC, alias, handle, domain, keyword",
    messagePlaceholder: "침해사고 로그, 노트, 텍스트를 붙여넣으세요",
    dropzone: "여기로 파일을 드래그하거나 클릭하여 업로드 (.log .txt .csv .json .eml)",
    stageHeading: "StealthMole 조회 대기열",
    historyHeading: "검색 히스토리",
    noFiles: "No files",
    noIoc: "No IOC",
    noEntity: "No entity",
    noSearches: "No searches",
    noReports: "No reports yet",
    noDocIoc: "현재 문서에서 발견된 IOC가 없습니다.",
    noSemantic: "Semantic highlight가 없습니다.",
    noRelationships: "No relationship candidates",
    noDocument: "왼쪽 목록에서 문서를 클릭하면 여기에 표시됩니다.",
    selectDocument: "문서를 선택하세요",
    sourceMissing: "원본 없음",
    sourceOpen: "원본 열기",
    sourceShowing: "원본 문서 표시 중",
    rawOpen: "원본 응답 보기",
    rawClose: "원본 응답 숨기기",
    rawTitle: "StealthMole 원본 응답",
    pendingNone: "첨부 파일 없음",
    removePending: "첨부 제거",
    deleteFile: "삭제",
    deleteFileConfirm: "이 업로드 파일과 여기서 추출된 IOC를 삭제할까요?",
    analyze: "분석 시작",
    analyzing: "분석 중...",
    autoSearch: "자동 후보 검색",
    autoSearching: "자동 검색 중...",
    search: "Search",
    loadMore: "더 보기",
    detailButton: "상세 보기",
    iocHelp: "IP, URL, 이메일, 해시, CVE, 지갑, Telegram handle은 패턴으로 추출합니다. LLM entity는 별도 후보이며 확정 사실이 아닙니다.",
    autoSearchHelp: "분석 직후 추출 IOC를 자동 검색합니다. IOC가 없으면 파일명/본문 키워드 후보를 사용합니다.",
    highlightHelp: "문서 IOC는 현재 문서 본문에서 다시 찾은 IOC입니다. 의미론적 highlight는 actor, 인프라 재사용, 연락 채널처럼 CTI 의미가 있는 문장을 표시합니다.",
    docIocHeading: "문서 IOC",
    semanticHeading: "Semantic Highlights",
    relationshipHeading: "동일인/동일 활동 후보",
    relationshipHelp: "확정 병합이 아니라 검토 후보입니다. 같은 문서에 함께 등장하거나 강한 식별자를 공유할 때 점수가 올라갑니다.",
    mockNotice: "현재 mock mode입니다. 검색 결과는 실제 StealthMole 응답이 아니라 개발용 fixture일 수 있습니다.",
    liveNotice: "",
    resultIdle: "검색을 실행하면 결과 설명이 여기에 표시됩니다.",
    contextLabel: "매칭 문맥",
    relationshipReasonLabel: "판단 이유",
    reviewStatusLabel: "검토 상태",
    autoMode: "자동 후보",
    manualMode: "직접 검색",
    iocMode: "IOC 검색",
    selectionMode: "드래그 검색",
    sourceMode: "원본 문서",
    semantic: "의미론적",
    all: "전체",
    off: "끄기",
    recent: "최신순",
    relevance: "관련도순",
    source: "출처별",
    allModules: "전체 모듈",
    allTypes: "전체 유형",
    allSources: "전체 출처"
  },
  en: {
    stageStatusHeading: "Processing Stages",
    uploadedFiles: "Uploaded Files",
    extractedIoc: "Extracted IOC",
    entityHeading: "Entity (LLM)",
    sessionLabel: "CTI analysis session",
    queryPlaceholder: "IOC, alias, handle, domain, keyword",
    messagePlaceholder: "Paste incident logs, notes, or report text",
    dropzone: "Drop files here or click to upload (.log .txt .csv .json .eml)",
    stageHeading: "StealthMole Query Queue",
    historyHeading: "Search History",
    noFiles: "No files",
    noIoc: "No IOC",
    noEntity: "No entity",
    noSearches: "No searches",
    noReports: "No reports yet",
    noDocIoc: "No IOC found in the current document.",
    noSemantic: "No semantic highlights.",
    noRelationships: "No relationship candidates",
    noDocument: "Select a document from the list to view it here.",
    selectDocument: "Select a document",
    sourceMissing: "No source",
    sourceOpen: "Open source",
    sourceShowing: "Showing source document",
    rawOpen: "Show raw response",
    rawClose: "Hide raw response",
    rawTitle: "Raw StealthMole Response",
    pendingNone: "No attached files",
    removePending: "Remove attachment",
    deleteFile: "Delete",
    deleteFileConfirm: "Delete this uploaded file and IOCs extracted from it?",
    analyze: "Analyze",
    analyzing: "Analyzing...",
    autoSearch: "Search auto candidates",
    autoSearching: "Searching...",
    search: "Search",
    loadMore: "Load more",
    detailButton: "Details",
    iocHelp: "IP, URL, email, hash, CVE, wallet, and Telegram handles are extracted by deterministic patterns. LLM entities are candidates, not confirmed facts.",
    autoSearchHelp: "After analysis, extracted IOCs are searched automatically. If no IOC exists, filename and text keyword candidates are used.",
    highlightHelp: "Document IOCs are re-extracted from the current document. Semantic highlights mark CTI-relevant sentences such as actor, infrastructure reuse, or contact channel evidence.",
    docIocHeading: "Document IOCs",
    semanticHeading: "Semantic Highlights",
    relationshipHeading: "Identity / Activity Candidates",
    relationshipHelp: "These are review candidates, not confirmed merges. Scores increase when identifiers co-appear in documents or share strong evidence.",
    mockNotice: "Current mode is mock. Search results may be development fixtures, not live StealthMole responses.",
    liveNotice: "",
    resultIdle: "Run a search to see result context here.",
    contextLabel: "Matched context",
    relationshipReasonLabel: "Reason",
    reviewStatusLabel: "Review status",
    autoMode: "Auto candidate",
    manualMode: "Manual search",
    iocMode: "IOC search",
    selectionMode: "Selected text",
    sourceMode: "Source document",
    semantic: "Semantic",
    all: "All",
    off: "Off",
    recent: "Newest",
    relevance: "Relevance",
    source: "By source",
    allModules: "All modules",
    allTypes: "All types",
    allSources: "All sources"
  }
};

const STAGES = [
  { key: "upload", label: { ko: "업로드 완료", en: "Upload complete" } },
  { key: "extract", label: { ko: "IOC 추출 중", en: "Extracting IOCs" } },
  { key: "search", label: { ko: "API 검색 중", en: "Searching API" } },
  { key: "normalize", label: { ko: "결과 정리 중", en: "Normalizing results" } },
  { key: "complete", label: { ko: "완료", en: "Complete" } }
];

const state = {
  session: null,
  pendingFiles: [],
  documents: { data: [], totalCount: 0, cursor: null },
  currentDoc: null,
  semanticHighlights: null,
  showRaw: false,
  highlightMode: "ioc",
  filters: { module: "", type: "", source: "", sort: "relevance" },
  stagedIocs: [],
  language: localStorage.getItem("d4d-language") || "ko",
  searchHistory: [],
  activeSearch: null,
  health: null,
  currentStage: "idle",
  stages: Object.fromEntries(STAGES.map((stage) => [stage.key, "pending"])),
  walletAnalysis: null,
  selectedWallet: null,
  expandedWallets: new Set()
};

const $ = (selector) => document.querySelector(selector);

function t(key) {
  return TEXT[state.language]?.[key] || TEXT.ko[key] || key;
}

function labelOf(value) {
  if (!value || typeof value !== "object") return value || "";
  return value[state.language] || value.ko || value.en || "";
}

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

function hasHangul(value) {
  return /[가-힣]/.test(value);
}

function isSearchableText(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return false;
  return hasHangul(normalized) ? normalized.length >= 2 : normalized.length >= 3;
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function applyLanguage() {
  document.documentElement.lang = state.language;
  $("#languageMode").value = state.language;
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const element of document.querySelectorAll("[data-i18n-placeholder]")) {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  }
  $("#manualSearch").textContent = t("search");
  $("#autoSearch").textContent = autoCandidates().length ? `${t("autoSearch")} (${Math.min(autoCandidates().length, 8)})` : t("autoSearch");
  $("#analyze").textContent = t("analyze");
  $("#loadMore").textContent = t("loadMore");
  $("#iocHelp").textContent = t("iocHelp");
  $("#autoSearchHelp").textContent = t("autoSearchHelp");
  $("#highlightHelp").textContent = t("highlightHelp");
  $("#relationshipHelp").textContent = t("relationshipHelp");
  document.querySelector('[data-mode="semantic"]').textContent = t("semantic");
  document.querySelector('[data-mode="all"]').textContent = t("all");
  document.querySelector('[data-mode="off"]').textContent = t("off");
  renderServiceOptions();
  renderFilterOptions();
  renderAll();
}

function resetStages() {
  state.currentStage = "idle";
  state.stages = Object.fromEntries(STAGES.map((stage) => [stage.key, "pending"]));
  renderStages();
}

function setStage(key, status = "active") {
  state.currentStage = key;
  state.stages[key] = status;
  renderStages();
}

function completeStage(key) {
  state.stages[key] = "done";
  renderStages();
}

function failStage(key) {
  state.currentStage = key;
  state.stages[key] = "failed";
  renderStages();
}

function renderStages() {
  $("#stageBadge").textContent = state.currentStage;
  $("#stageList").innerHTML = STAGES.map((stage) => {
    const status = state.stages[stage.key] || "pending";
    return `
      <div class="stage-item ${status}">
        <span>${escapeHtml(labelOf(stage.label))}</span>
        <strong>${escapeHtml(status)}</strong>
      </div>
    `;
  }).join("");
}

function renderServiceOptions() {
  const select = $("#service");
  const current = select.value;
  select.innerHTML = Object.entries(SERVICE_LABELS)
    .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(labelOf(label))}</option>`)
    .join("");
  select.value = Object.prototype.hasOwnProperty.call(SERVICE_LABELS, current) ? current : "";
}

function renderFilterOptions() {
  const moduleFilter = $("#moduleFilter");
  const currentModule = moduleFilter.value;
  moduleFilter.querySelector('option[value=""]').textContent = t("allModules");
  moduleFilter.value = currentModule;

  const typeFilter = $("#typeFilter");
  const currentType = typeFilter.value;
  const types = Array.from(new Set((state.documents.data || []).map((doc) => doc.query_ioc?.type).filter(Boolean))).sort();
  typeFilter.innerHTML = `<option value="">${escapeHtml(t("allTypes"))}</option>${types
    .map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`)
    .join("")}`;
  typeFilter.value = types.includes(currentType) ? currentType : "";

  const sourceFilter = $("#sourceFilter");
  const currentSource = sourceFilter.value;
  const sources = Array.from(new Set((state.documents.data || []).map((doc) => doc.forum_name || doc.module).filter(Boolean))).sort();
  sourceFilter.innerHTML = `<option value="">${escapeHtml(t("allSources"))}</option>${sources
    .map((source) => `<option value="${escapeHtml(source)}">${escapeHtml(source)}</option>`)
    .join("")}`;
  sourceFilter.value = sources.includes(currentSource) ? currentSource : "";

  const sortOrder = $("#sortOrder");
  const currentSort = sortOrder.value;
  sortOrder.querySelector('option[value="relevance"]').textContent = t("relevance");
  sortOrder.querySelector('option[value="recent"]').textContent = t("recent");
  sortOrder.querySelector('option[value="source"]').textContent = t("source");
  sortOrder.value = currentSort;
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
  $("#iocCount").textContent = iocs.length;
  if (!iocs.length) {
    list.className = "chips muted";
    list.textContent = t("noIoc");
    return;
  }

  list.className = "ioc-list";
  list.innerHTML = "";
  for (const ioc of iocs) {
    const row = document.createElement("div");
    row.className = "ioc-row";

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
    row.appendChild(chip);

    if (ioc.source_document_id) {
      const source = document.createElement("button");
      source.className = "source-link";
      source.type = "button";
      source.textContent = ioc.source_file || t("sourceOpen");
      source.title = t("sourceOpen");
      source.addEventListener("click", () => openSourceDocument(ioc.source_document_id));
      row.appendChild(source);
    }

    list.appendChild(row);
  }
}

function renderSourceDocuments() {
  const list = $("#sourceList");
  const sources = state.session?.sourceDocuments || [];
  $("#sourceCount").textContent = sources.length;
  if (!sources.length) {
    list.className = "mini-list muted";
    list.textContent = t("noFiles");
    return;
  }

  list.className = "mini-list";
  list.innerHTML = "";
  for (const doc of sources) {
    const row = document.createElement("div");
    row.className = "mini-row source-row";
    row.innerHTML = `
      <button class="mini-main" type="button" data-source-doc-id="${escapeHtml(doc.id)}">
        <strong class="truncate-text" title="${escapeHtml(doc.name || doc.title)}">${escapeHtml(doc.name || doc.title)}</strong>
        <span>${escapeHtml(doc.type || "source")} · ${formatBytes(doc.size)}</span>
      </button>
      ${
        doc.type === "file"
          ? `<button class="delete-file" type="button" data-delete-source-doc-id="${escapeHtml(doc.id)}">${escapeHtml(t("deleteFile"))}</button>`
          : ""
      }
    `;
    list.appendChild(row);
  }
}

// --- StealthMole query tray (drag IOC chips here, then run in a batch) ---

function renderStageTray() {
  const tray = $("#stageTray");
  const runBtn = $("#runQueryBtn");
  if (!state.stagedIocs.length) {
    tray.className = "stage-tray muted";
    tray.textContent = state.language === "ko" ? "왼쪽 IOC 칩을 여기로 드래그하세요" : "Drag IOC chips here";
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
  runBtn.textContent = state.language === "ko" ? "조회 중..." : "Searching...";
  try {
    await submitQuery({ iocs: state.stagedIocs }, { mode: "ioc", query: state.stagedIocs.map((ioc) => ioc.value).join(", ") });
    state.stagedIocs = [];
    renderStageTray();
  } catch (error) {
    alert(`StealthMole 조회 실패: ${error.message}`);
  } finally {
    runBtn.textContent = state.language === "ko" ? "StealthMole 조회 실행" : "Run StealthMole Search";
    runBtn.disabled = !state.stagedIocs.length;
  }
}

function renderEntities() {
  const box = $("#entityList");
  const entities = state.session ? state.session.entities : [];
  if (!entities.length) {
    box.className = "muted";
    box.textContent = t("noEntity");
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
    box.textContent = state.language === "ko" ? "아직 업로드된 내용이 없습니다." : "No uploaded content yet.";
    return;
  }
  box.className = "chat-thread";
  box.innerHTML = messages
    .map((message) => {
      const files = message.files.length
        ? `<div class="msg-files">${message.files
            .map(
              (f) =>
                `<button class="inline-source" type="button" data-source-doc-id="${escapeHtml(f.documentId || "")}">${escapeHtml(f.name)}</button>`
            )
            .join(" ")}</div>`
        : "";
      const sourceButton = message.documentId
        ? `<button class="inline-source" type="button" data-source-doc-id="${escapeHtml(message.documentId)}">${escapeHtml(t("sourceMode"))}</button>`
        : "";
      return `<div class="msg msg-${message.role}"><div class="msg-text">${escapeHtml(message.text)}</div>${sourceButton}${files}</div>`;
    })
    .join("");
  box.scrollTop = box.scrollHeight;
}

function renderPendingFiles() {
  const box = $("#pendingFiles");
  if (!state.pendingFiles.length) {
    box.className = "muted";
    box.textContent = t("pendingNone");
    return;
  }
  box.className = "pending-list";
  box.innerHTML = state.pendingFiles
    .map(
      (file, index) => `
        <span class="pending-file">
          <span title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
          <button type="button" data-remove-pending-index="${index}" title="${escapeHtml(t("removePending"))}">×</button>
        </span>
      `
    )
    .join("");
}

async function addFiles(fileList) {
  for (const file of Array.from(fileList || [])) {
    const content = await file.text().catch(() => "");
    state.pendingFiles.push({ name: file.name, content });
  }
  renderPendingFiles();
}

function removePendingFile(index) {
  state.pendingFiles.splice(index, 1);
  renderPendingFiles();
}

async function analyze() {
  const message = $("#message").value;
  if (!message.trim() && !state.pendingFiles.length) return;

  const files = state.pendingFiles;
  resetStages();
  setStage("upload", "active");
  $("#analyze").disabled = true;
  $("#analyze").textContent = t("analyzing");
  try {
    completeStage("upload");
    setStage("extract", "active");
    const session = await api(`/api/sessions/${state.session.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ message, files })
    });
    completeStage("extract");
    state.session = session;
    state.pendingFiles = [];
    $("#message").value = "";
    $("#title").textContent = session.title;
    renderAll();
    await loadDocuments({ reset: true });
    await runAutoSearch({ automatic: true });
    if (state.stages.search === "pending") completeStage("search");
    completeStage("normalize");
    completeStage("complete");
  } catch (error) {
    failStage(state.currentStage === "idle" ? "upload" : state.currentStage);
    alert(`분석 실패: ${error.message}`);
  } finally {
    $("#analyze").disabled = false;
    $("#analyze").textContent = t("analyze");
  }
}

function normalizeKeyword(value) {
  return String(value || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[_/\\.-]+/g, " ")
    .trim();
}

function addFallbackCandidate(candidates, seen, value) {
  const normalized = normalizeKeyword(value);
  if (!isSearchableText(normalized) || normalized.length > 80) return;
  const key = normalized.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  candidates.push({ type: "keyword", value: normalized, source_file: "fallback" });
}

function fallbackCandidates() {
  const candidates = [];
  const seen = new Set();
  for (const doc of state.session?.sourceDocuments || []) {
    addFallbackCandidate(candidates, seen, doc.name || doc.title);
    if (candidates.length >= 8) return candidates;
  }
  for (const message of state.session?.messages || []) {
    const text = String(message.text || "");
    for (const match of text.matchAll(/[@A-Za-z0-9가-힣][@A-Za-z0-9가-힣._:-]{1,79}/g)) {
      addFallbackCandidate(candidates, seen, match[0]);
      if (candidates.length >= 8) return candidates;
    }
  }
  return candidates;
}

function autoCandidates() {
  const iocs = [...(state.session?.iocs || [])]
    .filter((ioc) => ioc.value && !ioc.queried)
    .sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0))
    .slice(0, 8);
  return iocs.length ? iocs.map((ioc) => ({ type: ioc.type, value: ioc.value })) : fallbackCandidates();
}

function updateAutoSearchButton() {
  const candidates = autoCandidates();
  const button = $("#autoSearch");
  button.disabled = !state.session || !candidates.length;
  button.textContent = candidates.length ? `${t("autoSearch")} (${Math.min(candidates.length, 8)})` : t("autoSearch");
}

async function runAutoSearch() {
  const candidates = autoCandidates();
  if (!candidates.length || !state.session) {
    updateAutoSearchButton();
    return;
  }

  const button = $("#autoSearch");
  button.disabled = true;
  button.textContent = t("autoSearching");
  try {
    setStage("search", "active");
    await submitQuery(
      { iocs: candidates },
      { mode: candidates[0]?.type === "keyword" ? "autoKeyword" : "auto", query: candidates.map((item) => item.value).join(", ") }
    );
    completeStage("search");
  } finally {
    updateAutoSearchButton();
  }
}

// --- Results list (M4) ---

function renderResultsCount() {
  const visibleCount = filteredDocuments().length;
  if (!state.documents.totalCount) {
    $("#resultsCount").textContent = "";
    return;
  }
  const byModule = Object.entries(state.session.moduleCounts || {})
    .map(([module, count]) => `${module}:${count}`)
    .join(" ");
  $("#resultsCount").textContent =
    state.language === "ko"
      ? `${visibleCount}/${state.documents.totalCount}건 (${byModule})`
      : `${visibleCount}/${state.documents.totalCount} results (${byModule})`;
}

function renderResultSummary() {
  const box = $("#resultSummary");
  if (!state.activeSearch) {
    box.className = "result-summary muted";
    box.textContent = t("resultIdle");
    return;
  }
  const modeLabel = {
    auto: t("autoMode"),
    autoKeyword: state.language === "ko" ? "자동 키워드" : "Auto keyword",
    manual: t("manualMode"),
    ioc: t("iocMode"),
    selection: t("selectionMode")
  }[state.activeSearch.mode] || t("manualMode");
  const resultCount = state.documents.totalCount || 0;
  box.className = "result-summary";
  box.innerHTML =
    state.language === "ko"
      ? `<strong>${escapeHtml(modeLabel)}</strong>: <b>${escapeHtml(state.activeSearch.query)}</b> 기준으로 StealthMole 결과 ${resultCount}건을 정리했습니다. 카드는 검색어와 함께 반환된 문서 후보이며, 제목/본문을 눌러 원문과 IOC highlight를 확인할 수 있습니다.`
      : `<strong>${escapeHtml(modeLabel)}</strong>: organized ${resultCount} StealthMole result documents for <b>${escapeHtml(state.activeSearch.query)}</b>. Click a card to inspect the source text and IOC highlights.`;
}

function renderResultsList() {
  const box = $("#resultsList");
  renderFilterOptions();
  const docs = filteredDocuments();
  if (!docs.length) {
    box.className = "results-list muted";
    box.textContent = t("noReports");
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
      <div class="result-meta muted">${escapeHtml(doc.forum_name || "-")} · ${escapeHtml(doc.timestamp || "-")} · ${escapeHtml(t("relevance"))} ${Math.round(Number(doc.relevance_score || 0) * 100)}%</div>
      <p class="result-snippet">${highlightTerms(snippet, doc.matched_iocs)}${snippet.length === 220 ? "…" : ""}</p>
      <p class="result-explain">${escapeHtml(resultExplanation(doc))}</p>
      ${contextExplanation(doc)}
      <div class="result-footer">
        <div class="result-tags">${(doc.matched_iocs || []).map((v) => `<span class="tag">${escapeHtml(v)}</span>`).join("")}</div>
        <button class="detail-button" type="button">${escapeHtml(t("detailButton"))}</button>
      </div>
    `;
    card.addEventListener("click", () => openDocument(doc.id));
    box.appendChild(card);
  }
  $("#loadMore").hidden = state.documents.cursor === null;
}

function filteredDocuments() {
  return (state.documents.data || []).filter((doc) => {
    if (state.filters.type && doc.query_ioc?.type !== state.filters.type) return false;
    if (state.filters.source && (doc.forum_name || doc.module) !== state.filters.source) return false;
    return true;
  });
}

function resultExplanation(doc) {
  const matched = (doc.matched_iocs || []).join(", ") || doc.query_ioc?.value || "-";
  if (state.language === "ko") {
    return `관련 이유: 검색 후보 ${matched}가 ${doc.module?.toUpperCase() || "module"} 결과 문서와 매칭되었습니다. ${doc.relevance_reason || ""}`.trim();
  }
  return `Why matched: candidate ${matched} matched this ${doc.module?.toUpperCase() || "module"} result document. ${doc.relevance_reason || ""}`.trim();
}

function contextExplanation(doc) {
  const context = doc.relevance_context;
  if (!context?.snippet) return "";
  const fieldLabel = {
    title: state.language === "ko" ? "제목" : "title",
    content: state.language === "ko" ? "본문" : "body",
    source_url: state.language === "ko" ? "출처 URL" : "source URL",
    forum: state.language === "ko" ? "출처" : "source",
    author: state.language === "ko" ? "작성자" : "author",
    tags: state.language === "ko" ? "태그" : "tags",
    raw_response: state.language === "ko" ? "원본 응답" : "raw response"
  }[context.field] || (state.language === "ko" ? "문서" : "document");
  const matched = context.matched || doc.query_ioc?.value || (doc.matched_iocs || [])[0] || "";
  const sentence =
    state.language === "ko"
      ? `이 결과는 ${fieldLabel}에서 검색값 "${matched}"이(가) 다음 문맥에 등장해 관련 후보로 표시되었습니다: ${context.snippet}`
      : `This result is shown because the search value "${matched}" appears in the ${fieldLabel} in this context: ${context.snippet}`;
  return `
    <p class="result-context">
      <strong>${escapeHtml(t("contextLabel"))}</strong>
      <span>${escapeHtml(sentence)}</span>
    </p>
  `;
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
  renderResultSummary();
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

function rawPayload(doc) {
  if (!doc) return null;
  return doc.raw_node || doc.raw_response || null;
}

function renderRawDocument() {
  const rawBox = $("#rawDocument");
  const raw = rawPayload(state.currentDoc);
  if (!raw || !state.showRaw) {
    rawBox.hidden = true;
    rawBox.textContent = "";
    return;
  }
  rawBox.hidden = false;
  rawBox.textContent = `${t("rawTitle")}\n${JSON.stringify(raw, null, 2)}`;
}

function toggleRawDocument() {
  state.showRaw = !state.showRaw;
  renderDocumentViewer();
}

function renderDocumentViewer() {
  const doc = state.currentDoc;
  const sourceButton = $("#docSource");
  if (!doc) {
    $("#docTitle").textContent = t("selectDocument");
    sourceButton.textContent = t("sourceMissing");
    sourceButton.disabled = true;
    sourceButton.onclick = null;
    $("#docMeta").textContent = "";
    $("#document").textContent = t("noDocument");
    renderRawDocument();
    renderDocumentIocs();
    renderSemanticList();
    return;
  }
  $("#docTitle").textContent = doc.title || doc.name;
  if (doc.isSource) {
    sourceButton.textContent = t("sourceShowing");
    sourceButton.disabled = true;
    sourceButton.onclick = null;
  } else if (rawPayload(doc)) {
    sourceButton.textContent = state.showRaw ? t("rawClose") : t("rawOpen");
    sourceButton.disabled = false;
    sourceButton.onclick = toggleRawDocument;
  } else if (doc.source_document_id) {
    sourceButton.textContent = t("sourceOpen");
    sourceButton.disabled = false;
    sourceButton.onclick = () => openSourceDocument(doc.source_document_id);
  } else {
    sourceButton.textContent = t("sourceMissing");
    sourceButton.disabled = true;
    sourceButton.onclick = null;
  }
  $("#docMeta").textContent = `${String(doc.module || doc.type || "document").toUpperCase()} · ${doc.forum_name || doc.name || "-"} · ${doc.timestamp || "-"}${doc.source_url ? " · " + doc.source_url : ""}`;
  $("#document").innerHTML = buildHighlightHtml(doc.content || "", doc.iocSpans, state.semanticHighlights, state.highlightMode);
  renderRawDocument();
  renderDocumentIocs();
  renderSemanticList();
}

function renderDocumentIocs() {
  const list = $("#docIocList");
  const iocs = state.currentDoc?.iocSpans || [];
  $("#docIocCount").textContent = iocs.length;
  if (!iocs.length) {
    list.className = "inspector-list muted";
    list.textContent = t("noDocIoc");
    return;
  }
  list.className = "inspector-list";
  list.innerHTML = iocs
    .map(
      (ioc) => `
        <button class="inspector-item" type="button" data-ioc-type="${escapeHtml(ioc.type)}" data-ioc-value="${escapeHtml(ioc.value)}">
          <strong>${escapeHtml(ioc.type)}</strong>
          <span>${escapeHtml(ioc.value)}</span>
          <small>${escapeHtml(ioc.source_file || state.currentDoc?.title || "document")} · ${Math.round(Number(ioc.confidence || 1) * 100)}%</small>
        </button>
      `
    )
    .join("");
}

function renderSemanticList() {
  const list = $("#semanticList");
  const highlights = state.semanticHighlights || [];
  $("#semanticCount").textContent = highlights.length;
  if (!highlights.length) {
    list.className = "inspector-list muted";
    list.textContent = t("noSemantic");
    return;
  }
  list.className = "inspector-list";
  list.innerHTML = highlights
    .map(
      (highlight) => `
        <div class="inspector-item semantic-item">
          <strong>${escapeHtml(highlight.category || "semantic")}</strong>
          <span>${escapeHtml(highlight.text || highlight.rationale || "")}</span>
          <small>${escapeHtml(highlight.rationale || "")} · ${Math.round(Number(highlight.confidence || 0.7) * 100)}%</small>
        </div>
      `
    )
    .join("");
}

function identifierCandidates() {
  const identifiers = [];
  for (const ioc of state.session?.iocs || []) {
    identifiers.push({
      type: ioc.type,
      value: ioc.value,
      source: ioc.source_file || "source",
      sourceId: ioc.source_document_id || ioc.source_file || "source",
      strength: ["email", "btc_address", "eth_address", "telegram"].includes(ioc.type) ? 0.75 : 0.45
    });
  }
  for (const entity of state.session?.entities || []) {
    identifiers.push({
      type: entity.type,
      value: entity.value,
      source: entity.source_file || "llm",
      sourceId: entity.source_document_id || entity.source_file || "llm",
      strength: ["threat_actor_alias", "campaign", "malware"].includes(entity.type) ? 0.55 : 0.35
    });
  }
  return identifiers.filter((item) => item.value);
}

function relationshipCandidates() {
  const relationships = new Map();
  const addPair = (a, b, baseScore, evidence, sources) => {
    if (!a || !b || a.value === b.value) return;
    const [left, right] = [a, b].sort((x, y) => `${x.type}:${x.value}`.localeCompare(`${y.type}:${y.value}`));
    const key = `${left.type}:${left.value}|${right.type}:${right.value}`;
    const existing = relationships.get(key);
    const score = Math.min(0.95, baseScore + Math.max(left.strength || 0, right.strength || 0) * 0.25);
    if (existing) {
      existing.score = Math.max(existing.score, score);
      existing.evidence = Array.from(new Set([...existing.evidence, evidence]));
      existing.sources = Array.from(new Set([...existing.sources, ...sources]));
      return;
    }
    relationships.set(key, {
      subject: left.value,
      object: right.value,
      relation: "appeared_with",
      score,
      evidence: [evidence],
      sources
    });
  };

  const bySource = new Map();
  for (const item of identifierCandidates()) {
    const key = item.sourceId || item.source;
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key).push(item);
  }

  for (const [source, items] of bySource) {
    const uniqueItems = Array.from(new Map(items.map((item) => [`${item.type}:${item.value}`, item])).values());
    for (let i = 0; i < uniqueItems.length; i += 1) {
      for (let j = i + 1; j < uniqueItems.length; j += 1) {
        addPair(uniqueItems[i], uniqueItems[j], 0.28, `appeared together in ${source}`, [source]);
      }
    }
  }

  for (const doc of state.documents.data || []) {
    const values = Array.from(new Set(doc.matched_iocs || [])).filter(Boolean);
    for (let i = 0; i < values.length; i += 1) {
      for (let j = i + 1; j < values.length; j += 1) {
        addPair(
          { type: "matched_ioc", value: values[i], strength: 0.45 },
          { type: "matched_ioc", value: values[j], strength: 0.45 },
          0.34,
          `returned by ${doc.module?.toUpperCase() || "module"} result ${doc.title || doc.id}`,
          [doc.id]
        );
      }
    }
  }

  return Array.from(relationships.values())
    .map((item) => ({
      ...item,
      status:
        item.score >= 0.75
          ? "probable_same_cluster"
          : item.score >= 0.5
            ? "review_needed"
            : "weak_candidate"
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

function renderRelationships() {
  const list = $("#relationshipList");
  const candidates = state.session?.relationships || [];
  $("#relationshipCount").textContent = candidates.length;
  if (!candidates.length) {
    list.className = "relationship-list muted";
    list.textContent = t("noRelationships");
    return;
  }
  list.className = "relationship-list";
  list.innerHTML = candidates
    .map(
      (candidate) => `
        <div class="relationship-card">
          <div class="relationship-head">
            <strong>${escapeHtml(candidate.subject)}</strong>
            <span>${escapeHtml(candidate.relation)}</span>
            <strong>${escapeHtml(candidate.object)}</strong>
          </div>
          <div class="result-meta">${Math.round(candidate.score * 100)}% · ${escapeHtml(candidate.status)}</div>
          <p class="relationship-reason"><strong>${escapeHtml(t("relationshipReasonLabel"))}</strong> ${escapeHtml(relationshipReason(candidate))}</p>
          <label class="relationship-review">
            <span>${escapeHtml(t("reviewStatusLabel"))}</span>
            <select data-relationship-status-id="${escapeHtml(candidate.id)}">
              ${relationshipStatusOptions(candidate.status)}
            </select>
          </label>
          <ul>${candidate.evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          <small>${escapeHtml(candidate.sources.join(", "))}</small>
        </div>
      `
    )
    .join("");
}

function relationshipStatusOptions(current) {
  return ["weak_candidate", "review_needed", "probable_same_cluster", "rejected", "confirmed_by_analyst"]
    .map((status) => `<option value="${escapeHtml(status)}" ${status === current ? "selected" : ""}>${escapeHtml(status)}</option>`)
    .join("");
}

function relationshipReason(candidate) {
  if (candidate.reason) {
    return state.language === "ko"
      ? `${candidate.reason} 주요 근거: ${candidate.evidence?.[0] || "-"}`
      : `${candidate.reason} Main evidence: ${candidate.evidence?.[0] || "-"}`;
  }
  const evidence = candidate.evidence?.[0] || "";
  if (state.language === "ko") {
    if (candidate.score >= 0.75) {
      return `"${candidate.subject}"와 "${candidate.object}"가 강한 식별자 또는 반복된 근거를 공유해 같은 클러스터일 가능성이 높습니다. 주요 근거: ${evidence}`;
    }
    if (candidate.score >= 0.5) {
      return `"${candidate.subject}"와 "${candidate.object}"가 같은 문서나 검색 결과에서 함께 나타나 분석가 검토가 필요한 후보입니다. 주요 근거: ${evidence}`;
    }
    return `"${candidate.subject}"와 "${candidate.object}"의 연결은 약하지만 같은 문맥에서 관찰되어 낮은 우선순위 후보로 표시했습니다. 주요 근거: ${evidence}`;
  }
  if (candidate.score >= 0.75) {
    return `"${candidate.subject}" and "${candidate.object}" share strong identifiers or repeated evidence, so they may belong to the same cluster. Main evidence: ${evidence}`;
  }
  if (candidate.score >= 0.5) {
    return `"${candidate.subject}" and "${candidate.object}" appeared in the same document or result, so this needs analyst review. Main evidence: ${evidence}`;
  }
  return `"${candidate.subject}" and "${candidate.object}" have a weak connection but appeared in related context, so they are shown as a low-priority candidate. Main evidence: ${evidence}`;
}

async function openDocument(docId) {
  const doc = await api(`/api/sessions/${state.session.id}/documents/${encodeURIComponent(docId)}`);
  state.currentDoc = doc;
  state.semanticHighlights = null;
  state.showRaw = false;
  renderDocumentViewer();
  if (state.highlightMode === "semantic" || state.highlightMode === "all") {
    await loadSemanticHighlights();
  }
}

async function openSourceDocument(docId) {
  if (!docId || !state.session) return;
  const doc = await api(`/api/sessions/${state.session.id}/source-documents/${encodeURIComponent(docId)}`);
  state.currentDoc = { ...doc, isSource: true };
  state.semanticHighlights = null;
  state.showRaw = false;
  renderDocumentViewer();
}

async function deleteSourceDocument(docId) {
  if (!docId || !state.session) return;
  if (!confirm(t("deleteFileConfirm"))) return;
  const session = await api(`/api/sessions/${state.session.id}/source-documents/${encodeURIComponent(docId)}`, {
    method: "DELETE"
  });
  state.session = session;
  state.stagedIocs = state.stagedIocs.filter((staged) =>
    (state.session.iocs || []).some((ioc) => ioc.type === staged.type && ioc.value === staged.value)
  );
  if (state.currentDoc?.id === docId) {
    state.currentDoc = null;
    state.semanticHighlights = null;
    state.showRaw = false;
  }
  renderAll();
}

async function updateRelationshipReview(relationshipId, status) {
  if (!relationshipId || !status || !state.session) return;
  const session = await api(`/api/sessions/${state.session.id}/relationships/${encodeURIComponent(relationshipId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
  state.session = session;
  renderRelationships();
}

async function loadSemanticHighlights() {
  if (!state.currentDoc || state.currentDoc.isSource) {
    state.semanticHighlights = [];
    renderDocumentViewer();
    return;
  }
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
  await submitQuery(iocType ? { iocs: [{ type: iocType, value: query }] } : { query }, { mode: iocType ? "ioc" : "selection", query });
}

// Manual search form: user picked a specific StealthMole module directly,
// bypassing the IOC-type routing table.
async function runModuleSearch(value, module) {
  const query = String(value || "").trim();
  if (!query || !state.session) return;
  await submitQuery(module ? { module, query } : { query }, { mode: "manual", query, module });
}

function addHistory(query, mode = "manual") {
  const normalized = String(query || "").trim();
  if (!normalized) return;
  state.searchHistory = [{ query: normalized, mode, at: new Date().toISOString() }, ...state.searchHistory].slice(0, 8);
  renderHistory();
}

function renderHistory() {
  const box = $("#historyList");
  if (!state.searchHistory.length) {
    box.className = "history-list muted";
    box.textContent = t("noSearches");
    return;
  }
  box.className = "history-list";
  box.innerHTML = state.searchHistory
    .map((item) => `<button type="button" data-history-query="${escapeHtml(item.query)}">${escapeHtml(item.query)}</button>`)
    .join("");
}

async function submitQuery(body, meta = {}) {
  const queryLabel =
    meta.query ||
    (Array.isArray(body.iocs) ? body.iocs.map((ioc) => ioc.value).join(", ") : body.query || body.module || "");
  state.activeSearch = {
    mode: meta.mode || "manual",
    query: queryLabel,
    module: meta.module || body.module || ""
  };
  addHistory(queryLabel, state.activeSearch.mode);
  setStage("search", "active");
  await api(`/api/sessions/${state.session.id}/query`, {
    method: "POST",
    body: JSON.stringify(body)
  });
  completeStage("search");
  setStage("normalize", "active");
  state.session = await api(`/api/sessions/${state.session.id}`);
  renderAll();
  await loadDocuments({ reset: true });
  completeStage("normalize");
  if (state.stages.complete !== "done") completeStage("complete");
}

function hideSelectionMenu() {
  $("#selectionMenu").hidden = true;
}

function renderMockNotice() {
  const notice = $("#mockNotice");
  if (!state.health?.stealthmoleMock) {
    notice.hidden = true;
    notice.textContent = "";
    return;
  }
  notice.hidden = false;
  notice.textContent = t("mockNotice");
}

function renderAll() {
  renderStages();
  renderSourceDocuments();
  renderPendingFiles();
  renderChatThread();
  renderIocs();
  renderEntities();
  renderStageTray();
  renderHistory();
  renderResultsList();
  renderResultsCount();
  renderDocumentViewer();
  renderResultSummary();
  renderRelationships();
  renderWalletPanel();
  renderMockNotice();
  updateAutoSearchButton();
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
  $("#autoSearch").addEventListener("click", () => runAutoSearch());
  $("#languageMode").addEventListener("change", (event) => {
    state.language = event.target.value;
    localStorage.setItem("d4d-language", state.language);
    applyLanguage();
  });

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
  $("#files").addEventListener("change", (event) => {
    addFiles(event.target.files);
    event.target.value = "";
  });

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

  document.body.addEventListener("click", (event) => {
    const pendingTarget = event.target.closest("[data-remove-pending-index]");
    if (pendingTarget) {
      removePendingFile(Number(pendingTarget.dataset.removePendingIndex));
      return;
    }

    const deleteSourceTarget = event.target.closest("[data-delete-source-doc-id]");
    if (deleteSourceTarget?.dataset.deleteSourceDocId) {
      deleteSourceDocument(deleteSourceTarget.dataset.deleteSourceDocId);
      return;
    }

    const sourceTarget = event.target.closest("[data-source-doc-id]");
    if (sourceTarget?.dataset.sourceDocId) {
      openSourceDocument(sourceTarget.dataset.sourceDocId);
      return;
    }

    const historyTarget = event.target.closest("[data-history-query]");
    if (historyTarget?.dataset.historyQuery) {
      $("#query").value = historyTarget.dataset.historyQuery;
      runModuleSearch(historyTarget.dataset.historyQuery, $("#service").value || undefined);
      return;
    }

    const iocTarget = event.target.closest("[data-ioc-value]");
    if (iocTarget?.dataset.iocValue) {
      runSearch(iocTarget.dataset.iocValue, iocTarget.dataset.iocType);
    }
  });

  document.body.addEventListener("change", (event) => {
    const statusTarget = event.target.closest("[data-relationship-status-id]");
    if (statusTarget?.dataset.relationshipStatusId) {
      updateRelationshipReview(statusTarget.dataset.relationshipStatusId, statusTarget.value);
    }
  });

  $("#moduleFilter").addEventListener("change", (event) => {
    state.filters.module = event.target.value;
    loadDocuments({ reset: true });
  });
  $("#typeFilter").addEventListener("change", (event) => {
    state.filters.type = event.target.value;
    renderResultsList();
    renderResultsCount();
  });
  $("#sourceFilter").addEventListener("change", (event) => {
    state.filters.source = event.target.value;
    renderResultsList();
    renderResultsCount();
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
    event.stopPropagation();
    runSearch(target.dataset.iocValue, target.dataset.iocType);
  });

  $("#document").addEventListener("mouseup", (event) => {
    const text = window.getSelection().toString().trim();
    if (!isSearchableText(text) || text.length > 200) {
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
  state.health = health;
  $("#mode").textContent = `StealthMole: ${health.stealthmoleMock ? "mock" : "live"} · LLM: ${health.llmEnabled ? "on" : "off"}`;

  state.session = await api("/api/sessions", { method: "POST", body: JSON.stringify({ title: "New incident" }) });
  $("#title").textContent = state.session.title;
  applyLanguage();
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
