import type { CardEntry, CardModel } from "@/lib/game/share-card";
import { memberLine } from "@/lib/game/teams";
import { OG_COLORS as C } from "@/lib/og/theme";
import { SITE_DOMAIN } from "@/lib/site";

/*
 * La tarjeta del resultado como imagen (Satori: solo flexbox y un subconjunto de CSS). Dos composiciones del
 * mismo contenido: apaisada para la vista previa del enlace y los chats, y vertical para estados e historias.
 * Los colores y las fuentes son los de la app (ver `src/lib/og/theme.ts`).
 */

export const CARD_SIZES = {
  wide: { width: 1200, height: 630 },
  tall: { width: 1080, height: 1350 },
} as const;
export type CardFormat = keyof typeof CARD_SIZES;

/** Tamaños de la letra según cuánto mide el nombre (los largos bajan para que no se salgan). */
const fit = (text: string, sizes: [xlong: number, long: number, mid: number, short: number]) =>
  text.length > 26 ? sizes[0] : text.length > 16 ? sizes[1] : text.length > 10 ? sizes[2] : sizes[3];

const STEP_BG = { 1: C.saffron, 2: C.sky, 3: C.tomato } as const;
const STEP_INK = { 1: C.ink, 2: C.ink, 3: "#FFFFFF" } as const;

interface Scale {
  colW: number;
  gap: number;
  name: number;
  members: number;
  score: number;
  pts: number;
  ordinal: number;
  steps: [first: number, second: number, third: number];
}

/** Las tres cintas de color de arriba, con la etiqueta de la marca encima. */
function Band({ brand, stripe, left, size }: { brand: string; stripe: number; left: number; size: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", position: "relative", height: stripe * 3 }}>
      <div style={{ display: "flex", height: stripe, background: C.saffron }} />
      <div style={{ display: "flex", height: stripe, background: C.tomato }} />
      <div style={{ display: "flex", height: stripe, background: C.sky }} />
      <div
        style={{
          display: "flex",
          position: "absolute",
          left,
          top: stripe * 0.55,
          padding: "6px 20px",
          borderRadius: 6,
          background: C.card,
          color: C.ink,
          fontSize: size,
          letterSpacing: 3,
          textTransform: "uppercase",
        }}
      >
        {brand}
      </div>
    </div>
  );
}

/** Podio de tres escalones (2.º, 1.º, 3.º de izquierda a derecha). */
function Podium({ entries, points, s }: { entries: CardEntry[]; points: string; s: Scale }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: s.gap }}>
      {[1, 0, 2].map((i) => {
        const e = entries[i];
        if (!e) return <div key={i} style={{ display: "flex", width: s.colW }} />;
        const tier = Math.min(e.place, 3) as 1 | 2 | 3;
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: s.colW }}>
            <div
              style={{
                display: "flex",
                maxWidth: s.colW,
                color: C.card,
                fontFamily: "Kalam",
                fontSize: fit(e.name, [s.name * 0.55, s.name * 0.7, s.name * 0.85, s.name]),
                lineHeight: 1.15,
                textAlign: "center",
                overflow: "hidden",
                textOverflow: "ellipsis",
                lineClamp: 2,
              }}
            >
              {e.name}
            </div>
            {e.members.length > 0 && (
              <div
                style={{
                  display: "flex",
                  maxWidth: s.colW,
                  color: C.onShellSoft,
                  fontSize: s.members,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {memberLine(e.members, 3)}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, color: C.saffron, margin: "4px 0 10px" }}>
              <span style={{ display: "flex", fontSize: s.score, lineHeight: 1 }}>{e.score}</span>
              <span style={{ display: "flex", fontSize: s.pts, color: C.onShellSoft, textTransform: "uppercase" }}>{points}</span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                width: s.colW,
                height: s.steps[tier - 1],
                paddingTop: 10,
                borderRadius: "10px 10px 0 0",
                background: STEP_BG[tier],
                color: STEP_INK[tier],
                fontSize: s.ordinal,
                lineHeight: 1,
              }}
            >
              {e.place}º
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Del 4.º en adelante: una línea por jugador, y «y N más» si no caben. */
function Rest({ card, size, width }: { card: CardModel; size: number; width: number }) {
  if (!card.rest.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", width, gap: 2 }}>
      {card.rest.map((e) => (
        <div
          key={`${e.place}-${e.name}`}
          style={{ display: "flex", justifyContent: "space-between", fontSize: size, color: C.card, borderTop: `2px solid ${C.shellHi}`, padding: "3px 4px" }}
        >
          <div style={{ display: "flex", gap: 14, maxWidth: width - 140, overflow: "hidden", whiteSpace: "nowrap" }}>
            <span style={{ display: "flex", color: C.onShellSoft, width: size * 1.4 }}>{e.place}º</span>
            <span style={{ display: "flex", fontFamily: "Kalam", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name}</span>
          </div>
          <span style={{ display: "flex", color: C.saffron }}>
            {e.score} {card.points}
          </span>
        </div>
      ))}
      {card.more && <div style={{ display: "flex", fontSize: size * 0.9, color: C.onShellSoft, padding: "3px 4px" }}>{card.more}</div>}
    </div>
  );
}

/** El titular: «GANÓ» pequeño encima del nombre, que es lo grande. */
function Headline({ card, nameSizes, prefixSize, width }: { card: CardModel; nameSizes: [number, number, number, number]; prefixSize: number; width: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width, textTransform: "uppercase" }}>
      {card.headlinePrefix && (
        <div style={{ display: "flex", fontSize: prefixSize, color: C.card, letterSpacing: 2, lineHeight: 1 }}>{card.headlinePrefix}</div>
      )}
      <div
        style={{
          display: "flex",
          color: C.saffron,
          fontSize: fit(card.headlineText, nameSizes),
          lineHeight: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          lineClamp: 2,
          wordBreak: "break-word",
        }}
      >
        {card.headlineText}
      </div>
    </div>
  );
}

