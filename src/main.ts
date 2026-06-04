import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import katex from "katex";
import "katex/dist/katex.min.css";
import "./styles.css";

const chatView = document.querySelector<HTMLElement>("#chat-view");
const settingsView = document.querySelector<HTMLElement>("#settings-view");
const apiSettingsPage = document.querySelector<HTMLElement>("#api-settings-page");
const shortcutSettingsPage = document.querySelector<HTMLElement>("#shortcut-settings-page");
const promptSettingsPage = document.querySelector<HTMLElement>("#prompt-settings-page");
const appearanceSettingsPage = document.querySelector<HTMLElement>(
  "#appearance-settings-page",
);
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
const appearancePageButton = document.querySelector<HTMLButtonElement>(
  "#appearance-page-button",
);
const apiSettingsCancel = document.querySelector<HTMLButtonElement>("#api-settings-cancel");
const shortcutSettingsCancel = document.querySelector<HTMLButtonElement>(
  "#shortcut-settings-cancel",
);
const promptSettingsCancel = document.querySelector<HTMLButtonElement>("#prompt-settings-cancel");
const appearanceSettingsCancel = document.querySelector<HTMLButtonElement>(
  "#appearance-settings-cancel",
);
const apiSettingsForm = document.querySelector<HTMLFormElement>("#api-settings-form");
const shortcutSettingsForm = document.querySelector<HTMLFormElement>(
  "#shortcut-settings-form",
);
const promptSettingsForm = document.querySelector<HTMLFormElement>("#prompt-settings-form");
const appearanceSettingsForm = document.querySelector<HTMLFormElement>(
  "#appearance-settings-form",
);
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
const windowWidthInput = document.querySelector<HTMLInputElement>("#window-width-input");
const answerMaxHeightInput = document.querySelector<HTMLInputElement>(
  "#answer-max-height-input",
);
const apiSettingsStatus = document.querySelector<HTMLElement>("#api-settings-status");
const shortcutSettingsStatus = document.querySelector<HTMLElement>(
  "#shortcut-settings-status",
);
const promptSettingsStatus = document.querySelector<HTMLElement>("#prompt-settings-status");
const appearanceSettingsStatus = document.querySelector<HTMLElement>(
  "#appearance-settings-status",
);

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

type AppearanceResponse = {
  window_width: number;
  answer_max_height: number;
};

let currentAppearance: AppearanceResponse = {
  window_width: 720,
  answer_max_height: 520,
};

function clampNumber(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

function applyAppearance(settings: AppearanceResponse) {
  currentAppearance = {
    window_width: clampNumber(settings.window_width, 480, 980, 720),
    answer_max_height: clampNumber(settings.answer_max_height, 240, 1400, 520),
  };

  document.documentElement.style.setProperty(
    "--app-width",
    `${currentAppearance.window_width}px`,
  );
  document.documentElement.style.setProperty(
    "--answer-max-height",
    `${currentAppearance.answer_max_height}px`,
  );
  resizeWindow();
}

function focusQuestionInput() {
  if (isSettingsWindow || !input) return;

  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderInlineMarkdown(value: string) {
  let html = escapeHtml(value);

  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
  );
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  return html;
}

function renderMathExpression(expression: string, displayMode: boolean) {
  try {
    return katex.renderToString(expression.trim(), {
      displayMode,
      throwOnError: false,
      strict: false,
    });
  } catch {
    return escapeHtml(expression);
  }
}

function renderInlineContent(value: string) {
  const parts: string[] = [];
  const pattern = /(\\\((.+?)\\\)|\$(.+?)\$)/gs;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    parts.push(renderInlineMarkdown(value.slice(lastIndex, match.index)));
    parts.push(renderMathExpression(match[2] ?? match[3] ?? "", false));
    lastIndex = pattern.lastIndex;
  }

  parts.push(renderInlineMarkdown(value.slice(lastIndex)));
  return parts.join("");
}

