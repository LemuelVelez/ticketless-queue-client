/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import { CalendarDays, RefreshCw, ShieldCheck, Table2 } from "lucide-react"
import type { DateRange } from "react-day-picker"
import { format } from "date-fns"

import { DashboardLayout } from "@/components/dashboard-layout"
import { ADMIN_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"

import { API_PATHS } from "@/api/api"
import { api } from "@/lib/http"
import { useSession } from "@/hooks/use-session"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

type AuditActorRole = "ADMIN" | "STAFF"

type AuditLogRow = {
    id: string
    createdAt: string
    actorName?: string | null
    actorEmail?: string | null
    actorId?: string | null
    actorRole?: AuditActorRole | null
    action: string
    entityType?: string | null
    entityId?: string | null
    meta?: Record<string, unknown> | null
}

type AuditLogsResponse = {
    logs: AuditLogRow[]
    total: number
    page: number
    limit: number
}

const AUDIT_FETCH_LIMIT = 500
const ALL_FILTER_VALUE = "ALL"

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value)
}

function toTrimmedString(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined
    const clean = value.trim()
    return clean || undefined
}

function toNumber(value: unknown, fallback = 0): number {
    const n =
        typeof value === "number"
            ? value
            : typeof value === "string"
              ? Number(value)
              : NaN
    return Number.isFinite(n) ? n : fallback
}

function normalizeActorRole(value: unknown): AuditActorRole | null {
    const role = String(value ?? "")
        .trim()
        .toUpperCase()

    if (role === "ADMIN" || role === "STAFF") return role
    return null
}

function pickFirstString(...values: unknown[]): string | undefined {
    for (const value of values) {
        const clean = toTrimmedString(value)
        if (clean) return clean
    }
    return undefined
}

function normalizeMeta(value: unknown): Record<string, unknown> | null {
    if (isRecord(value)) return value
    return null
}

function normalizeAuditLogRow(value: unknown, index: number): AuditLogRow {
    const row = isRecord(value) ? value : {}

    const actor = isRecord(row.actor) ? row.actor : null
    const entity = isRecord(row.entity) ? row.entity : null

    const id =
        pickFirstString(row.id, row._id, row.auditId, row.logId) ??
        `audit-log-${index}`

    const createdAt =
        pickFirstString(
            row.createdAt,
            row.timestamp,
            row.date,
            row.loggedAt,
            row.updatedAt
        ) ?? new Date().toISOString()

    const action =
        pickFirstString(row.action, row.type, row.event, row.activity) ?? "—"

    const actorName = pickFirstString(
        row.actorName,
        actor?.name,
        actor?.fullName,
        actor?.displayName
    )

    const actorEmail = pickFirstString(row.actorEmail, actor?.email)

    const actorId = pickFirstString(row.actorId, actor?.id, actor?._id)

    const actorRole = normalizeActorRole(row.actorRole ?? actor?.role)

    const entityType = pickFirstString(
        row.entityType,
        entity?.type,
        row.targetType,
        row.subjectType,
        row.entityName
    )

    const entityId = pickFirstString(
        row.entityId,
        entity?.id,
        entity?._id,
        row.targetId,
        row.subjectId
    )

    const meta = normalizeMeta(row.meta ?? row.details ?? row.context)

    return {
        id,
        createdAt,
        actorName: actorName ?? null,
        actorEmail: actorEmail ?? null,
        actorId: actorId ?? null,
        actorRole,
        action,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        meta,
    }
}

