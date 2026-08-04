import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';

/** Imágenes de Pixabay descargadas en /public/landing (uso libre, atribución en pie). */
const FEATURES = [
  {
    title: 'Editor visual de capas',
    text: 'Control total como en un estudio profesional: tipografías, colores, opacidad, bloqueo y reordenación. Cada plato, precio e imagen es una capa que puedes afinar al milímetro. Tu marca, tu estilo, tu carta.',
    image: '/landing/editor-layers.jpg',
    alt: 'Espacio de trabajo digital para diseñar',
  },
  {
    title: 'IA que lee tu carta',
    text: '¿Foto de la carta, boceto a mano o captura? La IA reconoce texto, columnas y precios y los convierte en capas editables. Dejas de teclear plato a plato y ganas horas cada temporada.',
    image: '/landing/import-ocr.jpg',
    alt: 'Foto de platos lista para digitalizar',
  },
  {
    title: 'Varias páginas A4',
    text: 'Tapas, cartas, postres, vinos: tantas páginas como necesites. El cliente abre el QR y hace scroll por la carta completa, exactamente como la diseñaste. Sin PDFs sueltos ni apps.',
    image: '/landing/menu-pages.jpg',
    alt: 'Carta de restaurante multipágina',
  },
  {
    title: 'Plantillas que venden',
    text: 'Italiana, mexicana, bar, cafetería, fast food o fine dining. Empieza con un diseño que ya transmite calidad, cambia textos y fotos, y deja tu marca lista en minutos — no en días.',
    image: '/landing/templates.jpg',
    alt: 'Pizarra de menú tipo plantilla',
  },
  {
    title: 'Fotos que dan hambre',
    text: 'Sube tus platos (compresión automática) o elige stock gastronómico integrado. Imágenes nítidas que elevan el ticket medio y se quedan en tu espacio privado, multitenant.',
    image: '/landing/stock-food.jpg',
    alt: 'Fotografía gastronómica para la carta',
  },
  {
    title: 'QR siempre actualizado',
    text: 'Publica con un clic y pon el QR en mesa o escaparate. Cambias un precio a las 13:00 y a las 13:01 el comensal ya lo ve. Cero reimpresiones. Cero menús desfasados.',
    image: '/landing/qr-code.jpg',
    alt: 'Código QR para escanear en mesa',
  },
  {
    title: 'Exporta y comparte',
    text: 'PNG para redes, PDF multipágina para imprimir, JSON para respaldar o clonar diseños. Tu carta sale del editor lista para WhatsApp, Instagram o la impresora.',
    image: '/landing/export-print.jpg',
    alt: 'Documento listo para imprimir o exportar',
  },
] as const;

const AI_BENEFITS = [
  {
    title: 'De papel a digital en minutos',
    text: 'Fotografía la carta del local o sube un PDF escaneado. La IA lee platos, precios y secciones y te deja un borrador editable. Ideal para cambios de temporada o menús del día.',
    image: '/landing/ai-photo-menu.jpg',
    alt: 'Manos fotografiando una carta de menú impresa de restaurante',
  },
  {
    title: 'Bocetos y dibujos a mano',
    text: '¿Diseñaste la carta en una libreta? Sube el boceto. Paper To Menú interpreta el texto y lo coloca en capas para que pases del papel al QR sin reescribir nada.',
    image: '/landing/ai-handwritten-menu.jpg',
    alt: 'Manos fotografiando una carta de menú escrita a mano con bolígrafo',
  },
  {
    title: 'Columnas y precios limpios',
    text: 'Detecta layouts a dos columnas, categorías en mayúsculas y precios europeos. Menos errores, menos capas mezcladas y más tiempo para cuidar tipografías y fotos.',
    image: '/landing/ai-two-column-menu.jpg',
    alt: 'Carta de menú a dos columnas sobre mesa de restaurante de lujo',
  },
  {
    title: 'Tu estilo, no una plantilla rígida',
    text: 'El resultado es un punto de partida editable: fuentes, colores, imágenes y orden. La IA ahorra el trabajo pesado; tú firmas el acabado profesional.',
    image: '/landing/personalizacion.png',
    alt: 'Personalización del estilo de la carta digital',
  },
] as const;

