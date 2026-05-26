import {
  submitDirectiveDiscoveryFrontDoor,
  type DiscoveryFrontDoorResult,
} from "../../../discovery/lib/front-door/front-door.ts";
import type { DiscoverySubmissionRequest } from "../../../discovery/lib/front-door/submission-router.ts";

export type DiscoveryFrontDoorStarterOptions = {
  directiveRoot: string;
  request: DiscoverySubmissionRequest;
  runtimeArtifactsRoot?: string;
  receivedAt?: string;
};

export async function submitDiscoveryEntryThroughFrontDoor(
  input: DiscoveryFrontDoorStarterOptions,
): Promise<DiscoveryFrontDoorResult> {
  return submitDirectiveDiscoveryFrontDoor({
    directiveRoot: input.directiveRoot,
    request: input.request,
    runtimeArtifactsRoot: input.runtimeArtifactsRoot,
    receivedAt: input.receivedAt,
  });
}
