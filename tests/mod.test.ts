import { MarketplaceContract } from "../mod.ts";
import {
  Assets,
  Emulator,
  Crypto,
  Lucid,
  fromText,
  toUnit,
  Addresses, // ✅ Import Addresses
} from "../../deps.ts";
import * as D from "../types.ts";
import { MyNFT1, MyNFT2, MyNFT3, MyNFT4, MyNFT5, MyNFT6 } from "../testData.ts";
import { toAddress } from "../utils.ts";

// --- Sample Token ---
// --- Config ---
const MANE_POLICY_ID =
  "a90d1702625ee4ebcee3b3649708cbcbb163f50db9663308acc9650e";
const MANE = fromText("MANE");
const MANE_UNIT = toUnit(MANE_POLICY_ID, MANE);

const FAKE_POLICY_ID =
  "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
const FAKE_ASSET_NAME = fromText("FAKE");
const FAKE_UNIT = toUnit(FAKE_POLICY_ID, FAKE_ASSET_NAME);

// --- Helper to generate accounts ---
async function generateAccount(assets: Assets) {
  const seedPhrase = Crypto.generateSeed();
  const lucid = new Lucid();
  const address = await lucid.selectWalletFromSeed(seedPhrase).wallet.address();

  return { seedPhrase, address, assets };
}

async function expectFailure(fn: () => Promise<any>, reason: string) {
  try {
    await fn();
    throw new Error(`❌ Expected failure but transaction succeeded: ${reason}`);
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("failed script execution")
    ) {
      console.log(`✅ Failing as expected: ${reason}`);
    } else {
      console.error(`❌ Unexpected error during failure test:`, err);
      throw err; // Bubble unexpected errors
    }
  }
}

// --- Global Emulator Setup ---
const MASTER = await generateAccount({
  lovelace: 1_000_000_000n,
  [MANE_UNIT]: 1_000_000_000_000n,
});
const SELLER = await generateAccount({
  lovelace: 1_000_000_000n,
  [MANE_UNIT]: 1_000_000_000_000n,
  [toUnit(MyNFT1.policyId, MyNFT1.assetName)]: 1n,
  [toUnit(MyNFT2.policyId, MyNFT2.assetName)]: 1n,
  [toUnit(MyNFT3.policyId, MyNFT3.assetName)]: 1n,
  [toUnit(MyNFT4.policyId, MyNFT4.assetName)]: 1n,
  [toUnit(MyNFT5.policyId, MyNFT5.assetName)]: 1n,
  [toUnit(MyNFT6.policyId, MyNFT6.assetName)]: 1n,
});
const BUYER = await generateAccount({
  lovelace: 1_000_000_000_000n,
  [MANE_UNIT]: 1_000_000_000_000n,
  [FAKE_UNIT]: 1_000_000_000_000n,
});

const emulator = new Emulator([MASTER, SELLER, BUYER]);
const lucid = new Lucid({ provider: emulator, network: "Mainnet" });
lucid.selectWalletFromSeed(MASTER.seedPhrase);
// lucid.network = "Mainnet";
console.log("Lucid Network:", lucid.network);

console.log("Seller Address", SELLER.address);

const { txHash, instanceId } = await new MarketplaceContract(lucid).deploy(
  "TestMarket"
);
console.log("Marketplace Deployed");
console.log("txHash:", txHash);
console.log("instanceId:", instanceId);
emulator.awaitBlock();

// --- Tests ---

Deno.test("⚙️ Sends config datum to config validator", async () => {
  const txHash = await new MarketplaceContract(
    lucid,
    instanceId
  ).sendConfigDatum({
    fee_address: await lucid.wallet.address(), // current wallet receives fees
    token_fees: [
      {
        policy: MANE_POLICY_ID, // MANE
        name: MANE,
        fee_bps: 500, // 5%
      },
      {
        policy: "", // ADA
        name: "",
        fee_bps: 700, // 7%
      },
    ],
  });

  console.log("✅ Config datum sent:");
  console.log("Tx Hash:", txHash);
  emulator.awaitBlock();
});

