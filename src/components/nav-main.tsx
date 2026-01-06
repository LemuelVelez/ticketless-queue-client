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

import {
    BarChart3,
    Monitor,
    Settings,
    Ticket,
    Users,
    LayoutDashboard,
    Building2,
    LayoutGrid,
    ShieldCheck,
    Megaphone,
} from "lucide-react"

export type NavMainItem = {
    title: string
    href: string
    icon?: React.ComponentType<{ className?: string }>
    badge?: React.ReactNode
    items?: Array<{ title: string; href: string }>
}

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

/**
 * NOTE:
 * These are intentionally NOT exported to satisfy:
 * eslint(react-refresh/only-export-components)
 * Fast Refresh works best when a file only exports React components at runtime.
 */
const STAFF_NAV_ITEMS: NavMainItem[] = [
    { title: "Dashboard", href: "/staff/dashboard", icon: LayoutDashboard },
    { title: "Queue", href: "/staff/queue", icon: Ticket },
    { title: "Now Serving", href: "/staff/now-serving", icon: Megaphone },
    { title: "Public Display", href: "/display", icon: Monitor },
    { title: "Reports", href: "/staff/reports", icon: BarChart3 },
    { title: "Settings", href: "/staff/settings", icon: Settings },
]

const ADMIN_NAV_ITEMS: NavMainItem[] = [
    { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { title: "Departments", href: "/admin/departments", icon: Building2 },
    { title: "Windows", href: "/admin/windows", icon: LayoutGrid },
    { title: "Staff Accounts", href: "/admin/staff", icon: Users },
    { title: "Reports", href: "/admin/reports", icon: BarChart3 },
    { title: "Audit Logs", href: "/admin/audit-logs", icon: ShieldCheck },
    { title: "Settings", href: "/admin/settings", icon: Settings },
]

function normalizePath(input: string) {
    // Remove trailing slashes, ignore query/hash
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

        // Back/forward
        window.addEventListener("popstate", update)
        return () => window.removeEventListener("popstate", update)
    }, [activePath])

    const resolvedRole = React.useMemo<NavRole>(() => {
        if (role) return role
        // Prefer activePath when provided (router-based apps)
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
