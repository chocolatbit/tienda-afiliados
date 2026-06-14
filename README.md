# Tienda Afiliados Pro

Plataforma de tienda de afiliados de Amazon con panel de administración y auto-extracción de datos de productos.

## Requisitos

- **Node.js 18+** (para el backend)
- Navegador moderno (Chrome, Firefox, Edge)

## Instalación

```bash
cd server
npm install
```

## Configuración

Edita `server/.env` con tus datos:

```
AMAZON_ASSOCIATE_TAG=
AMAZON_DOMAIN=amazon.es
PORT=3000
```

- `AMAZON_ASSOCIATE_TAG`: tu ID de afiliado de Amazon
- `AMAZON_DOMAIN`: dominio de Amazon para tu país (amazon.es, amazon.com, etc.)

## Uso

```bash
cd server
npm start
```

Abre en el navegador: [http://localhost:3000](http://localhost:3000)

## Funcionalidades

- **Tienda**: visualización de productos en grid responsivo con búsqueda y filtros por categoría
- **Carrito simulado**: agregar productos al carrito con animación flotante y contador
- **Modo oscuro**: toggle en la cabecera con persistencia en localStorage
- **Panel de administración**: presiona la tecla **A** tres veces rápidamente para abrirlo
- **Auto-llenar**: pega una URL de Amazon y el sistema extrae nombre, imagen y precio automáticamente
- **Paginación**: cuando hay más de 12 productos
- **Persistencia**: todos los datos se guardan en localStorage

## Estructura

```
tienda-afiliados/
├── index.html           # Página principal
├── css/
│   └── style.css        # Estilos
├── js/
│   ├── products.js      # Gestión de productos (localStorage)
│   ├── cookies.js       # Gestión de cookies
│   ├── admin.js         # Panel de administración
│   └── app.js           # Lógica principal
├── server/
│   ├── package.json
│   ├── .env             # Configuración
│   ├── scraper.js       # Extrae datos de Amazon
│   └── server.js        # Servidor Express
└── README.md
```
