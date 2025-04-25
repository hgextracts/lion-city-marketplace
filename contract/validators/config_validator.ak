use cardano/transaction.{Transaction, OutputReference}
use cardano/assets.{PolicyId, quantity_of, without_lovelace, add, zero}
use aiken/collection/list
use types.{ConfigAction, Updating, Burning}
use constants
use utils.{get_self_input}

/// # Config Validator
/// Handles spending of the Marketplace Config UTxO.
/// Requires Ownership token to update, and verifies token burn during shutdown.
validator config_validator(control_policy_id: PolicyId) {
  spend(_datum: Option<Data>, action: ConfigAction, utxo: OutputReference, tx: Transaction) -> Bool {
    when action is {
      // ===================================
      // 🔄 Updating Marketplace Config
      // ===================================
      Updating -> {
        let self_input = get_self_input(utxo, tx)

        // ✅ Must include the Ownership token in inputs
        let has_ownership = list.any(
          tx.inputs,
          fn(i) {
            quantity_of(i.output.value, control_policy_id, constants.ownership) >= 1
          }
        )

        // ✅ Config UTxO must be recreated at the same script address
        let returned_to_same_address = list.any(
          tx.outputs,
          fn(o) { o.address == self_input.output.address }
        )

        has_ownership && returned_to_same_address
      }

      // ===================================
      // 🔥 Burning Config + Ownership
      // ===================================
      Burning -> {
        // ✅ Ensure exactly -1 of both Config and Ownership tokens were burned
        without_lovelace(tx.mint)
        == add(
          add(zero, control_policy_id, constants.marketplace_config, -1),
          control_policy_id,
          constants.ownership,
          -1
        )
      }
    }
  }
}
