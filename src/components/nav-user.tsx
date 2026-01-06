"use client"

import * as React from "react"
import { useNavigate } from "react-router-dom"

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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { LogOut, Settings } from "lucide-react"

import { useSession } from "@/hooks/use-session"
import { clearAuthUser } from "@/lib/auth"

export type DashboardUser = {
    name: string
    email: string
    avatarUrl?: string
}

type NavUserProps = {
    user: DashboardUser
    className?: string
    settingsHref?: string
    /**
     * Where to navigate after logout confirmation.
     * Default: /login
     */
    logoutHref?: string

    /**
     * Controls where the dropdown opens.
     * - Sidebar use-case: "right" looks best
     * - Header use-case: "bottom" is expected
     */
    dropdownSide?: "top" | "right" | "bottom" | "left"
    dropdownAlign?: "start" | "center" | "end"

    /**
     * If true, show only the avatar on mobile (desktop remains unchanged).
     * Useful for header mobile layout.
     */
    compactOnMobile?: boolean
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
    settingsHref = "/staff/settings",
    logoutHref = "/login",
    dropdownSide = "right",
    dropdownAlign = "end",
    compactOnMobile = false,
}: NavUserProps) {
    const { state, isMobile } = useSidebar()
    const collapsed = state === "collapsed" && !isMobile

    // Mobile: dropdown should open on TOP (do not affect desktop)
    const resolvedDropdownSide: NavUserProps["dropdownSide"] = isMobile ? "top" : dropdownSide

    const navigate = useNavigate()
    const { logout } = useSession()

    const [logoutOpen, setLogoutOpen] = React.useState(false)

    const handleLogout = () => {
        // Clear session context + token
        logout()
        // Also clear any stored user object (if used elsewhere)
        clearAuthUser()
        // Navigate to login (or provided path)
        navigate(logoutHref, { replace: true })
    }

    return (
        <>
            <SidebarMenu className={className}>
                <SidebarMenuItem>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <SidebarMenuButton asChild size="lg" tooltip={user.name}>
                                <Button
                                    variant="ghost"
                                    className={cn(
                                        "justify-start px-2",
                                        // default behavior
                                        "w-full gap-3",
                                        // collapsed sidebar (desktop)
                                        collapsed && "justify-center px-0",
                                        // compact header (MOBILE ONLY) - do not affect desktop
                                        compactOnMobile && "w-auto gap-0 px-0 md:w-full md:gap-3 md:px-2",
                                    )}
                                >
                                    <Avatar className="h-8 w-8">
                                        {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
                                        <AvatarFallback>{initials(user.name)}</AvatarFallback>
                                    </Avatar>

                                    <div
                                        className={cn(
                                            "min-w-0 flex-1 text-left",
                                            collapsed && "hidden",
                                            // hide text only on mobile when compactOnMobile is enabled
                                            compactOnMobile && "hidden md:block",
                                        )}
                                    >
                                        <div className="truncate text-sm font-medium">{user.name}</div>
                                        <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                                    </div>
                                </Button>
                            </SidebarMenuButton>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent
                            align={dropdownAlign}
                            side={resolvedDropdownSide}
                            sideOffset={8}
                            className="w-56"
                        >
                            {/* Always show name + email inside the dropdown (so email is never "lost") */}
                            <DropdownMenuLabel>
                                <div className="flex flex-col">
                                    <span className="truncate text-sm font-medium">{user.name}</span>
                                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                                </div>
                            </DropdownMenuLabel>

                            <DropdownMenuSeparator />

                            <DropdownMenuGroup>
                                <DropdownMenuItem asChild>
                                    <a href={settingsHref} className="flex items-center gap-2">
                                        <Settings className="h-4 w-4" />
                                        Settings
                                    </a>
                                </DropdownMenuItem>
                            </DropdownMenuGroup>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                                className="cursor-pointer"
                                onSelect={(e) => {
                                    e.preventDefault()
                                    setLogoutOpen(true)
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    <LogOut className="h-4 w-4" />
                                    Logout
                                </div>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </SidebarMenuItem>
            </SidebarMenu>

            {/* Logout confirmation */}
            <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Log out?</AlertDialogTitle>
                        <AlertDialogDescription>
                            You will be signed out and redirected to the login page.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault()
                                setLogoutOpen(false)
                                handleLogout()
                            }}
                            className="bg-destructive text-white hover:bg-destructive/90"
                        >
                            Logout
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
