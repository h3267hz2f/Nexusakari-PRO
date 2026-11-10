fn main() {
    // Only invoke tauri_build when building the full desktop bundle
    if std::env::var("CARGO_CFG_TEST").is_err() {
        let _ = std::fs::create_dir_all("../dist");
    }
}
