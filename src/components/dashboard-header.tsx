"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { NavUser, type DashboardUser } from "@/components/nav-user"

type DashboardHeaderProps = {
    title?: string
    className?: string
    /**
     * Optional slot for right-side actions (buttons, etc.)
     */
    children?: React.ReactNode
    /**
     * If provided, renders the user dropdown on the right side.
     */
    user?: DashboardUser
    /**
     * Optional overrides for NavUser links
     */
    accountHref?: string
    settingsHref?: string
    logoutHref?: string
}

export function DashboardHeader({
    title = "Dashboard",
    className,
    children,
    user,
    accountHref,
    settingsHref,
    logoutHref,
}: DashboardHeaderProps) {
    return (
        <header
            className={cn(
                "sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60",
                className,
            )}
        >
            <div className="flex h-14 items-center gap-2 px-3 md:px-6">
                <SidebarTrigger />

                <Separator orientation="vertical" className="mx-1 h-6" />

                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-sm font-semibold md:text-base">{title}</h1>
                </div>

                {children ? <div className="ml-1 flex items-center gap-2">{children}</div> : null}

                {user ? (
                    <div className="ml-2">
                        <NavUser
                            user={user}
                            accountHref={accountHref}
                            settingsHref={settingsHref}
                            logoutHref={logoutHref}
                            dropdownSide="bottom"
                            dropdownAlign="end"
                        />
                    </div>
                ) : null}
            </div>
        </header>
    )
}
