import {
  Addresses,
  Data,
  fromText,
  Lucid,
  Script,
  toUnit,
  Tx,
  Utxo,
} from "./deps.ts";
import * as D from "./types.ts";
import {
  ConfigValidatorConfigValidatorSpend,
  MarketplaceControlMarketplaceControlMint,
  MarketplaceMarketplaceSpend,
  TypesListingDatum,
} from "./contract/plutus.ts";
import {
  fromAddress,
  getKeyHashFromAddress,
  instanceIdToStruct,
  toAddress,
} from "./utils.ts";

function toPaymentUnit(policy: string, name: string): string {
  return policy === "" && name === "" ? "lovelace" : toUnit(policy, name);
}

export class MarketplaceContract {
  lucid: Lucid;
  instanceId?: string;
  validatorInstance!: Script;
  validatorHash!: string;
  address!: string;
  marketplaceControlPolicy!: Script;
  marketplaceControlPolicyId!: string;
  marketplaceConfigValidator!: Script;
  marketplaceConfigAddress!: string;
  configUnit!: string;

  constructor(lucid: Lucid, instanceId?: string) {
    this.lucid = lucid;
    this.instanceId = instanceId;
    if (this.instanceId) {
      this._instantiate(this.instanceId);
    }
  }

  _instantiate(instanceId: string) {
    const struct = instanceIdToStruct(instanceId);

    this.marketplaceControlPolicy =
      new MarketplaceControlMarketplaceControlMint({
        transactionId: struct.txHash,
        outputIndex: BigInt(struct.outputIndex),
      });
    this.marketplaceControlPolicyId = this.lucid
      .newScript(this.marketplaceControlPolicy)
      .toHash();

    this.marketplaceConfigValidator = new ConfigValidatorConfigValidatorSpend(
      this.marketplaceControlPolicyId
    );
    this.marketplaceConfigAddress = this.lucid.utils.scriptToAddress(
      this.marketplaceConfigValidator
    );

    this.validatorInstance = new MarketplaceMarketplaceSpend(
      this.marketplaceControlPolicyId
    );
    this.validatorHash = this.lucid.newScript(this.validatorInstance).toHash();
    this.address = this.lucid.utils.scriptToAddress(this.validatorInstance);
  }

  getValidator(): Script {
    return this.validatorInstance;
  }

  getAddress(): string {
    return this.address;
  }

  redeemer(action: "Buy" | "Delist" | "Edit", newPrice?: bigint) {
    switch (action) {
      case "Buy":
        return Data.to("Buy", MarketplaceMarketplaceSpend.redeemer);
      case "Delist":
        return Data.to("Delist", MarketplaceMarketplaceSpend.redeemer);
      case "Edit":
        if (newPrice === undefined)
          throw new Error("Missing newPrice for Edit");
        return Data.to(
          { Edit: { newPrice } },
          MarketplaceMarketplaceSpend.redeemer
        );
    }
  }

  datum(d: {
    seller: D.Address;
    price_policy: string;
    price_name: string;
    price_amount: bigint;
    nft_policy: string;
    nft_name: string;
  }) {
    return Data.to(
      {
        seller: d.seller,
        pricePolicy: d.price_policy,
        priceName: d.price_name,
        priceAmount: d.price_amount,
        nftPolicy: d.nft_policy,
        nftName: d.nft_name,
      },
      MarketplaceMarketplaceSpend.datum
    );
  }

  async deploy(name: string): Promise<{ txHash: string; instanceId: string }> {
    if (this.instanceId) throw new Error("Marketplace already deployed");

    const [utxo] = await this.lucid.wallet.getUtxos();
    const instanceId = `${utxo.txHash}-${utxo.outputIndex}-${fromText(name)}`;

    this._instantiate(instanceId); // Bootstraps validator instances

    const txHash = await this.lucid
      .newTx()
      .collectFrom([utxo])
      .mint(
        {
          [toUnit(
            this.marketplaceControlPolicyId,
            fromText("MarketplaceConfig")
          )]: 1n,
          [toUnit(this.marketplaceControlPolicyId, fromText("Ownership"))]: 1n,
        },
        Data.to("Initialize", MarketplaceControlMarketplaceControlMint.action)
      )
      .attachScript(this.marketplaceControlPolicy)
      .commit()
      .then((tx) => tx.sign().commit())
      .then((tx) => tx.submit());

    return { txHash, instanceId };
  }

