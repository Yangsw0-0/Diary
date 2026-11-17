use tauri::State;

use crate::{
    diary_storage::{self, DiaryDate, DiaryEntry, DiaryScan, RevisionExpectation},
    error::AppError,
    workspace::WorkspaceState,
};

#[tauri::command]
pub async fn list_diaries(state: State<'_, WorkspaceState>) -> Result<DiaryScan, AppError> {
    let workspace = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || workspace.with_root(diary_storage::list))
        .await
        .map_err(|error| AppError::new("unexpected", error.to_string()))?
}

#[tauri::command]
pub async fn read_diary(
    state: State<'_, WorkspaceState>,
    date: String,
) -> Result<DiaryEntry, AppError> {
    let date = DiaryDate::parse(&date)?;
    let workspace = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        workspace.with_root(|root| diary_storage::read(root, &date))
    })
    .await
    .map_err(|error| AppError::new("unexpected", error.to_string()))?
}

#[tauri::command]
pub async fn save_diary(
    state: State<'_, WorkspaceState>,
    date: String,
    markdown: String,
    expectation: RevisionExpectation,
) -> Result<DiaryEntry, AppError> {
    let date = DiaryDate::parse(&date)?;
    let workspace = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        workspace.with_write_root(|root| diary_storage::save(root, &date, &markdown, expectation))
    })
    .await
    .map_err(|error| AppError::new("unexpected", error.to_string()))?
}

#[tauri::command]
pub async fn rename_diary(
    state: State<'_, WorkspaceState>,
    old_date: String,
    markdown: String,
    expected_revision: String,
) -> Result<DiaryEntry, AppError> {
    let old_date = DiaryDate::parse(&old_date)?;
    let workspace = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        workspace.with_write_root(|root| {
            diary_storage::rename(root, &old_date, &markdown, &expected_revision)
        })
    })
    .await
    .map_err(|error| AppError::new("unexpected", error.to_string()))?
}

#[tauri::command]
pub async fn trash_diary(
    state: State<'_, WorkspaceState>,
    date: String,
    expected_revision: String,
) -> Result<(), AppError> {
    let date = DiaryDate::parse(&date)?;
    let workspace = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        workspace.with_write_root(|root| diary_storage::trash(root, &date, &expected_revision))
    })
    .await
    .map_err(|error| AppError::new("unexpected", error.to_string()))?
}
