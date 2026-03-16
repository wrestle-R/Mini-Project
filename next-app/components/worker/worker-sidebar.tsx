"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useWorker } from "@/contexts/WorkerContext";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

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
import { Building2, Sun, Moon, ChevronUp, LogOut, User } from "lucide-react";

import { FiHome, FiFolder } from "react-icons/fi";

/* ─────────────────── Component ─────────────────── */

export function WorkerSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const { user, clearUser } = useWorker();
  const { firstName, lastName, email, photoUrl } = user;
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") || "My Profile";
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const isActive = (url: string) => pathname === url;
  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      {/* ── Header ── */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="BuildSync">
              <Link href="/dashboard">
                <Building2 className="h-6 w-6 text-primary shrink-0" />
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
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/dashboard")}
                  tooltip="Dashboard"
                  className={cn(
                    isActive("/dashboard") &&
                      "bg-primary/10 text-primary font-medium"
                  )}
                >
                  <Link href="/dashboard">
                    <FiHome className="h-4 w-4 shrink-0" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/projects")}
                  tooltip="Projects"
                  className={cn(
                    isActive("/projects") &&
                      "bg-primary/10 text-primary font-medium"
                  )}
                >
                  <Link href="/projects">
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
                  <Link href="/profile" className="flex items-center w-full cursor-pointer py-2 px-3">
                    <User className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>My Profile</span>
                  </Link>
                </DropdownMenuItem>
                {mounted && (
                  <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer py-2 px-3">
                    {resolvedTheme === "dark"
                      ? <Sun className="mr-2 h-4 w-4 text-muted-foreground" />
                      : <Moon className="mr-2 h-4 w-4 text-muted-foreground" />
                    }
                    <span>Change Look ({resolvedTheme === "dark" ? "Light" : "Dark"})</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem
                  onClick={clearUser}
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
