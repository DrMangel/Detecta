import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { Aplicacion } from './aplicacion';
// Fuente autoalojada (especificación de diseño, §2.3): sin servicio externo.
import '@fontsource-variable/plus-jakarta-sans';
import './estilos/base.css';

const raiz = document.getElementById('raiz');
if (raiz === null) {
  throw new Error('Falta el elemento #raiz en index.html');
}

createRoot(raiz).render(
  <StrictMode>
    <BrowserRouter>
      <Aplicacion />
    </BrowserRouter>
  </StrictMode>,
);
