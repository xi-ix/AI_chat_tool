use serde::{Deserialize, Serialize};
use std::{
    fs,
    fs::OpenOptions,
    io::Write,
    panic,
    path::PathBuf,
    time::{Duration, SystemTime},
};
use tauri::Manager;
use tauri_plugin_autostart::ManagerExt as AutostartExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

#[derive(Debug, Deserialize, Serialize)]
struct AppConfig {
    api_key: String,
    #[serde(default = "default_base_url")]
    base_url: String,
    #[serde(default = "default_model")]
    model: String,
}

#[derive(Debug, Deserialize, Serialize)]
struct AppSettings {
    #[serde(default = "default_global_shortcut")]
    global_shortcut: String,
    #[serde(default)]
    prompt: String,
    #[serde(default)]
    hide_dock_icon: bool,
    #[serde(default)]
    launch_at_login: bool,
}

#[derive(Debug, Deserialize)]
struct SaveConfigRequest {
    #[serde(rename = "api_key")]
    api_key: String,
    #[serde(rename = "base_url")]
    base_url: String,
    model: String,
}

#[derive(Debug, Serialize)]
struct ConfigResponse {
    api_key_set: bool,
    base_url: String,
    model: String,
}

#[derive(Debug, Deserialize)]
struct SaveShortcutRequest {
    #[serde(rename = "global_shortcut")]
    global_shortcut: String,
    #[serde(rename = "hide_dock_icon")]
    hide_dock_icon: bool,
    #[serde(rename = "launch_at_login")]
    launch_at_login: bool,
}

#[derive(Debug, Serialize)]
struct ShortcutResponse {
    global_shortcut: String,
    hide_dock_icon: bool,
    launch_at_login: bool,
}

#[derive(Debug, Deserialize)]
struct SavePromptRequest {
    prompt: String,
}

#[derive(Debug, Serialize)]
struct PromptResponse {
    prompt: String,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: Message,
}

#[derive(Debug, Deserialize, Serialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct AskResponse {
    answer: String,
}

#[derive(Debug, Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<Message>,
}

fn default_base_url() -> String {
    "https://api.openai.com/v1".to_string()
}

fn default_model() -> String {
    "gpt-4o-mini".to_string()
}

fn default_global_shortcut() -> String {
    "CommandOrControl+Shift+Space".to_string()
}

fn app_config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("无法定位配置目录: {error}"))?;

    Ok(config_dir.join("config.json"))
}

fn app_settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("无法定位配置目录: {error}"))?;

    Ok(config_dir.join("app-settings.json"))
}

fn load_config(app: &tauri::AppHandle) -> Result<AppConfig, String> {
    let paths = config_paths(app)?;
    let mut errors = Vec::new();

    for path in &paths {
        match fs::read_to_string(path) {
            Ok(content) => {
                return serde_json::from_str(&content)
                    .map_err(|error| format!("配置文件格式错误 {}: {error}", path.display()));
            }
            Err(error) => errors.push(format!("{}: {error}", path.display())),
        }
    }

    return Err(format!(
        "无法读取配置文件。\n已尝试:\n{}\n请参考项目里的 config.example.json 创建配置。",
        errors.join("\n")
    ));
}

fn save_config_to_path(path: PathBuf, config: SaveConfigRequest) -> Result<(), String> {
    if config.api_key.trim().is_empty() {
        return Err("API Key 不能为空".to_string());
    }
    if config.base_url.trim().is_empty() {
        return Err("Base URL 不能为空".to_string());
    }
    if config.model.trim().is_empty() {
        return Err("Model 不能为空".to_string());
    }

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("无法创建配置目录: {error}"))?;
    }

    let config = AppConfig {
        api_key: config.api_key.trim().to_string(),
        base_url: config.base_url.trim().trim_end_matches('/').to_string(),
        model: config.model.trim().to_string(),
    };
    let content = serde_json::to_string_pretty(&config)
        .map_err(|error| format!("序列化配置失败: {error}"))?;

    fs::write(path, format!("{content}\n")).map_err(|error| format!("保存配置失败: {error}"))
}

fn config_paths(app: &tauri::AppHandle) -> Result<Vec<PathBuf>, String> {
    let mut paths = Vec::new();

    #[cfg(debug_assertions)]
    if let Ok(current_dir) = std::env::current_dir() {
        paths.push(current_dir.join("config.json"));
        paths.push(current_dir.join("..").join("config.json"));
    }

    paths.push(app_config_path(app)?);
    Ok(paths)
}

fn settings_paths(app: &tauri::AppHandle) -> Result<Vec<PathBuf>, String> {
    let mut paths = Vec::new();

    #[cfg(debug_assertions)]
    if let Ok(current_dir) = std::env::current_dir() {
        paths.push(current_dir.join("app-settings.json"));
        paths.push(current_dir.join("..").join("app-settings.json"));
    }

    paths.push(app_settings_path(app)?);
    Ok(paths)
}

