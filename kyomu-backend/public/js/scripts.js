// ========================================================
// 0️⃣ INFO BÁSICA DE PÁGINA
// ========================================================
console.log("scripts.js cargado correctamente");

const page = location.pathname.split("/").pop() || "login.html";
const path = location.pathname;

const isPadresPage = page === "padres.html";
const isEntrenadoresPage = page === "entrenadores.html";

// Estados para documentos
let plantillaDocs = [];
let padreDocs = [];

// Estado del calendario
let currentCalendarYear = null;
let currentCalendarMonth = null; // 0-11
let calendarEventsByDate = {};   // { "YYYY-MM-DD": [event, ...] }

// Hijos del padre actual (relleno desde backend)
let parentChildren = [];

// Clave para guardar token en localStorage
const ID_TOKEN_KEY = "kyomu_idToken";

// ========================================================
// 1️⃣ HELPERS DE TOKEN (SIN AMPLIFY)
// ========================================================
function saveIdToken(token) {
  localStorage.setItem(ID_TOKEN_KEY, token);
}

function getIdToken() {
  return localStorage.getItem(ID_TOKEN_KEY);
}

function decodeJwt(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(payload)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );
    return JSON.parse(json);
  } catch (e) {
    console.error("Error decodificando JWT:", e);
    return null;
  }
}

/**
 * Si estamos en login.html y Cognito nos ha devuelto #id_token=...
 * lo guardamos en localStorage y limpiamos el hash.
 */
function procesarTokenDeHashEnLogin() {
  if (page !== "login.html") return;

  const hash = window.location.hash;
  if (!hash || !hash.includes("id_token=")) return;

  const params = new URLSearchParams(hash.substring(1)); // sin '#'
  const idToken = params.get("id_token");

  if (!idToken) {
    console.warn("No se encontró id_token en el hash");
    return;
  }

  console.log("✅ id_token recibido desde Cognito");
  saveIdToken(idToken);

  // Limpiar el hash de la URL
  history.replaceState(null, "", window.location.pathname);

  // Dejamos que initSession() haga el resto (redirigir según grupo)
}

// ========================================================
// 2️⃣ HEADERS PARA LLAMAR AL BACKEND
// ========================================================
function getAuthHeaders() {
  return {
    Authorization: `Bearer ${window.idToken}`,
  };
}

// ========================================================
// 3️⃣ REDIRECCIÓN SEGÚN GRUPOS
// ========================================================
function redirigirSegunGrupo() {
  const groups = (window.payload && window.payload["cognito:groups"]) || [];
  const esPadre = groups.includes("padres");
  const esEntrenador = groups.includes("entrenadores");

  console.log("🔍 Grupos del usuario:", groups);

  // Justo después del login
  if (page === "login.html") {
    if (esPadre) {
      location.href = "/padres.html";
      return;
    }
    if (esEntrenador) {
      location.href = "/entrenadores.html";
      return;
    }
  }

  // Protección cruzada
  if (page === "entrenadores.html" && esPadre) {
    location.href = "/padres.html";
    return;
  }

  if (page === "padres.html" && esEntrenador) {
    location.href = "/entrenadores.html";
    return;
  }
}

// ========================================================
// 4️⃣ INICIALIZAR SESIÓN (USANDO SOLO LOCALSTORAGE)
// ========================================================
function initSession() {
  const token = getIdToken();

  if (!token) {
    console.warn("No hay idToken en localStorage");
    if (page !== "login.html") {
      location.href = "/login.html";
    }
    return;
  }

  const payload = decodeJwt(token);
  if (!payload) {
    console.warn("No se pudo decodificar el token");
    if (page !== "login.html") {
      location.href = "/login.html";
    }
    return;
  }

  window.idToken = token;
  window.payload = payload;

  // Registrar login en LogBook (no bloqueante)
  fetch("/api/logbook/login", {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
  }).catch(() => {});


  console.log("✅ Sesión inicializada. Payload:", payload);

  redirigirSegunGrupo();

  if (isPadresPage) {
    inicializarPaginaPadres();
  } else if (isEntrenadoresPage) {
    inicializarPaginaEntrenadores();
  }
}

// ========================================================
// 5️⃣ LOGOUT (USANDO aws-exports.js PARA EL DOMINIO)
// ========================================================
function logout() {
  console.log("🔴 Cerrando sesión...");

  localStorage.removeItem(ID_TOKEN_KEY);
  window.idToken = null;
  window.payload = null;

  const cfg = window.awsconfig;
  if (cfg && cfg.oauth) {
    const domain = cfg.oauth.domain;
    const clientId = cfg.aws_user_pools_web_client_id;
    const logoutUri = encodeURIComponent(cfg.oauth.redirectSignOut);
    const url = `https://${domain}/logout?client_id=${clientId}&logout_uri=${logoutUri}`;

    console.log("➡ Redirigiendo a logout de Cognito:", url);
    window.location.href = url;
  } else {
    console.warn("⚠ No hay config oauth → solo redirijo a /login.html");
    location.href = "/login.html";
  }
}

// ========================================================
// Helper: obtener el childId del selector de hijos
// ========================================================
function getSelectedChildIdForUpload() {
  // Busca el selector de hijos por ID o clase
  let select = document.getElementById("child-select-upload") || 
               document.querySelector(".child-select-upload");
  
  if (!select) return "";
  const value = select.value;
  
  // Evita valores de placeholder
  if (!value || value === "0" || value === "placeholder") return "";
  return value;
}


// ========================================================
// 6️⃣ SUBIR ARCHIVO general (padres) – OTROS DOCUMENTOS
// ========================================================
// ========================================================
// SUBIR ARCHIVO general (padres) – OTROS DOCUMENTOS
// ========================================================
async function subirArchivo() {
  const fileInput = document.getElementById("fileInput");
  const childSelect = document.getElementById("child-select"); // El selector de hijos principal

  if (!fileInput || !fileInput.files.length) return alert("Selecciona un archivo primero");
  
  const childId = childSelect.value;
  if (!childId) return alert("Selecciona primero a qué hijo corresponde el documento.");

  // EXTRAEMOS EL NOMBRE Y SEDE DEL HIJO SELECCIONADO PARA GUARDARLO
  const childOption = childSelect.options[childSelect.selectedIndex];
  const childFullName = childOption.text; // Ej: "Jesús Sánchez (Colegio Monteagudo)"

  const file = fileInput.files[0];
  try {
      // Enviamos childId y childFullName al backend
      const res = await fetch(`/api/files/upload-url?filename=${encodeURIComponent(file.name)}&childId=${encodeURIComponent(childId)}&childFullName=${encodeURIComponent(childFullName)}`, {
          headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error("Error al preparar la subida");

      const data = await res.json();
      const uploadUrl = data.url;

      const putRes = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
      });

      if (putRes.ok) {
          alert("Archivo subido correctamente");
          fileInput.value = "";
          listarArchivosPadre();
      }
  } catch (err) {
      console.error(err);
      alert("Error al subir archivo");
  }
}

