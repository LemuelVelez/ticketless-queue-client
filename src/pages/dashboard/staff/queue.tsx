/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import {
    Ticket,
    Megaphone,
    CheckCircle2,
    PauseCircle,
    Undo2,
    ListOrdered,
    PauseOctagon,
    XCircle,
    History,
    Volume2,
    MoreHorizontal,
    RefreshCw,
} from "lucide-react"

import { api } from "@/lib/http"
import { DashboardLayout } from "@/components/dashboard-layout"
import { STAFF_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"

import { useSession } from "@/hooks/use-session"
import { staffApi, type Ticket as LegacyTicket } from "@/api/staff"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type TicketStatus = "WAITING" | "CALLED" | "HOLD" | "OUT" | "SERVED"
type TicketParticipantType = "STUDENT" | "ALUMNI_VISITOR" | "GUEST" | string

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
    [key: string]: any
}

/**
 * ✅ TicketLike now supports BOTH shapes:
 * - centralized TicketView (department is an object)
 * - legacy Ticket (department is string)
 */
type TicketLike = TicketView | Partial<LegacyTicket>

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

type DuplicateActivePair = {
    departmentName: string
    departmentCode?: string
    queueNumber: number
    count: number
}

const POLL_MS = 2500 // ✅ 2.5s loop
const LEADER_TTL_MS = 10_000

const QUEUE_POLL_LEADER_KEY = "queuepass:staff:queue_poll_leader_v1"
const QUEUE_SYNC_CHANNEL = "queuepass:staff:queue_state_sync_v1"
const QUEUE_SYNC_SNAPSHOT_KEY = "queuepass:staff:queue_state_snapshot_v1"

function fmtTime(v?: string | null) {
    if (!v) return "—"
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleString()
}

function shortTime(v?: string | null) {
    if (!v) return "—"
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function statusBadge(status?: string) {
    const s = String(status || "").toUpperCase()
    if (s === "CALLED") return <Badge>CALLED</Badge>
    if (s === "WAITING") return <Badge variant="secondary">WAITING</Badge>
    if (s === "HOLD") return <Badge variant="secondary">HOLD</Badge>
    if (s === "OUT") return <Badge variant="destructive">OUT</Badge>
    if (s === "SERVED") return <Badge variant="default">SERVED</Badge>
    return <Badge variant="secondary">{s || "—"}</Badge>
}

function humanizeTransactionKey(value?: string | null) {
    const s = String(value ?? "").trim()
    if (!s) return ""
    return s
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase()
        .replace(/\b\w/g, (m) => m.toUpperCase())
}

function normalizeParticipantTypeKey(value?: string | null) {
    const raw = String(value ?? "").trim()
    if (!raw) return ""

    const normalized = raw.toUpperCase().replace(/[\s/-]+/g, "_")

    if (normalized === "STUDENT") return "STUDENT"
    if (normalized === "GUEST") return "GUEST"
    if (normalized === "ALUMNI_VISITOR" || normalized === "ALUMNI" || normalized === "VISITOR") {
        return "ALUMNI_VISITOR"
    }

    return normalized
}

function participantText(value?: string | null) {
    const s = normalizeParticipantTypeKey(value)
    if (!s) return "—"
    if (s === "STUDENT") return "Student"
    if (s === "ALUMNI_VISITOR") return "Alumni / Visitor"
    if (s === "GUEST") return "Guest"
    return humanizeTransactionKey(s) || s
}

function participantTypeBadge(value?: string | null) {
    const s = normalizeParticipantTypeKey(value)

    if (!s) return <Badge variant="secondary">—</Badge>
    if (s === "STUDENT") return <Badge>Student</Badge>
    if (s === "ALUMNI_VISITOR") return <Badge variant="secondary">Alumni / Visitor</Badge>
    if (s === "GUEST") return <Badge variant="outline">Guest</Badge>

    return <Badge variant="outline">{participantText(s)}</Badge>
}

function extractStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value.map((v) => String(v ?? "").trim()).filter(Boolean)
}

function firstNonEmptyText(candidates: unknown[]) {
    for (const candidate of candidates) {
        const text = String(candidate ?? "").trim()
        if (text) return text
    }
    return ""
}

function composeName(parts: unknown[]) {
    const s = parts
        .map((p) => String(p ?? "").trim())
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
    return s
}

function getTicketId(ticket: TicketLike): string {
    const t = ticket as any
    return String(t?.id ?? t?._id ?? "").trim()
}

function getDepartmentMeta(ticket: TicketLike) {
    const t = ticket as any
    const depObj = t?.department && typeof t.department === "object" ? t.department : null

    const id = String(depObj?.id ?? t?.departmentId ?? t?.department ?? "").trim()
    const name = String(depObj?.name ?? t?.departmentName ?? "").trim()
    const code = String(depObj?.code ?? t?.departmentCode ?? "").trim()
    const transactionManager = String(depObj?.transactionManager ?? t?.transactionManager ?? "").trim()

    return {
        id,
        name: name || "Department",
        code: code || undefined,
        transactionManager,
    }
}

function getWindowMeta(ticket: TicketLike) {
    const t = ticket as any
    const winObj = t?.window && typeof t.window === "object" ? t.window : null
    const number = Number(winObj?.number ?? t?.windowNumber ?? 0)
    const name = String(winObj?.name ?? t?.windowName ?? "").trim()
    const id = String(winObj?.id ?? t?.windowId ?? t?.window ?? "").trim()

    return {
        id,
        name: name || (number ? `Window ${number}` : "Window"),
        number: Number.isFinite(number) ? number : 0,
    }
}

function getParticipantName(ticket: TicketLike): string {
    const t = ticket as any

    // ✅ Prefer full name fields first (names > IDs)
    const name = firstNonEmptyText([
        t?.participant?.fullName,
        t?.participant?.name,
        t?.participantName,
        t?.__participantName,
        t?.user?.name,
        t?.name,
        t?.meta?.participantName,
    ])
    if (name) return name

    // ✅ Try composing from possible parts (if backend sends structured fields)
    const composed = composeName([
        t?.participant?.firstName,
        t?.participant?.middleName,
        t?.participant?.lastName,
        t?.user?.firstName,
        t?.user?.middleName,
        t?.user?.lastName,
        t?.firstName,
        t?.middleName,
        t?.lastName,
    ])
    return composed || ""
}

function getParticipantType(ticket: TicketLike): string {
    const t = ticket as any
    const type = firstNonEmptyText([
        t?.participant?.type,
        t?.participantType,
        t?.participantLabel,
        t?.participantTypeLabel,
        t?.transactions?.participantType,
        t?.transactions?.participantTypeLabel,
        t?.meta?.participantType,
        t?.meta?.participantLabel,
        t?.userType,
        t?.role,
    ])
    return type || ""
}

function getStudentId(ticket: TicketLike): string {
    const t = ticket as any
    return String(t?.participant?.studentId ?? t?.studentId ?? t?.tcNumber ?? "").trim()
}

