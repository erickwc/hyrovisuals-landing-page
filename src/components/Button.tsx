import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Arrow } from "./ui";

type Common = {
  variant?: "solid" | "ghost";
  size?: "sm" | "md" | "lg";
  /** Flecha a la derecha del texto. */
  arrow?: boolean;
  className?: string;
  children: ReactNode;
};
type AsLink = Common & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof Common | "href">;
type AsButton = Common & { href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof Common>;

/* Botón de pastilla de toda la página. El relleno rojo es una capa que sube con transform,
   y el fondo base vive dentro del mismo recorte para que no asome borde blanco al hacer hover. */
export function Button(props: AsLink | AsButton) {
  const { variant = "solid", size = "md", arrow, className, children, ...rest } = props;
  const cls = ["btn", variant === "ghost" && "ghost", size !== "md" && size, className].filter(Boolean).join(" ");
  const inner = (
    <>
      {variant === "solid" && (
        <>
          <span className="btn__bg" aria-hidden="true" />
          <span className="btn__fill" aria-hidden="true" />
        </>
      )}
      <span className="btn__label">
        {children}
        {arrow && <Arrow />}
      </span>
    </>
  );

  if ("href" in rest && rest.href !== undefined) {
    return (
      <a className={cls} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" className={cls} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {inner}
    </button>
  );
}
