use tauri::State;

use crate::{
    diary_storage::{self, DiaryDate, DiaryEntry, DiaryScan, RevisionExpectation},
    error::AppError,
    workspace::WorkspaceState,
};

#[tauri::command]
pub fn list_diaries(state: State<'_, WorkspaceState>) -> Result<DiaryScan, AppError> {
    state.with_root(diary_storage::list)
}

#[tauri::command]
pub fn read_diary(state: State<'_, WorkspaceState>, date: String) -> Result<DiaryEntry, AppError> {
    let date = DiaryDate::parse(&date)?;
    state.with_root(|root| diary_storage::read(root, &date))
}

#[tauri::command]
pub fn save_diary(
    state: State<'_, WorkspaceState>,
    date: String,
    markdown: String,
    expectation: RevisionExpectation,
) -> Result<DiaryEntry, AppError> {
    let date = DiaryDate::parse(&date)?;
    state.with_root(|root| diary_storage::save(root, &date, &markdown, expectation))
}
