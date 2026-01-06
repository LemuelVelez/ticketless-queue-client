import * as React from "react"
import { useLocation, Link } from "react-router-dom"
import {
    LayoutDashboard,
    Building2,
    LayoutGrid,
    Users,
    Settings as SettingsIcon,
    RefreshCcw,
} from "lucide-react"
import { toast } from "sonner"

import { DashboardLayout } from "@/components/dashboard-layout"
import type { NavMainItem } from "@/components/nav-main"
import type { DashboardUser } from "@/components/nav-user"

import { adminApi, type Department, type ServiceWindow, type Setting, type StaffUser } from "@/api/admin"
import { useSession } from "@/hooks/use-session"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const ADMIN_NAV: NavMainItem[] = [
    { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { title: "Departments", href: "/admin/departments", icon: Building2 },
    { title: "Windows", href: "/admin/windows", icon: LayoutGrid },
    { title: "Staff Accounts", href: "/admin/staff", icon: Users },
    { title: "Settings", href: "/admin/settings", icon: SettingsIcon },
]

function isEnabledFlag(value: boolean | undefined) {
    // treat undefined as enabled (common backend default)
    return value !== false
}

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

export default function AdminDashboardPage() {
    const location = useLocation()
    const { user: sessionUser } = useSession()

    const dashboardUser: DashboardUser | undefined = React.useMemo(() => {
        if (!sessionUser) return undefined
        return {
            name: sessionUser.name ?? "Admin",
            email: sessionUser.email ?? "",
        }
    }, [sessionUser])

    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    const [settings, setSettings] = React.useState<Setting | null>(null)
    const [departments, setDepartments] = React.useState<Department[]>([])
    const [windows, setWindows] = React.useState<ServiceWindow[]>([])
    const [staff, setStaff] = React.useState<StaffUser[]>([])

    const enabledDepartments = React.useMemo(
        () => departments.filter((d) => isEnabledFlag(d.enabled)).length,
        [departments],
    )
    const enabledWindows = React.useMemo(
        () => windows.filter((w) => isEnabledFlag(w.enabled)).length,
        [windows],
    )
    const activeStaff = React.useMemo(
        () => staff.filter((s) => s.active).length,
        [staff],
    )

    const fetchAll = React.useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const [settingsRes, deptRes, winRes, staffRes] = await Promise.all([
                adminApi.getSettings(),
                adminApi.listDepartments(),
                adminApi.listWindows(),
                adminApi.listStaff(),
            ])

            setSettings(settingsRes.settings ?? null)
            setDepartments(deptRes.departments ?? [])
            setWindows(winRes.windows ?? [])
            setStaff(staffRes.staff ?? [])
        } catch (e) {
            const message = e instanceof Error ? e.message : "Failed to load admin dashboard."
            setError(message)
            toast.error(message)
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        void fetchAll()
    }, [fetchAll])

    const headerRight = (
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void fetchAll()} disabled={loading}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Refresh
            </Button>
            <Button asChild size="sm">
                <Link to="/admin/settings">
                    <SettingsIcon className="mr-2 h-4 w-4" />
                    Settings
                </Link>
            </Button>
        </div>
    )

    return (
        <DashboardLayout
            title="Admin Dashboard"
            navItems={ADMIN_NAV}
            user={dashboardUser}
            headerRightSlot={headerRight}
            activePath={location.pathname}
        >
            {error ? (
                <Alert className="mb-6">
                    <AlertTitle>Couldn’t load dashboard</AlertTitle>
                    <AlertDescription className="flex flex-col gap-3">
                        <div className="text-sm text-muted-foreground">{error}</div>
                        <div>
                            <Button variant="outline" size="sm" onClick={() => void fetchAll()}>
                                Try again
                            </Button>
                        </div>
                    </AlertDescription>
                </Alert>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Departments"
                    value={loading ? <Skeleton className="h-9 w-20" /> : departments.length}
                    hint={
                        loading ? (
                            <Skeleton className="h-4 w-40" />
                        ) : (
                            <span className="text-muted-foreground">
                                {enabledDepartments} enabled
                            </span>
                        )
                    }
                    badge={
                        loading ? (
                            <Skeleton className="h-5 w-16" />
                        ) : (
                            <Badge variant="secondary">{enabledDepartments} active</Badge>
                        )
                    }
                    actions={
                        <Button asChild variant="outline" size="sm">
                            <Link to="/admin/departments">Manage</Link>
                        </Button>
                    }
                />

                <StatCard
                    title="Service Windows"
                    value={loading ? <Skeleton className="h-9 w-20" /> : windows.length}
                    hint={
                        loading ? (
                            <Skeleton className="h-4 w-40" />
                        ) : (
                            <span className="text-muted-foreground">
                                {enabledWindows} enabled
                            </span>
                        )
                    }
                    badge={
                        loading ? (
                            <Skeleton className="h-5 w-16" />
                        ) : (
                            <Badge variant="secondary">{enabledWindows} active</Badge>
                        )
                    }
                    actions={
                        <Button asChild variant="outline" size="sm">
                            <Link to="/admin/windows">Manage</Link>
                        </Button>
                    }
                />

                <StatCard
                    title="Staff Accounts"
                    value={loading ? <Skeleton className="h-9 w-20" /> : staff.length}
                    hint={
                        loading ? (
                            <Skeleton className="h-4 w-40" />
                        ) : (
                            <span className="text-muted-foreground">
                                {activeStaff} active
                            </span>
                        )
                    }
                    badge={
                        loading ? (
                            <Skeleton className="h-5 w-16" />
                        ) : (
                            <Badge variant={activeStaff > 0 ? "default" : "secondary"}>
                                {activeStaff} online-ready
                            </Badge>
                        )
                    }
                    actions={
                        <Button asChild variant="outline" size="sm">
                            <Link to="/admin/staff">Manage</Link>
                        </Button>
                    }
                />

                <StatCard
                    title="Queue Rules"
                    value={
                        loading ? (
                            <Skeleton className="h-9 w-24" />
                        ) : settings ? (
                            <span className="text-2xl font-semibold">
                                {settings.maxHoldAttempts}
                            </span>
                        ) : (
                            <span className="text-2xl font-semibold">—</span>
                        )
                    }
                    hint={
                        loading ? (
                            <Skeleton className="h-4 w-44" />
                        ) : settings ? (
                            <span className="text-muted-foreground">
                                Holds allowed per ticket
                            </span>
                        ) : (
                            <span className="text-muted-foreground">
                                Configure queue behavior
                            </span>
                        )
                    }
                    badge={
                        loading ? (
                            <Skeleton className="h-5 w-28" />
                        ) : settings ? (
                            <Badge variant={settings.disallowDuplicateActiveTickets ? "default" : "secondary"}>
                                {settings.disallowDuplicateActiveTickets ? "No duplicates" : "Duplicates allowed"}
                            </Badge>
                        ) : (
                            <Badge variant="secondary">Not set</Badge>
                        )
                    }
                    actions={
                        <Button asChild variant="outline" size="sm">
                            <Link to="/admin/settings">Edit</Link>
                        </Button>
                    }
                />
            </div>

            <Separator className="my-6" />

            <div className="grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-base">Directory</CardTitle>
                        <CardDescription>
                            Quick view of departments, windows, and staff.
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <Tabs defaultValue="departments" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="departments">Departments</TabsTrigger>
                                <TabsTrigger value="windows">Windows</TabsTrigger>
                                <TabsTrigger value="staff">Staff</TabsTrigger>
                            </TabsList>

                            <TabsContent value="departments" className="mt-4">
                                {loading ? (
                                    <div className="space-y-3">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Code</TableHead>
                                                <TableHead className="text-right">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(departments ?? []).slice(0, 8).map((d) => {
                                                const enabled = isEnabledFlag(d.enabled)
                                                return (
                                                    <TableRow key={d._id}>
                                                        <TableCell className="font-medium">{d.name}</TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            {d.code ?? "—"}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Badge variant={enabled ? "default" : "secondary"}>
                                                                {enabled ? "Enabled" : "Disabled"}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                            {departments.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                                                        No departments found.
                                                    </TableCell>
                                                </TableRow>
                                            ) : null}
                                        </TableBody>
                                    </Table>
                                )}

                                <div className="mt-4 flex justify-end">
                                    <Button asChild variant="outline" size="sm">
                                        <Link to="/admin/departments">View all</Link>
                                    </Button>
                                </div>
                            </TabsContent>

                            <TabsContent value="windows" className="mt-4">
                                {loading ? (
                                    <div className="space-y-3">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Number</TableHead>
                                                <TableHead className="text-right">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(windows ?? []).slice(0, 8).map((w) => {
                                                const enabled = isEnabledFlag(w.enabled)
                                                return (
                                                    <TableRow key={w._id}>
                                                        <TableCell className="font-medium">{w.name}</TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            {w.number}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Badge variant={enabled ? "default" : "secondary"}>
                                                                {enabled ? "Enabled" : "Disabled"}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                            {windows.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                                                        No windows found.
                                                    </TableCell>
                                                </TableRow>
                                            ) : null}
                                        </TableBody>
                                    </Table>
                                )}

                                <div className="mt-4 flex justify-end">
                                    <Button asChild variant="outline" size="sm">
                                        <Link to="/admin/windows">View all</Link>
                                    </Button>
                                </div>
                            </TabsContent>

                            <TabsContent value="staff" className="mt-4">
                                {loading ? (
                                    <div className="space-y-3">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Email</TableHead>
                                                <TableHead className="text-right">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(staff ?? []).slice(0, 8).map((s, idx) => (
                                                <TableRow key={s._id ?? s.id ?? `${s.email}-${idx}`}>
                                                    <TableCell className="font-medium">{s.name}</TableCell>
                                                    <TableCell className="text-muted-foreground">{s.email}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge variant={s.active ? "default" : "secondary"}>
                                                            {s.active ? "Active" : "Inactive"}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {staff.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                                                        No staff accounts found.
                                                    </TableCell>
                                                </TableRow>
                                            ) : null}
                                        </TableBody>
                                    </Table>
                                )}

                                <div className="mt-4 flex justify-end">
                                    <Button asChild variant="outline" size="sm">
                                        <Link to="/admin/staff">View all</Link>
                                    </Button>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Quick Actions</CardTitle>
                        <CardDescription>Common admin tasks.</CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-2">
                        <Button asChild className="w-full justify-start" variant="outline">
                            <Link to="/admin/departments">
                                <Building2 className="mr-2 h-4 w-4" />
                                Manage Departments
                            </Link>
                        </Button>

                        <Button asChild className="w-full justify-start" variant="outline">
                            <Link to="/admin/windows">
                                <LayoutGrid className="mr-2 h-4 w-4" />
                                Manage Windows
                            </Link>
                        </Button>

                        <Button asChild className="w-full justify-start" variant="outline">
                            <Link to="/admin/staff">
                                <Users className="mr-2 h-4 w-4" />
                                Manage Staff Accounts
                            </Link>
                        </Button>

                        <Button asChild className="w-full justify-start" variant="outline">
                            <Link to="/admin/settings">
                                <SettingsIcon className="mr-2 h-4 w-4" />
                                Update Settings
                            </Link>
                        </Button>

                        <Separator className="my-4" />

                        <div className="rounded-lg border p-3">
                            <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-medium">Up next display</div>
                                <Badge variant="secondary">
                                    {loading ? "…" : settings?.upNextCount ?? "—"}
                                </Badge>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                                Controls how many tickets appear on the public display as “Up Next”.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
