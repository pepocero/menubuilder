# Documentación del editor de menús

Guía de módulos y comportamientos del editor. Cada documento describe un módulo tal como debe usarse y cómo está modelado en código.

| Documento | Contenido |
|-----------|-----------|
| [Línea de carta](./linea-de-carta.md) | Capas `menuLine`, cajas de texto, conversión a plato ··· precio e ingredientes |

## Principios comunes

- **Multitenant:** los módulos y datos de cada usuario solo aplican a quien los tiene instalados.
- **Datos reales:** no se usan mocks en flujos de producto.
- **No romper lo que funciona:** cambios acotados al requisito pedido.
