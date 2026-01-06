import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { Megaphone, Monitor, Settings as SettingsIcon, Ticket } from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { STAFF_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"

import { useSession } from "@/hooks/use-session"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

function StatCard({
    title,
    value,
    hint,
    badge,
    actions,
}: {
    title: string
    value: React.ReactNode
    hint?: React.ReactNode
    badge?: React.ReactNode
    actions?: React.ReactNode
}) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <CardTitle className="text-base">{title}</CardTitle>
                        {hint ? <CardDescription className="mt-1">{hint}</CardDescription> : null}
                    </div>
                    {badge ? <div className="shrink-0">{badge}</div> : null}
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-end justify-between gap-3">
                    <div className="text-3xl font-semibold leading-none">{value}</div>
                    {actions ? <div className="shrink-0">{actions}</div> : null}
                </div>
            </CardContent>
        </Card>
    )
}

export default function StaffDashboardPage() {
    const location = useLocation()
    const { user: sessionUser } = useSession()

    const dashboardUser: DashboardUser | undefined = React.useMemo(() => {
        if (!sessionUser) return undefined
        return {
            name: sessionUser.name ?? "Staff",
            email: sessionUser.email ?? "",
        }
    }, [sessionUser])

    const assignedDepartment = sessionUser?.assignedDepartment ?? null
    const assignedWindow = sessionUser?.assignedWindow ?? null

    const hasAssignment = Boolean(assignedDepartment && assignedWindow)

    return (
        <DashboardLayout
            title="Staff Dashboard"
            navItems={STAFF_NAV_ITEMS}
            user={dashboardUser}
            activePath={location.pathname}
        >
            {!hasAssignment ? (
                <Alert className="mb-6">
                    <AlertTitle>Assignment required</AlertTitle>
                    <AlertDescription className="text-sm text-muted-foreground">
                        Your account is not assigned to a department and/or service window. Please contact an admin to set your
                        assignment before serving tickets.
                    </AlertDescription>
                </Alert>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Department"
                    value={assignedDepartment ? "Assigned" : "—"}
                    hint={
                        <span className="text-muted-foreground">
                            {assignedDepartment ? `ID: ${assignedDepartment}` : "No department assigned"}
                        </span>
                    }
                    badge={<Badge variant={assignedDepartment ? "default" : "secondary"}>{assignedDepartment ? "OK" : "Missing"}</Badge>}
                    actions={
                        <Button asChild variant="outline" size="sm" disabled={!assignedDepartment}>
                            <Link to="/staff/queue">Go</Link>
                        </Button>
                    }
                />

                <StatCard
                    title="Window"
                    value={assignedWindow ? "Assigned" : "—"}
                    hint={
                        <span className="text-muted-foreground">
                            {assignedWindow ? `ID: ${assignedWindow}` : "No window assigned"}
                        </span>
                    }
                    badge={<Badge variant={assignedWindow ? "default" : "secondary"}>{assignedWindow ? "OK" : "Missing"}</Badge>}
                    actions={
                        <Button asChild variant="outline" size="sm" disabled={!assignedWindow}>
                            <Link to="/staff/now-serving">Go</Link>
                        </Button>
                    }
                />

                <StatCard
                    title="Queue"
                    value={<span className="text-2xl font-semibold">Serve</span>}
                    hint={<span className="text-muted-foreground">Call, hold, or complete tickets</span>}
                    badge={<Badge variant="secondary">Staff</Badge>}
                    actions={
                        <Button asChild variant="outline" size="sm" disabled={!hasAssignment}>
                            <Link to="/staff/queue">Open</Link>
                        </Button>
                    }
                />

                <StatCard
                    title="Public Display"
                    value={<span className="text-2xl font-semibold">View</span>}
                    hint={<span className="text-muted-foreground">Show Now Serving & Up Next</span>}
                    badge={<Badge variant="secondary">Display</Badge>}
                    actions={
                        <Button asChild variant="outline" size="sm">
                            <Link to="/display">Open</Link>
                        </Button>
                    }
                />
            </div>

            <Separator className="my-6" />

            <div className="grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-base">Quick Actions</CardTitle>
                        <CardDescription>Common staff tasks.</CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-2">
                        <Button asChild className="w-full justify-start" variant="outline" disabled={!hasAssignment}>
                            <Link to="/staff/queue">
                                <Ticket className="mr-2 h-4 w-4" />
                                Queue
                            </Link>
                        </Button>

                        <Button asChild className="w-full justify-start" variant="outline" disabled={!hasAssignment}>
                            <Link to="/staff/now-serving">
                                <Megaphone className="mr-2 h-4 w-4" />
                                Now Serving
                            </Link>
                        </Button>

                        <Button asChild className="w-full justify-start" variant="outline">
                            <Link to="/display">
                                <Monitor className="mr-2 h-4 w-4" />
                                Public Display
                            </Link>
                        </Button>

                        <Button asChild className="w-full justify-start" variant="outline">
                            <Link to="/staff/settings">
                                <SettingsIcon className="mr-2 h-4 w-4" />
                                Settings
                            </Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Your Assignment</CardTitle>
                        <CardDescription>Current department/window assignment.</CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-3">
                        <div className="rounded-lg border p-3">
                            <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-medium">Department</div>
                                <Badge variant={assignedDepartment ? "default" : "secondary"}>
                                    {assignedDepartment ? "Assigned" : "Unassigned"}
                                </Badge>
                            </div>
                            <p className="mt-2 break-all text-xs text-muted-foreground">
                                {assignedDepartment ? assignedDepartment : "Ask an admin to assign your department."}
                            </p>
                        </div>

                        <div className="rounded-lg border p-3">
                            <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-medium">Window</div>
                                <Badge variant={assignedWindow ? "default" : "secondary"}>
                                    {assignedWindow ? "Assigned" : "Unassigned"}
                                </Badge>
                            </div>
                            <p className="mt-2 break-all text-xs text-muted-foreground">
                                {assignedWindow ? assignedWindow : "Ask an admin to assign your service window."}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