// ========================================================
// SUBIR ARCHIVO desde plantilla (cumplimentado)
// ========================================================
async function subirArchivoDesdeInput(inputId, childSelectId) {
  const fileInput = document.getElementById(inputId);
  const childSelect = document.getElementById(childSelectId);
  
  if (!fileInput || !fileInput.files.length) return;

  const childId = childSelect.value;
  if (!childId) {
      alert("Selecciona primero a qué hijo corresponde el documento.");
      fileInput.value = "";
      return;
  }

  const childOption = childSelect.options[childSelect.selectedIndex];
  const childFullName = childOption.text;

  const file = fileInput.files[0];
  try {
      const res = await fetch(`/api/files/upload-url?filename=${encodeURIComponent(file.name)}&childId=${encodeURIComponent(childId)}&childFullName=${encodeURIComponent(childFullName)}`, {
          headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      const uploadUrl = data.url;

      const putRes = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
      });

      if (putRes.ok) {
          alert("Archivo cumplimentado subido correctamente");
          fileInput.value = "";
          listarArchivosPadre(); 
      }
  } catch (err) {
      console.error("Error en subirArchivoDesdeInput:", err);
      alert("Error al procesar la subida");
  }
}


// ========================================================
// 8️⃣ DESCARGAR ARCHIVO
// ========================================================
async function descargarArchivo(key) {
  try {
    const decodedKey = decodeURIComponent(key);
    const parts = decodedKey.split("/");
    const filename = parts.pop();
    const folder = parts.join("/");

    console.log("Descargando archivo:", { folder, filename });

    const res = await fetch(
      `/api/files/download-url?folder=${encodeURIComponent(
        folder
      )}&filename=${encodeURIComponent(filename)}`,
      {
        headers: getAuthHeaders(),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("Error al obtener URL de descarga:", text);
      return alert("❌ No se pudo descargar el archivo");
    }

    const data = await res.json();
    const url = data.url;
    console.log("URL de descarga recibida:", url);

    window.location.href = url;
  } catch (err) {
    console.error("Error en descargarArchivo():", err);
    alert("❌ Error al descargar archivo");
  }
}

// ========================================================
// 9️⃣ ELIMINAR ARCHIVO
// ========================================================
async function eliminarArchivo(keyEncoded) {
  const decodedKey = decodeURIComponent(keyEncoded);
  const seguro = confirm("¿Seguro que quieres eliminar este archivo?");
  if (!seguro) return;

  try {
    const res = await fetch("/api/files/delete", {
      method: "DELETE",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ key: decodedKey }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Error al eliminar archivo:", text);
      alert("❌ No se pudo eliminar el archivo");
      return;
    }

    alert("✅ Archivo eliminado correctamente");
    // Para padres refrescamos su lista
    if (isPadresPage) {
      listarArchivosPadre();
    } else if (isEntrenadoresPage) {
      // Para entrenadores refrescamos la vista de padres
      listarArchivosPadresParaEntrenador();
      listarPlantillasEntrenadorParaEntrenador();
    }
  } catch (err) {
    console.error("Error en eliminarArchivo():", err);
    alert("❌ Error al eliminar archivo");
  }
}


// ========================================================
// 🔟 HELPERS DE NOMBRES
function getDocDisplayName(doc) {
  // 1) Primero intentamos con urlPath si existe
  let name = doc.urlPath && doc.urlPath.length > 0 ? doc.urlPath : doc.key;

  // 2) Siempre nos quedamos SOLO con el último segmento, por si viene "padres/..."
  if (typeof name === "string") {
    const parts = name.split("/");
    name = parts[parts.length - 1];
  }

  return name;
}


function getBaseName(name) {
  return name
    .toLowerCase()
    .replace(/\.[^/.]+$/, "")
    .trim();
}


// ========================================================
// 1️⃣1️⃣ LISTAR DOCUMENTOS DEL PADRE (CON COMENTARIOS)
// ========================================================
async function listarArchivosPadre() {
  const cont = document.getElementById("docs");
  if (!cont) return;
  cont.innerHTML = "<p>Cargando documentos...</p>";

  try {
      const res = await fetch("/api/files/padres", { headers: getAuthHeaders() });
      const data = await res.json();
      const docsByChild = data.documentsByChild || [];
      const parentSub = window.payload.sub;

      if (!docsByChild.length) {
          cont.innerHTML = "<p>No hay documentos todavía.</p>";
          return;
      }

      cont.innerHTML = "";
      docsByChild.forEach((group, gIdx) => {
          const child = (parentChildren || []).find(c => c.id === group.childId);
          const childNombre = child ? child.nombre : "Hijo/a";
          
          let html = `<div class="child-doc-section"><h4>Hijo/a: ${childNombre}</h4>`;
          
          group.documents.forEach((doc, dIdx) => {
              const safeKey = encodeURIComponent(doc.documentKey);
              // ID UNICA por hijo para evitar el error de carga infinita
              const listId = `lst-parent-${group.childId}-${dIdx}`;
              const textId = `txt-parent-${group.childId}-${dIdx}`;

              html += `
              <div class="doc-card">
                  <div class="doc-main"><span>${doc.filename}</span></div>
                  <div class="doc-actions">
                      <button onclick="descargarArchivo('${safeKey}')">Descargar</button>
                      <button onclick="eliminarArchivo('${safeKey}')">Eliminar</button>
                  </div>
                  <div class="parent-comment-section">
                      <div class="comment-list" id="${listId}"><em>Cargando conversación...</em></div>
                      <textarea id="${textId}" class="comment-textarea" placeholder="Escribe tu respuesta..."></textarea>
                      <button class="btn" onclick="guardarComentarioDocumento('${doc.documentKey}', '${textId}', '${parentSub}', '${listId}')">
                          Enviar respuesta
                      </button>
                  </div>
              </div>`;
          });
          html += `</div>`;
          cont.innerHTML += html;
      });

      // CARGA DE COMENTARIOS: Con pequeño retardo para asegurar que el DOM está listo
      setTimeout(() => {
          docsByChild.forEach(group => {
              group.documents.forEach((doc, dIdx) => {
                  cargarComentariosDocumento(parentSub, doc.documentKey, `lst-parent-${group.childId}-${dIdx}`);
              });
          });
      }, 200);

  } catch (err) { 
      console.error("Error en listarArchivosPadre:", err); 
      cont.innerHTML = "<p>Error al cargar documentos.</p>";
  }
}
async function cargarComentariosConversacion(parentSub, documentKey, listId) {
  const listEl = document.getElementById(listId);
  if (!listEl) return;

  try {
      const res = await fetch(`/api/comments?parentSub=${encodeURIComponent(parentSub)}&documentKey=${encodeURIComponent(documentKey)}`, {
          headers: getAuthHeaders()
      });
      const data = await res.json();
      const comments = data.comments || [];

      if (comments.length === 0) {
          listEl.innerHTML = "<p style='color:gray; font-size:0.8em;'>Sin comentarios aún.</p>";
          return;
      }

      listEl.innerHTML = comments
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .map(c => `
              <div class="comment-item ${c.authorRole}">
                  <p><strong>${c.authorName}:</strong> ${c.text}</p>
                  <small>${new Date(c.createdAt).toLocaleString()}</small>
              </div>
          `).join("");
  } catch (err) {
      console.error("Error cargando comentarios:", err);
  }
}

async function enviarComentarioPadre(documentKey, parentSub, listId, textId) {
  const textarea = document.getElementById(textId);
  const text = textarea.value.trim();
  if (!text) return alert("Escribe un mensaje.");

  try {
      const res = await fetch("/api/comments", {
          method: "POST",
          headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ documentKey, parentSub, text })
      });

      if (res.ok) {
          textarea.value = "";
          cargarComentariosConversacion(parentSub, documentKey, listId);
      }
  } catch (err) {
      alert("Error al enviar el comentario.");
  }
}

