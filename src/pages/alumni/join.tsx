/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { toast } from "sonner"
import { Lock, Ticket as TicketIcon } from "lucide-react"

import Header from "@/components/Header"
import Footer from "@/components/Footer"

import { API_PATHS } from "@/api/api"
import {
    getParticipantStorage,
    getParticipantUser,
    type StoredParticipantUser,
} from "@/lib/auth"
import { api } from "@/lib/http"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

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
    transactionLabel?: string
    transaction_label?: string
    code?: string
    id?: string
    name?: string
    title?: string
    purpose?: string
    [key: string]: unknown
}

type Ticket = {
    _id: string
    queueNumber: string | number
    status: string
    dateKey?: string
    department?: unknown
    transactionKeys?: string[]
    participantId?: string
    studentId?: string
    alumniId?: string
    visitorId?: string
    idNumber?: string
    tcNumber?: string
    mobileNumber?: string
    phone?: string
    phoneNumber?: string
    [key: string]: unknown
}

const PARTICIPANT_DEPARTMENT_STORAGE_KEY = "qp_participant_department_id"

function pickNonEmptyString(v: unknown) {
    return typeof v === "string" && v.trim() ? v.trim() : ""
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value)
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
    list: Array<ParticipantTransaction | Record<string, unknown>>,
) {
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

function mapSelectionToAvailableKeys(
    keys: string[],
    availableTransactions: ParticipantTransaction[],
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
        source?.id,
        source?._id,
    ]

    for (const c of candidates) {
        const v = pickNonEmptyString(c)
        if (v) return v
    }
    return ""
}

function readPhoneFromObject(source: any) {
    const candidates = [
        source?.mobileNumber,
        source?.phone,
        source?.phoneNumber,
        source?.mobile,
    ]
    for (const c of candidates) {
        const v = pickNonEmptyString(c)
        if (v) return v
    }
    return ""
}

