console.log("scripts.js cargado correctamente");

// ========================================================
// 1️⃣ INICIALIZAR AMPLIFY (usando window.* para evitar ReferenceError)
// ========================================================
let Auth;

try {
  // Intentamos obtener la librería de Amplify desde window
  let amplifyLib = null;

  if (window.aws_amplify) {
    amplifyLib = window.aws_amplify;
  } else if (window.Amplify) {
    // Algunas versiones exponen Amplify directamente en window.Amplify
    amplifyLib = { Amplify: window.Amplify, Auth: window.Amplify.Auth };
  }

  if (!amplifyLib) {
    throw new Error("Ni window.aws_amplify ni window.Amplify están definidos");
  }

  const { Amplify, Auth: AmplifyAuth } = amplifyLib;

  if (!Amplify || !AmplifyAuth) {
    throw new Error("Amplify o Auth no están disponibles en la librería");
  }

  Amplify.configure(window.awsconfig);
  Auth = AmplifyAuth;

  console.log("Amplify configurado correctamente");
} catch (e) {
  console.error("❌ ERROR inicializando Amplify:", e);
}

// ========================================================
// 2️⃣ DETECTAR PÁGINA + SI VOLVEMOS DE COGNITO
// ========================================================
const page = location.pathname.split("/").pop() || "login.html";
const volviendoDeCognito = location.search.includes("code=");
console.log("Página actual:", page, "¿Callback OAuth?", volviendoDeCognito);

// ========================================================
// Helper: cabeceras con token
// ========================================================
function getAuthHeaders() {
  return {
    Authorization: `Bearer ${window.idToken}`,
  };
}

// ========================================================
// 4️⃣ CARGAR SESIÓN Y REDIRIGIR
// ========================================================
async function cargarSesion() {
  try {
    console.log("Verificando sesión...");

    if (!Auth) {
      console.error("❌ Auth no está disponible, no se puede obtener la sesión");
      throw new Error("Auth no inicializado");
    }

    const session = await Auth.currentSession();
    console.log("Sesión obtenida:", session);

    const idToken = session.getIdToken().getJwtToken();
    const payload = session.getIdToken().decodePayload();

    window.idToken = idToken;
    window.payload = payload;

    console.log("✅ Usuario logueado. Payload:", payload);

    await redirigirSegunGrupo();

    // Una vez validado el rol y sin redirecciones,
    // cargamos datos específicos de cada página protegida
    if (page === "padres.html") {
      listarArchivosPadre();
    } else if (page === "entrenadores.html") {
      listarArchivosEntrenador();
    }
  } catch (e) {
    console.warn("⚠️ No logueado o error al cargar sesión:", e);
    if (page !== "login.html") {
      location.href = "/login.html";
    }
  }
}

// ========================================================
// 5️⃣ REDIRIGIR SEGÚN GRUPO
// ========================================================
async function redirigirSegunGrupo() {
  const groups = (window.payload && window.payload["cognito:groups"]) || [];

  const esPadre = groups.includes("padres");
  const esEntrenador = groups.includes("entrenadores");

  console.log("🔍 Grupos del usuario:", groups);

  // → Cuando volvemos del login
  if (page === "login.html") {
    if (esPadre) {
      console.log("➡️ Es padre, redirigiendo a /padres.html");
      return (location.href = "/padres.html");
    }
    if (esEntrenador) {
      console.log("➡️ Es entrenador, redirigiendo a /entrenadores.html");
      return (location.href = "/entrenadores.html");
    }
  }

  // → Protección cruzada
  if (page === "entrenadores.html" && esPadre) {
    console.log(
      "⛔ Padre intentando entrar en entrenadores → redirigiendo a /padres.html"
    );
    return (location.href = "/padres.html");
  }

  if (page === "padres.html" && esEntrenador) {
    console.log(
      "⛔ Entrenador intentando entrar en padres → redirigiendo a /entrenadores.html"
    );
    return (location.href = "/entrenadores.html");
  }
}

// ========================================================
// 6️⃣ CONFIGURAR CREDENCIALES AWS
//     → opción 2: todo S3 pasa por backend, así que está vacío
// ========================================================
async function configurarCredencialesAWS() {
  // Dejamos esta función por compatibilidad,
  // pero ya no configuramos AWS.config aquí.
  return;
}

