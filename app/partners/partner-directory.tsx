import Image from "next/image";

const partners = [
  {
    key: "alphachaser",
    name: "AlphaChaser",
    kicker: "Automated subnet trading · By Gordon Frayne",
    description: "Gordon Frayne’s Bittensor trading app scans subnet signals and automates trades through a staking-only wallet proxy, with positions, trade history, and strategy views in one dashboard.",
    href: "https://alphachaser.co/",
    cta: "Explore AlphaChaser",
    offer: {
      headline: "25% off your first 2 months",
      code: "SHIZZY25",
      price: "$51.75/month for 2 months, then $69/month.",
      terms: "New customers only. Prices in USD. Enter the code at checkout.",
    },
  },
  {
    key: "mentat",
    name: "Mentat",
    kicker: "TAO delegation",
    description: "Automated Bittensor staking strategies designed to keep your TAO delegated across strong validator opportunities.",
    href: "https://mentatminds.com/?origin=ShizzyUnchained",
    cta: "Explore Mentat",
  },
  {
    key: "saygm",
    name: "SayGM",
    kicker: "SN28 · AI models and developer tools",
    description: "Access Claude, GPT, Gemini, and open models through one Bittensor-powered AI gateway. Use SayGM’s desktop app, CLI, or compatible APIs with pay-as-you-go pricing.",
    href: "https://saygm.com/r/qm2gl6jx",
    cta: "Try SayGM",
  },
  {
    key: "engy",
    name: "engy",
    kicker: "SN53 · AI inference",
    description: "Access open AI models through engy’s chat interface and inference API. Explore models for text, image, and video tasks with usage-based pricing.",
    href: "https://engy.ai/r/ShizzyUnchained",
    cta: "Try engy",
  },
  {
    key: "alphagap",
    name: "Alpha Gap",
    kicker: "Subnet intelligence",
    description: "AI-powered Bittensor research tracking development, market signals, whale activity, emissions, and all active subnets.",
    href: "https://www.alphagap.io/?ref=SHIZ",
    cta: "Find the Alpha Gap",
  },
  {
    key: "btcc",
    name: "BTCC",
    kicker: "Crypto exchange · Referral code SHIZZY",
    description: "Explore BTCC’s markets and trading platform through Shizzy Unchained’s customer referral link. Use code SHIZZY when registering. Product availability and terms vary by region.",
    href: "https://partner.btcc.com/us/c/SHIZZY/94759937",
    cta: "Explore BTCC",
  },
  {
    key: "kraken",
    name: "Kraken",
    kicker: "Crypto exchange · Referral welcome offer",
    description: "Buy, sell, and manage crypto with Kraken. Use Shizzy’s invite link to view the current welcome offer: a random reward of up to $300 after a qualifying $200 deposit and $200 in trades. Eligibility, deadlines, and regional terms apply.",
    href: "https://invite.kraken.com/JDNW/bi12c5ws",
    cta: "Explore Kraken & offer",
  },
  {
    key: "ledger",
    name: "Ledger",
    kicker: "Hardware security",
    description: "Protect and manage crypto with a secure hardware wallet and the Ledger ecosystem built for self-custody.",
    href: "https://shop.ledger.com/?r=50075a40888b&tracker=MY_TRACKER",
    cta: "Shop Ledger",
  },
  {
    key: "nord",
    name: "NordVPN",
    kicker: "Online privacy",
    description: "Add an encrypted layer of protection to your internet connection across desktop, mobile, and public networks.",
    href: "https://go.nordvpn.net/aff_c?offer_id=15&aff_id=145365&source=Shizzy",
    cta: "Get NordVPN",
  },
];

export function PartnerDirectory() { return (
        <section className="partners-page">
          <div className="partners-hero">
            <p className="eyebrow">Tools Shizzy trusts</p>
            <h1>
              Power your journey.
              <br />
              <span>Meet our partners.</span>
            </h1>
            <p>Research smarter, protect your assets, strengthen your privacy, and put your TAO to work with handpicked products from across the ecosystem.</p>
          </div>
          <div className="partner-grid">
            {partners.map((partner, index) => (
              <a id={partner.key} className={`partner-banner ${partner.key}`} href={partner.href} target="_blank" rel="sponsored noreferrer" key={partner.name}>
                <div className="partner-number">0{index + 1}</div>
                <div className="partner-logo" aria-hidden="true">
                  {partner.key === "alphachaser" ? (
                    <>
                      <Image src="/partners/alphachaser.svg" alt="" width={44} height={44} unoptimized />
                      <span>AlphaChaser.</span>
                    </>
                  ) : partner.key === "saygm" || partner.key === "engy" ? (
                    <>
                      <Image src={`/partners/${partner.key}.svg`} alt="" width={44} height={38} unoptimized />
                      <span>{partner.name}</span>
                    </>
                  ) : (
                    <Image src={`/partners/${partner.key}.svg`} alt="" width={720} height={158} unoptimized />
                  )}
                </div>
                <div className="partner-copy">
                  <span>{partner.kicker}</span>
                  <h2>{partner.name}</h2>
                  <p>{partner.description}</p>
                </div>
                {partner.offer && (
                  <div className="partner-offer">
                    <span className="partner-offer-label">Shizzy community offer</span>
                    <h3>{partner.offer.headline}</h3>
                    <div className="partner-offer-code"><span>Use code</span><code>{partner.offer.code}</code></div>
                    <p>{partner.offer.price}</p>
                    <small>{partner.offer.terms}</small>
                  </div>
                )}
                <strong>
                  {partner.cta}
                  <b>↗</b>
                </strong>
              </a>
            ))}
          </div>
          <div className="partner-note">
            <span>Shizzy-approved resources</span>
            <p>Some links and discount codes are affiliate referrals. If you use them, Shizzy Unchained may earn a commission or referral reward at no additional cost to you.</p>
          </div>
        </section>
); }