  async sendConfigDatum(config: {
    fee_address: string;
    token_fees: {
      policy: string;
      name: string;
      fee_bps: number;
    }[];
  }): Promise<string> {
    if (!this.instanceId) throw new Error("Marketplace not initialized");

    // 🧱 Convert fee_address from Bech32 to on-chain Address type
    const feeAddress = fromAddress(config.fee_address);

    // 🧱 Convert token_fees to on-chain TokenFee[]
    const tokenFees = config.token_fees.map((fee) => ({
      policy: fee.policy,
      name: fee.name,
      fee_bps: BigInt(fee.fee_bps),
    }));

    // 🧱 Cast to full on-chain ConfigDatum format
    const configDatum = Data.to(
      {
        fee_address: feeAddress,
        token_fees: tokenFees,
      },
      D.ConfigDatum
    );

    return await this.lucid
      .newTx()
      .payToContract(
        this.marketplaceConfigAddress,
        {
          Inline: configDatum,
          scriptRef: this.validatorInstance, // ✅ Required for ref enforcement
        },
        {
          [toUnit(
            this.marketplaceControlPolicyId,
            fromText("MarketplaceConfig")
          )]: 1n,
        }
      )
      .commit()
      .then((tx) => tx.sign().commit())
      .then((tx) => tx.submit());
  }

  async updateConfigDatum(config: {
    fee_address: string;
    token_fees: { policy: string; name: string; fee_bps: number }[];
  }): Promise<string> {
    if (!this.instanceId) throw new Error("Marketplace not initialized");

    const configUnit = toUnit(
      this.marketplaceControlPolicyId,
      fromText("MarketplaceConfig")
    );
    const ownershipUnit = toUnit(
      this.marketplaceControlPolicyId,
      fromText("Ownership")
    );

    const [configUtxo] = await this.lucid.utxosAtWithUnit(
      this.marketplaceConfigAddress,
      configUnit
    );
    if (!configUtxo) throw new Error("Marketplace config UTxO not found");

    const [ownershipUtxo] = (await this.lucid.wallet.getUtxos()).filter((u) =>
      Object.keys(u.assets).includes(ownershipUnit)
    );
    if (!ownershipUtxo) throw new Error("Ownership token not found");

    const feeAddress = fromAddress(config.fee_address);
    const tokenFees = config.token_fees.map((fee) => ({
      policy: fee.policy,
      name: fee.name,
      fee_bps: BigInt(fee.fee_bps),
    }));
    const newDatum = Data.to(
      { fee_address: feeAddress, token_fees: tokenFees },
      D.ConfigDatum
    );

    return await this.lucid
      .newTx()
      .collectFrom(
        [configUtxo],
        Data.to("Updating", ConfigValidatorConfigValidatorSpend.action)
      )
      .collectFrom([ownershipUtxo])
      .payToContract(
        this.marketplaceConfigAddress,
        {
          Inline: newDatum,
          scriptRef: this.validatorInstance, // ✅ keep the reference for marketplace
        },
        {
          [configUnit]: 1n,
        }
      )
      .attachScript(this.marketplaceConfigValidator)
      .commit()
      .then((tx) => tx.sign().commit())
      .then((tx) => tx.submit());
  }

