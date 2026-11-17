use tauri::{
    State,
    ipc::{InvokeBody, Request, Response},
};

use crate::{
    attachment_storage::{self, AttachmentPreview, ImportedAttachment},
    diary_storage::DiaryDate,
    error::AppError,
    workspace::WorkspaceState,
};

#[tauri::command]
pub async fn import_attachment(
    state: State<'_, WorkspaceState>,
    request: Request<'_>,
) -> Result<ImportedAttachment, AppError> {
    let header = |key: &str| -> Result<&str, AppError> {
        request
            .headers()
            .get(key)
            .and_then(|value| value.to_str().ok())
            .ok_or_else(|| AppError::new("invalid_attachment", "附件请求缺少参数"))
    };
    let date = header("x-diary-date")?.to_owned();
    let encoded_name = header("x-diary-name")?;
    let name_bytes: Result<Vec<u8>, _> = encoded_name
        .as_bytes()
        .chunks_exact(2)
        .map(|pair| u8::from_str_radix(std::str::from_utf8(pair).unwrap_or(""), 16))
        .collect();
    if encoded_name.len() % 2 != 0 {
        return Err(AppError::new("invalid_attachment", "附件名称无效"));
    }
    let name = String::from_utf8(
        name_bytes.map_err(|_| AppError::new("invalid_attachment", "附件名称无效"))?,
    )
    .map_err(|_| AppError::new("invalid_attachment", "附件名称无效"))?;
    let bytes = match request.body() {
        InvokeBody::Raw(bytes) => bytes,
        _ => {
            return Err(AppError::new(
                "invalid_attachment",
                "附件必须使用二进制传输",
            ));
        }
    };
    if bytes.is_empty() || bytes.len() > attachment_storage::MAX_ATTACHMENT_BYTES {
        return Err(AppError::new(
            "invalid_attachment",
            "附件必须非空且不超过 20 MiB",
        ));
    }
    let bytes = bytes.clone();
    let date = DiaryDate::parse(&date)?;
    let workspace = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        workspace.with_write_root(|root| attachment_storage::import(root, &date, &name, &bytes))
    })
    .await
    .map_err(|error| AppError::new("unexpected", error.to_string()))?
}

#[tauri::command]
pub async fn preview_attachment(
    state: State<'_, WorkspaceState>,
    date: String,
    file_name: String,
) -> Result<Response, AppError> {
    let date = DiaryDate::parse(&date)?;
    let workspace = state.inner().clone();
    let preview: AttachmentPreview = tauri::async_runtime::spawn_blocking(move || {
        workspace.with_root(|root| attachment_storage::preview(root, &date, &file_name))
    })
    .await
    .map_err(|error| AppError::new("unexpected", error.to_string()))??;
    Ok(Response::new(preview.bytes))
}

#[tauri::command]
pub async fn open_attachment(
    state: State<'_, WorkspaceState>,
    date: String,
    file_name: String,
) -> Result<(), AppError> {
    let date = DiaryDate::parse(&date)?;
    let workspace = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        workspace.with_root(|root| attachment_storage::open(root, &date, &file_name))
    })
    .await
    .map_err(|error| AppError::new("unexpected", error.to_string()))?
}
