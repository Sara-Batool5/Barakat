import { Navbar } from "../components/Navbar";
import { Hero } from "../sections/Hero";
import { Strip } from "../sections/Strip";
import { HowItWorks } from "../sections/HowItWorks";
import { SafetyTiers } from "../sections/SafetyTiers";
import { WhoItsFor } from "../sections/WhoItsFor";
import { AgentSection } from "../sections/AgentSection";
import { Faq } from "../sections/Faq";
import { CtaBanner } from "../sections/CtaBanner";
import { Footer } from "../sections/Footer";

export default function Landing() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Strip />
        <HowItWorks />
        <SafetyTiers />
        <WhoItsFor />
        <AgentSection />
        <Faq />
        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}