  async createListingTx(params: {
    nftUnit: string;
    pricePolicy: string;
    priceName: string;
    priceAmount: bigint;
  }): Promise<string> {
    const utxo = (await this.lucid.wallet.getUtxos()).find(
      (u) => u.assets[params.nftUnit] === 1n
    );
    if (!utxo) throw new Error("NFT not found in wallet");

    const [policyId, assetName] = [
      params.nftUnit.slice(0, 56),
      params.nftUnit.slice(56),
    ];

    // ✅ Get full bech32 address of seller
    const sellerAddress = await this.lucid.wallet.address();

    // ✅ Convert to on-chain Address type
    const seller = fromAddress(sellerAddress); // <- this is what your Datum expects now

    const datum = this.datum({
      seller,
      price_policy: params.pricePolicy,
      price_name: params.priceName,
      price_amount: params.priceAmount,
      nft_policy: policyId,
      nft_name: assetName,
    });

    return await this.lucid
      .newTx()
      .collectFrom([utxo])
      .payToContract(
        this.address,
        { Inline: datum },
        {
          [params.nftUnit]: 1n,
        }
      )
      .commit()
      .then((tx) => tx.sign().commit())
      .then((tx) => tx.submit());
  }

  async buyTx(listingUtxo: Utxo): Promise<string> {
    const buyerAddress = await this.lucid.wallet.address();
    const buyerCredential = Addresses.inspect(buyerAddress).payment;

    if (!buyerCredential || buyerCredential.type !== "Key") {
      throw new Error("Buyer credential not found or not key hash");
    }

    const { configUtxo, paymentTx, txDatum } =
      await this.buildMarketplacePaymentTx(listingUtxo);

    return await this.lucid
      .newTx()
      .collectFrom(
        [listingUtxo],
        Data.to("Buy", MarketplaceMarketplaceSpend.redeemer)
      )
      .readFrom([configUtxo])
      .compose(paymentTx)
      .payTo(buyerAddress, {
        [toUnit(txDatum.nftPolicy, txDatum.nftName)]: 1n,
      })
      .attachScript(this.validatorInstance)
      .addSigner(buyerCredential.hash) // 🔥 Use key hash directly
      .commit()
      .then((tx) => tx.sign().commit())
      .then((tx) => tx.submit());
  }

  async delistTx(listingUtxo: Utxo): Promise<string> {
    const datum = await this.lucid.datumOf(
      listingUtxo,
      MarketplaceMarketplaceSpend.datum
    );

    return await this.lucid
      .newTx()
      .collectFrom(
        [listingUtxo],
        Data.to("Delist", MarketplaceMarketplaceSpend.redeemer)
      )
      .attachScript(this.validatorInstance)
      .addSigner(getKeyHashFromAddress(datum.seller)) // ✅ Ensure seller is in extra_signatories
      .commit()
      .then((tx) => tx.sign().commit())
      .then((tx) => tx.submit());
  }

  async editListingTx(listingUtxo: Utxo, newPrice: bigint): Promise<string> {
    const oldDatum = await this.lucid.datumOf(
      listingUtxo,
      MarketplaceMarketplaceSpend.datum
    );

    const newDatum = this.datum({
      seller: oldDatum.seller,
      price_policy: oldDatum.pricePolicy,
      price_name: oldDatum.priceName,
      price_amount: newPrice,
      nft_policy: oldDatum.nftPolicy,
      nft_name: oldDatum.nftName,
    });

    const payment = oldDatum.seller.paymentCredential;
    if (!("VerificationKey" in payment)) {
      throw new Error("Cannot sign: seller is not a key credential");
    }
    const signer = payment.VerificationKey[0];

    return await this.lucid
      .newTx()
      .collectFrom(
        [listingUtxo],
        Data.to({ Edit: { newPrice } }, MarketplaceMarketplaceSpend.redeemer)
      )
      .payToContract(this.address, { Inline: newDatum }, listingUtxo.assets)
      .addSigner(signer)
      .attachScript(this.validatorInstance)
      .commit()
      .then((tx) => tx.sign().commit())
      .then((tx) => tx.submit());
  }

