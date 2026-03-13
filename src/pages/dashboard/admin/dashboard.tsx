/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { toast } from "sonner"
import {
    BarChart3,
    Building2,
    FileText,
    LayoutGrid,
    RefreshCw,
    ShieldCheck,
    Users,
} from "lucide-react"
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

import { API_PATHS } from "@/api/api"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ADMIN_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"
import { useSession } from "@/hooks/use-session"
import { api } from "@/lib/http"

import { DataTable } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

import type { ColumnDef } from "@tanstack/react-table"

type AccountRole = "STAFF" | "ADMIN"
type TicketStatus = "WAITING" | "CALLED" | "HOLD" | "SERVED" | "OUT"

type AccountUser = {
    id: string
    name: string
    email: string
    role: AccountRole
    active: boolean
    assignedDepartment: string | null
    assignedWindow: string | null
}

type Department = {
    _id: string
    name: string
    code: string | null
    enabled: boolean
}

type ServiceWindow = {
    _id: string
    name: string
    number: number | null
    department: string | null
    departmentName: string | null
    enabled: boolean
}

type AuditLog = {
    id: string
    createdAt: string | null
    actorName: string | null
    actorEmail: string | null
    actorId: string | null
    actorRole: AccountRole | null
    action: string
    entityType: string | null
    entityId: string | null
}

type Ticket = {
    _id: string
    status: TicketStatus | null
    departmentId: string | null
    departmentName: string | null
    createdAt: string | null
    joinedAt: string | null
    calledAt: string | null
    servedAt: string | null
}

function isRecord(value: unknown): value is Record<string, any> {
    return !!value && typeof value === "object" && !Array.isArray(value)
}

function normalizeString(value: unknown): string | null {
    if (typeof value !== "string") return null
    const clean = value.trim()
    return clean ? clean : null
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
    if (typeof value === "boolean") return value
    if (typeof value === "number") return value !== 0
    if (typeof value === "string") {
        const clean = value.trim().toLowerCase()
        if (["true", "1", "yes", "enabled", "active"].includes(clean)) return true
        if (["false", "0", "no", "disabled", "inactive"].includes(clean))
            return false
    }
    return fallback
}

function normalizeNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string") {
        const n = Number(value.trim())
        if (Number.isFinite(n)) return n
    }
    return null
}

function safeRole(role?: string | null): AccountRole {
    return String(role ?? "").trim().toUpperCase() === "ADMIN" ? "ADMIN" : "STAFF"
}

function isEnabledFlag(value: boolean | undefined) {
    return value !== false
}

function pickFirstString(...values: unknown[]): string | null {
    for (const value of values) {
        const clean = normalizeString(value)
        if (clean) return clean
    }
    return null
}

function pickDateString(...values: unknown[]): string | null {
    for (const value of values) {
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            return value.toISOString()
        }

        if (typeof value === "number" && Number.isFinite(value)) {
            const date = new Date(value)
            if (!Number.isNaN(date.getTime())) return date.toISOString()
        }

        if (typeof value === "string") {
            const clean = value.trim()
            if (!clean) continue
            const date = new Date(clean)
            if (!Number.isNaN(date.getTime())) return date.toISOString()
        }
    }
    return null
}

function getDateMs(value: string | null | undefined): number | null {
    if (!value) return null
    const ms = new Date(value).getTime()
    return Number.isFinite(ms) ? ms : null
}

function extractArray(value: unknown, keys: string[]): any[] {
    if (Array.isArray(value)) return value

    if (!isRecord(value)) return []

    for (const key of keys) {
        if (Array.isArray(value[key])) return value[key]
    }

    return []
}

function extractCount(value: unknown, fallback: number): number {
    if (!isRecord(value)) return fallback

    const direct =
        normalizeNumber(value.total) ??
        normalizeNumber(value.count) ??
        normalizeNumber(value.totalCount)

    return direct ?? fallback
}

function resolveAccountName(user: Record<string, any>) {
    const direct = pickFirstString(user.name, user.fullName, user.displayName)
    if (direct) return direct

    const parts = [user.firstName, user.middleName, user.lastName]
        .map((value) => normalizeString(value))
        .filter(Boolean)

    if (parts.length) return parts.join(" ")

    return "Unnamed user"
}

function normalizeDepartment(raw: unknown): Department | null {
    if (!isRecord(raw)) return null

    const id = pickFirstString(raw._id, raw.id, raw.departmentId)
    const name = pickFirstString(raw.name, raw.departmentName)
    if (!id && !name) return null

    return {
        _id: id ?? name ?? "",
        name: name ?? "Unnamed department",
        code: pickFirstString(raw.code, raw.departmentCode),
        enabled: normalizeBoolean(raw.enabled ?? raw.isEnabled, true),
    }
}

function normalizeServiceWindow(raw: unknown): ServiceWindow | null {
    if (!isRecord(raw)) return null

    const departmentRecord = isRecord(raw.department) ? raw.department : null
    const id = pickFirstString(raw._id, raw.id, raw.windowId)
    const number = normalizeNumber(raw.number ?? raw.windowNumber)

    return {
        _id: id ?? `window-${Math.random().toString(36).slice(2)}`,
        name:
            pickFirstString(raw.name, raw.label, raw.windowName) ??
            (number !== null ? `Window ${number}` : "Unnamed window"),
        number,
        department:
            pickFirstString(
                raw.departmentId,
                raw.assignedDepartment,
                raw.department,
                departmentRecord?._id,
                departmentRecord?.id
            ) ?? null,
        departmentName:
            pickFirstString(
                raw.departmentName,
                departmentRecord?.name,
                departmentRecord?.departmentName
            ) ?? null,
        enabled: normalizeBoolean(raw.enabled ?? raw.isEnabled, true),
    }
}

