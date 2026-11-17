use std::{
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex, RwLock},
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
    #[serde(default)]
    sidebar_width: Option<u16>,
    #[serde(default)]
    sidebar_collapsed: bool,
    #[serde(default = "default_theme")]
    theme: String,
}

fn default_theme() -> String {
    "light".to_owned()
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceStatus {
    pub root: Option<String>,
    pub configured_root: Option<String>,
    pub issue: Option<String>,
    pub sidebar_width: Option<u16>,
    pub sidebar_collapsed: bool,
    pub theme: String,
}

#[derive(Clone)]
pub struct WorkspaceState {
    settings_path: PathBuf,
    selected: Arc<RwLock<Option<PathBuf>>>,
    startup_issue: Arc<Mutex<Option<String>>>,
    save_gate: Arc<Mutex<()>>,
    preferences: Arc<RwLock<(Option<u16>, bool)>>,
    theme: Arc<RwLock<String>>,
}

impl WorkspaceState {
    pub fn new(settings_path: PathBuf) -> Self {
        let (selected, preferences, theme, issue) = match fs::read(&settings_path) {
            Ok(bytes) => match serde_json::from_slice::<Settings>(&bytes) {
                Ok(settings) => (
                    Some(PathBuf::from(settings.diary_root)),
                    (settings.sidebar_width, settings.sidebar_collapsed),
                    settings.theme,
                    None,
                ),
                Err(error) => (
                    None,
                    (None, false),
                    default_theme(),
                    Some(format!("设置文件无法读取：{error}")),
                ),
            },
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                (None, (None, false), default_theme(), None)
            }
            Err(error) => (
                None,
                (None, false),
                default_theme(),
                Some(format!("设置文件无法读取：{error}")),
            ),
        };
        Self {
            settings_path,
            selected: Arc::new(RwLock::new(selected)),
            startup_issue: Arc::new(Mutex::new(issue)),
            save_gate: Arc::new(Mutex::new(())),
            preferences: Arc::new(RwLock::new(preferences)),
            theme: Arc::new(RwLock::new(theme)),
        }
    }

    pub fn status(&self) -> WorkspaceStatus {
        let theme = self
            .theme
            .read()
            .unwrap_or_else(|poison| poison.into_inner())
            .clone();
        let preferences = *self
            .preferences
            .read()
            .unwrap_or_else(|poison| poison.into_inner());
        let selected = self
            .selected
            .read()
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
                    sidebar_width: preferences.0,
                    sidebar_collapsed: preferences.1,
                    theme: theme.clone(),
                },
                Err(error) => WorkspaceStatus {
                    root: None,
                    configured_root,
                    issue: Some(error.message),
                    sidebar_width: preferences.0,
                    sidebar_collapsed: preferences.1,
                    theme: theme.clone(),
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
                sidebar_width: preferences.0,
                sidebar_collapsed: preferences.1,
                theme,
            },
        }
    }

    pub fn set_root(&self, candidate: &Path) -> Result<WorkspaceStatus, AppError> {
        let root = validate_root(candidate, true)?;
        let _save_guard = self
            .save_gate
            .lock()
            .unwrap_or_else(|poison| poison.into_inner());
        let preferences = *self
            .preferences
            .read()
            .unwrap_or_else(|poison| poison.into_inner());
        let mut selected = self
            .selected
            .write()
            .unwrap_or_else(|poison| poison.into_inner());
        let parent = self
            .settings_path
            .parent()
            .ok_or_else(|| AppError::new("unexpected", "设置路径无父目录"))?;
        fs::create_dir_all(parent).map_err(AppError::from_io)?;
        let bytes = serde_json::to_vec(&Settings {
            diary_root: root.to_string_lossy().into_owned(),
            sidebar_width: preferences.0,
            sidebar_collapsed: preferences.1,
            theme: self
                .theme
                .read()
                .unwrap_or_else(|poison| poison.into_inner())
                .clone(),
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
            sidebar_width: preferences.0,
            sidebar_collapsed: preferences.1,
            theme: self
                .theme
                .read()
                .unwrap_or_else(|poison| poison.into_inner())
                .clone(),
        })
    }

    pub fn set_ui_preferences(&self, width: Option<u16>, collapsed: bool) -> Result<(), AppError> {
        if width.is_some_and(|value| !(172..=500).contains(&value)) {
            return Err(AppError::new("invalid_response", "侧栏宽度无效"));
        }
        let _save_guard = self
            .save_gate
            .lock()
            .unwrap_or_else(|poison| poison.into_inner());
        let selected = self
            .selected
            .read()
            .unwrap_or_else(|poison| poison.into_inner());
        let root = selected
            .as_ref()
            .ok_or_else(|| AppError::new("not_found", "请先选择日记文件夹"))?;
        let bytes = serde_json::to_vec(&Settings {
            diary_root: root.to_string_lossy().into_owned(),
            sidebar_width: width,
            sidebar_collapsed: collapsed,
            theme: self
                .theme
                .read()
                .unwrap_or_else(|poison| poison.into_inner())
                .clone(),
        })
        .map_err(|error| AppError::new("unexpected", error.to_string()))?;
        atomic_write(&self.settings_path, &bytes)?;
        *self
            .preferences
            .write()
            .unwrap_or_else(|poison| poison.into_inner()) = (width, collapsed);
        Ok(())
    }

    pub fn set_theme(&self, theme: &str) -> Result<(), AppError> {
        if theme != "light" && theme != "dark" {
            return Err(AppError::new("invalid_response", "主题无效"));
        }
        let _save_guard = self
            .save_gate
            .lock()
            .unwrap_or_else(|poison| poison.into_inner());
        let selected = self
            .selected
            .read()
            .unwrap_or_else(|poison| poison.into_inner());
        let root = selected
            .as_ref()
            .ok_or_else(|| AppError::new("not_found", "请先选择日记文件夹"))?;
        let preferences = *self
            .preferences
            .read()
            .unwrap_or_else(|poison| poison.into_inner());
        let bytes = serde_json::to_vec(&Settings {
            diary_root: root.to_string_lossy().into_owned(),
            sidebar_width: preferences.0,
            sidebar_collapsed: preferences.1,
            theme: theme.to_owned(),
        })
        .map_err(|error| AppError::new("unexpected", error.to_string()))?;
        atomic_write(&self.settings_path, &bytes)?;
        *self
            .theme
            .write()
            .unwrap_or_else(|poison| poison.into_inner()) = theme.to_owned();
        Ok(())
    }

    pub fn with_root<T>(
        &self,
        operation: impl FnOnce(&Path) -> Result<T, AppError>,
    ) -> Result<T, AppError> {
        let selected = self
            .selected
            .read()
            .unwrap_or_else(|poison| poison.into_inner());
        let path = selected
            .as_ref()
            .ok_or_else(|| AppError::new("not_found", "请先选择日记文件夹"))?;
        let root = validate_root(path, false)?;
        operation(&root)
    }

    pub fn with_write_root<T>(
        &self,
        operation: impl FnOnce(&Path) -> Result<T, AppError>,
    ) -> Result<T, AppError> {
        let _save_guard = self
            .save_gate
            .lock()
            .unwrap_or_else(|poison| poison.into_inner());
        self.with_root(operation)
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
pub async fn get_workspace_status(
    state: State<'_, WorkspaceState>,
) -> Result<WorkspaceStatus, AppError> {
    let workspace = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || workspace.status())
        .await
        .map_err(|error| AppError::new("unexpected", error.to_string()))
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
    let workspace = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || workspace.set_root(&path))
        .await
        .map_err(|error| AppError::new("unexpected", error.to_string()))?
        .map(Some)
}

