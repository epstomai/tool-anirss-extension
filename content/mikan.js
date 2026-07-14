(() => {
  "use strict";

  const BTN_CLASS = "anirss-btn";
  const MARK = "data-anirss-injected";

  function getRuntime() {
    try {
      const api = globalThis.chrome || globalThis.browser;
      if (!api || !api.runtime) return null;
      const runtime = api.runtime;
      if (typeof runtime.sendMessage !== "function") return null;
      // 扩展被重载后访问 id / getManifest 会抛错
      try {
        void runtime.id;
        if (typeof runtime.getManifest === "function") {
          runtime.getManifest();
        }
      } catch {
        return null;
      }
      return runtime;
    } catch {
      return null;
    }
  }

  function contextLostError() {
    return new Error(
      "扩展上下文失效：请到 chrome://extensions 重新加载插件，然后【关闭】本标签页再重新打开（仅刷新不够）"
    );
  }

  /**
   * 订阅请求必须发到 background（内网 Ani-RSS）。
   * 仅使用 Promise 形式的 sendMessage，并吞掉/捕获 rejection，
   * 避免 Chrome「callback + Promise 双通道」导致 Uncaught (in promise)。
   */
  async function sendToBackground(type, payload, timeoutMs = 120000) {
    const runtime = getRuntime();
    if (!runtime) {
      throw contextLostError();
    }

    const send =
      typeof runtime.sendMessage === "function"
        ? runtime.sendMessage.bind(runtime)
        : null;
    if (!send) {
      throw contextLostError();
    }

    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new Error(
            "请求超时：Ani-RSS 无响应，请检查地址，并在插件弹窗点「测试连接」"
          )
        );
      }, timeoutMs);
    });

    try {
      // 不要传 callback，只走 Promise，统一 try/catch
      const resp = await Promise.race([send({ type, payload }), timeoutPromise]);

      if (!resp) {
        throw new Error("后台无响应");
      }
      if (resp.ok === false) {
        throw new Error(resp.error || "操作失败");
      }
      // 兼容 { ok:true, data } 与直接 data
      if (resp.ok === true) {
        return resp.data;
      }
      return resp;
    } catch (e) {
      const msg = e?.message || String(e);
      if (/sendMessage|Cannot read properties of undefined/i.test(msg)) {
        throw contextLostError();
      }
      if (/context invalidated/i.test(msg)) {
        throw new Error("扩展已重载：请关闭本标签页后重新打开蜜柑再试");
      }
      if (/receiving end does not exist/i.test(msg)) {
        throw new Error(
          "后台未就绪：请到 chrome://extensions 重新加载本插件后再试"
        );
      }
      if (/message port closed/i.test(msg)) {
        throw new Error("后台连接中断，请重试一次");
      }
      throw e instanceof Error ? e : new Error(msg);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  async function subscribeViaBackground(payload) {
    return sendToBackground("SUBSCRIBE", payload, 120000);
  }

  /** 页面顶部常驻条：扩展失效时提示用户关页重开 */
  function showContextBanner(text) {
    try {
      let bar = document.getElementById("anirss-context-banner");
      if (!bar) {
        bar = document.createElement("div");
        bar.id = "anirss-context-banner";
        bar.className = "anirss-context-banner";
        document.documentElement.appendChild(bar);
      }
      bar.textContent = text;
      bar.classList.add("show");
    } catch {
      /* ignore */
    }
  }

  // 尽早探测：若已失效，立刻提示
  if (!getRuntime()) {
    // 延迟到 DOM 可用
    setTimeout(() => {
      showContextBanner(
        "Ani-RSS 插件上下文已失效，请重新加载扩展后关闭本标签再打开"
      );
    }, 0);
  }

  function ensureToastHost() {
    let host = document.querySelector(".anirss-toast-host");
    if (!host) {
      host = document.createElement("div");
      host.className = "anirss-toast-host";
      document.documentElement.appendChild(host);
    }
    return host;
  }

  function isGenericSiteName(t) {
    if (!t) return true;
    const s = String(t).replace(/\s+/g, " ").trim();
    if (!s) return true;
    // 首页 document.title 常为「蜜柑计划 - Mikan Project」
    if (/^蜜柑计划(\s*-\s*Mikan Project)?$/i.test(s)) return true;
    if (/^Mikan Project$/i.test(s)) return true;
    if (/^Mikan$/i.test(s)) return true;
    return false;
  }

  function cleanTitle(t) {
    if (!t) return "";
    const s = String(t).replace(/\s+/g, " ").trim();
    return isGenericSiteName(s) ? "" : s;
  }

  function formatName(payload, result) {
    const title = cleanTitle(
      (result && result.title) ||
        (payload && payload.title) ||
        ""
    );
    const sub = String(
      (result && result.subgroup) || (payload && payload.subgroup) || ""
    )
      .replace(/\s+/g, " ")
      .trim();
    if (title && sub) return `${title} / ${sub}`;
    if (title) return title;
    if (sub) return sub;
    return "番剧";
  }

  /**
   * Sticky toast controller.
   * - createSticky: stays until done/close
   * - toast: auto-dismiss one-shot
   */
  function createStickyToast(message, kind = "info") {
    const host = ensureToastHost();
    const el = document.createElement("div");
    el.className = `anirss-toast ${kind} sticky`;
    el.innerHTML =
      `<div class="anirss-toast-row">` +
      `<span class="anirss-toast-spinner" aria-hidden="true"></span>` +
      `<span class="anirss-toast-text"></span>` +
      `</div>`;
    const textEl = el.querySelector(".anirss-toast-text");
    textEl.textContent = message;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));

    let closed = false;
    let hideTimer = null;

    const api = {
      update(nextMessage, nextKind) {
        if (closed) return;
        if (nextKind) {
          el.classList.remove("info", "success", "error", "loading");
          el.classList.add(nextKind);
        }
        textEl.textContent = nextMessage;
      },
      setLoading(isLoading) {
        if (closed) return;
        el.classList.toggle("loading", !!isLoading);
        const spin = el.querySelector(".anirss-toast-spinner");
        if (spin) spin.style.display = isLoading ? "" : "none";
      },
      done(nextMessage, nextKind = "success", ms = 3500) {
        if (closed) return;
        api.setLoading(false);
        api.update(nextMessage, nextKind);
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => api.close(), ms);
      },
      close() {
        if (closed) return;
        closed = true;
        if (hideTimer) clearTimeout(hideTimer);
        el.classList.remove("show");
        setTimeout(() => el.remove(), 220);
      },
    };

    api.setLoading(kind === "loading" || kind === "info");
    return api;
  }

  function toast(message, kind = "info", ms = 2800) {
    const t = createStickyToast(message, kind);
    t.setLoading(false);
    setTimeout(() => t.close(), ms);
    return t;
  }

  function absUrl(href) {
    try {
      return new URL(href, location.origin).toString();
    } catch {
      return href;
    }
  }

  function extractBangumiIdFromPath() {
    const m = location.pathname.match(/\/Home\/Bangumi\/(\d+)/i);
    return m ? m[1] : null;
  }

  function getPageBgmUrl() {
    const links = document.querySelectorAll('a[href*="bgm.tv/subject/"]');
    for (const a of links) {
      const href = a.getAttribute("href") || "";
      if (/bgm\.tv\/subject\/\d+/.test(href)) return absUrl(href);
    }
    return "";
  }

  function getDetailBangumiTitle() {
    const titleEl = document.querySelector(".bangumi-title");
    if (!titleEl) return "";
    // clone and strip RSS icon / buttons
    const clone = titleEl.cloneNode(true);
    clone.querySelectorAll("a, i, svg, .anirss-btn").forEach((n) => n.remove());
    return cleanTitle(clone.textContent);
  }

  function getPageTitle() {
    const detail = getDetailBangumiTitle();
    if (detail) return detail;

    // "Mikan Project - 番名" / "蜜柑计划 - 番名"（排除首页「蜜柑计划 - Mikan Project」）
    const doc = document.title.replace(/\s+/g, " ").trim();
    let m = doc.match(/^Mikan Project\s*-\s*(.+)$/i);
    if (m) {
      const t = cleanTitle(m[1]);
      if (t) return t;
    }
    m = doc.match(/^蜜柑计划\s*-\s*(.+)$/);
    if (m) {
      const t = cleanTitle(m[1]);
      if (t) return t;
    }
    return "";
  }

  /** Resolve anime title by bangumiId from homepage cards / expand panels. */
  function titleByBangumiId(bangumiId) {
    if (!bangumiId) return "";
    const id = String(bangumiId);

    // Expanded row title: a.res-ul-title-text
    const expandLinks = document.querySelectorAll(
      "a.res-ul-title-text, a.sk-col.res-ul-title-text"
    );
    for (const a of expandLinks) {
      const href = a.getAttribute("href") || "";
      if (href.includes(`/Home/Bangumi/${id}`) || href.endsWith(`/Bangumi/${id}`)) {
        const t = cleanTitle(a.getAttribute("title") || a.textContent);
        if (t) return t;
      }
    }

    // Homepage poster cards
    const cardLinks = document.querySelectorAll(`a.an-text[href*="Bangumi/${id}"]`);
    for (const a of cardLinks) {
      const t = cleanTitle(a.getAttribute("title") || a.textContent);
      if (t) return t;
    }

    // Poster span + sibling an-text
    const span = document.querySelector(
      `.js-expand_bangumi[data-bangumiid="${id}"]`
    );
    if (span) {
      const li = span.closest("li");
      const a = li?.querySelector("a.an-text");
      if (a) {
        const t = cleanTitle(a.getAttribute("title") || a.textContent);
        if (t) return t;
      }
    }

    // Detail page for this id
    if (extractBangumiIdFromPath() === id) {
      return getDetailBangumiTitle();
    }
    return "";
  }

  /**
   * Title near a homepage card / expanded row.
   * Note: subgroup row is also an <li>; must NOT stop at that li —
   * climb to .an-res-row for the real bangumi title.
   */
  function titleNear(el, bangumiId) {
    if (bangumiId) {
      const byId = titleByBangumiId(bangumiId);
      if (byId) return byId;
    }
    if (!el) return getPageTitle();

    // Expanded panel (homepage after clicking poster)
    const resRow = el.closest(".an-res-row");
    if (resRow) {
      const expandTitle = resRow.querySelector(
        "a.res-ul-title-text, .res-ul-title-text"
      );
      if (expandTitle) {
        const t = cleanTitle(
          expandTitle.getAttribute("title") || expandTitle.textContent
        );
        if (t) return t;
      }
    }

    // Card list item that actually has an-text (not subgroup li)
    let node = el;
    for (let i = 0; i < 8 && node; i++) {
      const li = node.closest?.("li") || (node.tagName === "LI" ? node : null);
      if (li) {
        const a = li.querySelector(":scope > .an-info a.an-text, :scope a.an-text");
        if (a && !li.classList.contains("js-expand_bangumi-subgroup")) {
          const t = cleanTitle(a.getAttribute("title") || a.textContent);
          if (t) return t;
        }
        node = li.parentElement;
      } else {
        break;
      }
    }

    return getPageTitle();
  }

  function subgroupNameNear(el) {
    // Homepage expanded subgroup row
    const homeRow = el.closest("li.js-expand_bangumi-subgroup, li");
    if (homeRow) {
      const tag = homeRow.querySelector(".tag-res-name");
      if (tag) {
        const t = (tag.getAttribute("title") || tag.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        if (t) return t;
      }
    }

    const root = el.closest(".subgroup-text") || el.parentElement;
    if (!root) return "";
    const nameLink = root.querySelector('a[href*="/Home/PublishGroup/"], a.subgroup-name');
    if (nameLink) return nameLink.textContent.replace(/\s+/g, " ").trim();
    // fallback: first text-ish anchor that is not RSS/subscribe
    const anchors = [...root.querySelectorAll("a")];
    for (const a of anchors) {
      if (a.classList.contains("mikan-rss")) continue;
      if (a.classList.contains(BTN_CLASS)) continue;
      if (a.classList.contains("js-subscribe_bangumi_page")) continue;
      if (a.classList.contains("subgroup-subscribe")) continue;
      const t = a.textContent.replace(/\s+/g, " ").trim();
      if (t && t !== "订阅" && t !== "RSS") return t;
    }
    return "";
  }

  function buildRssUrl(bangumiId, subgroupId) {
    const u = new URL("/RSS/Bangumi", location.origin);
    u.searchParams.set("bangumiId", bangumiId);
    if (subgroupId) u.searchParams.set("subgroupid", subgroupId);
    return u.toString();
  }

  async function doSubscribe(btn, payload) {
    if (btn.classList.contains("is-loading")) return;
    const oldText = btn.textContent;

    // 点击时再解析一次标题，避免注入时 DOM 未展开导致只有「蜜柑计划」
    const resolvedTitle =
      cleanTitle(payload.title) ||
      titleNear(btn, payload.bangumiId) ||
      titleByBangumiId(payload.bangumiId) ||
      getPageTitle();
    payload = { ...payload, title: resolvedTitle };

    const displayName = formatName(payload);

    btn.classList.add("is-loading");
    btn.classList.remove("is-done", "is-error");
    btn.textContent = "添加中…";

    // 右上角持续显示，直到添加完成；过程中展示名字
    const progress = createStickyToast(`添加中：${displayName}`, "loading");
    progress.setLoading(true);

    try {
      const data = await subscribeViaBackground(payload);
      btn.classList.remove("is-loading");
      btn.classList.add("is-done");
      btn.textContent = "已添加";

      const finalName = formatName(payload, data);
      progress.done(`✓ 已添加：${finalName}`, "success", 3500);

      setTimeout(() => {
        btn.textContent = oldText;
        btn.classList.remove("is-done");
      }, 2500);
    } catch (e) {
      btn.classList.remove("is-loading");
      btn.classList.add("is-error");
      btn.textContent = "失败";

      const errMsg = e?.message || e || "添加失败";
      progress.done(`✗ ${displayName}：${errMsg}`, "error", 6000);

      setTimeout(() => {
        btn.textContent = oldText;
        btn.classList.remove("is-error");
      }, 2500);
    }
  }

  function makeButton({
    label,
    title,
    bangumiId,
    subgroupId,
    subgroup,
    rssUrl,
    bgmUrl,
    animeTitle,
    extraClass,
  }) {
    const btn = document.createElement("a");
    btn.href = "javascript:void(0)";
    btn.className = `${BTN_CLASS}${extraClass ? " " + extraClass : ""}`;
    btn.setAttribute(MARK, "1");
    btn.textContent = label || "Ani";
    btn.title = title || "添加到 Ani-RSS";
    // 缓存注入时的上下文，点击时还会再解析一遍
    btn.dataset.anirssBangumiId = bangumiId ? String(bangumiId) : "";
    btn.dataset.anirssSubgroupId = subgroupId ? String(subgroupId) : "";
    btn.dataset.anirssSubgroup = subgroup || "";
    btn.dataset.anirssTitle = cleanTitle(animeTitle) || "";
    btn.dataset.anirssRss = rssUrl || "";
    btn.dataset.anirssBgm = bgmUrl || "";

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = bangumiId || btn.dataset.anirssBangumiId || "";
      const subId = subgroupId || btn.dataset.anirssSubgroupId || "";
      const subName =
        subgroup ||
        btn.dataset.anirssSubgroup ||
        subgroupNameNear(btn) ||
        "";
      const anime =
        cleanTitle(animeTitle) ||
        cleanTitle(btn.dataset.anirssTitle) ||
        titleNear(btn, id) ||
        titleByBangumiId(id) ||
        getPageTitle();

      doSubscribe(btn, {
        rssUrl: rssUrl || btn.dataset.anirssRss || buildRssUrl(id, subId),
        subgroup: subName,
        bgmUrl: bgmUrl || btn.dataset.anirssBgm || getPageBgmUrl(),
        title: anime,
        bangumiId: id,
        subgroupId: subId,
      }).catch((err) => {
        console.warn("[Ani-RSS]", err);
        toast(`✗ ${err?.message || err || "添加失败"}`, "error", 5000);
      });
    });
    return btn;
  }

  function alreadyInjectedNear(el) {
    if (!el) return false;
    if (el.parentElement?.querySelector(`:scope > .${BTN_CLASS}[${MARK}]`)) return true;
    if (el.previousElementSibling?.classList?.contains(BTN_CLASS)) return true;
    if (el.nextElementSibling?.classList?.contains(BTN_CLASS)) return true;
    return false;
  }

  /** Bangumi detail page: inject beside each 字幕组「订阅」 button. */
  function injectBangumiPage() {
    const bangumiId = extractBangumiIdFromPath();
    if (!bangumiId) return false;

    const pageAnimeTitle = getDetailBangumiTitle() || getPageTitle();

    // 仅字幕组可订阅；不提供「整部」按钮，避免误选
    document.querySelectorAll(".subgroup-text").forEach((block) => {
      if (block.querySelector(`.${BTN_CLASS}[${MARK}]`)) return;

      const subRss = block.querySelector("a.mikan-rss");
      const nativeSub = block.querySelector(
        "a.subgroup-subscribe, a.js-subscribe_bangumi_page"
      );

      let subgroupId =
        nativeSub?.dataset?.subtitlegroupid ||
        nativeSub?.getAttribute("data-subtitlegroupid") ||
        "";
      if (!subgroupId && subRss) {
        try {
          subgroupId = new URL(absUrl(subRss.getAttribute("href"))).searchParams.get(
            "subgroupid"
          );
        } catch {
          /* ignore */
        }
      }
      if (!subgroupId && block.id) subgroupId = block.id;
      if (!subgroupId) return;

      const subgroup = subgroupNameNear(block);
      const rssUrl = subRss
        ? absUrl(subRss.getAttribute("href"))
        : buildRssUrl(bangumiId, subgroupId);

      // 与蜜柑原生「订阅」并排，靠右：Ani | 订阅
      const btn = makeButton({
        label: "Ani",
        title: `添加「${pageAnimeTitle || bangumiId} / ${subgroup || subgroupId}」到 Ani-RSS`,
        bangumiId,
        subgroupId,
        subgroup,
        rssUrl,
        animeTitle: pageAnimeTitle,
        extraClass: "anirss-btn-detail-sub pull-right",
      });

      if (nativeSub) {
        nativeSub.insertAdjacentElement("beforebegin", btn);
      } else if (subRss) {
        subRss.insertAdjacentElement("afterend", btn);
      } else {
        block.appendChild(btn);
      }
    });

    return true;
  }

  /**
   * Homepage: after clicking a poster, ExpandBangumi injects subgroup rows:
   *   li.js-expand_bangumi-subgroup
   *     .tag-res-name          → subgroup name
   *     .tag-res-new?          → 新
   *     .tag-sub.js-subscribe_bangumi → 订
   *
   * Layout: [字幕组名 ……] [Ani] [订]  同一行，不换行
   * 不注入整部/卡片上的 A 按钮，必须展开后选字幕组。
   */
  function injectHomeExpandedSubgroups() {
    document
      .querySelectorAll(
        "li.js-expand_bangumi-subgroup .tag-sub.js-subscribe_bangumi, li.js-expand_bangumi-subgroup .js-subscribe_bangumi.tag-sub"
      )
      .forEach((native) => {
        const row = native.closest("li.js-expand_bangumi-subgroup");
        if (!row) return;
        if (row.querySelector(`.${BTN_CLASS}[${MARK}]`)) return;
        if (alreadyInjectedNear(native)) return;

        const bangumiId =
          native.dataset?.bangumiid ||
          native.getAttribute("data-bangumiid") ||
          "";
        const subgroupId =
          native.dataset?.subtitlegroupid ||
          native.getAttribute("data-subtitlegroupid") ||
          "";
        if (!bangumiId || !subgroupId) return;

        const subgroup = subgroupNameNear(native);
        const animeTitle =
          titleNear(native, bangumiId) || titleByBangumiId(bangumiId);

        row.classList.add("anirss-home-sub-row");

        const btn = makeButton({
          label: "Ani",
          title: `添加「${animeTitle || bangumiId} / ${subgroup || subgroupId}」到 Ani-RSS`,
          bangumiId,
          subgroupId,
          subgroup,
          animeTitle,
          rssUrl: buildRssUrl(bangumiId, subgroupId),
          extraClass: "anirss-btn-home-sub",
        });
        // 紧挨在「订」左侧，同一行
        native.insertAdjacentElement("beforebegin", btn);
      });
  }

  function injectListPages() {
    injectHomeExpandedSubgroups();
    // 移除已存在的整部 A 按钮（旧版本遗留）
    document
      .querySelectorAll(`.anirss-btn-compact[${MARK}], .anirss-btn-title[${MARK}]`)
      .forEach((el) => el.remove());
  }

  function injectAll() {
    const isBangumi = injectBangumiPage();
    // Homepage expand panels are AJAX-injected; always scan list/home targets
    // except pure bangumi detail already handled above for .subgroup-text.
    if (!isBangumi) {
      injectListPages();
    } else {
      // Safety: if any expand-style nodes ever appear, still cover them
      injectHomeExpandedSubgroups();
    }
  }

  // Initial + SPA-ish DOM changes (mikan is mostly full page loads, but be safe)
  injectAll();

  const obs = new MutationObserver(() => {
    // Debounce lightly
    if (injectAll._t) clearTimeout(injectAll._t);
    injectAll._t = setTimeout(injectAll, 300);
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
