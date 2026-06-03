import { invoke } from "@tauri-apps/api/core";
import "./styles.css";

const chatView = document.querySelector<HTMLElement>("#chat-view");
const settingsView = document.querySelector<HTMLElement>("#settings-view");
const apiSettingsPage = document.querySelector<HTMLElement>("#api-settings-page");
const shortcutSettingsPage = document.querySelector<HTMLElement>("#shortcut-settings-page");
const promptSettingsPage = document.querySelector<HTMLElement>("#prompt-settings-page");
const form = document.querySelector<HTMLFormElement>("#ask-form");
const input = document.querySelector<HTMLInputElement>("#question-input");
const panel = document.querySelector<HTMLElement>("#answer-panel");
const questionText = document.querySelector<HTMLElement>("#question-text");
const statusText = document.querySelector<HTMLElement>("#status-text");
const answerText = document.querySelector<HTMLElement>("#answer-text");
const settingsButton = document.querySelector<HTMLButtonElement>("#settings-button");
const apiPageButton = document.querySelector<HTMLButtonElement>("#api-page-button");
const shortcutPageButton = document.querySelector<HTMLButtonElement>("#shortcut-page-button");
const promptPageButton = document.querySelector<HTMLButtonElement>("#prompt-page-button");
const apiSettingsCancel = document.querySelector<HTMLButtonElement>("#api-settings-cancel");
const shortcutSettingsCancel = document.querySelector<HTMLButtonElement>(
  "#shortcut-settings-cancel",
);
const promptSettingsCancel = document.querySelector<HTMLButtonElement>("#prompt-settings-cancel");
const apiSettingsForm = document.querySelector<HTMLFormElement>("#api-settings-form");
const shortcutSettingsForm = document.querySelector<HTMLFormElement>(
  "#shortcut-settings-form",
);
const promptSettingsForm = document.querySelector<HTMLFormElement>("#prompt-settings-form");
const apiKeyInput = document.querySelector<HTMLInputElement>("#api-key-input");
const baseUrlInput = document.querySelector<HTMLInputElement>("#base-url-input");
const modelInput = document.querySelector<HTMLInputElement>("#model-input");
const globalShortcutInput = document.querySelector<HTMLInputElement>(
  "#global-shortcut-input",
);
const hideDockIconInput = document.querySelector<HTMLInputElement>("#hide-dock-icon-input");
const launchAtLoginInput = document.querySelector<HTMLInputElement>("#launch-at-login-input");
const showMenuBarIconInput = document.querySelector<HTMLInputElement>(
  "#show-menu-bar-icon-input",
);
const promptInput = document.querySelector<HTMLTextAreaElement>("#prompt-input");
const apiSettingsStatus = document.querySelector<HTMLElement>("#api-settings-status");
const shortcutSettingsStatus = document.querySelector<HTMLElement>(
  "#shortcut-settings-status",
);
const promptSettingsStatus = document.querySelector<HTMLElement>("#prompt-settings-status");

const isSettingsWindow = window.location.hash === "#settings";

type AskResponse = {
  answer: string;
};

type ConfigResponse = {
  api_key_set: boolean;
  base_url: string;
  model: string;
};

type ShortcutResponse = {
  global_shortcut: string;
  hide_dock_icon: boolean;
  launch_at_login: boolean;
  show_menu_bar_icon: boolean;
};

type PromptResponse = {
  prompt: string;
};

function closeWindow() {
  void invoke("close_current_window");
}

function hideMainWindow() {
  void invoke("hide_main_window");
}

function resizeWindow() {
  if (isSettingsWindow) return;

  requestAnimationFrame(() => {
    const height = Math.min(
      Math.max(document.documentElement.scrollHeight + 12, 140),
      760,
    );
    void invoke("resize_main_window", { height });
  });
}

function setPanelState(question: string, status: string, answer = "") {
  if (!panel || !questionText || !statusText || !answerText) return;

  panel.hidden = false;
  questionText.textContent = question;
  statusText.textContent = status;
  answerText.textContent = answer;
  resizeWindow();
}

function showSettingsPage(page: "api" | "shortcut" | "prompt") {
  if (apiSettingsPage) apiSettingsPage.hidden = page !== "api";
  if (shortcutSettingsPage) shortcutSettingsPage.hidden = page !== "shortcut";
  if (promptSettingsPage) promptSettingsPage.hidden = page !== "prompt";
  apiPageButton?.classList.toggle("is-active", page === "api");
  shortcutPageButton?.classList.toggle("is-active", page === "shortcut");
  promptPageButton?.classList.toggle("is-active", page === "prompt");

  if (page === "api") apiKeyInput?.focus();
  if (page === "shortcut") globalShortcutInput?.focus();
  if (page === "prompt") promptInput?.focus();
}

