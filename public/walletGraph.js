(function () {
  const BTC_PATTERN = /\b(?:[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{25,59})\b/g;
  const ETH_PATTERN = /\b0x[a-fA-F0-9]{40}\b/g;
  const DRAG_IOC = "application/x-d4d-ioc";
  const MAX_VISIBLE_LINKS = 5;
  const CENTER = { x: 360, y: 145 };

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function shortLabel(value) {
    return String(value || "").slice(0, 5);
  }

  function scanText(value) {
    const text = String(value || "");
    return [...(text.match(BTC_PATTERN) || []), ...(text.match(ETH_PATTERN) || [])];
  }

  function stringifyForScan(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }

  function chainFor(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(String(address || "")) ? "eth_address" : "btc_address";
  }

  function explorerUrl(address) {
    if (chainFor(address) === "eth_address") return `https://etherscan.io/address/${encodeURIComponent(address)}`;
    return `https://mempool.space/address/${encodeURIComponent(address)}`;
  }

  function collectWallets(item) {
    const fields = [
      item.title,
      item.content,
      (item.indicators_tagged || []).join(" "),
      stringifyForScan(item.raw_response)
    ];
    return Array.from(new Set(fields.flatMap(scanText)));
  }

  function normalizeNeighbor(item, source = "search") {
    if (!item) return null;
    const address = typeof item === "string" ? item : item.address;
    if (!address) return null;
    return {
      address,
      chain: item.chain || chainFor(address),
      source: item.source || source,
      txCount: Number(item.txCount || 0),
      totalSats: Number(item.totalSats || 0),
      directions: Array.isArray(item.directions) ? item.directions : [],
      lastSeen: item.lastSeen || null,
      txids: Array.isArray(item.txids) ? item.txids : []
    };
  }

  function mergeNeighbors(graph, items, source = "search") {
    const byAddress = new Map((graph.relatedWallets || []).map((item) => [item.address.toLowerCase(), item]));
    for (const item of items || []) {
      const neighbor = normalizeNeighbor(item, source);
      if (!neighbor || neighbor.address.toLowerCase() === graph.address.toLowerCase()) continue;
      const key = neighbor.address.toLowerCase();
      const existing = byAddress.get(key);
      byAddress.set(key, existing ? { ...existing, ...neighbor, txCount: Math.max(existing.txCount, neighbor.txCount) } : neighbor);
    }
    graph.relatedWallets = Array.from(byAddress.values()).sort(
      (a, b) => b.txCount - a.txCount || b.totalSats - a.totalSats
    );
  }

  function build(address, queryResults) {
    const root = String(address || "").trim();
    const graph = {
      address: root,
      seeds: [root],
      expanded: false,
      expandedSeeds: {},
      seedNeighbors: {},
      loading: false,
      loadingSeeds: {},
      error: null,
      hitCount: 0,
      relatedWallets: [],
      positions: {},
      source: null,
      txSampleSize: 0
    };

    const related = [];
    for (const result of queryResults || []) {
      for (const item of result.results || []) {
        graph.hitCount += 1;
        for (const wallet of collectWallets(item)) {
          if (wallet.toLowerCase() !== root.toLowerCase()) related.push(wallet);
        }
      }
    }
    mergeNeighbors(graph, related, "search");
    return graph;
  }

  function addSeed(graph, address) {
    const seed = String(address || "").trim();
    if (!seed) return graph;
    if (!graph.seeds) graph.seeds = [graph.address].filter(Boolean);
    if (!graph.seeds.some((item) => item.toLowerCase() === seed.toLowerCase())) {
      graph.seeds.push(seed);
    }
    graph.address = graph.seeds[0] || seed;
    graph.expandedSeeds = graph.expandedSeeds || {};
    graph.seedNeighbors = graph.seedNeighbors || {};
    graph.loadingSeeds = graph.loadingSeeds || {};
    return graph;
  }

  function visibleNodes(graph) {
    const seeds = (graph.seeds && graph.seeds.length ? graph.seeds : [graph.address]).filter(Boolean);
    const seedCount = seeds.length;
    const seedNodes = seeds.map((address, index) => {
      if (seedCount === 1) return { address, root: true, seed: true, x: CENTER.x, y: CENTER.y };
      const spread = Math.min(220, 90 + seedCount * 34);
      const x = CENTER.x + (index - (seedCount - 1) / 2) * (spread / Math.max(seedCount - 1, 1));
      return { address, root: true, seed: true, x, y: CENTER.y };
    });
    const nodes = [...seedNodes];

    for (const seedNode of seedNodes) {
      const seedKey = seedNode.address.toLowerCase();
      if (!graph.expandedSeeds?.[seedKey]) continue;
      const related = (graph.seedNeighbors?.[seedKey] || []).slice(0, MAX_VISIBLE_LINKS);
      const radiusX = seedCount === 1 ? 178 : 92;
      const radiusY = seedCount === 1 ? 104 : 82;
      related.forEach((neighbor, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(related.length, 1);
        nodes.push({
          ...neighbor,
          root: false,
          parent: seedNode.address,
          x: seedNode.x + Math.cos(angle) * radiusX,
          y: seedNode.y + Math.sin(angle) * radiusY
        });
      });
    }

    return nodes;
  }

  function seedPoint(nodes, address) {
    return nodes.find((node) => node.root && node.address.toLowerCase() === String(address || "").toLowerCase()) || {
      x: CENTER.x,
      y: CENTER.y
    };
  }

  function allNeighbors(graph) {
    const byAddress = new Map();
    for (const neighbors of Object.values(graph.seedNeighbors || {})) {
      for (const neighbor of neighbors || []) byAddress.set(neighbor.address.toLowerCase(), neighbor);
    }
    return Array.from(byAddress.values());
  }

  function graphLoading(graph) {
    return Object.values(graph.loadingSeeds || {}).some(Boolean);
  }

  function graphError(graph) {
    return graph.error || null;
  }

  function seedExpandedCount(graph) {
    return Object.values(graph.expandedSeeds || {}).filter(Boolean).length;
  }

  function ensureLegacyGraph(graph) {
    if (!graph.seeds) graph.seeds = [graph.address].filter(Boolean);
    if (!graph.expandedSeeds) graph.expandedSeeds = {};
    if (!graph.seedNeighbors) graph.seedNeighbors = {};
    if (!graph.loadingSeeds) graph.loadingSeeds = {};
    if (graph.relatedWallets?.length && graph.address) {
      const key = graph.address.toLowerCase();
      graph.seedNeighbors[key] = graph.seedNeighbors[key] || graph.relatedWallets;
    }
  }

  function edgeMarkup(nodes) {
    return nodes
      .filter((node) => !node.root)
      .map((node) => {
        const parent = seedPoint(nodes, node.parent);
        const label = edgeLabel(node);
        return `<g class="wallet-edge">
          <line class="wallet-link" x1="${parent.x}" y1="${parent.y}" x2="${node.x}" y2="${node.y}"></line>
          ${label ? `<text x="${(parent.x + node.x) / 2}" y="${(parent.y + node.y) / 2 - 6}">${escapeHtml(label)}</text>` : ""}
        </g>`;
      })
      .join("");
  }

  function syncPublicNeighbors(graph) {
    graph.relatedWallets = allNeighbors(graph);
  }

  function applySeedNeighbors(graph, seed, data) {
    const key = seed.toLowerCase();
    const normalized = [];
    for (const item of data.neighbors || []) {
      const neighbor = normalizeNeighbor(item, data.source || "mempool.space");
      if (neighbor && neighbor.address.toLowerCase() !== key) normalized.push(neighbor);
    }
    graph.seedNeighbors[key] = normalized
      .sort((a, b) => b.txCount - a.txCount || b.totalSats - a.totalSats)
      .slice(0, MAX_VISIBLE_LINKS);
    graph.source = data.source || "mempool.space";
    graph.txSampleSize = data.txSampleSize || 0;
    syncPublicNeighbors(graph);
  }

  function rootLabel(node) {
    return node.seed ? "seed" : "root";
  }

  function targetStart(previousPositions, key) {
    return previousPositions[key] || CENTER;
  }

  function nodeKindClass(node) {
    return node.root ? "node-wallet-root" : "node-wallet-linked";
  }

  function nodeSmallLabel(node) {
    if (node.root) return rootLabel(node);
    return node.txCount ? `${node.txCount}tx` : "link";
  }

  function displaySource(graph) {
    if (graph.source) return `${graph.source}${graph.txSampleSize ? ` / ${graph.txSampleSize} txs` : ""}`;
    return "drop BTC IOCs or click seeds";
  }

  function render(container, graph, options = {}) {
    if (!container || !graph || !graph.address) return;
    ensureLegacyGraph(graph);

    const previousPositions = graph.positions || {};
    const nodes = visibleNodes(graph);
    const targetPositions = Object.fromEntries(nodes.map((node) => [node.address.toLowerCase(), { x: node.x, y: node.y }]));
    const edges = edgeMarkup(nodes);

    const nodeMarkup = nodes
      .map((node) => {
        const iocType = chainFor(node.address);
        const key = node.address.toLowerCase();
        const start = targetStart(previousPositions, key);
        const left = ((start.x / 720) * 100).toFixed(3);
        const targetLeft = ((node.x / 720) * 100).toFixed(3);
        const titleParts = [
          node.address,
          node.txCount ? `${node.txCount} transaction(s)` : "",
          node.totalSats ? `${node.totalSats} sats` : "",
          node.lastSeen ? `last ${node.lastSeen}` : ""
        ].filter(Boolean);
        return `<div class="wallet-node wallet-node-card ${nodeKindClass(node)}"
            style="left:${left}%;top:${start.y}px"
            data-target-left="${targetLeft}%"
            data-target-top="${node.y}px"
            data-address="${escapeHtml(node.address)}"
            data-ioc-type="${iocType}"
            role="button"
            tabindex="0"
            draggable="true"
            title="${escapeHtml(titleParts.join(" | "))}">
          <span>${escapeHtml(shortLabel(node.address))}</span>
          <small>${nodeSmallLabel(node)}</small>
          <a class="wallet-explorer-link"
            href="${escapeHtml(explorerUrl(node.address))}"
            target="_blank"
            rel="noreferrer"
            aria-label="Open wallet explorer">></a>
        </div>`;
      })
      .join("");

    const visibleCount = graph.expanded ? Math.min(allNeighbors(graph).length, MAX_VISIBLE_LINKS * graph.seeds.length) : 0;
    const source = displaySource(graph);
    container.hidden = false;
    container.innerHTML = `
      <div class="wallet-graph-head">
        <div>
          <h3>Wallet Graph</h3>
          <p class="muted">${escapeHtml(graph.seeds.join("  |  "))}</p>
        </div>
        <div class="wallet-graph-stats">
          <span>${graph.seeds.length} seed</span>
          <span>${visibleCount}/${allNeighbors(graph).length} counterparties</span>
          <span>${escapeHtml(source)}</span>
        </div>
      </div>
      <div class="wallet-graph-stage ${graphLoading(graph) ? "is-loading" : ""}">
        <svg class="wallet-graph-canvas" viewBox="0 0 720 300" role="img" aria-label="Wallet relationship graph">
          ${edges}
        </svg>
        ${nodeMarkup}
        ${graphLoading(graph) ? `<div class="wallet-graph-loading">Loading transactions...</div>` : ""}
        ${graphError(graph) ? `<div class="wallet-graph-error">${escapeHtml(graphError(graph))}</div>` : ""}
      </div>
    `;

    requestAnimationFrame(() => {
      container.querySelectorAll(".wallet-node-card").forEach((nodeEl) => {
        nodeEl.style.left = nodeEl.dataset.targetLeft;
        nodeEl.style.top = nodeEl.dataset.targetTop;
        nodeEl.classList.add("is-settled");
      });
    });
    graph.positions = targetPositions;

    container.querySelectorAll(".wallet-node[data-address]").forEach((nodeEl) => {
      nodeEl.addEventListener("click", async (event) => {
        if (event.target.closest(".wallet-explorer-link")) return;
        const address = nodeEl.getAttribute("data-address");
        const type = chainFor(address);
        const seedKey = address.toLowerCase();
        const isSeed = (graph.seeds || []).some((seed) => seed.toLowerCase() === seedKey);
        if (isSeed) {
          if (graph.loadingSeeds?.[seedKey]) return;
          graph.expanded = true;
          graph.expandedSeeds[seedKey] = true;
          graph.error = null;
          if (options.loadNeighbors && !graph.seedNeighbors[seedKey] && type === "btc_address") {
            graph.loadingSeeds[seedKey] = true;
            render(container, graph, options);
            try {
              const data = await options.loadNeighbors(address, type);
              applySeedNeighbors(graph, address, data);
            } catch (error) {
              graph.error = error.message || "Failed to load wallet transactions";
            } finally {
              graph.loadingSeeds[seedKey] = false;
              render(container, graph, options);
            }
          } else {
            render(container, graph, options);
          }
        } else if (options.onAddressClick) {
          options.onAddressClick(address, type);
        }
      });

      nodeEl.addEventListener("dragstart", (event) => {
        const address = nodeEl.getAttribute("data-address");
        const ioc = { type: chainFor(address), value: address };
        event.dataTransfer.setData(DRAG_IOC, JSON.stringify(ioc));
        event.dataTransfer.setData("text/plain", address);
        event.dataTransfer.effectAllowed = "copy";
      });
    });
  }

  function clear(container) {
    if (!container) return;
    container.hidden = true;
    container.innerHTML = "";
  }

  window.WalletGraph = { build, render, clear, addSeed };
})();
