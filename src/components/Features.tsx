"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { BellRing, ClipboardCheck, KeyRound, QrCode, ShieldCheck, Tv2, Volume2 } from "lucide-react"

type FeatureTabValue = "student" | "staff" | "admin" | "display"

const featureTabs: Array<{
    value: FeatureTabValue
    label: string
    icon: React.ComponentType<{ className?: string }>
}> = [
        { value: "student", label: "Student", icon: QrCode },
        { value: "staff", label: "Staff", icon: ClipboardCheck },
        { value: "admin", label: "Admin", icon: ShieldCheck },
        { value: "display", label: "Display", icon: Tv2 },
    ]

const bullet = (items: string[]) => (
    <div className="grid gap-2 sm:flex sm:flex-wrap sm:gap-2">
        {items.map((i) => (
            <Badge
                key={i}
                variant="outline"
                className="w-full justify-start whitespace-normal wrap-break-word text-left leading-snug sm:w-auto sm:whitespace-nowrap"
            >
                {i}
            </Badge>
        ))}
    </div>
)

export default function Features() {
    const [tab, setTab] = useState<FeatureTabValue>("student")

    return (
        <section id="features" className="scroll-mt-24">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-semibold tracking-tight">Features</h2>
                <p className="text-muted-foreground">
                    Everything required for the three-role setup (Student, Staff/Teller, Admin) plus a public display.
                </p>
            </div>

            <div className="mt-8">
                <Tabs value={tab} onValueChange={(v) => setTab(v as FeatureTabValue)}>
                    {/* Dedicated MOBILE UI (xs): horizontal, swipeable chips */}
                    <div className="sm:hidden">
                        <div className="rounded-xl border bg-card p-2">
                            <div className="px-2 pb-2 text-xs font-medium text-muted-foreground">
                                Choose a view
                            </div>

                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {featureTabs.map((t) => {
                                    const Icon = t.icon
                                    const active = tab === t.value

                                    return (
                                        <Button
                                            key={t.value}
                                            type="button"
                                            variant="outline"
                                            onClick={() => setTab(t.value)}
                                            aria-pressed={active}
                                            className={[
                                                "shrink-0 rounded-lg px-3 py-2",
                                                "flex items-center gap-2",
                                                "whitespace-nowrap",
                                                active ? "border-primary bg-primary/10 text-primary" : "",
                                            ].join(" ")}
                                        >
                                            <Icon className="h-4 w-4 shrink-0" />
                                            <span className="text-sm font-medium">{t.label}</span>
                                        </Button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* DESKTOP / TABLET TABS (unchanged behavior & layout; hidden on xs) */}
                    <TabsList className="hidden w-full sm:grid sm:grid-cols-2 sm:gap-0 md:grid-cols-4">
                        <TabsTrigger value="student" className="gap-2">
                            <QrCode className="h-4 w-4" />
                            Student
                        </TabsTrigger>
                        <TabsTrigger value="staff" className="gap-2">
                            <ClipboardCheck className="h-4 w-4" />
                            Staff
                        </TabsTrigger>
                        <TabsTrigger value="admin" className="gap-2">
                            <ShieldCheck className="h-4 w-4" />
                            Admin
                        </TabsTrigger>
                        <TabsTrigger value="display" className="gap-2">
                            <Tv2 className="h-4 w-4" />
                            Display
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="student" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Student join & status</CardTitle>
                                <CardDescription>Mobile-first QR flow with real-time queue visibility.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4">
                                {bullet([
                                    "Scan QR → Join Queue page",
                                    "Select department/service",
                                    "Enter Student ID (+ phone optional)",
                                    "Receive virtual queue #",
                                    "View status: WAITING / CALLED / HOLD / OUT / SERVED",
                                    "See Now Serving + Up Next (read-only)",
                                ])}
                                <Separator />
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="secondary" className="gap-1 whitespace-normal sm:whitespace-nowrap">
                                        <QrCode className="h-3.5 w-3.5 shrink-0" />
                                        No kiosk required
                                    </Badge>
                                    <Badge variant="secondary" className="gap-1 whitespace-normal sm:whitespace-nowrap">
                                        <BellRing className="h-3.5 w-3.5 shrink-0" />
                                        SMS-ready events
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="staff" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Staff dashboard controls</CardTitle>
                                <CardDescription>Operate the queue quickly with HOLD-based no-show handling.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4">
                                {bullet([
                                    "Login required",
                                    "Assigned department + window",
                                    "Call Next (FIFO WAITING)",
                                    "Recall (no re-order, no attempts)",
                                    "Mark Served",
                                    "No-show → HOLD (attempts +1)",
                                    "Return from HOLD (append to end)",
                                ])}
                                <Separator />
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="secondary" className="gap-1 whitespace-normal sm:whitespace-nowrap">
                                        <BellRing className="h-3.5 w-3.5 shrink-0" />
                                        SMS on call/next
                                    </Badge>
                                    <Badge variant="secondary" className="gap-1 whitespace-normal sm:whitespace-nowrap">
                                        <Volume2 className="h-3.5 w-3.5 shrink-0" />
                                        Voice on call
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="admin" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Admin management</CardTitle>
                                <CardDescription>Configure departments, windows, staff assignments, rules, and audit logs.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4">
                                {bullet([
                                    "Create/update/disable departments",
                                    "Create/update/disable service windows",
                                    "Create/manage staff accounts + assignments",
                                    "Configure max HOLD attempts (default 4)",
                                    "Configure duplicate active ticket rule",
                                    "Reports + audit trail",
                                ])}
                                <Separator />
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="secondary" className="gap-1 whitespace-normal sm:whitespace-nowrap">
                                        <KeyRound className="h-3.5 w-3.5 shrink-0" />
                                        Role-based access
                                    </Badge>
                                    <Badge variant="secondary" className="gap-1 whitespace-normal sm:whitespace-nowrap">
                                        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                                        Logged actions
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="display" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Public queue display</CardTitle>
                                <CardDescription>Privacy-friendly monitor view with QR for joining.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4">
                                {bullet([
                                    "Department name",
                                    "Now Serving (Queue # + Window #)",
                                    "Up Next list (3–10)",
                                    "Optional: HOLD count (no list for privacy)",
                                    "QR code to Join Queue page",
                                    "Real-time updates (WebSockets recommended)",
                                ])}
                                <Separator />
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="secondary" className="gap-1 whitespace-normal sm:whitespace-nowrap">
                                        <Tv2 className="h-3.5 w-3.5 shrink-0" />
                                        Live updates
                                    </Badge>
                                    <Badge variant="secondary" className="gap-1 whitespace-normal sm:whitespace-nowrap">
                                        <Volume2 className="h-3.5 w-3.5 shrink-0" />
                                        Voice via browser
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </section>
    )
}
