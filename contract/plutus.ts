// deno-lint-ignore-file
import {
  applyParamsToScript,
  Data,
  Script,
} from "https://deno.land/x/lucid@0.20.4/mod.ts";

export type ByteArray = string;
// export type Data = Data;
export type Int = bigint;
export type OptionStakeCredential = StakeCredential | null;
export type PaymentCredential =
  | { VerificationKey: [VerificationKeyHash] }
  | {
      Script: [ScriptHash];
    };
export type PolicyId = string;
export type ScriptHash = string;
export type StakeCredential =
  | { Inline: [CardanoAddressCredential] }
  | {
      Pointer: {
        slotNumber: Int;
        transactionIndex: Int;
        certificateIndex: Int;
      };
    };
export type VerificationKeyHash = string;
export type CardanoAddressAddress = {
  paymentCredential: PaymentCredential;
  stakeCredential: OptionStakeCredential;
};
export type CardanoAddressCredential =
  | {
      VerificationKey: [VerificationKeyHash];
    }
  | { Script: [ScriptHash] };
export type CardanoTransactionOutputReference = {
  transactionId: ByteArray;
  outputIndex: Int;
};
export type TypesConfigAction = "Updating" | "Burning";
export type TypesControlAction = "Initialize" | "Shutdown";
export type TypesListingDatum = {
  seller: CardanoAddressAddress;
  pricePolicy: ByteArray;
  priceName: ByteArray;
  priceAmount: Int;
  nftPolicy: ByteArray;
  nftName: ByteArray;
};
export type TypesMarketplaceAction =
  | "Buy"
  | "Delist"
  | {
      Edit: { newPrice: Int };
    };

