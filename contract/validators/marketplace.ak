use aiken/collection/list
use cardano/address.{VerificationKey}
use cardano/assets.{PolicyId}
use cardano/transaction.{InlineDatum, OutputReference, Spend, Transaction}
use types.{Buy, Delist, Edit, ListingDatum, MarketplaceAction}
use utils.{
  find_token_fee, get_self_input, paid_at_least, read_marketplace_config,
}

/// # Marketplace Validator
/// Handles Buy, Delist, and Edit operations for a single NFT listing.
/// Enforces double satisfaction protection, correct seller payout, and fee distribution.
validator marketplace(control_policy_id: PolicyId) {
  spend(
    datum: Option<ListingDatum>,
    redeemer: MarketplaceAction,
    utxo: OutputReference,
    self: Transaction,
  ) {
    // ✅ Ensure listing datum exists
    expect Some(d) = datum

    // ✅ Find our script's own input
    let own_input = get_self_input(utxo, self)

    when redeemer is {
      // =================================
      // 🚀 BUY CASE
      // =================================
      Buy -> {
        // ✅ 1. Ensure exactly one Spend redeemer is attached for this UTxO
        expect
          list.length(
            list.filter(
              self.redeemers,
              fn(entry) {
                let Pair(purpose, _) = entry
                purpose == Spend(utxo)
              },
            ),
          ) == 1

        // ✅ 2. Ensure the NFT exists in the script input
        expect
          assets.quantity_of(own_input.output.value, d.nft_policy, d.nft_name) == 1

        // ✅ 3. Prevent double satisfaction (only one input from this script address)
        expect
          when
            list.filter(
              self.inputs,
              fn(input) { input.output.address == own_input.output.address },
            )
          is {
            [_] -> True
            _ -> False
          }

        // ✅ 4. Load marketplace config from reference input
        let config = read_marketplace_config(self, control_policy_id)

        // ✅ 5. Find the fee basis points for the payment token
        expect Some(fee_bps) =
          find_token_fee(config.allowed_tokens, d.price_policy, d.price_name)

        // ✅ 6. Calculate fee amount
        let fee_amount = d.price_amount * fee_bps / 10_000

        // ✅ 7. Ensure seller receives correct payout (price - fee)
        expect
          paid_at_least(
            self.outputs,
            d.seller,
            d.price_policy,
            d.price_name,
            d.price_amount - fee_amount,
          )

        // ✅ 8. Ensure enough fee paid to fee address
        let total_fee_paid =
          list.foldl(
            self.outputs,
            0,
            fn(output, acc) {
              if output.address == config.fee_address {
                acc + assets.quantity_of(
                  output.value,
                  d.price_policy,
                  d.price_name,
                )
              } else {
                acc
              }
            },
          )
        expect total_fee_paid >= fee_amount

        // ✅ 9. Ensure NFT appears exactly once in outputs
        let nft_outputs =
          list.filter(
            self.outputs,
            fn(output) {
              assets.quantity_of(output.value, d.nft_policy, d.nft_name) == 1
            },
          )
        expect list.length(nft_outputs) == 1

        // ✅ 10. Ensure NFT is sent to a signer who is NOT the seller
        expect
          list.any(
            self.outputs,
            fn(o) {
              list.any(
                self.extra_signatories,
                fn(key) {
                  o.address.payment_credential == VerificationKey(key) && o.address.payment_credential != d.seller.payment_credential && assets.quantity_of(
                    o.value,
                    d.nft_policy,
                    d.nft_name,
                  ) == 1
                },
              )
            },
          )

        // ✅ Success
        True
      }

      // =================================
      // 🗑️ DELIST CASE
      // =================================
      Delist -> {
        // ✅ 1. Ensure seller signed the transaction
        expect
          when d.seller.payment_credential is {
            VerificationKey(key) -> list.has(self.extra_signatories, key)
            _ -> False
          }

        // ✅ 2. Ensure NFT is returned to the seller
        let returned =
          list.any(
            self.outputs,
            fn(output) {
              when d.seller.payment_credential is {
                VerificationKey(key) ->
                  output.address.payment_credential == VerificationKey(key) && assets.quantity_of(
                    output.value,
                    d.nft_policy,
                    d.nft_name,
                  ) == 1
                _ -> False
              }
            },
          )
        expect returned

        // ✅ Success
        True
      }

      // =================================
      // ✏️ EDIT PRICE CASE
      // =================================
      Edit { new_price } -> {
        // ✅ 1. Ensure seller signed the transaction
        expect
          when d.seller.payment_credential is {
            VerificationKey(key) -> list.has(self.extra_signatories, key)
            _ -> False
          }

        // ✅ 2. Find updated output at same address with NFT still present
        expect Some(self_output) =
          list.find(
            self.outputs,
            fn(output) {
              output.address == own_input.output.address && assets.quantity_of(
                output.value,
                d.nft_policy,
                d.nft_name,
              ) == 1
            },
          )

        // ✅ 3. Validate inline datum on updated output
        expect InlineDatum(new_datum_data) = self_output.datum
        expect new_datum: ListingDatum = new_datum_data

        // ✅ 4. Ensure all fields match except updated price
        expect new_datum.seller == d.seller
        expect new_datum.price_policy == d.price_policy
        expect new_datum.price_name == d.price_name
        expect new_datum.nft_policy == d.nft_policy
        expect new_datum.nft_name == d.nft_name
        expect new_datum.price_amount == new_price

        // ✅ Success
        True
      }
    }
  }

  // ❌ Fallback for unknown redeemers
  else(_) {
    fail
  }
}
