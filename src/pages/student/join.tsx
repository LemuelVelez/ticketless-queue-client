/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { toast } from "sonner"
import { Lock, RefreshCw, Ticket as TicketIcon } from "lucide-react"

import Header from "@/components/Header"
import Footer from "@/components/Footer"

import { API_PATHS } from "@/api/api"
import {
    getParticipantStorage,
    getParticipantToken,
    getParticipantUser,
    setParticipantUser,
} from "@/lib/auth"
import { api, ApiError } from "@/lib/http"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

const LOCK_SENTINEL = "__LOCKED__"

type Department = {
    _id: string
    id?: string
    name: string
    code?: string
    [key: string]: unknown
}

type ParticipantTransaction = {
    key?: string
    label?: string
    transactionKey?: string
    transaction_key?: string
    code?: string
    id?: string
    name?: string
    title?: string
    purpose?: string
    [key: string]: unknown
}

type TicketDepartment =
    | string
    | {
          _id?: string
          id?: string
          name?: string
          code?: string
          [key: string]: unknown
      }

type Ticket = {
    _id?: string
    id?: string
    queueNumber?: string | number
    status?: string
    dateKey?: string
    department?: TicketDepartment
    studentId?: string
    phone?: string
    transactionKeys?: string[]
    [key: string]: unknown
}

type JoinQueuePayload = {
    departmentId: string
    studentId: string
    phone?: string
    transactionKeys?: string[]
}

type SessionResponse = {
    participant: Record<string, unknown> | null
    availableTransactions: ParticipantTransaction[]
    departmentLocked: boolean
}

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
    const candidates = [
        tx?.key,
        tx?.transactionKey,
        tx?.transaction_key,
        tx?.code,
        tx?.id,
    ]
    for (const c of candidates) {
        const v = pickNonEmptyString(c)
        if (v) return v
    }
    return ""
}

function readTransactionLabel(tx: any, fallbackKey: string) {
    const candidates = [
        tx?.label,
        tx?.transactionLabel,
        tx?.transaction_label,
        tx?.name,
        tx?.title,
        tx?.purpose,
    ]
    for (const c of candidates) {
        const v = pickNonEmptyString(c)
        if (v) return v
    }
    return fallbackKey || "Unnamed transaction"
}

