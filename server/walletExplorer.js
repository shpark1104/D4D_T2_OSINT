const BTC_PATTERN = /^(?:[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{25,59})$/;
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit || hit.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.data;
}

function cacheSet(key, data) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function addressFromInput(input) {
  return input?.prevout?.scriptpubkey_address || null;
}

function addressFromOutput(output) {
  return output?.scriptpubkey_address || null;
}

function addNeighbor(map, address, tx, value, direction) {
  if (!address) return;
  const key = address.toLowerCase();
  const existing =
    map.get(key) ||
    {
      address,
      chain: "btc_address",
      txCount: 0,
      totalSats: 0,
      directions: new Set(),
      txids: [],
      lastSeen: null
    };

  existing.txCount += 1;
  existing.totalSats += Number(value || 0);
  existing.directions.add(direction);
  if (tx.txid && !existing.txids.includes(tx.txid)) existing.txids.push(tx.txid);
  if (tx.status?.block_time) {
    const iso = new Date(Number(tx.status.block_time) * 1000).toISOString();
    if (!existing.lastSeen || iso > existing.lastSeen) existing.lastSeen = iso;
  }
  map.set(key, existing);
}

function extractBtcNeighbors(address, txs, limit) {
  const target = address.toLowerCase();
  const neighbors = new Map();

  for (const tx of txs || []) {
    const inputAddresses = (tx.vin || []).map(addressFromInput).filter(Boolean);
    const outputAddresses = (tx.vout || []).map(addressFromOutput).filter(Boolean);
    const targetInInputs = inputAddresses.some((item) => item.toLowerCase() === target);
    const targetInOutputs = outputAddresses.some((item) => item.toLowerCase() === target);

    if (!targetInInputs && !targetInOutputs) continue;

    if (targetInInputs) {
      for (const output of tx.vout || []) {
        const other = addressFromOutput(output);
        if (other && other.toLowerCase() !== target) addNeighbor(neighbors, other, tx, output.value, "sent");
      }
    }

    if (targetInOutputs) {
      for (const input of tx.vin || []) {
        const other = addressFromInput(input);
        if (other && other.toLowerCase() !== target) {
          addNeighbor(neighbors, other, tx, input.prevout?.value, "received");
        }
      }
    }
  }

  return Array.from(neighbors.values())
    .map((neighbor) => ({
      ...neighbor,
      directions: Array.from(neighbor.directions),
      txids: neighbor.txids.slice(0, 3)
    }))
    .sort((a, b) => b.txCount - a.txCount || b.totalSats - a.totalSats)
    .slice(0, limit);
}

async function getBtcNeighbors(address, { limit = 5 } = {}) {
  const normalized = String(address || "").trim();
  if (!BTC_PATTERN.test(normalized)) {
    throw Object.assign(new Error("Unsupported Bitcoin address"), { status: 400 });
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 5);
  const key = `btc:${normalized}:${safeLimit}`;
  const cached = cacheGet(key);
  if (cached) return { ...cached, cached: true };

  const url = `https://mempool.space/api/address/${encodeURIComponent(normalized)}/txs`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw Object.assign(new Error(`mempool.space ${response.status}`), { status: 502 });
  }
  const txs = await response.json();
  const data = {
    address: normalized,
    chain: "btc_address",
    source: "mempool.space",
    txSampleSize: Array.isArray(txs) ? txs.length : 0,
    neighbors: extractBtcNeighbors(normalized, txs, safeLimit)
  };
  cacheSet(key, data);
  return { ...data, cached: false };
}

module.exports = { getBtcNeighbors };
