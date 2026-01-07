/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import {
    RefreshCw,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

function fmtTime(v?: string | null) {
    if (!v) return "—"
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleString()
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

function historyWhen(t: TicketType) {
    const s = String(t.status || "").toUpperCase()
    if (s === "SERVED") return fmtTime((t as any).servedAt)
    if (s === "OUT") return fmtTime((t as any).outAt)
    if (s === "CALLED") return fmtTime((t as any).calledAt)
    return fmtTime((t as any).updatedAt)
}

function isSpeechSupported() {
    return (
        typeof window !== "undefined" &&
        "speechSynthesis" in window &&
        "SpeechSynthesisUtterance" in window
    )
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

    const [loading, setLoading] = React.useState(true)
    const [busy, setBusy] = React.useState(false)

    const [departmentId, setDepartmentId] = React.useState<string | null>(null)
    const [windowInfo, setWindowInfo] = React.useState<{ id: string; name: string; number: number } | null>(null)

    const [current, setCurrent] = React.useState<TicketType | null>(null)

    const [waiting, setWaiting] = React.useState<TicketType[]>([])
    const [hold, setHold] = React.useState<TicketType[]>([])
    const [out, setOut] = React.useState<TicketType[]>([])
    const [history, setHistory] = React.useState<TicketType[]>([])

    const [historyMine, setHistoryMine] = React.useState(false)

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

            // ✅ DO NOT cancel. This allows repeated clicks to queue multiple announcements.
            // synth.cancel()

            // Some browsers pause synthesis if tab changes
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

    // -------- Data refresh --------
    const refreshAll = React.useCallback(async () => {
        setLoading(true)
        try {
            const a = await staffApi.myAssignment()
            setDepartmentId(a.departmentId ?? null)
            setWindowInfo(a.window ? { id: a.window._id, name: a.window.name, number: a.window.number } : null)

            if (!a.departmentId || !a.window?._id) {
                setCurrent(null)
                setWaiting([])
                setHold([])
                setOut([])
                setHistory([])
                return
            }

            const [c, w, h, o, his] = await Promise.all([
                staffApi.currentCalledForWindow().catch(() => ({ ticket: null })),
                staffApi.listWaiting({ limit: 25 }).catch(() => ({ tickets: [] })),
                staffApi.listHold({ limit: 25 }).catch(() => ({ tickets: [] })),
                staffApi.listOut({ limit: 25 }).catch(() => ({ tickets: [] })),
                staffApi.listHistory({ limit: 25, mine: historyMine }).catch(() => ({ tickets: [] })),
            ])

            setCurrent(c.ticket ?? null)
            setWaiting(w.tickets ?? [])
            setHold(h.tickets ?? [])
            setOut(o.tickets ?? [])
            setHistory(his.tickets ?? [])
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to load staff queue.")
        } finally {
            setLoading(false)
        }
    }, [historyMine])

    React.useEffect(() => {
        void refreshAll()
    }, [refreshAll])

    async function onCallNext() {
        if (!assignedOk) return toast.error("You are not assigned to a department/window.")
        setBusy(true)
        try {
            const res = await staffApi.callNext()
            setCurrent(res.ticket)
            toast.success(`Called #${res.ticket.queueNumber}`)

            // ✅ Voice announcement on each click
            announceCall(res.ticket.queueNumber)

            await refreshAll()
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
            await refreshAll()
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
            await refreshAll()
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to hold ticket.")
        } finally {
            setBusy(false)
        }
    }

    async function onReturnFromHold(ticketId: string) {
        setBusy(true)
        try {
            const res = await staffApi.returnFromHold(ticketId)
            toast.success(`Returned #${res.ticket.queueNumber} to WAITING.`)
            await refreshAll()
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to return from HOLD.")
        } finally {
            setBusy(false)
        }
    }

    return (
        <DashboardLayout title="Queue" navItems={STAFF_NAV_ITEMS} user={dashboardUser} activePath={location.pathname}>
            <div className="grid w-full min-w-0 grid-cols-1 gap-6">
                <Card className="min-w-0">
                    <CardHeader className="gap-2">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <CardTitle className="flex items-center gap-2">
                                    <Ticket className="h-5 w-5" />
                                    Staff Queue
                                </CardTitle>
                                <CardDescription>Call next ticket, mark served, and manage HOLD/OUT tickets.</CardDescription>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <Button
                                    variant="outline"
                                    onClick={() => void refreshAll()}
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
                                        loading ||
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

                                <div className="flex items-center gap-2 sm:pl-2">
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

                        <Separator />

                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <Badge variant="secondary">Dept: {departmentId ?? "—"}</Badge>
                                <Badge variant="secondary">
                                    Window: {windowInfo ? `${windowInfo.name} (#${windowInfo.number})` : "—"}
                                </Badge>
                                {!assignedOk ? <Badge variant="destructive">Not assigned</Badge> : null}
                                {!voiceSupported ? <Badge variant="secondary">Voice unsupported</Badge> : null}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <Badge variant="secondary">Waiting: {waiting.length}</Badge>
                                <Badge variant="secondary">Hold: {hold.length}</Badge>
                                <Badge variant="secondary">Out: {out.length}</Badge>
                                <Badge variant="secondary">History: {history.length}</Badge>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="min-w-0">
                        {loading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-40 w-full" />
                            </div>
                        ) : (
                            <div className="grid gap-6 lg:grid-cols-12">
                                {/* Current Ticket */}
                                <Card className="lg:col-span-5">
                                    <CardHeader>
                                        <CardTitle>Current called</CardTitle>
                                        <CardDescription>Last ticket called for your window.</CardDescription>
                                    </CardHeader>

                                    <CardContent className="space-y-4">
                                        {current ? (
                                            <>
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-16 w-16 items-center justify-center rounded-xl border bg-muted text-2xl font-semibold">
                                                            {current.queueNumber}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <div className="truncate text-sm font-medium">
                                                                    Ticket #{current.queueNumber}
                                                                </div>
                                                                {statusBadge(current.status)}
                                                            </div>
                                                            <div className="truncate text-xs text-muted-foreground">
                                                                Student ID: {current.studentId ?? "—"}
                                                            </div>
                                                            <div className="truncate text-xs text-muted-foreground">
                                                                Called at: {fmtTime((current as any).calledAt)}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="text-xs text-muted-foreground">
                                                        Hold attempts: {current.holdAttempts ?? 0}
                                                    </div>
                                                </div>

                                                <Separator />

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

                                {/* Waiting List */}
                                <Card className="lg:col-span-7">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <ListOrdered className="h-5 w-5" />
                                            Waiting
                                        </CardTitle>
                                        <CardDescription>Oldest tickets are served first.</CardDescription>
                                    </CardHeader>

                                    <CardContent>
                                        {waiting.length === 0 ? (
                                            <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                                                No WAITING tickets.
                                            </div>
                                        ) : (
                                            <div className="rounded-lg border overflow-x-auto">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="w-24">Queue</TableHead>
                                                            <TableHead>Student ID</TableHead>
                                                            <TableHead className="hidden md:table-cell">Waiting since</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {waiting.map((t, idx) => (
                                                            <TableRow key={t._id} className={idx === 0 ? "bg-muted/50" : ""}>
                                                                <TableCell className="font-medium">#{t.queueNumber}</TableCell>
                                                                <TableCell className="truncate">{t.studentId ?? "—"}</TableCell>
                                                                <TableCell className="hidden md:table-cell text-muted-foreground">
                                                                    {fmtTime((t as any).waitingSince)}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Hold List */}
                                <Card className="lg:col-span-6">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <PauseOctagon className="h-5 w-5" />
                                            Hold
                                        </CardTitle>
                                        <CardDescription>Return a HOLD ticket back to WAITING.</CardDescription>
                                    </CardHeader>

                                    <CardContent>
                                        {hold.length === 0 ? (
                                            <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                                                No HOLD tickets.
                                            </div>
                                        ) : (
                                            <div className="rounded-lg border overflow-x-auto">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="w-24">Queue</TableHead>
                                                            <TableHead>Student ID</TableHead>
                                                            <TableHead className="w-28">Attempts</TableHead>
                                                            <TableHead className="hidden md:table-cell">Updated</TableHead>
                                                            <TableHead className="w-32 text-right">Action</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {hold.map((t) => (
                                                            <TableRow key={t._id}>
                                                                <TableCell className="font-medium">#{t.queueNumber}</TableCell>
                                                                <TableCell className="truncate">{t.studentId ?? "—"}</TableCell>
                                                                <TableCell>{t.holdAttempts ?? 0}</TableCell>
                                                                <TableCell className="hidden md:table-cell text-muted-foreground">
                                                                    {fmtTime((t as any).updatedAt)}
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="gap-2"
                                                                        disabled={busy}
                                                                        onClick={() => void onReturnFromHold(t._id)}
                                                                    >
                                                                        <Undo2 className="h-4 w-4" />
                                                                        Return
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* OUT List */}
                                <Card className="lg:col-span-6">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <XCircle className="h-5 w-5" />
                                            Out
                                        </CardTitle>
                                        <CardDescription>Tickets that reached max hold attempts.</CardDescription>
                                    </CardHeader>

                                    <CardContent>
                                        {out.length === 0 ? (
                                            <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                                                No OUT tickets.
                                            </div>
                                        ) : (
                                            <div className="rounded-lg border overflow-x-auto">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="w-24">Queue</TableHead>
                                                            <TableHead>Student ID</TableHead>
                                                            <TableHead className="w-28">Attempts</TableHead>
                                                            <TableHead className="hidden md:table-cell">Out at</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {out.map((t) => (
                                                            <TableRow key={t._id}>
                                                                <TableCell className="font-medium">#{t.queueNumber}</TableCell>
                                                                <TableCell className="truncate">{t.studentId ?? "—"}</TableCell>
                                                                <TableCell>{t.holdAttempts ?? 0}</TableCell>
                                                                <TableCell className="hidden md:table-cell text-muted-foreground">
                                                                    {fmtTime((t as any).outAt)}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* History */}
                                <Card className="lg:col-span-12">
                                    <CardHeader className="gap-2">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <CardTitle className="flex items-center gap-2">
                                                    <History className="h-5 w-5" />
                                                    History
                                                </CardTitle>
                                                <CardDescription>Recent CALLED / SERVED / OUT tickets (today).</CardDescription>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    id="historyMine"
                                                    checked={historyMine}
                                                    onCheckedChange={(v) => setHistoryMine(Boolean(v))}
                                                    disabled={!assignedOk || busy}
                                                />
                                                <Label htmlFor="historyMine" className="text-sm">
                                                    Mine only
                                                </Label>
                                            </div>
                                        </div>
                                    </CardHeader>

                                    <CardContent>
                                        {history.length === 0 ? (
                                            <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                                                No history yet.
                                            </div>
                                        ) : (
                                            <div className="rounded-lg border overflow-x-auto">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="w-24">Queue</TableHead>
                                                            <TableHead className="w-28">Status</TableHead>
                                                            <TableHead className="w-28">Window</TableHead>
                                                            <TableHead>Student ID</TableHead>
                                                            <TableHead className="hidden md:table-cell">When</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {history.map((t) => (
                                                            <TableRow key={t._id}>
                                                                <TableCell className="font-medium">#{t.queueNumber}</TableCell>
                                                                <TableCell>{statusBadge(t.status)}</TableCell>
                                                                <TableCell className="text-muted-foreground">
                                                                    {t.windowNumber ? `#${t.windowNumber}` : "—"}
                                                                </TableCell>
                                                                <TableCell className="truncate">{t.studentId ?? "—"}</TableCell>
                                                                <TableCell className="hidden md:table-cell text-muted-foreground">
                                                                    {historyWhen(t)}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
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