fn load_app_settings(app: &tauri::AppHandle) -> Result<AppSettings, String> {
    for path in settings_paths(app)? {
        if let Ok(content) = fs::read_to_string(&path) {
            return serde_json::from_str(&content)
                .map_err(|error| format!("快捷键配置文件格式错误 {}: {error}", path.display()));
        }
    }

    Ok(AppSettings {
        global_shortcut: default_global_shortcut(),
        prompt: String::new(),
        hide_dock_icon: false,
        launch_at_login: false,
    })
}

fn save_app_settings(app: &tauri::AppHandle, settings: &AppSettings) -> Result<(), String> {
    let path = settings_paths(app)?
        .into_iter()
        .next()
        .ok_or_else(|| "无法定位快捷键配置文件路径".to_string())?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("无法创建配置目录: {error}"))?;
    }

    let content = serde_json::to_string_pretty(settings)
        .map_err(|error| format!("序列化快捷键配置失败: {error}"))?;

    fs::write(path, format!("{content}\n"))
        .map_err(|error| format!("保存快捷键配置失败: {error}"))
}

fn show_main_window(app: &tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "找不到主窗口".to_string())?;

    window.show().map_err(|error| format!("显示主窗口失败: {error}"))?;
    window.unminimize().map_err(|error| format!("取消最小化失败: {error}"))?;
    window.set_focus().map_err(|error| format!("聚焦主窗口失败: {error}"))
}

fn apply_dock_visibility(app: &tauri::AppHandle, hide_dock_icon: bool) -> Result<(), String> {
    app.set_dock_visibility(!hide_dock_icon)
        .map_err(|error| format!("设置 Dock 图标显示状态失败: {error}"))
}

fn apply_autostart(app: &tauri::AppHandle, launch_at_login: bool) -> Result<(), String> {
    if launch_at_login {
        app.autolaunch()
            .enable()
            .map_err(|error| format!("启用开机自启失败: {error}"))
    } else {
        app.autolaunch()
            .disable()
            .map_err(|error| format!("关闭开机自启失败: {error}"))
    }
}

fn register_global_shortcut(app: &tauri::AppHandle, shortcut: &str) -> Result<(), String> {
    app.global_shortcut()
        .unregister_all()
        .map_err(|error| format!("清理旧快捷键失败: {error}"))?;

    app.global_shortcut()
        .on_shortcut(shortcut, |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                let _ = show_main_window(app);
            }
        })
        .map_err(|error| format!("注册快捷键失败: {error}"))
}

#[tauri::command]
async fn ask_question(app: tauri::AppHandle, question: String) -> Result<AskResponse, String> {
    let question = question.trim();
    if question.is_empty() {
        return Err("问题不能为空".to_string());
    }

    let config = load_config(&app)?;
    let url = format!(
        "{}/chat/completions",
        config.base_url.trim_end_matches('/')
    );

    let settings = load_app_settings(&app)?;
    let mut messages = Vec::new();
    if !settings.prompt.trim().is_empty() {
        messages.push(Message {
            role: "system".to_string(),
            content: settings.prompt.trim().to_string(),
        });
    }
    messages.push(Message {
        role: "user".to_string(),
        content: question.to_string(),
    });

    let request = ChatCompletionRequest {
        model: config.model,
        messages,
    };

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|error| format!("创建 HTTP 客户端失败: {error}"))?;

    let response = client
        .post(url)
        .bearer_auth(config.api_key)
        .json(&request)
        .send()
        .await
        .map_err(|error| format!("API 请求失败: {error}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("API 返回错误 {status}: {body}"));
    }

    let response_body = response
        .json::<ChatCompletionResponse>()
        .await
        .map_err(|error| format!("解析 API 响应失败: {error}"))?;

    let answer = response_body
        .choices
        .into_iter()
        .next()
        .map(|choice| choice.message.content)
        .filter(|content| !content.trim().is_empty())
        .ok_or_else(|| "API 没有返回答案".to_string())?;

    Ok(AskResponse { answer })
}

#[tauri::command]
fn get_config(app: tauri::AppHandle) -> Result<ConfigResponse, String> {
    let config = load_config(&app)?;

    Ok(ConfigResponse {
        api_key_set: !config.api_key.trim().is_empty(),
        base_url: config.base_url,
        model: config.model,
    })
}

#[tauri::command]
fn save_config(app: tauri::AppHandle, config: SaveConfigRequest) -> Result<(), String> {
    let path = config_paths(&app)?
        .into_iter()
        .next()
        .ok_or_else(|| "无法定位配置文件路径".to_string())?;

    save_config_to_path(path, config)
}

