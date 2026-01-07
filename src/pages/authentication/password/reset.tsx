import * as React from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

import { authApi } from "@/api/auth"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import logo from "@/assets/images/logo.svg"
import heroImage from "@/assets/images/heroImage.svg"

type Params = { token?: string }

export default function ResetPasswordPage() {
    const navigate = useNavigate()
    const params = useParams<Params>()
    const [searchParams] = useSearchParams()

    // Supports:
    // /reset-password/:token
    // /reset-password?token=...
    const token = (params.token ?? searchParams.get("token") ?? "").trim()

    const [password, setPassword] = React.useState("")
    const [confirmPassword, setConfirmPassword] = React.useState("")
    const [showPassword, setShowPassword] = React.useState(false)
    const [showConfirm, setShowConfirm] = React.useState(false)
    const [isSubmitting, setIsSubmitting] = React.useState(false)

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (isSubmitting) return

        if (!token) {
            toast.error("Reset token is missing. Please request a new reset link.")
            return
        }

        if (!password || !confirmPassword) {
            toast.error("Please enter and confirm your new password.")
            return
        }

        if (password.length < 8) {
            toast.error("Password must be at least 8 characters.")
            return
        }

        if (password !== confirmPassword) {
            toast.error("Passwords do not match.")
            return
        }

        setIsSubmitting(true)
        try {
            await authApi.resetPassword(token, password)
            toast.success("Password updated successfully. You can now sign in.")
            navigate("/login", { replace: true })
        } catch (err) {
            const message =
                err instanceof ApiError
                    ? err.message
                    : err instanceof Error
                        ? err.message
                        : "Reset failed"
            toast.error(message)
        } finally {
            setIsSubmitting(false)
        }
    }

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
                                <CardTitle className="text-2xl">Reset password</CardTitle>
                                <CardDescription>Set a new password for your account.</CardDescription>
                            </CardHeader>

                            <CardContent>
                                {!token ? (
                                    <div className="space-y-3">
                                        <p className="text-muted-foreground text-sm">
                                            Your reset link is missing or invalid.
                                        </p>
                                        <Button asChild className="w-full">
                                            <Link to="/forgot-password">Request a new reset link</Link>
                                        </Button>
                                    </div>
                                ) : (
                                    <form onSubmit={onSubmit} className="space-y-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="password">New password</Label>
                                            <div className="relative">
                                                <Input
                                                    id="password"
                                                    type={showPassword ? "text" : "password"}
                                                    autoComplete="new-password"
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
                                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                            <p className="text-muted-foreground text-xs">Use at least 8 characters.</p>
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="confirmPassword">Confirm new password</Label>
                                            <div className="relative">
                                                <Input
                                                    id="confirmPassword"
                                                    type={showConfirm ? "text" : "password"}
                                                    autoComplete="new-password"
                                                    required
                                                    disabled={isSubmitting}
                                                    className="pr-10"
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    disabled={isSubmitting}
                                                    onClick={() => setShowConfirm((s) => !s)}
                                                    aria-label={showConfirm ? "Hide password" : "Show password"}
                                                    className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                                                >
                                                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        </div>

                                        <Button className="w-full" type="submit" disabled={isSubmitting}>
                                            {isSubmitting ? "Updating..." : "Update password"}
                                        </Button>
                                    </form>
                                )}
                            </CardContent>

                            <CardFooter className="flex flex-col gap-2">
                                <p className="text-muted-foreground text-center text-sm">
                                    <Link to="/login" className="text-foreground underline-offset-4 hover:underline">
                                        Back to sign in
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
                                <CardTitle className="text-xl">Get back in quickly</CardTitle>
                                <CardDescription>
                                    Choose a strong password to keep your QueuePass account protected.
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