Deno.test("Can list multiple NFTs for sale", async () => {
  lucid.selectWalletFromSeed(SELLER.seedPhrase);

  const nfts = [MyNFT1, MyNFT2, MyNFT3, MyNFT4, MyNFT5];

  for (const nft of nfts) {
    const txHash = await new MarketplaceContract(
      lucid,
      instanceId
    ).createListingTx({
      nftUnit: toUnit(nft.policyId, nft.assetName),
      pricePolicy: MANE_POLICY_ID,
      priceName: MANE,
      priceAmount: 10_000_000_000n,
    });

    console.log(`Listed ${nft.assetName} Tx Hash:`, txHash);
    emulator.awaitBlock();
  }
});

Deno.test("Can edit NFT price", async () => {
  lucid.selectWalletFromSeed(SELLER.seedPhrase);

  const utxos = await lucid.utxosAt(
    new MarketplaceContract(lucid, instanceId).getAddress()
  );
  const listed = utxos.find(
    (u) => u.assets[toUnit(MyNFT1.policyId, MyNFT1.assetName)] === 1n
  );
  if (!listed) throw new Error("Listing not found");

  const newPrice = 25_000_000_000n;
  const txHash = await new MarketplaceContract(lucid, instanceId).editListingTx(
    listed,
    newPrice
  );
  console.log("Edit Tx Hash:", txHash);
  emulator.awaitBlock();

  const updated = await lucid.utxosAt(
    new MarketplaceContract(lucid, instanceId).getAddress()
  );
  console.log(
    "Updated listing UTxO:",
    updated.find(
      (u) => u.assets[toUnit(MyNFT1.policyId, MyNFT1.assetName)] === 1n
    )
  );
});

Deno.test("Can buy listed NFT", async () => {
  lucid.selectWalletFromSeed(BUYER.seedPhrase);

  // 🔍 Find the listed NFT UTxO at the script address
  const utxos = await lucid.utxosAt(
    new MarketplaceContract(lucid, instanceId).getAddress()
  );
  const listed = utxos.find(
    (u) => u.assets[toUnit(MyNFT1.policyId, MyNFT1.assetName)] === 1n
  );

  if (!listed) throw new Error("Listing not found");

  // 💰 Buyer purchases the NFT
  const txHash = await new MarketplaceContract(lucid, instanceId).buyTx(listed);
  console.log("Buy Tx Hash:", txHash);

  emulator.awaitBlock();

  // ✅ Verify buyer received the NFT
  const buyerUtxos = await lucid.wallet.getUtxos();
  const ownsNFT = buyerUtxos.some(
    (u) => u.assets[toUnit(MyNFT1.policyId, MyNFT1.assetName)] === 1n
  );
  console.log("✅ Expected SELLER.address:", SELLER.address);
  console.log("Buyer owns NFT:", ownsNFT);
  if (!ownsNFT) throw new Error("Buyer did not receive NFT");
});

Deno.test("🧾 Buyer pays and fees are split correctly (1% MANE)", async () => {
  lucid.selectWalletFromSeed(BUYER.seedPhrase);

  const contract = new MarketplaceContract(lucid, instanceId);
  const nftUnit = toUnit(MyNFT5.policyId, MyNFT5.assetName);
  const expectedPrice = 10_000_000_000n;

  // 🔍 Find the listed NFT
  const utxos = await lucid.utxosAt(contract.getAddress());
  const listed = utxos.find((u) => u.assets[nftUnit] === 1n);
  if (!listed) throw new Error("NFT listing not found");

  const datum = await lucid.datumOf(listed, D.ListingDatum);
  const sellerAddress = toAddress(datum.seller, lucid);

  // 💰 Execute Buy
  const txHash = await contract.buyTx(listed);
  console.log("Buy Tx Hash:", txHash);
  emulator.awaitBlock();

  // 🧾 Load config to compute expected fee
  const configUnit = toUnit(
    contract.marketplaceControlPolicyId,
    fromText("MarketplaceConfig")
  );
  const [configUtxo] = await lucid.utxosAtWithUnit(
    contract.marketplaceConfigAddress,
    configUnit
  );
  const configDatum = await lucid.datumOf<D.ConfigDatum>(
    configUtxo,
    D.ConfigDatum
  );

  const feeRule = configDatum.token_fees.find(
    (f) => f.policy === MANE_POLICY_ID && f.name === MANE
  );
  if (!feeRule) throw new Error("MANE fee rule not found");

  const feeBps = BigInt(feeRule.fee_bps);
  const expectedFee = (expectedPrice * feeBps) / 10_000n;
  const expectedSeller = expectedPrice - expectedFee;

  const unit =
    datum.pricePolicy === "" && datum.priceName === ""
      ? "lovelace"
      : toUnit(datum.pricePolicy, datum.priceName);

  const feeAddress = toAddress(configDatum.fee_address, lucid);

  // 🧾 Reload UTxOs after buy
  const sellerUtxos = await lucid.utxosAt(sellerAddress);
  const feeUtxos = await lucid.utxosAt(feeAddress);

  // ✅ Sum amounts received
  const sellerReceived = sellerUtxos
    .map((u) => u.assets[unit] || 0n)
    .reduce((a, b) => a + b, 0n);

  const feeReceived = feeUtxos
    .map((u) => u.assets[unit] || 0n)
    .reduce((a, b) => a + b, 0n);

  console.log("Expected Seller:", expectedSeller.toString());
  console.log("Actual Seller:", sellerReceived.toString());
  console.log("Expected Fee:", expectedFee.toString());
  console.log("Actual Fee:", feeReceived.toString());

  if (sellerReceived < expectedSeller) {
    throw new Error("❌ Seller did not receive enough payment");
  }
  if (feeReceived < expectedFee) {
    throw new Error("❌ Fee address did not receive correct fee");
  }
});

