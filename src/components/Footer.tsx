import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { QrCode } from "lucide-react"

export default function Footer() {
    return (
        <footer className="mt-14 border-t bg-background">
            <div className="mx-auto max-w-6xl px-4 py-10">
                <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
                    <div className="max-w-md">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg border">
                                <QrCode className="h-5 w-5" />
                            </div>
                            <div className="leading-tight">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold">QueuePass</span>
                                    <Badge variant="secondary">Ticketless</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    QR-based student ID queueing with SMS notification, voice announcement, and public display.
                                </p>
                            </div>
                        </div>

                        <Separator className="my-5" />

                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" asChild>
                                <a href="/admin/login">Admin</a>
                            </Button>
                            <Button variant="outline" asChild>
                                <a href="/staff/login">Staff</a>
                            </Button>
                            <Button asChild>
                                <a href="/join">Join Queue</a>
                            </Button>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <p className="text-sm font-medium">Explore</p>
                        <Button variant="link" className="h-auto justify-start p-0" asChild>
                            <a href="#why">Why this exists</a>
                        </Button>
                        <Button variant="link" className="h-auto justify-start p-0" asChild>
                            <a href="#how">How it works</a>
                        </Button>
                        <Button variant="link" className="h-auto justify-start p-0" asChild>
                            <a href="#features">Features</a>
                        </Button>
                        <Button variant="link" className="h-auto justify-start p-0" asChild>
                            <a href="#roles">Roles</a>
                        </Button>
                        <Button variant="link" className="h-auto justify-start p-0" asChild>
                            <a href="#faq">FAQ</a>
                        </Button>
                    </div>
                </div>

                <Separator className="my-8" />

                <div className="flex flex-col gap-2 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
                    <span>© {new Date().getFullYear()} QueuePass. All rights reserved.</span>
                    <span>Built for school offices: Registrar, Cashier, Library, Clinic, NSTP/ROTC, and more.</span>
                </div>
            </div>
        </footer>
    )
}
