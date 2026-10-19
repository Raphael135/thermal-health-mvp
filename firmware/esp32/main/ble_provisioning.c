#include "ble_provisioning.h"

#include <stdbool.h>
#include <string.h>

#include "esp_err.h"
#include "esp_log.h"
#include "sdkconfig.h"

#include "host/ble_hs.h"
#include "host/util/util.h"
#include "nimble/nimble_port.h"
#include "nimble/nimble_port_freertos.h"
#include "services/gap/ble_svc_gap.h"
#include "services/gatt/ble_svc_gatt.h"

#include "device_config.h"

// Definida pelo componente de armazenamento do NimBLE (guarda os pareamentos na NVS).
extern void ble_store_config_init(void);

static const char *TAG = "ble";

// ---- UUIDs (os mesmos do docs/BLE_PROTOCOL.md) -----------------------------------
// Base 7e5f00NN-1c3a-4b8e-9d2a-6f3b8c1e0a00. O NimBLE quer os bytes em ordem invertida.
#define THERMAL_UUID128(id) \
    BLE_UUID128_INIT(0x00, 0x0a, 0x1e, 0x8c, 0x3b, 0x6f, 0x2a, 0x9d, 0x8e, 0x4b, 0x3a, 0x1c, (id), 0x00, 0x5f, 0x7e)

static const ble_uuid128_t s_svc_uuid = THERMAL_UUID128(0x01);
static const ble_uuid128_t s_wifi_uuid = THERMAL_UUID128(0x02);
static const ble_uuid128_t s_patient_uuid = THERMAL_UUID128(0x03);
static const ble_uuid128_t s_command_uuid = THERMAL_UUID128(0x04);
static const ble_uuid128_t s_status_uuid = THERMAL_UUID128(0x05);

// ---- Segurança ---------------------------------------------------------------------
// A senha do Wi-Fi viaja por aqui, então escrita e leitura exigem link criptografado.
// Com THERMAL_BLE_PASSKEY > 0 o pareamento usa uma senha de 6 dígitos (protege contra quem
// intercepta o pareamento); com 0 é "Just Works": criptografa, mas não autentica o outro lado.
#if CONFIG_THERMAL_BLE_PASSKEY > 0
#define SECURE_WRITE BLE_GATT_CHR_F_WRITE_AUTHEN
#define SECURE_READ BLE_GATT_CHR_F_READ_AUTHEN
#else
#define SECURE_WRITE BLE_GATT_CHR_F_WRITE_ENC
#define SECURE_READ BLE_GATT_CHR_F_READ_ENC
#endif

#define MAX_WRITE_LEN 128 // maior quadro é o do Wi-Fi: 1 + 32 + 1 + 63 = 97
#define PREFERRED_MTU 247

typedef enum { CHR_WIFI, CHR_PATIENT, CHR_COMMAND } write_target_t;

static ble_provisioning_callbacks_t s_callbacks;
static uint16_t s_status_handle;
static uint8_t s_own_addr_type;
static volatile bool s_synced;
static volatile uint32_t s_status_word; // estado | flags << 8 | erro << 16

static int gap_event_cb(struct ble_gap_event *event, void *arg);

// ---- Anúncio -----------------------------------------------------------------------

