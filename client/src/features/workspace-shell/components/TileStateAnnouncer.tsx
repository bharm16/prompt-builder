import React, { useEffect, useState } from "react";
import type { Shot } from "../utils/groupShots";

export interface TileStateAnnouncerProps {
  shots: ReadonlyArray<Shot>;
}

/**
 * Single aria-live="polite" region that announces the active shot's
 * aggregate status. Per spec §9, this is anchored at the workspace
 * level — not per-tile — to avoid screen reader spam during a shot
 * with multiple variants resolving in quick succession.
 */
export function TileStateAnnouncer({
  shots,
}: TileStateAnnouncerProps): React.ReactElement {
  const activeStatus = shots[0]?.status;
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!activeStatus) {
      setMessage("");
      return;
    }
    setMessage(buildMessage(activeStatus));
  }, [activeStatus]);

  return (
    <div role="status" aria-live="polite" className="sr-only">
      {message}
    </div>
  );
}

function buildMessage(status: Shot["status"]): string {
  switch (status) {
    case "ready":
      return "Active shot ready";
    case "rendering":
      return "Active shot rendering";
    case "queued":
      return "Active shot queued";
    case "failed":
      return "Active shot failed";
    case "mixed":
      return "Active shot variants ready";
    default:
      return "";
  }
}
