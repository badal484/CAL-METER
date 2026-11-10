import type { OperationalMetricsResponse } from '@calmeter/contracts';

export class OperationalMetricsService {
  private startTime = Date.now();
  private totalRequests = 0;
  private statusCodes: Record<string, number> = {};
  private latenciesMs: number[] = [];
  private maxLatenciesRetained = 2000;

  // AI Usage counters
  private aiRequestCount = 0;
  private aiTotalTokens = 0;
  private aiPromptTokens = 0;
  private aiCompletionTokens = 0;
  private aiLatenciesMs: number[] = [];

  // Worker counters
  private workerActiveJobs = 0;
  private workerCompletedJobs = 0;
  private workerFailedJobs = 0;
  private workerWaitingJobs = 0;

  recordHttpRequest(statusCode: number, latencyMs: number) {
    this.totalRequests++;
    const codeKey = String(statusCode);
    this.statusCodes[codeKey] = (this.statusCodes[codeKey] || 0) + 1;

    this.latenciesMs.push(latencyMs);
    if (this.latenciesMs.length > this.maxLatenciesRetained) {
      this.latenciesMs.shift();
    }
  }

  recordAiUsage(tokens: { promptTokens?: number; completionTokens?: number }, latencyMs: number) {
    this.aiRequestCount++;
    const pTokens = tokens.promptTokens || 0;
    const cTokens = tokens.completionTokens || 0;
    this.aiPromptTokens += pTokens;
    this.aiCompletionTokens += cTokens;
    this.aiTotalTokens += pTokens + cTokens;

    this.aiLatenciesMs.push(latencyMs);
    if (this.aiLatenciesMs.length > 500) {
      this.aiLatenciesMs.shift();
    }
  }

  updateWorkerMetrics(counts: {
    active: number;
    completed: number;
    failed: number;
    waiting: number;
  }) {
    this.workerActiveJobs = counts.active;
    this.workerCompletedJobs = counts.completed;
    this.workerFailedJobs = counts.failed;
    this.workerWaitingJobs = counts.waiting;
  }

  private calculatePercentile(sorted: number[], p: number): number {
    if (!sorted.length) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))] ?? 0;
  }

  getMetrics(serviceName = 'calmeter-api', version = '1.0.0'): OperationalMetricsResponse {
    const mem = process.memoryUsage();
    const sortedLatencies = [...this.latenciesMs].sort((a, b) => a - b);
    const avgLatency =
      sortedLatencies.length > 0
        ? sortedLatencies.reduce((sum, val) => sum + val, 0) / sortedLatencies.length
        : 0;
    const p95Latency = this.calculatePercentile(sortedLatencies, 95);

    const sortedAiLatencies = [...this.aiLatenciesMs].sort((a, b) => a - b);
    const avgAiLatency =
      sortedAiLatencies.length > 0
        ? sortedAiLatencies.reduce((sum, val) => sum + val, 0) / sortedAiLatencies.length
        : 0;

    return {
      service: serviceName,
      version,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      memoryUsage: {
        heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
        rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
      },
      httpMetrics: {
        totalRequests: this.totalRequests,
        statusCodes: { ...this.statusCodes },
        averageLatencyMs: Math.round(avgLatency * 100) / 100,
        p95LatencyMs: Math.round(p95Latency * 100) / 100,
      },
      workerMetrics: {
        activeJobs: this.workerActiveJobs,
        completedJobs: this.workerCompletedJobs,
        failedJobs: this.workerFailedJobs,
        waitingJobs: this.workerWaitingJobs,
      },
      aiMetrics: {
        requestCount: this.aiRequestCount,
        totalTokens: this.aiTotalTokens,
        promptTokens: this.aiPromptTokens,
        completionTokens: this.aiCompletionTokens,
        averageLatencyMs: Math.round(avgAiLatency * 100) / 100,
      },
    };
  }

  toPrometheusFormat(serviceName = 'calmeter_api'): string {
    const m = this.getMetrics(serviceName);
    const lines: string[] = [];

    lines.push(`# HELP process_uptime_seconds Process uptime in seconds`);
    lines.push(`# TYPE process_uptime_seconds gauge`);
    lines.push(`process_uptime_seconds{service="${m.service}"} ${m.uptimeSeconds}`);

    lines.push(`# HELP process_memory_heap_used_bytes Heap memory used in bytes`);
    lines.push(`# TYPE process_memory_heap_used_bytes gauge`);
    lines.push(
      `process_memory_heap_used_bytes{service="${m.service}"} ${Math.round(m.memoryUsage.heapUsedMb * 1024 * 1024)}`,
    );

    lines.push(`# HELP http_requests_total Total number of HTTP requests`);
    lines.push(`# TYPE http_requests_total counter`);
    lines.push(`http_requests_total{service="${m.service}"} ${m.httpMetrics.totalRequests}`);

    for (const [code, count] of Object.entries(m.httpMetrics.statusCodes)) {
      lines.push(`http_requests_by_status{service="${m.service}",code="${code}"} ${count}`);
    }

    lines.push(`# HELP http_request_duration_ms Average HTTP request latency in ms`);
    lines.push(`# TYPE http_request_duration_ms gauge`);
    lines.push(
      `http_request_duration_ms{service="${m.service}",quantile="avg"} ${m.httpMetrics.averageLatencyMs}`,
    );
    lines.push(
      `http_request_duration_ms{service="${m.service}",quantile="p95"} ${m.httpMetrics.p95LatencyMs}`,
    );

    if (m.aiMetrics) {
      lines.push(`# HELP ai_tokens_total Total tokens used by AI pipelines`);
      lines.push(`# TYPE ai_tokens_total counter`);
      lines.push(
        `ai_tokens_total{service="${m.service}",type="prompt"} ${m.aiMetrics.promptTokens}`,
      );
      lines.push(
        `ai_tokens_total{service="${m.service}",type="completion"} ${m.aiMetrics.completionTokens}`,
      );
    }

    return lines.join('\n') + '\n';
  }

  reset() {
    this.totalRequests = 0;
    this.statusCodes = {};
    this.latenciesMs = [];
    this.aiRequestCount = 0;
    this.aiTotalTokens = 0;
    this.aiPromptTokens = 0;
    this.aiCompletionTokens = 0;
    this.aiLatenciesMs = [];
  }
}

export const globalOperationalMetrics = new OperationalMetricsService();
