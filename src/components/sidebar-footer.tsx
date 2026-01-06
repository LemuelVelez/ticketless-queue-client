"use client"

import { cn } from "@/lib/utils"

import { Separator } from "@/components/ui/separator"
import { NavUser, type DashboardUser } from "@/components/nav-user"

type SidebarFooterProps = {
    user: DashboardUser
    className?: string
}

export function SidebarFooter({ user, className }: SidebarFooterProps) {
    return (
        <div className={cn("p-2", className)}>
            <Separator className="mb-2" />
            <NavUser user={user} />
        </div>
    )
}
