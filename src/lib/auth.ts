const LS_TOKEN_KEY = "qp_auth_token"
const SS_TOKEN_KEY = "qp_auth_token_session"

const LS_USER_KEY = "qp_auth_user"
const SS_USER_KEY = "qp_auth_user_session"

// Participant (student/guest) auth keys
const LS_PARTICIPANT_TOKEN_KEY = "qp_participant_token"
const SS_PARTICIPANT_TOKEN_KEY = "qp_participant_token_session"

const LS_PARTICIPANT_USER_KEY = "qp_participant_user"
const SS_PARTICIPANT_USER_KEY = "qp_participant_user_session"

export type AuthStorage = "local" | "session" | null
export type ParticipantStorage = "local" | "session" | null

export type StoredAuthUser = {
    id: string
    name?: string
    email?: string
    role?: string
    assignedDepartment?: string | null
    assignedWindow?: string | null

    // ✅ Avatar (optional)
    avatarKey?: string | null
    avatarUrl?: string | null

    // Allow extra backend fields without breaking
    [key: string]: unknown
}

export type StoredParticipantUser = {
    id?: string
    _id?: string
    type?: string

    // Common identity fields
    name?: string
    firstName?: string
    middleName?: string
    lastName?: string

    tcNumber?: string
    studentId?: string
    mobileNumber?: string
    phone?: string

    departmentId?: string
    departmentCode?: string

    [key: string]: unknown
}

function canUseStorage(): boolean {
    return typeof window !== "undefined" && !!window.localStorage && !!window.sessionStorage
}

function mergeDefined<T extends Record<string, unknown>>(base: T | null, patch: T): T {
    const out: Record<string, unknown> = { ...(base ?? {}) }
    for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) out[k] = v
    }
    return out as T
}

function hasStorageToken(localKey: string, sessionKey: string): AuthStorage {
    if (!canUseStorage()) return null
    if (localStorage.getItem(localKey)) return "local"
    if (sessionStorage.getItem(sessionKey)) return "session"
    return null
}

function setScopedToken(localKey: string, sessionKey: string, token: string, rememberMe: boolean) {
    if (!canUseStorage()) return

    const clean = String(token ?? "").trim()
    if (!clean) return

    if (rememberMe) {
        localStorage.setItem(localKey, clean)
        sessionStorage.removeItem(sessionKey)
    } else {
        sessionStorage.setItem(sessionKey, clean)
        localStorage.removeItem(localKey)
    }
}

function getScopedToken(localKey: string, sessionKey: string): string | null {
    if (!canUseStorage()) return null
    return localStorage.getItem(localKey) || sessionStorage.getItem(sessionKey)
}

function clearScopedToken(localKey: string, sessionKey: string) {
    if (!canUseStorage()) return
    localStorage.removeItem(localKey)
    sessionStorage.removeItem(sessionKey)
}

function setScopedUser<T extends Record<string, unknown>>(
    localKey: string,
    sessionKey: string,
    user: T,
    rememberMe: boolean,
    readCurrent: () => T | null,
) {
    if (!canUseStorage()) return

    // Merge so partial updates won't wipe stored fields
    const prev = readCurrent()
    const merged = mergeDefined(prev, user)
    const raw = JSON.stringify(merged)

    if (rememberMe) {
        localStorage.setItem(localKey, raw)
        sessionStorage.removeItem(sessionKey)
    } else {
        sessionStorage.setItem(sessionKey, raw)
        localStorage.removeItem(localKey)
    }
}

function getScopedUser<T extends Record<string, unknown>>(localKey: string, sessionKey: string): T | null {
    if (!canUseStorage()) return null

    const raw = localStorage.getItem(localKey) || sessionStorage.getItem(sessionKey)
    if (!raw) return null
    try {
        return JSON.parse(raw) as T
    } catch {
        return null
    }
}

