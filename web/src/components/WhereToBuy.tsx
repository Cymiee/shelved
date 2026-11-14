import type { IGDBGame } from "@gameboxd/lib";
import { getStoreLinks, affiliateConfig } from "../lib/stores";
import type { StoreLink } from "../lib/stores";
import { ShelfHeader } from "./Shelf";
import { color, space } from "../theme";

interface Props {
  game: IGDBGame;
}

/**
 * Where to get the game. Official storefronts first; shops that pay Shelved a
 * commission follow under their own heading, with the disclosure those
 * programmes require. Renders nothing when there is nowhere to send people.
 */
export default function WhereToBuy({ game }: Props) {
  const { official, shops, hasAmazon } = getStoreLinks(game, affiliateConfig);
  if (official.length === 0 && shops.length === 0) return null;

  return (
    <section style={{ marginTop: space[8] }}>
      <ShelfHeader title="Where to buy" />

      {official.length > 0 && <StoreRow links={official} />}

      {shops.length > 0 && (
        <div style={{ marginTop: official.length > 0 ? space[5] : 0 }}>
          <h3 className="label" style={{ marginBottom: space[2] }}>Key and disc shops</h3>
          <StoreRow links={shops} />
          <p style={{ marginTop: space[3], fontSize: "var(--text-xs)", color: color.textMuted, maxWidth: "62ch" }}>
            Shelved may earn a small commission if you buy through these links, at no extra cost to you.
            {hasAmazon && " As an Amazon Associate, Shelved earns from qualifying purchases."}
          </p>
        </div>
      )}
    </section>
  );
}

function StoreRow({ links }: { links: StoreLink[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: space[3] }}>
      {links.map((link) => (
        <a
          key={link.id}
          className="btn-key btn-key--wall"
          href={link.url}
          target="_blank"
          // Affiliate networks attribute through their own redirect, so the
          // referrer can be dropped everywhere; "sponsored" tells search
          // engines which links are paid.
          rel={link.affiliate ? "sponsored noopener noreferrer" : "noopener noreferrer"}
        >
          {link.name}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
            <path d="M14 4h6v6M20 4 10 14M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="visually-hidden"> (opens in a new tab)</span>
        </a>
      ))}
    </div>
  );
}
