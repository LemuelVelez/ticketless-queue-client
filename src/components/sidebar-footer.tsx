"use client"

import { cn } from "@/lib/utils"

import { Separator } from "@/components/ui/separator"
import { NavUser, type DashboardUser } from "@/components/nav-user"
import { useSidebar } from "@/components/ui/sidebar"

type SidebarFooterProps = {
    user: DashboardUser
    className?: string
}

export function SidebarFooter({ user, className }: SidebarFooterProps) {
    const { state, isMobile } = useSidebar()
    const collapsed = state === "collapsed" && !isMobile

    return (
        <div
            className={cn(
                "p-2",
                // match NavMain alignment when collapsed
                collapsed && "px-1",
                className,
            )}
        >
            <Separator className="mb-2" />
            <NavUser user={user} />
        </div>
    )
}
