import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listPublicServices, type CatalogService } from "../api/client";
import { persistClientBrowseIntent } from "../auth/intent";
import "./Home.css";

type PopularShortcut = {
  matchNames: string[];
  label: string;
};

/** Compact hero pills — only shown when a matching public service exists. */
const POPULAR_SHORTCUTS: PopularShortcut[] = [
  { matchNames: ["Individual tax returns"], label: "Individual tax returns" },
  { matchNames: ["Freelance tax consult"], label: "Freelance taxes" },
  { matchNames: ["Small business bookkeeping"], label: "Small business" },
  { matchNames: ["Multi-state tax filing"], label: "Multi-state filing" },
  { matchNames: ["Startup tax consult"], label: "Startup tax support" },
];

type NeedCard = {
  matchNames: string[];
  title: string;
  blurb: string;
  icon: "return" | "freelance" | "books" | "states" | "startup" | "consult";
};

const BROWSE_BY_NEED: NeedCard[] = [
  {
    matchNames: ["Individual tax returns"],
    title: "Individual tax returns",
    blurb: "Federal and state filing support.",
    icon: "return",
  },
  {
    matchNames: ["Freelance tax consult"],
    title: "Freelance taxes",
    blurb: "1099 income and quarterly estimates.",
    icon: "freelance",
  },
  {
    matchNames: ["Small business bookkeeping"],
    title: "Small business bookkeeping",
    blurb: "Ongoing books and organization.",
    icon: "books",
  },
  {
    matchNames: ["Multi-state tax filing"],
    title: "Multi-state filing",
    blurb: "Income earned across state lines.",
    icon: "states",
  },
  {
    matchNames: ["Startup tax consult"],
    title: "Startup tax support",
    blurb: "Entity, payroll, and compliance.",
    icon: "startup",
  },
  {
    matchNames: ["Tax Filing", "Tax consultation"],
    title: "Tax consultation",
    blurb: "Talk through a specific situation.",
    icon: "consult",
  },
];

function findServiceByNames(
  services: CatalogService[],
  names: string[]
): CatalogService | undefined {
  for (const name of names) {
    const needle = name.trim().toLowerCase();
    const found = services.find((s) => s.name.trim().toLowerCase() === needle);
    if (found) return found;
  }
  return undefined;
}

function isRemoteLocation(value: string) {
  const v = value.trim().toLowerCase();
  return !v || v === "remote" || v === "anywhere" || v === "nationwide";
}

