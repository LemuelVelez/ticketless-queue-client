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

import { BarChart3, Monitor, Settings, Ticket, Users, LayoutDashboard } from "lucide-react"

export type NavMainItem = {
    title: string
    href: string
    icon?: React.ComponentType<{ className?: string }>
    badge?: React.ReactNode
    items?: Array<{ title: string; href: string }>
}

type NavMainProps = {
    items?: NavMainItem[]
    className?: string
    activePath?: string
    label?: string
}

const DEFAULT_ITEMS: NavMainItem[] = [
    { title: "Dashboard", href: "/staff/dashboard", icon: LayoutDashboard },
    { title: "Queue", href: "/staff/queue", icon: Ticket },
    { title: "Public Display", href: "/display", icon: Monitor },
    { title: "Staff", href: "/staff/users", icon: Users },
    { title: "Reports", href: "/staff/reports", icon: BarChart3 },
    { title: "Settings", href: "/staff/settings", icon: Settings },
]

function normalizePath(input: string) {
    // Remove trailing slashes, ignore query/hash
    const base = input.split("?")[0]?.split("#")[0] ?? input
    return base.length > 1 ? base.replace(/\/+$/, "") : base
}

export function NavMain({ items = DEFAULT_ITEMS, className, activePath, label = "Main" }: NavMainProps) {
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

    const isActive = (href: string) => {
        const h = normalizePath(href)
        if (!h) return false
        if (!path) return false
        if (h === "/") return path === "/"
        return path === h || path.startsWith(h + "/")
    }

    return (
        <SidebarGroup className={className}>
            <SidebarGroupLabel>{label}</SidebarGroupLabel>

            <SidebarGroupContent>
                <SidebarMenu>
                    {items.map((item) => {
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
