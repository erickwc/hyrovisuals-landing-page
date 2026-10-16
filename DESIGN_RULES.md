# Hyro · reglas del header

La referencia entregada por el usuario define la dirección: composición centrada, título ancho de dos líneas, visual panorámico protagonista, textura técnica sutil y cuatro beneficios. Alcance actual: navegación y hero. Las anclas de secciones futuras quedan preparadas.

## Sistema de variables

Fuente única: `src/styles/global.css`. Tema claro en `:root`; oscuro en `[data-theme="dark"]`. El sistema operativo determina el tema inicial; `hyro-theme` en localStorage conserva una elección manual. El selector de idioma usa `hyro-language`, después navigator.language (es → español; resto → inglés).

| Token            | Claro   | Oscuro  |
| ---------------- | ------- | ------- |
| --background     | #f3f3ef | #080908 |
| --surface        | #fafaf8 | #10110f |
| --text           | #171817 | #f8f8f6 |
| --secondary      | #575953 | #a9aba6 |
| --border         | #b9bcb4 | #363934 |
| --accent         | #a95013 | #efae4b |
| --button-bg      | #151615 | #fafaf8 |
| --button-text    | #fff    | #10110f |
| --gradient-start | #414440 | #f8f8f6 |
| --gradient-end   | #979b92 | #70726e |

Tailwind v4 se conecta mediante `@theme inline`: bg-background, bg-surface, text-foreground, text-secondary, border-border, text-accent, font-sans, text-hero, rounded-control, p-section. Las siguientes secciones deben consumir estos tokens; no introducir colores o tamaños en componentes Astro.

## Tipografía y geometría

Inter Variable local para cuerpo y títulos; Space Grotesk Variable local para etiquetas, controles y títulos de beneficios. Título peso 900, interlineado .97, tracking -.065em, tamaño fluido --title-size. Última palabra con background-clip y degradado configurable; nunca sombra o glow del título.

Texto: --text-small .75rem, --text-label .8125rem, --text-body .9375rem, --text-description 1.125rem. Escala de espacios: .5, .75, 1, 1.5, 2, 3, 4.5 y 6rem. Márgenes laterales fluidos --page-gutter. Radios: --radius-sm .6rem; --radius-md .8rem; --radius-button 1.5rem; --radius-full 999px. Bordes de 1px.

Botón principal sólido, 3.6rem de alto y 17rem de ancho mínimo, texto mayúsculo, flecha outline. Es un button sin navegación por requerimiento. Controles con foco visible; menú móvil con aria-expanded, Escape y cierre al pulsar fuera.

Íconos de beneficios: SVG de Heroicons outline 24×24, trazo 1.5, tamaño --feature-icon-size dentro de --feature-box-size. Se usan SVG estáticos, sin hidratación React. Licencia en public/images/heroicons-LICENSE.txt. Logo original con transparencia y recorte CSS para mostrar solo Hyro; filtro invertido en tema claro.

## Responsive

Desktop >=1024px: cuatro columnas. Tablet 768–1023px: dos columnas. Teléfono <768px: una columna. Menú colapsable por debajo de 1024px para evitar compresión de enlaces. Revisar siempre 360, 768 y 1440px. Visual panorámico conserva proporción en desktop y tablet; en teléfono el encuadre central con object-fit:cover mantiene los paneles legibles dentro de una franja de altura mínima.

## Movimiento

Inicialización única en src/scripts/init.ts: registra GSAP, ScrollTrigger y SplitText; conecta Lenis con el ticker de GSAP. Lógica en animations.ts; carrusel en carousel.ts; preferencias en preferences.ts. Astro solo declara data-anim.

Tokens: --duration-fast .25s, --duration-base .65s, --duration-slow 1.1s, --duration-crossfade .65s, --duration-slide 3s, --duration-pulse 2.4s. --ease-out cubic-bezier(.22,1,.36,1), --ease-gsap power3.out, --stagger .1. --magnet-strength .12; --parallax-desktop 20; --parallax-mobile 5.

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

Carrusel: cuatro MP4 de tres segundos derivados de los MOV originales. Nuevo video solo aparece cuando está decodificado; el anterior permanece completamente visible debajo hasta finalizar el crossfade. Poster permanente de respaldo. Color calculado sobre píxeles saturados del fotograma para alimentar --visual-tint. No se usa audio real para el pulso.

## Componentes reutilizables

- Navbar: logo, anclas y controles; único menú global.
- Button: acción principal estática con etiqueta traducida y flecha.
- SectionLabel: text + translationKey.
- Title: firstLine, secondLine, gradientText y keyPrefix; bloque final degradado configurable.
- FeatureItem: icon, title, description y translationKey.
- PlatformBadge: platform (mac/windows), label accesible.
- LanguageSelector: selección ES/EN sin recarga.
- ThemeToggle: alterna claro/oscuro con persistencia.
- VisualCarousel: videos, poster, glow, puntos y pausa.
- Icon: SVG outline compartido; tamaños heredados de tokens.

Todos los textos de interfaz y accesibilidad se definen en src/i18n/en.json y es.json. Mantener claves idénticas. Los nombres de plataforma y marca son propios. No añadir copy comercial ni secciones adicionales hasta definirlas.
