import cv2
import time
import requests
import urllib.request
import os
import numpy as np
from datetime import datetime
import threading
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# --- 1. Configuración de la API REST local ---
API_URL_EVENTOS = "http://127.0.0.1:8000/api/eventos"
API_URL_FRAME = "http://127.0.0.1:8000/api/frame"

# Índices exactos de la malla facial para los contornos de los ojos
LEFT_EYE_INDICES = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
RIGHT_EYE_INDICES = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]

# --- 2. Hilo de transmisión de video (Streaming MJPEG) ---
ultimo_frame_bytes = None
transmitiendo = True

def hilo_transmisor():
    while transmitiendo:
        if ultimo_frame_bytes is not None:
            try:
                requests.post(API_URL_FRAME, data=ultimo_frame_bytes, timeout=0.5)
            except:
                pass
        time.sleep(0.1)  # Transmitir a ~10 FPS

transmisor = threading.Thread(target=hilo_transmisor)
transmisor.start()

# --- 3. Inicialización de MediaPipe ---
model_path = 'face_landmarker.task'
if not os.path.exists(model_path):
    print("Descargando modelo de MediaPipe...")
    url = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
    urllib.request.urlretrieve(url, model_path)
    print("Modelo descargado.")

base_options = python.BaseOptions(model_asset_path=model_path)
options = vision.FaceLandmarkerOptions(
    base_options=base_options,
    output_face_blendshapes=True,
    num_faces=1
)
detector = vision.FaceLandmarker.create_from_options(options)

# --- 4. Inicialización de la Cámara y Variables de Control ---
cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
print("Nodo IoT iniciado. Presiona 'q' en la ventana de video para salir.")

# Variables para lógica de parpadeos y somnolencia
UMBRAL_SCORE = 0.60
UMBRAL_TIEMPO = 0.5
tiempo_inicio_cierre = None
alerta_somnolencia_enviada = False
ultimo_envio_evento = time.time()

# --- 5. Bucle Principal ---
while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break
        
    frame = cv2.flip(frame, 1)
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
    detection_result = detector.detect(mp_image)
    
    estado_actual = "Normal"
    detalle = "Conductor atento"
    score_maximo = 0.0
    enviar_evento_inmediato = False 

    if detection_result.face_landmarks:
        if detection_result.face_blendshapes:
            blendshapes = detection_result.face_blendshapes[0]
            score_izq = next((item.score for item in blendshapes if item.category_name == 'eyeBlinkLeft'), 0)
            score_der = next((item.score for item in blendshapes if item.category_name == 'eyeBlinkRight'), 0)
            score_maximo = max(score_izq, score_der)

            # --- MÁQUINA DE ESTADOS: Parpadeo vs Somnolencia ---
            if score_maximo >= UMBRAL_SCORE:
                if tiempo_inicio_cierre is None:
                    tiempo_inicio_cierre = time.time()
                else:
                    tiempo_cerrado = time.time() - tiempo_inicio_cierre
                    if tiempo_cerrado >= UMBRAL_TIEMPO and not alerta_somnolencia_enviada:
                        estado_actual = "Alerta de Somnolencia"
                        detalle = f"Microsueño detectado ({tiempo_cerrado:.1f}s)"
                        enviar_evento_inmediato = True
                        alerta_somnolencia_enviada = True
                        cv2.putText(frame, "¡SOMNOLENCIA!", (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            else:
                if tiempo_inicio_cierre is not None:
                    tiempo_cerrado = time.time() - tiempo_inicio_cierre
                    if 0.05 < tiempo_cerrado < UMBRAL_TIEMPO:
                        estado_actual = "Parpadeo"
                        detalle = f"Parpadeo natural ({tiempo_cerrado:.2f}s)"
                        enviar_evento_inmediato = True
                    
                    tiempo_inicio_cierre = None
                    alerta_somnolencia_enviada = False

        # Dibujo dinámico de los párpados
        r = int(255 * score_maximo)
        g = int(255 * (1 - score_maximo))
        color_dinamico = (0, g, r) 
        h, w, _ = frame.shape
        fl = detection_result.face_landmarks[0]

        left_eye_pts = np.array([[int(fl[i].x * w), int(fl[i].y * h)] for i in LEFT_EYE_INDICES], np.int32)
        right_eye_pts = np.array([[int(fl[i].x * w), int(fl[i].y * h)] for i in RIGHT_EYE_INDICES], np.int32)

        cv2.polylines(frame, [left_eye_pts], isClosed=True, color=color_dinamico, thickness=1, lineType=cv2.LINE_AA)
        cv2.polylines(frame, [right_eye_pts], isClosed=True, color=color_dinamico, thickness=1, lineType=cv2.LINE_AA)

    else:
        estado_actual = "Sin Rostro"
        detalle = "Conductor fuera del encuadre"
        tiempo_inicio_cierre = None
        alerta_somnolencia_enviada = False

    # Comprimir el frame a JPG y enviarlo al hilo transmisor
    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
    ultimo_frame_bytes = buffer.tobytes()

    # Envío de telemetría a la Base de Datos
    tiempo_actual = time.time()
    if enviar_evento_inmediato or (tiempo_actual - ultimo_envio_evento >= 1.0):
        if not enviar_evento_inmediato and alerta_somnolencia_enviada:
             estado_actual = "Alerta de Somnolencia"
             detalle = "Cierre prolongado continuo"

        payload = {
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3],
            "estado": estado_actual,
            "detalle": detalle,
            "score": round(score_maximo, 3) if score_maximo > 0 else 0.0
        }
        try:
            requests.post(API_URL_EVENTOS, json=payload, timeout=0.5)
        except:
            pass
        ultimo_envio_evento = tiempo_actual

    cv2.imshow('IoT - Entorno Convergente', frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# --- 6. Limpieza y Cierre ---
transmitiendo = False
transmisor.join()
cap.release()
cv2.destroyAllWindows()