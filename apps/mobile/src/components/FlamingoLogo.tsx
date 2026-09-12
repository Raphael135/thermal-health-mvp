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
        d="M150 30 Q152.5 40.5 163 43 Q152.5 45.5 150 56 Q147.5 45.5 137 43 Q147.5 40.5 150 30 Z"
        fill={colors.cream}
      />

      {/* cabeça + olho */}
      <Circle cx={90} cy={44} r={9} stroke={colors.cream} strokeWidth={4.5} />
      <Circle cx={87} cy={41} r={1.8} fill={colors.cream} />

      {/* bico (cunha sólida) */}
      <Path d="M98 41 L 120 45 L 101 51 Z" fill={colors.cream} />

      {/* pescoço: uma única curva em S */}
      <Path
        d="M92 53 C 58 66, 108 92, 72 130"
        stroke={colors.cream}
        strokeWidth={4.5}
        strokeLinecap="round"
        fill="none"
      />

      {/* corpo */}
      <Path
        d="M72 130
           C 46 126, 38 158, 54 178
           C 66 192, 102 192, 112 176
           C 120 163, 112 138, 90 130
           C 84 128, 76 128, 72 130 Z"
        stroke={colors.cream}
        strokeWidth={4.5}
        strokeLinejoin="round"
        fill="none"
      />

      {/* perna + pé */}
      <Path d="M84 186 L 82 198" stroke={colors.cream} strokeWidth={4.5} strokeLinecap="round" />
      <Path d="M76 198 L 89 198" stroke={colors.cream} strokeWidth={4.5} strokeLinecap="round" />
    </Svg>
  );
}
