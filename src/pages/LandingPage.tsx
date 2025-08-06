import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Clock, Smartphone, Volume2, Shield, ArrowRight, Menu, X, MapPin, Phone, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function LandingPage() {
    const [isMenuOpen, setIsMenuOpen] = useState(false)

    const servicePoints = [
        { name: 'Registrar Office', queue: 12, avgWait: '15 min' },
        { name: 'Cashier', queue: 8, avgWait: '10 min' },
        { name: 'Library', queue: 5, avgWait: '5 min' },
        { name: 'Campus Clinic', queue: 3, avgWait: '8 min' },
        { name: 'NSTP/ROTC', queue: 7, avgWait: '12 min' }
    ]

    const features = [
        {
            icon: Smartphone,
            title: 'Student ID Integration',
            description: 'Generate queue numbers using your student ID - no physical tickets needed'
        },
        {
            icon: Volume2,
            title: 'Voice Announcements',
            description: 'Clear audio announcements when your turn arrives'
        },
        {
            icon: Clock,
            title: 'Real-time Updates',
            description: 'Live queue status and estimated waiting times'
        },
        {
            icon: Users,
            title: 'SMS Notifications',
            description: 'Get notified via SMS about your queue status'
        }
    ]

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
                                <Shield className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">JRMSU Queue</h1>
                                <p className="text-xs text-gray-600">Smart Queue Management</p>
                            </div>
                        </div>

                        {/* Mobile menu button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="md:hidden"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                        >
                            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                        </Button>

                        {/* Desktop navigation */}
                        <nav className="hidden md:flex items-center gap-6">
                            <Link to="/student" className="text-gray-600 hover:text-blue-600 transition-colors">
                                Student Portal
                            </Link>
                            <Link to="/login" className="text-gray-600 hover:text-blue-600 transition-colors">
                                Staff Login
                            </Link>
                            <Button asChild>
                                <Link to="/student">Get Queue Number</Link>
                            </Button>
                        </nav>
                    </div>

                    {/* Mobile navigation */}
                    {isMenuOpen && (
                        <nav className="md:hidden mt-4 pb-4 border-t pt-4">
                            <div className="flex flex-col gap-4">
                                <Link
                                    to="/student"
                                    className="text-gray-600 hover:text-blue-600 transition-colors"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    Student Portal
                                </Link>
                                <Link
                                    to="/login"
                                    className="text-gray-600 hover:text-blue-600 transition-colors"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    Staff Login
                                </Link>
                                <Button asChild className="w-full">
                                    <Link to="/student" onClick={() => setIsMenuOpen(false)}>
                                        Get Queue Number
                                    </Link>
                                </Button>
                            </div>
                        </nav>
                    )}
                </div>
            </header>

            {/* Hero Section */}
            <section className="container mx-auto px-4 py-16">
                <div className="text-center max-w-4xl mx-auto">
                    <Badge variant="secondary" className="mb-6">
                        <Shield className="h-4 w-4 mr-2" />
                        Jose Rizal Memorial State University
                    </Badge>
                    <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
                        Smart Queue Management
                        <span className="block text-blue-600">for JRMSU Students</span>
                    </h1>
                    <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
                        Skip the physical lines. Get your queue number digitally, receive SMS updates,
                        and know exactly when it's your turn across all university service points.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button size="lg" asChild>
                            <Link to="/student">
                                Get Queue Number
                                <ArrowRight className="h-5 w-5 ml-2" />
                            </Link>
                        </Button>
                        <Button variant="outline" size="lg" asChild>
                            <Link to="/display/registrar">View Queue Status</Link>
                        </Button>
                    </div>
                </div>
            </section>

            {/* Live Service Points */}
            <section className="container mx-auto px-4 py-16">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">Live Service Points</h2>
                    <p className="text-gray-600">Current queue status across JRMSU service centers</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {servicePoints.map((point, index) => (
                        <Card key={index} className="hover:shadow-lg transition-shadow">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg">{point.name}</CardTitle>
                                    <Badge variant="secondary" className="text-xs">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1"></div>
                                        Live
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <p className="text-2xl font-bold text-blue-600">{point.queue}</p>
                                        <p className="text-sm text-gray-500">In Queue</p>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-orange-600">{point.avgWait}</p>
                                        <p className="text-sm text-gray-500">Avg Wait</p>
                                    </div>
                                </div>
                                <Button variant="outline" className="w-full" asChild>
                                    <Link to={`/display/${point.name.toLowerCase().replace(/\s+/g, '-')}`}>
                                        View Details
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Features */}
            <section className="bg-white py-16">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Choose Digital Queue?</h2>
                        <p className="text-gray-600">Modern features designed for student convenience</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {features.map((feature, index) => (
                            <Card key={index} className="text-center border-0 shadow-none">
                                <CardContent className="pt-6">
                                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <feature.icon className="h-8 w-8 text-blue-600" />
                                    </div>
                                    <CardTitle className="text-xl mb-2">{feature.title}</CardTitle>
                                    <CardDescription>{feature.description}</CardDescription>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* Stats */}
            <section className="bg-blue-600 py-16 text-white">
                <div className="container mx-auto px-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                        <div>
                            <div className="text-3xl md:text-4xl font-bold mb-2">2,500+</div>
                            <div className="text-blue-100">Students Served Daily</div>
                        </div>
                        <div>
                            <div className="text-3xl md:text-4xl font-bold mb-2">5</div>
                            <div className="text-blue-100">Service Points</div>
                        </div>
                        <div>
                            <div className="text-3xl md:text-4xl font-bold mb-2">65%</div>
                            <div className="text-blue-100">Reduced Wait Time</div>
                        </div>
                        <div>
                            <div className="text-3xl md:text-4xl font-bold mb-2">24/7</div>
                            <div className="text-blue-100">System Availability</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-900 text-white py-12">
                <div className="container mx-auto px-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                                    <Shield className="h-5 w-5" />
                                </div>
                                <span className="text-xl font-bold">JRMSU Queue</span>
                            </div>
                            <p className="text-gray-400">
                                Smart queue management system for Jose Rizal Memorial State University
                            </p>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
                            <div className="space-y-2">
                                <Link to="/student" className="block text-gray-400 hover:text-white transition-colors">
                                    Student Portal
                                </Link>
                                <Link to="/login" className="block text-gray-400 hover:text-white transition-colors">
                                    Staff Login
                                </Link>
                                <Link to="/admin" className="block text-gray-400 hover:text-white transition-colors">
                                    Admin Dashboard
                                </Link>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold mb-4">Contact</h3>
                            <div className="space-y-2 text-gray-400">
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4" />
                                    <span>JRMSU Main Campus, Dapitan City</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4" />
                                    <span>(065) 213-2324</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4" />
                                    <span>queue@jrmsu.edu.ph</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
                        <p>&copy; 2025 Jose Rizal Memorial State University. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    )
}
