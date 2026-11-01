'use client';

import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from './icon';

type TranslateProps = IconProps<keyof typeof animations>;

/* Mismo contrato que los iconos de Animate UI. Trazado: Hugeicons "translate" (set gratuito),
   que no está en la colección animada; las dos tarjetas se cruzan al activarlo. */
const pivot = { transformBox: 'fill-box', transformOrigin: 'center' } as const;

const animations = {
  default: {
    groupA: {
      initial: { rotate: 0, x: 0, y: 0, transition: { duration: 0.4, ease: 'easeInOut' } },
      animate: {
        rotate: [0, -14, 8, 0],
        x: [0, 1.5, 0, 0],
        y: [0, -1.5, 0, 0],
        transition: { duration: 0.8, ease: 'easeInOut' },
      },
    },
    groupB: {
      initial: { rotate: 0, x: 0, y: 0, transition: { duration: 0.4, ease: 'easeInOut' } },
      animate: {
        rotate: [0, 14, -8, 0],
        x: [0, -1.5, 0, 0],
        y: [0, 1.5, 0, 0],
        transition: { duration: 0.8, ease: 'easeInOut' },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: TranslateProps) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.g style={pivot} variants={variants.groupA} initial="initial" animate={controls}>
        <path d="M5 5.82759H7.7M11 5.82759H9.5M7.7 5.82759H9.5M7.7 5.82759V5M9.5 5.82759C9.18351 6.95937 8.52075 8.02923 7.76429 8.96946M5.83571 11C6.44723 10.4377 7.13788 9.74802 7.76429 8.96946M7.76429 8.96946C7.37857 8.51724 6.83857 7.78558 6.68429 7.45455M7.76429 8.96946L8.92143 10.1724" />
        <path d="M14 10V8C14 5.17157 14 3.75736 13.1213 2.87868C12.2426 2 10.8284 2 8 2C5.17157 2 3.75736 2 2.87868 2.87868C2 3.75736 2 5.17157 2 8C2 10.8284 2 12.2426 2.87868 13.1213C3.75736 14 5.17157 14 8 14H10" />
      </motion.g>
      <motion.g style={pivot} variants={variants.groupB} initial="initial" animate={controls}>
        <path d="M13.5 19L14.3333 17M18.5 19L17.6667 17M14.3333 17L16 13L17.6667 17M14.3333 17H17.6667" />
        <path d="M10 16C10 13.1716 10 11.7574 10.8787 10.8787C11.7574 10 13.1716 10 16 10C18.8284 10 20.2426 10 21.1213 10.8787C22 11.7574 22 13.1716 22 16C22 18.8284 22 20.2426 21.1213 21.1213C20.2426 22 18.8284 22 16 22C13.1716 22 11.7574 22 10.8787 21.1213C10 20.2426 10 18.8284 10 16Z" />
      </motion.g>
      <path d="M4 16.5C4 17.9045 4 18.6067 4.33706 19.1111C4.48298 19.3295 4.67048 19.517 4.88886 19.6629C5.39331 20 6.09554 20 7.5 20" />
      <path d="M20 7.5C20 6.09554 20 5.39331 19.6629 4.88886C19.517 4.67048 19.3295 4.48298 19.1111 4.33706C18.6067 4 17.9045 4 16.5 4" />
    </motion.svg>
  );
}

function Translate(props: TranslateProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export { animations, Translate, type TranslateProps };
