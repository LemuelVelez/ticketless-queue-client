/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { toast } from "sonner"
import { Lock, RefreshCw, Ticket as TicketIcon } from "lucide-react"

import Header from "@/components/Header"
import Footer from "@/components/Footer"

import { guestApi } from "@/api/guest"
import {
    studentApi,
    type Department,
    type ParticipantTransaction,
    type Ticket,
    participantAuthStorage,
} from "@/api/student"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

const LOCK_SENTINEL = "__LOCKED__"

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

function toggleKey(keys: string[], key: string) {
    if (keys.includes(key)) return keys.filter((k) => k !== key)
    return [...keys, key]
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

function deptNameFromTicketDepartment(dept: any, fallback?: string) {
    if (!dept) return fallback ?? "—"
    if (typeof dept === "string") return fallback ?? "—"
    return pickNonEmptyString(dept?.name) || fallback || "—"
}

function safeReadLastAction(key: string) {
    if (typeof window === "undefined") return 0
    const raw = window.localStorage.getItem(key)
    const n = Number(raw ?? 0)
    return Number.isFinite(n) ? n : 0
}

function safeWriteLastAction(key: string, value: number) {
    if (typeof window === "undefined") return
    window.localStorage.setItem(key, String(value))
}

function useActionCooldown(storageKey: string, cooldownMs: number) {
    const [remainingMs, setRemainingMs] = React.useState(0)

    const start = React.useCallback(() => {
        const now = Date.now()
        safeWriteLastAction(storageKey, now)
        setRemainingMs(cooldownMs)
    }, [storageKey, cooldownMs])

    React.useEffect(() => {
        const tick = () => {
            const last = safeReadLastAction(storageKey)
            const rem = cooldownMs - (Date.now() - last)
            setRemainingMs(rem > 0 ? rem : 0)
        }

        tick()
        const id = window.setInterval(tick, 250)
        return () => window.clearInterval(id)
    }, [storageKey, cooldownMs])

    return {
        remainingMs,
        isCoolingDown: remainingMs > 0,
        start,
        remainingSec: Math.ceil(remainingMs / 1000),
    }
}

export default function StudentJoinPage() {
    const location = useLocation()

    const qs = React.useMemo(() => new URLSearchParams(location.search || ""), [location.search])
    const preDeptId = React.useMemo(() => pickNonEmptyString(qs.get("departmentId")), [qs])
    const preStudentId = React.useMemo(() => pickNonEmptyString(qs.get("studentId") || qs.get("tcNumber")), [qs])
    const ticketId = React.useMemo(() => pickNonEmptyString(qs.get("ticketId") || qs.get("id")), [qs])

    const [loadingDepts, setLoadingDepts] = React.useState(true)
    const [loadingSession, setLoadingSession] = React.useState(true)

    const [departments, setDepartments] = React.useState<Department[]>([])

    // 🔒 lock department immediately from storage (prevents “editable flicker”)
    const initialLockedDept = participantAuthStorage.getDepartmentId() || ""
    const [lockedDepartmentId, setLockedDepartmentId] = React.useState<string>(initialLockedDept)

    const [sessionDepartmentId, setSessionDepartmentId] = React.useState<string>("")
    const [departmentId, setDepartmentId] = React.useState<string>(initialLockedDept || "")
    const [didManuallySelectDepartment, setDidManuallySelectDepartment] = React.useState(false)

    const [studentId, setStudentId] = React.useState<string>(preStudentId)
    const [phone, setPhone] = React.useState<string>("")

    const [participant, setParticipant] = React.useState<any | null>(null)
    const [availableTransactions, setAvailableTransactions] = React.useState<ParticipantTransaction[]>([])
    const [selectedTransactions, setSelectedTransactions] = React.useState<string[]>([])

    const [busy, setBusy] = React.useState(false)
    const [ticket, setTicket] = React.useState<Ticket | null>(null)

    // ✅ active ticket state (used to block ticket generation)
    const [activeTicket, setActiveTicket] = React.useState<Ticket | null>(null)
    const [checkingActive, setCheckingActive] = React.useState(false)

    const isSessionFlow = Boolean(participant)
    const isDepartmentLocked = Boolean(lockedDepartmentId)

    const selectedDept = React.useMemo(
        () => departments.find((d) => d._id === departmentId) || null,
        [departments, departmentId],
    )

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

    const joinCooldownKey = React.useMemo(() => {
        const sid = studentId.trim() || "none"
        return `student:join:attempt:${departmentId || "none"}:${sid}`
    }, [departmentId, studentId])

    const findCooldownKey = React.useMemo(() => {
        const sid = studentId.trim() || "none"
        return `student:join:find:${departmentId || "none"}:${sid}`
    }, [departmentId, studentId])

    const joinCooldown = useActionCooldown(joinCooldownKey, 15000)
    const findCooldown = useActionCooldown(findCooldownKey, 5000)

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

    const loadSession = React.useCallback(async () => {
        setLoadingSession(true)
        try {
            const res = await guestApi.getSession()
            const p = (res?.participant ?? null) as any | null
            const tx = normalizeAvailableTransactions((res?.availableTransactions ?? []) as any[])

            setParticipant(p)
            setAvailableTransactions(tx)
            setSelectedTransactions((prev) => mapSelectionToAvailableKeys(prev, tx))

            if (!p) {
                setSessionDepartmentId("")
                setLockedDepartmentId("")
                participantAuthStorage.clearDepartmentId()
                return
            }

            const sid =
                pickNonEmptyString(p?.tcNumber) ||
                pickNonEmptyString(p?.studentId) ||
                pickNonEmptyString(p?.idNumber)

            const mobile =
                pickNonEmptyString(p?.mobileNumber) ||
                pickNonEmptyString(p?.phone)

            const dept = pickNonEmptyString(p?.departmentId)

            if (sid) setStudentId((prev) => prev || sid)
            if (mobile) setPhone((prev) => prev || mobile)

            // 🔒 lock department after registration/profile sync
            const storedLock = participantAuthStorage.getDepartmentId() || ""
            const deptLockedFlag = Boolean((res as any)?.departmentLocked)
            const shouldLock = deptLockedFlag || Boolean(dept) || Boolean(storedLock)
            const effective = dept || storedLock

            if (dept) {
                setSessionDepartmentId(dept)
                participantAuthStorage.setDepartmentId(dept)
            } else if (storedLock) {
                setSessionDepartmentId(storedLock)
            }

            if (shouldLock) {
                setLockedDepartmentId(effective || LOCK_SENTINEL)
                if (effective) {
                    setDepartmentId(effective)
                    setDidManuallySelectDepartment(false)
                }
            } else {
                setLockedDepartmentId("")
                setSessionDepartmentId("")
                participantAuthStorage.clearDepartmentId()
            }
        } catch {
            setParticipant(null)
            setAvailableTransactions([])
            setSelectedTransactions([])
            setSessionDepartmentId("")
            setLockedDepartmentId("")
            participantAuthStorage.clearDepartmentId()
        } finally {
            setLoadingSession(false)
        }
    }, [])

    const loadTicketById = React.useCallback(async () => {
        if (!ticketId) return
        setBusy(true)
        try {
            const res = await studentApi.getTicket(ticketId)
            const t = (res?.ticket ?? null) as Ticket | null
            setTicket(t)

            // If ticket contains transaction keys, keep them in selection (best-effort)
            const txKeysRaw = [
                ...(Array.isArray(res?.transactions?.transactionKeys) ? res.transactions!.transactionKeys! : []),
                ...(Array.isArray((t as any)?.transactionKeys) ? ((t as any).transactionKeys as string[]) : []),
            ]
            const txKeys = txKeysRaw.map((k) => pickNonEmptyString(k)).filter(Boolean)
            if (txKeys.length) setSelectedTransactions(txKeys)

            // Do not override locked department
            const dept = (t as any)?.department
            const deptIdFromTicket =
                typeof dept === "string" ? dept : pickNonEmptyString(dept?._id) || pickNonEmptyString(dept?.id)

            if (deptIdFromTicket && !isDepartmentLocked) {
                setDidManuallySelectDepartment(true)
                setDepartmentId(deptIdFromTicket)
            }

            const sid = pickNonEmptyString((t as any)?.studentId)
            if (sid) setStudentId((prev) => prev || sid)

            const ph = pickNonEmptyString((t as any)?.phone)
            if (ph) setPhone((prev) => prev || ph)
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to load ticket.")
        } finally {
            setBusy(false)
        }
    }, [ticketId, isDepartmentLocked])

    const checkActiveTicket = React.useCallback(
        async (opts?: { silent?: boolean }) => {
            const sid = studentId.trim()
            if (!departmentId || !sid) {
                setActiveTicket(null)
                return null
            }

            const silent = Boolean(opts?.silent)
            if (!silent) setCheckingActive(true)

            try {
                const res = await studentApi.findActiveByStudent({ departmentId, studentId: sid })
                const t = (res?.ticket ?? null) as Ticket | null
                setActiveTicket(t)
                if (t) setTicket(t)
                return t
            } catch {
                if (!silent) toast.error("Failed to check active ticket.")
                return null
            } finally {
                if (!silent) setCheckingActive(false)
            }
        },
        [departmentId, studentId],
    )

    const handleDepartmentChange = React.useCallback(
        (value: string) => {
            if (loadingSession) {
                toast.message("Loading your session…")
                return
            }
            if (isDepartmentLocked) {
                toast.message("Department is locked to your registered profile.")
                return
            }
            setDidManuallySelectDepartment(true)
            setDepartmentId(value)
        },
        [isDepartmentLocked, loadingSession],
    )

    React.useEffect(() => {
        void loadDepartments()
        void loadSession()
    }, [loadDepartments, loadSession])

    React.useEffect(() => {
        if (!departments.length) return

        setDepartmentId((prev) => {
            const has = (id: string) => !!id && departments.some((d) => d._id === id)

            if (isDepartmentLocked && has(lockedDepartmentId)) return lockedDepartmentId

            if (has(preDeptId)) return preDeptId

            if (didManuallySelectDepartment && has(prev)) return prev
            if (has(sessionDepartmentId)) return sessionDepartmentId
            if (has(prev)) return prev
            return departments[0]?._id ?? ""
        })
    }, [departments, preDeptId, sessionDepartmentId, didManuallySelectDepartment, isDepartmentLocked, lockedDepartmentId])

    React.useEffect(() => {
        void loadTicketById()
    }, [loadTicketById])

    React.useEffect(() => {
        if (!departmentId || !studentId.trim()) return
        void checkActiveTicket({ silent: true })
    }, [departmentId, studentId, checkActiveTicket])

    async function onFindActive() {
        const sid = studentId.trim()
        if (!departmentId) return toast.error("Please select a department.")
        if (!sid) return toast.error("Please enter your Student ID.")

        if (findCooldown.isCoolingDown) {
            toast.message(`Please wait ${findCooldown.remainingSec}s before checking again.`)
            return
        }

        findCooldown.start()
        const t = await checkActiveTicket({ silent: false })
        if (t) toast.success("Active ticket found.")
        else toast.message("No active ticket found for today.")
    }

    async function onJoin() {
        const sid = studentId.trim()
        const ph = normalizeMobile(phone)

        if (!departmentId) return toast.error("Please select a department.")
        if (!sid) return toast.error("Student ID is required.")

        // 🔒 hard block when active exists
        if (activeTicket) {
            toast.message("You already have an active ticket for today.")
            return
        }

        if (joinCooldown.isCoolingDown) {
            toast.message(`Please wait ${joinCooldown.remainingSec}s before trying again.`)
            return
        }

        // strict server check before joining
        setCheckingActive(true)
        const existing = await checkActiveTicket({ silent: true })
        setCheckingActive(false)
        if (existing) {
            toast.message("You already have an active ticket for today.")
            return
        }

        // session-flow requires transactions (best UX + matches backend)
        if (isSessionFlow) {
            if (!availableTransactions.length) {
                return toast.error("No queue purpose is available for this account and department.")
            }
            if (!selectedForSubmit.length) {
                return toast.error("Please select at least one queue purpose.")
            }
            if (!sameStringArray(selectedTransactions, selectedForSubmit)) {
                setSelectedTransactions(selectedForSubmit)
            }
        }

        joinCooldown.start()
        setBusy(true)
        try {
            // ✅ Transactions are included when available (session-flow).
            // Guest/unregistered fallback still works (legacy join without transactions).
            const payload = isSessionFlow
                ? {
                      departmentId,
                      studentId: sid,
                      phone: ph || undefined,
                      transactionKeys: selectedForSubmit,
                  }
                : {
                      departmentId,
                      studentId: sid,
                      phone: ph || undefined,
                  }

            const res = await studentApi.joinQueue(payload as any)
            const t = (res?.ticket ?? null) as Ticket | null
            setTicket(t)
            setActiveTicket(t)
            toast.success("You are now in the queue.")
        } catch (e: any) {
            const status = (e as any)?.status
            const existingTicket = (e as any)?.data?.ticket

            if (status === 409 && existingTicket) {
                setTicket(existingTicket as Ticket)
                setActiveTicket(existingTicket as Ticket)
                toast.message("You already have an active ticket for today.")
                return
            }

            const msg = String(e?.message ?? "")
            if (msg.toLowerCase().includes("invalid transaction selection")) {
                await loadSession()
                toast.error("Selected queue purpose is not available. Please reselect and try again.")
                return
            }

            toast.error(e?.message ?? "Failed to join queue.")
        } finally {
            setBusy(false)
        }
    }

    const ticketDeptName = React.useMemo(() => {
        const t = activeTicket ?? ticket
        if (!t) return "—"
        return deptNameFromTicketDepartment(t.department, selectedDept?.name)
    }, [ticket, activeTicket, selectedDept?.name])

    const ticketToShow = activeTicket ?? ticket

    const selectedTransactionLabels = React.useMemo(() => {
        if (!selectedForSubmit.length) return []
        const map = new Map<string, string>()
        for (const tx of availableTransactions) {
            const k = readTransactionKey(tx)
            if (!k) continue
            map.set(k, readTransactionLabel(tx, k))
        }
        return selectedForSubmit.map((k) => map.get(k) || k)
    }, [selectedForSubmit, availableTransactions])

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Header variant="student" />

            <main className="mx-auto w-full px-4 py-10">
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold tracking-tight">Join Queue</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Select your department, choose a queue purpose (transaction), then generate your ticket.
                    </p>
                </div>

                <div className="grid gap-6">
                    <Card className="min-w-0">
                        <CardHeader>
                            <CardTitle>Queue Entry</CardTitle>
                            <CardDescription>
                                When logged in, your available queue purposes are loaded from your profile and the department is locked.
                            </CardDescription>

                            <div className="pt-1">
                                {loadingSession ? (
                                    <Skeleton className="h-5 w-48" />
                                ) : participant ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="secondary">Profile synced</Badge>
                                        <Badge variant="outline">{availableTransactions.length} purpose(s) loaded</Badge>
                                        {isDepartmentLocked ? (
                                            <Badge className="gap-2" variant="outline">
                                                <Lock className="h-3.5 w-3.5" />
                                                Department locked
                                            </Badge>
                                        ) : null}
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
                                    {activeTicket ? (
                                        <div className="rounded-lg border bg-muted p-4 text-sm">
                                            <div className="font-medium">Ticket generation blocked</div>
                                            <div className="mt-1 text-muted-foreground">
                                                You already have an active ticket today. To prevent queue spamming, you can’t generate a new ticket
                                                until your current one is completed.
                                            </div>
                                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                                <Button asChild variant="secondary" className="w-full">
                                                    <Link to={myTicketsUrl}>Go to My Tickets</Link>
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="w-full"
                                                    onClick={() => void onFindActive()}
                                                    disabled={busy}
                                                >
                                                    <RefreshCw className="mr-2 h-4 w-4" />
                                                    Refresh my ticket
                                                </Button>
                                            </div>
                                        </div>
                                    ) : null}

                                    <div className="grid gap-4 sm:grid-cols-3">
                                        <div className="min-w-0 space-y-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <Label>Department</Label>
                                                {isDepartmentLocked ? (
                                                    <Badge variant="secondary" className="shrink-0">
                                                        Locked
                                                    </Badge>
                                                ) : null}
                                            </div>

                                            <Select
                                                value={departmentId}
                                                onValueChange={handleDepartmentChange}
                                                disabled={busy || !departments.length || isDepartmentLocked}
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
                                            ) : isDepartmentLocked ? (
                                                <div className="text-xs text-muted-foreground">
                                                    <span className="inline-flex items-center gap-1">
                                                        <Lock className="h-3.5 w-3.5" />
                                                        Locked to your profile.
                                                    </span>
                                                </div>
                                            ) : null}
                                        </div>

                                        <div className="min-w-0 space-y-2">
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

                                        <div className="min-w-0 space-y-2">
                                            <Label htmlFor="phone">Phone Number (optional)</Label>
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
                                                Login first to select queue purpose. Guest mode supports basic joining only.
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => void onFindActive()}
                                            disabled={busy || checkingActive}
                                        >
                                            {findCooldown.isCoolingDown ? `Wait ${findCooldown.remainingSec}s` : "Find my ticket"}
                                        </Button>

                                        <Button
                                            type="button"
                                            onClick={() => void onJoin()}
                                            disabled={
                                                busy ||
                                                checkingActive ||
                                                joinCooldown.isCoolingDown ||
                                                !!activeTicket ||
                                                !departmentId ||
                                                !studentId.trim() ||
                                                (isSessionFlow && (!availableTransactions.length || !selectedForSubmit.length))
                                            }
                                        >
                                            {joinCooldown.isCoolingDown
                                                ? `Try again in ${joinCooldown.remainingSec}s`
                                                : busy || checkingActive
                                                  ? "Please wait…"
                                                  : activeTicket
                                                    ? "Ticket already active"
                                                    : "Join Queue"}
                                        </Button>
                                    </div>

                                    <div className="text-xs text-muted-foreground">
                                        Abuse prevention: join actions have a short cooldown to reduce queue spamming.
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {ticketToShow ? (
                        <Card className="min-w-0">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <TicketIcon className="h-5 w-5" />
                                    Your Ticket
                                </CardTitle>
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
                                            <Badge variant={statusBadgeVariant(ticketToShow.status) as any}>{ticketToShow.status}</Badge>
                                            <Badge variant="secondary">{ticketToShow.dateKey}</Badge>
                                        </div>
                                    </div>

                                    {selectedTransactionLabels.length ? (
                                        <>
                                            <Separator className="my-5" />
                                            <div className="space-y-2">
                                                <div className="text-sm text-muted-foreground">Purpose(s)</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedTransactionLabels.map((label) => (
                                                        <Badge key={label} variant="outline">
                                                            {label}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    ) : null}

                                    <Separator className="my-5" />

                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                        <div>
                                            <div className="text-sm text-muted-foreground">Queue Number</div>
                                            <div className="mt-1 text-6xl font-semibold tracking-tight">#{ticketToShow.queueNumber}</div>
                                        </div>

                                        <div className="text-xs text-muted-foreground">
                                            Ticket reference: <span className="font-mono">{ticketToShow._id}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-2 sm:grid-cols-2">
                                    <Button asChild variant="secondary" className="w-full">
                                        <Link to={myTicketsUrl}>Go to My Tickets</Link>
                                    </Button>
                                    <Button type="button" variant="outline" className="w-full" onClick={() => void onFindActive()}>
                                        Refresh status
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