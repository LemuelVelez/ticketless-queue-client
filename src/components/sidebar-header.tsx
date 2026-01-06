"use client"

import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { LayoutDashboard } from "lucide-react"

import logo from "@/assets/images/logo.svg"

type SidebarHeaderProps = {
    className?: string
}

export function SidebarHeader({ className }: SidebarHeaderProps) {
    const { state, isMobile } = useSidebar()
    const collapsed = state === "collapsed" && !isMobile

    return (
        <div className={cn("flex flex-col gap-2 p-2", className)}>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild size="lg" tooltip="QueuePass">
                        <a href="/staff/dashboard" className="flex items-center gap-3">
                            <div className="flex size-9 items-center justify-center rounded-lg border bg-background">
                                <img src={logo} alt="QueuePass" className="h-7 w-7" />
                            </div>

                            <div className={cn("min-w-0 flex-1", collapsed && "hidden")}>
                                <div className="flex items-center gap-2">
                                    <span className="truncate text-sm font-semibold">QueuePass</span>
                                    <Badge variant="secondary" className="hidden lg:inline-flex">
                                        Staff
                                    </Badge>
                                </div>
                                <p className="truncate text-xs text-muted-foreground">Queue operations</p>
                            </div>
                        </a>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>

            <div className={cn("px-1", collapsed && "hidden")}>
                <Button variant="secondary" className="w-full justify-start gap-2" asChild>
                    <a href="/staff/dashboard">
                        <LayoutDashboard className="h-4 w-4" />
                        Open dashboard
                    </a>
                </Button>
            </div>
        </div>
    )
}
