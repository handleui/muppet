mod commands;
mod db;

use sqlx::sqlite::SqlitePoolOptions;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // Initialize sqlx connection pool for backend use
            let db_path = app
                .path()
                .app_local_data_dir()
                .expect("could not resolve app local data path")
                .join("muppet.db");

            let db_url = format!("sqlite://{}?mode=rwc", db_path.display());
            let pool = tauri::async_runtime::block_on(async {
                SqlitePoolOptions::new()
                    .max_connections(5)
                    .after_connect(|conn, _meta| Box::pin(async move {
                        // Enable foreign keys FIRST - required for CASCADE to work
                        sqlx::query("PRAGMA foreign_keys = ON;").execute(&mut *conn).await?;
                        // Apply performance PRAGMAs to each connection
                        sqlx::query("PRAGMA journal_mode = WAL;").execute(&mut *conn).await?;
                        sqlx::query("PRAGMA synchronous = NORMAL;").execute(&mut *conn).await?;
                        sqlx::query("PRAGMA cache_size = -64000;").execute(&mut *conn).await?;
                        sqlx::query("PRAGMA temp_store = MEMORY;").execute(&mut *conn).await?;
                        sqlx::query("PRAGMA mmap_size = 268435456;").execute(&mut *conn).await?;
                        Ok(())
                    }))
                    .connect(&db_url)
                    .await
                    .expect("failed to connect to database")
            });

            // Run migrations directly through sqlx
            tauri::async_runtime::block_on(async {
                for migration_sql in db::migrations() {
                    sqlx::query(migration_sql)
                        .execute(&pool)
                        .await
                        .expect("failed to run migration");
                }
            });

            app.manage(Arc::new(pool));
            // Stronghold: use argon2 hashing with a salt file in app data dir
            let salt_path = app
                .path()
                .app_local_data_dir()
                .expect("could not resolve app local data path")
                .join("salt.txt");

            // Ensure parent directory exists with secure permissions
            if let Some(parent) = salt_path.parent() {
                std::fs::create_dir_all(parent)
                    .expect("failed to create app data directory");
            }

            // Read or create salt - generate random salt if file doesn't exist
            let salt = match std::fs::read_to_string(&salt_path) {
                Ok(existing_salt) => existing_salt,
                Err(_) => {
                    // Generate cryptographically secure random salt
                    use std::io::Write;
                    let mut random_bytes = [0u8; 32];
                    getrandom::fill(&mut random_bytes).expect("failed to generate random salt");
                    let new_salt = format!("{:x}", u128::from_le_bytes(random_bytes[0..16].try_into().unwrap()))
                        + &format!("{:x}", u128::from_le_bytes(random_bytes[16..32].try_into().unwrap()));

                    // Atomic write with restrictive permissions from the start
                    let temp_path = salt_path.with_extension("tmp");
                    let mut file = std::fs::File::create(&temp_path)
                        .expect("failed to create temp salt file");

                    #[cfg(unix)]
                    {
                        use std::os::unix::fs::PermissionsExt;
                        let mut perms = file.metadata()
                            .expect("failed to read temp file metadata")
                            .permissions();
                        perms.set_mode(0o600);
                        std::fs::set_permissions(&temp_path, perms)
                            .expect("failed to set temp file permissions");
                    }

                    file.write_all(new_salt.as_bytes())
                        .expect("failed to write temp salt file");
                    drop(file);

                    std::fs::rename(&temp_path, &salt_path)
                        .expect("failed to rename salt file");

                    new_salt
                }
            };

            let salt_bytes = salt.into_bytes();
            app.handle()
                .plugin(tauri_plugin_stronghold::Builder::new(move |password| {
                    use argon2::{Argon2, Algorithm, Params, Version};

                    let params = Params::new(10_000, 10, 4, None)
                        .expect("invalid argon2 params");
                    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

                    // Use hash_password_into for key derivation (returns raw bytes)
                    // Stronghold needs 32 bytes of key material, not a PHC string
                    let mut output_key = [0u8; 32];
                    argon2.hash_password_into(password.as_ref(), &salt_bytes, &mut output_key)
                        .expect("failed to hash password");

                    output_key.to_vec()
                }).build())?;

            // Register global hotkey (Option+Space on macOS)
            commands::register_hotkey(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::create_conversation,
            commands::list_conversations,
            commands::get_messages,
            commands::save_message,
            commands::delete_conversation,
            commands::update_conversation_title,
        ])
        .run(tauri::generate_context!())
        .expect("error while running muppet");
}
