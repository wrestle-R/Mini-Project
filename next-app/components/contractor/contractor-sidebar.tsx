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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ThemeToggle } from "@/components/shared/theme-toggle";

import {
  FiHome,
  FiFolder,
  FiCheckSquare,
  FiClipboard,
  FiUsers,
  FiPackage,
  FiFileText,
  FiChevronRight,
  FiLogOut,
  FiUser,
  FiTool,
} from "react-icons/fi";

/* ─────────────────── Nav config types ─────────────────── */

interface NavSubItem {
  title: string;
  href: string;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  subItems?: NavSubItem[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/* ─────────────────── Contractor nav items ───────────── */

const contractorNavGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/contractor/dashboard", icon: FiHome },
    ],
  },

];

/* ─────────────────── Component ─────────────────── */

export function ContractorSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const { user, clearUser } = useUser();
  const { firstName, lastName, email } = user;
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") || "My Profile";

  const isActive = (url: string, hasChildren = false) => {
    if (pathname === url) return true;
    if (hasChildren) return pathname.startsWith(url + "/");
    return false;
  };

  const isGroupOpen = (item: NavItem) => {
    if (isActive(item.href, true)) return true;
    if (item.subItems) {
      return item.subItems.some((sub) => pathname === sub.href);
    }
    return false;
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      {/* ── Header ── */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="BuildSync">
              <Link href="/contractor/dashboard">
                <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-md">
                  <FiTool className="h-4 w-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">BuildSync</span>
                  <span className="text-xs text-muted-foreground">
                    Contractor
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* ── Content ── */}
      <SidebarContent>
        {contractorNavGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/70 font-semibold">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) =>
                  item.subItems ? (
                    <Collapsible
                      key={item.title}
                      asChild
                      defaultOpen={isGroupOpen(item)}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            isActive={isActive(item.href, true)}
                            tooltip={item.title}
                            className={cn(
                              "cursor-pointer",
                              state === "expanded" &&
                                isActive(item.href, true) &&
                                "bg-primary/10 border-l-4 border-primary pl-2 font-medium"
                            )}
                          >
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                            <FiChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub className="border-l-primary/30">
                            {item.subItems.map((sub) => (
                              <SidebarMenuSubItem key={sub.href}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={pathname === sub.href}
                                  className={cn(
                                    "transition-colors",
                                    pathname === sub.href
                                      ? "bg-primary/10 text-primary font-medium"
                                      : "hover:bg-muted/50"
                                  )}
                                >
                                  <Link href={sub.href}>{sub.title}</Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  ) : (
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
                  )
                )}
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
              isActive={isActive("/contractor/profile")}
              tooltip="Profile"
              className={cn(
                "w-full h-auto py-2.5",
                isActive("/contractor/profile")
                  ? "bg-primary/10 border-l-4 border-primary"
                  : "hover:bg-muted/50"
              )}
            >
              <Link
                href="/contractor/profile"
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
