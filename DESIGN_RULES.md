# Hyro · reglas del header

La referencia entregada por el usuario define la dirección: composición centrada, título ancho de dos líneas, visual panorámico protagonista, textura técnica sutil y cuatro beneficios. Alcance actual: navegación y hero. Las anclas de secciones futuras quedan preparadas.

## Sistema de variables

Fuente única: `src/styles/global.css`. Tema claro en `:root`; oscuro en `[data-theme="dark"]`. El sistema operativo determina el tema inicial; `hyro-theme` en localStorage conserva una elección manual. El cambio de tema funde la página completa mediante View Transitions, con duración `--duration-theme`; con movimiento reducido o sin soporte, el cambio es inmediato y uniforme. El selector de idioma usa `hyro-language`, después navigator.language (es → español; resto → inglés).

| Token            | Claro       | Oscuro      |
| ---------------- | ----------- | ----------- |
| --background     | #f3f3ef     | #080808     |
| --surface        | #fafaf8     | #10110f     |
| --text           | #171817     | #f8f8f6     |
| --secondary      | #575953     | #a9aba6     |
| --border         | #b9bcb4     | #363934     |
| --accent         | #a95013     | #efae4b     |
| --button-bg      | #151615     | #fafaf8     |
| --button-text    | #fff        | #10110f     |
| --gradient-start | var(--text) | var(--text) |
| --gradient-end   | #777b75     | #70726e     |

Tailwind v4 se conecta mediante `@theme inline`: bg-background, bg-surface, text-foreground, text-secondary, border-border, text-accent, font-sans, font-heading, text-hero, rounded-control, p-section. Las siguientes secciones deben consumir estos tokens; no introducir colores o tamaños en componentes Astro.

## Tipografía y geometría

Inter Variable local para cuerpo; Space Grotesk Variable local para etiquetas, controles y títulos de beneficios. Gelegar Expanded, entregada por el usuario en `Gelegar Font.zip` y guardada en `public/fonts/gelegar-expanded.otf`, se carga con `@font-face` y `font-display: swap`; `--font-title` se usa solo en títulos. Título con peso nativo 400 de la fuente, interlineado 1.06, tracking -.03em y tamaño fluido `--title-size` mediante `clamp()`. La última palabra de la segunda línea se detecta automáticamente en la traducción activa. Conserva el color normal hasta `--gradient-tail-start` (62% de la palabra); solo al final pasa gradualmente a `--gradient-end`. El tramo degradado reserva `--gradient-overhang` (0.12em) de espacio de pintura y compensa ese espacio con margen negativo: la última letra de Gelegar se extiende más allá de su ancho tipográfico y así se dibuja completa sin mover el título. La etiqueta superior usa `--label-tracking: 0.18em`. Nunca sombra ni glow del título.

Texto: --text-small .75rem, --text-label .8125rem, --text-body .875rem, --text-description 1rem. Escala de espacios: .5, .75, 1, 1.5, 2, 3, 4.5 y 6rem; los controles, botones, iconos y título usan valores reducidos para que la composición respire a zoom 100%. Las separaciones del hero usan `--gap-label-title`, `--gap-title-copy`, `--gap-copy-button`, `--gap-button-visual`, `--gap-visual-features` y `--gap-features-availability`; en escritorio aumentan para distribuir mejor la altura. Márgenes laterales fluidos --page-gutter. Radios: --radius-sm .6rem; --radius-visual .6rem; --radius-md .8rem; --radius-button 1.5rem; --radius-full 999px. El visual usa un contenedor transparente sin borde ni padding, con `--visual-max-width: calc(76rem + 25px)`. Video y poster conservan su proporción completa mediante `object-fit: contain`, sin ampliación ni recorte. Los demás bordes son de 1px.

Glow del visual: `--glow-intensity` 0.17 en claro y 0.08 en oscuro; `--glow-blur` 3rem en claro y 2rem en oscuro; `--glow-height` 7rem en claro y 5rem en oscuro. Su color viene de `--visual-tint` y se interpola durante cada fundido.

Puntos de fondo: `--dot-size: 1.5px`, `--dot-alpha: 0.95` y `--dot-pulse-opacity: 0.65` en claro; 1px, 0.7 y 0.3 en oscuro. Mantienen el color del visual y pulsan sin tapar el contenido.

