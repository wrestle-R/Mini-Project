"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useCompany } from "@/contexts/CompanyContext";

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
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Building2 } from "lucide-react";
import {
  FiHome,
  FiLogOut,
  FiUser,
  FiFolder,
  FiUserPlus,
  FiClipboard,
  FiCamera,
} from "react-icons/fi";

export function CompanySidebar() {
  const pathname = usePathname();
  const { user, logout } = useCompany();
  const displayName = user.name || "Company";

  const isActive = (url: string) => pathname === url;

  const navItems = [
    { label: "Dashboard", href: "/company/dashboard", icon: FiHome },
    { label: "Projects", href: "/company/projects", icon: FiFolder },
    { label: "Contractors", href: "/company/contractors", icon: FiUserPlus },
    { label: "Assignments", href: "/company/assignments", icon: FiClipboard },
    { label: "Attendance Cam", href: "/company/attendance-cam", icon: FiCamera },
  ];

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="BuildSync">
              <Link href="/company/dashboard">
                <Building2 className="h-6 w-6 text-primary shrink-0" />
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">BuildSync</span>
                  <span className="text-xs text-muted-foreground">Company</span>
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
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                    className={cn(
                      isActive(item.href) &&
                        "bg-primary/10 text-primary font-medium"
                    )}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 py-1">
          <ThemeToggle fullWidth />
        </div>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive("/company/profile")}
              tooltip="Profile"
              className={cn(
                isActive("/company/profile")
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted/50"
              )}
            >
              <Link
                href="/company/profile"
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
                    {user.email || "View profile"}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

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
