import { TopBar } from "../components/TopBar";
import { Nav } from "../components/Nav";
import { Hero } from "../components/Hero";
import { Features, Who, Steps } from "../components/Features";
import { Preview } from "../components/Preview";
import { Producers } from "../components/Producers";
import { Reviews } from "../components/Reviews";
import { Faq } from "../components/Faq";
import { Pricing } from "../components/Pricing";
import { Footer } from "../components/Footer";

export function Home() {
  return (
    <>
      <TopBar />
      <Nav />
      <main id="main">
        <Hero />
        <Features />
        <Who />
        <Preview />
        <Steps />
        <Producers />
        <Reviews />
        <Faq />
        <Pricing />
      </main>
      <Footer />
    </>
  );
}
