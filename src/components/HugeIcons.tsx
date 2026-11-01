import type { SVGProps } from "react";

/* Iconos del set gratuito de Hugeicons que no existen en la colección animada de Animate UI
   (logos de sistema y ojo). Mismo trazo; el color se hereda con currentColor. */
const base: SVGProps<SVGSVGElement> = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function AppleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5.75C12 3.75 13.5 1.75 15.5 1.75C15.5 3.75 14 5.75 12 5.75Z" />
      <path d="M12.5 8.09001C11.9851 8.09001 11.5867 7.92646 11.1414 7.74368C10.5776 7.51225 9.93875 7.25 8.89334 7.25C7.02235 7.25 4 8.74945 4 12.7495C4 17.4016 7.10471 22.25 9.10471 22.25C9.77426 22.25 10.3775 21.9871 10.954 21.7359C11.4815 21.5059 11.9868 21.2857 12.5 21.2857C13.0132 21.2857 13.5185 21.5059 14.046 21.7359C14.6225 21.9871 15.2257 22.25 15.8953 22.25C17.2879 22.25 18.9573 19.8992 20 16.9008C18.3793 16.2202 17.338 14.618 17.338 12.75C17.338 11.121 18.2036 10.0398 19.5 9.25C18.5 7.75 17.0134 7.25 15.9447 7.25C14.8993 7.25 14.2604 7.51225 13.6966 7.74368C13.2514 7.92646 13.0149 8.09001 12.5 8.09001Z" />
    </svg>
  );
}

export function WindowsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M14.0136 3.99538L8.01361 4.99036C5.61912 5.38744 4.42188 5.58597 3.71094 6.421C3 7.25602 3 8.46368 3 10.879L3 13.121C3 15.5363 3 16.744 3.71094 17.579C4.42188 18.414 5.61913 18.6126 8.01361 19.0096L14.0136 20.0046C17.2567 20.5424 18.8782 20.8113 19.9391 19.9171C21 19.023 21 17.3873 21 14.116V9.88402C21 6.6127 21 4.97704 19.9391 4.08286C18.8782 3.18868 17.2567 3.45758 14.0136 3.99538Z" />
      <path d="M11 4.5V19.5M3 12H21" />
    </svg>
  );
}

export function ViewIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M2 12C2 12 5.5 5 12 5C18.5 5 22 12 22 12C22 12 18.5 19 12 19C5.5 19 2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function ViewOffIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M9.88 9.88C9.33 10.43 9 11.17 9 12C9 13.66 10.34 15 12 15C12.83 15 13.57 14.67 14.12 14.12" />
      <path d="M6.2 6.2C3.9 7.8 2 12 2 12C2 12 5.5 19 12 19C14 19 15.7 18.45 17.1 17.6M19.8 14.8C21.1 13.1 22 12 22 12C22 12 20.1 7.7 16.5 5.6C15.2 4.8 13.7 4.3 12 4.3C11.3 4.3 10.6 4.4 10 4.5" />
      <path d="M3 3L21 21" />
    </svg>
  );
}
