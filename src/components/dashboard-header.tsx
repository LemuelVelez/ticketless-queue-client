"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

type DashboardHeaderProps = {
    title?: string
    className?: string
    children?: React.ReactNode
}

export function DashboardHeader({ title = "Dashboard", className, children }: DashboardHeaderProps) {
    return (
        <header
            className={cn(
                "sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60",
                className
            )}
        >
            <div className="flex h-14 items-center gap-2 px-3 md:px-6">
                <SidebarTrigger />

                <Separator orientation="vertical" className="mx-1 h-6" />

                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-sm font-semibold md:text-base">{title}</h1>
                </div>

                <div className="hidden w-70 md:block">
                    <Input placeholder="Search…" />
                </div>

                {children ? <div className="ml-1 flex items-center gap-2">{children}</div> : null}
            </div>
        </header>
    )
}
