"use client"

import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, MailQuestion } from "lucide-react"

export default function ForgotPasswordPage() {
    const navigate = useNavigate()
    const [identifier, setIdentifier] = useState("")
    const [loading, setLoading] = useState(false)

    const goBack = () => navigate("/login")

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!identifier.trim()) {
            toast.error("Enter your email address to continue.")
            return
        }
        setLoading(true)
        try {
            await new Promise((r) => setTimeout(r, 1000))
            toast.success("If an account exists, a reset link has been sent.")
            navigate("/reset-password")
        } catch {
            toast.error("Failed to send reset instructions. Try again.")
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
                    <h1 className="text-xl font-bold text-gray-900">Forgot Password</h1>
                    <p className="text-sm text-gray-600">We’ll send a link to reset your password</p>
                </div>
            </div>

            <div className="flex justify-center">
                <Card className="w-full max-w-md shadow-xl border-0 bg-white/90 backdrop-blur-sm">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
                            <MailQuestion className="h-6 w-6 text-blue-600" />
                            Reset access
                        </CardTitle>
                        <CardDescription>Enter your email address to receive a reset link.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form className="space-y-6" onSubmit={submit}>
                            <div className="space-y-2">
                                <Label htmlFor="identifier">Email</Label>
                                <Input
                                    id="identifier"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    placeholder="you@jrmsu.edu.ph"
                                />
                            </div>

                            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-semibold" disabled={loading}>
                                {loading ? "Sending..." : "Send reset link"}
                            </Button>

                            <div className="text-center text-sm">
                                Remembered it?{" "}
                                <Link to="/login" className="text-blue-600 hover:underline">
                                    Go back to login
                                </Link>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
