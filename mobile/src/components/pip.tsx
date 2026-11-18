import { View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  FeGaussianBlur,
  Filter,
  G,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

// Drawn from assets/brand/pip/*.svg; every mood shares one body and changes the eyes, mouth and extras
export const PIP_MOODS = [
  'happy',
  'wave',
  'curious',
  'listening',
  'thinking',
  'confused',
  'surprised',
  'proud',
] as const;

export type PipMood = (typeof PIP_MOODS)[number];

// Pip keeps these colours on every background, so they don't come from the theme
const INK = '#3A2540';
const WHITE = '#FFFFFF';
const DENIM = '#3B6699';
const GOLD = '#FFC66B';

// The drawings are 260 wide and 250 tall
const HEIGHT_PER_WIDTH = 250 / 260;

// How far Pip leans in each mood, in degrees
const TILT: Record<PipMood, number> = {
  happy: 0,
  wave: 0,
  curious: -7,
  listening: 5,
  thinking: 0,
  confused: 6,
  surprised: 0,
  proud: 0,
};

// Where Pip looks, as a nudge to both eyes
const GAZE: Record<PipMood, { x: number; y: number }> = {
  happy: { x: 0, y: 0 },
  wave: { x: 0, y: 0 },
  curious: { x: 4, y: -2 },
  listening: { x: 0, y: 0 },
  thinking: { x: 6, y: -6 },
  confused: { x: -3, y: 0 },
  surprised: { x: 0, y: 0 },
  proud: { x: 0, y: 0 },
};

type PipProps = {
  mood: PipMood;
  size: number;
};

/** Telmi's mascot in one of its eight moods; hidden from screen readers because nearby text says it all. */
export function Pip({ mood, size }: PipProps) {
  return (
    <View
      testID={`pip-${mood}`}
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size * HEIGHT_PER_WIDTH }}
    >
      <Svg width="100%" height="100%" viewBox="-10 -10 260 250">
        <Defs>
          <RadialGradient id="pip-body" cx="40%" cy="30%" r="75%">
            <Stop offset="0" stopColor="#FFB094" />
            <Stop offset="0.55" stopColor="#FF8C69" />
            <Stop offset="1" stopColor="#F2734F" />
          </RadialGradient>
          <Filter id="pip-soft" x="-50%" y="-50%" width="200%" height="200%">
            <FeGaussianBlur stdDeviation={3.2} />
          </Filter>
          <Filter id="pip-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <FeGaussianBlur stdDeviation={6} />
          </Filter>
        </Defs>
        <Ellipse
          cx={124}
          cy={214}
          rx={66}
          ry={9}
          fill={INK}
          opacity={0.1}
          filter="url(#pip-shadow)"
        />
        <G transform={`rotate(${TILT[mood]} 120 116)`}>
          {mood === 'wave' ? <WavingArm /> : null}
          <Path
            d="M120 30C176 30 212 66 212 116C212 164 174 196 120 196C106 196 93 194 81 190L50 207C45 210 40 205 43 200L54 176C38 160 28 140 28 116C28 66 64 30 120 30Z"
            fill="url(#pip-body)"
          />
          <Ellipse
            cx={86}
            cy={60}
            rx={28}
            ry={11}
            transform="rotate(-24 86 60)"
            fill={WHITE}
            opacity={0.38}
          />
          <Ellipse
            cx={64}
            cy={142}
            rx={15}
            ry={9}
            fill="#FF6F91"
            opacity={0.42}
            filter="url(#pip-soft)"
          />
          <Ellipse
            cx={176}
            cy={142}
            rx={15}
            ry={9}
            fill="#FF6F91"
            opacity={0.42}
            filter="url(#pip-soft)"
          />
          <Eyes mood={mood} />
          <Mouth mood={mood} />
          <Extras mood={mood} />
        </G>
      </Svg>
    </View>
  );
}

/** Both eyes: closed and happy when listening or proud, otherwise open and looking somewhere. */
function Eyes({ mood }: { mood: PipMood }) {
  if (mood === 'listening' || mood === 'proud') {
    return (
      <Path
        d="M76 116q14-15 28 0M136 116q14-15 28 0"
        stroke={INK}
        strokeWidth={6}
        fill="none"
        strokeLinecap="round"
      />
    );
  }
  const gaze = GAZE[mood];
  const wide = mood === 'surprised';
  return (
    <G transform={`translate(${gaze.x} ${gaze.y})`}>
      <Eye x={90} wide={wide} />
      <Eye x={150} wide={wide} />
    </G>
  );
}

