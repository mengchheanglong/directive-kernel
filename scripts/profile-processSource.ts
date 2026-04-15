/// <reference types="node" />
/**
 * CPU profiling for processSource() hot path using V8 inspector.
 * Generates a .cpuprofile file that can be loaded in Chrome DevTools.
 */

import { performance } from "node:perf_hooks";
import { Session } from "node:inspector/promises";
import fs from "node:fs";
import { DirectiveEngine } from "../engine/directive-engine.ts";
import { createMemoryDirectiveEngineStore } from "../engine/storage.ts";
import { createDirectiveWorkspaceEngineLanes } from "../engine/directive-workspace-lanes.ts";

const WARMUP_ROUNDS = 5;
const MEASURE_ROUNDS = 50;

const MISSION = {
  missionId: "profile-mission",
  currentObjective: "Improve observability and real-time monitoring capabilities for distributed microservice architectures",
  missionGoals: [
    "Add structured logging across all service boundaries",
    "Implement distributed tracing with correlation IDs",
    "Build real-time alerting dashboards for latency percentiles",
  ],
  context: "Production system handling 50k req/s across 12 microservices",
};

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

function makeSource(i: number) {
  const topic = topics[i % topics.length];
  return {
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
  };
}

async function main() {
  const store = createMemoryDirectiveEngineStore();
  const engine = new DirectiveEngine({
    store,
    laneSet: createDirectiveWorkspaceEngineLanes(),
  });

  // Warmup
  console.log(`Warming up with ${WARMUP_ROUNDS} runs...`);
  for (let i = 0; i < WARMUP_ROUNDS; i++) {
    await engine.processSource({
      source: makeSource(i),
      mission: MISSION,
      receivedAt: new Date(Date.now() - (WARMUP_ROUNDS - i) * 3600_000).toISOString(),
    });
  }

  // Start V8 CPU profiler
  const session = new Session();
  session.connect();
  await session.post("Profiler.enable");
  await session.post("Profiler.start");

  console.log(`Profiling ${MEASURE_ROUNDS} processSource() calls...`);
  const wallStart = performance.now();

  for (let i = 0; i < MEASURE_ROUNDS; i++) {
    await engine.processSource({
      source: makeSource(WARMUP_ROUNDS + i),
      mission: MISSION,
      receivedAt: new Date(Date.now() - (MEASURE_ROUNDS - i) * 60_000).toISOString(),
    });
  }

  const wallEnd = performance.now();

  // Stop profiler and write result
  const { profile } = await session.post("Profiler.stop");
  const profilePath = "scripts/processSource.cpuprofile";
  fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
  console.log(`\nCPU profile written to ${profilePath}`);
  console.log(`Wall time: ${(wallEnd - wallStart).toFixed(1)} ms for ${MEASURE_ROUNDS} calls`);

  // Parse the profile to find top functions by self-time
  type ProfileNode = {
    id: number;
    callFrame: { functionName: string; url: string; lineNumber: number };
    hitCount: number;
    children?: number[];
  };
  const nodes: ProfileNode[] = (profile as any).nodes;
  const samplingInterval = (profile as any).samplingInterval ?? 1000; // microseconds

  // Aggregate by function + file
  const funcTimes = new Map<string, { selfTime: number; hits: number }>();
  for (const node of nodes) {
    const fn = node.callFrame.functionName || "(anonymous)";
    const url = node.callFrame.url;
    const file = url.replace(/.*[/\\]engine[/\\]/, "engine/").replace(/.*[/\\]scripts[/\\]/, "scripts/");
    const key = `${fn} @ ${file}:${node.callFrame.lineNumber + 1}`;
    const selfTimeMs = (node.hitCount * samplingInterval) / 1000;
    const existing = funcTimes.get(key) ?? { selfTime: 0, hits: 0 };
    existing.selfTime += selfTimeMs;
    existing.hits += node.hitCount;
    funcTimes.set(key, existing);
  }

  const totalSelfTime = [...funcTimes.values()].reduce((s, v) => s + v.selfTime, 0);
  const sorted = [...funcTimes.entries()]
    .sort((a, b) => b[1].selfTime - a[1].selfTime)
    .slice(0, 25);

  console.log(`\n=== Top 25 Functions by Self Time ===`);
  console.log(`Total sampled self-time: ${totalSelfTime.toFixed(1)} ms\n`);
  for (const [key, value] of sorted) {
    const pct = ((value.selfTime / totalSelfTime) * 100).toFixed(1);
    console.log(`  ${pct.padStart(5)}%  ${value.selfTime.toFixed(1).padStart(7)} ms  ${value.hits.toString().padStart(4)} hits  ${key}`);
  }

  // Aggregate by file
  const fileTimes = new Map<string, number>();
  for (const node of nodes) {
    const url = node.callFrame.url;
    const file = url.replace(/.*[/\\]engine[/\\]/, "engine/").replace(/.*[/\\]scripts[/\\]/, "scripts/");
    const selfTimeMs = (node.hitCount * samplingInterval) / 1000;
    fileTimes.set(file, (fileTimes.get(file) ?? 0) + selfTimeMs);
  }

  const sortedFiles = [...fileTimes.entries()]
    .filter(([file]) => file.includes("engine/"))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  console.log(`\n=== Top 15 Engine Files by Self Time ===`);
  for (const [file, time] of sortedFiles) {
    const pct = ((time / totalSelfTime) * 100).toFixed(1);
    console.log(`  ${pct.padStart(5)}%  ${time.toFixed(1).padStart(7)} ms  ${file}`);
  }

  session.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
