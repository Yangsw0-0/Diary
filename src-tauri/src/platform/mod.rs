//! OS-specific desktop integration.
//!
//! Everything that directly invokes an operating-system API lives in this
//! module. Business and storage code call these functions instead of using
//! `#[cfg(target_os = ...)]` or platform commands inline.

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "windows")]
mod windows;

use std::{ffi::OsStr, fs::File, path::Path};

use crate::error::AppError;

/// Open a validated http/https/mailto URL with the user's default application.
pub fn open_url(url: &str) -> Result<(), AppError> {
    open_target(OsStr::new(url))
}

/// Open a local file or directory with the user's default application.
pub fn open_path(path: &Path) -> Result<(), AppError> {
    open_target(path.as_os_str())
}

/// Open an attachment for reading without following a symlink.
///
/// The caller still checks the returned handle's metadata before reading it.
/// On macOS this uses `O_NOFOLLOW`; on Windows it opens the reparse point itself
/// and rejects a symbolic link or junction.
pub fn open_read_no_follow(path: &Path) -> Result<File, AppError> {
    open_read(path)
}

#[cfg(target_os = "macos")]
fn open_target(target: &OsStr) -> Result<(), AppError> {
    macos::open_target(target)
}

#[cfg(target_os = "windows")]
fn open_target(target: &OsStr) -> Result<(), AppError> {
    windows::open_target(target)
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn open_target(target: &OsStr) -> Result<(), AppError> {
    let _ = target;
    Err(AppError::new("unexpected", "当前平台不支持打开外部目标"))
}

#[cfg(target_os = "macos")]
fn open_read(path: &Path) -> Result<File, AppError> {
    macos::open_read_no_follow(path)
}

#[cfg(target_os = "windows")]
fn open_read(path: &Path) -> Result<File, AppError> {
    windows::open_read_no_follow(path)
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn open_read(path: &Path) -> Result<File, AppError> {
    let _ = path;
    Err(AppError::new("unexpected", "当前平台不支持安全读取附件"))
}