#[tauri::command]
fn get_shortcut_settings(app: tauri::AppHandle) -> Result<ShortcutResponse, String> {
    let settings = load_app_settings(&app)?;

    Ok(ShortcutResponse {
        global_shortcut: settings.global_shortcut,
        hide_dock_icon: settings.hide_dock_icon,
        launch_at_login: settings.launch_at_login,
    })
}

#[tauri::command]
fn save_shortcut_settings(
    app: tauri::AppHandle,
    settings: SaveShortcutRequest,
) -> Result<(), String> {
    let shortcut = settings.global_shortcut.trim();
    if shortcut.is_empty() {
        return Err("快捷键不能为空".to_string());
    }

    register_global_shortcut(&app, shortcut)?;
    apply_dock_visibility(&app, settings.hide_dock_icon)?;
    apply_autostart(&app, settings.launch_at_login)?;
    let current = load_app_settings(&app)?;
    save_app_settings(
        &app,
        &AppSettings {
            global_shortcut: shortcut.to_string(),
            prompt: current.prompt,
            hide_dock_icon: settings.hide_dock_icon,
            launch_at_login: settings.launch_at_login,
        },
    )
}

#[tauri::command]
fn get_prompt_settings(app: tauri::AppHandle) -> Result<PromptResponse, String> {
    let settings = load_app_settings(&app)?;

    Ok(PromptResponse {
        prompt: settings.prompt,
    })
}

#[tauri::command]
fn save_prompt_settings(app: tauri::AppHandle, settings: SavePromptRequest) -> Result<(), String> {
    let current = load_app_settings(&app)?;
    save_app_settings(
        &app,
        &AppSettings {
            global_shortcut: current.global_shortcut,
            prompt: settings.prompt.trim().to_string(),
            hide_dock_icon: current.hide_dock_icon,
            launch_at_login: current.launch_at_login,
        },
    )
}

#[tauri::command]
fn resize_main_window(app: tauri::AppHandle, height: f64) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "找不到主窗口".to_string())?;
    let height = height.clamp(140.0, 760.0);

    window
        .set_size(tauri::LogicalSize::new(640.0, height))
        .map_err(|error| format!("调整窗口大小失败: {error}"))
}

#[tauri::command]
fn close_current_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.close().map_err(|error| format!("关闭窗口失败: {error}"))
}

#[tauri::command]
fn hide_main_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "找不到主窗口".to_string())?;

    window.hide().map_err(|error| format!("隐藏主窗口失败: {error}"))
}

#[tauri::command]
fn open_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("settings") {
        window.show().map_err(|error| format!("显示设置窗口失败: {error}"))?;
        window.set_focus().map_err(|error| format!("聚焦设置窗口失败: {error}"))?;
        return Ok(());
    }

    tauri::WebviewWindowBuilder::new(
        &app,
        "settings",
        tauri::WebviewUrl::App("index.html#settings".into()),
    )
    .title("设置")
    .inner_size(520.0, 420.0)
    .resizable(false)
    .decorations(true)
    .center()
    .build()
    .map_err(|error| format!("创建设置窗口失败: {error}"))?;

    Ok(())
}

pub fn run() {
    let default_panic_hook = panic::take_hook();
    panic::set_hook(Box::new(move |info| {
        default_panic_hook(info);

        let message = format!(
            "time: {:?}\npanic: {info}\nbacktrace:\n{}\n\n",
            SystemTime::now(),
            std::backtrace::Backtrace::force_capture()
        );
        let mut paths = vec![std::env::temp_dir().join("chat-tool-panic.log")];

        if let Ok(current_dir) = std::env::current_dir() {
            paths.push(current_dir.join("chat-tool-panic.log"));
            paths.push(current_dir.join("..").join("chat-tool-panic.log"));
        }

        for path in paths {
            if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
                let _ = file.write_all(message.as_bytes());
            }
        }
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Chat Tool")
            .inner_size(640.0, 140.0)
            .resizable(true)
            .decorations(false)
            .transparent(true)
            .center()
            .build()
            .map_err(|error| {
                eprintln!("创建主窗口失败: {error}");
                error
            })?;

            let settings = load_app_settings(app.handle())?;
            register_global_shortcut(app.handle(), &settings.global_shortcut)?;
            apply_dock_visibility(app.handle(), settings.hide_dock_icon)?;
            apply_autostart(app.handle(), settings.launch_at_login)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ask_question,
            get_config,
            save_config,
            get_shortcut_settings,
            save_shortcut_settings,
            get_prompt_settings,
            save_prompt_settings,
            resize_main_window,
            close_current_window,
            hide_main_window,
            open_settings_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
