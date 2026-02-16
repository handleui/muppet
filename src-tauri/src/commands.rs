use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Row, Sqlite, SqlitePool};
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

// ── Types ──

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: String,
    pub model: Option<String>,
    pub tokens_in: Option<i64>,
    pub tokens_out: Option<i64>,
    pub created_at: String,
}

// ── Helpers ──

const MAX_TITLE_LENGTH: usize = 500;
const MAX_CONTENT_LENGTH: usize = 100_000; // ~100KB of text
const MAX_MODEL_LENGTH: usize = 100;

fn sanitize_db_error(err: sqlx::Error) -> String {
    // Log the actual error for debugging
    eprintln!("Database error: {:?}", err);
    // Don't leak internal database error details to frontend
    "Operation failed".to_string()
}

fn gen_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    use std::sync::atomic::{AtomicU32, Ordering};

    static COUNTER: AtomicU32 = AtomicU32::new(0);

    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time before UNIX epoch")
        .as_nanos();
    let counter = COUNTER.fetch_add(1, Ordering::Relaxed);

    format!("{:x}{:x}", ts, counter)
}

fn get_pool(app: &AppHandle) -> Result<&SqlitePool, String> {
    app.try_state::<Arc<SqlitePool>>()
        .ok_or_else(|| "Database not initialized".to_string())
        .map(|state| state.inner().as_ref())
}

// ── Conversation Commands ──

#[tauri::command]
pub async fn create_conversation(
    app: AppHandle,
    title: Option<String>,
) -> Result<Conversation, String> {
    let pool = get_pool(&app)?;
    let id = gen_id();
    let title = title.unwrap_or_else(|| "New Conversation".to_string());

    // Validate title length
    if title.len() > MAX_TITLE_LENGTH {
        return Err(format!("Title exceeds maximum length of {} characters", MAX_TITLE_LENGTH));
    }

    let result = sqlx::query(
        "INSERT INTO conversations (id, title) VALUES (?, ?)
         RETURNING id, title, created_at, updated_at",
    )
    .bind(&id)
    .bind(&title)
    .fetch_one(pool)
    .await
    .map_err(sanitize_db_error)?;

    Ok(Conversation {
        id: result.get("id"),
        title: result.get("title"),
        created_at: result.get("created_at"),
        updated_at: result.get("updated_at"),
    })
}

#[tauri::command]
pub async fn list_conversations(app: AppHandle) -> Result<Vec<Conversation>, String> {
    let pool = get_pool(&app)?;
    sqlx::query_as::<Sqlite, Conversation>(
        "SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(sanitize_db_error)
}

#[tauri::command]
pub async fn update_conversation_title(
    app: AppHandle,
    id: String,
    title: String,
) -> Result<(), String> {
    // Validate title length
    if title.len() > MAX_TITLE_LENGTH {
        return Err(format!("Title exceeds maximum length of {} characters", MAX_TITLE_LENGTH));
    }

    let pool = get_pool(&app)?;
    sqlx::query("UPDATE conversations SET title = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(&title)
        .bind(&id)
        .execute(pool)
        .await
        .map_err(sanitize_db_error)?;
    Ok(())
}

#[tauri::command]
pub async fn delete_conversation(app: AppHandle, id: String) -> Result<(), String> {
    let pool = get_pool(&app)?;
    // CASCADE foreign key will automatically delete associated messages
    sqlx::query("DELETE FROM conversations WHERE id = ?")
        .bind(&id)
        .execute(pool)
        .await
        .map_err(sanitize_db_error)?;
    Ok(())
}

// ── Message Commands ──

#[tauri::command]
pub async fn get_messages(
    app: AppHandle,
    conversation_id: String,
) -> Result<Vec<Message>, String> {
    let pool = get_pool(&app)?;
    sqlx::query_as::<Sqlite, Message>(
        "SELECT id, conversation_id, role, content, model, tokens_in, tokens_out, created_at
         FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
    )
    .bind(&conversation_id)
    .fetch_all(pool)
    .await
    .map_err(sanitize_db_error)
}

#[tauri::command]
pub async fn save_message(
    app: AppHandle,
    conversation_id: String,
    role: String,
    content: String,
    model: Option<String>,
    tokens_in: Option<i64>,
    tokens_out: Option<i64>,
) -> Result<Message, String> {
    // Validate role before database operation
    if !matches!(role.as_str(), "user" | "assistant" | "system") {
        return Err("Invalid role: must be 'user', 'assistant', or 'system'".to_string());
    }

    // Validate content length
    if content.len() > MAX_CONTENT_LENGTH {
        return Err(format!("Content exceeds maximum length of {} characters", MAX_CONTENT_LENGTH));
    }

    // Validate model length if provided
    if let Some(ref m) = model {
        if m.len() > MAX_MODEL_LENGTH {
            return Err(format!("Model name exceeds maximum length of {} characters", MAX_MODEL_LENGTH));
        }
    }

    // Validate token counts are non-negative
    if let Some(t) = tokens_in {
        if t < 0 {
            return Err("tokens_in must be non-negative".to_string());
        }
    }
    if let Some(t) = tokens_out {
        if t < 0 {
            return Err("tokens_out must be non-negative".to_string());
        }
    }

    let pool = get_pool(&app)?;
    let id = gen_id();

    // Use transaction to batch UPDATE + INSERT, then use RETURNING to avoid separate SELECT
    let mut tx = pool.begin().await.map_err(sanitize_db_error)?;

    sqlx::query("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?")
        .bind(&conversation_id)
        .execute(&mut *tx)
        .await
        .map_err(sanitize_db_error)?;

    let result = sqlx::query(
        "INSERT INTO messages (id, conversation_id, role, content, model, tokens_in, tokens_out)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id, conversation_id, role, content, model, tokens_in, tokens_out, created_at",
    )
    .bind(&id)
    .bind(&conversation_id)
    .bind(&role)
    .bind(&content)
    .bind(&model)
    .bind(tokens_in)
    .bind(tokens_out)
    .fetch_one(&mut *tx)
    .await
    .map_err(sanitize_db_error)?;

    tx.commit().await.map_err(sanitize_db_error)?;

    Ok(Message {
        id: result.get("id"),
        conversation_id: result.get("conversation_id"),
        role: result.get("role"),
        content: result.get("content"),
        model: result.get("model"),
        tokens_in: result.get("tokens_in"),
        tokens_out: result.get("tokens_out"),
        created_at: result.get("created_at"),
    })
}

// ── Global Hotkey ──

pub fn register_hotkey(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let shortcut: Shortcut = "Alt+Space".parse()?;

    app.global_shortcut().on_shortcut(
        shortcut,
        move |app_handle, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                if let Some(window) = app_handle.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        },
    )?;

    Ok(())
}