/** One open eye with its two shine dots. */
function Eye({ x, wide }: { x: number; wide: boolean }) {
  return (
    <G>
      <Ellipse cx={x} cy={112} rx={wide ? 17 : 15} ry={wide ? 22 : 19} fill={INK} />
      <Circle cx={x + 5} cy={105} r={6.2} fill={WHITE} />
      <Circle cx={x - 5} cy={120} r={2.6} fill={WHITE} />
    </G>
  );
}

/** The mouth for each mood. */
function Mouth({ mood }: { mood: PipMood }) {
  if (mood === 'wave' || mood === 'proud') {
    return (
      <G>
        <Path d="M107 137q13 3 26 0q-2 18 -13 18q-11 0 -13 -18z" fill={INK} />
        <Path d="M113 148q7 -6 14 0q-3 6 -7 6q-4 0 -7 -6z" fill="#FF7A8C" />
      </G>
    );
  }
  if (mood === 'curious') {
    return <Ellipse cx={120} cy={146} rx={7} ry={8.5} fill={INK} />;
  }
  if (mood === 'surprised') {
    return <Ellipse cx={120} cy={148} rx={9.5} ry={11.5} fill={INK} />;
  }
  if (mood === 'thinking') {
    return <Line d="M113 144h15" color={INK} width={5} />;
  }
  if (mood === 'confused') {
    return <Line d="M106 146q7-7 14 0t14 0" color={INK} width={5} />;
  }
  return <Line d="M110 141q10 10 20 0" color={INK} width={5} />;
}

/** The little things around Pip: a question mark, sound waves, thinking dots or sparkles. */
function Extras({ mood }: { mood: PipMood }) {
  if (mood === 'curious' || mood === 'confused') {
    return (
      <G>
        <Line d="M190 36q0-16 15-16t15 15q0 9-11 13v7" color={DENIM} width={7} />
        <Circle cx={209} cy={68} r={4.6} fill={DENIM} />
        {mood === 'confused' ? <Path d="M182 74q8 12 0 18q-8-6 0-18z" fill="#9CC3EA" /> : null}
      </G>
    );
  }
  if (mood === 'listening') {
    return (
      <G opacity={0.8}>
        <Line d="M218 98q9 18 0 36M229 88q14 28 0 56" color={DENIM} width={5} />
      </G>
    );
  }
  if (mood === 'thinking') {
    return (
      <G>
        <Circle cx={196} cy={40} r={5} fill={DENIM} />
        <Circle cx={212} cy={30} r={6.5} fill={DENIM} />
        <Circle cx={230} cy={18} r={8} fill={DENIM} />
      </G>
    );
  }
  if (mood === 'proud') {
    return (
      <G>
        <Path
          d="M212 27Q214.34 37.66 225 40Q214.34 42.34 212 53Q209.66 42.34 199 40Q209.66 37.66 212 27Z"
          fill={GOLD}
        />
        <Path
          d="M32 51Q33.62 58.38 41 60Q33.62 61.62 32 69Q30.38 61.62 23 60Q30.38 58.38 32 51Z"
          fill="#FF8C69"
        />
        <Path
          d="M226 75Q227.26 80.74 233 82Q227.26 83.26 226 89Q224.74 83.26 219 82Q224.74 80.74 226 75Z"
          fill={GOLD}
        />
      </G>
    );
  }
  if (mood === 'surprised') {
    return (
      <G>
        <Path
          d="M214 32Q216.16 41.84 226 44Q216.16 46.16 214 56Q211.84 46.16 202 44Q211.84 41.84 214 32Z"
          fill={GOLD}
        />
        <Path
          d="M30 50Q31.44 56.56 38 58Q31.44 59.44 30 66Q28.56 59.44 22 58Q28.56 56.56 30 50Z"
          fill={GOLD}
        />
      </G>
    );
  }
  return null;
}

/** The raised arm and motion lines, drawn behind the body. */
function WavingArm() {
  return (
    <G>
      <Line d="M190 120Q214 104 220 72" color="#F98060" width={24} />
      <Line d="M226 50q10 4 12 14M234 38q14 6 16 22" color={GOLD} width={4.5} />
    </G>
  );
}

/** A rounded pen stroke, which most of Pip's face is made of. */
function Line({ d, color, width }: { d: string; color: string; width: number }) {
  return <Path d={d} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" />;
}
