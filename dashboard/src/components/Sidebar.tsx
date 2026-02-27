import { useState } from "react";
import { Link, useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { FolderKanban, Menu, Eye } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    label: "Projects",
    href: "/",
    icon: <FolderKanban className="h-4 w-4" />,
  },
];

export function Sidebar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  const nav = (
    <>
      {/* Brand */}
      <div className="flex items-center gap-2 px-4 py-5">
        <Eye className="h-6 w-6 text-primary" />
        <span className="font-serif text-lg font-bold">
          TrueSight
        </span>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive(item.href)
                ? "border-l-2 border-primary bg-primary/8 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      <Separator />

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-xs text-muted-foreground">
          TrueSight v0.1.0
        </p>
        <ThemeToggle />
      </div>
    </>
  );

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="outline"
        size="icon"
        className="fixed left-4 top-4 z-50 lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile sidebar - Sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex w-60 flex-col p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Main navigation menu</SheetDescription>
          </SheetHeader>
          {nav}
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r bg-card lg:flex lg:flex-col">
        {nav}
      </aside>
    </>
  );
}
