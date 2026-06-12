import type { ToolExecutorMap } from "../types.ts";
import { archiveRunRecords } from "../../../engine/maintenance/archive.ts";

export function buildMaintenanceExecutors(opts: { directiveRoot: string }): ToolExecutorMap {
  const maintenanceArchive: ToolExecutorMap["maintenance_archive"] = async (args) => {
    const maxAgeDays = typeof args.max_age_days === "number" ? args.max_age_days : 90;
    const result = await archiveRunRecords(opts.directiveRoot, { maxAgeDays });
    return {
      ok: true,
      archived_count: result.archivedCount,
      archived_files: result.archivedBasenames,
      bytes_moved: result.bytesMoved,
    };
  };

  return { maintenance_archive: maintenanceArchive };
}
