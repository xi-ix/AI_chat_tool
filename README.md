# Chat Tool

一个极简 macOS 桌面问答工具。主窗口是无边框浮窗，输入问题回车后调用兼容 OpenAI 的 `/chat/completions` 接口，并显示问题和回答。

## 功能

- Tauri 桌面应用
- 原生 HTML/CSS/TypeScript 前端
- 兼容 OpenAI API 的问答请求
- 全局快捷键唤出主窗口
- `Esc` 隐藏主窗口
- 独立设置窗口
- API、快捷键、Prompt 设置
- 隐藏 Dock 图标
- 开机自启
- macOS 无边框透明主窗口

## 环境准备

当前项目主要面向 macOS。先安装 Xcode Command Line Tools：

```bash
xcode-select --install
```

如果提示已经安装，可以继续下一步。

安装 Homebrew 后，用它安装 Node.js：

```bash
brew install node
```

确认 Node.js 和 npm 可用：

```bash
node --version
npm --version
```

安装 Rust：

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

安装过程中选择默认安装。安装完成后刷新当前终端环境：

```bash
source "$HOME/.cargo/env"
```

确认 Rust 可用：

```bash
rustc --version
cargo --version
```

## 安装项目依赖

进入项目目录：

```bash
cd /Users/wangzhe/Documents/file/chat_tool
```

安装前端依赖：

```bash
npm install
```

拉取 Rust 依赖：

```bash
cargo fetch --manifest-path src-tauri/Cargo.toml
```

如果遇到 crates.io 网络错误，可以稍后重试。

## 配置 API

开发模式会优先读取项目根目录里的 `config.json`。复制示例配置：

```bash
cp config.example.json config.json
```

编辑 `config.json`：

```json
{
  "api_key": "sk-your-api-key",
  "base_url": "https://api.openai.com/v1",
  "model": "gpt-4o-mini"
}
```

如果使用 DeepSeek 一类兼容 OpenAI 的接口，可以改成对应的 `base_url` 和 `model`。

正式应用会读取系统应用配置目录里的 `config.json`，macOS 默认类似：

```text
~/Library/Application Support/com.local.chat-tool/config.json
```

快捷键、Prompt、隐藏 Dock 图标、开机自启会保存到 `app-settings.json`。开发模式也会优先读取项目根目录里的 `app-settings.json`。可选复制示例：

```bash
cp app-settings.example.json app-settings.json
```

示例内容：

```json
{
  "global_shortcut": "CommandOrControl+Shift+Space",
  "prompt": "",
  "hide_dock_icon": false,
  "launch_at_login": false
}
```

这些设置也可以直接在应用的设置窗口里修改。

## 运行

启动桌面应用：

```bash
npm run tauri:dev
```

只启动前端预览：

```bash
npm run dev
```

构建前端：

```bash
npm run build
```

检查 Rust/Tauri：

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

打包应用：

```bash
npm run tauri:build
```

## 常见问题

如果提示 `npm: command not found`，说明 Node.js 没装好：

```bash
brew install node
```

如果提示 `cargo` 或 `rustc` 找不到，说明 Rust 没装好，或终端环境没刷新：

```bash
source "$HOME/.cargo/env"
```

如果提示端口 `1420` 被占用，先关闭旧的开发进程，或在旧终端里按 `Ctrl+C`。

如果主窗口隐藏了，可以用全局快捷键唤出。默认快捷键：

```text
CommandOrControl+Shift+Space
```

## 注意

macOS 无边框透明主窗口启用了 Tauri 的 `macos-private-api` feature。开发和自用打包可以先保留；如果后续要上架 Mac App Store，需要重新评估。

## 后续待补

- 菜单栏入口
- 历史记录本地数据库
- Windows 验证和打包
# AI_chat_tool
