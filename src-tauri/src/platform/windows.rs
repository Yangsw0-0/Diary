use std::{
    ffi::{OsStr, c_void},
    fs::{File, OpenOptions},
    os::windows::ffi::OsStrExt,
    os::windows::fs::OpenOptionsExt,
    path::Path,
    ptr,
};

use windows_sys::Win32::{UI::Shell::ShellExecuteW, UI::WindowsAndMessaging::SW_SHOWNORMAL};

use crate::error::AppError;

/// `FILE_FLAG_OPEN_REPARSE_POINT`: open the link itself instead of its target.
const FILE_FLAG_OPEN_REPARSE_POINT: u32 = 0x0020_0000;

fn wide(value: &OsStr) -> Vec<u16> {
    value.encode_wide().chain(std::iter::once(0)).collect()
}

pub(super) fn open_target(target: &OsStr) -> Result<(), AppError> {
    let operation = wide(OsStr::new("open"));
    let file = wide(target);
    let result = unsafe {
        ShellExecuteW(
            ptr::null_mut::<c_void>(),
            operation.as_ptr(),
            file.as_ptr(),
            ptr::null(),
            ptr::null(),
            SW_SHOWNORMAL,
        )
    };

    // ShellExecuteW returns a value greater than 32 on success.
    if result as isize > 32 {
        Ok(())
    } else {
        Err(AppError::new("unexpected", "系统无法打开目标"))
    }
}

pub(super) fn open_read_no_follow(path: &Path) -> Result<File, AppError> {
    let file = OpenOptions::new()
        .read(true)
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT)
        .open(path)
        .map_err(AppError::from_io)?;

    let metadata = file.metadata().map_err(AppError::from_io)?;
    if metadata.file_type().is_symlink() {
        return Err(AppError::new(
            "permission_denied",
            "附件不能是符号链接或链接目录",
        ));
    }
    Ok(file)
}
