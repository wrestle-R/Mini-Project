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
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Building2, ChevronUp, LogOut, User } from "lucide-react";
import { GoogleTranslateLanguageSelector } from "@/components/shared/google-translate";
import { ThemeToggle } from "@/components/shared/theme-toggle";

import { FiHome, FiFolder, FiBox, FiFileText, FiPackage } from "react-icons/fi";

/* ─────────────────── Component ─────────────────── */

export function ContractorSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const { user, logout } = useContractor();
  const { firstName, lastName, email, photoUrl } = user;
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") || "My Profile";

  const isActive = (url: string) => pathname === url || pathname.startsWith(url + "/");

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
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/contractor/ifc-viewer")}
                  tooltip="IFC Studio"
                  className={cn(
                    isActive("/contractor/ifc-viewer") &&
                      "bg-primary/10 text-primary font-medium"
                  )}
                >
                  <Link href="/contractor/ifc-viewer">
                    <FiBox className="h-4 w-4 shrink-0" />
                    <span>IFC Studio</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/contractor/materials")}
                  tooltip="Materials"
                  className={cn(
                    isActive("/contractor/materials") &&
                      "bg-primary/10 text-primary font-medium"
                  )}
                >
                  <Link href="/contractor/materials">
                    <FiPackage className="h-4 w-4 shrink-0" />
                    <span>Materials</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/contractor/daily-reports")}
                  tooltip="Daily Reports"
                  className={cn(
                    isActive("/contractor/daily-reports") &&
                      "bg-primary/10 text-primary font-medium"
                  )}
                >
                  <Link href="/contractor/daily-reports">
                    <FiFileText className="h-4 w-4 shrink-0" />
                    <span>Daily Reports</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer ── */}
      <SidebarFooter>
        <div className="space-y-2 px-2 pb-2">
          <ThemeToggle fullWidth={state === "expanded"} />
          <GoogleTranslateLanguageSelector
            variant="sidebar"
            compact={state === "collapsed"}
          />
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip="Account"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground outline-none ring-0"
                >
                  <Avatar className="h-8 w-8 rounded-full shrink-0">
                    <AvatarImage src={photoUrl || ""} alt={displayName} />
                    <AvatarFallback className="rounded-full">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  {state === "expanded" && (
                    <div className="grid flex-1 text-left text-sm leading-tight ml-2 min-w-0">
                      <span className="truncate font-semibold">{displayName}</span>
                      <span className="truncate text-xs text-muted-foreground">{email || ""}</span>
                    </div>
                  )}
                  {state === "expanded" && (
                    <ChevronUp className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  )}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg mb-2"
                side={state === "collapsed" ? "right" : "bottom"}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem asChild>
                  <Link href="/contractor/profile" className="flex items-center w-full cursor-pointer py-2 px-3">
                    <User className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>My Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem
                  onClick={logout}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer py-2 px-3"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span className="font-medium text-destructive">Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
