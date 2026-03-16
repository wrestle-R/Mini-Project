"use client";

import React, { Fragment } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const labelMap: Record<string, string> = {
  company: "Company",
  dashboard: "Dashboard",
  projects: "Projects",
  profile: "Profile",
  customers: "Customers",
  contractors: "Contractors",
  assignments: "Assignments",
};

export function Topbar() {
  const pathname = usePathname();
  // Company routes: /company/dashboard, /company/projects, /company/profile, etc.
  const segments = pathname.split("/").filter(Boolean);

  const crumbs: { href: string; label: string }[] = [];

  // Always start with "Home" pointing to company dashboard
  crumbs.push({ href: "/company/dashboard", label: "Home" });

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label =
      labelMap[seg] ||
      seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    // Skip the "company" segment (redundant, Home already covers the root)
    if (seg === "company") continue;

    if (seg === "dashboard") {
      // Skip "Dashboard" when it's the landing page — Home covers it
      if (segments.length > 2) {
        crumbs.push({ href, label });
      }
    } else if (/^[a-f0-9]{24}$/.test(seg)) {
      crumbs.push({ href, label: "Details" });
    } else {
      crumbs.push({ href, label });
    }
  }

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-4 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger className="-ml-1 p-2" />
      <Separator orientation="vertical" className="mr-2 !h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((item, index) => {
            const isLast = index === crumbs.length - 1;
            return (
              <Fragment key={item.href + index}>
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={item.href}>{item.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}
