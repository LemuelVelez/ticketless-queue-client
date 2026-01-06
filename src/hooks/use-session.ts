import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import { authApi, type LoginResponse, type UserRole } from "@/api/auth"
import { ApiError } from "@/lib/http"
import {
    clearAuthSession,
    getAuthStorage,
    getAuthToken,
    getAuthUser,
    setAuthSession,
    setAuthUser,
    type StoredAuthUser,
} from "@/lib/auth"

const LS_TOKEN_KEY = "qp_auth_token"
const SS_TOKEN_KEY = "qp_auth_token_session"

export type SessionUser = {
    id: string
    role: UserRole
    name: string | null
    email?: string
    assignedDepartment: string | null
    assignedWindow: string | null
}

export type SessionContextValue = {
    user: SessionUser | null
    loading: boolean
    refresh: () => Promise<SessionUser | null>
    logout: () => void

    /**
     * Optional convenience method if you want session to own login.
     * You can ignore this if your login page handles it elsewhere.
     */
    login: (email: string, password: string, rememberMe: boolean) => Promise<LoginResponse>
}

const SessionContext = createContext<SessionContextValue | null>(null)

function isUserRole(v: unknown): v is UserRole {
    return v === "ADMIN" || v === "STAFF"
}

function mapLoginUserToSession(res: LoginResponse): SessionUser {
    return {
        id: res.user.id,
        role: res.user.role,
        name: res.user.name ?? null,
        email: res.user.email,
        assignedDepartment: res.user.assignedDepartment ?? null,
        assignedWindow: res.user.assignedWindow ?? null,
    }
}

function mapStoredUserToSessionUser(stored: StoredAuthUser | null): SessionUser | null {
    if (!stored) return null

    const id = typeof stored.id === "string" ? stored.id : ""
    const role = stored.role

    if (!id || !isUserRole(role)) return null

    const dep = stored.assignedDepartment
    const win = stored.assignedWindow

    return {
        id,
        role,
        name: typeof stored.name === "string" ? stored.name : null,
        email: typeof stored.email === "string" ? stored.email : undefined,
        assignedDepartment: typeof dep === "string" ? dep : null,
        assignedWindow: typeof win === "string" ? win : null,
    }
}

/**
 * /auth/me can be partial (often missing email).
 * We treat it as a PATCH over the existing session user.
 */
type SessionUserPatch = {
    id: string
    role: UserRole
    name?: string | null
    email?: string
    assignedDepartment?: string | null
    assignedWindow?: string | null
}

function mapMeToSessionPatch(me: Awaited<ReturnType<typeof authApi.me>>): SessionUserPatch | null {
    const u = me.user
    if (!u) return null

    const patch: SessionUserPatch = {
        id: u.id,
        role: u.role,
    }

    if (typeof u.name !== "undefined") patch.name = u.name ?? null
    if (typeof u.email !== "undefined") patch.email = u.email

    if (typeof u.assignedDepartment !== "undefined") {
        patch.assignedDepartment = (u.assignedDepartment as unknown as string | null) ?? null
    }
    if (typeof u.assignedWindow !== "undefined") {
        patch.assignedWindow = (u.assignedWindow as unknown as string | null) ?? null
    }

    return patch
}

