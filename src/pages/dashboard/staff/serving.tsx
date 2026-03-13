/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import { useSpeak, useVoices } from "react-text-to-speech"

import { DashboardLayout } from "@/components/dashboard-layout"
import { STAFF_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"

import { useSession } from "@/hooks/use-session"
import {
    staffApi,
    type DepartmentAssignment,
    type StaffDisplaySnapshotResponse,
    type Ticket as TicketType,
} from "@/api/staff"

import { Card, CardContent } from "@/components/ui/card"

import { StaffServingBoardMode } from "@/components/staff-serving/board-mode"
import { StaffServingControlPanel } from "@/components/staff-serving/control-panel"
import { StaffServingOperatorView } from "@/components/staff-serving/operator-view"
import { StaffServingSmsDialog } from "@/components/staff-serving/sms-dialog"
import {
    buildNowServingAnnouncement,
    defaultSmsCalledMessage,
    formatStatusSummary,
    getParticipantDetails,
    getTransactionPurposeText,
    isSpeechSupported,
    looksLikePhoneNumber,
    mapBoardWindowToTicketLike,
    normalizeLangTag,
    normalizeSmsSenderOption,
    normalizeTtsText,
    parseBool,
    parsePanelCount,
    resolveGenderedEnglishVoices,
    SMS_SENDING_AVAILABLE,
    SMS_UNAVAILABLE_NOTICE,
    uniqueDepartmentAssignments,
    type AnnouncementVoiceOption,
    type MonitorOption,
    type SmsSenderOption,
    type WindowWithScreenDetails,
} from "@/components/staff-serving/utils"

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

    const [monitorOptions, setMonitorOptions] = React.useState<MonitorOption[]>([])
    const [selectedMonitorId, setSelectedMonitorId] = React.useState<string>("")
    const [monitorApiSupported, setMonitorApiSupported] = React.useState(false)
    const [loadingMonitors, setLoadingMonitors] = React.useState(false)
    const monitorWarnedRef = React.useRef(false)

    const assignedDepartmentItems = React.useMemo(() => uniqueDepartmentAssignments(assignedDepartments), [assignedDepartments])
    const handledDepartmentItems = React.useMemo(() => uniqueDepartmentAssignments(handledDepartments), [handledDepartments])

    const assignedOk = Boolean(departmentId && windowInfo?.id)

    const [voiceEnabled, setVoiceEnabled] = React.useState(true)
    const [voiceSupported, setVoiceSupported] = React.useState(true)
    const [selectedVoiceType, setSelectedVoiceType] = React.useState<AnnouncementVoiceOption>("woman")
    const voiceUnsupportedWarnedRef = React.useRef(false)
    const englishVoiceWarnedRef = React.useRef(false)
    const lastAnnouncedRef = React.useRef<number | null>(null)

    const speakTimerRef = React.useRef<number | null>(null)

    const ANNOUNCEMENT_RATE = 0.92
    const ANNOUNCEMENT_PITCH = 1.02
    const ANNOUNCEMENT_GAP_MS = 140

    const [autoSmsOnCall, setAutoSmsOnCall] = React.useState(false)
    const [smsDialogOpen, setSmsDialogOpen] = React.useState(false)
    const [smsBusy, setSmsBusy] = React.useState(false)
    const [smsUseDefaultMessage, setSmsUseDefaultMessage] = React.useState(true)
    const [smsCustomMessage, setSmsCustomMessage] = React.useState("")

    const [smsSenderOption, setSmsSenderOption] = React.useState<SmsSenderOption>("default")
    const [smsSenderCustom, setSmsSenderCustom] = React.useState("")

    const resolvedSenderName = React.useMemo(() => {
        if (smsSenderOption === "custom") return String(smsSenderCustom || "").trim()
        if (smsSenderOption === "default") return ""
        return String(smsSenderOption || "").trim()
    }, [smsSenderCustom, smsSenderOption])

    React.useEffect(() => {
        if (!SMS_SENDING_AVAILABLE && autoSmsOnCall) setAutoSmsOnCall(false)
    }, [autoSmsOnCall])

    React.useEffect(() => {
        if (typeof window === "undefined") return
        try {
            const savedOpt = window.localStorage.getItem("staff_sms_sender_option")
            const savedCustom = window.localStorage.getItem("staff_sms_sender_custom")
            if (savedOpt) setSmsSenderOption(normalizeSmsSenderOption(savedOpt))
            if (savedCustom) setSmsSenderCustom(String(savedCustom))
        } catch {
            // ignore
        }
    }, [])

    React.useEffect(() => {
        if (typeof window === "undefined") return
        try {
            window.localStorage.setItem("staff_sms_sender_option", smsSenderOption)
            window.localStorage.setItem("staff_sms_sender_custom", smsSenderCustom)
        } catch {
            // ignore
        }
    }, [smsSenderCustom, smsSenderOption])

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
        if (!boardMode) return
        setPanelCount(parsePanelCount(location.search, 3))
    }, [boardMode, location.search])

    React.useEffect(() => {
        if (!voiceSupported) return
        if (!Array.isArray(voices) || voices.length === 0) return
        if (resolvedEnglishVoices.english.length > 0) return
        if (englishVoiceWarnedRef.current) return

        englishVoiceWarnedRef.current = true
        toast.message("No English TTS voice was found. Your browser default voice will be used.")
    }, [resolvedEnglishVoices.english.length, voiceSupported, voices])

    React.useEffect(() => {
        return () => {
            if (typeof window === "undefined") return
            if (speakTimerRef.current) {
                window.clearTimeout(speakTimerRef.current)
                speakTimerRef.current = null
            }
        }
    }, [])

    const speak = React.useCallback(
        (text: string) => {
            if (!voiceSupported) return
            if (typeof window === "undefined") return

            const preferred = selectedVoiceType === "woman" ? resolvedEnglishVoices.woman : resolvedEnglishVoices.man
            const fallback = selectedVoiceType === "woman" ? resolvedEnglishVoices.man : resolvedEnglishVoices.woman
            const chosen = preferred || fallback || resolvedEnglishVoices.english[0]

            const voiceURI = chosen?.voiceURI
            const voiceLangRaw = normalizeLangTag(chosen?.lang || "")
            const voiceLang = voiceLangRaw || "en-US"
            const finalLang = voiceLang.toLowerCase().startsWith("en-") ? voiceLang : "en-US"

            if (speakTimerRef.current) {
                window.clearTimeout(speakTimerRef.current)
                speakTimerRef.current = null
            }

            try {
                stopSpeech()
            } catch {
                // ignore
            }

            const cleaned = normalizeTtsText(text)

            speakTimerRef.current = window.setTimeout(() => {
                try {
                    speakWithPackage(cleaned, {
                        lang: finalLang,
                        rate: ANNOUNCEMENT_RATE,
                        pitch: ANNOUNCEMENT_PITCH,
                        volume: 1,
                        ...(voiceURI ? { voiceURI } : {}),
                    })
                } catch {
                    // ignore
                }
            }, ANNOUNCEMENT_GAP_MS)
        },
        [
            ANNOUNCEMENT_GAP_MS,
            ANNOUNCEMENT_PITCH,
            ANNOUNCEMENT_RATE,
            resolvedEnglishVoices,
            selectedVoiceType,
            speakWithPackage,
            stopSpeech,
            voiceSupported,
        ],
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
            const text = buildNowServingAnnouncement(queueNumber, win)

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
        async (ticket: TicketType, opts?: { message?: string; senderName?: string; toastOnSuccess?: boolean }) => {
            if (!SMS_SENDING_AVAILABLE) {
                toast.message(SMS_UNAVAILABLE_NOTICE)
                return false
            }

            if (!ticket?._id) {
                toast.error("No active ticket selected for SMS.")
                return false
            }

            const windowNumber = windowInfo?.number
            const messageOverride = String(opts?.message ?? "").trim()
            const senderName = String(opts?.senderName ?? "").trim()
            const fallbackMessage = messageOverride || defaultSmsCalledMessage(ticket.queueNumber, windowNumber)

            const participant = getParticipantDetails(ticket as any)
            const fallbackMobile = looksLikePhoneNumber(participant.mobile) ? String(participant.mobile || "").trim() : ""

            const lower = (v: unknown) => String(v ?? "").trim().toLowerCase()

            const setSuffix = (summary?: Record<string, number>) => {
                const summaryText = formatStatusSummary(summary)
                return summaryText ? ` (${summaryText})` : ""
            }

            setSmsBusy(true)
            try {
                const res = await staffApi.sendTicketSms(ticket._id, {
                    ...(messageOverride ? { message: messageOverride } : {}),
                    ...(senderName ? { senderName } : {}),
                    status: "CALLED",
                    meta: { source: "staff/serving", action: "called_sms" },
                } as any)

                const summarySuffix = setSuffix(res?.statusSummary)
                const confirmedSent = res?.ok === true && res?.outcome === "sent"

                if (confirmedSent) {
                    if (opts?.toastOnSuccess !== false) {
                        toast.success(
                            `SMS sent for #${ticket.queueNumber}${res?.number ? ` to ${res.number}` : ""}.${summarySuffix}`,
                        )
                    }
                    return true
                }

                if (res?.outcome === "skipped") {
                    toast.message(res?.message || res?.reason || "SMS was skipped by server policy.")
                    return false
                }

                const hasReceiptsSignal =
                    typeof res?.receiptsCount === "number"
                        ? res.receiptsCount > 0
                        : Boolean(res?.statusSummary && Object.keys(res.statusSummary).length)

                if (res?.ok === true && !hasReceiptsSignal) {
                    toast.message("SMS request was accepted, but provider receipt was not returned. Not confirmed.")
                    return false
                }

                const httpStatus = Number((res as any)?.httpStatus ?? NaN)
                const serverErrorish =
                    (Number.isFinite(httpStatus) && httpStatus >= 500) ||
                    lower(res?.error).includes("internal") ||
                    lower(res?.reason).includes("internal") ||
                    lower(res?.message).includes("internal") ||
                    lower(res?.error).includes("network_error") ||
                    lower(res?.reason).includes("network_error")

                if (serverErrorish && fallbackMobile) {
                    toast.message("Ticket SMS endpoint failed. Trying direct SMS fallback...")

                    const raw = await staffApi.sendSms({
                        numbers: fallbackMobile,
                        message: fallbackMessage,
                        ...(senderName ? { senderName } : {}),
                        entityType: "ticket",
                        entityId: ticket._id,
                        meta: { source: "staff/serving", status: "CALLED", queueNumber: ticket.queueNumber },
                    })

                    const rawSuffix = setSuffix(raw?.statusSummary)
                    const rawConfirmed = raw?.ok === true && raw?.outcome === "sent"

                    if (rawConfirmed) {
                        if (opts?.toastOnSuccess !== false) {
                            toast.success(`SMS sent for #${ticket.queueNumber} (fallback).${rawSuffix}`)
                        }
                        return true
                    }

                    if (raw?.outcome === "skipped") {
                        toast.message(raw?.message || raw?.reason || "SMS was skipped by server policy.")
                        return false
                    }

                    const rawErrMsg = raw?.message || raw?.reason || raw?.error || "SMS not confirmed by provider receipt."
                    toast.error(`${rawErrMsg}${rawSuffix}`)
                    return false
                }

                const errMsg = res?.message || res?.reason || res?.error || "SMS not confirmed by provider receipt."
                toast.error(`${errMsg}${summarySuffix}`)
                return false
            } catch (e: any) {
                const msg = String(e?.message || "Failed to send SMS.").trim()
                toast.error(msg)
                return false
            } finally {
                setSmsBusy(false)
            }
        },
        [windowInfo?.number],
    )

    const onSendSmsFromDialog = React.useCallback(async () => {
        if (!SMS_SENDING_AVAILABLE) {
            toast.message(SMS_UNAVAILABLE_NOTICE)
            return
        }

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
            senderName: resolvedSenderName || undefined,
            toastOnSuccess: true,
        })

        if (!ok) return

        setSmsDialogOpen(false)
        setSmsUseDefaultMessage(true)
        setSmsCustomMessage("")
    }, [current, resolvedSenderName, sendCalledSms, smsCustomMessage, smsUseDefaultMessage])

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

            const purpose = getTransactionPurposeText(res.ticket)
            toast.success(`Called #${res.ticket.queueNumber}${purpose ? ` • ${purpose}` : ""}`)

            announceCall(res.ticket.queueNumber)

            if (autoSmsOnCall && SMS_SENDING_AVAILABLE) {
                await sendCalledSms(res.ticket, { toastOnSuccess: true, senderName: resolvedSenderName || undefined })
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

    const currentParticipant = getParticipantDetails(current as any)
    const currentPurpose = getTransactionPurposeText(current as any) || "—"

    if (boardMode) {
        return (
            <StaffServingBoardMode
                snapshot={snapshot}
                panelCount={panelCount}
                setPanelCount={setPanelCount}
                autoRefresh={autoRefresh}
                setAutoRefresh={setAutoRefresh}
                busy={busy}
                loading={loading}
                refresh={refresh}
                assignedDepartmentItems={assignedDepartmentItems}
                current={current}
                upNext={upNext}
                holdTickets={holdTickets}
            />
        )
    }

    return (
        <DashboardLayout title="Now Serving" navItems={STAFF_NAV_ITEMS} user={dashboardUser} activePath={location.pathname}>
            <div className="grid w-full min-w-0 grid-cols-1 gap-6">
                <Card className="min-w-0">
                    <StaffServingControlPanel
                        loading={loading}
                        busy={busy}
                        smsBusy={smsBusy}
                        assignedOk={assignedOk}
                        current={current}
                        voiceEnabled={voiceEnabled}
                        setVoiceEnabled={setVoiceEnabled}
                        voiceSupported={voiceSupported}
                        autoRefresh={autoRefresh}
                        setAutoRefresh={setAutoRefresh}
                        autoSmsOnCall={autoSmsOnCall}
                        setAutoSmsOnCall={setAutoSmsOnCall}
                        assignedDepartmentItems={assignedDepartmentItems}
                        handledDepartmentItems={handledDepartmentItems}
                        windowInfo={windowInfo}
                        snapshot={snapshot}
                        onRefresh={refresh}
                        onCallNext={onCallNext}
                        onRecallVoice={onRecallVoice}
                        onOpenSmsDialog={() => setSmsDialogOpen(true)}
                        lastAnnouncedQueueNumber={lastAnnouncedRef.current}
                        monitorOptions={monitorOptions}
                        selectedMonitorId={selectedMonitorId}
                        setSelectedMonitorId={setSelectedMonitorId}
                        loadingMonitors={loadingMonitors}
                        panelCount={panelCount}
                        setPanelCount={setPanelCount}
                        selectedVoiceType={selectedVoiceType}
                        setSelectedVoiceType={setSelectedVoiceType}
                        resolvedEnglishVoices={resolvedEnglishVoices}
                        openBoardOnSelectedMonitor={openBoardOnSelectedMonitor}
                        loadMonitorOptions={loadMonitorOptions}
                        smsSenderOption={smsSenderOption}
                        setSmsSenderOption={setSmsSenderOption}
                        smsSenderCustom={smsSenderCustom}
                        setSmsSenderCustom={setSmsSenderCustom}
                        monitorApiSupported={monitorApiSupported}
                    />

                    <CardContent className="min-w-0">
                        <StaffServingOperatorView
                            loading={loading}
                            current={current}
                            currentParticipant={currentParticipant}
                            currentPurpose={currentPurpose}
                            busy={busy}
                            smsBusy={smsBusy}
                            upNext={upNext}
                            holdTickets={holdTickets}
                            snapshot={snapshot}
                            onOpenSmsDialog={() => setSmsDialogOpen(true)}
                            onHoldNoShow={onHoldNoShow}
                            onServed={onServed}
                        />
                    </CardContent>

                    <StaffServingSmsDialog
                        open={smsDialogOpen}
                        onOpenChange={setSmsDialogOpen}
                        current={current}
                        currentParticipant={currentParticipant}
                        currentPurpose={currentPurpose}
                        smsBusy={smsBusy}
                        smsUseDefaultMessage={smsUseDefaultMessage}
                        setSmsUseDefaultMessage={setSmsUseDefaultMessage}
                        smsCustomMessage={smsCustomMessage}
                        setSmsCustomMessage={setSmsCustomMessage}
                        smsSenderOption={smsSenderOption}
                        setSmsSenderOption={setSmsSenderOption}
                        smsSenderCustom={smsSenderCustom}
                        setSmsSenderCustom={setSmsSenderCustom}
                        windowNumber={windowInfo?.number}
                        onSend={onSendSmsFromDialog}
                    />
                </Card>
            </div>
        </DashboardLayout>
    )
}