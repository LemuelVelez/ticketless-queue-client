/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import { Monitor, RefreshCw } from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { STAFF_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"

import { API_PATHS } from "@/api/api"
import { useSession } from "@/hooks/use-session"
import { ApiError, api } from "@/lib/http"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

type DisplayNowServing =
    | {
          id: string
          queueNumber: string
          windowNumber: string | null
          calledAt: string | null
      }
    | null

type DisplayUpNextRow = {
    id: string
    queueNumber: string
}

type ResolvedDepartment = {
    id: string | null
    name: string
}

type ParsedTicket = {
    id: string
    queueNumber: string
    windowNumber: string | null
    calledAt: string | null
    status: string | null
    createdAt: string | null
    updatedAt: string | null
}

function fmtTime(v?: string | null) {
    if (!v) return "—"
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleString()
}

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n))
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value)
}

function normalizeString(value: unknown): string | null {
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
    if (typeof value !== "string") return null
    const clean = value.trim()
    return clean || null
}

function getPathValue(source: unknown, path: string): unknown {
    const parts = path.split(".")
    let current: unknown = source

    for (const part of parts) {
        if (!isRecord(current)) return undefined
        current = current[part]
    }

    return current
}

function pickValue(source: unknown, paths: string[]) {
    for (const path of paths) {
        const value = getPathValue(source, path)
        if (value === undefined || value === null) continue
        if (typeof value === "string" && !value.trim()) continue
        return value
    }
    return undefined
}

function normalizeQueueNumber(value: unknown): string | null {
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
    if (typeof value !== "string") return null
    const clean = value.trim()
    return clean || null
}

function normalizeStatus(value: unknown): string | null {
    const clean = normalizeString(value)
    return clean ? clean.toLowerCase() : null
}

function extractDepartment(value: unknown): ResolvedDepartment | null {
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = extractDepartment(item)
            if (found) return found
        }
        return null
    }

    if (!isRecord(value)) return null

    const nestedDepartment = pickValue(value, [
        "department",
        "item",
        "record",
        "result",
        "data",
    ])

    if (nestedDepartment && nestedDepartment !== value) {
        const found = extractDepartment(nestedDepartment)
        if (found) return found
    }

    const id = normalizeString(
        pickValue(value, ["id", "_id", "departmentId", "department.id"])
    )
    const name =
        normalizeString(
            pickValue(value, [
                "name",
                "departmentName",
                "department.name",
                "title",
                "label",
                "code",
            ])
        ) ??
        id

    if (!id && !name) return null

    return {
        id: id ?? null,
        name: name ?? "—",
    }
}

function extractTicketRecords(value: unknown): Record<string, unknown>[] {
    if (Array.isArray(value)) {
        return value.filter(isRecord)
    }

    if (!isRecord(value)) return []

    const directArrayKeys = [
        "tickets",
        "queue",
        "rows",
        "items",
        "results",
        "records",
        "upNext",
        "active",
        "list",
    ]

    for (const key of directArrayKeys) {
        const candidate = value[key]
        if (Array.isArray(candidate)) {
            return candidate.filter(isRecord)
        }
    }

    const singleRecordKeys = ["ticket", "nowServing", "item", "record", "result"]
    for (const key of singleRecordKeys) {
        const candidate = value[key]
        if (isRecord(candidate)) return [candidate]
    }

    const maybeQueueNumber = pickValue(value, [
        "queueNumber",
        "ticketNumber",
        "queueNo",
        "number",
    ])
    if (maybeQueueNumber !== undefined) return [value]

    return []
}

function parseTicket(record: Record<string, unknown>, index: number): ParsedTicket | null {
    const queueNumber = normalizeQueueNumber(
        pickValue(record, [
            "queueNumber",
            "ticketNumber",
            "queueNo",
            "number",
            "queue.number",
            "ticket.queueNumber",
        ])
    )

    if (!queueNumber) return null

    const id =
        normalizeString(pickValue(record, ["id", "_id", "ticketId"])) ??
        `${queueNumber}-${index}`

    const windowNumber =
        normalizeString(
            pickValue(record, [
                "windowNumber",
                "window.number",
                "window.windowNumber",
                "serviceWindow.number",
                "serviceWindow.windowNumber",
                "counter.number",
                "counterNumber",
                "serviceWindowName",
                "assignedWindow",
                "assignedWindowName",
            ])
        ) ?? null

    return {
        id,
        queueNumber,
        windowNumber,
        calledAt:
            normalizeString(
                pickValue(record, ["calledAt", "servingAt", "startedAt"])
            ) ?? null,
        status:
            normalizeStatus(
                pickValue(record, ["status", "queueStatus", "currentStatus"])
            ) ?? null,
        createdAt: normalizeString(pickValue(record, ["createdAt"])) ?? null,
        updatedAt: normalizeString(pickValue(record, ["updatedAt"])) ?? null,
    }
}

function getTimeValue(value?: string | null) {
    if (!value) return 0
    const time = new Date(value).getTime()
    return Number.isFinite(time) ? time : 0
}

