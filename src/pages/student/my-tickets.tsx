/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { toast } from "sonner"
import {
    Ticket,
    RefreshCw,
    PlusCircle,
    Monitor,
    MapPin,
    Building2,
    Users,
    ClipboardList,
    DoorOpen,
} from "lucide-react"

import Header from "@/components/Header"
import Footer from "@/components/Footer"

import {
    studentApi,
    type Department,
    type Ticket as TicketType,
    type TicketDetails,
} from "@/api/student"
import { api } from "@/lib/http"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
}

function pickNonEmptyString(v: unknown) {
    return typeof v === "string" && v.trim() ? v.trim() : ""
}

function deptNameFromTicketDepartment(dept: any, fallback?: string) {
    if (!dept) return fallback ?? "—"
    if (typeof dept === "string") return fallback ?? "—"
    return pickNonEmptyString(dept?.name) || fallback || "—"
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

function joinCompact(items: string[], max = 8) {
    const clean = (items || []).map((x) => String(x || "").trim()).filter(Boolean)
    if (!clean.length) return { text: "—", extra: 0 }
    if (clean.length <= max) return { text: clean.join(", "), extra: 0 }
    return { text: clean.slice(0, max).join(", "), extra: clean.length - max }
}

function buildWindowLabel(params: {
    details?: TicketDetails | null
    ticket?: TicketType | null
}) {
    const windowName = pickNonEmptyString(params.details?.windowName)
    const windowNo =
        params.details?.windowNumber != null
            ? Number(params.details.windowNumber)
            : params.ticket?.windowNumber != null
              ? Number(params.ticket.windowNumber)
              : undefined

    const hasNo = windowNo != null && Number.isFinite(windowNo) && windowNo > 0
    if (windowName && hasNo) return `${windowName} (Window ${windowNo})`
    if (windowName) return windowName
    if (hasNo) return `Window ${windowNo}`
    return ""
}

async function copyTextToClipboard(text: string) {
    const clean = String(text || "").trim()
    if (!clean) {
        toast.message("Nothing to copy.")
        return
    }

    try {
        await navigator.clipboard.writeText(clean)
        toast.success("Copied to clipboard.")
    } catch {
        // Fallback
        try {
            const el = document.createElement("textarea")
            el.value = clean
            el.style.position = "fixed"
            el.style.left = "-9999px"
            el.setAttribute("readonly", "true")
            document.body.appendChild(el)
            el.select()
            document.execCommand("copy")
            document.body.removeChild(el)
            toast.success("Copied to clipboard.")
        } catch {
            toast.error("Copy failed. Please copy manually.")
        }
    }
}

type InfoRowProps = {
    icon?: React.ReactNode
    label: string
    value: React.ReactNode
    hint?: React.ReactNode
}

function InfoRow({ icon, label, value, hint }: InfoRowProps) {
    return (
        <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                {icon ? <span className="inline-flex">{icon}</span> : null}
                <span>{label}</span>
            </div>
            <div className="mt-1 truncate text-sm font-medium">{value}</div>
            {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
        </div>
    )
}

export default function StudentMyTicketsPage() {
    const location = useLocation()

    const qs = React.useMemo(() => new URLSearchParams(location.search || ""), [location.search])
    const preDeptId = React.useMemo(() => pickNonEmptyString(qs.get("departmentId")), [qs])
    const preStudentId = React.useMemo(() => pickNonEmptyString(qs.get("studentId")), [qs])
    const ticketId = React.useMemo(() => pickNonEmptyString(qs.get("ticketId") || qs.get("id")), [qs])

    const [loadingDepts, setLoadingDepts] = React.useState(true)
    const [departments, setDepartments] = React.useState<Department[]>([])

    const [loadingSession, setLoadingSession] = React.useState(true)
    const [participant, setParticipant] = React.useState<SessionParticipant | null>(null)
    const [sessionDepartmentId, setSessionDepartmentId] = React.useState<string>("")
    const [sessionStudentId, setSessionStudentId] = React.useState<string>("")

    const [departmentId, setDepartmentId] = React.useState<string>("")
    const [studentId, setStudentId] = React.useState<string>(preStudentId)

    const [ticket, setTicket] = React.useState<TicketType | null>(null)
    const [ticketDetails, setTicketDetails] = React.useState<TicketDetails | null>(null)
    const [busy, setBusy] = React.useState(false)

    // Public display preview state (department display)
    const [displayLoading, setDisplayLoading] = React.useState(false)
    const [displayDateKey, setDisplayDateKey] = React.useState<string>("")
    const [displayNowServing, setDisplayNowServing] =
        React.useState<DepartmentDisplayResponse["nowServing"]>(null)
    const [displayUpNext, setDisplayUpNext] = React.useState<DepartmentDisplayResponse["upNext"]>([])

    const selectedDept = React.useMemo(
        () => departments.find((d) => d._id === departmentId) || null,
        [departments, departmentId],
    )

    // ✅ Student restriction: lock department after registration/profile sync (when not viewing a specific ticketId)
    const isDepartmentLocked = React.useMemo(() => {
        return Boolean(!ticketId && participant && pickNonEmptyString(sessionDepartmentId))
    }, [ticketId, participant, sessionDepartmentId])

    const isActiveTicket = React.useMemo(() => {
        if (!ticket) return false
        const s = String((ticket as any)?.status ?? "").toUpperCase()
        return ["WAITING", "CALLED", "HOLD"].includes(s) || !s
    }, [ticket])

    const isBeingCalledNow = React.useMemo(() => {
        if (!ticket || !displayNowServing) return false
        return Number(displayNowServing.queueNumber) === Number(ticket.queueNumber)
    }, [ticket, displayNowServing])

    const loadSession = React.useCallback(async () => {
        setLoadingSession(true)
        try {
            const res = await studentApi.getSession({})
            const p = (res.participant ?? null) as SessionParticipant | null
            setParticipant(p)

            const sid = pickNonEmptyString(p?.tcNumber) || pickNonEmptyString(p?.studentId)
            const dept = pickNonEmptyString(p?.departmentId)

            setSessionStudentId(sid)
            setSessionDepartmentId(dept)

            // Prefer profile context for normal view (not ticketId deep-link)
            if (!ticketId) {
                if (sid) setStudentId(sid)
                if (dept) setDepartmentId(dept)
            }
        } catch {
            setParticipant(null)
            setSessionStudentId("")
            setSessionDepartmentId("")
        } finally {
            setLoadingSession(false)
        }
    }, [ticketId])

    const loadDepartments = React.useCallback(async () => {
        setLoadingDepts(true)
        try {
            const res = await studentApi.listDepartments()
            const list = res.departments ?? []
            setDepartments(list)

            // Initial department selection (final lock is handled by effect below)
            const canUsePre = preDeptId && list.some((d) => d._id === preDeptId)
            const next = canUsePre ? preDeptId : list[0]?._id ?? ""
            setDepartmentId((prev) => prev || next)
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to load departments.")
            setDepartments([])
            setDepartmentId("")
        } finally {
            setLoadingDepts(false)
        }
    }, [preDeptId])

    const findActive = React.useCallback(
        async (opts?: { silent?: boolean }) => {
            const sid = studentId.trim()
            const silent = Boolean(opts?.silent)

            if (!departmentId || !sid) {
                if (!silent) {
                    toast.error("Unable to refresh ticket. Missing required ticket context.")
                }
                return
            }

            // ✅ Abuse prevention: throttle refresh active ticket
            const key = `qp:student:my-tickets:refresh-ticket:${departmentId}:${sid}`
            const remaining = cooldownRemainingMs(key, 2500)
            if (remaining > 0) {
                if (!silent) toast.message(`Please wait ${Math.ceil(remaining / 1000)}s before refreshing again.`)
                return
            }
            writeNowTs(key)

            setBusy(true)
            try {
                const res = await studentApi.findActiveByStudent({
                    departmentId,
                    studentId: sid,
                })

                setTicket(res.ticket ?? null)
                setTicketDetails(res.ticketDetails ?? null)

                if (!silent) {
                    if (res.ticket) {
                        toast.success("Ticket refreshed.")
                    } else {
                        toast.message("No active ticket found for today.")
                    }
                }
            } catch (e: any) {
                if (!silent) {
                    toast.error(e?.message ?? "Failed to refresh ticket.")
                }
            } finally {
                setBusy(false)
            }
        },
        [departmentId, studentId],
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

            // ✅ Abuse prevention: throttle display refresh to reduce flooding
            const key = `qp:student:my-tickets:refresh-display:${departmentId}`
            const remaining = cooldownRemainingMs(key, 2500)
            if (remaining > 0) {
                if (!silent) toast.message(`Please wait ${Math.ceil(remaining / 1000)}s before refreshing again.`)
                return
            }
            writeNowTs(key)

            if (!silent) setDisplayLoading(true)
            try {
                const res = await api.get<DepartmentDisplayResponse>(`/display/${encodeURIComponent(departmentId)}`, {
                    auth: false,
                })

                setDisplayDateKey(pickNonEmptyString(res?.dateKey))
                setDisplayNowServing(res?.nowServing ?? null)
                setDisplayUpNext(Array.isArray(res?.upNext) ? res.upNext : [])
            } catch (e: any) {
                if (!silent) {
                    toast.error(e?.message ?? "Failed to load department display.")
                }
            } finally {
                if (!silent) setDisplayLoading(false)
            }
        },
        [departmentId],
    )

    const loadTicketById = React.useCallback(async () => {
        if (!ticketId) return
        setBusy(true)
        try {
            const res = await studentApi.getTicket(ticketId)
            setTicket(res.ticket ?? null)
            setTicketDetails(res.ticketDetails ?? null)

            const dept = (res.ticket as any)?.department
            const deptIdFromTicket =
                typeof dept === "string" ? dept : pickNonEmptyString(dept?._id) || pickNonEmptyString(dept?.id)

            if (deptIdFromTicket) setDepartmentId(deptIdFromTicket)

            const sid = pickNonEmptyString((res.ticket as any)?.studentId)
            if (sid) setStudentId(sid)
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to load ticket.")
        } finally {
            setBusy(false)
        }
    }, [ticketId])

    React.useEffect(() => {
        void loadSession()
        void loadDepartments()
    }, [loadSession, loadDepartments])

    React.useEffect(() => {
        if (!departments.length) return

        const has = (id: string) => !!id && departments.some((d) => d._id === id)

        // ✅ Student restriction: enforce locked profile department (normal view)
        if (isDepartmentLocked && has(sessionDepartmentId)) {
            setDepartmentId(sessionDepartmentId)
            return
        }

        // otherwise keep valid current, or use preDeptId if valid, or fallback to first
        setDepartmentId((prev) => {
            if (has(prev)) return prev
            if (has(preDeptId)) return preDeptId
            return departments[0]?._id ?? ""
        })
    }, [departments, isDepartmentLocked, sessionDepartmentId, preDeptId])

    React.useEffect(() => {
        void loadTicketById()
    }, [loadTicketById])

    React.useEffect(() => {
        void loadDepartmentDisplay({ silent: true })
    }, [loadDepartmentDisplay])

    React.useEffect(() => {
        if (ticketId) return
        if (!departmentId || !studentId.trim()) return
        void findActive({ silent: true })
    }, [ticketId, departmentId, studentId, findActive])

    const ticketDeptName = React.useMemo(() => {
        if (!ticket) return "—"
        return deptNameFromTicketDepartment(ticket.department, selectedDept?.name)
    }, [ticket, selectedDept?.name])

    const effectiveJoinDeptId = sessionDepartmentId || departmentId
    const effectiveJoinStudentId = sessionStudentId || studentId

    const joinUrl = React.useMemo(() => {
        const q = new URLSearchParams()
        if (effectiveJoinDeptId) q.set("departmentId", effectiveJoinDeptId)
        if (effectiveJoinStudentId.trim()) q.set("studentId", effectiveJoinStudentId.trim())
        const qsStr = q.toString()
        return `/student/join${qsStr ? `?${qsStr}` : ""}`
    }, [effectiveJoinDeptId, effectiveJoinStudentId])

    const windowLabel = React.useMemo(() => buildWindowLabel({ details: ticketDetails, ticket }), [ticketDetails, ticket])

    const servedDepartmentsCompact = React.useMemo(() => {
        const list = Array.isArray(ticketDetails?.servedDepartments) ? ticketDetails!.servedDepartments : []
        return joinCompact(list, 8)
    }, [ticketDetails])

    const txCompact = React.useMemo(() => {
        const list = Array.isArray(ticketDetails?.transactionLabels) ? ticketDetails!.transactionLabels : []
        return joinCompact(list, 8)
    }, [ticketDetails])

    const primaryWhereToGo = pickNonEmptyString(ticketDetails?.whereToGo)

    const quickInstruction = React.useMemo(() => {
        if (primaryWhereToGo) return primaryWhereToGo
        const base =
            windowLabel
                ? `Please proceed to ${windowLabel}.`
                : "Please check the display monitor for your assigned window."
        return base
    }, [primaryWhereToGo, windowLabel])

    const copyPayload = React.useMemo(() => {
        if (!ticket) return ""
        const parts = [
            `Queue Ticket`,
            `Queue #: ${ticket.queueNumber}`,
            ticketDetails?.participantTypeLabel ? `Type: ${ticketDetails.participantTypeLabel}` : "",
            ticketDetails?.departmentName
                ? ticketDetails.departmentCode
                    ? `Department: ${ticketDetails.departmentName} (${ticketDetails.departmentCode})`
                    : `Department: ${ticketDetails.departmentName}`
                : ticketDeptName
                  ? `Department: ${ticketDeptName}`
                  : "",
            ticketDetails?.officeLabel ? `Office: ${ticketDetails.officeLabel}` : "",
            windowLabel ? `Window: ${windowLabel}` : "",
            ticketDetails?.staffName ? `Staff in charge: ${ticketDetails.staffName}` : "",
            Array.isArray(ticketDetails?.transactionLabels) && ticketDetails!.transactionLabels.length
                ? `Transactions: ${ticketDetails!.transactionLabels.join(", ")}`
                : "",
            Array.isArray(ticketDetails?.servedDepartments) && ticketDetails!.servedDepartments.length
                ? `Serves: ${ticketDetails!.servedDepartments.join(", ")}`
                : "",
            `Status: ${String(ticket.status || "").toUpperCase()}`,
            ticket.calledAt ? `Called at: ${fmtTime(ticket.calledAt)}` : "",
            `Where to go: ${quickInstruction}`,
            `Ticket ID: ${ticket._id}`,
        ]
            .map((x) => String(x || "").trim())
            .filter(Boolean)
        return parts.join("\n")
    }, [ticket, ticketDetails, ticketDeptName, windowLabel, quickInstruction])

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Header variant="student" />

            <main className="mx-auto w-full px-4 py-10">
                <div className="mb-6">
                    <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <Ticket className="h-6 w-6" />
                        My Tickets
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        View your queue status and your exact “where to go” instructions (window, staff, and transactions).
                    </p>
                </div>

                <div className="grid gap-6">
                    <Card className="min-w-0">
                        <CardHeader>
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div className="min-w-0">
                                    <CardTitle className="flex items-center gap-2">
                                        <Monitor className="h-5 w-5" />
                                        Queue Display & Join Queue
                                    </CardTitle>
                                    <CardDescription>
                                        Join queue and view the live department queue board preview.
                                    </CardDescription>
                                    <div className="flex flex-wrap items-center gap-2 pt-2">
                                        {loadingSession ? (
                                            <Skeleton className="h-5 w-28" />
                                        ) : participant ? (
                                            <>
                                                <Badge variant="secondary">Profile synced</Badge>
                                                {isDepartmentLocked ? <Badge variant="secondary">Department locked</Badge> : null}
                                            </>
                                        ) : (
                                            <Badge variant="outline">Guest mode</Badge>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <Button
                                        variant="outline"
                                        onClick={() => void loadDepartmentDisplay({ silent: false })}
                                        disabled={displayLoading || !departmentId || loadingDepts}
                                        className="w-full gap-2 sm:w-auto"
                                    >
                                        <RefreshCw className="h-4 w-4" />
                                        Refresh Display
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            {loadingDepts ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-8 w-44" />
                                    <Skeleton className="h-10 w-36" />
                                    <Skeleton className="h-1 w-full" />
                                    <Skeleton className="h-20 w-full" />
                                    <Skeleton className="h-64 w-full" />
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="outline">Date: {displayDateKey || "—"}</Badge>
                                        {isDepartmentLocked && selectedDept ? (
                                            <Badge variant="secondary">Department: {selectedDept.name}</Badge>
                                        ) : null}
                                    </div>

                                    {isActiveTicket ? (
                                        <div className="rounded-lg border bg-muted p-4 text-sm">
                                            <div className="font-medium">Active queue detected</div>
                                            <div className="mt-1 text-muted-foreground">
                                                New ticket generation is blocked while you have an active ticket.
                                            </div>
                                        </div>
                                    ) : null}

                                    <Button
                                        asChild={!isActiveTicket}
                                        className="w-full gap-2 sm:w-auto"
                                        onClick={
                                            isActiveTicket
                                                ? () => toast.message("Join Queue is blocked while you have an active ticket.")
                                                : undefined
                                        }
                                        {...(isActiveTicket ? { "aria-disabled": true } : {})}
                                    >
                                        {isActiveTicket ? (
                                            <span className="inline-flex items-center gap-2">
                                                <PlusCircle className="h-4 w-4" />
                                                Join Queue (Blocked)
                                            </span>
                                        ) : (
                                            <Link to={joinUrl}>
                                                <PlusCircle className="h-4 w-4" />
                                                Join Queue
                                            </Link>
                                        )}
                                    </Button>

                                    <Separator />

                                    {!departmentId ? (
                                        <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                                            No department available to preview.
                                        </div>
                                    ) : displayLoading ? (
                                        <div className="space-y-3">
                                            <Skeleton className="h-20 w-full" />
                                            <Skeleton className="h-64 w-full" />
                                        </div>
                                    ) : (
                                        <Card className="overflow-hidden">
                                            <CardHeader>
                                                <CardTitle>Public Queue Board Preview</CardTitle>
                                                <CardDescription>
                                                    This mirrors the participant-facing queue board: now serving and up next.
                                                </CardDescription>
                                            </CardHeader>

                                            <CardContent>
                                                <div className="grid gap-6 lg:grid-cols-12">
                                                    <div className="lg:col-span-7">
                                                        <div className="rounded-2xl border bg-muted p-6">
                                                            <div className="flex items-center justify-between">
                                                                <div className="text-sm uppercase tracking-widest text-muted-foreground">
                                                                    Now serving
                                                                </div>
                                                                {displayNowServing ? <Badge>CALLED</Badge> : <Badge variant="secondary">—</Badge>}
                                                            </div>

                                                            <div className="mt-4">
                                                                {displayNowServing ? (
                                                                    <>
                                                                        <div className="text-6xl font-semibold leading-none tracking-tight sm:text-7xl">
                                                                            #{displayNowServing.queueNumber}
                                                                        </div>
                                                                        <div className="mt-4 text-sm text-muted-foreground">
                                                                            Window:{" "}
                                                                            {displayNowServing.windowNumber ? `#${displayNowServing.windowNumber}` : "—"}
                                                                        </div>
                                                                        <div className="text-sm text-muted-foreground">
                                                                            Called at: {fmtTime(displayNowServing.calledAt)}
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <div className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">
                                                                        No ticket is currently being called.
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="lg:col-span-5">
                                                        <div className="rounded-2xl border p-6">
                                                            <div className="mb-4 flex items-center justify-between">
                                                                <div className="text-sm uppercase tracking-widest text-muted-foreground">
                                                                    Up next
                                                                </div>
                                                                <Badge variant="secondary">{displayUpNext.length}</Badge>
                                                            </div>

                                                            {displayUpNext.length === 0 ? (
                                                                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                                                                    No waiting tickets.
                                                                </div>
                                                            ) : (
                                                                <div className="grid gap-3">
                                                                    {displayUpNext.slice(0, 8).map((t, idx) => (
                                                                        <div
                                                                            key={t.id}
                                                                            className="flex items-center justify-between rounded-xl border p-4"
                                                                        >
                                                                            <div className="text-2xl font-semibold">#{t.queueNumber}</div>
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
                                            </CardContent>
                                        </Card>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {ticket ? (
                        <Card className="min-w-0">
                            <CardHeader>
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                        <CardTitle>Active Ticket</CardTitle>
                                        <CardDescription>
                                            Your queue details and exactly which window to go to (Student / Alumni / Guest).
                                        </CardDescription>
                                    </div>

                                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                                        <Button
                                            variant="outline"
                                            onClick={() => void copyTextToClipboard(copyPayload)}
                                            disabled={!copyPayload}
                                            className="w-full gap-2 sm:w-auto"
                                        >
                                            <ClipboardList className="h-4 w-4" />
                                            Copy Details
                                        </Button>

                                        <Button
                                            variant="outline"
                                            onClick={() => void findActive({ silent: false })}
                                            disabled={busy || !departmentId || !studentId.trim()}
                                            className="w-full gap-2 sm:w-auto"
                                        >
                                            <RefreshCw className="h-4 w-4" />
                                            Refresh Ticket
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="space-y-4">
                                <div className="rounded-2xl border bg-muted p-6">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="text-sm text-muted-foreground">Department</div>
                                            <div className="truncate text-lg font-medium">
                                                {pickNonEmptyString(ticketDetails?.departmentName) || ticketDeptName}
                                                {pickNonEmptyString(ticketDetails?.departmentCode)
                                                    ? ` (${pickNonEmptyString(ticketDetails?.departmentCode)})`
                                                    : ""}
                                            </div>
                                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                                {pickNonEmptyString(ticketDetails?.participantTypeLabel) ? (
                                                    <Badge variant="secondary">{pickNonEmptyString(ticketDetails?.participantTypeLabel)}</Badge>
                                                ) : null}
                                                {pickNonEmptyString(ticketDetails?.officeLabel) ? (
                                                    <Badge variant="outline">{pickNonEmptyString(ticketDetails?.officeLabel)}</Badge>
                                                ) : pickNonEmptyString(ticketDetails?.transactionManager) ? (
                                                    <Badge variant="outline">{pickNonEmptyString(ticketDetails?.transactionManager)}</Badge>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Badge variant={statusBadgeVariant(ticket.status) as any}>
                                                {String(ticket.status || "").toUpperCase()}
                                            </Badge>
                                            <Badge variant="secondary">{ticket.dateKey}</Badge>
                                        </div>
                                    </div>

                                    <Separator className="my-5" />

                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                        <div>
                                            <div className="text-sm text-muted-foreground">Queue Number</div>
                                            <div className="mt-1 text-6xl font-semibold tracking-tight">#{ticket.queueNumber}</div>
                                            <div className="mt-2 text-sm text-muted-foreground">
                                                Called at: {fmtTime(ticket.calledAt || displayNowServing?.calledAt)}
                                            </div>
                                        </div>

                                        <div className="text-sm text-muted-foreground">
                                            Ticket ID: <span className="font-mono">{ticket._id}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border p-6">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                                <div className="text-sm font-semibold">Where to go</div>
                                                {isBeingCalledNow ? <Badge>YOU ARE BEING CALLED</Badge> : null}
                                            </div>
                                            <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                                {quickInstruction}
                                            </div>
                                        </div>

                                        <div className="flex w-full flex-col gap-2 sm:w-auto">
                                            <Button
                                                variant="outline"
                                                onClick={() => void loadDepartmentDisplay({ silent: false })}
                                                disabled={displayLoading || !departmentId}
                                                className="w-full gap-2 sm:w-auto"
                                            >
                                                <RefreshCw className="h-4 w-4" />
                                                Refresh Display
                                            </Button>
                                        </div>
                                    </div>

                                    <Separator className="my-5" />

                                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                        <InfoRow
                                            icon={<DoorOpen className="h-4 w-4" />}
                                            label="Window"
                                            value={windowLabel ? windowLabel : "Check display monitor"}
                                            hint={
                                                !windowLabel
                                                    ? "Window assignment may appear when your ticket is called."
                                                    : undefined
                                            }
                                        />

                                        <InfoRow
                                            icon={<Users className="h-4 w-4" />}
                                            label="Staff in charge"
                                            value={pickNonEmptyString(ticketDetails?.staffName) || "—"}
                                        />

                                        <InfoRow
                                            icon={<Building2 className="h-4 w-4" />}
                                            label="Serves"
                                            value={servedDepartmentsCompact.text}
                                            hint={
                                                servedDepartmentsCompact.extra > 0
                                                    ? `+${servedDepartmentsCompact.extra} more`
                                                    : undefined
                                            }
                                        />

                                        <InfoRow
                                            icon={<ClipboardList className="h-4 w-4" />}
                                            label="Transactions"
                                            value={txCompact.text}
                                            hint={txCompact.extra > 0 ? `+${txCompact.extra} more` : undefined}
                                        />
                                    </div>

                                    {(Array.isArray(ticketDetails?.transactionLabels) && ticketDetails!.transactionLabels.length) ||
                                    (Array.isArray(ticketDetails?.servedDepartments) && ticketDetails!.servedDepartments.length) ? (
                                        <>
                                            <Separator className="my-5" />

                                            <div className="grid gap-4 lg:grid-cols-12">
                                                <div className="lg:col-span-6">
                                                    <div className="text-xs uppercase tracking-widest text-muted-foreground">
                                                        Your Transactions
                                                    </div>
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {(ticketDetails?.transactionLabels || []).slice(0, 12).map((t) => (
                                                            <Badge key={t} variant="secondary">
                                                                {t}
                                                            </Badge>
                                                        ))}
                                                        {(ticketDetails?.transactionLabels || []).length > 12 ? (
                                                            <Badge variant="outline">
                                                                +{(ticketDetails?.transactionLabels || []).length - 12} more
                                                            </Badge>
                                                        ) : null}
                                                    </div>
                                                </div>

                                                <div className="lg:col-span-6">
                                                    <div className="text-xs uppercase tracking-widest text-muted-foreground">
                                                        Window Serves (Departments)
                                                    </div>
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {(ticketDetails?.servedDepartments || []).slice(0, 12).map((d) => (
                                                            <Badge key={d} variant="outline">
                                                                {d}
                                                            </Badge>
                                                        ))}
                                                        {(ticketDetails?.servedDepartments || []).length > 12 ? (
                                                            <Badge variant="outline">
                                                                +{(ticketDetails?.servedDepartments || []).length - 12} more
                                                            </Badge>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    ) : null}
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardHeader>
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                        <CardTitle>Active Ticket</CardTitle>
                                        <CardDescription>Your active ticket will appear here once available.</CardDescription>
                                    </div>

                                    <Button
                                        variant="outline"
                                        onClick={() => void findActive({ silent: false })}
                                        disabled={busy || !departmentId || !studentId.trim()}
                                        className="w-full gap-2 sm:w-auto"
                                    >
                                        <RefreshCw className="h-4 w-4" />
                                        Refresh Ticket
                                    </Button>
                                </div>
                            </CardHeader>

                            <CardContent>
                                <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                                    No active ticket loaded yet.
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </main>

            <Footer variant="student" />
        </div>
    )
}