const definitions = {
  ByteArray: { title: "ByteArray", dataType: "bytes" },
  Data: { title: "Data", description: "Any Plutus data." },
  Int: { dataType: "integer" },
  Option$StakeCredential: {
    title: "Option",
    anyOf: [
      {
        title: "Some",
        description: "An optional value.",
        dataType: "constructor",
        index: 0,
        fields: [{ $ref: "#/definitions/StakeCredential" }],
      },
      {
        title: "None",
        description: "Nothing.",
        dataType: "constructor",
        index: 1,
        fields: [],
      },
    ],
  },
  PaymentCredential: {
    title: "PaymentCredential",
    description:
      "A general structure for representing an on-chain `Credential`.\n\n Credentials are always one of two kinds: a direct public/private key\n pair, or a script (native or Plutus).",
    anyOf: [
      {
        title: "VerificationKey",
        dataType: "constructor",
        index: 0,
        fields: [{ $ref: "#/definitions/VerificationKeyHash" }],
      },
      {
        title: "Script",
        dataType: "constructor",
        index: 1,
        fields: [{ $ref: "#/definitions/ScriptHash" }],
      },
    ],
  },
  PolicyId: { title: "PolicyId", dataType: "bytes" },
  ScriptHash: { title: "ScriptHash", dataType: "bytes" },
  StakeCredential: {
    title: "StakeCredential",
    description:
      "Represent a type of object that can be represented either inline (by hash)\n or via a reference (i.e. a pointer to an on-chain location).\n\n This is mainly use for capturing pointers to a stake credential\n registration certificate in the case of so-called pointer addresses.",
    anyOf: [
      {
        title: "Inline",
        dataType: "constructor",
        index: 0,
        fields: [{ $ref: "#/definitions/cardano/address/Credential" }],
      },
      {
        title: "Pointer",
        dataType: "constructor",
        index: 1,
        fields: [
          { title: "slotNumber", $ref: "#/definitions/Int" },
          {
            title: "transactionIndex",
            $ref: "#/definitions/Int",
          },
          { title: "certificateIndex", $ref: "#/definitions/Int" },
        ],
      },
    ],
  },
  VerificationKeyHash: {
    title: "VerificationKeyHash",
    dataType: "bytes",
  },
  "cardano/address/Address": {
    title: "Address",
    description:
      "A Cardano `Address` typically holding one or two credential references.\n\n Note that legacy bootstrap addresses (a.k.a. 'Byron addresses') are\n completely excluded from Plutus contexts. Thus, from an on-chain\n perspective only exists addresses of type 00, 01, ..., 07 as detailed\n in [CIP-0019 :: Shelley Addresses](https://github.com/cardano-foundation/CIPs/tree/master/CIP-0019/#shelley-addresses).",
    anyOf: [
      {
        title: "Address",
        dataType: "constructor",
        index: 0,
        fields: [
          {
            title: "paymentCredential",
            $ref: "#/definitions/PaymentCredential",
          },
          {
            title: "stakeCredential",
            $ref: "#/definitions/Option$StakeCredential",
          },
        ],
      },
    ],
  },
  "cardano/address/Credential": {
    title: "Credential",
    description:
      "A general structure for representing an on-chain `Credential`.\n\n Credentials are always one of two kinds: a direct public/private key\n pair, or a script (native or Plutus).",
    anyOf: [
      {
        title: "VerificationKey",
        dataType: "constructor",
        index: 0,
        fields: [{ $ref: "#/definitions/VerificationKeyHash" }],
      },
      {
        title: "Script",
        dataType: "constructor",
        index: 1,
        fields: [{ $ref: "#/definitions/ScriptHash" }],
      },
    ],
  },
  "cardano/transaction/OutputReference": {
    title: "OutputReference",
    description:
      "An `OutputReference` is a unique reference to an output on-chain. The `output_index`\n corresponds to the position in the output list of the transaction (identified by its id)\n that produced that output",
    anyOf: [
      {
        title: "OutputReference",
        dataType: "constructor",
        index: 0,
        fields: [
          {
            title: "transactionId",
            $ref: "#/definitions/ByteArray",
          },
          { title: "outputIndex", $ref: "#/definitions/Int" },
        ],
      },
    ],
  },
  "types/ConfigAction": {
    title: "ConfigAction",
    description:
      "# ConfigAction\n Actions for managing the MarketplaceConfig UTxO.",
    anyOf: [
      {
        title: "Updating",
        dataType: "constructor",
        index: 0,
        fields: [],
      },
      {
        title: "Burning",
        dataType: "constructor",
        index: 1,
        fields: [],
      },
    ],
  },
  "types/ControlAction": {
    title: "ControlAction",
    description:
      "# ControlAction\n Actions for minting or burning marketplace control tokens.",
    anyOf: [
      {
        title: "Initialize",
        dataType: "constructor",
        index: 0,
        fields: [],
      },
      {
        title: "Shutdown",
        dataType: "constructor",
        index: 1,
        fields: [],
      },
    ],
  },
  "types/ListingDatum": {
    title: "ListingDatum",
    description:
      "# ListingDatum\n On-chain data representing a single NFT listing.",
    anyOf: [
      {
        title: "ListingDatum",
        dataType: "constructor",
        index: 0,
        fields: [
          { title: "seller", $ref: "#/definitions/cardano/address/Address" },
          { title: "pricePolicy", $ref: "#/definitions/ByteArray" },
          { title: "priceName", $ref: "#/definitions/ByteArray" },
          { title: "priceAmount", $ref: "#/definitions/Int" },
          { title: "nftPolicy", $ref: "#/definitions/ByteArray" },
          { title: "nftName", $ref: "#/definitions/ByteArray" },
        ],
      },
    ],
  },
  "types/MarketplaceAction": {
    title: "MarketplaceAction",
    description:
      "# MarketplaceAction\n Redeemer actions for interacting with the marketplace.",
    anyOf: [
      {
        title: "Buy",
        dataType: "constructor",
        index: 0,
        fields: [],
      },
      {
        title: "Delist",
        dataType: "constructor",
        index: 1,
        fields: [],
      },
      {
        title: "Edit",
        dataType: "constructor",
        index: 2,
        fields: [{ title: "newPrice", $ref: "#/definitions/Int" }],
      },
    ],
  },
};

export interface ConfigValidatorConfigValidatorSpend {
  new (controlPolicyId: PolicyId): Script;
  _datum: Data;
  action: TypesConfigAction;
}

