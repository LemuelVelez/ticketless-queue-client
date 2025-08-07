import { useState } from "react";
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Building2, Clock, MessageSquare, Phone } from 'lucide-react';

const servicePoints = [
    { id: "registrar", name: "Registrar's Office", description: "Transcripts, Enrollment, Records", icon: "📋", estimatedWait: "15-20 min" },
    { id: "cashier", name: "Cashier", description: "Payments, Fees, Receipts", icon: "💰", estimatedWait: "10-15 min" },
    { id: "library", name: "Library", description: "Book Borrowing, Returns", icon: "📚", estimatedWait: "5-10 min" },
    { id: "clinic", name: "Campus Clinic", description: "Medical Consultations", icon: "🏥", estimatedWait: "20-25 min" },
    { id: "nstp", name: "NSTP Office", description: "NSTP Processing, Requirements", icon: "🎯", estimatedWait: "10-15 min" },
    { id: "rotc", name: "ROTC Office", description: "ROTC Processing, Requirements", icon: "🎖️", estimatedWait: "10-15 min" }
];

export default function LoginPage() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [studentId, setStudentId] = useState("");
    const [selectedService, setSelectedService] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [loading, setLoading] = useState(false);

    const handleBack = () => {
        navigate('/');
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedService) {
            toast.error("Please select a service point.");
            return;
        }

        if (!phoneNumber) {
            toast.error("Please provide your mobile number for SMS notifications.");
            return;
        }

        setLoading(true);

        // Simulate API call for student verification and queue generation
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Simulate student ID validation (in real implementation, this would check against JRMSU database)
        const isValidStudentId = /^\d{4}-\d{4}$/.test(studentId) || studentId === "12345";

        if (isValidStudentId) {
            const selectedServicePoint = servicePoints.find(sp => sp.id === selectedService);
            if (selectedServicePoint) {
                const queueNumber = `${selectedServicePoint.name.substring(0, 1)}-${Math.floor(Math.random() * 100) + 1}`;
                const queueData = {
                    service: selectedServicePoint.name,
                    queueNumber: queueNumber,
                    estimatedWaitTime: selectedServicePoint.estimatedWait,
                    servicePoint: selectedServicePoint.name,
                    phoneNumber: phoneNumber
                };

                toast.success(
                    `Queue number generated successfully! Your number is ${queueNumber} for ${selectedServicePoint.name}. SMS notification sent to +63${phoneNumber}.`
                );

                // Use auth context to login and navigate to dashboard
                login(studentId, queueData);
                navigate('/student');
            }
        } else {
            toast.error("Invalid Student ID format. Please use format: YYYY-NNNN (e.g., 2021-0001)");
        }

        setLoading(false);
    };

    const selectedServicePoint = servicePoints.find(sp => sp.id === selectedService);

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4">
            {/* Header */}
            <div className="max-w-md mx-auto pt-4 mb-6">
                <Button
                    variant="ghost"
                    onClick={handleBack}
                    className="mb-4 text-gray-600 hover:text-gray-900"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Welcome
                </Button>
                <div className="text-center">
                    <h1 className="text-xl font-bold text-gray-900">JRMSU Queue Management</h1>
                    <p className="text-sm text-gray-600">Generate Your Queue Number</p>
                </div>
            </div>

            {/* Main Form Card */}
            <div className="flex justify-center">
                <Card className="w-full max-w-md shadow-xl border-0 bg-white/90 backdrop-blur-sm">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl font-bold text-gray-900">Student Queue Registration</CardTitle>
                        <CardDescription className="text-gray-600">
                            Enter your details to join the service queue
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleLogin} className="space-y-6">
                            {/* Student ID Input */}
                            <div className="space-y-2">
                                <Label htmlFor="studentId" className="text-sm font-medium text-gray-700">
                                    Student ID <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="studentId"
                                    type="text"
                                    placeholder="e.g., 2021-0001"
                                    value={studentId}
                                    onChange={(e) => setStudentId(e.target.value)}
                                    required
                                    className="text-center font-mono text-lg"
                                />
                                <p className="text-xs text-gray-500">Format: YYYY-NNNN</p>
                            </div>

                            {/* Service Point Selection */}
                            <div className="space-y-2">
                                <Label htmlFor="service" className="text-sm font-medium text-gray-700">
                                    Select Service Point <span className="text-red-500">*</span>
                                </Label>
                                <Select value={selectedService} onValueChange={setSelectedService} required>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose your service point" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {servicePoints.map((service) => (
                                            <SelectItem key={service.id} value={service.id}>
                                                <div className="flex items-center gap-2">
                                                    <span>{service.icon}</span>
                                                    <div>
                                                        <p className="font-medium">{service.name}</p>
                                                        <p className="text-xs text-gray-500">{service.description}</p>
                                                    </div>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Mobile Number Input */}
                            <div className="space-y-2">
                                <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                                    Mobile Number <span className="text-red-500">*</span>
                                </Label>
                                <div className="flex">
                                    <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 border border-r-0 border-gray-300 rounded-l-md">
                                        +63
                                    </span>
                                    <Input
                                        id="phone"
                                        type="tel"
                                        placeholder="9XX XXX XXXX"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        required
                                        className="rounded-l-none"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                    <MessageSquare className="h-3 w-3" />
                                    SMS notifications will be sent to this number
                                </p>
                            </div>

                            {/* Service Point Info */}
                            {selectedServicePoint && (
                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Building2 className="h-5 w-5 text-blue-600" />
                                        <div>
                                            <p className="font-medium text-blue-900">{selectedServicePoint.name}</p>
                                            <p className="text-sm text-blue-700">{selectedServicePoint.description}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-blue-600">
                                        <Clock className="h-4 w-4" />
                                        <span>Estimated wait time: {selectedServicePoint.estimatedWait}</span>
                                    </div>
                                </div>
                            )}

                            {/* Submit Button */}
                            <Button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-semibold"
                                disabled={loading}
                            >
                                {loading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Generating Queue Number...
                                    </div>
                                ) : (
                                    "Generate Queue Number"
                                )}
                            </Button>

                            {/* Info Text */}
                            <div className="text-center space-y-2">
                                <p className="text-xs text-gray-500">
                                    You will receive SMS notifications about your queue status
                                </p>
                                <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
                                    <span className="flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        SMS Updates
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <MessageSquare className="h-3 w-3" />
                                        Real-time Status
                                    </span>
                                </div>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>

            {/* Footer */}
            <div className="text-center mt-8 text-xs text-gray-500">
                <p>© 2025 Jose Rizal Memorial State University</p>
                <p>Ticketless Queue Management System</p>
            </div>
        </div>
    );
}
