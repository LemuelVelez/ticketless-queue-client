import { api } from "@/lib/http"

export type TicketParticipantType = "STUDENT" | "ALUMNI_VISITOR" | "GUEST" | "ALUMNI" | "UNKNOWN"

export type TicketView = {
    id: string
    dateKey: string
    queueNumber: number
    status: string
    department: { id: string; name: string; code?: string; transactionManager: string }
    participant: { studentId: string; name?: string; phone?: string; type?: TicketParticipantType }
    window?: { id: string; name: string; number: number }
    createdAt: string
    updatedAt: string
}

export type Announcement = {
    id: string
    createdAt: string
    ticketId: string
    queueNumber: number
    departmentName: string
    windowNumber?: number
    windowName?: string
    participantName?: string
    participantType?: TicketParticipantType
    voiceText: string
}

export type PublicDisplayState = {
    manager: string
    serverTime: string
    dateKey: string
    windows: Array<{
        id: string
        name: string
        number: number
        enabled: boolean
        departments: Array<{ id: string; name: string; code?: string }>
        nowServing?: TicketView
    }>
    departments: Array<{ id: string; name: string; code?: string }>
    upNext: TicketView[]
    announcements: Announcement[]
}

type ApiEnvelope<T> = { ok: boolean; data?: T; error?: { code: string; message: string } }

// ✅ IMPORTANT:
// Your `api` client is already prefixed with "/api" (baseURL), so using "/api/queue" here
// becomes "/api/api/queue" and causes 404.
// With QUEUE_BASE="/queue", requests become: "/api/queue/..."
const QUEUE_BASE = "/queue"

function isApiEnvelope<T>(v: unknown): v is ApiEnvelope<T> {
    if (!v || typeof v !== "object") return false
    return "ok" in (v as any)
}

/**
 * Your http wrapper may return either:
 *  - ApiEnvelope<T> (enveloped)
 *  - T (already unwrapped)
 *  - { data: ApiEnvelope<T> } (axios-like)
 *  - { data: T } (axios-like already unwrapped)
 *
 * So we accept unknown and normalize safely with type guards.
 */
function unwrap<T>(res: unknown): T {
    const payload = res && typeof res === "object" && "data" in (res as any) ? (res as any).data : res

    if (isApiEnvelope<T>(payload)) {
        if (!payload.ok) {
            const msg = payload.error?.message || "Request failed."
            throw new Error(msg)
        }
        if (payload.data === undefined) {
            throw new Error("Request succeeded but no data was returned.")
        }
        return payload.data
    }

    if (payload === undefined || payload === null) {
        throw new Error("Empty response.")
    }

    return payload as T
}

export const landingApi = {
    async listManagers(): Promise<string[]> {
        const res = await api.get(`${QUEUE_BASE}/managers`)
        return unwrap<string[]>(res) ?? []
    },

    async getPublicDisplayState(manager: string, since?: string): Promise<PublicDisplayState> {
        const qs = new URLSearchParams()
        qs.set("manager", manager)
        if (since) qs.set("since", since)

        // ✅ Build query string manually because this http wrapper doesn't support `params`
        const url = `${QUEUE_BASE}/public-display?${qs.toString()}`
        const res = await api.get(url)
        return unwrap<PublicDisplayState>(res)
    },
}