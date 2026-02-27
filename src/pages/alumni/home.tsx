/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { toast } from "sonner"
import {
    ArrowRight,
    BarChart3,
    Home,
    Lock,
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

import { guestApi, participantAuthStorage } from "@/api/guest"
import { studentApi, type Department, type Ticket as TicketType } from "@/api/student"
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
    type?: string
}

function pickNonEmptyString(v: unknown) {
    return typeof v === "string" && v.trim() ? v.trim() : ""
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

function safeReadLastAction(key: string) {
    if (typeof window === "undefined") return 0
    const raw = window.localStorage.getItem(key)
    const n = Number(raw ?? 0)
    return Number.isFinite(n) ? n : 0
}

function safeWriteLastAction(key: string, value: number) {
    if (typeof window === "undefined") return
    window.localStorage.setItem(key, String(value))
}

function useActionCooldown(storageKey: string, cooldownMs: number) {
    const [remainingMs, setRemainingMs] = React.useState(0)

    const start = React.useCallback(() => {
        const now = Date.now()
        safeWriteLastAction(storageKey, now)
        setRemainingMs(cooldownMs)
    }, [storageKey, cooldownMs])

    React.useEffect(() => {
        const tick = () => {
            const last = safeReadLastAction(storageKey)
            const rem = cooldownMs - (Date.now() - last)
            setRemainingMs(rem > 0 ? rem : 0)
        }

        tick()
        const id = window.setInterval(tick, 250)
        return () => window.clearInterval(id)
    }, [storageKey, cooldownMs])

    return {
        remainingMs,
        isCoolingDown: remainingMs > 0,
        start,
        remainingSec: Math.ceil(remainingMs / 1000),
    }
}

function useDebouncedValue<T>(value: T, delayMs: number) {
    const [debounced, setDebounced] = React.useState<T>(value)

    React.useEffect(() => {
        const id = window.setTimeout(() => setDebounced(value), delayMs)
        return () => window.clearTimeout(id)
    }, [value, delayMs])

    return debounced
}

export default function AlumniHomePage() {
    const location = useLocation()

    const qs = React.useMemo(() => new URLSearchParams(location.search || ""), [location.search])

    const preDeptId = React.useMemo(() => pickNonEmptyString(qs.get("departmentId")), [qs])
    const preReferenceId = React.useMemo(
        () => pickNonEmptyString(qs.get("studentId") || qs.get("referenceId") || qs.get("tcNumber")),
        [qs],
    )

    const [loadingDepts, setLoadingDepts] = React.useState(true)
    const [loadingSession, setLoadingSession] = React.useState(true)
    const [loadingDisplay, setLoadingDisplay] = React.useState(false)
    const [loadingTicket, setLoadingTicket] = React.useState(false)

    const [departments, setDepartments] = React.useState<Department[]>([])

    // 🔒 lock department immediately from storage (prevents URL tampering + “editable flicker”)
    const initialLockedDept = participantAuthStorage.getDepartmentId() || ""
    const [lockedDepartmentId, setLockedDepartmentId] = React.useState<string>(initialLockedDept)

    const [sessionDepartmentId, setSessionDepartmentId] = React.useState("")
    const [departmentId, setDepartmentId] = React.useState(initialLockedDept || "")
    const [referenceId, setReferenceId] = React.useState(preReferenceId)

    const debouncedReferenceId = useDebouncedValue(referenceId, 600)

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

    // ✅ lock applies to ANY registered participant type (student/alumni/guest) as long as the session/storage has a department
    const isDepartmentLocked = Boolean(lockedDepartmentId)

    const sessionDisplayName = React.useMemo(() => {
        if (!participant) return ""
        const full = [participant.firstName, participant.lastName]
            .map(pickNonEmptyString)
            .filter(Boolean)
            .join(" ")
        if (full) return full
        return (
            pickNonEmptyString(participant.tcNumber) ||
            pickNonEmptyString(participant.studentId) ||
            pickNonEmptyString(participant.mobileNumber) ||
            pickNonEmptyString(participant.phone)
        )
    }, [participant])

    const cooldownKey = React.useMemo(() => {
        const rid = debouncedReferenceId.trim() || referenceId.trim()
        return `alumni:home:refresh:${departmentId || "none"}:${rid || "none"}`
    }, [departmentId, debouncedReferenceId, referenceId])

    const refreshCooldown = useActionCooldown(cooldownKey, 5000)

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
            const res = await guestApi.getSession()
            const p = ((res as any)?.participant ?? null) as SessionParticipant | null

            setParticipant(p)

            if (!p) {
                // no session -> unlock and clear stored lock
                setSessionDepartmentId("")
                setLockedDepartmentId("")
                participantAuthStorage.clearDepartmentId()
                return
            }

            const rid =
                pickNonEmptyString(p?.tcNumber) ||
                pickNonEmptyString(p?.studentId) ||
                pickNonEmptyString(p?.mobileNumber) ||
                pickNonEmptyString(p?.phone)

            const dept = pickNonEmptyString(p?.departmentId)

            if (rid) {
                setReferenceId((prev) => prev || rid)
            }

            if (dept) {
                setSessionDepartmentId(dept)
                setLockedDepartmentId(dept)
                participantAuthStorage.setDepartmentId(dept)
                setDepartmentId(dept)
            }
        } catch {
            // Guest mode is valid here.
            setParticipant(null)
            setSessionDepartmentId("")
            setLockedDepartmentId("")
            participantAuthStorage.clearDepartmentId()
        } finally {
            setLoadingSession(false)
        }
    }, [])

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
            const rid = debouncedReferenceId.trim()
            const silent = Boolean(opts?.silent)

            if (!departmentId || !rid) {
                setTicket(null)
                return
            }

            if (!silent) setLoadingTicket(true)

            try {
                const res = await studentApi.findActiveByStudent({
                    departmentId,
                    studentId: rid,
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
        [departmentId, debouncedReferenceId],
    )

    const refreshOverview = React.useCallback(async () => {
        if (refreshCooldown.isCoolingDown) {
            toast.message(`Please wait ${refreshCooldown.remainingSec}s before refreshing again.`)
            return
        }

        refreshCooldown.start()
        await Promise.all([loadDepartmentDisplay({ silent: false }), findActiveTicket({ silent: false })])
        toast.success("Overview refreshed.")
    }, [loadDepartmentDisplay, findActiveTicket, refreshCooldown])

    React.useEffect(() => {
        void loadDepartments()
        void loadSession()
    }, [loadDepartments, loadSession])

    React.useEffect(() => {
        if (!departments.length) return

        setDepartmentId((prev) => {
            const has = (id: string) => !!id && departments.some((d) => d._id === id)

            // 🔒 locked wins (ignore query param & manual changes)
            if (isDepartmentLocked && has(lockedDepartmentId)) return lockedDepartmentId

            // 1) explicit query param (only when not locked)
            if (has(preDeptId)) return preDeptId

            // 2) session profile department
            if (has(sessionDepartmentId)) return sessionDepartmentId

            // 3) keep current valid
            if (has(prev)) return prev

            // 4) fallback first
            return departments[0]?._id ?? ""
        })
    }, [departments, preDeptId, sessionDepartmentId, isDepartmentLocked, lockedDepartmentId])

    React.useEffect(() => {
        void loadDepartmentDisplay()
    }, [loadDepartmentDisplay])

    React.useEffect(() => {
        void findActiveTicket({ silent: true })
    }, [findActiveTicket])

    const joinUrl = React.useMemo(() => {
        const q = new URLSearchParams()
        if (departmentId) q.set("departmentId", departmentId)
        if (referenceId.trim()) {
            q.set("studentId", referenceId.trim())
            q.set("referenceId", referenceId.trim())
            q.set("tcNumber", referenceId.trim())
        }
        const qStr = q.toString()
        return `/alumni/join${qStr ? `?${qStr}` : ""}`
    }, [departmentId, referenceId])

    const myTicketsUrl = React.useMemo(() => {
        const q = new URLSearchParams()
        if (departmentId) q.set("departmentId", departmentId)
        if (referenceId.trim()) {
            q.set("studentId", referenceId.trim())
            q.set("referenceId", referenceId.trim())
            q.set("tcNumber", referenceId.trim())
        }
        const qStr = q.toString()
        return `/alumni/my-tickets${qStr ? `?${qStr}` : ""}`
    }, [departmentId, referenceId])

    const waitingCount = displayUpNext.length
    const nowServingCount = displayNowServing ? 1 : 0
    const visibleCount = nowServingCount + waitingCount

    const liveQueueBars = React.useMemo(
        () => [
            { label: "Now Serving", count: nowServingCount, fill: "hsl(var(--primary))" },
            { label: "Up Next", count: waitingCount, fill: "hsl(var(--secondary))" },
            { label: "Visible Queue", count: visibleCount, fill: "hsl(var(--accent))" },
        ],
        [nowServingCount, waitingCount, visibleCount],
    )

    const queueMixData = React.useMemo(
        () => [
            { name: "Called", value: nowServingCount, fill: "hsl(var(--primary))" },
            { name: "Waiting", value: waitingCount, fill: "hsl(var(--secondary))" },
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

    const handleDepartmentChange = React.useCallback(
        (value: string) => {
            if (isDepartmentLocked) {
                toast.message("Department is locked after registration.")
                return
            }
            setDepartmentId(value)
        },
        [isDepartmentLocked],
    )

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Header variant="student" />

            <main className="mx-auto w-full px-4 py-10">
                <div className="mb-6">
                    <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <Home className="h-6 w-6" />
                        Alumni Home
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Overview for <span className="font-medium">Join Queue</span> and{" "}
                        <span className="font-medium">My Tickets</span> with live queue insights for alumni and visitors.
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
                                        {isDepartmentLocked ? (
                                            <span className="inline-flex items-center gap-2">
                                                <Lock className="h-4 w-4" />
                                                Department is locked after registration.
                                            </span>
                                        ) : (
                                            "This context is shared by the quick links to Join Queue and My Tickets."
                                        )}
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
                                    {refreshCooldown.isCoolingDown ? `Refresh in ${refreshCooldown.remainingSec}s` : "Refresh Overview"}
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
                                    <div className="min-w-0 space-y-2">
                                        <Label>Department</Label>
                                        <Select
                                            value={departmentId}
                                            onValueChange={handleDepartmentChange}
                                            disabled={!departments.length || isDepartmentLocked}
                                        >
                                            <SelectTrigger className="w-full min-w-0">
                                                <SelectValue placeholder="Select department" />
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
                                                <span className="inline-flex items-center gap-1">
                                                    <Lock className="h-3.5 w-3.5" />
                                                    Locked to your profile.
                                                </span>
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="min-w-0 space-y-2">
                                        <Label htmlFor="reference-id">Reference ID</Label>
                                        <Input
                                            id="reference-id"
                                            value={referenceId}
                                            onChange={(e) => setReferenceId(e.target.value)}
                                            placeholder="Student ID / TC Number / Contact reference"
                                            autoComplete="off"
                                            inputMode="text"
                                        />
                                        <div className="text-xs text-muted-foreground">
                                            Tip: typing is debounced to reduce spam/requests.
                                        </div>
                                    </div>

                                    <div className="min-w-0 space-y-2">
                                        <Label>Session</Label>
                                        <div className="flex h-10 items-center rounded-md border px-3">
                                            {loadingSession ? (
                                                <Skeleton className="h-4 w-24" />
                                            ) : sessionDisplayName ? (
                                                <span className="truncate text-sm">{sessionDisplayName}</span>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">Guest session</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="min-w-0 space-y-2">
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
                                ) : (
                                    <Badge variant="outline">Ticket: —</Badge>
                                )}
                                {myPreviewPosition === 0 ? (
                                    <Badge>Now being called</Badge>
                                ) : myPreviewPosition ? (
                                    <Badge variant="outline">Position in preview: #{myPreviewPosition}</Badge>
                                ) : (
                                    <Badge variant="outline">Position in preview: —</Badge>
                                )}
                            </div>

                            {ticket ? (
                                <div className="rounded-lg border bg-muted p-4 text-sm">
                                    <div className="font-medium">Abuse prevention</div>
                                    <div className="mt-1 text-muted-foreground">
                                        Ticket generation is blocked while you still have an active ticket. Please use{" "}
                                        <span className="font-medium">My Tickets</span>.
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
                                    Start a queue transaction with your current department and reference context.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {ticket ? (
                                    <>
                                        <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                                            You already have an active ticket today. To prevent queue spamming, new ticket generation
                                            is blocked until your current ticket is completed.
                                        </div>
                                        <Button asChild variant="secondary" className="w-full">
                                            <Link to={myTicketsUrl}>Go to My Tickets</Link>
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                                            Use this when you need a new ticket. Selected department and your reference ID are passed
                                            automatically.
                                        </div>
                                        <Button asChild className="w-full" disabled={!departmentId || !referenceId.trim()}>
                                            <Link to={joinUrl}>Go to Join Queue</Link>
                                        </Button>
                                    </>
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
                                                <div className="text-3xl font-semibold tracking-tight">#{ticket.queueNumber}</div>
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
                                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                                    <XAxis
                                                        dataKey="label"
                                                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                                                        axisLine={{ stroke: "hsl(var(--border))" }}
                                                        tickLine={{ stroke: "hsl(var(--border))" }}
                                                    />
                                                    <YAxis
                                                        allowDecimals={false}
                                                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                                                        axisLine={{ stroke: "hsl(var(--border))" }}
                                                        tickLine={{ stroke: "hsl(var(--border))" }}
                                                    />
                                                    <Tooltip
                                                        formatter={(value: number | string | undefined) => [value ?? "—", "Count"]}
                                                        contentStyle={{
                                                            background: "hsl(var(--background))",
                                                            border: "1px solid hsl(var(--border))",
                                                            borderRadius: "0.75rem",
                                                            color: "hsl(var(--foreground))",
                                                        }}
                                                        labelStyle={{ color: "hsl(var(--foreground))" }}
                                                        cursor={{ fill: "hsl(var(--muted))" }}
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
                                                Now Serving: {displayNowServing ? `#${displayNowServing.queueNumber}` : "—"}
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
                                    Recharts donut view using your app CSS color tokens from <span className="font-mono">src/index.css</span>.
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
                                                            background: "hsl(var(--background))",
                                                            border: "1px solid hsl(var(--border))",
                                                            borderRadius: "0.75rem",
                                                            color: "hsl(var(--foreground))",
                                                        }}
                                                        labelStyle={{ color: "hsl(var(--foreground))" }}
                                                    />
                                                    <Legend verticalAlign="bottom" wrapperStyle={{ color: "hsl(var(--muted-foreground))" }} />
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
                                {ticket ? (
                                    <>
                                        <Button variant="outline" className="w-full" disabled>
                                            Ticket already active
                                        </Button>
                                        <Button asChild variant="secondary" className="w-full">
                                            <Link to={myTicketsUrl}>Open My Tickets</Link>
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button asChild className="w-full">
                                            <Link to={joinUrl}>Open Join Queue</Link>
                                        </Button>
                                        <Button asChild variant="secondary" className="w-full">
                                            <Link to={myTicketsUrl}>Open My Tickets</Link>
                                        </Button>
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>

            <Footer variant="student" />
        </div>
    )
}