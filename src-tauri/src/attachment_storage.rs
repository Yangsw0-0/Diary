use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::Serialize;

use crate::{
    diary_storage::{DiaryDate, create_temp_file, link_or_copy_new},
    error::AppError,
    platform,
};

pub const MAX_ATTACHMENT_BYTES: usize = 20 * 1024 * 1024;
static ATTACHMENT_SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedAttachment {
    pub file_name: String,
    pub relative_path: String,
    pub is_image: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentPreview {
    pub bytes: Vec<u8>,
    pub mime_type: &'static str,
}

fn image_mime(extension: &str) -> Option<&'static str> {
    match extension {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        "avif" => Some("image/avif"),
        _ => None,
    }
}

fn checked_extension(name: &str) -> Result<String, AppError> {
    if name.is_empty() || name.len() > 255 || name.contains(['/', '\\', '\0']) {
        return Err(AppError::new("invalid_attachment", "附件名称无效"));
    }
    let extension = name.rsplit_once('.').map(|(_, ext)| ext).unwrap_or("bin");
    if extension.is_empty()
        || extension.len() > 12
        || !extension.bytes().all(|b| b.is_ascii_alphanumeric())
    {
        return Err(AppError::new("invalid_attachment", "附件扩展名无效"));
    }
    Ok(extension.to_ascii_lowercase())
}

fn checked_directory(root: &Path, date: &DiaryDate, create: bool) -> Result<PathBuf, AppError> {
    let mut path = root.to_path_buf();
    for segment in ["assets", date.year(), date.as_str()] {
        path.push(segment);
        if create {
            match fs::create_dir(&path) {
                Ok(()) => (),
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => (),
                Err(error) => return Err(AppError::from_io(error)),
            }
        }
        let metadata = fs::symlink_metadata(&path).map_err(AppError::from_io)?;
        if !metadata.is_dir() || metadata.file_type().is_symlink() {
            return Err(AppError::new("permission_denied", "附件目录必须是真实目录"));
        }
    }
    Ok(path)
}

fn checked_file(root: &Path, date: &DiaryDate, name: &str) -> Result<PathBuf, AppError> {
    let Some((stem, extension)) = name.rsplit_once('.') else {
        return Err(AppError::new("invalid_attachment", "附件文件名无效"));
    };
    if !stem.starts_with("att-")
        || stem.len() != 36
        || !stem[4..].bytes().all(|b| b.is_ascii_hexdigit())
        || extension.is_empty()
        || extension.len() > 12
        || !extension.bytes().all(|b| b.is_ascii_alphanumeric())
    {
        return Err(AppError::new("invalid_attachment", "附件文件名无效"));
    }
    let path = checked_directory(root, date, false)?.join(name);
    let metadata = fs::symlink_metadata(&path).map_err(AppError::from_io)?;
    if !metadata.is_file() || metadata.file_type().is_symlink() {
        return Err(AppError::new("permission_denied", "附件必须是普通文件"));
    }
    Ok(path)
}

pub fn import(
    root: &Path,
    date: &DiaryDate,
    original_name: &str,
    bytes: &[u8],
) -> Result<ImportedAttachment, AppError> {
    if bytes.is_empty() || bytes.len() > MAX_ATTACHMENT_BYTES {
        return Err(AppError::new(
            "invalid_attachment",
            "附件必须非空且不超过 20 MiB",
        ));
    }
    let extension = checked_extension(original_name)?;
    let directory = checked_directory(root, date, true)?;
    let (temporary, mut file) = create_temp_file(&directory)?;
    let written = file.write_all(bytes).and_then(|_| file.sync_all());
    drop(file);
    if let Err(error) = written {
        let _ = fs::remove_file(&temporary);
        return Err(AppError::from_io(error));
    }
    let result = (|| {
        for _ in 0..16 {
            let nonce = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map_err(|error| AppError::new("unexpected", error.to_string()))?
                .as_nanos();
            let sequence = ATTACHMENT_SEQUENCE.fetch_add(1, Ordering::Relaxed);
            let name = format!("att-{nonce:020x}{sequence:012x}.{extension}");
            let destination = directory.join(&name);
            match link_or_copy_new(&temporary, &destination) {
                Ok(()) => {
                    return Ok(ImportedAttachment {
                        relative_path: format!(
                            "../assets/{}/{}/{}",
                            date.year(),
                            date.as_str(),
                            name
                        ),
                        file_name: name,
                        is_image: image_mime(&extension).is_some(),
                    });
                }
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
                Err(error) => return Err(AppError::from_io(error)),
            }
        }
        Err(AppError::new("unexpected", "无法生成唯一附件文件名"))
    })();
    let _ = fs::remove_file(&temporary);
    result
}

