/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { toast } from "sonner"

import Header from "@/components/Header"
import Footer from "@/components/Footer"

import { guestApi } from "@/api/guest"
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

function readTransactionKey(tx: any) {
    const candidates = [tx?.key, tx?.transactionKey, tx?.transaction_key, tx?.code, tx?.id]
    for (const c of candidates) {
        const v = pickNonEmptyString(c)
        if (v) return v
    }
    return ""
}

function readTransactionLabel(tx: any, fallbackKey: string) {
    const candidates = [tx?.label, tx?.transactionLabel, tx?.transaction_label, tx?.name, tx?.title, tx?.purpose]
    for (const c of candidates) {
        const v = pickNonEmptyString(c)
        if (v) return v
    }
    return fallbackKey || "Unnamed transaction"
}

function normalizeAvailableTransactions(list: Array<ParticipantTransaction | Record<string, unknown>>) {
    const out: ParticipantTransaction[] = []
    const seen = new Set<string>()

    for (const raw of list) {
        const tx = (raw ?? {}) as Record<string, unknown>
        const rawKey = readTransactionKey(tx)
        const normalized = normalizeTransactionKey(rawKey)

        if (!rawKey || !normalized || seen.has(normalized)) continue
        seen.add(normalized)

        out.push({
            ...(tx as any),
            key: rawKey,
            label: readTransactionLabel(tx, rawKey),
        })
    }

    return out
}

