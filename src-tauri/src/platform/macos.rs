use std::{
    ffi::OsStr,
    fs::{File, OpenOptions},
    os::unix::fs::OpenOptionsExt,
    path::Path,
    process::Command,
};

use crate::error::AppError;

pub(super) fn open_target(target: &OsStr) -> Result<(), AppError> {
    let status = Command::new("open")
        .arg(target)
        .status()
        .map_err(AppError::from_io)?;
    if status.success() {
        Ok(())
    } else {
        Err(AppError::new("unexpected", "系统无法打开目标"))
    }
}

pub(super) fn open_read_no_follow(path: &Path) -> Result<File, AppError> {
    OpenOptions::new()
        .read(true)
        .custom_flags(libc::O_NOFOLLOW)
        .open(path)
        .map_err(AppError::from_io)
}
