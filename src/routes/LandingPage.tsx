import { Link } from 'react-router-dom';

const FEATURES = [
  {
    title: 'Editor visual de capas',
    text: 'Diseña como en un estudio: texto, formas, líneas e imágenes con control total de posición, tamaño, color tipografía y opacidad. Selecciona, reordena capas, bloquea o duplica elementos en segundos.',
    image: '/templates/images/pasta.jpg',
    alt: 'Plato de pasta listo para carta',
  },
  {
    title: 'Varias páginas A4',
    text: 'Cada menú puede tener tantas páginas como necesites, apiladas en orden. Al abrir el enlace del QR, el cliente hace scroll y ve la carta completa exactamente como la diseñaste.',
    image: '/templates/images/pizza.jpg',
    alt: 'Pizza en menú multipágina',
  },
  {
    title: 'Plantillas listas',
    text: 'Galería por tipo de negocio: italiana, mexicana, bar, cafetería, comida rápida y fine dining. Empieza con un diseño sólido, cambia textos y fotos, y deja tu marca en minutos.',
    image: '/templates/images/tacos.jpg',
    alt: 'Comida mexicana para plantillas',
  },
  {
    title: 'Imágenes propias y stock',
    text: 'Sube las fotos de tus platos (con compresión automática y progreso de subida) o busca en el banco integrado de Pixabay. Todo queda en tu espacio privado, multitenant.',
    image: '/templates/images/salad.jpg',
    alt: 'Ensalada fresca para stock',
  },
  {
    title: 'QR y enlace público',
    text: 'Publica la carta con un clic y genera un QR para la mesa. El comensal abre el menú en el móvil sin apps. Actualizas el diseño y el mismo enlace muestra siempre la versión nueva.',
    image: '/templates/images/cocktail.jpg',
    alt: 'Cóctel para carta de bar',
  },
  {
    title: 'Exportar PNG y PDF',
    text: 'Descarga la página activa en PNG o el menú completo en PDF multipágina, listo para imprimir, enviar por WhatsApp o usar fuera de la app cuando lo necesites.',
    image: '/templates/images/dessert.jpg',
    alt: 'Postre para exportar en carta',
  },
] as const;

const STEPS = [
  {
    n: '01',
    title: 'Elige plantilla o empieza en blanco',
    text: 'Entra en la galería, filtra por estilo (bar, italiana, mexicana…) o parte de un lienzo vacío. La plantilla en blanco está siempre a un clic si quieres total libertad creativa.',
    image: '/templates/images/coffee.jpg',
    alt: 'Café como punto de partida',
    points: ['Plantillas por categoría', 'Vista previa real del diseño', 'Un clic para crear tu menú'],
  },
  {
    n: '02',
    title: 'Diseña tu carta en el editor',
    text: 'Añade texto, formas e imágenes. Sube fotos de tus platos o importa stock. Organiza capas, ajusta el fondo de cada página A4 y guarda automáticamente mientras trabajas. También en móvil, con paneles Capas / Lienzo / Propiedades.',
    image: '/templates/images/burger_meal.jpg',
    alt: 'Burger meal en editor',
    points: ['Autosave continuo', 'Stock + subida propia', 'Editor adaptable a móvil'],
  },
  {
    n: '03',
    title: 'Publica, QR y comparte',
    text: 'Activa la publicación, copia el enlace o descarga el QR. Colócalo en mesa, escaparate o redes. Cuando cambies precios o platos, el cliente verá la carta actualizada al instante.',
    image: '/templates/images/wine.jpg',
    alt: 'Vino para menú publicado',
    points: ['QR listo para imprimir', 'Enlace público /p/…', 'Export PNG y PDF'],
  },
] as const;

export function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-top">
        <a href="#inicio" className="landing-brand">
          MenuBuilder
        </a>
        <nav className="landing-nav" aria-label="Principal">
          <a href="#funciones">Funciones</a>
          <a href="#como">Cómo funciona</a>
          <Link to="/login" className="landing-nav-link">
            Entrar
          </Link>
          <Link to="/register" className="btn-landing-primary">
            Crear cuenta
          </Link>
        </nav>
      </header>

      <section className="landing-hero" id="inicio">
        <div className="landing-hero-media" aria-hidden="true">
          <img src="/templates/images/steak.jpg" alt="" className="landing-hero-img" />
          <div className="landing-hero-shade" />
        </div>
        <div className="landing-hero-content">
          <p className="landing-brand-hero">MenuBuilder</p>
          <h1>Tu carta digital, lista para la mesa</h1>
          <p className="landing-hero-lead">
            Diseña menús multipágina, publícalos con QR y actualízalos cuando quieras. Sin imprimir cada
            cambio.
          </p>
          <div className="landing-hero-actions">
            <Link to="/register" className="btn-landing-primary btn-landing-lg">
              Empezar gratis
            </Link>
            <a href="#funciones" className="btn-landing-ghost btn-landing-lg">
              Ver funciones
            </a>
          </div>
        </div>
      </section>

      <section className="landing-showcase" id="funciones">
        <header className="landing-section-head landing-section-head--center">
          <h2>Todo lo que necesitas para tu carta</h2>
          <p>Del borrador al QR en la mesa, en un solo flujo pensado para hostelería.</p>
        </header>

        <div className="landing-feature-grid">
          {FEATURES.map((f) => (
            <article key={f.title} className="landing-feature-tile">
              <div className="landing-feature-media">
                <img src={f.image} alt={f.alt} loading="lazy" />
              </div>
              <div className="landing-feature-body">
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-journey" id="como">
        <header className="landing-section-head landing-section-head--center">
          <h2>Cómo funciona</h2>
          <p>Tres pasos claros, con todas las herramientas que usa un restaurante de verdad.</p>
        </header>

        <div className="landing-journey-list">
          {STEPS.map((s, i) => (
            <article
              key={s.n}
              className={`landing-journey-row${i % 2 === 1 ? ' landing-journey-row--reverse' : ''}`}
            >
              <div className="landing-journey-media">
                <img src={s.image} alt={s.alt} loading="lazy" />
                <span className="landing-journey-badge">{s.n}</span>
              </div>
              <div className="landing-journey-copy">
                <h3>{s.title}</h3>
                <p>{s.text}</p>
                <ul>
                  {s.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <div className="landing-cta-inner">
          <h2>Empieza a diseñar tu menú hoy</h2>
          <p>Crea tu cuenta y publica la primera carta en minutos. Plantillas, editor, QR y exportación incluidos.</p>
          <Link to="/register" className="btn-landing-primary btn-landing-lg">
            Crear cuenta gratis
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-grid">
          <div className="landing-footer-brand">
            <span className="landing-footer-logo">MenuBuilder</span>
            <p>
              Cartas digitales para restaurantes, bares y cafeterías. Diseña, publica y actualiza sin
              reimprimir.
            </p>
          </div>
          <div className="landing-footer-col">
            <h4>Producto</h4>
            <a href="#funciones">Funciones</a>
            <a href="#como">Cómo funciona</a>
            <Link to="/register">Crear cuenta</Link>
            <Link to="/login">Iniciar sesión</Link>
          </div>
          <div className="landing-footer-col">
            <h4>Incluye</h4>
            <span>Editor de capas</span>
            <span>Plantillas y stock</span>
            <span>QR público</span>
            <span>Export PNG / PDF</span>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <p>© {new Date().getFullYear()} MenuBuilder</p>
          <p className="landing-footer-credit">
            Diseñado por{' '}
            <a href="https://carlinitools.com" target="_blank" rel="noopener noreferrer">
              CarliniTools
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
