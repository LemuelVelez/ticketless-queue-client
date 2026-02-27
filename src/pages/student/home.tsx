/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { toast } from "sonner"
import {
    ArrowRight,
    BarChart3,
    Home,
    Monitor,
    PieChart as PieChartIcon,
    RefreshCw,
    Ticket,
} from "lucide-react"
import {
    Bar,
    BarChart as RechartsBarChart,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart as RechartsPieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"

import Header from "@/components/Header"
import Footer from "@/components/Footer"

import { guestApi } from "@/api/guest"
import { studentApi, type Department, type Ticket as TicketType, participantAuthStorage } from "@/api/student"
import { api } from "@/lib/http"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

type DepartmentDisplayResponse = {
    dateKey: string
    department: {
        id: string
        name: string
    }
    nowServing: {
        id: string
        queueNumber: number
        windowNumber?: number | null
        calledAt?: string | null
    } | null
    upNext: Array<{
        id: string
        queueNumber: number
    }>
}

type SessionParticipant = {
    firstName?: string
    lastName?: string
    studentId?: string
    tcNumber?: string
    mobileNumber?: string
    phone?: string
    departmentId?: string
    department?: any
}

const LOCK_SENTINEL = "__LOCKED__"

function pickNonEmptyString(v: unknown) {
    return typeof v === "string" && v.trim() ? v.trim() : ""
}

function pickDepartmentIdFromParticipant(p: any) {
    const direct = pickNonEmptyString(p?.departmentId)
    if (direct) return direct

    const dept = p?.department
    if (typeof dept === "string") return pickNonEmptyString(dept)
    if (dept && typeof dept === "object") {
        return pickNonEmptyString(dept?._id) || pickNonEmptyString(dept?.id)
    }

    return ""
}

function getErrorMessage(error: unknown, fallback: string) {
    if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: unknown }).message === "string"
    ) {
        return (error as { message: string }).message
    }
    return fallback
}

function statusBadgeVariant(status?: string) {
    switch (status) {
        case "WAITING":
            return "outline"
        case "CALLED":
            return "default"
        case "HOLD":
            return "secondary"
        case "SERVED":
            return "default"
        case "OUT":
            return "secondary"
        default:
            return "secondary"
    }
}

function fmtTime(v?: string | null) {
    if (!v) return "—"
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleString()
}

function readLastTs(key: string) {
    try {
        const raw = window.localStorage.getItem(key)
        const n = Number(raw ?? "0")
        return Number.isFinite(n) ? n : 0
    } catch {
        return 0
    }
}

function writeNowTs(key: string) {
    try {
        window.localStorage.setItem(key, String(Date.now()))
    } catch {
        // ignore
    }
}

function cooldownRemainingMs(key: string, intervalMs: number) {
    const last = readLastTs(key)
    const diff = Date.now() - last
    if (diff >= intervalMs) return 0
    return intervalMs - diff
}

