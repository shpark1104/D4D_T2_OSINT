# Wallet Intel Submodule

Independent wallet-transaction exploration module for the CTI workbench.

## Purpose

When CTI search results contain wallet addresses, this module can:

- detect Ethereum and Bitcoin wallet address formats,
- fetch transaction history through provider APIs,
- expand counterparties by graph depth,
- return layered wallet relationships,
- expose placeholder observation hooks for future anomaly rules.

The main app should call this module through a thin API route only. Keep provider logic, graph traversal, and anomaly-rule work here to avoid collisions with the main CTI scaffold.

## Providers

- Ethereum/EVM: Etherscan API V2 `module=account&action=txlist`
- Bitcoin: Blockchain.com Data API `rawaddr`

## Output Shape

```json
{
  "address": "0x...",
  "network": "ethereum",
  "depth": 2,
  "mock": true,
  "graph": {
    "nodes": [],
    "edges": []
  },
  "layers": [],
  "transactions": [],
  "observations": [],
  "anomalyPolicy": {
    "configured": false,
    "note": "Anomaly definitions are intentionally pending."
  }
}
```

## Notes

- Depth is capped by config. Default maximum is 3.
- Fan-out is capped to keep API usage safe during early development.
- This module does not persist graph data.
- Do not place API keys or private wallet intelligence in this folder.
