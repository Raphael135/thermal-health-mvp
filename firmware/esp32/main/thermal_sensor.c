#include "thermal_sensor.h"
#include <stdlib.h>
#include <math.h>
#include "esp_log.h"

static const char *TAG = "thermal_sensor";

int thermal_sensor_init(void) {
    // TODO: quando o sensor real for definido, inicializar I2C/SPI aqui.
    ESP_LOGI(TAG, "Sensor térmico SIMULADO inicializado (sem hardware real).");
    return 0;
}

int thermal_sensor_read_frame(thermal_frame_t *out_frame) {
    if (out_frame == NULL || out_frame->temperatures == NULL) {
        return -1;
    }

    // Gera um frame plausível: baseline corporal + "hotspot" central + ruído,
    // só para permitir testar o pipeline completo sem hardware.
    float baseline = 31.0f + ((float) rand() / RAND_MAX);
    float center_x = out_frame->width / 2.0f;
    float center_y = out_frame->height / 2.0f;

    for (int y = 0; y < out_frame->height; y++) {
        for (int x = 0; x < out_frame->width; x++) {
            float dx = x - center_x;
            float dy = y - center_y;
            float distance = sqrtf(dx * dx + dy * dy);
            float hotspot = fmaxf(0.0f, 4.0f - distance * 0.3f);
            float noise = (((float) rand() / RAND_MAX) - 0.5f) * 0.6f;

            out_frame->temperatures[y * out_frame->width + x] = baseline + hotspot + noise;
        }
    }

    return 0;
}
