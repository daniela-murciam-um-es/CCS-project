// Abrir y cerrar modal
const modal = document.getElementById('uploadModal');
const openModalBtn = document.getElementById('openModal');
const closeModalBtn = document.getElementById('closeModal');
const uploadBtn = document.getElementById('uploadBtn');

if(openModalBtn) openModalBtn.onclick = () => modal.style.display = 'flex';
if(closeModalBtn) closeModalBtn.onclick = () => modal.style.display = 'none';
if(modal) window.onclick = (e) => { if(e.target === modal) modal.style.display = 'none'; }

// Login básico (solo ejemplo)
const loginBtn = document.getElementById('loginBtn');
if(loginBtn){
  loginBtn.onclick = () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('errorMsg');

    if(!email || !password){
      errorMsg.textContent = "Debe completar todos los campos";
      return;
    }
    // Aquí llamarías a tu backend para login
    // Ejemplo:
    // fetch('/login', { method:'POST', body: JSON.stringify({email, password})})
    // luego redirigir según role
    console.log("Login con", email, password);
  }
}

// Botón subir archivo (solo ejemplo)
if(uploadBtn){
  uploadBtn.onclick = () => {
    const fileInput = document.getElementById('fileInput');
    if(fileInput.files.length === 0){
      alert("Seleccione un archivo");
      return;
    }
    const file = fileInput.files[0];
    console.log("Archivo seleccionado:", file.name);
    // Aquí llamarías al backend para obtener presigned URL y subir a S3
  }
}
