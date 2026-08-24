// 组件：管理后台全站埋点数据与多维时序大盘 (AnalyticsDashboard)
// 支持历史总计、周表/月表/年表全周期切换、原生 SVG/CSS 走势图表、严格文章清洗与学生行为流
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users,
  Search,
  Bot,
  Copy,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  FileText,
  Clock,
  Sparkles,
  ExternalLink,
  Eye,
  CheckCircle2,
  Calendar,
  BarChart2,
} from "lucide-react";
import type { AnalyticsSummary, AnalyticsTimeRange, DailyTrendPoint } from "@/lib/analytics/types";

const TIME_RANGES: Array<{ key: AnalyticsTimeRange; label: string; desc: string }> = [
  { key: "today", label: "今日", desc: "实时" },
  { key: "7d", label: "近 7 天", desc: "周表" },
  { key: "30d", label: "近 30 天", desc: "月表" },
  { key: "1y", label: "近 1 年", desc: "年表" },
  { key: "all", label: "全部历史", desc: "总计" },
];

export function AnalyticsDashboard({ initialSummary }: { initialSummary?: AnalyticsSummary } = {}) {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(initialSummary || null);
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>(initialSummary?.timeRange || "7d");
  const [loading, setLoading] = useState(!initialSummary);
  const [hoveredPoint, setHoveredPoint] = useState<DailyTrendPoint | null>(null);

  const fetchAnalytics = useCallback((range: AnalyticsTimeRange = timeRange) => {
    setLoading(true);
    fetch(`/api/admin/analytics?timeRange=${range}`)
      .then((res) => res.json())
      .then((res) => {
        if (res?.ok && res?.data) {
          setSummary(res.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [timeRange]);

  useEffect(() => {
    fetchAnalytics(timeRange);
  }, [fetchAnalytics, timeRange]);

  if (loading && !summary) {
    return (
      <div className="rounded-medium border border-line bg-surface p-s8 text-center text-muted">
        <RefreshCw className="size-icon animate-spin mx-auto mb-s2 text-brand" />
        <p className="text-body font-medium text-ink">正在汇总全站埋点数据与学生行为画像...</p>
        <p className="text-caption text-muted mt-s1">按多维时序计算周表、月表与热门趋势中</p>
      </div>
    );
  }

  const data: AnalyticsSummary = summary || {
    timeRange: "7d",
    todayPv: 0,
    todayUv: 0,
    periodPv: 0,
    periodUv: 0,
    totalPv: 0,
    totalUv: 0,
    totalSearches: 0,
    zeroResultSearches: 0,
    totalAiAsks: 0,
    totalContactCopies: 0,
    trends: [],
    topArticles: [],
    topSearchQueries: [],
    zeroResultQueries: [],
    recentEvents: [],
  };

  const maxViews = data.topArticles[0]?.views || 1;
  const maxTrendPv = Math.max(...(data.trends.map((t) => t.pv) || [1]), 1);

  return (
    <div className="space-y-s6">
      {/* 顶部标题、时间区间切换器与操作 */}
      <div className="flex flex-wrap items-center justify-between gap-s4 border-b border-line pb-s4">
        <div>
          <div className="flex items-center gap-s2">
            <BarChart2 className="size-icon text-brand" />
            <h2 className="text-title font-semibold text-ink">全站数据洞察与埋点大盘</h2>
          </div>
          <p className="text-caption text-muted mt-s1">
            多维时序追踪学生访问热度、搜索诉求沉淀与 AI 问答交互
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-s2">
          {/* 时间范围切换器 (周表 / 月表 / 年表 / 全部) */}
          <div className="flex items-center rounded-pill border border-line bg-surface-subtle p-s1">
            {TIME_RANGES.map((r) => {
              const isActive = timeRange === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setTimeRange(r.key)}
                  className={`focus-ring rounded-pill px-s3 py-s1 text-caption font-semibold transition-all ${
                    isActive
                      ? "bg-ink text-surface shadow-subtle"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  <span>{r.label}</span>
                  <span className="text-caption opacity-70 ml-s1 font-normal">({r.desc})</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => fetchAnalytics(timeRange)}
            disabled={loading}
            className="focus-ring tap-target flex items-center gap-s1 rounded-small border border-line bg-surface px-s3 py-s2 text-caption font-medium hover:bg-surface-subtle transition-colors disabled:opacity-60"
            title="刷新当前周期数据"
          >
            <RefreshCw className={`size-icon-small ${loading ? "animate-spin text-brand" : ""}`} />
            <span>{loading ? "刷新中..." : "刷新"}</span>
          </button>
        </div>
      </div>

      {/* 5 大核心指标卡片：历史总计 + 周期维度 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-s4">
        {/* 卡片 1：全站累计总访问量 */}
        <div className="rounded-medium border border-line bg-surface p-s4 space-y-s2">
          <div className="flex items-center justify-between text-muted">
            <span className="text-caption font-medium">全站历史总浏览</span>
            <Users className="size-icon-small text-brand" />
          </div>
          <div className="flex items-baseline gap-s2">
            <strong className="text-display font-semibold text-ink">{data.totalPv}</strong>
            <span className="text-caption text-muted">/ {data.totalUv} 人</span>
          </div>
          <span className="text-caption text-brand flex items-center gap-s1">
            <Sparkles className="size-icon-small" /> 历史累计 (PV / UV)
          </span>
        </div>

        {/* 卡片 2：选定周期访问量 */}
        <div className="rounded-medium border border-brand bg-brand-tint p-s4 space-y-s2">
          <div className="flex items-center justify-between text-brand">
            <span className="text-caption font-semibold">
              {timeRange === "today"
                ? "今日访问"
                : timeRange === "7d"
                ? "本周访问 (7天)"
                : timeRange === "30d"
                ? "本月访问 (30天)"
                : timeRange === "1y"
                ? "年度访问 (1年)"
                : "周期总访问"}
            </span>
            <Calendar className="size-icon-small" />
          </div>
          <div className="flex items-baseline gap-s2">
            <strong className="text-display font-bold text-brand">{data.periodPv}</strong>
            <span className="text-caption text-brand font-medium">/ {data.periodUv} 人</span>
          </div>
          <span className="text-caption text-brand flex items-center gap-s1">
            <TrendingUp className="size-icon-small" /> 选定区间活跃
          </span>
        </div>

        {/* 卡片 3：搜索使用总量 */}
        <div className="rounded-medium border border-line bg-surface p-s4 space-y-s2">
          <div className="flex items-center justify-between text-muted">
            <span className="text-caption font-medium">区间搜索使用</span>
            <Search className="size-icon-small text-brand" />
          </div>
          <div className="flex items-baseline gap-s2">
            <strong className="text-display font-semibold text-ink">{data.totalSearches}</strong>
            <span className="text-caption text-muted">次</span>
          </div>
          {data.zeroResultSearches > 0 ? (
            <span className="text-caption text-danger flex items-center gap-s1 font-medium">
              <AlertTriangle className="size-icon-small" /> {data.zeroResultSearches} 次未搜到
            </span>
          ) : (
            <span className="text-caption text-muted">全部命中匹配</span>
          )}
        </div>

        {/* 卡片 4：AI 问答提问量 */}
        <div className="rounded-medium border border-line bg-surface p-s4 space-y-s2">
          <div className="flex items-center justify-between text-muted">
            <span className="text-caption font-medium">AI 问答提问</span>
            <Bot className="size-icon-small text-brand" />
          </div>
          <div className="flex items-baseline gap-s2">
            <strong className="text-display font-semibold text-ink">{data.totalAiAsks}</strong>
            <span className="text-caption text-muted">次</span>
          </div>
          <span className="text-caption text-muted">知识库精准答复</span>
        </div>

        {/* 卡片 5：电话/服务复制转化 */}
        <div className="rounded-medium border border-line bg-surface p-s4 space-y-s2 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-muted">
            <span className="text-caption font-medium">服务联系复制</span>
            <Copy className="size-icon-small text-brand" />
          </div>
          <div className="flex items-baseline gap-s2">
            <strong className="text-display font-semibold text-ink">{data.totalContactCopies}</strong>
            <span className="text-caption text-muted">次</span>
          </div>
          <span className="text-caption text-brand font-medium">高实用价值触达</span>
        </div>
      </div>

      {/* 趋势走势图大盘 (Trend Bar Chart) */}
      {data.trends.length > 0 && (
        <div className="rounded-medium border border-line bg-surface p-s5 space-y-s4">
          <div className="flex flex-wrap items-center justify-between gap-s2 border-b border-line pb-s3">
            <div className="flex items-center gap-s2">
              <TrendingUp className="size-icon text-brand" />
              <h3 className="text-label font-semibold text-ink">
                访问趋势走势波形 ({timeRange === "7d" ? "周表走势" : timeRange === "30d" ? "月表走势" : timeRange === "1y" ? "年表走势" : "区间走势"})
              </h3>
            </div>
            <div className="flex items-center gap-s3 text-caption">
              <span className="flex items-center gap-s1.5">
                <span className="size-s2 rounded-round bg-brand inline-block" />
                <span className="text-ink font-medium">页面浏览 (PV)</span>
              </span>
              <span className="flex items-center gap-s1.5">
                <span className="size-s2 rounded-round bg-ink inline-block" />
                <span className="text-muted">独立访客 (UV)</span>
              </span>
              {hoveredPoint && (
                <span className="ml-s2 rounded-small bg-brand-tint border border-brand px-s2 py-s0.5 font-mono text-brand font-semibold">
                  {hoveredPoint.label}: {hoveredPoint.pv} PV / {hoveredPoint.uv} UV
                </span>
              )}
            </div>
          </div>

          {/* 柱状时序走势图 */}
          <div className="w-full flex items-end gap-s1.5 sm:gap-s2 pt-s4 pb-s2 px-s1" style={{ height: "176px" }}>
            {data.trends.map((item) => {
              const heightPercent = maxTrendPv > 0 ? Math.max(6, Math.round((item.pv / maxTrendPv) * 100)) : 6;
              const uvHeightPercent = maxTrendPv > 0 ? Math.max(4, Math.round((item.uv / maxTrendPv) * 100)) : 4;
              const isHovered = hoveredPoint?.date === item.date;

              return (
                <div
                  key={item.date}
                  onMouseEnter={() => setHoveredPoint(item)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                >
                  {/* 悬浮提示 Tooltip */}
                  <div
                    style={{ bottom: "100%", marginBottom: "8px", zIndex: 10 }}
                    className={`absolute whitespace-nowrap rounded-small bg-ink text-surface px-s2 py-s1 text-caption font-semibold shadow-medium transition-opacity pointer-events-none ${
                      isHovered ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    {item.label} · {item.pv} PV / {item.uv} UV
                  </div>

                  {/* 柱子双层结构 (外层 PV，内层 UV) */}
                  <div className="w-full max-w-s6 h-full flex items-end justify-center">
                    <div
                      className={`w-full rounded-t-small transition-all relative flex items-end justify-center ${
                        isHovered ? "bg-brand-dark" : "bg-brand"
                      }`}
                      style={{ height: `${heightPercent}%` }}
                    >
                      {/* UV 内部深色核心柱 */}
                      <div
                        className="w-2/3 rounded-t-small bg-ink opacity-80"
                        style={{ height: `${Math.min(100, Math.round((uvHeightPercent / heightPercent) * 100))}%` }}
                      />
                    </div>
                  </div>

                  {/* X 轴日期刻度 */}
                  <span
                    className={`text-caption mt-s1 font-mono truncate max-w-full ${
                      isHovered ? "text-brand font-bold" : "text-muted"
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 核心双列分析：1. 热门阅读篇目 TOP 10  |  2. 搜索诉求与零结果预警 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-s6">
        {/* 1. 热门阅读篇目 TOP 10（严格排除首页、去重板块名） */}
        <div className="rounded-medium border border-line bg-surface p-s5 space-y-s4">
          <div className="flex items-center justify-between border-b border-line pb-s3">
            <div className="flex items-center gap-s2">
              <FileText className="size-icon text-brand" />
              <h3 className="text-label font-semibold text-ink">热门阅读篇目 TOP 10</h3>
            </div>
            <span className="text-caption text-muted">学生关注度最高</span>
          </div>

          {data.topArticles.length === 0 ? (
            <p className="text-caption text-muted py-s6 text-center">暂无文章访问记录，学生访问后将实时更新</p>
          ) : (
            <div className="space-y-s3.5">
              {data.topArticles.map((art, idx) => {
                const showSectionBadge = art.sectionTitle && art.sectionTitle !== art.title;

                return (
                  <div key={art.slug} className="space-y-s1.5 p-s2 rounded-small hover:bg-surface-subtle transition-colors">
                    <div className="flex items-center justify-between text-body">
                      <div className="flex items-center gap-s2 truncate min-w-0">
                        <span className="text-caption font-bold text-muted w-s4 shrink-0">{idx + 1}.</span>
                        <strong className="font-semibold text-ink truncate">
                          {art.title || art.slug}
                        </strong>
                        {showSectionBadge && (
                          <span className="text-caption text-muted bg-surface border border-line rounded-pill px-s2 py-s0.5 shrink-0">
                            {art.sectionTitle}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-s2 shrink-0 ml-s2">
                        <span className="text-caption font-semibold text-brand">{art.views} 次</span>
                        {art.routePath && (
                          <a
                            href={art.routePath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-caption text-muted hover:text-brand transition-colors"
                            title="在学生端新标签页查看"
                          >
                            <ExternalLink className="size-icon-small" />
                          </a>
                        )}
                        {art.notionUrl && (
                          <a
                            href={art.notionUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-caption text-brand hover:underline"
                            title="在 Notion 中编辑"
                          >
                            <Sparkles className="size-icon-small" />
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="h-s1 w-full rounded-pill bg-line-light overflow-hidden">
                      <div
                        className="h-full bg-brand rounded-pill transition-all"
                        style={{ width: `${Math.max(8, Math.round((art.views / maxViews) * 100))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. 搜索诉求洞察与零结果词预警 */}
        <div className="rounded-medium border border-line bg-surface p-s5 space-y-s4">
          <div className="flex items-center justify-between border-b border-line pb-s3">
            <div className="flex items-center gap-s2">
              <Search className="size-icon text-brand" />
              <h3 className="text-label font-semibold text-ink">学生搜索热词与零结果预警</h3>
            </div>
            <span className="text-caption text-muted">选题反哺与内容补充</span>
          </div>

          {/* 零结果词重点提示 */}
          {data.zeroResultQueries.length > 0 && (
            <div className="rounded-small border border-danger bg-danger-bg p-s3 space-y-s2">
              <div className="flex items-center gap-s2 text-danger font-semibold text-caption">
                <AlertTriangle className="size-icon-small" />
                <span>搜不到的关键词（急需在 Notion 中补充对应内容）</span>
              </div>
              <div className="flex flex-wrap gap-s2">
                {data.zeroResultQueries.map((zq) => (
                  <span
                    key={zq.query}
                    className="inline-flex items-center gap-s1 rounded-pill bg-surface border border-danger px-s2 py-s1 text-caption font-medium text-danger"
                  >
                    <span>{zq.query}</span>
                    <span className="opacity-70 text-caption">({zq.count}次)</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 高频搜索词列表 */}
          <div>
            <span className="text-caption text-muted block mb-s2">高频搜索关键词排行：</span>
            {data.topSearchQueries.length === 0 ? (
              <p className="text-caption text-muted py-s6 text-center">当前区间暂无搜索记录</p>
            ) : (
              <div className="flex flex-wrap gap-s2">
                {data.topSearchQueries.map((q) => (
                  <span
                    key={q.query}
                    className={`inline-flex items-center gap-s1 rounded-pill px-s3 py-s1 text-caption font-medium border ${
                      q.zeroResult
                        ? "border-danger bg-danger-bg text-danger"
                        : "border-line bg-surface-subtle text-ink"
                    }`}
                  >
                    <span>{q.query}</span>
                    <span className="text-muted text-caption">· {q.count}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 实时埋点流水日志（可视化学生行为流） */}
      <div className="rounded-medium border border-line bg-surface p-s5 space-y-s3">
        <div className="flex items-center justify-between border-b border-line pb-s3">
          <div className="flex items-center gap-s2">
            <Clock className="size-icon text-muted" />
            <h3 className="text-label font-semibold text-ink">最近实时学生行为流水</h3>
          </div>
          <span className="text-caption text-muted">最近 50 条学生端行为</span>
        </div>

        {data.recentEvents.length === 0 ? (
          <p className="text-caption text-muted py-s6 text-center">暂无埋点流水记录</p>
        ) : (
          <div className="divide-y divide-line overflow-y-auto text-caption" style={{ maxHeight: "384px" }}>
            {data.recentEvents.map((ev) => {
              const d = (ev.eventData || {}) as Record<string, string | number | boolean | undefined>;

              return (
                <div key={ev.id} className="py-s2.5 flex items-center justify-between gap-s4 hover:bg-surface-subtle px-s2 rounded-small transition-colors">
                  <div className="flex items-center gap-s2 truncate min-w-0">
                    {ev.eventName === "page_view" && (
                      <span className="inline-flex items-center gap-s1 rounded-pill bg-brand-tint border border-brand px-s2 py-s1 text-caption font-bold text-brand shrink-0">
                        <Eye className="size-icon-small" />
                        <span>浏览</span>
                      </span>
                    )}
                    {ev.eventName === "search_query" && (
                      <span className="inline-flex items-center gap-s1 rounded-pill bg-brand text-surface px-s2 py-s1 text-caption font-bold shrink-0">
                        <Search className="size-icon-small" />
                        <span>搜索</span>
                      </span>
                    )}
                    {ev.eventName === "ai_ask_submitted" && (
                      <span className="inline-flex items-center gap-s1 rounded-pill bg-surface-subtle border border-line px-s2 py-s1 text-caption font-bold text-brand shrink-0">
                        <Bot className="size-icon-small" />
                        <span>AI 提问</span>
                      </span>
                    )}
                    {ev.eventName === "contact_copied" && (
                      <span className="inline-flex items-center gap-s1 rounded-pill bg-brand-tint border border-brand px-s2 py-s1 text-caption font-bold text-brand shrink-0">
                        <Copy className="size-icon-small" />
                        <span>复制</span>
                      </span>
                    )}
                    {ev.eventName === "article_read_complete" && (
                      <span className="inline-flex items-center gap-s1 rounded-pill bg-surface-subtle border border-line px-s2 py-s1 text-caption font-bold text-ink shrink-0">
                        <CheckCircle2 className="size-icon-small" />
                        <span>读完</span>
                      </span>
                    )}

                    {/* 可读化行为描述 */}
                    <div className="text-ink truncate">
                      {ev.eventName === "page_view" && (
                        <span>
                          {ev.resolvedTitle === "首页" || d.path === "/" || d.pageTitle === "首页" ? (
                            <span>学生访问了 <strong className="font-semibold text-ink">首页</strong></span>
                          ) : (
                            <span>
                              学生阅读了指南{" "}
                              <strong className="font-semibold text-ink">
                                《{ev.resolvedTitle || d.pageTitle || "校园指南"}》
                              </strong>
                              {ev.resolvedSection && <span className="text-muted"> ({ev.resolvedSection})</span>}
                            </span>
                          )}
                          {d.device && <span className="text-muted font-mono"> · {d.device}</span>}
                        </span>
                      )}

                      {ev.eventName === "search_query" && (
                        <span>
                          搜索了「<strong className="font-semibold text-ink">{d.query}</strong>」，匹配到{" "}
                          <span className={d.resultCount === 0 ? "text-danger font-bold" : "text-brand"}>
                            {d.resultCount}
                          </span>{" "}
                          条结果
                        </span>
                      )}

                      {ev.eventName === "ai_ask_submitted" && (
                        <span>
                          向 AI 询问「<strong className="font-semibold text-ink">{d.questionPreview}</strong>」
                        </span>
                      )}

                      {ev.eventName === "contact_copied" && (
                        <span>
                          复制了联系方式 <strong className="font-semibold text-ink">{d.label || d.value}</strong>
                        </span>
                      )}

                      {ev.eventName === "article_read_complete" && (
                        <span>
                          完整读完了《<strong>{ev.resolvedTitle || d.pageTitle || d.slug}</strong>》
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-s2 shrink-0">
                    {ev.routePath && (
                      <a
                        href={ev.routePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-caption text-brand hover:underline"
                      >
                        预览 ↗
                      </a>
                    )}
                    <span className="text-muted text-caption">
                      {new Date(ev.createdAt).toLocaleTimeString("zh-CN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
