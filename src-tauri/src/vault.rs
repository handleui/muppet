pub struct ApiKeyVault {
    pub stronghold: iota_stronghold::Stronghold,
    pub snapshot_path: iota_stronghold::SnapshotPath,
    /// Stored to recreate KeyProvider for each commit (KeyProvider is !Send).
    pub vault_key: zeroize::Zeroizing<Vec<u8>>,
}
