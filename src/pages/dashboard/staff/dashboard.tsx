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

import { API_PATHS } from "@/api/api"
import { useSession } from "@/hooks/use-session"
import { api, ApiError } from "@/lib/http"

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
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

type TicketStatus = "WAITING" | "CALLED" | "SERVED" | "HOLD" | "OUT"

type TicketType = {
    _id: string
    queueNumber: number
    status: TicketStatus
    studentId?: string | null
    calledAt?: string | null
    holdAttempts?: number
    departmentId?: string | null
    windowId?: string | null
    createdAt?: string | null
    servedAt?: string | null
    updatedAt?: string | null
    [key: string]: unknown
}

type ReportsSummaryResponse = {
    totals: {
        total: number
        byStatus: Partial<Record<TicketStatus, number>>
        avgWaitMs: number | null
        avgServiceMs: number | null
    }
}

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

type DepartmentRecord = {
    id: string
    name: string
}

type ServiceWindowRecord = {
    id: string
    name: string
    number: number
}

type AssignmentResponse = {
    departmentId: string | null
    departmentName: string
    window: ServiceWindowRecord | null
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

function getStatusCount(
    byStatus: Partial<Record<TicketStatus, number>> | undefined,
    s: TicketStatus
) {
    const v = byStatus?.[s]
    return typeof v === "number" ? v : 0
}

function stripTrailingSlash(s: string) {
    return s.endsWith("/") ? s.slice(0, -1) : s
}

function getClientPublicUrl() {
    const envBase = String(
        (import.meta as any)?.env?.VITE_CLIENT_PUBLIC_URL ?? ""
    ).trim()
    if (envBase) return stripTrailingSlash(envBase)
    if (typeof window !== "undefined")
        return stripTrailingSlash(window.location.origin)
    return ""
}

function normalizeString(value: unknown): string | null {
    if (typeof value !== "string") return null
    const clean = value.trim()
    return clean ? clean : null
}

function normalizeNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string") {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : null
    }
    return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value)
}

function asArray<T = any>(value: unknown): T[] {
    if (Array.isArray(value)) return value as T[]
    if (isRecord(value)) {
        const keys = [
            "tickets",
            "items",
            "rows",
            "results",
            "queue",
            "history",
            "data",
            "windows",
            "departments",
        ] as const

        for (const key of keys) {
            const candidate = value[key]
            if (Array.isArray(candidate)) return candidate as T[]
        }
    }
    return []
}

function sameText(a: unknown, b: unknown) {
    return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase()
}

function extractId(value: unknown): string | null {
    if (typeof value === "string" || typeof value === "number") {
        const clean = String(value).trim()
        return clean ? clean : null
    }

    if (isRecord(value)) {
        return (
            normalizeString(value._id) ??
            normalizeString(value.id) ??
            normalizeString(value.value) ??
            null
        )
    }

    return null
}

function normalizeTicketStatus(value: unknown): TicketStatus {
    const status = String(value ?? "")
        .trim()
        .toUpperCase()

    if (
        status === "WAITING" ||
        status === "CALLED" ||
        status === "SERVED" ||
        status === "HOLD" ||
        status === "OUT"
    ) {
        return status
    }

    return "WAITING"
}

function getTicketDepartmentId(raw: Record<string, unknown>): string | null {
    return (
        extractId(raw.departmentId) ??
        extractId(raw.department) ??
        normalizeString(raw.assignedDepartment) ??
        null
    )
}

function getTicketWindowId(raw: Record<string, unknown>): string | null {
    return (
        extractId(raw.windowId) ??
        extractId(raw.window) ??
        normalizeString(raw.assignedWindow) ??
        null
    )
}

