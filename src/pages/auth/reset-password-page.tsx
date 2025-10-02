"use client"

import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, KeyRound } from "lucide-react"

export default function ResetPasswordPage() {
    const navigate = useNavigate()
    const [search] = useSearchParams()
    const [password, setPassword] = useState("")
    const [confirm, setConfirm] = useState("")
    const [loading, setLoading] = useState(false)

    const token = search.get("token") || "demo"

    const goBack = () => navigate("/login")

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (password.length < 6) return toast.error("Password must be at least 6 characters.")
        if (password !== confirm) return toast.error("Passwords do not match.")

        setLoading(true)
        try {
            await new Promise((r) => setTimeout(r, 1000))
            if (!token) throw new Error("Invalid token")
            toast.success("Password has been reset. You can now sign in.")
            navigate("/login")
        } catch {
            toast.error("Failed to reset password. The link may be invalid or expired.")
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
                    <h1 className="text-xl font-bold text-gray-900">Reset Password</h1>
                    <p className="text-sm text-gray-600">Enter a new password for your account</p>
                </div>
            </div>

            <div className="flex justify-center">
                <Card className="w-full max-w-md shadow-xl border-0 bg-white/90 backdrop-blur-sm">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
                            <KeyRound className="h-6 w-6 text-blue-600" />
                            Set a new password
                        </CardTitle>
                        <CardDescription>For security, choose a strong password you haven’t used before.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form className="space-y-6" onSubmit={submit}>
                            <div className="space-y-2">
                                <Label htmlFor="password">New Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirm">Confirm New Password</Label>
                                <Input
                                    id="confirm"
                                    type="password"
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                    placeholder="••••••••"
                                />
                            </div>

                            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-semibold" disabled={loading}>
                                {loading ? "Updating..." : "Update password"}
                            </Button>

                            <div className="text-center text-sm">
                                Back to{" "}
                                <Link to="/login" className="text-blue-600 hover:underline">
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
