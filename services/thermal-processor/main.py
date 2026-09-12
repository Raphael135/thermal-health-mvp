from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.processing import build_heatmap

app = FastAPI(
    title="Thermal Processor",
    description=(
        "Processa matrizes de temperatura em imagens (heatmap) e estatísticas "
        "descritivas. Não realiza diagnóstico médico nem classificação de risco."
    ),
    version="0.1.0",
)


class ProcessThermalMatrixRequest(BaseModel):
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    unit: str = "celsius"
    temperatures: list[float]


class ProcessThermalMatrixResponse(BaseModel):
    minTemp: float
    maxTemp: float
    avgTemp: float
    imageWidth: int
    imageHeight: int
    imageBase64: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/process-thermal-matrix", response_model=ProcessThermalMatrixResponse)
def process_thermal_matrix(payload: ProcessThermalMatrixRequest):
    expected_length = payload.width * payload.height
    if len(payload.temperatures) != expected_length:
        raise HTTPException(
            status_code=422,
            detail=f"Esperado {expected_length} valores (width*height), recebido {len(payload.temperatures)}.",
        )

    result = build_heatmap(payload.width, payload.height, payload.temperatures)
    return result
