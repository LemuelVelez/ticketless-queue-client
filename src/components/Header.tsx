import { Button } from "@/components/ui/button"
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
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

export default function Header() {
    return (
        <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
                {/* Brand (clickable to /) */}
                <a href="/" className="flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg border">
                        <img
                            src={logo}
                            alt="QueuePass logo"
                            className="h-12 w-12"
                        />
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
                </a>

                {/* Desktop nav */}
                <div className="hidden items-center gap-3 md:flex">
                    <NavigationMenu>
                        <NavigationMenuList>
                            {navItems.map((item) => (
                                <NavigationMenuItem key={item.href}>
                                    <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                                        <a href={item.href}>{item.label}</a>
                                    </NavigationMenuLink>
                                </NavigationMenuItem>
                            ))}
                        </NavigationMenuList>
                    </NavigationMenu>

                    <div className="flex items-center gap-2">
                        <Button variant="outline" asChild>
                            <a href="/staff/login">Staff Login</a>
                        </Button>
                        <Button asChild>
                            <a href="/join">Join Queue</a>
                        </Button>
                    </div>
                </div>

                {/* Mobile nav */}
                <div className="md:hidden">
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="outline" size="icon" aria-label="Open menu">
                                <Menu className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>

                        {/* Mobile-only: add side spacing (inset) + better vertical layout */}
                        <SheetContent
                            side="right"
                            className="right-4 top-4 bottom-4 h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-90 overflow-y-auto rounded-xl border px-4 py-6 sm:px-6"
                        >
                            <SheetHeader>
                                <SheetTitle className="text-left">
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center gap-3">
                                            <img
                                                src={logo}
                                                alt="QueuePass logo"
                                                className="h-10 w-10"
                                            />
                                            <div className="leading-tight">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-semibold">QueuePass</span>
                                                    <Badge variant="secondary">QR Queue</Badge>
                                                </div>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    Ticketless student queue
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </SheetTitle>
                            </SheetHeader>

                            <div className="mt-6 flex flex-col gap-2">
                                {navItems.map((item) => (
                                    <Button
                                        key={item.href}
                                        variant="ghost"
                                        className="w-full justify-start"
                                        asChild
                                    >
                                        <a href={item.href}>{item.label}</a>
                                    </Button>
                                ))}

                                <div className="mt-4 flex flex-col gap-2 border-t pt-4">
                                    <Button variant="outline" className="w-full" asChild>
                                        <a href="/staff/login">Staff Login</a>
                                    </Button>
                                    <Button className="w-full" asChild>
                                        <a href="/join">Join Queue</a>
                                    </Button>
                                    <Button variant="ghost" className="w-full justify-start" asChild>
                                        <a href="/admin/login">Admin Login</a>
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
