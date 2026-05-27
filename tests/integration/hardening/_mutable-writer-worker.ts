import { approveGapFormalization } from "../../../engine/mission/gap-formalization.ts";

const directiveRoot = process.argv[2];
const formalizationId = process.argv[3];

if (!directiveRoot || !formalizationId) {
  process.stderr.write("Usage: tsx _mutable-writer-worker.ts <directiveRoot> <formalizationId>\n");
  process.exit(1);
}

approveGapFormalization({
  directiveRoot,
  formalizationId,
  operatorRationale: "Integration test concurrent writer.",
  operatorApprovedPriority: "high",
}).then((result) => {
  process.stdout.write(JSON.stringify({ ok: true, gapId: result.newGap?.gap_id ?? null }));
  process.exit(0);
}).catch((err) => {
  process.stdout.write(JSON.stringify({ ok: false, error: String(err) }));
  process.exit(1);
});
