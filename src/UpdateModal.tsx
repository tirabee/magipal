import { useState } from "react";
import type { Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type Stage =
  | { kind: "offer" }
  | { kind: "downloading"; percent: number | null }
  | { kind: "done" }
  | { kind: "failed"; message: string };

export function UpdateModal({
  update,
  onDismiss,
}: {
  update: Update;
  onDismiss: () => void;
}) {
  const [stage, setStage] = useState<Stage>({ kind: "offer" });

  const install = async () => {
    setStage({ kind: "downloading", percent: null });
    try {
      // The server may not send a length, in which case we can't show a
      // percentage -- fall back to an indeterminate message rather than lying.
      let total = 0;
      let received = 0;

      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          received += event.data.chunkLength;
          setStage({
            kind: "downloading",
            percent: total > 0 ? Math.round((received / total) * 100) : null,
          });
        }
      });

      setStage({ kind: "done" });
    } catch (e) {
      setStage({ kind: "failed", message: String(e) });
    }
  };

  const busy = stage.kind === "downloading";

  return (
    <div
      className="modal-overlay"
      onClick={busy ? undefined : onDismiss}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-titlebar">
          <span className="modal-title">Update available</span>
          {!busy && (
            <button className="modal-close" onClick={onDismiss}>
              ×
            </button>
          )}
        </div>

        <div className="tab-content">
          <div className="update-version">
            Magipal <strong>{update.version}</strong> is available.
            {update.currentVersion && (
              <span className="update-current">
                {" "}
                You have {update.currentVersion}.
              </span>
            )}
          </div>

          {update.body && <div className="update-notes">{update.body}</div>}

          {stage.kind === "downloading" && (
            <div className="update-status">
              {stage.percent === null
                ? "Downloading…"
                : `Downloading… ${stage.percent}%`}
            </div>
          )}

          {stage.kind === "failed" && (
            <div className="update-status update-status-error">
              Update failed: {stage.message}
              <div className="tab-description">
                Your palettes are untouched. You can keep using this version and
                try again later.
              </div>
            </div>
          )}

          {stage.kind === "done" && (
            <div className="update-status">
              Installed. Magipal needs to restart to finish.
            </div>
          )}

          <div className="picker-actions">
            {stage.kind === "done" ? (
              <button className="btn btn-accent" onClick={() => relaunch()}>
                Restart now
              </button>
            ) : (
              <>
                <button className="btn" onClick={onDismiss} disabled={busy}>
                  Later
                </button>
                <button
                  className="btn btn-accent"
                  onClick={install}
                  disabled={busy}
                >
                  {stage.kind === "failed" ? "Try again" : "Update now"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
