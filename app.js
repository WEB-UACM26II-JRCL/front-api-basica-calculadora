// Frontend de la práctica: tokens únicamente en memoria del navegador.
const base = "http://127.0.0.1:8000";
let accessToken = null;
let refreshToken = null;

function mostrarSalida(dato) {
  document.getElementById("out").textContent =
    typeof dato === "string" ? dato : JSON.stringify(dato, null, 2);
}

function actualizarSesion(mensaje) {
  document.getElementById("sesion-msg").textContent = mensaje;
  document.querySelectorAll(".operacion").forEach(function (boton) {
    boton.disabled = !accessToken;
  });
}

function obtenerValores() {
  const a = Number(document.getElementById("in-a").value);
  const b = Number(document.getElementById("in-b").value);
  if (!Number.isFinite(a) || !Number.isFinite(b) ||
      document.getElementById("in-a").value.trim() === "" ||
      document.getElementById("in-b").value.trim() === "") {
    throw new Error("A y B deben ser números válidos.");
  }
  return { a, b };
}

// Obtiene Access Token y Refresh Token mediante POST /auth/login.
async function iniciarSesion() {
  const usuario = document.getElementById("usuario").value;
  const password = document.getElementById("password").value;
  try {
    const respuesta = await fetch(base + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, password })
    });
    const datos = await respuesta.json();
    if (!respuesta.ok) throw new Error(datos.detail || "Error de acceso");
    accessToken = datos.access_token;
    refreshToken = datos.refresh_token;
    document.getElementById("password").value = "";
    actualizarSesion("Sesión iniciada: " + usuario);
    mostrarSalida("Autenticación correcta.");
  } catch (error) {
    cerrarSesion();
    mostrarSalida("Error de login: " + error.message);
  }
}

// POST /auth/refresh: el refresh token no sirve para operar directamente.
async function renovarToken() {
  if (!refreshToken) throw new Error("Primero inicia sesión.");
  const respuesta = await fetch(base + "/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.detail || "No se pudo renovar");
  accessToken = datos.access_token;
  actualizarSesion("Access Token renovado.");
  return accessToken;
}

// Centraliza las peticiones protegidas y reintenta una vez ante HTTP 401.
async function solicitar(ruta, opciones = {}) {
  if (!accessToken) throw new Error("Inicia sesión antes de operar.");
  const config = {
    ...opciones,
    headers: { ...opciones.headers, Authorization: "Bearer " + accessToken }
  };
  let respuesta = await fetch(base + ruta, config);
  if (respuesta.status === 401 && refreshToken) {
    try {
      await renovarToken();
      config.headers.Authorization = "Bearer " + accessToken;
      respuesta = await fetch(base + ruta, config);
    } catch (error) {
      cerrarSesion();
      throw new Error("Sesión expirada: " + error.message);
    }
  }
  const datos = await respuesta.json();
  if (!respuesta.ok) {
    if (respuesta.status === 401) cerrarSesion();
    throw new Error(typeof datos.detail === "string"
      ? datos.detail : JSON.stringify(datos.detail || datos));
  }
  return datos;
}

async function operar(tipo) {
  try {
    const valores = obtenerValores();
    let datos;
    if (tipo === "sumar" || tipo === "restar") {
      const parametros = new URLSearchParams(valores);
      datos = await solicitar("/" + tipo + "?" + parametros);
    } else {
      datos = await solicitar("/" + tipo, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(valores)
      });
    }
    mostrarSalida(datos);
  } catch (error) {
    mostrarSalida("Error: " + error.message);
  }
}

function sumar() { operar("sumar"); }
function restar() { operar("restar"); }
function multiplicar() { operar("multiplicar"); }
function dividir() { operar("dividir"); }

// El cierre de sesión borra los tokens locales; NO revoca el JWT en servidor.
function cerrarSesion() {
  accessToken = null;
  refreshToken = null;
  document.getElementById("password").value = "";
  actualizarSesion("Sin sesión");
}

// /openapi.json es público; el backend actual no tiene /health.
async function comprobarConexion() {
  const mensaje = document.getElementById("health-msg");
  try {
    const respuesta = await fetch(base + "/openapi.json");
    if (!respuesta.ok) throw new Error("API no disponible");
    mensaje.textContent = "API disponible";
  } catch (error) {
    mensaje.textContent = "No se pudo conectar a FastAPI";
  }
}

// Los botones de interfaz capturan el error sin exponer los JWT.
async function renovarDesdeBoton() {
  try {
    await renovarToken();
    mostrarSalida("Access Token renovado correctamente.");
  } catch (error) {
    mostrarSalida("Error: " + error.message);
  }
}

actualizarSesion("Sin sesión");
comprobarConexion();