#[tauri::command]
pub async fn save_ui_preferences(
    state: State<'_, WorkspaceState>,
    width: Option<u16>,
    collapsed: bool,
) -> Result<(), AppError> {
    let workspace = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || workspace.set_ui_preferences(width, collapsed))
        .await
        .map_err(|error| AppError::new("unexpected", error.to_string()))?
}

#[tauri::command]
pub async fn save_theme(state: State<'_, WorkspaceState>, theme: String) -> Result<(), AppError> {
    let workspace = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || workspace.set_theme(&theme))
        .await
        .map_err(|error| AppError::new("unexpected", error.to_string()))?
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
    use std::{
        sync::mpsc,
        thread,
        time::{Duration, SystemTime, UNIX_EPOCH},
    };

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
        let canonical_root = fs::canonicalize(&root).unwrap();
        let settings = base.join("config/settings.json");
        let state = WorkspaceState::new(settings.clone());
        assert!(state.status().root.is_none());
        state.set_root(&root).unwrap();
        assert_eq!(
            WorkspaceState::new(settings).status().root,
            Some(canonical_root.to_string_lossy().into_owned())
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
        let canonical_second = fs::canonicalize(&second).unwrap();
        let settings = base.join("config/settings.json");
        let state = WorkspaceState::new(settings.clone());
        state.set_root(&first).unwrap();
        let date = DiaryDate::parse("2024-02-29").unwrap();
        state
            .with_root(|root| {
                diary_storage::save(root, &date, "# 2024-02-29 first", RevisionExpectation::New)
            })
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
            "# 2024-02-29 first"
        );
        assert_eq!(
            WorkspaceState::new(settings).status().root,
            Some(canonical_second.to_string_lossy().into_owned())
        );
        fs::remove_dir_all(base).unwrap();
    }

    #[test]
    fn root_switch_waits_for_an_in_flight_file_operation() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let base = std::env::temp_dir().join(format!("diary-lock-{}-{nonce}", std::process::id()));
        let first = base.join("first");
        let second = base.join("second");
        fs::create_dir_all(&first).unwrap();
        fs::create_dir(&second).unwrap();
        let state = WorkspaceState::new(base.join("config/settings.json"));
        state.set_root(&first).unwrap();

        let (entered_tx, entered_rx) = mpsc::channel();
        let (release_tx, release_rx) = mpsc::channel();
        let reader = state.clone();
        let read_task = thread::spawn(move || {
            reader
                .with_root(|_| {
                    entered_tx.send(()).unwrap();
                    release_rx.recv().unwrap();
                    Ok(())
                })
                .unwrap();
        });
        entered_rx.recv_timeout(Duration::from_secs(1)).unwrap();

        let (started_tx, started_rx) = mpsc::channel();
        let (done_tx, done_rx) = mpsc::channel();
        let writer = state.clone();
        let switch_task = thread::spawn(move || {
            started_tx.send(()).unwrap();
            writer.set_root(&second).unwrap();
            done_tx.send(()).unwrap();
        });
        started_rx.recv_timeout(Duration::from_secs(1)).unwrap();
        assert!(done_rx.recv_timeout(Duration::from_millis(50)).is_err());
        release_tx.send(()).unwrap();
        read_task.join().unwrap();
        done_rx.recv_timeout(Duration::from_secs(1)).unwrap();
        switch_task.join().unwrap();
        fs::remove_dir_all(base).unwrap();
    }

    #[test]
    fn sidebar_preferences_survive_restart_and_root_switch() {
        let base = std::env::temp_dir().join(format!("diary-ui-prefs-{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir(&base).unwrap();
        let root = base.join("diaries");
        fs::create_dir(&root).unwrap();
        let settings = base.join("config/settings.json");
        let state = WorkspaceState::new(settings.clone());
        state.set_root(&root).unwrap();
        state.set_ui_preferences(Some(240), true).unwrap();
        state.set_theme("dark").unwrap();
        let restored = WorkspaceState::new(settings);
        assert_eq!(restored.status().sidebar_width, Some(240));
        assert!(restored.status().sidebar_collapsed);
        assert_eq!(restored.status().theme, "dark");
        assert!(restored.set_theme("other").is_err());
        assert!(restored.set_ui_preferences(Some(100), false).is_err());
        fs::remove_dir_all(base).unwrap();
    }
}
