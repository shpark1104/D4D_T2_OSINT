const ETH_ADDRESS = /\b0x[a-fA-F0-9]{40}\b/g;
const BTC_ADDRESS = /\b(?:bc1[a-zA-HJ-NP-Z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/g;

function extractWalletAddresses(text) {
  const source = String(text || "");
  const seen = new Set();
  const addresses = [];

  ETH_ADDRESS.lastIndex = 0;
  for (const match of source.matchAll(ETH_ADDRESS)) {
    const value = match[0];
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    addresses.push({ network: "ethereum", address: value });
  }

  BTC_ADDRESS.lastIndex = 0;
  for (const match of source.matchAll(BTC_ADDRESS)) {
    const value = match[0];
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    addresses.push({ network: "bitcoin", address: value });
  }

  return addresses;
}

function detectNetwork(address) {
  const value = String(address || "").trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(value)) return "ethereum";
  if (/^(?:bc1[a-zA-HJ-NP-Z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(value)) {
    return "bitcoin";
  }
  return null;
}

function normalizeAddress(address, network) {
  return network === "ethereum" ? String(address).toLowerCase() : String(address);
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function weiToEth(wei) {
  const value = BigInt(String(wei || "0"));
  const whole = value / 1000000000000000000n;
  const fraction = String(value % 1000000000000000000n).padStart(18, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

function satoshiToBtc(satoshi) {
  const value = BigInt(String(satoshi || "0"));
  const whole = value / 100000000n;
  const fraction = String(value % 100000000n).padStart(8, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

async function fetchJson(url) {
  if (typeof fetch !== "function") {
    throw new Error("Node.js 18 or later is required for live wallet provider calls.");
  }

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Wallet provider request failed: ${response.status}`);
  }
  return data;
}

async function fetchEthereumTransfers(address, settings) {
  if (!settings.etherscanApiKey) {
    throw new Error("ETHERSCAN_API_KEY is required when WALLET_INTEL_MOCK=false for Ethereum.");
  }

  const url = new URL(settings.etherscanBaseUrl);
  url.searchParams.set("chainid", settings.etherscanChainId);
  url.searchParams.set("module", "account");
  url.searchParams.set("action", "txlist");
  url.searchParams.set("address", address);
  url.searchParams.set("startblock", "0");
  url.searchParams.set("endblock", "999999999");
  url.searchParams.set("page", "1");
  url.searchParams.set("offset", String(settings.txLimit));
  url.searchParams.set("sort", "desc");
  url.searchParams.set("apikey", settings.etherscanApiKey);

  const data = await fetchJson(url);
  if (data.status === "0" && /no transactions/i.test(String(data.message))) return [];
  if (!Array.isArray(data.result)) {
    throw new Error(data.message || "Unexpected Etherscan response.");
  }

  const source = normalizeAddress(address, "ethereum");
  return data.result
    .filter((tx) => tx.from || tx.to)
    .map((tx) => {
      const from = normalizeAddress(tx.from || "", "ethereum");
      const to = normalizeAddress(tx.to || "", "ethereum");
      const direction = from === source ? "out" : to === source ? "in" : "related";
      return {
        network: "ethereum",
        hash: tx.hash,
        from,
        to,
        counterparty: direction === "out" ? to : from,
        direction,
        timestamp: Number(tx.timeStamp || 0),
        value: String(tx.value || "0"),
        valueNative: weiToEth(tx.value || "0"),
        status: tx.isError === "1" ? "error" : "ok",
        raw: tx
      };
    })
    .filter((tx) => tx.counterparty && /^0x[a-f0-9]{40}$/.test(tx.counterparty));
}

function bitcoinInputAddresses(tx) {
  return (tx.inputs || [])
    .map((item) => item.prev_out && (item.prev_out.addr || item.prev_out.hash))
    .filter(Boolean);
}

function bitcoinOutputAddresses(tx) {
  return (tx.out || []).map((item) => item.addr || item.hash).filter(Boolean);
}

async function fetchBitcoinTransfers(address, settings) {
  const url = new URL(`/rawaddr/${encodeURIComponent(address)}`, settings.blockchainBaseUrl);
  url.searchParams.set("limit", String(Math.min(settings.txLimit, 50)));

  const data = await fetchJson(url);
  const txs = Array.isArray(data.txs) ? data.txs : [];
  const transfers = [];

  for (const tx of txs) {
    const inputs = bitcoinInputAddresses(tx);
    const outputs = bitcoinOutputAddresses(tx);
    const sent = inputs.includes(address);
    const received = outputs.includes(address);
    const counterparties = sent
      ? outputs.filter((item) => item !== address)
      : inputs.filter((item) => item !== address);

    for (const counterparty of Array.from(new Set(counterparties))) {
      const amount = (tx.out || [])
        .filter((item) => (item.addr || item.hash) === (sent ? counterparty : address))
        .reduce((sum, item) => sum + BigInt(String(item.value || "0")), 0n);
      transfers.push({
        network: "bitcoin",
        hash: tx.hash,
        from: sent ? address : counterparty,
        to: sent ? counterparty : address,
        counterparty,
        direction: sent ? "out" : received ? "in" : "related",
        timestamp: Number(tx.time || 0),
        value: String(amount),
        valueNative: satoshiToBtc(amount),
        status: "ok",
        raw: tx
      });
    }
  }

  return transfers.filter((tx) => detectNetwork(tx.counterparty) === "bitcoin");
}

function mockTransfers(address, network, depth) {
  if (network === "bitcoin") {
    const peers = [
      "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
      "1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp",
      "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080",
      "bc1q2umvpzns5hck966lc7lazwj7ppzx6n577d0622",
      "bc1q8283c0cvh3q4lay9mr8th5myghe3ttv9dv9qun",
      "bc1qdr3czuj350a9y2uupyskdssh3lrjfs63rvrad8"
    ].filter((item) => item !== address);
    const [a, b, c, d, e] = peers;
    return [
      { network, hash: "mock-btc-1", from: address, to: a, counterparty: a, direction: "out", timestamp: 1760000000, value: "1800000", valueNative: "0.018", status: "ok" },
      { network, hash: "mock-btc-2", from: b, to: address, counterparty: b, direction: "in", timestamp: 1759900000, value: "900000", valueNative: "0.009", status: "ok" },
      { network, hash: "mock-btc-3", from: address, to: c, counterparty: c, direction: "out", timestamp: 1759800000, value: "420000", valueNative: "0.0042", status: "ok" },
      { network, hash: "mock-btc-4", from: d, to: address, counterparty: d, direction: "in", timestamp: 1759700000, value: "610000", valueNative: "0.0061", status: "ok" },
      { network, hash: "mock-btc-5", from: address, to: e, counterparty: e, direction: "out", timestamp: 1759600000, value: "730000", valueNative: "0.0073", status: "ok" },
      ...(depth > 0 ? [{ network, hash: "mock-btc-6", from: a, to: c, counterparty: c, direction: "out", timestamp: 1759500000, value: "800000", valueNative: "0.008", status: "ok" }] : [])
    ];
  }

  const peers = [
    "0x742d35cc6634c0532925a3b844bc454e4438f44e",
    "0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae",
    "0x00000000219ab540356cbb839cbe05303d7705fa",
    "0x123bf3b32fb3986c9251c81430d2542d5054f0d2",
    "0xf66ac2c80aaeff89b081ff911e80e7daeb9d0af6",
    "0x3ddb59b591b63906617ad1d245a70f915d73b494"
  ].filter((item) => item !== normalizeAddress(address, "ethereum"));
  const [a, b, c, d, e] = peers;
  return [
    { network, hash: "mock-eth-1", from: address, to: a, counterparty: a, direction: "out", timestamp: 1760000000, value: "420000000000000000", valueNative: "0.42", status: "ok" },
    { network, hash: "mock-eth-2", from: b, to: address, counterparty: b, direction: "in", timestamp: 1759900000, value: "120000000000000000", valueNative: "0.12", status: "ok" },
    { network, hash: "mock-eth-3", from: address, to: c, counterparty: c, direction: "out", timestamp: 1759800000, value: "580000000000000000", valueNative: "0.58", status: "ok" },
    { network, hash: "mock-eth-4", from: a, to: address, counterparty: a, direction: "in", timestamp: 1759700000, value: "80000000000000000", valueNative: "0.08", status: "ok" },
    { network, hash: "mock-eth-5", from: address, to: b, counterparty: b, direction: "out", timestamp: 1759600000, value: "1100000000000000000", valueNative: "1.10", status: "ok" },
    ...(depth > 0 ? [
      { network, hash: "mock-eth-6", from: a, to: d, counterparty: d, direction: "out", timestamp: 1759500000, value: "50000000000000000", valueNative: "0.05", status: "ok" },
      { network, hash: "mock-eth-7", from: b, to: e, counterparty: e, direction: "out", timestamp: 1759400000, value: "310000000000000000", valueNative: "0.31", status: "ok" }
    ] : [])
  ];
}

async function fetchTransfers(address, network, settings, currentDepth) {
  if (settings.mockMode) return mockTransfers(address, network, settings.depth - currentDepth);
  if (network === "ethereum") return fetchEthereumTransfers(address, settings);
  if (network === "bitcoin") return fetchBitcoinTransfers(address, settings);
  return [];
}

function addNode(nodes, id, network, depth, role) {
  const existing = nodes.get(id);
  if (existing) {
    existing.depth = Math.min(existing.depth, depth);
    if (role === "seed") existing.role = "seed";
    return existing;
  }

  const node = {
    id,
    label: id.length > 18 ? `${id.slice(0, 10)}...${id.slice(-6)}` : id,
    network,
    depth,
    role
  };
  nodes.set(id, node);
  return node;
}

function buildLayers(nodes) {
  const grouped = new Map();
  for (const node of nodes.values()) {
    if (!grouped.has(node.depth)) grouped.set(node.depth, []);
    grouped.get(node.depth).push(node.id);
  }
  return Array.from(grouped.entries())
    .sort(([a], [b]) => a - b)
    .map(([depth, addresses]) => ({ depth, addresses }));
}

function createObservations(nodes, edges) {
  const observations = [
    {
      type: "policy",
      severity: "info",
      title: "Anomaly rules pending",
      detail: "Formal anomaly definitions are not configured yet. Current output is structural only."
    }
  ];

  const degree = new Map();
  const pairCounts = new Map();
  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
    const pair = [edge.source, edge.target].sort().join("|");
    pairCounts.set(pair, (pairCounts.get(pair) || 0) + 1);
  }

  for (const [address, count] of degree.entries()) {
    if (count >= 5) {
      observations.push({
        type: "graph_degree",
        severity: "medium",
        title: "High local degree candidate",
        detail: `${address} appears in ${count} sampled edge(s).`
      });
    }
  }

  for (const [pair, count] of pairCounts.entries()) {
    if (count >= 3) {
      observations.push({
        type: "repeated_counterparty",
        severity: "medium",
        title: "Repeated counterparty candidate",
        detail: `${pair} appears ${count} time(s) in sampled transactions.`
      });
    }
  }

  return observations;
}

async function analyzeWallet(options, config) {
  const address = String(options.address || "").trim();
  const network = options.network || detectNetwork(address);
  if (!network) {
    const error = new Error("Unsupported wallet address format.");
    error.status = 400;
    throw error;
  }

  const settings = {
    mockMode: config.walletIntel.mockMode,
    etherscanApiKey: config.walletIntel.etherscanApiKey,
    etherscanBaseUrl: config.walletIntel.etherscanBaseUrl,
    etherscanChainId: config.walletIntel.etherscanChainId,
    blockchainBaseUrl: config.walletIntel.blockchainBaseUrl,
    depth: clampNumber(options.depth, 1, 0, config.walletIntel.maxDepth),
    txLimit: clampNumber(options.txLimit, config.walletIntel.txLimit, 1, config.walletIntel.txLimit),
    maxFanout: config.walletIntel.maxFanout,
    maxNodes: config.walletIntel.maxNodes
  };

  const seed = normalizeAddress(address, network);
  const nodes = new Map();
  const edges = [];
  const transactions = [];
  const visited = new Set();
  const queue = [{ address: seed, depth: 0 }];

  addNode(nodes, seed, network, 0, "seed");

  while (queue.length) {
    const current = queue.shift();
    if (visited.has(current.address) || current.depth > settings.depth) continue;
    visited.add(current.address);

    const transfers = await fetchTransfers(current.address, network, settings, current.depth);
    let expanded = 0;
    for (const transfer of transfers) {
      const from = normalizeAddress(transfer.from, network);
      const to = normalizeAddress(transfer.to, network);
      const counterparty = normalizeAddress(transfer.counterparty, network);
      const nextDepth = Math.min(settings.depth, current.depth + 1);
      const fromDepth = from === current.address ? current.depth : from === seed ? 0 : nextDepth;
      const toDepth = to === current.address ? current.depth : to === seed ? 0 : nextDepth;

      addNode(nodes, from, network, fromDepth, from === seed ? "seed" : "wallet");
      addNode(nodes, to, network, toDepth, to === seed ? "seed" : "wallet");

      const edge = {
        id: `${transfer.hash}:${from}:${to}:${edges.length}`,
        source: from,
        target: to,
        txHash: transfer.hash,
        valueNative: transfer.valueNative,
        valueRaw: transfer.value,
        timestamp: transfer.timestamp,
        depth: current.depth,
        status: transfer.status
      };
      edges.push(edge);
      transactions.push({ ...transfer, from, to, counterparty });

      if (
        current.depth < settings.depth &&
        !visited.has(counterparty) &&
        expanded < settings.maxFanout &&
        nodes.size < settings.maxNodes
      ) {
        queue.push({ address: counterparty, depth: current.depth + 1 });
        expanded += 1;
      }
    }
  }

  const nodeList = Array.from(nodes.values()).sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id));
  const edgeList = edges.slice(0, settings.maxNodes * settings.txLimit);

  return {
    address: seed,
    network,
    depth: settings.depth,
    mock: settings.mockMode,
    graph: {
      nodes: nodeList,
      edges: edgeList
    },
    layers: buildLayers(nodes),
    transactions,
    observations: createObservations(nodes, edgeList),
    anomalyPolicy: {
      configured: false,
      note: "Anomaly definitions are intentionally pending."
    },
    provider: network === "ethereum" ? "etherscan" : "blockchain.com"
  };
}

module.exports = {
  analyzeWallet,
  detectNetwork,
  extractWalletAddresses
};
