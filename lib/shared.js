/**
 * Shared Ani-RSS client for background / content / popup (classic script, no ES modules).
 * Attaches API to globalThis.AniRssApi
 */
(() => {
  "use strict";

  function md5(string) {
    function cmn(q, a, b, x, s, t) {
      a = add32(add32(a, q), add32(x, t));
      return add32((a << s) | (a >>> (32 - s)), b);
    }
    function ff(a, b, c, d, x, s, t) {
      return cmn((b & c) | (~b & d), a, b, x, s, t);
    }
    function gg(a, b, c, d, x, s, t) {
      return cmn((b & d) | (c & ~d), a, b, x, s, t);
    }
    function hh(a, b, c, d, x, s, t) {
      return cmn(b ^ c ^ d, a, b, x, s, t);
    }
    function ii(a, b, c, d, x, s, t) {
      return cmn(c ^ (b | ~d), a, b, x, s, t);
    }
    function md5cycle(x, k) {
      let [a, b, c, d] = x;
      a = ff(a, b, c, d, k[0], 7, -680876936);
      d = ff(d, a, b, c, k[1], 12, -389564586);
      c = ff(c, d, a, b, k[2], 17, 606105819);
      b = ff(b, c, d, a, k[3], 22, -1044525330);
      a = ff(a, b, c, d, k[4], 7, -176418897);
      d = ff(d, a, b, c, k[5], 12, 1200080426);
      c = ff(c, d, a, b, k[6], 17, -1473231341);
      b = ff(b, c, d, a, k[7], 22, -45705983);
      a = ff(a, b, c, d, k[8], 7, 1770035416);
      d = ff(d, a, b, c, k[9], 12, -1958414417);
      c = ff(c, d, a, b, k[10], 17, -42063);
      b = ff(b, c, d, a, k[11], 22, -1990404162);
      a = ff(a, b, c, d, k[12], 7, 1804603682);
      d = ff(d, a, b, c, k[13], 12, -40341101);
      c = ff(c, d, a, b, k[14], 17, -1502002290);
      b = ff(b, c, d, a, k[15], 22, 1236535329);
      a = gg(a, b, c, d, k[1], 5, -165796510);
      d = gg(d, a, b, c, k[6], 9, -1069501632);
      c = gg(c, d, a, b, k[11], 14, 643717713);
      b = gg(b, c, d, a, k[0], 20, -373897302);
      a = gg(a, b, c, d, k[5], 5, -701558691);
      d = gg(d, a, b, c, k[10], 9, 38016083);
      c = gg(c, d, a, b, k[15], 14, -660478335);
      b = gg(b, c, d, a, k[4], 20, -405537848);
      a = gg(a, b, c, d, k[9], 5, 568446438);
      d = gg(d, a, b, c, k[14], 9, -1019803690);
      c = gg(c, d, a, b, k[3], 14, -187363961);
      b = gg(b, c, d, a, k[8], 20, 1163531501);
      a = gg(a, b, c, d, k[13], 5, -1444681467);
      d = gg(d, a, b, c, k[2], 9, -51403784);
      c = gg(c, d, a, b, k[7], 14, 1735328473);
      b = gg(b, c, d, a, k[12], 20, -1926607734);
      a = hh(a, b, c, d, k[5], 4, -378558);
      d = hh(d, a, b, c, k[8], 11, -2022574463);
      c = hh(c, d, a, b, k[11], 16, 1839030562);
      b = hh(b, c, d, a, k[14], 23, -35309556);
      a = hh(a, b, c, d, k[1], 4, -1530992060);
      d = hh(d, a, b, c, k[4], 11, 1272893353);
      c = hh(c, d, a, b, k[7], 16, -155497632);
      b = hh(b, c, d, a, k[10], 23, -1094730640);
      a = hh(a, b, c, d, k[13], 4, 681279174);
      d = hh(d, a, b, c, k[0], 11, -358537222);
      c = hh(c, d, a, b, k[3], 16, -722521979);
      b = hh(b, c, d, a, k[6], 23, 76029189);
      a = hh(a, b, c, d, k[9], 4, -640364487);
      d = hh(d, a, b, c, k[12], 11, -421815835);
      c = hh(c, d, a, b, k[15], 16, 530742520);
      b = hh(b, c, d, a, k[2], 23, -995338651);
      a = ii(a, b, c, d, k[0], 6, -198630844);
      d = ii(d, a, b, c, k[7], 10, 1126891415);
      c = ii(c, d, a, b, k[14], 15, -1416354905);
      b = ii(b, c, d, a, k[5], 21, -57434055);
      a = ii(a, b, c, d, k[12], 6, 1700485571);
      d = ii(d, a, b, c, k[3], 10, -1894986606);
      c = ii(c, d, a, b, k[10], 15, -1051523);
      b = ii(b, c, d, a, k[1], 21, -2054922799);
      a = ii(a, b, c, d, k[8], 6, 1873313359);
      d = ii(d, a, b, c, k[15], 10, -30611744);
      c = ii(c, d, a, b, k[6], 15, -1560198380);
      b = ii(b, c, d, a, k[13], 21, 1309151649);
      a = ii(a, b, c, d, k[4], 6, -145523070);
      d = ii(d, a, b, c, k[11], 10, -1120210379);
      c = ii(c, d, a, b, k[2], 15, 718787259);
      b = ii(b, c, d, a, k[9], 21, -343485551);
      x[0] = add32(a, x[0]);
      x[1] = add32(b, x[1]);
      x[2] = add32(c, x[2]);
      x[3] = add32(d, x[3]);
    }
    function md5blk(s) {
      const md5blks = [];
      for (let i = 0; i < 64; i += 4) {
        md5blks[i >> 2] =
          s.charCodeAt(i) +
          (s.charCodeAt(i + 1) << 8) +
          (s.charCodeAt(i + 2) << 16) +
          (s.charCodeAt(i + 3) << 24);
      }
      return md5blks;
    }
    function md51(s) {
      const n = s.length;
      const state = [1732584193, -271733879, -1732584194, 271733878];
      let i;
      for (i = 64; i <= n; i += 64) {
        md5cycle(state, md5blk(s.substring(i - 64, i)));
      }
      s = s.substring(i - 64);
      const tail = new Array(16).fill(0);
      for (i = 0; i < s.length; i++) {
        tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
      }
      tail[i >> 2] |= 0x80 << ((i % 4) << 3);
      if (i > 55) {
        md5cycle(state, tail);
        for (i = 0; i < 16; i++) tail[i] = 0;
      }
      tail[14] = n * 8;
      md5cycle(state, tail);
      return state;
    }
    function rhex(n) {
      const hex_chr = "0123456789abcdef";
      let s = "";
      for (let j = 0; j < 4; j++) {
        s +=
          hex_chr.charAt((n >> (j * 8 + 4)) & 0x0f) +
          hex_chr.charAt((n >> (j * 8)) & 0x0f);
      }
      return s;
    }
    function hex(x) {
      return x.map(rhex).join("");
    }
    function add32(a, b) {
      return (a + b) & 0xffffffff;
    }
    function utf8Encode(str) {
      return unescape(encodeURIComponent(str));
    }
    return hex(md51(utf8Encode(string)));
  }

  const DEFAULT_SETTINGS = {
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

  function storageArea() {
    const api = globalThis.chrome || globalThis.browser;
    const area = api?.storage?.sync || api?.storage?.local;
    if (!area) {
      throw new Error("扩展 storage 不可用，请重新加载插件并刷新页面");
    }
    return area;
  }

  async function getSettings() {
    const stored = await storageArea().get(DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS, ...stored };
  }

  async function saveSettings(partial) {
    await storageArea().set(partial);
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
        const origin = rewriteHost.startsWith("http")
          ? rewriteHost.replace(/\/+$/, "")
          : `https://${host}`;
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
    const headers = { Accept: "application/json" };
    if (body != null) headers["Content-Type"] = "application/json";

    const token = auth === "" ? "" : auth ?? settings.authToken;
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
      const detail = e?.message || String(e);
      let hint = "";
      if (/Failed to fetch|NetworkError|Load failed|网络/i.test(detail)) {
        hint =
          "；请确认：1) Ani-RSS 已启动 2) 地址端口正确 3) 本机浏览器能打开该地址 4) 在插件弹窗点「测试连接」";
      }
      throw new Error(`无法连接 Ani-RSS（${settings.baseUrl}）：${detail}${hint}`);
    }

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(`Ani-RSS 返回非 JSON（HTTP ${res.status}）`);
    }

    return { httpStatus: res.status, data };
  }

  async function ping(settings) {
    const { data } = await requestJson(settings, "api/ping", { method: "GET" });
    if (data?.code >= 200 && data?.code < 300) return true;
    throw new Error(data?.message || "Ping 失败");
  }

  async function login(settings) {
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

  async function rssToAni(settings, { url, type = "mikan", subgroup, bgmUrl, enable }) {
    const body = {
      url,
      type,
      enable: enable ?? settings.enable ?? true,
    };

    // 不单独传 subgroup：否则 Ani-RSS 会跳过蜜柑抓取并报 bgmUrl 不能为空
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

  async function addAni(settings, ani) {
    const { data } = await withAuth(settings, (s) =>
      requestJson(s, "api/addAni", { body: ani })
    );
    if (!(data?.code >= 200 && data?.code < 300)) {
      throw new Error(data?.message || "添加订阅失败");
    }
    return data;
  }

  async function listAni(settings) {
    const { data } = await withAuth(settings, (s) =>
      requestJson(s, "api/listAni", { body: {} })
    );
    if (!(data?.code >= 200 && data?.code < 300)) {
      throw new Error(data?.message || "获取订阅列表失败");
    }
    return data.data;
  }

  async function subscribeMikan(settings, payload) {
    let rssUrl = payload.rssUrl;
    if (!rssUrl) throw new Error("缺少 RSS 地址");

    rssUrl = rewriteRssUrl(rssUrl, settings.rewriteRssHost);

    const pageBgm = (payload.bgmUrl || "").trim();
    const pageSubgroup = (payload.subgroup || "").trim();

    const ani = await rssToAni(settings, {
      url: rssUrl,
      type: "mikan",
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
    if (pageSubgroup && !ani.subgroup) {
      ani.subgroup = pageSubgroup;
    }

    await addAni(settings, ani);
    return ani;
  }

  async function testConnection(settings) {
    await ping(settings);
    if (settings.apiKey) {
      await listAni(settings);
      return { mode: "apiKey" };
    }
    if (settings.username && settings.password) {
      await login(settings);
      await listAni(await getSettings());
      return { mode: "login" };
    }
    await listAni(settings);
    return { mode: "open" };
  }

  globalThis.AniRssApi = {
    DEFAULT_SETTINGS,
    md5,
    getSettings,
    saveSettings,
    ping,
    login,
    rssToAni,
    addAni,
    listAni,
    subscribeMikan,
    testConnection,
  };
})();
