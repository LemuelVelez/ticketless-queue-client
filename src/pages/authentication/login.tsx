import * as React from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

import LoadingPage from "@/pages/loading"

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

function defaultDashboardPath(role: "ADMIN" | "STAFF") {
    return role === "ADMIN" ? "/admin/dashboard" : "/staff/dashboard"
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

export default function LoginPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const { login, user, loading } = useSession()

    const [email, setEmail] = React.useState("")
    const [password, setPassword] = React.useState("")
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [rememberMe, setRememberMe] = React.useState(true)
    const [showPassword, setShowPassword] = React.useState(false)

    // ✅ If there's an active session, redirect away from /login automatically.
    React.useEffect(() => {
        if (loading) return
        if (!user) return

        const role = user.role
        const home = defaultDashboardPath(role)
        const state = location.state as LocationState | null
        const fromPath = state?.from?.pathname

        if (canRedirectTo(fromPath, role)) {
            navigate(fromPath!, { replace: true })
            return
        }

        navigate(home, { replace: true })
    }, [loading, user, location.state, navigate])

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
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
                                    Welcome back. Enter your details to continue.
                                </CardDescription>
                            </CardHeader>

                            <CardContent>
                                <form onSubmit={onSubmit} className="space-y-4">
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
                            </CardContent>

                            <CardFooter className="flex flex-col gap-3">
                                <p className="text-muted-foreground text-center text-sm">
                                    Don&apos;t have an account?{" "}
                                    <Link
                                        to="/signup"
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