function applyPatch(prev: SessionUser | null, patch: SessionUserPatch): SessionUser {
    return {
        id: patch.id,
        role: patch.role,
        name: typeof patch.name !== "undefined" ? patch.name : prev?.name ?? null,
        email: typeof patch.email !== "undefined" ? patch.email : prev?.email,
        assignedDepartment:
            typeof patch.assignedDepartment !== "undefined"
                ? patch.assignedDepartment
                : prev?.assignedDepartment ?? null,
        assignedWindow:
            typeof patch.assignedWindow !== "undefined" ? patch.assignedWindow : prev?.assignedWindow ?? null,
    }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
    // Hydrate from storage immediately (prevents "email disappears after refresh")
    const [user, setUser] = useState<SessionUser | null>(() => {
        const token = getAuthToken()
        if (!token) return null
        return mapStoredUserToSessionUser(getAuthUser())
    })

    // If a token exists, we start in loading state and resolve via refresh().
    const [loading, setLoading] = useState<boolean>(() => !!getAuthToken())

    const userRef = useRef<SessionUser | null>(user)
    useEffect(() => {
        userRef.current = user
    }, [user])

    const logout = useCallback(() => {
        clearAuthSession()
        setUser(null)
        userRef.current = null
        setLoading(false)
    }, [])

    const refresh = useCallback(async () => {
        const token = getAuthToken()
        if (!token) {
            setUser(null)
            userRef.current = null
            setLoading(false)
            return null
        }

        setLoading(true)
        try {
            const me = await authApi.me()
            const patch = mapMeToSessionPatch(me)

            // If backend says "no user", treat as logged out.
            if (!patch) {
                clearAuthSession()
                setUser(null)
                userRef.current = null
                setLoading(false)
                return null
            }

            const merged = applyPatch(userRef.current, patch)

            setUser(merged)
            userRef.current = merged

            // Persist merged user (keeps email even if /me omits it)
            const rememberMe = getAuthStorage() === "local"
            setAuthUser(
                {
                    id: merged.id,
                    role: merged.role,
                    ...(typeof merged.name === "string" ? { name: merged.name } : {}),
                    ...(typeof merged.email === "string" ? { email: merged.email } : {}),
                    assignedDepartment: merged.assignedDepartment,
                    assignedWindow: merged.assignedWindow,
                },
                rememberMe,
            )

            setLoading(false)
            return merged
        } catch (err) {
            // Token invalid/expired -> logout.
            if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
                clearAuthSession()
                setUser(null)
                userRef.current = null
                setLoading(false)
                return null
            }

            // Any other error: keep previous user state, but stop loading.
            setLoading(false)
            throw err
        }
    }, [])

    const login = useCallback(async (email: string, password: string, rememberMe: boolean) => {
        const res = await authApi.login(email, password)

        // Store BOTH token + user so refresh can re-hydrate email reliably
        setAuthSession(res.token, res.user, rememberMe)

        const next = mapLoginUserToSession(res)
        setUser(next)
        userRef.current = next
        setLoading(false)
        return res
    }, [])

    // Initial resolve on mount if token exists.
    useEffect(() => {
        let alive = true

        const token = getAuthToken()
        if (!token) {
            setLoading(false)
            return
        }

        // If we have a stored user, show it immediately (already in state),
        // then patch it with /me.
        ; (async () => {
            try {
                const me = await authApi.me()
                if (!alive) return

                const patch = mapMeToSessionPatch(me)
                if (!patch) {
                    clearAuthSession()
                    setUser(null)
                    userRef.current = null
                } else {
                    const merged = applyPatch(userRef.current, patch)
                    setUser(merged)
                    userRef.current = merged

                    const rememberMe = getAuthStorage() === "local"
                    setAuthUser(
                        {
                            id: merged.id,
                            role: merged.role,
                            ...(typeof merged.name === "string" ? { name: merged.name } : {}),
                            ...(typeof merged.email === "string" ? { email: merged.email } : {}),
                            assignedDepartment: merged.assignedDepartment,
                            assignedWindow: merged.assignedWindow,
                        },
                        rememberMe,
                    )
                }
            } catch (err) {
                if (!alive) return
                if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
                    clearAuthSession()
                    setUser(null)
                    userRef.current = null
                }
            } finally {
                if (alive) setLoading(false)
            }
        })()

        return () => {
            alive = false
        }
    }, [])

    // Keep session in sync across tabs (localStorage changes fire storage events).
    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key === LS_TOKEN_KEY || e.key === SS_TOKEN_KEY) {
                // Refresh session when token changes in another tab.
                void refresh()
            }
        }
        window.addEventListener("storage", onStorage)
        return () => window.removeEventListener("storage", onStorage)
    }, [refresh])

    const value = useMemo<SessionContextValue>(
        () => ({
            user,
            loading,
            refresh,
            logout,
            login,
        }),
        [user, loading, refresh, logout, login],
    )

    return React.createElement(SessionContext.Provider, { value }, children)
}

export function useSession(): SessionContextValue {
    const ctx = useContext(SessionContext)
    if (!ctx) {
        throw new Error("useSession must be used within <SessionProvider />")
    }
    return ctx
}
