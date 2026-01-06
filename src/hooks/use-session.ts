import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react"
import { authApi, type LoginResponse, type UserRole } from "@/api/auth"
import { ApiError } from "@/lib/http"
import { clearAuthToken, getAuthToken, setAuthToken } from "@/lib/auth"

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

function mapMeToSessionUser(me: Awaited<ReturnType<typeof authApi.me>>): SessionUser | null {
    const u = me.user
    if (!u) return null

    return {
        id: u.id,
        role: u.role,
        name: u.name ?? null,
        assignedDepartment: u.assignedDepartment ?? null,
        assignedWindow: u.assignedWindow ?? null,
    }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<SessionUser | null>(null)

    // If a token exists, we start in loading state and resolve via refresh().
    const [loading, setLoading] = useState<boolean>(() => !!getAuthToken())

    const logout = useCallback(() => {
        clearAuthToken()
        setUser(null)
        setLoading(false)
    }, [])

    const refresh = useCallback(async () => {
        const token = getAuthToken()
        if (!token) {
            setUser(null)
            setLoading(false)
            return null
        }

        setLoading(true)
        try {
            const me = await authApi.me()
            const nextUser = mapMeToSessionUser(me)

            // If backend says "no user", treat as logged out.
            if (!nextUser) {
                clearAuthToken()
                setUser(null)
                setLoading(false)
                return null
            }

            setUser(nextUser)
            setLoading(false)
            return nextUser
        } catch (err) {
            // Token invalid/expired -> logout.
            if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
                clearAuthToken()
                setUser(null)
                setLoading(false)
                return null
            }

            // Any other error: keep previous user state, but stop loading.
            setLoading(false)
            throw err
        }
    }, [])

    const login = useCallback(
        async (email: string, password: string, rememberMe: boolean) => {
            const res = await authApi.login(email, password)
            setAuthToken(res.token, rememberMe)
            setUser(mapLoginUserToSession(res))
            setLoading(false)
            return res
        },
        [],
    )

    // Initial resolve on mount if token exists.
    useEffect(() => {
        let alive = true

        const token = getAuthToken()
        if (!token) {
            setLoading(false)
            return
        }

        ;(async () => {
            try {
                const me = await authApi.me()
                if (!alive) return
                const nextUser = mapMeToSessionUser(me)
                if (!nextUser) {
                    clearAuthToken()
                    setUser(null)
                } else {
                    setUser(nextUser)
                }
            } catch (err) {
                if (!alive) return
                if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
                    clearAuthToken()
                    setUser(null)
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