function normalizeAuditLogsResponse(
    payload: unknown,
    fallbackPage: number,
    fallbackLimit: number
): AuditLogsResponse {
    const data = isRecord(payload) ? payload : {}

    const rawLogs =
        (Array.isArray(payload) && payload) ||
        (Array.isArray(data.data) && data.data) ||
        (Array.isArray(data.logs) && data.logs) ||
        (Array.isArray(data.items) && data.items) ||
        (Array.isArray(data.rows) && data.rows) ||
        (Array.isArray(data.results) && data.results) ||
        (Array.isArray(data.auditLogs) && data.auditLogs) ||
        []

    const logs = rawLogs
        .map((item, index) => normalizeAuditLogRow(item, index))
        .sort((a, b) => {
            const aTime = new Date(a.createdAt).getTime()
            const bTime = new Date(b.createdAt).getTime()
            return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0)
        })

    const pagination = isRecord(data.pagination) ? data.pagination : null
    const meta = isRecord(data.meta) ? data.meta : null

    const total = toNumber(
        data.total ??
            data.count ??
            data.totalCount ??
            pagination?.total ??
            meta?.total,
        logs.length
    )

    const page = Math.max(
        1,
        toNumber(data.page ?? pagination?.page ?? meta?.page, fallbackPage)
    )

    const limit = Math.max(
        1,
        toNumber(data.limit ?? pagination?.limit ?? meta?.limit, fallbackLimit)
    )

    return { logs, total, page, limit }
}

function ymdLocal(d: Date) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
}

function lastNDaysRange(n: number): DateRange {
    const to = new Date()
    const from = new Date()
    from.setDate(to.getDate() - (n - 1))
    return { from, to }
}

function formatNumber(n: number | null | undefined) {
    if (n === null || n === undefined || Number.isNaN(n)) return "—"
    return new Intl.NumberFormat().format(n)
}

function toStartOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

function toEndOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function uniqueSortedStrings(values: Array<string | null | undefined>) {
    return Array.from(
        new Set(
            values
                .map((value) => String(value ?? "").trim())
                .filter(Boolean)
        )
    ).sort((a, b) => a.localeCompare(b))
}

function DateRangePicker({
    value,
    onChange,
    disabled,
}: {
    value: DateRange | undefined
    onChange: (v: DateRange | undefined) => void
    disabled?: boolean
}) {
    const label = React.useMemo(() => {
        if (value?.from) {
            if (value.to) {
                return `${format(value.from, "LLL dd, y")} – ${format(
                    value.to,
                    "LLL dd, y"
                )}`
            }
            return format(value.from, "LLL dd, y")
        }
        return "Pick a date range"
    }, [value])

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        "w-full justify-start text-left font-normal",
                        !value?.from && "text-muted-foreground"
                    )}
                >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {label}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="range"
                    selected={value}
                    onSelect={onChange}
                    initialFocus
                    numberOfMonths={1}
                />
            </PopoverContent>
        </Popover>
    )
}