Deno.test("Can list NFT6 for 10 ADA", async () => {
  lucid.selectWalletFromSeed(SELLER.seedPhrase);

  const txHash = await new MarketplaceContract(
    lucid,
    instanceId
  ).createListingTx({
    nftUnit: toUnit(MyNFT6.policyId, MyNFT6.assetName),
    pricePolicy: "", // ADA policy ID is empty string
    priceName: "", // ADA asset name is also empty
    priceAmount: 10_000_000n, // 10 ADA in lovelace units
  });

  console.log("✅ Listed MyNFT6 for 10 ADA");
  console.log("Tx Hash:", txHash);
  emulator.awaitBlock();
});

Deno.test("🧾 Buyer pays and fees are split correctly (2% ADA)", async () => {
  lucid.selectWalletFromSeed(BUYER.seedPhrase);

  const contract = new MarketplaceContract(lucid, instanceId);
  const nftUnit = toUnit(MyNFT6.policyId, MyNFT6.assetName);
  const expectedPrice = 10_000_000n; // 10 ADA

  const utxos = await lucid.utxosAt(contract.getAddress());
  const listed = utxos.find((u) => u.assets[nftUnit] === 1n);
  if (!listed) throw new Error("NFT listing not found");

  const datum = await lucid.datumOf(listed, D.ListingDatum);
  const sellerAddress = toAddress(datum.seller, lucid);

  // 🧾 Load config to get feeAddress and fee settings
  const configUnit = toUnit(
    contract.marketplaceControlPolicyId,
    fromText("MarketplaceConfig")
  );
  const [configUtxo] = await lucid.utxosAtWithUnit(
    contract.marketplaceConfigAddress,
    configUnit
  );
  const configDatum = await lucid.datumOf<D.ConfigDatum>(
    configUtxo,
    D.ConfigDatum
  );
  const feeRule = configDatum.token_fees.find(
    (f) => f.policy === "" && f.name === ""
  );
  if (!feeRule) throw new Error("ADA fee rule not found");

  const feeBps = BigInt(feeRule.fee_bps);
  const expectedFee = (expectedPrice * feeBps) / 10_000n;
  const expectedSeller = expectedPrice - expectedFee;

  const feeAddress = toAddress(configDatum.fee_address, lucid); // ✅ Fixed: read fee address dynamically

  // 📋 BEFORE Buy
  const sellerUtxosBefore = await lucid.utxosAt(sellerAddress);
  const feeUtxosBefore = await lucid.utxosAt(feeAddress);

  const sellerBalanceBefore = sellerUtxosBefore
    .map((u) => u.assets["lovelace"] || 0n)
    .reduce((a, b) => a + b, 0n);

  const feeBalanceBefore = feeUtxosBefore
    .map((u) => u.assets["lovelace"] || 0n)
    .reduce((a, b) => a + b, 0n);

  // 💰 BUY
  const txHash = await contract.buyTx(listed);
  console.log("Buy Tx Hash:", txHash);
  emulator.awaitBlock();

  // 📋 AFTER Buy
  const sellerUtxosAfter = await lucid.utxosAt(sellerAddress);
  const feeUtxosAfter = await lucid.utxosAt(feeAddress);

  const sellerBalanceAfter = sellerUtxosAfter
    .map((u) => u.assets["lovelace"] || 0n)
    .reduce((a, b) => a + b, 0n);

  const feeBalanceAfter = feeUtxosAfter
    .map((u) => u.assets["lovelace"] || 0n)
    .reduce((a, b) => a + b, 0n);

  const sellerReceived = sellerBalanceAfter - sellerBalanceBefore;
  const feeReceived = feeBalanceAfter - feeBalanceBefore;

  console.log("Expected Seller:", expectedSeller.toString());
  console.log("Actual Seller Received:", sellerReceived.toString());
  console.log("Expected Fee:", expectedFee.toString());
  console.log("Actual Fee Received:", feeReceived.toString());

  if (sellerReceived < expectedSeller) {
    throw new Error("❌ Seller did not receive enough ADA");
  }
  if (feeReceived < expectedFee) {
    throw new Error("❌ Fee address did not receive correct ADA");
  }
});

