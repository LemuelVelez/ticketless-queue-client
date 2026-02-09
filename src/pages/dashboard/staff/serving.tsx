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

function fmtTime(v?: string | null) {
    if (!v) return "—"
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleString()
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
    return (
        typeof window !== "undefined" &&
        "speechSynthesis" in window &&
        "SpeechSynthesisUtterance" in window
    )
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
    return (
        containsAnyHint(blob, WOMAN_VOICE_HINTS) ||
        /(?:^|[-_ ])f(?:$|[-_ 0-9])/i.test(blob)
    )
}

function isLikelyManVoice(v: SpeechSynthesisVoice) {
    const blob = `${v.name || ""} ${v.voiceURI || ""}`.toLowerCase()
    return (
        containsAnyHint(blob, MAN_VOICE_HINTS) ||
        /(?:^|[-_ ])m(?:$|[-_ 0-9])/i.test(blob)
    )
}

function resolveGenderedEnglishVoices(list: SpeechSynthesisVoice[]): {
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
            transactionManager:
                typeof item?.transactionManager === "string" ? item.transactionManager : null,
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

function defaultSmsCalledMessage(queueNumber: number, windowNumber?: number) {
    const windowText = typeof windowNumber === "number" ? ` at Window ${windowNumber}` : ""
    return `Queue update: Your ticket #${queueNumber} is now being served${windowText}.`
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
    const [busy, setBusy] = React.useState(false)

    const [departmentId, setDepartmentId] = React.useState<string | null>(null)
    const [windowInfo, setWindowInfo] = React.useState<{ id: string; name: string; number: number } | null>(null)
    const [assignedDepartments, setAssignedDepartments] = React.useState<DepartmentAssignment[]>([])
    const [handledDepartments, setHandledDepartments] = React.useState<DepartmentAssignment[]>([])

    const [current, setCurrent] = React.useState<TicketType | null>(null)
    const [upNext, setUpNext] = React.useState<TicketType[]>([])
    const [holdTickets, setHoldTickets] = React.useState<TicketType[]>([])
    const [snapshot, setSnapshot] = React.useState<StaffDisplaySnapshotResponse | null>(null)

    const [autoRefresh, setAutoRefresh] = React.useState(true)

    const [panelCount, setPanelCount] = React.useState<number>(() => parsePanelCount(location.search, 3))

    // -------- Monitor selection (multi-display) --------
    const [monitorOptions, setMonitorOptions] = React.useState<MonitorOption[]>([])
    const [selectedMonitorId, setSelectedMonitorId] = React.useState<string>("")
    const [monitorApiSupported, setMonitorApiSupported] = React.useState(false)
    const [loadingMonitors, setLoadingMonitors] = React.useState(false)
    const monitorWarnedRef = React.useRef(false)

    const assignedDepartmentItems = React.useMemo(
        () => uniqueDepartmentAssignments(assignedDepartments),
        [assignedDepartments],
    )
    const handledDepartmentItems = React.useMemo(
        () => uniqueDepartmentAssignments(handledDepartments),
        [handledDepartments],
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
    const [smsDialogOpen, setSmsDialogOpen] = React.useState(false)
    const [smsBusy, setSmsBusy] = React.useState(false)
    const [smsUseDefaultMessage, setSmsUseDefaultMessage] = React.useState(true)
    const [smsCustomMessage, setSmsCustomMessage] = React.useState("")
    const [smsSenderName, setSmsSenderName] = React.useState("")

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
        [voices],
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

    const speak = React.useCallback((text: string) => {
        if (!voiceSupported) return

        const preferred =
            selectedVoiceType === "woman"
                ? resolvedEnglishVoices.woman
                : resolvedEnglishVoices.man

        const fallback =
            selectedVoiceType === "woman"
                ? resolvedEnglishVoices.man
                : resolvedEnglishVoices.woman

        const voiceURI =
            preferred?.voiceURI ||
            fallback?.voiceURI ||
            resolvedEnglishVoices.english[0]?.voiceURI

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
    }, [resolvedEnglishVoices, selectedVoiceType, speakWithPackage, stopSpeech, voiceSupported])

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
            const text = win
                ? `Number ${queueNumber}, please proceed to window ${win}.`
                : `Number ${queueNumber}.`

            speak(text)
        },
        [speak, voiceEnabled, voiceSupported, windowInfo?.number],
    )

    const onRecallVoice = React.useCallback(() => {
        const n = current?.queueNumber ?? lastAnnouncedRef.current
        if (!n) return toast.message("No ticket to announce.")
        announceCall(n)
    }, [announceCall, current?.queueNumber])

    const sendCalledSms = React.useCallback(
        async (
            ticket: TicketType,
            opts?: { message?: string; senderName?: string; toastOnSuccess?: boolean },
        ) => {
            if (!ticket?._id) {
                toast.error("No active ticket selected for SMS.")
                return false
            }

            setSmsBusy(true)
            try {
                const message = String(opts?.message ?? "").trim()
                const senderName = String(opts?.senderName ?? "").trim()

                const payload = {
                    ...(message ? { message } : {}),
                    ...(senderName ? { senderName } : {}),
                }

                const res = await staffApi.sendTicketCalledSms(ticket._id, payload)

                if (opts?.toastOnSuccess !== false) {
                    toast.success(
                        `SMS sent for #${ticket.queueNumber}${res?.number ? ` to ${res.number}` : ""}.`,
                    )
                }

                return true
            } catch (e: any) {
                toast.error(e?.message ?? "Failed to send SMS.")
                return false
            } finally {
                setSmsBusy(false)
            }
        },
        [],
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
        })

        if (!ok) return

        setSmsDialogOpen(false)
        setSmsUseDefaultMessage(true)
        setSmsCustomMessage("")
    }, [current, sendCalledSms, smsCustomMessage, smsSenderName, smsUseDefaultMessage])

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

    const refresh = React.useCallback(async () => {
        try {
            const a = await staffApi.myAssignment()
            setDepartmentId(a.departmentId ?? null)
            setWindowInfo(a.window ? { id: a.window._id, name: a.window.name, number: a.window.number } : null)

            const normalizedAssigned = uniqueDepartmentAssignments(a.assignedDepartments)
            const normalizedHandled = uniqueDepartmentAssignments(a.handledDepartments)

            setAssignedDepartments(normalizedAssigned)
            setHandledDepartments(normalizedHandled.length ? normalizedHandled : normalizedAssigned)

            const [snapshotResult, currentResult, waitingResult, holdResult] = await Promise.all([
                staffApi.getDisplaySnapshot().catch(() => null),
                a.departmentId && a.window?._id
                    ? staffApi.currentCalledForWindow().catch(() => ({ ticket: null }))
                    : Promise.resolve({ ticket: null }),
                a.departmentId && a.window?._id
                    ? staffApi.listWaiting({ limit: 16 }).catch(() => ({ tickets: [] }))
                    : Promise.resolve({ tickets: [] }),
                a.departmentId && a.window?._id
                    ? staffApi.listHold({ limit: 16 }).catch(() => ({ tickets: [] }))
                    : Promise.resolve({ tickets: [] }),
            ])

            const snapshotHandled = uniqueDepartmentAssignments(snapshotResult?.department?.handledDepartments)
            if (!normalizedHandled.length && snapshotHandled.length) {
                setHandledDepartments(snapshotHandled)
            }
            if (!normalizedAssigned.length && snapshotHandled.length) {
                setAssignedDepartments(snapshotHandled)
            }

            setSnapshot(snapshotResult ?? null)
            setCurrent(currentResult.ticket ?? null)

            // Prefer explicit queue list for operator mode, but fallback to snapshot upNext if needed.
            const explicit = waitingResult.tickets ?? []
            if (explicit.length) {
                setUpNext(explicit)
            } else if (snapshotResult?.upNext?.length) {
                setUpNext(snapshotResult.upNext.map(mapBoardWindowToTicketLike))
            } else {
                setUpNext([])
            }

            setHoldTickets(holdResult.tickets ?? [])
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to load now serving.")
        }
    }, [])

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

    React.useEffect(() => {
        ; (async () => {
            setLoading(true)
            try {
                await refresh()
            } finally {
                setLoading(false)
            }
        })()
    }, [refresh])

    React.useEffect(() => {
        if (boardMode) return
        void loadMonitorOptions(true)
    }, [boardMode, loadMonitorOptions])

    React.useEffect(() => {
        if (!autoRefresh) return
        const t = window.setInterval(() => {
            void refresh()
        }, 5000)
        return () => window.clearInterval(t)
    }, [autoRefresh, refresh])

    async function onCallNext() {
        if (!assignedOk) return toast.error("You are not assigned to a department/window.")
        setBusy(true)
        try {
            const res = await staffApi.callNext()
            setCurrent(res.ticket)
            toast.success(`Called #${res.ticket.queueNumber}`)
            announceCall(res.ticket.queueNumber)

            if (autoSmsOnCall) {
                await sendCalledSms(res.ticket, { toastOnSuccess: true })
            }

            await refresh()
        } catch (e: any) {
            toast.error(e?.message ?? "No waiting tickets.")
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
            await refresh()
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
            await refresh()
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to hold ticket.")
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
            : upNext.map((t) => Number(t.queueNumber)).filter((n) => Number.isFinite(n))
        ) as number[]

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
                                <Badge variant="secondary">
                                    Generated: {fmtTime(snapshot?.meta?.generatedAt || null)}
                                </Badge>
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
                                Multi-window queue display (3+ split panes) • auto refresh every 5s
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                                <Label htmlFor="panelsBoard" className="text-sm">Panels</Label>
                                <Select
                                    value={String(Math.max(3, panelCount))}
                                    onValueChange={(v) => setPanelCount(Math.max(3, Number(v || 3)))}
                                >
                                    <SelectTrigger id="panelsBoard" className="h-8 w-[90px]">
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

                            <Button variant="outline" onClick={() => void refresh()} disabled={loading || busy} className="gap-2">
                                <RefreshCw className="h-4 w-4" />
                                Refresh
                            </Button>

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
                        <div
                            className="grid gap-4"
                            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                        >
                            {panelRows.map((row, idx) => {
                                if (!row) {
                                    return (
                                        <Card key={`empty-${idx}`} className="min-h-[380px] border-dashed">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-base">Unassigned panel</CardTitle>
                                                <CardDescription>
                                                    Add more active windows under this manager to fill this slot.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
                                                No active window bound.
                                            </CardContent>
                                        </Card>
                                    )
                                }

                                const previewUpNext = getTwoNumberSlice(globalUpNextNumbers, idx)
                                const previewHold = getTwoNumberSlice(globalHoldNumbers, idx)

                                const currentForThisWindow =
                                    current && current.windowNumber === row.number ? current : null

                                const studentLabel =
                                    (row.nowServing as any)?.studentName ||
                                    (row.nowServing as any)?.studentId ||
                                    (currentForThisWindow?.studentId ? `STUDENT ID: ${currentForThisWindow.studentId}` : "NAME OF STUDENT")

                                return (
                                    <Card key={row.id || `window-${idx}`} className="min-h-[380px]">
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

                                                <div className="mt-3 text-center text-sm font-semibold uppercase tracking-wide">
                                                    {studentLabel}
                                                </div>

                                                <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                                                    <div className="text-center">
                                                        <div className="font-medium">up next:</div>
                                                        <div className="mt-1 leading-6">
                                                            {previewUpNext.length
                                                                ? previewUpNext.map((n) => (
                                                                    <div key={`up-${row.id}-${n}`}>#{n}</div>
                                                                ))
                                                                : <div>—</div>}
                                                        </div>
                                                    </div>

                                                    <div className="text-center">
                                                        <div className="font-medium">on hold:</div>
                                                        <div className="mt-1 leading-6">
                                                            {previewHold.length
                                                                ? previewHold.map((n) => (
                                                                    <div key={`hold-${row.id}-${n}`}>#{n}</div>
                                                                ))
                                                                : <div>—</div>}
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
                                    Dedicated operator board for live calling. Open <strong>?board=1&amp;panels=3</strong> for monitor display mode.
                                </CardDescription>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <Button
                                    variant="outline"
                                    onClick={() => void refresh()}
                                    disabled={loading || busy}
                                    className="w-full gap-2 sm:w-auto"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Refresh
                                </Button>

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
                                    <DialogContent className="sm:max-w-[620px]">
                                        <DialogHeader>
                                            <DialogTitle>Send SMS notification</DialogTitle>
                                            <DialogDescription>
                                                Notify the current ticket via Semaphore SMS.
                                                {current
                                                    ? ` Ticket #${current.queueNumber} • Student ID: ${current.studentId || "—"}`
                                                    : " No active ticket selected."}
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
                                                        ? defaultSmsCalledMessage(current.queueNumber, windowInfo?.number)
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
                            </div>
                        </div>

                        <Separator />

                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <Badge variant="secondary">Assigned depts: {assignedDepartmentItems.length}</Badge>
                                <Badge variant="secondary">
                                    Window: {windowInfo ? `${windowInfo.name} (#${windowInfo.number})` : "—"}
                                </Badge>
                                <Badge variant="secondary">
                                    Manager: {snapshot?.board?.transactionManager || "—"}
                                </Badge>
                                <Badge variant="secondary">
                                    Managed windows: {snapshot?.board?.windows?.length ?? 0}
                                </Badge>
                                <Badge variant="secondary">
                                    SMS: {smsBusy ? "Sending..." : autoSmsOnCall ? "Auto on call" : "Manual"}
                                </Badge>
                                {!assignedOk ? <Badge variant="destructive">Not assigned</Badge> : null}
                                {!voiceSupported ? <Badge variant="secondary">Voice unsupported</Badge> : null}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                                    <Switch
                                        id="autoRefresh"
                                        checked={autoRefresh}
                                        onCheckedChange={(v) => setAutoRefresh(Boolean(v))}
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
                            </div>
                        </div>

                        <div className="grid gap-3 rounded-lg border p-3 lg:grid-cols-2">
                            <div>
                                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                                    Assigned departments
                                </div>
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
                                    <div className="mt-2 text-xs text-muted-foreground">
                                        No handled departments available.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid gap-3 rounded-lg border p-3 lg:grid-cols-12">
                            <div className="lg:col-span-3">
                                <Label htmlFor="monitorSelect" className="mb-2 block text-sm">Display monitor</Label>
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
                                <Label htmlFor="panelCountSelect" className="mb-2 block text-sm">Split panels</Label>
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
                                <Label htmlFor="voiceTypeSelect" className="mb-2 block text-sm">Announcement voice (English)</Label>
                                <Select
                                    value={selectedVoiceType}
                                    onValueChange={(v) => setSelectedVoiceType(v === "man" ? "man" : "woman")}
                                    disabled={!voiceSupported}
                                >
                                    <SelectTrigger id="voiceTypeSelect" className="w-full">
                                        <SelectValue placeholder="Select voice type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="woman">
                                            Woman ({formatVoiceLabel(resolvedEnglishVoices.woman)})
                                        </SelectItem>
                                        <SelectItem value="man">
                                            Man ({formatVoiceLabel(resolvedEnglishVoices.man)})
                                        </SelectItem>
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
                                <Button
                                    className="w-full gap-2"
                                    onClick={openBoardOnSelectedMonitor}
                                    disabled={!monitorOptions.length}
                                >
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
                                Voice engine: react-text-to-speech • English only • Woman: {formatVoiceLabel(resolvedEnglishVoices.woman)} • Man: {formatVoiceLabel(resolvedEnglishVoices.man)}
                            </div>

                            <div className="lg:col-span-12 text-xs text-muted-foreground">
                                SMS engine: Semaphore via backend • {autoSmsOnCall ? "Auto send is enabled when calling next." : "Manual send mode is enabled."}
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
                                {/* Main billboard */}
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
                                                        <div>
                                                            <div className="text-xs uppercase tracking-widest text-muted-foreground">
                                                                Now serving
                                                            </div>
                                                            <div className="mt-2 text-7xl font-semibold tracking-tight">
                                                                #{current.queueNumber}
                                                            </div>
                                                            <div className="mt-3 text-sm text-muted-foreground">
                                                                Student ID: {current.studentId ?? "—"}
                                                            </div>
                                                            <div className="text-sm text-muted-foreground">
                                                                Called at: {fmtTime((current as any).calledAt)}
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col items-start gap-2 md:items-end">
                                                            <Badge>CALLED</Badge>
                                                            <div className="text-xs text-muted-foreground">
                                                                Hold attempts: {current.holdAttempts ?? 0}
                                                            </div>
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

                                                    <Button
                                                        type="button"
                                                        onClick={() => void onServed()}
                                                        disabled={busy}
                                                        className="w-full gap-2 sm:w-auto"
                                                    >
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

                                {/* Operator side rail */}
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
                                                    {upNext.slice(0, 6).map((t, idx) => (
                                                        <div key={t._id} className="flex items-center justify-between rounded-xl border p-3">
                                                            <div className="text-xl font-semibold">#{t.queueNumber}</div>
                                                            <div className="text-right text-xs text-muted-foreground">
                                                                <div>{idx === 0 ? "Next" : "Waiting"}</div>
                                                                <div>{fmtTime((t as any).waitingSince)}</div>
                                                            </div>
                                                        </div>
                                                    ))}
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

                                {/* Multi-window manager preview */}
                                <Card className="lg:col-span-12">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <LayoutGrid className="h-4 w-4" />
                                            Manager multi-window preview
                                        </CardTitle>
                                        <CardDescription>
                                            Queue display layout mirrors window cards: big number + student label + up next + on hold.
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent>
                                        {snapshot?.board?.windows?.length ? (
                                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                                {snapshot.board.windows.map((w, idx) => {
                                                    const previewUpNext = getTwoNumberSlice(
                                                        (snapshot?.upNext?.map((t) => Number(t.queueNumber)).filter((n) => Number.isFinite(n)) as number[]) || [],
                                                        idx,
                                                    )
                                                    const previewHold = getTwoNumberSlice(
                                                        holdTickets.map((t) => Number(t.queueNumber)).filter((n) => Number.isFinite(n)),
                                                        idx,
                                                    )

                                                    const currentForThisWindow =
                                                        current && current.windowNumber === w.number ? current : null

                                                    const studentLabel =
                                                        (w.nowServing as any)?.studentName ||
                                                        (w.nowServing as any)?.studentId ||
                                                        (currentForThisWindow?.studentId ? `STUDENT ID: ${currentForThisWindow.studentId}` : "NAME OF STUDENT")

                                                    return (
                                                        <div key={w.id} className="rounded-xl border p-4">
                                                            <div className="text-center text-lg font-semibold">
                                                                Window {w.number}
                                                            </div>
                                                            <div className="mt-3 text-center text-base font-medium">Now Serving:</div>
                                                            <div className="mt-2 text-center text-[clamp(3.4rem,8vw,6rem)] font-bold leading-none">
                                                                {queueNumberLabel(w.nowServing?.queueNumber)}
                                                            </div>
                                                            <div className="mt-2 text-center text-xs font-semibold uppercase tracking-wide">
                                                                {studentLabel}
                                                            </div>

                                                            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                                                                <div className="text-center">
                                                                    <div className="font-medium">up next:</div>
                                                                    <div className="mt-1 leading-5">
                                                                        {previewUpNext.length
                                                                            ? previewUpNext.map((n) => (
                                                                                <div key={`preview-up-${w.id}-${n}`}>#{n}</div>
                                                                            ))
                                                                            : <div>—</div>}
                                                                    </div>
                                                                </div>
                                                                <div className="text-center">
                                                                    <div className="font-medium">on hold:</div>
                                                                    <div className="mt-1 leading-5">
                                                                        {previewHold.length
                                                                            ? previewHold.map((n) => (
                                                                                <div key={`preview-hold-${w.id}-${n}`}>#{n}</div>
                                                                            ))
                                                                            : <div>—</div>}
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