static void start_advertising(void) {
    struct ble_hs_adv_fields fields;
    memset(&fields, 0, sizeof fields);
    fields.flags = BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP;
    fields.uuids128 = (ble_uuid128_t *) &s_svc_uuid;
    fields.num_uuids128 = 1;
    fields.uuids128_is_complete = 1;
    int rc = ble_gap_adv_set_fields(&fields);
    if (rc != 0) {
        ESP_LOGE(TAG, "ble_gap_adv_set_fields falhou: %d", rc);
        return;
    }

    // O UUID de 128 bits ocupa quase todo o pacote principal; o nome vai na resposta de varredura.
    struct ble_hs_adv_fields scan_rsp;
    memset(&scan_rsp, 0, sizeof scan_rsp);
    const char *name = ble_svc_gap_device_name();
    scan_rsp.name = (uint8_t *) name;
    scan_rsp.name_len = (uint8_t) strlen(name);
    scan_rsp.name_is_complete = 1;
    rc = ble_gap_adv_rsp_set_fields(&scan_rsp);
    if (rc != 0) {
        ESP_LOGE(TAG, "ble_gap_adv_rsp_set_fields falhou: %d", rc);
        return;
    }

    struct ble_gap_adv_params params;
    memset(&params, 0, sizeof params);
    params.conn_mode = BLE_GAP_CONN_MODE_UND;
    params.disc_mode = BLE_GAP_DISC_MODE_GEN;
    rc = ble_gap_adv_start(s_own_addr_type, NULL, BLE_HS_FOREVER, &params, gap_event_cb, NULL);
    if (rc != 0) {
        ESP_LOGE(TAG, "ble_gap_adv_start falhou: %d", rc);
        return;
    }
    ESP_LOGI(TAG, "Anunciando como \"%s\".", name);
}

static int gap_event_cb(struct ble_gap_event *event, void *arg) {
    (void) arg;

    switch (event->type) {
    case BLE_GAP_EVENT_CONNECT:
        if (event->connect.status == 0) {
            ESP_LOGI(TAG, "App conectado (handle %d).", event->connect.conn_handle);
            // Pede o pareamento já na conexão, em vez de esperar o primeiro acesso falhar.
            ble_gap_security_initiate(event->connect.conn_handle);
        } else {
            ESP_LOGW(TAG, "Conexão falhou (status %d); anunciando de novo.", event->connect.status);
            start_advertising();
        }
        return 0;

    case BLE_GAP_EVENT_DISCONNECT:
        ESP_LOGI(TAG, "App desconectado (motivo %d).", event->disconnect.reason);
        start_advertising();
        return 0;

    case BLE_GAP_EVENT_ADV_COMPLETE:
        start_advertising();
        return 0;

    case BLE_GAP_EVENT_ENC_CHANGE:
        ESP_LOGI(TAG, "Criptografia do link: status %d.", event->enc_change.status);
        return 0;

    case BLE_GAP_EVENT_MTU:
        ESP_LOGI(TAG, "MTU negociado: %d.", event->mtu.value);
        return 0;

    case BLE_GAP_EVENT_SUBSCRIBE:
        ESP_LOGI(TAG, "Inscrição no status: notificar=%d.", event->subscribe.cur_notify);
        return 0;

    case BLE_GAP_EVENT_REPEAT_PAIRING: {
        // O celular esqueceu o pareamento antigo (ou é outro celular com o mesmo endereço):
        // apaga o registro velho e deixa parear de novo.
        struct ble_gap_conn_desc desc;
        if (ble_gap_conn_find(event->repeat_pairing.conn_handle, &desc) == 0) {
            ble_store_util_delete_peer(&desc.peer_id_addr);
        }
        return BLE_GAP_REPEAT_PAIRING_RETRY;
    }

#if CONFIG_THERMAL_BLE_PASSKEY > 0
    case BLE_GAP_EVENT_PASSKEY_ACTION:
        if (event->passkey.params.action == BLE_SM_IOACT_DISP) {
            struct ble_sm_io pk;
            memset(&pk, 0, sizeof pk);
            pk.action = BLE_SM_IOACT_DISP;
            pk.passkey = CONFIG_THERMAL_BLE_PASSKEY;
            ble_sm_inject_io(event->passkey.conn_handle, &pk);
        }
        return 0;
#endif

    default:
        return 0;
    }
}

// ---- GATT --------------------------------------------------------------------------

static void wipe(void *p, size_t n) {
    volatile uint8_t *v = (volatile uint8_t *) p;
    while (n--) {
        *v++ = 0;
    }
}

