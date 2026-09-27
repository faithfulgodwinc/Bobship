import Link from "next/link";
import { Rocket, Github, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl",
        className
      )}
    >
      <div className="container mx-auto max-w-7xl px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div className="h-7 w-7 rounded-xl bg-system-blue flex items-center justify-center">
            <Rocket className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-base tracking-tight">BobShip</span>
          <span className="text-[10px] font-semibold bg-system-blue/10 text-system-blue px-1.5 py-0.5 rounded-md">
            BETA
          </span>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-accent transition-colors"
          >
            Projects
          </Link>
          <Link
            href="/releases"
            className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-accent transition-colors"
          >
            Releases
          </Link>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Github className="h-4 w-4" />
          </a>
          <Link
            href="/settings"
            className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
