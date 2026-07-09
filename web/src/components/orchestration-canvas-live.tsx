"use client";

import { OrchestrationCanvas, type OrchestrationNode } from "./orchestration-canvas";
import { useZoomRemountKey } from "./use-zoom-remount-key";

// Thin client wrapper: forces OrchestrationCanvas to fully remount when the
// browser's zoom level changes, so its heavily-animated subtree always gets
// a fresh GPU compositing layer at the correct scale (see
// use-zoom-remount-key.ts for why this is necessary).
export function OrchestrationCanvasLive({ nodes }: { nodes: OrchestrationNode[] }) {
  const zoomKey = useZoomRemountKey();
  return <OrchestrationCanvas key={zoomKey} nodes={nodes} />;
}