const WIDE: Scale = { colW: 190, gap: 10, name: 34, members: 20, score: 56, pts: 22, ordinal: 44, steps: [160, 118, 84] };
const TALL: Scale = { colW: 296, gap: 22, name: 50, members: 28, score: 80, pts: 30, ordinal: 60, steps: [220, 160, 112] };

/** Apaisada (1200×630): titular a la izquierda, podio a la derecha. */
export function WideCard({ card }: { card: CardModel }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: C.ink, fontFamily: "Barlow Condensed" }}>
      <Band brand={card.brand} stripe={30} left={56} size={34} />
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between", padding: "0 56px" }}>
        <div style={{ display: "flex", flexDirection: "column", width: card.scored ? 470 : 1000, gap: 18 }}>
          <div style={{ display: "flex", fontSize: 30, letterSpacing: 4, color: C.onShellSoft, textTransform: "uppercase" }}>{card.kicker}</div>
          <Headline card={card} nameSizes={card.scored ? [58, 64, 88, 118] : [84, 100, 124, 140]} prefixSize={60} width={card.scored ? 470 : 1000} />
          <div style={{ display: "flex", fontSize: 30, color: C.onShellSoft, letterSpacing: 1 }}>{card.meta}</div>
          <div style={{ display: "flex", fontSize: 26, color: C.onShellSoft, letterSpacing: 1 }}>{SITE_DOMAIN}</div>
        </div>
        {card.scored && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <Podium entries={card.podium} points={card.points} s={WIDE} />
            <Rest card={card} size={22} width={WIDE.colW * 3 + WIDE.gap * 2} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Vertical (1080×1350): todo apilado, para estados e historias. */
export function TallCard({ card }: { card: CardModel }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: C.ink, fontFamily: "Barlow Condensed" }}>
      <Band brand={card.brand} stripe={40} left={64} size={44} />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between", padding: "44px 72px 48px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 38, letterSpacing: 5, color: C.onShellSoft, textTransform: "uppercase" }}>{card.kicker}</div>
          <Headline card={card} nameSizes={[64, 96, 124, 150]} prefixSize={72} width={936} />
          <div style={{ display: "flex", fontSize: 38, color: C.onShellSoft, letterSpacing: 1 }}>{card.meta}</div>
        </div>
        {card.scored && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
            <Podium entries={card.podium} points={card.points} s={TALL} />
            <Rest card={card} size={30} width={936} />
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "center", fontSize: 36, color: C.onShellSoft, letterSpacing: 2 }}>{SITE_DOMAIN}</div>
      </div>
    </div>
  );
}