// Cargar TODOS los comentarios (entrenadores + padres) para un documento del padre
// --- FUNCIONES DE COMENTARIOS RECUPERADAS ---

async function cargarComentariosDocumento(parentId, documentKey, listId) {
  const listEl = document.getElementById(listId);
  if (!listEl) return;

  try {
      // IMPORTANTE: La ruta debe coincidir con routes/commentsRoutes.js
      const res = await fetch(`/api/comments?parentId=${encodeURIComponent(parentId)}&documentKey=${encodeURIComponent(documentKey)}`, {
          headers: getAuthHeaders()
      });
      
      if (!res.ok) throw new Error("Error en la petición");
      
      const data = await res.json();
      const comments = data.comments || [];

      if (comments.length === 0) {
          listEl.innerHTML = "<p style='color:gray; font-size:0.8em;'>Sin comentarios.</p>";
          return;
      }

      // Ordenar por fecha
      comments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      listEl.innerHTML = comments.map(c => `
          <div class="comment-item ${c.authorRole}" style="margin-bottom: 5px; padding: 5px; border-radius: 4px; background: ${c.authorRole==='trainer'?'#fdf2f2':'#f2f7fd'}">
              <small><strong>${c.authorName}</strong> (${new Date(c.createdAt).toLocaleString()}):</small>
              <p style="margin: 2px 0;">${c.text}</p>
          </div>
      `).join("");
  } catch (err) {
      console.error("Error cargando comentarios:", err);
      listEl.innerHTML = "<em>Error al cargar.</em>";
  }
}

async function guardarComentarioDocumento(documentKey, textareaId, parentId, listId) {
  const textarea = document.getElementById(textareaId);
  const text = textarea.value.trim();
  if (!text) return;

  try {
      const res = await fetch("/api/comments", {
          method: "POST",
          headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ documentKey, parentId, text })
      });

      if (res.ok) {
          textarea.value = "";
          // Recargar inmediatamente la lista
          await cargarComentariosDocumento(parentId, documentKey, listId);
      }
  } catch (err) {
      console.error("Error al guardar:", err);
  }
}

// Padre/madre responde al entrenador sobre un documento
async function enviarRespuestaEntrenador(encodedKey, listElementId, textareaId) {
  const key = decodeURIComponent(encodedKey);
  const textarea = document.getElementById(textareaId);
  const listEl = document.getElementById(listElementId);

  if (!textarea || !listEl) return;

  const text = textarea.value.trim();
  if (!text) {
    alert("Escribe tu respuesta antes de enviar.");
    return;
  }

  const parentId = window.payload && window.payload.sub;
  if (!parentId) {
    alert("No se ha podido identificar al usuario padre/madre.");
    return;
  }

  try {
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        documentKey: key,
        parentId,
        text,
      }),
    });

    if (!res.ok) {
      const bodyText = await res.text();
      console.error("Error enviando respuesta:", bodyText);
      alert("❌ Error al enviar la respuesta");
      return;
    }

    // Limpiar caja de texto
    textarea.value = "";

    // Recargar la conversación
    await cargarComentariosParaPadre(parentId, key, listElementId, textareaId);
  } catch (err) {
    console.error("Error en enviarRespuestaEntrenador():", err);
    alert("❌ Error al enviar la respuesta");
  }
}