Deno.test("Can delist NFT", async () => {
  lucid.selectWalletFromSeed(SELLER.seedPhrase);

  const utxos = await lucid.utxosAt(
    new MarketplaceContract(lucid, instanceId).getAddress()
  );
  const listed = utxos.find(
    (u) => u.assets[toUnit(MyNFT2.policyId, MyNFT2.assetName)] === 1n
  );

  if (!listed) throw new Error("Listing not found");

  const txHash = await new MarketplaceContract(lucid, instanceId).delistTx(
    listed
  );
  console.log("Delist Tx Hash:", txHash);
  emulator.awaitBlock();
});

// Deno.test("Can update marketplace config", async () => {
//   lucid.selectWalletFromSeed(MASTER.seedPhrase); // whoever holds Ownership

//   const contract = new MarketplaceContract(lucid, instanceId);

//   const txHash = await contract.updateConfigDatum({
//     fee_address: MASTER.address, // or another address to simulate a change
//     token_fees: [
//       { policy: "", name: "", fee_bps: 300 }, // 3% ADA
//       { policy: MANE_POLICY_ID, name: MANE, fee_bps: 50 }, // 0.5% MANE
//     ],
//   });

//   console.log("Updated config tx:", txHash);
//   emulator.awaitBlock();

//   // ✅ Optional: read config back and assert fee value was updated
//   const configUnit = toUnit(
//     contract.marketplaceControlPolicyId,
//     fromText("MarketplaceConfig")
//   );
//   const [configUtxo] = await lucid.utxosAtWithUnit(
//     contract.marketplaceConfigAddress,
//     configUnit
//   );
//   const configDatum = await lucid.datumOf<D.ConfigDatum>(
//     configUtxo,
//     D.ConfigDatum
//   );

//   const adaFee = configDatum.token_fees.find(
//     (f) => f.policy === "" && f.name === ""
//   );
//   if (!adaFee || adaFee.fee_bps !== 300n)
//     throw new Error("Config not updated correctly");
// });

/////////////////// FAILURE TESTS /////////////////////////

Deno.test("🧪 Fails if buyer pays too little", async () => {
  lucid.selectWalletFromSeed(BUYER.seedPhrase);

  const utxos = await lucid.utxosAt(
    new MarketplaceContract(lucid, instanceId).getAddress()
  );
  const listing = utxos.find(
    (u) => u.assets[toUnit(MyNFT3.policyId, MyNFT3.assetName)] === 1n
  );
  if (!listing) throw new Error("Listing not found");

  await expectFailure(
    () =>
      new MarketplaceContract(lucid, instanceId).failBuyTx(listing, 5_000_000n),
    "Buyer should not be able to underpay"
  );
});

Deno.test("🧪 Fails if NFT is not in the input", async () => {
  lucid.selectWalletFromSeed(BUYER.seedPhrase);

  const utxos = await lucid.utxosAt(
    new MarketplaceContract(lucid, instanceId).getAddress()
  );
  const listing = utxos.find(
    (u) => u.assets[toUnit(MyNFT3.policyId, MyNFT3.assetName)] === 1n
  );

  if (!listing) throw new Error("Listing not found");

  await expectFailure(
    () => new MarketplaceContract(lucid, instanceId).failBuyMissingNft(listing),
    "Expected failure: NFT is missing in UTxO input"
  );
});

