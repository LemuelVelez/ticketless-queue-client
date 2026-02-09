/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import {
    CheckCircle2,
    Megaphone,
    PauseCircle,
    RefreshCw,
    Ticket as TicketIcon,
    Maximize2,
    Minimize2,
    Volume2,
} from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { STAFF_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"

import { useSession } from "@/hooks/use-session"
import { staffApi, type Ticket as TicketType } from "@/api/staff"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

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

function isSpeechSupported() {
    return (
        typeof window !== "undefined" &&
        "speechSynthesis" in window &&
        "SpeechSynthesisUtterance" in window
    )
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

    const [loading, setLoading] = React.useState(true)
    const [busy, setBusy] = React.useState(false)

    const [departmentId, setDepartmentId] = React.useState<string | null>(null)
    const [windowInfo, setWindowInfo] = React.useState<{ id: string; name: string; number: number } | null>(null)

    const [current, setCurrent] = React.useState<TicketType | null>(null)
    const [upNext, setUpNext] = React.useState<TicketType[]>([])

    const [autoRefresh, setAutoRefresh] = React.useState(true)

    // Presentation mode
    const [presentation, setPresentation] = React.useState(false)
    const presentationRequestedRef = React.useRef(false)
    const autoPresentDoneRef = React.useRef(false)

    const assignedOk = Boolean(departmentId && windowInfo?.id)

    // -------- Voice announcement (Web Speech API) --------
    const [voiceEnabled, setVoiceEnabled] = React.useState(true)
    const [voiceSupported, setVoiceSupported] = React.useState(true)
    const voicesRef = React.useRef<SpeechSynthesisVoice[]>([])
    const voiceWarnedRef = React.useRef(false)
    const lastAnnouncedRef = React.useRef<number | null>(null)

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

            const voices = voicesRef.current?.length ? voicesRef.current : (synth.getVoices?.() ?? [])
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

    const announceCall = React.useCallback(
        (queueNumber: number) => {
            lastAnnouncedRef.current = queueNumber

            if (!voiceEnabled) return
            if (!voiceSupported) {
                if (!voiceWarnedRef.current) {
                    voiceWarnedRef.current = true
                    toast.message("Voice announcement is not supported in this browser.")
                }
                return
            }

            const win = windowInfo?.number
            const text = win
                ? `Queue number ${queueNumber}. Please proceed to window ${win}.`
                : `Queue number ${queueNumber}.`

            speak(text)
        },
        [speak, voiceEnabled, voiceSupported, windowInfo?.number],
    )

    const onRecallVoice = React.useCallback(() => {
        const n = current?.queueNumber ?? lastAnnouncedRef.current
        if (!n) return toast.message("No ticket to announce.")
        announceCall(n)
    }, [announceCall, current?.queueNumber])

    const refresh = React.useCallback(async () => {
        try {
            const a = await staffApi.myAssignment()
            setDepartmentId(a.departmentId ?? null)
            setWindowInfo(a.window ? { id: a.window._id, name: a.window.name, number: a.window.number } : null)

            if (!a.departmentId || !a.window?._id) {
                setCurrent(null)
                setUpNext([])
                return
            }

            const [c, w] = await Promise.all([
                staffApi.currentCalledForWindow().catch(() => ({ ticket: null })),
                staffApi.listWaiting({ limit: 8 }).catch(() => ({ tickets: [] })),
            ])

            setCurrent(c.ticket ?? null)
            setUpNext(w.tickets ?? [])
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to load now serving.")
        }
    }, [])

    async function enterPresentation() {
        setPresentation(true)
        try {
            presentationRequestedRef.current = true
            await document.documentElement.requestFullscreen()
        } catch {
            presentationRequestedRef.current = false
        }
    }

    async function exitPresentation() {
        setPresentation(false)
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen()
            }
        } catch {
            // ignore
        } finally {
            presentationRequestedRef.current = false
        }
    }

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

    // Auto-enter Presentation Mode when opening /staff/now-serving?present=1
    React.useEffect(() => {
        if (autoPresentDoneRef.current) return

        const qs = new URLSearchParams(location.search || "")
        const shouldPresent = parseBool(qs.get("present"))
        if (!shouldPresent) return

        autoPresentDoneRef.current = true
        void enterPresentation()
    }, [location.search])

    React.useEffect(() => {
        if (!autoRefresh) return
        const t = window.setInterval(() => {
            void refresh()
        }, 5000)
        return () => window.clearInterval(t)
    }, [autoRefresh, refresh])

    React.useEffect(() => {
        const onFsChange = () => {
            const isFs = typeof document !== "undefined" && !!document.fullscreenElement
            if (presentation && presentationRequestedRef.current && !isFs) {
                presentationRequestedRef.current = false
                setPresentation(false)
            }
        }
        document.addEventListener("fullscreenchange", onFsChange)
        return () => document.removeEventListener("fullscreenchange", onFsChange)
    }, [presentation])

    async function onCallNext() {
        if (!assignedOk) return toast.error("You are not assigned to a department/window.")
        setBusy(true)
        try {
            const res = await staffApi.callNext()
            setCurrent(res.ticket)
            toast.success(`Called #${res.ticket.queueNumber}`)
            announceCall(res.ticket.queueNumber)
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

    // Presentation overlay (distinct "billboard" style)
    if (presentation) {
        return (
            <div className="fixed inset-0 z-50 bg-background">
                <div className="flex h-full w-full flex-col">
                    <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">Dept: {departmentId ?? "—"}</Badge>
                                <Badge variant="secondary">
                                    Window: {windowInfo ? `${windowInfo.name} (#${windowInfo.number})` : "—"}
                                </Badge>
                                {!assignedOk ? <Badge variant="destructive">Not assigned</Badge> : null}
                                {!voiceSupported ? <Badge variant="secondary">Voice unsupported</Badge> : null}
                            </div>
                            <div className="mt-2 text-sm text-muted-foreground">
                                Live board • Auto refresh {autoRefresh ? "On" : "Off"} (every 5s)
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                                <Switch
                                    id="autoRefreshPm"
                                    checked={autoRefresh}
                                    onCheckedChange={(v) => setAutoRefresh(Boolean(v))}
                                    disabled={busy}
                                />
                                <Label htmlFor="autoRefreshPm" className="text-sm">
                                    Auto refresh
                                </Label>
                            </div>

                            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                                <Switch
                                    id="voiceEnabledPm"
                                    checked={voiceEnabled}
                                    onCheckedChange={(v) => setVoiceEnabled(Boolean(v))}
                                    disabled={busy || !voiceSupported}
                                />
                                <Label htmlFor="voiceEnabledPm" className="text-sm">
                                    Voice
                                </Label>
                            </div>

                            <Button variant="outline" onClick={() => void refresh()} disabled={loading || busy} className="gap-2">
                                <RefreshCw className="h-4 w-4" />
                                Refresh
                            </Button>

                            <Button onClick={() => void onCallNext()} disabled={loading || busy || !assignedOk} className="gap-2">
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
                                className="gap-2"
                            >
                                <Volume2 className="h-4 w-4" />
                                Recall
                            </Button>

                            <Button variant="secondary" onClick={() => void exitPresentation()} className="gap-2">
                                <Minimize2 className="h-4 w-4" />
                                Exit
                            </Button>
                        </div>
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col gap-6 p-4 lg:p-8">
                        <div className="flex min-h-0 flex-1 flex-col rounded-2xl border bg-muted p-6 lg:p-10">
                            <div className="flex items-center justify-between">
                                <div className="text-sm tracking-wide text-muted-foreground">NOW SERVING</div>
                                {current ? <Badge>CALLED</Badge> : <Badge variant="secondary">—</Badge>}
                            </div>

                            <div className="mt-6 flex flex-1 flex-col items-center justify-center text-center">
                                {current ? (
                                    <>
                                        <div className="text-[clamp(5rem,20vw,14rem)] font-semibold leading-none tracking-tight">
                                            #{current.queueNumber}
                                        </div>
                                        <div className="mt-5 text-xl text-muted-foreground">Student ID: {current.studentId ?? "—"}</div>
                                        <div className="mt-2 text-base text-muted-foreground">
                                            Called at: {fmtTime((current as any).calledAt)}
                                        </div>
                                        <div className="mt-1 text-sm text-muted-foreground">
                                            Hold attempts: {current.holdAttempts ?? 0}
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-2xl text-muted-foreground">No ticket called for your window.</div>
                                )}
                            </div>

                            <Separator className="my-6" />

                            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => void onHoldNoShow()}
                                    disabled={busy || !current}
                                    className="w-full gap-2 sm:w-auto"
                                >
                                    <PauseCircle className="h-4 w-4" />
                                    Hold / No-show
                                </Button>

                                <Button
                                    type="button"
                                    onClick={() => void onServed()}
                                    disabled={busy || !current}
                                    className="w-full gap-2 sm:w-auto"
                                >
                                    <CheckCircle2 className="h-4 w-4" />
                                    Mark served
                                </Button>
                            </div>
                        </div>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Up next ticker</CardTitle>
                                <CardDescription>Waiting tickets preview for announcement order.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {upNext.length === 0 ? (
                                    <div className="rounded-lg border p-4 text-sm text-muted-foreground">No WAITING tickets.</div>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {upNext.map((t, idx) => (
                                            <Badge key={t._id} variant={idx === 0 ? "default" : "secondary"} className="px-3 py-1 text-sm">
                                                #{t.queueNumber}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
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
                                    Dedicated operator board for live calling. Use <strong>?present=1</strong> to auto-open presentation mode.
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

                                <Button
                                    variant="secondary"
                                    onClick={() => void enterPresentation()}
                                    disabled={busy}
                                    className="w-full gap-2 sm:w-auto"
                                >
                                    <Maximize2 className="h-4 w-4" />
                                    Presentation
                                </Button>
                            </div>
                        </div>

                        <Separator />

                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <Badge variant="secondary">Dept: {departmentId ?? "—"}</Badge>
                                <Badge variant="secondary">
                                    Window: {windowInfo ? `${windowInfo.name} (#${windowInfo.number})` : "—"}
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
                                        <CardDescription>Quick view of next tickets in line.</CardDescription>
                                    </CardHeader>

                                    <CardContent>
                                        {upNext.length === 0 ? (
                                            <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                                                No WAITING tickets.
                                            </div>
                                        ) : (
                                            <div className="grid gap-3">
                                                {upNext.map((t, idx) => (
                                                    <div key={t._id} className="flex items-center justify-between rounded-xl border p-4">
                                                        <div className="text-2xl font-semibold">#{t.queueNumber}</div>
                                                        <div className="text-right text-xs text-muted-foreground">
                                                            <div>{idx === 0 ? "Next to call" : "Waiting"}</div>
                                                            <div>{fmtTime((t as any).waitingSince)}</div>
                                                        </div>
                                                    </div>
                                                ))}
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
