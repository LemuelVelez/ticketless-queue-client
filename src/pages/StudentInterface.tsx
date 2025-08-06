import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, User, Smartphone, MapPin, Clock, CheckCircle, Users, Volume2, MessageSquare, Shield } from 'lucide-react'
import { useQueue } from '../contexts/QueueContext'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

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

        setTimeout(() => {
            const newQueueNumber = `${selectedService.id.toUpperCase()}-${String(selectedService.currentQueue + 1).padStart(3, '0')}`
            setQueueNumber(newQueueNumber)

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

    const progressValue = (step / 4) * 100

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
                        <Button variant="ghost" asChild>
                            <Link to="/">
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back to Home
                            </Link>
                        </Button>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-4 py-8">
                {/* Progress Indicator */}
                <div className="max-w-2xl mx-auto mb-8">
                    <Progress value={progressValue} className="mb-4" />
                    <div className="flex justify-between text-sm text-gray-500">
                        <span className={step >= 1 ? 'text-blue-600 font-medium' : ''}>Student Info</span>
                        <span className={step >= 2 ? 'text-blue-600 font-medium' : ''}>Select Service</span>
                        <span className={step >= 3 ? 'text-blue-600 font-medium' : ''}>Confirm</span>
                        <span className={step >= 4 ? 'text-blue-600 font-medium' : ''}>Queue Number</span>
                    </div>
                </div>

                {/* Step Content */}
                <div className="max-w-2xl mx-auto">
                    {step === 1 && (
                        <Card>
                            <CardHeader className="text-center">
                                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <User className="h-8 w-8 text-blue-600" />
                                </div>
                                <CardTitle>Student Information</CardTitle>
                                <CardDescription>Enter your student ID and contact information</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Student ID *</label>
                                    <Input
                                        value={studentId}
                                        onChange={(e) => setStudentId(e.target.value)}
                                        placeholder="e.g., 2021-12345"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Mobile Number *</label>
                                    <Input
                                        type="tel"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        placeholder="e.g., 09123456789"
                                    />
                                    <p className="text-xs text-gray-500">
                                        You'll receive SMS notifications about your queue status
                                    </p>
                                </div>
                                <Button onClick={handleNext} className="w-full">
                                    Continue
                                    <ArrowRight className="h-5 w-5 ml-2" />
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {step === 2 && (
                        <Card>
                            <CardHeader className="text-center">
                                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <MapPin className="h-8 w-8 text-blue-600" />
                                </div>
                                <CardTitle>Select Service Point</CardTitle>
                                <CardDescription>Choose the service you need assistance with</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {servicePoints.map((service) => (
                                    <Card
                                        key={service.id}
                                        className={`cursor-pointer transition-all ${selectedService?.id === service.id
                                                ? 'ring-2 ring-blue-500 bg-blue-50'
                                                : 'hover:shadow-md'
                                            } ${!service.isOpen ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        onClick={() => service.isOpen && setSelectedService(service)}
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                                        {service.icon}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold">{service.name}</h3>
                                                        <p className="text-sm text-gray-600">{service.description}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right space-y-2">
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
                                                    <Badge variant={service.isOpen ? "default" : "destructive"}>
                                                        {service.isOpen ? 'Open' : 'Closed'}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                <div className="flex gap-4 pt-4">
                                    <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                                        <ArrowLeft className="h-5 w-5 mr-2" />
                                        Back
                                    </Button>
                                    <Button onClick={handleNext} className="flex-1">
                                        Continue
                                        <ArrowRight className="h-5 w-5 ml-2" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {step === 3 && selectedService && (
                        <Card>
                            <CardHeader className="text-center">
                                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle className="h-8 w-8 text-blue-600" />
                                </div>
                                <CardTitle>Confirm Details</CardTitle>
                                <CardDescription>Please verify your information before generating queue number</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <Card className="bg-gray-50">
                                    <CardHeader>
                                        <CardTitle className="text-lg">Student Information</CardTitle>
                                    </CardHeader>
                                    <CardContent>
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
                                    </CardContent>
                                </Card>

                                <Card className="bg-gray-50">
                                    <CardHeader>
                                        <CardTitle className="text-lg">Selected Service</CardTitle>
                                    </CardHeader>
                                    <CardContent>
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
                                    </CardContent>
                                </Card>

                                <Card className="bg-blue-50">
                                    <CardContent className="pt-6">
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
                                    </CardContent>
                                </Card>

                                <div className="flex gap-4">
                                    <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                                        <ArrowLeft className="h-5 w-5 mr-2" />
                                        Back
                                    </Button>
                                    <Button onClick={handleGenerateQueue} disabled={isGenerating} className="flex-1">
                                        {isGenerating ? (
                                            <>
                                                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                Generate Queue Number
                                                <ArrowRight className="h-5 w-5 ml-2" />
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {step === 4 && queueNumber && selectedService && (
                        <Card>
                            <CardContent className="pt-8 text-center">
                                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <CheckCircle className="h-10 w-10 text-green-600" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Queue Number Generated!</h2>
                                <p className="text-gray-600 mb-8">Your queue number has been successfully generated</p>

                                <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white mb-8">
                                    <CardContent className="pt-8">
                                        <p className="text-blue-100 mb-2">Your Queue Number</p>
                                        <p className="text-4xl font-bold mb-4">{queueNumber}</p>
                                        <p className="text-blue-100">
                                            {selectedService.name} • Estimated wait: {selectedService.avgWaitTime}
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card className="bg-green-50 mb-8">
                                    <CardContent className="pt-6">
                                        <div className="flex items-center justify-center gap-2 mb-2">
                                            <MessageSquare className="h-5 w-5 text-green-600" />
                                            <span className="font-semibold text-green-800">SMS Notification Sent</span>
                                        </div>
                                        <p className="text-sm text-green-700">
                                            A confirmation message has been sent to {phoneNumber}
                                        </p>
                                    </CardContent>
                                </Card>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                    <Button asChild>
                                        <Link to={`/display/${selectedService.id}`}>
                                            View Queue Status
                                        </Link>
                                    </Button>
                                    <Button variant="outline" onClick={resetForm}>
                                        Generate Another
                                    </Button>
                                </div>

                                <div className="text-sm text-gray-500">
                                    <p>Keep your phone nearby for SMS updates</p>
                                    <p>Listen for voice announcements when your turn approaches</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}
