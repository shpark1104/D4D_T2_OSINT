(function () {
  const BTC_PATTERN = /\b(?:[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{25,59})\b/g;
  const ETH_PATTERN = /\b0x[a-fA-F0-9]{40}\b/g;
  const DRAG_IOC = "application/x-d4d-ioc";
  const MAX_VISIBLE_LINKS = 5;

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

  function build(address, queryResults) {
    const root = String(address || "").trim();
    const related = new Map();
    let hitCount = 0;

    for (const result of queryResults || []) {
      for (const item of result.results || []) {
        hitCount += 1;
        for (const wallet of collectWallets(item)) {
          if (wallet.toLowerCase() === root.toLowerCase()) continue;
          related.set(wallet.toLowerCase(), wallet);
        }
      }
    }

    return {
      address: root,
      expanded: false,
      hitCount,
      relatedWallets: Array.from(related.values())
    };
  }

  function visibleNodes(graph) {
    const nodes = [{ address: graph.address, root: true, x: 360, y: 120 }];
    if (!graph.expanded) return nodes;

    const related = graph.relatedWallets.slice(0, MAX_VISIBLE_LINKS);
    const radius = related.length <= 2 ? 115 : 130;
    related.forEach((address, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(related.length, 1);
      nodes.push({
        address,
        root: false,
        x: 360 + Math.cos(angle) * radius,
        y: 120 + Math.sin(angle) * radius
      });
    });
    return nodes;
  }

  function render(container, graph, options = {}) {
    if (!container || !graph || !graph.address) return;

    const nodes = visibleNodes(graph);
    const edges = graph.expanded
      ? nodes
          .filter((node) => !node.root)
          .map(
            (node) => `<line class="wallet-link" x1="360" y1="120" x2="${node.x}" y2="${node.y}"></line>`
          )
          .join("")
      : "";

    const nodeMarkup = nodes
      .map((node) => {
        const iocType = chainFor(node.address);
        const left = ((node.x / 720) * 100).toFixed(3);
        return `<div class="wallet-node wallet-node-card ${node.root ? "node-wallet-root" : "node-wallet-linked"}"
            style="left:${left}%;top:${node.y}px"
            data-address="${escapeHtml(node.address)}"
            data-ioc-type="${iocType}"
            role="button"
            tabindex="0"
            draggable="true"
            title="${escapeHtml(node.address)}">
          <span>${escapeHtml(shortLabel(node.address))}</span>
          <a class="wallet-explorer-link"
            href="${escapeHtml(explorerUrl(node.address))}"
            target="_blank"
            rel="noreferrer"
            aria-label="Open wallet explorer">></a>
        </div>`;
      })
      .join("");

    const visibleCount = graph.expanded ? Math.min(graph.relatedWallets.length, MAX_VISIBLE_LINKS) : 0;
    container.hidden = false;
    container.innerHTML = `
      <div class="wallet-graph-head">
        <div>
          <h3>Wallet Graph</h3>
          <p class="muted">${escapeHtml(graph.address)}</p>
        </div>
        <div class="wallet-graph-stats">
          <span>${graph.hitCount} hits</span>
          <span>${visibleCount}/${graph.relatedWallets.length} links</span>
        </div>
      </div>
      <div class="wallet-graph-stage">
        <svg class="wallet-graph-canvas" viewBox="0 0 720 260" role="img" aria-label="Wallet relationship graph">
          ${edges}
        </svg>
        ${nodeMarkup}
      </div>
    `;

    container.querySelectorAll(".wallet-node[data-address]").forEach((nodeEl) => {
      nodeEl.addEventListener("click", (event) => {
        if (event.target.closest(".wallet-explorer-link")) return;
        const address = nodeEl.getAttribute("data-address");
        if (address === graph.address) {
          graph.expanded = true;
          render(container, graph, options);
        } else if (options.onAddressClick) {
          options.onAddressClick(address, chainFor(address));
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

  window.WalletGraph = { build, render, clear };
})();