  async shutdown(): Promise<string> {
    const [configUtxo] = await this.lucid.utxosAtWithUnit(
      this.marketplaceConfigAddress,
      toUnit(this.marketplaceControlPolicyId, fromText("MarketplaceConfig"))
    );

    if (!configUtxo) throw new Error("MarketplaceConfig UTxO not found");

    return await this.lucid
      .newTx()
      .collectFrom(
        [configUtxo],
        Data.to("Burning", ConfigValidatorConfigValidatorSpend.action)
      )
      .mint(
        {
          [toUnit(
            this.marketplaceControlPolicyId,
            fromText("MarketplaceConfig")
          )]: -1n,
          [toUnit(this.marketplaceControlPolicyId, fromText("Ownership"))]: -1n,
        },
        Data.to("Shutdown", MarketplaceControlMarketplaceControlMint.action)
      )
      .attachScript(this.marketplaceControlPolicy)
      .attachScript(this.marketplaceConfigValidator)
      .commit()
      .then((tx) => tx.sign().commit())
      .then((tx) => tx.submit());
  }

  async buildMarketplacePaymentTx(
    listingUtxo: Utxo
  ): Promise<{ configUtxo: Utxo; paymentTx: Tx; txDatum: TypesListingDatum }> {
    const datum = await this.lucid.datumOf(
      listingUtxo,
      MarketplaceMarketplaceSpend.datum
    );

    const unit =
      datum.pricePolicy === "" && datum.priceName === ""
        ? "lovelace"
        : toUnit(datum.pricePolicy, datum.priceName);

    const configUnit = toUnit(
      this.marketplaceControlPolicyId,
      fromText("MarketplaceConfig")
    );

    const [configUtxo] = await this.lucid.utxosAtWithUnit(
      this.marketplaceConfigAddress,
      configUnit
    );
    if (!configUtxo) throw new Error("Marketplace config UTxO not found");

    const configDatum = await this.lucid.datumOf<D.ConfigDatum>(
      configUtxo,
      D.ConfigDatum
    );

    const tokenFee = configDatum.token_fees.find(
      (fee) => fee.policy === datum.pricePolicy && fee.name === datum.priceName
    );
    if (!tokenFee) throw new Error("No fee config for this token");

    const feeAmount = (datum.priceAmount * tokenFee.fee_bps) / 10_000n;
    const sellerAmount = datum.priceAmount - feeAmount;

    const feeAddress = toAddress(configDatum.fee_address, this.lucid);
    const sellerAddress = toAddress(datum.seller, this.lucid); // ✅ Use your util directly

    console.log("🧾 Resolved seller address:", sellerAddress);

    const paymentTx = this.lucid
      .newTx()
      .payTo(sellerAddress, { [unit]: sellerAmount })
      .payTo(feeAddress, { [unit]: feeAmount });

    return { configUtxo, paymentTx, txDatum: datum };
  }

  ///////////////////// Failure Test Functions ////////////////////////////

  async failBuyTx(listingUtxo: Utxo, amount: bigint): Promise<string> {
    const datum = await this.lucid.datumOf(
      listingUtxo,
      MarketplaceMarketplaceSpend.datum
    );

    return await this.lucid
      .newTx()
      .collectFrom([listingUtxo], this.redeemer("Buy"))
      .payTo(
        this.lucid.utils.credentialToAddress({
          type: "Key",
          hash: getKeyHashFromAddress(datum.seller),
        }),
        {
          [toPaymentUnit(datum.pricePolicy, datum.priceName)]: amount, // underpay or wrong token
        }
      )
      .attachScript(this.validatorInstance)
      .commit()
      .then((tx) => tx.sign().commit())
      .then((tx) => tx.submit());
  }

  async failBuyMissingNft(listingUtxo: Utxo): Promise<string> {
    // Remove the NFT from the UTxO
    const fakeListing = {
      ...listingUtxo,
      assets: {}, // NFT is no longer present
    };

    const datum = await this.lucid.datumOf(
      fakeListing,
      MarketplaceMarketplaceSpend.datum
    );

    const sellerKeyHash = getKeyHashFromAddress(datum.seller);

    return await this.lucid
      .newTx()
      .collectFrom([fakeListing], this.redeemer("Buy"))
      .payTo(
        this.lucid.utils.credentialToAddress({
          type: "Key",
          hash: sellerKeyHash,
        }),
        { lovelace: 10_000_000n }
      )
      .attachScript(this.validatorInstance)
      .commit()
      .then((tx) => tx.sign().commit())
      .then((tx) => tx.submit());
  }