const STEPS = [
  {
    n: '01',
    title: 'Empieza con ventaja',
    text: 'Elige una plantilla que venda tu tipo de local, parte de un lienzo en blanco o importa foto, boceto o carta en papel con IA. En un clic ya tienes menú en marcha.',
    image: '/landing/step-blank.jpg',
    alt: 'Mesa de restaurante como punto de partida',
    points: ['Plantillas por estilo de negocio', 'Importar con IA desde imagen o boceto', 'Crear menú en un clic'],
  },
  {
    n: '02',
    title: 'Diseña como un profesional',
    text: 'Edita capas, tipografías y fotos. Sube tus platos o usa stock. Varias páginas A4, autosave y paneles pensados también para móvil. Cada detalle refuerza tu marca en mesa.',
    image: '/landing/step-editor.jpg',
    alt: 'Composición de menú con platos',
    points: ['Autosave continuo', 'Stock + fotos propias', 'Editor listo para móvil'],
  },
  {
    n: '03',
    title: 'Publica y cobra la atención',
    text: 'Activa el enlace público, descarga el QR y colócalo donde el cliente decide. Actualizas precios o platos y el mismo QR muestra la carta nueva al instante. Exporta PNG o PDF cuando lo necesites.',
    image: '/landing/step-publish.jpg',
    alt: 'QR listo para publicar la carta',
    points: ['QR listo para imprimir', 'Enlace público /p/…', 'Export PNG, PDF y JSON'],
  },
] as const;

