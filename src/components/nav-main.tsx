"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "@/components/ui/sidebar"

import { ADMIN_NAV_ITEMS, STAFF_NAV_ITEMS, type NavMainItem } from "@/components/dashboard-nav"

export type NavRole = "staff" | "admin"

type NavMainProps = {
    /**
     * If provided, NavMain will render these items (manual mode).
     * If omitted or empty, it will auto-pick defaults based on role or URL (/admin vs /staff).
     */
    items?: NavMainItem[]
    className?: string
    activePath?: string
    /**
     * Optional group label. If omitted, it becomes "Staff" or "Admin" automatically.
     */
    label?: string
    /**
     * Optional explicit role. If omitted, role is inferred from the current path:
     *   /admin/* => admin
     *   otherwise => staff
     */
    role?: NavRole
}

function normalizePath(input: string) {
    const base = input.split("?")[0]?.split("#")[0] ?? input
    return base.length > 1 ? base.replace(/\/+$/, "") : base
}

function inferRoleFromPath(pathname: string): NavRole {
    const p = normalizePath(pathname || "")
    if (p.startsWith("/admin")) return "admin"
    return "staff"
}

export function NavMain({ items, className, activePath, label, role }: NavMainProps) {
    const [path, setPath] = React.useState<string>(() => {
        if (activePath) return normalizePath(activePath)
        if (typeof window === "undefined") return ""
        return normalizePath(window.location.pathname)
    })

    React.useEffect(() => {
        if (activePath) {
            setPath(normalizePath(activePath))
            return
        }
        if (typeof window === "undefined") return

        const update = () => setPath(normalizePath(window.location.pathname))
        update()

        window.addEventListener("popstate", update)
        return () => window.removeEventListener("popstate", update)
    }, [activePath])

    const resolvedRole = React.useMemo<NavRole>(() => {
        if (role) return role
        return inferRoleFromPath(activePath ?? path)
    }, [role, activePath, path])

    const resolvedItems = React.useMemo<NavMainItem[]>(() => {
        if (items && items.length > 0) return items
        return resolvedRole === "admin" ? ADMIN_NAV_ITEMS : STAFF_NAV_ITEMS
    }, [items, resolvedRole])

    const groupLabel = label ?? (resolvedRole === "admin" ? "Admin" : "Staff")

    const isActive = (href: string) => {
        const h = normalizePath(href)
        if (!h) return false
        if (!path) return false
        if (h === "/") return path === "/"
        return path === h || path.startsWith(h + "/")
    }

    return (
        <SidebarGroup className={className}>
            <SidebarGroupLabel>{groupLabel}</SidebarGroupLabel>

            <SidebarGroupContent>
                <SidebarMenu>
                    {resolvedItems.map((item) => {
                        const Icon = item.icon
                        const active = isActive(item.href)

                        return (
                            <SidebarMenuItem key={item.href}>
                                <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                                    <a href={item.href} className="flex items-center gap-2">
                                        {Icon ? <Icon className="h-4 w-4" /> : null}
                                        <span className={cn("flex-1 truncate")}>{item.title}</span>
                                        {item.badge ? <span className="ml-auto">{item.badge}</span> : null}
                                    </a>
                                </SidebarMenuButton>

                                {item.items?.length ? (
                                    <SidebarMenuSub>
                                        {item.items.map((sub) => {
                                            const subActive = isActive(sub.href)
                                            return (
                                                <SidebarMenuSubItem key={sub.href}>
                                                    <SidebarMenuSubButton href={sub.href} isActive={subActive}>
                                                        {sub.title}
                                                    </SidebarMenuSubButton>
                                                </SidebarMenuSubItem>
                                            )
                                        })}
                                    </SidebarMenuSub>
                                ) : null}
                            </SidebarMenuItem>
                        )
                    })}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    )
}
