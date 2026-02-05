"use client"

import * as React from "react"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarInset,
    SidebarProvider,
} from "@/components/ui/sidebar"

import { DashboardHeader } from "@/components/dashboard-header"
import { NavMain } from "@/components/nav-main"
import { STAFF_NAV_ITEMS, type NavMainItem } from "@/components/dashboard-nav"
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

    /**
     * Optional overrides for NavUser links in the header dropdown
     */
    accountHref?: string
    settingsHref?: string
    logoutHref?: string
}

const DEFAULT_USER: DashboardUser = {
    name: "Staff User",
    email: "staff@example.com",
}

export function DashboardLayout({
    children,
    title = "Dashboard",
    navItems = STAFF_NAV_ITEMS,
    user = DEFAULT_USER,
    headerRightSlot,
    activePath,
    accountHref,
    settingsHref,
    logoutHref,
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

            <SidebarInset className="min-w-0">
                <DashboardHeader
                    title={title}
                    user={user}
                    accountHref={accountHref}
                    settingsHref={settingsHref}
                    logoutHref={logoutHref}
                >
                    {headerRightSlot}
                </DashboardHeader>

                <main className="flex-1 p-4 md:p-6 min-w-0">{children}</main>
            </SidebarInset>
        </SidebarProvider>
    )
}
