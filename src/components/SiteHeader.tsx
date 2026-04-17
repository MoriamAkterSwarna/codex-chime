import { Sparkles } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const { pathname } = useLocation();
  const isReport = pathname.startsWith("/report");

  return (
    <header className="border-border/40 bg-background/80 sticky top-0 z-40 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="gradient-primary shadow-glow grid h-9 w-9 place-items-center rounded-xl">
            <Sparkles className="text-primary-foreground h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-lg font-bold tracking-tight">
              Grade<span className="text-gradient-primary">flow</span>
            </div>
            <div className="text-muted-foreground -mt-0.5 text-[10px] uppercase tracking-wider">
              AI Project Evaluator
            </div>
          </div>
        </Link>
        <nav className="text-muted-foreground flex items-center gap-6 text-sm">
          <Link
            to="/"
            className={cn(
              "hover:text-foreground transition-colors",
              !isReport && "text-foreground font-medium",
            )}
          >
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}
