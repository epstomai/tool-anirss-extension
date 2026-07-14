/* global AniRssApi */
/**
 * 所有对 Ani-RSS（内网 IP）的请求必须在这里发起。
 * content script 在 https 蜜柑页无法稳定访问 192.168.x。
 */
try {
  importScripts("lib/shared.js");
} catch (e) {
  console.error("[Ani-RSS] importScripts failed", e);
}

function notify(title, message) {
  try {
    if (!chrome?.notifications?.create) return;
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: title || "Ani-RSS",
      message: String(message || "").slice(0, 200),
    });
  } catch {
    /* ignore */
  }
}

function keepAliveWhile(promise) {
  const timer = setInterval(() => {
    try {
      chrome.storage.local.set({ __anirss_ka: Date.now() });
    } catch {
      /* ignore */
    }
  }, 15000);
  return Promise.resolve(promise).finally(() => clearInterval(timer));
}

// 保证 SW 注册成功（扩展页 Errors 常因启动抛错）
self.addEventListener("install", () => {
  // no-op
});
self.addEventListener("activate", () => {
  // no-op
});

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const reply = (payload) => {
      try {
        sendResponse(payload);
      } catch {
        /* port closed */
      }
    };

    (async () => {
      try {
        if (!globalThis.AniRssApi) {
          throw new Error("后台 API 未加载，请重新加载扩展");
        }
        if (!message || !message.type) {
          throw new Error("未知消息");
        }

        if (message.type === "PING_EXT") {
          reply({ ok: true, data: { alive: true, v: chrome.runtime.getManifest?.()?.version } });
          return;
        }

        if (message.type === "GET_SETTINGS") {
          reply({ ok: true, data: await AniRssApi.getSettings() });
          return;
        }

        if (message.type === "SAVE_SETTINGS") {
          reply({
            ok: true,
            data: await AniRssApi.saveSettings(message.payload || {}),
          });
          return;
        }

        if (message.type === "TEST_CONNECTION") {
          const base = await AniRssApi.getSettings();
          const settings = message.payload
            ? { ...base, ...message.payload }
            : base;
          const result = await keepAliveWhile(
            AniRssApi.testConnection(settings)
          );
          reply({ ok: true, data: result });
          return;
        }

        if (message.type === "SUBSCRIBE") {
          const settings = await AniRssApi.getSettings();
          if (!settings.baseUrl) {
            throw new Error("请先在插件弹窗中配置 Ani-RSS 地址");
          }
          const ani = await keepAliveWhile(
            AniRssApi.subscribeMikan(settings, message.payload || {})
          );
          if (settings.notify !== false) {
            notify(
              "已添加到 Ani-RSS",
              `${ani.title || "订阅"}${ani.subgroup ? " / " + ani.subgroup : ""}`
            );
          }
          reply({
            ok: true,
            data: {
              title: ani.title,
              subgroup: ani.subgroup,
              season: ani.season,
              url: ani.url,
              id: ani.id,
            },
          });
          return;
        }

        throw new Error(`未知消息类型: ${message.type}`);
      } catch (e) {
        reply({ ok: false, error: e?.message || String(e) });
      }
    })();

    return true; // async response
  });
} else {
  console.error("[Ani-RSS] chrome.runtime.onMessage unavailable");
}
