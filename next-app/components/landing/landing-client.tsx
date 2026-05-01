"use client";

import { Navbar } from "@/components/landing/navbar";
import HeroSection from "@/components/landing/ui/hero-section-one";
import Features from "@/components/landing/ui/features-3";
import Stats from "@/components/landing/ui/stats-2";
import Testimonials from "@/components/landing/ui/testimonials-1";
import FAQs from "@/components/landing/ui/faqs-1";
import Footer from "@/components/landing/ui/footer-5";

export default function LandingClient() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <Features />
        <Stats />
        <Testimonials />
        <FAQs />
      </main>
      <Footer />
    </div>
  );
}