export default function AdminAuditsPage() {
    const location = useLocation()
    const { user: sessionUser } = useSession()

    const dashboardUser: DashboardUser | undefined = React.useMemo(() => {
        if (!sessionUser) return undefined
        return {
            name: sessionUser.name ?? "Admin",
            email: sessionUser.email ?? "",
        }
    }, [sessionUser])

    const [range, setRange] = React.useState<DateRange | undefined>(() =>
        lastNDaysRange(7)
    )
    const from = React.useMemo(
        () => (range?.from ? ymdLocal(range.from) : ""),
        [range?.from]
    )
    const to = React.useMemo(
        () => (range?.to ? ymdLocal(range.to) : ""),
        [range?.to]
    )

    const [action, setAction] = React.useState(ALL_FILTER_VALUE)
    const [entityType, setEntityType] = React.useState(ALL_FILTER_VALUE)
    const [actorRole, setActorRole] = React.useState<"ALL" | "ADMIN" | "STAFF">(
        "ALL"
    )

    const [page, setPage] = React.useState(1)
    const [limit, setLimit] = React.useState(50)

    const [loading, setLoading] = React.useState(true)
    const [allLogs, setAllLogs] = React.useState<AuditLogRow[]>([])
    const [loadedTotal, setLoadedTotal] = React.useState(0)

    const [metaOpen, setMetaOpen] = React.useState(false)
    const [metaTitle, setMetaTitle] = React.useState("Meta")
    const [metaJson, setMetaJson] = React.useState<string>("{}")

    const canApplyRange = React.useMemo(() => {
        if (!range?.from && !range?.to) return true
        if (range?.from && range?.to) return from <= to
        return true
    }, [range?.from, range?.to, from, to])

    const actionOptions = React.useMemo(
        () => uniqueSortedStrings(allLogs.map((log) => log.action)),
        [allLogs]
    )

    const entityTypeOptions = React.useMemo(
        () => uniqueSortedStrings(allLogs.map((log) => log.entityType)),
        [allLogs]
    )

    const filteredLogs = React.useMemo(() => {
        const fromBoundary = range?.from ? toStartOfDay(range.from) : null
        const toBoundary = range?.to ? toEndOfDay(range.to) : null

        return allLogs.filter((log) => {
            if (action !== ALL_FILTER_VALUE && log.action !== action) {
                return false
            }

            if (
                entityType !== ALL_FILTER_VALUE &&
                (log.entityType ?? "") !== entityType
            ) {
                return false
            }

            if (actorRole !== "ALL" && log.actorRole !== actorRole) {
                return false
            }

            if (fromBoundary || toBoundary) {
                const createdAt = new Date(log.createdAt)
                const createdAtMs = createdAt.getTime()

                if (!Number.isFinite(createdAtMs)) return false
                if (fromBoundary && createdAtMs < fromBoundary.getTime()) return false
                if (toBoundary && createdAtMs > toBoundary.getTime()) return false
            }

            return true
        })
    }, [allLogs, action, entityType, actorRole, range])

    const totalPages = React.useMemo(() => {
        return Math.max(1, Math.ceil(filteredLogs.length / limit))
    }, [filteredLogs.length, limit])

    const pagedLogs = React.useMemo(() => {
        const start = (page - 1) * limit
        return filteredLogs.slice(start, start + limit)
    }, [filteredLogs, page, limit])

    React.useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages)
        }
    }, [page, totalPages])

    function openMeta(title: string, obj: unknown) {
        setMetaTitle(title)
        try {
            setMetaJson(JSON.stringify(obj ?? {}, null, 2))
        } catch {
            setMetaJson(String(obj ?? ""))
        }
        setMetaOpen(true)
    }

    const fetchAuditLogs = React.useCallback(async () => {
        setLoading(true)

        try {
            const response = await api.get<unknown>(API_PATHS.auditLogs.recent, {
                auth: "staff",
                params: {
                    limit: AUDIT_FETCH_LIMIT,
                },
            })

            const normalized = normalizeAuditLogsResponse(
                response,
                1,
                AUDIT_FETCH_LIMIT
            )

            setAllLogs(normalized.logs)
            setLoadedTotal(normalized.total)
        } catch (e) {
            const msg =
                e instanceof Error ? e.message : "Failed to load audit logs."
            toast.error(msg)
            setAllLogs([])
            setLoadedTotal(0)
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        void fetchAuditLogs()
    }, [fetchAuditLogs])

    return (
        <DashboardLayout
            title="Audit logs"
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
                                    <ShieldCheck className="h-5 w-5" />
                                    Audit logs
                                </CardTitle>
                                <CardDescription>
                                    Filter and review admin/staff actions.
                                </CardDescription>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                <Select
                                    value={String(limit)}
                                    onValueChange={(v) => {
                                        setPage(1)
                                        setLimit(Number(v))
                                    }}
                                >
                                    <SelectTrigger className="w-full sm:w-36">
                                        <SelectValue placeholder="Rows" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[10, 20, 50, 100, 200].map((n) => (
                                            <SelectItem key={n} value={String(n)}>
                                                {n} / page
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Button
                                    variant="outline"
                                    onClick={() => void fetchAuditLogs()}
                                    className="w-full gap-2 sm:w-auto"
                                    disabled={loading}
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Refresh
                                </Button>

                                <Button
                                    onClick={() => {
                                        if (!canApplyRange) {
                                            return toast.error(
                                                "Pick a valid date range (start and end)."
                                            )
                                        }
                                        setPage(1)
                                    }}
                                    className="w-full gap-2 sm:w-auto"
                                    disabled={loading || !canApplyRange}
                                >
                                    <CalendarDays className="h-4 w-4" />
                                    Apply
                                </Button>
                            </div>
                        </div>

                        <Separator />

                        <div className="grid gap-4 md:grid-cols-12">
                            <div className="grid gap-2 md:col-span-4">
                                <Label>Date range</Label>
                                <DateRangePicker
                                    value={range}
                                    onChange={setRange}
                                    disabled={loading}
                                />

                                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="w-full sm:w-auto"
                                        onClick={() => {
                                            setPage(1)
                                            setRange({
                                                from: new Date(),
                                                to: new Date(),
                                            })
                                        }}
                                    >
                                        Today
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="w-full sm:w-auto"
                                        onClick={() => {
                                            setPage(1)
                                            setRange(lastNDaysRange(7))
                                        }}
                                    >
                                        Last 7 days
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="w-full sm:w-auto"
                                        onClick={() => {
                                            setPage(1)
                                            setRange(lastNDaysRange(30))
                                        }}
                                    >
                                        Last 30 days
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="w-full sm:w-auto"
                                        onClick={() => {
                                            setPage(1)
                                            setRange(undefined)
                                        }}
                                    >
                                        Clear
                                    </Button>
                                </div>

                                <div className="text-xs text-muted-foreground">
                                    Selected range:{" "}
                                    <span className="font-medium">
                                        {from || "—"}
                                    </span>{" "}
                                    →{" "}
                                    <span className="font-medium">
                                        {to || "—"}
                                    </span>
                                </div>
                            </div>

                            <div className="grid gap-2 md:col-span-3">
                                <Label>Action</Label>
                                <Select
                                    value={action}
                                    onValueChange={(value) => {
                                        setPage(1)
                                        setAction(value)
                                    }}
                                >
                                    <SelectTrigger className="w-full min-w-0">
                                        <SelectValue placeholder="All actions" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={ALL_FILTER_VALUE}>
                                            All actions
                                        </SelectItem>
                                        {actionOptions.map((option) => (
                                            <SelectItem key={option} value={option}>
                                                {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <div className="text-xs text-muted-foreground">
                                    Loaded from recent audit logs.
                                </div>
                            </div>

                            <div className="grid gap-2 md:col-span-3">
                                <Label>Entity type</Label>
                                <Select
                                    value={entityType}
                                    onValueChange={(value) => {
                                        setPage(1)
                                        setEntityType(value)
                                    }}
                                >
                                    <SelectTrigger className="w-full min-w-0">
                                        <SelectValue placeholder="All entity types" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={ALL_FILTER_VALUE}>
                                            All entity types
                                        </SelectItem>
                                        {entityTypeOptions.map((option) => (
                                            <SelectItem key={option} value={option}>
                                                {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2 md:col-span-2">
                                <Label>Actor role</Label>
                                <Select
                                    value={actorRole}
                                    onValueChange={(v) => {
                                        setPage(1)
                                        setActorRole(v as "ALL" | "ADMIN" | "STAFF")
                                    }}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All</SelectItem>
                                        <SelectItem value="ADMIN">
                                            ADMIN
                                        </SelectItem>
                                        <SelectItem value="STAFF">
                                            STAFF
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="min-w-0">
                        {loading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex flex-wrap items-center gap-2 text-sm">
                                        <Badge variant="secondary">
                                            Total: {formatNumber(filteredLogs.length)}
                                        </Badge>
                                        <Badge variant="secondary">
                                            Loaded: {formatNumber(loadedTotal)}
                                        </Badge>
                                        <Badge variant="secondary">
                                            Page: {page} / {totalPages}
                                        </Badge>
                                        <Badge
                                            variant="secondary"
                                            className="gap-2"
                                        >
                                            <Table2 className="h-4 w-4" />
                                            {formatNumber(pagedLogs.length)} rows
                                        </Badge>
                                    </div>

                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                        <Button
                                            variant="outline"
                                            className="w-full sm:w-auto"
                                            onClick={() =>
                                                setPage((p) => Math.max(1, p - 1))
                                            }
                                            disabled={page <= 1}
                                        >
                                            Prev
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="w-full sm:w-auto"
                                            onClick={() =>
                                                setPage((p) =>
                                                    Math.min(totalPages, p + 1)
                                                )
                                            }
                                            disabled={page >= totalPages}
                                        >
                                            Next
                                        </Button>
                                        <Button
                                            onClick={() => void fetchAuditLogs()}
                                            disabled={loading}
                                            className="w-full gap-2 sm:w-auto"
                                        >
                                            <RefreshCw className="h-4 w-4" />
                                            Load
                                        </Button>
                                    </div>
                                </div>

                                <div className="mt-4 overflow-x-auto rounded-lg border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>When</TableHead>
                                                <TableHead>Actor</TableHead>
                                                <TableHead className="hidden sm:table-cell">
                                                    Role
                                                </TableHead>
                                                <TableHead>Action</TableHead>
                                                <TableHead className="hidden lg:table-cell">
                                                    Entity
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    Meta
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>

                                        <TableBody>
                                            {pagedLogs.map((l) => (
                                                <TableRow key={l.id}>
                                                    <TableCell className="whitespace-nowrap">
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">
                                                                {new Date(
                                                                    l.createdAt
                                                                ).toLocaleString()}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {l.id}
                                                            </span>
                                                        </div>
                                                    </TableCell>

                                                    <TableCell className="min-w-48">
                                                        <div className="flex min-w-0 flex-col">
                                                            <span className="truncate font-medium">
                                                                {l.actorName ||
                                                                    "—"}
                                                            </span>
                                                            <span className="truncate text-xs text-muted-foreground">
                                                                {l.actorEmail ||
                                                                    l.actorId ||
                                                                    "—"}
                                                            </span>
                                                        </div>
                                                    </TableCell>

                                                    <TableCell className="hidden sm:table-cell">
                                                        <Badge
                                                            variant={
                                                                l.actorRole ===
                                                                "ADMIN"
                                                                    ? "default"
                                                                    : "secondary"
                                                            }
                                                        >
                                                            {l.actorRole ?? "—"}
                                                        </Badge>
                                                    </TableCell>

                                                    <TableCell className="font-medium">
                                                        <span className="wrap-break-word">
                                                            {l.action}
                                                        </span>
                                                    </TableCell>

                                                    <TableCell className="hidden lg:table-cell">
                                                        <div className="flex min-w-0 flex-col">
                                                            <span className="truncate">
                                                                {l.entityType ||
                                                                    "—"}
                                                            </span>
                                                            <span className="truncate text-xs text-muted-foreground">
                                                                {l.entityId ||
                                                                    "—"}
                                                            </span>
                                                        </div>
                                                    </TableCell>

                                                    <TableCell className="text-right">
                                                        {l.meta &&
                                                        Object.keys(l.meta)
                                                            .length ? (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() =>
                                                                    openMeta(
                                                                        `${l.action} • ${
                                                                            l.entityType ??
                                                                            "Meta"
                                                                        }`,
                                                                        l.meta
                                                                    )
                                                                }
                                                            >
                                                                View
                                                            </Button>
                                                        ) : (
                                                            <span className="text-sm text-muted-foreground">
                                                                —
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}

                                            {pagedLogs.length === 0 ? (
                                                <TableRow>
                                                    <TableCell
                                                        colSpan={6}
                                                        className="py-10 text-center text-muted-foreground"
                                                    >
                                                        No audit logs match your
                                                        filters.
                                                    </TableCell>
                                                </TableRow>
                                            ) : null}
                                        </TableBody>
                                    </Table>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={metaOpen} onOpenChange={setMetaOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{metaTitle}</DialogTitle>
                    </DialogHeader>

                    <div className="rounded-lg border bg-muted/30 p-3">
                        <pre className="max-h-[60vh] overflow-auto text-xs leading-relaxed">
                            {metaJson}
                        </pre>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(metaJson)
                                    toast.success("Copied to clipboard.")
                                } catch {
                                    toast.error("Copy failed.")
                                }
                            }}
                        >
                            Copy
                        </Button>

                        <Button
                            className="w-full sm:w-auto"
                            onClick={() => setMetaOpen(false)}
                        >
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    )
}