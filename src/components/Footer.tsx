import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"

import { guestApi, participantAuthStorage } from "@/api/guest"
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
    { label: "Features", href: "#features" },
    { label: "Roles", href: "#roles" },
    { label: "FAQ", href: "#faq" },
]

const sectionIds = exploreItems
    .map((item) => item.href)
    .filter((href) => href.startsWith("#"))
    .map((href) => href.slice(1))

function normalizeParticipantRole(raw: unknown): ParticipantRole | null {
    const value = String(raw ?? "").trim().toUpperCase()
    if (value === "STUDENT") return "STUDENT"
    if (value === "ALUMNI_VISITOR" || value === "ALUMNI-VISITOR") return "ALUMNI_VISITOR"
    if (value === "GUEST" || value === "VISITOR") return "GUEST"
    return null
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

function getParticipantBase(role: ParticipantRole | null | undefined) {
    return role === "STUDENT" ? "/student" : "/alumni"
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

export default function Footer({ variant = "landing" }: FooterProps) {
    const { user, loading } = useSession()

    const [participantRole, setParticipantRole] = useState<ParticipantRole | null>(null)
    const [participantLoading, setParticipantLoading] = useState(true)

    useEffect(() => {
        let alive = true

        const resolveParticipant = async () => {
            const token = participantAuthStorage.getToken()
            if (!token) {
                if (!alive) return
                setParticipantRole(null)
                setParticipantLoading(false)
                return
            }

            try {
                const res = await guestApi.getSession()
                if (!alive) return

                const role = normalizeParticipantRole(res?.participant?.type)
                if (!role) {
                    participantAuthStorage.clearToken()
                    setParticipantRole(null)
                } else {
                    setParticipantRole(role)
                }
            } catch {
                if (!alive) return
                participantAuthStorage.clearToken()
                setParticipantRole(null)
            } finally {
                if (alive) setParticipantLoading(false)
            }
        }

        void resolveParticipant()

        const onStorage = (e: StorageEvent) => {
            if (e.key === "qp_participant_token") {
                setParticipantLoading(true)
                void resolveParticipant()
            }
        }

        window.addEventListener("storage", onStorage)
        return () => {
            alive = false
            window.removeEventListener("storage", onStorage)
        }
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

    const participantBase = useMemo(() => getParticipantBase(participantRole), [participantRole])
    const participantLabel = useMemo(() => getParticipantLabel(participantRole), [participantRole])

    const authLabel = isStaffAuthenticated
        ? staffRole === "ADMIN" || staffRole === "STAFF"
            ? "Dashboard"
            : "My Home"
        : isParticipantAuthenticated
            ? "My Home"
            : "Login"

    const authTo = dashboardPath

    // ✅ Hooks must not be conditional
    const [activeHref, setActiveHref] = useState<string>("")

    // Landing-only: hash sync
    useEffect(() => {
        if (variant !== "landing") return

        const syncFromHash = () => setActiveHref(window.location.hash || "")
        syncFromHash()

        window.addEventListener("hashchange", syncFromHash)
        return () => window.removeEventListener("hashchange", syncFromHash)
    }, [variant])

    // Landing-only: scroll-spy using IntersectionObserver
    useEffect(() => {
        if (variant !== "landing") return

        const sections = sectionIds.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[]

        if (!sections.length) return

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0))[0]

                if (visible?.target?.id) setActiveHref(`#${visible.target.id}`)
            },
            {
                root: null,
                threshold: [0.2, 0.35, 0.5, 0.65],
                rootMargin: "-20% 0px -60% 0px",
            },
        )

        sections.forEach((el) => observer.observe(el))
        return () => observer.disconnect()
    }, [variant])

    // ✅ Student/Guest authenticated footer
    if (variant === "student") {
        return (
            <footer className="mt-14 border-t bg-background">
                <div className="mx-4 px-4 py-10">
                    <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg border">
                                <QrCode className="h-5 w-5" />
                            </div>
                            <div className="leading-tight">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold">QueuePass</span>
                                    <Badge variant="secondary">{participantLabel}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Participant pages require an authenticated student/guest session.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" asChild>
                                <Link to="/">Landing Page</Link>
                            </Button>

                            {isParticipantAuthenticated ? (
                                <>
                                    <Button variant="outline" asChild>
                                        <Link to={`${participantBase}/home`}>Home</Link>
                                    </Button>

                                    <Button asChild>
                                        <Link to={`${participantBase}/join`}>Join Queue</Link>
                                    </Button>

                                    <Button variant="outline" asChild>
                                        <Link to={`${participantBase}/my-tickets`}>My Tickets</Link>
                                    </Button>

                                    <Button variant="outline" asChild>
                                        <Link to={`${participantBase}/profile`}>Profile</Link>
                                    </Button>
                                </>
                            ) : participantLoading ? (
                                <Button variant="outline" disabled>
                                    Checking session...
                                </Button>
                            ) : (
                                <Button asChild>
                                    <Link to="/login">Login to continue</Link>
                                </Button>
                            )}
                        </div>
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

    // ✅ Landing footer (role-aware + participant-aware routes)
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
                                    QR-based student ID queueing with SMS notification, voice announcement, and public display.
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
                                    className={cn("h-auto justify-start p-0", isActive && "font-semibold underline")}
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
                    <span>Built for school offices: Registrar, Cashier, Library, Clinic, NSTP/ROTC, and more.</span>
                </div>
            </div>
        </footer>
    )
}
