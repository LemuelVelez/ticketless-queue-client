"use client"

import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import {
    AlertTriangle,
    BadgeCheck,
    BellRing,
    CircleDot,
    RefreshCcw,
    Volume2,
    VolumeX,
} from "lucide-react"

import { api } from "@/lib/http"
import { cn } from "@/lib/utils"
import { useSession } from "@/hooks/use-session"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

type TicketParticipantType = "STUDENT" | "ALUMNI_VISITOR" | "GUEST" | string
type TicketStatus = "WAITING" | "CALLED" | "HOLD" | "SERVED" | "OUT" | string

type TicketView = {
    id: string
    dateKey: string
    queueNumber: number
    status: TicketStatus
    department: { id: string; name: string; code?: string; transactionManager: string }
    participant: { studentId: string; name?: string; phone?: string; type?: TicketParticipantType }
    transaction?: { category?: string; key?: string; label?: string; purpose?: string }
    window?: { id: string; name: string; number: number }
    holdAttempts: number
    waitingSince: string
    calledAt?: string
    servedAt?: string
    outAt?: string
    createdAt: string
    updatedAt: string
}

type StaffQueueState = {
    serverTime: string
    dateKey: string
    scope: {
        manager?: string
        departmentId?: string
        windowId?: string
        departmentIds?: string[]
    }
    settings: {
        upNextCount: number
        maxHoldAttempts: number
        disallowDuplicateActiveTickets: boolean
    }
    nowServing?: TicketView
    waiting: TicketView[]
    hold: TicketView[]
    called: TicketView[]
    upNext: TicketView[]
}

/**
 * NOTE:
 * These endpoints assume you mounted QueueManagementController under something like:
 *   /queue-management/...
 * If your backend uses a different base path, update QUEUE_BASE below.
 */
const QUEUE_BASE = "/queue-management"
const ENDPOINTS = {
    staffState: `${QUEUE_BASE}/staff/state`,
    callNext: `${QUEUE_BASE}/staff/call-next`,
    serve: `${QUEUE_BASE}/staff/serve`,
    hold: `${QUEUE_BASE}/staff/hold`,
    out: `${QUEUE_BASE}/staff/out`,

    // existing staff assignment endpoint (already in your staffRoutes.ts)
    staffAssignment: "/staff/me/assignment",
} as const

function unwrapData<T>(raw: any): T {
    // supports both: { ok:true, data } and plain { ... }
    if (raw && typeof raw === "object" && "ok" in raw && "data" in raw) return raw.data as T
    return raw as T
}

function toErrMessage(err: any, fallback = "Something went wrong.") {
    const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message
    return String(msg ?? fallback)
}

