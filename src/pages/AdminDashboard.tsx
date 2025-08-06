import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Users, BarChart3, Clock, CheckCircle, AlertTriangle, TrendingUp, TrendingDown, Shield, Monitor, Settings, Activity } from 'lucide-react'
import { useQueue } from '../contexts/QueueContext'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function AdminDashboard() {
    const { user } = useAuth()
    const { queue } = useQueue()
    const [currentTime, setCurrentTime] = useState(new Date())

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date())
        }, 1000)
        return () => clearInterval(timer)
    }, [])

    const servicePoints = [
        { name: 'Registrar Office', active: 12, completed: 45, avgWait: '15 min', status: 'active' },
        { name: 'Cashier', active: 8, completed: 32, avgWait: '10 min', status: 'active' },
        { name: 'Library', active: 5, completed: 28, avgWait: '5 min', status: 'active' },
        { name: 'Campus Clinic', active: 3, completed: 15, avgWait: '8 min', status: 'break' },
        { name: 'NSTP/ROTC', active: 7, completed: 22, avgWait: '12 min', status: 'active' }
    ]

    const recentActivity = [
        { time: '14:32', action: 'Queue REG-045 completed at Registrar Office', type: 'completed' },
        { time: '14:30', action: 'New queue CAS-023 generated for Cashier', type: 'new' },
        { time: '14:28', action: 'Campus Clinic window went on break', type: 'status' },
        { time: '14:25', action: 'Queue LIB-012 called at Library', type: 'called' },
        { time: '14:23', action: 'System backup completed successfully', type: 'system' }
    ]

    const totalActive = servicePoints.reduce((sum, point) => sum + point.active, 0)
    const totalCompleted = servicePoints.reduce((sum, point) => sum + point.completed, 0)
    const activeServices = servicePoints.filter(point => point.status === 'active').length

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-sm border-b">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
                                <Shield className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">JRMSU Queue</h1>
                                <p className="text-xs text-gray-600">Admin Dashboard</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                                <p className="text-xs text-gray-600">System Administrator</p>
                            </div>
                            <Button variant="ghost" asChild>
                                <Link to="/">
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    Exit
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-4 py-8">
                {/* Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Total in Queue</p>
                                    <p className="text-3xl font-bold text-blue-600">{totalActive}</p>
                                </div>
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <Users className="h-6 w-6 text-blue-600" />
                                </div>
                            </div>
                            <div className="flex items-center gap-1 mt-2">
                                <TrendingUp className="h-4 w-4 text-green-500" />
                                <span className="text-sm text-green-600">+12% from yesterday</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Completed Today</p>
                                    <p className="text-3xl font-bold text-green-600">{totalCompleted}</p>
                                </div>
                                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                    <CheckCircle className="h-6 w-6 text-green-600" />
                                </div>
                            </div>
                            <div className="flex items-center gap-1 mt-2">
                                <TrendingUp className="h-4 w-4 text-green-500" />
                                <span className="text-sm text-green-600">+8% from yesterday</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Active Services</p>
                                    <p className="text-3xl font-bold text-orange-600">{activeServices}/5</p>
                                </div>
                                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                                    <Activity className="h-6 w-6 text-orange-600" />
                                </div>
                            </div>
                            <div className="flex items-center gap-1 mt-2">
                                <AlertTriangle className="h-4 w-4 text-orange-500" />
                                <span className="text-sm text-orange-600">1 service on break</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Avg Wait Time</p>
                                    <p className="text-3xl font-bold text-purple-600">10 min</p>
                                </div>
                                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                                    <Clock className="h-6 w-6 text-purple-600" />
                                </div>
                            </div>
                            <div className="flex items-center gap-1 mt-2">
                                <TrendingDown className="h-4 w-4 text-green-500" />
                                <span className="text-sm text-green-600">-3 min from yesterday</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Service Points Status */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>Service Points</CardTitle>
                                <div className="text-sm text-gray-500">
                                    {currentTime.toLocaleTimeString()}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {servicePoints.map((point, index) => (
                                <Card key={index}>
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <h3 className="font-semibold">{point.name}</h3>
                                                <Badge variant={point.status === 'active' ? 'default' : 'secondary'}>
                                                    {point.status === 'active' ? '🟢 Active' : '🟡 Break'}
                                                </Badge>
                                            </div>
                                            <Button variant="link" size="sm" asChild>
                                                <Link to={`/display/${point.name.toLowerCase().replace(/\s+/g, '-')}`}>
                                                    View Display
                                                </Link>
                                            </Button>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 text-sm">
                                            <div>
                                                <p className="text-gray-600">In Queue</p>
                                                <p className="font-semibold text-blue-600">{point.active}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-600">Completed</p>
                                                <p className="font-semibold text-green-600">{point.completed}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-600">Avg Wait</p>
                                                <p className="font-semibold text-orange-600">{point.avgWait}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Recent Activity */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Activity</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {recentActivity.map((activity, index) => (
                                    <div key={index} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50">
                                        <div className={`w-2 h-2 rounded-full mt-2 ${
                                            activity.type === 'completed' ? 'bg-green-500' :
                                            activity.type === 'new' ? 'bg-blue-500' :
                                            activity.type === 'called' ? 'bg-orange-500' :
                                            activity.type === 'status' ? 'bg-yellow-500' :
                                            'bg-gray-500'
                                        }`} />
                                        <div className="flex-1">
                                            <p className="text-sm">{activity.action}</p>
                                            <p className="text-xs text-gray-500">{activity.time}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <Button variant="link" className="w-full mt-4">
                                View All Activity
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Quick Actions */}
                <Card className="mt-8">
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            <Button variant="outline" className="flex flex-col items-center gap-2 h-auto p-4">
                                <Monitor className="h-8 w-8 text-blue-600" />
                                <span className="text-sm font-medium">View Displays</span>
                            </Button>
                            <Button variant="outline" className="flex flex-col items-center gap-2 h-auto p-4">
                                <BarChart3 className="h-8 w-8 text-green-600" />
                                <span className="text-sm font-medium">Analytics</span>
                            </Button>
                            <Button variant="outline" className="flex flex-col items-center gap-2 h-auto p-4">
                                <Users className="h-8 w-8 text-purple-600" />
                                <span className="text-sm font-medium">Manage Users</span>
                            </Button>
                            <Button variant="outline" className="flex flex-col items-center gap-2 h-auto p-4">
                                <Settings className="h-8 w-8 text-orange-600" />
                                <span className="text-sm font-medium">Settings</span>
                            </Button>
                            <Button variant="outline" className="flex flex-col items-center gap-2 h-auto p-4">
                                <Activity className="h-8 w-8 text-red-600" />
                                <span className="text-sm font-medium">System Health</span>
                            </Button>
                            <Button variant="outline" className="flex flex-col items-center gap-2 h-auto p-4">
                                <Shield className="h-8 w-8 text-indigo-600" />
                                <span className="text-sm font-medium">Security</span>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
