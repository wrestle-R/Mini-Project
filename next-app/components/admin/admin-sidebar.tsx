"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAdmin } from "@/contexts/AdminContext";

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
import { GoogleTranslateLanguageSelector } from "@/components/shared/google-translate";
import { Shield, ChevronRight, Building2 } from "lucide-react";
import { FiHome, FiLogOut } from "react-icons/fi";

interface NavSubItem {
  label: string;
  href: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  subItems?: NavSubItem[];
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/admin/dashboard",
    icon: FiHome,
  },
  {
    label: "Companies",
    href: "/admin/companies",
    icon: Building2,
    subItems: [
      { label: "All Companies", href: "/admin/companies" },
      { label: "Create Company", href: "/admin/companies/create" },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { logout } = useAdmin();
  const { state } = useSidebar();

  const isActive = (href: string, exact = false) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  const isGroupOpen = (item: NavItem) => {
    if (isActive(item.href)) return true;
    if (item.subItems) {
      return item.subItems.some((sub) => pathname === sub.href);
    }
    return false;
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Admin Panel">
              <Link href="/admin/dashboard">
                <Shield className="h-6 w-6 text-primary shrink-0" />
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">InfraSaathi</span>
                  <span className="text-xs text-muted-foreground">Admin</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) =>
                item.subItems ? (
                  <Collapsible
                    key={item.label}
                    asChild
                    defaultOpen={isGroupOpen(item)}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          isActive={isActive(item.href)}
                          tooltip={item.label}
                          className={cn(
                            "cursor-pointer",
                            isActive(item.href) &&
                              "bg-primary/10 text-primary font-medium"
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                          <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <SidebarMenuSub>
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
                                <Link href={sub.href}>{sub.label}</Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ) : (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href, true)}
                      tooltip={item.label}
                      className={cn(
                        isActive(item.href, true) &&
                          "bg-primary/10 text-primary font-medium"
                      )}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="space-y-2 px-2 py-1">
          <ThemeToggle fullWidth={state === "expanded"} />
          <GoogleTranslateLanguageSelector
            variant="sidebar"
            compact={state === "collapsed"}
          />
        </div>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign Out"
              onClick={logout}
              className="w-full mb-2 cursor-pointer text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <FiLogOut className="h-4 w-4 shrink-0" />
              <span className="font-medium">Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
