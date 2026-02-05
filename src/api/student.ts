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

export type PresentToDisplayPayload = {
    ticketId: string
    [key: string]: any
}

export type PresentToDisplayResponse = {
    ok?: boolean
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

export const guestApi = {
    // Public departments (for signup dropdown)
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
    getSession: () =>
        api.get<ParticipantSessionResponse>("/public/auth/session", {
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

    // Display monitor presence (participant-auth required)
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
