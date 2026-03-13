import * as React from "react"
import { toast } from "sonner"
import {
    Expand,
    History,
    Pause,
    Play,
    RefreshCcw,
    WifiOff,
    X,
} from "lucide-react"

import { API_PATHS } from "@/api/api"
import { api, pickParticipantFullName } from "@/lib/http"
import { cn } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const STORAGE_MANAGER = "qp_public_display_manager"
const STORAGE_AUTO_REFRESH = "qp_public_display_auto_refresh"

type TicketView = {
    id: string
    queueNumber?: string | number | null
    participant?: Record<string, unknown> | null
    participantDisplay?: string | null
    studentId?: string | null
    department?: {
        id?: string
        name?: string | null
        [key: string]: unknown
    } | null
    [key: string]: unknown
}

type DisplayWindow = {
    id: string
    name?: string | null
    number?: string | number | null
    departments?: Array<{
        id?: string
        name?: string | null
        [key: string]: unknown
    }>
    nowServing?: TicketView | null
    [key: string]: unknown
}

type Announcement = {
    id: string
    queueNumber?: string | number | null
    windowNumber?: string | number | null
    departmentName?: string | null
    participantName?: string | null
    createdAt?: string | null
    [key: string]: unknown
}

type PublicDisplayState = {
    dateKey?: string | null
    serverTime?: string | null
    windows: DisplayWindow[]
    upNext: TicketView[]
    announcements: Announcement[]
    [key: string]: unknown
}

const MANAGER_ENDPOINTS = [
    "/landing/managers",
    "/landing/transaction-managers",
    "/public-display/managers",
    "/display/managers",
    API_PATHS.departments.enabled,
] as const

const DISPLAY_STATE_REQUESTS = [
    (manager: string, since?: string) => ({
        path: `/landing/public-display/${encodeURIComponent(manager)}`,
        params: since ? { since } : undefined,
    }),
    (manager: string, since?: string) => ({
        path: `/public-display/${encodeURIComponent(manager)}`,
        params: since ? { since } : undefined,
    }),
    (manager: string, since?: string) => ({
        path: `/display/${encodeURIComponent(manager)}`,
        params: since ? { since } : undefined,
    }),
    (manager: string, since?: string) => ({
        path: "/landing/public-display",
        params: {
            manager,
            ...(since ? { since } : {}),
        },
    }),
    (manager: string, since?: string) => ({
        path: "/public-display",
        params: {
            manager,
            ...(since ? { since } : {}),
        },
    }),
    (manager: string, since?: string) => ({
        path: "/display",
        params: {
            manager,
            ...(since ? { since } : {}),
        },
    }),
    (manager: string, since?: string) => ({
        path: "/landing/public-display",
        params: {
            transactionManager: manager,
            ...(since ? { since } : {}),
        },
    }),
    (manager: string, since?: string) => ({
        path: "/public-display",
        params: {
            transactionManager: manager,
            ...(since ? { since } : {}),
        },
    }),
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value)
}

function titleCase(input: string) {
    const s = String(input ?? "").trim()
    if (!s) return ""
    return s
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .split(" ")
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
        .join(" ")
}

