import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function WelcomePage({ onGetStarted }: { onGetStarted: () => void }) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 to-background p-4">
            <Card className="w-full max-w-md text-center shadow-lg">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold">
                        Welcome to JRMSU Queue Management
                    </CardTitle>
                    <CardDescription className="mt-2 text-lg text-muted-foreground">
                        Your seamless service experience starts here.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                    <img
                        src="/placeholder.svg?height=200&width=200"
                        alt="Queue Management System"
                        className="mb-4 rounded-lg"
                    />
                    <Button size="lg" onClick={onGetStarted}>
                        Get Started
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