function clearScopedUser(localKey: string, sessionKey: string) {
    if (!canUseStorage()) return
    localStorage.removeItem(localKey)
    sessionStorage.removeItem(sessionKey)
}

// ------------------------------
// Staff/Admin auth session
// ------------------------------
export function setAuthToken(token: string, rememberMe: boolean) {
    setScopedToken(LS_TOKEN_KEY, SS_TOKEN_KEY, token, rememberMe)
}

export function getAuthToken(): string | null {
    return getScopedToken(LS_TOKEN_KEY, SS_TOKEN_KEY)
}

export function clearAuthToken() {
    clearScopedToken(LS_TOKEN_KEY, SS_TOKEN_KEY)
}

export function getAuthStorage(): AuthStorage {
    return hasStorageToken(LS_TOKEN_KEY, SS_TOKEN_KEY)
}

export function setAuthUser(user: StoredAuthUser, rememberMe: boolean) {
    setScopedUser(LS_USER_KEY, SS_USER_KEY, user, rememberMe, () => getAuthUser<StoredAuthUser>())
}

export function getAuthUser<T extends StoredAuthUser = StoredAuthUser>(): T | null {
    return getScopedUser<T>(LS_USER_KEY, SS_USER_KEY)
}

export function clearAuthUser() {
    clearScopedUser(LS_USER_KEY, SS_USER_KEY)
}

export function setAuthSession(token: string, user: StoredAuthUser, rememberMe: boolean) {
    setAuthToken(token, rememberMe)
    setAuthUser(user, rememberMe)
}

export function clearAuthSession() {
    clearAuthToken()
    clearAuthUser()
}

// ------------------------------
// Participant (Student/Guest) auth session
// ------------------------------
export function setParticipantToken(token: string, rememberMe = true) {
    setScopedToken(LS_PARTICIPANT_TOKEN_KEY, SS_PARTICIPANT_TOKEN_KEY, token, rememberMe)
}

export function getParticipantToken(): string | null {
    return getScopedToken(LS_PARTICIPANT_TOKEN_KEY, SS_PARTICIPANT_TOKEN_KEY)
}

export function clearParticipantToken() {
    clearScopedToken(LS_PARTICIPANT_TOKEN_KEY, SS_PARTICIPANT_TOKEN_KEY)
}

export function getParticipantStorage(): ParticipantStorage {
    return hasStorageToken(LS_PARTICIPANT_TOKEN_KEY, SS_PARTICIPANT_TOKEN_KEY)
}

export function setParticipantUser(user: StoredParticipantUser, rememberMe = true) {
    setScopedUser(
        LS_PARTICIPANT_USER_KEY,
        SS_PARTICIPANT_USER_KEY,
        user,
        rememberMe,
        () => getParticipantUser<StoredParticipantUser>(),
    )
}

export function getParticipantUser<T extends StoredParticipantUser = StoredParticipantUser>(): T | null {
    return getScopedUser<T>(LS_PARTICIPANT_USER_KEY, SS_PARTICIPANT_USER_KEY)
}

export function clearParticipantUser() {
    clearScopedUser(LS_PARTICIPANT_USER_KEY, SS_PARTICIPANT_USER_KEY)
}

export function setParticipantSession(token: string, user?: StoredParticipantUser, rememberMe = true) {
    setParticipantToken(token, rememberMe)
    if (user) setParticipantUser(user, rememberMe)
}

export function clearParticipantSession() {
    clearParticipantToken()
    clearParticipantUser()
}

/**
 * Convenience helper used by HTTP clients that can work with either:
 * - "staff" (admin/staff auth token)
 * - "participant" (student/guest token)
 */
export function getAnyAuthToken(prefer: "staff" | "participant" = "staff"): string | null {
    if (prefer === "participant") {
        return getParticipantToken() || getAuthToken()
    }
    return getAuthToken() || getParticipantToken()
}

export function clearAllAuthSessions() {
    clearAuthSession()
    clearParticipantSession()
}