export default function StudentHomePage() {
    const location = useLocation()

    const qs = React.useMemo(() => new URLSearchParams(location.search || ""), [location.search])
    const preDeptId = React.useMemo(() => pickNonEmptyString(qs.get("departmentId")), [qs])
    const preStudentId = React.useMemo(() => pickNonEmptyString(qs.get("studentId")), [qs])

    // 🔒 lock immediately from storage to prevent brief “editable” state
    const initialLockedDept = participantAuthStorage.getDepartmentId() || ""

    const [loadingDepts, setLoadingDepts] = React.useState(true)
    const [loadingSession, setLoadingSession] = React.useState(true)
    const [loadingDisplay, setLoadingDisplay] = React.useState(false)
    const [loadingTicket, setLoadingTicket] = React.useState(false)

    const [departments, setDepartments] = React.useState<Department[]>([])
    const [sessionDepartmentId, setSessionDepartmentId] = React.useState(initialLockedDept)
    const [lockedDepartmentId, setLockedDepartmentId] = React.useState<string>(initialLockedDept)
    const [departmentId, setDepartmentId] = React.useState(initialLockedDept)
    const [studentId, setStudentId] = React.useState(preStudentId)

    const [participant, setParticipant] = React.useState<SessionParticipant | null>(null)
    const [ticket, setTicket] = React.useState<TicketType | null>(null)

    const [displayDateKey, setDisplayDateKey] = React.useState("")
    const [displayNowServing, setDisplayNowServing] =
        React.useState<DepartmentDisplayResponse["nowServing"]>(null)
    const [displayUpNext, setDisplayUpNext] = React.useState<DepartmentDisplayResponse["upNext"]>([])

    const selectedDept = React.useMemo(
        () => departments.find((d) => d._id === departmentId) || null,
        [departments, departmentId],
    )

    const sessionDisplayName = React.useMemo(() => {
        if (!participant) return ""
        const full = [participant.firstName, participant.lastName]
            .map(pickNonEmptyString)
            .filter(Boolean)
            .join(" ")
        if (full) return full
        return pickNonEmptyString(participant.studentId) || pickNonEmptyString(participant.tcNumber)
    }, [participant])

    const effectiveLockedDeptId = React.useMemo(() => {
        if (!lockedDepartmentId) return ""
        if (lockedDepartmentId !== LOCK_SENTINEL) return lockedDepartmentId
        return participantAuthStorage.getDepartmentId() || sessionDepartmentId || ""
    }, [lockedDepartmentId, sessionDepartmentId])

    // ✅ lock department after registration/profile sync (student/alumni/guest)
    const isDepartmentLocked = Boolean(lockedDepartmentId)

    const hasActiveTicket = Boolean(ticket)

    const loadDepartments = React.useCallback(async () => {
        setLoadingDepts(true)
        try {
            const res = await studentApi.listDepartments()
            setDepartments(res.departments ?? [])
        } catch (error) {
            toast.error(getErrorMessage(error, "Failed to load departments."))
            setDepartments([])
            setDepartmentId("")
        } finally {
            setLoadingDepts(false)
        }
    }, [])

    const loadSession = React.useCallback(async () => {
        setLoadingSession(true)
        try {
            // Use guestApi (public session) so alumni/guest/student all get the same “registered dept” lock behavior
            const res = await guestApi.getSession()
            const p = (res?.participant ?? null) as SessionParticipant | null

            setParticipant(p)

            const sid =
                pickNonEmptyString((p as any)?.tcNumber) ||
                pickNonEmptyString((p as any)?.studentId)
            const deptFromProfile = p ? pickDepartmentIdFromParticipant(p) : ""

            if (sid) setStudentId((prev) => prev || sid)

            const storedLock = participantAuthStorage.getDepartmentId() || ""
            const deptLockedFlag = Boolean((res as any)?.departmentLocked)
            const shouldLock = deptLockedFlag || Boolean(deptFromProfile) || Boolean(storedLock)

            const effective = deptFromProfile || storedLock

            if (deptFromProfile) {
                setSessionDepartmentId(deptFromProfile)
                participantAuthStorage.setDepartmentId(deptFromProfile)
            } else if (storedLock) {
                setSessionDepartmentId(storedLock)
            }

            if (shouldLock) {
                setLockedDepartmentId(effective || LOCK_SENTINEL)
                if (effective) setDepartmentId(effective)
            } else {
                setLockedDepartmentId("")
                setSessionDepartmentId("")
                participantAuthStorage.clearDepartmentId()
            }
        } catch {
            // Guest mode without session is valid here.
            setParticipant(null)
            setLockedDepartmentId("")
            setSessionDepartmentId("")
            participantAuthStorage.clearDepartmentId()
        } finally {
            setLoadingSession(false)
        }
    }, [])

    const handleDepartmentChange = React.useCallback(
        (value: string) => {
            if (loadingSession) {
                toast.message("Loading your session…")
                return
            }
            if (isDepartmentLocked) {
                toast.message("Department is locked to your registered profile.")
                return
            }
            setDepartmentId(value)
        },
        [isDepartmentLocked, loadingSession],
    )

    const loadDepartmentDisplay = React.useCallback(
        async (opts?: { silent?: boolean }) => {
            if (!departmentId) {
                setDisplayDateKey("")
                setDisplayNowServing(null)
                setDisplayUpNext([])
                return
            }

            const silent = Boolean(opts?.silent)
            if (!silent) setLoadingDisplay(true)

            try {
                const res = await api.get<DepartmentDisplayResponse>(`/display/${encodeURIComponent(departmentId)}`, {
                    auth: false,
                })

                setDisplayDateKey(pickNonEmptyString(res?.dateKey))
                setDisplayNowServing(res?.nowServing ?? null)
                setDisplayUpNext(Array.isArray(res?.upNext) ? res.upNext : [])
            } catch (error) {
                if (!silent) {
                    toast.error(getErrorMessage(error, "Failed to load department overview."))
                }
            } finally {
                if (!silent) setLoadingDisplay(false)
            }
        },
        [departmentId],
    )

    const findActiveTicket = React.useCallback(
        async (opts?: { silent?: boolean }) => {
            const sid = studentId.trim()
            const silent = Boolean(opts?.silent)

            if (!departmentId || !sid) {
                setTicket(null)
                return
            }

            if (!silent) setLoadingTicket(true)

            try {
                const res = await studentApi.findActiveByStudent({
                    departmentId,
                    studentId: sid,
                })
                setTicket(res.ticket ?? null)
            } catch (error) {
                if (!silent) {
                    toast.error(getErrorMessage(error, "Failed to load active ticket."))
                }
            } finally {
                if (!silent) setLoadingTicket(false)
            }
        },
        [departmentId, studentId],
    )

    const refreshOverview = React.useCallback(async () => {
        const key = `qp:student:home:refresh:${departmentId || "none"}`
        const remaining = cooldownRemainingMs(key, 2500)
        if (remaining > 0) {
            toast.message(`Please wait ${Math.ceil(remaining / 1000)}s before refreshing again.`)
            return
        }
        writeNowTs(key)

        await Promise.all([loadDepartmentDisplay({ silent: false }), findActiveTicket({ silent: false })])
        toast.success("Overview refreshed.")
    }, [loadDepartmentDisplay, findActiveTicket, departmentId])

    React.useEffect(() => {
        void loadDepartments()
        void loadSession()
    }, [loadDepartments, loadSession])

    React.useEffect(() => {
        if (!departments.length) return

        setDepartmentId((prev) => {
            const has = (id: string) => !!id && departments.some((d) => d._id === id)

            // ✅ If locked, always force the registered dept (ignore URL params)
            if (isDepartmentLocked && has(effectiveLockedDeptId)) return effectiveLockedDeptId

            // 1) explicit query param (guest / unlocked only)
            if (has(preDeptId)) return preDeptId

            // 2) keep current valid
            if (has(prev)) return prev

            // 3) fallback first
            return departments[0]?._id ?? ""
        })
    }, [departments, preDeptId, isDepartmentLocked, effectiveLockedDeptId])

    React.useEffect(() => {
        void loadDepartmentDisplay()
    }, [loadDepartmentDisplay])

    React.useEffect(() => {
        void findActiveTicket({ silent: true })
    }, [findActiveTicket])

    const joinUrl = React.useMemo(() => {
        const q = new URLSearchParams()
        if (departmentId) q.set("departmentId", departmentId)
        if (studentId.trim()) q.set("studentId", studentId.trim())
        const qStr = q.toString()
        return `/student/join${qStr ? `?${qStr}` : ""}`
    }, [departmentId, studentId])

    const myTicketsUrl = React.useMemo(() => {
        const q = new URLSearchParams()
        if (departmentId) q.set("departmentId", departmentId)
        if (studentId.trim()) q.set("studentId", studentId.trim())
        const qStr = q.toString()
        return `/student/my-tickets${qStr ? `?${qStr}` : ""}`
    }, [departmentId, studentId])

    const waitingCount = displayUpNext.length
    const nowServingCount = displayNowServing ? 1 : 0
    const visibleCount = nowServingCount + waitingCount

    // ✅ Use chart tokens from src/index.css (OKLCH vars), not hsl(var(--primary))
    const liveQueueBars = React.useMemo(
        () => [
            { label: "Now Serving", count: nowServingCount, fill: "var(--chart-1)" },
            { label: "Up Next", count: waitingCount, fill: "var(--chart-2)" },
            { label: "Visible Queue", count: visibleCount, fill: "var(--chart-3)" },
        ],
        [nowServingCount, waitingCount, visibleCount],
    )

    const queueMixData = React.useMemo(
        () => [
            { name: "Called", value: nowServingCount, fill: "var(--chart-1)" },
            { name: "Waiting", value: waitingCount, fill: "var(--chart-2)" },
        ],
        [nowServingCount, waitingCount],
    )

    const hasQueueMix = queueMixData.some((item) => item.value > 0)

    const myPreviewPosition = React.useMemo(() => {
        if (!ticket) return null

        if (
            displayNowServing &&
            (displayNowServing.id === ticket._id || displayNowServing.queueNumber === ticket.queueNumber)
        ) {
            return 0
        }

        const index = displayUpNext.findIndex(
            (item) => item.id === ticket._id || item.queueNumber === ticket.queueNumber,
        )

        if (index >= 0) return index + 1
        return null
    }, [ticket, displayNowServing, displayUpNext])

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Header variant="student" />

            <main className="mx-auto w-full px-4 py-10">
                <div className="mb-6">
                    <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <Home className="h-6 w-6" />
                        Student Home
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Overview for <span className="font-medium">Join Queue</span> and{" "}
                        <span className="font-medium">My Tickets</span> with live queue insights.
                    </p>
                </div>

                <div className="grid gap-6">
                    <Card className="min-w-0">
                        <CardHeader>
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                                <div className="min-w-0">
                                    <CardTitle className="flex items-center gap-2">
                                        <BarChart3 className="h-5 w-5" />
                                        Overview Context
                                    </CardTitle>
                                    <CardDescription>
                                        This context is shared by the quick links to Join Queue and My Tickets.
                                    </CardDescription>
                                </div>

                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full gap-2 lg:w-auto"
                                    onClick={() => void refreshOverview()}
                                    disabled={loadingDisplay || loadingTicket || loadingDepts}
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Refresh Overview
                                </Button>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            {loadingDepts ? (
                                <div className="grid gap-3 lg:grid-cols-4">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : (
                                <div className="grid gap-4 lg:grid-cols-4">
                                    <div className="space-y-2 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <Label>Department</Label>
                                            {isDepartmentLocked ? (
                                                <Badge variant="secondary" className="shrink-0">
                                                    Locked
                                                </Badge>
                                            ) : null}
                                        </div>

                                        <Select
                                            value={departmentId}
                                            onValueChange={handleDepartmentChange}
                                            disabled={!departments.length || isDepartmentLocked}
                                        >
                                            <SelectTrigger className="w-full min-w-0">
                                                <SelectValue placeholder={loadingSession ? "Loading session..." : "Select department"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {departments.map((d) => (
                                                    <SelectItem key={d._id} value={d._id}>
                                                        {d.name}
                                                        {d.code ? ` (${d.code})` : ""}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        {isDepartmentLocked ? (
                                            <div className="text-xs text-muted-foreground">
                                                Your department is locked to your registered profile.
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="space-y-2 min-w-0">
                                        <Label htmlFor="student-id">Student ID</Label>
                                        <Input
                                            id="student-id"
                                            value={studentId}
                                            onChange={(e) => setStudentId(e.target.value)}
                                            placeholder="e.g. TC-20-A-00001"
                                            autoComplete="off"
                                            inputMode="text"
                                        />
                                    </div>

                                    <div className="space-y-2 min-w-0">
                                        <Label>Session</Label>
                                        <div className="flex h-10 items-center rounded-md border px-3">
                                            {loadingSession ? (
                                                <Skeleton className="h-4 w-24" />
                                            ) : sessionDisplayName ? (
                                                <span className="truncate text-sm">{sessionDisplayName}</span>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">Guest mode</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2 min-w-0">
                                        <Label>Date Key</Label>
                                        <div className="flex h-10 items-center rounded-md border px-3">
                                            <span className="text-sm">{displayDateKey || "—"}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-wrap items-center gap-2">
                                {selectedDept ? <Badge variant="secondary">Department: {selectedDept.name}</Badge> : null}
                                {ticket ? (
                                    <Badge variant={statusBadgeVariant(ticket.status) as any}>Ticket: {ticket.status}</Badge>
                                ) : null}
                                {myPreviewPosition === 0 ? (
                                    <Badge>Now being called</Badge>
                                ) : myPreviewPosition ? (
                                    <Badge variant="outline">Position in preview: #{myPreviewPosition}</Badge>
                                ) : (
                                    <Badge variant="outline">Position in preview: —</Badge>
                                )}
                            </div>

                            {hasActiveTicket ? (
                                <div className="rounded-lg border bg-muted p-4 text-sm">
                                    <div className="font-medium">Active queue detected</div>
                                    <div className="mt-1 text-muted-foreground">
                                        Ticket generation is blocked while you have an active queue. Please use{" "}
                                        <span className="font-medium">My Tickets</span> to monitor your status.
                                    </div>
                                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                        <Button asChild className="w-full" variant="secondary">
                                            <Link to={myTicketsUrl}>Open My Tickets</Link>
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="w-full"
                                            onClick={() => {
                                                toast.message("Join Queue is blocked while you have an active ticket.")
                                            }}
                                        >
                                            Join Queue (Blocked)
                                        </Button>
                                    </div>
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card className="min-w-0">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <ArrowRight className="h-5 w-5" />
                                    Join Queue
                                </CardTitle>
                                <CardDescription>
                                    Start a queue transaction with your current department and student context.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                                    Use this when you need a new ticket. Selected department and student ID are passed automatically.
                                </div>

                                {hasActiveTicket ? (
                                    <Button asChild className="w-full" variant="secondary">
                                        <Link to={myTicketsUrl}>View Active Ticket</Link>
                                    </Button>
                                ) : (
                                    <Button asChild className="w-full">
                                        <Link to={joinUrl}>Go to Join Queue</Link>
                                    </Button>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="min-w-0">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Ticket className="h-5 w-5" />
                                    My Tickets
                                </CardTitle>
                                <CardDescription>
                                    Check your active ticket, live queue board preview, and refresh your current status.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {ticket ? (
                                    <div className="rounded-lg border p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <div className="text-sm text-muted-foreground">Queue Number</div>
                                                <div className="text-3xl font-semibold tracking-tight">
                                                    #{ticket.queueNumber}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <Badge variant={statusBadgeVariant(ticket.status) as any}>{ticket.status}</Badge>
                                                <Badge variant="outline">{ticket.dateKey}</Badge>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                                        No active ticket found for the current context.
                                    </div>
                                )}

                                <Button asChild variant="secondary" className="w-full">
                                    <Link to={myTicketsUrl}>Go to My Tickets</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card className="min-w-0">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Monitor className="h-5 w-5" />
                                    Live Queue Snapshot
                                </CardTitle>
                                <CardDescription>
                                    Recharts bar view of now serving, up next, and visible queue count.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {!departmentId ? (
                                    <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                                        Select a department to view queue insights.
                                    </div>
                                ) : loadingDisplay ? (
                                    <Skeleton className="h-80 w-full" />
                                ) : (
                                    <div className="space-y-4">
                                        <div className="h-80 w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <RechartsBarChart
                                                    data={liveQueueBars}
                                                    margin={{ top: 12, right: 12, left: -12, bottom: 0 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                                    <XAxis
                                                        dataKey="label"
                                                        tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                                                        axisLine={{ stroke: "var(--border)" }}
                                                        tickLine={{ stroke: "var(--border)" }}
                                                    />
                                                    <YAxis
                                                        allowDecimals={false}
                                                        tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                                                        axisLine={{ stroke: "var(--border)" }}
                                                        tickLine={{ stroke: "var(--border)" }}
                                                    />
                                                    <Tooltip
                                                        formatter={(value: number | string | undefined) => [value ?? "—", "Count"]}
                                                        contentStyle={{
                                                            background: "var(--background)",
                                                            border: "1px solid var(--border)",
                                                            borderRadius: "0.75rem",
                                                            color: "var(--foreground)",
                                                        }}
                                                        labelStyle={{ color: "var(--foreground)" }}
                                                        cursor={{ fill: "var(--muted)" }}
                                                    />
                                                    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                                                        {liveQueueBars.map((entry) => (
                                                            <Cell key={entry.label} fill={entry.fill} />
                                                        ))}
                                                    </Bar>
                                                </RechartsBarChart>
                                            </ResponsiveContainer>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant="outline">
                                                Now Serving:{" "}
                                                {displayNowServing ? `#${displayNowServing.queueNumber}` : "—"}
                                            </Badge>
                                            <Badge variant="outline">Up Next: {waitingCount}</Badge>
                                            <Badge variant="secondary">Visible: {visibleCount}</Badge>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="min-w-0">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <PieChartIcon className="h-5 w-5" />
                                    Queue Mix
                                </CardTitle>
                                <CardDescription>
                                    Recharts donut view using your app CSS color tokens from{" "}
                                    <span className="font-mono">src/index.css</span>.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {!departmentId ? (
                                    <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                                        Select a department to view queue distribution.
                                    </div>
                                ) : loadingDisplay ? (
                                    <Skeleton className="h-80 w-full" />
                                ) : !hasQueueMix ? (
                                    <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                                        No queue data available yet for this department.
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="h-80 w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <RechartsPieChart>
                                                    <Tooltip
                                                        formatter={(value: number | string | undefined) => [value ?? "—", "Tickets"]}
                                                        contentStyle={{
                                                            background: "var(--background)",
                                                            border: "1px solid var(--border)",
                                                            borderRadius: "0.75rem",
                                                            color: "var(--foreground)",
                                                        }}
                                                        labelStyle={{ color: "var(--foreground)" }}
                                                    />
                                                    <Legend
                                                        verticalAlign="bottom"
                                                        wrapperStyle={{ color: "var(--muted-foreground)" }}
                                                    />
                                                    <Pie
                                                        data={queueMixData}
                                                        dataKey="value"
                                                        nameKey="name"
                                                        innerRadius={72}
                                                        outerRadius={108}
                                                        paddingAngle={3}
                                                    >
                                                        {queueMixData.map((entry) => (
                                                            <Cell key={entry.name} fill={entry.fill} />
                                                        ))}
                                                    </Pie>
                                                </RechartsPieChart>
                                            </ResponsiveContainer>
                                        </div>

                                        {myPreviewPosition === 0 ? (
                                            <div className="rounded-lg border p-4 text-sm">Your ticket is currently being called.</div>
                                        ) : myPreviewPosition ? (
                                            <div className="rounded-lg border p-4 text-sm">
                                                Your ticket appears at position{" "}
                                                <span className="font-semibold">#{myPreviewPosition}</span> in the visible preview queue.
                                            </div>
                                        ) : (
                                            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                                                Your ticket is not visible in the current board preview list.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="min-w-0">
                        <CardHeader>
                            <CardTitle>Queue Board Preview</CardTitle>
                            <CardDescription>Quick glance from home: now serving and up next tickets.</CardDescription>
                        </CardHeader>

                        <CardContent>
                            {!departmentId ? (
                                <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                                    Select a department to preview the queue board.
                                </div>
                            ) : loadingDisplay ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-24 w-full" />
                                    <Skeleton className="h-40 w-full" />
                                </div>
                            ) : (
                                <div className="grid gap-4 lg:grid-cols-12">
                                    <div className="lg:col-span-7">
                                        <div className="rounded-2xl border bg-muted p-6">
                                            <div className="flex items-center justify-between">
                                                <div className="text-sm uppercase tracking-widest text-muted-foreground">Now serving</div>
                                                {displayNowServing ? <Badge>CALLED</Badge> : <Badge variant="secondary">—</Badge>}
                                            </div>

                                            <div className="mt-4">
                                                {displayNowServing ? (
                                                    <>
                                                        <div className="text-[clamp(3rem,10vw,7rem)] font-semibold leading-none tracking-tight">
                                                            #{displayNowServing.queueNumber}
                                                        </div>
                                                        <div className="mt-3 text-sm text-muted-foreground">
                                                            Window: {displayNowServing.windowNumber ? `#${displayNowServing.windowNumber}` : "—"}
                                                        </div>
                                                        <div className="text-sm text-muted-foreground">
                                                            Called at: {fmtTime(displayNowServing.calledAt)}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
                                                        No ticket is currently being called.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="lg:col-span-5">
                                        <div className="rounded-2xl border p-6">
                                            <div className="mb-4 flex items-center justify-between">
                                                <div className="text-sm uppercase tracking-widest text-muted-foreground">Up next</div>
                                                <Badge variant="secondary">{displayUpNext.length}</Badge>
                                            </div>

                                            {displayUpNext.length === 0 ? (
                                                <div className="rounded-lg border p-4 text-sm text-muted-foreground">No waiting tickets.</div>
                                            ) : (
                                                <div className="grid gap-2">
                                                    {displayUpNext.slice(0, 6).map((item, idx) => (
                                                        <div key={item.id} className="flex items-center justify-between rounded-xl border p-3">
                                                            <div className="text-xl font-semibold">#{item.queueNumber}</div>
                                                            <Badge variant={idx === 0 ? "default" : "secondary"}>
                                                                {idx === 0 ? "Next" : "Waiting"}
                                                            </Badge>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <Separator className="my-6" />

                            <div className="grid gap-2 sm:grid-cols-2">
                                {hasActiveTicket ? (
                                    <Button asChild variant="secondary">
                                        <Link to={myTicketsUrl}>Open My Tickets</Link>
                                    </Button>
                                ) : (
                                    <Button asChild>
                                        <Link to={joinUrl}>Open Join Queue</Link>
                                    </Button>
                                )}

                                <Button asChild variant="secondary">
                                    <Link to={myTicketsUrl}>Open My Tickets</Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>

            <Footer variant="student" />
        </div>
    )
}