function toTicket(value: unknown): TicketType | null {
    if (!isRecord(value)) return null

    const queueNumber =
        normalizeNumber(value.queueNumber) ??
        normalizeNumber(value.number) ??
        normalizeNumber(value.ticketNumber)

    if (queueNumber === null) return null

    const id =
        extractId(value._id) ??
        extractId(value.id) ??
        extractId(value.ticketId) ??
        `ticket-${queueNumber}`

    return {
        ...value,
        _id: id,
        queueNumber,
        status: normalizeTicketStatus(value.status),
        studentId:
            normalizeString(value.studentId) ??
            normalizeString(value.studentNumber) ??
            null,
        calledAt:
            normalizeString(value.calledAt) ??
            normalizeString(value.lastCalledAt) ??
            null,
        holdAttempts: normalizeNumber(value.holdAttempts) ?? 0,
        departmentId: getTicketDepartmentId(value),
        windowId: getTicketWindowId(value),
        createdAt:
            normalizeString(value.createdAt) ??
            normalizeString(value.joinedAt) ??
            normalizeString(value.queuedAt) ??
            null,
        servedAt:
            normalizeString(value.servedAt) ??
            normalizeString(value.completedAt) ??
            null,
        updatedAt: normalizeString(value.updatedAt) ?? null,
    }
}

function extractTickets(value: unknown): TicketType[] {
    if (Array.isArray(value)) {
        return value.map(toTicket).filter(Boolean) as TicketType[]
    }

    if (isRecord(value)) {
        if (isRecord(value.ticket)) {
            const single = toTicket(value.ticket)
            return single ? [single] : []
        }

        return asArray(value)
            .map(toTicket)
            .filter(Boolean) as TicketType[]
    }

    return []
}

function pickLatestDate(ticket: TicketType): string | null {
    return (
        normalizeString(ticket.updatedAt) ??
        normalizeString(ticket.servedAt) ??
        normalizeString(ticket.calledAt) ??
        normalizeString(ticket.createdAt) ??
        null
    )
}

function sortTicketsDesc(tickets: TicketType[]) {
    return [...tickets].sort((a, b) => {
        const ta = pickLatestDate(a)
        const tb = pickLatestDate(b)
        const av = ta ? new Date(ta).getTime() : 0
        const bv = tb ? new Date(tb).getTime() : 0
        return bv - av
    })
}

function filterTicketsByStatus(tickets: TicketType[], status: TicketStatus) {
    return tickets.filter((ticket) => ticket.status === status)
}

function matchDepartmentId(ticket: TicketType, departmentId: string | null) {
    if (!departmentId) return false
    return sameText(ticket.departmentId, departmentId)
}

function matchWindowId(ticket: TicketType, windowId: string | null) {
    if (!windowId) return false
    return sameText(ticket.windowId, windowId)
}

function parseDate(value: string | null | undefined) {
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
}

function startOfDay(value: string) {
    const date = new Date(`${value}T00:00:00`)
    return Number.isNaN(date.getTime()) ? null : date
}

function endOfDay(value: string) {
    const date = new Date(`${value}T23:59:59.999`)
    return Number.isNaN(date.getTime()) ? null : date
}

function isWithinRange(value: string | null | undefined, from: string, to: string) {
    const date = parseDate(value)
    const fromDate = startOfDay(from)
    const toDate = endOfDay(to)

    if (!date || !fromDate || !toDate) return false
    return date.getTime() >= fromDate.getTime() && date.getTime() <= toDate.getTime()
}

function average(values: number[]) {
    if (!values.length) return null
    return Math.round(values.reduce((sum, current) => sum + current, 0) / values.length)
}

function computeReportsSummary(
    tickets: TicketType[],
    departmentId: string,
    from: string,
    to: string
): ReportsSummaryResponse {
    const scoped = tickets.filter((ticket) => {
        if (!matchDepartmentId(ticket, departmentId)) return false

        const dateCandidate =
            ticket.servedAt ?? ticket.calledAt ?? ticket.createdAt ?? ticket.updatedAt
        return isWithinRange(dateCandidate, from, to)
    })

    const byStatus: Partial<Record<TicketStatus, number>> = {
        WAITING: 0,
        CALLED: 0,
        SERVED: 0,
        HOLD: 0,
        OUT: 0,
    }

    const waitDurations: number[] = []
    const serviceDurations: number[] = []

    for (const ticket of scoped) {
        byStatus[ticket.status] = (byStatus[ticket.status] ?? 0) + 1

        const createdAt = parseDate(ticket.createdAt)
        const calledAt = parseDate(ticket.calledAt)
        const servedAt = parseDate(ticket.servedAt)

        if (createdAt && calledAt && calledAt.getTime() >= createdAt.getTime()) {
            waitDurations.push(calledAt.getTime() - createdAt.getTime())
        }

        if (calledAt && servedAt && servedAt.getTime() >= calledAt.getTime()) {
            serviceDurations.push(servedAt.getTime() - calledAt.getTime())
        }
    }

    return {
        totals: {
            total: scoped.length,
            byStatus,
            avgWaitMs: average(waitDurations),
            avgServiceMs: average(serviceDurations),
        },
    }
}

