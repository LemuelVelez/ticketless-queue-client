import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Users, Volume2, Play, SkipForward, CheckCircle, Clock, Settings, Shield, Mic, MicOff, Monitor } from 'lucide-react'
import { useQueue } from '../contexts/QueueContext'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface QueueItem {
    id: string
    studentId: string
    phoneNumber: string
    servicePoint: string
    queueNumber: string
    status: 'waiting' | 'serving' | 'completed'
    timestamp: Date
    estimatedWaitTime: string
}

export default function ServiceStaffInterface() {
    const { user } = useAuth()
    const { queue, updateQueueStatus, callNext } = useQueue()
    const [currentlyServing, setCurrentlyServing] = useState<QueueItem | null>(null)
    const [isVoiceEnabled, setIsVoiceEnabled] = useState(true)
    const [windowNumber, setWindowNumber] = useState("1")
    const [serviceStatus, setServiceStatus] = useState<'open' | 'closed' | 'break'>('open')

    const serviceQueue = queue.filter(item => item.status === 'waiting').slice(0, 10)

    const handleCallNext = () => {
        if (serviceQueue.length === 0) {
            toast.error('No students in queue')
            return
        }

        const nextStudent = serviceQueue[0]
        setCurrentlyServing(nextStudent)
        callNext(nextStudent.id)

        if (isVoiceEnabled) {
            toast.success(`🔊 Now calling: ${nextStudent.queueNumber} to Window ${windowNumber}`)
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(
                    `Now calling queue number ${nextStudent.queueNumber} to window ${windowNumber}`
                )
                utterance.rate = 0.8
                utterance.volume = 0.8
                speechSynthesis.speak(utterance)
            }
        }

        setTimeout(() => {
            toast.info(`📱 SMS sent to ${nextStudent.phoneNumber}: "Your turn! Please proceed to Window ${windowNumber}"`)
        }, 1000)
    }

    const handleCompleteService = () => {
        if (!currentlyServing) return
        updateQueueStatus(currentlyServing.id, 'completed')
        setCurrentlyServing(null)
        toast.success('Service completed successfully')

        setTimeout(() => {
            toast.info(`📱 SMS sent: "Thank you for using JRMSU Queue System. Service completed."`)
        }, 500)
    }

    const handleSkipStudent = () => {
        if (!currentlyServing) return
        updateQueueStatus(currentlyServing.id, 'waiting')
        setCurrentlyServing(null)
        toast.warning('Student skipped - moved back to queue')
    }

    const toggleServiceStatus = () => {
        const statuses: ('open' | 'closed' | 'break')[] = ['open', 'break', 'closed']
        const currentIndex = statuses.indexOf(serviceStatus)
        const nextStatus = statuses[(currentIndex + 1) % statuses.length]
        setServiceStatus(nextStatus)

        const statusMessages = {
            open: 'Service window is now open',
            break: 'Service window is on break',
            closed: 'Service window is now closed'
        }
        toast.info(statusMessages[nextStatus])
    }

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
                                <p className="text-xs text-gray-600">Service Staff Portal</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                                <p className="text-xs text-gray-600">{user?.role} • Window {windowNumber}</p>
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
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Control Panel */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Service Status Card */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle>Service Control</CardTitle>
                                    <Badge variant={serviceStatus === 'open' ? 'default' : serviceStatus === 'break' ? 'secondary' : 'destructive'}>
                                        {serviceStatus === 'open' ? '🟢 Active' : serviceStatus === 'break' ? '🟡 Break' : '🔴 Closed'}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Card className="bg-blue-50">
                                        <CardContent className="pt-6 text-center">
                                            <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                                            <p className="text-2xl font-bold text-blue-600">{serviceQueue.length}</p>
                                            <p className="text-sm text-gray-600">In Queue</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-green-50">
                                        <CardContent className="pt-6 text-center">
                                            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                                            <p className="text-2xl font-bold text-green-600">{queue.filter(q => q.status === 'completed').length}</p>
                                            <p className="text-sm text-gray-600">Completed Today</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-orange-50">
                                        <CardContent className="pt-6 text-center">
                                            <Clock className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                                            <p className="text-2xl font-bold text-orange-600">12</p>
                                            <p className="text-sm text-gray-600">Avg Wait (min)</p>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Currently Serving */}
                                {currentlyServing ? (
                                    <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                                        <CardContent className="pt-6">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-blue-100 mb-1">Currently Serving</p>
                                                    <p className="text-2xl font-bold">{currentlyServing.queueNumber}</p>
                                                    <p className="text-blue-100">Student ID: {currentlyServing.studentId}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-blue-100">Window</p>
                                                    <p className="text-3xl font-bold">{windowNumber}</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <Card className="bg-gray-100">
                                        <CardContent className="pt-6 text-center">
                                            <Users className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                                            <p className="text-gray-600">No student currently being served</p>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Action Buttons */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Button
                                        onClick={handleCallNext}
                                        disabled={serviceQueue.length === 0 || currentlyServing !== null || serviceStatus !== 'open'}
                                        className="flex items-center gap-2"
                                    >
                                        <Play className="h-5 w-5" />
                                        Call Next
                                    </Button>
                                    <Button
                                        onClick={handleCompleteService}
                                        disabled={!currentlyServing}
                                        variant="default"
                                        className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
                                    >
                                        <CheckCircle className="h-5 w-5" />
                                        Complete
                                    </Button>
                                    <Button
                                        onClick={handleSkipStudent}
                                        disabled={!currentlyServing}
                                        variant="default"
                                        className="bg-orange-600 hover:bg-orange-700 flex items-center gap-2"
                                    >
                                        <SkipForward className="h-5 w-5" />
                                        Skip
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Queue List */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Queue List</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {serviceQueue.length === 0 ? (
                                    <div className="text-center py-8">
                                        <Users className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                                        <p className="text-gray-600">No students in queue</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {serviceQueue.map((item, index) => (
                                            <Card
                                                key={item.id}
                                                className={index === 0 ? 'border-blue-200 bg-blue-50' : ''}
                                            >
                                                <CardContent className="p-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-4">
                                                            <Badge variant={index === 0 ? 'default' : 'secondary'}>
                                                                {index + 1}
                                                            </Badge>
                                                            <div>
                                                                <p className="font-semibold">{item.queueNumber}</p>
                                                                <p className="text-sm text-gray-600">ID: {item.studentId}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-sm text-gray-600">
                                                                {new Date(item.timestamp).toLocaleTimeString()}
                                                            </p>
                                                            <p className="text-xs text-gray-500">Est: {item.estimatedWaitTime}</p>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Settings Panel */}
                    <div className="space-y-6">
                        {/* Window Settings */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Window Settings</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Window Number</label>
                                    <Select value={windowNumber} onValueChange={setWindowNumber}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[1, 2, 3, 4, 5].map(num => (
                                                <SelectItem key={num} value={num.toString()}>
                                                    Window {num}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Service Status</label>
                                    <Button
                                        onClick={toggleServiceStatus}
                                        variant="outline"
                                        className="w-full justify-start"
                                    >
                                        {serviceStatus === 'open' ? '🟢 Open' :
                                            serviceStatus === 'break' ? '🟡 On Break' :
                                                '🔴 Closed'}
                                    </Button>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Voice Announcements</span>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                                    >
                                        {isVoiceEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Quick Actions */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Quick Actions</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Button variant="outline" className="w-full justify-start" asChild>
                                    <Link to="/display/registrar">
                                        <Monitor className="h-5 w-5 mr-2" />
                                        View Display
                                    </Link>
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full justify-start"
                                    onClick={() => toast.info('Test announcement played')}
                                >
                                    <Volume2 className="h-5 w-5 mr-2" />
                                    Test Voice
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full justify-start"
                                    onClick={() => toast.info('Settings panel opened')}
                                >
                                    <Settings className="h-5 w-5 mr-2" />
                                    Settings
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Service Statistics */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Today's Stats</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Students Served</span>
                                    <span className="font-semibold">24</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Avg Service Time</span>
                                    <span className="font-semibold">3.5 min</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Peak Hour</span>
                                    <span className="font-semibold">10:00 AM</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Efficiency</span>
                                    <span className="font-semibold text-green-600">94%</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}
