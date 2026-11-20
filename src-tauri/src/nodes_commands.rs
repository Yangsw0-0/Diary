use crate::{
    error::AppError,
    nodes_storage::{self, NodesFile},
    workspace::WorkspaceState,
};
use tauri::State;
#[tauri::command]
pub async fn read_nodes(state: State<'_, WorkspaceState>) -> Result<Option<NodesFile>, AppError> {
    let workspace = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || workspace.with_root(nodes_storage::read))
        .await
        .map_err(|e| AppError::new("unexpected", e.to_string()))?
}
#[tauri::command]
pub async fn save_nodes(
    state: State<'_, WorkspaceState>,
    json: String,
    expected_revision: Option<String>,
    force: bool,
) -> Result<NodesFile, AppError> {
    let workspace = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        workspace.with_write_root(|root| {
            nodes_storage::save(root, &json, expected_revision.as_deref(), force)
        })
    })
    .await
    .map_err(|e| AppError::new("unexpected", e.to_string()))?
}
#[tauri::command]
pub async fn backup_nodes_file(
    state: State<'_, WorkspaceState>,
) -> Result<Option<String>, AppError> {
    let workspace = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || workspace.with_write_root(nodes_storage::backup))
        .await
        .map_err(|e| AppError::new("unexpected", e.to_string()))?
}
