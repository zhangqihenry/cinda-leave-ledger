use serde::Serialize;
use serde_json::Value;
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};

const DATA_DIRECTORY_NAME: &str = "Cinda Leave Ledger Data";
const DATA_FILE_NAME: &str = "leave-records.json";
const CONFIG_FILE_NAME: &str = "leave-config.json";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppFiles {
    data: Option<Value>,
    config: Option<Value>,
    directory: String,
    first_run: bool,
}

fn data_directory_for_executable(executable: &Path) -> Result<PathBuf, String> {
    let parent = executable
        .parent()
        .ok_or_else(|| "无法确定 EXE 所在目录".to_string())?;
    Ok(parent.join(DATA_DIRECTORY_NAME))
}

fn portable_data_directory() -> Result<PathBuf, String> {
    let executable =
        std::env::current_exe().map_err(|error| format!("无法确定 EXE 所在目录：{error}"))?;
    data_directory_for_executable(&executable)
}

fn is_first_run(directory: &Path) -> bool {
    !directory.is_dir()
        || !directory.join(DATA_FILE_NAME).is_file()
        || !directory.join(CONFIG_FILE_NAME).is_file()
}

fn ensure_data_directory() -> Result<PathBuf, String> {
    let directory = portable_data_directory()?;
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
fn load_app_files() -> Result<AppFiles, String> {
    let directory = portable_data_directory()?;
    let first_run = is_first_run(&directory);
    fs::create_dir_all(&directory).map_err(|error| format!("无法创建应用数据目录：{error}"))?;
    Ok(AppFiles {
        data: read_json(&directory.join(DATA_FILE_NAME))?,
        config: read_json(&directory.join(CONFIG_FILE_NAME))?,
        directory: directory.to_string_lossy().into_owned(),
        first_run,
    })
}

#[tauri::command]
fn save_app_files(data: Value, config: Value) -> Result<(), String> {
    let directory = ensure_data_directory()?;
    write_json(&directory.join(DATA_FILE_NAME), &data)?;
    write_json(&directory.join(CONFIG_FILE_NAME), &config)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_app_files, save_app_files])
        .run(tauri::generate_context!())
        .expect("启动休假账本时发生错误");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn data_directory_is_next_to_executable() {
        let executable = Path::new("C:/Portable/cinda-leave-ledger.exe");
        let directory = data_directory_for_executable(executable).unwrap();
        assert_eq!(
            directory,
            Path::new("C:/Portable").join(DATA_DIRECTORY_NAME)
        );
    }

    #[test]
    fn first_run_requires_directory_and_both_files() {
        let directory =
            std::env::temp_dir().join(format!("cinda-leave-ledger-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&directory);
        assert!(is_first_run(&directory));

        fs::create_dir_all(&directory).unwrap();
        fs::write(directory.join(DATA_FILE_NAME), "{}").unwrap();
        assert!(is_first_run(&directory));

        fs::write(directory.join(CONFIG_FILE_NAME), "{}").unwrap();
        assert!(!is_first_run(&directory));
        fs::remove_dir_all(&directory).unwrap();
    }
}