function normalizeAccount(raw: unknown): AccountUser | null {
    if (!isRecord(raw)) return null

    const id = pickFirstString(raw.id, raw._id, raw.userId)
    if (!id) return null

    return {
        id,
        name: resolveAccountName(raw),
        email: pickFirstString(raw.email) ?? "",
        role: safeRole(pickFirstString(raw.role, raw.userRole) ?? "STAFF"),
        active: normalizeBoolean(
            raw.active ?? raw.isActive ?? raw.enabled ?? raw.status,
            true
        ),
        assignedDepartment:
            pickFirstString(
                raw.assignedDepartment,
                raw.assignedDepartmentId,
                raw.departmentId,
                raw.department?._id,
                raw.department?.id
            ) ?? null,
        assignedWindow:
            pickFirstString(
                raw.assignedWindow,
                raw.assignedWindowId,
                raw.windowId,
                raw.window?._id,
                raw.window?.id
            ) ?? null,
    }
}

function normalizeAuditLog(raw: unknown): AuditLog | null {
    if (!isRecord(raw)) return null

    const actor = isRecord(raw.actor) ? raw.actor : null

    return {
        id: pickFirstString(raw.id, raw._id, raw.logId) ?? "",
        createdAt: pickDateString(raw.createdAt, raw.timestamp, raw.date),
        actorName:
            pickFirstString(
                raw.actorName,
                actor?.name,
                actor?.fullName,
                raw.userName
            ) ?? null,
        actorEmail:
            pickFirstString(raw.actorEmail, actor?.email, raw.userEmail) ?? null,
        actorId: pickFirstString(raw.actorId, actor?._id, actor?.id, raw.userId),
        actorRole: pickFirstString(raw.actorRole, actor?.role)
            ? safeRole(pickFirstString(raw.actorRole, actor?.role))
            : null,
        action: pickFirstString(raw.action, raw.type, raw.event) ?? "UNKNOWN",
        entityType:
            pickFirstString(raw.entityType, raw.subjectType, raw.module) ?? null,
        entityId: pickFirstString(raw.entityId, raw.subjectId, raw.recordId) ?? null,
    }
}

function normalizeTicketStatus(value: unknown): TicketStatus | null {
    const clean = String(value ?? "").trim().toUpperCase()
    if (!clean) return null

    if (["WAITING", "PENDING", "QUEUED"].includes(clean)) return "WAITING"
    if (["CALLED", "IN_SERVICE", "IN_PROGRESS", "SERVING"].includes(clean))
        return "CALLED"
    if (["HOLD", "ON_HOLD"].includes(clean)) return "HOLD"
    if (["SERVED", "DONE", "COMPLETED", "FINISHED"].includes(clean))
        return "SERVED"
    if (["OUT", "CANCELLED", "CANCELED", "NO_SHOW", "EXPIRED"].includes(clean))
        return "OUT"

    return null
}

function normalizeTicket(raw: unknown): Ticket | null {
    if (!isRecord(raw)) return null

    const departmentRecord = isRecord(raw.department) ? raw.department : null

    return {
        _id: pickFirstString(raw._id, raw.id, raw.ticketId) ?? "",
        status: normalizeTicketStatus(raw.status ?? raw.queueStatus ?? raw.state),
        departmentId:
            pickFirstString(
                raw.departmentId,
                raw.department,
                departmentRecord?._id,
                departmentRecord?.id
            ) ?? null,
        departmentName:
            pickFirstString(raw.departmentName, departmentRecord?.name) ?? null,
        createdAt: pickDateString(
            raw.createdAt,
            raw.timestamp,
            raw.date,
            raw.joinedAt
        ),
        joinedAt: pickDateString(
            raw.joinedAt,
            raw.queuedAt,
            raw.createdAt,
            raw.timestamp
        ),
        calledAt: pickDateString(
            raw.calledAt,
            raw.calledOn,
            raw.startedAt,
            raw.serviceStartedAt
        ),
        servedAt: pickDateString(
            raw.servedAt,
            raw.servedOn,
            raw.completedAt,
            raw.finishedAt
        ),
    }
}

function formatNumber(n: number | null | undefined) {
    if (n === null || n === undefined || Number.isNaN(n)) return "—"
    return new Intl.NumberFormat().format(n)
}

function formatDuration(ms: number | null | undefined) {
    if (ms === null || ms === undefined || Number.isNaN(ms)) return "—"
    if (ms <= 0) return "0m"
    const totalSec = Math.round(ms / 1000)
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    if (min <= 0) return `${sec}s`
    return sec ? `${min}m ${sec}s` : `${min}m`
}

function ymdKey(d: Date) {
    return format(d, "yyyy-MM-dd")
}

