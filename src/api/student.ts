/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from "@/lib/http"

export type ParticipantType = "STUDENT" | "GUEST" | "ALUMNI_VISITOR" | "VISITOR"

export type Department = {
    _id: string
    name: string
    code?: string
    enabled?: boolean
}

export type Participant = {
    id?: string
    _id?: string
    type?: ParticipantType
    name?: string
    email?: string

    // Identity fields
    studentId?: string
    tcNumber?: string
    mobileNumber?: string
    phone?: string

    // Profile fields
    firstName?: string
    middleName?: string
    lastName?: string
    departmentId?: string
    departmentCode?: string

    [key: string]: any
}

export type ParticipantTransaction = {
    key: string
    label: string
    scope?: "INTERNAL" | "EXTERNAL"
    [key: string]: any
}

export type ParticipantAuthResponse = {
    ok?: boolean
    token?: string
    sessionToken?: string
    participant?: Participant | null
    availableTransactions?: ParticipantTransaction[]
    [key: string]: any
}

export type ParticipantSessionResponse = {
    session?: {
        expiresAt?: string
    } | null
    participant?: Participant | null
    availableTransactions?: ParticipantTransaction[]
    [key: string]: any
}

export type StudentSignupPayload = {
    firstName: string
    middleName?: string
    lastName: string
    name?: string

    tcNumber: string
    departmentId: string
    mobileNumber: string
    pin: string

    // compatibility aliases
    studentId?: string
    phone?: string
    password?: string
    [key: string]: any
}

export type AlumniVisitorSignupPayload = {
    firstName: string
    middleName?: string
    lastName: string
    name?: string

    departmentId: string
    mobileNumber: string
    pin: string

    // compatibility aliases
    phone?: string
    password?: string
    [key: string]: any
}

export type StudentLoginPayload = {
    tcNumber: string
    pin: string

    // compatibility aliases
    studentId?: string
    password?: string
    [key: string]: any
}

export type AlumniVisitorLoginPayload = {
    mobileNumber: string
    pin: string

    // compatibility aliases
    phone?: string
    password?: string
    [key: string]: any
}

export type TicketStatus = "WAITING" | "CALLED" | "HOLD" | "SERVED" | "OUT"

export type Ticket = {
    _id: string
    department?: string | Department | { _id?: string; id?: string; name?: string; enabled?: boolean } | null
    dateKey: string
    queueNumber: number
    studentId?: string
    phone?: string
    status: TicketStatus
    windowNumber?: number | null
    calledAt?: string | null
    waitingSince?: string | null
    createdAt?: string
    updatedAt?: string
    [key: string]: any
}

export type JoinQueuePayload = {
    // Legacy/public flow
    departmentId?: string
    studentId?: string
    phone?: string

    // Participant-session flow
    transactionKeys?: string[]
    presentDirectlyToDisplayMonitor?: boolean
    shouldDisplayImmediately?: boolean

    [key: string]: any
}

export type JoinQueueResponse = {
    ticket: Ticket
    join?: {
        ticketId: string
        queueNumber: number
        dateKey: string
        status: TicketStatus
        windowNumber?: number
        staffAssigned?: string
        accountName?: string
        nameOfPersonInCharge?: string
        canPresentDirectlyToDisplayMonitor?: boolean
        voiceAnnouncement?: string
        [key: string]: any
    }
    [key: string]: any
}

export type FindActiveTicketResponse = {
    ticket: Ticket | null
    [key: string]: any
}

export type GetTicketResponse = {
    ticket: Ticket | null
    transactions?: {
        transactionKeys?: string[]
        transactionLabels?: string[]
        participantType?: string
    } | null
    [key: string]: any
}

export type PresentToDisplayPayload = {
    ticketId: string
    [key: string]: any
}

export type PresentToDisplayResponse = {
    ok?: boolean
    ticket?: Ticket
    [key: string]: any
}

/** =========================
 * HOME OVERVIEW TYPES
 * ========================= */

export type HomeOverviewStatusRow = {
    status: TicketStatus
    count: number
}

export type HomeOverviewDepartmentRow = {
    departmentId: string
    name: string
    code?: string
    total: number
    waiting: number
    called: number
    hold: number
    served: number
    out: number
}

export type HomeOverviewTrendPoint = {
    dateKey: string
    total: number
    served: number
    waiting: number
    called: number
}

export type HomeOverviewResponse = {
    dateKey: string
    generatedAt: string
    participantType?: ParticipantType | null
    scope?: {
        departmentId?: string | null
        departmentName?: string | null
    }
    highlights: {
        totalToday: number
        activeTickets: number
        servedToday: number
        enabledDepartments: number
    }
    statusDistribution: HomeOverviewStatusRow[]
    departmentLoad: HomeOverviewDepartmentRow[]
    trend: HomeOverviewTrendPoint[]
    [key: string]: any
}

const PARTICIPANT_TOKEN_KEY = "qp_participant_token"

