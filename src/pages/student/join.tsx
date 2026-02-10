/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { toast } from "sonner"

import Header from "@/components/Header"
import Footer from "@/components/Footer"

import { studentApi, type Department, type ParticipantTransaction, type Ticket } from "@/api/student"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

function pickNonEmptyString(v: unknown) {
    return typeof v === "string" && v.trim() ? v.trim() : ""
}

function normalizeMobile(value: string) {
    return value.replace(/[^\d+]/g, "").trim()
}

function normalizeTransactionKey(value: unknown) {
    const raw = String(value ?? "").trim().toLowerCase()
    if (!raw) return ""
    return raw.replace(/[_\s]+/g, "-")
}

function normalizeAvailableTransactions(list: ParticipantTransaction[]) {
    const out: ParticipantTransaction[] = []
    const seen = new Set<string>()

    for (const tx of list) {
        const rawKey = pickNonEmptyString(tx?.key)
        const normalized = normalizeTransactionKey(rawKey)
        if (!rawKey || !normalized || seen.has(normalized)) continue
        seen.add(normalized)

        out.push({
            ...tx,
            key: rawKey,
        })
    }

    return out
}

function mapSelectionToAvailableKeys(
    keys: string[],
    availableTransactions: ParticipantTransaction[],
): string[] {
    const normalizedToExact = new Map<string, string>()

    for (const tx of availableTransactions) {
        const rawKey = pickNonEmptyString(tx?.key)
        const normalized = normalizeTransactionKey(rawKey)
        if (!rawKey || !normalized || normalizedToExact.has(normalized)) continue
        normalizedToExact.set(normalized, rawKey)
    }

    const out: string[] = []
    const seen = new Set<string>()

    for (const key of keys) {
        const normalized = normalizeTransactionKey(key)
        if (!normalized) continue

        const exact = normalizedToExact.get(normalized)
        if (!exact || seen.has(exact)) continue

        seen.add(exact)
        out.push(exact)
    }

    return out
}

function sameStringArray(a: string[], b: string[]) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) return false
    }
    return true
}

function deptNameFromTicketDepartment(dept: any, fallback?: string) {
    if (!dept) return fallback ?? "—"
    if (typeof dept === "string") return fallback ?? "—"
    return pickNonEmptyString(dept?.name) || fallback || "—"
}

function statusBadgeVariant(status?: string) {
    switch (status) {
        case "WAITING":
            return "outline"
        case "CALLED":
            return "default"
        case "HOLD":
            return "secondary"
        case "SERVED":
            return "default"
        case "OUT":
            return "secondary"
        default:
            return "secondary"
    }
}

function toggleKey(keys: string[], key: string) {
    if (keys.includes(key)) return keys.filter((k) => k !== key)
    return [...keys, key]
}