Deno.test("Fails if NFT is not sent to buyer", async () => {
  lucid.selectWalletFromSeed(BUYER.seedPhrase);

  const utxos = await lucid.utxosAt(
    new MarketplaceContract(lucid, instanceId).getAddress()
  );
  const listing = utxos.find(
    (u) => u.assets[toUnit(MyNFT3.policyId, MyNFT3.assetName)] === 1n
  );

  if (!listing) throw new Error("Listing not found");

  await expectFailure(
    () =>
      new MarketplaceContract(lucid, instanceId).failBuyNftToWrongAddress(
        listing
      ),
    "Expected failure: NFT not sent to buyer"
  );
});

Deno.test(
  "Fails if buyer tricks validator with double satisfaction",
  async () => {
    lucid.selectWalletFromSeed(BUYER.seedPhrase);

    const utxos = await lucid.utxosAt(
      new MarketplaceContract(lucid, instanceId).getAddress()
    );

    const listing1 = utxos.find(
      (u) => u.assets[toUnit(MyNFT3.policyId, MyNFT3.assetName)] === 1n
    );
    const listing2 = utxos.find(
      (u) => u.assets[toUnit(MyNFT4.policyId, MyNFT4.assetName)] === 1n
    );

    if (!listing1 || !listing2) throw new Error("Listings not found");

    await expectFailure(
      () =>
        new MarketplaceContract(
          lucid,
          instanceId
        ).failBuyDoubleSatisfactionExploit(listing1, listing2),
      "Double satisfaction exploit"
    );
  }
);

Deno.test("Fails if buyer pays in wrong token", async () => {
  lucid.selectWalletFromSeed(BUYER.seedPhrase);

  const utxos = await lucid.utxosAt(
    new MarketplaceContract(lucid, instanceId).getAddress()
  );
  const listing = utxos.find(
    (u) => u.assets[toUnit(MyNFT4.policyId, MyNFT4.assetName)] === 1n
  );
  if (!listing) throw new Error("Listing not found");

  await expectFailure(
    () =>
      new MarketplaceContract(lucid, instanceId).failBuyWrongTokenTx(listing), // but override unit to be a junk token inside contract
    "Buyer should not be able to pay with invalid token"
  );
});

///////////////// Permantly close market ///////////////////////
// this will still allow delisting assets but buy will be no available because the reference input will be gone
// use this for migrating to a new contract or closing business

Deno.test("Can shutdown the marketplace", async () => {
  lucid.selectWalletFromSeed(MASTER.seedPhrase); // ✅ Make sure this wallet holds the Ownership token

  const contract = new MarketplaceContract(lucid, instanceId);

  const shutdownTxHash = await contract.shutdown();
  console.log("Shutdown Tx Hash:", shutdownTxHash);
  emulator.awaitBlock();

  // ✅ Validate config UTxO is removed
  const configUnit = toUnit(
    contract.marketplaceControlPolicyId,
    fromText("MarketplaceConfig")
  );
  const configUtxos = await lucid.utxosAtWithUnit(
    contract.marketplaceConfigAddress,
    configUnit
  );

  if (configUtxos.length !== 0) {
    throw new Error("MarketplaceConfig UTxO still exists after shutdown");
  }

  // ✅ Optionally check Ownership token is also burned
  const [walletUtxo] = await lucid.wallet.getUtxos();
  const stillHasOwnership = Object.keys(walletUtxo.assets).some(
    (unit) =>
      unit ===
      toUnit(contract.marketplaceControlPolicyId, fromText("Ownership"))
  );

  if (stillHasOwnership) {
    throw new Error("Ownership token was not burned during shutdown");
  }
});

Deno.test("✅ Can delist NFT even after config is burned", async () => {
  lucid.selectWalletFromSeed(SELLER.seedPhrase);

  // 🔍 Look for an already listed NFT before shutdown (e.g. MyNFT4)
  const utxos = await lucid.utxosAt(
    new MarketplaceContract(lucid, instanceId).getAddress()
  );
  const listed = utxos.find(
    (u) => u.assets[toUnit(MyNFT4.policyId, MyNFT4.assetName)] === 1n
  );
  if (!listed) throw new Error("Pre-shutdown NFT listing not found");

  // ✅ Delist it after shutdown
  const delistTx = await new MarketplaceContract(lucid, instanceId).delistTx(
    listed
  );
  console.log("Delist after shutdown Tx:", delistTx);
  emulator.awaitBlock();
});
