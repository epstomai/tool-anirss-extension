/* global AniRssApi */
const $ = (id) => document.getElementById(id);

function setStatus(text, kind) {
  const el = $("status");
  el.hidden = !text;
  el.textContent = text || "";
  el.className = `status${kind ? " " + kind : ""}`;
}

function readForm() {
  return {
    baseUrl: $("baseUrl").value.trim().replace(/\/+$/, ""),
    username: $("username").value.trim(),
    password: $("password").value,
    apiKey: $("apiKey").value.trim(),
    rewriteRssHost: $("rewriteRssHost").value.trim(),
    enable: $("enable").checked,
    downloadNew: $("downloadNew").checked,
    notify: $("notify").checked,
  };
}

function fillForm(settings) {
  $("baseUrl").value = settings.baseUrl || "";
  $("username").value = settings.username || "";
  $("password").value = settings.password || "";
  $("apiKey").value = settings.apiKey || "";
  $("rewriteRssHost").value = settings.rewriteRssHost || "";
  $("enable").checked = settings.enable !== false;
  $("downloadNew").checked = !!settings.downloadNew;
  $("notify").checked = settings.notify !== false;
}

async function load() {
  try {
    const settings = await AniRssApi.getSettings();
    fillForm(settings);
  } catch (e) {
    setStatus(e?.message || "读取设置失败", "err");
  }
}

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = readForm();
  if (!payload.baseUrl) {
    setStatus("请填写 Ani-RSS 地址", "err");
    return;
  }
  $("saveBtn").disabled = true;
  try {
    await AniRssApi.saveSettings(payload);
    setStatus("已保存", "ok");
  } catch (err) {
    setStatus(err?.message || "保存失败", "err");
  } finally {
    $("saveBtn").disabled = false;
  }
});

$("testBtn").addEventListener("click", async () => {
  const payload = readForm();
  if (!payload.baseUrl) {
    setStatus("请填写 Ani-RSS 地址", "err");
    return;
  }
  $("testBtn").disabled = true;
  $("saveBtn").disabled = true;
  setStatus("测试中…");
  try {
    await AniRssApi.saveSettings(payload);
    const settings = await AniRssApi.getSettings();
    const result = await AniRssApi.testConnection(settings);
    const map = {
      apiKey: "API Key 鉴权成功",
      login: "登录鉴权成功",
      open: "连接成功（IP 白名单 / 免登录）",
    };
    setStatus(map[result.mode] || "连接成功", "ok");
  } catch (err) {
    setStatus(err?.message || "连接失败", "err");
  } finally {
    $("testBtn").disabled = false;
    $("saveBtn").disabled = false;
  }
});

load();
