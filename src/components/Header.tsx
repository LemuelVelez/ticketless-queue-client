import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"

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

export default function Header() {
    const [activeHref, setActiveHref] = useState<string>("")
    const [sheetOpen, setSheetOpen] = useState(false)
    const headerRef = useRef<HTMLElement | null>(null)

    // Keep active state in sync with URL hash (clicks, back/forward)
    useEffect(() => {
        const syncFromHash = () => setActiveHref(window.location.hash || "")
        syncFromHash()

        window.addEventListener("hashchange", syncFromHash)
        return () => window.removeEventListener("hashchange", syncFromHash)
    }, [])

    // Scroll-spy
    useEffect(() => {
        const sections = sectionIds
            .map((id) => document.getElementById(id))
            .filter(Boolean) as HTMLElement[]

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
    }, [])

    const handleNavClick = (href: string) => {
        setActiveHref(href)
        setSheetOpen(false)
    }

    return (
        <header ref={headerRef} className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
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
                        {/* ✅ Unified Login */}
                        <Button variant="outline" asChild>
                            <Link to="/login">Login</Link>
                        </Button>

                        <Button asChild>
                            <a href="/join">Join Queue</a>
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
                                    {/* ✅ Unified Login */}
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        asChild
                                        onClick={() => setSheetOpen(false)}
                                    >
                                        <Link to="/login">Login</Link>
                                    </Button>

                                    <Button className="w-full" asChild>
                                        <a href="/join" onClick={() => setSheetOpen(false)}>
                                            Join Queue
                                        </a>
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
