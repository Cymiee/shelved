import { useState } from "react";
import type { ShelfStats } from "../lib/stats";
import { renderReceiptImage } from "../lib/receiptImage";
import { formatHoursTotal } from "../lib/format";
import { useToastStore } from "../store/toast";

interface Props {
  username: string;
  userId: string;
  stats: ShelfStats;
}

/**
 * Turns the stats receipt into an image and hands it to the phone's share
 * sheet. Where a browser can't share files (most desktops), it downloads the
 * image instead, and the button says so up front.
 */
export default function ShareReceiptButton({ username, userId, stats }: Props) {
  const showToast = useToastStore((s) => s.show);
  const [working, setWorking] = useState(false);

  const probe = typeof navigator !== "undefined" && typeof navigator.canShare === "function"
    ? new File([new Blob()], "probe.png", { type: "image/png" })
    : null;
  const canShareFiles = probe !== null && navigator.canShare({ files: [probe] });

  const handleClick = async () => {
    setWorking(true);
    try {
      const blob = await renderReceiptImage(username, stats);
      const file = new File([blob], `shelved-${username}.png`, { type: "image/png" });
      const url = `${window.location.origin}/profile/${userId}`;
      const text = `My Shelved receipt: ${stats.onShelf} games` + (stats.minutes > 0 ? `, ${formatHoursTotal(stats.minutes)} played.` : ".");

      if (canShareFiles && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "My Shelved receipt", text, url });
        } catch (err) {
          // Closing the share sheet is a choice, not a failure.
          if (err instanceof DOMException && err.name === "AbortError") return;
          throw err;
        }
        return;
      }

      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
      showToast("Receipt image saved to your downloads");
    } catch {
      showToast("Couldn't make the image. Try again.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <button type="button" className="btn-key" disabled={working} onClick={() => { void handleClick(); }}>
      {working ? "Printing…" : canShareFiles ? "Share receipt" : "Download receipt"}
    </button>
  );
}