function formatTime(iso?: string | null) {
    if (!iso) return ""
    const d = new Date(iso)
    if (String(d).includes("Invalid")) return ""
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function pickText(...values: unknown[]) {
    for (const value of values) {
        if (typeof value === "string") {
            const clean = value.trim()
            if (clean) return clean
        }

        if (typeof value === "number" && !Number.isNaN(value)) {
            return String(value)
        }
    }

    return ""
}

function pickNumberLike(...values: unknown[]) {
    for (const value of values) {
        if (typeof value === "number" && !Number.isNaN(value)) return value
        if (typeof value === "string") {
            const clean = value.trim()
            if (clean) return clean
        }
    }

    return null
}

function uniqueStrings(values: string[]) {
    return Array.from(new Set(values.filter(Boolean)))
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
    if (!Array.isArray(value)) return []
    return value.filter(isRecord)
}

function looksLikeManagerPayload(value: unknown) {
    if (Array.isArray(value)) return true
    if (!isRecord(value)) return false

    return [
        "managers",
        "items",
        "rows",
        "results",
        "departments",
        "data",
    ].some((key) => key in value)
}

function extractManagersFromRecords(value: unknown): string[] {
    const rows = toRecordArray(value)

    return uniqueStrings(
        rows
            .map((row) =>
                pickText(
                    row.transactionManager,
                    row.manager,
                    row.managerName,
                    row.displayManager,
                    row.name,
                    row.label
                )
            )
            .filter(Boolean)
    )
}

function normalizeManagerList(value: unknown): string[] {
    if (Array.isArray(value)) {
        const directStrings = uniqueStrings(
            value
                .map((item) => {
                    if (typeof item === "string") return item.trim()
                    if (isRecord(item)) {
                        return pickText(
                            item.transactionManager,
                            item.manager,
                            item.managerName,
                            item.displayManager,
                            item.name,
                            item.label
                        )
                    }
                    return ""
                })
                .filter(Boolean)
        )

        return directStrings
    }

    if (!isRecord(value)) return []

    const direct = uniqueStrings([
        ...normalizeManagerList(value.managers),
        ...normalizeManagerList(value.items),
        ...normalizeManagerList(value.rows),
        ...normalizeManagerList(value.results),
        ...extractManagersFromRecords(value.departments),
    ])

    if (direct.length) return direct

    if ("data" in value) {
        return normalizeManagerList(value.data)
    }

    return []
}

function normalizeDepartment(
    value: unknown,
    index: number
): { id?: string; name?: string | null; [key: string]: unknown } {
    const row = isRecord(value) ? value : {}

    return {
        ...row,
        id:
            pickText(row.id, row._id, row.departmentId) ||
            `department-${index}`,
        name: pickText(row.name, row.departmentName, row.label) || null,
    }
}

function normalizeTicket(value: unknown, index: number): TicketView {
    const row = isRecord(value) ? value : {}
    const participant = isRecord(row.participant) ? row.participant : null

    const departmentSource = isRecord(row.department)
        ? row.department
        : isRecord(row.serviceDepartment)
          ? row.serviceDepartment
          : null

    const departmentName =
        pickText(
            departmentSource?.name,
            departmentSource?.departmentName,
            row.departmentName
        ) || null

    return {
        ...row,
        id:
            pickText(row.id, row._id, row.ticketId, row.queueId) ||
            `ticket-${index}`,
        queueNumber: pickNumberLike(
            row.queueNumber,
            row.ticketNumber,
            row.number
        ),
        participant,
        participantDisplay:
            pickText(row.participantDisplay, row.participantLabel) || null,
        studentId: pickText(row.studentId, participant?.studentId) || null,
        department: departmentName
            ? {
                  ...(departmentSource ?? {}),
                  id: pickText(
                      departmentSource?.id,
                      departmentSource?._id,
                      departmentSource?.departmentId
                  ),
                  name: departmentName,
              }
            : null,
    }
}

function normalizeWindow(value: unknown, index: number): DisplayWindow {
    const row = isRecord(value) ? value : {}

    const departmentsSource = Array.isArray(row.departments)
        ? row.departments
        : Array.isArray(row.assignedDepartments)
          ? row.assignedDepartments
          : []

    const nowServingSource =
        row.nowServing ?? row.currentTicket ?? row.activeTicket ?? null

    return {
        ...row,
        id:
            pickText(row.id, row._id, row.windowId) || `window-${index}`,
        name: pickText(row.name, row.label) || null,
        number: pickNumberLike(row.number, row.windowNumber, row.no),
        departments: departmentsSource.map((dep, depIndex) =>
            normalizeDepartment(dep, depIndex)
        ),
        nowServing: nowServingSource
            ? normalizeTicket(nowServingSource, index)
            : null,
    }
}

function normalizeAnnouncement(value: unknown, index: number): Announcement {
    const row = isRecord(value) ? value : {}
    const participant = isRecord(row.participant) ? row.participant : null
    const department = isRecord(row.department) ? row.department : null

    return {
        ...row,
        id:
            pickText(row.id, row._id, row.announcementId) ||
            `announcement-${index}`,
        queueNumber: pickNumberLike(
            row.queueNumber,
            row.ticketNumber,
            row.number
        ),
        windowNumber: pickNumberLike(
            row.windowNumber,
            row.window,
            row.serviceWindowNumber
        ),
        departmentName:
            pickText(
                row.departmentName,
                department?.name,
                department?.departmentName
            ) || null,
        participantName:
            pickText(
                row.participantName,
                row.participantFullName,
                row.participantLabel,
                participant?.fullName,
                participant?.name
            ) || null,
        createdAt: pickText(row.createdAt, row.timestamp, row.calledAt) || null,
    }
}

function extractStateSource(value: unknown): Record<string, unknown> {
    if (!isRecord(value)) return {}

    if (isRecord(value.state)) return value.state
    if (isRecord(value.display)) return value.display
    if (isRecord(value.publicDisplay)) return value.publicDisplay
    if (isRecord(value.data)) return value.data

    return value
}

function looksLikePublicDisplayState(value: unknown) {
    const source = extractStateSource(value)

    return (
        Array.isArray(source.windows) ||
        Array.isArray(source.upNext) ||
        Array.isArray(source.announcements) ||
        Array.isArray(source.activeWindows) ||
        Array.isArray(source.waitingTickets) ||
        Array.isArray(source.recentAnnouncements) ||
        "serverTime" in source ||
        "dateKey" in source
    )
}

function normalizePublicDisplayState(value: unknown): PublicDisplayState {
    const source = extractStateSource(value)

    const windowsSource = Array.isArray(source.windows)
        ? source.windows
        : Array.isArray(source.activeWindows)
          ? source.activeWindows
          : Array.isArray(source.serviceWindows)
            ? source.serviceWindows
            : []

    const upNextSource = Array.isArray(source.upNext)
        ? source.upNext
        : Array.isArray(source.waitingTickets)
          ? source.waitingTickets
          : Array.isArray(source.queue)
            ? source.queue
            : []

    const announcementsSource = Array.isArray(source.announcements)
        ? source.announcements
        : Array.isArray(source.recentAnnouncements)
          ? source.recentAnnouncements
          : Array.isArray(source.recentCalls)
            ? source.recentCalls
            : Array.isArray(source.calls)
              ? source.calls
              : []

    return {
        ...source,
        dateKey: pickText(
            source.dateKey,
            source.date,
            source.today,
            source.displayDate
        ) || null,
        serverTime: pickText(
            source.serverTime,
            source.generatedAt,
            source.updatedAt,
            source.now
        ) || null,
        windows: windowsSource.map((row, index) => normalizeWindow(row, index)),
        upNext: upNextSource.map((row, index) => normalizeTicket(row, index)),
        announcements: announcementsSource.map((row, index) =>
            normalizeAnnouncement(row, index)
        ),
    }
}

const publicDisplayApi = {
    async listManagers() {
        let lastError: unknown = null

        for (const path of MANAGER_ENDPOINTS) {
            try {
                const response = await api.getData<unknown>(path, {
                    auth: false,
                })

                if (!looksLikeManagerPayload(response)) continue

                return normalizeManagerList(response)
            } catch (error) {
                lastError = error
            }
        }

        if (lastError) throw lastError
        return []
    },

    async getPublicDisplayState(
        manager: string,
        since?: string
    ): Promise<PublicDisplayState> {
        let lastError: unknown = null

        for (const buildRequest of DISPLAY_STATE_REQUESTS) {
            const request = buildRequest(manager, since)

            try {
                const response = await api.getData<unknown>(request.path, {
                    auth: false,
                    params: request.params,
                })

                if (!looksLikePublicDisplayState(response)) continue

                return normalizePublicDisplayState(response)
            } catch (error) {
                lastError = error
            }
        }

        if (lastError) throw lastError

        return {
            windows: [],
            upNext: [],
            announcements: [],
        }
    },
}

function getTicketStudentId(t?: TicketView | null) {
    if (!t) return ""

    const direct = String(
        (t as any)?.participant?.studentId ?? (t as any)?.studentId ?? ""
    ).trim()
    if (direct) return direct

    // participantDisplay can look like: "Full Name • StudentId • Mobile"
    const display = String((t as any)?.participantDisplay ?? "").trim()
    if (display && display.includes("•")) {
        const parts = display
            .split("•")
            .map((x) => x.trim())
            .filter(Boolean)

        // Usually: [name, studentId, mobile]
        const maybe = parts[1] ? String(parts[1]).trim() : ""
        return maybe
    }

    return ""
}

function getTicketParticipantInfo(t?: TicketView | null) {
    const fullName = pickParticipantFullName(t ?? undefined)
    const studentId = getTicketStudentId(t)

    return {
        primary: fullName ? fullName : studentId ? `ID: ${studentId}` : "—",
        studentId,
        hasName: Boolean(fullName),
    }
}

function buildAnnouncementLabel(a: Announcement) {
    const q = a.queueNumber ? `#${a.queueNumber}` : "Now serving"
    const w = a.windowNumber ? ` • Window ${a.windowNumber}` : ""
    const dep = a.departmentName ? ` • ${a.departmentName}` : ""
    const person = a.participantName ? ` • ${a.participantName}` : ""
    return `${q}${w}${dep}${person}`.trim()
}

function supportsFullscreen() {
    if (typeof document === "undefined") return false
    const el = document.documentElement as any
    return Boolean(
        el.requestFullscreen ||
            el.webkitRequestFullscreen ||
            el.msRequestFullscreen
    )
}

async function requestFullscreen() {
    if (typeof document === "undefined") return false
    const el = document.documentElement as any
    const fn =
        el.requestFullscreen ||
        el.webkitRequestFullscreen ||
        el.msRequestFullscreen

    if (!fn) return false

    try {
        await fn.call(el)
        return true
    } catch {
        return false
    }
}

async function exitFullscreen() {
    if (typeof document === "undefined") return
    const d = document as any
    const fn = d.exitFullscreen || d.webkitExitFullscreen || d.msExitFullscreen
    if (!fn) return

    try {
        await fn.call(d)
    } catch {
        // ignore
    }
}

function isFullscreenActive() {
    if (typeof document === "undefined") return false
    const d = document as any
    return Boolean(
        d.fullscreenElement || d.webkitFullscreenElement || d.msFullscreenElement
    )
}

type DisplayBoardProps = {
    manager: string
    managers: string[]
    onManagerChange: (v: string) => void
    loadingManagers: boolean

    state: PublicDisplayState | null
    loadingState: boolean
    onRefresh: () => void

    autoRefreshEnabled: boolean
    onAutoRefreshToggle: (v: boolean) => void

    recentCalls: Announcement[]
    onClearRecentCalls: () => void

    offline: boolean
    lastOkTime?: string

    highlightWindowNumber?: number | null

    variant: "embed" | "fullscreen"
    onOpenFullscreen: () => void
    onCloseFullscreen?: () => void
    fullscreenActive?: boolean
}

function DisplayBoard({
    manager,
    managers,
    onManagerChange,
    loadingManagers,
    state,
    loadingState,
    onRefresh,
    autoRefreshEnabled,
    onAutoRefreshToggle,
    recentCalls,
    onClearRecentCalls,
    offline,
    lastOkTime,
    highlightWindowNumber,
    variant,
    onOpenFullscreen,
    onCloseFullscreen,
    fullscreenActive,
}: DisplayBoardProps) {
    const managerLabel = titleCase(manager || "")
    const latestCall = recentCalls.length
        ? recentCalls[recentCalls.length - 1]
        : undefined

    return (
        <div
            className={cn(
                "flex flex-col gap-4",
                variant === "fullscreen" && "h-full"
            )}
        >
            <div
                className={cn(
                    "flex flex-col gap-3",
                    variant === "fullscreen" && "px-4 pt-4 sm:px-6"
                )}
            >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3
                                className={cn(
                                    "text-xl font-semibold tracking-tight",
                                    variant === "fullscreen" && "text-2xl"
                                )}
                            >
                                Public Display
                            </h3>

                            <Badge variant="secondary" className="whitespace-nowrap">
                                Centralized view
                            </Badge>

                            {state?.dateKey ? (
                                <Badge variant="outline" className="whitespace-nowrap">
                                    {state.dateKey}
                                </Badge>
                            ) : null}

                            {offline ? (
                                <Badge variant="destructive" className="whitespace-nowrap">
                                    <WifiOff className="mr-2 h-4 w-4" />
                                    Offline
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="whitespace-nowrap">
                                    Live
                                </Badge>
                            )}

                            {lastOkTime ? (
                                <Badge variant="outline" className="whitespace-nowrap">
                                    Updated {formatTime(lastOkTime)}
                                </Badge>
                            ) : null}
                        </div>

                        <p className="mt-1 text-sm text-muted-foreground">
                            Switch managers to view their active service windows,
                            now serving, and up next.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 rounded-md border px-2 py-1">
                            <Switch
                                checked={autoRefreshEnabled}
                                onCheckedChange={onAutoRefreshToggle}
                                aria-label="Toggle auto refresh"
                            />
                            <span className="text-xs text-muted-foreground">
                                {autoRefreshEnabled ? (
                                    <span className="inline-flex items-center gap-1">
                                        <Play className="h-3.5 w-3.5" />
                                        Auto
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1">
                                        <Pause className="h-3.5 w-3.5" />
                                        Paused
                                    </span>
                                )}
                            </span>
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onRefresh}
                            disabled={!manager}
                        >
                            <RefreshCcw className="mr-2 h-4 w-4" />
                            Refresh
                        </Button>

                        {variant === "embed" ? (
                            <Button size="sm" onClick={onOpenFullscreen}>
                                <Expand className="mr-2 h-4 w-4" />
                                Fullscreen
                            </Button>
                        ) : (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={onCloseFullscreen}
                            >
                                <X className="h-4 w-4" />
                                Exit
                            </Button>
                        )}
                    </div>
                </div>

                <Card>
                    <CardHeader
                        className={cn(
                            "pb-3",
                            variant === "fullscreen" && "pb-4"
                        )}
                    >
                        <CardTitle className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <span className="flex min-w-0 items-center gap-2">
                                <span className="truncate">Manager</span>
                                {managerLabel ? (
                                    <Badge className="whitespace-nowrap">
                                        {managerLabel}
                                    </Badge>
                                ) : (
                                    <Badge variant="outline">Not selected</Badge>
                                )}
                            </span>

                            <div className="flex flex-wrap items-center gap-3">
                                {variant === "fullscreen" ? (
                                    <Badge
                                        variant={
                                            fullscreenActive ? "default" : "outline"
                                        }
                                        className="whitespace-nowrap"
                                    >
                                        {fullscreenActive
                                            ? "Browser fullscreen"
                                            : "Immersive mode"}
                                    </Badge>
                                ) : null}
                            </div>
                        </CardTitle>

                        <CardDescription className="mt-2">
                            <div className="flex flex-col gap-3">
                                <div className="grid gap-2 sm:hidden">
                                    <Select
                                        value={manager || ""}
                                        onValueChange={(v) => onManagerChange(v)}
                                        disabled={loadingManagers || !managers.length}
                                    >
                                        <SelectTrigger>
                                            <SelectValue
                                                placeholder={
                                                    loadingManagers
                                                        ? "Loading managers..."
                                                        : "Select manager"
                                                }
                                            />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {managers.map((m) => (
                                                <SelectItem key={m} value={m}>
                                                    {titleCase(m)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="hidden sm:block">
                                    <Tabs
                                        value={manager || ""}
                                        onValueChange={(v) => onManagerChange(v)}
                                    >
                                        <TabsList className="flex w-full flex-wrap justify-start">
                                            {loadingManagers ? (
                                                <TabsTrigger
                                                    value="__loading__"
                                                    disabled
                                                >
                                                    Loading...
                                                </TabsTrigger>
                                            ) : managers.length ? (
                                                managers.map((m) => (
                                                    <TabsTrigger
                                                        key={m}
                                                        value={m}
                                                        className="whitespace-nowrap"
                                                    >
                                                        {titleCase(m)}
                                                    </TabsTrigger>
                                                ))
                                            ) : (
                                                <TabsTrigger value="__empty__" disabled>
                                                    No managers found
                                                </TabsTrigger>
                                            )}
                                        </TabsList>
                                    </Tabs>
                                </div>

                                {latestCall ? (
                                    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                                        <Badge className="whitespace-nowrap">
                                            Latest call
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                            {buildAnnouncementLabel(latestCall)}
                                        </span>
                                    </div>
                                ) : manager ? (
                                    <div className="text-xs text-muted-foreground">
                                        No live calls yet for this manager today.
                                    </div>
                                ) : null}

                                {variant === "fullscreen" ? (
                                    <p className="text-xs text-muted-foreground">
                                        Mobile tip: landscape is recommended for
                                        the best viewing experience.
                                    </p>
                                ) : null}
                            </div>
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>

            <div
                className={cn(
                    "grid gap-4",
                    variant === "fullscreen" &&
                        "min-h-0 px-4 pb-4 sm:px-6 sm:pb-6",
                    "lg:grid-cols-3"
                )}
            >
                <Card
                    className={cn(
                        "lg:col-span-2",
                        variant === "fullscreen" && "min-h-0"
                    )}
                >
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between">
                            <span>Active service windows</span>
                            <Badge variant="secondary" className="whitespace-nowrap">
                                {state?.windows?.length ?? 0} windows
                            </Badge>
                        </CardTitle>
                        <CardDescription>
                            Each window shows what it is currently serving. This
                            view is centralized (same across devices).
                        </CardDescription>
                    </CardHeader>

                    <CardContent
                        className={cn(
                            "pt-0",
                            variant === "fullscreen" && "min-h-0"
                        )}
                    >
                        {loadingState && !state ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <Card key={i}>
                                        <CardHeader className="pb-3">
                                            <Skeleton className="h-5 w-40" />
                                            <Skeleton className="h-4 w-64" />
                                        </CardHeader>
                                        <CardContent className="pt-0">
                                            <Skeleton className="h-10 w-32" />
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : state?.windows?.length ? (
                            <ScrollArea
                                className={cn(
                                    variant === "fullscreen"
                                        ? "h-[60vh] sm:h-[64vh]"
                                        : "h-80 sm:h-96"
                                )}
                            >
                                <div
                                    className={cn(
                                        "grid gap-3",
                                        variant === "fullscreen"
                                            ? "sm:grid-cols-2 lg:grid-cols-3"
                                            : "sm:grid-cols-2"
                                    )}
                                >
                                    {state.windows.map((w) => {
                                        const serving = w.nowServing
                                        const deptNames =
                                            w.departments
                                                ?.map((d) => d.name)
                                                .filter(Boolean) ?? []

                                        const p =
                                            getTicketParticipantInfo(serving)
                                        const showStudentIdBadge = Boolean(
                                            p.hasName && p.studentId
                                        )

                                        const highlighted = Boolean(
                                            highlightWindowNumber != null &&
                                                Number(w.number) ===
                                                    Number(highlightWindowNumber)
                                        )

                                        return (
                                            <Card
                                                key={w.id}
                                                className={cn(
                                                    "overflow-hidden transition",
                                                    highlighted &&
                                                        "ring-2 ring-primary"
                                                )}
                                            >
                                                <CardHeader className="pb-3">
                                                    <CardTitle className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="truncate font-semibold">
                                                                    {w.name ||
                                                                        `Window ${w.number}`}
                                                                </span>
                                                                <Badge
                                                                    variant="outline"
                                                                    className="whitespace-nowrap"
                                                                >
                                                                    #{w.number}
                                                                </Badge>
                                                            </div>

                                                            <p className="mt-1 text-xs text-muted-foreground">
                                                                {deptNames.length
                                                                    ? deptNames.join(
                                                                          " • "
                                                                      )
                                                                    : "No departments assigned"}
                                                            </p>
                                                        </div>

                                                        <Badge
                                                            variant={
                                                                serving
                                                                    ? "default"
                                                                    : "secondary"
                                                            }
                                                            className="whitespace-nowrap"
                                                        >
                                                            {serving
                                                                ? "Now serving"
                                                                : "Idle"}
                                                        </Badge>
                                                    </CardTitle>
                                                </CardHeader>

                                                <CardContent className="pt-0">
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex items-baseline gap-2">
                                                            <span
                                                                className={cn(
                                                                    "text-3xl font-bold tracking-tight",
                                                                    variant ===
                                                                        "fullscreen" &&
                                                                        "text-4xl"
                                                                )}
                                                            >
                                                                {serving
                                                                    ? serving.queueNumber
                                                                    : "—"}
                                                            </span>
                                                            <span className="text-sm text-muted-foreground">
                                                                Queue #
                                                            </span>
                                                        </div>

                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                                <span className="truncate text-sm font-medium">
                                                                    {p.primary}
                                                                </span>

                                                                {showStudentIdBadge ? (
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="whitespace-nowrap"
                                                                    >
                                                                        ID:{" "}
                                                                        {p.studentId}
                                                                    </Badge>
                                                                ) : null}
                                                            </div>

                                                            <span className="text-xs text-muted-foreground">
                                                                {serving?.department
                                                                    ?.name
                                                                    ? serving
                                                                          .department
                                                                          .name
                                                                    : "—"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )
                                    })}
                                </div>
                            </ScrollArea>
                        ) : (
                            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                                {manager
                                    ? "No active windows found for this manager."
                                    : "Select a manager to start."}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div
                    className={cn(
                        "flex flex-col gap-4",
                        variant === "fullscreen" && "min-h-0"
                    )}
                >
                    <Card className={cn(variant === "fullscreen" && "min-h-0")}>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center justify-between">
                                <span>Up next</span>
                                <Badge variant="secondary" className="whitespace-nowrap">
                                    {state?.upNext?.length ?? 0}
                                </Badge>
                            </CardTitle>
                            <CardDescription>
                                A user-friendly preview of the next tickets in line
                                (names first).
                            </CardDescription>
                        </CardHeader>

                        <CardContent
                            className={cn(
                                "pt-0",
                                variant === "fullscreen" && "min-h-0"
                            )}
                        >
                            {loadingState && !state ? (
                                <div className="grid gap-2">
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center justify-between gap-3 rounded-lg border p-3"
                                        >
                                            <Skeleton className="h-5 w-10" />
                                            <Skeleton className="h-4 w-40" />
                                        </div>
                                    ))}
                                </div>
                            ) : state?.upNext?.length ? (
                                <ScrollArea
                                    className={cn(
                                        variant === "fullscreen"
                                            ? "h-72 sm:h-80"
                                            : "h-64"
                                    )}
                                >
                                    <div className="grid gap-2">
                                        {state.upNext.map((t) => {
                                            const p =
                                                getTicketParticipantInfo(t)
                                            const showStudentIdBadge = Boolean(
                                                p.hasName && p.studentId
                                            )

                                            return (
                                                <div
                                                    key={t.id}
                                                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <Badge className="whitespace-nowrap">
                                                                {t.queueNumber}
                                                            </Badge>

                                                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                                <span className="truncate text-sm font-medium">
                                                                    {p.primary}
                                                                </span>

                                                                {showStudentIdBadge ? (
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="whitespace-nowrap"
                                                                    >
                                                                        ID:{" "}
                                                                        {p.studentId}
                                                                    </Badge>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                        <p className="mt-1 truncate text-xs text-muted-foreground">
                                                            {t.department?.name ||
                                                                "Department"}
                                                        </p>
                                                    </div>

                                                    <Badge
                                                        variant="outline"
                                                        className="whitespace-nowrap"
                                                    >
                                                        Waiting
                                                    </Badge>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </ScrollArea>
                            ) : (
                                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                                    {manager
                                        ? "No waiting tickets right now."
                                        : "Select a manager to view up next."}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className={cn(variant === "fullscreen" && "min-h-0")}>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center justify-between">
                                <span className="inline-flex items-center gap-2">
                                    <History className="h-4 w-4" />
                                    Recent calls
                                </span>

                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="whitespace-nowrap">
                                        {recentCalls.length}
                                    </Badge>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={onClearRecentCalls}
                                        disabled={!recentCalls.length}
                                        className="h-8 px-2"
                                    >
                                        Clear
                                    </Button>
                                </div>
                            </CardTitle>
                            <CardDescription>
                                Shows the latest called tickets for this manager
                                (names first).
                            </CardDescription>
                        </CardHeader>

                        <CardContent
                            className={cn(
                                "pt-0",
                                variant === "fullscreen" && "min-h-0"
                            )}
                        >
                            {recentCalls.length ? (
                                <ScrollArea
                                    className={cn(
                                        variant === "fullscreen"
                                            ? "h-72 sm:h-80"
                                            : "h-64"
                                    )}
                                >
                                    <div className="grid gap-2">
                                        {recentCalls
                                            .slice()
                                            .reverse()
                                            .map((a) => (
                                                <div
                                                    key={a.id}
                                                    className="flex items-start justify-between gap-3 rounded-lg border p-3"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <Badge className="whitespace-nowrap">
                                                                {a.queueNumber ||
                                                                    "—"}
                                                            </Badge>
                                                            {a.windowNumber ? (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="whitespace-nowrap"
                                                                >
                                                                    Window{" "}
                                                                    {a.windowNumber}
                                                                </Badge>
                                                            ) : null}
                                                            <span className="truncate text-sm font-medium">
                                                                {a.participantName
                                                                    ? a.participantName
                                                                    : "Participant"}
                                                            </span>
                                                        </div>
                                                        <p className="mt-1 truncate text-xs text-muted-foreground">
                                                            {a.departmentName
                                                                ? a.departmentName
                                                                : "Department"}
                                                        </p>
                                                    </div>

                                                    <Badge
                                                        variant="outline"
                                                        className="whitespace-nowrap"
                                                    >
                                                        {formatTime(a.createdAt) ||
                                                            "—"}
                                                    </Badge>
                                                </div>
                                            ))}
                                    </div>
                                </ScrollArea>
                            ) : (
                                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                                    {manager
                                        ? "No recent calls yet."
                                        : "Select a manager to view recent calls."}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}

export default function PublicDisplaySection() {
    const [managers, setManagers] = React.useState<string[]>([])
    const [loadingManagers, setLoadingManagers] = React.useState(true)

    const [manager, setManager] = React.useState<string>("")
    const [state, setState] = React.useState<PublicDisplayState | null>(null)
    const [loadingState, setLoadingState] = React.useState(false)

    const [offline, setOffline] = React.useState(false)
    const [lastOkTime, setLastOkTime] = React.useState<string | undefined>(
        undefined
    )

    const [recentCalls, setRecentCalls] = React.useState<Announcement[]>([])
    const recentCallsRef = React.useRef<Announcement[]>([])
    React.useEffect(() => {
        recentCallsRef.current = recentCalls
    }, [recentCalls])

    const [highlightWindowNumber, setHighlightWindowNumber] = React.useState<
        number | null
    >(null)
    const highlightTimerRef = React.useRef<number | null>(null)

    const [fullscreenOpen, setFullscreenOpen] = React.useState(false)
    const [fullscreenActive, setFullscreenActive] = React.useState(false)

    const [autoRefreshEnabled, setAutoRefreshEnabled] = React.useState<boolean>(
        () => {
            if (typeof window === "undefined") return true

            try {
                const v = localStorage.getItem(STORAGE_AUTO_REFRESH)
                if (v === "0") return false
                return true
            } catch {
                return true
            }
        }
    )

    React.useEffect(() => {
        try {
            localStorage.setItem(
                STORAGE_AUTO_REFRESH,
                autoRefreshEnabled ? "1" : "0"
            )
        } catch {
            // ignore
        }
        toast.message(
            autoRefreshEnabled ? "Auto refresh enabled." : "Auto refresh paused."
        )
    }, [autoRefreshEnabled])

    const sinceRef = React.useRef<string | undefined>(undefined)

    const lastToastRef = React.useRef<number>(0)
    const lastCallToastIdRef = React.useRef<string | null>(null)

    const safeToastError = (msg: string) => {
        const now = Date.now()
        if (now - lastToastRef.current < 8000) return
        lastToastRef.current = now
        toast.error(msg)
    }

    const safeToastCall = (a?: Announcement) => {
        if (!a?.id) return
        if (lastCallToastIdRef.current === a.id) return
        lastCallToastIdRef.current = a.id

        const now = Date.now()
        if (now - lastToastRef.current < 2500) return
        lastToastRef.current = now
        toast.message(buildAnnouncementLabel(a))
    }

    const appendRecentCalls = React.useCallback((items: Announcement[]) => {
        if (!items?.length) return

        setRecentCalls((prev) => {
            const existing = new Set(prev.map((x) => x.id))
            const merged = [...prev]

            for (const a of items) {
                if (!a?.id) continue
                if (existing.has(a.id)) continue
                merged.push(a)
                existing.add(a.id)
            }

            // keep last 20
            return merged.slice(-20)
        })
    }, [])

    const loadManagers = React.useCallback(async () => {
        setLoadingManagers(true)

        try {
            const list = await publicDisplayApi.listManagers()
            setManagers(list)

            let next = ""
            try {
                const saved = localStorage.getItem(STORAGE_MANAGER)
                if (saved && list.includes(saved)) next = saved
            } catch {
                // ignore
            }

            if (!next) next = list[0] || ""
            setManager(next)
        } catch {
            safeToastError("Failed to load managers for Public Display.")
            setManagers([])
            setManager("")
        } finally {
            setLoadingManagers(false)
        }
    }, [])

    React.useEffect(() => {
        void loadManagers()
    }, [loadManagers])

    const refresh = React.useCallback(async () => {
        if (!manager) return

        setLoadingState(true)

        try {
            const data = await publicDisplayApi.getPublicDisplayState(
                manager,
                sinceRef.current
            )

            setState(data)
            setOffline(false)
            setLastOkTime(data?.serverTime || new Date().toISOString())

            const anns = data?.announcements ?? []
            if (anns.length) {
                const last = anns[anns.length - 1]
                sinceRef.current = last?.createdAt || sinceRef.current

                appendRecentCalls(anns)
                safeToastCall(last)

                const wn =
                    last?.windowNumber != null
                        ? Number(last.windowNumber)
                        : null

                if (wn != null && !Number.isNaN(wn)) {
                    setHighlightWindowNumber(wn)

                    if (highlightTimerRef.current) {
                        window.clearTimeout(highlightTimerRef.current)
                    }

                    highlightTimerRef.current = window.setTimeout(
                        () => setHighlightWindowNumber(null),
                        3500
                    )
                }
            }
        } catch {
            setOffline(true)
            safeToastError("Unable to load Public Display right now.")
        } finally {
            setLoadingState(false)
        }
    }, [manager, appendRecentCalls])

    React.useEffect(() => {
        return () => {
            if (highlightTimerRef.current) {
                window.clearTimeout(highlightTimerRef.current)
            }
        }
    }, [])

    React.useEffect(() => {
        if (!manager) return

        try {
            localStorage.setItem(STORAGE_MANAGER, manager)
        } catch {
            // ignore
        }

        // Reset per manager switch
        sinceRef.current = undefined
        lastCallToastIdRef.current = null
        setRecentCalls([])
        setHighlightWindowNumber(null)

        void refresh()

        if (!autoRefreshEnabled) return

        const id = window.setInterval(() => {
            void refresh()
        }, 2500)

        return () => window.clearInterval(id)
    }, [manager, refresh, autoRefreshEnabled])

    React.useEffect(() => {
        const onFs = () => setFullscreenActive(isFullscreenActive())

        document.addEventListener("fullscreenchange", onFs)
        document.addEventListener("webkitfullscreenchange", onFs as any)
        onFs()

        return () => {
            document.removeEventListener("fullscreenchange", onFs)
            document.removeEventListener("webkitfullscreenchange", onFs as any)
        }
    }, [])

    const handleManagerChange = (v: string) => {
        setManager(v)
    }

    const openFullscreen = async () => {
        setFullscreenOpen(true)

        // Best-effort browser fullscreen (desktop + most mobile browsers).
        // iOS Safari often does not support it; we still show immersive mode (Dialog).
        if (!supportsFullscreen()) {
            toast.message(
                "Fullscreen not supported in this browser. Using immersive mode instead."
            )
            return
        }

        const ok = await requestFullscreen()
        if (!ok) {
            toast.message(
                "Could not enter browser fullscreen. Using immersive mode instead."
            )
        }
    }

    const closeFullscreen = async () => {
        setFullscreenOpen(false)
        if (isFullscreenActive()) await exitFullscreen()
    }

    const clearRecentCalls = () => {
        setRecentCalls([])
        toast.message("Recent calls cleared.")
    }

    return (
        <section id="public-display" className="scroll-mt-24">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-semibold tracking-tight">
                    Public Display
                </h2>
                <p className="text-muted-foreground">
                    A centralized display for the general public: switch
                    managers, view their windows, and see who’s being served
                    next.
                </p>
            </div>

            <Separator className="my-8" />

            <DisplayBoard
                manager={manager}
                managers={managers}
                onManagerChange={handleManagerChange}
                loadingManagers={loadingManagers}
                state={state}
                loadingState={loadingState}
                onRefresh={refresh}
                autoRefreshEnabled={autoRefreshEnabled}
                onAutoRefreshToggle={setAutoRefreshEnabled}
                recentCalls={recentCalls}
                onClearRecentCalls={clearRecentCalls}
                offline={offline}
                lastOkTime={lastOkTime}
                highlightWindowNumber={highlightWindowNumber}
                variant="embed"
                onOpenFullscreen={openFullscreen}
            />

            <Dialog
                open={fullscreenOpen}
                onOpenChange={(v) => {
                    if (!v) void closeFullscreen()
                    else setFullscreenOpen(true)
                }}
            >
                <DialogContent
                    fullscreen
                    showCloseButton={false}
                    className="overflow-auto p-0"
                >
                    <DialogHeader className="sr-only">
                        <DialogTitle>Public Display Fullscreen</DialogTitle>
                    </DialogHeader>

                    <div className="flex min-h-full flex-col">
                        <div className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary">Public Display</Badge>
                                <Badge
                                    variant="outline"
                                    className="hidden sm:inline-flex"
                                >
                                    Landscape recommended on mobile
                                </Badge>
                            </div>

                            <div className="flex items-center gap-2">
                                {offline ? (
                                    <Badge
                                        variant="destructive"
                                        className="whitespace-nowrap"
                                    >
                                        <WifiOff className="mr-2 h-4 w-4" />
                                        Offline
                                    </Badge>
                                ) : (
                                    <Badge
                                        variant="outline"
                                        className="whitespace-nowrap"
                                    >
                                        Live
                                    </Badge>
                                )}
                            </div>
                        </div>

                        <div className="flex-1">
                            <DisplayBoard
                                manager={manager}
                                managers={managers}
                                onManagerChange={handleManagerChange}
                                loadingManagers={loadingManagers}
                                state={state}
                                loadingState={loadingState}
                                onRefresh={refresh}
                                autoRefreshEnabled={autoRefreshEnabled}
                                onAutoRefreshToggle={setAutoRefreshEnabled}
                                recentCalls={recentCalls}
                                onClearRecentCalls={clearRecentCalls}
                                offline={offline}
                                lastOkTime={lastOkTime}
                                highlightWindowNumber={highlightWindowNumber}
                                variant="fullscreen"
                                onOpenFullscreen={openFullscreen}
                                onCloseFullscreen={closeFullscreen}
                                fullscreenActive={fullscreenActive}
                            />
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </section>
    )
}