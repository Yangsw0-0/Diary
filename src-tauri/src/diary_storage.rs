use std::{
    fs::{self, File, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::error::AppError;

static TEMP_SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DiaryDate(String);

impl DiaryDate {
    pub fn parse(value: &str) -> Result<Self, AppError> {
        let bytes = value.as_bytes();
        if bytes.len() != 10
            || bytes[4] != b'-'
            || bytes[7] != b'-'
            || !bytes
                .iter()
                .enumerate()
                .all(|(i, byte)| i == 4 || i == 7 || byte.is_ascii_digit())
        {
            return Err(AppError::new("invalid_date", "日期必须为 YYYY-MM-DD"));
        }
        let year: u16 = value[0..4]
            .parse()
            .map_err(|_| AppError::new("invalid_date", "年份无效"))?;
        let month: usize = value[5..7]
            .parse()
            .map_err(|_| AppError::new("invalid_date", "月份无效"))?;
        let day: usize = value[8..10]
            .parse()
            .map_err(|_| AppError::new("invalid_date", "日期无效"))?;
        let leap =
            year.is_multiple_of(4) && (!year.is_multiple_of(100) || year.is_multiple_of(400));
        let days = [
            31,
            if leap { 29 } else { 28 },
            31,
            30,
            31,
            30,
            31,
            31,
            30,
            31,
            30,
            31,
        ];
        if year == 0 || month == 0 || month > 12 || day == 0 || day > days[month - 1] {
            return Err(AppError::new("invalid_date", "日历日期无效"));
        }
        Ok(Self(value.to_owned()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
    pub fn year(&self) -> &str {
        &self.0[..4]
    }
    pub fn file_name(&self) -> String {
        format!("{}.md", self.0)
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiaryEntry {
    pub date: String,
    pub markdown: String,
    pub revision: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiaryFileFailure {
    pub file_name: String,
    pub reason: String,
}

#[derive(Debug, Serialize)]
pub struct DiaryScan {
    pub entries: Vec<DiaryEntry>,
    pub failures: Vec<DiaryFileFailure>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum RevisionExpectation {
    New,
    Match { revision: String },
}

pub fn revision(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn checked_year_dir(root: &Path, date: &DiaryDate, create: bool) -> Result<PathBuf, AppError> {
    let year_dir = root.join(date.year());
    if create && !year_dir.exists() {
        fs::create_dir(&year_dir).map_err(AppError::from_io)?;
    }
    let metadata = fs::symlink_metadata(&year_dir).map_err(AppError::from_io)?;
    if !metadata.file_type().is_dir() || metadata.file_type().is_symlink() {
        return Err(AppError::new("permission_denied", "年份目录必须是真实目录"));
    }
    Ok(year_dir)
}

fn checked_file(year_dir: &Path, date: &DiaryDate) -> Result<PathBuf, AppError> {
    let path = year_dir.join(date.file_name());
    let metadata = fs::symlink_metadata(&path).map_err(AppError::from_io)?;
    if !metadata.file_type().is_file() || metadata.file_type().is_symlink() {
        return Err(AppError::new("corrupt_file", "日记路径必须是普通文件"));
    }
    Ok(path)
}

fn read_from_year(year_dir: &Path, date: &DiaryDate) -> Result<DiaryEntry, AppError> {
    let path = checked_file(year_dir, date)?;
    let bytes = fs::read(path).map_err(AppError::from_io)?;
    let revision = revision(&bytes);
    let markdown = String::from_utf8(bytes)
        .map_err(|_| AppError::new("corrupt_file", "日记不是 UTF-8 文件"))?;
    if let Some(first_line) = markdown.lines().next()
        && let Some(heading) = first_line.strip_prefix("# ")
        && let Some(first_word) = heading.split_whitespace().next()
        && DiaryDate::parse(first_word).is_ok()
        && first_word != date.as_str()
    {
        return Err(AppError::new("corrupt_file", "正文日期与文件名不一致"));
    }
    Ok(DiaryEntry {
        date: date.as_str().to_owned(),
        markdown,
        revision,
    })
}

pub fn read(root: &Path, date: &DiaryDate) -> Result<DiaryEntry, AppError> {
    let year_dir = checked_year_dir(root, date, false)?;
    read_from_year(&year_dir, date)
}

pub fn list(root: &Path) -> Result<DiaryScan, AppError> {
    let mut scan = DiaryScan {
        entries: Vec::new(),
        failures: Vec::new(),
    };
    for year_item in fs::read_dir(root).map_err(AppError::from_io)? {
        let year_item = match year_item {
            Ok(item) => item,
            Err(error) => {
                scan.failures.push(DiaryFileFailure {
                    file_name: "<年份目录>".into(),
                    reason: error.to_string(),
                });
                continue;
            }
        };
        let year_name = year_item.file_name().to_string_lossy().into_owned();
        if year_name.len() != 4 || !year_name.bytes().all(|byte| byte.is_ascii_digit()) {
            if year_name.ends_with(".md") {
                scan.failures.push(DiaryFileFailure {
                    file_name: year_name,
                    reason: "日记文件必须放在年份目录中".into(),
                });
            }
            continue;
        }
        let year_type = match year_item.file_type() {
            Ok(file_type) => file_type,
            Err(error) => {
                scan.failures.push(DiaryFileFailure {
                    file_name: year_name,
                    reason: error.to_string(),
                });
                continue;
            }
        };
        if !year_type.is_dir() {
            scan.failures.push(DiaryFileFailure {
                file_name: year_name,
                reason: "年份路径不是普通目录".into(),
            });
            continue;
        }
        let year_entries = match fs::read_dir(year_item.path()) {
            Ok(entries) => entries,
            Err(error) => {
                scan.failures.push(DiaryFileFailure {
                    file_name: year_name,
                    reason: error.to_string(),
                });
                continue;
            }
        };
        for item in year_entries {
            let item = match item {
                Ok(item) => item,
                Err(error) => {
                    scan.failures.push(DiaryFileFailure {
                        file_name: year_name.clone(),
                        reason: error.to_string(),
                    });
                    continue;
                }
            };
            let name = item.file_name().to_string_lossy().into_owned();
            if !name.ends_with(".md") {
                continue;
            }
            let stem = &name[..name.len() - 3];
            match DiaryDate::parse(stem) {
                Ok(date) if date.year() == year_name => {
                    match read_from_year(&year_item.path(), &date) {
                        Ok(entry) => scan.entries.push(entry),
                        Err(error) => scan.failures.push(DiaryFileFailure {
                            file_name: format!("{year_name}/{name}"),
                            reason: error.message,
                        }),
                    }
                }
                _ => scan.failures.push(DiaryFileFailure {
                    file_name: format!("{year_name}/{name}"),
                    reason: "文件名日期无效或与年份目录不一致".into(),
                }),
            }
        }
    }
    scan.entries
        .sort_by(|left, right| right.date.cmp(&left.date));
    scan.failures
        .sort_by(|left, right| left.file_name.cmp(&right.file_name));
    Ok(scan)
}

pub fn create_temp_file(dir: &Path) -> Result<(PathBuf, File), AppError> {
    for _ in 0..16 {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| AppError::new("unexpected", error.to_string()))?
            .as_nanos();
        let sequence = TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let path = dir.join(format!(
            ".diary-{}-{nonce}-{sequence}.tmp",
            std::process::id()
        ));
        match OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(file) => return Ok((path, file)),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(AppError::from_io(error)),
        }
    }
    Err(AppError::new("unexpected", "无法创建唯一临时文件"))
}

struct TempCleanup(PathBuf);
impl Drop for TempCleanup {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.0);
    }
}

fn atomic_write_checked(
    path: &Path,
    bytes: &[u8],
    check: impl FnOnce() -> Result<(), AppError>,
    create_new: bool,
) -> Result<(), AppError> {
    let parent = path
        .parent()
        .ok_or_else(|| AppError::new("unexpected", "目标路径没有父目录"))?;
    let (temp_path, mut file) = create_temp_file(parent)?;
    let cleanup = TempCleanup(temp_path.clone());
    file.write_all(bytes).map_err(AppError::from_io)?;
    file.sync_all().map_err(AppError::from_io)?;
    drop(file);
    check()?;
    if create_new {
        fs::hard_link(&temp_path, path).map_err(|error| {
            if error.kind() == std::io::ErrorKind::AlreadyExists {
                AppError::new("conflict", "该日期已有日记")
            } else {
                AppError::from_io(error)
            }
        })?;
    } else {
        fs::rename(&temp_path, path).map_err(AppError::from_io)?;
    }
    drop(cleanup);
    Ok(())
}

pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), AppError> {
    atomic_write_checked(path, bytes, || Ok(()), false)
}

fn check_expectation(
    year_dir: &Path,
    date: &DiaryDate,
    expectation: &RevisionExpectation,
) -> Result<(), AppError> {
    let path = year_dir.join(date.file_name());
    match (fs::symlink_metadata(&path), expectation) {
        (Err(error), RevisionExpectation::New) if error.kind() == std::io::ErrorKind::NotFound => {
            Ok(())
        }
        (Ok(_), RevisionExpectation::New) => Err(AppError::new("conflict", "该日期已有日记")),
        (Err(error), RevisionExpectation::Match { .. })
            if error.kind() == std::io::ErrorKind::NotFound =>
        {
            Err(AppError::new("conflict", "日记已被删除"))
        }
        (Ok(_), RevisionExpectation::Match { revision: expected }) => {
            let actual = read_from_year(year_dir, date)?;
            if actual.revision == *expected {
                Ok(())
            } else {
                Err(AppError::new("conflict", "日记已被外部修改"))
            }
        }
        (Err(error), _) => Err(AppError::from_io(error)),
    }
}

pub fn save(
    root: &Path,
    date: &DiaryDate,
    markdown: &str,
    expectation: RevisionExpectation,
) -> Result<DiaryEntry, AppError> {
    let year_dir = checked_year_dir(root, date, true)?;
    let path = year_dir.join(date.file_name());
    check_expectation(&year_dir, date, &expectation)?;
    let normalized = markdown.replace("\r\n", "\n").replace('\r', "\n");
    let create_new = matches!(expectation, RevisionExpectation::New);
    atomic_write_checked(
        &path,
        normalized.as_bytes(),
        || check_expectation(&year_dir, date, &expectation),
        create_new,
    )?;
    let revision = revision(normalized.as_bytes());
    Ok(DiaryEntry {
        date: date.as_str().to_owned(),
        markdown: normalized,
        revision,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestRoot(PathBuf);

    impl TestRoot {
        fn new() -> Self {
            let (path, file) = create_temp_file(&std::env::temp_dir()).unwrap();
            drop(file);
            fs::remove_file(&path).unwrap();
            fs::create_dir(&path).unwrap();
            Self(path)
        }
    }

    impl Drop for TestRoot {
        fn drop(&mut self) {
            fs::remove_dir_all(&self.0).unwrap();
        }
    }

    #[test]
    fn dates_reject_impossible_values_and_path_fragments() {
        assert_eq!(DiaryDate::parse("2024-02-29").unwrap().year(), "2024");
        for value in [
            "2023-02-29",
            "0000-01-01",
            "2024-13-01",
            "../2024-01-01",
            "2024-1-1",
        ] {
            assert!(DiaryDate::parse(value).is_err(), "{value}");
        }
    }

    #[test]
    fn save_read_scan_and_revision_conflict() {
        let root = TestRoot::new();
        let old = DiaryDate::parse("2023-12-31").unwrap();
        let today = DiaryDate::parse("2024-02-29").unwrap();
        let first = save(
            &root.0,
            &old,
            "# 2023-12-31 Old\r\n",
            RevisionExpectation::New,
        )
        .unwrap();
        assert_eq!(first.markdown, "# 2023-12-31 Old\n");
        let next = save(
            &root.0,
            &today,
            "# 2024-02-29 New\n",
            RevisionExpectation::New,
        )
        .unwrap();
        assert_eq!(read(&root.0, &today).unwrap().revision, next.revision);
        assert_eq!(
            list(&root.0)
                .unwrap()
                .entries
                .iter()
                .map(|entry| entry.date.as_str())
                .collect::<Vec<_>>(),
            ["2024-02-29", "2023-12-31"]
        );
        assert_eq!(
            save(&root.0, &today, "overwrite", RevisionExpectation::New)
                .unwrap_err()
                .code,
            "conflict"
        );
        fs::write(root.0.join("2024/2024-02-29.md"), "# 2024-02-29 External\n").unwrap();
        assert_eq!(
            save(
                &root.0,
                &today,
                "ours",
                RevisionExpectation::Match {
                    revision: next.revision
                }
            )
            .unwrap_err()
            .code,
            "conflict"
        );
        assert_eq!(
            read(&root.0, &today).unwrap().markdown,
            "# 2024-02-29 External\n"
        );
        let updated = save(
            &root.0,
            &old,
            "# 2023-12-31 Updated",
            RevisionExpectation::Match {
                revision: first.revision,
            },
        )
        .unwrap();
        assert_eq!(updated.markdown, read(&root.0, &old).unwrap().markdown);
        assert!(!fs::read_dir(root.0.join("2023")).unwrap().any(|item| {
            item.unwrap()
                .file_name()
                .to_string_lossy()
                .ends_with(".tmp")
        }));
    }

    #[test]
    fn bad_files_are_reported_without_hiding_valid_dates() {
        let root = TestRoot::new();
        save(
            &root.0,
            &DiaryDate::parse("2024-01-01").unwrap(),
            "# 2024-01-01 Good",
            RevisionExpectation::New,
        )
        .unwrap();
        fs::write(root.0.join("2024/2024-02-30.md"), b"bad").unwrap();
        fs::write(root.0.join("2024/2023-12-31.md"), b"bad").unwrap();
        fs::write(root.0.join("2024/2024-01-02.md"), [0xff]).unwrap();
        fs::write(root.0.join("2024/2024-01-03.md"), "# 2024-01-04 mismatch").unwrap();
        fs::write(root.0.join("2024-05-01.md"), "# 2024-05-01 misplaced").unwrap();
        let scan = list(&root.0).unwrap();
        assert_eq!(scan.entries.len(), 1);
        assert_eq!(scan.failures.len(), 5);
    }

    #[test]
    fn failure_after_temp_write_keeps_original_and_cleans_temp() {
        let root = TestRoot::new();
        let target = root.0.join("settings.json");
        fs::write(&target, b"original").unwrap();
        let error = atomic_write_checked(
            &target,
            b"replacement",
            || Err(AppError::new("unexpected", "simulated failure")),
            false,
        )
        .unwrap_err();
        assert_eq!(error.message, "simulated failure");
        assert_eq!(fs::read(&target).unwrap(), b"original");
        assert!(!fs::read_dir(&root.0).unwrap().any(|item| {
            item.unwrap()
                .file_name()
                .to_string_lossy()
                .ends_with(".tmp")
        }));
    }

    #[test]
    fn concurrent_creation_cannot_replace_another_file() {
        let root = TestRoot::new();
        let target = root.0.join("new.md");
        let error = atomic_write_checked(
            &target,
            b"ours",
            || fs::write(&target, b"theirs").map_err(AppError::from_io),
            true,
        )
        .unwrap_err();
        assert_eq!(error.code, "conflict");
        assert_eq!(fs::read(&target).unwrap(), b"theirs");
    }

    #[cfg(unix)]
    #[test]
    fn symlinks_cannot_escape_the_selected_root() {
        use std::os::unix::fs::symlink;
        let root = TestRoot::new();
        let outside = TestRoot::new();
        symlink(&outside.0, root.0.join("2024")).unwrap();
        let date = DiaryDate::parse("2024-01-01").unwrap();
        assert_eq!(
            save(&root.0, &date, "secret", RevisionExpectation::New)
                .unwrap_err()
                .code,
            "permission_denied"
        );
        assert_eq!(read(&root.0, &date).unwrap_err().code, "permission_denied");
        assert!(!outside.0.join("2024-01-01.md").exists());
    }

    #[test]
    fn ipc_fixture_matches_rust_serialization() {
        let fixture: serde_json::Value =
            serde_json::from_str(include_str!("../../tests/fixtures/diary-ipc.json")).unwrap();
        let entry = DiaryEntry {
            date: "2024-02-29".into(),
            markdown: "# 2024-02-29 Leap day\n".into(),
            revision: "abc123".into(),
        };
        assert_eq!(serde_json::to_value(&entry).unwrap(), fixture["entry"]);
        let scan = DiaryScan {
            entries: vec![entry],
            failures: vec![DiaryFileFailure {
                file_name: "2023/2023-02-29.md".into(),
                reason: "invalid date".into(),
            }],
        };
        assert_eq!(serde_json::to_value(&scan).unwrap(), fixture["scan"]);
        let expectation: RevisionExpectation =
            serde_json::from_value(fixture["matchExpectation"].clone()).unwrap();
        assert!(
            matches!(expectation, RevisionExpectation::Match { revision } if revision == "abc123")
        );
    }
}