function getStatusRank(status: string | null) {
    switch (status) {
        case "serving":
        case "in_service":
        case "in-service":
            return 5
        case "called":
            return 4
        case "active":
            return 3
        case "processing":
            return 2
        default:
            return 1
    }
}

function pickNowServing(tickets: ParsedTicket[]): ParsedTicket | null {
    if (!tickets.length) return null

    const sorted = [...tickets].sort((a, b) => {
        const statusDiff = getStatusRank(b.status) - getStatusRank(a.status)
        if (statusDiff !== 0) return statusDiff

        const calledDiff = getTimeValue(b.calledAt) - getTimeValue(a.calledAt)
        if (calledDiff !== 0) return calledDiff

        const updatedDiff = getTimeValue(b.updatedAt) - getTimeValue(a.updatedAt)
        if (updatedDiff !== 0) return updatedDiff

        return getTimeValue(b.createdAt) - getTimeValue(a.createdAt)
    })

    return sorted[0] ?? null
}

function sortQueueTickets(tickets: ParsedTicket[]) {
    return [...tickets].sort((a, b) => {
        const queueDiff = a.queueNumber.localeCompare(b.queueNumber, undefined, {
            numeric: true,
            sensitivity: "base",
        })
        if (queueDiff !== 0) return queueDiff

        return getTimeValue(a.createdAt) - getTimeValue(b.createdAt)
    })
}

async function getDataOrNull(path: string) {
    try {
        return await api.getData<any>(path, { auth: "staff" })
    } catch (error) {
        if (
            error instanceof ApiError &&
            (error.status === 400 || error.status === 404)
        ) {
            return null
        }
        throw error
    }
}

async function resolveStaffDepartment(
    sessionUser: ReturnType<typeof useSession>["user"]
): Promise<ResolvedDepartment | null> {
    if (!sessionUser?.id) return null

    const byManager = await getDataOrNull(
        API_PATHS.departments.byTransactionManager(sessionUser.id)
    )
    const resolvedByManager = extractDepartment(byManager)
    if (resolvedByManager?.id) return resolvedByManager

    const assignedDepartment = normalizeString(sessionUser.assignedDepartment)
    if (!assignedDepartment) return resolvedByManager ?? null

    const byId = await getDataOrNull(API_PATHS.departments.byId(assignedDepartment))
    const resolvedById = extractDepartment(byId)
    if (resolvedById) return resolvedById

    return {
        id: null,
        name: assignedDepartment,
    }
}

