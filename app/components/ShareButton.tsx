import { Share2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface ShareButtonProps {
  onClick: () => void;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
}

export function ShareButton({
  onClick,
  className,
  size = "sm",
  variant = "outline",
}: ShareButtonProps) {
  return (
    <Button
      onClick={onClick}
      size={size}
      variant={variant}
      className={cn("gap-2", className)}
      title="Share Pick of the Day"
    >
      <Share2 className="h-4 w-4" />
      <span className="hidden sm:inline">Share</span>
    </Button>
  );
}
