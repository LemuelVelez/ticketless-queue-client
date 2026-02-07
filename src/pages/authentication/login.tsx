import * as React from "react"
import * as Tabs from "@radix-ui/react-tabs"
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

type AuthTab = "staff" | "participant"
type ParticipantTab = "student" | "alumniVisitor"
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

/**
 * Prevent redirect loops / wrong-role redirects.
 * Example: a STAFF user trying to access /admin/* should NOT be redirected back there after login.
 */
function canRedirectTo(pathname: string | undefined, role: "ADMIN" | "STAFF") {
    if (!pathname || typeof pathname !== "string") return false

    // Never redirect back to auth/loading routes
    if (
        pathname === "/login" ||
        pathname === "/loading" ||
        pathname === "/forgot-password" ||
        pathname.startsWith("/reset-password")
    ) {
        return false
    }

    // Role-based protection
    if (pathname.startsWith("/admin")) return role === "ADMIN"
    if (pathname.startsWith("/staff")) return role === "STAFF"

    // Public routes (e.g. /display) are OK
    return true
}

function canRedirectParticipantTo(pathname: string | undefined, role: ParticipantRole) {
    if (!pathname || typeof pathname !== "string") return false

    // Never redirect back to auth/loading routes
    if (
        pathname === "/login" ||
        pathname === "/loading" ||
        pathname === "/forgot-password" ||
        pathname.startsWith("/reset-password")
    ) {
        return false
    }

    // Participant cannot go to staff/admin routes
    if (pathname.startsWith("/admin") || pathname.startsWith("/staff")) return false

    // Participant route restrictions
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

    const [authTab, setAuthTab] = React.useState<AuthTab>("staff")
    const [participantTab, setParticipantTab] = React.useState<ParticipantTab>("student")

    // Staff/Admin fields
    const [email, setEmail] = React.useState("")
    const [password, setPassword] = React.useState("")
    const [rememberMe, setRememberMe] = React.useState(true)

    // Participant fields
    const [tcNumber, setTcNumber] = React.useState("")
    const [mobileNumber, setMobileNumber] = React.useState("")
    const [participantPin, setParticipantPin] = React.useState("")

    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [showPassword, setShowPassword] = React.useState(false)

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

            ; (async () => {
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

    async function onSubmitStaff(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (isSubmitting) return

        const cleanEmail = email.trim()
        if (!cleanEmail || !password) {
            toast.error("Please enter your email and password.")
            return
        }

        setIsSubmitting(true)

        try {
            const res = await login(cleanEmail, password, rememberMe)
            toast.success("Signed in successfully")

            const role = res.user.role
            const home = defaultDashboardPath(role)

            // If RoleGuard redirected here, it may set state.from
            const state = location.state as LocationState | null
            const fromPath = state?.from?.pathname

            // ✅ Only redirect back if it matches the user's role
            if (canRedirectTo(fromPath, role)) {
                navigate(fromPath!, { replace: true })
                return
            }

            navigate(home, { replace: true })
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

    async function onSubmitParticipant(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (isSubmitting) return

        const pin = participantPin.trim()

        if (!isFourDigitPin(pin)) {
            toast.error("PIN must be exactly 4 digits.")
            return
        }

        setIsSubmitting(true)

        try {
            if (participantTab === "student") {
                const cleanTc = tcNumber.trim()

                if (!cleanTc) {
                    toast.error("Please enter your TC Number.")
                    return
                }

                await guestApi.loginStudent({
                    tcNumber: cleanTc,
                    pin,
                    // aliases for compatibility
                    studentId: cleanTc,
                    password: pin,
                })
            } else {
                const cleanMobile = mobileNumber.trim()

                if (!cleanMobile) {
                    toast.error("Please enter your mobile number.")
                    return
                }

                await guestApi.loginGuest({
                    mobileNumber: cleanMobile,
                    pin,
                    // aliases for compatibility
                    phone: cleanMobile,
                    password: pin,
                })
            }

            const fallbackRole: ParticipantRole =
                participantTab === "student" ? "STUDENT" : "ALUMNI_VISITOR"

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
                                    Students and visitors must login first before joining queue.
                                </CardDescription>
                            </CardHeader>

                            <CardContent>
                                <Tabs.Root value={authTab} onValueChange={(v) => setAuthTab(v as AuthTab)} className="w-full">
                                    <Tabs.List className="bg-muted grid h-10 w-full grid-cols-2 rounded-lg p-1">
                                        <Tabs.Trigger
                                            value="staff"
                                            className="inline-flex items-center justify-center rounded-md px-3 text-sm font-medium transition data-[state=active]:bg-background data-[state=active]:shadow-sm"
                                        >
                                            Staff / Admin
                                        </Tabs.Trigger>
                                        <Tabs.Trigger
                                            value="participant"
                                            className="inline-flex items-center justify-center rounded-md px-3 text-sm font-medium transition data-[state=active]:bg-background data-[state=active]:shadow-sm"
                                        >
                                            Student / Visitor
                                        </Tabs.Trigger>
                                    </Tabs.List>

                                    <Tabs.Content value="staff" className="mt-4 outline-none">
                                        <form onSubmit={onSubmitStaff} className="space-y-4">
                                            <div className="grid gap-2">
                                                <Label htmlFor="email">Email</Label>
                                                <Input
                                                    id="email"
                                                    type="email"
                                                    placeholder="name@example.com"
                                                    autoComplete="email"
                                                    required
                                                    disabled={isSubmitting}
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <div className="flex items-center justify-between">
                                                    <Label htmlFor="password">Password</Label>
                                                    <Link
                                                        to="/forgot-password"
                                                        className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
                                                    >
                                                        Forgot password?
                                                    </Link>
                                                </div>

                                                <div className="relative">
                                                    <Input
                                                        id="password"
                                                        type={showPassword ? "text" : "password"}
                                                        autoComplete="current-password"
                                                        required
                                                        disabled={isSubmitting}
                                                        className="pr-10"
                                                        value={password}
                                                        onChange={(e) => setPassword(e.target.value)}
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        disabled={isSubmitting}
                                                        onClick={() => setShowPassword((s) => !s)}
                                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                                        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                                                    >
                                                        {showPassword ? (
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
                                                        onCheckedChange={(v) => setRememberMe(v === true)}
                                                        disabled={isSubmitting}
                                                    />
                                                    <Label htmlFor="remember" className="text-sm font-normal">
                                                        Remember me
                                                    </Label>
                                                </div>

                                                <span className="text-muted-foreground text-xs">
                                                    {rememberMe ? "Keeps you signed in" : ""}
                                                </span>
                                            </div>

                                            <Button className="w-full" type="submit" disabled={isSubmitting}>
                                                {isSubmitting ? "Signing in..." : "Sign in"}
                                            </Button>
                                        </form>
                                    </Tabs.Content>

                                    <Tabs.Content value="participant" className="mt-4 outline-none">
                                        <Tabs.Root
                                            value={participantTab}
                                            onValueChange={(v) => setParticipantTab(v as ParticipantTab)}
                                            className="w-full"
                                        >
                                            <Tabs.List className="bg-muted grid h-10 w-full grid-cols-2 rounded-lg p-1">
                                                <Tabs.Trigger
                                                    value="student"
                                                    className="inline-flex items-center justify-center rounded-md px-3 text-sm font-medium transition data-[state=active]:bg-background data-[state=active]:shadow-sm"
                                                >
                                                    Student
                                                </Tabs.Trigger>
                                                <Tabs.Trigger
                                                    value="alumniVisitor"
                                                    className="inline-flex items-center justify-center rounded-md px-3 text-sm font-medium transition data-[state=active]:bg-background data-[state=active]:shadow-sm"
                                                >
                                                    Alumni / Visitor
                                                </Tabs.Trigger>
                                            </Tabs.List>

                                            <form onSubmit={onSubmitParticipant} className="mt-4 space-y-4">
                                                {participantTab === "student" ? (
                                                    <div className="grid gap-2">
                                                        <Label htmlFor="tcNumber">TC Number</Label>
                                                        <Input
                                                            id="tcNumber"
                                                            placeholder="e.g. TC-2024-12345"
                                                            autoComplete="username"
                                                            required
                                                            disabled={isSubmitting}
                                                            value={tcNumber}
                                                            onChange={(e) => setTcNumber(e.target.value)}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="grid gap-2">
                                                        <Label htmlFor="mobileNumber">Mobile number</Label>
                                                        <Input
                                                            id="mobileNumber"
                                                            type="tel"
                                                            placeholder="+63 9XX XXX XXXX"
                                                            autoComplete="username"
                                                            required
                                                            disabled={isSubmitting}
                                                            value={mobileNumber}
                                                            onChange={(e) => setMobileNumber(e.target.value)}
                                                        />
                                                    </div>
                                                )}

                                                <div className="grid gap-2">
                                                    <Label htmlFor="participantPin">PIN (4 digits)</Label>
                                                    <div className="relative">
                                                        <Input
                                                            id="participantPin"
                                                            type={showPassword ? "text" : "password"}
                                                            autoComplete="current-password"
                                                            required
                                                            disabled={isSubmitting}
                                                            className="pr-10"
                                                            value={participantPin}
                                                            onChange={(e) => setParticipantPin(normalizePin(e.target.value))}
                                                            inputMode="numeric"
                                                            maxLength={4}
                                                            pattern="\d{4}"
                                                            placeholder="4-digit PIN"
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            disabled={isSubmitting}
                                                            onClick={() => setShowPassword((s) => !s)}
                                                            aria-label={showPassword ? "Hide PIN" : "Show PIN"}
                                                            className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                                                        >
                                                            {showPassword ? (
                                                                <EyeOff className="h-4 w-4" />
                                                            ) : (
                                                                <Eye className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>

                                                <Button className="w-full" type="submit" disabled={isSubmitting}>
                                                    {isSubmitting
                                                        ? "Signing in..."
                                                        : participantTab === "student"
                                                            ? "Sign in as student"
                                                            : "Sign in as alumni/visitor"}
                                                </Button>
                                            </form>
                                        </Tabs.Root>
                                    </Tabs.Content>
                                </Tabs.Root>
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
