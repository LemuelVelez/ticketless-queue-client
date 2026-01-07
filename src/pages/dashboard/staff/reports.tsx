/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import { BarChart3, CalendarDays, RefreshCw, Table2 } from "lucide-react"
import type { DateRange } from "react-day-picker"
import { format } from "date-fns"

import { DashboardLayout } from "@/components/dashboard-layout"
import { STAFF_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"

import { useSession } from "@/hooks/use-session"
import {
    staffApi,
    type ReportsSummaryResponse,
    type ReportsTimeseriesResponse,
    type TicketStatus,
} from "@/api/staff"
import { api } from "@/lib/http"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type DepartmentDisplayResponse = {
    department: { id: string; name: string }
    nowServing: any
    upNext: any[]
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
    const labelLong = React.useMemo(() => {
        if (value?.from) {
            if (value.to) return `${format(value.from, "LLL dd, y")} – ${format(value.to, "LLL dd, y")}`
            return format(value.from, "LLL dd, y")
        }
        return "Pick a date range"
    }, [value])

    const labelShort = React.useMemo(() => {
        if (!value?.from) return "Pick dates"
        if (!value.to) return format(value.from, "MMM d, yyyy")

        const fromD = value.from
        const toD = value.to

        const sameYear = fromD.getFullYear() === toD.getFullYear()
        const sameMonth = sameYear && fromD.getMonth() === toD.getMonth()

        if (sameMonth) return `${format(fromD, "MMM d")}–${format(toD, "d, yyyy")}`
        if (sameYear) return `${format(fromD, "MMM d")}–${format(toD, "MMM d, yyyy")}`
        return `${format(fromD, "MMM d, yyyy")}–${format(toD, "MMM d, yyyy")}`
    }, [value])

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        "w-full min-w-0 justify-start text-left font-normal overflow-hidden",
                        !value?.from && "text-muted-foreground",
                    )}
                >
                    <CalendarDays className="mr-2 h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">
                        <span className="sm:hidden">{labelShort}</span>
                        <span className="hidden sm:inline">{labelLong}</span>
                    </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="range" selected={value} onSelect={onChange} initialFocus numberOfMonths={1} />
            </PopoverContent>
        </Popover>
    )
}

