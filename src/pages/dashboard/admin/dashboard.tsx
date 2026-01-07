/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { toast } from "sonner"
import { BarChart3, RefreshCw, ShieldCheck, Users } from "lucide-react"
import { format } from "date-fns"
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"

import { DashboardLayout } from "@/components/dashboard-layout"
import { ADMIN_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"

import { adminApi, type AuditLogsResponse, type Department } from "@/api/admin"
import { useSession } from "@/hooks/use-session"

import { DataTable } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

import type { ColumnDef } from "@tanstack/react-table"

type AccountRole = "STAFF" | "ADMIN"

type AccountUser = {
    id?: string
    _id?: string
    name: string
    email: string
    role?: AccountRole
    active: boolean
    assignedDepartment: string | null
    assignedWindow: string | null
}

function safeRole(role?: string): AccountRole {
    return role === "ADMIN" ? "ADMIN" : "STAFF"
}

function formatNumber(n: number | null | undefined) {
    if (n === null || n === undefined || Number.isNaN(n)) return "—"
    return new Intl.NumberFormat().format(n)
}

function ymdKey(d: Date) {
    return format(d, "yyyy-MM-dd")
}

type AuditLog = AuditLogsResponse["logs"] extends (infer U)[] ? U : any

const CHART = {
    c1: "var(--chart-1)",
    c2: "var(--chart-2)",
    c3: "var(--chart-3)",
    c4: "var(--chart-4)",
    c5: "var(--chart-5)",
} as const

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
    const [refreshing, setRefreshing] = React.useState(false)

    const [departments, setDepartments] = React.useState<Department[]>([])
    const [accounts, setAccounts] = React.useState<AccountUser[]>([])
    const [audit, setAudit] = React.useState<AuditLogsResponse | null>(null)

    const [rangeDays, setRangeDays] = React.useState<7 | 30>(7)

    const range = React.useMemo(() => {
        const to = new Date()
        const from = new Date()
        from.setDate(to.getDate() - (rangeDays - 1))
        return { from, to }
    }, [rangeDays])

    const fromStr = React.useMemo(() => ymdKey(range.from), [range.from])
    const toStr = React.useMemo(() => ymdKey(range.to), [range.to])

    const tooltipContentStyle = React.useMemo<React.CSSProperties>(
        () => ({
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            color: "var(--foreground)",
        }),
        [],
    )

    const tooltipLabelStyle = React.useMemo<React.CSSProperties>(
        () => ({
            color: "var(--foreground)",
            fontWeight: 600,
        }),
        [],
    )

    const tooltipItemStyle = React.useMemo<React.CSSProperties>(
        () => ({
            color: "var(--foreground)",
        }),
        [],
    )

    const fetchAll = React.useCallback(async () => {
        setLoading(true)
        try {
            const [deptRes, staffRes, auditRes] = await Promise.all([
                adminApi.listDepartments(),
                adminApi.listStaff(),
                adminApi.listAuditLogs({
                    page: 1,
                    limit: 200, // dashboard snapshot
                    from: fromStr,
                    to: toStr,
                } as any),
            ])

            setDepartments(deptRes.departments ?? [])
            setAccounts(((staffRes.staff ?? []) as any[]).map((u) => ({ ...u, role: safeRole(u.role) })))
            setAudit(auditRes as any)
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to load dashboard data."
            toast.error(msg)
        } finally {
            setLoading(false)
        }
    }, [fromStr, toStr])

    React.useEffect(() => {
        void fetchAll()
    }, [fetchAll])

    async function handleRefresh() {
        setRefreshing(true)
        try {
            await fetchAll()
            toast.success("Dashboard refreshed.")
        } finally {
            setRefreshing(false)
        }
    }

    const deptNameById = React.useMemo(() => {
        const m = new Map<string, string>()
        for (const d of departments ?? []) m.set(d._id, d.name)
        return m
    }, [departments])

    const accountStats = React.useMemo(() => {
        const total = accounts.length
        const active = accounts.filter((a) => a.active).length
        const inactive = total - active
        const admins = accounts.filter((a) => safeRole(a.role) === "ADMIN").length
        const staff = total - admins
        return { total, active, inactive, admins, staff }
    }, [accounts])

    const deptBreakdown = React.useMemo(() => {
        const counts = new Map<string, number>()
        for (const u of accounts) {
            if (!u.active) continue
            if (safeRole(u.role) !== "STAFF") continue
            const deptId = u.assignedDepartment ?? "unassigned"
            counts.set(deptId, (counts.get(deptId) ?? 0) + 1)
        }

        const rows = Array.from(counts.entries()).map(([deptId, count]) => ({
            deptId,
            name: deptId === "unassigned" ? "Unassigned" : deptNameById.get(deptId) ?? "Unknown",
            count,
        }))

        rows.sort((a, b) => b.count - a.count)
        return rows.slice(0, 8)
    }, [accounts, deptNameById])

    const audits = React.useMemo(() => (audit?.logs ?? []) as AuditLog[], [audit])

    const auditStats = React.useMemo(() => {
        const total = audit?.total ?? audits.length ?? 0
        const uniqueActors = new Set<string>()
        for (const l of audits) {
            const actor = (l as any)?.actorEmail || (l as any)?.actorId || (l as any)?.actorName || ""
            if (actor) uniqueActors.add(String(actor))
        }
        return { total, uniqueActors: uniqueActors.size }
    }, [audit?.total, audits])

    const auditsByDay = React.useMemo(() => {
        const map = new Map<string, number>()
        for (let i = 0; i < rangeDays; i++) {
            const d = new Date(range.from)
            d.setDate(range.from.getDate() + i)
            map.set(ymdKey(d), 0)
        }

        for (const l of audits) {
            const dt = new Date((l as any)?.createdAt ?? Date.now())
            const key = ymdKey(dt)
            if (!map.has(key)) continue
            map.set(key, (map.get(key) ?? 0) + 1)
        }

        return Array.from(map.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([day, count]) => ({ day, count }))
    }, [audits, range.from, rangeDays])

    const topActions = React.useMemo(() => {
        const map = new Map<string, number>()
        for (const l of audits) {
            const action = String((l as any)?.action ?? "UNKNOWN")
            map.set(action, (map.get(action) ?? 0) + 1)
        }
        return Array.from(map.entries())
            .map(([action, count]) => ({ action, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8)
    }, [audits])

    const recentAccounts = React.useMemo(() => {
        return [...accounts]
            .sort((a, b) => (a.active === b.active ? (a.name ?? "").localeCompare(b.name ?? "") : a.active ? -1 : 1))
            .slice(0, 10)
    }, [accounts])

    const recentAudits = React.useMemo(() => {
        return [...audits]
            .sort((a: any, b: any) => {
                const da = new Date(a?.createdAt ?? 0).getTime()
                const db = new Date(b?.createdAt ?? 0).getTime()
                return db - da
            })
            .slice(0, 10)
    }, [audits])

    const accountColumns = React.useMemo<ColumnDef<AccountUser>[]>(
        () => [
            {
                accessorKey: "name",
                header: "Name",
                cell: ({ row }) => (
                    <div className="min-w-0">
                        <div className="truncate font-medium">{row.original.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{row.original.email}</div>
                    </div>
                ),
            },
            {
                accessorKey: "role",
                header: "Role",
                cell: ({ row }) => (
                    <Badge variant={safeRole(row.original.role) === "ADMIN" ? "default" : "secondary"}>
                        {safeRole(row.original.role)}
                    </Badge>
                ),
            },
            {
                accessorKey: "active",
                header: "Status",
                cell: ({ row }) => (
                    <Badge variant={row.original.active ? "default" : "secondary"}>
                        {row.original.active ? "Active" : "Inactive"}
                    </Badge>
                ),
            },
            {
                id: "department",
                header: "Department",
                cell: ({ row }) => {
                    const deptId = row.original.assignedDepartment
                    const name = deptId ? deptNameById.get(deptId) ?? "Unknown" : "—"
                    return <span className="text-muted-foreground">{name}</span>
                },
            },
        ],
        [deptNameById],
    )

    const auditColumns = React.useMemo<ColumnDef<AuditLog>[]>(
        () => [
            {
                accessorKey: "createdAt",
                header: "When",
                cell: ({ row }) => {
                    const v = (row.original as any)?.createdAt
                    return (
                        <div className="whitespace-nowrap">
                            <div className="font-medium">{v ? new Date(v).toLocaleString() : "—"}</div>
                            <div className="text-xs text-muted-foreground">{(row.original as any)?.id ?? "—"}</div>
                        </div>
                    )
                },
            },
            {
                id: "actor",
                header: "Actor",
                cell: ({ row }) => {
                    const l: any = row.original
                    return (
                        <div className="min-w-0">
                            <div className="truncate font-medium">{l.actorName || "—"}</div>
                            <div className="truncate text-xs text-muted-foreground">{l.actorEmail || l.actorId || "—"}</div>
                        </div>
                    )
                },
            },
            {
                accessorKey: "actorRole",
                header: "Role",
                cell: ({ row }) => {
                    const role = String((row.original as any)?.actorRole ?? "—")
                    return <Badge variant={role === "ADMIN" ? "default" : "secondary"}>{role}</Badge>
                },
            },
            {
                accessorKey: "action",
                header: "Action",
                cell: ({ row }) => <span className="font-medium">{String((row.original as any)?.action ?? "—")}</span>,
            },
            {
                id: "entity",
                header: "Entity",
                cell: ({ row }) => {
                    const l: any = row.original
                    return (
                        <div className="min-w-0">
                            <div className="truncate">{l.entityType || "—"}</div>
                            <div className="truncate text-xs text-muted-foreground">{l.entityId || "—"}</div>
                        </div>
                    )
                },
            },
        ],
        [],
    )

    const pieData = React.useMemo(
        () => [
            { name: "Active", value: accountStats.active },
            { name: "Inactive", value: accountStats.inactive },
        ],
        [accountStats.active, accountStats.inactive],
    )

    const rolePieData = React.useMemo(
        () => [
            { name: "ADMIN", value: accountStats.admins },
            { name: "STAFF", value: accountStats.staff },
        ],
        [accountStats.admins, accountStats.staff],
    )

    return (
        <DashboardLayout
            title="Admin dashboard"
            navItems={ADMIN_NAV_ITEMS}
            user={dashboardUser}
            activePath={location.pathname}
        >
            <div className="grid w-full min-w-0 grid-cols-1 gap-6">
                <Card className="min-w-0">
                    <CardHeader className="gap-2">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <CardTitle className="flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5" />
                                    Overview
                                </CardTitle>
                                <CardDescription>
                                    Snapshot of <span className="font-medium">Accounts</span> and{" "}
                                    <span className="font-medium">Audit logs</span>.
                                </CardDescription>
                            </div>

                            {/* ✅ Mobile: vertical controls; Desktop unchanged */}
                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                                    <Button
                                        type="button"
                                        variant={rangeDays === 7 ? "default" : "secondary"}
                                        className="w-full sm:w-auto"
                                        onClick={() => setRangeDays(7)}
                                        disabled={loading || refreshing}
                                    >
                                        Last 7 days
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={rangeDays === 30 ? "default" : "secondary"}
                                        className="w-full sm:w-auto"
                                        onClick={() => setRangeDays(30)}
                                        disabled={loading || refreshing}
                                    >
                                        Last 30 days
                                    </Button>
                                </div>

                                <Button
                                    variant="outline"
                                    onClick={() => void handleRefresh()}
                                    disabled={loading || refreshing}
                                    className="w-full gap-2 sm:w-auto"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Refresh
                                </Button>

                                <Button asChild className="w-full sm:w-auto">
                                    <Link to="/dashboard/admin/accounts" className="gap-2">
                                        <Users className="h-4 w-4" />
                                        Manage accounts
                                    </Link>
                                </Button>

                                <Button asChild variant="secondary" className="w-full sm:w-auto">
                                    <Link to="/dashboard/admin/audits" className="gap-2">
                                        <ShieldCheck className="h-4 w-4" />
                                        View audits
                                    </Link>
                                </Button>
                            </div>
                        </div>

                        <Separator />

                        {/* ✅ Mobile: vertical badges; Desktop unchanged */}
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                            <Badge variant="secondary">Audit range: {fromStr} → {toStr}</Badge>
                            <Badge variant="secondary">Accounts: {formatNumber(accountStats.total)}</Badge>
                            <Badge variant="secondary">Audits (loaded): {formatNumber(audit?.logs?.length ?? 0)}</Badge>
                        </div>
                    </CardHeader>

                    <CardContent className="min-w-0">
                        {loading ? (
                            <div className="space-y-4">
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-72 w-full" />
                                <Skeleton className="h-72 w-full" />
                            </div>
                        ) : (
                            <>
                                {/* KPI cards */}
                                <div className="grid gap-4 md:grid-cols-4">
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm text-muted-foreground">Total accounts</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-semibold">{formatNumber(accountStats.total)}</div>
                                            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                                <Badge variant="default">Active: {formatNumber(accountStats.active)}</Badge>
                                                <Badge variant="secondary">Inactive: {formatNumber(accountStats.inactive)}</Badge>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm text-muted-foreground">Roles</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-semibold">
                                                {formatNumber(accountStats.admins + accountStats.staff)}
                                            </div>
                                            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                                <Badge variant="default">ADMIN: {formatNumber(accountStats.admins)}</Badge>
                                                <Badge variant="secondary">STAFF: {formatNumber(accountStats.staff)}</Badge>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm text-muted-foreground">Audit events</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-semibold">{formatNumber(auditStats.total)}</div>
                                            <div className="mt-1 text-sm text-muted-foreground">
                                                Unique actors: <span className="font-medium">{formatNumber(auditStats.uniqueActors)}</span>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm text-muted-foreground">Top action</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-sm font-medium">{topActions[0]?.action ?? "—"}</div>
                                            <div className="text-2xl font-semibold">{formatNumber(topActions[0]?.count ?? 0)}</div>
                                            <div className="text-xs text-muted-foreground">Occurrences (within range)</div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Charts */}
                                <div className="mt-6 grid gap-6 lg:grid-cols-12">
                                    <Card className="lg:col-span-4">
                                        <CardHeader>
                                            <CardTitle>Account status</CardTitle>
                                            <CardDescription>Active vs inactive</CardDescription>
                                        </CardHeader>
                                        <CardContent className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Tooltip
                                                        contentStyle={tooltipContentStyle}
                                                        labelStyle={tooltipLabelStyle}
                                                        itemStyle={tooltipItemStyle}
                                                    />
                                                    <Legend wrapperStyle={{ color: "var(--muted-foreground)" }} />
                                                    <Pie
                                                        data={pieData}
                                                        dataKey="value"
                                                        nameKey="name"
                                                        outerRadius={80}
                                                        stroke="var(--background)"
                                                    >
                                                        <Cell fill={CHART.c1} />
                                                        <Cell fill={CHART.c2} />
                                                    </Pie>
                                                </PieChart>
                                            </ResponsiveContainer>

                                            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap text-sm">
                                                <Badge variant="default">Active: {formatNumber(accountStats.active)}</Badge>
                                                <Badge variant="secondary">Inactive: {formatNumber(accountStats.inactive)}</Badge>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="lg:col-span-4">
                                        <CardHeader>
                                            <CardTitle>Roles</CardTitle>
                                            <CardDescription>ADMIN vs STAFF</CardDescription>
                                        </CardHeader>
                                        <CardContent className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Tooltip
                                                        contentStyle={tooltipContentStyle}
                                                        labelStyle={tooltipLabelStyle}
                                                        itemStyle={tooltipItemStyle}
                                                    />
                                                    <Legend wrapperStyle={{ color: "var(--muted-foreground)" }} />
                                                    <Pie
                                                        data={rolePieData}
                                                        dataKey="value"
                                                        nameKey="name"
                                                        outerRadius={80}
                                                        stroke="var(--background)"
                                                    >
                                                        <Cell fill={CHART.c4} />
                                                        <Cell fill={CHART.c5} />
                                                    </Pie>
                                                </PieChart>
                                            </ResponsiveContainer>

                                            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap text-sm">
                                                <Badge variant="default">ADMIN: {formatNumber(accountStats.admins)}</Badge>
                                                <Badge variant="secondary">STAFF: {formatNumber(accountStats.staff)}</Badge>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="lg:col-span-4">
                                        <CardHeader>
                                            <CardTitle>Active staff by department</CardTitle>
                                            <CardDescription>Top departments (active STAFF only)</CardDescription>
                                        </CardHeader>
                                        <CardContent className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={deptBreakdown}>
                                                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                                                    <XAxis
                                                        dataKey="name"
                                                        interval={0}
                                                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                                                        axisLine={{ stroke: "var(--border)" }}
                                                        tickLine={{ stroke: "var(--border)" }}
                                                    />
                                                    <YAxis
                                                        allowDecimals={false}
                                                        tick={{ fill: "var(--muted-foreground)" }}
                                                        axisLine={{ stroke: "var(--border)" }}
                                                        tickLine={{ stroke: "var(--border)" }}
                                                    />
                                                    <Tooltip
                                                        contentStyle={tooltipContentStyle}
                                                        labelStyle={tooltipLabelStyle}
                                                        itemStyle={tooltipItemStyle}
                                                    />
                                                    <Bar dataKey="count" fill={CHART.c1} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>
                                </div>

                                <div className="mt-6 grid gap-6 lg:grid-cols-12">
                                    <Card className="lg:col-span-7">
                                        <CardHeader>
                                            <CardTitle>Audits over time</CardTitle>
                                            <CardDescription>Daily count ({rangeDays} days)</CardDescription>
                                        </CardHeader>
                                        <CardContent className="h-72">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={auditsByDay}>
                                                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                                                    <XAxis
                                                        dataKey="day"
                                                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                                                        axisLine={{ stroke: "var(--border)" }}
                                                        tickLine={{ stroke: "var(--border)" }}
                                                    />
                                                    <YAxis
                                                        allowDecimals={false}
                                                        tick={{ fill: "var(--muted-foreground)" }}
                                                        axisLine={{ stroke: "var(--border)" }}
                                                        tickLine={{ stroke: "var(--border)" }}
                                                    />
                                                    <Tooltip
                                                        contentStyle={tooltipContentStyle}
                                                        labelStyle={tooltipLabelStyle}
                                                        itemStyle={tooltipItemStyle}
                                                    />
                                                    <Legend wrapperStyle={{ color: "var(--muted-foreground)" }} />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="count"
                                                        stroke={CHART.c3}
                                                        strokeWidth={2}
                                                        dot={false}
                                                        activeDot={{ r: 4 }}
                                                    />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>

                                    <Card className="lg:col-span-5">
                                        <CardHeader>
                                            <CardTitle>Top actions</CardTitle>
                                            <CardDescription>Most frequent actions (loaded logs)</CardDescription>
                                        </CardHeader>
                                        <CardContent className="h-72">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={topActions} layout="vertical" margin={{ left: 24 }}>
                                                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                                                    <XAxis
                                                        type="number"
                                                        allowDecimals={false}
                                                        tick={{ fill: "var(--muted-foreground)" }}
                                                        axisLine={{ stroke: "var(--border)" }}
                                                        tickLine={{ stroke: "var(--border)" }}
                                                    />
                                                    <YAxis
                                                        type="category"
                                                        dataKey="action"
                                                        width={140}
                                                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                                                        axisLine={{ stroke: "var(--border)" }}
                                                        tickLine={{ stroke: "var(--border)" }}
                                                    />
                                                    <Tooltip
                                                        contentStyle={tooltipContentStyle}
                                                        labelStyle={tooltipLabelStyle}
                                                        itemStyle={tooltipItemStyle}
                                                    />
                                                    <Bar dataKey="count" fill={CHART.c2} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Tables */}
                                <div className="mt-6 grid gap-6 lg:grid-cols-12">
                                    <Card className="min-w-0 lg:col-span-6">
                                        <CardHeader>
                                            <CardTitle>Accounts preview</CardTitle>
                                            <CardDescription>Quick view (top 10)</CardDescription>
                                        </CardHeader>
                                        <CardContent className="min-w-0">
                                            <DataTable
                                                columns={accountColumns}
                                                data={recentAccounts}
                                                searchColumnId="name"
                                                searchPlaceholder="Search name…"
                                            />

                                            {/* ✅ Mobile: vertical actions; Desktop unchanged */}
                                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                                <Button asChild variant="outline" className="w-full sm:w-auto">
                                                    <Link to="/dashboard/admin/accounts">Open full accounts</Link>
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="min-w-0 lg:col-span-6">
                                        <CardHeader>
                                            <CardTitle>Audit logs preview</CardTitle>
                                            <CardDescription>Most recent (top 10)</CardDescription>
                                        </CardHeader>
                                        <CardContent className="min-w-0">
                                            <DataTable
                                                columns={auditColumns}
                                                data={recentAudits}
                                                searchColumnId="action"
                                                searchPlaceholder="Search action…"
                                            />

                                            {/* ✅ Mobile: vertical actions; Desktop unchanged */}
                                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                                <Button asChild variant="outline" className="w-full sm:w-auto">
                                                    <Link to="/dashboard/admin/audits">Open full audits</Link>
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
