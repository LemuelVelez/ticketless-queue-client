"use client"

import { cn } from "@/lib/utils"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { LogOut, Settings, User } from "lucide-react"

export type DashboardUser = {
    name: string
    email: string
    avatarUrl?: string
}

type NavUserProps = {
    user: DashboardUser
    className?: string
    accountHref?: string
    settingsHref?: string
    logoutHref?: string

    /**
     * Controls where the dropdown opens.
     * - Sidebar use-case: "right" looks best
     * - Header use-case: "bottom" is expected
     */
    dropdownSide?: "top" | "right" | "bottom" | "left"
    dropdownAlign?: "start" | "center" | "end"
}

function initials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    const a = parts[0]?.[0] ?? ""
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""
    return (a + b).toUpperCase() || "U"
}

export function NavUser({
    user,
    className,
    accountHref = "/staff/account",
    settingsHref = "/staff/settings",
    logoutHref = "/staff/logout",
    dropdownSide = "right",
    dropdownAlign = "end",
}: NavUserProps) {
    const { state, isMobile } = useSidebar()
    const collapsed = state === "collapsed" && !isMobile

    return (
        <SidebarMenu className={className}>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton asChild size="lg" tooltip={user.name}>
                            <Button
                                variant="ghost"
                                className={cn("w-full justify-start gap-3 px-2", collapsed && "justify-center px-0")}
                            >
                                <Avatar className="h-8 w-8">
                                    {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
                                    <AvatarFallback>{initials(user.name)}</AvatarFallback>
                                </Avatar>

                                <div className={cn("min-w-0 flex-1 text-left", collapsed && "hidden")}>
                                    <div className="truncate text-sm font-medium">{user.name}</div>
                                    <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                                </div>
                            </Button>
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                        align={dropdownAlign}
                        side={dropdownSide}
                        sideOffset={8}
                        className="w-56"
                    >
                        <DropdownMenuLabel>Account</DropdownMenuLabel>
                        <DropdownMenuSeparator />

                        <DropdownMenuGroup>
                            <DropdownMenuItem asChild>
                                <a href={accountHref} className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    Profile
                                </a>
                            </DropdownMenuItem>

                            <DropdownMenuItem asChild>
                                <a href={settingsHref} className="flex items-center gap-2">
                                    <Settings className="h-4 w-4" />
                                    Settings
                                </a>
                            </DropdownMenuItem>
                        </DropdownMenuGroup>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem asChild>
                            <a href={logoutHref} className="flex items-center gap-2">
                                <LogOut className="h-4 w-4" />
                                Logout
                            </a>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}
