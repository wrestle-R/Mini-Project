"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useContractor } from "@/contexts/ContractorContext";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Building2 } from "lucide-react";

import { FiHome, FiLogOut, FiUser, FiFolder } from "react-icons/fi";

/* ─────────────────── Component ─────────────────── */

export function ContractorSidebar() {
  const pathname = usePathname();
  const { user, logout } = useContractor();
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
              <Link href="/contractor/dashboard">
                <Building2 className="h-6 w-6 text-primary shrink-0" />
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
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/contractor/dashboard")}
                  tooltip="Dashboard"
                  className={cn(
                    isActive("/contractor/dashboard") &&
                      "bg-primary/10 text-primary font-medium"
                  )}
                >
                  <Link href="/contractor/dashboard">
                    <FiHome className="h-4 w-4 shrink-0" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/contractor/projects")}
                  tooltip="Projects"
                  className={cn(
                    isActive("/contractor/projects") &&
                      "bg-primary/10 text-primary font-medium"
                  )}
                >
                  <Link href="/contractor/projects">
                    <FiFolder className="h-4 w-4 shrink-0" />
                    <span>Projects</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer ── */}
      <SidebarFooter>
        <div className="px-2 py-1">
          <ThemeToggle fullWidth />
        </div>
        <SidebarSeparator />
        <SidebarMenu>
          {/* Profile */}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive("/contractor/profile")}
              tooltip="Profile"
              className={cn(
                isActive("/contractor/profile")
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted/50"
              )}
            >
              <Link
                href="/contractor/profile"
                className="flex items-center gap-2 w-full"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <FiUser className="h-4 w-4" />
                </div>
                <div className="flex flex-col min-w-0 overflow-hidden">
                  <span className="text-sm font-medium truncate">
                    {displayName}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {email || "View profile"}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Logout */}
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