// ========================================================
// 7️⃣ SUBIR ARCHIVO (PADRES) vía BACKEND
// ========================================================
async function subirArchivo() {
  const fileInput = document.getElementById("fileInput");
  if (!fileInput || !fileInput.files.length) {
    return alert("Selecciona un archivo primero");
  }

  const file = fileInput.files[0];

  try {
    console.log("Preparando subida de archivo:", file.name);

    // 1) Pedimos URL de subida al backend
    const res = await fetch(
      `/api/files/upload-url?filename=${encodeURIComponent(file.name)}`,
      {
        headers: getAuthHeaders(),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("Error al obtener URL de subida:", text);
      return alert("❌ Error al preparar la subida");
    }

    const data = await res.json();
    const uploadUrl = data.url;
    console.log("URL de subida recibida:", uploadUrl);

    // 2) Subimos el archivo directamente a S3 usando la URL firmada
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
    });

    if (!putRes.ok) {
      console.error("Error al subir a la URL firmada:", putRes.status);
      return alert("❌ Error al subir el archivo");
    }

    alert("✅ Archivo subido correctamente");
    listarArchivosPadre();
  } catch (err) {
    console.error("Error en subirArchivo():", err);
    alert("❌ Error al subir archivo");
  }
}

// ========================================================
// 8️⃣ DESCARGAR ARCHIVO vía BACKEND
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

    // Redirigimos al navegador a la URL firmada
    window.location.href = url;
  } catch (err) {
    console.error("Error en descargarArchivo():", err);
    alert("❌ Error al descargar archivo");
  }
}

// ========================================================
// 9️⃣ LISTAR ARCHIVOS DEL PADRE vía BACKEND
// ========================================================
async function listarArchivosPadre() {
  const cont = document.getElementById("docs");
  if (!cont) return;

  cont.innerHTML = "<p>Cargando documentos...</p>";

  try {
    const res = await fetch("/api/files/padres", {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Error listando documentos de padre:", text);
      cont.innerHTML = "<p>Error al cargar documentos.</p>";
      return;
    }

    const data = await res.json();
    const docs = data.documents || [];

    if (!docs.length) {
      cont.innerHTML = "<p>No hay documentos todavía.</p>";
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
          <span>${name}</span>
          <button onclick="descargarArchivo('${safeKey}')">Descargar</button>
        </div>
      `;
    });
  } catch (err) {
    console.error("Error en listarArchivosPadre():", err);
    cont.innerHTML = "<p>Error al cargar documentos.</p>";
  }
}

// ========================================================
// 🔟 LISTAR ARCHIVOS PARA ENTRENADORES vía BACKEND
// ========================================================
async function listarArchivosEntrenador() {
  const cont = document.getElementById("docs-entrenadores");
  if (!cont) return;

  cont.innerHTML = "<p>Cargando documentos...</p>";

  try {
    const res = await fetch("/api/files/entrenadores", {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Error listando documentos (entrenador):", text);
      cont.innerHTML = "<p>Error al cargar documentos.</p>";
      return;
    }

    const data = await res.json();
    const docs = data.documents || [];

    if (!docs.length) {
      cont.innerHTML = "<p>No hay documentos de padres aún.</p>";
      return;
    }

    cont.innerHTML = "";

    docs.forEach((doc) => {
      const safeKey = encodeURIComponent(doc.key);
      cont.innerHTML += `
        <div class="doc-card">
          <span>${doc.key}</span>
          <button onclick="descargarArchivo('${safeKey}')">Descargar</button>
        </div>
      `;
    });
  } catch (err) {
    console.error("Error en listarArchivosEntrenador():", err);
    cont.innerHTML = "<p>Error al cargar documentos.</p>";
  }
}

// ========================================================
// 🔄 11️⃣ EJECUTAR SESIÓN SEGÚN DONDE ESTAMOS
// ========================================================

// Si estamos en login.html pero *volvemos de Cognito* → procesar sesión
if (page === "login.html" && volviendoDeCognito) {
  console.log("↪ Callback OAuth detectado → procesando sesión");
  cargarSesion();
}

// Si estamos en una página protegida → verificar sesión
if (page !== "login.html") {
  cargarSesion();
}
