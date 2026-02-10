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
    if (
        normalized === "ALUMNI_VISITOR" ||
        normalized === "ALUMNI" ||
        normalized === "VISITOR"
    ) {
        return "ALUMNI_VISITOR"
    }

    return normalized
}

function extractStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value
        .map((v) => String(v ?? "").trim())
        .filter(Boolean)
}

function firstNonEmptyText(candidates: unknown[]) {
    for (const candidate of candidates) {
        const text = String(candidate ?? "").trim()
        if (text) return text
    }
    return ""
}

function participantText(value?: string | null) {
    const s = normalizeParticipantTypeKey(value)
    if (!s) return "—"
    if (s === "STUDENT") return "Student"
    if (s === "ALUMNI_VISITOR") return "Alumni / Visitor"
    if (s === "GUEST") return "Guest"
    return humanizeTransactionKey(s) || s
}

function participantBadge(value?: string | null) {
    const s = normalizeParticipantTypeKey(value)

    if (!s) return <Badge variant="secondary">—</Badge>
    if (s === "STUDENT") return <Badge>Student</Badge>
    if (s === "ALUMNI_VISITOR") return <Badge variant="secondary">Alumni / Visitor</Badge>
    if (s === "GUEST") return <Badge variant="outline">Guest</Badge>

    return <Badge variant="outline">{participantText(s)}</Badge>
}

function participantFromTicket(ticket?: TicketType | null) {
    if (!ticket) return ""

    const t = ticket as any
    const explicit = firstNonEmptyText([
        t.participantType,
        t.participantLabel,
        t.participant,
        t.userType,
        t.role,
        t.meta?.participantType,
        t.meta?.participantLabel,
        t.transactions?.participantType,
        t.transactions?.participantLabel,
    ])

    if (explicit) return explicit

    // Practical fallback: tc/student-style IDs are typically student records.
    const sid = String(ticket.studentId ?? "").trim()
    if (/^TC[-_A-Z0-9]/i.test(sid)) return "STUDENT"

    return ""
}

