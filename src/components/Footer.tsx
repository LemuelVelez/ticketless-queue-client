import { useEffect, useMemo, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"

import {
    AUTH_STORAGE_KEYS,
    clearParticipantSession,
    getParticipantToken,
    getParticipantUser,
} from "@/lib/auth"
import { useSession } from "@/hooks/use-session"

import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { QrCode } from "lucide-react"

type FooterProps = {
    /**
     * "landing" = section links + scroll spy (default)
     * "student" = authenticated participant footer for student/guest pages
     */
    variant?: "landing" | "student"
}

type ParticipantRole = "STUDENT" | "ALUMNI_VISITOR" | "GUEST"

const exploreItems: Array<{ label: string; href: string }> = [
    { label: "Why this exists", href: "#why" },
    { label: "How it works", href: "#how" },
    { label: "Public Display", href: "#public-display" },
    { label: "Features", href: "#features" },
    { label: "Roles", href: "#roles" },
    { label: "FAQ", href: "#faq" },
]

const sectionIds = exploreItems
    .map((item) => item.href)
    .filter((href) => href.startsWith("#"))
    .map((href) => href.slice(1))

const participantStorageKeys = new Set<string>([
    AUTH_STORAGE_KEYS.participant.token.local,
    AUTH_STORAGE_KEYS.participant.token.session,
    AUTH_STORAGE_KEYS.participant.user.local,
    AUTH_STORAGE_KEYS.participant.user.session,
])

function normalizeParticipantRole(raw: unknown): ParticipantRole | null {
    const value = String(raw ?? "").trim().toUpperCase()
    if (value === "STUDENT") return "STUDENT"
    if (value === "ALUMNI_VISITOR" || value === "ALUMNI-VISITOR") {
        return "ALUMNI_VISITOR"
    }
    if (value === "ALUMNI") return "ALUMNI_VISITOR"
    if (value === "GUEST" || value === "VISITOR") return "GUEST"
    return null
}

function resolveParticipantRoleFromStorage(): ParticipantRole | null {
    const token = getParticipantToken()
    if (!token) return null

    const participant = getParticipantUser()
    const role = normalizeParticipantRole(participant?.type)

    if (!role) {
        clearParticipantSession()
        return null
    }

    return role
}

function getHomePath(role: string | undefined) {
    switch (role) {
        case "ADMIN":
            return "/admin/dashboard"
        case "STAFF":
            return "/staff/dashboard"
        case "STUDENT":
            return "/student/home"
        case "ALUMNI":
        case "GUEST":
        default:
            return "/alumni/home"
    }
}

function getJoinPath(role: string | undefined) {
    switch (role) {
        case "STAFF":
            return "/staff/queue"
        case "STUDENT":
            return "/student/join"
        case "ALUMNI":
        case "GUEST":
        case "ADMIN":
        default:
            return "/alumni/join"
    }
}

function getParticipantLabel(role: ParticipantRole | null | undefined) {
    return role === "STUDENT" ? "Student" : "Guest"
}

function getParticipantHomePath(role: ParticipantRole | null | undefined) {
    return role === "STUDENT" ? "/student/home" : "/alumni/home"
}

function getParticipantJoinPath(role: ParticipantRole | null | undefined) {
    return role === "STUDENT" ? "/student/join" : "/alumni/join"
}

function getParticipantPageLabel(pathname: string) {
    if (pathname.endsWith("/join")) return "Join Queue"
    if (pathname.endsWith("/my-tickets")) return "My Tickets"
    if (pathname.endsWith("/profile")) return "Profile"
    return "Home"
}

export default function Footer({ variant = "landing" }: FooterProps) {
    const { user, loading } = useSession()
    const location = useLocation()

    const [participantRole, setParticipantRole] = useState<ParticipantRole | null>(
        () => resolveParticipantRoleFromStorage()
    )
    const [participantLoading, setParticipantLoading] = useState(false)

    useEffect(() => {
        const syncParticipantSession = () => {
            setParticipantLoading(true)
            setParticipantRole(resolveParticipantRoleFromStorage())
            setParticipantLoading(false)
        }

        syncParticipantSession()

        const onStorage = (e: StorageEvent) => {
            if (!e.key || participantStorageKeys.has(e.key)) {
                syncParticipantSession()
            }
        }

        window.addEventListener("storage", onStorage)
        return () => window.removeEventListener("storage", onStorage)
    }, [])

    const staffRole = user?.role
    const isStaffAuthenticated = !loading && !!user
    const isParticipantAuthenticated = !participantLoading && !!participantRole

    const dashboardPath = useMemo(() => {
        if (isStaffAuthenticated) return getHomePath(staffRole)
        if (isParticipantAuthenticated) return getParticipantHomePath(participantRole)
        return "/login"
    }, [isStaffAuthenticated, staffRole, isParticipantAuthenticated, participantRole])

    const joinPath = useMemo(() => {
        if (isStaffAuthenticated) return getJoinPath(staffRole)
        if (isParticipantAuthenticated) return getParticipantJoinPath(participantRole)
        return "/login"
    }, [isStaffAuthenticated, staffRole, isParticipantAuthenticated, participantRole])

    const participantLabel = useMemo(
        () => getParticipantLabel(participantRole),
        [participantRole]
    )

    const authLabel = isStaffAuthenticated
        ? staffRole === "ADMIN" || staffRole === "STAFF"
            ? "Dashboard"
            : "My Home"
        : isParticipantAuthenticated
          ? "My Home"
          : "Login"

    const authTo = dashboardPath

    const currentParticipantPage = useMemo(
        () => getParticipantPageLabel(location.pathname),
        [location.pathname]
    )

    const [activeHref, setActiveHref] = useState<string>("")

    useEffect(() => {
        if (variant !== "landing") return

        const syncFromHash = () => setActiveHref(window.location.hash || "")
        syncFromHash()

        window.addEventListener("hashchange", syncFromHash)
        return () => window.removeEventListener("hashchange", syncFromHash)
    }, [variant])

    useEffect(() => {
        if (variant !== "landing") return

        const sections = sectionIds
            .map((id) => document.getElementById(id))
            .filter(Boolean) as HTMLElement[]

        if (!sections.length) return

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort(
                        (a, b) =>
                            (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0)
                    )[0]

                if (visible?.target?.id) setActiveHref(`#${visible.target.id}`)
            },
            {
                root: null,
                threshold: [0.2, 0.35, 0.5, 0.65],
                rootMargin: "-20% 0px -60% 0px",
            }
        )

        sections.forEach((el) => observer.observe(el))
        return () => observer.disconnect()
    }, [variant])

    if (variant === "student") {
        return (
            <footer className="mt-14 border-t bg-background">
                <div className="mx-4 px-4 py-10">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg border">
                                <QrCode className="h-5 w-5" />
                            </div>
                            <div className="leading-tight">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold">QueuePass</span>
                                    <Badge variant="secondary">{participantLabel}</Badge>
                                    <Badge variant="outline">
                                        {currentParticipantPage}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Navigation is available in the header menu.
                                </p>
                            </div>
                        </div>

                        <Badge variant={isParticipantAuthenticated ? "default" : "outline"}>
                            {participantLoading
                                ? "Checking session…"
                                : isParticipantAuthenticated
                                  ? "Session active"
                                  : "Not signed in"}
                        </Badge>
                    </div>

                    <Separator className="my-8" />

                    <div className="flex flex-col gap-2 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
                        <span>© {new Date().getFullYear()} QueuePass. All rights reserved.</span>
                        <span>Built for student-facing offices and queue-based services.</span>
                    </div>
                </div>
            </footer>
        )
    }

    return (
        <footer className="mx-0 mt-14 border-t bg-background">
            <div className="mx-4 px-4 py-10">
                <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
                    <div className="max-w-md">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg border">
                                <QrCode className="h-5 w-5" />
                            </div>
                            <div className="leading-tight">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold">QueuePass</span>
                                    <Badge variant="secondary">Ticketless</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    QR-based student ID queueing with SMS notification, voice
                                    announcement, and public display.
                                </p>
                            </div>
                        </div>

                        <Separator className="my-5" />

                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" asChild>
                                <Link to={authTo}>{authLabel}</Link>
                            </Button>

                            <Button asChild>
                                <Link to={joinPath}>Join Queue</Link>
                            </Button>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <p className="text-sm font-medium">Explore</p>

                        {exploreItems.map((item) => {
                            const isActive = activeHref === item.href

                            return (
                                <Button
                                    key={item.href}
                                    variant="link"
                                    className={cn(
                                        "h-auto justify-start p-0",
                                        isActive && "font-semibold underline"
                                    )}
                                    asChild
                                >
                                    <a
                                        href={item.href}
                                        aria-current={isActive ? "page" : undefined}
                                        onClick={() => setActiveHref(item.href)}
                                    >
                                        {item.label}
                                    </a>
                                </Button>
                            )
                        })}
                    </div>
                </div>

                <Separator className="my-8" />

                <div className="flex flex-col gap-2 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
                    <span>© {new Date().getFullYear()} QueuePass. All rights reserved.</span>
                    <span>
                        Built for school offices: Registrar, Cashier, Library, Clinic,
                        NSTP/ROTC, and more.
                    </span>
                </div>
            </div>
        </footer>
    )
}