import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Users, MessageSquare, Volume2, Building2, GraduationCap } from 'lucide-react';

export default function WelcomePage() {
    const navigate = useNavigate();

    const handleGetStarted = () => {
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4">
            {/* Header Section */}
            <div className="text-center mb-8 pt-8">
                <div className="flex flex-col items-center justify-center gap-3 mb-4">
                    <GraduationCap className="h-12 w-12 text-blue-600" />
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">JRMSU</h1>
                        <p className="text-sm text-gray-600">Jose Rizal Memorial State University</p>
                    </div>
                </div>
                <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                    Ticketless Queue Management System
                </h2>
                <p className="text-gray-600 max-w-2xl mx-auto">
                    Streamlined service delivery with SMS notifications and voiceover features for all JRMSU service points
                </p>
            </div>

            {/* Main Welcome Card */}
            <div className="flex justify-center mb-8">
                <Card className="w-full max-w-2xl shadow-xl border-0 bg-white/80 backdrop-blur-sm">
                    <CardHeader className="text-center pb-4">
                        <CardTitle className="text-2xl font-bold text-gray-900">
                            Welcome to Digital Queue Management
                        </CardTitle>
                        <CardDescription className="text-lg text-gray-600 mt-2">
                            Your seamless service experience starts here. No more physical queues, no more waiting in crowded areas.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Service Points */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                            <div className="text-center p-3 bg-blue-50 rounded-lg">
                                <Building2 className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                                <p className="text-sm font-medium text-gray-700">Registrar</p>
                            </div>
                            <div className="text-center p-3 bg-green-50 rounded-lg">
                                <Building2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                                <p className="text-sm font-medium text-gray-700">Cashier</p>
                            </div>
                            <div className="text-center p-3 bg-purple-50 rounded-lg">
                                <Building2 className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                                <p className="text-sm font-medium text-gray-700">Library</p>
                            </div>
                            <div className="text-center p-3 bg-red-50 rounded-lg">
                                <Building2 className="h-8 w-8 text-red-600 mx-auto mb-2" />
                                <p className="text-sm font-medium text-gray-700">Clinic</p>
                            </div>
                            <div className="text-center p-3 bg-yellow-50 rounded-lg">
                                <Building2 className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                                <p className="text-sm font-medium text-gray-700">NSTP</p>
                            </div>
                            <div className="text-center p-3 bg-indigo-50 rounded-lg">
                                <Building2 className="h-8 w-8 text-indigo-600 mx-auto mb-2" />
                                <p className="text-sm font-medium text-gray-700">ROTC</p>
                            </div>
                        </div>

                        {/* Features */}
                        <div className="grid md:grid-cols-2 gap-4 mb-6">
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                <Clock className="h-6 w-6 text-blue-600 flex-shrink-0" />
                                <div>
                                    <p className="font-medium text-gray-900">Real-time Updates</p>
                                    <p className="text-sm text-gray-600">Live queue status and wait times</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                <MessageSquare className="h-6 w-6 text-green-600 flex-shrink-0" />
                                <div>
                                    <p className="font-medium text-gray-900">SMS Notifications</p>
                                    <p className="text-sm text-gray-600">Get notified when it's your turn</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                <Volume2 className="h-6 w-6 text-purple-600 flex-shrink-0" />
                                <div>
                                    <p className="font-medium text-gray-900">Voiceover Calls</p>
                                    <p className="text-sm text-gray-600">Audio announcements for accessibility</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                <Users className="h-6 w-6 text-orange-600 flex-shrink-0" />
                                <div>
                                    <p className="font-medium text-gray-900">Multi-Service Support</p>
                                    <p className="text-sm text-gray-600">All campus service points integrated</p>
                                </div>
                            </div>
                        </div>

                        {/* CTA Button */}
                        <div className="text-center">
                            <Button
                                size="lg"
                                onClick={handleGetStarted}
                                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-8 py-3 text-base sm:text-lg font-semibold"
                            >
                                <span className="hidden sm:inline">Get Started - Generate Queue Number</span>
                                <span className="sm:hidden">Generate Queue Number</span>
                            </Button>
                            <p className="text-sm text-gray-500 mt-2">
                                Use your Student ID to join the queue
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Footer */}
            <div className="text-center text-sm text-gray-500">
                <p>© 2025 Jose Rizal Memorial State University</p>
                <p>ZNAC, Tampilisan, Zamboanga del Norte</p>
            </div>
        </div>
    );
}