async function loadApiSettings() {
  if (!apiKeyInput || !baseUrlInput || !modelInput) return;

  if (apiSettingsStatus) apiSettingsStatus.textContent = "";
  apiKeyInput.value = "";

  try {
    const config = await invoke<ConfigResponse>("get_config");
    apiKeyInput.placeholder = config.api_key_set ? "已保存，重新输入可替换" : "sk-...";
    baseUrlInput.value = config.base_url;
    modelInput.value = config.model;
  } catch {
    apiKeyInput.placeholder = "sk-...";
    baseUrlInput.value = "https://api.openai.com/v1";
    modelInput.value = "gpt-4o-mini";
  }
}

async function loadShortcutSettings() {
  if (
    !globalShortcutInput ||
    !hideDockIconInput ||
    !launchAtLoginInput ||
    !showMenuBarIconInput
  ) {
    return;
  }

  if (shortcutSettingsStatus) shortcutSettingsStatus.textContent = "";

  try {
    const settings = await invoke<ShortcutResponse>("get_shortcut_settings");
    globalShortcutInput.value = settings.global_shortcut;
    hideDockIconInput.checked = settings.hide_dock_icon;
    launchAtLoginInput.checked = settings.launch_at_login;
    showMenuBarIconInput.checked = settings.show_menu_bar_icon;
  } catch {
    globalShortcutInput.value = "CommandOrControl+Shift+Space";
    hideDockIconInput.checked = false;
    launchAtLoginInput.checked = false;
    showMenuBarIconInput.checked = false;
  }
}

async function loadPromptSettings() {
  if (!promptInput) return;

  if (promptSettingsStatus) promptSettingsStatus.textContent = "";

  try {
    const settings = await invoke<PromptResponse>("get_prompt_settings");
    promptInput.value = settings.prompt;
  } catch {
    promptInput.value = "";
  }
}

settingsButton?.addEventListener("click", () => {
  void invoke("open_settings_window");
});

apiPageButton?.addEventListener("click", () => {
  showSettingsPage("api");
});

shortcutPageButton?.addEventListener("click", () => {
  showSettingsPage("shortcut");
});

promptPageButton?.addEventListener("click", () => {
  showSettingsPage("prompt");
});

apiSettingsCancel?.addEventListener("click", closeWindow);
shortcutSettingsCancel?.addEventListener("click", closeWindow);
promptSettingsCancel?.addEventListener("click", closeWindow);

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;

  event.preventDefault();
  if (isSettingsWindow) {
    closeWindow();
  } else {
    hideMainWindow();
  }
});

apiSettingsForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!apiKeyInput || !baseUrlInput || !modelInput || !apiSettingsStatus) return;

  apiSettingsStatus.textContent = "保存中...";

  try {
    await invoke("save_config", {
      config: {
        api_key: apiKeyInput.value,
        base_url: baseUrlInput.value,
        model: modelInput.value,
      },
    });
    apiSettingsStatus.textContent = "已保存";
    setTimeout(closeWindow, 250);
  } catch (error) {
    apiSettingsStatus.textContent = String(error);
  }
});

shortcutSettingsForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (
    !globalShortcutInput ||
    !hideDockIconInput ||
    !launchAtLoginInput ||
    !showMenuBarIconInput ||
    !shortcutSettingsStatus
  ) {
    return;
  }

  shortcutSettingsStatus.textContent = "保存中...";

  try {
    await invoke("save_shortcut_settings", {
      settings: {
        global_shortcut: globalShortcutInput.value,
        hide_dock_icon: hideDockIconInput.checked,
        launch_at_login: launchAtLoginInput.checked,
        show_menu_bar_icon: showMenuBarIconInput.checked,
      },
    });
    shortcutSettingsStatus.textContent = "已保存";
    setTimeout(closeWindow, 250);
  } catch (error) {
    shortcutSettingsStatus.textContent = String(error);
  }
});

promptSettingsForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!promptInput || !promptSettingsStatus) return;

  promptSettingsStatus.textContent = "保存中...";

  try {
    await invoke("save_prompt_settings", {
      settings: {
        prompt: promptInput.value,
      },
    });
    promptSettingsStatus.textContent = "已保存";
    setTimeout(closeWindow, 250);
  } catch (error) {
    promptSettingsStatus.textContent = String(error);
  }
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const question = input?.value.trim();
  if (!question) return;

  if (input) input.value = "";
  setPanelState(question, "思考中...");

  try {
    const response = await invoke<AskResponse>("ask_question", { question });
    setPanelState(question, "", response.answer);
  } catch (error) {
    setPanelState(question, "请求失败", String(error));
  }
});

window.addEventListener("DOMContentLoaded", () => {
  chatView && (chatView.hidden = isSettingsWindow);
  settingsView && (settingsView.hidden = !isSettingsWindow);

  if (isSettingsWindow) {
    void loadApiSettings();
    void loadShortcutSettings();
    void loadPromptSettings();
    showSettingsPage("api");
    return;
  }

  input?.focus();
  resizeWindow();
});
