/// <reference types="node" />
/**
 * Counts extractSourceSignalTokens calls per processSource invocation
 * using the built-in cache stats (hits + misses = total calls).
 */

import { DirectiveEngine } from "../../engine/directive-engine.ts";
import { createMemoryDirectiveEngineStore } from "../../engine/storage.ts";
import { createDirectiveWorkspaceEngineLanes } from "../../engine/directive-workspace-lanes.ts";
import { readSourceSignalTokenCacheStats, resetSourceSignalTokenCache } from "../../engine/routing/routing-correction-ledger.ts";
import type { DirectiveEngineSourceItem } from "../../engine/types.ts";

const ROUNDS = 30;

const MISSION = {
  missionId: "count-mission",
  currentObjective: "Improve observability and real-time monitoring capabilities for distributed microservice architectures",
  missionGoals: [
    "Add structured logging across all service boundaries",
    "Implement distributed tracing with correlation IDs",
  ],
  context: "Production system",
};

const types: DirectiveEngineSourceItem["sourceType"][] = ["paper", "github-repo", "product-doc", "theory", "technical-essay"];
const targets = ["runtime", "architecture", "discovery", null] as const;
const topics = [
  "OpenTelemetry collector pipeline configuration",
  "Grafana Loki log aggregation with structured metadata",
  "Circuit breaker pattern for resilient service mesh",
  "Kubernetes HPA autoscaling with Prometheus metrics",
  "Event-driven architecture with Apache Kafka",
  "Zero-downtime database migration for PostgreSQL",
  "gRPC service mesh observability with Envoy proxy",
  "Distributed consensus Raft vs Paxos replication",
  "WebAssembly runtime sandboxing for edge computing",
  "Feature flag evaluation engine with gradual rollout",
];

function makeSource(i: number) {
  const topic = topics[i % topics.length];
  return {
    sourceId: `count-source-${i}`,
    sourceType: types[i % types.length],
    sourceRef: `https://example.com/source/${i}`,
    title: topic,
    summary: `${topic} — analysis and implementation guide.`,
    missionAlignmentHint: i % 3 === 0 ? "observability" : null,
    capabilityGapId: null,
    primaryAdoptionTarget: targets[i % targets.length],
    containsExecutableCode: i % 4 === 0,
    containsWorkflowPattern: i % 5 === 0,
    improvesDirectiveWorkspace: i % 7 === 0,
    workflowBoundaryShape: null,
    notes: null,
  };
}

async function main() {
  const store = createMemoryDirectiveEngineStore();
  const engine = new DirectiveEngine({
    store,
    laneSet: createDirectiveWorkspaceEngineLanes(),
  });

  console.log("run#  | storeSize | extractCalls | hits | misses | hits/total");
  console.log("------|-----------|-------------|------|--------|----------");

  for (let i = 0; i < ROUNDS; i++) {
    resetSourceSignalTokenCache(); // reset counters, keep cache
    const statsBefore = readSourceSignalTokenCacheStats();
    const hitsBefore = statsBefore.hits;
    const missesBefore = statsBefore.misses;

    await engine.processSource({
      source: makeSource(i),
      mission: MISSION,
      receivedAt: new Date(Date.now() - (ROUNDS - i) * 60_000).toISOString(),
    });

    const statsAfter = readSourceSignalTokenCacheStats();
    const hits = statsAfter.hits - hitsBefore;
    const misses = statsAfter.misses - missesBefore;
    const total = hits + misses;
    const hitRate = total > 0 ? ((hits / total) * 100).toFixed(0) : "n/a";

    console.log(
      `  ${String(i + 1).padStart(3)}  |    ${String(i).padStart(5)}  |      ${String(total).padStart(5)}  | ${String(hits).padStart(4)} |  ${String(misses).padStart(5)} |   ${hitRate}%`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
