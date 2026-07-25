# Documentación del editor de menús

## Guía para usuarios (en la app)

Tras iniciar sesión: **Documentación** en la barra superior → ruta `/documentacion`.

Explica de forma práctica textos, líneas de carta, conversión, filas, publicación QR, etc.

## Notas técnicas (desarrolladores)

| Documento | Contenido |
|-----------|-----------|
| [Línea de carta](./linea-de-carta.md) | Capas `menuLine`, conversión, ingredientes, modelo de datos |

## Principios comunes

- **Multitenant:** los módulos y datos de cada usuario solo aplican a quien los tiene instalados.
- **Datos reales:** no se usan mocks en flujos de producto.
- **No romper lo que funciona:** cambios acotados al requisito pedido.
