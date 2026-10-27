import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import ui from "./ui.module.css";

type CardProps<T extends ElementType> = {
  as?: T;
  /** La tapa con las tres rayas de la cinta (por defecto, sí). */
  stripes?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

/** Carátula de cartulina con las tres rayas arriba. Puede ser una sección, un formulario o un `<details>`. */
export function Card<T extends ElementType = "section">({ as, stripes = true, className = "", children, ...rest }: CardProps<T>) {
  const Tag: ElementType = as ?? "section";
  return (
    <Tag className={`${ui.card} ${className}`} {...rest}>
      {stripes && <div className={ui.cardStripes} />}
      {children}
    </Tag>
  );
}
