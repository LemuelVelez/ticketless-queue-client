import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Users, Volume2, Play, Pause, SkipForward, CheckCircle, Clock, Settings, Shield, Mic, MicOff, Monitor } from 'lucide-react'
import { useQueue } from '../contexts/QueueContext'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'sonner'

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
    const [windowNumber, setWindowNumber] = useState(1)
    const [serviceStatus, setServiceStatus] = useState<'open' | 'closed' | 'break'>('open')

    // Filter queue for current service point (simplified - in real app would be based on user's assigned service)
    const serviceQueue = queue.filter(item => item.status === 'waiting').slice(0, 10)
    const servingQueue = queue.filter(item => item.status === 'serving')

    const handleCallNext = () => {
        if (serviceQueue.length === 0) {
            toast.error('No students in queue')
            return
        }

        const nextStudent = serviceQueue[0]
        setCurrentlyServing(nextStudent)
        callNext(nextStudent.id)

        // Simulate voice announcement
        if (isVoiceEnabled) {
            toast.success(`🔊 Now calling: ${nextStudent.queueNumber} to Window ${windowNumber}`)

            // Simulate text-to-speech
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(
                    `Now calling queue number ${nextStudent.queueNumber} to window ${windowNumber}`
                )
                utterance.rate = 0.8
                utterance.volume = 0.8
                speechSynthesis.speak(utterance)
            }
        }

        // Simulate SMS notification
        setTimeout(() => {
            toast.info(`📱 SMS sent to ${nextStudent.phoneNumber}: "Your turn! Please proceed to Window ${windowNumber}"`)
        }, 1000)
    }

    const handleCompleteService = () => {
        if (!currentlyServing) return

        updateQueueStatus(currentlyServing.id, 'completed')
        setCurrentlyServing(null)
        toast.success('Service completed successfully')

        // Simulate SMS notification
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
                            <Link
                                to="/"
                                className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Exit
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Control Panel */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Service Status Card */}
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-gray-900">Service Control</h2>
                                <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${serviceStatus === 'open' ? 'bg-green-500' :
                                            serviceStatus === 'break' ? 'bg-yellow-500' : 'bg-red-500'
                                        }`} />
                                    <span className="text-sm font-medium capitalize">{serviceStatus}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <div className="bg-blue-50 rounded-lg p-4 text-center">
                                    <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                                    <p className="text-2xl font-bold text-blue-600">{serviceQueue.length}</p>
                                    <p className="text-sm text-gray-600">In Queue</p>
                                </div>
                                <div className="bg-green-50 rounded-lg p-4 text-center">
                                    <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                                    <p className="text-2xl font-bold text-green-600">{queue.filter(q => q.status === 'completed').length}</p>
                                    <p className="text-sm text-gray-600">Completed Today</p>
                                </div>
                                <div className="bg-orange-50 rounded-lg p-4 text-center">
                                    <Clock className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                                    <p className="text-2xl font-bold text-orange-600">12</p>
                                    <p className="text-sm text-gray-600">Avg Wait (min)</p>
                                </div>
                            </div>

                            {/* Currently Serving */}
                            {currentlyServing ? (
                                <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-6 mb-6">
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
                                </div>
                            ) : (
                                <div className="bg-gray-100 rounded-lg p-6 mb-6 text-center">
                                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                                    <p className="text-gray-600">No student currently being served</p>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <button
                                    onClick={handleCallNext}
                                    disabled={serviceQueue.length === 0 || currentlyServing !== null || serviceStatus !== 'open'}
                                    className="bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <Play className="h-5 w-5" />
                                    Call Next
                                </button>

                                <button
                                    onClick={handleCompleteService}
                                    disabled={!currentlyServing}
                                    className="bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <CheckCircle className="h-5 w-5" />
                                    Complete
                                </button>

                                <button
                                    onClick={handleSkipStudent}
                                    disabled={!currentlyServing}
                                    className="bg-orange-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <SkipForward className="h-5 w-5" />
                                    Skip
                                </button>
                            </div>
                        </div>

                        {/* Queue List */}
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Queue List</h3>

                            {serviceQueue.length === 0 ? (
                                <div className="text-center py-8">
                                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                                    <p className="text-gray-600">No students in queue</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {serviceQueue.map((item, index) => (
                                        <div
                                            key={item.id}
                                            className={`flex items-center justify-between p-4 rounded-lg border ${index === 0 ? 'border-blue-200 bg-blue-50' : 'border-gray-200'
                                                }`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${index === 0 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                                                    }`}>
                                                    {index + 1}
                                                </div>
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
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Settings Panel */}
                    <div className="space-y-6">
                        {/* Window Settings */}
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Window Settings</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Window Number
                                    </label>
                                    <select
                                        value={windowNumber}
                                        onChange={(e) => setWindowNumber(Number(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        {[1, 2, 3, 4, 5].map(num => (
                                            <option key={num} value={num}>Window {num}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Service Status
                                    </label>
                                    <button
                                        onClick={toggleServiceStatus}
                                        className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${serviceStatus === 'open' ? 'bg-green-100 text-green-800' :
                                                serviceStatus === 'break' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-red-100 text-red-800'
                                            }`}
                                    >
                                        {serviceStatus === 'open' ? '🟢 Open' :
                                            serviceStatus === 'break' ? '🟡 On Break' :
                                                '🔴 Closed'}
                                    </button>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700">Voice Announcements</span>
                                    <button
                                        onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                                        className={`p-2 rounded-lg transition-colors ${isVoiceEnabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
                                            }`}
                                    >
                                        {isVoiceEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>

                            <div className="space-y-3">
                                <Link
                                    to="/display/registrar"
                                    className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Monitor className="h-5 w-5" />
                                    View Display
                                </Link>

                                <button
                                    onClick={() => toast.info('Test announcement played')}
                                    className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Volume2 className="h-5 w-5" />
                                    Test Voice
                                </button>

                                <button
                                    onClick={() => toast.info('Settings panel opened')}
                                    className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Settings className="h-5 w-5" />
                                    Settings
                                </button>
                            </div>
                        </div>

                        {/* Service Statistics */}
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Today's Stats</h3>

                            <div className="space-y-3">
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
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