export const participantAuthStorage = {
    getToken(): string | null {
        if (typeof window === "undefined") return null
        return localStorage.getItem(PARTICIPANT_TOKEN_KEY)
    },

    setToken(token: string) {
        if (typeof window === "undefined") return
        const clean = String(token ?? "").trim()
        if (!clean) return
        localStorage.setItem(PARTICIPANT_TOKEN_KEY, clean)
    },

    clearToken() {
        if (typeof window === "undefined") return
        localStorage.removeItem(PARTICIPANT_TOKEN_KEY)
    },
}

function participantAuthHeaders(): Record<string, string> | undefined {
    const token = participantAuthStorage.getToken()
    if (!token) return undefined
    return { Authorization: `Bearer ${token}` }
}

function persistToken<T extends ParticipantAuthResponse>(res: T): T {
    const token = res?.token || res?.sessionToken
    if (token) participantAuthStorage.setToken(token)
    return res
}

function toQuery(params?: Record<string, string | number | boolean | undefined | null>) {
    const qs = new URLSearchParams()
    if (!params) return ""
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === "") continue
        qs.set(k, String(v))
    }
    const s = qs.toString()
    return s ? `?${s}` : ""
}

export const studentApi = {
    // Public departments (for dropdowns)
    listDepartments: () => api.get<{ departments: Department[] }>("/public/departments", { auth: false }),

    // Participant signup
    signupStudent: async (payload: StudentSignupPayload) =>
        persistToken(
            await api.post<ParticipantAuthResponse>("/public/auth/signup/student", payload, { auth: false })
        ),

    signupAlumniVisitor: async (payload: AlumniVisitorSignupPayload) =>
        persistToken(
            await api.post<ParticipantAuthResponse>("/public/auth/signup/alumni-visitor", payload, { auth: false })
        ),

    // Guest alias
    signupGuest: async (payload: AlumniVisitorSignupPayload) =>
        persistToken(
            await api.post<ParticipantAuthResponse>("/public/auth/signup/guest", payload, { auth: false })
        ),

    // Participant login
    loginStudent: async (payload: StudentLoginPayload) =>
        persistToken(
            await api.post<ParticipantAuthResponse>("/public/auth/login/student", payload, { auth: false })
        ),

    loginAlumniVisitor: async (payload: AlumniVisitorLoginPayload) =>
        persistToken(
            await api.post<ParticipantAuthResponse>("/public/auth/login/alumni-visitor", payload, { auth: false })
        ),

    // Guest alias
    loginGuest: async (payload: AlumniVisitorLoginPayload) =>
        persistToken(
            await api.post<ParticipantAuthResponse>("/public/auth/login/guest", payload, { auth: false })
        ),

    // Session
    getSession: (opts?: { departmentId?: string }) =>
        api.get<ParticipantSessionResponse>(`/public/auth/session${toQuery(opts as any)}`, {
            auth: false,
            headers: participantAuthHeaders(),
        }),

    restoreSession: () =>
        api.post<ParticipantSessionResponse>("/public/auth/session", {}, {
            auth: false,
            headers: participantAuthHeaders(),
        }),

    logout: async () => {
        try {
            return await api.post<{ ok: true }>("/public/auth/logout", {}, {
                auth: false,
                headers: participantAuthHeaders(),
            })
        } finally {
            participantAuthStorage.clearToken()
        }
    },

    // Home overview charts (student/alumni dashboards)
    getHomeOverview: (opts?: {
        participantType?: ParticipantType
        departmentId?: string
        days?: number
    }) =>
        api.get<HomeOverviewResponse>(`/public/home/overview${toQuery(opts as any)}`, {
            auth: false,
            headers: participantAuthHeaders(),
        }),

    // Queue endpoints (supports both legacy and participant-session payloads)
    joinQueue: (payload: JoinQueuePayload) =>
        api.post<JoinQueueResponse>("/public/tickets/join", payload, {
            auth: false,
            headers: participantAuthHeaders(),
        }),

    findActiveByStudent: (payload: { departmentId: string; studentId: string }) =>
        api.get<FindActiveTicketResponse>(
            `/public/tickets?departmentId=${encodeURIComponent(payload.departmentId)}&studentId=${encodeURIComponent(payload.studentId)}`,
            {
                auth: false,
                headers: participantAuthHeaders(),
            }
        ),

    getTicket: (id: string) =>
        api.get<GetTicketResponse>(`/public/tickets/${encodeURIComponent(String(id).trim())}`, {
            auth: false,
            headers: participantAuthHeaders(),
        }),

    // Display monitor presence (participant-auth/session token supported)
    presentToDisplayMonitor: (payload: PresentToDisplayPayload) =>
        api.post<PresentToDisplayResponse>("/public/tickets/present", payload, {
            auth: false,
            headers: participantAuthHeaders(),
        }),

    // Backward-compatible alias endpoint
    presentToDisplayMonitorLegacy: (payload: PresentToDisplayPayload) =>
        api.post<PresentToDisplayResponse>("/public/tickets/present-to-display-monitor", payload, {
            auth: false,
            headers: participantAuthHeaders(),
        }),
}

// Compatibility alias for modules that still import guestApi from student.ts
export const guestApi = studentApi
