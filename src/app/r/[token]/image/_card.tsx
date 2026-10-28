import type { CSSProperties } from "react";
import type { CardEntry, CardModel } from "@/lib/game/share-card";
import { memberLine } from "@/lib/game/teams";
import { OG_COLORS as C } from "@/lib/og/theme";
import { SITE_DOMAIN } from "@/lib/site";

/*
 * La tarjeta del resultado como imagen (Satori: solo flexbox y un subconjunto de CSS). Dos composiciones del
 * mismo contenido: apaisada para la vista previa del enlace y los chats, y vertical para estados e historias.
 * Los colores y las fuentes son los de la app (ver `src/lib/og/theme.ts`).
 *
 * Satori no lee hojas de estilo ni variables CSS, solo `style` en línea: por eso los estilos están aquí arriba,
 * con nombre y agrupados por pieza, y el JSX de abajo solo dice qué va dónde.
 */

export const CARD_SIZES = {
  wide: { width: 1200, height: 630 },
  tall: { width: 1080, height: 1350 },
} as const;
export type CardFormat = keyof typeof CARD_SIZES;

// ---------- Estilos ----------

/** Satori exige `display: flex` en todo elemento con hijos. */
const flex: CSSProperties = { display: "flex" };
const stack: CSSProperties = { ...flex, flexDirection: "column" };
/** Una sola línea que acaba en «…» si no cabe. */
const ellipsis: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis" };

/** Texto suave sobre la carcasa (el pie, la fecha, el «Fin de la cinta»). */
const soft = (size: number, spacing: number): CSSProperties => ({
  ...flex,
  fontSize: size,
  letterSpacing: spacing,
  color: C.onShellSoft,
});

const frame: CSSProperties = { ...stack, width: "100%", height: "100%", background: C.ink, fontFamily: "Barlow Condensed" };

/** Las tres cintas de color de arriba, con la etiqueta de la marca encima. */
const band = {
  root: (stripe: number): CSSProperties => ({ ...stack, position: "relative", height: stripe * 3 }),
  stripe: (height: number, background: string): CSSProperties => ({ ...flex, height, background }),
  brand: (stripe: number, left: number, size: number): CSSProperties => ({
    ...flex,
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
  }),
};

/** El titular: «GANÓ» pequeño encima del nombre, que es lo grande. */
const headline = {
  root: (width: number): CSSProperties => ({ ...stack, width, textTransform: "uppercase" }),
  prefix: (size: number): CSSProperties => ({ ...flex, fontSize: size, color: C.card, letterSpacing: 2, lineHeight: 1 }),
  name: (text: string, sizes: FitSizes): CSSProperties => ({
    ...flex,
    color: C.saffron,
    fontSize: fit(text, sizes),
    lineHeight: 1,
    ...ellipsis,
    lineClamp: 2,
    wordBreak: "break-word",
  }),
};

/** Podio de tres escalones. */
const podium = {
  row: (gap: number): CSSProperties => ({ ...flex, alignItems: "flex-end", justifyContent: "center", gap }),
  emptySlot: (width: number): CSSProperties => ({ ...flex, width }),
  slot: (width: number): CSSProperties => ({ ...stack, alignItems: "center", width }),
  name: (s: Scale, text: string): CSSProperties => ({
    ...flex,
    maxWidth: s.colW,
    color: C.card,
    fontFamily: "Kalam",
    fontSize: fit(text, [s.name * 0.55, s.name * 0.7, s.name * 0.85, s.name]),
    lineHeight: 1.15,
    textAlign: "center",
    ...ellipsis,
    lineClamp: 2,
  }),
  members: (s: Scale): CSSProperties => ({
    ...flex,
    maxWidth: s.colW,
    color: C.onShellSoft,
    fontSize: s.members,
    whiteSpace: "nowrap",
    ...ellipsis,
  }),
  score: { ...flex, alignItems: "baseline", gap: 8, color: C.saffron, margin: "4px 0 10px" } satisfies CSSProperties,
  scoreValue: (s: Scale): CSSProperties => ({ ...flex, fontSize: s.score, lineHeight: 1 }),
  points: (s: Scale): CSSProperties => ({ ...flex, fontSize: s.pts, color: C.onShellSoft, textTransform: "uppercase" }),
  step: (s: Scale, tier: 1 | 2 | 3): CSSProperties => ({
    ...flex,
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
  }),
};

/** Del 4.º en adelante. */
const rest = {
  list: (width: number): CSSProperties => ({ ...stack, width, gap: 2 }),
  row: (size: number): CSSProperties => ({
    ...flex,
    justifyContent: "space-between",
    fontSize: size,
    color: C.card,
    borderTop: `2px solid ${C.shellHi}`,
    padding: "3px 4px",
  }),
  who: (width: number): CSSProperties => ({ ...flex, gap: 14, maxWidth: width - 140, overflow: "hidden", whiteSpace: "nowrap" }),
  place: (size: number): CSSProperties => ({ ...flex, color: C.onShellSoft, width: size * 1.4 }),
  name: { ...flex, fontFamily: "Kalam", whiteSpace: "nowrap", ...ellipsis } satisfies CSSProperties,
  score: { ...flex, color: C.saffron } satisfies CSSProperties,
  more: (size: number): CSSProperties => ({ ...flex, fontSize: size * 0.9, color: C.onShellSoft, padding: "3px 4px" }),
};

/** Apaisada (1200×630): titular a la izquierda, podio a la derecha. */
const wide = {
  body: { ...flex, flex: 1, alignItems: "center", justifyContent: "space-between", padding: "0 56px" } satisfies CSSProperties,
  text: (width: number): CSSProperties => ({ ...stack, width, gap: 18 }),
  kicker: { ...soft(30, 4), textTransform: "uppercase" } satisfies CSSProperties,
  meta: soft(30, 1),
  domain: soft(26, 1),
  side: { ...stack, alignItems: "center", gap: 14 } satisfies CSSProperties,
};