function NeedIcon({ kind }: { kind: NeedCard["icon"] }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  switch (kind) {
    case "return":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8M8 17h5" />
        </svg>
      );
    case "freelance":
      return (
        <svg {...common}>
          <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
        </svg>
      );
    case "books":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case "states":
      return (
        <svg {...common}>
          <path d="M4 20V10M12 20V4M20 20v-6" />
        </svg>
      );
    case "startup":
      return (
        <svg {...common}>
          <path d="M7 17L17 7M17 7H9M17 7v8" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5" />
          <path d="M12 17h.01" />
        </svg>
      );
  }
}

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [services, setServices] = useState<CatalogService[]>([]);
  const [needQuery, setNeedQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadServices() {
      try {
        const rows = await listPublicServices();
        if (!cancelled) setServices(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setServices([]);
      }
    }
    void loadServices();
    return () => {
      cancelled = true;
    };
  }, []);

  const popularShortcuts = useMemo(() => {
    return POPULAR_SHORTCUTS.map((item) => {
      const service = findServiceByNames(services, item.matchNames);
      return service ? { ...item, service } : null;
    }).filter(Boolean) as Array<PopularShortcut & { service: CatalogService }>;
  }, [services]);

  const needCards = useMemo(() => {
    const usedIds = new Set<number>();
    return BROWSE_BY_NEED.map((need) => {
      const service = findServiceByNames(services, need.matchNames);
      if (!service || usedIds.has(service.id)) return null;
      usedIds.add(service.id);
      return { ...need, service };
    }).filter(Boolean) as Array<NeedCard & { service: CatalogService }>;
  }, [services]);

  function onSearchSubmit(event: FormEvent) {
    event.preventDefault();
    persistClientBrowseIntent();
    const location = locationQuery.trim();
    // Specialty/need filtering is not supported on the directory yet.
    // Location uses the existing geographic search on /accountants.
    if (!isRemoteLocation(location)) {
      navigate(`/accountants?location=${encodeURIComponent(location)}`);
      return;
    }
    navigate("/accountants");
  }

  return (
    <div className="home-page">
      <section className="home-hero" aria-labelledby="home-hero-heading">
        <div className="home-container home-hero-inner">
          <p className="home-eyebrow">Tax help, without the guesswork</p>
          <h1 id="home-hero-heading" className="home-hero-title">
            Find the right tax professional for your situation.
          </h1>
          <p className="home-hero-lede">
            Compare specialties, services, and pricing. Message professionals before you
            decide.
          </p>

          <form className="home-search" onSubmit={onSearchSubmit} role="search">
            <div className="home-search-fields">
              <div className="home-search-field">
                <span className="home-search-icon" aria-hidden="true">
                  <SearchIcon />
                </span>
                <label className="visually-hidden" htmlFor="home-need-search">
                  What do you need help with?
                </label>
                <input
                  id="home-need-search"
                  type="search"
                  name="q"
                  value={needQuery}
                  onChange={(e) => setNeedQuery(e.target.value)}
                  placeholder="What do you need help with?"
                  className="home-search-input"
                  autoComplete="off"
                />
              </div>
              <div className="home-search-divider" aria-hidden="true" />
              <div className="home-search-field">
                <span className="home-search-icon" aria-hidden="true">
                  <PinIcon />
                </span>
                <label className="visually-hidden" htmlFor="home-location-search">
                  Remote or location
                </label>
                <input
                  id="home-location-search"
                  type="search"
                  name="location"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  placeholder="Remote or location"
                  className="home-search-input"
                  autoComplete="off"
                />
              </div>
              <button type="submit" className="home-search-submit">
                Search
              </button>
            </div>
          </form>

          {popularShortcuts.length > 0 && (
            <div className="home-popular" aria-label="Popular services">
              {popularShortcuts.map(({ service, label }) => (
                <Link
                  key={service.id}
                  to={`/services/${service.id}`}
                  className="home-popular-pill"
                >
                  {label}
                </Link>
              ))}
            </div>
          )}

          <ul className="home-trust-row">
            <li>
              <span className="home-trust-icon" aria-hidden="true">
                ○
              </span>
              Message before booking
            </li>
            <li>
              <span className="home-trust-icon" aria-hidden="true">
                ◇
              </span>
              See pricing upfront
            </li>
            <li>
              <span className="home-trust-icon" aria-hidden="true">
                ✓
              </span>
              Secure Stripe checkout
            </li>
          </ul>
        </div>
      </section>

      {needCards.length > 0 && (
        <section
          className="home-section"
          aria-labelledby="home-browse-need-heading"
        >
          <div className="home-container">
            <p className="home-section-eyebrow">Browse by need</p>
            <h2 id="home-browse-need-heading" className="home-section-title">
              What can we help you with?
            </h2>
            <p className="home-section-lede">
              Start with the service that best matches your situation.
            </p>
            <ul className="home-need-grid">
              {needCards.map(({ service, title, blurb, icon }) => (
                <li key={service.id}>
                  <Link to={`/services/${service.id}`} className="home-need-card">
                    <span className="home-need-icon">
                      <NeedIcon kind={icon} />
                    </span>
                    <span className="home-need-copy">
                      <span className="home-need-title">{title}</span>
                      <span className="home-need-blurb">{blurb}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section
        id="how-it-works"
        className="home-section"
        aria-labelledby="home-how-heading"
      >
        <div className="home-container">
          <p className="home-section-eyebrow">How it works</p>
          <h2 id="home-how-heading" className="home-section-title">
            Get help in three simple steps.
          </h2>
          <ol className="home-steps">
            <li>
              <span className="home-step-num">1</span>
              <div>
                <div className="home-step-title">Explore profiles</div>
                <p className="home-step-blurb">
                  Compare specialties, services, and pricing.
                </p>
              </div>
            </li>
            <li>
              <span className="home-step-num">2</span>
              <div>
                <div className="home-step-title">Ask questions</div>
                <p className="home-step-blurb">
                  Message professionals before deciding.
                </p>
              </div>
            </li>
            <li>
              <span className="home-step-num">3</span>
              <div>
                <div className="home-step-title">Book when ready</div>
                <p className="home-step-blurb">
                  Choose a service and schedule a consultation.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-container">
          <p className="home-disclaimer">
            TaxManFinder connects clients with independent tax professionals and does
            not provide tax advice directly.
          </p>
        </div>
      </footer>
    </div>
  );
}
