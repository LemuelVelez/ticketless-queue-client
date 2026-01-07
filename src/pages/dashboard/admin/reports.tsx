/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import { BarChart3, CalendarDays, RefreshCw, ShieldCheck, Table2 } from "lucide-react"
import type { DateRange } from "react-day-picker"
import { format } from "date-fns"

import { DashboardLayout } from "@/components/dashboard-layout"
import { ADMIN_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"

import {
    adminApi,
    type Department,
    type ReportsSummaryResponse,
    type ReportsTimeseriesResponse,
    type AuditLogsResponse,
    type TicketStatus,
} from "@/api/admin"
import { useSession } from "@/hooks/use-session"

import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

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

function formatDuration(ms: number | null | undefined) {
    if (ms === null || ms === undefined || Number.isNaN(ms)) return "—"
    if (ms <= 0) return "0m"
    const totalSec = Math.round(ms / 1000)
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    if (min <= 0) return `${sec}s`
    return sec ? `${min}m ${sec}s` : `${min}m`
}

function getStatusCount(byStatus: Partial<Record<TicketStatus, number>> | undefined, s: TicketStatus) {
    const v = byStatus?.[s]
    return typeof v === "number" ? v : 0
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
            if (value.to) return `${format(value.from, "LLL dd, y")} – ${format(value.to, "LLL dd, y")}`
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
                    className={cn("w-full justify-start text-left font-normal", !value?.from && "text-muted-foreground")}
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

export default function AdminReportsPage() {
    const location = useLocation()
    const { user: sessionUser } = useSession()

    const dashboardUser: DashboardUser | undefined = React.useMemo(() => {
        if (!sessionUser) return undefined
        return {
            name: sessionUser.name ?? "Admin",
            email: sessionUser.email ?? "",
        }
    }, [sessionUser])

    // ✅ Fix: allow undefined so setRange matches DateRangePicker's onChange type
    const [range, setRange] = React.useState<DateRange | undefined>(() => lastNDaysRange(7))

    const from = React.useMemo(() => (range?.from ? ymdLocal(range.from) : ""), [range?.from])
    const to = React.useMemo(() => (range?.to ? ymdLocal(range.to) : ""), [range?.to])

    const [departmentId, setDepartmentId] = React.useState<string>("all")

    // Audit log filters
    const [logAction, setLogAction] = React.useState("")
    const [logEntityType, setLogEntityType] = React.useState("")
    const [logActorRole, setLogActorRole] = React.useState<"ALL" | "ADMIN" | "STAFF">("ALL")

    // Data
    const [departments, setDepartments] = React.useState<Department[]>([])
    const [summary, setSummary] = React.useState<ReportsSummaryResponse | null>(null)
    const [series, setSeries] = React.useState<ReportsTimeseriesResponse | null>(null)
    const [logs, setLogs] = React.useState<AuditLogsResponse | null>(null)

    // UI state
    const [loadingDepts, setLoadingDepts] = React.useState(true)
    const [loadingReports, setLoadingReports] = React.useState(true)
    const [loadingLogs, setLoadingLogs] = React.useState(true)
    const [activeTab, setActiveTab] = React.useState<"summary" | "timeseries" | "audit">("summary")

    // Pagination
    const [page, setPage] = React.useState(1)
    const [limit, setLimit] = React.useState(20)

    // Meta dialog
    const [metaOpen, setMetaOpen] = React.useState(false)
    const [metaTitle, setMetaTitle] = React.useState("Meta")
    const [metaJson, setMetaJson] = React.useState<string>("{}")

    const departmentOptions = React.useMemo(() => {
        const enabledSorted = [...departments].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
        return enabledSorted
    }, [departments])

    const selectedDeptLabel = React.useMemo(() => {
        if (departmentId === "all") return "All departments"
        const d = departments.find((x) => x._id === departmentId)
        return d?.name ?? "Selected department"
    }, [departmentId, departments])

    const fetchDepartments = React.useCallback(async () => {
        setLoadingDepts(true)
        try {
            const res = await adminApi.listDepartments()
            setDepartments(res.departments ?? [])
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to load departments."
            toast.error(msg)
        } finally {
            setLoadingDepts(false)
        }
    }, [])

    const fetchReports = React.useCallback(async () => {
        setLoadingReports(true)
        try {
            const deptParam = departmentId === "all" ? undefined : departmentId
            const [s1, s2] = await Promise.all([
                adminApi.getReportsSummary({ from, to, departmentId: deptParam }),
                adminApi.getReportsTimeseries({ from, to, departmentId: deptParam }),
            ])
            setSummary(s1)
            setSeries(s2)
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to load reports."
            toast.error(msg)
        } finally {
            setLoadingReports(false)
        }
    }, [from, to, departmentId])

    const fetchAuditLogs = React.useCallback(async () => {
        setLoadingLogs(true)
        try {
            const actorRole = logActorRole === "ALL" ? undefined : logActorRole
            const res = await adminApi.listAuditLogs({
                page,
                limit,
                action: logAction.trim() || undefined,
                entityType: logEntityType.trim() || undefined,
                actorRole: actorRole as any,
                from,
                to,
            })
            setLogs(res)
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to load audit logs."
            toast.error(msg)
        } finally {
            setLoadingLogs(false)
        }
    }, [page, limit, logAction, logEntityType, logActorRole, from, to])

    React.useEffect(() => {
        void fetchDepartments()
    }, [fetchDepartments])

    React.useEffect(() => {
        void fetchReports()
        void fetchAuditLogs()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const canApply = React.useMemo(() => {
        if (!range?.from || !range?.to) return false
        return from <= to
    }, [range?.from, range?.to, from, to])

    const totals = summary?.totals
    const totalAll = totals?.total ?? 0
    const servedAll = getStatusCount(totals?.byStatus, "SERVED")
    const waitingAll = getStatusCount(totals?.byStatus, "WAITING")
    const calledAll = getStatusCount(totals?.byStatus, "CALLED")
    const holdAll = getStatusCount(totals?.byStatus, "HOLD")
    const outAll = getStatusCount(totals?.byStatus, "OUT")

    const totalPages = React.useMemo(() => {
        const t = logs?.total ?? 0
        return Math.max(1, Math.ceil(t / limit))
    }, [logs?.total, limit])

    function openMeta(title: string, obj: unknown) {
        setMetaTitle(title)
        try {
            setMetaJson(JSON.stringify(obj ?? {}, null, 2))
        } catch {
            setMetaJson(String(obj ?? ""))
        }
        setMetaOpen(true)
    }

    return (
        <DashboardLayout
            title="Reports"
            navItems={ADMIN_NAV_ITEMS}
            user={dashboardUser}
            activePath={location.pathname}
        >
            <div className="grid gap-6">
                {/* Filters */}
                <Card>
                    <CardHeader className="gap-2">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <CardTitle className="flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5" />
                                    Reports
                                </CardTitle>
                                <CardDescription>
                                    View operational metrics by date range and (optionally) department.
                                </CardDescription>
                            </div>

                            {/* XS: stack vertically; desktop unchanged */}
                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        void fetchReports()
                                        void fetchAuditLogs()
                                    }}
                                    className="w-full gap-2 sm:w-auto"
                                    disabled={loadingReports || loadingLogs}
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Refresh
                                </Button>

                                <Button
                                    onClick={() => {
                                        if (!canApply) return toast.error("Pick a valid date range (start and end).")
                                        setPage(1)
                                        void fetchReports()
                                        void fetchAuditLogs()
                                    }}
                                    disabled={!canApply || loadingReports || loadingLogs}
                                    className="w-full gap-2 sm:w-auto"
                                >
                                    <CalendarDays className="h-4 w-4" />
                                    Apply
                                </Button>
                            </div>
                        </div>

                        <Separator />

                        <div className="grid gap-4 md:grid-cols-4">
                            <div className="grid gap-2 md:col-span-2">
                                <Label>Date range</Label>
                                <DateRangePicker value={range} onChange={setRange} />

                                {/* XS: stack vertically; desktop unchanged */}
                                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="w-full sm:w-auto"
                                        onClick={() => setRange({ from: new Date(), to: new Date() })}
                                    >
                                        Today
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="w-full sm:w-auto"
                                        onClick={() => setRange(lastNDaysRange(7))}
                                    >
                                        Last 7 days
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="w-full sm:w-auto"
                                        onClick={() => setRange(lastNDaysRange(30))}
                                    >
                                        Last 30 days
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="w-full sm:w-auto"
                                        onClick={() => setRange(undefined)}
                                    >
                                        Clear
                                    </Button>
                                </div>

                                <div className="text-xs text-muted-foreground">
                                    API range: <span className="font-medium">{from || "—"}</span> →{" "}
                                    <span className="font-medium">{to || "—"}</span>
                                </div>
                            </div>

                            <div className="grid gap-2 md:col-span-2">
                                <Label>Department</Label>
                                <Select value={departmentId} onValueChange={setDepartmentId} disabled={loadingDepts}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All departments</SelectItem>
                                        {departmentOptions.map((d) => (
                                            <SelectItem key={d._id} value={d._id}>
                                                {d.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <div className="text-xs text-muted-foreground">
                                    Currently viewing: <span className="font-medium">{selectedDeptLabel}</span>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                {/* Content Tabs */}
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                    {/* XS-only dedicated mobile tab UI */}
                    <div className="sm:hidden">
                        <Select value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select view" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="summary">Summary</SelectItem>
                                <SelectItem value="timeseries">Daily breakdown</SelectItem>
                                <SelectItem value="audit">Audit logs</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Desktop/tablet tab UI (unchanged) */}
                    <TabsList className="hidden w-full grid-cols-3 sm:grid">
                        <TabsTrigger value="summary">Summary</TabsTrigger>
                        <TabsTrigger value="timeseries">Daily breakdown</TabsTrigger>
                        <TabsTrigger value="audit" className="gap-2">
                            <ShieldCheck className="h-4 w-4" />
                            Audit logs
                        </TabsTrigger>
                    </TabsList>

                    {/* SUMMARY */}
                    <TabsContent value="summary" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Summary</CardTitle>
                                <CardDescription>
                                    Totals across the selected range ({from || "—"} → {to || "—"}).
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="grid gap-6">
                                {loadingReports ? (
                                    <div className="grid gap-3 md:grid-cols-5">
                                        <Skeleton className="h-20 w-full" />
                                        <Skeleton className="h-20 w-full" />
                                        <Skeleton className="h-20 w-full" />
                                        <Skeleton className="h-20 w-full" />
                                        <Skeleton className="h-20 w-full" />
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid gap-3 md:grid-cols-5">
                                            <div className="rounded-lg border p-4">
                                                <div className="text-xs text-muted-foreground">Total tickets</div>
                                                <div className="mt-1 text-2xl font-semibold">{formatNumber(totalAll)}</div>
                                            </div>

                                            <div className="rounded-lg border p-4">
                                                <div className="text-xs text-muted-foreground">Served</div>
                                                <div className="mt-1 text-2xl font-semibold">{formatNumber(servedAll)}</div>
                                                <div className="mt-2">
                                                    <Badge variant="secondary">SERVED</Badge>
                                                </div>
                                            </div>

                                            <div className="rounded-lg border p-4">
                                                <div className="text-xs text-muted-foreground">Waiting</div>
                                                <div className="mt-1 text-2xl font-semibold">{formatNumber(waitingAll)}</div>
                                                <div className="mt-2">
                                                    <Badge variant="outline">WAITING</Badge>
                                                </div>
                                            </div>

                                            <div className="rounded-lg border p-4">
                                                <div className="text-xs text-muted-foreground">Hold</div>
                                                <div className="mt-1 text-2xl font-semibold">{formatNumber(holdAll)}</div>
                                                <div className="mt-2">
                                                    <Badge variant="outline">HOLD</Badge>
                                                </div>
                                            </div>

                                            <div className="rounded-lg border p-4">
                                                <div className="text-xs text-muted-foreground">Out</div>
                                                <div className="mt-1 text-2xl font-semibold">{formatNumber(outAll)}</div>
                                                <div className="mt-2">
                                                    <Badge variant="secondary">OUT</Badge>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid gap-3 md:grid-cols-3">
                                            <div className="rounded-lg border p-4">
                                                <div className="text-xs text-muted-foreground">Called</div>
                                                <div className="mt-1 text-2xl font-semibold">{formatNumber(calledAll)}</div>
                                                <div className="mt-2">
                                                    <Badge variant="outline">CALLED</Badge>
                                                </div>
                                            </div>

                                            <div className="rounded-lg border p-4">
                                                <div className="text-xs text-muted-foreground">Avg wait time</div>
                                                <div className="mt-1 text-2xl font-semibold">{formatDuration(totals?.avgWaitMs)}</div>
                                                <div className="mt-2 text-xs text-muted-foreground">From join → called</div>
                                            </div>

                                            <div className="rounded-lg border p-4">
                                                <div className="text-xs text-muted-foreground">Avg service time</div>
                                                <div className="mt-1 text-2xl font-semibold">{formatDuration(totals?.avgServiceMs)}</div>
                                                <div className="mt-2 text-xs text-muted-foreground">From called → served</div>
                                            </div>
                                        </div>

                                        <Separator />

                                        {/* XS: stack vertically; desktop unchanged */}
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex items-center gap-2">
                                                <Table2 className="h-4 w-4 text-muted-foreground" />
                                                <p className="text-sm font-medium">By department</p>
                                            </div>
                                            <Badge variant="secondary">{formatNumber(summary?.departments?.length ?? 0)} rows</Badge>
                                        </div>

                                        <div className="rounded-lg border">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Department</TableHead>
                                                        <TableHead className="hidden md:table-cell">Total</TableHead>
                                                        <TableHead className="hidden lg:table-cell">WAIT</TableHead>
                                                        <TableHead className="hidden lg:table-cell">CALLED</TableHead>
                                                        <TableHead className="hidden lg:table-cell">HOLD</TableHead>
                                                        <TableHead className="hidden lg:table-cell">OUT</TableHead>
                                                        <TableHead className="text-right">SERVED</TableHead>
                                                        <TableHead className="hidden xl:table-cell text-right">Avg wait</TableHead>
                                                        <TableHead className="hidden xl:table-cell text-right">Avg service</TableHead>
                                                    </TableRow>
                                                </TableHeader>

                                                <TableBody>
                                                    {(summary?.departments ?? []).map((r) => (
                                                        <TableRow key={r.departmentId}>
                                                            <TableCell className="font-medium">
                                                                <div className="flex flex-col">
                                                                    <span className="truncate">{r.name ?? "Department"}</span>
                                                                    <span className="truncate text-xs text-muted-foreground">
                                                                        {r.code ? `Code: ${r.code}` : `ID: ${r.departmentId}`}
                                                                    </span>
                                                                </div>
                                                            </TableCell>

                                                            <TableCell className="hidden md:table-cell">{formatNumber(r.total)}</TableCell>
                                                            <TableCell className="hidden lg:table-cell">{formatNumber(r.waiting)}</TableCell>
                                                            <TableCell className="hidden lg:table-cell">{formatNumber(r.called)}</TableCell>
                                                            <TableCell className="hidden lg:table-cell">{formatNumber(r.hold)}</TableCell>
                                                            <TableCell className="hidden lg:table-cell">{formatNumber(r.out)}</TableCell>

                                                            <TableCell className="text-right">
                                                                <Badge>{formatNumber(r.served)}</Badge>
                                                            </TableCell>

                                                            <TableCell className="hidden xl:table-cell text-right">
                                                                {formatDuration(r.avgWaitMs)}
                                                            </TableCell>

                                                            <TableCell className="hidden xl:table-cell text-right">
                                                                {formatDuration(r.avgServiceMs)}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}

                                                    {(summary?.departments?.length ?? 0) === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                                                                No department rows returned for this range.
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
                    </TabsContent>

                    {/* TIMESERIES */}
                    <TabsContent value="timeseries" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Daily breakdown</CardTitle>
                                <CardDescription>
                                    Totals per day across the selected range ({from || "—"} → {to || "—"}).
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="grid gap-4">
                                {loadingReports ? (
                                    <div className="space-y-3">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ) : (
                                    <div className="rounded-lg border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Total</TableHead>
                                                    <TableHead className="hidden md:table-cell">WAIT</TableHead>
                                                    <TableHead className="hidden md:table-cell">CALLED</TableHead>
                                                    <TableHead className="hidden md:table-cell">HOLD</TableHead>
                                                    <TableHead className="hidden md:table-cell">OUT</TableHead>
                                                    <TableHead className="text-right">SERVED</TableHead>
                                                </TableRow>
                                            </TableHeader>

                                            <TableBody>
                                                {(series?.series ?? []).map((p) => (
                                                    <TableRow key={p.dateKey}>
                                                        <TableCell className="font-medium">{p.dateKey}</TableCell>
                                                        <TableCell>{formatNumber(p.total)}</TableCell>
                                                        <TableCell className="hidden md:table-cell">{formatNumber(p.waiting)}</TableCell>
                                                        <TableCell className="hidden md:table-cell">{formatNumber(p.called)}</TableCell>
                                                        <TableCell className="hidden md:table-cell">{formatNumber(p.hold)}</TableCell>
                                                        <TableCell className="hidden md:table-cell">{formatNumber(p.out)}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Badge>{formatNumber(p.served)}</Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}

                                                {(series?.series?.length ?? 0) === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                                                            No data points returned for this range.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : null}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* AUDIT LOGS */}
                    <TabsContent value="audit" className="mt-4">
                        <Card>
                            <CardHeader className="gap-2">
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div className="min-w-0">
                                        <CardTitle>Audit logs</CardTitle>
                                        <CardDescription>
                                            Filter and review admin/staff actions (range: {from || "—"} → {to || "—"}).
                                        </CardDescription>
                                    </div>

                                    {/* XS: stack vertically; desktop unchanged */}
                                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                        <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
                                            <SelectTrigger className="w-full sm:w-32">
                                                <SelectValue placeholder="Rows" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {[10, 20, 50, 100].map((n) => (
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
                                            disabled={loadingLogs}
                                        >
                                            <RefreshCw className="h-4 w-4" />
                                            Refresh
                                        </Button>
                                    </div>
                                </div>

                                <Separator />

                                <div className="grid gap-3 md:grid-cols-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="log-action">Action (optional)</Label>
                                        <Input
                                            id="log-action"
                                            value={logAction}
                                            onChange={(e) => setLogAction(e.target.value)}
                                            placeholder="e.g., ADMIN_UPDATE_SETTINGS"
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="log-entity">Entity type (optional)</Label>
                                        <Input
                                            id="log-entity"
                                            value={logEntityType}
                                            onChange={(e) => setLogEntityType(e.target.value)}
                                            placeholder="e.g., User, Department"
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>Actor role</Label>
                                        <Select value={logActorRole} onValueChange={(v) => setLogActorRole(v as any)}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ALL">All</SelectItem>
                                                <SelectItem value="ADMIN">ADMIN</SelectItem>
                                                <SelectItem value="STAFF">STAFF</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex items-end gap-2">
                                        <Button
                                            className="w-full"
                                            onClick={() => {
                                                setPage(1)
                                                void fetchAuditLogs()
                                            }}
                                            disabled={loadingLogs}
                                        >
                                            Apply filters
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="grid gap-4">
                                {loadingLogs ? (
                                    <div className="space-y-3">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                                <Badge variant="secondary">Total: {formatNumber(logs?.total ?? 0)}</Badge>
                                                <Badge variant="secondary">
                                                    Page: {page} / {totalPages}
                                                </Badge>
                                            </div>

                                            {/* XS: stack vertically; desktop unchanged */}
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                                <Button
                                                    variant="outline"
                                                    className="w-full sm:w-auto"
                                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                                    disabled={page <= 1}
                                                >
                                                    Prev
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="w-full sm:w-auto"
                                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                                    disabled={page >= totalPages}
                                                >
                                                    Next
                                                </Button>
                                                <Button
                                                    onClick={() => void fetchAuditLogs()}
                                                    disabled={loadingLogs}
                                                    className="w-full gap-2 sm:w-auto"
                                                >
                                                    <RefreshCw className="h-4 w-4" />
                                                    Load
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="rounded-lg border">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>When</TableHead>
                                                        <TableHead>Actor</TableHead>
                                                        <TableHead>Role</TableHead>
                                                        <TableHead>Action</TableHead>
                                                        <TableHead className="hidden lg:table-cell">Entity</TableHead>
                                                        <TableHead className="text-right">Meta</TableHead>
                                                    </TableRow>
                                                </TableHeader>

                                                <TableBody>
                                                    {(logs?.logs ?? []).map((l) => (
                                                        <TableRow key={l.id}>
                                                            <TableCell className="whitespace-nowrap">
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium">{new Date(l.createdAt).toLocaleString()}</span>
                                                                    <span className="text-xs text-muted-foreground">{l.id}</span>
                                                                </div>
                                                            </TableCell>

                                                            <TableCell className="min-w-45">
                                                                <div className="flex flex-col">
                                                                    <span className="truncate font-medium">{l.actorName || "—"}</span>
                                                                    <span className="truncate text-xs text-muted-foreground">
                                                                        {l.actorEmail || l.actorId || "—"}
                                                                    </span>
                                                                </div>
                                                            </TableCell>

                                                            <TableCell>
                                                                <Badge variant={l.actorRole === "ADMIN" ? "default" : "secondary"}>
                                                                    {l.actorRole ?? "—"}
                                                                </Badge>
                                                            </TableCell>

                                                            <TableCell className="font-medium">{l.action}</TableCell>

                                                            <TableCell className="hidden lg:table-cell">
                                                                <div className="flex flex-col">
                                                                    <span className="truncate">{l.entityType || "—"}</span>
                                                                    <span className="truncate text-xs text-muted-foreground">{l.entityId || "—"}</span>
                                                                </div>
                                                            </TableCell>

                                                            <TableCell className="text-right">
                                                                {l.meta && Object.keys(l.meta).length ? (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => openMeta(`${l.action} • ${l.entityType ?? "Meta"}`, l.meta)}
                                                                    >
                                                                        View
                                                                    </Button>
                                                                ) : (
                                                                    <span className="text-sm text-muted-foreground">—</span>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}

                                                    {(logs?.logs?.length ?? 0) === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                                                                No audit logs match your filters.
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
                    </TabsContent>
                </Tabs>
            </div>

            {/* Meta viewer */}
            <Dialog open={metaOpen} onOpenChange={setMetaOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{metaTitle}</DialogTitle>
                    </DialogHeader>

                    <div className="rounded-lg border bg-muted/30 p-3">
                        <pre className="max-h-[60vh] overflow-auto text-xs leading-relaxed">{metaJson}</pre>
                    </div>

                    {/* XS: stack vertically; desktop unchanged */}
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

                        <Button className="w-full sm:w-auto" onClick={() => setMetaOpen(false)}>
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    )
}
