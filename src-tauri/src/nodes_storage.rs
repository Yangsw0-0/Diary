use crate::{
    diary_storage::{self, DiaryDate},
    error::AppError,
};
use serde::Serialize;
use serde_json::Value;
use std::{collections::HashSet, fs, io::Read, path::Path};
const LIMIT: u64 = 4 * 1024 * 1024;
#[derive(Serialize)]
pub struct NodesFile {
    pub json: String,
    pub revision: String,
}
#[cfg(windows)]
fn is_reparse(meta: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    meta.file_attributes() & 0x400 != 0
}
#[cfg(not(windows))]
fn is_reparse(_: &fs::Metadata) -> bool {
    false
}
fn checked_path(root: &Path) -> Result<std::path::PathBuf, AppError> {
    let path = root.join("Nodes.json");
    match fs::symlink_metadata(&path) {
        Ok(meta) if !meta.is_file() || meta.file_type().is_symlink() || is_reparse(&meta) => {
            return Err(AppError::new("invalid_data", "Nodes.json 不能是链接或目录"));
        }
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => return Err(AppError::from_io(e)),
        _ => (),
    }
    Ok(path)
}
pub fn read(root: &Path) -> Result<Option<NodesFile>, AppError> {
    let path = checked_path(root)?;
    let file = match fs::File::open(path) {
        Ok(file) => file,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(AppError::from_io(e)),
    };
    let mut bytes = Vec::new();
    file.take(LIMIT + 1)
        .read_to_end(&mut bytes)
        .map_err(AppError::from_io)?;
    if bytes.len() as u64 > LIMIT {
        return Err(AppError::new("corrupt_file", "节点文件超过 4 MiB"));
    }
    let revision = diary_storage::revision(&bytes);
    let json = String::from_utf8(bytes)
        .map_err(|_| AppError::new("corrupt_file", "节点文件不是 UTF-8"))?;
    Ok(Some(NodesFile { json, revision }))
}
fn validate(json: &str) -> Result<(), AppError> {
    let invalid = || AppError::new("invalid_data", "节点文件结构、日期或事件无效");
    if json.len() as u64 > LIMIT {
        return Err(invalid());
    }
    let doc: Value = serde_json::from_str(json).map_err(|_| invalid())?;
    let version = doc["version"].as_u64().ok_or_else(invalid)?;
    if version != 1 && version != 2 {
        return Err(invalid());
    }
    let nodes = doc["nodes"].as_array().ok_or_else(invalid)?;
    let mut dates = HashSet::new();
    let mut ids = HashSet::new();
    let mut count = 0;
    for node in nodes {
        let date = node["date"].as_str().ok_or_else(invalid)?;
        DiaryDate::parse(date)?;
        if !dates.insert(date) {
            return Err(invalid());
        }
        let id = node["id"]
            .as_str()
            .filter(|s| !s.trim().is_empty())
            .ok_or_else(invalid)?;
        if !ids.insert(id) {
            return Err(invalid());
        }
        let events: Vec<&Value> = if version == 1 {
            vec![node]
        } else {
            node["events"]
                .as_array()
                .ok_or_else(invalid)?
                .iter()
                .collect()
        };
        if events.is_empty() {
            return Err(invalid());
        }
        for event in events {
            count += 1;
            if count > 1000 {
                return Err(invalid());
            }
            if version == 2 {
                let id = event["id"]
                    .as_str()
                    .filter(|s| !s.trim().is_empty())
                    .ok_or_else(invalid)?;
                if !ids.insert(id) {
                    return Err(invalid());
                }
            }
            let title = event["title"].as_str().ok_or_else(invalid)?.trim();
            if title.is_empty()
                || title.chars().count() > 60
                || event["colorIndex"].as_u64().is_none_or(|v| v > 5)
            {
                return Err(invalid());
            }
            for field in ["createdAt", "updatedAt"] {
                if event[field].as_str().is_none_or(|v| !v.contains('T')) {
                    return Err(invalid());
                }
            }
        }
    }
    Ok(())
}
pub fn save(
    root: &Path,
    json: &str,
    expected: Option<&str>,
    force: bool,
) -> Result<NodesFile, AppError> {
    validate(json)?;
    let path = checked_path(root)?;
    let current = read(root)?;
    if !force && current.as_ref().map(|f| f.revision.as_str()) != expected {
        return Err(AppError::new(
            "conflict",
            "节点文件已被外部修改，请重新载入或覆盖保存",
        ));
    }
    diary_storage::atomic_write_checked(
        &path,
        json.as_bytes(),
        || {
            checked_path(root)?;
            let latest = read(root)?;
            if !force && latest.as_ref().map(|f| f.revision.as_str()) != expected {
                return Err(AppError::new("conflict", "节点文件在保存期间已被修改"));
            }
            Ok(())
        },
        current.is_none(),
    )?;
    Ok(NodesFile {
        json: json.to_owned(),
        revision: diary_storage::revision(json.as_bytes()),
    })
}
pub fn backup(root: &Path) -> Result<Option<String>, AppError> {
    let path = checked_path(root)?;
    if !path.exists() {
        return Ok(None);
    }
    let (temporary, file) = diary_storage::create_temp_file(root)?;
    drop(file);
    fs::remove_file(&temporary).map_err(AppError::from_io)?;
    let name = temporary.with_extension("nodes-backup.json");
    // Rename preserves even corrupt/non-UTF8/oversized bytes without reading or overwriting them.
    fs::hard_link(&path, &name).map_err(AppError::from_io)?;
    fs::remove_file(path).map_err(AppError::from_io)?;
    Ok(Some(
        name.file_name().unwrap().to_string_lossy().into_owned(),
    ))
}
#[cfg(test)]
mod tests {
    use super::*;
    fn root() -> std::path::PathBuf {
        let path = std::env::temp_dir().join(format!(
            "diary-nodes-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir(&path).unwrap();
        path
    }
    #[test]
    fn conflict_and_backup() {
        let root = root();
        assert!(read(&root).unwrap().is_none());
        let json = r#"{"version":2,"nodes":[]}"#;
        let file = save(&root, json, None, false).unwrap();
        assert!(save(&root, json, None, false).is_err());
        save(&root, json, Some(&file.revision), false).unwrap();
        fs::write(root.join("Nodes.json"), b"broken").unwrap();
        assert!(backup(&root).unwrap().is_some());
        assert!(!root.join("Nodes.json").exists());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn rejects_invalid_data() {
        let root = root();
        assert!(save(&root, r#"{"version":9,"nodes":[]}"#, None, true).is_err());
        assert!(save(&root, "{", None, true).is_err());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn bounded_read_and_scan_isolation() {
        let root = root();
        fs::write(root.join("Nodes.json"), vec![b'x'; LIMIT as usize + 1]).unwrap();
        assert!(read(&root).is_err());
        backup(&root).unwrap();
        fs::write(root.join("Nodes.json"), [0xff, 0xfe]).unwrap();
        assert!(read(&root).is_err());
        assert!(diary_storage::list(&root).unwrap().entries.is_empty());
        backup(&root).unwrap();
        let json = r#"{"version":2,"nodes":[]}"#;
        save(&root, json, None, false).unwrap();
        assert!(save(&root, json, Some("wrong"), false).is_err());
        save(&root, json, Some("wrong"), true).unwrap();
        fs::remove_dir_all(root).unwrap();
    }
    #[cfg(unix)]
    #[test]
    fn rejects_symlink() {
        let root = root();
        fs::write(root.join("original"), b"{}").unwrap();
        std::os::unix::fs::symlink(root.join("original"), root.join("Nodes.json")).unwrap();
        assert!(read(&root).is_err());
        fs::remove_dir_all(root).unwrap();
    }
}