static int write_access_cb(uint16_t conn_handle, uint16_t attr_handle, struct ble_gatt_access_ctxt *ctxt,
                           void *arg) {
    (void) conn_handle;
    (void) attr_handle;

    if (ctxt->op != BLE_GATT_ACCESS_OP_WRITE_CHR) {
        return BLE_ATT_ERR_UNLIKELY;
    }

    uint16_t len = OS_MBUF_PKTLEN(ctxt->om);
    uint8_t buf[MAX_WRITE_LEN];
    uint16_t copied = 0;
    if (len > sizeof buf) {
        return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
    }
    if (ble_hs_mbuf_to_flat(ctxt->om, buf, sizeof buf, &copied) != 0) {
        return BLE_ATT_ERR_UNLIKELY;
    }

    ble_parse_result_t result = BLE_PARSE_BAD_VALUE;
    switch ((write_target_t) (uintptr_t) arg) {
    case CHR_WIFI: {
        char ssid[BLE_WIFI_SSID_MAX + 1];
        char password[BLE_WIFI_PASSWORD_MAX + 1];
        result = ble_protocol_parse_wifi(buf, copied, ssid, password);
        if (result == BLE_PARSE_OK) {
            ESP_LOGI(TAG, "Wi-Fi recebido: SSID \"%s\" (senha de %u caracteres).", ssid,
                     (unsigned) strlen(password));
            if (s_callbacks.on_wifi_credentials != NULL) {
                s_callbacks.on_wifi_credentials(ssid, password);
            }
        }
        wipe(ssid, sizeof ssid);
        wipe(password, sizeof password);
        break;
    }
    case CHR_PATIENT: {
        char patient_id[BLE_PATIENT_ID_LEN + 1];
        result = ble_protocol_parse_patient_id(buf, copied, patient_id);
        if (result == BLE_PARSE_OK) {
            ESP_LOGI(TAG, "patientId recebido.");
            if (s_callbacks.on_patient_id != NULL) {
                s_callbacks.on_patient_id(patient_id);
            }
        }
        break;
    }
    case CHR_COMMAND: {
        uint8_t command = 0;
        result = ble_protocol_parse_command(buf, copied, &command);
        if (result == BLE_PARSE_OK) {
            ESP_LOGI(TAG, "Comando: iniciar captura.");
            if (s_callbacks.on_start_capture != NULL) {
                s_callbacks.on_start_capture();
            }
        }
        break;
    }
    }

    wipe(buf, sizeof buf);

    switch (result) {
    case BLE_PARSE_OK:
        return 0;
    case BLE_PARSE_BAD_LENGTH:
        ESP_LOGW(TAG, "Escrita recusada: tamanho inválido.");
        return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
    default:
        ESP_LOGW(TAG, "Escrita recusada: conteúdo inválido.");
        return BLE_ATT_ERR_VALUE_NOT_ALLOWED;
    }
}

static int status_access_cb(uint16_t conn_handle, uint16_t attr_handle, struct ble_gatt_access_ctxt *ctxt,
                            void *arg) {
    (void) conn_handle;
    (void) attr_handle;
    (void) arg;

    if (ctxt->op != BLE_GATT_ACCESS_OP_READ_CHR) {
        return BLE_ATT_ERR_UNLIKELY;
    }

    uint32_t word = s_status_word;
    uint8_t value[BLE_STATUS_LEN];
    ble_protocol_encode_status(value, (ble_device_state_t) (word & 0xFF), (uint8_t) ((word >> 8) & 0xFF),
                               (ble_device_error_t) ((word >> 16) & 0xFF));
    return os_mbuf_append(ctxt->om, value, sizeof value) == 0 ? 0 : BLE_ATT_ERR_INSUFFICIENT_RES;
}

static const struct ble_gatt_svc_def s_gatt_services[] = {
    {
        .type = BLE_GATT_SVC_TYPE_PRIMARY,
        .uuid = &s_svc_uuid.u,
        .characteristics =
            (struct ble_gatt_chr_def[]) {
                {
                    .uuid = &s_wifi_uuid.u,
                    .access_cb = write_access_cb,
                    .arg = (void *) (uintptr_t) CHR_WIFI,
                    .flags = BLE_GATT_CHR_F_WRITE | SECURE_WRITE,
                },
                {
                    .uuid = &s_patient_uuid.u,
                    .access_cb = write_access_cb,
                    .arg = (void *) (uintptr_t) CHR_PATIENT,
                    .flags = BLE_GATT_CHR_F_WRITE | SECURE_WRITE,
                },
                {
                    .uuid = &s_command_uuid.u,
                    .access_cb = write_access_cb,
                    .arg = (void *) (uintptr_t) CHR_COMMAND,
                    .flags = BLE_GATT_CHR_F_WRITE | SECURE_WRITE,
                },
                {
                    .uuid = &s_status_uuid.u,
                    .access_cb = status_access_cb,
                    .val_handle = &s_status_handle,
                    .flags = BLE_GATT_CHR_F_READ | SECURE_READ | BLE_GATT_CHR_F_NOTIFY,
                },
                {0},
            },
    },
    {0},
};

