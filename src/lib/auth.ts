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

export function setAuthToken(token: string, rememberMe: boolean) {
    if (rememberMe) {
        localStorage.setItem(LS_TOKEN_KEY, token)
        sessionStorage.removeItem(SS_TOKEN_KEY)
    } else {
        sessionStorage.setItem(SS_TOKEN_KEY, token)
        localStorage.removeItem(LS_TOKEN_KEY)
    }
}

export function getAuthToken(): string | null {
    return localStorage.getItem(LS_TOKEN_KEY) || sessionStorage.getItem(SS_TOKEN_KEY)
}

export function clearAuthToken() {
    localStorage.removeItem(LS_TOKEN_KEY)
    sessionStorage.removeItem(SS_TOKEN_KEY)
}

export function getAuthStorage(): AuthStorage {
    if (localStorage.getItem(LS_TOKEN_KEY)) return "local"
    if (sessionStorage.getItem(SS_TOKEN_KEY)) return "session"
    return null
}

export function setAuthUser(user: StoredAuthUser, rememberMe: boolean) {
    const raw = JSON.stringify(user)

    if (rememberMe) {
        localStorage.setItem(LS_USER_KEY, raw)
        sessionStorage.removeItem(SS_USER_KEY)
    } else {
        sessionStorage.setItem(SS_USER_KEY, raw)
        localStorage.removeItem(LS_USER_KEY)
    }
}

export function getAuthUser<T extends StoredAuthUser = StoredAuthUser>(): T | null {
    const raw = localStorage.getItem(LS_USER_KEY) || sessionStorage.getItem(SS_USER_KEY)
    if (!raw) return null
    try {
        return JSON.parse(raw) as T
    } catch {
        return null
    }
}

export function clearAuthUser() {
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