function ticketPurpose(ticket?: TicketLike | null) {
    if (!ticket) return "—"
    const t = ticket as any

    // Centralized TicketView path
    const fromView = firstNonEmptyText([t?.transaction?.purpose, t?.transaction?.label, t?.transaction?.category])
    if (fromView) return fromView

    // 1) Array label candidates
    const arrayLabelCandidates = [
        t.transactionLabels,
        t.selectedTransactionLabels,
        t.meta?.transactionLabels,
        t.transactions?.transactionLabels,
        t.transactions?.labels,
        t.selection?.transactionLabels,
        t.join?.transactionLabels,
    ]
    for (const candidate of arrayLabelCandidates) {
        const labels = extractStringArray(candidate)
        if (labels.length) return labels.join(" • ")
    }

    // 2) Array-of-object candidates
    const objectArrayCandidates = [t.selectedTransactions, t.transactionSelections, t.transactions?.items, t.transactions?.selected]
    for (const candidate of objectArrayCandidates) {
        if (!Array.isArray(candidate)) continue
        const labels = candidate
            .map((item: any) => String(item?.label ?? item?.name ?? item?.title ?? item?.transactionLabel ?? "").trim())
            .filter(Boolean)
        if (labels.length) return labels.join(" • ")
    }

    // 3) Direct string candidates
    const direct = firstNonEmptyText([
        t.queuePurpose,
        t.purpose,
        t.transactionLabel,
        t.transaction?.label,
        t.transactionName,
        t.transactionTitle,
        t.meta?.purpose,
        t.meta?.transactionLabel,
        t.transactionCategory,
        t.meta?.transactionCategory,
    ])
    if (direct) return direct

    // 4) Key arrays -> humanized labels
    const keyArrayCandidates = [
        t.transactionKeys,
        t.selectedTransactionKeys,
        t.meta?.transactionKeys,
        t.transactions?.transactionKeys,
        t.selection?.transactionKeys,
    ]
    for (const candidate of keyArrayCandidates) {
        const keys = extractStringArray(candidate)
            .map((k) => humanizeTransactionKey(k))
            .filter(Boolean)
        if (keys.length) return keys.join(" • ")
    }

    // 5) Single key fallback
    const key = firstNonEmptyText([t.transactionKey, t.transaction?.key, t.meta?.transactionKey, t.transactionCode])
    if (key) return humanizeTransactionKey(key)

    return "—"
}

function historyWhen(t: TicketLike) {
    const x = t as any
    const s = String(x?.status || "").toUpperCase()
    if (s === "SERVED") return fmtTime(x?.servedAt)
    if (s === "OUT") return fmtTime(x?.outAt)
    if (s === "CALLED") return fmtTime(x?.calledAt)
    return fmtTime(x?.updatedAt)
}

function isSpeechSupported() {
    return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window
}

function EmptyStateCard({ message }: { message: string }) {
    return (
        <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">{message}</CardContent>
        </Card>
    )
}

function TableShell({ children }: { children: React.ReactNode }) {
    return (
        <Card className="overflow-hidden">
            <CardContent className="p-0">
                <div className="overflow-x-auto">{children}</div>
            </CardContent>
        </Card>
    )
}

function QueueStatCard({ label, value }: { label: string; value: number }) {
    return (
        <Card>
            <CardContent className="flex items-center justify-between py-3">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-lg font-semibold tabular-nums">{value}</span>
            </CardContent>
        </Card>
    )
}

function safeErrorMessage(err: any, fallback: string) {
    return err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || fallback
}

/**
 * Unwraps:
 * 1) axios response -> response.data
 * 2) QueueManagementController envelope -> { ok:true, data: T } -> T
 * 3) other payloads -> as-is
 */
function unwrapPayload<T>(value: any): T {
    let v = value
    if (v && typeof v === "object" && "data" in v) v = (v as any).data
    if (v && typeof v === "object" && "ok" in v && "data" in v) v = (v as any).data
    return v as T
}

function pad3(n: number) {
    const s = String(Math.max(0, Math.floor(n)))
    return s.length >= 3 ? s : s.padStart(3, "0")
}

function ticketKey(t: TicketLike) {
    const id = getTicketId(t)
    if (id) return id
    const dep = getDepartmentMeta(t)
    const qn = Number((t as any)?.queueNumber ?? 0)
    return `${dep.id || "dep"}:${String(qn)}`
}

function TicketNumberPill({ ticket }: { ticket: TicketLike }) {
    const dep = getDepartmentMeta(ticket)
    const qn = Number((ticket as any)?.queueNumber ?? 0)
    const label = dep.code ? `${dep.code}-${pad3(qn)}` : `#${qn}`

    return (
        <div className="flex items-center gap-2">
            <span className="font-medium tabular-nums">{label}</span>
            <Badge variant="secondary" className="max-w-full whitespace-normal wrap-break-word">
                {dep.code || dep.name}
            </Badge>
        </div>
    )
}

function ParticipantCell({ ticket }: { ticket: TicketLike }) {
    const name = getParticipantName(ticket)
    const type = getParticipantType(ticket)
    const sid = getStudentId(ticket)

    return (
        <div className="min-w-0">
            {/* ✅ show full name (no forced truncate) */}
            <div className="font-medium whitespace-normal wrap-break-word leading-snug">{name || "—"}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
                {participantTypeBadge(type || "")}
                <span className="text-xs text-muted-foreground">
                    Student ID: <span className="tabular-nums">{sid || "—"}</span>
                </span>
            </div>
        </div>
    )
}

function canUseBroadcastChannel() {
    return typeof window !== "undefined" && typeof (window as any).BroadcastChannel !== "undefined"
}

function formatSeconds(ms: number) {
    const s = Math.max(0, ms) / 1000
    return s.toFixed(1)
}

