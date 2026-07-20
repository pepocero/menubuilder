import { Link } from 'react-router-dom';

const FEATURES = [
  {
    title: 'Editor visual de capas',
    text: 'Texto, formas e imágenes con control total de posición, tamaño y estilo. Trabaja como en un diseño profesional.',
  },
  {
    title: 'Varias páginas A4',
    text: 'Apila páginas una debajo de otra. Al compartir el QR, el cliente hace scroll y ve el menú completo en orden.',
  },
  {
    title: 'Plantillas listas',
    text: 'Italiana, mexicana, bar, cafetería, comida rápida y más. Empieza con un diseño sólido y personalízalo.',
  },
  {
    title: 'Imágenes propias y stock',
    text: 'Sube fotos de tus platos o busca en el banco integrado. Compresión automática para que carguen rápido.',
  },
  {
    title: 'QR y enlace público',
    text: 'Publica tu carta con un toque. Genera un QR para la mesa: el comensal abre el menú en su móvil.',
  },
  {
    title: 'Exportar PNG y PDF',
    text: 'Descarga la página activa o el menú multipágina listo para imprimir o compartir fuera de la app.',
  },
] as const;

const STEPS = [
  { n: '01', title: 'Elige plantilla o empieza en blanco', text: 'Galería por tipo de negocio o lienzo limpio.' },
  { n: '02', title: 'Diseña tu carta', text: 'Edita textos, añade fotos y organiza las páginas.' },
  { n: '03', title: 'Publica y comparte', text: 'Activa el QR y ponlo en mesa, escaparate o redes.' },
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
          <img
            src="/templates/images/steak.jpg"
            alt=""
            className="landing-hero-img"
          />
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

      <section className="landing-section" id="funciones">
        <header className="landing-section-head">
          <h2>Todo lo que necesitas para tu carta</h2>
          <p>Del borrador al QR en la mesa, en un solo flujo pensado para hostelería.</p>
        </header>
        <ul className="landing-feature-list">
          {FEATURES.map((f) => (
            <li key={f.title} className="landing-feature">
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="landing-section landing-section--tint" id="como">
        <header className="landing-section-head">
          <h2>Tres pasos</h2>
          <p>Sin curva de aprendizaje complicada.</p>
        </header>
        <ol className="landing-steps">
          {STEPS.map((s) => (
            <li key={s.n} className="landing-step">
              <span className="landing-step-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-cta">
        <h2>Empieza a diseñar tu menú hoy</h2>
        <p>Crea tu cuenta y publica la primera carta en minutos.</p>
        <Link to="/register" className="btn-landing-primary btn-landing-lg">
          Crear cuenta gratis
        </Link>
      </section>

      <footer className="landing-footer">
        <span className="landing-brand">MenuBuilder</span>
        <p>Cartas digitales para restaurantes, bares y cafeterías.</p>
      </footer>
    </div>
  );
}
