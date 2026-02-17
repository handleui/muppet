mod commands;
mod db;
mod error;
mod exa;
mod supermemory;

use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};
use sqlx::SqlitePool;
use std::path::Path;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_local_data_dir()
                .expect("could not resolve app local data path");

            std::fs::create_dir_all(&app_data_dir)
                .expect("failed to create app data directory");

            let pool = tauri::async_runtime::block_on(init_db_pool(&app_data_dir))?;
            let cached_api_key = tauri::async_runtime::block_on(load_cached_api_key(&pool));

            app.manage(pool);
            app.manage(reqwest::Client::new());
            app.manage(commands::ApiKeyCache(std::sync::Mutex::new(cached_api_key)));

            app.manage(
                std::sync::RwLock::new(Option::<std::sync::Arc<supermemory::SupermemoryClient>>::None),
            );

            let salt_path = app_data_dir.join("salt.txt");
            app.handle()
                .plugin(tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build())?;

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
            commands::set_supermemory_api_key,
            commands::supermemory_add,
            commands::supermemory_search,
            commands::store_api_key,
            commands::has_api_key,
            commands::delete_api_key,
            commands::search_web,
        ])
        .run(tauri::generate_context!())
        .expect("error while running muppet");
}

async fn init_db_pool(app_data_dir: &Path) -> Result<SqlitePool, Box<dyn std::error::Error>> {
    let connect_opts = SqliteConnectOptions::new()
        .filename(app_data_dir.join("muppet.db"))
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .foreign_keys(true)
        .pragma("cache_size", "-64000")
        .pragma("temp_store", "MEMORY")
        .pragma("mmap_size", "268435456")
        .pragma("wal_autocheckpoint", "16000")
        .optimize_on_close(true, Some(400));

    let pool = SqlitePoolOptions::new()
        .max_connections(2)
        .connect_with(connect_opts)
        .await?;

    db::run_migrations(&pool).await?;

    Ok(pool)
}

async fn load_cached_api_key(pool: &SqlitePool) -> Option<String> {
    sqlx::query_scalar::<_, String>("SELECT value FROM settings WHERE key = 'exa_api_key'")
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
}