export default function StaffQueuePage() {
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

    const [bootLoading, setBootLoading] = React.useState(true)
    const [busy, setBusy] = React.useState(false)

    const [departmentId, setDepartmentId] = React.useState<string | null>(null)
    const [departmentNames, setDepartmentNames] = React.useState<string[]>([])
    const [windowInfo, setWindowInfo] = React.useState<{ id: string; name: string; number: number } | null>(null)

    const [queueState, setQueueState] = React.useState<StaffQueueState | null>(null)
    const [stateLoading, setStateLoading] = React.useState(false)

    // ✅ Auto-refresh (AJAX polling every 2.5 seconds)
    const [liveSync, setLiveSync] = React.useState(true)

    // ✅ Cross-tab sync: one tab polls (leader), all open windows receive updates
    const [isQueueLeader, setIsQueueLeader] = React.useState(false)
    const lastAppliedStateTsRef = React.useRef<number>(0)
    const lastToastSyncErrorAtRef = React.useRef<number>(0)
    const bcRef = React.useRef<BroadcastChannel | null>(null)
    const [lastSyncedAtIso, setLastSyncedAtIso] = React.useState<string>("")

    // ✅ 2.5s countdown loop (visual + numeric)
    const nextRefreshAtRef = React.useRef<number>(0)
    const [refreshRemainingMs, setRefreshRemainingMs] = React.useState<number>(0)

    const scheduleNextRefresh = React.useCallback((baseTs?: number) => {
        if (typeof window === "undefined") return
        const base = typeof baseTs === "number" && Number.isFinite(baseTs) ? baseTs : Date.now()
        nextRefreshAtRef.current = base + POLL_MS
    }, [])

    const [out, setOut] = React.useState<TicketLike[]>([])
    const [history, setHistory] = React.useState<TicketLike[]>([])
    const [historyMine, setHistoryMine] = React.useState(false)

    const assignedOk = Boolean(windowInfo?.id)

    const departmentDisplay = React.useMemo(() => {
        if (departmentNames.length) return departmentNames.join(", ")
        return departmentId ?? "—"
    }, [departmentId, departmentNames])

    // -------- Voice announcement (Web Speech API) --------
    const [voiceEnabled, setVoiceEnabled] = React.useState(true)
    const [voiceSupported, setVoiceSupported] = React.useState(true)
    const voicesRef = React.useRef<SpeechSynthesisVoice[]>([])
    const voiceWarnedRef = React.useRef(false)

    // ✅ Centralized Audio Trigger (single shared announcer per device via leader election)
    const [centralAudio, setCentralAudio] = React.useState(true)
    const [isAudioLeader, setIsAudioLeader] = React.useState(false)

    const tabIdRef = React.useRef<string>("")
    if (!tabIdRef.current) {
        try {
            tabIdRef.current =
                typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `tab_${Date.now()}_${Math.random()}`
        } catch {
            tabIdRef.current = `tab_${Date.now()}_${Math.random()}`
        }
    }

    const lastAnnouncedTicketIdsRef = React.useRef<Set<string>>(new Set())
    const lastAnnouncedQueueRef = React.useRef<number | null>(null)
    const duplicateWarnedRef = React.useRef(false)

    React.useEffect(() => {
        const supported = isSpeechSupported()
        setVoiceSupported(supported)
        if (!supported) {
            setVoiceEnabled(false)
            return
        }

        const synth = window.speechSynthesis
        const loadVoices = () => {
            try {
                const v = synth.getVoices?.() ?? []
                if (v.length) voicesRef.current = v
            } catch {
                // ignore
            }
        }

        loadVoices()
        try {
            synth.addEventListener("voiceschanged", loadVoices)
        } catch {
            // ignore
        }

        return () => {
            try {
                synth.removeEventListener("voiceschanged", loadVoices)
            } catch {
                // ignore
            }
        }
    }, [])

    const speak = React.useCallback((text: string) => {
        if (typeof window === "undefined") return
        if (!isSpeechSupported()) return

        try {
            const synth = window.speechSynthesis
            try {
                synth.resume()
            } catch {
                // ignore
            }

            const u = new SpeechSynthesisUtterance(text)
            u.lang = "en-US"
            u.rate = 1
            u.pitch = 1
            u.volume = 1

            const voices = voicesRef.current?.length ? voicesRef.current : synth.getVoices?.() ?? []
            const preferred =
                voices.find((v) => v.lang?.toLowerCase().startsWith("en-ph")) ||
                voices.find((v) => v.lang?.toLowerCase().startsWith("en")) ||
                voices[0]

            if (preferred) u.voice = preferred
            synth.speak(u)
        } catch {
            // ignore
        }
    }, [])

    const announceTicket = React.useCallback(
        (ticket: TicketLike) => {
            const qn = Number((ticket as any)?.queueNumber ?? 0)
            if (!qn) return

            lastAnnouncedQueueRef.current = qn

            if (!voiceEnabled) return
            if (!voiceSupported) {
                if (!voiceWarnedRef.current) {
                    voiceWarnedRef.current = true
                    toast.message("Voice announcement is not supported in this browser.")
                }
                return
            }

            const dep = getDepartmentMeta(ticket)
            const win = getWindowMeta(ticket)
            const participantName = getParticipantName(ticket)

            const parts = [
                `Queue number ${qn}.`,
                dep?.name ? `For ${dep.name}.` : "",
                win?.number ? `Please proceed to window ${win.number}.` : "",
                participantName ? `Participant ${participantName}.` : "",
            ]
                .map((s) => String(s).trim())
                .filter(Boolean)

            speak(parts.join(" "))
        },
        [speak, voiceEnabled, voiceSupported],
    )

    const onRecallVoice = React.useCallback(() => {
        const n = (queueState?.nowServing?.queueNumber ?? lastAnnouncedQueueRef.current) || 0
        if (!n) return toast.message("No ticket to announce.")
        announceTicket({
            queueNumber: n,
            window:
                queueState?.nowServing?.window ??
                (windowInfo ? { number: windowInfo.number, name: windowInfo.name, id: windowInfo.id } : undefined),
            department: (queueState?.nowServing as any)?.department,
            participant: (queueState?.nowServing as any)?.participant,
        } as any)
    }, [announceTicket, queueState?.nowServing, windowInfo])

    // -------- Central Audio Leader Election (per device) --------
    const AUDIO_LEADER_KEY = "queuepass:staff:audio_leader_v1"
    const claimAudioLeadership = React.useCallback(() => {
        try {
            const payload = { id: tabIdRef.current, ts: Date.now() }
            localStorage.setItem(AUDIO_LEADER_KEY, JSON.stringify(payload))
            setIsAudioLeader(true)
        } catch {
            // ignore
        }
    }, [])

    React.useEffect(() => {
        if (typeof window === "undefined") return
        if (!centralAudio) {
            setIsAudioLeader(false)
            return
        }

        const tick = () => {
            try {
                const raw = localStorage.getItem(AUDIO_LEADER_KEY)
                const now = Date.now()
                const parsed = raw ? (JSON.parse(raw) as { id?: string; ts?: number }) : null

                const leaderId = String(parsed?.id ?? "")
                const leaderTs = Number(parsed?.ts ?? 0)
                const expired = !leaderId || !Number.isFinite(leaderTs) || now - leaderTs > LEADER_TTL_MS

                if (expired || leaderId === tabIdRef.current) {
                    localStorage.setItem(AUDIO_LEADER_KEY, JSON.stringify({ id: tabIdRef.current, ts: now }))
                    setIsAudioLeader(true)
                } else {
                    setIsAudioLeader(false)
                }
            } catch {
                // If storage is blocked, fall back to "single tab" behavior
                setIsAudioLeader(true)
            }
        }

        tick()
        const iv = window.setInterval(tick, 3000)
        return () => window.clearInterval(iv)
    }, [centralAudio])

    // -------- Unified (centralized) refresh --------
    const fetchAssignment = React.useCallback(async () => {
        const a = await staffApi.myAssignment()

        const names = (a.assignedDepartments?.length ? a.assignedDepartments : a.handledDepartments ?? [])
            .map((d) => String(d?.name ?? "").trim())
            .filter(Boolean)

        setDepartmentNames(names)

        const firstAssignedDepartmentId: string | null = Array.isArray(a.assignedDepartmentIds) ? a.assignedDepartmentIds[0] ?? null : null
        const firstHandledDepartmentId: string | null = Array.isArray(a.handledDepartmentIds) ? a.handledDepartmentIds[0] ?? null : null

        const resolvedDepartmentId: string | null = (a as any).departmentId ?? firstAssignedDepartmentId ?? firstHandledDepartmentId ?? null

        setDepartmentId(resolvedDepartmentId)
        setWindowInfo(
            a.window ? { id: String((a.window as any)._id ?? a.window.id), name: a.window.name, number: a.window.number } : null,
        )

        return { windowId: a.window ? String((a.window as any)._id ?? a.window.id ?? "").trim() : "" }
    }, [])

    const broadcastQueueState = React.useCallback(
        (payload: { ts: number; windowId: string; state: StaffQueueState }) => {
            if (typeof window === "undefined") return

            // Prefer BroadcastChannel; fallback to localStorage snapshot for cross-tab sync.
            if (canUseBroadcastChannel()) {
                try {
                    bcRef.current?.postMessage({ type: "QUEUE_STATE", ...payload })
                    return
                } catch {
                    // fallback below
                }
            }

            try {
                localStorage.setItem(QUEUE_SYNC_SNAPSHOT_KEY, JSON.stringify({ type: "QUEUE_STATE", ...payload }))
            } catch {
                // ignore
            }
        },
        [],
    )

    const applyRemoteQueueState = React.useCallback(
        (payload: { ts: number; windowId: string; state: StaffQueueState }) => {
            if (!payload?.state) return
            if (!windowInfo?.id) return
            if (payload.windowId !== windowInfo.id) return

            if (payload.ts <= lastAppliedStateTsRef.current) return
            lastAppliedStateTsRef.current = payload.ts

            setQueueState(payload.state)
            setLastSyncedAtIso(new Date(payload.ts).toISOString())
            scheduleNextRefresh(payload.ts)
            setStateLoading(false)
        },
        [scheduleNextRefresh, windowInfo?.id],
    )

    const fetchCentralState = React.useCallback(
        async (opts?: { silent?: boolean; broadcast?: boolean; tickTs?: number }) => {
            if (!windowInfo?.id) {
                setQueueState(null)
                return
            }

            if (!opts?.silent) setStateLoading(true)

            try {
                const raw = await api.get(`/staff/queue/state?windowId=${encodeURIComponent(windowInfo.id)}`)
                const state = unwrapPayload<StaffQueueState>(raw)

                const baseTs = typeof opts?.tickTs === "number" && Number.isFinite(opts.tickTs) ? opts.tickTs : Date.now()

                setQueueState(state)
                setLastSyncedAtIso(new Date(baseTs).toISOString())
                lastAppliedStateTsRef.current = Math.max(lastAppliedStateTsRef.current, baseTs)
                scheduleNextRefresh(baseTs)

                if (opts?.broadcast) {
                    broadcastQueueState({ ts: baseTs, windowId: windowInfo.id, state })
                }

                // Duplicate-active-number detection (quick warning)
                const active = [...(state?.waiting ?? []), ...(state?.hold ?? []), ...(state?.called ?? [])]
                const seen = new Map<string, number>()
                let hasDup = false

                for (const t of active) {
                    const dep = getDepartmentMeta(t)
                    const qn = Number((t as any)?.queueNumber ?? NaN)
                    if (!dep.id || !Number.isFinite(qn)) continue
                    const key = `${dep.id}:${qn}`
                    const count = (seen.get(key) ?? 0) + 1
                    seen.set(key, count)
                    if (count > 1) hasDup = true
                }

                if (hasDup && !duplicateWarnedRef.current) {
                    duplicateWarnedRef.current = true
                    toast.warning("Duplicate active queue numbers detected. Backend constraints may need review.")
                }
                if (!hasDup) duplicateWarnedRef.current = false
            } catch (e: any) {
                const msg = safeErrorMessage(e, "Failed to load centralized queue state.")

                // ✅ Avoid toast spam during 2.5s polling
                if (!opts?.silent) {
                    toast.error(msg)
                } else {
                    const now = Date.now()
                    if (now - lastToastSyncErrorAtRef.current > 15_000) {
                        lastToastSyncErrorAtRef.current = now
                        toast.error(msg)
                    }
                }
            } finally {
                if (!opts?.silent) setStateLoading(false)
            }
        },
        [broadcastQueueState, scheduleNextRefresh, windowInfo?.id],
    )

    const fetchSecondary = React.useCallback(async () => {
        if (!windowInfo?.id) {
            setOut([])
            setHistory([])
            return
        }

        try {
            const [o, his] = await Promise.all([
                staffApi.listOut({ limit: 25 }).catch(() => ({ tickets: [] as any[] })),
                staffApi.listHistory({ limit: 25, mine: historyMine }).catch(() => ({ tickets: [] as any[] })),
            ])

            setOut(((o as any).tickets ?? []) as TicketLike[])
            setHistory(((his as any).tickets ?? []) as TicketLike[])
        } catch {
            // non-critical
        }
    }, [historyMine, windowInfo?.id])

    const refreshAll = React.useCallback(async () => {
        setBootLoading(true)
        try {
            await fetchAssignment()
        } catch (e: any) {
            toast.error(safeErrorMessage(e, "Failed to load staff assignment."))
        } finally {
            setBootLoading(false)
        }
    }, [fetchAssignment])

    React.useEffect(() => {
        void refreshAll()
    }, [refreshAll])

    React.useEffect(() => {
        if (!windowInfo?.id) {
            setQueueState(null)
            setOut([])
            setHistory([])
            return
        }
        scheduleNextRefresh(Date.now())
        void fetchCentralState({ broadcast: true, tickTs: Date.now() })
        void fetchSecondary()
    }, [scheduleNextRefresh, windowInfo?.id, fetchCentralState, fetchSecondary])

    // ✅ Countdown loop updater (smooth)
    React.useEffect(() => {
        if (typeof window === "undefined") return
        if (!liveSync || !assignedOk) {
            nextRefreshAtRef.current = 0
            setRefreshRemainingMs(0)
            return
        }

        if (!nextRefreshAtRef.current) scheduleNextRefresh(Date.now())

        const iv = window.setInterval(() => {
            const target = nextRefreshAtRef.current || Date.now() + POLL_MS
            const remaining = Math.max(0, target - Date.now())
            setRefreshRemainingMs(remaining)
        }, 100)

        return () => window.clearInterval(iv)
    }, [assignedOk, liveSync, scheduleNextRefresh])

    // ✅ Cross-tab receive: BroadcastChannel + localStorage fallback
    React.useEffect(() => {
        if (typeof window === "undefined") return

        // BroadcastChannel
        if (canUseBroadcastChannel()) {
            try {
                const bc = new BroadcastChannel(QUEUE_SYNC_CHANNEL)
                bcRef.current = bc
                bc.onmessage = (ev) => {
                    const data = ev?.data
                    if (!data || typeof data !== "object") return
                    if (data.type !== "QUEUE_STATE") return
                    applyRemoteQueueState({
                        ts: Number((data as any).ts ?? 0),
                        windowId: String((data as any).windowId ?? ""),
                        state: (data as any).state as StaffQueueState,
                    })
                }
                return () => {
                    try {
                        bc.close()
                    } catch {
                        // ignore
                    }
                    bcRef.current = null
                }
            } catch {
                // fall through to storage listener only
            }
        }

        // localStorage snapshot listener (fallback)
        const onStorage = (e: StorageEvent) => {
            if (e.key !== QUEUE_SYNC_SNAPSHOT_KEY) return
            if (!e.newValue) return
            try {
                const parsed = JSON.parse(e.newValue) as any
                if (parsed?.type !== "QUEUE_STATE") return
                applyRemoteQueueState({
                    ts: Number(parsed.ts ?? 0),
                    windowId: String(parsed.windowId ?? ""),
                    state: parsed.state as StaffQueueState,
                })
            } catch {
                // ignore
            }
        }

        window.addEventListener("storage", onStorage)
        return () => window.removeEventListener("storage", onStorage)
    }, [applyRemoteQueueState])

    // ✅ Queue poll leader election (one tab polls, all tabs stay in sync)
    const claimQueueLeadership = React.useCallback(() => {
        try {
            localStorage.setItem(QUEUE_POLL_LEADER_KEY, JSON.stringify({ id: tabIdRef.current, ts: Date.now() }))
            setIsQueueLeader(true)
        } catch {
            // If blocked, allow polling in this tab
            setIsQueueLeader(true)
        }
    }, [])

    React.useEffect(() => {
        if (typeof window === "undefined") return
        if (!liveSync) {
            setIsQueueLeader(false)
            return
        }
        if (!windowInfo?.id) {
            setIsQueueLeader(false)
            return
        }

        const tick = () => {
            try {
                const raw = localStorage.getItem(QUEUE_POLL_LEADER_KEY)
                const now = Date.now()
                const parsed = raw ? (JSON.parse(raw) as { id?: string; ts?: number }) : null

                const leaderId = String(parsed?.id ?? "")
                const leaderTs = Number(parsed?.ts ?? 0)
                const expired = !leaderId || !Number.isFinite(leaderTs) || now - leaderTs > LEADER_TTL_MS

                if (expired || leaderId === tabIdRef.current) {
                    localStorage.setItem(QUEUE_POLL_LEADER_KEY, JSON.stringify({ id: tabIdRef.current, ts: now }))
                    setIsQueueLeader(true)
                } else {
                    setIsQueueLeader(false)
                }
            } catch {
                setIsQueueLeader(true)
            }
        }

        tick()
        const iv = window.setInterval(tick, 3000)
        return () => window.clearInterval(iv)
    }, [liveSync, windowInfo?.id])

    // ✅ Leader polling: every 2.5 seconds; broadcasts state to all tabs/windows
    React.useEffect(() => {
        if (!liveSync) return
        if (!windowInfo?.id) return
        if (!isQueueLeader) return
        if (typeof window === "undefined") return

        const iv = window.setInterval(() => {
            const tickTs = Date.now()
            scheduleNextRefresh(tickTs)
            void fetchCentralState({ silent: true, broadcast: true, tickTs })
        }, POLL_MS)

        return () => window.clearInterval(iv)
    }, [fetchCentralState, isQueueLeader, liveSync, scheduleNextRefresh, windowInfo?.id])

    // Secondary refresh can be less frequent; no need to spam server
    React.useEffect(() => {
        if (!liveSync) return
        if (!windowInfo?.id) return
        if (typeof window === "undefined") return

        const secondaryIv = window.setInterval(() => {
            void fetchSecondary()
        }, 8000)

        return () => window.clearInterval(secondaryIv)
    }, [fetchSecondary, liveSync, windowInfo?.id])

    React.useEffect(() => {
        if (!centralAudio) return
        if (!isAudioLeader) return
        if (!voiceEnabled || !voiceSupported) return

        const called = queueState?.called ?? []
        if (!called.length) return

        const announced = lastAnnouncedTicketIdsRef.current
        const newlyCalled = called
            .slice()
            .sort((a, b) => {
                const ta = new Date(a.calledAt ?? a.updatedAt ?? a.createdAt ?? 0).getTime()
                const tb = new Date(b.calledAt ?? b.updatedAt ?? b.createdAt ?? 0).getTime()
                return ta - tb
            })
            .filter((t) => !announced.has(String(t.id)))

        if (!newlyCalled.length) return

        for (const t of newlyCalled.slice(-3)) {
            announced.add(String(t.id))
            announceTicket(t)
        }
    }, [announceTicket, centralAudio, isAudioLeader, queueState?.called, voiceEnabled, voiceSupported])

    const current = queueState?.nowServing ?? null
    const waiting = React.useMemo(() => (queueState?.waiting ?? []).slice(), [queueState?.waiting])
    const hold = React.useMemo(() => (queueState?.hold ?? []).slice(), [queueState?.hold])
    const called = React.useMemo(() => (queueState?.called ?? []).slice(), [queueState?.called])

    const nowServingBoard = React.useMemo(() => {
        const map = new Map<number, TicketView>()
        for (const t of called) {
            const win = getWindowMeta(t)
            if (!win.number) continue

            const prev = map.get(win.number)
            if (!prev) {
                map.set(win.number, t)
                continue
            }

            const prevAt = new Date(prev.calledAt ?? prev.updatedAt ?? prev.createdAt ?? 0).getTime()
            const curAt = new Date(t.calledAt ?? t.updatedAt ?? t.createdAt ?? 0).getTime()
            if (curAt > prevAt) map.set(win.number, t)
        }

        return Array.from(map.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([windowNumber, ticket]) => ({ windowNumber, ticket }))
    }, [called])

    // ✅ FIX: standardize the shape to ONE type (DuplicateActivePair) to avoid TS union property errors
    const duplicateActivePairs = React.useMemo<DuplicateActivePair[]>(() => {
        const state = queueState
        if (!state) return []

        const active = [...(state.waiting ?? []), ...(state.hold ?? []), ...(state.called ?? [])]
        const counts = new Map<string, DuplicateActivePair>()

        for (const t of active) {
            const dep = getDepartmentMeta(t)
            const qn = Number((t as any)?.queueNumber ?? NaN)
            if (!dep.id || !Number.isFinite(qn)) continue

            const key = `${dep.id}:${qn}`
            const existing = counts.get(key)

            if (!existing) {
                counts.set(key, {
                    departmentName: dep.name,
                    departmentCode: dep.code,
                    queueNumber: qn,
                    count: 1,
                })
            } else {
                counts.set(key, {
                    ...existing,
                    count: existing.count + 1,
                })
            }
        }

        return Array.from(counts.values()).filter((x) => x.count > 1)
    }, [queueState])

    async function onCallNextCentral() {
        if (!windowInfo?.id) return toast.error("You are not assigned to a service window.")

        setBusy(true)
        try {
            if (centralAudio) claimAudioLeadership()

            const raw = await api.post("/staff/queue/call-next-central", { windowId: windowInfo.id })
            const ticket = unwrapPayload<TicketView | null>(raw)

            if (!ticket) {
                toast.message("No waiting tickets.")
                return
            }

            const dep = getDepartmentMeta(ticket)
            toast.success(`Called ${dep.code ? `${dep.code}-${pad3(ticket.queueNumber)}` : `#${ticket.queueNumber}`}`)

            if (centralAudio) {
                if (isAudioLeader) announceTicket(ticket)
                else toast.message("Call placed. Audio is handled by another active tab/device.")
            } else {
                announceTicket(ticket)
            }

            await fetchCentralState({ broadcast: true, tickTs: Date.now() })
            await fetchSecondary()
        } catch (e: any) {
            toast.error(safeErrorMessage(e, "Failed to call next."))
            await fetchCentralState({ silent: true, broadcast: true, tickTs: Date.now() })
        } finally {
            setBusy(false)
        }
    }

    async function onServeCentral() {
        const ticketId = String(current?.id ?? "").trim()
        if (!ticketId) return

        setBusy(true)
        try {
            const raw = await api.post("/staff/queue/serve", { ticketId })
            const updated = unwrapPayload<TicketView>(raw)
            const dep = getDepartmentMeta(updated)
            toast.success(`Marked ${dep.code ? `${dep.code}-${pad3(updated.queueNumber)}` : `#${updated.queueNumber}`} as served.`)
            await fetchCentralState({ broadcast: true, tickTs: Date.now() })
            await fetchSecondary()
        } catch (e: any) {
            toast.error(safeErrorMessage(e, "Failed to mark served."))
            await fetchCentralState({ silent: true, broadcast: true, tickTs: Date.now() })
        } finally {
            setBusy(false)
        }
    }

    async function onHoldCentral() {
        const ticketId = String(current?.id ?? "").trim()
        if (!ticketId) return

        setBusy(true)
        try {
            const raw = await api.post("/staff/queue/hold", { ticketId })
            const updated = unwrapPayload<TicketView>(raw)
            const dep = getDepartmentMeta(updated)

            if (String(updated.status).toUpperCase() === "OUT") {
                toast.success(`${dep.code ? `${dep.code}-${pad3(updated.queueNumber)}` : `#${updated.queueNumber}`} is OUT.`)
            } else {
                toast.success(`${dep.code ? `${dep.code}-${pad3(updated.queueNumber)}` : `#${updated.queueNumber}`} moved to HOLD.`)
            }

            await fetchCentralState({ broadcast: true, tickTs: Date.now() })
            await fetchSecondary()
        } catch (e: any) {
            toast.error(safeErrorMessage(e, "Failed to hold ticket."))
            await fetchCentralState({ silent: true, broadcast: true, tickTs: Date.now() })
        } finally {
            setBusy(false)
        }
    }

    async function onReturnFromHold(ticketId: string) {
        setBusy(true)
        try {
            const res = await staffApi.returnFromHold(ticketId)
            const qn = Number((res as any)?.ticket?.queueNumber ?? 0)
            toast.success(`Returned ${qn ? `#${qn}` : "ticket"} to WAITING.`)
            await fetchCentralState({ broadcast: true, tickTs: Date.now() })
            await fetchSecondary()
        } catch (e: any) {
            toast.error(safeErrorMessage(e, "Failed to return from HOLD."))
            await fetchCentralState({ silent: true, broadcast: true, tickTs: Date.now() })
        } finally {
            setBusy(false)
        }
    }

    const syncBadgeText = React.useMemo(() => {
        if (!assignedOk) return "Auto-refresh: —"
        if (!liveSync) return "Auto-refresh: OFF"
        return `Auto-refresh: ON (${(POLL_MS / 1000).toFixed(1)}s)`
    }, [assignedOk, liveSync])

    const countdownText = React.useMemo(() => {
        if (!assignedOk) return "Next refresh: —"
        if (!liveSync) return "Next refresh: —"
        return `Next refresh: ${formatSeconds(refreshRemainingMs)}s`
    }, [assignedOk, liveSync, refreshRemainingMs])

    const refreshProgress = React.useMemo(() => {
        if (!assignedOk || !liveSync) return 0
        const elapsed = Math.min(POLL_MS, Math.max(0, POLL_MS - refreshRemainingMs))
        return Math.min(100, Math.max(0, (elapsed / POLL_MS) * 100))
    }, [assignedOk, liveSync, refreshRemainingMs])

    return (
        <DashboardLayout title="Queue" navItems={STAFF_NAV_ITEMS} user={dashboardUser} activePath={location.pathname}>
            <div className="grid w-full min-w-0 grid-cols-1 gap-6">
                <Card className="min-w-0">
                    <CardHeader className="gap-2">
                        <CardTitle className="flex items-center gap-2">
                            <Ticket className="h-5 w-5" />
                            Staff Queue Control Center
                        </CardTitle>
                        <CardDescription>
                            ✅ Centralized, synchronized queue state across all windows. Auto-refresh runs on a 2.5s loop with a live countdown.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="min-w-0">
                        {bootLoading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-28 w-full" />
                                <Skeleton className="h-56 w-full" />
                                <Skeleton className="h-56 w-full" />
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="grid gap-4 xl:grid-cols-12">
                                    <Card className="xl:col-span-8">
                                        <CardHeader className="flex flex-row items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <CardTitle className="text-base">Queue Commands</CardTitle>
                                                <CardDescription>
                                                    Centralized actions + real-time state. Updates sync across all open staff windows automatically.
                                                </CardDescription>
                                            </div>

                                            {/* ✅ Optional actions tucked away (no manual refresh needed) */}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" size="icon" className="shrink-0" aria-label="Queue options">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-56">
                                                    <DropdownMenuLabel>Queue options</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            const ts = Date.now()
                                                            toast.message("Syncing now…")
                                                            scheduleNextRefresh(ts)
                                                            void fetchCentralState({ broadcast: true, tickTs: ts })
                                                            void fetchSecondary()
                                                        }}
                                                    >
                                                        <RefreshCw className="mr-2 h-4 w-4" />
                                                        Sync now
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            toast.message("Re-checking assignment…")
                                                            void refreshAll()
                                                        }}
                                                    >
                                                        Re-check assignment
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            const next = !liveSync
                                                            setLiveSync(next)
                                                            toast.message(next ? "Auto-refresh enabled." : "Auto-refresh paused.")
                                                            if (next) {
                                                                claimQueueLeadership()
                                                                scheduleNextRefresh(Date.now())
                                                                void fetchCentralState({ broadcast: true, tickTs: Date.now() })
                                                            }
                                                        }}
                                                    >
                                                        {liveSync ? "Pause auto-refresh" : "Resume auto-refresh"}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </CardHeader>

                                        <CardContent className="space-y-4">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant="secondary" className="max-w-full whitespace-normal wrap-break-word">
                                                    Departments: {departmentDisplay}
                                                </Badge>
                                                <Badge variant="secondary">
                                                    Window: {windowInfo ? `${windowInfo.name} (#${windowInfo.number})` : "—"}
                                                </Badge>

                                                {!assignedOk ? <Badge variant="destructive">Not assigned</Badge> : null}

                                                <Badge variant={liveSync ? "default" : "secondary"}>{syncBadgeText}</Badge>

                                                <Badge variant="secondary">{countdownText}</Badge>

                                                <Badge variant="secondary">
                                                    Server: {queueState?.serverTime ? shortTime(queueState.serverTime) : "—"}
                                                </Badge>

                                                {lastSyncedAtIso ? (
                                                    <Badge variant="secondary">Last sync: {shortTime(lastSyncedAtIso)}</Badge>
                                                ) : null}

                                                {stateLoading ? <Badge variant="secondary">Syncing…</Badge> : null}

                                                {liveSync && assignedOk ? (
                                                    <Badge variant={isQueueLeader ? "default" : "secondary"}>
                                                        Sync leader: {isQueueLeader ? "YES" : "NO"}
                                                    </Badge>
                                                ) : null}

                                                {!voiceSupported ? <Badge variant="secondary">Voice unsupported</Badge> : null}
                                                {centralAudio ? (
                                                    <Badge variant={isAudioLeader ? "default" : "secondary"}>
                                                        Audio leader: {isAudioLeader ? "YES" : "NO"}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary">Central audio: OFF</Badge>
                                                )}
                                            </div>

                                            {/* ✅ 2.5s loop progress bar (smooth visual countdown) */}
                                            {assignedOk && liveSync ? (
                                                <div className="space-y-2">
                                                    <Progress value={refreshProgress} className="h-2" />
                                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                        <span className="tabular-nums">Loop: {(POLL_MS / 1000).toFixed(1)}s</span>
                                                        <span className="tabular-nums">Remaining: {formatSeconds(refreshRemainingMs)}s</span>
                                                    </div>
                                                </div>
                                            ) : null}

                                            {duplicateActivePairs.length ? (
                                                <Card className="border-destructive/40 bg-destructive/5">
                                                    <CardContent className="py-3">
                                                        <div className="min-w-0">
                                                            <div className="font-medium">Duplicate active queue numbers detected</div>
                                                            <div className="text-sm text-muted-foreground">
                                                                This should not happen. The dashboard auto-syncs; if it persists, check backend queue counter constraints.
                                                            </div>
                                                            <div className="mt-2 flex flex-wrap gap-2">
                                                                {duplicateActivePairs.slice(0, 6).map((d) => (
                                                                    <Badge key={`${d.departmentName}:${d.queueNumber}`} variant="destructive">
                                                                        {(d.departmentCode || d.departmentName) + ` #${d.queueNumber} (${d.count}x)`}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ) : null}

                                            <Separator />

                                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                                <Button
                                                    onClick={() => void onCallNextCentral()}
                                                    disabled={busy || !assignedOk}
                                                    className="w-full gap-2 sm:w-auto"
                                                >
                                                    <Megaphone className="h-4 w-4" />
                                                    Next queue (central)
                                                </Button>

                                                <Button
                                                    variant="outline"
                                                    onClick={() => onRecallVoice()}
                                                    disabled={
                                                        busy ||
                                                        !assignedOk ||
                                                        !voiceEnabled ||
                                                        !voiceSupported ||
                                                        (!current?.queueNumber && !lastAnnouncedQueueRef.current)
                                                    }
                                                    className="w-full gap-2 sm:w-auto"
                                                >
                                                    <Volume2 className="h-4 w-4" />
                                                    Recall voice
                                                </Button>

                                                <div className="grid w-full gap-2 sm:ml-auto sm:w-auto sm:grid-cols-3">
                                                    <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 sm:justify-start">
                                                        <Switch
                                                            id="liveSync"
                                                            checked={liveSync}
                                                            onCheckedChange={(v) => {
                                                                const next = Boolean(v)
                                                                setLiveSync(next)
                                                                toast.message(next ? "Auto-refresh enabled." : "Auto-refresh paused.")
                                                                if (next) {
                                                                    claimQueueLeadership()
                                                                    scheduleNextRefresh(Date.now())
                                                                    void fetchCentralState({ broadcast: true, tickTs: Date.now() })
                                                                }
                                                            }}
                                                            disabled={!assignedOk}
                                                        />
                                                        <Label htmlFor="liveSync" className="text-sm">
                                                            Auto-refresh
                                                        </Label>
                                                    </div>

                                                    <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 sm:justify-start">
                                                        <Switch
                                                            id="voiceEnabled"
                                                            checked={voiceEnabled}
                                                            onCheckedChange={(v) => setVoiceEnabled(Boolean(v))}
                                                            disabled={busy || !voiceSupported}
                                                        />
                                                        <Label htmlFor="voiceEnabled" className="text-sm">
                                                            Voice
                                                        </Label>
                                                    </div>

                                                    <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 sm:justify-start">
                                                        <Switch
                                                            id="centralAudio"
                                                            checked={centralAudio}
                                                            onCheckedChange={(v) => {
                                                                const next = Boolean(v)
                                                                setCentralAudio(next)
                                                                if (next) claimAudioLeadership()
                                                            }}
                                                            disabled={busy || !voiceSupported}
                                                        />
                                                        <Label htmlFor="centralAudio" className="text-sm">
                                                            Central audio
                                                        </Label>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="xl:col-span-4">
                                        <CardHeader>
                                            <CardTitle className="text-base">Queue Snapshot</CardTitle>
                                            <CardDescription>Unified live counters (same across all staff windows).</CardDescription>
                                        </CardHeader>
                                        <CardContent className="grid grid-cols-2 gap-3">
                                            <QueueStatCard label="Waiting" value={waiting.length} />
                                            <QueueStatCard label="Hold" value={hold.length} />
                                            <QueueStatCard label="Called" value={called.length} />
                                            <QueueStatCard label="History" value={history.length} />
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Now Serving Board */}
                                <Card className="min-w-0">
                                    <CardHeader>
                                        <CardTitle className="text-base">Now Serving Board (All Windows)</CardTitle>
                                        <CardDescription>
                                            Live, centralized view of what each window is currently serving (synchronized everywhere).
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {nowServingBoard.length === 0 ? (
                                            <EmptyStateCard message="No windows are currently serving a ticket." />
                                        ) : (
                                            <TableShell>
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="w-24">Window</TableHead>
                                                            <TableHead className="w-44">Now serving</TableHead>
                                                            <TableHead className="min-w-55">Department</TableHead>
                                                            <TableHead>Student</TableHead>
                                                            <TableHead className="hidden md:table-cell">Called at</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {nowServingBoard.map(({ windowNumber, ticket }) => {
                                                            const isMine = Number(windowInfo?.number ?? 0) === windowNumber
                                                            const dep = getDepartmentMeta(ticket)
                                                            const qLabel = dep.code ? `${dep.code}-${pad3(ticket.queueNumber)}` : `#${ticket.queueNumber}`

                                                            return (
                                                                <TableRow key={`${windowNumber}:${ticket.id}`} className={isMine ? "bg-muted/50" : ""}>
                                                                    <TableCell className="font-medium">#{windowNumber}</TableCell>
                                                                    <TableCell className="font-medium tabular-nums">{qLabel}</TableCell>
                                                                    <TableCell className="text-muted-foreground">
                                                                        <span className="block max-w-md whitespace-normal wrap-break-word">{dep.name}</span>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div className="min-w-0">
                                                                            <div className="font-medium whitespace-normal wrap-break-word leading-snug">
                                                                                {getParticipantName(ticket) || "—"}
                                                                            </div>
                                                                            <div className="text-xs text-muted-foreground">
                                                                                Student ID: <span className="tabular-nums">{getStudentId(ticket) || "—"}</span>
                                                                            </div>
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="hidden md:table-cell text-muted-foreground">
                                                                        {fmtTime(ticket?.calledAt ?? ticket?.updatedAt)}
                                                                    </TableCell>
                                                                </TableRow>
                                                            )
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </TableShell>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Main queue work area */}
                                <div className="grid gap-6 lg:grid-cols-12">
                                    {/* Current Ticket */}
                                    <Card className="lg:col-span-4">
                                        <CardHeader>
                                            <CardTitle>Current called</CardTitle>
                                            <CardDescription>Ticket currently assigned to your window (centralized state).</CardDescription>
                                        </CardHeader>

                                        <CardContent className="space-y-4">
                                            {!assignedOk ? (
                                                <EmptyStateCard message="You are not assigned to a service window yet." />
                                            ) : current ? (
                                                <>
                                                    <div className="rounded-xl border bg-muted/40 p-4">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <div className="text-xs uppercase tracking-wide text-muted-foreground">Active ticket</div>

                                                                {(() => {
                                                                    const dep = getDepartmentMeta(current)
                                                                    const label = dep.code ? `${dep.code}-${pad3(current.queueNumber)}` : `#${current.queueNumber}`
                                                                    return (
                                                                        <div className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">
                                                                            {label}
                                                                        </div>
                                                                    )
                                                                })()}

                                                                <div className="mt-2 text-sm text-muted-foreground">
                                                                    Student:{" "}
                                                                    <span className="text-foreground font-medium whitespace-normal wrap-break-word">
                                                                        {getParticipantName(current) || "—"}
                                                                    </span>
                                                                </div>

                                                                <div className="text-sm text-muted-foreground">
                                                                    Student ID: <span className="tabular-nums">{getStudentId(current) || "—"}</span>
                                                                </div>

                                                                <div className="text-sm text-muted-foreground">
                                                                    Department: {getDepartmentMeta(current).name}
                                                                </div>

                                                                <div className="text-sm text-muted-foreground">Called at: {fmtTime(current.calledAt)}</div>

                                                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                                                    {participantTypeBadge(getParticipantType(current) || "")}
                                                                    <Badge variant="outline" className="max-w-full whitespace-normal wrap-break-word">
                                                                        Purpose: {ticketPurpose(current)}
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                            {statusBadge(current.status)}
                                                        </div>

                                                        <div className="mt-3 text-xs text-muted-foreground">
                                                            Hold attempts: {Number(current.holdAttempts ?? 0)}
                                                        </div>
                                                    </div>

                                                    <div className="grid gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="secondary"
                                                            onClick={() => void onHoldCentral()}
                                                            disabled={busy}
                                                            className="w-full gap-2"
                                                        >
                                                            <PauseCircle className="h-4 w-4" />
                                                            Hold / No-show
                                                        </Button>

                                                        <Button type="button" onClick={() => void onServeCentral()} disabled={busy} className="w-full gap-2">
                                                            <CheckCircle2 className="h-4 w-4" />
                                                            Mark served
                                                        </Button>
                                                    </div>
                                                </>
                                            ) : (
                                                <EmptyStateCard message="No ticket is currently called for your window." />
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Waiting List */}
                                    <Card className="lg:col-span-8">
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <ListOrdered className="h-5 w-5" />
                                                Waiting Line (Unified)
                                            </CardTitle>
                                            <CardDescription>
                                                Oldest tickets appear first. This list is synchronized across all staff windows.
                                            </CardDescription>
                                        </CardHeader>

                                        <CardContent>
                                            {!assignedOk ? (
                                                <EmptyStateCard message="Waiting line is unavailable until you are assigned to a window." />
                                            ) : waiting.length === 0 ? (
                                                <EmptyStateCard message="No WAITING tickets." />
                                            ) : (
                                                <TableShell>
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="w-44">Queue</TableHead>
                                                                <TableHead>Student (Full name)</TableHead>
                                                                <TableHead className="min-w-55">Purpose / Transaction</TableHead>
                                                                <TableHead className="hidden xl:table-cell">Waiting since</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {waiting.map((t, idx) => (
                                                                <TableRow key={ticketKey(t)} className={idx === 0 ? "bg-muted/50" : ""}>
                                                                    <TableCell>
                                                                        <TicketNumberPill ticket={t} />
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <ParticipantCell ticket={t} />
                                                                    </TableCell>
                                                                    <TableCell className="text-muted-foreground">
                                                                        <span className="block max-w-md whitespace-normal wrap-break-word">{ticketPurpose(t)}</span>
                                                                    </TableCell>
                                                                    <TableCell className="hidden xl:table-cell text-muted-foreground">
                                                                        {fmtTime((t as any).waitingSince)}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </TableShell>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Hold List */}
                                    <Card className="lg:col-span-6">
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <PauseOctagon className="h-5 w-5" />
                                                HOLD Queue (Unified)
                                            </CardTitle>
                                            <CardDescription>Return tickets to WAITING when they are ready.</CardDescription>
                                        </CardHeader>

                                        <CardContent>
                                            {!assignedOk ? (
                                                <EmptyStateCard message="HOLD queue is unavailable until you are assigned to a window." />
                                            ) : hold.length === 0 ? (
                                                <EmptyStateCard message="No HOLD tickets." />
                                            ) : (
                                                <TableShell>
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="w-44">Queue</TableHead>
                                                                <TableHead>Student</TableHead>
                                                                <TableHead className="min-w-45">Purpose</TableHead>
                                                                <TableHead className="w-28">Attempts</TableHead>
                                                                <TableHead className="hidden md:table-cell">Updated</TableHead>
                                                                <TableHead className="w-32 text-right">Action</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {hold.map((t) => (
                                                                <TableRow key={ticketKey(t)}>
                                                                    <TableCell>
                                                                        <TicketNumberPill ticket={t} />
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <ParticipantCell ticket={t} />
                                                                    </TableCell>
                                                                    <TableCell className="text-muted-foreground">
                                                                        <span className="block max-w-sm whitespace-normal wrap-break-word">{ticketPurpose(t)}</span>
                                                                    </TableCell>
                                                                    <TableCell>{Number((t as any)?.holdAttempts ?? 0)}</TableCell>
                                                                    <TableCell className="hidden md:table-cell text-muted-foreground">
                                                                        {fmtTime((t as any)?.updatedAt)}
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="gap-2"
                                                                            disabled={busy}
                                                                            onClick={() => void onReturnFromHold(String(getTicketId(t)))}
                                                                        >
                                                                            <Undo2 className="h-4 w-4" />
                                                                            Return
                                                                        </Button>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </TableShell>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* OUT List */}
                                    <Card className="lg:col-span-6">
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <XCircle className="h-5 w-5" />
                                                OUT Queue
                                            </CardTitle>
                                            <CardDescription>Tickets that reached maximum HOLD attempts.</CardDescription>
                                        </CardHeader>

                                        <CardContent>
                                            {!assignedOk ? (
                                                <EmptyStateCard message="OUT queue is unavailable until you are assigned to a window." />
                                            ) : out.length === 0 ? (
                                                <EmptyStateCard message="No OUT tickets." />
                                            ) : (
                                                <TableShell>
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="w-44">Queue</TableHead>
                                                                <TableHead>Student</TableHead>
                                                                <TableHead className="min-w-45">Purpose</TableHead>
                                                                <TableHead className="w-28">Attempts</TableHead>
                                                                <TableHead className="hidden md:table-cell">Out at</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {out.map((t) => (
                                                                <TableRow key={ticketKey(t)}>
                                                                    <TableCell>
                                                                        <TicketNumberPill ticket={t} />
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <ParticipantCell ticket={t} />
                                                                    </TableCell>
                                                                    <TableCell className="text-muted-foreground">
                                                                        <span className="block max-w-sm whitespace-normal wrap-break-word">{ticketPurpose(t)}</span>
                                                                    </TableCell>
                                                                    <TableCell>{Number((t as any)?.holdAttempts ?? 0)}</TableCell>
                                                                    <TableCell className="hidden md:table-cell text-muted-foreground">
                                                                        {fmtTime((t as any)?.outAt)}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </TableShell>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* History */}
                                    <Card className="lg:col-span-12">
                                        <CardHeader className="gap-2">
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <CardTitle className="flex items-center gap-2">
                                                        <History className="h-5 w-5" />
                                                        Ticket History
                                                    </CardTitle>
                                                    <CardDescription>Recent CALLED / SERVED / OUT tickets for today.</CardDescription>
                                                </div>

                                                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                                                    <Switch
                                                        id="historyMine"
                                                        checked={historyMine}
                                                        onCheckedChange={(v) => {
                                                            setHistoryMine(Boolean(v))
                                                            toast.message(Boolean(v) ? "Showing your window history." : "Showing all window history.")
                                                        }}
                                                        disabled={!assignedOk || busy}
                                                    />
                                                    <Label htmlFor="historyMine" className="text-sm">
                                                        Mine only
                                                    </Label>
                                                </div>
                                            </div>
                                        </CardHeader>

                                        <CardContent>
                                            {!assignedOk ? (
                                                <EmptyStateCard message="History is unavailable until you are assigned to a window." />
                                            ) : history.length === 0 ? (
                                                <EmptyStateCard message="No history yet." />
                                            ) : (
                                                <TableShell>
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="w-44">Queue</TableHead>
                                                                <TableHead className="w-28">Status</TableHead>
                                                                <TableHead>Student</TableHead>
                                                                <TableHead className="min-w-55">Purpose</TableHead>
                                                                <TableHead className="w-28">Window</TableHead>
                                                                <TableHead className="hidden md:table-cell">When</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {history.map((t) => {
                                                                const win = getWindowMeta(t)
                                                                return (
                                                                    <TableRow key={ticketKey(t)}>
                                                                        <TableCell>
                                                                            <TicketNumberPill ticket={t} />
                                                                        </TableCell>
                                                                        <TableCell>{statusBadge(String((t as any)?.status ?? ""))}</TableCell>
                                                                        <TableCell>
                                                                            <ParticipantCell ticket={t} />
                                                                        </TableCell>
                                                                        <TableCell className="text-muted-foreground">
                                                                            <span className="block max-w-120 whitespace-normal wrap-break-word">{ticketPurpose(t)}</span>
                                                                        </TableCell>
                                                                        <TableCell className="text-muted-foreground">{win?.number ? `#${win.number}` : "—"}</TableCell>
                                                                        <TableCell className="hidden md:table-cell text-muted-foreground">{historyWhen(t)}</TableCell>
                                                                    </TableRow>
                                                                )
                                                            })}
                                                        </TableBody>
                                                    </Table>
                                                </TableShell>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}