/**
 * Known vault addresses to seed the registry.
 *
 * Sourced manually from app.hyperliquid.xyz/vaults leaderboard (March 2026).
 * Add addresses here as they are discovered. These are verified vault addresses
 * — confirmed with userRole returning {"role": "vault"}.
 *
 * Update this list as new significant vaults appear on the leaderboard.
 */

function addr(raw: string): string {
  return raw.replace(/^HL:/i, "").trim().toLowerCase();
}

export const SEED_VAULT_ADDRESSES: string[] = [
  // HLP — Hyperliquidity Provider (official market-making vault, $423M+ TVL)
  addr("0xdfc24b077bc1425ad1dea75bcb6f8158e10df303"),

  // HLP Strategy A (sub-vault, leader = HLP itself, high-frequency)
  addr("0x010461c14e146ac35fe42271bdc1134ee31c703a"),

  // Liquidator (discovered via userVaultEquities on HLP leader)
  addr("0x63c621a33714ec48660e32f2374895c8026a3a00"),

  // Top vaults from leaderboard — paste addresses as-is, HL: prefix handled automatically
  addr("HL:0x1e37a337ed460039d1b15bd3bc489de789768d5e"),
  addr("HL:0xd6e56265890b76413d1d527eb9b75e334c0c5b42"),
  addr("HL:0x4cb5f4d145cd16460932bbb9b871bb6fd5db97e3"),
  addr("HL:0xc179e03922afe8fa9533d3f896338b9fb87ce0c8"),
  addr("HL:0x07fd993f0fa3a185f7207adccd29f7a87404689d"),
  addr("HL:0x45e7014f092c5f9c39482caec131346f13ac5e73"),
  addr("HL:0xb1505ad1a4c7755e0eb236aa2f4327bfc3474768"),
  addr("HL:0x115849ce84370f25cadcf0d348510d73837e1aa5"),
  addr("HL:0xa6a34f0bf2ccea9a1ddf9e9a973f17c498dc5e40"),
  addr("HL:0xac26cf5f3c46b5e102048c65b977d2551b72a9c7"),
  addr("HL:0xca230e816bdb34a46960c2f978a30a563d1ae9e0"),
  addr("HL:0x654016a8c9fcf0c4cb7ed6078aba21f7f399f7b7"),
  addr("HL:0x1840bdb83caff17de910ec407cafb817678786b5"),
  addr("HL:0x7048b287889c5913d59f812795d7fd5d724be77a"),
  addr("HL:0x27d33e77c8e6335089f56e399bf706ae9ad402b9"),
  addr("HL:0x914434e8a235cb608a94a5f70ab8c40927152a24"),
  addr("HL:0x73ce82fb75868af2a687e9889fcf058dd1cf8ce9"),
  addr("HL:0x61b1cf5c2d7c4bf6d5db14f36651b2242e7cba0a"),
  addr("HL:0x4dec0a851849056e259128464ef28ce78afa27f6"),
  addr("HL:0xda51323fe9800c8365646ad5c7ade0dd17fdc167"),
  addr("HL:0x3005fade4c0df5e1cd187d7062da359416f0eb8e"),
  addr("HL:0x45bae5219bbbcce476e8ac92c26593ad9ba93d01"),
  addr("HL:0xbbf7d7a9d0eaeab4115f022a6863450296112422"),
  addr("HL:0x8fc7c0442e582bca195978c5a4fdec2e7c5bb0f7"),
  addr("HL:0xa844d7ac9fa3424c4fd38a25baa23e460ec3e802"),
  addr("HL:0x5661a070eb13c7c55ac3210b2447d4bea426cbf5"),
  addr("HL:0x5a733b25a17dc0f26b862ca9e32b439801b1a8c7"),
  addr("HL:0xe67dbf2d051106b42104c1a6631af5e5a458b682"),
  addr("HL:0x21edf2d791f626ee69352120e7f6e2fbb0f48cf1"),
  addr("HL:0x780825f3f0ad6799e304fb843387934c1fa06e70"),

];
