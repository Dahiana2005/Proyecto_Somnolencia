from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from fastapi import FastAPI, Depends, Request
from fastapi.responses import StreamingResponse
import asyncio

# ---------------------------------------------------------
# 1. Configuración de Base de Datos (Persistencia)
# ---------------------------------------------------------
SQLALCHEMY_DATABASE_URL = "postgresql+psycopg2://postgres:012529@localhost:5432/somnolencia_db"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Modelo de la tabla para almacenar los eventos y alertas
class EventoDB(Base):
    __tablename__ = "eventos"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(String, index=True)
    estado = Column(String, index=True)
    detalle = Column(String)
    score = Column(Float, nullable=True)

# Crear las tablas en la base de datos local
Base.metadata.create_all(bind=engine)

# ---------------------------------------------------------
# 2. Esquemas de Datos (Pydantic para la API REST)
# ---------------------------------------------------------
class EventoCreate(BaseModel):
    timestamp: str
    estado: str
    detalle: str
    score: float = None

class EventoResponse(EventoCreate):
    id: int
    class Config:
        from_attributes = True

# ---------------------------------------------------------
# 3. Configuración del Servidor FastAPI
# ---------------------------------------------------------
app = FastAPI(title="API Entorno Convergente - Somnolencia")

# Configurar CORS para permitir que tu futuro frontend en React consuma la API sin bloqueos
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependencia para inyectar la sesión de la base de datos
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------------------------------------------------------
# 4. Endpoints de la API REST
# ---------------------------------------------------------

@app.post("/api/eventos", response_model=EventoResponse)
def registrar_evento(evento: EventoCreate, db: Session = Depends(get_db)):
    """
    Recibe la telemetría y alertas generadas por el script de visión artificial (Nodo IoT).
    """
    db_evento = EventoDB(**evento.model_dump())
    db.add(db_evento)
    db.commit()
    db.refresh(db_evento)
    return db_evento

@app.get("/api/eventos", response_model=list[EventoResponse])
def obtener_eventos(db: Session = Depends(get_db)):
    """
    Retorna el historial completo de eventos para los reportes y analítica en la App Web.
    """
    # Ordenar de forma descendente para tener los eventos más recientes primero
    return db.query(EventoDB).order_by(EventoDB.id.desc()).all()

# ---------------------------------------------------------
# 5. Streaming de Video (IoT -> FastAPI -> React)
# ---------------------------------------------------------
fotograma_actual = b""

@app.post("/api/frame")
async def recibir_fotograma(request: Request):
    """Recibe los frames en bytes puros desde el script IoT"""
    global fotograma_actual
    fotograma_actual = await request.body()
    return {"status": "ok"}

async def generador_video():
    """Genera el flujo MJPEG continuo para el navegador"""
    global fotograma_actual
    while True:
        if fotograma_actual:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + fotograma_actual + b'\r\n')
        await asyncio.sleep(0.05) # Límite de ~20 FPS para no saturar la red

@app.get("/api/video_feed")
def transmitir_video():
    """Endpoint que consume React para ver el video en vivo"""
    return StreamingResponse(generador_video(), media_type="multipart/x-mixed-replace; boundary=frame")