export default function StudentJoinPage() {
    const location = useLocation()

    const qs = React.useMemo(() => new URLSearchParams(location.search || ""), [location.search])
    const preDeptId = React.useMemo(() => pickNonEmptyString(qs.get("departmentId")), [qs])
    const preStudentId = React.useMemo(() => pickNonEmptyString(qs.get("studentId")), [qs])
    const ticketId = React.useMemo(() => pickNonEmptyString(qs.get("ticketId") || qs.get("id")), [qs])

    const [loadingDepts, setLoadingDepts] = React.useState(true)
    const [loadingSession, setLoadingSession] = React.useState(true)
    const [departments, setDepartments] = React.useState<Department[]>([])

    const [sessionDepartmentId, setSessionDepartmentId] = React.useState<string>("")
    const [departmentId, setDepartmentId] = React.useState<string>("")
    const [studentId, setStudentId] = React.useState<string>(preStudentId)
    const [phone, setPhone] = React.useState<string>("")

    const [participant, setParticipant] = React.useState<any | null>(null)
    const [availableTransactions, setAvailableTransactions] = React.useState<ParticipantTransaction[]>([])
    const [selectedTransactions, setSelectedTransactions] = React.useState<string[]>([])

    const [busy, setBusy] = React.useState(false)
    const [ticket, setTicket] = React.useState<Ticket | null>(null)

    const isSessionFlow = Boolean(participant)

    const selectedDept = React.useMemo(
        () => departments.find((d) => d._id === departmentId) || null,
        [departments, departmentId],
    )

    const publicDisplayUrl = React.useMemo(() => {
        if (!departmentId) return ""
        return `/display?departmentId=${encodeURIComponent(departmentId)}`
    }, [departmentId])

    const myTicketsUrl = React.useMemo(() => {
        const q = new URLSearchParams()
        if (departmentId) q.set("departmentId", departmentId)
        if (studentId.trim()) q.set("studentId", studentId.trim())
        const qsStr = q.toString()
        return `/student/my-tickets${qsStr ? `?${qsStr}` : ""}`
    }, [departmentId, studentId])

    const selectedForSubmit = React.useMemo(
        () => mapSelectionToAvailableKeys(selectedTransactions, availableTransactions),
        [selectedTransactions, availableTransactions],
    )

    const selectedTransactionSet = React.useMemo(
        () => new Set(selectedForSubmit),
        [selectedForSubmit],
    )

    const loadDepartments = React.useCallback(async () => {
        setLoadingDepts(true)
        try {
            const res = await studentApi.listDepartments()
            setDepartments(res.departments ?? [])
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to load departments.")
            setDepartments([])
            setDepartmentId("")
        } finally {
            setLoadingDepts(false)
        }
    }, [])

    const loadSession = React.useCallback(
        async (opts?: { departmentId?: string; silent?: boolean; preserveDepartment?: boolean }) => {
            const silent = Boolean(opts?.silent)

            if (!silent) setLoadingSession(true)
            try {
                const res = await studentApi.getSession({
                    departmentId: pickNonEmptyString(opts?.departmentId),
                })

                const p = (res.participant ?? null) as any
                const tx = normalizeAvailableTransactions(
                    (res.availableTransactions ?? []).filter((x) => pickNonEmptyString(x?.key)),
                )

                setParticipant(p)
                setAvailableTransactions(tx)
                setSelectedTransactions((prev) => mapSelectionToAvailableKeys(prev, tx))

                const sid = pickNonEmptyString(p?.tcNumber) || pickNonEmptyString(p?.studentId)
                const mobile = pickNonEmptyString(p?.mobileNumber) || pickNonEmptyString(p?.phone)
                const dept = pickNonEmptyString(p?.departmentId)

                if (sid) setStudentId((prev) => prev || sid)
                if (mobile) setPhone((prev) => prev || mobile)

                if (!opts?.preserveDepartment && dept) {
                    setSessionDepartmentId(dept)
                    setDepartmentId((prev) => prev || dept)
                }
            } catch {
                if (!silent) {
                    setParticipant(null)
                    setAvailableTransactions([])
                    setSelectedTransactions([])
                }
            } finally {
                if (!silent) setLoadingSession(false)
            }
        },
        [],
    )

    const loadTicketById = React.useCallback(async () => {
        if (!ticketId) return
        setBusy(true)
        try {
            const res = await studentApi.getTicket(ticketId)
            setTicket(res.ticket ?? null)

            const dept = (res.ticket as any)?.department
            const deptIdFromTicket =
                typeof dept === "string" ? dept : pickNonEmptyString(dept?._id) || pickNonEmptyString(dept?.id)

            if (deptIdFromTicket) setDepartmentId(deptIdFromTicket)
            if ((res.ticket as any)?.studentId) setStudentId(String((res.ticket as any).studentId))
            if ((res.ticket as any)?.phone) setPhone(String((res.ticket as any).phone))

            const txKeys = Array.isArray(res.transactions?.transactionKeys)
                ? res.transactions?.transactionKeys.filter((k) => pickNonEmptyString(k))
                : []

            if (txKeys.length) setSelectedTransactions(txKeys)
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to load ticket.")
        } finally {
            setBusy(false)
        }
    }, [ticketId])

    React.useEffect(() => {
        void loadDepartments()
        void loadSession()
    }, [loadDepartments, loadSession])

    React.useEffect(() => {
        if (!departments.length) return

        setDepartmentId((prev) => {
            const has = (id: string) => !!id && departments.some((d) => d._id === id)

            if (has(prev)) return prev
            if (has(preDeptId)) return preDeptId
            if (has(sessionDepartmentId)) return sessionDepartmentId

            return departments[0]?._id ?? ""
        })
    }, [departments, preDeptId, sessionDepartmentId])

    React.useEffect(() => {
        void loadTicketById()
    }, [loadTicketById])

    React.useEffect(() => {
        if (loadingSession) return
        if (!isSessionFlow) return
        if (!departmentId) return

        void loadSession({
            departmentId,
            silent: true,
            preserveDepartment: true,
        })
    }, [loadingSession, isSessionFlow, departmentId, loadSession])

    React.useEffect(() => {
        if (!isSessionFlow) return
        if (!availableTransactions.length) return

        setSelectedTransactions((prev) => {
            const normalized = mapSelectionToAvailableKeys(prev, availableTransactions)
            return sameStringArray(prev, normalized) ? prev : normalized
        })
    }, [isSessionFlow, availableTransactions])

    async function onFindActive() {
        const sid = studentId.trim()
        if (!departmentId) return toast.error("Please select a department.")
        if (!sid) return toast.error("Please enter your Student ID.")

        setBusy(true)
        try {
            const res = await studentApi.findActiveByStudent({ departmentId, studentId: sid })
            if (res.ticket) {
                setTicket(res.ticket)
                toast.success("Active ticket found.")
            } else {
                setTicket(null)
                toast.message("No active ticket found for today.")
            }
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to find active ticket.")
        } finally {
            setBusy(false)
        }
    }

    async function onJoin() {
        const sid = studentId.trim()
        const ph = normalizeMobile(phone)

        if (!departmentId) return toast.error("Please select a department.")
        if (!sid) return toast.error("Student ID is required.")
        if (!ph) return toast.error("Phone number is required.")

        if (isSessionFlow && !availableTransactions.length) {
            return toast.error("No queue purpose is available for this account and department.")
        }
        if (isSessionFlow && !selectedForSubmit.length) {
            return toast.error("Please select at least one queue purpose.")
        }

        if (isSessionFlow && !sameStringArray(selectedTransactions, selectedForSubmit)) {
            setSelectedTransactions(selectedForSubmit)
        }

        setBusy(true)
        try {
            const res = await studentApi.joinQueue(
                isSessionFlow
                    ? {
                        departmentId,
                        studentId: sid,
                        phone: ph,
                        transactionKeys: selectedForSubmit,
                    }
                    : {
                        departmentId,
                        studentId: sid,
                        phone: ph,
                    }
            )

            setTicket(res.ticket)
            toast.success("You are now in the queue.")
        } catch (e: any) {
            const status = (e as any)?.status
            const existing = (e as any)?.data?.ticket
            if (status === 409 && existing) {
                setTicket(existing as Ticket)
                toast.message("You already have an active ticket for today.")
                return
            }

            const msg = String(e?.message ?? "")
            if (msg.toLowerCase().includes("invalid transaction selection")) {
                await loadSession({
                    departmentId,
                    silent: true,
                    preserveDepartment: true,
                })
                toast.error("Selected queue purpose is not available for the chosen department. Please reselect and try again.")
                return
            }

            toast.error(e?.message ?? "Failed to join queue.")
        } finally {
            setBusy(false)
        }
    }

    const ticketDeptName = React.useMemo(() => {
        if (!ticket) return "—"
        return deptNameFromTicketDepartment(ticket.department, selectedDept?.name)
    }, [ticket, selectedDept?.name])

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Header variant="student" />

            <main className="mx-auto w-full px-4 py-10">
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold tracking-tight">Join Queue</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Department defaults to your registered profile. You can change it here if needed.
                    </p>
                </div>

                <div className="grid gap-6">
                    <Card className="min-w-0">
                        <CardHeader>
                            <CardTitle>Queue Entry</CardTitle>
                            <CardDescription>
                                Student ID and phone are prefilled from your account when available. You may edit before joining.
                            </CardDescription>
                            <div className="pt-1">
                                {loadingSession ? (
                                    <Skeleton className="h-5 w-40" />
                                ) : participant ? (
                                    <Badge variant="secondary">Profile synced</Badge>
                                ) : (
                                    <Badge variant="outline">Guest mode</Badge>
                                )}
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-5">
                            {loadingDepts ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : (
                                <>
                                    <div className="grid gap-4 sm:grid-cols-3">
                                        <div className="space-y-2 min-w-0">
                                            <Label>Department</Label>
                                            <Select value={departmentId} onValueChange={setDepartmentId} disabled={busy || !departments.length}>
                                                <SelectTrigger className="w-full min-w-0">
                                                    <SelectValue placeholder="Select department" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {departments.map((d) => (
                                                        <SelectItem key={d._id} value={d._id}>
                                                            {d.name}
                                                            {d.code ? ` (${d.code})` : ""}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {!departments.length ? (
                                                <div className="text-xs text-muted-foreground">No departments available.</div>
                                            ) : null}
                                        </div>

                                        <div className="space-y-2 min-w-0">
                                            <Label htmlFor="studentId">Student ID</Label>
                                            <Input
                                                id="studentId"
                                                value={studentId}
                                                onChange={(e) => setStudentId(e.target.value)}
                                                placeholder="e.g. TC-20-A-00001"
                                                autoComplete="off"
                                                inputMode="text"
                                                disabled={busy}
                                            />
                                        </div>

                                        <div className="space-y-2 min-w-0">
                                            <Label htmlFor="phone">Phone Number</Label>
                                            <Input
                                                id="phone"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                placeholder="e.g. 09xxxxxxxxx or +639xxxxxxxxx"
                                                autoComplete="tel"
                                                inputMode="tel"
                                                disabled={busy}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <Label>Purpose of Queue (Transaction)</Label>
                                            {selectedForSubmit.length ? (
                                                <Badge variant="secondary">{selectedForSubmit.length} selected</Badge>
                                            ) : null}
                                        </div>

                                        {loadingSession ? (
                                            <div className="space-y-2">
                                                <Skeleton className="h-9 w-full" />
                                                <Skeleton className="h-9 w-full" />
                                            </div>
                                        ) : participant ? (
                                            availableTransactions.length ? (
                                                <div className="grid gap-2 sm:grid-cols-2">
                                                    {availableTransactions.map((tx) => {
                                                        const txKey = pickNonEmptyString(tx?.key)
                                                        if (!txKey) return null

                                                        const active = selectedTransactionSet.has(txKey)

                                                        return (
                                                            <Button
                                                                key={txKey}
                                                                type="button"
                                                                variant={active ? "default" : "outline"}
                                                                className="h-auto justify-start whitespace-normal text-left"
                                                                onClick={() =>
                                                                    setSelectedTransactions((prev) =>
                                                                        toggleKey(
                                                                            mapSelectionToAvailableKeys(prev, availableTransactions),
                                                                            txKey,
                                                                        ),
                                                                    )
                                                                }
                                                                disabled={busy}
                                                            >
                                                                {tx.label}
                                                            </Button>
                                                        )
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-muted-foreground">
                                                    No transaction options are available for your account.
                                                </div>
                                            )
                                        ) : (
                                            <div className="text-sm text-muted-foreground">
                                                Login first to select queue purpose. Guest mode supports legacy joining only.
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                        <Button type="button" variant="outline" onClick={() => void onFindActive()} disabled={busy}>
                                            Find my ticket
                                        </Button>
                                        <Button
                                            type="button"
                                            onClick={() => void onJoin()}
                                            disabled={
                                                busy ||
                                                !departmentId ||
                                                !studentId.trim() ||
                                                !normalizeMobile(phone) ||
                                                (isSessionFlow &&
                                                    (!availableTransactions.length || !selectedForSubmit.length))
                                            }
                                        >
                                            {busy ? "Please wait…" : "Join Queue"}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {ticket ? (
                        <Card className="min-w-0">
                            <CardHeader>
                                <CardTitle>Your Ticket</CardTitle>
                                <CardDescription>Keep this page open or take a screenshot.</CardDescription>
                            </CardHeader>

                            <CardContent className="space-y-4">
                                <div className="rounded-2xl border bg-muted p-6">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="text-sm text-muted-foreground">Department</div>
                                            <div className="truncate text-lg font-medium">{ticketDeptName}</div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Badge variant={statusBadgeVariant(ticket.status) as any}>{ticket.status}</Badge>
                                            <Badge variant="secondary">{ticket.dateKey}</Badge>
                                        </div>
                                    </div>

                                    <Separator className="my-5" />

                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                        <div>
                                            <div className="text-sm text-muted-foreground">Queue Number</div>
                                            <div className="mt-1 text-6xl font-semibold tracking-tight">#{ticket.queueNumber}</div>
                                        </div>

                                        <div className="text-sm text-muted-foreground">
                                            Ticket ID: <span className="font-mono">{ticket._id}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-2 sm:grid-cols-2">
                                    <Button asChild variant="outline" className="w-full" disabled={!departmentId}>
                                        <Link to={publicDisplayUrl}>Open Public Display</Link>
                                    </Button>

                                    <Button asChild variant="secondary" className="w-full">
                                        <Link to={myTicketsUrl}>Go to My Tickets</Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ) : null}
                </div>
            </main>

            <Footer variant="student" />
        </div>
    )
}
