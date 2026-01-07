/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { toast } from "sonner"
import {
    BarChart3,
    Monitor,
    RefreshCw,
    Ticket,
    Tv2,
    Megaphone,
    CheckCircle2,
    PauseCircle,
    Maximize2,
} from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { STAFF_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"

import { useSession } from "@/hooks/use-session"
import {
    staffApi,
    type ReportsSummaryResponse,
    type Ticket as TicketType,
    type TicketStatus,
} from "@/api/staff"
import { api } from "@/lib/http"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

type DisplayNowServing = {
    id: string
    queueNumber: number
    windowNumber: number | null
    calledAt: string | null
} | null

type DisplayUpNextRow = {
    id: string
    queueNumber: number
}

type DepartmentDisplayResponse = {
    department: { id: string; name: string }
    nowServing: DisplayNowServing
    upNext: DisplayUpNextRow[]
}

function ymdKey(d: Date) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
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

function fmtTime(v?: string | null) {
    if (!v) return "—"
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleString()
}

function getStatusCount(byStatus: Partial<Record<TicketStatus, number>> | undefined, s: TicketStatus) {
    const v = byStatus?.[s]
    return typeof v === "number" ? v : 0
}

function stripTrailingSlash(s: string) {
    return s.endsWith("/") ? s.slice(0, -1) : s
}

function getClientPublicUrl() {
    const envBase = String((import.meta as any)?.env?.VITE_CLIENT_PUBLIC_URL ?? "").trim()
    if (envBase) return stripTrailingSlash(envBase)
    if (typeof window !== "undefined") return stripTrailingSlash(window.location.origin)
    return ""
}

export default function StaffDashboardPage() {
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

    const [loading, setLoading] = React.useState(true)
    const [refreshing, setRefreshing] = React.useState(false)
    const [busy, setBusy] = React.useState(false)

    const [autoRefresh, setAutoRefresh] = React.useState(true)

    const [departmentId, setDepartmentId] = React.useState<string | null>(null)
    const [departmentName, setDepartmentName] = React.useState<string>("—")
    const [windowInfo, setWindowInfo] = React.useState<{ id: string; name: string; number: number } | null>(null)

    // Display overview (public display endpoint)
    const [displayNow, setDisplayNow] = React.useState<DisplayNowServing>(null)
    const [displayUpNext, setDisplayUpNext] = React.useState<DisplayUpNextRow[]>([])

    // Serving / Queue overview (staff endpoints)
    const [current, setCurrent] = React.useState<TicketType | null>(null)
    const [waiting, setWaiting] = React.useState<TicketType[]>([])
    const [hold, setHold] = React.useState<TicketType[]>([])
    const [out, setOut] = React.useState<TicketType[]>([])
    const [history, setHistory] = React.useState<TicketType[]>([])

    // Reports overview (last 7 days)
    const [reportsSummary, setReportsSummary] = React.useState<ReportsSummaryResponse | null>(null)

    const clientPublicBase = React.useMemo(() => getClientPublicUrl(), [])
    const publicDisplayUrl = React.useMemo(() => {
        if (!departmentId) return ""
        return `${clientPublicBase}/display?departmentId=${encodeURIComponent(departmentId)}`
    }, [clientPublicBase, departmentId])

    const assignedOk = Boolean(departmentId && windowInfo?.id)

    const range = React.useMemo(() => {
        const to = new Date()
        const from = new Date()
        from.setDate(to.getDate() - 6) // last 7 days
        return { from, to }
    }, [])
    const fromStr = React.useMemo(() => ymdKey(range.from), [range.from])
    const toStr = React.useMemo(() => ymdKey(range.to), [range.to])

    const fetchAll = React.useCallback(async () => {
        try {
            const a = await staffApi.myAssignment()
            const deptId = a.departmentId ?? null
            setDepartmentId(deptId)
            setWindowInfo(a.window ? { id: a.window._id, name: a.window.name, number: a.window.number } : null)

            if (!deptId || !a.window?._id) {
                setDepartmentName("—")
                setDisplayNow(null)
                setDisplayUpNext([])
                setCurrent(null)
                setWaiting([])
                setHold([])
                setOut([])
                setHistory([])
                setReportsSummary(null)
                return
            }

            const [displayRes, curRes, wRes, hRes, oRes, hisRes, rptRes] = await Promise.all([
                api.get<DepartmentDisplayResponse>(`/display/${deptId}`, { auth: false }).catch(() => null),
                staffApi.currentCalledForWindow().catch(() => ({ ticket: null })),
                staffApi.listWaiting({ limit: 25 }).catch(() => ({ tickets: [] })),
                staffApi.listHold({ limit: 25 }).catch(() => ({ tickets: [] })),
                staffApi.listOut({ limit: 25 }).catch(() => ({ tickets: [] })),
                staffApi.listHistory({ limit: 25, mine: false }).catch(() => ({ tickets: [] })),
                staffApi.getReportsSummary({ from: fromStr, to: toStr }).catch(() => null),
            ])

            if (displayRes) {
                setDepartmentName(displayRes.department?.name ?? "—")
                setDisplayNow(displayRes.nowServing ?? null)
                setDisplayUpNext(displayRes.upNext ?? [])
            } else {
                setDepartmentName("—")
                setDisplayNow(null)
                setDisplayUpNext([])
            }

            setCurrent(curRes.ticket ?? null)
            setWaiting(wRes.tickets ?? [])
            setHold(hRes.tickets ?? [])
            setOut(oRes.tickets ?? [])
            setHistory(hisRes.tickets ?? [])

            setReportsSummary(rptRes)
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to load staff dashboard.")
        }
    }, [fromStr, toStr])

    React.useEffect(() => {
        ;(async () => {
            setLoading(true)
            try {
                await fetchAll()
            } finally {
                setLoading(false)
            }
        })()
    }, [fetchAll])

    React.useEffect(() => {
        if (!autoRefresh) return
        const t = window.setInterval(() => void fetchAll(), 5000)
        return () => window.clearInterval(t)
    }, [autoRefresh, fetchAll])

    async function handleRefresh() {
        setRefreshing(true)
        try {
            await fetchAll()
            toast.success("Dashboard refreshed.")
        } finally {
            setRefreshing(false)
        }
    }

    async function onCallNext() {
        if (!assignedOk) return toast.error("You are not assigned to a department/window.")
        setBusy(true)
        try {
            const res = await staffApi.callNext()
            toast.success(`Called #${res.ticket.queueNumber}`)
            await fetchAll()
        } catch (e: any) {
            toast.error(e?.message ?? "No waiting tickets.")
        } finally {
            setBusy(false)
        }
    }

    async function onMarkServed() {
        if (!current?._id) return
        setBusy(true)
        try {
            await staffApi.markServed(current._id)
            toast.success(`Marked #${current.queueNumber} as served.`)
            await fetchAll()
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to mark served.")
        } finally {
            setBusy(false)
        }
    }

    async function onHoldNoShow() {
        if (!current?._id) return
        setBusy(true)
        try {
            const res = await staffApi.holdNoShow(current._id)
            toast.success(
                res.ticket.status === "OUT"
                    ? `Ticket #${current.queueNumber} is OUT.`
                    : `Ticket #${current.queueNumber} moved to HOLD.`,
            )
            await fetchAll()
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to hold ticket.")
        } finally {
            setBusy(false)
        }
    }

    const totals = reportsSummary?.totals
    const rptTotal = totals?.total ?? 0
    const rptServed = getStatusCount(totals?.byStatus, "SERVED")
    const rptWaiting = getStatusCount(totals?.byStatus, "WAITING")
    const rptCalled = getStatusCount(totals?.byStatus, "CALLED")
    const rptHold = getStatusCount(totals?.byStatus, "HOLD")
    const rptOut = getStatusCount(totals?.byStatus, "OUT")

    return (
        <DashboardLayout title="Staff dashboard" navItems={STAFF_NAV_ITEMS} user={dashboardUser} activePath={location.pathname}>
            <div className="grid w-full min-w-0 grid-cols-1 gap-6">
                <Card className="min-w-0">
                    <CardHeader className="gap-2">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <CardTitle className="flex items-center gap-2">
                                    <Ticket className="h-5 w-5" />
                                    Overview
                                </CardTitle>
                                <CardDescription>
                                    Quick snapshot of Display, Now Serving, Queue, and Reports (scoped to your assignment).
                                </CardDescription>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                <div className="flex items-center gap-2">
                                    <Switch
                                        id="autoRefresh"
                                        checked={autoRefresh}
                                        onCheckedChange={(v) => setAutoRefresh(Boolean(v))}
                                        disabled={loading || refreshing}
                                    />
                                    <Label htmlFor="autoRefresh" className="text-sm">
                                        Auto refresh
                                    </Label>
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
                                    <Link to="/staff/queue" className="gap-2">
                                        <Ticket className="h-4 w-4" />
                                        Queue
                                    </Link>
                                </Button>

                                <Button asChild variant="secondary" className="w-full sm:w-auto">
                                    <Link to="/staff/now-serving" className="gap-2">
                                        <Tv2 className="h-4 w-4" />
                                        Now Serving
                                    </Link>
                                </Button>

                                <Button asChild variant="secondary" className="w-full sm:w-auto">
                                    <Link to="/staff/display" className="gap-2">
                                        <Monitor className="h-4 w-4" />
                                        Display
                                    </Link>
                                </Button>

                                <Button asChild variant="secondary" className="w-full sm:w-auto">
                                    <Link to="/staff/reports" className="gap-2">
                                        <BarChart3 className="h-4 w-4" />
                                        Reports
                                    </Link>
                                </Button>
                            </div>
                        </div>

                        <Separator />

                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                            <Badge variant="secondary">Dept: {departmentName}</Badge>
                            <Badge variant="secondary">Dept ID: {departmentId ?? "—"}</Badge>
                            <Badge variant="secondary">
                                Window: {windowInfo ? `${windowInfo.name} (#${windowInfo.number})` : "—"}
                            </Badge>
                            {!assignedOk ? <Badge variant="destructive">Not assigned</Badge> : null}
                            <Badge variant="secondary">Waiting: {formatNumber(waiting.length)}</Badge>
                            <Badge variant="secondary">Hold: {formatNumber(hold.length)}</Badge>
                            <Badge variant="secondary">Out: {formatNumber(out.length)}</Badge>
                        </div>
                    </CardHeader>

                    <CardContent className="min-w-0">
                        {loading ? (
                            <div className="space-y-4">
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-64 w-full" />
                                <Skeleton className="h-64 w-full" />
                            </div>
                        ) : !assignedOk ? (
                            <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                                You are not assigned to a department/window. Please ask an admin to assign your account.
                            </div>
                        ) : (
                            <div className="grid gap-6 lg:grid-cols-12">
                                {/* ===== DISPLAY OVERVIEW (from staff/display.tsx) ===== */}
                                <Card className="min-w-0 lg:col-span-6">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Monitor className="h-5 w-5" />
                                            Display overview
                                        </CardTitle>
                                        <CardDescription>
                                            Public display snapshot (department-wide): Now Serving + Up Next.
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent className="grid gap-4">
                                        <div className="grid gap-2 rounded-lg border p-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium">Now Serving</span>
                                                <Badge>
                                                    {displayNow?.windowNumber ? `Window ${displayNow.windowNumber}` : "—"}
                                                </Badge>
                                            </div>
                                            {displayNow ? (
                                                <>
                                                    <div className="text-3xl font-semibold">Queue #{displayNow.queueNumber}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Called at: {fmtTime(displayNow.calledAt)}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-sm text-muted-foreground">No ticket is currently being called.</div>
                                            )}
                                        </div>

                                        <div className="grid gap-2 rounded-lg border p-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium">Up Next</span>
                                                <Badge variant="secondary">{formatNumber(displayUpNext.length)}</Badge>
                                            </div>
                                            {displayUpNext.length ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {displayUpNext.slice(0, 6).map((t) => (
                                                        <Badge key={t.id} variant="outline">
                                                            #{t.queueNumber}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-muted-foreground">No waiting tickets.</div>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                            <Button asChild variant="outline" className="w-full sm:w-auto">
                                                <Link to="/staff/display">Open staff display tools</Link>
                                            </Button>

                                            <Button asChild className="w-full sm:w-auto" disabled={!publicDisplayUrl}>
                                                <a href={publicDisplayUrl || "#"} target="_blank" rel="noreferrer" className="gap-2">
                                                    <Tv2 className="h-4 w-4" />
                                                    Open public display
                                                </a>
                                            </Button>

                                            <Button asChild variant="secondary" className="w-full sm:w-auto">
                                                <Link to="/staff/display?present=1" className="gap-2">
                                                    <Maximize2 className="h-4 w-4" />
                                                    Present
                                                </Link>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* ===== NOW SERVING OVERVIEW (from staff/serving.tsx) ===== */}
                                <Card className="min-w-0 lg:col-span-6">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Tv2 className="h-5 w-5" />
                                            Now Serving overview
                                        </CardTitle>
                                        <CardDescription>
                                            Your window: current called ticket + quick actions + up next.
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent className="grid gap-4">
                                        <div className="rounded-2xl border bg-muted p-4">
                                            <div className="flex items-center justify-between">
                                                <div className="text-sm text-muted-foreground">CURRENT</div>
                                                {current ? <Badge>CALLED</Badge> : <Badge variant="secondary">—</Badge>}
                                            </div>

                                            {current ? (
                                                <>
                                                    <div className="mt-2 text-5xl font-semibold tracking-tight">#{current.queueNumber}</div>
                                                    <div className="mt-2 text-sm text-muted-foreground">
                                                        Student ID: {current.studentId ?? "—"}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        Called at: {fmtTime((current as any).calledAt)}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Hold attempts: {current.holdAttempts ?? 0}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="mt-2 text-sm text-muted-foreground">
                                                    No ticket is currently called for your window.
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid gap-2 rounded-lg border p-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium">Up Next (waiting)</span>
                                                <Badge variant="secondary">{formatNumber(waiting.length)}</Badge>
                                            </div>
                                            {waiting.length ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {waiting.slice(0, 6).map((t) => (
                                                        <Badge key={t._id} variant="outline">
                                                            #{t.queueNumber}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-muted-foreground">No WAITING tickets.</div>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                            <Button
                                                onClick={() => void onCallNext()}
                                                disabled={busy || refreshing}
                                                className="w-full gap-2 sm:w-auto"
                                            >
                                                <Megaphone className="h-4 w-4" />
                                                Call next
                                            </Button>

                                            <Button
                                                variant="secondary"
                                                onClick={() => void onHoldNoShow()}
                                                disabled={busy || !current}
                                                className="w-full gap-2 sm:w-auto"
                                            >
                                                <PauseCircle className="h-4 w-4" />
                                                Hold / No-show
                                            </Button>

                                            <Button
                                                onClick={() => void onMarkServed()}
                                                disabled={busy || !current}
                                                className="w-full gap-2 sm:w-auto"
                                            >
                                                <CheckCircle2 className="h-4 w-4" />
                                                Mark served
                                            </Button>

                                            <Button asChild variant="secondary" className="w-full sm:w-auto">
                                                <Link to="/staff/now-serving?present=1" className="gap-2">
                                                    <Maximize2 className="h-4 w-4" />
                                                    Present
                                                </Link>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* ===== QUEUE OVERVIEW (from staff/queue.tsx) ===== */}
                                <Card className="min-w-0 lg:col-span-6">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Ticket className="h-5 w-5" />
                                            Queue overview
                                        </CardTitle>
                                        <CardDescription>
                                            Counts + quick peek (WAITING / HOLD / OUT / HISTORY).
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent className="grid gap-4">
                                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                            <div className="rounded-lg border p-4">
                                                <div className="text-xs text-muted-foreground">Waiting</div>
                                                <div className="mt-1 text-2xl font-semibold">{formatNumber(waiting.length)}</div>
                                            </div>
                                            <div className="rounded-lg border p-4">
                                                <div className="text-xs text-muted-foreground">Hold</div>
                                                <div className="mt-1 text-2xl font-semibold">{formatNumber(hold.length)}</div>
                                            </div>
                                            <div className="rounded-lg border p-4">
                                                <div className="text-xs text-muted-foreground">Out</div>
                                                <div className="mt-1 text-2xl font-semibold">{formatNumber(out.length)}</div>
                                            </div>
                                            <div className="rounded-lg border p-4">
                                                <div className="text-xs text-muted-foreground">History</div>
                                                <div className="mt-1 text-2xl font-semibold">{formatNumber(history.length)}</div>
                                            </div>
                                        </div>

                                        <div className="grid gap-2 rounded-lg border p-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium">Next up (top 5)</span>
                                                <Badge variant="secondary">{Math.min(5, waiting.length)}</Badge>
                                            </div>
                                            {waiting.length ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {waiting.slice(0, 5).map((t) => (
                                                        <Badge key={t._id} variant="outline">
                                                            #{t.queueNumber}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-muted-foreground">No WAITING tickets.</div>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                            <Button asChild variant="outline" className="w-full sm:w-auto">
                                                <Link to="/staff/queue">Open full queue</Link>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* ===== REPORTS OVERVIEW (from staff/reports.tsx) ===== */}
                                <Card className="min-w-0 lg:col-span-6">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <BarChart3 className="h-5 w-5" />
                                            Reports overview
                                        </CardTitle>
                                        <CardDescription>
                                            Last 7 days snapshot ({fromStr} → {toStr}) for your assigned department.
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent className="grid gap-4">
                                        {!reportsSummary ? (
                                            <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                                                Reports snapshot is unavailable right now.
                                            </div>
                                        ) : (
                                            <>
                                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                                                    <div className="rounded-lg border p-4 sm:col-span-1">
                                                        <div className="text-xs text-muted-foreground">Total</div>
                                                        <div className="mt-1 text-2xl font-semibold">{formatNumber(rptTotal)}</div>
                                                    </div>
                                                    <div className="rounded-lg border p-4">
                                                        <div className="text-xs text-muted-foreground">Served</div>
                                                        <div className="mt-1 text-2xl font-semibold">{formatNumber(rptServed)}</div>
                                                    </div>
                                                    <div className="rounded-lg border p-4">
                                                        <div className="text-xs text-muted-foreground">Waiting</div>
                                                        <div className="mt-1 text-2xl font-semibold">{formatNumber(rptWaiting)}</div>
                                                    </div>
                                                    <div className="rounded-lg border p-4">
                                                        <div className="text-xs text-muted-foreground">Hold</div>
                                                        <div className="mt-1 text-2xl font-semibold">{formatNumber(rptHold)}</div>
                                                    </div>
                                                    <div className="rounded-lg border p-4">
                                                        <div className="text-xs text-muted-foreground">Out</div>
                                                        <div className="mt-1 text-2xl font-semibold">{formatNumber(rptOut)}</div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                                    <div className="rounded-lg border p-4">
                                                        <div className="text-xs text-muted-foreground">Called</div>
                                                        <div className="mt-1 text-2xl font-semibold">{formatNumber(rptCalled)}</div>
                                                    </div>

                                                    <div className="rounded-lg border p-4">
                                                        <div className="text-xs text-muted-foreground">Avg wait</div>
                                                        <div className="mt-1 text-2xl font-semibold">{formatDuration(totals?.avgWaitMs)}</div>
                                                        <div className="mt-1 text-xs text-muted-foreground">Join → called</div>
                                                    </div>

                                                    <div className="rounded-lg border p-4">
                                                        <div className="text-xs text-muted-foreground">Avg service</div>
                                                        <div className="mt-1 text-2xl font-semibold">{formatDuration(totals?.avgServiceMs)}</div>
                                                        <div className="mt-1 text-xs text-muted-foreground">Called → served</div>
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                            <Button asChild variant="outline" className="w-full sm:w-auto">
                                                <Link to="/staff/reports">Open full reports</Link>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
