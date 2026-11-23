use crate::{diary_storage, error::AppError, workspace::WorkspaceState};
use serde::Serialize;
use serde_json::Value;
use std::{
    collections::HashSet,
    fs,
    io::Read,
    path::{Path, PathBuf},
};
use tauri::State;
const LIMIT: u64 = 512 * 1024;
#[derive(Serialize)]
pub struct CloudFile {
    json: String,
    revision: String,
}
fn path(root: &Path) -> Result<PathBuf, AppError> {
    let path = root.join("WordCloud.json");
    match fs::symlink_metadata(&path) {
        Ok(meta) if !meta.is_file() || meta.file_type().is_symlink() => {
            return Err(AppError::new("invalid_data", "词云文件不能是链接或目录"));
        }
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => return Err(AppError::from_io(e)),
        _ => (),
    }
    Ok(path)
}
fn read(root: &Path) -> Result<Option<CloudFile>, AppError> {
    let file = match crate::platform::open_read_no_follow(&path(root)?) {
        Ok(file) => file,
        Err(e) if e.code == "not_found" => return Ok(None),
        Err(e) => return Err(e),
    };
    if !file.metadata().map_err(AppError::from_io)?.is_file() {
        return Err(AppError::new("invalid_data", "词云文件不是普通文件"));
    }
    let mut bytes = Vec::new();
    file.take(LIMIT + 1)
        .read_to_end(&mut bytes)
        .map_err(AppError::from_io)?;
    if bytes.len() as u64 > LIMIT {
        return Err(AppError::new("corrupt_file", "词云文件超过512 KiB"));
    }
    let revision = diary_storage::revision(&bytes);
    let json =
        String::from_utf8(bytes).map_err(|_| AppError::new("corrupt_file", "词云文件不是UTF-8"))?;
    Ok(Some(CloudFile { json, revision }))
}
fn validate(json: &str) -> Result<(), AppError> {
    let invalid = || AppError::new("invalid_data", "词云数据格式、版本或配置无效");
    if json.len() as u64 > LIMIT {
        return Err(invalid());
    }
    let doc: Value = serde_json::from_str(json).map_err(|_| invalid())?;
    if doc["version"].as_u64() != Some(1) {
        return Err(invalid());
    }
    let words = doc["words"].as_array().ok_or_else(invalid)?;
    if words.len() > 500 {
        return Err(invalid());
    }
    let mut ids = HashSet::new();
    let mut texts = HashSet::new();
    for word in words {
        let id = word["id"]
            .as_str()
            .filter(|s| !s.trim().is_empty())
            .ok_or_else(invalid)?;
        let text = word["text"].as_str().ok_or_else(invalid)?.trim();
        if text.is_empty() || text.chars().count() > 120 || !ids.insert(id) || !texts.insert(text) {
            return Err(invalid());
        }
    }
    if let Some(preferences) = doc.get("preferences") {
        let preferences = preferences.as_object().ok_or_else(invalid)?;
        for name in ["showTags", "autoRotate", "panelCollapsed"] {
            if preferences.get(name).is_some_and(|v| !v.is_boolean()) {
                return Err(invalid());
            }
        }
        if preferences.get("lineMode").is_some_and(|v| {
            !matches!(
                v.as_str(),
                Some("none" | "grid" | "constellation" | "mixed")
            )
        }) {
            return Err(invalid());
        }
    }
    Ok(())
}
fn save(
    root: &Path,
    json: &str,
    expected: Option<&str>,
    force: bool,
) -> Result<CloudFile, AppError> {
    validate(json)?;
    let destination = path(root)?;
    let current = read(root)?;
    let check = || {
        path(root)?;
        let latest = read(root)?;
        if !force && latest.as_ref().map(|f| f.revision.as_str()) != expected {
            return Err(AppError::new(
                "conflict",
                "词云文件已被外部修改，请重新载入或覆盖保存",
            ));
        }
        Ok(())
    };
    check()?;
    diary_storage::atomic_write_checked(&destination, json.as_bytes(), check, current.is_none())?;
    Ok(CloudFile {
        json: json.to_owned(),
        revision: diary_storage::revision(json.as_bytes()),
    })
}
#[tauri::command]
pub async fn read_word_cloud(
    state: State<'_, WorkspaceState>,
) -> Result<Option<CloudFile>, AppError> {
    let workspace = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || workspace.with_root(read))
        .await
        .map_err(|e| AppError::new("unexpected", e.to_string()))?
}
#[tauri::command]
pub async fn save_word_cloud(
    state: State<'_, WorkspaceState>,
    json: String,
    expected_revision: Option<String>,
    force: bool,
) -> Result<CloudFile, AppError> {
    let workspace = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        workspace.with_write_root(|root| save(root, &json, expected_revision.as_deref(), force))
    })
    .await
    .map_err(|e| AppError::new("unexpected", e.to_string()))?
}
#[cfg(test)]
mod tests {
    use super::*;
    fn root() -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "diary-cloud-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir(&root).unwrap();
        root
    }
    #[test]
    fn roundtrip_conflict_and_scan() {
        let root = root();
        assert!(read(&root).unwrap().is_none());
        let json = r#"{"version":1,"words":[{"id":"a","text":"成长"}]}"#;
        let file = save(&root, json, None, false).unwrap();
        assert_eq!(read(&root).unwrap().unwrap().json, json);
        assert!(save(&root, json, None, false).is_err());
        save(&root, json, Some(&file.revision), false).unwrap();
        save(&root, json, None, true).unwrap();
        assert!(diary_storage::list(&root).unwrap().entries.is_empty());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn refuses_invalid_and_oversized() {
        for json in [
            r#"{"version":2,"words":[]}"#,
            r#"{"version":1,"words":[{"id":"a","text":" "}]}"#,
            r#"{"version":1,"words":[],"preferences":{"lineMode":"bad"}}"#,
        ] {
            assert!(validate(json).is_err());
        }
        let root = root();
        fs::write(root.join("WordCloud.json"), vec![b'x'; LIMIT as usize + 1]).unwrap();
        assert!(read(&root).is_err());
        fs::write(root.join("WordCloud.json"), [0xff]).unwrap();
        assert!(read(&root).is_err());
        fs::remove_dir_all(root).unwrap();
    }
    #[cfg(unix)]
    #[test]
    fn rejects_links() {
        let root = root();
        fs::write(root.join("original"), b"{}").unwrap();
        std::os::unix::fs::symlink(root.join("original"), root.join("WordCloud.json")).unwrap();
        assert!(read(&root).is_err());
        assert!(save(&root, r#"{"version":1,"words":[]}"#, None, true).is_err());
        fs::remove_dir_all(root).unwrap();
    }
}
