use crate::{error::AppError, platform};

fn checked_url(value: &str) -> Result<url::Url, AppError> {
    let parsed =
        url::Url::parse(value).map_err(|_| AppError::new("invalid_link", "链接地址无效"))?;
    match parsed.scheme() {
        "http" | "https" if parsed.host_str().is_some() => Ok(parsed),
        "mailto" if !parsed.path().is_empty() => Ok(parsed),
        _ => Err(AppError::new("invalid_link", "仅支持网页和邮件链接")),
    }
}

#[tauri::command]
pub async fn open_external_link(url: String) -> Result<(), AppError> {
    let checked = checked_url(&url)?;
    tauri::async_runtime::spawn_blocking(move || platform::open_url(checked.as_str()))
        .await
        .map_err(|error| AppError::new("unexpected", error.to_string()))?
}

#[cfg(test)]
#[test]
fn only_web_and_mail_links_are_allowed() {
    assert!(checked_url("https://example.com/path").is_ok());
    assert!(checked_url("mailto:someone@example.com").is_ok());
    assert!(checked_url("javascript:alert(1)").is_err());
    assert!(checked_url("file:///private/etc/passwd").is_err());
}