// ---- Ciclo de vida do NimBLE -------------------------------------------------------

static void on_sync(void) {
    int rc = ble_hs_util_ensure_addr(0);
    if (rc == 0) {
        rc = ble_hs_id_infer_auto(0, &s_own_addr_type);
    }
    if (rc != 0) {
        ESP_LOGE(TAG, "Não consegui definir o endereço BLE: %d", rc);
        return;
    }
    s_synced = true;
    start_advertising();
}

static void on_reset(int reason) {
    s_synced = false;
    ESP_LOGW(TAG, "Pilha BLE reiniciada (motivo %d).", reason);
}

static void host_task(void *param) {
    (void) param;
    nimble_port_run(); // só retorna quando o NimBLE é encerrado
    nimble_port_freertos_deinit();
}

int ble_provisioning_init(const ble_provisioning_callbacks_t *callbacks) {
    if (callbacks != NULL) {
        s_callbacks = *callbacks;
    }

    esp_err_t err = nimble_port_init();
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "nimble_port_init falhou: %s", esp_err_to_name(err));
        return -1;
    }

    ble_hs_cfg.reset_cb = on_reset;
    ble_hs_cfg.sync_cb = on_sync;
    ble_hs_cfg.store_status_cb = ble_store_util_status_rr;

    ble_hs_cfg.sm_bonding = 1;
    ble_hs_cfg.sm_sc = 1;
    ble_hs_cfg.sm_our_key_dist = BLE_SM_PAIR_KEY_DIST_ENC | BLE_SM_PAIR_KEY_DIST_ID;
    ble_hs_cfg.sm_their_key_dist = BLE_SM_PAIR_KEY_DIST_ENC | BLE_SM_PAIR_KEY_DIST_ID;
#if CONFIG_THERMAL_BLE_PASSKEY > 0
    ble_hs_cfg.sm_io_cap = BLE_HS_IO_DISPLAY_ONLY;
    ble_hs_cfg.sm_mitm = 1;
#else
    ble_hs_cfg.sm_io_cap = BLE_HS_IO_NO_INPUT_OUTPUT;
    ble_hs_cfg.sm_mitm = 0;
    ESP_LOGW(TAG, "Pareamento sem senha (Just Works): defina THERMAL_BLE_PASSKEY para autenticar o app.");
#endif

    ble_svc_gap_init();
    ble_svc_gatt_init();

    int rc = ble_gatts_count_cfg(s_gatt_services);
    if (rc == 0) {
        rc = ble_gatts_add_svcs(s_gatt_services);
    }
    if (rc != 0) {
        ESP_LOGE(TAG, "Falha ao registrar o serviço GATT: %d", rc);
        return -2;
    }

    rc = ble_svc_gap_device_name_set(DEVICE_HARDWARE_ID);
    if (rc != 0) {
        ESP_LOGE(TAG, "Falha ao definir o nome BLE: %d", rc);
        return -3;
    }
    ble_att_set_preferred_mtu(PREFERRED_MTU);
    ble_store_config_init();

    nimble_port_freertos_init(host_task);
    return 0;
}

void ble_provisioning_update_status(ble_device_state_t state, uint8_t flags, ble_device_error_t error) {
    s_status_word = (uint32_t) state | ((uint32_t) flags << 8) | ((uint32_t) error << 16);
    if (s_synced && s_status_handle != 0) {
        ble_gatts_chr_updated(s_status_handle); // notifica quem se inscreveu
    }
}