async function tryRequests<T>(requests: Array<() => Promise<T>>): Promise<T> {
    let lastError: unknown

    for (const request of requests) {
        try {
            return await request()
        } catch (error) {
            lastError = error

            if (
                error instanceof ApiError &&
                (error.status === 404 || error.status === 405)
            ) {
                continue
            }
        }
    }

    if (lastError instanceof Error) throw lastError
    throw new Error("Request failed.")
}

async function getDepartmentByAssignedValue(
    assignedDepartment: string | null
): Promise<DepartmentRecord | null> {
    if (!assignedDepartment) return null

    try {
        const direct = await api.getData<any>(
            API_PATHS.departments.byId(assignedDepartment),
            { auth: "staff" }
        )

        if (isRecord(direct)) {
            const id = extractId(direct)
            const name = normalizeString(direct.name)

            if (id && name) {
                return { id, name }
            }
        }
    } catch {
        // fall through to enabled list
    }

    try {
        const enabled = await api.getData<any>(API_PATHS.departments.enabled, {
            auth: "staff",
        })

        for (const raw of asArray(enabled)) {
            if (!isRecord(raw)) continue

            const id = extractId(raw)
            const name = normalizeString(raw.name)
            if (!id || !name) continue

            if (sameText(id, assignedDepartment) || sameText(name, assignedDepartment)) {
                return { id, name }
            }
        }
    } catch {
        // ignore
    }

    return null
}

async function getWindowByAssignedValue(
    departmentId: string | null,
    assignedWindow: string | null
): Promise<ServiceWindowRecord | null> {
    if (!departmentId || !assignedWindow) return null

    try {
        const direct = await api.getData<any>(
            API_PATHS.serviceWindows.byId(assignedWindow),
            { auth: "staff" }
        )

        if (isRecord(direct)) {
            const id = extractId(direct)
            const name = normalizeString(direct.name)
            const number = normalizeNumber(direct.number)

            if (id && name && number !== null) {
                return { id, name, number }
            }
        }
    } catch {
        // fall through to department windows
    }

    try {
        const byDepartment = await api.getData<any>(
            API_PATHS.serviceWindows.byDepartment(departmentId),
            { auth: "staff" }
        )

        for (const raw of asArray(byDepartment)) {
            if (!isRecord(raw)) continue

            const id = extractId(raw)
            const name = normalizeString(raw.name)
            const number = normalizeNumber(raw.number)

            if (!id || !name || number === null) continue

            if (
                sameText(id, assignedWindow) ||
                sameText(name, assignedWindow) ||
                sameText(number, assignedWindow)
            ) {
                return { id, name, number }
            }
        }
    } catch {
        // ignore
    }

    return null
}

async function getAssignment(
    sessionUser: ReturnType<typeof useSession>["user"]
): Promise<AssignmentResponse> {
    const department = await getDepartmentByAssignedValue(
        sessionUser?.assignedDepartment ?? null
    )

    const window = await getWindowByAssignedValue(
        department?.id ?? null,
        sessionUser?.assignedWindow ?? null
    )

    return {
        departmentId: department?.id ?? null,
        departmentName: department?.name ?? "—",
        window,
    }
}

async function getDisplayOverview(
    departmentId: string
): Promise<DepartmentDisplayResponse | null> {
    try {
        return await api.getData<DepartmentDisplayResponse>(`/display/${departmentId}`, {
            auth: false,
        })
    } catch {
        return null
    }
}

