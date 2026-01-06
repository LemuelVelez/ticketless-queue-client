"use client"

import * as React from "react"

import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { NavMain, type NavMainItem } from "@/components/nav-main"
import { SidebarHeader as AppSidebarHeader } from "@/components/sidebar-header"
import { SidebarFooter as AppSidebarFooter } from "@/components/sidebar-footer"
import type { DashboardUser } from "@/components/nav-user"

type DashboardLayoutProps = {
    children: React.ReactNode
    title?: string
    navItems?: NavMainItem[]
    user?: DashboardUser
    headerRightSlot?: React.ReactNode
    /**
     * Use this if you want to force "active" highlighting without relying on window.location.
     * Example: react-router's `useLocation().pathname`
     */
    activePath?: string
}

const DEFAULT_NAV: NavMainItem[] = [
    { title: "Dashboard", href: "/staff/dashboard" },
    { title: "Queue", href: "/staff/queue" },
    { title: "Now Serving", href: "/staff/now-serving" },
    { title: "Reports", href: "/staff/reports" },
    { title: "Settings", href: "/staff/settings" },
]

const DEFAULT_USER: DashboardUser = {
    name: "Staff User",
    email: "staff@example.com",
}

export function DashboardLayout({
    children,
    title = "Dashboard",
    navItems = DEFAULT_NAV,
    user = DEFAULT_USER,
    headerRightSlot,
    activePath,
}: DashboardLayoutProps) {
    return (
        <SidebarProvider defaultOpen>
            <Sidebar variant="inset" collapsible="icon">
                <SidebarHeader>
                    <AppSidebarHeader />
                </SidebarHeader>

                <SidebarContent>
                    <NavMain items={navItems} activePath={activePath} />
                </SidebarContent>

                <SidebarFooter>
                    <AppSidebarFooter user={user} />
                </SidebarFooter>
            </Sidebar>

            <SidebarInset>
                <DashboardHeader title={title}>{headerRightSlot}</DashboardHeader>

                <main className="flex-1 p-4 md:p-6">{children}</main>
            </SidebarInset>
        </SidebarProvider>
    )
}
