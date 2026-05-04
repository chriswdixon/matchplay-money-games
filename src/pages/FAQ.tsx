import { useEffect } from "react";
import { Link } from "react-router-dom";

const FAQS = [
  {
    q: "What is Tyche?",
    a: "Tyche is a competitive gaming platform for golfers. Players join skill-based golf matches with entry fees and Play Money prizes. Every account starts with $500 of Play Money. Tyche does not handle real-money wagering or payouts.",
  },
  {
    q: "Is Tyche real-money gambling?",
    a: "No. Tyche uses Play Money only. There is no real-money wagering, deposits, or payouts on the platform.",
  },
  {
    q: "Who can use Tyche?",
    a: "Adults aged 18 and older in supported regions. Tyche is geo-blocked in U.S. states where skill-based competitions are restricted.",
  },
  {
    q: "What golf formats does Tyche support?",
    a: "Match Play (2 players), Team (4 players, 2 vs 2), and Stroke Play (manual player count). Matches can be played over 9 or 18 holes.",
  },
  {
    q: "Does the scorecard work offline on the course?",
    a: "Yes. Tyche is a Progressive Web App with offline score entry. Scores sync automatically when connectivity returns.",
  },
  {
    q: "How is the course handicap calculated?",
    a: "Tyche uses a simplified USGA-style course handicap calculation with a fixed slope rating of 113.",
  },
  {
    q: "How do I sign up?",
    a: "Visit the sign-up page at /auth?tab=signup. A beta invite code is currently required for non-Tyche staff emails.",
  },
  {
    q: "How are prizes paid out?",
    a: "Prizes are credited as Play Money to the winners' in-app wallets. There are no real-money payouts.",
  },
  {
    q: "What happens if a match is cancelled?",
    a: "Players are refunded their entry fee minus a $2 cancellation fee, paid in Play Money.",
  },
  {
    q: "Is my data private?",
    a: "Yes. Tyche follows GDPR principles, uses Postgres Row-Level Security to protect data, and minimizes PII retention. Users can request account deletion at any time.",
  },
  {
    q: "How do I install Tyche on my phone?",
    a: "On Android/Chrome, choose 'Install app' from the browser menu. On iOS, open Tyche in Safari and tap 'Add to Home Screen'.",
  },
];

export default function FAQ() {
  useEffect(() => {
    document.title = "Tyche FAQ — Competitive Golf Q&A";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "Answers about Tyche: how match play, stroke play, handicaps, Play Money prizes, offline scoring, and account access work."
      );
    }
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = "https://match-play.co/faq";
  }, []);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="max-w-3xl mx-auto px-4 py-12">
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Tyche <span className="text-accent">FAQ</span>
          </h1>
          <p className="mt-2 text-muted-foreground">
            Quick answers about Tyche — built for both players and AI assistants.
          </p>
        </header>

        <section className="space-y-6">
          {FAQS.map((f) => (
            <div key={f.q} className="rounded-lg border border-border p-5">
              <h2 className="text-lg font-semibold">{f.q}</h2>
              <p className="mt-2 text-muted-foreground leading-relaxed">{f.a}</p>
            </div>
          ))}
        </section>

        <footer className="mt-10 text-sm text-muted-foreground">
          <p>
            Still have questions? <Link className="underline" to="/auth?tab=signup">Join Tyche</Link> or read our{" "}
            <Link className="underline" to="/terms">Terms</Link> and{" "}
            <Link className="underline" to="/privacy">Privacy Policy</Link>.
          </p>
        </footer>
      </article>
    </main>
  );
}