async function getQueueTickets(departmentId: string): Promise<TicketType[]> {
    try {
        const response = await api.getData<any>(
            API_PATHS.tickets.queueByDepartment(departmentId),
            {
                auth: "staff",
                params: { limit: 200 },
            }
        )
        return extractTickets(response).filter((ticket) =>
            matchDepartmentId(ticket, departmentId)
        )
    } catch {
        return []
    }
}

async function getActiveTickets(departmentId: string): Promise<TicketType[]> {
    try {
        const response = await api.getData<any>(
            API_PATHS.tickets.activeByDepartment(departmentId),
            { auth: "staff" }
        )
        return extractTickets(response).filter((ticket) =>
            matchDepartmentId(ticket, departmentId)
        )
    } catch {
        return []
    }
}

async function getRecentTickets(
    departmentId: string,
    from: string,
    to: string
): Promise<TicketType[]> {
    try {
        const response = await api.getData<any>(API_PATHS.tickets.recent, {
            auth: "staff",
            params: {
                departmentId,
                from,
                to,
                limit: 250,
            },
        })

        return extractTickets(response).filter((ticket) =>
            matchDepartmentId(ticket, departmentId)
        )
    } catch {
        return []
    }
}

function pickCurrentTicket(
    activeTickets: TicketType[],
    queueTickets: TicketType[],
    windowId: string | null
) {
    const activeCalled = activeTickets.filter((ticket) => ticket.status === "CALLED")
    const queueCalled = queueTickets.filter((ticket) => ticket.status === "CALLED")
    const candidates = [...activeCalled, ...queueCalled]

    if (windowId) {
        const byWindow = candidates.find((ticket) => matchWindowId(ticket, windowId))
        if (byWindow) return byWindow
    }

    return candidates[0] ?? null
}

function pickHistoryTickets(recentTickets: TicketType[]) {
    return sortTicketsDesc(recentTickets).slice(0, 25)
}

function extractActionTicket(value: unknown): TicketType | null {
    if (isRecord(value) && isRecord(value.ticket)) {
        return toTicket(value.ticket)
    }
    return toTicket(value)
}

