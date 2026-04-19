import {
  submitDirectiveDiscoveryFrontDoor,
  type DirectiveDiscoveryFrontDoorResult,
} from "../../../discovery/lib/discovery-front-door.ts";
import type { DiscoverySubmissionRequest } from "../../../discovery/lib/discovery-submission-router.ts";

export type DiscoveryFrontDoorStarterOptions = {
  directiveRoot: string;
  request: DiscoverySubmissionRequest;
  runtimeArtifactsRoot?: string;
  receivedAt?: string;
};

export async function submitDiscoveryEntryThroughFrontDoor(
  input: DiscoveryFrontDoorStarterOptions,
): Promise<DirectiveDiscoveryFrontDoorResult> {
  return submitDirectiveDiscoveryFrontDoor({
    directiveRoot: input.directiveRoot,
    request: input.request,
    runtimeArtifactsRoot: input.runtimeArtifactsRoot,
    receivedAt: input.receivedAt,
  });
}
