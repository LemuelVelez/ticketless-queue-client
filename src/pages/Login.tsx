import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, User, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export default function Login() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const { login } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            await new Promise(resolve => setTimeout(resolve, 1000))
            const success = await login(username, password)

            if (success) {
                toast.success('Login successful!')
                if (username === 'admin') {
                    navigate('/admin')
                } else {
                    navigate('/staff')
                }
            } else {
                toast.error('Invalid credentials')
            }
        } catch (error) {
            toast.error('Login failed. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-white">
                            <Shield className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">JRMSU Queue</h1>
                            <p className="text-sm text-gray-600">Staff Portal</p>
                        </div>
                    </div>
                    <p className="text-gray-600">Jose Rizal Memorial State University</p>
                </div>

                {/* Login Card */}
                <Card>
                    <CardHeader className="text-center">
                        <CardTitle>Staff Login</CardTitle>
                        <CardDescription>Enter your credentials to access the system</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Username</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                    <Input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="Enter your username"
                                        className="pl-10"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                    <Input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        className="pl-10 pr-12"
                                        required
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </Button>
                                </div>
                            </div>

                            <Button type="submit" disabled={isLoading} className="w-full">
                                {isLoading ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                                        Signing in...
                                    </div>
                                ) : (
                                    'Sign In'
                                )}
                            </Button>
                        </form>

                        {/* Demo Credentials */}
                        <Card className="mt-6 bg-blue-50">
                            <CardContent className="pt-4">
                                <h3 className="text-sm font-semibold text-blue-900 mb-2">Demo Credentials:</h3>
                                <div className="text-sm text-blue-800 space-y-1">
                                    <p><strong>Admin:</strong> username: admin, password: admin</p>
                                    <p><strong>Staff:</strong> username: staff, password: staff</p>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="mt-6 text-center">
                            <Button variant="link" asChild>
                                <Link to="/">← Back to Home</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Footer */}
                <div className="mt-8 text-center text-sm text-gray-600">
                    <p>© 2025 Jose Rizal Memorial State University</p>
                    <p>All rights reserved</p>
                </div>
            </div>
        </div>
    )
}