export function LandingPage() {
  const { user, loading } = useAuth();

  return (
    <div className="landing">
      <header className="landing-top">
        <a href="#inicio" className="landing-brand">
          Paper To Menú
        </a>
        <nav className="landing-nav" aria-label="Principal">
          <a href="#funciones">Funciones</a>
          <a href="#importar">Funciones con IA</a>
          <a href="#como">Cómo funciona</a>
          {!loading && user ? (
            <Link to="/dashboard" className="btn-landing-primary">
              Mis menús
            </Link>
          ) : (
            <>
              <Link to="/login" className="landing-nav-link">
                Entrar
              </Link>
              <Link to="/register" className="btn-landing-primary">
                Crear cuenta
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="landing-hero" id="inicio">
        <div className="landing-hero-media" aria-hidden="true">
          <img src="/templates/images/steak.jpg" alt="" className="landing-hero-img" />
          <div className="landing-hero-shade" />
        </div>
        <div className="landing-hero-content">
          <p className="landing-brand-hero">Paper To Menú</p>
          <h1>Convierte tus fotos en un menú digital al instante.</h1>
          <p className="landing-hero-lead">
            Diseña menús que enamoran! Importa fotos, bocetos o cartas hechas a mano. La IA
            lo reconoce todo, y te genera una carta digital del menú de tu restaurante. Luego
            publícalos con QR y actualízalos al instante.
          </p>
          <div className="landing-hero-actions">
            <Link to="/register" className="btn-landing-primary btn-landing-lg">
              Empieza gratis ahora
            </Link>
            <a href="#importar" className="btn-landing-ghost btn-landing-lg">
              Ver la IA en acción
            </a>
          </div>
        </div>
      </section>

      <section className="landing-showcase" id="funciones">
        <header className="landing-section-head landing-section-head--center">
          <h2>Todo lo que tu local necesita para destacar</h2>
          <p>
            Del primer boceto al QR en la mesa: un flujo pensado para hostelería que quiere
            verse profesional y moverse rápido.
          </p>
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

      <section className="landing-ocr" id="importar">
        <div className="landing-ocr-inner">
          <header className="landing-section-head landing-section-head--center">
            <p className="landing-ocr-eyebrow">Potencia con inteligencia artificial</p>
            <h2>Funciones con IA</h2>
            <p className="landing-ocr-lead">
              Sube una carta impresa, una foto del menú del día o incluso un boceto a mano. La IA
              de Paper To Menú lee el contenido, respeta columnas y precios, y te entrega capas
              editables listas para publicar. Digitalizar deja de ser un proyecto: se convierte en
              una ventaja competitiva.
            </p>
          </header>

          <div className="landing-ocr-benefits">
            {AI_BENEFITS.map((b) => (
              <article key={b.title} className="landing-ocr-benefit">
                <div className="landing-ocr-benefit-media">
                  <img src={b.image} alt={b.alt} loading="lazy" />
                </div>
                <div className="landing-ocr-benefit-body">
                  <h3>{b.title}</h3>
                  <p>{b.text}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="landing-ocr-layout">
            <div className="landing-ocr-media">
              <img
                src="/landing/import-ocr.jpg"
                alt="Fotografiar platos o la carta para digitalizarla"
                loading="lazy"
              />
            </div>

            <ol className="landing-ocr-steps">
              <li>
                <span className="landing-ocr-step-n">1</span>
                <div>
                  <h3>Sube foto, captura o boceto</h3>
                  <p>
                    PNG, JPG o un archivo de tu biblioteca. Cuanto más nítida la imagen, más
                    preciso el reconocimiento — pero incluso un boceto claro te ahorra horas de
                    tecleo.
                  </p>
                </div>
              </li>
              <li>
                <span className="landing-ocr-step-n">2</span>
                <div>
                  <h3>La IA estructura tu menú</h3>
                  <p>
                    Detecta títulos, platos, ingredientes y precios. Separa columnas y categorías
                    (Tapas, Pizzas, Entrepans…) para que no mezcle secciones. Tú eliges el motor:
                    Workers AI o OpenAI.
                  </p>
                </div>
              </li>
              <li>
                <span className="landing-ocr-step-n">3</span>
                <div>
                  <h3>Retoca, publica y vende</h3>
                  <p>
                    Ajusta tipografías, fotos y precios en el editor visual. Publica el QR o
                    exporta PNG/PDF. Tu carta pasa del papel (o del dibujo) a la mesa digital en
                    un solo flujo.
                  </p>
                </div>
              </li>
            </ol>
          </div>

          <div className="landing-ocr-cta-row">
            <Link to="/register" className="btn-landing-primary btn-landing-lg">
              Probar importación con IA
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-journey" id="como">
        <header className="landing-section-head landing-section-head--center">
          <h2>Cómo funciona Paper To Menú</h2>
          <p>Tres pasos. Cero fricción. El mismo flujo que usan locales que quieren verse premium.</p>
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
          <h2>Tu próxima carta puede estar online hoy</h2>
          <p>
            Crea la cuenta, importa con IA o parte de una plantilla, y publica el QR antes de
            abrir. Editor, IA, plantillas, stock y exportación incluidos.
          </p>
          <Link to="/register" className="btn-landing-primary btn-landing-lg">
            Crear cuenta gratis
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-grid">
          <div className="landing-footer-brand">
            <span className="landing-footer-logo">Paper To Menú</span>
            <p>
              Cartas digitales que venden para restaurantes, bares y cafeterías. Diseña, digitaliza
              con IA, publica y actualiza sin reimprimir.
            </p>
          </div>
          <div className="landing-footer-col">
            <h4>Producto</h4>
            <a href="#funciones">Funciones</a>
            <a href="#importar">Funciones con IA</a>
            <a href="#como">Cómo funciona</a>
            <Link to="/register">Crear cuenta</Link>
            <Link to="/login">Iniciar sesión</Link>
          </div>
          <div className="landing-footer-col">
            <h4>Incluye</h4>
            <span>Editor de capas profesional</span>
            <span>IA: carta, foto o boceto</span>
            <span>Plantillas y stock</span>
            <span>QR público siempre al día</span>
            <span>Export PNG / PDF / JSON</span>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <p>© {new Date().getFullYear()} Paper To Menú</p>
          <p className="landing-footer-credit">
            Diseñado por{' '}
            <a href="https://carlinitools.com" target="_blank" rel="noopener noreferrer">
              CarliniTools
            </a>
            {' · '}
            Fotos de{' '}
            <a href="https://pixabay.com/" target="_blank" rel="noopener noreferrer">
              Pixabay
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
