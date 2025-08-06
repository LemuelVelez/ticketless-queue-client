import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Users, Clock, Volume2, Shield, Wifi, WifiOff } from 'lucide-react'
import { useQueue } from '../contexts/QueueContext'

export default function QueueDisplay() {
    const { servicePoint } = useParams()
    const { queue } = useQueue()
    const [currentTime, setCurrentTime] = useState(new Date())
    const [isConnected, setIsConnected] = useState(true)

    // Update time every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date())
        }, 1000)

        return () => clearInterval(timer)
    }, [])

    // Simulate connection status
    useEffect(() => {
        const connectionTimer = setInterval(() => {
            setIsConnected(Math.random() > 0.1) // 90% uptime simulation
        }, 5000)

        return () => clearInterval(connectionTimer)
    }, [])

    // Filter queue for current service point
    const currentQueue = queue.filter(item =>
        item.servicePoint.toLowerCase().includes(servicePoint?.toLowerCase() || '')
    )

    const currentlyServing = currentQueue.find(item => item.status === 'serving')
    const waitingQueue = currentQueue.filter(item => item.status === 'waiting').slice(0, 8)

    const servicePointNames: { [key: string]: string } = {
        'registrar': 'Registrar Office',
        'cashier': 'Cashier',
        'library': 'Library',
        'clinic': 'Campus Clinic',
        'nstp': 'NSTP/ROTC',
        'registrar-office': 'Registrar Office'
    }

    const displayName = servicePointNames[servicePoint || ''] || 'Service Point'

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-white">
            {/* Header */}
            <header className="bg-black/20 backdrop-blur-sm border-b border-white/10">
                <div className="container mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/10">
                                <Shield className="h-7 w-7" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold">JRMSU Queue System</h1>
                                <p className="text-blue-200">{displayName}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                {isConnected ? (
                                    <>
                                        <Wifi className="h-5 w-5 text-green-400" />
                                        <span className="text-green-400 text-sm">Connected</span>
                                    </>
                                ) : (
                                    <>
                                        <WifiOff className="h-5 w-5 text-red-400" />
                                        <span className="text-red-400 text-sm">Disconnected</span>
                                    </>
                                )}
                            </div>

                            <div className="text-right">
                                <p className="text-xl font-bold">
                                    {currentTime.toLocaleTimeString()}
                                </p>
                                <p className="text-blue-200 text-sm">
                                    {currentTime.toLocaleDateString()}
                                </p>
                            </div>

                            <Link
                                to="/"
                                className="flex items-center gap-2 text-blue-200 hover:text-white transition-colors"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Home
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-200px)]">
                    {/* Currently Serving */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
                        <div className="text-center h-full flex flex-col justify-center">
                            <div className="mb-6">
                                <Volume2 className="h-16 w-16 mx-auto mb-4 text-blue-300" />
                                <h2 className="text-3xl font-bold mb-2">Now Serving</h2>
                            </div>

                            {currentlyServing ? (
                                <div className="space-y-6">
                                    <div className="bg-gradient-to-r from-green-400 to-blue-500 rounded-xl p-8">
                                        <p className="text-6xl md:text-8xl font-bold mb-2">
                                            {currentlyServing.queueNumber}
                                        </p>
                                        <p className="text-xl text-green-100">
                                            Please proceed to the counter
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-center">
                                        <div className="bg-white/5 rounded-lg p-4">
                                            <p className="text-2xl font-bold">Window 1</p>
                                            <p className="text-blue-200">Service Counter</p>
                                        </div>
                                        <div className="bg-white/5 rounded-lg p-4">
                                            <p className="text-2xl font-bold">
                                                {new Date(currentlyServing.timestamp).toLocaleTimeString()}
                                            </p>
                                            <p className="text-blue-200">Called At</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="text-8xl font-bold text-gray-400 mb-4">---</div>
                                    <p className="text-2xl text-gray-300">No one is currently being served</p>
                                    <p className="text-blue-200">Please wait for the next call</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Waiting Queue */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-3xl font-bold">Queue List</h2>
                            <div className="flex items-center gap-2">
                                <Users className="h-6 w-6" />
                                <span className="text-xl font-semibold">{waitingQueue.length}</span>
                            </div>
                        </div>

                        {waitingQueue.length === 0 ? (
                            <div className="text-center py-16">
                                <Users className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                                <p className="text-2xl text-gray-300 mb-2">No students in queue</p>
                                <p className="text-blue-200">Queue is currently empty</p>
                            </div>
                        ) : (
                            <div className="space-y-4 max-h-[500px] overflow-y-auto">
                                {waitingQueue.map((item, index) => (
                                    <div
                                        key={item.id}
                                        className={`flex items-center justify-between p-4 rounded-xl transition-all ${index === 0
                                                ? 'bg-gradient-to-r from-yellow-400/20 to-orange-400/20 border border-yellow-400/30'
                                                : 'bg-white/5 border border-white/10'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${index === 0
                                                    ? 'bg-yellow-400 text-black'
                                                    : 'bg-white/10 text-white'
                                                }`}>
                                                {index + 1}
                                            </div>
                                            <div>
                                                <p className="text-2xl font-bold">{item.queueNumber}</p>
                                                <p className="text-blue-200">ID: {item.studentId}</p>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Clock className="h-5 w-5 text-blue-300" />
                                                <span className="text-lg">{item.estimatedWaitTime}</span>
                                            </div>
                                            <p className="text-blue-200 text-sm">
                                                {new Date(item.timestamp).toLocaleTimeString()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Status Bar */}
                <div className="mt-8 bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
                        <div>
                            <p className="text-3xl font-bold text-blue-300">{currentQueue.length}</p>
                            <p className="text-blue-200">Total in Queue</p>
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-green-300">
                                {currentQueue.filter(q => q.status === 'completed').length}
                            </p>
                            <p className="text-blue-200">Served Today</p>
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-orange-300">12 min</p>
                            <p className="text-blue-200">Average Wait</p>
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-purple-300">
                                {currentlyServing ? 'Active' : 'Idle'}
                            </p>
                            <p className="text-blue-200">Service Status</p>
                        </div>
                    </div>
                </div>

                {/* Instructions */}
                <div className="mt-6 text-center">
                    <p className="text-blue-200 text-lg">
                        🔊 Listen for voice announcements • 📱 Check your SMS for updates
                    </p>
                    <p className="text-blue-300 text-sm mt-2">
                        For assistance, please approach the information desk
                    </p>
                </div>
            </div>
        </div>
    )
}