function getStatusCount(
    byStatus: Partial<Record<TicketStatus, number>> | undefined,
    s: TicketStatus
) {
    const v = byStatus?.[s]
    return typeof v === "number" ? v : 0
}

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
    const [windows, setWindows] = React.useState<ServiceWindow[]>([])
    const [accounts, setAccounts] = React.useState<AccountUser[]>([])
    const [audits, setAudits] = React.useState<AuditLog[]>([])
    const [auditTotal, setAuditTotal] = React.useState(0)
    const [tickets, setTickets] = React.useState<Ticket[]>([])

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
        []
    )

    const tooltipLabelStyle = React.useMemo<React.CSSProperties>(
        () => ({
            color: "var(--foreground)",
            fontWeight: 600,
        }),
        []
    )

    const tooltipItemStyle = React.useMemo<React.CSSProperties>(
        () => ({
            color: "var(--foreground)",
        }),
        []
    )

    const fetchAll = React.useCallback(async () => {
        setLoading(true)

        try {
            const [deptRes, winRes, staffRes, auditRes, ticketRes] =
                await Promise.all([
                    api.getData<unknown>(API_PATHS.departments.enabled, {
                        auth: "staff",
                    }),
                    api.getData<unknown>(API_PATHS.serviceWindows.enabled, {
                        auth: "staff",
                    }),
                    api.getData<unknown>(API_PATHS.users.staff, {
                        auth: "staff",
                    }),
                    api.getData<unknown>(API_PATHS.auditLogs.recent, {
                        auth: "staff",
                        params: {
                            page: 1,
                            limit: 200,
                            from: fromStr,
                            to: toStr,
                        },
                    }),
                    api.getData<unknown>(API_PATHS.tickets.recent, {
                        auth: "staff",
                        params: {
                            page: 1,
                            limit: 500,
                            from: fromStr,
                            to: toStr,
                        },
                    }),
                ])

            const normalizedDepartments = extractArray(deptRes, [
                "departments",
                "items",
                "rows",
                "results",
            ])
                .map(normalizeDepartment)
                .filter(Boolean) as Department[]

            const normalizedWindows = extractArray(winRes, [
                "windows",
                "items",
                "rows",
                "results",
            ])
                .map(normalizeServiceWindow)
                .filter(Boolean) as ServiceWindow[]

            const normalizedAccounts = extractArray(staffRes, [
                "staff",
                "users",
                "items",
                "rows",
                "results",
            ])
                .map(normalizeAccount)
                .filter(Boolean) as AccountUser[]

            const normalizedAudits = extractArray(auditRes, [
                "logs",
                "auditLogs",
                "items",
                "rows",
                "results",
            ])
                .map(normalizeAuditLog)
                .filter(Boolean) as AuditLog[]

            const normalizedTickets = extractArray(ticketRes, [
                "tickets",
                "items",
                "rows",
                "results",
            ])
                .map(normalizeTicket)
                .filter(Boolean) as Ticket[]

            setDepartments(normalizedDepartments)
            setWindows(normalizedWindows)
            setAccounts(
                normalizedAccounts.map((user) => ({
                    ...user,
                    role: safeRole(user.role),
                }))
            )
            setAudits(normalizedAudits)
            setAuditTotal(extractCount(auditRes, normalizedAudits.length))
            setTickets(normalizedTickets)
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
        for (const d of departments ?? []) {
            if (d._id) m.set(d._id, d.name)
        }
        return m
    }, [departments])

    const deptStats = React.useMemo(() => {
        const total = departments.length
        const enabled = departments.filter((d) => isEnabledFlag(d.enabled)).length
        return { total, enabled, disabled: total - enabled }
    }, [departments])

    const windowStats = React.useMemo(() => {
        const total = windows.length
        const enabled = windows.filter((w) => isEnabledFlag(w.enabled)).length
        return { total, enabled, disabled: total - enabled }
    }, [windows])

    const windowsByDept = React.useMemo(() => {
        const map = new Map<string, { name: string; count: number }>()

        for (const w of windows) {
            const deptId = w.department ?? "unassigned"
            const name =
                deptId === "unassigned"
                    ? "Unassigned"
                    : deptNameById.get(deptId) ?? w.departmentName ?? "Unknown"

            const prev = map.get(deptId)
            map.set(deptId, {
                name,
                count: (prev?.count ?? 0) + 1,
            })
        }

        return Array.from(map.entries())
            .map(([deptId, value]) => ({
                deptId,
                name: value.name,
                count: value.count,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8)
    }, [windows, deptNameById])

    const accountStats = React.useMemo(() => {
        const total = accounts.length
        const active = accounts.filter((a) => a.active).length
        const inactive = total - active
        const admins = accounts.filter((a) => safeRole(a.role) === "ADMIN").length
        const staff = total - admins
        return { total, active, inactive, admins, staff }
    }, [accounts])

    const deptBreakdown = React.useMemo(() => {
        const counts = new Map<string, { name: string; count: number }>()

        for (const u of accounts) {
            if (!u.active) continue
            if (safeRole(u.role) !== "STAFF") continue

            const deptId = u.assignedDepartment ?? "unassigned"
            const name =
                deptId === "unassigned"
                    ? "Unassigned"
                    : deptNameById.get(deptId) ?? "Unknown"

            const prev = counts.get(deptId)
            counts.set(deptId, {
                name,
                count: (prev?.count ?? 0) + 1,
            })
        }

        return Array.from(counts.entries())
            .map(([deptId, value]) => ({
                deptId,
                name: value.name,
                count: value.count,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8)
    }, [accounts, deptNameById])

    const auditStats = React.useMemo(() => {
        const total = auditTotal || audits.length || 0
        const uniqueActors = new Set<string>()

        for (const l of audits) {
            const actor = l.actorEmail || l.actorId || l.actorName || ""
            if (actor) uniqueActors.add(String(actor))
        }

        return { total, uniqueActors: uniqueActors.size }
    }, [auditTotal, audits])

    const auditsByDay = React.useMemo(() => {
        const map = new Map<string, number>()

        for (let i = 0; i < rangeDays; i++) {
            const d = new Date(range.from)
            d.setDate(range.from.getDate() + i)
            map.set(ymdKey(d), 0)
        }

        for (const l of audits) {
            const dateValue = pickDateString(l.createdAt)
            const dt = new Date(dateValue ?? Date.now())
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
            const action = String(l.action || "UNKNOWN")
            map.set(action, (map.get(action) ?? 0) + 1)
        }

        return Array.from(map.entries())
            .map(([action, count]) => ({ action, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8)
    }, [audits])

    const recentAccounts = React.useMemo(() => {
        return [...accounts]
            .sort((a, b) =>
                a.active === b.active
                    ? (a.name ?? "").localeCompare(b.name ?? "")
                    : a.active
                      ? -1
                      : 1
            )
            .slice(0, 10)
    }, [accounts])

    const recentAudits = React.useMemo(() => {
        return [...audits]
            .sort((a, b) => {
                const da = new Date(a.createdAt ?? 0).getTime()
                const db = new Date(b.createdAt ?? 0).getTime()
                return db - da
            })
            .slice(0, 10)
    }, [audits])

    const recentDepartments = React.useMemo(() => {
        return [...departments]
            .sort((a, b) => {
                const ae = isEnabledFlag(a.enabled)
                const be = isEnabledFlag(b.enabled)
                if (ae !== be) return ae ? -1 : 1
                return (a.name ?? "").localeCompare(b.name ?? "")
            })
            .slice(0, 10)
    }, [departments])

    const recentWindows = React.useMemo(() => {
        return [...windows]
            .sort((a, b) => {
                const ae = isEnabledFlag(a.enabled)
                const be = isEnabledFlag(b.enabled)
                if (ae !== be) return ae ? -1 : 1
                const da = deptNameById.get(a.department ?? "") ?? a.departmentName ?? ""
                const db = deptNameById.get(b.department ?? "") ?? b.departmentName ?? ""
                if (da !== db) return da.localeCompare(db)
                return Number(a.number ?? 0) - Number(b.number ?? 0)
            })
            .slice(0, 10)
    }, [windows, deptNameById])

    const ticketSummary = React.useMemo(() => {
        const byStatus: Partial<Record<TicketStatus, number>> = {
            WAITING: 0,
            CALLED: 0,
            HOLD: 0,
            SERVED: 0,
            OUT: 0,
        }

        let waitSum = 0
        let waitCount = 0
        let serviceSum = 0
        let serviceCount = 0

        for (const ticket of tickets) {
            if (ticket.status) {
                byStatus[ticket.status] = (byStatus[ticket.status] ?? 0) + 1
            }

            const joinedAt = getDateMs(ticket.joinedAt ?? ticket.createdAt)
            const calledAt = getDateMs(ticket.calledAt)
            const servedAt = getDateMs(ticket.servedAt)

            if (
                joinedAt !== null &&
                calledAt !== null &&
                calledAt >= joinedAt
            ) {
                waitSum += calledAt - joinedAt
                waitCount += 1
            }

            if (
                calledAt !== null &&
                servedAt !== null &&
                servedAt >= calledAt
            ) {
                serviceSum += servedAt - calledAt
                serviceCount += 1
            }
        }

        return {
            total: tickets.length,
            byStatus,
            avgWaitMs: waitCount ? Math.round(waitSum / waitCount) : null,
            avgServiceMs: serviceCount
                ? Math.round(serviceSum / serviceCount)
                : null,
        }
    }, [tickets])

    const rptTotal = ticketSummary.total
    const rptServed = getStatusCount(ticketSummary.byStatus, "SERVED")
    const rptWaiting = getStatusCount(ticketSummary.byStatus, "WAITING")
    const rptCalled = getStatusCount(ticketSummary.byStatus, "CALLED")
    const rptHold = getStatusCount(ticketSummary.byStatus, "HOLD")
    const rptOut = getStatusCount(ticketSummary.byStatus, "OUT")

    const ticketStatusPie = React.useMemo(
        () => [
            { name: "SERVED", value: rptServed },
            { name: "WAITING", value: rptWaiting },
            { name: "CALLED", value: rptCalled },
            { name: "HOLD", value: rptHold },
            { name: "OUT", value: rptOut },
        ],
        [rptServed, rptWaiting, rptCalled, rptHold, rptOut]
    )

    const topServedDepts = React.useMemo(() => {
        const map = new Map<string, { name: string; served: number }>()

        for (const ticket of tickets) {
            if (ticket.status !== "SERVED") continue

            const deptId = ticket.departmentId ?? ticket.departmentName ?? "unassigned"
            const name =
                ticket.departmentName ??
                (ticket.departmentId
                    ? deptNameById.get(ticket.departmentId) ?? "Unknown"
                    : "Unassigned")

            const prev = map.get(deptId)
            map.set(deptId, {
                name,
                served: (prev?.served ?? 0) + 1,
            })
        }

        return Array.from(map.entries())
            .map(([, value]) => ({
                name: value.name,
                served: value.served,
            }))
            .sort((a, b) => b.served - a.served)
            .slice(0, 8)
    }, [tickets, deptNameById])

    const accountColumns = React.useMemo<ColumnDef<AccountUser>[]>(
        () => [
            {
                accessorKey: "name",
                header: "Name",
                cell: ({ row }) => (
                    <div className="min-w-0">
                        <div className="truncate font-medium">{row.original.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                            {row.original.email}
                        </div>
                    </div>
                ),
            },
            {
                accessorKey: "role",
                header: "Role",
                cell: ({ row }) => (
                    <Badge
                        variant={
                            safeRole(row.original.role) === "ADMIN"
                                ? "default"
                                : "secondary"
                        }
                    >
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
        [deptNameById]
    )

    const auditColumns = React.useMemo<ColumnDef<AuditLog>[]>(
        () => [
            {
                accessorKey: "createdAt",
                header: "When",
                cell: ({ row }) => {
                    const v = row.original.createdAt
                    return (
                        <div className="whitespace-nowrap">
                            <div className="font-medium">
                                {v ? new Date(v).toLocaleString() : "—"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {row.original.id ?? "—"}
                            </div>
                        </div>
                    )
                },
            },
            {
                id: "actor",
                header: "Actor",
                cell: ({ row }) => {
                    const l = row.original
                    return (
                        <div className="min-w-0">
                            <div className="truncate font-medium">
                                {l.actorName || "—"}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                                {l.actorEmail || l.actorId || "—"}
                            </div>
                        </div>
                    )
                },
            },
            {
                accessorKey: "actorRole",
                header: "Role",
                cell: ({ row }) => {
                    const role = String(row.original.actorRole ?? "—")
                    return (
                        <Badge variant={role === "ADMIN" ? "default" : "secondary"}>
                            {role}
                        </Badge>
                    )
                },
            },
            {
                accessorKey: "action",
                header: "Action",
                cell: ({ row }) => (
                    <span className="font-medium">
                        {String(row.original.action ?? "—")}
                    </span>
                ),
            },
            {
                id: "entity",
                header: "Entity",
                cell: ({ row }) => {
                    const l = row.original
                    return (
                        <div className="min-w-0">
                            <div className="truncate">{l.entityType || "—"}</div>
                            <div className="truncate text-xs text-muted-foreground">
                                {l.entityId || "—"}
                            </div>
                        </div>
                    )
                },
            },
        ],
        []
    )

    const departmentColumns = React.useMemo<ColumnDef<Department>[]>(
        () => [
            {
                accessorKey: "name",
                header: "Department",
                cell: ({ row }) => (
                    <div className="min-w-0">
                        <div className="truncate font-medium">
                            {row.original.name ?? "—"}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                            Code: {row.original.code || "—"}
                        </div>
                    </div>
                ),
            },
            {
                accessorKey: "enabled",
                header: "Status",
                cell: ({ row }) => (
                    <Badge
                        variant={
                            isEnabledFlag(row.original.enabled)
                                ? "default"
                                : "secondary"
                        }
                    >
                        {isEnabledFlag(row.original.enabled) ? "Enabled" : "Disabled"}
                    </Badge>
                ),
            },
        ],
        []
    )

    const windowColumns = React.useMemo<ColumnDef<ServiceWindow>[]>(
        () => [
            {
                accessorKey: "name",
                header: "Window",
                cell: ({ row }) => (
                    <div className="min-w-0">
                        <div className="truncate font-medium">
                            {row.original.name ?? "—"}{" "}
                            <span className="text-muted-foreground">
                                (#{row.original.number ?? "—"})
                            </span>
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                            Dept:{" "}
                            {deptNameById.get(row.original.department ?? "") ??
                                row.original.departmentName ??
                                "—"}
                        </div>
                    </div>
                ),
            },
            {
                accessorKey: "enabled",
                header: "Status",
                cell: ({ row }) => (
                    <Badge
                        variant={
                            isEnabledFlag(row.original.enabled)
                                ? "default"
                                : "secondary"
                        }
                    >
                        {isEnabledFlag(row.original.enabled) ? "Enabled" : "Disabled"}
                    </Badge>
                ),
            },
        ],
        [deptNameById]
    )

    const accountStatusPie = React.useMemo(
        () => [
            { name: "Active", value: accountStats.active },
            { name: "Inactive", value: accountStats.inactive },
        ],
        [accountStats.active, accountStats.inactive]
    )

    const rolePieData = React.useMemo(
        () => [
            { name: "ADMIN", value: accountStats.admins },
            { name: "STAFF", value: accountStats.staff },
        ],
        [accountStats.admins, accountStats.staff]
    )

    const deptStatusPie = React.useMemo(
        () => [
            { name: "Enabled", value: deptStats.enabled },
            { name: "Disabled", value: deptStats.disabled },
        ],
        [deptStats.enabled, deptStats.disabled]
    )

    const winStatusPie = React.useMemo(
        () => [
            { name: "Enabled", value: windowStats.enabled },
            { name: "Disabled", value: windowStats.disabled },
        ],
        [windowStats.enabled, windowStats.disabled]
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
                                    Key snapshot across accounts, departments, windows,
                                    tickets, and audits.
                                </CardDescription>
                            </div>

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
                                    <Link to="/admin/accounts" className="gap-2">
                                        <Users className="h-4 w-4" />
                                        Accounts
                                    </Link>
                                </Button>

                                <Button asChild variant="secondary" className="w-full sm:w-auto">
                                    <Link to="/admin/audit-logs" className="gap-2">
                                        <ShieldCheck className="h-4 w-4" />
                                        Audit logs
                                    </Link>
                                </Button>

                                <Button asChild variant="secondary" className="w-full sm:w-auto">
                                    <Link to="/admin/departments" className="gap-2">
                                        <Building2 className="h-4 w-4" />
                                        Departments
                                    </Link>
                                </Button>

                                <Button asChild variant="secondary" className="w-full sm:w-auto">
                                    <Link to="/admin/windows" className="gap-2">
                                        <LayoutGrid className="h-4 w-4" />
                                        Windows
                                    </Link>
                                </Button>

                                <Button asChild variant="secondary" className="w-full sm:w-auto">
                                    <Link to="/admin/reports" className="gap-2">
                                        <FileText className="h-4 w-4" />
                                        Reports
                                    </Link>
                                </Button>
                            </div>
                        </div>

                        <Separator />

                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                            <Badge variant="secondary">
                                Range: {fromStr} → {toStr}
                            </Badge>
                            <Badge variant="secondary">
                                Accounts: {formatNumber(accountStats.total)}
                            </Badge>
                            <Badge variant="secondary">
                                Departments: {formatNumber(deptStats.total)}
                            </Badge>
                            <Badge variant="secondary">
                                Windows: {formatNumber(windowStats.total)}
                            </Badge>
                            <Badge variant="secondary">
                                Tickets: {formatNumber(rptTotal)}
                            </Badge>
                            <Badge variant="secondary">
                                Audits (loaded): {formatNumber(audits.length)}
                            </Badge>
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
                                <div className="grid gap-4 md:grid-cols-4">
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm text-muted-foreground">
                                                Total accounts
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-semibold">
                                                {formatNumber(accountStats.total)}
                                            </div>
                                            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                                <Badge variant="default">
                                                    Active: {formatNumber(accountStats.active)}
                                                </Badge>
                                                <Badge variant="secondary">
                                                    Inactive: {formatNumber(accountStats.inactive)}
                                                </Badge>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm text-muted-foreground">
                                                Roles
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-semibold">
                                                {formatNumber(accountStats.admins + accountStats.staff)}
                                            </div>
                                            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                                <Badge variant="default">
                                                    ADMIN: {formatNumber(accountStats.admins)}
                                                </Badge>
                                                <Badge variant="secondary">
                                                    STAFF: {formatNumber(accountStats.staff)}
                                                </Badge>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm text-muted-foreground">
                                                Departments
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-semibold">
                                                {formatNumber(deptStats.total)}
                                            </div>
                                            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                                <Badge variant="default">
                                                    Enabled: {formatNumber(deptStats.enabled)}
                                                </Badge>
                                                <Badge variant="secondary">
                                                    Disabled: {formatNumber(deptStats.disabled)}
                                                </Badge>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm text-muted-foreground">
                                                Windows
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-semibold">
                                                {formatNumber(windowStats.total)}
                                            </div>
                                            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                                <Badge variant="default">
                                                    Enabled: {formatNumber(windowStats.enabled)}
                                                </Badge>
                                                <Badge variant="secondary">
                                                    Disabled: {formatNumber(windowStats.disabled)}
                                                </Badge>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm text-muted-foreground">
                                                Audit events
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-semibold">
                                                {formatNumber(auditStats.total)}
                                            </div>
                                            <div className="mt-1 text-sm text-muted-foreground">
                                                Unique actors:{" "}
                                                <span className="font-medium">
                                                    {formatNumber(auditStats.uniqueActors)}
                                                </span>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm text-muted-foreground">
                                                Top action
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-sm font-medium">
                                                {topActions[0]?.action ?? "—"}
                                            </div>
                                            <div className="text-2xl font-semibold">
                                                {formatNumber(topActions[0]?.count ?? 0)}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                Occurrences (within range)
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm text-muted-foreground">
                                                Tickets
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-semibold">
                                                {formatNumber(rptTotal)}
                                            </div>
                                            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                                <Badge variant="default">
                                                    SERVED: {formatNumber(rptServed)}
                                                </Badge>
                                                <Badge variant="secondary">
                                                    WAITING: {formatNumber(rptWaiting)}
                                                </Badge>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

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
                                                    <Legend
                                                        wrapperStyle={{
                                                            color: "var(--muted-foreground)",
                                                        }}
                                                    />
                                                    <Pie
                                                        data={accountStatusPie}
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

                                            <div className="mt-2 flex gap-2 text-sm sm:flex-row sm:flex-wrap">
                                                <Badge variant="default">
                                                    Active: {formatNumber(accountStats.active)}
                                                </Badge>
                                                <Badge variant="secondary">
                                                    Inactive: {formatNumber(accountStats.inactive)}
                                                </Badge>
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
                                                    <Legend
                                                        wrapperStyle={{
                                                            color: "var(--muted-foreground)",
                                                        }}
                                                    />
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

                                            <div className="mt-2 flex gap-2 text-sm sm:flex-row sm:flex-wrap">
                                                <Badge variant="default">
                                                    ADMIN: {formatNumber(accountStats.admins)}
                                                </Badge>
                                                <Badge variant="secondary">
                                                    STAFF: {formatNumber(accountStats.staff)}
                                                </Badge>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="lg:col-span-4">
                                        <CardHeader>
                                            <CardTitle>Active staff by department</CardTitle>
                                            <CardDescription>
                                                Top departments (active STAFF only)
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={deptBreakdown}>
                                                    <CartesianGrid
                                                        stroke="var(--border)"
                                                        strokeDasharray="3 3"
                                                    />
                                                    <XAxis
                                                        dataKey="name"
                                                        interval={0}
                                                        tick={{
                                                            fontSize: 11,
                                                            fill: "var(--muted-foreground)",
                                                        }}
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
                                    <Card className="lg:col-span-4">
                                        <CardHeader>
                                            <CardTitle>Departments status</CardTitle>
                                            <CardDescription>Enabled vs disabled</CardDescription>
                                        </CardHeader>
                                        <CardContent className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Tooltip
                                                        contentStyle={tooltipContentStyle}
                                                        labelStyle={tooltipLabelStyle}
                                                        itemStyle={tooltipItemStyle}
                                                    />
                                                    <Legend
                                                        wrapperStyle={{
                                                            color: "var(--muted-foreground)",
                                                        }}
                                                    />
                                                    <Pie
                                                        data={deptStatusPie}
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

                                            <div className="mt-2 flex gap-2 text-sm sm:flex-row sm:flex-wrap">
                                                <Badge variant="default">
                                                    Enabled: {formatNumber(deptStats.enabled)}
                                                </Badge>
                                                <Badge variant="secondary">
                                                    Disabled: {formatNumber(deptStats.disabled)}
                                                </Badge>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="lg:col-span-4">
                                        <CardHeader>
                                            <CardTitle>Windows status</CardTitle>
                                            <CardDescription>Enabled vs disabled</CardDescription>
                                        </CardHeader>
                                        <CardContent className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Tooltip
                                                        contentStyle={tooltipContentStyle}
                                                        labelStyle={tooltipLabelStyle}
                                                        itemStyle={tooltipItemStyle}
                                                    />
                                                    <Legend
                                                        wrapperStyle={{
                                                            color: "var(--muted-foreground)",
                                                        }}
                                                    />
                                                    <Pie
                                                        data={winStatusPie}
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

                                            <div className="mt-2 flex gap-2 text-sm sm:flex-row sm:flex-wrap">
                                                <Badge variant="default">
                                                    Enabled: {formatNumber(windowStats.enabled)}
                                                </Badge>
                                                <Badge variant="secondary">
                                                    Disabled: {formatNumber(windowStats.disabled)}
                                                </Badge>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="lg:col-span-4">
                                        <CardHeader>
                                            <CardTitle>Windows by department</CardTitle>
                                            <CardDescription>
                                                Top departments (by window count)
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={windowsByDept}>
                                                    <CartesianGrid
                                                        stroke="var(--border)"
                                                        strokeDasharray="3 3"
                                                    />
                                                    <XAxis
                                                        dataKey="name"
                                                        interval={0}
                                                        tick={{
                                                            fontSize: 11,
                                                            fill: "var(--muted-foreground)",
                                                        }}
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
                                                    <Bar dataKey="count" fill={CHART.c2} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>
                                </div>

                                <div className="mt-6 grid gap-6 lg:grid-cols-12">
                                    <Card className="lg:col-span-4">
                                        <CardHeader>
                                            <CardTitle>Ticket status</CardTitle>
                                            <CardDescription>
                                                Recent tickets snapshot ({fromStr} → {toStr})
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Tooltip
                                                        contentStyle={tooltipContentStyle}
                                                        labelStyle={tooltipLabelStyle}
                                                        itemStyle={tooltipItemStyle}
                                                    />
                                                    <Legend
                                                        wrapperStyle={{
                                                            color: "var(--muted-foreground)",
                                                        }}
                                                    />
                                                    <Pie
                                                        data={ticketStatusPie}
                                                        dataKey="value"
                                                        nameKey="name"
                                                        outerRadius={80}
                                                        stroke="var(--background)"
                                                    >
                                                        <Cell fill={CHART.c1} />
                                                        <Cell fill={CHART.c2} />
                                                        <Cell fill={CHART.c3} />
                                                        <Cell fill={CHART.c4} />
                                                        <Cell fill={CHART.c5} />
                                                    </Pie>
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>

                                    <Card className="lg:col-span-4">
                                        <CardHeader>
                                            <CardTitle>Tickets summary</CardTitle>
                                            <CardDescription>
                                                Derived from recent ticket data
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-semibold">
                                                {formatNumber(rptTotal)}
                                            </div>
                                            <div className="mt-2 flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap">
                                                <Badge variant="default">
                                                    SERVED: {formatNumber(rptServed)}
                                                </Badge>
                                                <Badge variant="secondary">
                                                    WAITING: {formatNumber(rptWaiting)}
                                                </Badge>
                                                <Badge variant="secondary">
                                                    CALLED: {formatNumber(rptCalled)}
                                                </Badge>
                                                <Badge variant="secondary">
                                                    HOLD: {formatNumber(rptHold)}
                                                </Badge>
                                                <Badge variant="secondary">
                                                    OUT: {formatNumber(rptOut)}
                                                </Badge>
                                            </div>

                                            <Separator className="my-4" />

                                            <div className="grid grid-cols-1 gap-3">
                                                <div className="rounded-lg border p-3">
                                                    <div className="text-xs text-muted-foreground">
                                                        Avg wait time
                                                    </div>
                                                    <div className="mt-1 text-lg font-semibold">
                                                        {formatDuration(ticketSummary.avgWaitMs)}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        From join → called
                                                    </div>
                                                </div>

                                                <div className="rounded-lg border p-3">
                                                    <div className="text-xs text-muted-foreground">
                                                        Avg service time
                                                    </div>
                                                    <div className="mt-1 text-lg font-semibold">
                                                        {formatDuration(ticketSummary.avgServiceMs)}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        From called → served
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                                <Button
                                                    asChild
                                                    variant="outline"
                                                    className="w-full sm:w-auto"
                                                >
                                                    <Link to="/admin/reports">Open full reports</Link>
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="lg:col-span-4">
                                        <CardHeader>
                                            <CardTitle>Top departments</CardTitle>
                                            <CardDescription>By SERVED count</CardDescription>
                                        </CardHeader>
                                        <CardContent className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={topServedDepts}>
                                                    <CartesianGrid
                                                        stroke="var(--border)"
                                                        strokeDasharray="3 3"
                                                    />
                                                    <XAxis
                                                        dataKey="name"
                                                        interval={0}
                                                        tick={{
                                                            fontSize: 11,
                                                            fill: "var(--muted-foreground)",
                                                        }}
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
                                                    <Bar dataKey="served" fill={CHART.c3} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>
                                </div>

                                <div className="mt-6 grid gap-6 lg:grid-cols-12">
                                    <Card className="lg:col-span-7">
                                        <CardHeader>
                                            <CardTitle>Audits over time</CardTitle>
                                            <CardDescription>
                                                Daily count ({rangeDays} days)
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="h-72">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={auditsByDay}>
                                                    <CartesianGrid
                                                        stroke="var(--border)"
                                                        strokeDasharray="3 3"
                                                    />
                                                    <XAxis
                                                        dataKey="day"
                                                        tick={{
                                                            fontSize: 11,
                                                            fill: "var(--muted-foreground)",
                                                        }}
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
                                                    <Legend
                                                        wrapperStyle={{
                                                            color: "var(--muted-foreground)",
                                                        }}
                                                    />
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
                                            <CardDescription>
                                                Most frequent actions (loaded logs)
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="h-72">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={topActions}
                                                    layout="vertical"
                                                    margin={{ left: 24 }}
                                                >
                                                    <CartesianGrid
                                                        stroke="var(--border)"
                                                        strokeDasharray="3 3"
                                                    />
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
                                                        tick={{
                                                            fontSize: 11,
                                                            fill: "var(--muted-foreground)",
                                                        }}
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
                                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                                <Button
                                                    asChild
                                                    variant="outline"
                                                    className="w-full sm:w-auto"
                                                >
                                                    <Link to="/admin/accounts">
                                                        Open full accounts
                                                    </Link>
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
                                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                                <Button
                                                    asChild
                                                    variant="outline"
                                                    className="w-full sm:w-auto"
                                                >
                                                    <Link to="/admin/audit-logs">
                                                        Open full audit logs
                                                    </Link>
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                <div className="mt-6 grid gap-6 lg:grid-cols-12">
                                    <Card className="min-w-0 lg:col-span-6">
                                        <CardHeader>
                                            <CardTitle>Departments preview</CardTitle>
                                            <CardDescription>Quick view (top 10)</CardDescription>
                                        </CardHeader>
                                        <CardContent className="min-w-0">
                                            <DataTable
                                                columns={departmentColumns}
                                                data={recentDepartments}
                                                searchColumnId="name"
                                                searchPlaceholder="Search department…"
                                            />
                                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                                <Button
                                                    asChild
                                                    variant="outline"
                                                    className="w-full sm:w-auto"
                                                >
                                                    <Link to="/admin/departments">
                                                        Open full departments
                                                    </Link>
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="min-w-0 lg:col-span-6">
                                        <CardHeader>
                                            <CardTitle>Windows preview</CardTitle>
                                            <CardDescription>Quick view (top 10)</CardDescription>
                                        </CardHeader>
                                        <CardContent className="min-w-0">
                                            <DataTable
                                                columns={windowColumns}
                                                data={recentWindows}
                                                searchColumnId="name"
                                                searchPlaceholder="Search window…"
                                            />
                                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                                <Button
                                                    asChild
                                                    variant="outline"
                                                    className="w-full sm:w-auto"
                                                >
                                                    <Link to="/admin/windows">
                                                        Open full windows
                                                    </Link>
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