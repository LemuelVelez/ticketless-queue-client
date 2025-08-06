import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, User, Smartphone, MapPin, Clock, CheckCircle, Users, Volume2, MessageSquare, Shield } from 'lucide-react'
import { useQueue } from '../contexts/QueueContext'
import { toast } from 'sonner'

interface ServicePoint {
    id: string
    name: string
    description: string
    currentQueue: number
    avgWaitTime: string
    isOpen: boolean
    icon: React.ReactNode
}

export default function StudentInterface() {
    const [step, setStep] = useState(1)
    const [studentId, setStudentId] = useState('')
    const [phoneNumber, setPhoneNumber] = useState('')
    const [selectedService, setSelectedService] = useState<ServicePoint | null>(null)
    const [queueNumber, setQueueNumber] = useState<string | null>(null)
    const [isGenerating, setIsGenerating] = useState(false)

    const { addToQueue } = useQueue()

    const servicePoints: ServicePoint[] = [
        {
            id: 'registrar',
            name: 'Registrar Office',
            description: 'Transcripts, enrollment, academic records',
            currentQueue: 12,
            avgWaitTime: '15 min',
            isOpen: true,
            icon: <User className="h-6 w-6" />
        },
        {
            id: 'cashier',
            name: 'Cashier',
            description: 'Payments, fees, financial transactions',
            currentQueue: 8,
            avgWaitTime: '10 min',
            isOpen: true,
            icon: <Users className="h-6 w-6" />
        },
        {
            id: 'library',
            name: 'Library',
            description: 'Book borrowing, returns, research assistance',
            currentQueue: 5,
            avgWaitTime: '5 min',
            isOpen: true,
            icon: <Users className="h-6 w-6" />
        },
        {
            id: 'clinic',
            name: 'Campus Clinic',
            description: 'Medical consultation, health services',
            currentQueue: 3,
            avgWaitTime: '8 min',
            isOpen: true,
            icon: <Users className="h-6 w-6" />
        },
        {
            id: 'nstp',
            name: 'NSTP/ROTC',
            description: 'NSTP enrollment, ROTC processing',
            currentQueue: 7,
            avgWaitTime: '12 min',
            isOpen: true,
            icon: <Users className="h-6 w-6" />
        }
    ]

    const handleNext = () => {
        if (step === 1 && (!studentId || !phoneNumber)) {
            toast.error('Please fill in all required fields')
            return
        }
        if (step === 2 && !selectedService) {
            toast.error('Please select a service point')
            return
        }
        setStep(step + 1)
    }

    const handleGenerateQueue = async () => {
        if (!selectedService) return

        setIsGenerating(true)

        // Simulate queue generation process
        setTimeout(() => {
            const newQueueNumber = `${selectedService.id.toUpperCase()}-${String(selectedService.currentQueue + 1).padStart(3, '0')}`
            setQueueNumber(newQueueNumber)

            // Add to queue context
            addToQueue({
                id: newQueueNumber,
                studentId,
                phoneNumber,
                servicePoint: selectedService.name,
                queueNumber: newQueueNumber,
                status: 'waiting',
                timestamp: new Date(),
                estimatedWaitTime: selectedService.avgWaitTime
            })

            setIsGenerating(false)
            setStep(4)

            // Simulate SMS notification
            toast.success(`SMS sent to ${phoneNumber}: Your queue number is ${newQueueNumber}`)
        }, 2000)
    }

    const resetForm = () => {
        setStep(1)
        setStudentId('')
        setPhoneNumber('')
        setSelectedService(null)
        setQueueNumber(null)
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-sm border-b">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <Link to="/" className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
                                <Shield className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">JRMSU Queue</h1>
                                <p className="text-xs text-gray-600">Student Portal</p>
                            </div>
                        </Link>

                        <Link
                            to="/"
                            className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back to Home
                        </Link>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-4 py-8">
                {/* Progress Indicator */}
                <div className="max-w-2xl mx-auto mb-8">
                    <div className="flex items-center justify-between">
                        {[1, 2, 3, 4].map((stepNumber) => (
                            <div key={stepNumber} className="flex items-center">
                                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold
                  ${step >= stepNumber
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-200 text-gray-500'
                                    }
                `}>
                                    {step > stepNumber ? <CheckCircle className="h-5 w-5" /> : stepNumber}
                                </div>
                                {stepNumber < 4 && (
                                    <div className={`
                    w-16 h-1 mx-2
                    ${step > stepNumber ? 'bg-blue-600' : 'bg-gray-200'}
                  `} />
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-between mt-2 text-xs text-gray-500">
                        <span>Student Info</span>
                        <span>Select Service</span>
                        <span>Confirm</span>
                        <span>Queue Number</span>
                    </div>
                </div>

                {/* Step Content */}
                <div className="max-w-2xl mx-auto">
                    {step === 1 && (
                        <div className="bg-white rounded-xl shadow-lg p-8">
                            <div className="text-center mb-8">
                                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <User className="h-8 w-8 text-blue-600" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Student Information</h2>
                                <p className="text-gray-600">Enter your student ID and contact information</p>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Student ID *
                                    </label>
                                    <input
                                        type="text"
                                        value={studentId}
                                        onChange={(e) => setStudentId(e.target.value)}
                                        placeholder="e.g., 2021-12345"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Mobile Number *
                                    </label>
                                    <input
                                        type="tel"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        placeholder="e.g., 09123456789"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        You'll receive SMS notifications about your queue status
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={handleNext}
                                className="w-full mt-8 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                            >
                                Continue
                                <ArrowRight className="h-5 w-5" />
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="bg-white rounded-xl shadow-lg p-8">
                            <div className="text-center mb-8">
                                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <MapPin className="h-8 w-8 text-blue-600" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Service Point</h2>
                                <p className="text-gray-600">Choose the service you need assistance with</p>
                            </div>

                            <div className="space-y-4">
                                {servicePoints.map((service) => (
                                    <div
                                        key={service.id}
                                        onClick={() => setSelectedService(service)}
                                        className={`
                      p-4 border-2 rounded-lg cursor-pointer transition-all
                      ${selectedService?.id === service.id
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                            }
                      ${!service.isOpen ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                                    {service.icon}
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-gray-900">{service.name}</h3>
                                                    <p className="text-sm text-gray-600">{service.description}</p>
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <div className="flex items-center gap-4 text-sm">
                                                    <div className="flex items-center gap-1">
                                                        <Users className="h-4 w-4 text-gray-400" />
                                                        <span>{service.currentQueue} in queue</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="h-4 w-4 text-gray-400" />
                                                        <span>{service.avgWaitTime} wait</span>
                                                    </div>
                                                </div>
                                                <div className={`
                          inline-flex items-center gap-1 mt-1 px-2 py-1 rounded-full text-xs
                          ${service.isOpen
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-red-100 text-red-800'
                                                    }
                        `}>
                                                    <div className={`w-2 h-2 rounded-full ${service.isOpen ? 'bg-green-500' : 'bg-red-500'}`} />
                                                    {service.isOpen ? 'Open' : 'Closed'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-4 mt-8">
                                <button
                                    onClick={() => setStep(1)}
                                    className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                    Back
                                </button>
                                <button
                                    onClick={handleNext}
                                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    Continue
                                    <ArrowRight className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && selectedService && (
                        <div className="bg-white rounded-xl shadow-lg p-8">
                            <div className="text-center mb-8">
                                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle className="h-8 w-8 text-blue-600" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Confirm Details</h2>
                                <p className="text-gray-600">Please verify your information before generating queue number</p>
                            </div>

                            <div className="space-y-6">
                                <div className="bg-gray-50 rounded-lg p-6">
                                    <h3 className="font-semibold text-gray-900 mb-4">Student Information</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-gray-600">Student ID</p>
                                            <p className="font-semibold">{studentId}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600">Mobile Number</p>
                                            <p className="font-semibold">{phoneNumber}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-6">
                                    <h3 className="font-semibold text-gray-900 mb-4">Selected Service</h3>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                            {selectedService.icon}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-semibold">{selectedService.name}</h4>
                                            <p className="text-sm text-gray-600">{selectedService.description}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-gray-600">Current Queue</p>
                                            <p className="font-semibold">{selectedService.currentQueue} people</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-blue-50 rounded-lg p-6">
                                    <h3 className="font-semibold text-blue-900 mb-2">What happens next?</h3>
                                    <div className="space-y-2 text-sm text-blue-800">
                                        <div className="flex items-center gap-2">
                                            <MessageSquare className="h-4 w-4" />
                                            <span>You'll receive an SMS with your queue number</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Volume2 className="h-4 w-4" />
                                            <span>Listen for voice announcements when your turn approaches</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-4 w-4" />
                                            <span>Estimated wait time: {selectedService.avgWaitTime}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 mt-8">
                                <button
                                    onClick={() => setStep(2)}
                                    className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                    Back
                                </button>
                                <button
                                    onClick={handleGenerateQueue}
                                    disabled={isGenerating}
                                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isGenerating ? (
                                        <>
                                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            Generate Queue Number
                                            <ArrowRight className="h-5 w-5" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 4 && queueNumber && selectedService && (
                        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle className="h-10 w-10 text-green-600" />
                            </div>

                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Queue Number Generated!</h2>
                            <p className="text-gray-600 mb-8">Your queue number has been successfully generated</p>

                            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl p-8 mb-8">
                                <p className="text-blue-100 mb-2">Your Queue Number</p>
                                <p className="text-4xl font-bold mb-4">{queueNumber}</p>
                                <p className="text-blue-100">
                                    {selectedService.name} • Estimated wait: {selectedService.avgWaitTime}
                                </p>
                            </div>

                            <div className="bg-green-50 rounded-lg p-6 mb-8">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <MessageSquare className="h-5 w-5 text-green-600" />
                                    <span className="font-semibold text-green-800">SMS Notification Sent</span>
                                </div>
                                <p className="text-sm text-green-700">
                                    A confirmation message has been sent to {phoneNumber}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                <Link
                                    to={`/display/${selectedService.id}`}
                                    className="bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                                >
                                    View Queue Status
                                </Link>
                                <button
                                    onClick={resetForm}
                                    className="border border-gray-300 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                                >
                                    Generate Another
                                </button>
                            </div>

                            <div className="text-sm text-gray-500">
                                <p>Keep your phone nearby for SMS updates</p>
                                <p>Listen for voice announcements when your turn approaches</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
