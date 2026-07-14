import { md5 } from "./md5.js";

export const DEFAULT_SETTINGS = {
  baseUrl: "http://192.168.233.7:17789",
  username: "admin",
  password: "",
  apiKey: "",
  authToken: "",
  enable: true,
  downloadNew: false,
  rewriteRssHost: "",
  notify: true,
};

export async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(partial) {
  await chrome.storage.sync.set(partial);
  return getSettings();
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").trim().replace(/\/+$/, "");
}

function buildUrl(baseUrl, path, query = {}) {
  const url = new URL(normalizeBaseUrl(baseUrl) + "/" + path.replace(/^\//, ""));
  for (const [k, v] of Object.entries(query)) {
    if (v != null && v !== "") url.searchParams.set(k, v);
  }
  return url.toString();
}

function rewriteRssUrl(rssUrl, rewriteHost) {
  if (!rewriteHost) return rssUrl;
  try {
    const u = new URL(rssUrl);
    const host = rewriteHost.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (host.includes("/")) {
      // full origin like https://mikanani.me
      const origin = rewriteHost.startsWith("http") ? rewriteHost.replace(/\/+$/, "") : `https://${host}`;
      const target = new URL(origin);
      u.protocol = target.protocol;
      u.host = target.host;
    } else {
      u.host = host;
    }
    return u.toString();
  } catch {
    return rssUrl;
  }
}

async function requestJson(settings, path, { method = "POST", body, query, auth } = {}) {
  const headers = {
    Accept: "application/json",
  };
  if (body != null) headers["Content-Type"] = "application/json";

  const token = auth ?? settings.authToken;
  if (token) headers["Authorization"] = token;
  if (settings.apiKey) {
    headers["x-api-key"] = settings.apiKey;
    headers["api-key"] = settings.apiKey;
  }

  const url = buildUrl(settings.baseUrl, path, {
    ...(settings.apiKey ? { s: settings.apiKey, "api-key": settings.apiKey } : {}),
    ...(query || {}),
  });

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error(`无法连接 Ani-RSS（${settings.baseUrl}）：${e.message}`);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Ani-RSS 返回非 JSON（HTTP ${res.status}）`);
  }

  return { httpStatus: res.status, data };
}

export async function ping(settings) {
  const { data } = await requestJson(settings, "api/ping", { method: "GET" });
  if (data?.code >= 200 && data?.code < 300) return true;
  throw new Error(data?.message || "Ping 失败");
}

export async function login(settings) {
  if (!settings.username || !settings.password) {
    throw new Error("请先填写用户名和密码");
  }
  const passwordHash = md5(settings.password);
  const { data } = await requestJson(settings, "api/login", {
    body: {
      username: settings.username,
      password: passwordHash,
    },
    auth: "",
  });
  if (!(data?.code >= 200 && data?.code < 300) || !data?.data) {
    throw new Error(data?.message || "登录失败");
  }
  const token = data.data;
  await saveSettings({ authToken: token });
  return token;
}

async function withAuth(settings, fn) {
  let current = settings;
  let result = await fn(current);
  if (result?.data?.code === 403 && current.username && current.password) {
    const token = await login(current);
    current = { ...current, authToken: token };
    result = await fn(current);
  }
  return result;
}

export async function rssToAni(settings, { url, type = "mikan", subgroup, bgmUrl, enable }) {
  const body = {
    url,
    type,
    enable: enable ?? settings.enable ?? true,
  };

  // Ani-RSS mikan 分支逻辑（AniUtil.getAni）：
  // - subgroup 与 bgmUrl 都为空 → 根据 RSS URL 自动抓蜜柑信息（含 bgmUrl）
  // - 任一有值 → 直接 set，不再抓取；若只有 subgroup 没有 bgmUrl 会报「bgmUrl 不能为空」
  // 首页只有字幕组名、没有 BGM 链接，因此绝不能单独传 subgroup。
  const hasBgm = !!(bgmUrl && String(bgmUrl).trim());
  if (hasBgm) {
    body.bgmUrl = String(bgmUrl).trim();
    if (subgroup && String(subgroup).trim()) {
      body.subgroup = String(subgroup).trim();
    }
  }

  const { data } = await withAuth(settings, (s) =>
    requestJson(s, "api/rssToAni", { body })
  );
  if (!(data?.code >= 200 && data?.code < 300) || !data?.data) {
    throw new Error(data?.message || "RSS 解析失败");
  }
  return data.data;
}

export async function addAni(settings, ani) {
  const { data } = await withAuth(settings, (s) =>
    requestJson(s, "api/addAni", { body: ani })
  );
  if (!(data?.code >= 200 && data?.code < 300)) {
    throw new Error(data?.message || "添加订阅失败");
  }
  return data;
}

export async function listAni(settings) {
  const { data } = await withAuth(settings, (s) =>
    requestJson(s, "api/listAni", { body: {} })
  );
  if (!(data?.code >= 200 && data?.code < 300)) {
    throw new Error(data?.message || "获取订阅列表失败");
  }
  return data.data;
}

/**
 * Subscribe a Mikan RSS feed into Ani-RSS.
 */
export async function subscribeMikan(settings, payload) {
  let rssUrl = payload.rssUrl;
  if (!rssUrl) throw new Error("缺少 RSS 地址");

  rssUrl = rewriteRssUrl(rssUrl, settings.rewriteRssHost);

  const pageBgm = (payload.bgmUrl || "").trim();
  const pageSubgroup = (payload.subgroup || "").trim();

  const ani = await rssToAni(settings, {
    url: rssUrl,
    type: "mikan",
    // 仅在同时有 bgmUrl 时才把页面字幕组名带给 rssToAni
    subgroup: pageBgm ? pageSubgroup : "",
    bgmUrl: pageBgm,
    enable: settings.enable,
  });

  if (typeof settings.downloadNew === "boolean") {
    ani.downloadNew = settings.downloadNew;
  }
  if (typeof settings.enable === "boolean") {
    ani.enable = settings.enable;
  }

  // 自动抓取后若字幕组名仍空，再用页面上的名称补全（不影响 bgmUrl）
  if (pageSubgroup && !ani.subgroup) {
    ani.subgroup = pageSubgroup;
  }

  await addAni(settings, ani);
  return ani;
}

export async function testConnection(settings) {
  await ping(settings);
  // Prefer API key / existing token; fall back to login when credentials exist.
  if (settings.apiKey) {
    await listAni(settings);
    return { mode: "apiKey" };
  }
  if (settings.username && settings.password) {
    await login(settings);
    await listAni(await getSettings());
    return { mode: "login" };
  }
  // IP whitelist / no auth
  await listAni(settings);
  return { mode: "open" };
}
