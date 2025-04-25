# 🮁 Cardano Marketplace Contract (Lion City)

This repository contains the **Lion City Marketplace**: a secure, on-chain NFT marketplace built for Cardano using **Aiken** and **Lucid**. It supports direct NFT listings with fee-based payments, customizable config, and built-in protections against double satisfaction and misrouted transfers.

---

## ✨ Features

- ✅ **Buy, Delist, and Edit** support for NFTs
- ✅ Supports **custom payment tokens** (ADA, MANE, etc.)
- ✅ Fee configuration via `MarketplaceConfig` UTxO
- ✅ Enforces **fee splitting** between seller and fee address
- ✅ Prevents **double satisfaction** exploits
- ✅ Enforces that **NFT is sent to buyer**
- ✅ Upgradeable config with `Ownership` token
- ✅ Test coverage for success + failure scenarios
- ✅ Fully modular and open-source friendly

---

## 📦 Contracts Overview

| Validator             | Purpose                                                        |
| --------------------- | -------------------------------------------------------------- |
| `marketplace`         | Handles NFT buys, edits, and delists                           |
| `marketplace_control` | Mints and burns the `Ownership` and `MarketplaceConfig` tokens |
| `config_validator`    | Controls updates to fee config using `Ownership` token         |

---

## 🧠 Data Types

### `ListingDatum`

```ts
{
  seller: Address;
  price_policy: ByteArray;
  price_name: ByteArray;
  price_amount: Int;
  nft_policy: ByteArray;
  nft_name: ByteArray;
}
```

### `MarketplaceAction`

```ts
Buy | Delist | Edit { new_price: Int }
```

---

## 🛠 Prerequisites

This contract **does not** include Aiken or Deno by default. You must install them separately:

### ✅ Install Aiken

```bash
cargo install aiken
```

Or see the official guide: https://aiken-lang.org/docs/getting-started

### ✅ Install Deno

```bash
curl -fsSL https://deno.land/install.sh | sh
```

Or visit https://deno.land/manual/getting_started/installation

You also need Node.js if you plan to run frontend scripts, but it's not required for the contract itself.

### ⚙️ Configuration (Service Fee Setup)

Upon deployment, you must send a config datum defining your fee structure:

```ts
{
  fee_address: "addr...", // Address that receives all service fees
  token_fees: [
    { policy: "", name: "", fee_bps: 800 },                   // ADA: 8% fee
    { policy: "<MANE_POLICY_ID>", name: "MANE", fee_bps: 500 } // MANE: 5% fee
  ]
}
```

- fee_bps = "basis points" (100 = 1% fee)

- ADA is represented with `policy: ""` and `name: ""`

You can update the config later by holding the special Ownership token generated during the marketplace initialization.

This gives you full control to adjust service fees or fee address as needed.

---

## 🥪 Tests

### ✅ Success Tests

- Deploy marketplace
- Send config datum
- List multiple NFTs
- Edit listing price
- Buy NFT (fee paid, NFT transferred)
- Delist NFT
- Update marketplace config
- Shutdown marketplace
- Delist after shutdown

### ❌ Failure Tests

- Underpaying seller
- NFT missing from input
- NFT sent to wrong address
- Double satisfaction (2 inputs, 1 payment)
- Wrong token used for payment

All tests use the Lucid emulator and reset state per run.

---

## 🔐 Security Protections

- ✅ **Double Satisfaction Protection**: Only one input from this script allowed
- ✅ **Fee Enforcement**: Exact bps calculation and verification
- ✅ **Ownership Token**: Required to update marketplace config
- ✅ **Fail-Safe Delisting**: Always allowed, even after shutdown

---

## 📖 How to Use in Your Project

1. **Deploy a new instance**  
   Mint `MarketplaceConfig` and `Ownership` tokens

2. **Send config datum**  
   Set fee address and payment token options (e.g., ADA = 2%, MANE = 1%)

3. **List NFTs**  
   Lock any NFT at the marketplace script with a valid `ListingDatum`

4. **Buy NFTs**  
   Buyer pays → fees split → NFT delivered → validator enforces rules

5. **Delist/Edit**  
   Only the seller can delist or update their own listing

6. **Shutdown marketplace**  
   Burns Ownership and Config tokens — disables future buying - allows delisting assets

---

## 🔓 License

MIT — Free to use, extend, and fork.

> Credit appreciated if you use this for your own Cardano dApp.
