import { TeamDot } from "./TeamDot";

/** Nombre de un jugador o equipo con el punto de su color delante (sin color, solo el nombre). */
export function PlayerName({
  name,
  color,
  size = 16,
  className,
}: {
  name: string;
  color?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span className={className}>
      <TeamDot color={color} size={size} /> {name}
    </span>
  );
}
