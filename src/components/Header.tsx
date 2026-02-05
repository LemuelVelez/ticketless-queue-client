import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"

import { useSession } from "@/hooks/use-session"

import { Button } from "@/components/ui/button"
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Menu } from "lucide-react"

import logo from "@/assets/images/logo.svg"

type HeaderProps = {
    /**
     * "landing" = section anchors + scroll spy (default)
     * "student" = simple header for student/guest participant pages
     */
    variant?: "landing" | "student"
}

const navItems: Array<{ label: string; href: string }> = [
    { label: "Why", href: "#why" },
    { label: "How it works", href: "#how" },
    { label: "Features", href: "#features" },
    { label: "Roles", href: "#roles" },
    { label: "FAQ", href: "#faq" },
]

const sectionIds = navItems
    .map((item) => item.href)
    .filter((href) => href.startsWith("#"))
    .map((href) => href.slice(1))

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

function getParticipantBase(role: string | undefined) {
    return role === "STUDENT" ? "/student" : "/alumni"
}

function getParticipantLabel(role: string | undefined) {
    return role === "STUDENT" ? "Student" : "Guest"
}

export default function Header({ variant = "landing" }: HeaderProps) {
    const { user, loading } = useSession()

    const role = user?.role
    const showDashboard = !loading && !!user
    const authTo = showDashboard ? getHomePath(role) : "/login"
    const authLabel = showDashboard ? (role === "ADMIN" || role === "STAFF" ? "Dashboard" : "My Home") : "Login"

    const landingJoinTo = useMemo(() => getJoinPath(role), [role])

    const participantBase = useMemo(() => getParticipantBase(role), [role])
    const participantLabel = useMemo(() => getParticipantLabel(role), [role])

    // ✅ Hooks must not be conditional
    const [activeHref, setActiveHref] = useState<string>("")
    const [sheetOpen, setSheetOpen] = useState(false)
    const headerRef = useRef<HTMLElement | null>(null)

    // ✅ Landing-only: keep active state in sync with URL hash
    useEffect(() => {
        if (variant !== "landing") return

        const syncFromHash = () => setActiveHref(window.location.hash || "")
        syncFromHash()

        window.addEventListener("hashchange", syncFromHash)
        return () => window.removeEventListener("hashchange", syncFromHash)
    }, [variant])

    // ✅ Landing-only: scroll-spy
    useEffect(() => {
        if (variant !== "landing") return

        const sections = sectionIds.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[]

        if (!sections.length) return

        let ticking = false

        const computeActive = () => {
            const headerH = headerRef.current?.getBoundingClientRect().height ?? 0
            const offset = headerH + 24
            const y = window.scrollY + offset + 1

            let currentId = sections[0].id

            for (const sec of sections) {
                const top = sec.offsetTop
                const bottom = top + sec.offsetHeight

                if (y >= top && y < bottom) {
                    currentId = sec.id
                    break
                }
                if (y >= top) currentId = sec.id
            }

            setActiveHref(`#${currentId}`)
        }

        const onScroll = () => {
            if (ticking) return
            ticking = true
            window.requestAnimationFrame(() => {
                ticking = false
                computeActive()
            })
        }

        computeActive()
        window.addEventListener("scroll", onScroll, { passive: true })
        window.addEventListener("resize", onScroll)

        return () => {
            window.removeEventListener("scroll", onScroll)
            window.removeEventListener("resize", onScroll)
        }
    }, [variant])

    const handleNavClick = (href: string) => {
        setActiveHref(href)
        setSheetOpen(false)
    }

    // ✅ Student/Guest simple header
    if (variant === "student") {
        return (
            <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
                <div className="mx-4 flex items-center justify-between px-4 py-3">
                    <Link to={`${participantBase}/home`} className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg border">
                            <img src={logo} alt="QueuePass logo" className="h-10 w-10" />
                        </div>
                        <div className="leading-tight">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold">QueuePass</span>
                                <Badge variant="secondary" className="hidden sm:inline-flex">
                                    {participantLabel}
                                </Badge>
                            </div>
                            <p className="hidden text-xs text-muted-foreground sm:block">Join queue and track your tickets</p>
                        </div>
                    </Link>

                    {/* Desktop actions */}
                    <div className="hidden items-center gap-2 md:flex">
                        <Button variant="outline" asChild>
                            <Link to="/">Landing Page</Link>
                        </Button>

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
                    </div>

                    {/* Mobile actions */}
                    <div className="md:hidden">
                        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                            <SheetTrigger asChild>
                                <Button variant="outline" size="icon" aria-label="Open menu">
                                    <Menu className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>

                            <SheetContent
                                side="right"
                                className="right-4 top-4 bottom-4 h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-90 overflow-y-auto rounded-xl border px-4 py-6 sm:px-6"
                            >
                                <SheetHeader>
                                    <SheetTitle className="text-left">
                                        <div className="flex items-center gap-3">
                                            <img src={logo} alt="QueuePass logo" className="h-10 w-10" />
                                            <div className="leading-tight">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-semibold">QueuePass</span>
                                                    <Badge variant="secondary">{participantLabel}</Badge>
                                                </div>
                                                <p className="mt-1 text-xs text-muted-foreground">Student & guest pages</p>
                                            </div>
                                        </div>
                                    </SheetTitle>
                                </SheetHeader>

                                <div className="mt-6 flex flex-col gap-2">
                                    <Button variant="ghost" className="w-full justify-start" asChild>
                                        <Link to="/" onClick={() => setSheetOpen(false)}>
                                            Landing Page
                                        </Link>
                                    </Button>

                                    <Button variant="ghost" className="w-full justify-start" asChild>
                                        <Link to={`${participantBase}/home`} onClick={() => setSheetOpen(false)}>
                                            Home
                                        </Link>
                                    </Button>

                                    <Button className="w-full" asChild>
                                        <Link to={`${participantBase}/join`} onClick={() => setSheetOpen(false)}>
                                            Join Queue
                                        </Link>
                                    </Button>

                                    <Button variant="outline" className="w-full" asChild>
                                        <Link to={`${participantBase}/my-tickets`} onClick={() => setSheetOpen(false)}>
                                            My Tickets
                                        </Link>
                                    </Button>

                                    <Button variant="outline" className="w-full" asChild>
                                        <Link to={`${participantBase}/profile`} onClick={() => setSheetOpen(false)}>
                                            Profile
                                        </Link>
                                    </Button>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>
            </header>
        )
    }

    // ✅ Landing header (scroll-spy + auth)
    return (
        <header ref={headerRef} className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
            <div className="mx-4 flex items-center justify-between px-4 py-3">
                {/* Brand */}
                <Link to="/" className="flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg border">
                        <img src={logo} alt="QueuePass logo" className="h-12 w-12" />
                    </div>
                    <div className="leading-tight">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">QueuePass</span>
                            <Badge variant="secondary" className="hidden sm:inline-flex">
                                Ticketless QR Queue
                            </Badge>
                        </div>
                        <p className="hidden text-xs text-muted-foreground sm:block">
                            Student ID queue management with SMS, voice, and public display
                        </p>
                    </div>
                </Link>

                {/* Desktop nav */}
                <div className="hidden items-center gap-3 md:flex">
                    <NavigationMenu>
                        <NavigationMenuList>
                            {navItems.map((item) => {
                                const isActive = activeHref === item.href

                                return (
                                    <NavigationMenuItem key={item.href}>
                                        <NavigationMenuLink
                                            asChild
                                            className={cn(
                                                navigationMenuTriggerStyle(),
                                                "relative",
                                                isActive &&
                                                "bg-accent text-accent-foreground " +
                                                "after:absolute after:bottom-1 after:left-3 after:right-3 after:h-0.5 after:rounded-full after:bg-primary",
                                            )}
                                        >
                                            <a
                                                href={item.href}
                                                aria-current={isActive ? "page" : undefined}
                                                onClick={() => setActiveHref(item.href)}
                                            >
                                                {item.label}
                                            </a>
                                        </NavigationMenuLink>
                                    </NavigationMenuItem>
                                )
                            })}
                        </NavigationMenuList>
                    </NavigationMenu>

                    <div className="flex items-center gap-2">
                        <Button variant="outline" asChild>
                            <Link to={authTo}>{authLabel}</Link>
                        </Button>

                        <Button asChild>
                            <Link to={landingJoinTo}>Join Queue</Link>
                        </Button>
                    </div>
                </div>

                {/* Mobile nav */}
                <div className="md:hidden">
                    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                        <SheetTrigger asChild>
                            <Button variant="outline" size="icon" aria-label="Open menu">
                                <Menu className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>

                        <SheetContent
                            side="right"
                            className="right-4 top-4 bottom-4 h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-90 overflow-y-auto rounded-xl border px-4 py-6 sm:px-6"
                        >
                            <SheetHeader>
                                <SheetTitle className="text-left">
                                    <div className="flex items-center gap-3">
                                        <img src={logo} alt="QueuePass logo" className="h-10 w-10" />
                                        <div className="leading-tight">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-semibold">QueuePass</span>
                                                <Badge variant="secondary">QR Queue</Badge>
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">Ticketless student queue</p>
                                        </div>
                                    </div>
                                </SheetTitle>
                            </SheetHeader>

                            <div className="mt-6 flex flex-col gap-2">
                                {navItems.map((item) => {
                                    const isActive = activeHref === item.href

                                    return (
                                        <Button
                                            key={item.href}
                                            variant="ghost"
                                            className={cn(
                                                "relative w-full justify-start",
                                                isActive &&
                                                "bg-accent text-accent-foreground " +
                                                "before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r before:bg-primary",
                                            )}
                                            asChild
                                        >
                                            <a
                                                href={item.href}
                                                aria-current={isActive ? "page" : undefined}
                                                onClick={() => handleNavClick(item.href)}
                                            >
                                                {item.label}
                                            </a>
                                        </Button>
                                    )
                                })}

                                <div className="mt-4 flex flex-col gap-2 border-t pt-4">
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        asChild
                                        onClick={() => setSheetOpen(false)}
                                        disabled={loading}
                                    >
                                        <Link to={authTo}>{authLabel}</Link>
                                    </Button>

                                    <Button className="w-full" asChild>
                                        <Link to={landingJoinTo} onClick={() => setSheetOpen(false)}>
                                            Join Queue
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    )
}
