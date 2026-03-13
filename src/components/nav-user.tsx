/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { useNavigate } from "react-router-dom"
import { LogOut, Settings } from "lucide-react"

import { api } from "@/lib/http"
import { getAuthUser, type StoredAuthUser } from "@/lib/auth"
import { useSession } from "@/hooks/use-session"
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
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar"
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

export type DashboardUser = {
    name: string
    email: string
    avatarUrl?: string
}

type NavUserProps = {
    user: DashboardUser
    className?: string

    /**
     * Optional manual override.
     * If not provided, it auto-routes based on the logged-in role:
     * - ADMIN -> /admin/settings
     * - STAFF -> /staff/settings
     */
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

const AVATAR_URL_PATHS = [
    "/auth/me/avatar-url",
    "/users/me/avatar-url",
    "/users/avatar-url",
    "/auth/avatar-url",
] as const

function initials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    const a = parts[0]?.[0] ?? ""
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""
    return (a + b).toUpperCase() || "U"
}

function pickNonEmptyString(v: unknown): string {
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : ""
}

function readStoredAuthUser(): StoredAuthUser | null {
    try {
        return getAuthUser()
    } catch {
        return null
    }
}

function extractAvatarUrl(payload: unknown): string | null {
    if (typeof payload === "string") {
        const clean = payload.trim()
        return clean || null
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return null
    }

    const record = payload as Record<string, unknown>

    const direct = [
        record.url,
        record.avatarUrl,
        record.signedUrl,
        record.fileUrl,
    ]
        .map(pickNonEmptyString)
        .find(Boolean)

    if (direct) return direct

    const nested = record.data
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
        const nestedRecord = nested as Record<string, unknown>
        const nestedUrl = [
            nestedRecord.url,
            nestedRecord.avatarUrl,
            nestedRecord.signedUrl,
            nestedRecord.fileUrl,
        ]
            .map(pickNonEmptyString)
            .find(Boolean)

        if (nestedUrl) return nestedUrl
    }

    return null
}