function renderMarkdown(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let codeLines: string[] = [];
  let inCodeBlock = false;

  function flushParagraph() {
    if (paragraph.length === 0) return;
    html.push(`<p>${renderInlineContent(paragraph.join(" "))}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (listItems.length === 0) return;
    html.push(`<ul>${listItems.map((item) => `<li>${item}</li>`).join("")}</ul>`);
    listItems = [];
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        inCodeBlock = false;
      } else {
        flushParagraph();
        flushList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (trimmed.startsWith("$$")) {
      flushParagraph();
      flushList();
      const mathLines: string[] = [];
      let current = trimmed.slice(2);
      let closed = false;

      if (current.endsWith("$$") && current.length > 2) {
        mathLines.push(current.slice(0, -2));
        closed = true;
      } else {
        if (current) mathLines.push(current);
        while (index + 1 < lines.length) {
          index += 1;
          const nextLine = lines[index];
          const nextTrimmed = nextLine.trim();
          if (nextTrimmed.endsWith("$$")) {
            mathLines.push(nextLine.slice(0, nextLine.lastIndexOf("$$")));
            closed = true;
            break;
          }
          mathLines.push(nextLine);
        }
      }

      if (closed) {
        html.push(
          `<div class="math-block">${renderMathExpression(mathLines.join("\n"), true)}</div>`,
        );
      } else {
        paragraph.push(trimmed);
      }
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length + 2;
      html.push(`<h${level}>${renderInlineContent(heading[2])}</h${level}>`);
      continue;
    }

    const listItem = trimmed.match(/^[-*]\s+(.+)$/);
    if (listItem) {
      flushParagraph();
      listItems.push(renderInlineContent(listItem[1]));
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  if (inCodeBlock) {
    html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }
  flushParagraph();
  flushList();

  return html.join("");
}

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
      currentAppearance.answer_max_height + 220,
    );
    void invoke("resize_main_window", { height });
  });
}

function centerWindowOnAnswer() {
  if (isSettingsWindow || !panel || panel.hidden) return;

  requestAnimationFrame(() => {
    const rect = panel.getBoundingClientRect();
    const answerCenterY = rect.top + rect.height / 2;
    void invoke("center_main_window_on_answer", {
      answerCenterY,
    });
  });
}

function setPanelState(question: string, status: string, answer = "") {
  if (!panel || !questionText || !statusText || !answerText) return;

  panel.hidden = false;
  questionText.textContent = question;
  statusText.textContent = status;
  answerText.innerHTML = answer ? renderMarkdown(answer) : "";
  resizeWindow();
  if (answer) {
    window.setTimeout(centerWindowOnAnswer, 80);
  }
}

function showSettingsPage(page: "api" | "shortcut" | "prompt" | "appearance") {
  if (apiSettingsPage) apiSettingsPage.hidden = page !== "api";
  if (shortcutSettingsPage) shortcutSettingsPage.hidden = page !== "shortcut";
  if (promptSettingsPage) promptSettingsPage.hidden = page !== "prompt";
  if (appearanceSettingsPage) appearanceSettingsPage.hidden = page !== "appearance";
  apiPageButton?.classList.toggle("is-active", page === "api");
  shortcutPageButton?.classList.toggle("is-active", page === "shortcut");
  promptPageButton?.classList.toggle("is-active", page === "prompt");
  appearancePageButton?.classList.toggle("is-active", page === "appearance");

  if (page === "api") apiKeyInput?.focus();
  if (page === "shortcut") globalShortcutInput?.focus();
  if (page === "prompt") promptInput?.focus();
  if (page === "appearance") windowWidthInput?.focus();
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

async function loadAppearanceSettings() {
  if (appearanceSettingsStatus) appearanceSettingsStatus.textContent = "";

  try {
    const settings = await invoke<AppearanceResponse>("get_appearance_settings");
    applyAppearance(settings);
  } catch {
    applyAppearance({ window_width: 720, answer_max_height: 520 });
  }

  if (windowWidthInput && answerMaxHeightInput) {
    windowWidthInput.value = String(currentAppearance.window_width);
    answerMaxHeightInput.value = String(currentAppearance.answer_max_height);
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

appearancePageButton?.addEventListener("click", () => {
  showSettingsPage("appearance");
});

apiSettingsCancel?.addEventListener("click", closeWindow);
shortcutSettingsCancel?.addEventListener("click", closeWindow);
promptSettingsCancel?.addEventListener("click", closeWindow);
appearanceSettingsCancel?.addEventListener("click", closeWindow);

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

appearanceSettingsForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!windowWidthInput || !answerMaxHeightInput || !appearanceSettingsStatus) return;

  const settings = {
    window_width: clampNumber(Number(windowWidthInput.value), 480, 980, 720),
    answer_max_height: clampNumber(Number(answerMaxHeightInput.value), 240, 1400, 520),
  };

  appearanceSettingsStatus.textContent = "保存中...";

  try {
    await invoke("save_appearance_settings", { settings });
    applyAppearance(settings);
    windowWidthInput.value = String(currentAppearance.window_width);
    answerMaxHeightInput.value = String(currentAppearance.answer_max_height);
    appearanceSettingsStatus.textContent = "已保存";
    setTimeout(closeWindow, 250);
  } catch (error) {
    appearanceSettingsStatus.textContent = String(error);
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
    void loadAppearanceSettings();
    showSettingsPage("api");
    return;
  }

  void loadAppearanceSettings();
  void listen("main-window-shown", focusQuestionInput);
  focusQuestionInput();
  resizeWindow();
});