async function callFirstSuccessful<T>(
    attempts: Array<() => Promise<T>>,
): Promise<T> {
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

const participantDepartmentStorage = {
    getDepartmentId() {
        const fromUser = pickNonEmptyString(getParticipantUser()?.departmentId)
        if (fromUser) return fromUser

        if (typeof window === "undefined") return ""

        return (
            pickNonEmptyString(
                window.localStorage.getItem(PARTICIPANT_DEPARTMENT_STORAGE_KEY),
            ) ||
            pickNonEmptyString(
                window.sessionStorage.getItem(PARTICIPANT_DEPARTMENT_STORAGE_KEY),
            )
        )
    },
    setDepartmentId(departmentId: string) {
        if (typeof window === "undefined") return

        const clean = pickNonEmptyString(departmentId)
        if (!clean) {
            this.clearDepartmentId()
            return
        }

        const storage = getParticipantStorage()

        if (storage === "session") {
            window.sessionStorage.setItem(
                PARTICIPANT_DEPARTMENT_STORAGE_KEY,
                clean,
            )
            window.localStorage.removeItem(PARTICIPANT_DEPARTMENT_STORAGE_KEY)
            return
        }

        window.localStorage.setItem(PARTICIPANT_DEPARTMENT_STORAGE_KEY, clean)
        window.sessionStorage.removeItem(PARTICIPANT_DEPARTMENT_STORAGE_KEY)
    },
    clearDepartmentId() {
        if (typeof window === "undefined") return
        window.localStorage.removeItem(PARTICIPANT_DEPARTMENT_STORAGE_KEY)
        window.sessionStorage.removeItem(PARTICIPANT_DEPARTMENT_STORAGE_KEY)
    },
}

function extractDepartments(value: any): Department[] {
    const candidates = [
        value?.departments,
        value?.items,
        value?.results,
        value?.data?.departments,
        value?.data?.items,
        value?.data,
        value,
    ]

    for (const candidate of candidates) {
        if (!Array.isArray(candidate)) continue

        return candidate
            .map((item) => {
                if (!isRecord(item)) return null

                const _id =
                    pickNonEmptyString(item._id) || pickNonEmptyString(item.id)
                const name = pickNonEmptyString(item.name)

                if (!_id || !name) return null

                return {
                    ...(item as Department),
                    _id,
                    name,
                    code: pickNonEmptyString(item.code) || undefined,
                }
            })
            .filter(Boolean) as Department[]
    }

    return []
}

function extractSessionResponse(value: any) {
    const participant =
        value?.participant ??
        value?.user ??
        value?.data?.participant ??
        value?.data?.user ??
        null

    const availableTransactionsRaw =
        value?.availableTransactions ??
        value?.transactions ??
        value?.participant?.availableTransactions ??
        value?.user?.availableTransactions ??
        value?.data?.availableTransactions ??
        value?.data?.transactions ??
        []

    return {
        participant: participant && isRecord(participant) ? participant : null,
        availableTransactions: Array.isArray(availableTransactionsRaw)
            ? availableTransactionsRaw
            : [],
    }
}

function extractTicketResponse(value: any) {
    const ticket =
        value?.ticket ??
        value?.data?.ticket ??
        (isRecord(value) &&
        "_id" in value &&
        "queueNumber" in value &&
        "status" in value
            ? value
            : null)

    const transactions = isRecord(value?.transactions)
        ? value.transactions
        : isRecord(value?.data?.transactions)
          ? value.data.transactions
          : undefined

    return {
        ticket: ticket && isRecord(ticket) ? (ticket as Ticket) : null,
        transactions,
    }
}

async function listParticipantDepartments(): Promise<{
    departments: Department[]
}> {
    const res = await callFirstSuccessful<any>([
        () => api.getData(API_PATHS.departments.enabled, { auth: false }),
        () => api.getData(API_PATHS.departments.enabled, { auth: "auto" }),
    ])

    return {
        departments: extractDepartments(res),
    }
}

async function getParticipantSession(opts?: { departmentId?: string }) {
    const departmentId = pickNonEmptyString(opts?.departmentId)

    const res = await callFirstSuccessful<any>([
        () =>
            api.getData(API_PATHS.users.participants, {
                auth: "participant",
                params: departmentId ? { departmentId } : undefined,
            }),
        () =>
            api.getData("/users/participants/session", {
                auth: "participant",
                params: departmentId ? { departmentId } : undefined,
            }),
        () =>
            api.getData("/users/participants/me", {
                auth: "participant",
                params: departmentId ? { departmentId } : undefined,
            }),
        () =>
            api.getData("/participants/session", {
                auth: "participant",
                params: departmentId ? { departmentId } : undefined,
            }),
        () =>
            api.getData("/participant/session", {
                auth: "participant",
                params: departmentId ? { departmentId } : undefined,
            }),
    ])

    return extractSessionResponse(res)
}

async function getParticipantTicket(ticketId: string) {
    const res = await callFirstSuccessful<any>([
        () => api.getData(API_PATHS.tickets.byId(ticketId), { auth: "auto" }),
        () => api.getData(`/tickets/${encodeURIComponent(ticketId)}`, { auth: "auto" }),
    ])

    return extractTicketResponse(res)
}

async function findActiveByParticipant(args: {
    departmentId: string
    participantId: string
}) {
    const params = {
        participantId: args.participantId,
        studentId: args.participantId,
        idNumber: args.participantId,
        tcNumber: args.participantId,
    }

    const res = await callFirstSuccessful<any>([
        () =>
            api.getData(API_PATHS.tickets.activeByDepartment(args.departmentId), {
                auth: "participant",
                params,
            }),
        () =>
            api.getData(API_PATHS.tickets.activeByDepartment(args.departmentId), {
                auth: "auto",
                params,
            }),
        () =>
            api.getData(
                `/tickets/department/${encodeURIComponent(args.departmentId)}/active`,
                {
                    auth: "participant",
                    params,
                },
            ),
    ])

    return extractTicketResponse(res)
}

async function joinParticipantQueue(args: {
    departmentId: string
    participantId: string
    phone: string
    transactionKeys?: string[]
}) {
    const payload = {
        departmentId: args.departmentId,
        participantId: args.participantId,
        studentId: args.participantId,
        idNumber: args.participantId,
        tcNumber: args.participantId,
        phone: args.phone,
        mobileNumber: args.phone,
        transactionKeys: args.transactionKeys ?? [],
    }

    const res = await callFirstSuccessful<any>([
        () =>
            api.postData(API_PATHS.tickets.queueByDepartment(args.departmentId), payload, {
                auth: "participant",
            }),
        () =>
            api.postData(API_PATHS.tickets.queueByDepartment(args.departmentId), payload, {
                auth: "auto",
            }),
        () =>
            api.postData(
                `/tickets/department/${encodeURIComponent(args.departmentId)}/queue`,
                payload,
                { auth: "participant" },
            ),
    ])

    return extractTicketResponse(res)
}

export default function AlumniJoinPage() {
    const location = useLocation()
    const storedParticipant = React.useMemo<StoredParticipantUser | null>(
        () => getParticipantUser(),
        [],
    )

    const qs = React.useMemo(
        () => new URLSearchParams(location.search || ""),
        [location.search],
    )
    const preDeptId = React.useMemo(
        () => pickNonEmptyString(qs.get("departmentId")),
        [qs],
    )
    const preParticipantId = React.useMemo(
        () =>
            pickNonEmptyString(
                qs.get("participantId") ||
                    qs.get("studentId") ||
                    qs.get("idNumber") ||
                    qs.get("visitorId") ||
                    qs.get("alumniId"),
            ) || readParticipantIdFromObject(storedParticipant),
        [qs, storedParticipant],
    )
    const prePhone = React.useMemo(
        () => readPhoneFromObject(storedParticipant),
        [storedParticipant],
    )
    const ticketId = React.useMemo(
        () => pickNonEmptyString(qs.get("ticketId") || qs.get("id")),
        [qs],
    )

    const [loadingDepts, setLoadingDepts] = React.useState(true)
    const [loadingSession, setLoadingSession] = React.useState(true)
    const [departments, setDepartments] = React.useState<Department[]>([])

    const initialLockedDept =
        participantDepartmentStorage.getDepartmentId() || preDeptId || ""
    const [lockedDepartmentId, setLockedDepartmentId] =
        React.useState<string>(initialLockedDept)

    const [sessionDepartmentId, setSessionDepartmentId] =
        React.useState<string>("")
    const [departmentId, setDepartmentId] = React.useState<string>(
        initialLockedDept || "",
    )
    const [didManuallySelectDepartment, setDidManuallySelectDepartment] =
        React.useState(false)

    const [participantId, setParticipantId] =
        React.useState<string>(preParticipantId)
    const [phone, setPhone] = React.useState<string>(prePhone)

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

    const [ticketTransactionLabels, setTicketTransactionLabels] =
        React.useState<string[]>([])

    const isSessionFlow = Boolean(participant)
    const isDepartmentLocked = Boolean(lockedDepartmentId)

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
        () =>
            mapSelectionToAvailableKeys(
                selectedTransactions,
                availableTransactions,
            ),
        [selectedTransactions, availableTransactions],
    )

    const selectedTransactionSet = React.useMemo(
        () => new Set(selectedForSubmit),
        [selectedForSubmit],
    )

    const joinCooldownKey = React.useMemo(() => {
        const pid = participantId.trim() || "none"
        return `alumni:join:attempt:${departmentId || "none"}:${pid}`
    }, [departmentId, participantId])

    const findCooldownKey = React.useMemo(() => {
        const pid = participantId.trim() || "none"
        return `alumni:join:find:${departmentId || "none"}:${pid}`
    }, [departmentId, participantId])

    const joinCooldown = useActionCooldown(joinCooldownKey, 15000)
    const findCooldown = useActionCooldown(findCooldownKey, 5000)

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

    const purposeLabelsToShow = React.useMemo(() => {
        const fromTicket = ticketTransactionLabels
            .map((x) => String(x ?? "").trim())
            .filter(Boolean)
        if (fromTicket.length) return fromTicket
        return selectedTransactionLabels
    }, [ticketTransactionLabels, selectedTransactionLabels])

    const handleDepartmentChange = React.useCallback(
        (value: string) => {
            if (isDepartmentLocked) {
                toast.message("Department is locked after registration.")
                return
            }
            setDidManuallySelectDepartment(true)
            setDepartmentId(value)
        },
        [isDepartmentLocked],
    )

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
        async (opts?: { departmentId?: string; silent?: boolean }) => {
            const silent = Boolean(opts?.silent)
            if (!silent) setLoadingSession(true)

            try {
                const res = await getParticipantSession({
                    departmentId: pickNonEmptyString(opts?.departmentId),
                })

                const p = (res?.participant ?? null) as any
                const tx = normalizeAvailableTransactions(
                    (res?.availableTransactions ?? []) as any[],
                )

                setParticipant(p)
                setAvailableTransactions(tx)
                setSelectedTransactions((prev) =>
                    mapSelectionToAvailableKeys(prev, tx),
                )

                if (!p) {
                    const storedDept =
                        participantDepartmentStorage.getDepartmentId()
                    if (!silent) {
                        setSessionDepartmentId(storedDept)
                        setLockedDepartmentId(storedDept)
                        if (storedDept) {
                            setDepartmentId((prev) => prev || storedDept)
                        }
                    }
                    return
                }

                const pid = readParticipantIdFromObject(p)
                const mobile = readPhoneFromObject(p)
                const dept = pickNonEmptyString(p?.departmentId)

                if (pid) setParticipantId((prev) => prev || pid)
                if (mobile) setPhone((prev) => prev || mobile)

                if (dept) {
                    setSessionDepartmentId(dept)
                    setLockedDepartmentId(dept)
                    participantDepartmentStorage.setDepartmentId(dept)

                    setDepartmentId(dept)
                    setDidManuallySelectDepartment(false)
                }
            } catch {
                const storedDept = participantDepartmentStorage.getDepartmentId()
                if (!silent) {
                    setParticipant(null)
                    setAvailableTransactions([])
                    setSelectedTransactions([])
                    setSessionDepartmentId(storedDept)
                    setLockedDepartmentId(storedDept)
                    if (storedDept) {
                        setDepartmentId((prev) => prev || storedDept)
                    }
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
            const t = (res?.ticket ?? null) as Ticket | null
            setTicket(t)

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

            const idFromTicket = readParticipantIdFromObject(t)
            if (idFromTicket) setParticipantId(idFromTicket)

            const phoneFromTicket = readPhoneFromObject(t)
            if (phoneFromTicket) setPhone(phoneFromTicket)

            const txLabelsRaw = Array.isArray(res?.transactions?.transactionLabels)
                ? (res.transactions.transactionLabels as any[])
                : []

            const cleanedLabels = txLabelsRaw
                .map((x) => String(x ?? "").trim())
                .filter(Boolean)
            setTicketTransactionLabels(cleanedLabels)

            const txKeysRaw = [
                ...(Array.isArray(res?.transactions?.transactionKeys)
                    ? (res.transactions.transactionKeys as any[])
                    : []),
                ...(Array.isArray((t as any)?.transactionKeys)
                    ? ((t as any).transactionKeys as any[])
                    : []),
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
    }, [ticketId, isDepartmentLocked])

    const fetchTicketPurposeIfPossible = React.useCallback(async (t: Ticket) => {
        try {
            const res = await getParticipantTicket(t._id)
            const labelsRaw = Array.isArray(res?.transactions?.transactionLabels)
                ? (res.transactions.transactionLabels as any[])
                : []
            const cleaned = labelsRaw
                .map((x) => String(x ?? "").trim())
                .filter(Boolean)
            setTicketTransactionLabels(cleaned)
        } catch {
            // ignore
        }
    }, [])

    const checkActiveTicket = React.useCallback(
        async (opts?: { silent?: boolean }) => {
            const pid = participantId.trim()
            if (!departmentId || !pid) {
                setActiveTicket(null)
                return null
            }

            const silent = Boolean(opts?.silent)
            if (!silent) setCheckingActive(true)

            try {
                const res = await findActiveByParticipant({
                    departmentId,
                    participantId: pid,
                })
                const t = (res?.ticket ?? null) as Ticket | null
                setActiveTicket(t)

                if (t) setTicket(t)
                if (t && !silent) {
                    void fetchTicketPurposeIfPossible(t)
                }

                return t
            } catch {
                if (!silent) toast.error("Failed to check active ticket.")
                return null
            } finally {
                if (!silent) setCheckingActive(false)
            }
        },
        [departmentId, participantId, fetchTicketPurposeIfPossible],
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
        if (loadingSession) return
        if (!isSessionFlow) return
        if (!departmentId) return

        void loadSession({
            departmentId,
            silent: true,
        })
    }, [loadingSession, isSessionFlow, departmentId, loadSession])

    React.useEffect(() => {
        if (!isSessionFlow) return
        if (!availableTransactions.length) return

        setSelectedTransactions((prev) => {
            const normalized = mapSelectionToAvailableKeys(
                prev,
                availableTransactions,
            )
            return sameStringArray(prev, normalized) ? prev : normalized
        })
    }, [isSessionFlow, availableTransactions])

    React.useEffect(() => {
        if (!departmentId || !participantId.trim()) return
        void checkActiveTicket({ silent: true })
    }, [departmentId, participantId, checkActiveTicket])

    async function onFindActive() {
        const pid = participantId.trim()
        if (!departmentId) return toast.error("Please select a department.")
        if (!pid) return toast.error("Please enter your Alumni/Visitor ID.")

        if (findCooldown.isCoolingDown) {
            toast.message(
                `Please wait ${findCooldown.remainingSec}s before checking again.`,
            )
            return
        }

        findCooldown.start()
        const t = await checkActiveTicket({ silent: false })
        if (t) {
            toast.success("Active ticket found.")
        } else {
            toast.message("No active ticket found for today.")
            setTicketTransactionLabels([])
        }
    }

    async function onJoin() {
        const pid = participantId.trim()
        const ph = normalizeMobile(phone)

        if (!departmentId) return toast.error("Please select a department.")
        if (!pid) return toast.error("Alumni/Visitor ID is required.")
        if (!ph) return toast.error("Phone number is required.")

        if (activeTicket) {
            toast.message("You already have an active ticket for today.")
            return
        }

        if (joinCooldown.isCoolingDown) {
            toast.message(
                `Please wait ${joinCooldown.remainingSec}s before trying again.`,
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

        if (isSessionFlow && !availableTransactions.length) {
            return toast.error(
                "No queue purpose is available for this account and department.",
            )
        }
        if (isSessionFlow && !selectedForSubmit.length) {
            return toast.error("Please select at least one queue purpose.")
        }

        if (
            isSessionFlow &&
            !sameStringArray(selectedTransactions, selectedForSubmit)
        ) {
            setSelectedTransactions(selectedForSubmit)
        }

        joinCooldown.start()
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

            const t = (res?.ticket ?? null) as Ticket | null
            setTicket(t)
            setActiveTicket(t)

            setTicketTransactionLabels(
                isSessionFlow ? selectedTransactionLabels : [],
            )

            toast.success("You are now in the queue.")
        } catch (e: any) {
            const status = (e as any)?.status
            const existingTicket = (e as any)?.data?.ticket

            if (status === 409 && existingTicket) {
                setTicket(existingTicket as Ticket)
                setActiveTicket(existingTicket as Ticket)
                toast.message("You already have an active ticket for today.")
                void fetchTicketPurposeIfPossible(existingTicket as Ticket)
                return
            }

            const msg = String(e?.message ?? "")
            if (msg.toLowerCase().includes("invalid transaction selection")) {
                await loadSession({
                    departmentId,
                    silent: true,
                })
                toast.error(
                    "Selected queue purpose is not available for the chosen department. Please reselect and try again.",
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

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Header variant="student" />

            <main className="mx-auto w-full px-4 py-10">
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Join Queue
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {isDepartmentLocked
                            ? "Department is locked to your registered profile."
                            : "Department defaults to your registered profile when available. You can change it here anytime."}
                    </p>
                </div>

                <div className="grid gap-6">
                    <Card className="min-w-0">
                        <CardHeader>
                            <CardTitle>Queue Entry</CardTitle>
                            <CardDescription>
                                Alumni/Visitor ID and phone are prefilled from
                                your account when available. You may edit before
                                joining.
                            </CardDescription>
                            <div className="pt-1">
                                {loadingSession ? (
                                    <Skeleton className="h-5 w-40" />
                                ) : participant ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="secondary">
                                            Profile synced
                                        </Badge>
                                        <Badge variant="outline">
                                            {availableTransactions.length}{" "}
                                            purpose(s) loaded
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
                                                You already have an active
                                                ticket today. To prevent queue
                                                spamming, you can’t generate a
                                                new ticket until your current
                                                one is completed.
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
                                                    Refresh my ticket
                                                </Button>
                                            </div>
                                        </div>
                                    ) : null}

                                    <div className="grid gap-4 sm:grid-cols-3">
                                        <div className="min-w-0 space-y-2">
                                            <Label>Department</Label>
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
                                            <Label htmlFor="participantId">
                                                Alumni/Visitor ID
                                            </Label>
                                            <Input
                                                id="participantId"
                                                value={participantId}
                                                onChange={(e) =>
                                                    setParticipantId(
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="e.g. AL-24-00001"
                                                autoComplete="off"
                                                inputMode="text"
                                                disabled={busy}
                                            />
                                        </div>

                                        <div className="min-w-0 space-y-2">
                                            <Label htmlFor="phone">
                                                Phone Number
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
                                                    {selectedForSubmit.length}{" "}
                                                    selected
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
                                                                    tx,
                                                                )
                                                            if (!txKey)
                                                                return null

                                                            const active =
                                                                selectedTransactionSet.has(
                                                                    txKey,
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
                                                                                prev,
                                                                            ) =>
                                                                                toggleKey(
                                                                                    mapSelectionToAvailableKeys(
                                                                                        prev,
                                                                                        availableTransactions,
                                                                                    ),
                                                                                    txKey,
                                                                                ),
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        busy
                                                                    }
                                                                >
                                                                    {readTransactionLabel(
                                                                        tx,
                                                                        txKey,
                                                                    )}
                                                                </Button>
                                                            )
                                                        },
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-muted-foreground">
                                                    No transaction options are
                                                    available for your account
                                                    in this department.
                                                </div>
                                            )
                                        ) : (
                                            <div className="text-sm text-muted-foreground">
                                                Login first to select queue
                                                purpose. Guest mode supports
                                                legacy joining only.
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
                                                !participantId.trim() ||
                                                !normalizeMobile(phone) ||
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
                                                        ticketToShow.status,
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

                                    {purposeLabelsToShow.length ? (
                                        <>
                                            <Separator className="my-5" />
                                            <div className="space-y-2">
                                                <div className="text-sm text-muted-foreground">
                                                    Purpose(s)
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {purposeLabelsToShow.map(
                                                        (label) => (
                                                            <Badge
                                                                key={label}
                                                                variant="outline"
                                                            >
                                                                {label}
                                                            </Badge>
                                                        ),
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

                                        <div className="text-sm text-muted-foreground">
                                            Ticket ID:{" "}
                                            <span className="font-mono">
                                                {ticketToShow._id}
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
                                        disabled={busy || checkingActive}
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