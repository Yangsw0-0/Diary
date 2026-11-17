use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

use crate::{
    diary_storage::{atomic_write, create_temp_file},
    error::AppError,
};

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Settings {
    diary_root: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceStatus {
    pub root: Option<String>,
    pub configured_root: Option<String>,
    pub issue: Option<String>,
}

pub struct WorkspaceState {
    settings_path: PathBuf,
    selected: Mutex<Option<PathBuf>>,
    startup_issue: Mutex<Option<String>>,
}

impl WorkspaceState {
    pub fn new(settings_path: PathBuf) -> Self {
        let (selected, issue) = match fs::read(&settings_path) {
            Ok(bytes) => match serde_json::from_slice::<Settings>(&bytes) {
                Ok(settings) => (Some(PathBuf::from(settings.diary_root)), None),
                Err(error) => (None, Some(format!("设置文件无法读取：{error}"))),
            },
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => (None, None),
            Err(error) => (None, Some(format!("设置文件无法读取：{error}"))),
        };
        Self {
            settings_path,
            selected: Mutex::new(selected),
            startup_issue: Mutex::new(issue),
        }
    }

    pub fn status(&self) -> WorkspaceStatus {
        let selected = self
            .selected
            .lock()
            .unwrap_or_else(|poison| poison.into_inner());
        let configured_root = selected
            .as_ref()
            .map(|path| path.to_string_lossy().into_owned());
        match selected.as_ref() {
            Some(path) => match validate_root(path, true) {
                Ok(root) => WorkspaceStatus {
                    root: Some(root.to_string_lossy().into_owned()),
                    configured_root,
                    issue: None,
                },
                Err(error) => WorkspaceStatus {
                    root: None,
                    configured_root,
                    issue: Some(error.message),
                },
            },
            None => WorkspaceStatus {
                root: None,
                configured_root: None,
                issue: self
                    .startup_issue
                    .lock()
                    .unwrap_or_else(|poison| poison.into_inner())
                    .clone(),
            },
        }
    }

    pub fn set_root(&self, candidate: &Path) -> Result<WorkspaceStatus, AppError> {
        let root = validate_root(candidate, true)?;
        let mut selected = self
            .selected
            .lock()
            .unwrap_or_else(|poison| poison.into_inner());
        let parent = self
            .settings_path
            .parent()
            .ok_or_else(|| AppError::new("unexpected", "设置路径无父目录"))?;
        fs::create_dir_all(parent).map_err(AppError::from_io)?;
        let bytes = serde_json::to_vec(&Settings {
            diary_root: root.to_string_lossy().into_owned(),
        })
        .map_err(|error| AppError::new("unexpected", error.to_string()))?;
        atomic_write(&self.settings_path, &bytes)?;
        *selected = Some(root.clone());
        *self
            .startup_issue
            .lock()
            .unwrap_or_else(|poison| poison.into_inner()) = None;
        Ok(WorkspaceStatus {
            root: Some(root.to_string_lossy().into_owned()),
            configured_root: Some(root.to_string_lossy().into_owned()),
            issue: None,
        })
    }

    pub fn with_root<T>(
        &self,
        operation: impl FnOnce(&Path) -> Result<T, AppError>,
    ) -> Result<T, AppError> {
        let selected = self
            .selected
            .lock()
            .unwrap_or_else(|poison| poison.into_inner());
        let path = selected
            .as_ref()
            .ok_or_else(|| AppError::new("not_found", "请先选择日记文件夹"))?;
        let root = validate_root(path, false)?;
        operation(&root)
    }
}

fn validate_root(path: &Path, probe_write: bool) -> Result<PathBuf, AppError> {
    let original = fs::symlink_metadata(path).map_err(AppError::from_io)?;
    if original.file_type().is_symlink() || !original.is_dir() {
        return Err(AppError::new(
            "permission_denied",
            "选择的路径不是普通文件夹",
        ));
    }
    let root = fs::canonicalize(path).map_err(AppError::from_io)?;
    let metadata = fs::symlink_metadata(&root).map_err(AppError::from_io)?;
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Err(AppError::new(
            "permission_denied",
            "选择的路径不是可用文件夹",
        ));
    }
    fs::read_dir(&root).map_err(AppError::from_io)?;
    if probe_write {
        let (probe, file) = create_temp_file(&root)?;
        drop(file);
        fs::remove_file(probe).map_err(AppError::from_io)?;
    }
    Ok(root)
}

#[tauri::command]
pub fn get_workspace_status(state: State<'_, WorkspaceState>) -> WorkspaceStatus {
    state.status()
}

#[tauri::command]
pub async fn choose_diary_root(
    app: AppHandle,
    state: State<'_, WorkspaceState>,
) -> Result<Option<WorkspaceStatus>, AppError> {
    let selected = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .set_title("选择日记文件夹")
            .set_can_create_directories(false)
            .blocking_pick_folder()
    })
    .await
    .map_err(|error| AppError::new("unexpected", error.to_string()))?;
    let Some(selected) = selected else {
        return Ok(None);
    };
    let path = selected
        .into_path()
        .map_err(|error| AppError::new("unexpected", error.to_string()))?;
    state.set_root(&path).map(Some)
}

pub fn settings_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    Ok(app
        .path()
        .app_config_dir()
        .map_err(|error| AppError::new("unexpected", error.to_string()))?
        .join("settings.json"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::diary_storage::{self, DiaryDate, RevisionExpectation};
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn selection_persists_and_missing_root_requires_reselection() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let base =
            std::env::temp_dir().join(format!("diary-workspace-{}-{nonce}", std::process::id()));
        let root = base.join("journals");
        fs::create_dir_all(&root).unwrap();
        let settings = base.join("config/settings.json");
        let state = WorkspaceState::new(settings.clone());
        assert!(state.status().root.is_none());
        state.set_root(&root).unwrap();
        assert_eq!(
            WorkspaceState::new(settings).status().root,
            Some(root.to_string_lossy().into_owned())
        );
        fs::remove_dir(&root).unwrap();
        assert!(state.status().root.is_none());
        assert!(state.status().issue.is_some());
        fs::remove_dir_all(base).unwrap();
    }

    #[test]
    fn switching_root_is_serialized_and_keeps_old_files() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let base =
            std::env::temp_dir().join(format!("diary-switch-{}-{nonce}", std::process::id()));
        let first = base.join("first");
        let second = base.join("second");
        fs::create_dir_all(&first).unwrap();
        fs::create_dir(&second).unwrap();
        let settings = base.join("config/settings.json");
        let state = WorkspaceState::new(settings.clone());
        state.set_root(&first).unwrap();
        let date = DiaryDate::parse("2024-02-29").unwrap();
        state
            .with_root(|root| diary_storage::save(root, &date, "first", RevisionExpectation::New))
            .unwrap();
        state.set_root(&second).unwrap();
        assert!(
            state
                .with_root(diary_storage::list)
                .unwrap()
                .entries
                .is_empty()
        );
        assert_eq!(
            diary_storage::read(&first, &date).unwrap().markdown,
            "first"
        );
        assert_eq!(
            WorkspaceState::new(settings).status().root,
            Some(second.to_string_lossy().into_owned())
        );
        fs::remove_dir_all(base).unwrap();
    }
}
