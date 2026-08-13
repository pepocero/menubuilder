import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';

const TOC = [
  { id: 'inicio', label: 'Primeros pasos' },
  { id: 'editor', label: 'El editor' },
  { id: 'texto', label: 'Cajas de texto' },
  { id: 'linea-carta', label: 'Línea de carta' },
  { id: 'conversion', label: 'Convertir texto → línea de carta' },
  { id: 'editar-filas', label: 'Editar filas, platos y precios' },
  { id: 'imagenes', label: 'Imágenes y formas' },
  { id: 'paginas', label: 'Páginas y tamaño' },
  { id: 'publicar', label: 'Publicar y QR' },
  { id: 'exportar', label: 'Exportar e importar' },
] as const;

export function DocsPage() {
  return (
    <div className="docs-page">
      <AppLayout />
      <main className="docs-main">
        <header className="docs-header">
          <p className="docs-kicker">
            <Link to="/dashboard">Mis menús</Link>
            <span aria-hidden> / </span>
            Documentación
          </p>
          <h1>Guía de uso</h1>
          <p className="docs-lead">
            Cómo crear y editar cartas digitales en Paper To Menu: textos, líneas de carta, imágenes,
            páginas, publicación con QR y exportación.
          </p>
        </header>

        <nav className="docs-toc" aria-label="Índice de la guía">
          <h2>Índice</h2>
          <ol>
            {TOC.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`}>{item.label}</a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="docs-article">
          <section id="inicio" className="docs-section">
            <h2>Primeros pasos</h2>
            <p>
              En <Link to="/dashboard">Mis menús</Link> ves todas tus cartas. Desde ahí puedes:
            </p>
            <ul>
              <li>
                <strong>Nuevo menú en blanco</strong> — abre el editor con una página vacía.
              </li>
              <li>
                <strong>Desde plantilla</strong> — elige un diseño de partida en{' '}
                <Link to="/templates">Plantillas</Link>.
              </li>
              <li>
                <strong>Importar menú</strong> — sube un archivo <code>menu.json</code> exportado
                antes.
              </li>
              <li>
                <strong>Duplicar / Eliminar</strong> — en cada tarjeta de menú.
              </li>
            </ul>
            <p>
              La barra superior enlaza a Mis menús, Plantillas, Mis QR y esta Documentación. Cada
              cuenta solo ve y edita sus propios menús.
            </p>
          </section>

          <section id="editor" className="docs-section">
            <h2>El editor</h2>
            <p>
              Al abrir un menú entras en el editor. Arriba está la barra de herramientas; a la
              izquierda las capas; a la derecha las propiedades del elemento seleccionado; en el
              centro el lienzo (página A4 u otro tamaño).
            </p>
            <h3>Modo del lienzo</h3>
            <ul>
              <li>
                <strong>Mover</strong> — seleccionar, mover y editar capas (recomendado en
                escritorio).
              </li>
              <li>
                <strong>Scroll</strong> — desplazar la vista sin seleccionar capas (útil en móvil).
              </li>
            </ul>
            <h3>Zoom</h3>
            <p>
              Usa <strong>+</strong> / <strong>−</strong>, el porcentaje (restablece a 100 %) o{' '}
              <strong>Ajustar</strong>. También puedes acercar/alejar con <kbd>Ctrl</kbd> + rueda del
              ratón (hasta 250 %).
            </p>
            <h3>Capas</h3>
            <p>
              Cada elemento del lienzo es una capa. En el panel izquierdo puedes seleccionar,
              renombrar, bloquear, duplicar o eliminar. El orden de la lista controla qué queda
              delante o detrás: arrastra el asa (⋮⋮) o usa ↑ / ↓.
            </p>
            <h3>Deshacer</h3>
            <p>
              <strong>↶</strong> / <strong>↷</strong> (o <kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Y</kbd>)
              deshacen y rehacen cambios de la página activa.
            </p>
          </section>

          <section id="texto" className="docs-section">
            <h2>Cajas de texto</h2>
            <p>
              Una <strong>caja de texto</strong> es texto libre: títulos, notas, párrafos o un
              borrador entero de la carta pegado desde otro sitio.
            </p>
            <h3>Crear texto</h3>
            <ol>
              <li>
                En la barra, menú <strong>Insertar</strong>, pulsa <strong>Texto</strong>.
              </li>
              <li>Aparece una caja en el lienzo. Haz doble clic (o edita en propiedades) para escribir.</li>
            </ol>
            <h3>Formato</h3>
            <p>
              Con el texto seleccionado, el panel derecho permite fuente, tamaño, color, negrita,
              cursiva y alineación. Si seleccionas solo una parte del texto en el lienzo, el formato
              se aplica a esa porción.
            </p>
            <h3>Unir textos</h3>
            <p>
              Si tienes varias cajas de texto seleccionadas, <strong>Unir textos</strong> las
              combina en una sola (de arriba a abajo). Útil tras importar una carta por OCR o pegar
              trozos sueltos.
            </p>
            <h3>Unir líneas de carta</h3>
            <p>
              Con <kbd>Shift</kbd> puedes seleccionar dos o más <strong>líneas de carta</strong>.
              El botón <strong>Unir líneas de carta</strong> (panel o menú Editar) crea un solo
              bloque con todas las filas, en orden de arriba a abajo.
            </p>
            <p className="docs-callout">
              El texto libre <strong>no</strong> alinea solo el nombre del plato con el precio. Para
              ese patrón usa <a href="#linea-carta">línea de carta</a> o{' '}
              <a href="#conversion">conviértelo</a>.
            </p>
          </section>

          <section id="linea-carta" className="docs-section">
            <h2>¿Qué es una línea de carta?</h2>
            <p>
              Es el bloque pensado para el menú clásico de restaurante: en cada fila, el{' '}
              <strong>nombre del plato</strong>, un <strong>separador</strong> (puntos, guiones…) y
              el <strong>precio</strong>, con <strong>ingredientes opcionales</strong> debajo.
            </p>
            <pre className="docs-example" aria-label="Ejemplo de línea de carta">
{`Margarida ............................................ 10,00 €
Mozzarella - Tomàquet - Albérrega

De la Casa ............................................ 14,00 €
Bacó - Pernil dolç - Xorxíço - Xampinyons`}
            </pre>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Parte</th>
                  <th>Qué hace</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Plato</td>
                  <td>Nombre; ancho de columna fijo (ajustable)</td>
                </tr>
                <tr>
                  <td>Separador</td>
                  <td>Rellena el espacio entre plato y precio</td>
                </tr>
                <tr>
                  <td>Precio</td>
                  <td>Se ajusta al largo del texto del precio</td>
                </tr>
                <tr>
                  <td>Ingredientes</td>
                  <td>Línea bajo el plato, a todo el ancho del bloque</td>
                </tr>
              </tbody>
            </table>
            <p>
              Todo el bloque se selecciona y mueve junto. El ancho del bloque se cambia con las{' '}
              <strong>asas</strong> del lienzo: se redistribuyen plato / separador / precio{' '}
              <em>sin</em> escalar la tipografía.
            </p>
            <h3>Crear una línea de carta vacía</h3>
            <p>
              En <strong>Insertar</strong>, <strong>Línea de carta</strong> inserta un
              bloque con una fila de ejemplo. Luego editas filas y textos en el panel derecho.
            </p>
          </section>

          <section id="conversion" className="docs-section">
            <h2>Convertir texto → línea de carta</h2>
            <p>
              Si ya tienes la carta escrita en una caja de texto (o tras OCR), puedes convertirla de
              golpe.
            </p>
            <ol>
              <li>Selecciona <strong>una sola</strong> caja de texto.</li>
              <li>
                Pulsa <strong>Convertir a línea de carta</strong> en el menú <strong>Editar</strong> de la barra, o{' '}
                <strong>→ Línea de carta</strong> en propiedades.
              </li>
            </ol>
            <h3>Cómo debe estar escrito el texto</h3>
            <ul>
              <li>
                <strong>Una línea por plato</strong> con el precio al final, por ejemplo:
                <br />
                <code>Pollastre ........................ 12,00 €</code>
              </li>
              <li>
                Separación entre nombre y precio: puntos, guiones largos o varios espacios.
              </li>
              <li>
                Precios reconocidos: <code>10,00 €</code>, <code>12€</code>, <code>$9.50</code>, etc.
              </li>
              <li>
                <strong>Ingredientes</strong> (opcional) justo debajo del plato+precio: en una
                sola línea separados por <code> - </code>, comas o punto y coma, o en{' '}
                <strong>varias líneas</strong> (OCR: <code>Pollo,</code> / <code>Nueces,</code>…).
                Al convertir se unen en una línea con <code> - </code> y quedan en el campo
                editable <strong>Ingredientes</strong>.
                <br />
                <code>Carn de pollastre - Ceba - Xampinyons - Mozzarella</code>
                <br />
                <code>Ingrediente 1, Ingrediente 2, Ingrediente 3</code>
              </li>
              <li>
                <strong>Líneas en blanco</strong> entre platos se conservan como espacio extra
                (saltos) entre filas.
              </li>
            </ul>
            <p className="docs-callout">
              No hace falta marcar a mano qué son ingredientes: si bajo un plato+precio hay una
              lista (misma línea o varias líneas OCR con comas), se empareja sola y queda editable
              en el campo Ingredientes.
            </p>
          </section>

          <section id="editar-filas" className="docs-section">
            <h2>Editar filas, platos y precios</h2>
            <p>
              Selecciona el bloque de línea de carta. En el panel derecho verás las opciones de{' '}
              <strong>Línea de carta</strong>.
            </p>
            <h3>Filas</h3>
            <ul>
              <li>
                Elige <strong>Fila 1, 2…</strong> o <strong>Todas</strong> (formato de una columna en
                todas las filas a la vez).
              </li>
              <li>
                <strong>+ Fila</strong> añade otra fila con el mismo estilo.
              </li>
              <li>
                <strong>− Fila</strong> elimina la fila activa (hace falta más de una).
              </li>
              <li>
                <strong>Espacio entre filas</strong> — separación base entre platos.
              </li>
              <li>
                <strong>Saltos después</strong> — líneas en blanco extra tras esa fila (o tras todas
                si eliges «Todas»). Sirve para abrir más el bloque hacia abajo.
              </li>
            </ul>
            <h3>Columnas: Plato, Separador, Precio</h3>
            <ul>
              <li>
                Pestañas <strong>Plato / Separador / Precio</strong> para editar el texto y el formato
                de cada columna.
              </li>
              <li>
                Fuente, tamaño, color, negrita, cursiva y alineación son independientes por columna
                (y por fila, salvo que uses «Todas»).
              </li>
              <li>
                En <strong>Separador</strong> eliges puntos, guiones, espacios o texto personalizado.
              </li>
              <li>
                El <strong>ancho de la columna plato</strong> se regula con el deslizador; el precio
                se adapta solo al texto.
              </li>
            </ul>
            <h3>Ingredientes</h3>
            <p>
              Con una fila concreta seleccionada (no «Todas»), el campo{' '}
              <strong>Ingredientes</strong> muestra u oculta la línea debajo del plato. Déjalo vacío
              para quitarlos.
            </p>
          </section>

          <section id="imagenes" className="docs-section">
            <h2>Imágenes y formas</h2>
            <ul>
              <li>
                <strong>Subir</strong> — imagen desde tu dispositivo (se comprime al subir).
              </li>
              <li>
                <strong>Stock</strong> — buscar imágenes de banco.
              </li>
              <li>
                <strong>Importar carta</strong> — OCR / IA a partir de una foto de menú (crea capas de
                texto que luego puedes convertir a línea de carta).
              </li>
              <li>
                <strong>Archivos</strong> — gestionar imágenes ya subidas.
              </li>
              <li>
                <strong>Descargar</strong> — guarda en tu ordenador la imagen seleccionada (el
                archivo original).
              </li>
              <li>
                <strong>Ajustar a A4</strong> — encaja la imagen seleccionada al tamaño de la página.
              </li>
              <li>
                Formas: <strong>rectángulo</strong>, <strong>línea</strong> y <strong>círculo</strong>{' '}
                en Insertar.
              </li>
            </ul>
            <p>
              El color de <strong>fondo</strong> de la página se cambia en el menú <strong>Página</strong>.
            </p>
          </section>

          <section id="paginas" className="docs-section">
            <h2>Páginas y tamaño</h2>
            <ul>
              <li>
                <strong>+ Página</strong> añade otra página; puedes eliminar o reordenar (subir /
                bajar).
              </li>
              <li>
                En el panel de tamaño de página puedes cambiar el formato (p. ej. A4) de la página
                activa.
              </li>
              <li>
                En la vista pública (QR), puedes configurar el <strong>scroll</strong> (vertical /
                horizontal) y la <strong>separación entre páginas</strong>. Eso no cambia cómo se
                apilan en el editor.
              </li>
            </ul>
          </section>

          <section id="publicar" className="docs-section">
            <h2>Publicar y QR</h2>
            <ol>
              <li>Guarda el menú (el editor guarda automáticamente al editar).</li>
              <li>
                Abre el diálogo de <strong>QR</strong> y pulsa <strong>Publicar y generar QR</strong>.
              </li>
              <li>
                Comparte el enlace, <strong>Copia el enlace</strong> (verás un aviso al copiar) o
                descarga el QR en PNG/SVG para imprimir.
              </li>
            </ol>
            <p>
              En <Link to="/qrs">Mis QR</Link> ves tus cartas con enlace (activas o inactivas).{' '}
              <strong>Despublicar</strong> deja el enlace inactivo pero conserva el QR; al publicar
              de nuevo se reutiliza el mismo enlace. <strong>Eliminar</strong> borra el enlace y la
              imagen asociada; al publicar después se crea un enlace nuevo.
            </p>
          </section>

          <section id="exportar" className="docs-section">
            <h2>Exportar e importar</h2>
            <ul>
              <li>
                <strong>PNG</strong> — exporta la página activa como imagen.
              </li>
              <li>
                <strong>PDF</strong> — todas las páginas en un PDF.
              </li>
              <li>
                <strong>JSON</strong> — exporta el diseño completo (<code>menu.json</code>),
                incluidas las líneas de carta (filas, precios, ingredientes y formato), para
                respaldo o para importarlo luego en Mis menús.
              </li>
            </ul>
          </section>

          <section className="docs-section docs-section--end">
            <h2>¿Dudas rápidas?</h2>
            <dl className="docs-faq">
              <dt>¿Texto o línea de carta?</dt>
              <dd>
                Usa texto para títulos y borradores; línea de carta para plato ··· precio alineados.
              </dd>
              <dt>¿No me deja convertir?</dt>
              <dd>
                Debe haber exactamente una caja de texto seleccionada (no varias capas ni una celda
                interna).
              </dd>
              <dt>¿Los ingredientes salen en «Texto (Plato)» en vez de en «Ingredientes»?</dt>
              <dd>
                Vuelve a convertir el texto a línea de carta. El nombre del plato debe quedar en{' '}
                <strong>Texto (Plato)</strong> y la lista en <strong>Ingredientes</strong> (una sola
                línea con <code> - </code>). Si el OCR dejó blancos entre ítems, también se
                emparejan.
              </dd>
              <dt>¿Los ingredientes no se detectan o salen en filas sueltas?</dt>
              <dd>
                Deben ir bajo el plato+precio. Vale una línea con <code> - </code>, comas o{' '}
                <code>;</code>, o varias líneas tipo OCR. Tras convertir, edítalos en el campo{' '}
                <strong>Ingredientes</strong> de esa fila (no en Plato).
              </dd>
              <dt>¿Quiero más aire entre platos?</dt>
              <dd>
                Sube «Espacio entre filas», o «Saltos después» por fila / en Todas; al convertir, las
                líneas en blanco del texto también cuentan.
              </dd>
            </dl>
            <p>
              <Link to="/dashboard" className="btn-primary">
                Volver a Mis menús
              </Link>
            </p>
          </section>
        </article>
      </main>
    </div>
  );
}
