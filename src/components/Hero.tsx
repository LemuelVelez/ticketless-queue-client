/* eslint-disable @typescript-eslint/no-explicit-any */
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { BellRing, QrCode, Tv2, Volume2 } from "lucide-react"

import heroImage from "@/assets/images/heroImage.svg"
import { useSession } from "@/hooks/use-session"

export default function Hero() {
    const { user, loading } = useSession()
    const dashboardPath = user?.role === "ADMIN" ? "/admin/dashboard" : "/staff/dashboard"

    return (
        <section className="py-12 md:py-16">
            <div className="grid gap-8 md:grid-cols-2 md:items-start">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="gap-1">
                            <QrCode className="h-3.5 w-3.5" />
                            QR-based entry
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                            <BellRing className="h-3.5 w-3.5" />
                            SMS notification
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                            <Volume2 className="h-3.5 w-3.5" />
                            Voice announcement
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                            <Tv2 className="h-3.5 w-3.5" />
                            Public display
                        </Badge>
                    </div>

                    <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
                        QueuePass: ticketless student ID queueing for school offices
                    </h1>
                    <p className="mt-4 text-pretty text-muted-foreground">
                        Students scan a QR code, enter their Student ID, and get a virtual queue number. Staff can call
                        next, recall, serve, and HOLD no-shows—while the public display updates in real time with SMS +
                        voice announcements.
                    </p>

                    <div className="mt-6 flex flex-wrap gap-2">
                        <Button asChild>
                            <a href="/join">Join Queue</a>
                        </Button>

                        {!loading && user ? (
                            <Button variant="outline" asChild>
                                <Link to={dashboardPath}>Dashboard</Link>
                            </Button>
                        ) : null}
                    </div>

                    <div className="mt-6">
                        <Separator className="my-4" />
                        <p className="text-sm text-muted-foreground">
                            Designed for Registrar, Cashier, Library, Clinic, NSTP/ROTC, and other student-facing
                            departments.
                        </p>
                    </div>
                </div>

                {/* Right column: hero image (Live display removed) */}
                <div className="flex justify-center">
                    <Card className="w-full max-w-70 overflow-hidden">
                        <CardContent className="p-3">
                            <img
                                src={heroImage}
                                alt="QueuePass hero illustration"
                                className="h-full w-full object-contain rounded-circle"
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </section>
    )
}