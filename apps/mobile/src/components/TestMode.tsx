import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { TEST_MODE, getApiUrl, saveApiUrl } from '../config/server';
import { AppButton, AppTextInput, ErrorText, Subtitle } from './ui';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

/** Aviso fixo de versão de teste. Só aparece com EXPO_PUBLIC_TEST_MODE=true. */
export function TestBanner() {
  if (!TEST_MODE) return null;
  return (
    <View
      style={{
        backgroundColor: '#FFF4D6',
        borderColor: '#E8C766',
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
      }}
    >
      <Text style={{ fontFamily: fonts.semiBold, fontSize: 13, color: '#6B5300' }}>Versão de teste</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: '#6B5300', marginTop: 2 }}>
        Use apenas dados fictícios. Não informe nome, e-mail ou sintomas reais.
      </Text>
    </View>
  );
}

/** Troca do endereço do servidor, para quando a API roda atrás de um túnel temporário. */
export function ServerSettings() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(getApiUrl());
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  if (!TEST_MODE) return null;

  async function save() {
    const ok = await saveApiUrl(value);
    if (!ok) {
      setMessage({ text: 'Endereço inválido. Use algo como https://exemplo.trycloudflare.com', error: true });
      return;
    }
    setValue(getApiUrl());
    setMessage({ text: 'Servidor salvo.', error: false });
  }

  return (
    <View style={{ gap: 8 }}>
      <TouchableOpacity onPress={() => setOpen((o) => !o)}>
        <Text style={{ textAlign: 'center', color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 12 }}>
          {open ? 'Ocultar servidor' : 'Servidor (teste)'}
        </Text>
      </TouchableOpacity>
      {open && (
        <View style={{ gap: 8 }}>
          <Subtitle>Endereço da API</Subtitle>
          <AppTextInput value={value} onChangeText={setValue} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          <AppButton label="Salvar servidor" variant="secondary" onPress={save} />
          {message && (message.error ? <ErrorText>{message.text}</ErrorText> : <Subtitle>{message.text}</Subtitle>)}
        </View>
      )}
    </View>
  );
}