const dashboardActionApi = {
    async callNext(departmentId: string, windowId: string) {
        return tryRequests<any>([
            () =>
                api.postData("/staff/serving/call-next", undefined, {
                    auth: "staff",
                }),
            () =>
                api.postData(
                    "/staff/queue/call-next",
                    { departmentId, windowId },
                    { auth: "staff" }
                ),
            () =>
                api.postData(
                    `/staff/windows/${encodeURIComponent(windowId)}/call-next`,
                    { departmentId },
                    { auth: "staff" }
                ),
            () =>
                api.postData(
                    `/tickets/department/${encodeURIComponent(
                        departmentId
                    )}/call-next`,
                    { windowId },
                    { auth: "staff" }
                ),
        ])
    },

    async markServed(ticketId: string) {
        return tryRequests<any>([
            () =>
                api.postData(
                    `/staff/serving/${encodeURIComponent(ticketId)}/served`,
                    undefined,
                    { auth: "staff" }
                ),
            () =>
                api.patchData(
                    `/staff/tickets/${encodeURIComponent(ticketId)}/served`,
                    undefined,
                    { auth: "staff" }
                ),
            () =>
                api.patchData(
                    `/tickets/${encodeURIComponent(ticketId)}/served`,
                    undefined,
                    { auth: "staff" }
                ),
        ])
    },

    async holdNoShow(ticketId: string) {
        return tryRequests<any>([
            () =>
                api.postData(
                    `/staff/serving/${encodeURIComponent(ticketId)}/hold-no-show`,
                    undefined,
                    { auth: "staff" }
                ),
            () =>
                api.postData(
                    `/staff/tickets/${encodeURIComponent(ticketId)}/hold-no-show`,
                    undefined,
                    { auth: "staff" }
                ),
            () =>
                api.patchData(
                    `/tickets/${encodeURIComponent(ticketId)}/hold`,
                    { reason: "NO_SHOW" },
                    { auth: "staff" }
                ),
        ])
    },
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
    const [windowInfo, setWindowInfo] = React.useState<ServiceWindowRecord | null>(null)

    const [displayNow, setDisplayNow] = React.useState<DisplayNowServing>(null)
    const [displayUpNext, setDisplayUpNext] = React.useState<DisplayUpNextRow[]>([])

    const [current, setCurrent] = React.useState<TicketType | null>(null)
    const [waiting, setWaiting] = React.useState<TicketType[]>([])
    const [hold, setHold] = React.useState<TicketType[]>([])
    const [out, setOut] = React.useState<TicketType[]>([])
    const [history, setHistory] = React.useState<TicketType[]>([])

    const [reportsSummary, setReportsSummary] =
        React.useState<ReportsSummaryResponse | null>(null)

    const clientPublicBase = React.useMemo(() => getClientPublicUrl(), [])
    const publicDisplayUrl = React.useMemo(() => {
        if (!departmentId) return ""
        return `${clientPublicBase}/display?departmentId=${encodeURIComponent(
            departmentId
        )}`
    }, [clientPublicBase, departmentId])

    const assignedOk = Boolean(departmentId && windowInfo?.id)

    const range = React.useMemo(() => {
        const to = new Date()
        const from = new Date()
        from.setDate(to.getDate() - 6)
        return { from, to }
    }, [])
    const fromStr = React.useMemo(() => ymdKey(range.from), [range.from])
    const toStr = React.useMemo(() => ymdKey(range.to), [range.to])

    const resetDashboardState = React.useCallback(() => {
        setDepartmentName("—")
        setDisplayNow(null)
        setDisplayUpNext([])
        setCurrent(null)
        setWaiting([])
        setHold([])
        setOut([])
        setHistory([])
        setReportsSummary(null)
    }, [])

    const fetchAll = React.useCallback(async () => {
        try {
            const assignment = await getAssignment(sessionUser)

            setDepartmentId(assignment.departmentId)
            setDepartmentName(assignment.departmentName)
            setWindowInfo(assignment.window)

            if (!assignment.departmentId || !assignment.window?.id) {
                resetDashboardState()
                return
            }

            const [displayRes, queueTickets, activeTickets, recentTickets] =
                await Promise.all([
                    getDisplayOverview(assignment.departmentId),
                    getQueueTickets(assignment.departmentId),
                    getActiveTickets(assignment.departmentId),
                    getRecentTickets(assignment.departmentId, fromStr, toStr),
                ])

            if (displayRes) {
                setDisplayNow(displayRes.nowServing ?? null)
                setDisplayUpNext(displayRes.upNext ?? [])
                setDepartmentName(displayRes.department?.name ?? assignment.departmentName)
            } else {
                setDisplayNow(null)
                setDisplayUpNext([])
            }

            const mergedQueue = sortTicketsDesc([
                ...queueTickets,
                ...activeTickets.filter(
                    (activeTicket) =>
                        !queueTickets.some((ticket) => sameText(ticket._id, activeTicket._id))
                ),
            ])

            const nextCurrent = pickCurrentTicket(
                activeTickets,
                mergedQueue,
                assignment.window.id
            )

            setCurrent(nextCurrent)
            setWaiting(filterTicketsByStatus(mergedQueue, "WAITING").slice(0, 25))
            setHold(filterTicketsByStatus(mergedQueue, "HOLD").slice(0, 25))
            setOut(filterTicketsByStatus(mergedQueue, "OUT").slice(0, 25))
            setHistory(pickHistoryTickets(recentTickets))
            setReportsSummary(
                computeReportsSummary(
                    recentTickets,
                    assignment.departmentId,
                    fromStr,
                    toStr
                )
            )
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to load staff dashboard.")
        }
    }, [fromStr, resetDashboardState, sessionUser, toStr])

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
        if (!departmentId || !windowInfo?.id) {
            toast.error("You are not assigned to a department/window.")
            return
        }

        setBusy(true)
        try {
            const res = await dashboardActionApi.callNext(departmentId, windowInfo.id)
            const ticket = extractActionTicket(res)
            toast.success(
                ticket?.queueNumber
                    ? `Called #${ticket.queueNumber}`
                    : "Next ticket called."
            )
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
            await dashboardActionApi.markServed(current._id)
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
            const res = await dashboardActionApi.holdNoShow(current._id)
            const ticket = extractActionTicket(res)
            const nextStatus = ticket?.status ?? null

            toast.success(
                nextStatus === "OUT"
                    ? `Ticket #${current.queueNumber} is OUT.`
                    : `Ticket #${current.queueNumber} moved to HOLD.`
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
        <DashboardLayout
            title="Staff dashboard"
            navItems={STAFF_NAV_ITEMS}
            user={dashboardUser}
            activePath={location.pathname}
        >
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
                                    Quick snapshot of Display, Now Serving, Queue, and
                                    Reports (scoped to your assignment).
                                </CardDescription>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                <div className="flex items-center gap-2">
                                    <Switch
                                        id="autoRefresh"
                                        checked={autoRefresh}
                                        onCheckedChange={(v) =>
                                            setAutoRefresh(Boolean(v))
                                        }
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

                                <Button
                                    asChild
                                    variant="secondary"
                                    className="w-full sm:w-auto"
                                >
                                    <Link to="/staff/now-serving" className="gap-2">
                                        <Tv2 className="h-4 w-4" />
                                        Now Serving
                                    </Link>
                                </Button>

                                <Button
                                    asChild
                                    variant="secondary"
                                    className="w-full sm:w-auto"
                                >
                                    <Link to="/staff/display" className="gap-2">
                                        <Monitor className="h-4 w-4" />
                                        Display
                                    </Link>
                                </Button>

                                <Button
                                    asChild
                                    variant="secondary"
                                    className="w-full sm:w-auto"
                                >
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
                            <Badge variant="secondary">
                                Dept ID: {departmentId ?? "—"}
                            </Badge>
                            <Badge variant="secondary">
                                Window:{" "}
                                {windowInfo
                                    ? `${windowInfo.name} (#${windowInfo.number})`
                                    : "—"}
                            </Badge>
                            {!assignedOk ? (
                                <Badge variant="destructive">Not assigned</Badge>
                            ) : null}
                            <Badge variant="secondary">
                                Waiting: {formatNumber(waiting.length)}
                            </Badge>
                            <Badge variant="secondary">
                                Hold: {formatNumber(hold.length)}
                            </Badge>
                            <Badge variant="secondary">
                                Out: {formatNumber(out.length)}
                            </Badge>
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
                                You are not assigned to a department/window. Please ask
                                an admin to assign your account.
                            </div>
                        ) : (
                            <div className="grid gap-6 lg:grid-cols-12">
                                <Card className="min-w-0 lg:col-span-6">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Monitor className="h-5 w-5" />
                                            Display overview
                                        </CardTitle>
                                        <CardDescription>
                                            Public display snapshot (department-wide): Now
                                            Serving + Up Next.
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent className="grid gap-4">
                                        <div className="grid gap-2 rounded-lg border p-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium">
                                                    Now Serving
                                                </span>
                                                <Badge>
                                                    {displayNow?.windowNumber
                                                        ? `Window ${displayNow.windowNumber}`
                                                        : "—"}
                                                </Badge>
                                            </div>
                                            {displayNow ? (
                                                <>
                                                    <div className="text-3xl font-semibold">
                                                        Queue #{displayNow.queueNumber}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Called at:{" "}
                                                        {fmtTime(displayNow.calledAt)}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-sm text-muted-foreground">
                                                    No ticket is currently being called.
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid gap-2 rounded-lg border p-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium">
                                                    Up Next
                                                </span>
                                                <Badge variant="secondary">
                                                    {formatNumber(displayUpNext.length)}
                                                </Badge>
                                            </div>
                                            {displayUpNext.length ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {displayUpNext
                                                        .slice(0, 6)
                                                        .map((ticketRow) => (
                                                            <Badge
                                                                key={ticketRow.id}
                                                                variant="outline"
                                                            >
                                                                #{ticketRow.queueNumber}
                                                            </Badge>
                                                        ))}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-muted-foreground">
                                                    No waiting tickets.
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                            <Button
                                                asChild
                                                variant="outline"
                                                className="w-full sm:w-auto"
                                            >
                                                <Link to="/staff/display">
                                                    Open staff display tools
                                                </Link>
                                            </Button>

                                            <Button
                                                asChild
                                                className="w-full sm:w-auto"
                                                disabled={!publicDisplayUrl}
                                            >
                                                <a
                                                    href={publicDisplayUrl || "#"}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="gap-2"
                                                >
                                                    <Tv2 className="h-4 w-4" />
                                                    Open public display
                                                </a>
                                            </Button>

                                            <Button
                                                asChild
                                                variant="secondary"
                                                className="w-full sm:w-auto"
                                            >
                                                <Link
                                                    to="/staff/display?present=1"
                                                    className="gap-2"
                                                >
                                                    <Maximize2 className="h-4 w-4" />
                                                    Present
                                                </Link>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="min-w-0 lg:col-span-6">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Tv2 className="h-5 w-5" />
                                            Now Serving overview
                                        </CardTitle>
                                        <CardDescription>
                                            Your window: current called ticket + quick
                                            actions + up next.
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent className="grid gap-4">
                                        <div className="rounded-2xl border bg-muted p-4">
                                            <div className="flex items-center justify-between">
                                                <div className="text-sm text-muted-foreground">
                                                    CURRENT
                                                </div>
                                                {current ? (
                                                    <Badge>CALLED</Badge>
                                                ) : (
                                                    <Badge variant="secondary">—</Badge>
                                                )}
                                            </div>

                                            {current ? (
                                                <>
                                                    <div className="mt-2 text-5xl font-semibold tracking-tight">
                                                        #{current.queueNumber}
                                                    </div>
                                                    <div className="mt-2 text-sm text-muted-foreground">
                                                        Student ID:{" "}
                                                        {current.studentId ?? "—"}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        Called at:{" "}
                                                        {fmtTime(current.calledAt)}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Hold attempts:{" "}
                                                        {current.holdAttempts ?? 0}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="mt-2 text-sm text-muted-foreground">
                                                    No ticket is currently called for
                                                    your window.
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid gap-2 rounded-lg border p-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium">
                                                    Up Next (waiting)
                                                </span>
                                                <Badge variant="secondary">
                                                    {formatNumber(waiting.length)}
                                                </Badge>
                                            </div>
                                            {waiting.length ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {waiting.slice(0, 6).map((ticketRow) => (
                                                        <Badge
                                                            key={ticketRow._id}
                                                            variant="outline"
                                                        >
                                                            #{ticketRow.queueNumber}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-muted-foreground">
                                                    No WAITING tickets.
                                                </div>
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

                                            <Button
                                                asChild
                                                variant="secondary"
                                                className="w-full sm:w-auto"
                                            >
                                                <Link
                                                    to="/staff/now-serving?present=1"
                                                    className="gap-2"
                                                >
                                                    <Maximize2 className="h-4 w-4" />
                                                    Present
                                                </Link>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="min-w-0 lg:col-span-6">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Ticket className="h-5 w-5" />
                                            Queue overview
                                        </CardTitle>
                                        <CardDescription>
                                            Counts + quick peek (WAITING / HOLD / OUT /
                                            HISTORY).
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent className="grid gap-4">
                                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                            <div className="rounded-lg border p-4">
                                                <div className="text-xs text-muted-foreground">
                                                    Waiting
                                                </div>
                                                <div className="mt-1 text-2xl font-semibold">
                                                    {formatNumber(waiting.length)}
                                                </div>
                                            </div>
                                            <div className="rounded-lg border p-4">
                                                <div className="text-xs text-muted-foreground">
                                                    Hold
                                                </div>
                                                <div className="mt-1 text-2xl font-semibold">
                                                    {formatNumber(hold.length)}
                                                </div>
                                            </div>
                                            <div className="rounded-lg border p-4">
                                                <div className="text-xs text-muted-foreground">
                                                    Out
                                                </div>
                                                <div className="mt-1 text-2xl font-semibold">
                                                    {formatNumber(out.length)}
                                                </div>
                                            </div>
                                            <div className="rounded-lg border p-4">
                                                <div className="text-xs text-muted-foreground">
                                                    History
                                                </div>
                                                <div className="mt-1 text-2xl font-semibold">
                                                    {formatNumber(history.length)}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid gap-2 rounded-lg border p-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium">
                                                    Next up (top 5)
                                                </span>
                                                <Badge variant="secondary">
                                                    {Math.min(5, waiting.length)}
                                                </Badge>
                                            </div>
                                            {waiting.length ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {waiting.slice(0, 5).map((ticketRow) => (
                                                        <Badge
                                                            key={ticketRow._id}
                                                            variant="outline"
                                                        >
                                                            #{ticketRow.queueNumber}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-muted-foreground">
                                                    No WAITING tickets.
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                            <Button
                                                asChild
                                                variant="outline"
                                                className="w-full sm:w-auto"
                                            >
                                                <Link to="/staff/queue">
                                                    Open full queue
                                                </Link>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="min-w-0 lg:col-span-6">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <BarChart3 className="h-5 w-5" />
                                            Reports overview
                                        </CardTitle>
                                        <CardDescription>
                                            Last 7 days snapshot ({fromStr} → {toStr}) for
                                            your assigned department.
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
                                                        <div className="text-xs text-muted-foreground">
                                                            Total
                                                        </div>
                                                        <div className="mt-1 text-2xl font-semibold">
                                                            {formatNumber(rptTotal)}
                                                        </div>
                                                    </div>
                                                    <div className="rounded-lg border p-4">
                                                        <div className="text-xs text-muted-foreground">
                                                            Served
                                                        </div>
                                                        <div className="mt-1 text-2xl font-semibold">
                                                            {formatNumber(rptServed)}
                                                        </div>
                                                    </div>
                                                    <div className="rounded-lg border p-4">
                                                        <div className="text-xs text-muted-foreground">
                                                            Waiting
                                                        </div>
                                                        <div className="mt-1 text-2xl font-semibold">
                                                            {formatNumber(rptWaiting)}
                                                        </div>
                                                    </div>
                                                    <div className="rounded-lg border p-4">
                                                        <div className="text-xs text-muted-foreground">
                                                            Hold
                                                        </div>
                                                        <div className="mt-1 text-2xl font-semibold">
                                                            {formatNumber(rptHold)}
                                                        </div>
                                                    </div>
                                                    <div className="rounded-lg border p-4">
                                                        <div className="text-xs text-muted-foreground">
                                                            Out
                                                        </div>
                                                        <div className="mt-1 text-2xl font-semibold">
                                                            {formatNumber(rptOut)}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                                    <div className="rounded-lg border p-4">
                                                        <div className="text-xs text-muted-foreground">
                                                            Called
                                                        </div>
                                                        <div className="mt-1 text-2xl font-semibold">
                                                            {formatNumber(rptCalled)}
                                                        </div>
                                                    </div>

                                                    <div className="rounded-lg border p-4">
                                                        <div className="text-xs text-muted-foreground">
                                                            Avg wait
                                                        </div>
                                                        <div className="mt-1 text-2xl font-semibold">
                                                            {formatDuration(
                                                                totals?.avgWaitMs
                                                            )}
                                                        </div>
                                                        <div className="mt-1 text-xs text-muted-foreground">
                                                            Join → called
                                                        </div>
                                                    </div>

                                                    <div className="rounded-lg border p-4">
                                                        <div className="text-xs text-muted-foreground">
                                                            Avg service
                                                        </div>
                                                        <div className="mt-1 text-2xl font-semibold">
                                                            {formatDuration(
                                                                totals?.avgServiceMs
                                                            )}
                                                        </div>
                                                        <div className="mt-1 text-xs text-muted-foreground">
                                                            Called → served
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                            <Button
                                                asChild
                                                variant="outline"
                                                className="w-full sm:w-auto"
                                            >
                                                <Link to="/staff/reports">
                                                    Open full reports
                                                </Link>
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