import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/integrations/supabase";
import { authenticateAdminRequest } from "@/lib/publishing/auth";
import type { AnalyticsEventName, AnalyticsSummary } from "@/lib/analytics/types";
import { getArticleMetadataLookup, resolveArticleMeta } from "@/lib/content/metadata-resolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const isAuthenticated = await authenticateAdminRequest(request);
  if (!isAuthenticated) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "database_not_configured" }, { status: 500 });
  }

  // 获取全站文章元数据字典，用于反查中文标题与 Notion 链接
  const { lookup: articleLookup } = await getArticleMetadataLookup();

  let rawEvents: Array<{
    id?: number;
    session_id: string;
    event_name: string;
    event_data: Record<string, unknown>;
    created_at: string;
  }> = [];

  // 1. 优先读取 analytics_events 表
  const { data: tableEvents, error: tableErr } = await supabase
    .from("analytics_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (!tableErr && tableEvents && tableEvents.length > 0) {
    rawEvents = tableEvents.map((row) => ({
      id: row.id,
      session_id: row.session_id,
      event_name: row.event_name,
      event_data: (typeof row.event_data === "object" && row.event_data !== null ? row.event_data : {}) as Record<string, unknown>,
      created_at: row.created_at,
    }));
  } else {
    // 2. 读取缓冲池降级数据
    const { data: bufferData } = await supabase
      .from("site_configs")
      .select("value")
      .eq("key", "analytics_events_buffer")
      .maybeSingle();

    if (Array.isArray(bufferData?.value)) {
      rawEvents = (bufferData.value as Array<Record<string, unknown>>).map((item, idx) => ({
        id: typeof item.id === "number" ? item.id : idx + 1,
        session_id: typeof item.session_id === "string" ? item.session_id : "anonymous",
        event_name: typeof item.event_name === "string" ? item.event_name : "page_view",
        event_data: (typeof item.event_data === "object" && item.event_data !== null ? item.event_data : {}) as Record<string, unknown>,
        created_at: typeof item.created_at === "string" ? item.created_at : new Date().toISOString(),
      }));
    }
  }

  // 解析时间筛选范围参数 (today | 7d | 30d | 1y | all)
  const url = new URL(request.url);
  const timeRangeParam = (url.searchParams.get("timeRange") || "7d").toLowerCase();
  const timeRange: "today" | "7d" | "30d" | "1y" | "all" =
    timeRangeParam === "today" || timeRangeParam === "7d" || timeRangeParam === "30d" || timeRangeParam === "1y" || timeRangeParam === "all"
      ? timeRangeParam
      : "7d";

  // 计算时间过滤边界
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStartIso = todayStart.toISOString();

  let cutoffDate = new Date(0);
  if (timeRange === "today") {
    cutoffDate = todayStart;
  } else if (timeRange === "7d") {
    cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (timeRange === "30d") {
    cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (timeRange === "1y") {
    cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  }
  const cutoffIso = cutoffDate.toISOString();

  // 3. 统计聚合指标
  let todayPv = 0;
  const todaySessions = new Set<string>();
  let periodPv = 0;
  const periodSessions = new Set<string>();
  let totalSearches = 0;
  let zeroResultSearches = 0;
  let totalAiAsks = 0;
  let totalContactCopies = 0;

  // 趋势图聚合数据字典 (Key: YYYY-MM-DD 或 YYYY-MM)
  const trendBuckets: Record<string, { label: string; pv: number; sessions: Set<string> }> = {};

  // 预初始化近 7 天或近 30 天的连续空数据桶，保证图表连续平滑
  const trendDays = timeRange === "today" ? 7 : timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 0;
  if (trendDays > 0) {
    for (let i = trendDays - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const label = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
      trendBuckets[key] = { label, pv: 0, sessions: new Set() };
    }
  }

  const articleViewCounts: Record<
    string,
    { title: string; sectionTitle?: string; routePath?: string; notionUrl?: string; count: number }
  > = {};
  const queryCounts: Record<string, { count: number; zeroResult: boolean; lastAt: string }> = {};

  for (const ev of rawEvents) {
    const isToday = ev.created_at >= todayStartIso;
    const inPeriod = ev.created_at >= cutoffIso;

    // 填充趋势图点
    if (ev.event_name === "page_view") {
      const evDate = new Date(ev.created_at);
      let trendKey = "";
      let trendLabel = "";

      if (timeRange === "1y" || timeRange === "all") {
        trendKey = `${evDate.getFullYear()}-${String(evDate.getMonth() + 1).padStart(2, "0")}`;
        trendLabel = `${evDate.getFullYear()}/${String(evDate.getMonth() + 1).padStart(2, "0")}`;
      } else {
        trendKey = `${evDate.getFullYear()}-${String(evDate.getMonth() + 1).padStart(2, "0")}-${String(evDate.getDate()).padStart(2, "0")}`;
        trendLabel = `${String(evDate.getMonth() + 1).padStart(2, "0")}/${String(evDate.getDate()).padStart(2, "0")}`;
      }

      if (trendKey) {
        let bucket = trendBuckets[trendKey];
        if (!bucket) {
          bucket = { label: trendLabel, pv: 0, sessions: new Set() };
          trendBuckets[trendKey] = bucket;
        }
        bucket.pv++;
        bucket.sessions.add(ev.session_id);
      }
    }

    if (ev.event_name === "page_view") {
      if (isToday) {
        todayPv++;
        todaySessions.add(ev.session_id);
      }
      if (inPeriod) {
        periodPv++;
        periodSessions.add(ev.session_id);
      }

      const rawSlug = String((ev.event_data?.slug as string) || (ev.event_data?.path as string) || "").trim();
      const cleanSlug = rawSlug.toLowerCase();
      const isHomepage = cleanSlug === "/" || cleanSlug === "home" || cleanSlug === "首页" || cleanSlug === "" || cleanSlug === "/home";

      // 严格排除非文章入口
      if (!isHomepage && inPeriod) {
        const meta = resolveArticleMeta(articleLookup, rawSlug);
        const title = meta?.title || (ev.event_data?.pageTitle as string) || rawSlug;
        const sectionTitle = meta?.sectionTitle;
        const routePath = meta?.routePath || (rawSlug.startsWith("/") ? rawSlug : `/docs/${rawSlug}`);
        const notionUrl = meta?.notionUrl;
        const groupKey = meta?.slug || rawSlug.replace(/^\/docs\//, "").replace(/^\/sections\//, "");

        if (!articleViewCounts[groupKey]) {
          articleViewCounts[groupKey] = {
            title,
            sectionTitle,
            routePath,
            notionUrl,
            count: 0,
          };
        }
        articleViewCounts[groupKey].count++;
      }
    } else if (ev.event_name === "search_query" && inPeriod) {
      totalSearches++;
      const q = String(ev.event_data?.query || "").trim();
      const count = Number(ev.event_data?.resultCount ?? 0);
      const isZero = count === 0;
      if (isZero) zeroResultSearches++;

      if (q) {
        if (!queryCounts[q]) {
          queryCounts[q] = { count: 0, zeroResult: isZero, lastAt: ev.created_at };
        }
        queryCounts[q].count++;
      }
    } else if (ev.event_name === "ai_ask_submitted" && inPeriod) {
      totalAiAsks++;
    } else if (ev.event_name === "contact_copied" && inPeriod) {
      totalContactCopies++;
    }
  }

  // 排序热门文章 Top 10
  const topArticles = Object.entries(articleViewCounts)
    .map(([slug, data]) => ({
      slug,
      title: data.title,
      sectionTitle: data.sectionTitle,
      routePath: data.routePath,
      notionUrl: data.notionUrl,
      views: data.count,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  // 排序高频搜索词 Top 10
  const topSearchQueries = Object.entries(queryCounts)
    .map(([query, data]) => ({ query, count: data.count, zeroResult: data.zeroResult }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 排序零结果词列表
  const zeroResultQueries = Object.entries(queryCounts)
    .filter(([, data]) => data.zeroResult)
    .map(([query, data]) => ({ query, count: data.count, lastSearchedAt: data.lastAt }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const totalPv = rawEvents.filter((e) => e.event_name === "page_view").length;
  const totalUv = new Set(rawEvents.map((e) => e.session_id)).size;

  // 组装趋势图有序点
  const trends = Object.entries(trendBuckets)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, bucket]) => ({
      date,
      label: bucket.label,
      pv: bucket.pv,
      uv: bucket.sessions.size,
    }));

  const summary: AnalyticsSummary = {
    timeRange,
    todayPv,
    todayUv: todaySessions.size,
    periodPv,
    periodUv: periodSessions.size,
    totalPv,
    totalUv,
    totalSearches,
    zeroResultSearches,
    totalAiAsks,
    totalContactCopies,
    trends,
    topArticles,
    topSearchQueries,
    zeroResultQueries,
    recentEvents: rawEvents.slice(0, 50).map((e, idx) => {
      const slug = (e.event_data?.slug as string) || (e.event_data?.path as string);
      const meta = resolveArticleMeta(articleLookup, slug);
      return {
        id: e.id || idx + 1,
        eventName: e.event_name as AnalyticsEventName,
        eventData: e.event_data,
        createdAt: e.created_at,
        resolvedTitle: meta?.title || (e.event_data?.pageTitle as string) || (slug === "/" ? "首页" : undefined),
        resolvedSection: meta?.sectionTitle,
        routePath: meta?.routePath || (slug?.startsWith("/") ? slug : slug ? `/docs/${slug}` : undefined),
        notionUrl: meta?.notionUrl,
      };
    }),
  };

  return NextResponse.json({ ok: true, data: summary });
}
