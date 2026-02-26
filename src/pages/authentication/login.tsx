import * as React from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

import LoadingPage from "@/pages/loading"

import { guestApi, participantAuthStorage } from "@/api/guest"
import { useSession } from "@/hooks/use-session"
import { ApiError } from "@/lib/http"

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

type AppRole = "ADMIN" | "STAFF" | "STUDENT"

function normalizeRole(raw: unknown): AppRole | null {
    const value = String(raw ?? "").trim().toUpperCase()
    if (value === "ADMIN") return "ADMIN"
    if (value === "STAFF") return "STAFF"
    if (value === "STUDENT") return "STUDENT"
    return null
}

function defaultDashboardPath(role: AppRole) {
    if (role === "ADMIN") return "/admin/dashboard"
    if (role === "STAFF") return "/staff/dashboard"
    return "/student/home"
}

function isAuthOrResetPath(pathname: string) {
    return (
        pathname === "/login" ||
        pathname === "/loading" ||
        pathname === "/forgot-password" ||
        pathname.startsWith("/reset-password")
    )
}

/**
 * Prevent redirect loops / wrong-role redirects.
 * Role-based protection for /admin, /staff, /student routes.
 */
function canRedirectTo(pathname: string | undefined, role: AppRole) {
    if (!pathname || typeof pathname !== "string") return false
    if (isAuthOrResetPath(pathname)) return false

    // Role-based areas
    if (pathname.startsWith("/admin")) return role === "ADMIN"
    if (pathname.startsWith("/staff")) return role === "STAFF"
    if (pathname.startsWith("/student")) return role === "STUDENT"

    // Shared/public routes are OK
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
    return v.includes("@") && v.includes(".")
}

async function resolveStudentRoleFromSession(): Promise<AppRole | null> {
    try {
        const session = await guestApi.getSession()
        return normalizeRole(session?.participant?.type)
    } catch {
        return null
    }
}