export default function StaffDisplayPage() {
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
    const [busy, setBusy] = React.useState(false)

    const [departmentId, setDepartmentId] = React.useState<string | null>(null)
    const [departmentName, setDepartmentName] = React.useState<string>("—")

    const [nowServing, setNowServing] = React.useState<DisplayNowServing>(null)
    const [upNext, setUpNext] = React.useState<DisplayUpNextRow[]>([])
    const [generatedAt, setGeneratedAt] = React.useState<string | null>(null)

    const [autoRefresh, setAutoRefresh] = React.useState(true)
    const [refreshEveryMs, setRefreshEveryMs] = React.useState(5000)

    const assignedOk = Boolean(departmentId)

    const refresh = React.useCallback(async () => {
        if (!sessionUser) {
            setDepartmentId(null)
            setDepartmentName("—")
            setNowServing(null)
            setUpNext([])
            setGeneratedAt(null)
            return
        }

        try {
            const department = await resolveStaffDepartment(sessionUser)

            setDepartmentId(department?.id ?? null)
            setDepartmentName(department?.name ?? "—")

            if (!department?.id) {
                setNowServing(null)
                setUpNext([])
                setGeneratedAt(null)
                return
            }

            const [activeRaw, queueRaw] = await Promise.all([
                getDataOrNull(API_PATHS.tickets.activeByDepartment(department.id)),
                getDataOrNull(API_PATHS.tickets.queueByDepartment(department.id)),
            ])

            const activeTickets = extractTicketRecords(activeRaw)
                .map((item, index) => parseTicket(item, index))
                .filter(Boolean) as ParsedTicket[]

            const queueTickets = extractTicketRecords(queueRaw)
                .map((item, index) => parseTicket(item, index))
                .filter(Boolean) as ParsedTicket[]

            const serving = pickNowServing(activeTickets)

            const nextQueue = sortQueueTickets(queueTickets)
                .filter((ticket) => ticket.id !== serving?.id)
                .slice(0, 8)
                .map((ticket) => ({
                    id: ticket.id,
                    queueNumber: ticket.queueNumber,
                }))

            setNowServing(
                serving
                    ? {
                          id: serving.id,
                          queueNumber: serving.queueNumber,
                          windowNumber: serving.windowNumber,
                          calledAt:
                              serving.calledAt ??
                              serving.updatedAt ??
                              serving.createdAt,
                      }
                    : null
            )
            setUpNext(nextQueue)
            setGeneratedAt(new Date().toISOString())
            setRefreshEveryMs((current) => clamp(current || 5000, 2000, 60000))
        } catch (e: any) {
            const status = Number(e?.status || 0)

            if (status === 400 || status === 404) {
                setDepartmentId(null)
                setDepartmentName("—")
                setNowServing(null)
                setUpNext([])
                setGeneratedAt(null)
                return
            }

            toast.error(e?.message ?? "Failed to load display snapshot.")
        }
    }, [sessionUser])

    React.useEffect(() => {
        ;(async () => {
            setLoading(true)
            try {
                await refresh()
            } finally {
                setLoading(false)
            }
        })()
    }, [refresh])

    React.useEffect(() => {
        if (!autoRefresh) return
        const intervalMs = clamp(refreshEveryMs, 2000, 60000)
        const timer = window.setInterval(() => void refresh(), intervalMs)
        return () => window.clearInterval(timer)
    }, [autoRefresh, refresh, refreshEveryMs])

    async function onManualRefresh() {
        setBusy(true)
        try {
            await refresh()
        } finally {
            setBusy(false)
        }
    }

    return (
        <DashboardLayout
            title="Display Preview"
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
                                    <Monitor className="h-5 w-5" />
                                    Student/Alumni/Visitor Display Preview
                                </CardTitle>
                                <CardDescription>
                                    Read-only preview of the public queue screen seen
                                    by students, alumni, and visitors.
                                </CardDescription>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <Button
                                    variant="outline"
                                    onClick={() => void onManualRefresh()}
                                    disabled={loading || busy}
                                    className="w-full gap-2 sm:w-auto"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Refresh
                                </Button>
                            </div>
                        </div>

                        <Separator />

                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <Badge variant="secondary">
                                    Department: {departmentName}
                                </Badge>
                                <Badge variant="secondary">
                                    Dept ID: {departmentId ?? "—"}
                                </Badge>
                                {!assignedOk ? (
                                    <Badge variant="destructive">Not assigned</Badge>
                                ) : null}
                                <Badge variant="outline">
                                    Refresh: {Math.round(refreshEveryMs / 1000)}s
                                </Badge>
                                <Badge variant="outline">
                                    Updated: {fmtTime(generatedAt)}
                                </Badge>
                            </div>

                            <div className="flex items-center gap-2">
                                <Switch
                                    id="autoRefresh"
                                    checked={autoRefresh}
                                    onCheckedChange={(v) =>
                                        setAutoRefresh(Boolean(v))
                                    }
                                    disabled={busy}
                                />
                                <Label htmlFor="autoRefresh" className="text-sm">
                                    Auto refresh
                                </Label>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="min-w-0">
                        {loading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-20 w-full" />
                                <Skeleton className="h-64 w-full" />
                            </div>
                        ) : !assignedOk ? (
                            <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                                You are not assigned to a department. Please ask an
                                admin to assign your department.
                            </div>
                        ) : (
                            <Card className="overflow-hidden">
                                <CardHeader>
                                    <CardTitle>Public Queue Board Preview</CardTitle>
                                    <CardDescription>
                                        This mirrors the participant-facing queue board:
                                        now serving and up next.
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
                                                    {nowServing ? (
                                                        <Badge>CALLED</Badge>
                                                    ) : (
                                                        <Badge variant="secondary">
                                                            —
                                                        </Badge>
                                                    )}
                                                </div>

                                                <div className="mt-4">
                                                    {nowServing ? (
                                                        <>
                                                            <div className="text-[clamp(4rem,12vw,9rem)] font-semibold leading-none tracking-tight">
                                                                #{nowServing.queueNumber}
                                                            </div>
                                                            <div className="mt-4 text-sm text-muted-foreground">
                                                                Window:{" "}
                                                                {nowServing.windowNumber
                                                                    ? `#${nowServing.windowNumber}`
                                                                    : "—"}
                                                            </div>
                                                            <div className="text-sm text-muted-foreground">
                                                                Called at:{" "}
                                                                {fmtTime(
                                                                    nowServing.calledAt
                                                                )}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">
                                                            No ticket is currently being
                                                            called.
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
                                                    <Badge variant="secondary">
                                                        {upNext.length}
                                                    </Badge>
                                                </div>

                                                {upNext.length === 0 ? (
                                                    <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                                                        No waiting tickets.
                                                    </div>
                                                ) : (
                                                    <div className="grid gap-3">
                                                        {upNext.map((ticket, index) => (
                                                            <div
                                                                key={ticket.id}
                                                                className="flex items-center justify-between rounded-xl border p-4"
                                                            >
                                                                <div className="text-2xl font-semibold">
                                                                    #{ticket.queueNumber}
                                                                </div>
                                                                <Badge
                                                                    variant={
                                                                        index === 0
                                                                            ? "default"
                                                                            : "secondary"
                                                                    }
                                                                >
                                                                    {index === 0
                                                                        ? "Next"
                                                                        : "Waiting"}
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
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}