function normalizeAvailableTransactions(
    list: Array<ParticipantTransaction | Record<string, unknown> | string>
) {
    const out: ParticipantTransaction[] = []
    const seen = new Set<string>()

    for (const raw of list) {
        const tx =
            typeof raw === "string"
                ? ({ key: raw, label: raw } as Record<string, unknown>)
                : ((raw ?? {}) as Record<string, unknown>)

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

function mapSelectionToAvailableKeys(
    keys: string[],
    availableTransactions: ParticipantTransaction[]
): string[] {
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

function unwrapResponseData<T = any>(value: T): any {
    if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        "data" in (value as Record<string, unknown>)
    ) {
        return (value as Record<string, unknown>).data
    }
    return value
}

function isEndpointFallbackError(error: unknown) {
    return (
        error instanceof ApiError &&
        (error.status === 404 || error.status === 405 || error.status === 501)
    )
}

function isFailurePayload(value: unknown) {
    return (
        !!value &&
        typeof value === "object" &&
        "ok" in (value as Record<string, unknown>) &&
        (value as Record<string, unknown>).ok === false
    )
}

function looksLikeTicket(value: unknown): value is Ticket {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false
    const raw = value as Record<string, unknown>
    return Boolean(
        pickNonEmptyString(raw._id) ||
            pickNonEmptyString(raw.id) ||
            raw.queueNumber !== undefined
    )
}

function extractDepartments(value: unknown): Department[] {
    const raw = unwrapResponseData(value)

    const candidates = [
        Array.isArray((raw as any)?.departments) ? (raw as any).departments : null,
        Array.isArray((raw as any)?.items) ? (raw as any).items : null,
        Array.isArray(raw) ? raw : null,
    ]

    const list = candidates.find(Array.isArray) ?? []

    return list
        .map((item) => {
            const dept = (item ?? {}) as Record<string, unknown>
            const id =
                pickNonEmptyString(dept._id) || pickNonEmptyString(dept.id)
            const name = pickNonEmptyString(dept.name)
            const code = pickNonEmptyString(dept.code) || undefined

            if (!id || !name) return null

            return {
                ...(dept as any),
                _id: id,
                name,
                ...(code ? { code } : {}),
            } as Department
        })
        .filter(Boolean) as Department[]
}

function extractAvailableTransactionsFromSession(value: unknown) {
    const raw = unwrapResponseData(value)

    const candidates = [
        Array.isArray((raw as any)?.availableTransactions)
            ? (raw as any).availableTransactions
            : null,
        Array.isArray((raw as any)?.transactions)
            ? (raw as any).transactions
            : null,
        Array.isArray((raw as any)?.participant?.availableTransactions)
            ? (raw as any).participant.availableTransactions
            : null,
        Array.isArray((raw as any)?.participant?.transactions)
            ? (raw as any).participant.transactions
            : null,
        Array.isArray((raw as any)?.user?.availableTransactions)
            ? (raw as any).user.availableTransactions
            : null,
        Array.isArray((raw as any)?.user?.transactions)
            ? (raw as any).user.transactions
            : null,
    ]

    const list = candidates.find(Array.isArray) ?? []
    return normalizeAvailableTransactions(list as Array<any>)
}

function extractSessionResponse(value: unknown): SessionResponse {
    const raw = unwrapResponseData(value)

    if (isFailurePayload(raw)) {
        return {
            participant: null,
            availableTransactions: [],
            departmentLocked: false,
        }
    }

    const participant =
        raw && typeof raw === "object"
            ? (((raw as any).participant ??
                  (raw as any).user ??
                  null) as Record<string, unknown> | null)
            : null

    const departmentLocked = Boolean(
        (raw as any)?.departmentLocked ??
            (raw as any)?.lockedDepartment ??
            (raw as any)?.participant?.departmentLocked ??
            (raw as any)?.user?.departmentLocked
    )

    return {
        participant:
            participant && typeof participant === "object" ? participant : null,
        availableTransactions: extractAvailableTransactionsFromSession(raw),
        departmentLocked,
    }
}

function extractTicketResponse(value: unknown) {
    const raw = unwrapResponseData(value)

    if (looksLikeTicket(raw)) {
        return { ticket: raw as Ticket, transactions: null as any }
    }

    if (raw && typeof raw === "object") {
        if (looksLikeTicket((raw as any).ticket)) {
            return {
                ticket: (raw as any).ticket as Ticket,
                transactions: (raw as any).transactions ?? null,
            }
        }

        if (looksLikeTicket((raw as any).activeTicket)) {
            return {
                ticket: (raw as any).activeTicket as Ticket,
                transactions: (raw as any).transactions ?? null,
            }
        }
    }

    return { ticket: null as Ticket | null, transactions: null as any }
}

function extractActiveTicket(value: unknown): Ticket | null {
    const raw = unwrapResponseData(value)

    if (looksLikeTicket(raw)) return raw as Ticket
    if (raw && typeof raw === "object") {
        if (looksLikeTicket((raw as any).ticket)) return (raw as any).ticket as Ticket
        if (looksLikeTicket((raw as any).activeTicket))
            return (raw as any).activeTicket as Ticket

        if (Array.isArray((raw as any).tickets)) {
            const first = (raw as any).tickets.find((item: unknown) =>
                looksLikeTicket(item)
            )
            if (first) return first as Ticket
        }
    }

    if (Array.isArray(raw)) {
        const first = raw.find((item) => looksLikeTicket(item))
        if (first) return first as Ticket
    }

    return null
}

const participantDepartmentStorage = {
    getDepartmentId() {
        const user = getParticipantUser()
        return pickNonEmptyString(user?.departmentId)
    },
    setDepartmentId(value: string) {
        const clean = pickNonEmptyString(value)
        if (!clean) {
            this.clearDepartmentId()
            return
        }

        const rememberMe = getParticipantStorage() === "session" ? false : true
        const current = (getParticipantUser() ?? {}) as Record<string, unknown>

        setParticipantUser(
            {
                ...(current as any),
                departmentId: clean,
            },
            rememberMe
        )
    },
    clearDepartmentId() {
        const storage = getParticipantStorage()
        if (!storage) return

        const rememberMe = storage === "local"
        const current = (getParticipantUser() ?? {}) as Record<string, unknown>

        setParticipantUser(
            {
                ...(current as any),
                departmentId: null as any,
            },
            rememberMe
        )
    },
}

const studentPageApi = {
    async listDepartments() {
        const res = await api.get<any>(API_PATHS.departments.enabled, {
            auth: false,
        })

        return {
            departments: extractDepartments(res),
        }
    },

    async getSession(): Promise<SessionResponse> {
        const token = getParticipantToken()
        if (!token) {
            return {
                participant: null,
                availableTransactions: [],
                departmentLocked: false,
            }
        }

        const attempts = [
            () =>
                api.get<any>("/participants/session", {
                    auth: "participant",
                    throwOnError: false,
                }),
            () =>
                api.get<any>("/participant/session", {
                    auth: "participant",
                    throwOnError: false,
                }),
            () =>
                api.get<any>("/guest/session", {
                    auth: "participant",
                    throwOnError: false,
                }),
            () =>
                api.get<any>(API_PATHS.auth.me, {
                    auth: "participant",
                    throwOnError: false,
                }),
        ]

        for (const attempt of attempts) {
            const res = await attempt()
            const parsed = extractSessionResponse(res)

            if (
                parsed.participant ||
                parsed.availableTransactions.length ||
                parsed.departmentLocked
            ) {
                return parsed
            }
        }

        const stored = getParticipantUser()
        if (stored) {
            return {
                participant: stored as Record<string, unknown>,
                availableTransactions: [],
                departmentLocked: Boolean(
                    pickNonEmptyString((stored as any)?.departmentId)
                ),
            }
        }

        return {
            participant: null,
            availableTransactions: [],
            departmentLocked: false,
        }
    },

    async getTicket(ticketId: string) {
        const res = await api.get<any>(API_PATHS.tickets.byId(ticketId), {
            auth: "auto",
        })
        return extractTicketResponse(res)
    },

    async findActiveByStudent({
        departmentId,
        studentId,
    }: {
        departmentId: string
        studentId: string
    }) {
        const attempts = [
            () =>
                api.get<any>(API_PATHS.tickets.activeByDepartment(departmentId), {
                    auth: "participant",
                    params: { studentId },
                }),
            () =>
                api.get<any>("/tickets/active", {
                    auth: "participant",
                    params: { departmentId, studentId },
                }),
            () =>
                api.get<any>("/participants/tickets/active", {
                    auth: "participant",
                    params: { departmentId, studentId },
                }),
            () =>
                api.get<any>("/student/tickets/active", {
                    auth: "participant",
                    params: { departmentId, studentId },
                }),
        ]

        let lastError: unknown = null

        for (const attempt of attempts) {
            try {
                const res = await attempt()
                return { ticket: extractActiveTicket(res) }
            } catch (error) {
                if (isEndpointFallbackError(error)) {
                    lastError = error
                    continue
                }
                throw error
            }
        }

        if (lastError && !isEndpointFallbackError(lastError)) {
            throw lastError
        }

        return { ticket: null as Ticket | null }
    },

    async joinQueue(payload: JoinQueuePayload) {
        const attempts = [
            () =>
                api.post<any>("/tickets", payload, {
                    auth: "participant",
                }),
            () =>
                api.post<any>("/tickets/join", payload, {
                    auth: "participant",
                }),
            () =>
                api.post<any>("/participants/join", payload, {
                    auth: "participant",
                }),
            () =>
                api.post<any>("/participant/join", payload, {
                    auth: "participant",
                }),
            () =>
                api.post<any>("/student/join", payload, {
                    auth: "participant",
                }),
        ]

        let lastError: unknown = null

        for (const attempt of attempts) {
            try {
                const res = await attempt()
                return extractTicketResponse(res)
            } catch (error) {
                if (isEndpointFallbackError(error)) {
                    lastError = error
                    continue
                }
                throw error
            }
        }

        throw lastError instanceof Error
            ? lastError
            : new Error("Failed to join queue.")
    },
}

export default function StudentJoinPage() {
    const location = useLocation()

    const qs = React.useMemo(
        () => new URLSearchParams(location.search || ""),
        [location.search]
    )
    const preDeptId = React.useMemo(
        () => pickNonEmptyString(qs.get("departmentId")),
        [qs]
    )
    const preStudentId = React.useMemo(
        () => pickNonEmptyString(qs.get("studentId") || qs.get("tcNumber")),
        [qs]
    )
    const ticketId = React.useMemo(
        () => pickNonEmptyString(qs.get("ticketId") || qs.get("id")),
        [qs]
    )

    const [loadingDepts, setLoadingDepts] = React.useState(true)
    const [loadingSession, setLoadingSession] = React.useState(true)

    const [departments, setDepartments] = React.useState<Department[]>([])

    const initialLockedDept = participantDepartmentStorage.getDepartmentId() || ""
    const [lockedDepartmentId, setLockedDepartmentId] =
        React.useState<string>(initialLockedDept)

    const [sessionDepartmentId, setSessionDepartmentId] =
        React.useState<string>("")
    const [departmentId, setDepartmentId] = React.useState<string>(
        initialLockedDept || ""
    )
    const [didManuallySelectDepartment, setDidManuallySelectDepartment] =
        React.useState(false)

    const [studentId, setStudentId] = React.useState<string>(preStudentId)
    const [phone, setPhone] = React.useState<string>("")

    const [participant, setParticipant] = React.useState<any | null>(null)
    const [availableTransactions, setAvailableTransactions] = React.useState<
        ParticipantTransaction[]
    >([])
    const [selectedTransactions, setSelectedTransactions] = React.useState<
        string[]
    >([])

    const [busy, setBusy] = React.useState(false)
    const [ticket, setTicket] = React.useState<Ticket | null>(null)

    const [activeTicket, setActiveTicket] = React.useState<Ticket | null>(null)
    const [checkingActive, setCheckingActive] = React.useState(false)

    const isSessionFlow = Boolean(participant)
    const isDepartmentLocked = Boolean(lockedDepartmentId)

    const selectedDept = React.useMemo(
        () => departments.find((d) => d._id === departmentId) || null,
        [departments, departmentId]
    )

    const myTicketsUrl = React.useMemo(() => {
        const q = new URLSearchParams()
        if (departmentId) q.set("departmentId", departmentId)
        if (studentId.trim()) q.set("studentId", studentId.trim())
        const qsStr = q.toString()
        return `/student/my-tickets${qsStr ? `?${qsStr}` : ""}`
    }, [departmentId, studentId])

    const selectedForSubmit = React.useMemo(
        () =>
            mapSelectionToAvailableKeys(
                selectedTransactions,
                availableTransactions
            ),
        [selectedTransactions, availableTransactions]
    )

    const selectedTransactionSet = React.useMemo(
        () => new Set(selectedForSubmit),
        [selectedForSubmit]
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
            const res = await studentPageApi.listDepartments()
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
            const res = await studentPageApi.getSession()
            const p = (res?.participant ?? null) as any | null
            const tx = normalizeAvailableTransactions(
                (res?.availableTransactions ?? []) as any[]
            )

            setParticipant(p)
            setAvailableTransactions(tx)
            setSelectedTransactions((prev) =>
                mapSelectionToAvailableKeys(prev, tx)
            )

            if (!p) {
                setSessionDepartmentId("")
                setLockedDepartmentId("")
                participantDepartmentStorage.clearDepartmentId()
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

            const storedLock = participantDepartmentStorage.getDepartmentId() || ""
            const deptLockedFlag = Boolean((res as any)?.departmentLocked)
            const shouldLock = deptLockedFlag || Boolean(dept) || Boolean(storedLock)
            const effective = dept || storedLock

            if (dept) {
                setSessionDepartmentId(dept)
                participantDepartmentStorage.setDepartmentId(dept)
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
                participantDepartmentStorage.clearDepartmentId()
            }
        } catch {
            setParticipant(null)
            setAvailableTransactions([])
            setSelectedTransactions([])
            setSessionDepartmentId("")
            setLockedDepartmentId("")
            participantDepartmentStorage.clearDepartmentId()
        } finally {
            setLoadingSession(false)
        }
    }, [])

    const loadTicketById = React.useCallback(async () => {
        if (!ticketId) return
        setBusy(true)
        try {
            const res = await studentPageApi.getTicket(ticketId)
            const t = (res?.ticket ?? null) as Ticket | null
            setTicket(t)

            const txKeysRaw = [
                ...(Array.isArray(res?.transactions?.transactionKeys)
                    ? res.transactions.transactionKeys
                    : []),
                ...(Array.isArray((t as any)?.transactionKeys)
                    ? ((t as any).transactionKeys as string[])
                    : []),
            ]
            const txKeys = txKeysRaw
                .map((k) => pickNonEmptyString(k))
                .filter(Boolean)
            if (txKeys.length) setSelectedTransactions(txKeys)

            const dept = (t as any)?.department
            const deptIdFromTicket =
                typeof dept === "string"
                    ? dept
                    : pickNonEmptyString(dept?._id) ||
                      pickNonEmptyString(dept?.id)

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
                const res = await studentPageApi.findActiveByStudent({
                    departmentId,
                    studentId: sid,
                })
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
        [departmentId, studentId]
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
        [isDepartmentLocked, loadingSession]
    )

    React.useEffect(() => {
        void loadDepartments()
        void loadSession()
    }, [loadDepartments, loadSession])

    React.useEffect(() => {
        if (!departments.length) return

        setDepartmentId((prev) => {
            const has = (id: string) =>
                !!id && departments.some((d) => d._id === id)

            if (isDepartmentLocked && has(lockedDepartmentId))
                return lockedDepartmentId

            if (has(preDeptId)) return preDeptId

            if (didManuallySelectDepartment && has(prev)) return prev
            if (has(sessionDepartmentId)) return sessionDepartmentId
            if (has(prev)) return prev
            return departments[0]?._id ?? ""
        })
    }, [
        departments,
        preDeptId,
        sessionDepartmentId,
        didManuallySelectDepartment,
        isDepartmentLocked,
        lockedDepartmentId,
    ])

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
            toast.message(
                `Please wait ${findCooldown.remainingSec}s before checking again.`
            )
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

        if (activeTicket) {
            toast.message("You already have an active ticket for today.")
            return
        }

        if (joinCooldown.isCoolingDown) {
            toast.message(
                `Please wait ${joinCooldown.remainingSec}s before trying again.`
            )
            return
        }

        setCheckingActive(true)
        const existing = await checkActiveTicket({ silent: true })
        setCheckingActive(false)
        if (existing) {
            toast.message("You already have an active ticket for today.")
            return
        }

        if (isSessionFlow) {
            if (!availableTransactions.length) {
                return toast.error(
                    "No queue purpose is available for this account and department."
                )
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

            const res = await studentPageApi.joinQueue(payload)
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
                toast.error(
                    "Selected queue purpose is not available. Please reselect and try again."
                )
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
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Join Queue
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Select your department, choose a queue purpose
                        (transaction), then generate your ticket.
                    </p>
                </div>

                <div className="grid gap-6">
                    <Card className="min-w-0">
                        <CardHeader>
                            <CardTitle>Queue Entry</CardTitle>
                            <CardDescription>
                                When logged in, your available queue purposes are
                                loaded from your profile and the department is
                                locked.
                            </CardDescription>

                            <div className="pt-1">
                                {loadingSession ? (
                                    <Skeleton className="h-5 w-48" />
                                ) : participant ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="secondary">
                                            Profile synced
                                        </Badge>
                                        <Badge variant="outline">
                                            {availableTransactions.length} purpose(s)
                                            loaded
                                        </Badge>
                                        {isDepartmentLocked ? (
                                            <Badge
                                                className="gap-2"
                                                variant="outline"
                                            >
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
                                            <div className="font-medium">
                                                Ticket generation blocked
                                            </div>
                                            <div className="mt-1 text-muted-foreground">
                                                You already have an active ticket
                                                today. To prevent queue spamming,
                                                you can’t generate a new ticket
                                                until your current one is
                                                completed.
                                            </div>
                                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                                <Button
                                                    asChild
                                                    variant="secondary"
                                                    className="w-full"
                                                >
                                                    <Link to={myTicketsUrl}>
                                                        Go to My Tickets
                                                    </Link>
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="w-full"
                                                    onClick={() =>
                                                        void onFindActive()
                                                    }
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
                                                    <Badge
                                                        variant="secondary"
                                                        className="shrink-0"
                                                    >
                                                        Locked
                                                    </Badge>
                                                ) : null}
                                            </div>

                                            <Select
                                                value={departmentId}
                                                onValueChange={
                                                    handleDepartmentChange
                                                }
                                                disabled={
                                                    busy ||
                                                    !departments.length ||
                                                    isDepartmentLocked
                                                }
                                            >
                                                <SelectTrigger className="w-full min-w-0">
                                                    <SelectValue placeholder="Select department" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {departments.map((d) => (
                                                        <SelectItem
                                                            key={d._id}
                                                            value={d._id}
                                                        >
                                                            {d.name}
                                                            {d.code
                                                                ? ` (${d.code})`
                                                                : ""}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>

                                            {!departments.length ? (
                                                <div className="text-xs text-muted-foreground">
                                                    No departments available.
                                                </div>
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
                                            <Label htmlFor="studentId">
                                                Student ID
                                            </Label>
                                            <Input
                                                id="studentId"
                                                value={studentId}
                                                onChange={(e) =>
                                                    setStudentId(e.target.value)
                                                }
                                                placeholder="e.g. TC-20-A-00001"
                                                autoComplete="off"
                                                inputMode="text"
                                                disabled={busy}
                                            />
                                        </div>

                                        <div className="min-w-0 space-y-2">
                                            <Label htmlFor="phone">
                                                Phone Number (optional)
                                            </Label>
                                            <Input
                                                id="phone"
                                                value={phone}
                                                onChange={(e) =>
                                                    setPhone(e.target.value)
                                                }
                                                placeholder="e.g. 09xxxxxxxxx or +639xxxxxxxxx"
                                                autoComplete="tel"
                                                inputMode="tel"
                                                disabled={busy}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <Label>
                                                Purpose of Queue (Transaction)
                                            </Label>
                                            {selectedForSubmit.length ? (
                                                <Badge variant="secondary">
                                                    {selectedForSubmit.length} selected
                                                </Badge>
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
                                                    {availableTransactions.map(
                                                        (tx) => {
                                                            const txKey =
                                                                readTransactionKey(
                                                                    tx
                                                                )
                                                            if (!txKey)
                                                                return null
                                                            const active =
                                                                selectedTransactionSet.has(
                                                                    txKey
                                                                )

                                                            return (
                                                                <Button
                                                                    key={txKey}
                                                                    type="button"
                                                                    variant={
                                                                        active
                                                                            ? "default"
                                                                            : "outline"
                                                                    }
                                                                    className="h-auto justify-start whitespace-normal text-left"
                                                                    onClick={() =>
                                                                        setSelectedTransactions(
                                                                            (
                                                                                prev
                                                                            ) =>
                                                                                toggleKey(
                                                                                    mapSelectionToAvailableKeys(
                                                                                        prev,
                                                                                        availableTransactions
                                                                                    ),
                                                                                    txKey
                                                                                )
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        busy
                                                                    }
                                                                >
                                                                    {readTransactionLabel(
                                                                        tx,
                                                                        txKey
                                                                    )}
                                                                </Button>
                                                            )
                                                        }
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-muted-foreground">
                                                    No transaction options are
                                                    available for your account in
                                                    this department.
                                                </div>
                                            )
                                        ) : (
                                            <div className="text-sm text-muted-foreground">
                                                Login first to select queue
                                                purpose. Guest mode supports
                                                basic joining only.
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
                                            {findCooldown.isCoolingDown
                                                ? `Wait ${findCooldown.remainingSec}s`
                                                : "Find my ticket"}
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
                                                (isSessionFlow &&
                                                    (!availableTransactions.length ||
                                                        !selectedForSubmit.length))
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
                                        Abuse prevention: join actions have a
                                        short cooldown to reduce queue spamming.
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
                                <CardDescription>
                                    Keep this page open or take a screenshot.
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="space-y-4">
                                <div className="rounded-2xl border bg-muted p-6">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="text-sm text-muted-foreground">
                                                Department
                                            </div>
                                            <div className="truncate text-lg font-medium">
                                                {ticketDeptName}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Badge
                                                variant={
                                                    statusBadgeVariant(
                                                        ticketToShow.status
                                                    ) as any
                                                }
                                            >
                                                {ticketToShow.status}
                                            </Badge>
                                            <Badge variant="secondary">
                                                {ticketToShow.dateKey}
                                            </Badge>
                                        </div>
                                    </div>

                                    {selectedTransactionLabels.length ? (
                                        <>
                                            <Separator className="my-5" />
                                            <div className="space-y-2">
                                                <div className="text-sm text-muted-foreground">
                                                    Purpose(s)
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedTransactionLabels.map(
                                                        (label) => (
                                                            <Badge
                                                                key={label}
                                                                variant="outline"
                                                            >
                                                                {label}
                                                            </Badge>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    ) : null}

                                    <Separator className="my-5" />

                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                        <div>
                                            <div className="text-sm text-muted-foreground">
                                                Queue Number
                                            </div>
                                            <div className="mt-1 text-6xl font-semibold tracking-tight">
                                                #{ticketToShow.queueNumber}
                                            </div>
                                        </div>

                                        <div className="text-xs text-muted-foreground">
                                            Ticket reference:{" "}
                                            <span className="font-mono">
                                                {ticketToShow._id ||
                                                    ticketToShow.id}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-2 sm:grid-cols-2">
                                    <Button
                                        asChild
                                        variant="secondary"
                                        className="w-full"
                                    >
                                        <Link to={myTicketsUrl}>
                                            Go to My Tickets
                                        </Link>
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => void onFindActive()}
                                    >
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