export default function LoginPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const { login, user, loading } = useSession()

    const [identifier, setIdentifier] = React.useState("") // email (staff/admin) OR tcNumber (student)
    const [secret, setSecret] = React.useState("") // password OR 4-digit PIN

    const [rememberMe, setRememberMe] = React.useState(true)
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [showSecret, setShowSecret] = React.useState(false)

    const isEmailMode = looksLikeEmail(identifier)
    const secretLabel = isEmailMode ? "Password" : "PIN (4 digits)"
    const secretPlaceholder = isEmailMode ? "Enter your password" : "4-digit PIN"
    const identifierLabel = "Email or TC Number"
    const identifierPlaceholder = "name@example.com or TC-2024-12345"

    // ✅ If there's an active session, redirect away from /login automatically.
    React.useEffect(() => {
        if (loading) return

        // Staff/Admin (and possibly Student if your main session supports it)
        if (user) {
            const role = normalizeRole((user as any)?.role) ?? "STAFF"
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

        // Student session (participant token)
        const participantToken = participantAuthStorage.getToken()
        if (!participantToken) return

        let alive = true

        ;(async () => {
            try {
                const role = await resolveStudentRoleFromSession()
                if (!alive) return

                if (role !== "STUDENT") {
                    participantAuthStorage.clearToken()
                    return
                }

                const state = location.state as LocationState | null
                const fromPath = state?.from?.pathname

                if (canRedirectTo(fromPath, "STUDENT")) {
                    navigate(fromPath!, { replace: true })
                    return
                }

                navigate(defaultDashboardPath("STUDENT"), { replace: true })
            } catch {
                if (!alive) return
                participantAuthStorage.clearToken()
            }
        })()

        return () => {
            alive = false
        }
    }, [loading, user, location.state, navigate])

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (isSubmitting) return

        const cleanIdentifier = identifier.trim()
        const cleanSecret = secret.trim()

        if (!cleanIdentifier || !cleanSecret) {
            toast.error("Please enter your login details.")
            return
        }

        setIsSubmitting(true)

        try {
            // Staff/Admin login (email + password)
            if (looksLikeEmail(cleanIdentifier)) {
                const res = await login(cleanIdentifier, cleanSecret, rememberMe)

                // Clear stale student session to avoid mixed-role redirect behavior.
                participantAuthStorage.clearToken()

                toast.success("Signed in successfully")

                const role = normalizeRole((res as any)?.user?.role) ?? "STAFF"
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

            // Student login (TC Number + 4-digit PIN)
            const pin = normalizePin(cleanSecret)
            if (!isFourDigitPin(pin)) {
                toast.error("PIN must be exactly 4 digits.")
                return
            }

            await guestApi.loginStudent({
                tcNumber: cleanIdentifier,
                pin,
                // aliases for compatibility
                studentId: cleanIdentifier,
                password: pin,
            })

            const role = (await resolveStudentRoleFromSession()) ?? "STUDENT"
            if (role !== "STUDENT") {
                participantAuthStorage.clearToken()
                toast.error("Unauthorized role. Please contact the administrator.")
                return
            }

            toast.success("Signed in successfully")

            const state = location.state as LocationState | null
            const fromPath = state?.from?.pathname

            if (canRedirectTo(fromPath, "STUDENT")) {
                navigate(fromPath!, { replace: true })
                return
            }

            navigate(defaultDashboardPath("STUDENT"), { replace: true })
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

    // While resolving an existing token/session, show loading instead of flashing the login form.
    if (loading) return <LoadingPage />

    return (
        <div className="grid min-h-svh lg:grid-cols-2">
            {/* Left: form */}
            <div className="flex flex-col gap-6 p-6 md:p-10">
                <div className="flex items-center justify-center md:justify-start">
                    <Link to="/" className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-card">
                            <img src={logo} alt="QueuePass logo" className="h-10 w-10" />
                        </div>
                        <div className="leading-tight">
                            <div className="text-sm font-semibold">QueuePass</div>
                            <div className="text-muted-foreground text-xs">Ticketless QR Queue</div>
                        </div>
                    </Link>
                </div>

                <div className="flex flex-1 items-center justify-center">
                    <div className="w-full max-w-sm">
                        <Card>
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-2xl">Sign in</CardTitle>
                                <CardDescription>
                                    Use your staff email or your student TC Number to continue.
                                </CardDescription>
                            </CardHeader>

                            <CardContent>
                                <form onSubmit={onSubmit} className="space-y-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="identifier">{identifierLabel}</Label>
                                        <Input
                                            id="identifier"
                                            placeholder={identifierPlaceholder}
                                            autoComplete="username"
                                            required
                                            disabled={isSubmitting}
                                            value={identifier}
                                            onChange={(e) => setIdentifier(e.target.value)}
                                        />
                                        <p className="text-muted-foreground text-xs">
                                            Tip: Email signs you into <span className="font-medium">Staff/Admin</span>.
                                            TC Number signs you into <span className="font-medium">Student</span>.
                                        </p>
                                    </div>

                                    <div className="grid gap-2">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="secret">{secretLabel}</Label>

                                            {isEmailMode ? (
                                                <Link
                                                    to="/forgot-password"
                                                    className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
                                                >
                                                    Forgot password?
                                                </Link>
                                            ) : (
                                                <span className="text-muted-foreground text-sm" />
                                            )}
                                        </div>

                                        <div className="relative">
                                            <Input
                                                id="secret"
                                                type={showSecret ? "text" : "password"}
                                                autoComplete={isEmailMode ? "current-password" : "current-password"}
                                                required
                                                disabled={isSubmitting}
                                                className="pr-10"
                                                value={isEmailMode ? secret : normalizePin(secret)}
                                                onChange={(e) =>
                                                    setSecret(isEmailMode ? e.target.value : normalizePin(e.target.value))
                                                }
                                                inputMode={isEmailMode ? undefined : "numeric"}
                                                maxLength={isEmailMode ? undefined : 4}
                                                pattern={isEmailMode ? undefined : "\\d{4}"}
                                                placeholder={secretPlaceholder}
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                disabled={isSubmitting}
                                                onClick={() => setShowSecret((s) => !s)}
                                                aria-label={showSecret ? "Hide secret" : "Show secret"}
                                                className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                                            >
                                                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Remember me only matters for staff/admin sessions */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="remember"
                                                checked={rememberMe}
                                                onCheckedChange={(v) => setRememberMe(v === true)}
                                                disabled={isSubmitting || !isEmailMode}
                                            />
                                            <Label
                                                htmlFor="remember"
                                                className="text-sm font-normal"
                                            >
                                                Remember me
                                            </Label>
                                        </div>

                                        <span className="text-muted-foreground text-xs">
                                            {isEmailMode && rememberMe ? "Keeps you signed in" : ""}
                                        </span>
                                    </div>

                                    <Button className="w-full" type="submit" disabled={isSubmitting}>
                                        {isSubmitting ? "Signing in..." : "Sign in"}
                                    </Button>
                                </form>
                            </CardContent>

                            <CardFooter className="flex flex-col gap-3">
                                <p className="text-muted-foreground text-center text-sm">
                                    Don&apos;t have a student account?{" "}
                                    <Link
                                        to="/authentication/register"
                                        className="text-foreground underline-offset-4 hover:underline"
                                    >
                                        Create one
                                    </Link>
                                </p>

                                <p className="text-muted-foreground text-balance text-center text-xs">
                                    By continuing, you agree to our{" "}
                                    <Link to="/terms" className="underline-offset-4 hover:underline">
                                        Terms
                                    </Link>{" "}
                                    and{" "}
                                    <Link to="/privacy" className="underline-offset-4 hover:underline">
                                        Privacy Policy
                                    </Link>
                                    .
                                </p>
                            </CardFooter>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Right: illustration */}
            <div className="bg-muted relative hidden lg:block">
                <div className="absolute inset-0 bg-linear-to-br from-primary/15 via-background to-muted" />
                <div className="relative flex h-svh flex-col items-center justify-center p-10">
                    <div className="w-full max-w-lg">
                        <Card className="border-border/60 bg-background/70 overflow-hidden backdrop-blur">
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-xl">Manage queues with ease</CardTitle>
                                <CardDescription>
                                    QR-based entry, SMS updates, voice announcements, and a public display—built
                                    for student-facing offices.
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