function mapSelectionToAvailableKeys(keys: string[], availableTransactions: ParticipantTransaction[]): string[] {
    const normalizedToExact = new Map<string, string>()

    for (const tx of availableTransactions) {
        const rawKey = readTransactionKey(tx)
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

function readParticipantIdFromObject(source: any) {
    const candidates = [
        source?.participantId,
        source?.alumniId,
        source?.visitorId,
        source?.idNumber,
        source?.studentId,
        source?.tcNumber,
    ]

    for (const c of candidates) {
        const v = pickNonEmptyString(c)
        if (v) return v
    }
    return ""
}

function readPhoneFromObject(source: any) {
    const candidates = [source?.mobileNumber, source?.phone, source?.phoneNumber, source?.mobile]
    for (const c of candidates) {
        const v = pickNonEmptyString(c)
        if (v) return v
    }
    return ""
}

async function maybeInvoke<T = any>(owner: any, method: string, ...args: any[]): Promise<T> {
    const fn = owner?.[method]
    if (typeof fn !== "function") {
        throw new Error(`Method "${method}" is not available`)
    }
    return await fn.apply(owner, args)
}

async function callFirstSuccessful<T>(attempts: Array<() => Promise<T>>): Promise<T> {
    let lastError: unknown = null
    for (const attempt of attempts) {
        try {
            return await attempt()
        } catch (err) {
            lastError = err
        }
    }
    throw lastError ?? new Error("Request failed")
}

async function listParticipantDepartments(): Promise<{ departments: Department[] }> {
    const res = await callFirstSuccessful<any>([
        () => maybeInvoke(guestApi, "listDepartments"),
        () => maybeInvoke(studentApi, "listDepartments"),
    ])

    return {
        departments: Array.isArray(res?.departments) ? res.departments : [],
    }
}

async function getParticipantSession(opts?: { departmentId?: string }) {
    const dept = pickNonEmptyString(opts?.departmentId)

    return await callFirstSuccessful<any>([
        () => maybeInvoke(guestApi, "getSession", dept ? { departmentId: dept } : undefined),
        () => maybeInvoke(guestApi, "getSession"),
        () => maybeInvoke(studentApi, "getSession", dept ? { departmentId: dept } : undefined),
        () => maybeInvoke(studentApi, "getSession"),
    ])
}

async function getParticipantTicket(ticketId: string) {
    return await callFirstSuccessful<any>([
        () => maybeInvoke(guestApi, "getTicket", ticketId),
        () => maybeInvoke(studentApi, "getTicket", ticketId),
    ])
}

async function findActiveByParticipant(args: { departmentId: string; participantId: string }) {
    const payload = {
        departmentId: args.departmentId,
        participantId: args.participantId,
        studentId: args.participantId,
        idNumber: args.participantId,
        tcNumber: args.participantId,
    }

    return await callFirstSuccessful<any>([
        () => maybeInvoke(guestApi, "findActiveByParticipant", payload),
        () => maybeInvoke(guestApi, "findActiveByStudent", payload),
        () => maybeInvoke(studentApi, "findActiveByParticipant", payload),
        () => maybeInvoke(studentApi, "findActiveByStudent", { departmentId: args.departmentId, studentId: args.participantId }),
    ])
}

async function joinParticipantQueue(args: {
    departmentId: string
    participantId: string
    phone: string
    transactionKeys?: string[]
}) {
    const basePayload = {
        departmentId: args.departmentId,
        participantId: args.participantId,
        studentId: args.participantId,
        idNumber: args.participantId,
        tcNumber: args.participantId,
        phone: args.phone,
        mobileNumber: args.phone,
        transactionKeys: args.transactionKeys ?? [],
    }

    return await callFirstSuccessful<any>([
        () => maybeInvoke(guestApi, "joinQueue", basePayload),
        () =>
            maybeInvoke(studentApi, "joinQueue", {
                departmentId: args.departmentId,
                studentId: args.participantId,
                phone: args.phone,
                ...(args.transactionKeys?.length ? { transactionKeys: args.transactionKeys } : {}),
            }),
    ])
}

export default function AlumniJoinPage() {
    const location = useLocation()

    const qs = React.useMemo(() => new URLSearchParams(location.search || ""), [location.search])
    const preDeptId = React.useMemo(() => pickNonEmptyString(qs.get("departmentId")), [qs])
    const preParticipantId = React.useMemo(
        () =>
            pickNonEmptyString(
                qs.get("participantId") || qs.get("studentId") || qs.get("idNumber") || qs.get("visitorId") || qs.get("alumniId"),
            ),
        [qs],
    )
    const ticketId = React.useMemo(() => pickNonEmptyString(qs.get("ticketId") || qs.get("id")), [qs])

    const [loadingDepts, setLoadingDepts] = React.useState(true)
    const [loadingSession, setLoadingSession] = React.useState(true)
    const [departments, setDepartments] = React.useState<Department[]>([])

    const [sessionDepartmentId, setSessionDepartmentId] = React.useState<string>("")
    const [departmentId, setDepartmentId] = React.useState<string>("")
    const [didManuallySelectDepartment, setDidManuallySelectDepartment] = React.useState(false)

    const [participantId, setParticipantId] = React.useState<string>(preParticipantId)
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

    const myTicketsUrl = React.useMemo(() => {
        const q = new URLSearchParams()
        if (departmentId) q.set("departmentId", departmentId)
        if (participantId.trim()) {
            q.set("participantId", participantId.trim())
            q.set("studentId", participantId.trim())
        }
        const qsStr = q.toString()
        return `/alumni/my-tickets${qsStr ? `?${qsStr}` : ""}`
    }, [departmentId, participantId])

    const selectedForSubmit = React.useMemo(
        () => mapSelectionToAvailableKeys(selectedTransactions, availableTransactions),
        [selectedTransactions, availableTransactions],
    )

    const selectedTransactionSet = React.useMemo(
        () => new Set(selectedForSubmit),
        [selectedForSubmit],
    )

    const handleDepartmentChange = React.useCallback((value: string) => {
        setDidManuallySelectDepartment(true)
        setDepartmentId(value)
    }, [])

    const loadDepartments = React.useCallback(async () => {
        setLoadingDepts(true)
        try {
            const res = await listParticipantDepartments()
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
                const res = await getParticipantSession({
                    departmentId: pickNonEmptyString(opts?.departmentId),
                })

                const p = (res?.participant ?? null) as any
                const tx = normalizeAvailableTransactions((res?.availableTransactions ?? []) as any[])

                setParticipant(p)
                setAvailableTransactions(tx)
                setSelectedTransactions((prev) => mapSelectionToAvailableKeys(prev, tx))

                const pid = readParticipantIdFromObject(p)
                const mobile = readPhoneFromObject(p)
                const dept = pickNonEmptyString(p?.departmentId)

                if (pid) setParticipantId((prev) => prev || pid)
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
            const res = await getParticipantTicket(ticketId)
            setTicket((res?.ticket ?? null) as Ticket | null)

            const dept = (res?.ticket as any)?.department
            const deptIdFromTicket =
                typeof dept === "string" ? dept : pickNonEmptyString(dept?._id) || pickNonEmptyString(dept?.id)

            if (deptIdFromTicket) {
                setDidManuallySelectDepartment(true)
                setDepartmentId(deptIdFromTicket)
            }

            const idFromTicket = readParticipantIdFromObject(res?.ticket)
            if (idFromTicket) setParticipantId(idFromTicket)

            const phoneFromTicket = readPhoneFromObject(res?.ticket)
            if (phoneFromTicket) setPhone(phoneFromTicket)

            const txKeysRaw = [
                ...(Array.isArray(res?.transactions?.transactionKeys) ? res.transactions.transactionKeys : []),
                ...(Array.isArray((res?.ticket as any)?.transactionKeys) ? (res.ticket as any).transactionKeys : []),
            ]

            const txKeys = txKeysRaw
                .map((k) => pickNonEmptyString(k))
                .filter((k) => !!k)

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

            if (has(preDeptId)) return preDeptId
            if (didManuallySelectDepartment && has(prev)) return prev
            if (has(sessionDepartmentId)) return sessionDepartmentId
            if (has(prev)) return prev
            return departments[0]?._id ?? ""
        })
    }, [departments, preDeptId, sessionDepartmentId, didManuallySelectDepartment])

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
        const pid = participantId.trim()
        if (!departmentId) return toast.error("Please select a department.")
        if (!pid) return toast.error("Please enter your Alumni/Visitor ID.")

        setBusy(true)
        try {
            const res = await findActiveByParticipant({ departmentId, participantId: pid })
            if (res?.ticket) {
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
        const pid = participantId.trim()
        const ph = normalizeMobile(phone)

        if (!departmentId) return toast.error("Please select a department.")
        if (!pid) return toast.error("Alumni/Visitor ID is required.")
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
            const res = await joinParticipantQueue(
                isSessionFlow
                    ? {
                        departmentId,
                        participantId: pid,
                        phone: ph,
                        transactionKeys: selectedForSubmit,
                    }
                    : {
                        departmentId,
                        participantId: pid,
                        phone: ph,
                    },
            )

            setTicket((res?.ticket ?? null) as Ticket | null)
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
                        Department defaults to your registered profile when available. You can change it here anytime.
                    </p>
                </div>

                <div className="grid gap-6">
                    <Card className="min-w-0">
                        <CardHeader>
                            <CardTitle>Queue Entry</CardTitle>
                            <CardDescription>
                                Alumni/Visitor ID and phone are prefilled from your account when available. You may edit before joining.
                            </CardDescription>
                            <div className="pt-1">
                                {loadingSession ? (
                                    <Skeleton className="h-5 w-40" />
                                ) : participant ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="secondary">Profile synced</Badge>
                                        <Badge variant="outline">{availableTransactions.length} purpose(s) loaded</Badge>
                                    </div>
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
                                        <div className="min-w-0 space-y-2">
                                            <Label>Department</Label>
                                            <Select
                                                value={departmentId}
                                                onValueChange={handleDepartmentChange}
                                                disabled={busy || !departments.length}
                                            >
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

                                        <div className="min-w-0 space-y-2">
                                            <Label htmlFor="participantId">Alumni/Visitor ID</Label>
                                            <Input
                                                id="participantId"
                                                value={participantId}
                                                onChange={(e) => setParticipantId(e.target.value)}
                                                placeholder="e.g. AL-24-00001"
                                                autoComplete="off"
                                                inputMode="text"
                                                disabled={busy}
                                            />
                                        </div>

                                        <div className="min-w-0 space-y-2">
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
                                                        const txKey = readTransactionKey(tx)
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
                                                                {readTransactionLabel(tx, txKey)}
                                                            </Button>
                                                        )
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-muted-foreground">
                                                    No transaction options are available for your account in this department.
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
                                                !participantId.trim() ||
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

                                <div className="grid gap-2">
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
