use cardano/transaction.{Transaction, OutputReference}
use cardano/assets.{PolicyId, flatten}
use aiken/collection/list
use types.{ControlAction, Initialize, Shutdown}

/// # Marketplace Control Minting Policy
/// Controls minting of management tokens such as `Ownership` and `MarketplaceConfig`.
/// Minting is only allowed if a specific UTxO is consumed (for `Initialize`).
/// Burning is only allowed for tokens under the same policy.
validator marketplace_control(starter_utxo: OutputReference) {
  mint(action: ControlAction, policy_id: PolicyId, tx: Transaction) -> Bool {
    when action is {
      // ✅ Minting (e.g., Ownership or Config token) only allowed if starter UTxO is consumed
      Initialize -> {
        list.any(
          tx.inputs,
          fn(input) { input.output_reference == starter_utxo }
        )
      }

      // ✅ Burning only allowed (negative quantities) for tokens under this policy
      Shutdown -> {
        list.all(
          flatten(tx.mint),
          fn((pid, _name, qty)) {
            pid != policy_id || qty < 0
          }
        )
      }
    }
  }
}
