import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"

import { useSession } from "@/hooks/use-session"

import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { QrCode } from "lucide-react"

type FooterProps = {
    /**
     * "landing" = section links + scroll spy (default)
     * "student" = minimal footer for public student pages
     */
    variant?: "landing" | "student"
}

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

export default function Footer({ variant = "landing" }: FooterProps) {
    const { user, loading } = useSession()
    const dashboardPath = useMemo(() => (user?.role === "ADMIN" ? "/admin/dashboard" : "/staff/dashboard"), [user])

    const showDashboard = !loading && !!user
    const authLabel = showDashboard ? "Dashboard" : "Login"
    const authTo = showDashboard ? dashboardPath : "/login"

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

        const sections = sectionIds
            .map((id) => document.getElementById(id))
            .filter(Boolean) as HTMLElement[]

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

    // ✅ Student/simple footer
    if (variant === "student") {
        return (
            <footer className="mt-14 border-t bg-background">
                <div className="mx-auto  px-4 py-10">
                    <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg border">
                                <QrCode className="h-5 w-5" />
                            </div>
                            <div className="leading-tight">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold">QueuePass</span>
                                    <Badge variant="secondary">Student</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Join the queue and view live updates on the public display.
                                </p>
                            </div>
                        </div>

                        {/* ✅ Add Landing Page link; keep /student; remove Login button */}
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" asChild>
                                <Link to="/">Landing Page</Link>
                            </Button>

                            <Button variant="outline" asChild>
                                <Link to="/student">Home</Link>
                            </Button>

                            <Button asChild>
                                <Link to="/join">Join Queue</Link>
                            </Button>

                            <Button variant="outline" asChild>
                                <Link to="/display">Public Display</Link>
                            </Button>
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

    // ✅ Landing footer (original behavior)
    return (
        <footer className="mt-14 border-t bg-background">
            <div className="mx-auto  px-4 py-10">
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
                                    QR-based student ID queueing with SMS notification, voice announcement, and public
                                    display.
                                </p>
                            </div>
                        </div>

                        <Separator className="my-5" />

                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" asChild>
                                <Link to={authTo}>{authLabel}</Link>
                            </Button>

                            <Button asChild>
                                <a href="/join">Join Queue</a>
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
