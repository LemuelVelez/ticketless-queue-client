import Header from "@/components/Header"
import Footer from "@/components/Footer"
import Hero from "@/components/Hero"
import WhyThisExist from "@/components/WhyThisExist"
import HowThisWorks from "@/components/HowThisWorks"
import Features from "@/components/Features"
import Roles from "@/components/Roles"
import FAQ from "@/components/FAQ"
import CTA from "@/components/CTA"
import { Separator } from "@/components/ui/separator"

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <Header />

            <main className="mx-auto max-w-6xl px-4">
                <Hero />

                <Separator className="my-12" />

                <WhyThisExist />

                <Separator className="my-12" />

                <HowThisWorks />

                <Separator className="my-12" />

                <Features />

                <Separator className="my-12" />

                <Roles />

                <Separator className="my-12" />

                <FAQ />

                <Separator className="my-12" />

                <CTA />
            </main>

            <Footer />
        </div>
    )
}
