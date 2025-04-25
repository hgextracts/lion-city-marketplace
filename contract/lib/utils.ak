use aiken/collection/list
use cardano/assets.{PolicyId}
use cardano/transaction.{InlineDatum, Input, Output, OutputReference, Transaction}
use cardano/address.{Address}
use types.{MarketplaceConfigDatum, TokenFee}
use constants

/// # Utility Functions for Marketplace Validators
/// Core helper functions for UTxO selection, seller payment verification, and marketplace configuration reading.

/// ✅ Fetches the script's own input UTxO from the transaction inputs.
/// Will `fail` if the input is not found.
pub fn get_self_input(utxo: OutputReference, tx: Transaction) -> Input {
  expect Some(input) =
    list.find(tx.inputs, fn(i) { i.output_reference == utxo })
  input
}

/// ✅ Verifies that the seller received at least the specified amount
/// of the payment token (ADA or other asset).
pub fn paid_at_least(
  outputs: List<Output>,
  seller: Address,
  policy: ByteArray,
  name: ByteArray,
  amount: Int
) -> Bool {
  let total_paid = list.foldl(
    outputs,
    0,
    fn(output, acc) {
      if output.address == seller {
        acc + assets.quantity_of(output.value, policy, name)
      } else {
        acc
      }
    }
  )

  total_paid >= amount
}

/// ✅ Reads the MarketplaceConfigDatum from the reference inputs.
/// Requires that the reference input contains the config NFT and a valid inline datum.
pub fn read_marketplace_config(tx: Transaction, policy_id: PolicyId) -> MarketplaceConfigDatum {
  let ref_input = list.find(tx.reference_inputs, fn(i) {
    assets.quantity_of(i.output.value, policy_id, constants.marketplace_config) == 1
  })
  expect Some(input) = ref_input

  expect InlineDatum(data) = input.output.datum
  expect config: MarketplaceConfigDatum = data
  config
}

/// ✅ Finds the fee basis points (bps) for a given payment token in the allowed tokens list.
/// Returns `None` if no matching fee config is found.
pub fn find_token_fee(
  tokens: List<TokenFee>,
  policy: ByteArray,
  name: ByteArray
) -> Option<Int> {
  tokens
  |> list.filter_map(fn(token) {
    if token.policy == policy && token.name == name {
      Some(token.fee_bps)
    } else {
      None
    }
  })
  |> list.head
}
