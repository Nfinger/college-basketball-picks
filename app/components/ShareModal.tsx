import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Copy, Check, Twitter, Facebook } from "lucide-react";
import { toast } from "sonner";
import { cn } from "~/lib/utils";

interface Team {
  id: string;
  name: string;
  short_name: string;
}

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pickId: string;
  pickedTeam: Team;
  spread: number;
}

export function ShareModal({
  open,
  onOpenChange,
  pickId,
  pickedTeam,
  spread,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  // Generate share URL (will be the current domain + share path)
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/share/potd/${pickId}`
      : "";

  // Format spread for display
  const spreadDisplay =
    spread < 0 ? spread.toString() : `+${spread}`;

  // Share text for social media
  const shareText = `My Pick of the Day: ${pickedTeam.short_name} ${spreadDisplay}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");

      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error("Failed to copy link");
    }
  };

  const handleTwitterShare = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, "_blank", "noopener,noreferrer,width=550,height=420");
  };

  const handleFacebookShare = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(facebookUrl, "_blank", "noopener,noreferrer,width=550,height=420");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Your Pick of the Day</DialogTitle>
          <DialogDescription>
            Share your pick with friends on social media
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              Your pick:
            </p>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {pickedTeam.short_name} {spreadDisplay}
            </p>
          </div>

          {/* Share URL */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md truncate"
              onClick={(e) => e.currentTarget.select()}
            />
            <Button
              onClick={handleCopy}
              size="sm"
              variant="outline"
              className={cn(
                "gap-2 transition-colors",
                copied && "bg-green-50 dark:bg-green-950/30 border-green-500"
              )}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-green-600 dark:text-green-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          </div>

          {/* Social Share Buttons */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Share on social media:
            </p>
            <div className="flex gap-2">
              <Button
                onClick={handleTwitterShare}
                variant="outline"
                className="flex-1 gap-2"
              >
                <Twitter className="h-4 w-4" />
                Twitter
              </Button>
              <Button
                onClick={handleFacebookShare}
                variant="outline"
                className="flex-1 gap-2"
              >
                <Facebook className="h-4 w-4" />
                Facebook
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
