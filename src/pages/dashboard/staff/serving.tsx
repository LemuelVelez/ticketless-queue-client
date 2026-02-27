/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import {
    CheckCircle2,
    ExternalLink,
    LayoutGrid,
    Megaphone,
    MessageSquare,
    Monitor,
    MoreHorizontal,
    PauseCircle,
    RefreshCw,
    Send,
    Ticket as TicketIcon,
    Volume2,
} from "lucide-react"
import { useSpeak, useVoices } from "react-text-to-speech"

import { DashboardLayout } from "@/components/dashboard-layout"
import { STAFF_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"

import { useSession } from "@/hooks/use-session"
import {
    staffApi,
    type DepartmentAssignment,
    type StaffDisplayBoardWindow,
    type StaffDisplaySnapshotResponse,
    type Ticket as TicketType,
} from "@/api/staff"

import { ApiError } from "@/lib/http"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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

function parseBool(v: unknown): boolean {
    if (typeof v === "boolean") return v
    if (typeof v !== "string") return false
    const s = v.trim().toLowerCase()
    return s === "1" || s === "true" || s === "yes" || s === "y" || s === "on"
}

function parsePanelCount(search: string, fallback = 3) {
    const qs = new URLSearchParams(search || "")
    const raw = Number(qs.get("panels") || fallback)
    if (!Number.isFinite(raw)) return fallback
    return Math.max(3, Math.min(8, Math.floor(raw)))
}

function isSpeechSupported() {
    return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window
}

type MonitorOption = {
    id: string
    label: string
    left: number
    top: number
    width: number
    height: number
    isPrimary: boolean
}

type WindowWithScreenDetails = Window & {
    getScreenDetails?: () => Promise<{
        screens: Array<{
            id?: string
            label?: string
            isPrimary?: boolean
            left?: number
            top?: number
            availLeft?: number
            availTop?: number
            width?: number
            height?: number
            availWidth?: number
            availHeight?: number
        }>
    }>
}

type AnnouncementVoiceOption = "woman" | "man"

const WOMAN_VOICE_HINTS = [
    "female",
    "woman",
    "girl",
    "samantha",
    "victoria",
    "karen",
    "hazel",
    "aria",
    "ava",
    "emma",
    "amy",
    "jenny",
    "allison",
    "kendra",
    "kimberly",
    "salli",
    "joanna",
    "ivy",
    "linda",
    "serena",
    "natasha",
    "susan",
    "lucy",
    "sofia",
    "catherine",
    "olivia",
    "zira",
]

const MAN_VOICE_HINTS = [
    "male",
    "man",
    "boy",
    "david",
    "daniel",
    "george",
    "james",
    "john",
    "mark",
    "matthew",
    "oliver",
    "ryan",
    "brian",
    "arthur",
    "fred",
    "michael",
    "tom",
    "paul",
    "kevin",
    "sean",
    "alex",
    "rishi",
    "liam",
    "william",
]

/**
 * ✅ Reliability check tokens (per request)
 * Requirement: confirm supported networks (Globe / Smart).
 * NOTE: Semaphore may return variants/casing; backend already matches loosely.
 */
const SMS_SUPPORTED_NETWORK_TOKENS = ["GLOBE", "SMART"]

/**
 * ✅ Staff Panel / Queue Dashboard requirements:
 * - Auto-refresh (AJAX polling every 2–3 seconds)
 * - Sync across all open windows (leader election + BroadcastChannel/localStorage)
 */
const POLL_MS = 2500 // 2.5s loop
const LEADER_TTL_MS = 10_000

const SERVING_POLL_LEADER_KEY = "queuepass:staff:serving_poll_leader_v1"
const SERVING_SYNC_CHANNEL = "queuepass:staff:serving_state_sync_v1"
const SERVING_SYNC_SNAPSHOT_KEY = "queuepass:staff:serving_state_snapshot_v1"

function canUseBroadcastChannel() {
    return typeof window !== "undefined" && typeof (window as any).BroadcastChannel !== "undefined"
}

function firstNonEmptyText(candidates: unknown[]) {
    for (const c of candidates) {
        const s = String(c ?? "").trim()
        if (s) return s
    }
    return ""
}

function composeName(parts: unknown[]) {
    return parts
        .map((p) => String(p ?? "").trim())
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
}

/**
 * ✅ Prefer enriched backend field: participantFullName
 * (supports Student / Alumni-Visitor / Guest). Falls back to legacy fields.
 */
function getStudentFullName(ticket: any): string {
    const t = ticket as any

    const selectionName = Array.isArray(t?.transactionSelections)
        ? String(t.transactionSelections.find(Boolean)?.participantFullName ?? "").trim()
        : ""

    const direct = firstNonEmptyText([
        // ✅ new/enriched fields (best UX)
        t?.participantFullName,
        t?.transactions?.participantFullName,
        selectionName,
        t?.meta?.participantFullName,

        // legacy/other payload shapes
        t?.studentName,
        t?.participantName,
        t?.participant?.fullName,
        t?.participant?.name,
        t?.user?.name,
        t?.name,
        t?.meta?.participantName,
    ])
    if (direct) return direct

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

/**
 * ✅ Generic identifier (studentId / tcNumber / phone)
 * Used as fallback for non-student participant types.
 */
function getStudentId(ticket: any): string {
    const t = ticket as any
    return firstNonEmptyText([t?.studentId, t?.participant?.studentId, t?.tcNumber, t?.phone, t?.participant?.phone])
}

function safeErrorMessage(err: any, fallback: string) {
    if (!err) return fallback

    const data =
        err instanceof ApiError
            ? err.data
            : (err?.data ?? err?.response?.data) // keep compatibility if any legacy axios errors exist

    const fromData =
        typeof data === "string"
            ? data
            : data && typeof data === "object"
              ? String((data as any)?.message || (data as any)?.error || (data as any)?.detail || (data as any)?.title || "")
              : ""

    const msg = String(err?.message || "").trim() || String(fromData || "").trim()
    return msg || fallback
}

function mapBoardWindowToTicketLike(row: { id: string; queueNumber: number }) {
    return {
        _id: row.id,
        department: "",
        dateKey: "",
        queueNumber: row.queueNumber,
        studentId: "",
        status: "WAITING",
        holdAttempts: 0,
    } as TicketType
}

function normalizeEnglishVoices(list: SpeechSynthesisVoice[]) {
    const map = new Map<string, SpeechSynthesisVoice>()

    for (const v of list) {
        const key = String(v.voiceURI || "").trim() || `${v.name}-${v.lang}`
        if (!key) continue

        const lang = String(v.lang || "").trim().toLowerCase()
        if (!lang.startsWith("en")) continue

        if (!map.has(key)) map.set(key, v)
    }

    return Array.from(map.values()).sort((a, b) => {
        const aDefault = a.default ? 0 : 1
        const bDefault = b.default ? 0 : 1
        if (aDefault !== bDefault) return aDefault - bDefault

        const langCmp = String(a.lang || "").localeCompare(String(b.lang || ""))
        if (langCmp !== 0) return langCmp
        return String(a.name || "").localeCompare(String(b.name || ""))
    })
}

function containsAnyHint(text: string, hints: string[]) {
    const low = text.toLowerCase()
    return hints.some((h) => low.includes(h))
}

function isLikelyWomanVoice(v: SpeechSynthesisVoice) {
    const blob = `${v.name || ""} ${v.voiceURI || ""}`.toLowerCase()
    return containsAnyHint(blob, WOMAN_VOICE_HINTS) || /(?:^|[-_ ])f(?:$|[-_ 0-9])/i.test(blob)
}

function isLikelyManVoice(v: SpeechSynthesisVoice) {
    const blob = `${v.name || ""} ${v.voiceURI || ""}`.toLowerCase()
    return containsAnyHint(blob, MAN_VOICE_HINTS) || /(?:^|[-_ ])m(?:$|[-_ 0-9])/i.test(blob)
}

function resolveGenderedEnglishVoices(
    list: SpeechSynthesisVoice[]
): {
    english: SpeechSynthesisVoice[]
    woman?: SpeechSynthesisVoice
    man?: SpeechSynthesisVoice
} {
    const english = normalizeEnglishVoices(list)
    if (!english.length) return { english: [] }

    const woman = english.find((v) => isLikelyWomanVoice(v))
    const man = english.find((v) => isLikelyManVoice(v) && v.voiceURI !== woman?.voiceURI)

    const fallbackForWoman = english.find((v) => v.voiceURI !== man?.voiceURI)
    const fallbackForMan = english.find((v) => v.voiceURI !== woman?.voiceURI)

    return {
        english,
        woman: woman ?? fallbackForWoman ?? english[0],
        man: man ?? fallbackForMan ?? english[0],
    }
}

function queueNumberLabel(v?: number | null) {
    if (!Number.isFinite(Number(v))) return "—"
    return `#${Number(v)}`
}

function getTwoNumberSlice(allNumbers: number[], panelIndex: number) {
    if (!allNumbers.length) return []
    const start = panelIndex * 2
    const sliced = allNumbers.slice(start, start + 2)
    if (sliced.length) return sliced
    return allNumbers.slice(0, 2)
}

function formatVoiceLabel(v?: SpeechSynthesisVoice) {
    if (!v) return "Auto"
    return `${v.name} (${v.lang})`
}

function uniqueDepartmentAssignments(list?: DepartmentAssignment[] | null): DepartmentAssignment[] {
    if (!Array.isArray(list)) return []

    const seen = new Set<string>()
    const out: DepartmentAssignment[] = []

    for (const item of list) {
        const id = String(item?.id || "").trim()
        if (!id || seen.has(id)) continue
        seen.add(id)

        out.push({
            id,
            name: typeof item?.name === "string" ? item.name : undefined,
            code: typeof item?.code === "string" ? item.code : null,
            transactionManager: typeof item?.transactionManager === "string" ? item.transactionManager : null,
            enabled: item?.enabled !== false,
        })
    }

    return out
}

function departmentLabel(dep?: Partial<DepartmentAssignment> | null) {
    if (!dep) return "—"
    const name = String(dep.name ?? "").trim()
    const code = String(dep.code ?? "").trim()
    if (name && code) return `${name} (${code})`
    return name || code || "—"
}

function buildCalledSmsMessage(args: { departmentLabel: string; queueNumber: number; windowNumber?: number }) {
    const dept = args.departmentLabel || "your office"
    const q = args.queueNumber
    const w = args.windowNumber
    if (typeof w === "number") {
        return `Queue Update (${dept}): You are now being called. Ticket #${q}. Please proceed to Window ${w}.`
    }
    return `Queue Update (${dept}): You are now being called. Ticket #${q}. Please proceed to the service window.`
}

function buildAdvanceNoticeSmsMessage(args: { departmentLabel: string; queueNumber: number }) {
    const dept = args.departmentLabel || "your office"
    const q = args.queueNumber
    return `Queue Update (${dept}): Advance notice — you're next. Ticket #${q}. Please be ready.`
}

function pickNextWaitingTicket(afterQueueNumber: number, list: TicketType[]) {
    const candidates = (Array.isArray(list) ? list : [])
        .filter((t) => Number.isFinite(Number(t?.queueNumber)) && Number(t.queueNumber) > afterQueueNumber)
        .slice()
        .sort((a, b) => Number(a.queueNumber) - Number(b.queueNumber))

    return candidates[0] ?? null
}

function safeJson(value: unknown) {
    try {
        return JSON.stringify(value, null, 2)
    } catch {
        return String(value)
    }
}

function summarizeReliability(result: any): {
    statusLabel: "sent" | "skipped" | "failed" | "unknown"
    deliveryStatus?: string
    providerNetwork?: string
    supportedNetwork?: boolean | null
    providerMessageId?: number
    reason?: string
} {
    if (!result) return { statusLabel: "unknown" }

    if (result?.skipped) {
        return {
            statusLabel: "skipped",
            reason: String(result?.reason || "skipped"),
        }
    }

    const reliability = result?.reliability
    const deliveryStatus = reliability?.deliveryStatus ? String(reliability.deliveryStatus) : undefined
    const providerNetwork = reliability?.providerNetwork ? String(reliability.providerNetwork) : undefined
    const supportedNetwork =
        typeof reliability?.supportedNetwork === "boolean" || reliability?.supportedNetwork === null
            ? (reliability.supportedNetwork as boolean | null)
            : undefined
    const providerMessageId = Number.isFinite(Number(reliability?.providerMessageId))
        ? Number(reliability.providerMessageId)
        : undefined

    const statusLabel = deliveryStatus === "FAILED" ? "failed" : deliveryStatus ? "sent" : "unknown"

    return {
        statusLabel,
        deliveryStatus,
        providerNetwork,
        supportedNetwork,
        providerMessageId,
    }
}

/**
 * ✅ Updated API alignment:
 * Prefer the centralized, pollable queue state endpoint:
 *   GET /staff/queue/state-full
 * It may return data at root OR inside { state: ... }.
 */
function isTicketLikeLocal(value: any): value is TicketType {
    if (!value || typeof value !== "object") return false
    const id = value?._id ?? value?.id
    const hasId = typeof id === "string" || (id && typeof id === "object")
    const hasQueueNumber = typeof value?.queueNumber === "number" || typeof value?.queueNumber === "string"
    const hasStatus = typeof value?.status === "string"
    return Boolean(hasId && hasQueueNumber && hasStatus)
}

function normalizeTicketArrayLocal(value: any): TicketType[] {
    if (!Array.isArray(value)) return []
    return value.filter((x) => isTicketLikeLocal(x)).map((x) => x as TicketType)
}

function extractQueueStateTickets(payload: any): { current: TicketType | null; upNext: TicketType[]; hold: TicketType[] } {
    const root = payload && typeof payload === "object" ? payload : {}
    const state = root?.state && typeof root.state === "object" ? root.state : root

    const currentRaw = state?.nowServing ?? state?.current ?? null
    const current = isTicketLikeLocal(currentRaw) ? (currentRaw as TicketType) : null

    const upNextRaw = Array.isArray(state?.upNext) ? state.upNext : Array.isArray(state?.waiting) ? state.waiting : []
    const holdRaw = Array.isArray(state?.hold) ? state.hold : []

    return {
        current,
        upNext: normalizeTicketArrayLocal(upNextRaw),
        hold: normalizeTicketArrayLocal(holdRaw),
    }
}

type SmsLog = {
    at: string
    current: {
        ticketId: string
        queueNumber: number
        message: string
        ok: boolean
        apiResponse?: any
        error?: string
        reliabilitySummary?: ReturnType<typeof summarizeReliability>
    }
    advance?: {
        enabled: boolean
        attempted: boolean
        nextTicketId?: string
        nextQueueNumber?: number
        message?: string
        ok?: boolean
        apiResponse?: any
        error?: string
        reliabilitySummary?: ReturnType<typeof summarizeReliability>
    }
}

type ServingSyncPayload = {
    ts: number
    windowId: string
    departmentId: string | null
    windowInfo: { id: string; name: string; number: number } | null
    assignedDepartments: DepartmentAssignment[]
    handledDepartments: DepartmentAssignment[]
    snapshot: StaffDisplaySnapshotResponse | null
    current: TicketType | null
    upNext: TicketType[]
    holdTickets: TicketType[]
}

export default function StaffServingPage() {
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

    const boardMode = React.useMemo(() => {
        const qs = new URLSearchParams(location.search || "")
        // keep backward compatibility with old ?present=1 links
        return parseBool(qs.get("board")) || parseBool(qs.get("present"))
    }, [location.search])

    const [loading, setLoading] = React.useState(true)
    const [stateLoading, setStateLoading] = React.useState(false)
    const [busy, setBusy] = React.useState(false)

    const [departmentId, setDepartmentId] = React.useState<string | null>(null)
    const [windowInfo, setWindowInfo] = React.useState<{ id: string; name: string; number: number } | null>(null)
    const [assignedDepartments, setAssignedDepartments] = React.useState<DepartmentAssignment[]>([])
    const [handledDepartments, setHandledDepartments] = React.useState<DepartmentAssignment[]>([])

    const [current, setCurrent] = React.useState<TicketType | null>(null)
    const [upNext, setUpNext] = React.useState<TicketType[]>([])
    const [holdTickets, setHoldTickets] = React.useState<TicketType[]>([])
    const [snapshot, setSnapshot] = React.useState<StaffDisplaySnapshotResponse | null>(null)

    // ✅ Auto-refresh ON by default; 2.5s polling + cross-window sync
    const [autoRefresh, setAutoRefresh] = React.useState(true)
    const [isServingLeader, setIsServingLeader] = React.useState(false)
    const lastAppliedStateTsRef = React.useRef<number>(0)
    const lastToastSyncErrorAtRef = React.useRef<number>(0)
    const bcRef = React.useRef<BroadcastChannel | null>(null)
    const [lastSyncedAtIso, setLastSyncedAtIso] = React.useState<string>("")

    const tabIdRef = React.useRef<string>("")
    if (!tabIdRef.current) {
        try {
            tabIdRef.current =
                typeof crypto !== "undefined" && "randomUUID" in crypto
                    ? crypto.randomUUID()
                    : `tab_${Date.now()}_${Math.random()}`
        } catch {
            tabIdRef.current = `tab_${Date.now()}_${Math.random()}`
        }
    }

    const [panelCount, setPanelCount] = React.useState<number>(() => parsePanelCount(location.search, 3))

    // -------- Monitor selection (multi-display) --------
    const [monitorOptions, setMonitorOptions] = React.useState<MonitorOption[]>([])
    const [selectedMonitorId, setSelectedMonitorId] = React.useState<string>("")
    const [monitorApiSupported, setMonitorApiSupported] = React.useState(false)
    const [loadingMonitors, setLoadingMonitors] = React.useState(false)
    const monitorWarnedRef = React.useRef(false)

    const assignedDepartmentItems = React.useMemo(
        () => uniqueDepartmentAssignments(assignedDepartments),
        [assignedDepartments]
    )
    const handledDepartmentItems = React.useMemo(
        () => uniqueDepartmentAssignments(handledDepartments),
        [handledDepartments]
    )

    const assignedOk = Boolean(departmentId && windowInfo?.id)

    // -------- Voice announcement (react-text-to-speech) --------
    const [voiceEnabled, setVoiceEnabled] = React.useState(true)
    const [voiceSupported, setVoiceSupported] = React.useState(true)
    const [selectedVoiceType, setSelectedVoiceType] = React.useState<AnnouncementVoiceOption>("woman")
    const voiceUnsupportedWarnedRef = React.useRef(false)
    const englishVoiceWarnedRef = React.useRef(false)
    const lastAnnouncedRef = React.useRef<number | null>(null)

    // -------- SMS states --------
    const [autoSmsOnCall, setAutoSmsOnCall] = React.useState(false)
    const [smsAdvanceNoticeEnabled, setSmsAdvanceNoticeEnabled] = React.useState(false)
    const [smsDialogOpen, setSmsDialogOpen] = React.useState(false)
    const [smsLogDialogOpen, setSmsLogDialogOpen] = React.useState(false)
    const [smsBusy, setSmsBusy] = React.useState(false)
    const [smsUseDefaultMessage, setSmsUseDefaultMessage] = React.useState(true)
    const [smsCustomMessage, setSmsCustomMessage] = React.useState("")
    const [smsSenderName, setSmsSenderName] = React.useState("")
    const [lastSmsLog, setLastSmsLog] = React.useState<SmsLog | null>(null)

    const smsDepartmentLabel = React.useMemo(() => {
        const snapName = String(snapshot?.department?.name || "").trim()
        if (snapName) return snapName

        const pools = [...assignedDepartmentItems, ...handledDepartmentItems]
        const dep = pools.find((d) => String(d.id) === String(departmentId || ""))
        const name = String(dep?.name || "").trim()
        const code = String(dep?.code || "").trim()

        return name || code || "your office"
    }, [assignedDepartmentItems, handledDepartmentItems, departmentId, snapshot?.department?.name])

    const { voices } = useVoices()
    const { speak: speakWithPackage, stop: stopSpeech } = useSpeak({
        onError: (error: Error) => {
            if (voiceUnsupportedWarnedRef.current) return
            voiceUnsupportedWarnedRef.current = true
            toast.message(error?.message || "Voice announcement failed in this browser.")
        },
    })

    const resolvedEnglishVoices = React.useMemo(
        () => resolveGenderedEnglishVoices(Array.isArray(voices) ? voices : []),
        [voices]
    )

    React.useEffect(() => {
        const supported = isSpeechSupported()
        setVoiceSupported(supported)
        if (!supported) {
            setVoiceEnabled(false)
        }
    }, [])

    React.useEffect(() => {
        // Keep panel count synced when opening board links with ?panels=
        if (!boardMode) return
        setPanelCount(parsePanelCount(location.search, 3))
    }, [boardMode, location.search])

    React.useEffect(() => {
        if (!voiceSupported) return
        if (!Array.isArray(voices) || voices.length === 0) return
        if (resolvedEnglishVoices.english.length > 0) return
        if (englishVoiceWarnedRef.current) return

        englishVoiceWarnedRef.current = true
        toast.message("No English TTS voice was found. Browser default voice will be used.")
    }, [resolvedEnglishVoices.english.length, voiceSupported, voices])

    const speak = React.useCallback(
        (text: string) => {
            if (!voiceSupported) return

            const preferred = selectedVoiceType === "woman" ? resolvedEnglishVoices.woman : resolvedEnglishVoices.man

            const fallback = selectedVoiceType === "woman" ? resolvedEnglishVoices.man : resolvedEnglishVoices.woman

            const voiceURI = preferred?.voiceURI || fallback?.voiceURI || resolvedEnglishVoices.english[0]?.voiceURI

            try {
                stopSpeech()
            } catch {
                // ignore
            }

            try {
                speakWithPackage(text, {
                    lang: "en-US",
                    rate: 1,
                    pitch: 1,
                    volume: 1,
                    ...(voiceURI ? { voiceURI } : {}),
                })
            } catch {
                // ignore
            }
        },
        [resolvedEnglishVoices, selectedVoiceType, speakWithPackage, stopSpeech, voiceSupported]
    )

    const announceCall = React.useCallback(
        (queueNumber: number) => {
            lastAnnouncedRef.current = queueNumber

            if (!voiceEnabled) return
            if (!voiceSupported) {
                if (!voiceUnsupportedWarnedRef.current) {
                    voiceUnsupportedWarnedRef.current = true
                    toast.message("Voice announcement is not supported in this browser.")
                }
                return
            }

            const win = windowInfo?.number
            const text = win ? `Number ${queueNumber}, please proceed to window ${win}.` : `Number ${queueNumber}.`

            speak(text)
        },
        [speak, voiceEnabled, voiceSupported, windowInfo?.number]
    )

    const onRecallVoice = React.useCallback(() => {
        const n = current?.queueNumber ?? lastAnnouncedRef.current
        if (!n) return toast.message("No ticket to announce.")
        announceCall(n)
    }, [announceCall, current?.queueNumber])

    const loadMonitorOptions = React.useCallback(async (silent = false) => {
        if (typeof window === "undefined") return

        setLoadingMonitors(true)
        try {
            const w = window as WindowWithScreenDetails
            const nextOptions: MonitorOption[] = []

            if (typeof w.getScreenDetails === "function") {
                try {
                    const details = await w.getScreenDetails()
                    const screens = Array.isArray(details?.screens) ? details.screens : []
                    for (let i = 0; i < screens.length; i += 1) {
                        const s = screens[i]
                        const width = Number(s?.availWidth ?? s?.width ?? 0)
                        const height = Number(s?.availHeight ?? s?.height ?? 0)
                        const left = Number(s?.left ?? s?.availLeft ?? 0)
                        const top = Number(s?.top ?? s?.availTop ?? 0)
                        const isPrimary = s?.isPrimary === true
                        const id = String(s?.id || `screen-${i}`)

                        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
                            continue
                        }

                        const labelBase = s?.label?.trim() ? s.label.trim() : `Monitor ${i + 1}`
                        const label = `${labelBase}${isPrimary ? " (Primary)" : ""} • ${Math.floor(width)}×${Math.floor(height)}`
                        nextOptions.push({
                            id,
                            label,
                            left,
                            top,
                            width: Math.floor(width),
                            height: Math.floor(height),
                            isPrimary,
                        })
                    }

                    if (nextOptions.length) {
                        setMonitorApiSupported(true)
                    }
                } catch {
                    // permission denied / unsupported by browser policy
                    setMonitorApiSupported(false)
                }
            }

            if (!nextOptions.length) {
                const s = window.screen
                const width = Number(s?.availWidth || s?.width || 1280)
                const height = Number(s?.availHeight || s?.height || 720)

                nextOptions.push({
                    id: "primary-fallback",
                    label: `Current monitor (fallback) • ${Math.floor(width)}×${Math.floor(height)}`,
                    left: 0,
                    top: 0,
                    width: Math.floor(width),
                    height: Math.floor(height),
                    isPrimary: true,
                })

                if (!silent && !monitorWarnedRef.current) {
                    monitorWarnedRef.current = true
                    toast.message("Hardware monitor API is unavailable. Using current monitor fallback.")
                }
            }

            setMonitorOptions(nextOptions)
            setSelectedMonitorId((prev) => {
                if (prev && nextOptions.some((o) => o.id === prev)) return prev
                const primary = nextOptions.find((o) => o.isPrimary)
                return primary?.id || nextOptions[0]?.id || ""
            })
        } finally {
            setLoadingMonitors(false)
        }
    }, [])

    const broadcastServingState = React.useCallback((payload: ServingSyncPayload) => {
        if (typeof window === "undefined") return

        if (canUseBroadcastChannel()) {
            try {
                bcRef.current?.postMessage({ type: "SERVING_STATE", ...payload })
                return
            } catch {
                // fallback below
            }
        }

        try {
            localStorage.setItem(SERVING_SYNC_SNAPSHOT_KEY, JSON.stringify({ type: "SERVING_STATE", ...payload }))
        } catch {
            // ignore
        }
    }, [])

    const applyRemoteServingState = React.useCallback(
        (payload: Partial<ServingSyncPayload>) => {
            const ts = Number(payload?.ts ?? 0)
            if (!Number.isFinite(ts) || ts <= 0) return

            // If we already know our window, only accept matching updates.
            const localWindowId = String(windowInfo?.id ?? "").trim()
            const remoteWindowId = String(payload?.windowId ?? "").trim()
            if (localWindowId && remoteWindowId && localWindowId !== remoteWindowId) return

            if (ts <= lastAppliedStateTsRef.current) return
            lastAppliedStateTsRef.current = ts

            // Prefer not to override assignment if we already have it; but fill gaps to improve UX.
            if (!departmentId && typeof payload?.departmentId !== "undefined") setDepartmentId(payload.departmentId ?? null)
            if (!windowInfo && payload?.windowInfo) setWindowInfo(payload.windowInfo)

            if (
                Array.isArray(payload?.assignedDepartments) &&
                payload.assignedDepartments.length &&
                assignedDepartments.length === 0
            ) {
                setAssignedDepartments(payload.assignedDepartments)
            }
            if (
                Array.isArray(payload?.handledDepartments) &&
                payload.handledDepartments.length &&
                handledDepartments.length === 0
            ) {
                setHandledDepartments(payload.handledDepartments)
            }

            if (typeof payload?.snapshot !== "undefined") setSnapshot(payload.snapshot ?? null)
            if (typeof payload?.current !== "undefined") setCurrent(payload.current ?? null)
            if (Array.isArray(payload?.upNext)) setUpNext(payload.upNext)
            if (Array.isArray(payload?.holdTickets)) setHoldTickets(payload.holdTickets)

            setLastSyncedAtIso(new Date(ts).toISOString())
            setStateLoading(false)
            setLoading(false)
        },
        [assignedDepartments.length, departmentId, handledDepartments.length, windowInfo]
    )

    const refresh = React.useCallback(
        async (opts?: { silent?: boolean; broadcast?: boolean; tickTs?: number }) => {
            if (!opts?.silent) setStateLoading(true)

            try {
                const a = await staffApi.myAssignment()
                setDepartmentId(a.departmentId ?? null)
                setWindowInfo(a.window ? { id: a.window._id, name: a.window.name, number: a.window.number } : null)

                const normalizedAssigned = uniqueDepartmentAssignments(a.assignedDepartments)
                const normalizedHandled = uniqueDepartmentAssignments(a.handledDepartments)

                setAssignedDepartments(normalizedAssigned)
                setHandledDepartments(normalizedHandled.length ? normalizedHandled : normalizedAssigned)

                const assignedReady = Boolean(a.departmentId && a.window?._id)

                // ✅ Updated: prefer centralized queue state for current/upNext/hold
                const [snapshotResult, queueStateResult] = await Promise.all([
                    staffApi.getDisplaySnapshot().catch(() => null),
                    assignedReady ? staffApi.getQueueState().catch(() => null) : Promise.resolve(null),
                ])

                const snapshotHandled = uniqueDepartmentAssignments(snapshotResult?.department?.handledDepartments)
                if (!normalizedHandled.length && snapshotHandled.length) {
                    setHandledDepartments(snapshotHandled)
                }
                if (!normalizedAssigned.length && snapshotHandled.length) {
                    setAssignedDepartments(snapshotHandled)
                }

                setSnapshot(snapshotResult ?? null)

                // ✅ Extract current/upNext/hold from the centralized state response
                const extracted = queueStateResult ? extractQueueStateTickets(queueStateResult) : null

                // Fallbacks for older backends or partial payloads
                let currentTicket: TicketType | null = extracted?.current ?? null
                let upNextTickets: TicketType[] = extracted?.upNext ?? []
                let holdList: TicketType[] = extracted?.hold ?? []

                if (assignedReady && !currentTicket) {
                    try {
                        const legacyCurrent = await staffApi.currentCalledForWindow()
                        currentTicket = legacyCurrent.ticket ?? null
                    } catch {
                        // ignore
                    }
                }

                if (assignedReady && upNextTickets.length === 0) {
                    try {
                        const waitingRes = await staffApi.listWaiting({ limit: 16 })
                        upNextTickets = Array.isArray(waitingRes?.tickets) ? waitingRes.tickets : []
                    } catch {
                        // ignore
                    }
                }

                if (assignedReady && holdList.length === 0) {
                    try {
                        const holdRes = await staffApi.listHold({ limit: 16 })
                        holdList = Array.isArray(holdRes?.tickets) ? holdRes.tickets : []
                    } catch {
                        // ignore
                    }
                }

                setCurrent(currentTicket)

                // If we still have no waiting list, use snapshot upNext (board shape) as last resort.
                if (upNextTickets.length) {
                    setUpNext(upNextTickets)
                } else if (snapshotResult?.upNext?.length) {
                    setUpNext(snapshotResult.upNext.map(mapBoardWindowToTicketLike))
                } else {
                    setUpNext([])
                }

                setHoldTickets(holdList)

                const tickTs =
                    typeof opts?.tickTs === "number" && Number.isFinite(opts.tickTs) ? opts.tickTs : Date.now()
                setLastSyncedAtIso(new Date(tickTs).toISOString())
                lastAppliedStateTsRef.current = Math.max(lastAppliedStateTsRef.current, tickTs)

                if (opts?.broadcast) {
                    const w = a.window ? { id: a.window._id, name: a.window.name, number: a.window.number } : null
                    const payload: ServingSyncPayload = {
                        ts: tickTs,
                        windowId: w?.id ? String(w.id) : "",
                        departmentId: a.departmentId ?? null,
                        windowInfo: w,
                        assignedDepartments: uniqueDepartmentAssignments(a.assignedDepartments),
                        handledDepartments: uniqueDepartmentAssignments(
                            a.handledDepartments?.length ? a.handledDepartments : a.assignedDepartments
                        ),
                        snapshot: snapshotResult ?? null,
                        current: (currentTicket ?? null) as any,
                        upNext: (upNextTickets.length
                            ? upNextTickets
                            : snapshotResult?.upNext?.length
                              ? snapshotResult.upNext.map(mapBoardWindowToTicketLike)
                              : []) as any,
                        holdTickets: (holdList ?? []) as any,
                    }
                    broadcastServingState(payload)
                }
            } catch (e: any) {
                const msg = safeErrorMessage(e, "Failed to load now serving.")
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
        [broadcastServingState]
    )

    const openBoardOnSelectedMonitor = React.useCallback(() => {
        if (typeof window === "undefined") return
        const selected = monitorOptions.find((m) => m.id === selectedMonitorId) || monitorOptions[0]
        const targetPanels = Math.max(3, panelCount)

        const qs = new URLSearchParams()
        qs.set("board", "1")
        qs.set("panels", String(targetPanels))

        const url = `${window.location.pathname}?${qs.toString()}`

        if (!selected) {
            const childFallback = window.open(url, "_blank")
            if (!childFallback) toast.error("Popup was blocked. Please allow popups for this site.")
            return
        }

        const features = [
            "popup=yes",
            `left=${Math.max(0, Math.floor(selected.left))}`,
            `top=${Math.max(0, Math.floor(selected.top))}`,
            `width=${Math.max(800, Math.floor(selected.width))}`,
            `height=${Math.max(600, Math.floor(selected.height))}`,
        ].join(",")

        const child = window.open(url, `_queue_board_${Date.now()}`, features)
        if (!child) {
            toast.error("Popup was blocked. Please allow popups for this site.")
            return
        }

        try {
            child.focus()
        } catch {
            // ignore
        }

        toast.success(`Queue display opened on ${selected.label}.`)
    }, [monitorOptions, panelCount, selectedMonitorId])

    // ✅ Boot: apply last snapshot fast (cross-window sync) then fetch
    React.useEffect(() => {
        if (typeof window === "undefined") return
        try {
            const raw = localStorage.getItem(SERVING_SYNC_SNAPSHOT_KEY)
            if (!raw) return
            const parsed = JSON.parse(raw) as any
            if (parsed?.type !== "SERVING_STATE") return
            applyRemoteServingState(parsed as any)
        } catch {
            // ignore
        }
    }, [applyRemoteServingState])

    React.useEffect(() => {
        ;(async () => {
            setLoading(true)
            try {
                await refresh({ broadcast: true, tickTs: Date.now() })
            } finally {
                setLoading(false)
            }
        })()
    }, [refresh])

    React.useEffect(() => {
        if (boardMode) return
        void loadMonitorOptions(true)
    }, [boardMode, loadMonitorOptions])

    // ✅ Cross-window receive: BroadcastChannel + localStorage fallback
    React.useEffect(() => {
        if (typeof window === "undefined") return

        if (canUseBroadcastChannel()) {
            try {
                const bc = new BroadcastChannel(SERVING_SYNC_CHANNEL)
                bcRef.current = bc
                bc.onmessage = (ev) => {
                    const data = ev?.data
                    if (!data || typeof data !== "object") return
                    if ((data as any).type !== "SERVING_STATE") return
                    applyRemoteServingState(data as any)
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
                // fallback to storage listener only
            }
        }

        const onStorage = (e: StorageEvent) => {
            if (e.key !== SERVING_SYNC_SNAPSHOT_KEY) return
            if (!e.newValue) return
            try {
                const parsed = JSON.parse(e.newValue) as any
                if (parsed?.type !== "SERVING_STATE") return
                applyRemoteServingState(parsed as any)
            } catch {
                // ignore
            }
        }

        window.addEventListener("storage", onStorage)
        return () => window.removeEventListener("storage", onStorage)
    }, [applyRemoteServingState])

    // ✅ Leader election: ONE tab polls; all tabs sync instantly
    React.useEffect(() => {
        if (typeof window === "undefined") return
        if (!autoRefresh) {
            setIsServingLeader(false)
            return
        }
        if (!assignedOk) {
            setIsServingLeader(false)
            return
        }

        const tick = () => {
            try {
                const raw = localStorage.getItem(SERVING_POLL_LEADER_KEY)
                const now = Date.now()
                const parsed = raw ? (JSON.parse(raw) as { id?: string; ts?: number }) : null

                const leaderId = String(parsed?.id ?? "")
                const leaderTs = Number(parsed?.ts ?? 0)
                const expired = !leaderId || !Number.isFinite(leaderTs) || now - leaderTs > LEADER_TTL_MS

                if (expired || leaderId === tabIdRef.current) {
                    localStorage.setItem(SERVING_POLL_LEADER_KEY, JSON.stringify({ id: tabIdRef.current, ts: now }))
                    setIsServingLeader(true)
                } else {
                    setIsServingLeader(false)
                }
            } catch {
                setIsServingLeader(true)
            }
        }

        tick()
        const iv = window.setInterval(tick, 3000)
        return () => window.clearInterval(iv)
    }, [assignedOk, autoRefresh])

    // ✅ Poll loop (leader only): every 2.5s, broadcast to everyone
    React.useEffect(() => {
        if (typeof window === "undefined") return
        if (!autoRefresh) return
        if (!assignedOk) return
        if (!isServingLeader) return

        const iv = window.setInterval(() => {
            const tickTs = Date.now()
            void refresh({ silent: true, broadcast: true, tickTs })
        }, POLL_MS)

        return () => window.clearInterval(iv)
    }, [assignedOk, autoRefresh, isServingLeader, refresh])

    const sendCalledSms = React.useCallback(
        async (
            ticket: TicketType,
            opts?: { message?: string; senderName?: string; toastOnSuccess?: boolean; advanceNotice?: boolean }
        ) => {
            if (!ticket?._id) {
                toast.error("No active ticket selected for SMS.")
                return false
            }

            const senderName = String(opts?.senderName ?? "").trim()
            const useAdvance = Boolean(opts?.advanceNotice)

            const message =
                String(opts?.message ?? "").trim() ||
                buildCalledSmsMessage({
                    departmentLabel: smsDepartmentLabel,
                    queueNumber: Number(ticket.queueNumber),
                    windowNumber: windowInfo?.number,
                })

            setSmsBusy(true)

            const nextLog: SmsLog = {
                at: new Date().toISOString(),
                current: {
                    ticketId: String(ticket._id),
                    queueNumber: Number(ticket.queueNumber),
                    message,
                    ok: false,
                },
                advance: {
                    enabled: useAdvance,
                    attempted: false,
                },
            }

            try {
                let res: any
                try {
                    // ✅ Updated API: unified alias (/staff/tickets/:id/sms)
                    res = await staffApi.sendTicketSms(ticket._id, {
                        message,
                        ...(senderName ? { senderName } : {}),
                        respectOptOut: true,
                        supportedNetworkTokens: SMS_SUPPORTED_NETWORK_TOKENS,
                        meta: {
                            source: "staff-serving",
                            kind: "current_called",
                            departmentLabel: smsDepartmentLabel,
                            windowNumber: windowInfo?.number ?? null,
                        },
                    })
                } catch (e: any) {
                    // ✅ If backend returns 502 with JSON body (provider failure), our fetch-based client throws.
                    // We still want to show/log the payload for best UX.
                    if (e instanceof ApiError && e.status === 502 && e.data && typeof e.data === "object") {
                        res = e.data
                    } else {
                        throw e
                    }
                }

                nextLog.current.ok = Boolean(res?.ok)
                nextLog.current.apiResponse = res
                nextLog.current.error = !res?.ok
                    ? String((res as any)?.error || (res as any)?.message || "").trim() || "SMS failed."
                    : undefined
                nextLog.current.reliabilitySummary = summarizeReliability(res?.result)

                if (!res?.ok) {
                    toast.error(nextLog.current.error || `SMS failed for #${ticket.queueNumber}.`)
                    setLastSmsLog(nextLog)
                    return false
                }

                const sum = nextLog.current.reliabilitySummary
                if (sum.statusLabel === "skipped") {
                    toast.message(`SMS skipped for #${ticket.queueNumber} (opted out).`)
                } else if (sum.statusLabel === "failed") {
                    toast.error(
                        `SMS failed for #${ticket.queueNumber}${sum.providerNetwork ? ` • ${sum.providerNetwork}` : ""}.`
                    )
                    setLastSmsLog(nextLog)
                    return false
                } else {
                    if (opts?.toastOnSuccess !== false) {
                        const supportLabel =
                            sum.supportedNetwork === true
                                ? "supported"
                                : sum.supportedNetwork === false
                                  ? "unsupported"
                                  : "unknown"

                        toast.success(
                            `SMS ${sum.deliveryStatus || "sent"} for #${ticket.queueNumber}` +
                                (sum.providerNetwork ? ` • ${sum.providerNetwork}` : "") +
                                (sum.providerMessageId ? ` • id ${sum.providerMessageId}` : "")
                        )

                        if (sum.supportedNetwork !== true) {
                            toast.message(
                                `Network check: ${sum.providerNetwork || "Unknown"} is ${supportLabel}. Supported: Globe/Smart.`
                            )
                        }
                    }
                }

                if (!useAdvance) {
                    nextLog.advance = { enabled: false, attempted: false }
                    setLastSmsLog(nextLog)
                    return true
                }

                // ✅ Updated API alignment: prefer centralized queue state for the waiting list (then fallback)
                let waitingList: TicketType[] = upNext
                try {
                    const qs = await staffApi.getQueueState()
                    const extracted = extractQueueStateTickets(qs)
                    waitingList = extracted.upNext.length ? extracted.upNext : waitingList
                } catch {
                    // fallback to legacy list
                    try {
                        const waitingRes = await staffApi.listWaiting({ limit: 50 })
                        waitingList = Array.isArray(waitingRes?.tickets) ? waitingRes.tickets : waitingList
                    } catch {
                        // ignore
                    }
                }

                const nextTicket = pickNextWaitingTicket(Number(ticket.queueNumber), waitingList)

                if (!nextTicket?._id) {
                    nextLog.advance = {
                        enabled: true,
                        attempted: true,
                        error: "No next waiting ticket found.",
                    }
                    setLastSmsLog(nextLog)
                    toast.message("Advance notice: no next waiting ticket found.")
                    return true
                }

                const nextMessage = buildAdvanceNoticeSmsMessage({
                    departmentLabel: smsDepartmentLabel,
                    queueNumber: Number(nextTicket.queueNumber),
                })

                nextLog.advance = {
                    enabled: true,
                    attempted: true,
                    nextTicketId: String(nextTicket._id),
                    nextQueueNumber: Number(nextTicket.queueNumber),
                    message: nextMessage,
                }

                try {
                    let res2: any
                    try {
                        // ✅ Updated API: unified alias (/staff/tickets/:id/sms)
                        res2 = await staffApi.sendTicketSms(nextTicket._id, {
                            message: nextMessage,
                            ...(senderName ? { senderName } : {}),
                            respectOptOut: true,
                            supportedNetworkTokens: SMS_SUPPORTED_NETWORK_TOKENS,
                            meta: {
                                source: "staff-serving",
                                kind: "advance_notice",
                                relatedCurrentTicketId: String(ticket._id),
                                relatedCurrentQueueNumber: Number(ticket.queueNumber),
                                nextQueueNumber: Number(nextTicket.queueNumber),
                            },
                        })
                    } catch (e2: any) {
                        if (e2 instanceof ApiError && e2.status === 502 && e2.data && typeof e2.data === "object") {
                            res2 = e2.data
                        } else {
                            throw e2
                        }
                    }

                    nextLog.advance.ok = Boolean(res2?.ok)
                    nextLog.advance.apiResponse = res2
                    nextLog.advance.error = !res2?.ok
                        ? String((res2 as any)?.error || (res2 as any)?.message || "").trim() || "Advance notice failed."
                        : undefined
                    nextLog.advance.reliabilitySummary = summarizeReliability(res2?.result)

                    if (!res2?.ok) {
                        toast.message(`Advance notice failed: ${nextLog.advance.error || "Unknown error"}`)
                        setLastSmsLog(nextLog)
                        return true
                    }

                    const sum2 = nextLog.advance.reliabilitySummary
                    if (sum2?.statusLabel === "skipped") {
                        toast.message(`Advance SMS skipped for next #${nextTicket.queueNumber} (opted out).`)
                    } else if (sum2?.statusLabel === "failed") {
                        toast.message(`Advance notice SMS failed for next #${nextTicket.queueNumber}.`)
                    } else {
                        const supportLabel =
                            sum2?.supportedNetwork === true
                                ? "supported"
                                : sum2?.supportedNetwork === false
                                  ? "unsupported"
                                  : "unknown"

                        toast.success(
                            `Advance notice ${sum2?.deliveryStatus || "sent"} for next #${nextTicket.queueNumber}` +
                                (sum2?.providerNetwork ? ` • ${sum2.providerNetwork}` : "")
                        )

                        if (sum2?.supportedNetwork !== true) {
                            toast.message(
                                `Network check (advance): ${sum2?.providerNetwork || "Unknown"} is ${supportLabel}. Supported: Globe/Smart.`
                            )
                        }
                    }
                } catch (e2: any) {
                    nextLog.advance.error = safeErrorMessage(e2, "Advance notice failed.")
                    toast.message(`Advance notice failed: ${nextLog.advance.error}`)
                }

                setLastSmsLog(nextLog)
                return true
            } catch (e: any) {
                nextLog.current.ok = false
                nextLog.current.error = safeErrorMessage(e, "Failed to send SMS.")
                setLastSmsLog(nextLog)
                toast.error(nextLog.current.error)
                return false
            } finally {
                setSmsBusy(false)
            }
        },
        [smsDepartmentLabel, upNext, windowInfo?.number]
    )

    const onSendSmsFromDialog = React.useCallback(async () => {
        if (!current?._id) {
            toast.message("No active ticket selected for SMS.")
            return
        }

        const custom = smsUseDefaultMessage ? "" : smsCustomMessage.trim()
        if (!smsUseDefaultMessage && !custom) {
            toast.error("Custom message is required.")
            return
        }

        const ok = await sendCalledSms(current, {
            message: custom || undefined,
            senderName: smsSenderName.trim() || undefined,
            toastOnSuccess: true,
            advanceNotice: smsAdvanceNoticeEnabled,
        })

        if (!ok) return

        setSmsDialogOpen(false)
        setSmsUseDefaultMessage(true)
        setSmsCustomMessage("")
    }, [current, sendCalledSms, smsCustomMessage, smsSenderName, smsUseDefaultMessage, smsAdvanceNoticeEnabled])

    async function onCallNext() {
        if (!assignedOk) return toast.error("You are not assigned to a department/window.")
        setBusy(true)
        try {
            const res = await staffApi.callNext()
            setCurrent(res.ticket)
            toast.success(`Called #${res.ticket.queueNumber}`)
            announceCall(res.ticket.queueNumber)

            if (autoSmsOnCall) {
                await sendCalledSms(res.ticket, {
                    senderName: smsSenderName.trim() || undefined,
                    toastOnSuccess: true,
                    advanceNotice: smsAdvanceNoticeEnabled,
                })
            }

            await refresh({ broadcast: true, tickTs: Date.now() })
        } catch (e: any) {
            toast.error(safeErrorMessage(e, "No waiting tickets."))
        } finally {
            setBusy(false)
        }
    }

    async function onServed() {
        if (!current?._id) return
        setBusy(true)
        try {
            await staffApi.markServed(current._id)
            toast.success(`Marked #${current.queueNumber} as served.`)
            await refresh({ broadcast: true, tickTs: Date.now() })
        } catch (e: any) {
            toast.error(safeErrorMessage(e, "Failed to mark served."))
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
                    : `Ticket #${current.queueNumber} moved to HOLD.`
            )
            await refresh({ broadcast: true, tickTs: Date.now() })
        } catch (e: any) {
            toast.error(safeErrorMessage(e, "Failed to hold ticket."))
        } finally {
            setBusy(false)
        }
    }

    // ===== Dedicated queue display board mode =====
    if (boardMode) {
        const boardWindows: StaffDisplayBoardWindow[] = snapshot?.board?.windows ?? []
        const resolvedPanels = Math.max(3, panelCount, boardWindows.length)
        const panelRows: Array<StaffDisplayBoardWindow | null> = [...boardWindows]

        while (panelRows.length < resolvedPanels) panelRows.push(null)

        const columns = Math.min(4, Math.max(3, resolvedPanels >= 4 ? 4 : 3))

        const globalUpNextNumbers = (snapshot?.upNext?.length
            ? snapshot.upNext.map((t) => Number(t.queueNumber)).filter((n) => Number.isFinite(n))
            : upNext.map((t) => Number(t.queueNumber)).filter((n) => Number.isFinite(n))) as number[]

        const globalHoldNumbers = holdTickets.map((t) => Number(t.queueNumber)).filter((n) => Number.isFinite(n))

        return (
            <div className="fixed inset-0 z-50 bg-background">
                <div className="flex h-full w-full flex-col">
                    <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">Manager: {snapshot?.board?.transactionManager || "—"}</Badge>
                                <Badge variant="secondary">Panels: {resolvedPanels}</Badge>
                                <Badge variant="secondary">Windows: {boardWindows.length}</Badge>
                                <Badge variant="secondary">Generated: {fmtTime(snapshot?.meta?.generatedAt || null)}</Badge>
                                <Badge variant={autoRefresh ? "default" : "secondary"}>
                                    Auto-refresh: {autoRefresh ? `ON (${(POLL_MS / 1000).toFixed(1)}s)` : "OFF"}
                                </Badge>
                                {lastSyncedAtIso ? (
                                    <Badge variant="secondary">Last sync: {shortTime(lastSyncedAtIso)}</Badge>
                                ) : null}
                                {stateLoading ? <Badge variant="secondary">Syncing…</Badge> : null}
                                {autoRefresh ? (
                                    <Badge variant={isServingLeader ? "default" : "secondary"}>
                                        Sync leader: {isServingLeader ? "YES" : "NO"}
                                    </Badge>
                                ) : null}
                            </div>

                            <div className="mt-2">
                                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                                    Assigned departments
                                </div>
                                {assignedDepartmentItems.length ? (
                                    <div className="mt-1 flex flex-wrap gap-2">
                                        {assignedDepartmentItems.map((dep) => (
                                            <Badge key={`board-assigned-${dep.id}`} variant="outline">
                                                {departmentLabel(dep)}
                                            </Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        No assigned departments found for this staff account.
                                    </div>
                                )}
                            </div>

                            <div className="mt-2 text-sm text-muted-foreground">
                                Multi-window queue display (3+ split panes) • synchronized across all open windows
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                                <Label htmlFor="panelsBoard" className="text-sm">
                                    Panels
                                </Label>
                                <Select
                                    value={String(Math.max(3, panelCount))}
                                    onValueChange={(v) => setPanelCount(Math.max(3, Number(v || 3)))}
                                >
                                    <SelectTrigger id="panelsBoard" className="h-8 w-22.5">
                                        <SelectValue placeholder="Panels" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[3, 4, 5, 6, 7, 8].map((n) => (
                                            <SelectItem key={n} value={String(n)}>
                                                {n}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                                <Switch
                                    id="autoRefreshBoard"
                                    checked={autoRefresh}
                                    onCheckedChange={(v) => setAutoRefresh(Boolean(v))}
                                    disabled={busy}
                                />
                                <Label htmlFor="autoRefreshBoard" className="text-sm">
                                    Auto refresh
                                </Label>
                            </div>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon" aria-label="Board options">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuLabel>Board options</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={() => {
                                            const ts = Date.now()
                                            toast.message("Syncing now…")
                                            void refresh({ broadcast: true, tickTs: ts })
                                        }}
                                    >
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        Sync now
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => {
                                            const next = !autoRefresh
                                            setAutoRefresh(next)
                                            toast.message(next ? "Auto-refresh enabled." : "Auto-refresh paused.")
                                        }}
                                    >
                                        {autoRefresh ? "Pause auto-refresh" : "Resume auto-refresh"}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <Button
                                variant="secondary"
                                onClick={() => {
                                    try {
                                        window.close()
                                    } catch {
                                        // ignore
                                    }
                                }}
                            >
                                Close
                            </Button>
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
                        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                            {panelRows.map((row, idx) => {
                                if (!row) {
                                    return (
                                        <Card key={`empty-${idx}`} className="min-h-95 border-dashed">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-base">Unassigned panel</CardTitle>
                                                <CardDescription>
                                                    Add more active windows under this manager to fill this slot.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="flex h-62.5 items-center justify-center text-sm text-muted-foreground">
                                                No active window bound.
                                            </CardContent>
                                        </Card>
                                    )
                                }

                                const previewUpNext = getTwoNumberSlice(globalUpNextNumbers, idx)
                                const previewHold = getTwoNumberSlice(globalHoldNumbers, idx)

                                const currentForThisWindow =
                                    current && (current as any).windowNumber === row.number ? current : null

                                const nowServingName = getStudentFullName(row.nowServing as any)
                                const nowServingSid = getStudentId(row.nowServing as any)
                                const currentName = currentForThisWindow ? getStudentFullName(currentForThisWindow as any) : ""
                                const currentSid = currentForThisWindow ? getStudentId(currentForThisWindow as any) : ""

                                const participantLabel =
                                    nowServingName ||
                                    currentName ||
                                    (nowServingSid
                                        ? `ID/Phone: ${nowServingSid}`
                                        : currentSid
                                          ? `ID/Phone: ${currentSid}`
                                          : "")

                                return (
                                    <Card key={row.id || `window-${idx}`} className="min-h-95">
                                        <CardContent className="p-5">
                                            <div className="flex h-full flex-col">
                                                <div className="text-center text-[clamp(1rem,2.2vw,1.5rem)] font-semibold">
                                                    Window {row.number}
                                                </div>

                                                <div className="mt-4 text-center text-[clamp(1rem,2vw,1.4rem)] font-medium">
                                                    Now Serving:
                                                </div>

                                                <div className="mt-3 text-center text-[clamp(5rem,12vw,10rem)] font-bold leading-none tracking-tight">
                                                    {queueNumberLabel(row.nowServing?.queueNumber)}
                                                </div>

                                                <div className="mt-3 text-center text-sm font-semibold uppercase tracking-wide whitespace-normal wrap-break-word leading-snug">
                                                    {participantLabel || "—"}
                                                </div>

                                                <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                                                    <div className="text-center">
                                                        <div className="font-medium">up next:</div>
                                                        <div className="mt-1 leading-6">
                                                            {previewUpNext.length ? (
                                                                previewUpNext.map((n) => (
                                                                    <div key={`up-${row.id}-${n}`}>#{n}</div>
                                                                ))
                                                            ) : (
                                                                <div>—</div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="text-center">
                                                        <div className="font-medium">on hold:</div>
                                                        <div className="mt-1 leading-6">
                                                            {previewHold.length ? (
                                                                previewHold.map((n) => (
                                                                    <div key={`hold-${row.id}-${n}`}>#{n}</div>
                                                                ))
                                                            ) : (
                                                                <div>—</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-5 text-center text-xs text-muted-foreground">
                                                    {row.nowServing
                                                        ? `Called at ${fmtTime(row.nowServing.calledAt)}`
                                                        : "No active called ticket"}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const lastSmsCurrent = lastSmsLog?.current?.reliabilitySummary
    const lastSmsBadgeText =
        lastSmsLog && lastSmsCurrent
            ? lastSmsCurrent.statusLabel === "failed"
                ? "Last SMS: Failed"
                : lastSmsCurrent.statusLabel === "skipped"
                  ? "Last SMS: Skipped"
                  : lastSmsCurrent.statusLabel === "sent"
                    ? `Last SMS: ${lastSmsCurrent.deliveryStatus || "Sent"}`
                    : "Last SMS: Logged"
            : "Last SMS: —"

    const syncBadgeText = React.useMemo(() => {
        if (!assignedOk) return "Auto-refresh: —"
        if (!autoRefresh) return "Auto-refresh: OFF"
        return `Auto-refresh: ON (${(POLL_MS / 1000).toFixed(1)}s)`
    }, [assignedOk, autoRefresh])

    return (
        <DashboardLayout title="Now Serving" navItems={STAFF_NAV_ITEMS} user={dashboardUser} activePath={location.pathname}>
            <div className="grid w-full min-w-0 grid-cols-1 gap-6">
                <Card className="min-w-0">
                    <CardHeader className="gap-2">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <CardTitle className="flex items-center gap-2">
                                    <TicketIcon className="h-5 w-5" />
                                    Now Serving Board
                                </CardTitle>
                                <CardDescription>
                                    Live operator board with synchronized auto-refresh across all open windows. Open{" "}
                                    <strong>?board=1&amp;panels=3</strong> for monitor display mode.
                                </CardDescription>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <Button
                                    onClick={() => void onCallNext()}
                                    disabled={loading || busy || !assignedOk}
                                    className="w-full gap-2 sm:w-auto"
                                >
                                    <Megaphone className="h-4 w-4" />
                                    Call next
                                </Button>

                                <Button
                                    variant="outline"
                                    onClick={() => onRecallVoice()}
                                    disabled={
                                        busy ||
                                        !assignedOk ||
                                        !voiceEnabled ||
                                        !voiceSupported ||
                                        (!current?.queueNumber && !lastAnnouncedRef.current)
                                    }
                                    className="w-full gap-2 sm:w-auto"
                                >
                                    <Volume2 className="h-4 w-4" />
                                    Recall voice
                                </Button>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="icon" className="shrink-0" aria-label="Now Serving options">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-60">
                                        <DropdownMenuLabel>Now Serving options</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            onClick={() => {
                                                const ts = Date.now()
                                                toast.message("Syncing now…")
                                                void refresh({ broadcast: true, tickTs: ts })
                                            }}
                                        >
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                            Sync now
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => {
                                                const next = !autoRefresh
                                                setAutoRefresh(next)
                                                toast.message(next ? "Auto-refresh enabled." : "Auto-refresh paused.")
                                            }}
                                        >
                                            {autoRefresh ? "Pause auto-refresh" : "Resume auto-refresh"}
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <Dialog open={smsDialogOpen} onOpenChange={setSmsDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button
                                            variant="outline"
                                            disabled={busy || smsBusy || !assignedOk || !current?._id}
                                            className="w-full gap-2 sm:w-auto"
                                        >
                                            <MessageSquare className="h-4 w-4" />
                                            Send SMS
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-155">
                                        <DialogHeader>
                                            <DialogTitle>Send SMS notification</DialogTitle>
                                            <DialogDescription>
                                                Sends a reliable Semaphore SMS via backend. Includes{" "}
                                                <strong>network check (Globe/Smart)</strong> and optional{" "}
                                                <strong>advance notice</strong> to the next queue number.
                                            </DialogDescription>
                                        </DialogHeader>

                                        <div className="grid gap-4 py-1">
                                            <div className="grid gap-2">
                                                <Label htmlFor="smsSenderName">Sender name (optional)</Label>
                                                <Input
                                                    id="smsSenderName"
                                                    value={smsSenderName}
                                                    onChange={(e) => setSmsSenderName(e.target.value)}
                                                    placeholder="e.g. QUEUE"
                                                />
                                            </div>

                                            <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                                <Label htmlFor="smsAdvanceNoticeToggleDialog" className="text-sm">
                                                    Advance notice SMS (next queue)
                                                </Label>
                                                <Switch
                                                    id="smsAdvanceNoticeToggleDialog"
                                                    checked={smsAdvanceNoticeEnabled}
                                                    onCheckedChange={(v) => setSmsAdvanceNoticeEnabled(Boolean(v))}
                                                />
                                            </div>

                                            <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                                <Label htmlFor="smsUseDefaultMessage" className="text-sm">
                                                    Use default called message
                                                </Label>
                                                <Switch
                                                    id="smsUseDefaultMessage"
                                                    checked={smsUseDefaultMessage}
                                                    onCheckedChange={(v) => setSmsUseDefaultMessage(Boolean(v))}
                                                />
                                            </div>

                                            {smsUseDefaultMessage ? (
                                                <div className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">
                                                    {current
                                                        ? buildCalledSmsMessage({
                                                              departmentLabel: smsDepartmentLabel,
                                                              queueNumber: current.queueNumber,
                                                              windowNumber: windowInfo?.number,
                                                          })
                                                        : "Queue update message preview will appear when an active ticket is selected."}
                                                </div>
                                            ) : (
                                                <div className="grid gap-2">
                                                    <Label htmlFor="smsCustomMessage">Custom message</Label>
                                                    <Textarea
                                                        id="smsCustomMessage"
                                                        value={smsCustomMessage}
                                                        onChange={(e) => setSmsCustomMessage(e.target.value)}
                                                        placeholder="Type your custom SMS message..."
                                                        rows={4}
                                                    />
                                                </div>
                                            )}

                                            <div className="rounded-md border p-3 text-xs text-muted-foreground">
                                                Reliability checks enabled: <strong>Supported networks:</strong> Globe / Smart •{" "}
                                                <strong>Status:</strong> queued/sent/failed • <strong>Provider response:</strong> logged to
                                                SMS Log.
                                            </div>
                                        </div>

                                        <DialogFooter>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => setSmsDialogOpen(false)}
                                                disabled={smsBusy}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                type="button"
                                                onClick={() => void onSendSmsFromDialog()}
                                                disabled={smsBusy || !current?._id}
                                                className="gap-2"
                                            >
                                                <Send className="h-4 w-4" />
                                                {smsBusy ? "Sending..." : "Send SMS"}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>

                                <Dialog open={smsLogDialogOpen} onOpenChange={setSmsLogDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" disabled={!lastSmsLog} className="w-full gap-2 sm:w-auto">
                                            <MessageSquare className="h-4 w-4" />
                                            SMS Log
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-170">
                                        <DialogHeader>
                                            <DialogTitle>SMS Log (Reliability + Provider Response)</DialogTitle>
                                            <DialogDescription>Last send attempt details for auditing and troubleshooting.</DialogDescription>
                                        </DialogHeader>

                                        {!lastSmsLog ? (
                                            <div className="rounded-md border p-4 text-sm text-muted-foreground">No SMS logs yet.</div>
                                        ) : (
                                            <div className="grid gap-3">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge variant="secondary">At: {fmtTime(lastSmsLog.at)}</Badge>
                                                    <Badge variant="secondary">Current: #{lastSmsLog.current.queueNumber}</Badge>
                                                    <Badge variant="secondary">
                                                        Advance: {lastSmsLog.advance?.enabled ? "Enabled" : "Disabled"}
                                                    </Badge>
                                                    <Badge variant="secondary">Networks: {SMS_SUPPORTED_NETWORK_TOKENS.join(" / ")}</Badge>
                                                </div>

                                                <div className="grid gap-2">
                                                    <Label>Raw provider response (JSON)</Label>
                                                    <Textarea value={safeJson(lastSmsLog)} readOnly className="min-h-80 font-mono text-xs" />
                                                </div>
                                            </div>
                                        )}

                                        <DialogFooter>
                                            <Button type="button" onClick={() => setSmsLogDialogOpen(false)}>
                                                Close
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>

                        <Separator />

                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <Badge variant="secondary">Assigned depts: {assignedDepartmentItems.length}</Badge>
                                <Badge variant="secondary">Window: {windowInfo ? `${windowInfo.name} (#${windowInfo.number})` : "—"}</Badge>
                                <Badge variant="secondary">Manager: {snapshot?.board?.transactionManager || "—"}</Badge>
                                <Badge variant="secondary">Managed windows: {snapshot?.board?.windows?.length ?? 0}</Badge>
                                <Badge variant="secondary">{lastSmsBadgeText}</Badge>
                                {!assignedOk ? <Badge variant="destructive">Not assigned</Badge> : null}
                                {!voiceSupported ? <Badge variant="secondary">Voice unsupported</Badge> : null}
                                <Badge variant={autoRefresh ? "default" : "secondary"}>{syncBadgeText}</Badge>
                                {lastSyncedAtIso ? <Badge variant="secondary">Last sync: {shortTime(lastSyncedAtIso)}</Badge> : null}
                                {stateLoading ? <Badge variant="secondary">Syncing…</Badge> : null}
                                {autoRefresh && assignedOk ? (
                                    <Badge variant={isServingLeader ? "default" : "secondary"}>
                                        Sync leader: {isServingLeader ? "YES" : "NO"}
                                    </Badge>
                                ) : null}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                                    <Switch
                                        id="autoRefresh"
                                        checked={autoRefresh}
                                        onCheckedChange={(v) => {
                                            const next = Boolean(v)
                                            setAutoRefresh(next)
                                            toast.message(next ? "Auto-refresh enabled." : "Auto-refresh paused.")
                                        }}
                                        disabled={busy}
                                    />
                                    <Label htmlFor="autoRefresh" className="text-sm">
                                        Auto refresh
                                    </Label>
                                </div>

                                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
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

                                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                                    <Switch
                                        id="autoSmsOnCall"
                                        checked={autoSmsOnCall}
                                        onCheckedChange={(v) => setAutoSmsOnCall(Boolean(v))}
                                        disabled={busy || smsBusy || !assignedOk}
                                    />
                                    <Label htmlFor="autoSmsOnCall" className="text-sm">
                                        Auto SMS on call
                                    </Label>
                                </div>

                                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                                    <Switch
                                        id="smsAdvanceNoticeToggle"
                                        checked={smsAdvanceNoticeEnabled}
                                        onCheckedChange={(v) => setSmsAdvanceNoticeEnabled(Boolean(v))}
                                        disabled={busy || smsBusy || !assignedOk}
                                    />
                                    <Label htmlFor="smsAdvanceNoticeToggle" className="text-sm">
                                        Advance notice SMS
                                    </Label>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-3 rounded-lg border p-3 lg:grid-cols-2">
                            <div>
                                <div className="text-xs uppercase tracking-widest text-muted-foreground">Assigned departments</div>
                                {assignedDepartmentItems.length ? (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {assignedDepartmentItems.map((dep) => (
                                            <Badge key={`assigned-${dep.id}`} variant="outline">
                                                {departmentLabel(dep)}
                                            </Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="mt-2 text-xs text-muted-foreground">
                                        No assigned departments found for this staff account.
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                                    Handled departments (effective scope)
                                </div>
                                {handledDepartmentItems.length ? (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {handledDepartmentItems.map((dep) => (
                                            <Badge key={`handled-${dep.id}`} variant="secondary">
                                                {departmentLabel(dep)}
                                            </Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="mt-2 text-xs text-muted-foreground">No handled departments available.</div>
                                )}
                            </div>
                        </div>

                        <div className="grid gap-3 rounded-lg border p-3 lg:grid-cols-12">
                            <div className="lg:col-span-3">
                                <Label htmlFor="monitorSelect" className="mb-2 block text-sm">
                                    Display monitor
                                </Label>
                                <Select
                                    value={selectedMonitorId || undefined}
                                    onValueChange={setSelectedMonitorId}
                                    disabled={loadingMonitors || !monitorOptions.length}
                                >
                                    <SelectTrigger id="monitorSelect" className="w-full">
                                        <SelectValue placeholder="Select monitor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {monitorOptions.map((m) => (
                                            <SelectItem key={m.id} value={m.id}>
                                                {m.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="lg:col-span-2">
                                <Label htmlFor="panelCountSelect" className="mb-2 block text-sm">
                                    Split panels
                                </Label>
                                <Select value={String(panelCount)} onValueChange={(v) => setPanelCount(Math.max(3, Number(v || 3)))}>
                                    <SelectTrigger id="panelCountSelect" className="w-full">
                                        <SelectValue placeholder="Panels" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[3, 4, 5, 6, 7, 8].map((n) => (
                                            <SelectItem key={n} value={String(n)}>
                                                {n}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="lg:col-span-3">
                                <Label htmlFor="voiceTypeSelect" className="mb-2 block text-sm">
                                    Announcement voice (English)
                                </Label>
                                <Select
                                    value={selectedVoiceType}
                                    onValueChange={(v) => setSelectedVoiceType(v === "man" ? "man" : "woman")}
                                    disabled={!voiceSupported}
                                >
                                    <SelectTrigger id="voiceTypeSelect" className="w-full">
                                        <SelectValue placeholder="Select voice type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="woman">Woman ({formatVoiceLabel(resolvedEnglishVoices.woman)})</SelectItem>
                                        <SelectItem value="man">Man ({formatVoiceLabel(resolvedEnglishVoices.man)})</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col justify-end gap-2 lg:col-span-2">
                                <Button
                                    variant="outline"
                                    className="w-full gap-2"
                                    onClick={() => void loadMonitorOptions(false)}
                                    disabled={loadingMonitors}
                                >
                                    <Monitor className="h-4 w-4" />
                                    {loadingMonitors ? "Scanning..." : "Refresh monitors"}
                                </Button>
                            </div>

                            <div className="flex flex-col justify-end gap-2 lg:col-span-2">
                                <Button className="w-full gap-2" onClick={openBoardOnSelectedMonitor} disabled={!monitorOptions.length}>
                                    <ExternalLink className="h-4 w-4" />
                                    Open queue board
                                </Button>
                            </div>

                            <div className="lg:col-span-12 text-xs text-muted-foreground">
                                {monitorApiSupported
                                    ? "Monitor hardware picker is active. Window placement uses browser window-management support."
                                    : "Monitor hardware API not available in this browser context. Fallback opens on current monitor."}
                            </div>

                            <div className="lg:col-span-12 text-xs text-muted-foreground">
                                Voice engine: react-text-to-speech • English only • Woman: {formatVoiceLabel(resolvedEnglishVoices.woman)} • Man:{" "}
                                {formatVoiceLabel(resolvedEnglishVoices.man)}
                            </div>

                            <div className="lg:col-span-12 text-xs text-muted-foreground">
                                SMS engine: Semaphore via backend • <strong>Reliability:</strong> network check ({SMS_SUPPORTED_NETWORK_TOKENS.join(" / ")})
                                + status + provider response log • <strong>Advance notice:</strong>{" "}
                                {smsAdvanceNoticeEnabled ? "Enabled" : "Disabled"}
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="min-w-0">
                        {loading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-60 w-full" />
                                <Skeleton className="h-36 w-full" />
                            </div>
                        ) : (
                            <div className="grid gap-6 lg:grid-cols-12">
                                <Card className="lg:col-span-8">
                                    <CardHeader>
                                        <CardTitle>Active ticket billboard</CardTitle>
                                        <CardDescription>This panel is optimized for quick staff operation.</CardDescription>
                                    </CardHeader>

                                    <CardContent className="space-y-4">
                                        {current ? (
                                            <>
                                                <div className="rounded-2xl border bg-muted p-6">
                                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                        <div className="min-w-0">
                                                            <div className="text-xs uppercase tracking-widest text-muted-foreground">
                                                                Now serving
                                                            </div>
                                                            <div className="mt-2 text-7xl font-semibold tracking-tight">#{current.queueNumber}</div>

                                                            <div className="mt-3 text-sm text-muted-foreground">
                                                                Participant:{" "}
                                                                <span className="font-medium text-foreground whitespace-normal wrap-break-word">
                                                                    {getStudentFullName(current) || "—"}
                                                                </span>
                                                            </div>

                                                            <div className="text-sm text-muted-foreground">
                                                                ID/Phone: <span className="tabular-nums">{getStudentId(current) || "—"}</span>
                                                            </div>

                                                            <div className="text-sm text-muted-foreground">Called at: {fmtTime((current as any).calledAt)}</div>
                                                        </div>

                                                        <div className="flex flex-col items-start gap-2 md:items-end">
                                                            <Badge>CALLED</Badge>
                                                            <div className="text-xs text-muted-foreground">Hold attempts: {current.holdAttempts ?? 0}</div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={() => setSmsDialogOpen(true)}
                                                        disabled={busy || smsBusy || !current?._id}
                                                        className="w-full gap-2 sm:w-auto"
                                                    >
                                                        <MessageSquare className="h-4 w-4" />
                                                        Send SMS
                                                    </Button>

                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        onClick={() => void onHoldNoShow()}
                                                        disabled={busy}
                                                        className="w-full gap-2 sm:w-auto"
                                                    >
                                                        <PauseCircle className="h-4 w-4" />
                                                        Hold / No-show
                                                    </Button>

                                                    <Button type="button" onClick={() => void onServed()} disabled={busy} className="w-full gap-2 sm:w-auto">
                                                        <CheckCircle2 className="h-4 w-4" />
                                                        Mark served
                                                    </Button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                                                No ticket is currently called for your window.
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card className="lg:col-span-4">
                                    <CardHeader>
                                        <CardTitle>Operator rail</CardTitle>
                                        <CardDescription>Quick view of next and hold queues.</CardDescription>
                                    </CardHeader>

                                    <CardContent className="space-y-4">
                                        <div>
                                            <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Up next</div>
                                            {upNext.length === 0 ? (
                                                <div className="rounded-lg border p-4 text-sm text-muted-foreground">No WAITING tickets.</div>
                                            ) : (
                                                <div className="grid gap-2">
                                                    {upNext.slice(0, 6).map((t, idx) => {
                                                        const name = getStudentFullName(t)
                                                        const sid = getStudentId(t)

                                                        return (
                                                            <div key={t._id} className="flex items-start justify-between gap-3 rounded-xl border p-3">
                                                                <div className="min-w-0">
                                                                    <div className="text-xl font-semibold tabular-nums">#{t.queueNumber}</div>
                                                                    <div className="mt-1 font-medium whitespace-normal wrap-break-word leading-snug">{name || "—"}</div>
                                                                    <div className="mt-1 text-xs text-muted-foreground">
                                                                        ID/Phone: <span className="tabular-nums">{sid || "—"}</span>
                                                                    </div>
                                                                </div>

                                                                <div className="shrink-0 text-right text-xs text-muted-foreground">
                                                                    <div>{idx === 0 ? "Next" : "Waiting"}</div>
                                                                    <div>{fmtTime((t as any).waitingSince)}</div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">On hold</div>
                                            {holdTickets.length === 0 ? (
                                                <div className="rounded-lg border p-4 text-sm text-muted-foreground">No HOLD tickets.</div>
                                            ) : (
                                                <div className="flex flex-wrap gap-2">
                                                    {holdTickets.slice(0, 8).map((t) => (
                                                        <Badge key={`hold-${t._id}`} variant="secondary" className="px-3 py-1 text-sm">
                                                            #{t.queueNumber}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="lg:col-span-12">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <LayoutGrid className="h-4 w-4" />
                                            Manager multi-window preview
                                        </CardTitle>
                                        <CardDescription>
                                            Queue display layout mirrors window cards: big number + participant label + up next + on hold.
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent>
                                        {snapshot?.board?.windows?.length ? (
                                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                                {snapshot.board.windows.map((w, idx) => {
                                                    const previewUpNext = getTwoNumberSlice(
                                                        (snapshot?.upNext?.map((t) => Number(t.queueNumber)).filter((n) =>
                                                            Number.isFinite(n)
                                                        ) as number[]) || [],
                                                        idx
                                                    )
                                                    const previewHold = getTwoNumberSlice(
                                                        holdTickets.map((t) => Number(t.queueNumber)).filter((n) => Number.isFinite(n)),
                                                        idx
                                                    )

                                                    const currentForThisWindow = current && (current as any).windowNumber === w.number ? current : null

                                                    const nowServingName = getStudentFullName(w.nowServing as any)
                                                    const nowServingSid = getStudentId(w.nowServing as any)
                                                    const currentName = currentForThisWindow ? getStudentFullName(currentForThisWindow as any) : ""
                                                    const currentSid = currentForThisWindow ? getStudentId(currentForThisWindow as any) : ""

                                                    const participantLabel =
                                                        nowServingName ||
                                                        currentName ||
                                                        (nowServingSid ? `ID/Phone: ${nowServingSid}` : currentSid ? `ID/Phone: ${currentSid}` : "")

                                                    return (
                                                        <div key={w.id} className="rounded-xl border p-4">
                                                            <div className="text-center text-lg font-semibold">Window {w.number}</div>
                                                            <div className="mt-3 text-center text-base font-medium">Now Serving:</div>
                                                            <div className="mt-2 text-center text-[clamp(3.4rem,8vw,6rem)] font-bold leading-none">
                                                                {queueNumberLabel(w.nowServing?.queueNumber)}
                                                            </div>
                                                            <div className="mt-2 text-center text-xs font-semibold uppercase tracking-wide whitespace-normal wrap-break-word leading-snug">
                                                                {participantLabel || "—"}
                                                            </div>

                                                            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                                                                <div className="text-center">
                                                                    <div className="font-medium">up next:</div>
                                                                    <div className="mt-1 leading-5">
                                                                        {previewUpNext.length ? (
                                                                            previewUpNext.map((n) => <div key={`preview-up-${w.id}-${n}`}>#{n}</div>)
                                                                        ) : (
                                                                            <div>—</div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="text-center">
                                                                    <div className="font-medium">on hold:</div>
                                                                    <div className="mt-1 leading-5">
                                                                        {previewHold.length ? (
                                                                            previewHold.map((n) => <div key={`preview-hold-${w.id}-${n}`}>#{n}</div>)
                                                                        ) : (
                                                                            <div>—</div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                                                No active windows found for your current manager scope.
                                            </div>
                                        )}
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