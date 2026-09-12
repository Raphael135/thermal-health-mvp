"""
Processamento puro de imagem térmica.

IMPORTANTE: este módulo NÃO faz diagnóstico médico, NÃO classifica risco e
NÃO decide se um exame é normal ou anormal. Apenas transforma uma matriz de
temperaturas em uma imagem (heatmap) e calcula estatísticas descritivas
(mínimo, máximo, média). Qualquer interpretação clínica é responsabilidade
exclusiva do médico, feita no painel web.
"""

import base64

import cv2
import numpy as np

# Escala de saída para deixar o heatmap legível mesmo vindo de sensores de baixa
# resolução (ex.: 32x24, típico de sensores térmicos econômicos).
OUTPUT_SCALE = 8


def build_heatmap(width: int, height: int, temperatures: list[float]) -> dict:
    matrix = np.array(temperatures, dtype=np.float32).reshape((height, width))

    min_temp = float(np.min(matrix))
    max_temp = float(np.max(matrix))
    avg_temp = float(np.mean(matrix))

    # Normaliza para 0-255 para poder aplicar um colormap.
    if max_temp > min_temp:
        normalized = ((matrix - min_temp) / (max_temp - min_temp) * 255).astype(np.uint8)
    else:
        normalized = np.zeros_like(matrix, dtype=np.uint8)

    colored = cv2.applyColorMap(normalized, cv2.COLORMAP_JET)

    output_width = width * OUTPUT_SCALE
    output_height = height * OUTPUT_SCALE
    resized = cv2.resize(colored, (output_width, output_height), interpolation=cv2.INTER_CUBIC)

    success, encoded = cv2.imencode('.png', resized)
    if not success:
        raise RuntimeError('Falha ao codificar imagem PNG.')

    image_base64 = base64.b64encode(encoded.tobytes()).decode('ascii')

    return {
        'minTemp': round(min_temp, 2),
        'maxTemp': round(max_temp, 2),
        'avgTemp': round(avg_temp, 2),
        'imageWidth': output_width,
        'imageHeight': output_height,
        'imageBase64': image_base64,
    }