export function NavUser({
    user,
    className,
    settingsHref,
    logoutHref = "/login",
    dropdownSide = "right",
    dropdownAlign = "end",
    compactOnMobile = false,
}: NavUserProps) {
    const { state, isMobile } = useSidebar()
    const collapsed = state === "collapsed" && !isMobile

    // Mobile: dropdown should open on TOP (do not affect desktop)
    const resolvedDropdownSide: NavUserProps["dropdownSide"] = isMobile
        ? "top"
        : dropdownSide

    const navigate = useNavigate()
    const { logout, user: sessionUser } = useSession()

    const [logoutOpen, setLogoutOpen] = React.useState(false)

    /**
     * Use auth storage to avoid fields disappearing on refresh
     * and to get avatarKey/avatarUrl even if parent didn't pass it.
     */
    const [storedUser, setStoredUser] = React.useState<StoredAuthUser | null>(
        () => readStoredAuthUser()
    )

    React.useEffect(() => {
        setStoredUser(readStoredAuthUser())

        const onStorage = () => {
            setStoredUser(readStoredAuthUser())
        }

        window.addEventListener("storage", onStorage)
        return () => window.removeEventListener("storage", onStorage)
    }, [])

    const propName = pickNonEmptyString((user as { name?: unknown })?.name)
    const propEmail = pickNonEmptyString((user as { email?: unknown })?.email)

    const sessionName = pickNonEmptyString((sessionUser as any)?.name)
    const sessionEmail = pickNonEmptyString((sessionUser as any)?.email)

    const storedName = pickNonEmptyString(storedUser?.name)
    const storedEmail = pickNonEmptyString(storedUser?.email)

    const displayName = propName || sessionName || storedName || "User"
    const displayEmail = propEmail || sessionEmail || storedEmail || "—"

    // Role-based settings redirect
    const role =
        pickNonEmptyString((sessionUser as any)?.role) ||
        pickNonEmptyString((storedUser as any)?.role) ||
        "STAFF"

    const autoSettingsHref =
        role === "ADMIN" ? "/admin/settings" : "/staff/settings"

    // If caller explicitly passed settingsHref, respect it.
    // Otherwise auto-route based on role.
    const resolvedSettingsHref = (() => {
        const manual = pickNonEmptyString(settingsHref)
        if (manual) return manual
        return autoSettingsHref
    })()

    // Extra safety: if an old/wrong default was passed, correct it by role.
    const finalSettingsHref =
        role === "ADMIN" && resolvedSettingsHref === "/staff/settings"
            ? "/admin/settings"
            : role !== "ADMIN" && resolvedSettingsHref === "/admin/settings"
              ? "/staff/settings"
              : resolvedSettingsHref

    // Avatar resolution (prop -> storage -> signed URL fallback)
    const propAvatarUrl = pickNonEmptyString((user as any)?.avatarUrl)
    const storedAvatarUrl = pickNonEmptyString((storedUser as any)?.avatarUrl)
    const storedAvatarKey = pickNonEmptyString((storedUser as any)?.avatarKey)

    const [resolvedAvatarUrl, setResolvedAvatarUrl] =
        React.useState<string | null>(null)
    const signedTriedRef = React.useRef(false)

    React.useEffect(() => {
        const next = propAvatarUrl || storedAvatarUrl || null
        setResolvedAvatarUrl(next)
        signedTriedRef.current = false
    }, [propAvatarUrl, storedAvatarUrl])

    const fetchSignedAvatarUrl = React.useCallback(async () => {
        if (!storedAvatarKey) return
        if (signedTriedRef.current) return

        signedTriedRef.current = true

        for (const path of AVATAR_URL_PATHS) {
            try {
                const res = await api.getData<unknown>(path, { auth: "staff" })
                const nextUrl = extractAvatarUrl(res)

                if (nextUrl) {
                    setResolvedAvatarUrl(nextUrl)
                    return
                }
            } catch {
                // try next compatible centralized endpoint
            }
        }
    }, [storedAvatarKey])

    React.useEffect(() => {
        if (!resolvedAvatarUrl && storedAvatarKey) {
            void fetchSignedAvatarUrl()
        }
    }, [resolvedAvatarUrl, storedAvatarKey, fetchSignedAvatarUrl])

    const handleLogout = () => {
        logout()
        navigate(logoutHref, { replace: true })
    }

    return (
        <>
            <SidebarMenu className={className}>
                <SidebarMenuItem>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <SidebarMenuButton
                                asChild
                                size="lg"
                                tooltip={displayName}
                            >
                                <Button
                                    variant="ghost"
                                    className={cn(
                                        "w-full justify-start gap-3 px-2",
                                        collapsed && "justify-center px-0",
                                        compactOnMobile &&
                                            "w-auto gap-0 px-0 md:w-full md:gap-3 md:px-2"
                                    )}
                                >
                                    <Avatar className="h-8 w-8">
                                        {resolvedAvatarUrl ? (
                                            <AvatarImage
                                                src={resolvedAvatarUrl}
                                                alt={displayName}
                                                className="object-cover"
                                                onLoadingStatusChange={(
                                                    status
                                                ) => {
                                                    if (status === "error") {
                                                        if (
                                                            storedAvatarKey &&
                                                            !signedTriedRef.current
                                                        ) {
                                                            void fetchSignedAvatarUrl()
                                                        } else {
                                                            setResolvedAvatarUrl(
                                                                null
                                                            )
                                                        }
                                                    }
                                                }}
                                            />
                                        ) : null}
                                        <AvatarFallback>
                                            {initials(displayName)}
                                        </AvatarFallback>
                                    </Avatar>

                                    <div
                                        className={cn(
                                            "min-w-0 flex-1 text-left",
                                            collapsed && "hidden",
                                            compactOnMobile && "hidden md:block"
                                        )}
                                    >
                                        <div className="truncate text-sm font-medium">
                                            {displayName}
                                        </div>
                                        <div className="truncate text-xs text-muted-foreground">
                                            {displayEmail}
                                        </div>
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
                            <DropdownMenuLabel>
                                <div className="flex flex-col">
                                    <span className="truncate text-sm font-medium">
                                        {displayName}
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        {displayEmail}
                                    </span>
                                </div>
                            </DropdownMenuLabel>

                            <DropdownMenuSeparator />

                            <DropdownMenuGroup>
                                <DropdownMenuItem
                                    className="cursor-pointer"
                                    onSelect={(e) => {
                                        e.preventDefault()
                                        navigate(finalSettingsHref)
                                    }}
                                >
                                    <div className="flex items-center gap-2">
                                        <Settings className="h-4 w-4" />
                                        Settings
                                    </div>
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

            <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Log out?</AlertDialogTitle>
                        <AlertDialogDescription>
                            You will be signed out and redirected to the login
                            page.
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