  async failBuyNftToWrongAddress(listingUtxo: Utxo): Promise<string> {
    const datum = await this.lucid.datumOf(
      listingUtxo,
      MarketplaceMarketplaceSpend.datum
    );

    // Infer buyer by getting a wallet UTxO that's not the seller
    const buyerAddress = await this.lucid.wallet.address();
    const buyerCredential = Addresses.inspect(buyerAddress).payment;
    if (!buyerCredential || buyerCredential.type !== "Key") {
      throw new Error("Buyer credential not found or not key hash");
    }

    const unit = toUnit(datum.nftPolicy, datum.nftName);

    return await this.lucid
      .newTx()
      .collectFrom([listingUtxo], this.redeemer("Buy"))
      // ✅ Correct payment to seller
      .payTo(
        this.lucid.utils.credentialToAddress({
          type: "Key",
          hash: getKeyHashFromAddress(datum.seller),
        }),
        {
          [toPaymentUnit(datum.pricePolicy, datum.priceName)]:
            datum.priceAmount,
        }
      )
      // ❌ Wrongfully send NFT back to the seller, not the buyer
      .payTo(
        this.lucid.utils.credentialToAddress({
          type: "Key",
          hash: getKeyHashFromAddress(datum.seller), // should have been buyerCredential.hash
        }),
        {
          [unit]: 1n,
        }
      )
      .attachScript(this.validatorInstance)
      .commit()
      .then((tx) => tx.sign().commit())
      .then((tx) => tx.submit());
  }

  async failBuyDoubleSatisfactionExploit(
    listing1: Utxo,
    listing2: Utxo
  ): Promise<string> {
    const datum1 = await this.lucid.datumOf(
      listing1,
      MarketplaceMarketplaceSpend.datum
    );
    const datum2 = await this.lucid.datumOf(
      listing2,
      MarketplaceMarketplaceSpend.datum
    );

    const buyerAddress = await this.lucid.wallet.address();

    return await this.lucid
      .newTx()
      .collectFrom([listing1, listing2], this.redeemer("Buy"))
      .payTo(
        this.lucid.utils.credentialToAddress({
          type: "Key",
          hash: getKeyHashFromAddress(datum1.seller), // both go to same seller in your test
        }),
        {
          [toPaymentUnit(datum1.pricePolicy, datum1.priceName)]:
            datum1.priceAmount, // only pay for 1
        }
      )
      .payTo(buyerAddress, {
        [toUnit(datum1.nftPolicy, datum1.nftName)]: 1n,
        [toUnit(datum2.nftPolicy, datum2.nftName)]: 1n,
      })
      .attachScript(this.validatorInstance)
      .attachScript(this.validatorInstance)
      .commit()
      .then((tx) => tx.sign().commit())
      .then((tx) => tx.submit());
  }

  async failBuyWrongTokenTx(listingUtxo: Utxo): Promise<string> {
    const datum = await this.lucid.datumOf(
      listingUtxo,
      MarketplaceMarketplaceSpend.datum
    );

    // ❌ Use a random (fake) token instead of the correct price unit
    const fakePolicyId =
      "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    const fakeAssetName = fromText("FAKE");
    const fakeUnit = toUnit(fakePolicyId, fakeAssetName);

    return await this.lucid
      .newTx()
      .collectFrom([listingUtxo], this.redeemer("Buy"))
      .payTo(
        this.lucid.utils.credentialToAddress({
          type: "Key",
          hash: getKeyHashFromAddress(datum.seller),
        }),
        {
          [fakeUnit]: datum.priceAmount, // ⚠️ Invalid token
        }
      )
      .payTo(await this.lucid.wallet.address(), {
        [toUnit(datum.nftPolicy, datum.nftName)]: 1n,
      })
      .attachScript(this.validatorInstance)
      .commit()
      .then((tx) => tx.sign().commit())
      .then((tx) => tx.submit());
  }
}
