/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, LogIn, ShieldCheck, Eye, EyeOff } from "lucide-react"

const STUDENT_ID_RE = /^[A-Z]{2}-\d{2}-[A-Z]-\d{5}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function LoginPage() {
    const navigate = useNavigate()
    const { login, isAuthenticated, studentId } = useAuth()
    const [searchParams] = useSearchParams()

    const [identifier, setIdentifier] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)

    const redirect = useMemo(() => searchParams.get("redirect") || "", [searchParams])

    useEffect(() => {
        if (isAuthenticated && studentId) {
            navigate("/student", { replace: true })
        }
    }, [isAuthenticated, studentId, navigate])

    const goBack = () => navigate("/")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!identifier.trim()) return toast.error("Enter your Student ID or Email.")
        if (!password.trim()) return toast.error("Enter your password.")

        const isStudentId = STUDENT_ID_RE.test(identifier.toUpperCase())
        const isEmail = EMAIL_RE.test(identifier)
        if (!isStudentId && !isEmail) {
            toast.error("Enter a valid Student ID (TC-20-A-00123) or Email.")
            return
        }

        setLoading(true)
        try {
            // Simulate auth API call
            await new Promise((r) => setTimeout(r, 1200))

            const normalizedId = isStudentId ? identifier.toUpperCase() : identifier
            // Auth context expects an id and optional queue data (none on sign-in)
            login(normalizedId, null as any)

            toast.success("Welcome back! Redirecting to your dashboard…")
            // Backend will decide final role-based destination; for now, only Student UI exists.
            navigate(redirect || "/student")
        } catch {
            toast.error("Login failed. Please check your credentials and try again.")
        } finally {
            setLoading(false)
        }
    }

    const year = new Date().getFullYear()

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4">
            <div className="max-w-md mx-auto pt-4 mb-6">
                <Button variant="ghost" onClick={goBack} className="mb-4 text-gray-600 hover:text-gray-900 cursor-pointer">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Welcome
                </Button>
                <div className="text-center">
                    <h1 className="text-xl font-bold text-gray-900">JRMSU Authentication</h1>
                    <p className="text-sm text-gray-600">Sign in to continue</p>
                </div>
            </div>

            <div className="flex justify-center">
                <Card className="w-full max-w-md shadow-xl border-0 bg-white/90 backdrop-blur-sm">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl font-bold text-gray-900 flex items-center justify-center gap-2">
                            <ShieldCheck className="h-6 w-6 text-blue-600" />
                            Sign in
                        </CardTitle>
                        <CardDescription className="text-gray-600">
                            Use your credentials to access your dashboard.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="identifier">Student ID or Email</Label>
                                <Input
                                    id="identifier"
                                    type="text"
                                    placeholder="TC-20-A-00123 or you@jrmsu.edu.ph"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    className="text-center font-mono text-base"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                        onClick={() => setShowPassword((v) => !v)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-semibold cursor-pointer"
                                disabled={loading}
                            >
                                {loading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                        Signing in...
                                    </div>
                                ) : (
                                    <>
                                        <LogIn className="h-4 w-4 mr-2" />
                                        Sign in
                                    </>
                                )}
                            </Button>

                            <div className="flex items-center justify-between text-sm">
                                <Link to="/forgot-password" className="text-blue-600 hover:underline">
                                    Forgot password?
                                </Link>
                                <span className="text-gray-400">•</span>
                                <Link to="/register" className="text-blue-600 hover:underline">
                                    Create account
                                </Link>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>

            <div className="text-center mt-8 text-xs text-gray-500">
                <p>© {year} Jose Rizal Memorial State University</p>
                <p>Ticketless Queue Management System</p>
            </div>
        </div>
    )
}
