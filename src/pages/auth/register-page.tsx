"use client"

import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, UserPlus, Eye, EyeOff } from "lucide-react"

const STUDENT_ID_RE = /^[A-Z]{2}-\d{2}-[A-Z]-\d{5}$/

export default function RegisterPage() {
    const navigate = useNavigate()
    const [fullName, setFullName] = useState("")
    const [email, setEmail] = useState("")
    const [studentId, setStudentId] = useState("")
    const [password, setPassword] = useState("")
    const [confirm, setConfirm] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [loading, setLoading] = useState(false)

    const goBack = () => navigate("/login")

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!fullName.trim()) return toast.error("Please enter your full name.")
        if (!email.trim()) return toast.error("Please enter an email.")
        if (!STUDENT_ID_RE.test(studentId.toUpperCase())) {
            return toast.error("Invalid Student ID. Use format: TC-20-A-00123")
        }
        if (password.length < 6) return toast.error("Password must be at least 6 characters.")
        if (password !== confirm) return toast.error("Passwords do not match.")

        setLoading(true)
        try {
            await new Promise((r) => setTimeout(r, 1200))
            toast.success("Registration successful. Please sign in.")
            navigate("/login")
        } catch {
            toast.error("Registration failed. Try again.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4">
            <div className="max-w-md mx-auto pt-4 mb-6">
                <Button variant="ghost" onClick={goBack} className="mb-4 text-gray-600 hover:text-gray-900 cursor-pointer">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Login
                </Button>
                <div className="text-center">
                    <h1 className="text-xl font-bold text-gray-900">Create an account</h1>
                    <p className="text-sm text-gray-600">Register to access the system</p>
                </div>
            </div>

            <div className="flex justify-center">
                <Card className="w-full max-w-md shadow-xl border-0 bg-white/90 backdrop-blur-sm">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
                            <UserPlus className="h-6 w-6 text-blue-600" />
                            Register
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form className="space-y-6" onSubmit={submit}>
                            <div className="space-y-2">
                                <Label htmlFor="name">Full Name</Label>
                                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Juan Dela Cruz" />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@jrmsu.edu.ph" />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="studentId">Student ID (e.g., TC-20-A-00123)</Label>
                                <Input
                                    id="studentId"
                                    value={studentId}
                                    onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                                    placeholder="TC-20-A-00123"
                                    className="font-mono text-center"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
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

                            <div className="space-y-2">
                                <Label htmlFor="confirm">Confirm Password</Label>
                                <div className="relative">
                                    <Input
                                        id="confirm"
                                        type={showConfirm ? "text" : "password"}
                                        value={confirm}
                                        onChange={(e) => setConfirm(e.target.value)}
                                        placeholder="••••••••"
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                                        onClick={() => setShowConfirm((v) => !v)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                                    >
                                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-semibold" disabled={loading}>
                                {loading ? "Creating account..." : "Create account"}
                            </Button>

                            <div className="text-center text-sm">
                                Already have an account?{" "}
                                <Link className="text-blue-600 hover:underline" to="/login">
                                    Sign in
                                </Link>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
