"use client"

import { cn } from "@/lib/utils"

import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"

import { useSession } from "@/hooks/use-session"

import logo from "@/assets/images/logo.svg"

type SidebarHeaderProps = {
    className?: string
}

export function SidebarHeader({ className }: SidebarHeaderProps) {
    const { state, isMobile } = useSidebar()
    const collapsed = state === "collapsed" && !isMobile

    const { user } = useSession()
    const role = user?.role ?? "STAFF"

    // ✅ Staff link should be /staff/dashboard
    const homeHref = role === "ADMIN" ? "/admin/dashboard" : "/staff/dashboard"

    const roleLabel = role === "ADMIN" ? "Admin" : "Staff"
    const roleSubtitle = role === "ADMIN" ? "Administration" : "Queue operations"

    return (
        <div className={cn("flex flex-col gap-2 p-2", className)}>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild size="lg" tooltip="QueuePass">
                        <a href={homeHref} className="flex items-center gap-3">
                            <div className="flex size-9 items-center justify-center rounded-lg border bg-background">
                                <img src={logo} alt="QueuePass" className="h-7 w-7" />
                            </div>

                            <div className={cn("min-w-0 flex-1", collapsed && "hidden")}>
                                <div className="flex items-center gap-2">
                                    <span className="truncate text-sm font-semibold">QueuePass</span>
                                    <Badge variant="secondary" className="hidden lg:inline-flex">
                                        {roleLabel}
                                    </Badge>
                                </div>
                                <p className="truncate text-xs text-muted-foreground">{roleSubtitle}</p>
                            </div>
                        </a>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </div>
    )
}
