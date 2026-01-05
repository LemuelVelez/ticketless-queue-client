"use client"

import type React from "react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { ShieldCheck, User, UserCog } from "lucide-react"

type RoleTabValue = "student" | "staff" | "admin"

type RoleBlock = {
    label: string
    icon: React.ComponentType<{ className?: string }>
    summary: string
    can: string[]
    cannot: string[]
}

const roles: Record<RoleTabValue, RoleBlock> = {
    student: {
        label: "Student",
        icon: User,
        summary: "Joins the queue via QR, tracks status, and receives notifications.",
        can: [
            "Scan QR and open Join Queue page",
            "Select department/service",
            "Enter Student ID (and phone if required)",
            "Receive queue number",
            "View real-time status + Now Serving/Up Next",
            "Receive SMS notifications",
        ],
        cannot: ["Access staff/admin controls", "Edit queue entry after submission (unless added later)"],
    },
    staff: {
        label: "Staff/Teller",
        icon: UserCog,
        summary: "Calls, recalls, serves, and manages HOLD returns for an assigned department/window.",
        can: [
            "Login (staff authentication required)",
            "Operate queue: Call Next, Recall, Served",
            "No-show → HOLD (attempts +1)",
            "Return from HOLD to end of WAITING",
            "Trigger display updates + SMS + voice (via display page)",
        ],
        cannot: ["Create/edit departments/windows", "Change system settings", "Delete audit logs"],
    },
    admin: {
        label: "Admin",
        icon: ShieldCheck,
        summary: "Manages departments, windows, staff assignments, settings, and reports/audit logs.",
        can: [
            "Create/update/disable departments",
            "Create/update/disable service windows",
            "Create/manage staff accounts + assignments",
            "Configure rules (HOLD attempts, duplicates)",
            "View reports/logs and audit trail",
        ],
        cannot: ["Perform unlogged admin actions (admin actions must be audited)"],
    },
}

const roleTabs: Array<{
    value: RoleTabValue
    label: string
    icon: React.ComponentType<{ className?: string }>
}> = [
        { value: "student", label: "Student", icon: User },
        { value: "staff", label: "Staff/Teller", icon: UserCog },
        { value: "admin", label: "Admin", icon: ShieldCheck },
    ]

function RoleCard({ role }: { role: RoleBlock }) {
    const Icon = role.icon
    return (
        <Card>
            <CardHeader>
                {/* Mobile: stack title items; Desktop unchanged */}
                <CardTitle className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border">
                        <Icon className="h-4 w-4" />
                    </span>
                    <span className="wrap-break-word">{role.label}</span>
                    <Badge variant="secondary">Role</Badge>
                </CardTitle>
                <CardDescription className="wrap-break-word">{role.summary}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4">
                <div className="grid gap-2">
                    <div className="flex items-center gap-2">
                        <Badge>Can</Badge>
                    </div>

                    <div className="grid gap-2 sm:flex sm:flex-wrap sm:gap-2">
                        {role.can.map((x) => (
                            <Badge
                                key={x}
                                variant="outline"
                                className="w-full justify-start whitespace-normal wrap-break-word text-left leading-snug sm:w-auto sm:whitespace-nowrap"
                            >
                                {x}
                            </Badge>
                        ))}
                    </div>
                </div>

                <Separator />

                <div className="grid gap-2">
                    <div className="flex items-center gap-2">
                        <Badge variant="destructive">Cannot</Badge>
                    </div>

                    <div className="grid gap-2 sm:flex sm:flex-wrap sm:gap-2">
                        {role.cannot.map((x) => (
                            <Badge
                                key={x}
                                variant="outline"
                                className="w-full justify-start whitespace-normal wrap-break-word text-left leading-snug sm:w-auto sm:whitespace-nowrap"
                            >
                                {x}
                            </Badge>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export default function Roles() {
    const [tab, setTab] = useState<RoleTabValue>("student")

    return (
        <section id="roles" className="scroll-mt-24">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-semibold tracking-tight">Roles</h2>
                <p className="text-muted-foreground">
                    Three-role setup with clear permissions: Student (public), Staff/Teller (authenticated), Admin (full control).
                </p>
            </div>

            <div className="mt-8">
                <Tabs value={tab} onValueChange={(v) => setTab(v as RoleTabValue)}>
                    {/* Dedicated MOBILE UI (xs): horizontal scroll tabs */}
                    <div className="sm:hidden">
                        <div className="rounded-xl border bg-card p-2">
                            <div className="px-2 pb-2 text-xs font-medium text-muted-foreground">
                                Choose a role
                            </div>

                            {/* overflow-x-auto on the actual tab row */}
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {roleTabs.map((t) => {
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
                                                "shrink-0",
                                                "h-auto rounded-lg px-3 py-2",
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

                    {/* DESKTOP / TABLET TABS (unchanged; hidden on xs) */}
                    <TabsList className="hidden w-full sm:grid sm:grid-cols-3">
                        <TabsTrigger value="student">Student</TabsTrigger>
                        <TabsTrigger value="staff">Staff/Teller</TabsTrigger>
                        <TabsTrigger value="admin">Admin</TabsTrigger>
                    </TabsList>

                    <TabsContent value="student" className="mt-4">
                        <RoleCard role={roles.student} />
                    </TabsContent>
                    <TabsContent value="staff" className="mt-4">
                        <RoleCard role={roles.staff} />
                    </TabsContent>
                    <TabsContent value="admin" className="mt-4">
                        <RoleCard role={roles.admin} />
                    </TabsContent>
                </Tabs>
            </div>
        </section>
    )
}
