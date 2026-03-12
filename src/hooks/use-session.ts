import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import { toApiPath } from "@/api/api"
import {
    AUTH_STORAGE_KEYS,
    clearAuthSession,
    getAuthStorage,
    getAuthToken,
    getAuthUser,
    setAuthSession,
    setAuthUser,
    type StoredAuthUser,
} from "@/lib/auth"
import { api, ApiError } from "@/lib/http"
import { isUserRole, type UserRole } from "@/lib/rolebase"

const LS_TOKEN_KEY = AUTH_STORAGE_KEYS.auth.token.local
const SS_TOKEN_KEY = AUTH_STORAGE_KEYS.auth.token.session

const AUTH_API_PATHS = {
    login: toApiPath("/auth/login"),
    me: toApiPath("/auth/me"),
} as const

type ApiUser = {
    id?: string
    _id?: string
    role?: unknown
    name?: string | null
    email?: string | null
    assignedDepartment?: string | null
    assignedDepartmentName?: string | null
    assignedDepartmentNames?: string[] | null
    assignedWindow?: string | null
    assignedWindowName?: string | null
    firstName?: string | null
    middleName?: string | null
    lastName?: string | null
    [key: string]: unknown
}

export type LoginResponse = {
    token: string
    user: ApiUser
}

type MeResponse = {
    user?: ApiUser | null
}

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

type SessionUserPatch = {
    id: string
    role: UserRole
    name?: string | null
    email?: string
    assignedDepartment?: string | null
    assignedWindow?: string | null
}

function normalizeString(value: unknown): string | null {
    if (typeof value !== "string") return null
    const clean = value.trim()
    return clean ? clean : null
}

function hasOwn<T extends object>(value: T, key: PropertyKey): boolean {
    return Object.prototype.hasOwnProperty.call(value, key)
}

function resolveName(user: ApiUser): string | null {
    const directName = normalizeString(user.name)
    if (directName) return directName

    const parts = [user.firstName, user.middleName, user.lastName]
        .map(normalizeString)
        .filter(Boolean)

    if (!parts.length) return null
    return parts.join(" ")
}

function resolveAssignedDepartment(user: ApiUser): string | null {
    const direct = normalizeString(user.assignedDepartment)
    if (direct) return direct

    const named = normalizeString(user.assignedDepartmentName)
    if (named) return named

    if (Array.isArray(user.assignedDepartmentNames)) {
        for (const value of user.assignedDepartmentNames) {
            const clean = normalizeString(value)
            if (clean) return clean
        }
    }

    return null
}

function resolveAssignedWindow(user: ApiUser): string | null {
    return normalizeString(user.assignedWindow) ?? normalizeString(user.assignedWindowName)
}

function toSessionUser(user: ApiUser | null | undefined): SessionUser | null {
    if (!user) return null

    const id = normalizeString(user.id) ?? normalizeString(user._id)
    if (!id || !isUserRole(user.role)) return null

    const email = normalizeString(user.email)

    return {
        id,
        role: user.role,
        name: resolveName(user),
        ...(email ? { email } : {}),
        assignedDepartment: resolveAssignedDepartment(user),
        assignedWindow: resolveAssignedWindow(user),
    }
}

function mapStoredUserToSessionUser(stored: StoredAuthUser | null): SessionUser | null {
    if (!stored) return null

    const id = normalizeString(stored.id)
    const role = stored.role

    if (!id || !isUserRole(role)) return null

    const email = normalizeString(stored.email)

    return {
        id,
        role,
        name: normalizeString(stored.name),
        ...(email ? { email } : {}),
        assignedDepartment: normalizeString(stored.assignedDepartment) ?? null,
        assignedWindow: normalizeString(stored.assignedWindow) ?? null,
    }
}