pub fn preview(root: &Path, date: &DiaryDate, name: &str) -> Result<AttachmentPreview, AppError> {
    let path = checked_file(root, date, name)?;
    let extension = name
        .rsplit_once('.')
        .map(|(_, ext)| ext.to_ascii_lowercase())
        .unwrap_or_default();
    let mime_type = image_mime(&extension)
        .ok_or_else(|| AppError::new("invalid_attachment", "只支持预览图片附件"))?;
    let file = platform::open_read_no_follow(&path)?;
    let metadata = file.metadata().map_err(AppError::from_io)?;
    if !metadata.is_file() {
        return Err(AppError::new("permission_denied", "附件必须是普通文件"));
    }
    if metadata.len() > MAX_ATTACHMENT_BYTES as u64 {
        return Err(AppError::new(
            "invalid_attachment",
            "图片超过 20 MiB 预览上限",
        ));
    }
    let mut bytes = Vec::new();
    file.take(MAX_ATTACHMENT_BYTES as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(AppError::from_io)?;
    if bytes.len() > MAX_ATTACHMENT_BYTES {
        return Err(AppError::new(
            "invalid_attachment",
            "图片超过 20 MiB 预览上限",
        ));
    }
    Ok(AttachmentPreview { bytes, mime_type })
}

pub fn open(root: &Path, date: &DiaryDate, name: &str) -> Result<(), AppError> {
    let path = checked_file(root, date, name)?;
    platform::open_path(&path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn imports_unique_files_and_blocks_unsafe_paths() {
        let base = std::env::temp_dir().join(format!("diary-attachments-{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir(&base).unwrap();
        let date = DiaryDate::parse("2026-11-17").unwrap();
        let first = import(&base, &date, "图片.png", b"image bytes").unwrap();
        let second = import(&base, &date, "图片.png", b"image bytes").unwrap();
        assert_ne!(first.file_name, second.file_name);
        assert!(first.is_image);
        assert_eq!(
            preview(&base, &date, &first.file_name).unwrap().bytes,
            b"image bytes"
        );
        assert!(preview(&base, &date, "../../settings.json").is_err());
        assert!(import(&base, &date, "../bad.png", b"data").is_err());
        let moved = base.with_extension("moved");
        let _ = fs::remove_dir_all(&moved);
        fs::rename(&base, &moved).unwrap();
        assert_eq!(
            preview(&moved, &date, &first.file_name).unwrap().bytes,
            b"image bytes"
        );
        fs::remove_dir_all(moved).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlinked_attachment_directory() {
        use std::os::unix::fs::symlink;
        let base =
            std::env::temp_dir().join(format!("diary-attachment-link-{}", std::process::id()));
        let outside = base.join("outside");
        fs::create_dir_all(&outside).unwrap();
        symlink(&outside, base.join("assets")).unwrap();
        let date = DiaryDate::parse("2026-11-17").unwrap();
        assert!(import(&base, &date, "x.png", b"data").is_err());
        fs::remove_dir_all(base).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn preview_rejects_symlink_and_oversized_file() {
        use std::fs::OpenOptions;
        use std::os::unix::fs::symlink;
        let base = std::env::temp_dir().join(format!("diary-preview-{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir(&base).unwrap();
        let date = DiaryDate::parse("2026-11-17").unwrap();
        let imported = import(&base, &date, "picture.png", b"small").unwrap();
        let directory = base.join("assets/2026/2026-11-17");
        let path = directory.join(&imported.file_name);
        let outside = base.join("outside.png");
        fs::write(&outside, b"outside").unwrap();
        fs::remove_file(&path).unwrap();
        symlink(&outside, &path).unwrap();
        assert!(preview(&base, &date, &imported.file_name).is_err());
        fs::remove_file(&path).unwrap();
        let file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)
            .unwrap();
        file.set_len(MAX_ATTACHMENT_BYTES as u64 + 1).unwrap();
        assert!(preview(&base, &date, &imported.file_name).is_err());
        fs::remove_dir_all(base).unwrap();
    }
}