export const ConfigValidatorConfigValidatorSpend = Object.assign(
  function (controlPolicyId: PolicyId) {
    return {
      type: "PlutusV3",
      script: applyParamsToScript(
        [controlPolicyId],
        "5904db010100229800aba2aba1aba0aab9faab9eaab9dab9a9bae0024888888896600264653001300900198049805000cdc3a400530090024888966002600460126ea800e2646645300113259800980118069baa0088cc004c9660026006601c6ea800626024601e6ea80062c8068c8cc004004dd6180918079baa0062259800800c530103d87a80008992cc004cdd7980a18089baa0010068980219809800a5eb82266006006602a0048078c04c00501148c048c04c00644646600200200644b30010018a508acc004c00cc0540062946266004004602c00280810132444b3001330013758602860226ea80208cdc4a400464b3001300b3012375400314800226eb4c058c04cdd5000a0223259800980598091baa0018a60103d87a8000899198008009bab30173014375400444b30010018a6103d87a8000899192cc004cdc8a45094f776e657273686970000018acc004cdc7a441094f776e65727368697000001898051980c980b80125eb82298103d87a80004055133004004301b00340546eb8c054004c060005016202232330010013756600860266ea8c010c04cdd5001112cc004006298103d87a8000899192cc004cdc8809800c56600266e3c04c0062601266030602c00497ae08a60103d87a80004051133004004301a00340506eb8c050004c05c00501544cc004dd6180a180a980a98089baa00823375e602a60246ea8004c054c048dd5180198091baa0048a50403c899baf374c64660020026eacc048c04cc04cc04cc04cc03cdd5003112cc004006297adef6c608994c004dd71808000cdd59808800cc0540092225980099b91489000038acc004cdc7a441000038800c401501244cc058cdd81ba9003374c0046600c00c002809060260028088dd31919194c006600297adef6c6080752201114d61726b6574706c616365436f6e66696700a4002800a01d4881094f776e65727368697000a40028008888966002601000310048991919800800803112cc00400626603266ec0dd48031ba60034bd6f7b63044ca60026eb8c05c0066eacc06000660380049112cc004cdc8005001c4cc074cdd81ba900a374c00e00b15980099b8f00a0038992cc004c040c06cdd5000c4cc078cdd81ba900b301f301c37540020051002406864b300159800800c528c528203a8a60103d87a8000898079980f1ba60014bd70203432330010010032259800800c4cc07ccdd81ba900b375001497adef6c608994c004dd7180e800cdd6980f000cc0880092225980099b9000f00389981199bb0375201e6ea00380162b30013371e01e00713259800980b18109baa00189981219bb03752020604a60446ea800400a20048100c966002602c00314c103d87a80008980a998121ba80014bd7020403370000401d133023337606ea400cdd400119803003000a03e407c3020001407913301d337606ea400cdd300119803003000a0324064301a00140606464004600c0026602c66ec0dd48011ba80014bd6f7b630202430010012259800800c5268992cc00400629344c96600266e40dd71808980a8019bae30110018998020021980a000980b001459010180a000a024301400140448060dd2a4001300c375400f30103011003488966002600800515980098081baa00a801c590114566002601000515980098081baa00a801c5901145900e201c18070009b8748000c028dd5001c590080c024004c010dd5004c52689b2b200401",
        {
          shape: {
            dataType: "list",
            items: [{ $ref: "#/definitions/PolicyId" }],
          },
          definitions,
        } as any
      ),
    };
  },
  { _datum: { shape: { $ref: "#/definitions/Data" }, definitions } },
  {
    action: {
      shape: { $ref: "#/definitions/types/ConfigAction" },
      definitions,
    },
  }
) as unknown as ConfigValidatorConfigValidatorSpend;

export interface MarketplaceMarketplaceSpend {
  new (controlPolicyId: PolicyId): Script;
  datum: TypesListingDatum;
  redeemer: TypesMarketplaceAction;
}