function mapMeToSessionPatch(me: MeResponse): SessionUserPatch | null {
    const user = me.user
    if (!user) return null

    const id = normalizeString(user.id) ?? normalizeString(user._id)
    if (!id || !isUserRole(user.role)) return null

    const patch: SessionUserPatch = {
        id,
        role: user.role,
    }

    if (
        hasOwn(user, "name") ||
        hasOwn(user, "firstName") ||
        hasOwn(user, "middleName") ||
        hasOwn(user, "lastName")
    ) {
        patch.name = resolveName(user)
    }

    if (hasOwn(user, "email")) {
        const email = normalizeString(user.email)
        if (email) patch.email = email
    }

    if (
        hasOwn(user, "assignedDepartment") ||
        hasOwn(user, "assignedDepartmentName") ||
        hasOwn(user, "assignedDepartmentNames")
    ) {
        patch.assignedDepartment = resolveAssignedDepartment(user)
    }

    if (hasOwn(user, "assignedWindow") || hasOwn(user, "assignedWindowName")) {
        patch.assignedWindow = resolveAssignedWindow(user)
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
            typeof patch.assignedWindow !== "undefined"
                ? patch.assignedWindow
                : prev?.assignedWindow ?? null,
    }
}

function toStoredAuthUser(user: SessionUser): StoredAuthUser {
    return {
        id: user.id,
        role: user.role,
        ...(typeof user.name === "string" ? { name: user.name } : {}),
        ...(typeof user.email === "string" ? { email: user.email } : {}),
        assignedDepartment: user.assignedDepartment,
        assignedWindow: user.assignedWindow,
    }
}

const sessionAuthApi = {
    login(email: string, password: string) {
        return api.postData<LoginResponse>(
            AUTH_API_PATHS.login,
            { email, password },
            { auth: false },
        )
    },
    me() {
        return api.getData<MeResponse>(AUTH_API_PATHS.me, { auth: "staff" })
    },
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
    // Hydrate from storage immediately
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

    const clearSessionState = useCallback(() => {
        clearAuthSession()
        setUser(null)
        userRef.current = null
    }, [])

    const persistSessionUser = useCallback((nextUser: SessionUser) => {
        const rememberMe = getAuthStorage() === "local"
        setAuthUser(toStoredAuthUser(nextUser), rememberMe)
    }, [])

    const logout = useCallback(() => {
        clearSessionState()
        setLoading(false)
    }, [clearSessionState])

    const refresh = useCallback(async () => {
        const token = getAuthToken()

        if (!token) {
            clearSessionState()
            setLoading(false)
            return null
        }

        setLoading(true)

        try {
            const me = await sessionAuthApi.me()
            const patch = mapMeToSessionPatch(me)

            if (!patch) {
                clearSessionState()
                return null
            }

            const merged = applyPatch(userRef.current, patch)

            setUser(merged)
            userRef.current = merged
            persistSessionUser(merged)

            return merged
        } catch (err) {
            if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
                clearSessionState()
                return null
            }

            throw err
        } finally {
            setLoading(false)
        }
    }, [clearSessionState, persistSessionUser])

    const login = useCallback(async (email: string, password: string, rememberMe: boolean) => {
        const res = await sessionAuthApi.login(email, password)
        const next = toSessionUser(res.user)

        if (!next) {
            throw new Error("Login response did not include a valid staff session user.")
        }

        setAuthSession(res.token, toStoredAuthUser(next), rememberMe)

        setUser(next)
        userRef.current = next
        setLoading(false)

        return res
    }, [])

    useEffect(() => {
        let alive = true

        const token = getAuthToken()
        if (!token) {
            setLoading(false)
            return
        }

        ;(async () => {
            try {
                const me = await sessionAuthApi.me()
                if (!alive) return

                const patch = mapMeToSessionPatch(me)

                if (!patch) {
                    clearSessionState()
                    return
                }

                const merged = applyPatch(userRef.current, patch)
                setUser(merged)
                userRef.current = merged
                persistSessionUser(merged)
            } catch (err) {
                if (!alive) return

                if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
                    clearSessionState()
                }
            } finally {
                if (alive) setLoading(false)
            }
        })()

        return () => {
            alive = false
        }
    }, [clearSessionState, persistSessionUser])

    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key === LS_TOKEN_KEY || e.key === SS_TOKEN_KEY) {
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