function ticketPurpose(ticket?: TicketType | null) {
    if (!ticket) return "—"

    const t = ticket as any

    // 1) Array label candidates (highest fidelity)
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
    const objectArrayCandidates = [
        t.selectedTransactions,
        t.transactionSelections,
        t.transactions?.items,
        t.transactions?.selected,
    ]

    for (const candidate of objectArrayCandidates) {
        if (!Array.isArray(candidate)) continue

        const labels = candidate
            .map((item: any) =>
                String(
                    item?.label ??
                    item?.name ??
                    item?.title ??
                    item?.transactionLabel ??
                    "",
                ).trim(),
            )
            .filter(Boolean)

        if (labels.length) return labels.join(" • ")
    }

    // 3) Direct string candidates
    const direct = firstNonEmptyText([
        ticket.queuePurpose,
        ticket.purpose,
        ticket.transactionLabel,
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
        const keys = extractStringArray(candidate).map((k) => humanizeTransactionKey(k)).filter(Boolean)
        if (keys.length) return keys.join(" • ")
    }

    // 5) Single key fallback
    const key = firstNonEmptyText([
        ticket.transactionKey,
        t.transaction?.key,
        t.meta?.transactionKey,
        t.transactionCode,
    ])

    if (key) return humanizeTransactionKey(key)

    return "—"
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
    const [departmentNames, setDepartmentNames] = React.useState<string[]>([])
    const [windowInfo, setWindowInfo] = React.useState<{ id: string; name: string; number: number } | null>(null)

    const [current, setCurrent] = React.useState<TicketType | null>(null)

    const [waiting, setWaiting] = React.useState<TicketType[]>([])
    const [hold, setHold] = React.useState<TicketType[]>([])
    const [out, setOut] = React.useState<TicketType[]>([])
    const [history, setHistory] = React.useState<TicketType[]>([])

    const [historyMine, setHistoryMine] = React.useState(false)

    const assignedOk = Boolean(departmentId && windowInfo?.id)

    const departmentDisplay = React.useMemo(() => {
        if (departmentNames.length) return departmentNames.join(", ")
        return departmentId ?? "—"
    }, [departmentId, departmentNames])

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

    // -------- Data refresh --------
    const refreshAll = React.useCallback(async () => {
        setLoading(true)
        try {
            const a = await staffApi.myAssignment()

            const names = (a.assignedDepartments?.length ? a.assignedDepartments : a.handledDepartments ?? [])
                .map((d) => String(d?.name ?? "").trim())
                .filter(Boolean)

            setDepartmentNames(names)

            const firstAssignedDepartmentId: string | null = Array.isArray(a.assignedDepartmentIds)
                ? a.assignedDepartmentIds[0] ?? null
                : null

            const firstHandledDepartmentId: string | null = Array.isArray(a.handledDepartmentIds)
                ? a.handledDepartmentIds[0] ?? null
                : null

            const resolvedDepartmentId: string | null =
                a.departmentId ?? firstAssignedDepartmentId ?? firstHandledDepartmentId ?? null

            setDepartmentId(resolvedDepartmentId)
            setWindowInfo(a.window ? { id: a.window._id, name: a.window.name, number: a.window.number } : null)

            if (!resolvedDepartmentId || !a.window?._id) {
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
                        <CardTitle className="flex items-center gap-2">
                            <Ticket className="h-5 w-5" />
                            Staff Queue Control Center
                        </CardTitle>
                        <CardDescription>
                            Manage waiting line operations and clearly view who is in queue and their transaction purpose.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="min-w-0">
                        {loading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-28 w-full" />
                                <Skeleton className="h-56 w-full" />
                                <Skeleton className="h-56 w-full" />
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Command + Snapshot row */}
                                <div className="grid gap-4 xl:grid-cols-12">
                                    <Card className="xl:col-span-8">
                                        <CardHeader>
                                            <CardTitle className="text-base">Queue Commands</CardTitle>
                                            <CardDescription>Primary actions for your assigned window.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant="secondary" className="max-w-full whitespace-normal break-words">
                                                    Departments: {departmentDisplay}
                                                </Badge>
                                                <Badge variant="secondary">
                                                    Window: {windowInfo ? `${windowInfo.name} (#${windowInfo.number})` : "—"}
                                                </Badge>
                                                {!assignedOk ? <Badge variant="destructive">Not assigned</Badge> : null}
                                                {!voiceSupported ? <Badge variant="secondary">Voice unsupported</Badge> : null}
                                            </div>

                                            <Separator />

                                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => void refreshAll()}
                                                    disabled={loading || busy}
                                                    className="w-full gap-2 sm:w-auto"
                                                >
                                                    <RefreshCw className="h-4 w-4" />
                                                    Refresh data
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

                                                <div className="ml-0 flex items-center gap-2 rounded-md border px-3 py-2 sm:ml-auto">
                                                    <Switch
                                                        id="voiceEnabled"
                                                        checked={voiceEnabled}
                                                        onCheckedChange={(v) => setVoiceEnabled(Boolean(v))}
                                                        disabled={busy || !voiceSupported}
                                                    />
                                                    <Label htmlFor="voiceEnabled" className="text-sm">
                                                        Voice enabled
                                                    </Label>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="xl:col-span-4">
                                        <CardHeader>
                                            <CardTitle className="text-base">Queue Snapshot</CardTitle>
                                            <CardDescription>Live counters for today.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="grid grid-cols-2 gap-3">
                                            <QueueStatCard label="Waiting" value={waiting.length} />
                                            <QueueStatCard label="Hold" value={hold.length} />
                                            <QueueStatCard label="Out" value={out.length} />
                                            <QueueStatCard label="History" value={history.length} />
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Main queue work area */}
                                <div className="grid gap-6 lg:grid-cols-12">
                                    {/* Current Ticket */}
                                    <Card className="lg:col-span-4">
                                        <CardHeader>
                                            <CardTitle>Current called</CardTitle>
                                            <CardDescription>Ticket currently assigned to your window.</CardDescription>
                                        </CardHeader>

                                        <CardContent className="space-y-4">
                                            {current ? (
                                                <>
                                                    <div className="rounded-xl border bg-muted/40 p-4">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                                                                    Active ticket
                                                                </div>
                                                                <div className="mt-1 text-4xl font-semibold tracking-tight">
                                                                    #{current.queueNumber}
                                                                </div>
                                                                <div className="mt-2 text-sm text-muted-foreground">
                                                                    Student ID: {current.studentId ?? "—"}
                                                                </div>
                                                                <div className="text-sm text-muted-foreground">
                                                                    Called at: {fmtTime((current as any).calledAt)}
                                                                </div>

                                                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                                                    {participantBadge(participantFromTicket(current))}
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="max-w-full whitespace-normal break-words"
                                                                    >
                                                                        Purpose: {ticketPurpose(current)}
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                            {statusBadge(current.status)}
                                                        </div>

                                                        <div className="mt-3 text-xs text-muted-foreground">
                                                            Hold attempts: {current.holdAttempts ?? 0}
                                                        </div>
                                                    </div>

                                                    <div className="grid gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="secondary"
                                                            onClick={() => void onHoldNoShow()}
                                                            disabled={busy}
                                                            className="w-full gap-2"
                                                        >
                                                            <PauseCircle className="h-4 w-4" />
                                                            Hold / No-show
                                                        </Button>

                                                        <Button
                                                            type="button"
                                                            onClick={() => void onServed()}
                                                            disabled={busy}
                                                            className="w-full gap-2"
                                                        >
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
                                                Waiting Line
                                            </CardTitle>
                                            <CardDescription>Oldest tickets appear first and should be prioritized.</CardDescription>
                                        </CardHeader>

                                        <CardContent>
                                            {waiting.length === 0 ? (
                                                <EmptyStateCard message="No WAITING tickets." />
                                            ) : (
                                                <TableShell>
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="w-24">Queue</TableHead>
                                                                <TableHead className="w-40">Participant</TableHead>
                                                                <TableHead>Student ID</TableHead>
                                                                <TableHead className="min-w-[220px]">Purpose / Transaction</TableHead>
                                                                <TableHead className="hidden xl:table-cell">Waiting since</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {waiting.map((t, idx) => (
                                                                <TableRow key={t._id} className={idx === 0 ? "bg-muted/50" : ""}>
                                                                    <TableCell className="font-medium">#{t.queueNumber}</TableCell>
                                                                    <TableCell>{participantBadge(participantFromTicket(t))}</TableCell>
                                                                    <TableCell className="truncate">{t.studentId ?? "—"}</TableCell>
                                                                    <TableCell className="text-muted-foreground">
                                                                        <span className="block max-w-[28rem] whitespace-normal break-words">
                                                                            {ticketPurpose(t)}
                                                                        </span>
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
                                                HOLD Queue
                                            </CardTitle>
                                            <CardDescription>Return tickets to WAITING when they are ready.</CardDescription>
                                        </CardHeader>

                                        <CardContent>
                                            {hold.length === 0 ? (
                                                <EmptyStateCard message="No HOLD tickets." />
                                            ) : (
                                                <TableShell>
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="w-24">Queue</TableHead>
                                                                <TableHead className="w-40">Participant</TableHead>
                                                                <TableHead>Student ID</TableHead>
                                                                <TableHead className="min-w-[180px]">Purpose</TableHead>
                                                                <TableHead className="w-28">Attempts</TableHead>
                                                                <TableHead className="hidden md:table-cell">Updated</TableHead>
                                                                <TableHead className="w-32 text-right">Action</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {hold.map((t) => (
                                                                <TableRow key={t._id}>
                                                                    <TableCell className="font-medium">#{t.queueNumber}</TableCell>
                                                                    <TableCell>{participantBadge(participantFromTicket(t))}</TableCell>
                                                                    <TableCell className="truncate">{t.studentId ?? "—"}</TableCell>
                                                                    <TableCell className="text-muted-foreground">
                                                                        <span className="block max-w-[24rem] whitespace-normal break-words">
                                                                            {ticketPurpose(t)}
                                                                        </span>
                                                                    </TableCell>
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
                                            {out.length === 0 ? (
                                                <EmptyStateCard message="No OUT tickets." />
                                            ) : (
                                                <TableShell>
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="w-24">Queue</TableHead>
                                                                <TableHead className="w-40">Participant</TableHead>
                                                                <TableHead>Student ID</TableHead>
                                                                <TableHead className="min-w-[180px]">Purpose</TableHead>
                                                                <TableHead className="w-28">Attempts</TableHead>
                                                                <TableHead className="hidden md:table-cell">Out at</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {out.map((t) => (
                                                                <TableRow key={t._id}>
                                                                    <TableCell className="font-medium">#{t.queueNumber}</TableCell>
                                                                    <TableCell>{participantBadge(participantFromTicket(t))}</TableCell>
                                                                    <TableCell className="truncate">{t.studentId ?? "—"}</TableCell>
                                                                    <TableCell className="text-muted-foreground">
                                                                        <span className="block max-w-[24rem] whitespace-normal break-words">
                                                                            {ticketPurpose(t)}
                                                                        </span>
                                                                    </TableCell>
                                                                    <TableCell>{t.holdAttempts ?? 0}</TableCell>
                                                                    <TableCell className="hidden md:table-cell text-muted-foreground">
                                                                        {fmtTime((t as any).outAt)}
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
                                                <EmptyStateCard message="No history yet." />
                                            ) : (
                                                <TableShell>
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="w-24">Queue</TableHead>
                                                                <TableHead className="w-28">Status</TableHead>
                                                                <TableHead className="w-40">Participant</TableHead>
                                                                <TableHead className="min-w-[220px]">Purpose</TableHead>
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
                                                                    <TableCell>{participantBadge(participantFromTicket(t))}</TableCell>
                                                                    <TableCell className="text-muted-foreground">
                                                                        <span className="block max-w-[30rem] whitespace-normal break-words">
                                                                            {ticketPurpose(t)}
                                                                        </span>
                                                                    </TableCell>
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
