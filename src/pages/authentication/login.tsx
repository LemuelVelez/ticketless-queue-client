import * as React from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

import LoadingPage from "@/pages/loading"

import { toApiPath } from "@/api/api"
import { useSession } from "@/hooks/use-session"
import {
    clearAuthSession,
    clearParticipantSession,
    getParticipantToken,
    setParticipantSession,
    type StoredParticipantUser,
} from "@/lib/auth"
import { api, ApiError } from "@/lib/http"
import { isUserRole } from "@/lib/rolebase"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import logo from "@/assets/images/logo.svg"
import heroImage from "@/assets/images/heroImage.svg"

type LocationState = {
    from?: {
        pathname?: string
    }
}

type ParticipantRole = "STUDENT" | "ALUMNI_VISITOR" | "GUEST"
type StaffRole = "ADMIN" | "STAFF"

type ParticipantRecord = {
    id?: string
    _id?: string
    type?: unknown
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

type ParticipantSessionResponse = {
    token?: string
    accessToken?: string
    sessionToken?: string
    session?: {
        token?: string
        accessToken?: string
        sessionToken?: string
        participant?: ParticipantRecord | null
        user?: ParticipantRecord | null
    } | null
    participant?: ParticipantRecord | null
    user?: ParticipantRecord | null
    [key: string]: unknown
}

type ParticipantLoginPayload = {
    tcNumber?: string
    studentId?: string
    mobileNumber?: string
    phone?: string
    pin: string
    password: string
}

const PARTICIPANT_AUTH_API_PATHS = {
    session: [
        "/guest/session",
        "/guest/me",
        "/participant/session",
        "/participant/me",
        "/auth/guest/session",
        "/auth/participant/session",
        "/auth/participant/me",
    ],
    loginStudent: [
        "/guest/login/student",
        "/guest/student/login",
        "/participant/login/student",
        "/auth/participant/login/student",
        "/auth/student/login",
    ],
    loginAlumniVisitor: [
        "/guest/login/alumni-visitor",
        "/guest/login/alumniVisitor",
        "/guest/alumni-visitor/login",
        "/participant/login/alumni-visitor",
        "/participant/login/alumniVisitor",
        "/auth/participant/login/alumni-visitor",
    ],
    loginGuest: [
        "/guest/login/guest",
        "/guest/guest/login",
        "/participant/login/guest",
        "/auth/participant/login/guest",
    ],
} as const

function defaultDashboardPath(role: StaffRole) {
    return role === "ADMIN" ? "/admin/dashboard" : "/staff/dashboard"
}

function defaultParticipantPath(role: ParticipantRole) {
    return role === "STUDENT" ? "/student/home" : "/alumni/home"
}

function normalizeParticipantRole(raw: unknown): ParticipantRole | null {
    const value = String(raw ?? "")
        .trim()
        .toUpperCase()
    if (value === "STUDENT") return "STUDENT"
    if (value === "ALUMNI_VISITOR" || value === "ALUMNI-VISITOR")
        return "ALUMNI_VISITOR"
    if (value === "GUEST" || value === "VISITOR") return "GUEST"
    return null
}

function toStaffRole(raw: unknown): StaffRole | null {
    return isUserRole(raw) ? raw : null
}

function isAuthOrResetPath(pathname: string) {
    return (
        pathname === "/login" ||
        pathname === "/authentication/login" ||
        pathname === "/loading" ||
        pathname === "/forgot-password" ||
        pathname === "/authentication/forgot-password" ||
        pathname.startsWith("/reset-password") ||
        pathname.startsWith("/authentication/reset-password")
    )
}

function isParticipantPath(pathname: string) {
    return pathname.startsWith("/student") || pathname.startsWith("/alumni")
}

/**
 * Prevent redirect loops / wrong-role redirects.
 * Important: staff/admin should never be redirected to participant-only routes.
 */
function canRedirectTo(pathname: string | undefined, role: StaffRole) {
    if (!pathname || typeof pathname !== "string") return false
    if (isAuthOrResetPath(pathname)) return false
    if (isParticipantPath(pathname)) return false

    if (pathname.startsWith("/admin")) return role === "ADMIN"
    if (pathname.startsWith("/staff")) return role === "STAFF"

    return true
}

function canRedirectParticipantTo(
    pathname: string | undefined,
    role: ParticipantRole
) {
    if (!pathname || typeof pathname !== "string") return false
    if (isAuthOrResetPath(pathname)) return false
    if (pathname.startsWith("/admin") || pathname.startsWith("/staff"))
        return false

    if (pathname.startsWith("/student")) return role === "STUDENT"
    if (pathname.startsWith("/alumni")) return role !== "STUDENT"

    return true
}

function normalizePin(value: string) {
    return value.replace(/\D+/g, "").slice(0, 4)
}

function isFourDigitPin(pin: string) {
    return /^\d{4}$/.test(pin)
}

function looksLikeEmail(value: string) {
    const v = value.trim()
    if (!v) return false
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function looksLikePhone(value: string) {
    const v = value.trim()
    if (!v) return false
    const digits = v.replace(/\D+/g, "")
    return digits.length >= 10
}

function normalizeText(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined
    const clean = value.trim()
    return clean || undefined
}

function uniqueApiPaths(paths: readonly string[]) {
    return Array.from(
        new Set(
            paths.map((path) => toApiPath(path)).filter(Boolean)
        )
    )
}

function shouldTryNextApiPath(error: unknown) {
    return error instanceof ApiError && (error.status === 404 || error.status === 405)
}

async function requestWithFallback<T>(
    paths: readonly string[],
    execute: (path: string) => Promise<T>
): Promise<T> {
    const candidates = uniqueApiPaths(paths)

    if (!candidates.length) {
        throw new Error("No API paths are configured for this request.")
    }

    let lastError: unknown = null

    for (const path of candidates) {
        try {
            return await execute(path)
        } catch (error) {
            lastError = error

            if (shouldTryNextApiPath(error)) {
                continue
            }

            throw error
        }
    }

    if (lastError instanceof Error) {
        throw lastError
    }

    throw new Error("No matching API endpoint was found.")
}

function extractParticipantToken(
    payload: ParticipantSessionResponse | null | undefined
) {
    const candidates = [
        payload?.token,
        payload?.accessToken,
        payload?.sessionToken,
        payload?.session?.token,
        payload?.session?.accessToken,
        payload?.session?.sessionToken,
    ]

    for (const value of candidates) {
        const token = normalizeText(value)
        if (token) return token
    }

    return null
}

function extractParticipant(
    payload: ParticipantSessionResponse | null | undefined
): ParticipantRecord | null {
    const candidates = [
        payload?.participant,
        payload?.user,
        payload?.session?.participant,
        payload?.session?.user,
    ]

    for (const value of candidates) {
        if (value && typeof value === "object") {
            return value as ParticipantRecord
        }
    }

    return null
}

function toStoredParticipantUser(
    participant: ParticipantRecord | null | undefined
): StoredParticipantUser | undefined {
    if (!participant) return undefined

    return {
        ...(normalizeText(participant.id)
            ? { id: normalizeText(participant.id) }
            : {}),
        ...(normalizeText(participant._id)
            ? { _id: normalizeText(participant._id) }
            : {}),
        ...(normalizeText(participant.type)
            ? { type: normalizeText(participant.type) }
            : {}),
        ...(normalizeText(participant.name)
            ? { name: normalizeText(participant.name) }
            : {}),
        ...(normalizeText(participant.firstName)
            ? { firstName: normalizeText(participant.firstName) }
            : {}),
        ...(normalizeText(participant.middleName)
            ? { middleName: normalizeText(participant.middleName) }
            : {}),
        ...(normalizeText(participant.lastName)
            ? { lastName: normalizeText(participant.lastName) }
            : {}),
        ...(normalizeText(participant.tcNumber)
            ? { tcNumber: normalizeText(participant.tcNumber) }
            : {}),
        ...(normalizeText(participant.studentId)
            ? { studentId: normalizeText(participant.studentId) }
            : {}),
        ...(normalizeText(participant.mobileNumber)
            ? { mobileNumber: normalizeText(participant.mobileNumber) }
            : {}),
        ...(normalizeText(participant.phone)
            ? { phone: normalizeText(participant.phone) }
            : {}),
        ...(normalizeText(participant.departmentId)
            ? { departmentId: normalizeText(participant.departmentId) }
            : {}),
        ...(normalizeText(participant.departmentCode)
            ? { departmentCode: normalizeText(participant.departmentCode) }
            : {}),
    }
}

async function loginParticipant(
    paths: readonly string[],
    payload: ParticipantLoginPayload,
    rememberMe: boolean
) {
    const response = await requestWithFallback(paths, (path) =>
        api.postData<ParticipantSessionResponse>(path, payload, { auth: false })
    )

    const token = extractParticipantToken(response)
    if (!token) {
        throw new Error(
            "Participant login succeeded but no session token was returned."
        )
    }

    const participant = extractParticipant(response)
    setParticipantSession(
        token,
        toStoredParticipantUser(participant),
        rememberMe
    )

    return response
}

const participantAuthApi = {
    getSession() {
        return requestWithFallback(PARTICIPANT_AUTH_API_PATHS.session, (path) =>
            api.getData<ParticipantSessionResponse>(path, {
                auth: "participant",
            })
        )
    },
    loginStudent(payload: ParticipantLoginPayload, rememberMe = true) {
        return loginParticipant(
            PARTICIPANT_AUTH_API_PATHS.loginStudent,
            payload,
            rememberMe
        )
    },
    loginAlumniVisitor(payload: ParticipantLoginPayload, rememberMe = true) {
        return loginParticipant(
            PARTICIPANT_AUTH_API_PATHS.loginAlumniVisitor,
            payload,
            rememberMe
        )
    },
    loginGuest(payload: ParticipantLoginPayload, rememberMe = true) {
        return loginParticipant(
            PARTICIPANT_AUTH_API_PATHS.loginGuest,
            payload,
            rememberMe
        )
    },
}

async function resolveParticipantRole(
    fallback: ParticipantRole
): Promise<ParticipantRole> {
    try {
        const session = await participantAuthApi.getSession()
        return normalizeParticipantRole(extractParticipant(session)?.type) ?? fallback
    } catch {
        return fallback
    }
}

export default function LoginPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const { login, user, loading } = useSession()

    const [identifier, setIdentifier] = React.useState("")
    const [secret, setSecret] = React.useState("")
    const [rememberMe, setRememberMe] = React.useState(true)

    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [showSecret, setShowSecret] = React.useState(false)

    // ✅ Always auto-detect:
    // Email => Staff/Admin (password)
    // Otherwise => Participant (PIN)
    const isStaffMode = looksLikeEmail(identifier)

    // ✅ If there's an active session, redirect away from /login automatically.
    React.useEffect(() => {
        if (loading) return

        if (user) {
            const role = user.role
            const home = defaultDashboardPath(role)
            const state = location.state as LocationState | null
            const fromPath = state?.from?.pathname

            if (canRedirectTo(fromPath, role)) {
                navigate(fromPath!, { replace: true })
                return
            }

            navigate(home, { replace: true })
            return
        }

        const participantToken = getParticipantToken()
        if (!participantToken) return

        let alive = true

        ;(async () => {
            try {
                const session = await participantAuthApi.getSession()
                if (!alive) return

                const role = normalizeParticipantRole(extractParticipant(session)?.type)
                if (!role) {
                    clearParticipantSession()
                    return
                }

                const state = location.state as LocationState | null
                const fromPath = state?.from?.pathname

                if (canRedirectParticipantTo(fromPath, role)) {
                    navigate(fromPath!, { replace: true })
                    return
                }

                navigate(defaultParticipantPath(role), { replace: true })
            } catch {
                if (!alive) return
                clearParticipantSession()
            }
        })()

        return () => {
            alive = false
        }
    }, [loading, user, location.state, navigate])

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (isSubmitting) return

        const cleanId = identifier.trim()
        if (!cleanId || !secret) {
            toast.error("Please enter your login details.")
            return
        }

        setIsSubmitting(true)

        try {
            if (isStaffMode) {
                if (!looksLikeEmail(cleanId)) {
                    toast.error("Please enter a valid email for Staff/Admin sign in.")
                    return
                }

                const res = await login(cleanId, secret, rememberMe)

                clearParticipantSession()

                toast.success("Signed in successfully")

                const role = toStaffRole(res.user.role)
                if (!role) {
                    throw new Error("Login response did not include a valid staff role.")
                }

                const home = defaultDashboardPath(role)

                const state = location.state as LocationState | null
                const fromPath = state?.from?.pathname

                if (canRedirectTo(fromPath, role)) {
                    navigate(fromPath!, { replace: true })
                    return
                }

                navigate(home, { replace: true })
                return
            }

            const pin = normalizePin(secret)
            if (!isFourDigitPin(pin)) {
                toast.error("PIN must be exactly 4 digits.")
                return
            }

            try {
                await participantAuthApi.loginStudent(
                    {
                        tcNumber: cleanId,
                        studentId: cleanId,
                        pin,
                        password: pin,
                    },
                    rememberMe
                )
            } catch (err) {
                if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
                    try {
                        await participantAuthApi.loginAlumniVisitor(
                            {
                                mobileNumber: cleanId,
                                pin,
                                phone: cleanId,
                                password: pin,
                            },
                            rememberMe
                        )
                    } catch (err2) {
                        if (
                            err2 instanceof ApiError &&
                            (err2.status === 401 || err2.status === 404)
                        ) {
                            await participantAuthApi.loginGuest(
                                {
                                    mobileNumber: cleanId,
                                    pin,
                                    phone: cleanId,
                                    password: pin,
                                },
                                rememberMe
                            )
                        } else {
                            throw err2
                        }
                    }
                } else {
                    throw err
                }
            }

            clearAuthSession()

            const fallbackRole: ParticipantRole = looksLikePhone(cleanId)
                ? "ALUMNI_VISITOR"
                : "STUDENT"
            const participantRole = await resolveParticipantRole(fallbackRole)

            toast.success("Signed in successfully")

            const state = location.state as LocationState | null
            const fromPath = state?.from?.pathname

            if (canRedirectParticipantTo(fromPath, participantRole)) {
                navigate(fromPath!, { replace: true })
                return
            }

            navigate(defaultParticipantPath(participantRole), { replace: true })
        } catch (err) {
            const message =
                err instanceof ApiError
                    ? err.message
                    : err instanceof Error
                      ? err.message
                      : "Sign in failed"
            toast.error(message)
        } finally {
            setIsSubmitting(false)
        }
    }

    if (loading) return <LoadingPage />

    return (
        <div className="grid min-h-svh lg:grid-cols-2">
            <div className="flex flex-col gap-6 p-6 md:p-10">
                <div className="flex items-center justify-center md:justify-start">
                    <Link to="/" className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-card">
                            <img src={logo} alt="QueuePass logo" className="h-10 w-10" />
                        </div>
                        <div className="leading-tight">
                            <div className="text-sm font-semibold">QueuePass</div>
                            <div className="text-muted-foreground text-xs">
                                Ticketless QR Queue
                            </div>
                        </div>
                    </Link>
                </div>

                <div className="flex flex-1 items-center justify-center">
                    <div className="w-full max-w-sm">
                        <Card>
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-2xl">Sign in</CardTitle>
                            </CardHeader>

                            <CardContent>
                                <form onSubmit={onSubmit} className="space-y-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="identifier">
                                            {isStaffMode
                                                ? "Email"
                                                : "Email / TC Number / Mobile number"}
                                        </Label>
                                        <Input
                                            id="identifier"
                                            placeholder="name@example.com or TC-2024-12345 or +63 9XX XXX XXXX"
                                            autoComplete="username"
                                            required
                                            disabled={isSubmitting}
                                            value={identifier}
                                            onChange={(e) => setIdentifier(e.target.value)}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="secret">
                                                {isStaffMode
                                                    ? "Password"
                                                    : "PIN (4 digits)"}
                                            </Label>

                                            {isStaffMode ? (
                                                <Link
                                                    to="/forgot-password"
                                                    className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
                                                >
                                                    Forgot password?
                                                </Link>
                                            ) : null}
                                        </div>

                                        <div className="relative">
                                            <Input
                                                id="secret"
                                                type={showSecret ? "text" : "password"}
                                                autoComplete="current-password"
                                                required
                                                disabled={isSubmitting}
                                                className="pr-10"
                                                value={
                                                    isStaffMode
                                                        ? secret
                                                        : normalizePin(secret)
                                                }
                                                onChange={(e) =>
                                                    setSecret(e.target.value)
                                                }
                                                inputMode={
                                                    isStaffMode ? undefined : "numeric"
                                                }
                                                maxLength={
                                                    isStaffMode ? undefined : 4
                                                }
                                                pattern={
                                                    isStaffMode
                                                        ? undefined
                                                        : "\\d{4}"
                                                }
                                                placeholder={
                                                    isStaffMode
                                                        ? "Your password"
                                                        : "4-digit PIN"
                                                }
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                disabled={isSubmitting}
                                                onClick={() =>
                                                    setShowSecret((s) => !s)
                                                }
                                                aria-label={
                                                    showSecret ? "Hide" : "Show"
                                                }
                                                className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                                            >
                                                {showSecret ? (
                                                    <EyeOff className="h-4 w-4" />
                                                ) : (
                                                    <Eye className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="remember"
                                                checked={rememberMe}
                                                onCheckedChange={(v) =>
                                                    setRememberMe(v === true)
                                                }
                                                disabled={isSubmitting}
                                            />
                                            <Label
                                                htmlFor="remember"
                                                className="text-sm font-normal"
                                            >
                                                Keep me signed in
                                            </Label>
                                        </div>

                                        <span className="text-muted-foreground text-xs">
                                            {rememberMe
                                                ? "Recommended on personal devices"
                                                : ""}
                                        </span>
                                    </div>

                                    <Button
                                        className="w-full"
                                        type="submit"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? "Signing in..." : "Sign in"}
                                    </Button>
                                </form>
                            </CardContent>

                            <CardFooter className="flex flex-col gap-3">
                                <p className="text-muted-foreground text-center text-sm">
                                    Don&apos;t have an account?{" "}
                                    <Link
                                        to="/authentication/register"
                                        className="text-foreground underline-offset-4 hover:underline"
                                    >
                                        Create one
                                    </Link>
                                </p>
                            </CardFooter>
                        </Card>
                    </div>
                </div>
            </div>

            <div className="bg-muted relative hidden lg:block">
                <div className="absolute inset-0 bg-linear-to-br from-primary/15 via-background to-muted" />
                <div className="relative flex h-svh flex-col items-center justify-center p-10">
                    <div className="w-full max-w-lg">
                        <Card className="overflow-hidden border-border/60 bg-background/70 backdrop-blur">
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-xl">
                                    Manage queues with ease
                                </CardTitle>
                                <CardDescription>
                                    QR-based entry, SMS updates, voice announcements,
                                    and a public display—built for student-facing
                                    offices.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-xl border bg-card p-4">
                                    <img
                                        src={heroImage}
                                        alt="QueuePass hero illustration"
                                        className="max-h-102.75 w-full rounded-lg object-contain"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}