/** Vertical (1080×1350): todo apilado. */
const tall = {
  body: { ...stack, flex: 1, justifyContent: "space-between", padding: "44px 72px 48px" } satisfies CSSProperties,
  text: { ...stack, gap: 20 } satisfies CSSProperties,
  kicker: { ...soft(38, 5), textTransform: "uppercase" } satisfies CSSProperties,
  meta: soft(38, 1),
  podium: { ...stack, alignItems: "center", gap: 22 } satisfies CSSProperties,
  domain: { ...soft(36, 2), justifyContent: "center" } satisfies CSSProperties,
};

// ---------- Medidas y colores del podio ----------

/** Tamaños de la letra según cuánto mide el nombre (los largos bajan para que no se salgan). */
type FitSizes = [xlong: number, long: number, mid: number, short: number];
const fit = (text: string, sizes: FitSizes) =>
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

const WIDE: Scale = { colW: 190, gap: 10, name: 34, members: 20, score: 56, pts: 22, ordinal: 44, steps: [160, 118, 84] };
const TALL: Scale = { colW: 296, gap: 22, name: 50, members: 28, score: 80, pts: 30, ordinal: 60, steps: [220, 160, 112] };

// ---------- Piezas ----------

function Band({ brand, stripe, left, size }: { brand: string; stripe: number; left: number; size: number }) {
  return (
    <div style={band.root(stripe)}>
      <div style={band.stripe(stripe, C.saffron)} />
      <div style={band.stripe(stripe, C.tomato)} />
      <div style={band.stripe(stripe, C.sky)} />
      <div style={band.brand(stripe, left, size)}>{brand}</div>
    </div>
  );
}

function Headline({ card, nameSizes, prefixSize, width }: { card: CardModel; nameSizes: FitSizes; prefixSize: number; width: number }) {
  return (
    <div style={headline.root(width)}>
      {card.headlinePrefix && <div style={headline.prefix(prefixSize)}>{card.headlinePrefix}</div>}
      <div style={headline.name(card.headlineText, nameSizes)}>{card.headlineText}</div>
    </div>
  );
}

/** Podio de tres escalones (2.º, 1.º, 3.º de izquierda a derecha). */
function Podium({ entries, points, s }: { entries: CardEntry[]; points: string; s: Scale }) {
  return (
    <div style={podium.row(s.gap)}>
      {[1, 0, 2].map((i) => {
        const e = entries[i];
        if (!e) return <div key={i} style={podium.emptySlot(s.colW)} />;
        const tier = Math.min(e.place, 3) as 1 | 2 | 3;
        return (
          <div key={i} style={podium.slot(s.colW)}>
            <div style={podium.name(s, e.name)}>{e.name}</div>
            {e.members.length > 0 && <div style={podium.members(s)}>{memberLine(e.members, 3)}</div>}
            <div style={podium.score}>
              <span style={podium.scoreValue(s)}>{e.score}</span>
              <span style={podium.points(s)}>{points}</span>
            </div>
            <div style={podium.step(s, tier)}>{e.place}º</div>
          </div>
        );
      })}
    </div>
  );
}

/** Una línea por jugador, y «y N más» si no caben. */
function Rest({ card, size, width }: { card: CardModel; size: number; width: number }) {
  if (!card.rest.length) return null;
  return (
    <div style={rest.list(width)}>
      {card.rest.map((e) => (
        <div key={`${e.place}-${e.name}`} style={rest.row(size)}>
          <div style={rest.who(width)}>
            <span style={rest.place(size)}>{e.place}º</span>
            <span style={rest.name}>{e.name}</span>
          </div>
          <span style={rest.score}>
            {e.score} {card.points}
          </span>
        </div>
      ))}
      {card.more && <div style={rest.more(size)}>{card.more}</div>}
    </div>
  );
}

// ---------- Las dos tarjetas ----------

export function WideCard({ card }: { card: CardModel }) {
  const textWidth = card.scored ? 470 : 1000;
  return (
    <div style={frame}>
      <Band brand={card.brand} stripe={30} left={56} size={34} />
      <div style={wide.body}>
        <div style={wide.text(textWidth)}>
          <div style={wide.kicker}>{card.kicker}</div>
          <Headline card={card} nameSizes={card.scored ? [58, 64, 88, 118] : [84, 100, 124, 140]} prefixSize={60} width={textWidth} />
          <div style={wide.meta}>{card.meta}</div>
          <div style={wide.domain}>{SITE_DOMAIN}</div>
        </div>
        {card.scored && (
          <div style={wide.side}>
            <Podium entries={card.podium} points={card.points} s={WIDE} />
            <Rest card={card} size={22} width={WIDE.colW * 3 + WIDE.gap * 2} />
          </div>
        )}
      </div>
    </div>
  );
}

export function TallCard({ card }: { card: CardModel }) {
  return (
    <div style={frame}>
      <Band brand={card.brand} stripe={40} left={64} size={44} />
      <div style={tall.body}>
        <div style={tall.text}>
          <div style={tall.kicker}>{card.kicker}</div>
          <Headline card={card} nameSizes={[64, 96, 124, 150]} prefixSize={72} width={936} />
          <div style={tall.meta}>{card.meta}</div>
        </div>
        {card.scored && (
          <div style={tall.podium}>
            <Podium entries={card.podium} points={card.points} s={TALL} />
            <Rest card={card} size={30} width={936} />
          </div>
        )}
        <div style={tall.domain}>{SITE_DOMAIN}</div>
      </div>
    </div>
  );
}
