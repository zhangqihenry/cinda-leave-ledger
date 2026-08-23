use serde::Serialize;
use serde_json::Value;
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppFiles {
    data: Option<Value>,
    config: Option<Value>,
    directory: String,
}

fn app_data_directory(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("无法确定应用数据目录：{error}"))?;
    fs::create_dir_all(&directory).map_err(|error| format!("无法创建应用数据目录：{error}"))?;
    Ok(directory)
}

fn read_json(path: &Path) -> Result<Option<Value>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(path)
        .map_err(|error| format!("无法读取 {}：{error}", path.display()))?;
    let value = serde_json::from_str(content.trim_start_matches('\u{feff}'))
        .map_err(|error| format!("{} 的 JSON 格式有误：{error}", path.display()))?;
    Ok(Some(value))
}

fn write_json(path: &Path, value: &Value) -> Result<(), String> {
    let content = serde_json::to_string_pretty(value)
        .map_err(|error| format!("无法整理 {}：{error}", path.display()))?;
    let mut file = OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(path)
        .map_err(|error| format!("无法写入 {}：{error}", path.display()))?;
    file.write_all(content.as_bytes())
        .and_then(|_| file.write_all(b"\n"))
        .and_then(|_| file.sync_all())
        .map_err(|error| format!("无法保存 {}：{error}", path.display()))
}

#[tauri::command]
fn load_app_files(app: AppHandle) -> Result<AppFiles, String> {
    let directory = app_data_directory(&app)?;
    Ok(AppFiles {
        data: read_json(&directory.join("leave-records.json"))?,
        config: read_json(&directory.join("leave-config.json"))?,
        directory: directory.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
fn save_app_files(app: AppHandle, data: Value, config: Value) -> Result<(), String> {
    let directory = app_data_directory(&app)?;
    write_json(&directory.join("leave-records.json"), &data)?;
    write_json(&directory.join("leave-config.json"), &config)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_app_files, save_app_files])
        .run(tauri::generate_context!())
        .expect("启动休假账本时发生错误");
}
