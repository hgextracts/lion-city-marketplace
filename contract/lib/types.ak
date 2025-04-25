use cardano/address.{Address}

/// # ListingDatum
/// On-chain data representing a single NFT listing.
pub type ListingDatum {    
  seller: Address,         // Full address of the seller
  price_policy: ByteArray, // Policy ID of the payment token (empty for ADA)
  price_name: ByteArray,   // Asset name of the payment token (empty for ADA)
  price_amount: Int,       // Required payment amount
  nft_policy: ByteArray,   // Policy ID of the listed NFT
  nft_name: ByteArray,     // Asset name of the listed NFT
}

/// # MarketplaceAction
/// Redeemer actions for interacting with the marketplace.
pub type MarketplaceAction {
  Buy                     // Purchase the listed NFT
  Delist                  // Remove the NFT listing
  Edit { new_price: Int }  // Update the price of the listing
}

/// # ControlAction
/// Actions for minting or burning marketplace control tokens.
pub type ControlAction {
  Initialize  // Mint initial Ownership and Config tokens
  Shutdown    // Burn Ownership and Config tokens
}

/// # ConfigAction
/// Actions for managing the MarketplaceConfig UTxO.
pub type ConfigAction {
  Updating  // Update the config datum (fee structure, etc.)
  Burning   // Destroy the config UTxO when shutting down
}

/// # TokenFee
/// Defines an allowed payment token and its associated fee in basis points.
pub type TokenFee {
  policy: ByteArray,   // Policy ID of the token
  name: ByteArray,     // Asset name of the token
  fee_bps: Int         // Fee rate (1% = 100 bps)
}

/// # MarketplaceConfigDatum
/// On-chain configuration for marketplace settings.
pub type MarketplaceConfigDatum {
  fee_address: Address,        // Address where marketplace fees are sent
  allowed_tokens: List<TokenFee>  // List of allowed payment tokens and fee rates
}
