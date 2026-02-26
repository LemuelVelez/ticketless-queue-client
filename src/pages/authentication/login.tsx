import * as React from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

import LoadingPage from "@/pages/loading"

import { guestApi, participantAuthStorage } from "@/api/guest"
import { useSession } from "@/hooks/use-session"
import { ApiError } from "@/lib/http"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
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

function defaultDashboardPath(role: "ADMIN" | "STAFF") {
    return role === "ADMIN" ? "/admin/dashboard" : "/staff/dashboard"
}

function defaultParticipantPath(role: ParticipantRole) {
    return role === "STUDENT" ? "/student/home" : "/alumni/home"
}

function normalizeParticipantRole(raw: unknown): ParticipantRole | null {
    const value = String(raw ?? "").trim().toUpperCase()
    if (value === "STUDENT") return "STUDENT"
    if (value === "ALUMNI_VISITOR" || value === "ALUMNI-VISITOR") return "ALUMNI_VISITOR"
    if (value === "GUEST" || value === "VISITOR") return "GUEST"
    return null
}

function isAuthOrResetPath(pathname: string) {
    return (
        pathname === "/login" ||
        pathname === "/loading" ||
        pathname === "/forgot-password" ||
        pathname.startsWith("/reset-password")
    )
}

function isParticipantPath(pathname: string) {
    return pathname.startsWith("/student") || pathname.startsWith("/alumni")
}

/**
 * Prevent redirect loops / wrong-role redirects.
 * Important: staff/admin should never be redirected to participant-only routes.
 */
function canRedirectTo(pathname: string | undefined, role: "ADMIN" | "STAFF") {
    if (!pathname || typeof pathname !== "string") return false
    if (isAuthOrResetPath(pathname)) return false
    if (isParticipantPath(pathname)) return false

    if (pathname.startsWith("/admin")) return role === "ADMIN"
    if (pathname.startsWith("/staff")) return role === "STAFF"

    return true
}

function canRedirectParticipantTo(pathname: string | undefined, role: ParticipantRole) {
    if (!pathname || typeof pathname !== "string") return false
    if (isAuthOrResetPath(pathname)) return false
    if (pathname.startsWith("/admin") || pathname.startsWith("/staff")) return false

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

async function resolveParticipantRole(fallback: ParticipantRole): Promise<ParticipantRole> {
    try {
        const session = await guestApi.getSession()
        return normalizeParticipantRole(session?.participant?.type) ?? fallback
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

        const participantToken = participantAuthStorage.getToken()
        if (!participantToken) return

        let alive = true

        ;(async () => {
            try {
                const session = await guestApi.getSession()
                if (!alive) return

                const role = normalizeParticipantRole(session?.participant?.type)
                if (!role) {
                    participantAuthStorage.clearToken()
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

        const cleanId = identifier.trim()
        if (!cleanId || !secret) {
            toast.error("Please enter your login details.")
            return
        }

        setIsSubmitting(true)

        try {
            if (isStaffMode) {
                // ✅ Staff/Admin must use EMAIL + PASSWORD
                if (!looksLikeEmail(cleanId)) {
                    toast.error("Please enter a valid email for Staff/Admin sign in.")
                    return
                }

                const res = await login(cleanId, secret, rememberMe)

                // Avoid mixed-role sessions
                participantAuthStorage.clearToken()

                toast.success("Signed in successfully")

                const role = res.user.role
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

            // ✅ Participant (Student / Alumni / Visitor) uses PIN
            const pin = normalizePin(secret)
            if (!isFourDigitPin(pin)) {
                toast.error("PIN must be exactly 4 digits.")
                return
            }

            // Try student first, then alumni/visitor, then legacy guest (older accounts)
            try {
                await guestApi.loginStudent({
                    tcNumber: cleanId,
                    pin,
                    studentId: cleanId,
                    password: pin,
                })
            } catch (err) {
                if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
                    try {
                        await guestApi.loginAlumniVisitor({
                            mobileNumber: cleanId,
                            pin,
                            phone: cleanId,
                            password: pin,
                        })
                    } catch (err2) {
                        if (err2 instanceof ApiError && (err2.status === 401 || err2.status === 404)) {
                            await guestApi.loginGuest({
                                mobileNumber: cleanId,
                                pin,
                                phone: cleanId,
                                password: pin,
                            })
                        } else {
                            throw err2
                        }
                    }
                } else {
                    throw err
                }
            }

            const fallbackRole: ParticipantRole = looksLikePhone(cleanId) ? "ALUMNI_VISITOR" : "STUDENT"
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
                            </CardHeader>

                            <CardContent>
                                <form onSubmit={onSubmit} className="space-y-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="identifier">
                                            {isStaffMode ? "Email" : "Email / TC Number / Mobile number"}
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
                                            <Label htmlFor="secret">{isStaffMode ? "Password" : "PIN (4 digits)"}</Label>

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
                                                value={isStaffMode ? secret : normalizePin(secret)}
                                                onChange={(e) => setSecret(e.target.value)}
                                                inputMode={isStaffMode ? undefined : "numeric"}
                                                maxLength={isStaffMode ? undefined : 4}
                                                pattern={isStaffMode ? undefined : "\\d{4}"}
                                                placeholder={isStaffMode ? "Your password" : "4-digit PIN"}
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                disabled={isSubmitting}
                                                onClick={() => setShowSecret((s) => !s)}
                                                aria-label={showSecret ? "Hide" : "Show"}
                                                className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                                            >
                                                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </div>

                                    {isStaffMode ? (
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    id="remember"
                                                    checked={rememberMe}
                                                    onCheckedChange={(v) => setRememberMe(v === true)}
                                                    disabled={isSubmitting}
                                                />
                                                <Label htmlFor="remember" className="text-sm font-normal">
                                                    Keep me signed in
                                                </Label>
                                            </div>

                                            <span className="text-muted-foreground text-xs">
                                                {rememberMe ? "Recommended on personal devices" : ""}
                                            </span>
                                        </div>
                                    ) : null}

                                    <Button className="w-full" type="submit" disabled={isSubmitting}>
                                        {isSubmitting ? "Signing in..." : "Sign in"}
                                    </Button>
                                </form>
                            </CardContent>

                            <CardFooter className="flex flex-col gap-3">
                                <p className="text-muted-foreground text-center text-sm">
                                    Don&apos;t have an account?{" "}
                                    <Link to="/authentication/register" className="text-foreground underline-offset-4 hover:underline">
                                        Create one
                                    </Link>
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