// ========================================================
// 1️⃣2️⃣ LISTAR PLANTILLAS (publico/padres/)
// ========================================================
async function listarPlantillasEntrenador() {
  const cont = document.getElementById("docs-plantillas");
  if (!cont) return;

  cont.innerHTML = "<p>Cargando plantillas...</p>";

  try {
    const res = await fetch("/api/files/plantillas", {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Error listando plantillas:", text);
      cont.innerHTML = "<p>Error al cargar plantillas.</p>";
      return;
    }

    const data = await res.json();
    const docs = data.documents || [];
    plantillaDocs = docs;

    if (!docs.length) {
      cont.innerHTML = "<p>Por ahora no hay documentos del club.</p>";
      return;
    }

    renderPlantillasConCompletados();
  } catch (err) {
    console.error("Error en listarPlantillasEntrenador():", err);
    cont.innerHTML = "<p>Error al cargar plantillas.</p>";
  }
}

// ========================================================
// 1️⃣3️⃣ RENDER PLANTILLAS + COMPLETADOS (PADRES)
// ========================================================
function renderPlantillasConCompletados() {
  const cont = document.getElementById("docs-plantillas");
  if (!cont) return;

  if (!plantillaDocs || !plantillaDocs.length) {
    cont.innerHTML = "<p>Por ahora no hay documentos del club.</p>";
    return;
  }

  // Mapa de documentos subidos por el padre (metadatos /api/files/padres)
  const completadosPorBase = {};
  (padreDocs || []).forEach((doc) => {
    const name = getDocDisplayName(doc);
    const base = getBaseName(name);
    if (!completadosPorBase[base]) completadosPorBase[base] = [];
    completadosPorBase[base].push(doc);
  });

  cont.innerHTML = "";

  plantillaDocs.forEach((doc, index) => {
    const name = getDocDisplayName(doc);
    const base = getBaseName(name);
    const safeKey = encodeURIComponent(doc.key);

    const fileInputId = `fileInput-template-${index}`;
    const childSelectId = `childSelect-template-${index}`;

    // ⬇️ Bloque de plantilla (descargar + subir cumplimentado PARA UN HIJO)
    let html = `
      <div class="doc-card template-card">
        <div class="doc-main">
          <span class="file-icon">📄 </span>
          <span class="doc-name">${name}</span>
        </div>
        <div class="doc-actions">
          <button onclick="descargarArchivo('${safeKey}')">Descargar</button>
    `;

    // Selector de hijo (si hay hijos)
    if (parentChildren && parentChildren.length > 0) {
      html += `
        <select id="${childSelectId}" class="child-select">
          ${parentChildren
            .map((child) => {
              const label = `${child.nombre}${
                child.sede ? " (" + child.sede + ")" : ""
              }`;
              return `<option value="${child.id}">${label}</option>`;
            })
            .join("")}
        </select>
      `;
    } else {
      html += `
        <span style="margin-left:8px; font-size:0.9em;">
          (No hay hijos asociados a este usuario)
        </span>
      `;
    }

    html += `
          <input
            type="file"
            id="${fileInputId}"
            style="display:none"
            onchange="subirArchivoDesdeInput('${fileInputId}', '${childSelectId}')"
          >
          <button onclick="document.getElementById('${fileInputId}').click()">
            Subir cumplimentado
          </button>
        </div>
      </div>
    `;

    cont.innerHTML += html;

    // Ahora listamos los documentos que el padre ya ha subido relacionados con esta plantilla
    const completados = completadosPorBase[base] || [];
    completados.forEach((docPadre) => {
      const namePadre = getDocDisplayName(docPadre);
      const safeKeyPadre = encodeURIComponent(docPadre.documentKey || docPadre.key);

      cont.innerHTML += `
        <div class="doc-card completed-card">
          <div class="doc-main">
            <span class="file-icon completed-icon">✅ </span>
            <span class="doc-name">${namePadre}</span>
          </div>
          <div class="doc-actions">
            <button onclick="descargarArchivo('${safeKeyPadre}')">Descargar</button>
            <button onclick="eliminarArchivo('${safeKeyPadre}')">Eliminar</button>
          </div>
        </div>
      `;
    });
  });
}


async function listarArchivosPadresParaEntrenador() {
  const cont = document.getElementById("docs-entrenadores");
  if (!cont) return;
  cont.innerHTML = "<p>Cargando documentos de padres...</p>";

  try {
      const res = await fetch("/api/files/entrenadores", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      const parents = data.parents || [];

      if (!parents.length) {
          cont.innerHTML = "<p>No hay documentos enviados por padres.</p>";
          return;
      }

      cont.innerHTML = "";
      parents.forEach((parent) => {
          const pSub = parent.parentSub;
          const pSafe = pSub.replace(/[^a-z0-9]/gi, "_");
          
          let html = `
          <div class="parent-section">
              <h4>Padre/Madre: <span class="parent-name">${parent.parentName || "Usuario"}</span></h4>
          `;

          // BUCLE PARA MOSTRAR HIJOS Y SUS DOCUMENTOS [cite: 1162-1168]
          parent.children.forEach((child) => {
              const cId = child.childId;
              const cSafe = cId.replace(/[^a-z0-9]/gi, "_");
              
              // Intentamos extraer el nombre real si el backend lo mandó como "Hijo no identificado"
              const nombreMostrar = (child.childNombre && child.childNnombre !== "Hijo no identificado") 
                  ? child.childNombre 
                  : `Hijo (${cId})`;

              html += `
              <div class="child-block">
                  <p class="child-info">Hijo/a: <strong>${nombreMostrar}${child.childSede ? " (" + child.childSede + ")" : ""}</strong></p>
              `;

              child.documents.forEach((doc, idx) => {
                  const safeKey = encodeURIComponent(doc.documentKey);
                  // ID UNICA para comentarios [cite: 2703-2704]
                  const txtId = `txt-${pSafe}-${cSafe}-${idx}`;
                  const lstId = `lst-${pSafe}-${cSafe}-${idx}`;

                  html += `
                  <div class="doc-card parent-doc-card">
                      <div class="doc-info"><span>${doc.filename}</span></div>
                      <div class="doc-actions">
                          <button class="btn" onclick="descargarArchivo('${safeKey}')">Descargar</button>
                          <button class="btn btn-danger" onclick="eliminarArchivo('${safeKey}')">Eliminar</button>
                      </div>
                      <div class="trainer-comment-box">
                          <textarea id="${txtId}" class="comment-textarea" rows="2" placeholder="Observaciones..."></textarea>
                          <button class="btn" onclick="guardarComentarioDocumento('${doc.documentKey}', '${txtId}', '${pSub}', '${lstId}')">Guardar</button>
                          <div class="comment-list" id="${lstId}"></div>
                      </div>
                  </div>`;
              });
              html += `</div>`; // Cierre child-block
          });

          html += `</div>`; // Cierre parent-section
          cont.innerHTML += html;
      });

      // DISPARAR CARGA DE COMENTARIOS TRAS EL RENDERIZADO [cite: 2757-2767]
      parents.forEach(p => {
          const pSafe = p.parentSub.replace(/[^a-z0-9]/gi, "_");
          p.children.forEach(c => {
              const cSafe = c.childId.replace(/[^a-z0-9]/gi, "_");
              c.documents.forEach((doc, idx) => {
                  cargarComentariosDocumento(p.parentSub, doc.documentKey, `lst-${pSafe}-${cSafe}-${idx}`);
              });
          });
      });

  } catch (err) {
      console.error("Error en vista entrenadores:", err);
      cont.innerHTML = "<p>Error al cargar la gestión de archivos.</p>";
  }
}


function renderParentSectionForTrainer(parent) {
  const pSub = parent.parentSub;
  const pName = parent.parentName || pSub;
  const pSafe = pSub.replace(/[^a-z0-9_-]/gi, "_");

  let html = `
  <div class="parent-section" style="margin-bottom: 30px; border: 1px solid #ddd; padding: 15px; border-radius: 8px;">
      <h4 style="color: #333; border-bottom: 2px solid #B30000; padding-bottom: 5px;">
          Padre/Madre: <span class="parent-name">${pName}</span>
      </h4>
  `;

  parent.children.forEach((child) => {
      const cId = child.childId;
      const cSafe = cId.replace(/[^a-z0-9_-]/gi, "_");
      const cNombre = child.nombre;
      const cSede = child.sede ? ` (${child.sede})` : "";

      html += `
      <div class="child-block" style="margin: 15px 0 10px 20px; background: #f9f9f9; padding: 10px; border-radius: 5px;">
          <p style="font-weight: bold; color: #555;">Hijo/a: ${cNombre}${cSede}</p>
      `;

      child.documents.forEach((doc, idx) => {
          const safeKey = encodeURIComponent(doc.documentKey);
          const docSafe = doc.documentKey.replace(/[^a-z0-9_-]/gi, "_");
          const textareaId = `comment-textarea-${pSafe}-${cSafe}-${docSafe}-${idx}`;
          const listId = `comment-list-${pSafe}-${cSafe}-${docSafe}-${idx}`;

          html += `
          <div class="doc-card" style="display: flex; flex-direction: column; gap: 10px; background: white; border: 1px solid #eee; padding: 10px; margin-bottom: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                  <strong>${doc.filename}</strong>
                  <div>
                      <button class="btn" onclick="descargarArchivo('${safeKey}')">Descargar</button>
                      <button class="btn" style="background-color:#B30000" onclick="eliminarArchivo('${safeKey}')">Eliminar</button>
                  </div>
              </div>
              <div class="trainer-comment-box" style="border-top: 1px solid #eee; padding-top: 10px;">
                  <label class="comment-label">Comentario para el padre/madre:</label>
                  <textarea id="${textareaId}" class="comment-textarea" rows="2" placeholder="Escribe aquí tus observaciones..."></textarea>
                  <div style="margin-top: 5px;">
                      <button class="btn" onclick="guardarComentarioDocumento('${safeKey}', '${textareaId}', '${pSub}', '${listId}')">Guardar comentario</button>
                  </div>
                  <div class="comment-list" id="${listId}" style="margin-top: 10px; font-size: 0.9em;"></div>
              </div>
          </div>
          `;
      });

      html += `</div>`; // Cerrar child-block
  });

  html += `</div>`; // Cerrar parent-section
  return html;
}


// Eliminar comentario existente (si lo hay)
async function eliminarComentarioDocumento(encodedKey, parentId, listElementId, textareaId) {
  const key = decodeURIComponent(encodedKey);
  const textarea = document.getElementById(textareaId);
  const listEl = document.getElementById(listElementId);
  if (!textarea || !listEl) return;

  const existingId = textarea.dataset.commentId || null;
  if (!existingId) {
    // No hay comentario en BD, solo limpiamos la UI
    textarea.value = "";
    listEl.innerHTML = "<em>Sin comentarios todavía.</em>";
    return;
  }

  const seguro = confirm("¿Seguro que quieres eliminar este comentario?");
  if (!seguro) return;

  try {
    const res = await fetch(`/api/comments/${existingId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const bodyText = await res.text();
      console.error("Error eliminando comentario:", bodyText);
      alert("❌ Error al eliminar comentario");
      return;
    }

    alert("✅ Comentario eliminado");

    // Limpiar UI
    textarea.value = "";
    textarea.dataset.commentId = "";
    listEl.innerHTML = "<em>Sin comentarios todavía.</em>";
  } catch (err) {
    console.error("Error en eliminarComentarioDocumento():", err);
    alert("❌ Error al eliminar comentario");
  }
}



// ========================================================
// 1️⃣5️⃣ ENTRENADORES: SUBIR PLANTILLAS
// ========================================================
async function subirPlantillaEntrenador() {
  const input = document.getElementById("templateFileInput");
  if (!input || !input.files.length) {
    return alert("Selecciona un archivo de plantilla primero");
  }

  const file = input.files[0];

  try {
    console.log("Subiendo nueva plantilla:", file.name);

    const res = await fetch(
      `/api/files/upload-url?filename=${encodeURIComponent(
        file.name
      )}&type=plantilla`,
      {
        headers: getAuthHeaders(),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("Error al obtener URL de subida de plantilla:", text);
      return alert("❌ Error al preparar la subida de la plantilla");
    }

    const data = await res.json();
    const uploadUrl = data.url;

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
    });

    if (!putRes.ok) {
      console.error(
        "Error al subir plantilla a la URL firmada:",
        putRes.status
      );
      return alert("❌ Error al subir la plantilla");
    }

    alert("✅ Plantilla subida correctamente");
    input.value = "";
    listarPlantillasEntrenadorParaEntrenador();
  } catch (err) {
    console.error("Error en subirPlantillaEntrenador():", err);
    alert("❌ Error al subir la plantilla");
  }
}

async function listarPlantillasEntrenadorParaEntrenador() {
  const cont = document.getElementById("docs-plantillas");
  if (!cont) return;

  cont.innerHTML = "<p>Cargando plantillas...</p>";

  try {
    const res = await fetch("/api/files/plantillas", {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Error listando plantillas:", text);
      cont.innerHTML = "<p>Error al cargar plantillas.</p>";
      return;
    }

    const data = await res.json();
    const docs = data.documents || [];

    if (!docs.length) {
      cont.innerHTML = "<p>No hay plantillas todavía.</p>";
      return;
    }

    cont.innerHTML = "";
    docs.forEach((doc) => {
      const name =
        doc.urlPath && doc.urlPath.length > 0
          ? doc.urlPath
          : doc.key.split("/").pop();
      const safeKey = encodeURIComponent(doc.key);

      cont.innerHTML += `
        <div class="doc-card">
          <div class="doc-info">
            <strong>${name}</strong>
          </div>
          <div class="doc-actions">
            <button class="btn" onclick="descargarArchivo('${safeKey}')">
              Descargar
            </button>
            <button class="btn" style="background-color:#B30000"
                    onclick="eliminarArchivo('${safeKey}')">
              Eliminar
            </button>
          </div>
        </div>
      `;
    });
  } catch (err) {
    console.error("Error en listarPlantillasEntrenadorParaEntrenador():", err);
    cont.innerHTML = "<p>Error al cargar plantillas.</p>";
  }
}

// ========================================================
// 1️⃣6️⃣ TABS (PADRES / ENTRENADORES)
// ========================================================
function initTabsEntrenadores() {
  const tabs = document.querySelectorAll(".tabs .tab");
  const docsTab = document.getElementById("tab-docs");
  const calendarTab = document.getElementById("tab-calendar");
  if (!tabs.length || !docsTab || !calendarTab) return;

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-tab");

      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      docsTab.classList.remove("active");
      calendarTab.classList.remove("active");

      if (target === "docs") {
        docsTab.classList.add("active");
      } else if (target === "calendar") {
        calendarTab.classList.add("active");
      }
    });
  });
}

function initTabsPadres() {
  const tabs = document.querySelectorAll(".tabs .tab");
  const docsTab = document.getElementById("tab-docs");
  const calendarTab = document.getElementById("tab-calendar");
  if (!tabs.length || !docsTab || !calendarTab) return;

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-tab");

      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      docsTab.classList.remove("active");
      calendarTab.classList.remove("active");

      if (target === "docs") {
        docsTab.classList.add("active");
      } else if (target === "calendar") {
        calendarTab.classList.add("active");
      }
    });
  });
}

// ========================================================
// 1️⃣7️⃣ PADRES: CARGAR HIJOS
// ========================================================
async function cargarHijosDelPadre() {
  try {
    const res = await fetch("/api/parents/me/children", {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      console.error("Error obteniendo hijos del padre:", await res.text());
      parentChildren = [];
      return;
    }

    const data = await res.json();
    parentChildren = data.children || [];
    console.log("Hijos del padre/madre:", parentChildren);
  } catch (err) {
    console.error("Error en cargarHijosDelPadre():", err);
    parentChildren = [];
  }
}

function poblarSelectHijos() {
  const select = document.getElementById("child-select");
  if (!select) return;

  select.innerHTML = "";

  if (!parentChildren.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No hay hijos registrados";
    select.appendChild(opt);
    select.disabled = true;
    return;
  }

  parentChildren.forEach((child) => {
    const opt = document.createElement("option");
    opt.value = child.id; // 👈 usamos el id del niño de KyomuChildren
    opt.textContent = `${child.nombre}${
      child.sede ? " (" + child.sede + ")" : ""
    }`;
    select.appendChild(opt);
  });

  select.disabled = false;
}



// ========================================================
// 1️⃣8️⃣ CALENDARIO (COMPARTIDO PADRES / ENTRENADORES)
// ========================================================
function initCalendarTrainer() {
  const now = new Date();
  currentCalendarYear = now.getFullYear();
  currentCalendarMonth = now.getMonth();

  renderCalendarTrainer();
  loadEventsForCurrentMonth();
}

async function loadEventsForCurrentMonth() {
  if (currentCalendarYear === null || currentCalendarMonth === null) return;

  try {
    const year = currentCalendarYear;
    const month = currentCalendarMonth + 1;

    const res = await fetch(
      `/api/calendar/events?year=${year}&month=${month}`,
      {
        headers: getAuthHeaders(),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("Error cargando eventos del calendario:", text);
      calendarEventsByDate = {};
      renderCalendarTrainer();
      return;
    }

    const data = await res.json();
    const events = data.events || [];
    const map = {};

    events.forEach((ev) => {
      if (!ev.date) return;
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    });

    calendarEventsByDate = map;
    renderCalendarTrainer();
  } catch (err) {
    console.error("Error en loadEventsForCurrentMonth():", err);
    calendarEventsByDate = {};
    renderCalendarTrainer();
  }
}

function renderCalendarTrainer() {
  const monthLabel = document.getElementById("calendar-month-label");
  const grid = document.getElementById("calendar-grid");
  if (!monthLabel || !grid) return;

  const monthNames = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];

  const year = currentCalendarYear;
  const month = currentCalendarMonth;

  if (year == null || month == null) {
    const now = new Date();
    currentCalendarYear = now.getFullYear();
    currentCalendarMonth = now.getMonth();
    return renderCalendarTrainer();
  }

  const firstDayDate = new Date(year, month, 1);
  let firstWeekday = firstDayDate.getDay(); // 0=Dom
  firstWeekday = (firstWeekday + 6) % 7; // 0=Lun

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  monthLabel.textContent = `${monthNames[month]} ${year}`;

  grid.innerHTML = "";

  for (let i = 0; i < firstWeekday; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "calendar-day empty";
    grid.appendChild(emptyCell);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement("div");
    cell.className = "calendar-day";

    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`;

    cell.dataset.date = dateStr;

    const eventsForDay = calendarEventsByDate[dateStr] || [];
    const hasEvents = eventsForDay.length > 0;

    if (hasEvents) {
      cell.classList.add("has-events"); // estilo en CSS: color distinto
    }

    const eventsHtml = eventsForDay
      .map(
        (ev) =>
          `<div class="calendar-day-events-item">• ${
            ev.title || "Evento"
          }</div>`
      )
      .join("");

    cell.innerHTML = `
      <div class="calendar-day-number">${day}</div>
      <div class="calendar-day-events">
        ${eventsHtml}
      </div>
    `;

    if (isEntrenadoresPage) {
      cell.addEventListener("click", () => {
        const ev = eventsForDay[0] || null;
        console.log("EDIT click", { dateStr, ev, evId: ev?.id });
        openEventModal(dateStr, ev);
      });
    }
     else if (isPadresPage) {
      if (eventsForDay.length > 0) {
        cell.addEventListener("click", () => {
          openAttendanceModal(dateStr, eventsForDay);
        });
      }
    }

    grid.appendChild(cell);
  }
}

function nextMonthTrainer() {
  if (currentCalendarMonth === null) return;
  currentCalendarMonth++;
  if (currentCalendarMonth > 11) {
    currentCalendarMonth = 0;
    currentCalendarYear++;
  }
  renderCalendarTrainer();
  loadEventsForCurrentMonth();
}

function prevMonthTrainer() {
  if (currentCalendarMonth === null) return;
  currentCalendarMonth--;
  if (currentCalendarMonth < 0) {
    currentCalendarMonth = 11;
    currentCalendarYear--;
  }
  renderCalendarTrainer();
  loadEventsForCurrentMonth();
}

// ========================================================
// 1️⃣9️⃣ MODAL DE EVENTO (ENTRENADORES)
// ========================================================
function openEventModal(dateStr, existingEvent = null) {
  const modal = document.getElementById("event-modal");
  const dateLabel = document.getElementById("event-modal-date-label");
  const dateHidden = document.getElementById("event-date-hidden");
  const titleInput = document.getElementById("event-title");
  const descInput = document.getElementById("event-description");
  const priceInput = document.getElementById("event-price");
  const placeInput = document.getElementById("event-place");
  const timeInput = document.getElementById("event-time");
  const authCheckbox = document.getElementById("event-auth-required");
  const audienceInput = document.getElementById("event-audience");
  const paymentInput = document.getElementById("event-payment");
  const attendanceDiv = document.getElementById("event-attendance-summary");

  if (!modal) return;

  dateLabel.textContent = `Fecha: ${dateStr}`;
  dateHidden.value = dateStr;

  if (existingEvent) {
    titleInput.value = existingEvent.title || "";
    descInput.value = existingEvent.description || "";
    priceInput.value = existingEvent.price || "";
    placeInput.value = existingEvent.place || "";
    timeInput.value = existingEvent.time || "";
    authCheckbox.checked = !!existingEvent.requiresAuthorization;
    audienceInput.value = existingEvent.audience || "";
    paymentInput.value = existingEvent.paymentInfo || "";
    modal.dataset.eventId = existingEvent.id;
  } else {
    titleInput.value = "";
    descInput.value = "";
    priceInput.value = "";
    placeInput.value = "";
    timeInput.value = "";
    authCheckbox.checked = false;
    audienceInput.value = "";
    paymentInput.value = "";
    modal.dataset.eventId = "";
  }

  console.log("openEventModal existingEvent.id =", existingEvent?.id);

  // Resumen de asistencia (ordenado por colegio / nombre)
  if (attendanceDiv) {
    renderAttendanceSummaryForTrainer(existingEvent);
  }

  modal.style.display = "flex";
}

function closeEventModal() {
  const modal = document.getElementById("event-modal");
  if (modal) {
    modal.style.display = "none";
  }
}

// ========================================================
// 2️⃣0️⃣ MODAL DE ASISTENCIA (PADRES)
// ========================================================
function openAttendanceModal(dateStr, eventsForDay) {
  const modal = document.getElementById("attendance-modal");
  const dateLabel = document.getElementById("attendance-modal-date-label");
  const body = document.getElementById("attendance-modal-body");
  if (!modal || !dateLabel || !body) return;

  dateLabel.textContent = `Fecha: ${dateStr}`;
  body.innerHTML = "";

  if (!eventsForDay || !eventsForDay.length) {
    body.innerHTML = "<p>No hay eventos este día.</p>";
    modal.style.display = "flex";
    return;
  }

  if (!parentChildren.length) {
    body.innerHTML =
      "<p>No se han encontrado hijos asociados a este usuario. Consulta con el club.</p>";
    modal.style.display = "flex";
    return;
  }

  const parentSub = window.payload && window.payload.sub;

  eventsForDay.forEach((ev) => {
    const wrapper = document.createElement("div");
    wrapper.className = "attendance-event-card";

    const myAttendance = (ev.attendances || []).find(
      (a) => a.parentSub === parentSub
    );
    const myChildrenStatus = myAttendance ? myAttendance.children || [] : [];

    const timeText = ev.time ? `Hora: ${ev.time}` : "";
    const placeText = ev.place ? `Lugar: ${ev.place}` : "";
    const priceText =
      ev.price !== undefined && ev.price !== null && ev.price !== ""
        ? `<p><strong>Precio:</strong> ${ev.price} €</p>`
        : "";
    const descText = ev.description
      ? `<p><strong>Descripción:</strong> ${ev.description}</p>`
      : "";
    const audienceText = ev.audience
      ? `<p><strong>Quiénes pueden acudir:</strong> ${ev.audience}</p>`
      : "";
    const authText =
      ev.requiresAuthorization === true
        ? `<p><strong>Autorización:</strong> Es necesario rellenar una autorización en el apartado de documentos.</p>`
        : "";
    const paymentText = ev.paymentInfo
      ? `<p><strong>Cómo realizar el pago:</strong> ${ev.paymentInfo}</p>`
      : "";

    const childrenCheckboxesHtml = parentChildren
      .map((child) => {
        const alreadyGoing = myChildrenStatus.some(
          (c) =>
            c.childNombre === child.nombre && (c.status || "going") === "going"
        );
        return `
          <label class="attendance-child-item">
            <input 
              type="checkbox" 
              data-event-id="${ev.id}" 
              data-child-nombre="${child.nombre}"
              data-child-sede="${child.sede || ""}"
              ${alreadyGoing ? "checked" : ""}
            />
            ${child.nombre}${
              child.sede ? ` (${child.sede})` : ""
            }
          </label>
        `;
      })
      .join("");

    wrapper.innerHTML = `
      <h4>${ev.title || "Evento"}</h4>
      <p class="attendance-event-info">
        ${timeText} ${placeText}
      </p>
      ${descText}
      ${priceText}
      ${audienceText}
      ${authText}
      ${paymentText}
      <div class="attendance-children-list">
        ${childrenCheckboxesHtml}
      </div>
      <button 
        type="button" 
        class="btn-submit" 
        onclick="submitAttendance('${ev.id}')"
      >
        Guardar asistencia
      </button>
    `;

    body.appendChild(wrapper);
  });

  modal.style.display = "flex";
}

// ================================
// Guardar evento (entrenadores)
// ================================
async function submitEventForm(e) {
  e.preventDefault();

  try {
    const modal = document.getElementById("event-modal");
    const eventId = modal?.dataset?.eventId || ""; // 👈 clave para editar

    const date = document.getElementById("event-date-hidden")?.value;
    const title = document.getElementById("event-title")?.value?.trim();

    const description = document.getElementById("event-description")?.value || "";
    const priceRaw = document.getElementById("event-price")?.value;
    const place = document.getElementById("event-place")?.value || "";
    const time = document.getElementById("event-time")?.value || "";
    const requiresAuthorization = !!document.getElementById("event-auth-required")?.checked;
    const audience = document.getElementById("event-audience")?.value || "";
    const paymentInfo = document.getElementById("event-payment")?.value || "";

    // En crear: necesitas date + title
    // En editar: necesitas title (y el eventId)
    if ((!eventId && !date) || !title) {
      alert("Faltan campos obligatorios: fecha y nombre del evento.");
      return;
    }

    const price = (priceRaw === "" || priceRaw == null) ? null : Number(priceRaw);

    // 👇 Si hay eventId → EDITAR (PUT). Si no → CREAR (POST)
    const url = eventId
      ? `/api/calendar/events/${encodeURIComponent(eventId)}`
      : `/api/calendar/events`;

    const method = eventId ? "PUT" : "POST";

    const body = {
      title,
      description,
      price,
      place,
      time,
      requiresAuthorization,
      audience,
      paymentInfo,
    };

    // Solo en creación mandamos date
    if (!eventId) body.date = date;

    const res = await fetch(url, {
      method,
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    console.log("submitEventForm eventId =", eventId);


    if (!res.ok) {
      const text = await res.text();
      console.error("Error guardando evento:", res.status, text);
      alert("❌ No se pudo guardar el evento.");
      return;
    }

    closeEventModal();
    await loadEventsForCurrentMonth();
    alert(eventId ? "✅ Evento actualizado" : "✅ Evento creado");
  } catch (err) {
    console.error("Error en submitEventForm:", err);
    alert("❌ Error al guardar el evento");
  }
}


function closeAttendanceModal() {
  const modal = document.getElementById("attendance-modal");
  if (modal) modal.style.display = "none";
}

async function submitAttendance(eventId) {
  try {
    const checkboxes = document.querySelectorAll(
      `input[type="checkbox"][data-event-id="${eventId}"]`
    );

    const selectedChildren = [];
    checkboxes.forEach((cb) => {
      if (cb.checked) {
        selectedChildren.push({
          childNombre: cb.getAttribute("data-child-nombre"),
          childSede: cb.getAttribute("data-child-sede") || "",
          status: "going",
        });
      }
    });

    if (!selectedChildren.length) {
      alert("Selecciona al menos un hijo para marcar asistencia.");
      return;
    }

    const res = await fetch(`/api/calendar/events/${eventId}/attendance`, {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ children: selectedChildren }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Error guardando asistencia:", text);
      alert("❌ Error al guardar la asistencia");
      return;
    }

    const data = await res.json();
    console.log("Asistencia guardada:", data);

    if (typeof loadEventsForCurrentMonth === "function") {
      await loadEventsForCurrentMonth();
    }

    alert("✅ Asistencia guardada correctamente");
  } catch (err) {
    console.error("Error en submitAttendance():", err);
    alert("❌ Error al guardar la asistencia");
  }
}

// ========================================================
// 2️⃣1️⃣ INICIALIZADORES DE PÁGINA
// ========================================================
async function inicializarPaginaPadres() {
  console.log("Inicializando página de padres...");

  initTabsPadres();
  initCalendarTrainer();

  // 1) Cargamos hijos del padre (KyomuChildren)
  await cargarHijosDelPadre();

  // 2) Rellenamos el <select> de hijos
  poblarSelectHijos();

  // 3) Plantillas del club + documentos del padre
  await Promise.all([
    listarPlantillasEntrenador(),
    listarArchivosPadre(),
  ]);
}


async function inicializarPaginaEntrenadores() {
  console.log("Inicializando página de entrenadores...");

  initTabsEntrenadores();
  initCalendarTrainer();

  await Promise.all([
    listarPlantillasEntrenadorParaEntrenador(),
    listarArchivosPadresParaEntrenador(),
  ]);
}

// ========================================================
// 2️⃣2️⃣ RESUMEN DE ASISTENCIA PARA ENTRENADORES (FIX FINAL)
// ========================================================
function renderAttendanceSummaryForTrainer(event) {
  const container = document.getElementById("event-attendance-summary");
  if (!container) return;

  if (!event || !Array.isArray(event.attendances) || !event.attendances.length) {
    container.innerHTML =
      "<p><em>No hay asistencia registrada aún para este evento.</em></p>";
    return;
  }

  const allChildren = [];

  // Aplanamos todas las asistencias en una sola lista de niños
  event.attendances.forEach((att) => {
    (att.children || []).forEach((c) => {
      allChildren.push({
        sede: c.childSede || c.sede || "Otros",
        nombre: c.childNombre || c.nombre || "Sin nombre",
      });
    });
  });

  if (!allChildren.length) {
    container.innerHTML =
      "<p><em>No hay asistencia registrada aún para este evento.</em></p>";
    return;
  }

  // Ordenar por sede y luego por nombre (SEGURIDAD TOTAL)
  allChildren.sort((a, b) => {
    const sedeA = a.sede || "";
    const sedeB = b.sede || "";
    const nombreA = a.nombre || "";
    const nombreB = b.nombre || "";

    const bySede = sedeA.localeCompare(sedeB);
    if (bySede !== 0) return bySede;
    return nombreA.localeCompare(nombreB);
  });

  let html = `<h3 class="attendance-title">Asistencia registrada</h3>`;
  let currentSede = null;

  allChildren.forEach((c) => {
    if (c.sede !== currentSede) {
      if (currentSede !== null) html += "<br>";
      currentSede = c.sede;
      html += `<p class="attendance-sede"><strong>${currentSede}</strong></p>`;
    }

    html += `<p class="attendance-child">${c.nombre}</p>`;
  });

  container.innerHTML = html;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function verMisLogs() {
  const out = document.getElementById("logbook-output");
  if (out) out.textContent = "Cargando...";

  try {
    const res = await fetch("/api/logbook/me?limit=50", {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const text = await res.text();
      if (out) out.textContent = `Error ${res.status}: ${text}`;
      return;
    }

    const data = await res.json();
    if (out) out.textContent = JSON.stringify(data.items || [], null, 2);
  } catch (e) {
    if (out) out.textContent = `Error: ${e.message}`;
  }
}

async function verLogsDeUsuario() {
  const sub = document.getElementById("logbook-sub-input")?.value?.trim();
  const out = document.getElementById("logbook-output");
  if (out) out.textContent = "Cargando...";

  if (!sub) {
    if (out) out.textContent = "Pon un SUB en la caja para ver logs de ese usuario.";
    return;
  }

  try {
    const res = await fetch(`/api/logbook/user/${encodeURIComponent(sub)}?limit=50`, {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const text = await res.text();
      if (out) out.textContent = `Error ${res.status}: ${text}`;
      return;
    }

    const data = await res.json();
    if (out) out.textContent = JSON.stringify(data.items || [], null, 2);
  } catch (e) {
    if (out) out.textContent = `Error: ${e.message}`;
  }
}




// ========================================================
// 2️⃣3️⃣ ARRANQUE GLOBAL
// ========================================================

// 1) Si venimos de Cognito con #id_token
procesarTokenDeHashEnLogin();

// 2) Intentar iniciar sesión en cualquier página
initSession();