export const MarketplaceMarketplaceSpend = Object.assign(
  function (controlPolicyId: PolicyId) {
    return {
      type: "PlutusV3",
      script: applyParamsToScript(
        [controlPolicyId],
        "590b33010100229800aba2aba1aba0aab9faab9eaab9dab9a9bae0024888888896600264653001300900198049805000cdc3a400530090024888966002600460126ea800e33001300a3754007370e90024dc3a40013009375400891111991192cc004c0140122b3001301137540170018b20248acc004c0240122b3001301137540170018b20248acc004c01801226464b30013017002801c590141bad30150013011375401716403c807900f0acc004c010c03cdd5000c66002602660206ea80066e9520009180a180a980a980a800c8c050c054c054c054c054c05400646028602a602a602a602a0032301430150019180a180a980a800c8c050c054c054c054c054c054c054c054c05400644646600200200644b30010018a508acc004cdc79bae30170010038a51899801001180c000a02440552232598009803800c4c8c96600260320050048b202c375c602e00260266ea800e2b3001300b001899192cc004c06400a0091640586eb8c05c004c04cdd5001c59011202230113754005300f37540152232330010010032259800800c52845660026006602e00314a31330020023018001404880a9222222222222329800992cc004c048c074dd5000c4c084c078dd5000c5901c198009bac3020301d3754028466ebcc084c078dd5000808489660026026603c6ea800a2646464b3001302600289980498128018992cc004c05c006264b30013028001899192cc004c068006264b3001302b0018998071815000804c5902818131baa0028acc004c07800626464653001375a6058003375a6058007375a60580049112cc004c0c001201d1640b4302c001302b001302637540051640908120c090dd50009813800c5902518119baa0028acc004c06c0062b3001302337540050058b20488b2042408460426ea80062c8118c090004c090004c07cdd500145901d4888c966002603260406ea80062900044dd6981218109baa001407c64b300130193020375400314c0103d87a8000899198008009bab30253022375400444b30010018a6103d87a8000899192cc004cdc8803000c56600266e3c018006260286604e604a00497ae08a60103d87a8000408d1330040043029003408c6eb8c08c004c098005024203e32330010010042259800800c5300103d87a8000899192cc004cdc8803000c56600266e3c018006260266604c604800497ae08a60103d87a80004089133004004302800340886eb8c088004c0940050232444b300130140068acc004c060c8cc004004c8cc004004dd5981298131813181318131813181318131813181318111baa0192259800800c52f5bded8c1133225980099baf30240023374a90011981380ba5eb8226604e00466008008003133004004001408c604c002604e00281208966002003148002266e012002330020023026001408d159800980c4c004dd5980598101baa300b30203754007375c601860406ea80426eb8c034c080dd500820028992cc004cc89660020030028acc004c09c006294600481210240a50330013758604860426ea80608cdd7981298111baa300d30223754002604a60446ea8c034c088dd5002c4c8c966002602e60446ea800626644b300198009bac300f3025375403930283025375402b375c6020604a6ea80566eb8c03cc094dd500aa444466e24cdc09bad30173029375403200d3001004a4001225980099baf302e302b375400400b13370000330013756602c60566ea800a0090034031100140a4802915980099b8900298009bac300f302537540394800244b30013375e6054604e6ea8008c0a8c09cdd500344cdc0000cc004dd5980918139baa0029bae30123027375402f375c6022604e6ea805d0084400502520028acc004c074c8cc004004cc018dd6180818131baa01d2301f98009bab301230273754003375c6026604e6ea805e6eb8c050c09cdd500ba0102259800800c52000899b8048008cc008008c0ac0050284566002660146eb0c03cc094dd500e119198008009bac30103027375403c44b30010018a508acc0056600266ebcc0acc0a0dd5181598141baa00330173302a302b0014bd70456600330013375e605660506ea8c0acc0a0dd5001981598141baa302b302837540314a14a281322604130013756602660506ea800e6eb8c050c0a0dd500c4dd7180a98141baa018402514a0813229410264528c4cc008008c0b000502620528a518b20468b20468b20468b20463370666e08dd6980898119baa013375a604c60466ea800520a09c01222329800800c01200680088896600200510018cc00400e605a00533004302c002001400c81522c810a60026eb0c034c088dd5000cdd7180698111baa0129bae300c30223754024911192cc004006298103d87a80008980a998141814800a5eb810271919800800802112cc004006297ae089919912cc004c088c0a4dd500144cc014014006266058605a60546ea8008cc0140140050282cc0056600266e3cdd7181598141baa001005899b8f375c602660506ea8004012294102644c05ccc0a8c048c0a0dd5000a5eb82298103d87a8000409860580046054002814064b300130163021375400313259800980c18111baa0018992cc004c060c08cdd5000c4c8c8c9660026056005133009302a003132330010010022259800800c401a264b3001301e30293754003132323298009bad30300019bae30300039bae3030002488966002606800913300900930340088b20621818000981780098151baa0018b2050302c00140a91640a06eb0c0a4004c0a4004c090dd5000c59022181318119baa0018b2042300c30223754601a60446ea8c094c088dd5000c59020198029bac300c302137540304603530013756601a60446ea8c034c088dd5000c07e911114d61726b6574706c616365436f6e66696700400d16407c44646600200200644b30010018a5eb8226644b3001300500289981400119802002000c4cc01001000502418138009814000a04a8b203c8b203c8acc004c06001a2b30013259800980a98101baa0018998049bac300a302137540306eb8c090c084dd5000c528203e302330203754604660406ea80422b3001330053758601460406ea805c8c966002602c60426ea80062b30013375e604a60446ea8c094c088dd5001180899812181298111baa0014bd7044c06a60026eacc034c088dd50014dd7180718111baa0129bae300f30223754024801a294102045282040302430213754604860426ea804629462c80f22c80f2264b30013259800980b18109baa0018998051bac300b302237540326eb8c094c088dd5000c5282040302430213754604860426ea8046264b300130163021375400313259800980c18111baa0018992cc004c060c08cdd5000c4c8c8c8c8c8ca60026eb8c0b40066eb8c0b40166eb8c0b40126eb4c0b400e6eb8c0b40092222259800981980344cc044c0c802c56600266ebcc0c8c0bcdd5006181918179baa01f8acc004cdc79bae301a302f37540186eb8c068c0bcdd500fc56600266e3cdd7180c98179baa00c375c6032605e6ea807e2b30013371e6eb8c06cc0bcdd50061bae301b302f375403f15980099b8f375c6038605e6ea8030dd7180e18179baa01f8acc004cdc39bad301d302f375401801f14a31640b51640b51640b51640b51640b51640b51640c0302d001302c001302b001302a001302900130243754003164088604c60466ea80062c8108c030c088dd5181298111baa0018b2040330053758601660426ea806096600266ebcc094c088dd5000981298111baa300d3022375400b1301a98009bab300d30223754003375c601c60446ea804a6eb8c03cc088dd500920068a50408116407c6eb4c08cc080dd500d203c40782232330010010032259800800c5300103d87a80008992cc004c010006260206604600297ae08998018019812801203e302300140848b201c3011004301130120044590080c024004c010dd5004c52689b2b200401",
        {
          shape: {
            dataType: "list",
            items: [{ $ref: "#/definitions/PolicyId" }],
          },
          definitions,
        } as any
      ),
    };
  },
  {
    datum: {
      shape: { $ref: "#/definitions/types/ListingDatum" },
      definitions,
    },
  },
  {
    redeemer: {
      shape: { $ref: "#/definitions/types/MarketplaceAction" },
      definitions,
    },
  }
) as unknown as MarketplaceMarketplaceSpend;

