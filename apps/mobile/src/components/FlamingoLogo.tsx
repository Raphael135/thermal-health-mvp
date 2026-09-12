import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../theme/colors';

interface FlamingoLogoProps {
  size?: number;
  /** Quando true, não desenha o fundo arredondado — só o traço do flamingo. */
  bare?: boolean;
}

/**
 * Logo do app em SVG (vetorial, redimensiona sem perder qualidade).
 * Recriação estilizada da marca oficial (flamingo de linha + estrela),
 * na mesma paleta rosé/creme. Se um arquivo de logo oficial (PNG/SVG) for
 * fornecido depois, ele pode substituir este componente ou virar o ícone
 * do app em app.json sem afetar as telas que já usam <FlamingoLogo />.
 */
export function FlamingoLogo({ size = 96, bare = false }: FlamingoLogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      {!bare && <Rect x={0} y={0} width={200} height={200} rx={44} fill={colors.primary} />}

      {/* estrela */}
      <Path
        d="M156 66 L160.5 79.5 L174 84 L160.5 88.5 L156 102 L151.5 88.5 L138 84 L151.5 79.5 Z"
        fill={colors.cream}
      />

      {/* cabeça + bico */}
      <Circle cx={96} cy={52} r={9} stroke={colors.cream} strokeWidth={4} />
      <Path
        d="M104 50 C 114 48, 122 52, 126 58"
        stroke={colors.cream}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <Circle cx={99} cy={49} r={1.6} fill={colors.cream} />

      {/* pescoço em S até o corpo */}
      <Path
        d="M89 58 C 78 70, 100 82, 92 98 C 86 110, 66 112, 66 128"
        stroke={colors.cream}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />

      {/* corpo */}
      <Path
        d="M66 128 C 40 122, 34 150, 52 162 C 68 172, 96 168, 100 150 C 103 138, 92 130, 78 128 Z"
        stroke={colors.cream}
        strokeWidth={4}
        strokeLinejoin="round"
        fill="none"
      />

      {/* perna e pé */}
      <Path
        d="M84 160 L84 200"
        stroke={colors.cream}
        strokeWidth={4}
        strokeLinecap="round"
      />
    </Svg>
  );
}
