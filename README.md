# Hyro

Landing de HYRO VISUALS: Astro + Tailwind CSS, GSAP (ScrollTrigger y SplitText) y Lenis. Incluye hero y sección de compra.

## Desarrollo

```sh
npm install
npm run dev
```

## Comprobaciones

```sh
npm run check
npm run build
npm run preview -- --port 4323
```

Con la vista previa abierta, en otra terminal:

```sh
npm run verify:header
```

La comprobación usa Microsoft Edge instalado, recorre 360/768/1440px y verifica el crossfade, idiomas, tema y movimiento reducido. Capturas en `artifacts/` (ignorado por Git).

## Editar

- `src/styles/global.css`: tokens de temas, tipografías, tamaños y estilos.
- `src/components/`: piezas reutilizables.
- `src/i18n/`: textos ES/EN.
- `src/scripts/`: preferencias, carrusel, animaciones e inicialización.
- `public/media/`: cuatro clips MP4 optimizados de tres segundos y poster.
- `DESIGN_RULES.md`: criterios que deben seguir las siguientes secciones.

Los MOV originales en `src/videos/` se conservan. La página sirve las versiones MP4 de `public/media/`. Los enlaces a secciones futuras quedan preparados. El botón del hero lleva a `#compra` con desplazamiento suave. El botón «Comprar ahora» está deshabilitado hasta integrar el pago.

`npm run format` aplica el formato de Astro al código.
