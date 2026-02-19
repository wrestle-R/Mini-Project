"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUser } from "@/contexts/UserContext";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/shared/theme-toggle";

import {
  FiHome,
  FiCheckSquare,
  FiClipboard,
  FiUsers,
  FiLogOut,
  FiUser,
  FiTool,
} from "react-icons/fi";

/* ─────────────────── Nav config types ─────────────────── */

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/* ─────────────────── Worker nav items ─────────────────── */

const workerNavGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/dashboard", icon: FiHome }],
  },
  {
    label: "Field Work",
    items: [
      { title: "Tasks", href: "/tasks", icon: FiCheckSquare },
      { title: "DPR", href: "/dpr", icon: FiClipboard },
      { title: "Attendance", href: "/attendance", icon: FiUsers },
    ],
  },
];

/* ─────────────────── Component ─────────────────── */

export function WorkerSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const { user, clearUser } = useUser();
  const { firstName, lastName, email } = user;
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") || "My Profile";

  const isActive = (url: string) => pathname === url;

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      {/* ── Header ── */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="BuildSync">
              <Link href="/dashboard">
                <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-md">
                  <FiTool className="h-4 w-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">BuildSync</span>
                  <span className="text-xs text-muted-foreground">Worker</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* ── Content ── */}
      <SidebarContent>
        {workerNavGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/70 font-semibold">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      tooltip={item.title}
                      className={cn(
                        state === "expanded" &&
                          isActive(item.href) &&
                          "bg-primary/10 border-l-4 border-primary pl-2 font-medium"
                      )}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* ── Footer ── */}
      <SidebarFooter>
        {state === "expanded" && (
          <div className="flex items-center justify-center px-3 py-2">
            <ThemeToggle />
          </div>
        )}
        <SidebarSeparator />
        <SidebarMenu>
          {/* Profile */}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive("/profile")}
              tooltip="Profile"
              className={cn(
                "w-full h-auto py-2.5",
                isActive("/profile")
                  ? "bg-primary/10 border-l-4 border-primary"
                  : "hover:bg-muted/50"
              )}
            >
              <Link
                href="/profile"
                className="flex items-center gap-3 w-full"
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary",
                    state === "collapsed" && "h-6 w-6"
                  )}
                >
                  <FiUser className="h-4 w-4" />
                </div>
                {state === "expanded" && (
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">
                      {displayName}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {email || "View profile"}
                    </span>
                  </div>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Logout */}
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign Out"
              onClick={clearUser}
              className="w-full mb-2 cursor-pointer text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <FiLogOut
                className={cn("h-4 w-4", state === "expanded" && "ml-2")}
              />
              {state === "expanded" && (
                <span className="font-medium">Logout</span>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