export default function StaffReportsPage() {
    const location = useLocation()
    const { user: sessionUser } = useSession()

    const dashboardUser: DashboardUser | undefined = React.useMemo(() => {
        if (!sessionUser) return undefined
        return {
            name: sessionUser.name ?? "Staff",
            email: sessionUser.email ?? "",
            avatarUrl: (sessionUser as any)?.avatarUrl ?? undefined,
        }
    }, [sessionUser])

    const [range, setRange] = React.useState<DateRange | undefined>(() => lastNDaysRange(7))

    const from = React.useMemo(() => (range?.from ? ymdLocal(range.from) : ""), [range?.from])
    const to = React.useMemo(() => (range?.to ? ymdLocal(range.to) : ""), [range?.to])

    const [departmentId, setDepartmentId] = React.useState<string | null>(null)
    const [departmentName, setDepartmentName] = React.useState<string>("—")

    const [summary, setSummary] = React.useState<ReportsSummaryResponse | null>(null)
    const [series, setSeries] = React.useState<ReportsTimeseriesResponse | null>(null)

    const [loading, setLoading] = React.useState(true)
    const [loadingReports, setLoadingReports] = React.useState(true)

    const [activeTab, setActiveTab] = React.useState<"summary" | "timeseries">("summary")

    const assignedOk = Boolean(departmentId)

    const canApply = React.useMemo(() => {
        if (!range?.from || !range?.to) return false
        return from <= to
    }, [range?.from, range?.to, from, to])

    const fetchAssignmentAndDeptName = React.useCallback(async () => {
        const a = await staffApi.myAssignment()
        const deptId = a.departmentId ?? null
        setDepartmentId(deptId)

        if (!deptId) {
            setDepartmentName("—")
            return
        }

        // Best-effort: use public display endpoint to resolve dept name
        try {
            const res = await api.get<DepartmentDisplayResponse>(`/display/${deptId}`, { auth: false })
            setDepartmentName(res.department?.name ?? "—")
        } catch {
            setDepartmentName("—")
        }
    }, [])

    const fetchReports = React.useCallback(async () => {
        if (!departmentId) {
            setSummary(null)
            setSeries(null)
            return
        }

        if (!canApply) {
            setSummary(null)
            setSeries(null)
            return
        }

        setLoadingReports(true)
        try {
            const [s1, s2] = await Promise.all([
                staffApi.getReportsSummary({ from, to }),
                staffApi.getReportsTimeseries({ from, to }),
            ])
            setSummary(s1)
            setSeries(s2)
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to load reports.")
        } finally {
            setLoadingReports(false)
        }
    }, [departmentId, canApply, from, to])

    React.useEffect(() => {
        ; (async () => {
            setLoading(true)
            try {
                await fetchAssignmentAndDeptName()
            } catch (e: any) {
                toast.error(e?.message ?? "Failed to load assignment.")
            } finally {
                setLoading(false)
            }
        })()
    }, [fetchAssignmentAndDeptName])

    // Initial load once we have departmentId + default range
    React.useEffect(() => {
        if (!departmentId) return
        if (!canApply) return
        void fetchReports()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [departmentId])

    const totals = summary?.totals
    const totalAll = totals?.total ?? 0
    const servedAll = getStatusCount(totals?.byStatus, "SERVED")
    const waitingAll = getStatusCount(totals?.byStatus, "WAITING")
    const calledAll = getStatusCount(totals?.byStatus, "CALLED")
    const holdAll = getStatusCount(totals?.byStatus, "HOLD")
    const outAll = getStatusCount(totals?.byStatus, "OUT")

    return (
        <DashboardLayout title="Reports" navItems={STAFF_NAV_ITEMS} user={dashboardUser} activePath={location.pathname}>
            <div className="grid w-full min-w-0 grid-cols-1 gap-6">
                {/* Filters */}
                <Card className="min-w-0">
                    <CardHeader className="gap-2">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                                <CardTitle className="flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5" />
                                    Staff Reports
                                </CardTitle>
                                <CardDescription>
                                    Reports are scoped to your assigned department.
                                </CardDescription>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        void fetchAssignmentAndDeptName()
                                        void fetchReports()
                                    }}
                                    className="w-full gap-2 sm:w-auto"
                                    disabled={loading || loadingReports}
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Refresh
                                </Button>

                                <Button
                                    onClick={() => {
                                        if (!canApply) return toast.error("Pick a valid date range (start and end).")
                                        void fetchReports()
                                    }}
                                    disabled={!canApply || loading || loadingReports || !assignedOk}
                                    className="w-full gap-2 sm:w-auto"
                                >
                                    <CalendarDays className="h-4 w-4" />
                                    Apply
                                </Button>
                            </div>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                            <div className="grid min-w-0 grid-cols-1 gap-2 sm:col-span-2">
                                <Label>Date range</Label>
                                <DateRangePicker value={range} onChange={setRange} disabled={loading} />

                                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="w-full sm:w-auto"
                                        onClick={() => setRange({ from: new Date(), to: new Date() })}
                                        disabled={loading}
                                    >
                                        Today
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="w-full sm:w-auto"
                                        onClick={() => setRange(lastNDaysRange(7))}
                                        disabled={loading}
                                    >
                                        Last 7 days
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="w-full sm:w-auto"
                                        onClick={() => setRange(lastNDaysRange(30))}
                                        disabled={loading}
                                    >
                                        Last 30 days
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="w-full sm:w-auto"
                                        onClick={() => setRange(undefined)}
                                        disabled={loading}
                                    >
                                        Clear
                                    </Button>
                                </div>

                                <div className="text-xs text-muted-foreground">
                                    API range: <span className="font-medium">{from || "—"}</span> →{" "}
                                    <span className="font-medium">{to || "—"}</span>
                                </div>
                            </div>

                            <div className="grid min-w-0 grid-cols-1 gap-2 sm:col-span-2">
                                <Label>Department</Label>
                                {loading ? (
                                    <Skeleton className="h-10 w-full" />
                                ) : (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="secondary">Name: {departmentName}</Badge>
                                        <Badge variant="secondary">ID: {departmentId ?? "—"}</Badge>
                                        {!assignedOk ? <Badge variant="destructive">Not assigned</Badge> : null}
                                    </div>
                                )}
                                <div className="text-xs text-muted-foreground">
                                    If you are not assigned, ask an admin to assign your department.
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                {/* Content */}
                {loading ? (
                    <Card className="min-w-0">
                        <CardContent className="p-6 space-y-3">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-32 w-full" />
                            <Skeleton className="h-48 w-full" />
                        </CardContent>
                    </Card>
                ) : !assignedOk ? (
                    <Card className="min-w-0">
                        <CardContent className="p-6 text-sm text-muted-foreground">
                            You are not assigned to a department. Please ask an admin to assign your department.
                        </CardContent>
                    </Card>
                ) : (
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                        {/* Mobile tab UI */}
                        <div className="sm:hidden">
                            <Select value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                                <SelectTrigger className="w-full min-w-0">
                                    <SelectValue placeholder="Select view" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="summary">Summary</SelectItem>
                                    <SelectItem value="timeseries">Daily breakdown</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Desktop tab UI */}
                        <TabsList className="hidden w-full grid-cols-2 sm:grid">
                            <TabsTrigger value="summary">Summary</TabsTrigger>
                            <TabsTrigger value="timeseries">Daily breakdown</TabsTrigger>
                        </TabsList>

                        {/* SUMMARY */}
                        <TabsContent value="summary" className="mt-4">
                            <Card className="min-w-0">
                                <CardHeader>
                                    <CardTitle>Summary</CardTitle>
                                    <CardDescription>
                                        Totals across the selected range ({from || "—"} → {to || "—"}).
                                    </CardDescription>
                                </CardHeader>

                                <CardContent className="grid min-w-0 grid-cols-1 gap-6">
                                    {loadingReports ? (
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                                            <Skeleton className="h-20 w-full" />
                                            <Skeleton className="h-20 w-full" />
                                            <Skeleton className="h-20 w-full" />
                                            <Skeleton className="h-20 w-full" />
                                            <Skeleton className="h-20 w-full" />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
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

                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Table2 className="h-4 w-4 text-muted-foreground" />
                                                    <p className="text-sm font-medium">Department breakdown</p>
                                                </div>
                                                <Badge variant="secondary">{formatNumber(summary?.departments?.length ?? 0)} rows</Badge>
                                            </div>

                                            <div className="rounded-lg border overflow-x-auto">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Department</TableHead>
                                                            <TableHead className="hidden sm:table-cell">Total</TableHead>
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
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className="truncate">{r.name ?? departmentName ?? "Department"}</span>
                                                                        <span className="truncate text-xs text-muted-foreground">
                                                                            {r.code ? `Code: ${r.code}` : `ID: ${r.departmentId}`}
                                                                        </span>
                                                                    </div>
                                                                </TableCell>

                                                                <TableCell className="hidden sm:table-cell">{formatNumber(r.total)}</TableCell>
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
                            <Card className="min-w-0">
                                <CardHeader>
                                    <CardTitle>Daily breakdown</CardTitle>
                                    <CardDescription>
                                        Totals per day across the selected range ({from || "—"} → {to || "—"}).
                                    </CardDescription>
                                </CardHeader>

                                <CardContent className="grid min-w-0 grid-cols-1 gap-4">
                                    {loadingReports ? (
                                        <div className="space-y-3">
                                            <Skeleton className="h-10 w-full" />
                                            <Skeleton className="h-10 w-full" />
                                            <Skeleton className="h-10 w-full" />
                                            <Skeleton className="h-10 w-full" />
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Date</TableHead>
                                                        <TableHead>Total</TableHead>
                                                        <TableHead className="hidden sm:table-cell">WAIT</TableHead>
                                                        <TableHead className="hidden sm:table-cell">CALLED</TableHead>
                                                        <TableHead className="hidden sm:table-cell">HOLD</TableHead>
                                                        <TableHead className="hidden sm:table-cell">OUT</TableHead>
                                                        <TableHead className="text-right">SERVED</TableHead>
                                                    </TableRow>
                                                </TableHeader>

                                                <TableBody>
                                                    {(series?.series ?? []).map((p) => (
                                                        <TableRow key={p.dateKey}>
                                                            <TableCell className="font-medium">{p.dateKey}</TableCell>
                                                            <TableCell>{formatNumber(p.total)}</TableCell>
                                                            <TableCell className="hidden sm:table-cell">{formatNumber(p.waiting)}</TableCell>
                                                            <TableCell className="hidden sm:table-cell">{formatNumber(p.called)}</TableCell>
                                                            <TableCell className="hidden sm:table-cell">{formatNumber(p.hold)}</TableCell>
                                                            <TableCell className="hidden sm:table-cell">{formatNumber(p.out)}</TableCell>
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
                    </Tabs>
                )}
            </div>
        </DashboardLayout>
    )
}