function formatTime(iso?: string) {
    if (!iso) return "—"
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function formatSince(iso?: string) {
    if (!iso) return "—"
    const d = new Date(iso)
    const ms = Date.now() - d.getTime()
    if (!Number.isFinite(ms) || ms < 0) return "—"
    const s = Math.floor(ms / 1000)
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}m`
    const h = Math.floor(m / 60)
    return `${h}h`
}

function useInterval(callback: () => void, delayMs: number | null) {
    const cbRef = React.useRef(callback)
    React.useEffect(() => {
        cbRef.current = callback
    }, [callback])

    React.useEffect(() => {
        if (delayMs == null) return
        const id = window.setInterval(() => cbRef.current(), delayMs)
        return () => window.clearInterval(id)
    }, [delayMs])
}

function makeTabId() {
    // stable per tab
    return `tab_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

const AUDIO_LOCK_KEY = "queue_audio_speaker_lock_v1"
const AUDIO_LOCK_TTL_MS = 12_000

function tryAcquireAudioLock(tabId: string) {
    try {
        const raw = localStorage.getItem(AUDIO_LOCK_KEY)
        const now = Date.now()
        if (raw) {
            const parsed = JSON.parse(raw) as { tabId: string; ts: number }
            if (parsed?.tabId === tabId) {
                localStorage.setItem(AUDIO_LOCK_KEY, JSON.stringify({ tabId, ts: now }))
                return true
            }
            if (parsed?.ts && now - parsed.ts < AUDIO_LOCK_TTL_MS) return false
        }
        localStorage.setItem(AUDIO_LOCK_KEY, JSON.stringify({ tabId, ts: now }))
        return true
    } catch {
        return false
    }
}

function releaseAudioLock(tabId: string) {
    try {
        const raw = localStorage.getItem(AUDIO_LOCK_KEY)
        if (!raw) return
        const parsed = JSON.parse(raw) as { tabId: string; ts: number }
        if (parsed?.tabId === tabId) localStorage.removeItem(AUDIO_LOCK_KEY)
    } catch {
        // ignore
    }
}

function speak(text: string) {
    if (!("speechSynthesis" in window)) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1
    u.pitch = 1
    u.volume = 1
    window.speechSynthesis.speak(u)
}

function buildVoiceText(t: TicketView) {
    const dept = t.department?.name ? `for ${t.department.name}` : ""
    const win = t.window?.number ? `Please proceed to window ${t.window.number}.` : ""
    const participant = t.participant?.name ? `Participant ${t.participant.name}.` : ""
    return [`Now serving`, dept, `queue number ${t.queueNumber}.`, win, participant]
        .map((s) => String(s || "").trim())
        .filter(Boolean)
        .join(" ")
}

type StaffAssignment = {
    assignedWindow?: { id?: string; _id?: string; name?: string; number?: number } | string | null
    assignedDepartment?: { id?: string; _id?: string; name?: string; code?: string } | string | null
    assignedTransactionManager?: string | null
    // allow extra fields
    [k: string]: unknown
}

function pickAssignedWindowId(a: StaffAssignment | null | undefined) {
    const v: any = a?.assignedWindow
    const id =
        (v && typeof v === "object" && (v.id || v._id)) ||
        (typeof v === "string" ? v : "")
    return String(id || "").trim()
}

function pickAssignedManager(a: StaffAssignment | null | undefined) {
    const m = String(a?.assignedTransactionManager ?? "").trim()
    return m || ""
}

function pickAssignedWindowLabel(a: StaffAssignment | null | undefined) {
    const raw: any = a?.assignedWindow
    if (!raw) return ""

    if (typeof raw === "object") {
        const name = String(raw?.name ?? "").trim()
        const num = raw?.number != null ? Number(raw.number) : NaN
        if (name && Number.isFinite(num) && num > 0) return `${name} (Window ${num})`
        if (name) return name
        if (Number.isFinite(num) && num > 0) return `Window ${num}`
        return ""
    }

    // string id fallback (avoid showing unless necessary)
    return ""
}

function pickAssignedDepartmentLabel(a: StaffAssignment | null | undefined) {
    const raw: any = a?.assignedDepartment
    if (!raw) return ""

    if (typeof raw === "object") {
        const name = String(raw?.name ?? "").trim()
        const code = String(raw?.code ?? "").trim()
        if (name && code) return `${name} (${code})`
        if (name) return name
        if (code) return code
        return ""
    }

    // string id fallback (avoid showing unless necessary)
    return ""
}

function computeDuplicates(state: StaffQueueState | null) {
    if (!state) return []
    const active = [...(state.waiting ?? []), ...(state.hold ?? []), ...(state.called ?? [])]
    const seen = new Map<string, TicketView>()
    const dups: Array<{ key: string; first: TicketView; second: TicketView }> = []

    for (const t of active) {
        const key = `${t.department?.id ?? "dep"}:${t.queueNumber}`
        const prev = seen.get(key)
        if (!prev) seen.set(key, t)
        else dups.push({ key, first: prev, second: t })
    }
    return dups
}

export default function QueueControlCenter() {
    const location = useLocation()
    const { user } = useSession() as any

    const tabId = React.useMemo(() => makeTabId(), [])
    const bcRef = React.useRef<BroadcastChannel | null>(null)

    const [assignment, setAssignment] = React.useState<StaffAssignment | null>(null)

    // Scope controls (window is the safest “single-source-of-truth” control mode for staff actions)
    const [windowId, setWindowId] = React.useState<string>("")
    const [managerKey, setManagerKey] = React.useState<string>("")

    // Polling
    const [polling, setPolling] = React.useState(true)
    const [pollMs, setPollMs] = React.useState<number>(2000)

    // Data
    const [state, setState] = React.useState<StaffQueueState | null>(null)
    const [loadingState, setLoadingState] = React.useState(true)
    const [mutating, setMutating] = React.useState<null | "NEXT" | "SERVED" | "HOLD" | "OUT">(null)
    const [lastUpdatedAt, setLastUpdatedAt] = React.useState<number>(0)

    // Audio (centralized per-browser via lock; recommended to run on Public Display device)
    const [audioEnabled, setAudioEnabled] = React.useState(false)
    const [hasAudioLock, setHasAudioLock] = React.useState(false)
    const lastSpokenTicketIdRef = React.useRef<string>("")

    // duplicate warning throttling
    const lastDupWarnRef = React.useRef<number>(0)

    const dashboardUser = React.useMemo(() => {
        const name = String(user?.name ?? "Staff User")
        const email = String(user?.email ?? "staff@example.com")
        return { name, email }
    }, [user?.name, user?.email])

    const fetchAssignment = React.useCallback(async () => {
        try {
            const res = await (api as any).get(ENDPOINTS.staffAssignment)
            const data = unwrapData<StaffAssignment>(res?.data)
            setAssignment(data ?? null)

            const assignedWinId = pickAssignedWindowId(data ?? null)
            const mgr = pickAssignedManager(data ?? null)

            if (assignedWinId && !windowId) setWindowId(assignedWinId)
            if (mgr && !managerKey) setManagerKey(mgr)
        } catch (err: any) {
            // Not fatal (some projects may not implement this endpoint yet)
            setAssignment(null)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const fetchState = React.useCallback(
        async (reason?: string) => {
            if (!windowId && !managerKey) return

            setLoadingState((prev) => (prev ? true : prev))
            try {
                const params: Record<string, string> = {}
                if (windowId) params.windowId = windowId
                else if (managerKey) params.manager = managerKey

                const res = await (api as any).get(ENDPOINTS.staffState, { params })
                const data = unwrapData<StaffQueueState>(res?.data)
                setState(data)
                setLastUpdatedAt(Date.now())

                if (reason === "manual") toast.success("Queue state refreshed.")
            } catch (err: any) {
                toast.error(toErrMessage(err, "Failed to fetch queue state."))
            } finally {
                setLoadingState(false)
            }
        },
        [windowId, managerKey]
    )

    // BroadcastChannel: instant cross-tab sync (same browser/profile)
    React.useEffect(() => {
        const ch = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("queue_control_center_v1") : null
        bcRef.current = ch

        if (!ch) return

        ch.onmessage = (ev) => {
            const msg = ev?.data
            if (!msg || typeof msg !== "object") return
            if (msg.type === "invalidate") {
                fetchState()
            }
            if (msg.type === "audio_lock_recheck") {
                setHasAudioLock(tryAcquireAudioLock(tabId))
            }
        }

        return () => {
            ch.close()
            bcRef.current = null
        }
    }, [fetchState, tabId])

    const broadcastInvalidate = React.useCallback(() => {
        try {
            bcRef.current?.postMessage({ type: "invalidate", ts: Date.now() })
        } catch {
            // ignore
        }
    }, [])

    const broadcastAudioLockRecheck = React.useCallback(() => {
        try {
            bcRef.current?.postMessage({ type: "audio_lock_recheck", ts: Date.now() })
        } catch {
            // ignore
        }
    }, [])

    // Initial boot
    React.useEffect(() => {
        fetchAssignment()
    }, [fetchAssignment])

    React.useEffect(() => {
        // first state fetch when scope becomes available
        if (!windowId && !managerKey) return
        fetchState()
    }, [windowId, managerKey, fetchState])

    // Polling (server is the “one queue DB / one live state” source of truth)
    useInterval(
        () => {
            if (!polling) return
            if (document.visibilityState !== "visible") return
            fetchState()
        },
        polling ? pollMs : null
    )

    // Detect duplicates (defensive UX warning)
    React.useEffect(() => {
        const dups = computeDuplicates(state)
        if (!dups.length) return

        const now = Date.now()
        if (now - lastDupWarnRef.current < 60_000) return
        lastDupWarnRef.current = now

        toast.error(`Duplicate queue numbers detected (${dups.length}). Centralized validation may be misconfigured.`)
    }, [state])

    // Audio lock heartbeat
    React.useEffect(() => {
        if (!audioEnabled) {
            setHasAudioLock(false)
            return
        }

        const tick = () => setHasAudioLock(tryAcquireAudioLock(tabId))
        tick()

        const id = window.setInterval(tick, 4000)
        const onStorage = (e: StorageEvent) => {
            if (e.key === AUDIO_LOCK_KEY) tick()
        }
        window.addEventListener("storage", onStorage)

        return () => {
            window.clearInterval(id)
            window.removeEventListener("storage", onStorage)
        }
    }, [audioEnabled, tabId])

    // Speak ONLY if this tab holds lock (prevents duplicate audio across staff tabs on same device)
    React.useEffect(() => {
        if (!audioEnabled || !hasAudioLock) return
        if (!state?.nowServing?.id) return

        const ticketId = state.nowServing.id
        if (lastSpokenTicketIdRef.current === ticketId) return

        lastSpokenTicketIdRef.current = ticketId
        const voice = buildVoiceText(state.nowServing)
        speak(voice)
    }, [audioEnabled, hasAudioLock, state?.nowServing?.id])

    React.useEffect(() => {
        // cleanup lock on tab close
        const onBeforeUnload = () => releaseAudioLock(tabId)
        window.addEventListener("beforeunload", onBeforeUnload)
        return () => window.removeEventListener("beforeunload", onBeforeUnload)
    }, [tabId])

    const onUseAssignment = React.useCallback(() => {
        const winId = pickAssignedWindowId(assignment)
        const mgr = pickAssignedManager(assignment)

        if (winId) setWindowId(winId)
        if (mgr) setManagerKey(mgr)

        if (!winId && !mgr) {
            toast.message("No assignment data available to apply.")
            return
        }

        toast.success("Applied your assignment to scope.")
    }, [assignment])

    const onCallNext = React.useCallback(async () => {
        if (!windowId) {
            toast.error("Select a service window first.")
            return
        }

        setMutating("NEXT")
        try {
            const res = await (api as any).post(ENDPOINTS.callNext, { windowId })
            const ticket = unwrapData<TicketView | null>(res?.data)

            if (!ticket) {
                toast.message("No waiting tickets right now.")
                return
            }

            toast.success(
                `Called queue #${ticket.queueNumber} — ${ticket.participant?.name || ticket.participant?.studentId}`
            )
            broadcastInvalidate()
            fetchState()
        } catch (err: any) {
            toast.error(toErrMessage(err, "Failed to call next queue."))
        } finally {
            setMutating(null)
        }
    }, [broadcastInvalidate, fetchState, windowId])

    const onServe = React.useCallback(async () => {
        const ticketId = state?.nowServing?.id
        if (!ticketId) return

        setMutating("SERVED")
        try {
            await (api as any).post(ENDPOINTS.serve, { ticketId })
            toast.success("Marked as served.")
            broadcastInvalidate()
            fetchState()
        } catch (err: any) {
            toast.error(toErrMessage(err, "Failed to mark as served."))
        } finally {
            setMutating(null)
        }
    }, [broadcastInvalidate, fetchState, state?.nowServing?.id])

    const onHold = React.useCallback(async () => {
        const ticketId = state?.nowServing?.id
        if (!ticketId) return

        setMutating("HOLD")
        try {
            await (api as any).post(ENDPOINTS.hold, { ticketId })
            toast.success("Ticket placed on hold.")
            broadcastInvalidate()
            fetchState()
        } catch (err: any) {
            toast.error(toErrMessage(err, "Failed to hold ticket."))
        } finally {
            setMutating(null)
        }
    }, [broadcastInvalidate, fetchState, state?.nowServing?.id])

    const onOut = React.useCallback(async () => {
        const ticketId = state?.nowServing?.id
        if (!ticketId) return

        setMutating("OUT")
        try {
            await (api as any).post(ENDPOINTS.out, { ticketId, reason: "No-show / cancelled" })
            toast.success("Ticket marked out.")
            broadcastInvalidate()
            fetchState()
        } catch (err: any) {
            toast.error(toErrMessage(err, "Failed to mark out."))
        } finally {
            setMutating(null)
        }
    }, [broadcastInvalidate, fetchState, state?.nowServing?.id])

    const nowServing = state?.nowServing

    const topRight = (
        <div className="flex items-center gap-2">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchState("manual")}
                            disabled={loadingState || mutating != null}
                        >
                            <RefreshCcw className="h-4 w-4 mr-2" />
                            Refresh
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Manual refresh (also triggers toast)</TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <div className="hidden sm:flex items-center gap-2">
                <CircleDot className={cn("h-4 w-4", polling ? "text-emerald-600" : "text-muted-foreground")} />
                <span className="text-sm text-muted-foreground">
                    {polling ? "Live" : "Paused"} • {pollMs / 1000}s
                </span>
            </div>
        </div>
    )

    const assignedWindowLabel = pickAssignedWindowLabel(assignment)
    const assignedDepartmentLabel = pickAssignedDepartmentLabel(assignment)
    const assignedManagerLabel = pickAssignedManager(assignment)

    return (
        <DashboardLayout
            title="Queue Control Center"
            user={dashboardUser}
            headerRightSlot={topRight}
            activePath={location.pathname}
        >
            <div className="max-w-screen-2xl mx-auto w-full space-y-4">
                <Card>
                    <CardHeader className="space-y-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <BadgeCheck className="h-5 w-5" />
                                    Centralized Real-Time Queue State
                                </CardTitle>
                                <CardDescription className="mt-1">
                                    One shared queue DB + one live serving state. All staff windows see the same truth and stay synchronized.
                                </CardDescription>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">
                                    Date: <span className="ml-1 font-medium">{state?.dateKey ?? "—"}</span>
                                </Badge>
                                <Badge variant="secondary">
                                    Server: <span className="ml-1 font-medium">{formatTime(state?.serverTime)}</span>
                                </Badge>
                                <Badge variant="secondary">
                                    Updated:{" "}
                                    <span className="ml-1 font-medium">
                                        {lastUpdatedAt ? `${formatSince(new Date(lastUpdatedAt).toISOString())} ago` : "—"}
                                    </span>
                                </Badge>
                            </div>
                        </div>

                        <Separator />

                        <div className="grid gap-3 md:grid-cols-3">
                            <Card className="md:col-span-2">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">Scope (shared state)</CardTitle>
                                    <CardDescription>
                                        Use a window scope for “Next Queue” to guarantee race-safe centralized calls.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-3">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <div className="text-sm font-medium">Window ID</div>
                                            <Input
                                                value={windowId}
                                                onChange={(e) => setWindowId(e.target.value)}
                                                placeholder="Paste windowId (or auto-filled from assignment)"
                                            />
                                            <div className="text-xs text-muted-foreground">
                                                Tip: This is safe to open in multiple staff tabs — updates synchronize instantly.
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="text-sm font-medium">Manager Key (fallback view)</div>
                                            <Input
                                                value={managerKey}
                                                onChange={(e) => setManagerKey(e.target.value)}
                                                placeholder="e.g. REGISTRAR"
                                            />
                                            <div className="text-xs text-muted-foreground">
                                                If no windowId is set, this page can still view centralized state via manager scope (read-only safe).
                                            </div>
                                        </div>
                                    </div>

                                    {/* ✅ Read assignment for UX + fixes TS unused variable warning */}
                                    <div className="rounded-lg border bg-card p-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="text-sm font-medium">My Assignment</div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={onUseAssignment}
                                                disabled={!assignment}
                                            >
                                                Use assignment
                                            </Button>
                                        </div>

                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {assignedWindowLabel ? (
                                                <Badge variant="secondary">Window: {assignedWindowLabel}</Badge>
                                            ) : null}

                                            {assignedDepartmentLabel ? (
                                                <Badge variant="secondary">Department: {assignedDepartmentLabel}</Badge>
                                            ) : null}

                                            {assignedManagerLabel ? (
                                                <Badge variant="secondary">Manager: {assignedManagerLabel}</Badge>
                                            ) : null}

                                            {!assignedWindowLabel && !assignedDepartmentLabel && !assignedManagerLabel ? (
                                                <span className="text-xs text-muted-foreground">
                                                    {assignment ? "Assignment loaded, but missing readable labels." : "No assignment available. You can still paste Window ID or Manager Key."}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">Live Controls</CardTitle>
                                    <CardDescription>Best UX: fast sync + no duplicate audio.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="space-y-0.5">
                                            <div className="text-sm font-medium">Live polling</div>
                                            <div className="text-xs text-muted-foreground">
                                                Auto-refresh from the centralized server state
                                            </div>
                                        </div>
                                        <Switch checked={polling} onCheckedChange={setPolling} />
                                    </div>

                                    <div className="flex items-center justify-between gap-3">
                                        <div className="space-y-0.5">
                                            <div className="text-sm font-medium">Polling interval</div>
                                            <div className="text-xs text-muted-foreground">Recommended: 2s–3s</div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                variant={pollMs === 2000 ? "default" : "outline"}
                                                onClick={() => setPollMs(2000)}
                                            >
                                                2s
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant={pollMs === 3000 ? "default" : "outline"}
                                                onClick={() => setPollMs(3000)}
                                            >
                                                3s
                                            </Button>
                                        </div>
                                    </div>

                                    <Separator />

                                    <div className="flex items-center justify-between gap-3">
                                        <div className="space-y-0.5">
                                            <div className="text-sm font-medium flex items-center gap-2">
                                                <BellRing className="h-4 w-4" />
                                                Audio speaker
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                Enable ONLY on the single device that should speak announcements (prevents duplicate audio on the same browser via lock).
                                            </div>
                                        </div>
                                        <Switch
                                            checked={audioEnabled}
                                            onCheckedChange={(v) => {
                                                setAudioEnabled(v)
                                                if (v) {
                                                    const ok = tryAcquireAudioLock(tabId)
                                                    setHasAudioLock(ok)
                                                    broadcastAudioLockRecheck()
                                                    toast.message(ok ? "Audio speaker enabled on this tab." : "Audio speaker already active in another tab.")
                                                } else {
                                                    releaseAudioLock(tabId)
                                                    setHasAudioLock(false)
                                                    broadcastAudioLockRecheck()
                                                    toast.message("Audio speaker disabled.")
                                                }
                                            }}
                                        />
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {audioEnabled ? (
                                            hasAudioLock ? (
                                                <Badge className="gap-1" variant="secondary">
                                                    <Volume2 className="h-3.5 w-3.5" />
                                                    Speaker active
                                                </Badge>
                                            ) : (
                                                <Badge className="gap-1" variant="secondary">
                                                    <VolumeX className="h-3.5 w-3.5" />
                                                    Another tab is speaking
                                                </Badge>
                                            )
                                        ) : (
                                            <Badge variant="secondary">Audio off</Badge>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </CardHeader>
                </Card>

                <div className="grid gap-4 lg:grid-cols-3">
                    <Card className="lg:col-span-1">
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-base">Now Serving (centralized)</CardTitle>
                            <CardDescription>
                                This is shared state. If any staff calls next, all windows see it.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            {loadingState && !state ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-10 w-40" />
                                    <Skeleton className="h-4 w-56" />
                                    <Skeleton className="h-4 w-44" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : nowServing ? (
                                <div className="space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-3xl font-semibold">#{nowServing.queueNumber}</div>
                                            <div className="text-sm text-muted-foreground">
                                                Called at {formatTime(nowServing.calledAt)}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary">{nowServing.department.name}</Badge>
                                            {nowServing.window?.number ? (
                                                <Badge variant="secondary">Window {nowServing.window.number}</Badge>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="rounded-lg border bg-card p-3 space-y-2">
                                        <div className="text-sm font-medium">Participant</div>
                                        <div className="text-sm">
                                            <span className="font-semibold">
                                                {nowServing.participant.name || "Unknown"}
                                            </span>
                                            <span className="text-muted-foreground"> • {nowServing.participant.studentId}</span>
                                        </div>
                                        {nowServing.transaction?.purpose ? (
                                            <div className="text-xs text-muted-foreground">
                                                Purpose: {nowServing.transaction.purpose}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <Button onClick={onServe} disabled={mutating != null} className="w-full">
                                            Mark Served
                                        </Button>
                                        <Button variant="outline" onClick={onHold} disabled={mutating != null} className="w-full">
                                            Hold
                                        </Button>
                                    </div>

                                    <Button variant="destructive" onClick={onOut} disabled={mutating != null} className="w-full">
                                        Mark Out
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="rounded-lg border p-4">
                                        <div className="flex items-start gap-3">
                                            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                                            <div>
                                                <div className="text-sm font-medium">No active ticket for this scope</div>
                                                <div className="text-xs text-muted-foreground">
                                                    Click “Next Queue” to call the next waiting ticket (race-safe, centralized).
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <Separator />

                            <div className="space-y-2">
                                <Button onClick={onCallNext} disabled={mutating != null || !windowId} className="w-full">
                                    Next Queue (Centralized)
                                </Button>
                                <div className="text-xs text-muted-foreground">
                                    If multiple staff click Next at the same time, the server guarantees only one ticket is called.
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-2">
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-base">Queue Lists (shared & synchronized)</CardTitle>
                            <CardDescription>Names first, IDs included only as helpful context.</CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-3">
                            <Tabs defaultValue="upnext">
                                <TabsList className="w-full sm:w-auto">
                                    <TabsTrigger value="upnext">Up Next</TabsTrigger>
                                    <TabsTrigger value="waiting">Waiting</TabsTrigger>
                                    <TabsTrigger value="hold">Hold</TabsTrigger>
                                    <TabsTrigger value="called">Called</TabsTrigger>
                                </TabsList>

                                <TabsContent value="upnext" className="mt-3">
                                    <QueueTable rows={state?.upNext ?? []} emptyLabel="No upcoming tickets." compact />
                                </TabsContent>

                                <TabsContent value="waiting" className="mt-3">
                                    <QueueTable rows={state?.waiting ?? []} emptyLabel="No waiting tickets." />
                                </TabsContent>

                                <TabsContent value="hold" className="mt-3">
                                    <QueueTable rows={state?.hold ?? []} emptyLabel="No held tickets." />
                                </TabsContent>

                                <TabsContent value="called" className="mt-3">
                                    <QueueTable rows={state?.called ?? []} emptyLabel="No called history yet." />
                                </TabsContent>
                            </Tabs>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="text-xs text-muted-foreground">
                                    Centralized protection:{" "}
                                    {state?.settings?.disallowDuplicateActiveTickets ? (
                                        <span className="font-medium text-emerald-600">Duplicate active tickets blocked</span>
                                    ) : (
                                        <span className="font-medium text-amber-600">Duplicate active tickets allowed</span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary">
                                        Up Next: <span className="ml-1 font-medium">{state?.settings?.upNextCount ?? "—"}</span>
                                    </Badge>
                                    <Badge variant="secondary">
                                        Max Holds: <span className="ml-1 font-medium">{state?.settings?.maxHoldAttempts ?? "—"}</span>
                                    </Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-base">Instant Sync Notes</CardTitle>
                        <CardDescription>
                            This page uses a single shared server state (polling) + cross-tab invalidate (BroadcastChannel) for instant updates.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground space-y-2">
                        <div className="flex items-start gap-2">
                            <span className="mt-0.5">•</span>
                            <span>
                                <span className="font-medium text-foreground">Multi-window sync:</span> any call/serve/hold/out triggers a refresh and broadcasts an invalidate to other open tabs.
                            </span>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="mt-0.5">•</span>
                            <span>
                                <span className="font-medium text-foreground">Duplicate queue number fix:</span> queue numbers are generated only by the backend counter (no client-generated numbers), with retry on insert conflicts.
                            </span>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="mt-0.5">•</span>
                            <span>
                                <span className="font-medium text-foreground">Central audio:</span> enable audio only on the dedicated display device. This page prevents duplicate audio on the same browser via an exclusive speaker lock.
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}

function QueueTable({
    rows,
    emptyLabel,
    compact,
}: {
    rows: TicketView[]
    emptyLabel: string
    compact?: boolean
}) {
    return (
        <div className="rounded-lg border">
            <ScrollArea className={cn(compact ? "h-56" : "h-96")}>
                {rows.length ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-20">Queue</TableHead>
                                <TableHead>Participant</TableHead>
                                <TableHead className="hidden md:table-cell">Department</TableHead>
                                <TableHead className="hidden lg:table-cell">Window</TableHead>
                                <TableHead className="text-right">Since</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((t) => {
                                const name = t.participant?.name || "Unknown"
                                const dept = t.department?.name || "Department"
                                const winLabel = t.window?.number ? `#${t.window.number}` : "—"

                                return (
                                    <TableRow key={t.id}>
                                        <TableCell className="font-semibold">#{t.queueNumber}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{name}</span>
                                                <span className="text-xs text-muted-foreground">{t.participant.studentId}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary">{dept}</Badge>
                                                {t.department?.code ? (
                                                    <span className="text-xs text-muted-foreground">{t.department.code}</span>
                                                ) : null}
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden lg:table-cell">
                                            <Badge variant="secondary">{winLabel}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {formatSince(t.waitingSince)}
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                ) : (
                    <div className="p-6 text-sm text-muted-foreground">{emptyLabel}</div>
                )}
            </ScrollArea>
        </div>
    )
}