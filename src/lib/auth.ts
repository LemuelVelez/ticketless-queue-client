const LS_TOKEN_KEY = "qp_auth_token"
const SS_TOKEN_KEY = "qp_auth_token_session"

const LS_USER_KEY = "qp_auth_user"
const SS_USER_KEY = "qp_auth_user_session"

export type AuthStorage = "local" | "session" | null

export type StoredAuthUser = {
    id: string
    name?: string
    email?: string
    role?: string
    assignedDepartment?: string | null
    assignedWindow?: string | null
    // Allow extra backend fields without breaking
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

export function setAuthToken(token: string, rememberMe: boolean) {
    if (!canUseStorage()) return

    if (rememberMe) {
        localStorage.setItem(LS_TOKEN_KEY, token)
        sessionStorage.removeItem(SS_TOKEN_KEY)
    } else {
        sessionStorage.setItem(SS_TOKEN_KEY, token)
        localStorage.removeItem(LS_TOKEN_KEY)
    }
}

export function getAuthToken(): string | null {
    if (!canUseStorage()) return null
    return localStorage.getItem(LS_TOKEN_KEY) || sessionStorage.getItem(SS_TOKEN_KEY)
}

export function clearAuthToken() {
    if (!canUseStorage()) return
    localStorage.removeItem(LS_TOKEN_KEY)
    sessionStorage.removeItem(SS_TOKEN_KEY)
}

export function getAuthStorage(): AuthStorage {
    if (!canUseStorage()) return null
    if (localStorage.getItem(LS_TOKEN_KEY)) return "local"
    if (sessionStorage.getItem(SS_TOKEN_KEY)) return "session"
    return null
}

export function setAuthUser(user: StoredAuthUser, rememberMe: boolean) {
    if (!canUseStorage()) return

    /**
     * Fix: don't wipe fields (like email) when callers update the stored user
     * with a partial user (e.g. /auth/me response missing email).
     */
    const prev = getAuthUser<StoredAuthUser>()
    const merged = mergeDefined(prev, user)
    const raw = JSON.stringify(merged)

    if (rememberMe) {
        localStorage.setItem(LS_USER_KEY, raw)
        sessionStorage.removeItem(SS_USER_KEY)
    } else {
        sessionStorage.setItem(SS_USER_KEY, raw)
        localStorage.removeItem(LS_USER_KEY)
    }
}

export function getAuthUser<T extends StoredAuthUser = StoredAuthUser>(): T | null {
    if (!canUseStorage()) return null

    const raw = localStorage.getItem(LS_USER_KEY) || sessionStorage.getItem(SS_USER_KEY)
    if (!raw) return null
    try {
        return JSON.parse(raw) as T
    } catch {
        return null
    }
}

export function clearAuthUser() {
    if (!canUseStorage()) return
    localStorage.removeItem(LS_USER_KEY)
    sessionStorage.removeItem(SS_USER_KEY)
}

export function setAuthSession(token: string, user: StoredAuthUser, rememberMe: boolean) {
    setAuthToken(token, rememberMe)
    setAuthUser(user, rememberMe)
}

export function clearAuthSession() {
    clearAuthToken()
    clearAuthUser()
}
