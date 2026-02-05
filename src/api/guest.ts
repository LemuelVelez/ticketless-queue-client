/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from "@/lib/http"

export type ParticipantType = "STUDENT" | "ALUMNI_VISITOR"

export type Participant = {
    id?: string
    _id?: string
    type?: ParticipantType
    name?: string
    email?: string
    studentId?: string
    phone?: string
    [key: string]: any
}

export type ParticipantAuthResponse = {
    ok?: boolean
    token?: string
    participant?: Participant | null
    [key: string]: any
}

export type ParticipantSessionResponse = {
    authenticated?: boolean
    participant?: Participant | null
    expiresAt?: string | null
    [key: string]: any
}

export type StudentSignupPayload = {
    studentId: string
    password: string
    name?: string
    email?: string
    phone?: string
    [key: string]: any
}

export type AlumniVisitorSignupPayload = {
    name: string
    password: string
    email?: string
    phone?: string
    [key: string]: any
}

export type StudentLoginPayload = {
    studentId: string
    password: string
    [key: string]: any
}

export type AlumniVisitorLoginPayload = {
    email?: string
    name?: string
    password: string
    [key: string]: any
}

export type PresentToDisplayPayload = {
    ticketId: string
    [key: string]: any
}

export type PresentToDisplayResponse = {
    ok: boolean
    [key: string]: any
}

export const guestApi = {
    // Participant signup
    signupStudent: (payload: StudentSignupPayload) =>
        api.post<ParticipantAuthResponse>("/public/auth/signup/student", payload, { auth: false }),

    signupAlumniVisitor: (payload: AlumniVisitorSignupPayload) =>
        api.post<ParticipantAuthResponse>("/public/auth/signup/alumni-visitor", payload, { auth: false }),

    // Participant login
    loginStudent: (payload: StudentLoginPayload) =>
        api.post<ParticipantAuthResponse>("/public/auth/login/student", payload, { auth: false }),

    loginAlumniVisitor: (payload: AlumniVisitorLoginPayload) =>
        api.post<ParticipantAuthResponse>("/public/auth/login/alumni-visitor", payload, { auth: false }),

    // Session
    getSession: () => api.get<ParticipantSessionResponse>("/public/auth/session", { auth: false }),

    restoreSession: () => api.post<ParticipantSessionResponse>("/public/auth/session", {}, { auth: false }),

    logout: () => api.post<{ ok: true }>("/public/auth/logout", {}, { auth: false }),

    // Display monitor presence
    presentToDisplayMonitor: (payload: PresentToDisplayPayload) =>
        api.post<PresentToDisplayResponse>("/public/tickets/present", payload, { auth: false }),

    // Backward-compatible alias endpoint
    presentToDisplayMonitorLegacy: (payload: PresentToDisplayPayload) =>
        api.post<PresentToDisplayResponse>("/public/tickets/present-to-display-monitor", payload, { auth: false }),
}
