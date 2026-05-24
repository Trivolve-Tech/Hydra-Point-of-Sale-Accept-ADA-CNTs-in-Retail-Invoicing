# Integration — Wallet

The customer-side flow. merchant-pos ships a working CIP-30 implementation; this page is for developers building a custom wallet or embedding the payment intent into a different surface.

## Lifecycle

```text
1. Storefront ─► POST /api/payment                ─► merchant-pos
                                                     returns { tx_id, payment_address, settlement_layer }

2. Wallet  ─► CIP-30 signTx(payment_intent)        ─► customer signs in-head tx

3. Wallet  ─► POST /api/hydra/submit               ─► merchant-pos forwards to hydra-node
              { tx_id, cbor_hex }

4. Wallet ─► GET /api/payment?tx=<tx_id>           ─► merchant-pos polls hydra-node + L1
              until {status: "paid"}                 then writes invoice paid
```

## Connect a CIP-30 wallet

The merchant-pos UI uses the Mesh SDK for browser-side wallet integration. Equivalent vanilla CIP-30:

```javascript
// 1. Discover the wallet
const wallet = await window.cardano?.eternl?.enable();
const network = await wallet.getNetworkId();  // 1 = mainnet, 0 = testnet
const addresses = await wallet.getUsedAddresses();
```

## Sign a Hydra L2 payment intent

```javascript
// 2. Ask merchant-pos for a payment intent (Hydra-preferred)
const res = await fetch('/api/payment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ amount: 5, prefer_hydra: true }),
});
const intent = await res.json();
// { tx_id, payment_address, settlement_layer: "L2" | "L1", … }

// 3. Build the in-head tx with your tx-builder library, then sign via CIP-30
const cborHex = await wallet.signTx(builtTxCborHex, /*partial*/ true);

// 4. Submit the signed L2 tx through the merchant-pos bridge
await fetch('/api/hydra/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tx_id: intent.tx_id, cbor_hex: cborHex }),
});
```

If `settlement_layer === "L1"`, your wallet should follow the standard L1 sign + submit path against `payment_address` instead.

## Verify settlement

```javascript
async function pollUntilPaid(tx_id) {
  while (true) {
    const r = await fetch(`/api/payment?tx=${tx_id}`).then(r => r.json());
    if (r.status === 'paid') return r;
    if (r.status === 'failed' || r.status === 'cancelled') throw new Error(r.status);
    await new Promise(r => setTimeout(r, 1500));
  }
}
```

Pilot data: L2 settlement averages **~380 ms** end-to-end, vs ~48 s on L1. About **5.8%** of L2 attempts fall back to L1 cleanly without merchant intervention.

## Native-token (CNT) payments

CNT support uses the same `/api/payment` endpoint with the asset's policy id + asset name in the request body:

```json
{
  "amount": 10,
  "asset": {
    "policy_id": "<hex>",
    "asset_name": "<hex>",
    "decimals": 6
  },
  "prefer_hydra": true
}
```

`merchant-pos` selects pricing via `/api/adaprice`; for CNTs the merchant supplies an oracle of their choice or accepts a fixed exchange rate at checkout.
