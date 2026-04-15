/// <reference types="node" />
/**
 * Benchmark for DirectiveEngine.processSource() — the hot path.
 * Measures p50/p95/p99 latency, throughput, and peak memory.
 */

import { performance } from "node:perf_hooks";
import { DirectiveEngine } from "../engine/directive-engine.ts";
import { createMemoryDirectiveEngineStore } from "../engine/storage.ts";
import { createDirectiveWorkspaceEngineLanes } from "../engine/directive-workspace-lanes.ts";

const WARMUP_ROUNDS = 5;
const MEASURE_ROUNDS = 50;

const MISSION = {
  missionId: "benchmark-mission",
  currentObjective: "Improve observability and real-time monitoring capabilities for distributed microservice architectures",
  missionGoals: [
    "Add structured logging across all service boundaries",
    "Implement distributed tracing with correlation IDs",
    "Build real-time alerting dashboards for latency percentiles",
  ],
  context: "Production system handling 50k req/s across 12 microservices",
};

function makeSources(count: number) {
  const types = ["paper", "github-repo", "product-doc", "theory", "technical-essay"];
  const targets = ["runtime", "architecture", "discovery", null] as const;
  const topics = [
    "OpenTelemetry collector pipeline configuration for high-throughput trace ingestion",
    "Grafana Loki log aggregation with structured metadata indexing",
    "Circuit breaker pattern implementation for resilient service mesh communication",
    "Kubernetes HPA autoscaling based on custom Prometheus latency metrics",
    "Event-driven architecture with Apache Kafka consumer group rebalancing",
    "Zero-downtime database migration strategy for PostgreSQL partitioned tables",
    "gRPC service mesh observability with Envoy proxy sidecar telemetry",
    "Distributed consensus algorithm comparison: Raft vs Paxos for state replication",
    "WebAssembly runtime sandboxing for plugin execution in edge computing nodes",
    "Feature flag evaluation engine with gradual rollout and experiment tracking",
  ];
  const sources = [];
  for (let i = 0; i < count; i++) {
    const topic = topics[i % topics.length];
    sources.push({
      sourceId: `bench-source-${i}`,
      sourceType: types[i % types.length],
      sourceRef: `https://example.com/source/${i}`,
      title: topic,
      summary: `${topic} — detailed analysis and implementation guide for production systems.`,
      missionAlignmentHint: i % 3 === 0 ? "observability" : null,
      capabilityGapId: null,
      primaryAdoptionTarget: targets[i % targets.length],
      containsExecutableCode: i % 4 === 0,
      containsWorkflowPattern: i % 5 === 0,
      improvesDirectiveWorkspace: i % 7 === 0,
      workflowBoundaryShape: null,
      notes: i % 3 === 0 ? ["benchmark note"] : null,
    });
  }
  return sources;
}

function percentile(sorted: number[], p: number) {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

async function main() {
  const store = createMemoryDirectiveEngineStore();
  const engine = new DirectiveEngine({
    store,
    laneSet: createDirectiveWorkspaceEngineLanes(),
  });

  const sources = makeSources(WARMUP_ROUNDS + MEASURE_ROUNDS);

  // Warmup: seed the store with some runs so advisory modules have history
  console.log(`Warming up with ${WARMUP_ROUNDS} runs...`);
  for (let i = 0; i < WARMUP_ROUNDS; i++) {
    await engine.processSource({
      source: sources[i],
      mission: MISSION,
      receivedAt: new Date(Date.now() - (WARMUP_ROUNDS - i) * 3600_000).toISOString(),
    });
  }

  // Measure
  const latencies: number[] = [];
  const memBefore = process.memoryUsage();

  console.log(`Measuring ${MEASURE_ROUNDS} processSource() calls...`);
  const wallStart = performance.now();

  for (let i = 0; i < MEASURE_ROUNDS; i++) {
    const src = sources[WARMUP_ROUNDS + i];
    const start = performance.now();
    await engine.processSource({
      source: src,
      mission: MISSION,
      receivedAt: new Date(Date.now() - (MEASURE_ROUNDS - i) * 60_000).toISOString(),
    });
    const elapsed = performance.now() - start;
    latencies.push(elapsed);
  }

  const wallEnd = performance.now();
  const memAfter = process.memoryUsage();

  latencies.sort((a, b) => a - b);
  const wallMs = wallEnd - wallStart;
  const throughput = (MEASURE_ROUNDS / wallMs) * 1000;

  console.log("\n=== Baseline Benchmark Results ===");
  console.log(`Rounds:      ${MEASURE_ROUNDS}`);
  console.log(`Wall time:   ${wallMs.toFixed(1)} ms`);
  console.log(`p50 latency: ${percentile(latencies, 50).toFixed(3)} ms`);
  console.log(`p95 latency: ${percentile(latencies, 95).toFixed(3)} ms`);
  console.log(`p99 latency: ${percentile(latencies, 99).toFixed(3)} ms`);
  console.log(`min latency: ${latencies[0].toFixed(3)} ms`);
  console.log(`max latency: ${latencies[latencies.length - 1].toFixed(3)} ms`);
  console.log(`throughput:  ${throughput.toFixed(1)} ops/s`);
  console.log(`heap delta:  ${((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(1)} MB`);
  console.log(`rss delta:   ${((memAfter.rss - memBefore.rss) / 1024 / 1024).toFixed(1)} MB`);
  console.log(`peak heap:   ${(memAfter.heapUsed / 1024 / 1024).toFixed(1)} MB`);

  // Per-10-run rolling stats to show scaling behavior
  console.log("\n=== Scaling (avg latency per 10-run batch) ===");
  for (let batch = 0; batch < Math.floor(MEASURE_ROUNDS / 10); batch++) {
    const slice = latencies.slice(batch * 10, (batch + 1) * 10);
    const avg = slice.reduce((s, v) => s + v, 0) / slice.length;
    console.log(`  Batch ${batch + 1} (runs ${batch * 10 + 1}-${(batch + 1) * 10}): avg ${avg.toFixed(3)} ms`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