export interface MarketplaceControlMarketplaceControlMint {
  new (starterUtxo: CardanoTransactionOutputReference): Script;
  action: TypesControlAction;
}

export const MarketplaceControlMarketplaceControlMint = Object.assign(
  function (starterUtxo: CardanoTransactionOutputReference) {
    return {
      type: "PlutusV3",
      script: applyParamsToScript(
        [starterUtxo],
        "59018c010100229800aba2aba1aba0aab9faab9eaab9dab9a488888896600264653001300800198041804800cdc3a400130080024888966002600460106ea800e2646644b300130050018acc004c030dd5003c00a2c806a2b30013370e9001000c56600260186ea801e0051640351640288050566002600660126ea8016264660020026eb0c038c02cdd5001912cc00400629422b30013375e601e60186ea8c03c00404a29462660040046020002805100d44c8cc004004c8cc004004dd59807980818081808180818061baa0042259800800c52f5c113233223322330020020012259800800c400e2646602a6e9ccc054dd48029980a98090009980a9809800a5eb80cc00c00cc05c008c0540050131bab3010003375c601a00266006006602400460200028070896600200314a3159800992cc006600266e3cdd71808000802528528a0168a51899b88375a602060226022002900020163758601e00313300200230100018a504028806900818049baa005375c601860126ea800e2c8038601000260066ea802229344d95900101",
        {
          shape: {
            dataType: "list",
            items: [
              {
                $ref: "#/definitions/cardano/transaction/OutputReference",
              },
            ],
          },
          definitions,
        } as any
      ),
    };
  },
  {
    action: {
      shape: { $ref: "#/definitions/types/ControlAction" },
      definitions,
    },
  }
) as unknown as MarketplaceControlMarketplaceControlMint;
