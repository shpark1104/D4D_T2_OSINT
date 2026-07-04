const state = {
  incident: null,
  documentText: "",
  searchTerms: []
};

const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function highlight(text) {
  let html = escapeHtml(text);
  for (const term of state.searchTerms.filter(Boolean)) {
    const escaped = escapeHtml(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(new RegExp(escaped, "gi"), (match) => `<mark>${match}</mark>`);
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

function renderIocs() {
  const list = $("#iocList");
  const iocs = state.incident ? state.incident.iocs : [];
  if (!iocs.length) {
    list.className = "chips muted";
    list.textContent = "No IOC";
    return;
  }

  list.className = "chips";
  list.innerHTML = "";
  for (const ioc of iocs) {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = `${ioc.type}: ${ioc.value}`;
    chip.addEventListener("click", () => runSearch(ioc.value));
    list.appendChild(chip);
  }
}

function renderDocument() {
  $("#document").innerHTML = highlight(state.documentText || "No document");
}

function renderResults(results = []) {
  const box = $("#results");
  if (!results.length) {
    box.className = "muted";
    box.textContent = "No reports";
    return;
  }

  box.className = "";
  box.innerHTML = "";
  for (const result of results) {
    const item = document.createElement("div");
    item.className = "result";
    item.innerHTML = `<strong>${escapeHtml(result.title)}</strong><p>${escapeHtml(result.summary)}</p>`;
    item.addEventListener("click", () => {
      state.documentText = result.content;
      state.searchTerms = [$("#query").value];
      renderDocument();
    });
    box.appendChild(item);
  }
}

async function analyze() {
  const fileInput = $("#files");
  const files = [];
  for (const file of Array.from(fileInput.files || [])) {
    files.push({ name: file.name, content: await file.text() });
  }

  const message = $("#message").value;
  const incident = await api("/api/incidents", {
    method: "POST",
    body: JSON.stringify({ message, files })
  });

  state.incident = incident;
  state.documentText = [message, ...files.map((file) => `# ${file.name}\n${file.content}`)].join("\n\n");
  state.searchTerms = incident.iocs.map((ioc) => ioc.value);
  $("#title").textContent = incident.title;
  $("#entityList").textContent = "Placeholder";
  renderIocs();
  renderDocument();
}

async function runSearch(value) {
  const query = String(value || $("#query").value || "").trim();
  if (!query) return;

  $("#query").value = query;
  state.searchTerms = [query];
  renderDocument();

  const data = await api("/api/search", {
    method: "POST",
    body: JSON.stringify({
      service: $("#service").value,
      query
    })
  });
  renderResults(data.results || []);
}

async function boot() {
  $("#analyze").addEventListener("click", analyze);
  $("#searchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch();
  });

  $("#document").addEventListener("mouseup", () => {
    const text = window.getSelection().toString().trim();
    if (text.length >= 3 && text.length <= 120) runSearch(text);
  });

  const health = await api("/api/health");
  $("#mode").textContent = `mode: ${health.mockMode ? "mock" : "live"}`;
}

boot().catch((error) => {
  console.error(error);
});
