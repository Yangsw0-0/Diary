use tauri::State;

use crate::{
    attachment_storage::{self, AttachmentPreview, ImportedAttachment},
    diary_storage::DiaryDate,
    error::AppError,
    workspace::WorkspaceState,
};

#[tauri::command]
pub async fn import_attachment(
    state: State<'_, WorkspaceState>,
    date: String,
    name: String,
    bytes: Vec<u8>,
) -> Result<ImportedAttachment, AppError> {
    let date = DiaryDate::parse(&date)?;
    let workspace = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        workspace.with_write_root(|root| attachment_storage::import(root, &date, &name, &bytes))
    })
    .await
    .map_err(|error| AppError::new("unexpected", error.to_string()))?
}

#[tauri::command]
pub async fn preview_attachment(
    state: State<'_, WorkspaceState>,
    date: String,
    file_name: String,
) -> Result<AttachmentPreview, AppError> {
    let date = DiaryDate::parse(&date)?;
    let workspace = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        workspace.with_root(|root| attachment_storage::preview(root, &date, &file_name))
    })
    .await
    .map_err(|error| AppError::new("unexpected", error.to_string()))?
}

#[tauri::command]
pub async fn open_attachment(
    state: State<'_, WorkspaceState>,
    date: String,
    file_name: String,
) -> Result<(), AppError> {
    let date = DiaryDate::parse(&date)?;
    let workspace = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        workspace.with_root(|root| attachment_storage::open(root, &date, &file_name))
    })
    .await
    .map_err(|error| AppError::new("unexpected", error.to_string()))?
}