Botón principal sólido, 3.25rem de alto y 15rem de ancho mínimo, texto mayúsculo, flecha outline. Es un button sin navegación por requerimiento. Controles con foco visible; menú móvil con aria-expanded, Escape y cierre al pulsar fuera.

Íconos de beneficios: SVG de Heroicons outline 24×24, trazo 1.5, tamaño --feature-icon-size dentro de --feature-box-size. La fila completa de beneficios comparte `--visual-max-width` con el visual y usa un espacio superior menor en escritorio. Se usan SVG estáticos, sin hidratación React. Licencia en public/images/heroicons-LICENSE.txt. Logo original con transparencia y recorte CSS para mostrar solo Hyro; filtro invertido en tema claro.

## Responsive

Desktop >=1024px: cuatro columnas. Tablet 768–1023px: dos columnas. Teléfono <768px: una columna. Menú colapsable por debajo de 1024px para evitar compresión de enlaces. Revisar siempre 360, 768 y 1440px. El visual conserva la proporción completa en los tres tamaños; en teléfono se muestra toda la franja, aunque sus detalles naturalmente se ven más pequeños.

## Movimiento

Inicialización única en src/scripts/init.ts: registra GSAP, ScrollTrigger y SplitText; conecta Lenis con el ticker de GSAP. Lógica en animations.ts; carrusel en carousel.ts; preferencias en preferences.ts. Astro solo declara data-anim.

Tokens: --duration-fast .25s, --duration-base .65s, --duration-slow 1.1s, --duration-pulse 2.4s. --ease-out cubic-bezier(.22,1,.36,1), --ease-gsap power3.out, --stagger .1. --magnet-strength .12; --parallax-desktop 20; --parallax-mobile 5. El carrusel centraliza `VIDEO_DURATION = 4500` ms de exposición completa y `FADE_DURATION = 1800` ms de fundido en `src/scripts/carousel.ts`; ambos video y glow usan `sine.inOut`.

| data-anim   | Comportamiento                                                |
| ----------- | ------------------------------------------------------------- |
| title       | SplitText por líneas con máscara y desplazamiento vertical    |
| label       | Entrada vertical después del título                           |
| description | Entrada con stagger                                           |
| button      | Entrada con stagger y magnetismo solo escritorio/puntero fino |
| visual      | Escala y apertura clip-path; parallax con ScrollTrigger       |
| feature     | Entrada vertical escalonada al entrar en viewport             |
| line        | Dibujo con scaleY desde arriba                                |
| dots        | Pulso simulado del color del visual                           |

Reduced motion: contenido visible, sin Lenis, GSAP ni reproducción de videos; poster/fotograma estático. Cambiar la preferencia del sistema actualiza el comportamiento. Pausa manual disponible en el carrusel. Pestaña oculta pausa reproducción. Antes de astro:before-swap se limpian eventos, timers, animaciones, ticker, Lenis y triggers.

Carrusel: cuatro MP4 de unos tres segundos derivados de los MOV originales. Cada video tiene `loop` y se reinicia al comienzo de su turno, para evitar el último fotograma congelado durante los 4.5 segundos visibles y 1.8 segundos de fundido. El nuevo video solo aparece cuando está decodificado; ambos se reproducen durante el crossfade y el anterior permanece completamente visible debajo hasta terminarlo. Poster permanente de respaldo. Color calculado sobre píxeles saturados del fotograma para alimentar `--visual-tint`, con interpolación sincronizada al crossfade. No se usa audio real para el pulso.

## Componentes reutilizables

- Navbar: logo, anclas y controles; único menú global.
- Button: acción principal estática con etiqueta traducida y flecha.
- SectionLabel: text + translationKey.
- Title: firstLine, secondLine y keyPrefix; separa automáticamente la última palabra de la segunda línea para aplicarle el degradado en ES y EN.
- FeatureItem: icon, title, description y translationKey.
- PlatformBadge: platform (mac/windows), label accesible.
- LanguageSelector: selección ES/EN sin recarga.
- ThemeToggle: alterna claro/oscuro con persistencia.
- VisualCarousel: videos, poster, glow, puntos y pausa.
- Icon: SVG outline compartido; tamaños heredados de tokens.

Todos los textos de interfaz y accesibilidad se definen en src/i18n/en.json y es.json. Mantener claves idénticas. Los nombres de plataforma y marca son propios. No añadir copy comercial ni secciones adicionales hasta definirlas.
