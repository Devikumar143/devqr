import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Path,
  Circle,
  G,
} from 'react-native-svg';

export interface DevQRLogoMarkProps {
  size?: number;
  glow?: boolean;
  style?: ViewStyle;
}

/**
 * High-tech standalone vector icon mark for DevQR:
 * Features a neon cyber rounded container, QR locator matrices,
 * intertwined developer < / > chevrons, and neural energy bridge nodes.
 */
export const DevQRLogoMark: React.FC<DevQRLogoMarkProps> = ({
  size = 56,
  glow = true,
  style,
}) => {
  const gradientId = `devqr_grad_${Math.floor(size)}`;
  const glowGradId = `devqr_glow_${Math.floor(size)}`;

  return (
    <View style={[{ width: size, height: size }, styles.markWrapper, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <Defs>
          {/* Brand Primary Linear Gradient: Electric Cyan to Indigo */}
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#00F0FF" />
            <Stop offset="45%" stopColor="#0284c7" />
            <Stop offset="100%" stopColor="#6366f1" />
          </LinearGradient>

          {/* Glow backdrop gradient */}
          <LinearGradient id={glowGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#0284c7" stopOpacity="0.35" />
            <Stop offset="100%" stopColor="#38bdf8" stopOpacity="0.05" />
          </LinearGradient>
        </Defs>

        {/* Ambient Glow Background */}
        {glow && (
          <Rect
            x="4"
            y="4"
            width="92"
            height="92"
            rx="24"
            fill={`url(#${glowGradId})`}
          />
        )}

        {/* Dark Obsidian Badge Surface */}
        <Rect
          x="6"
          y="6"
          width="88"
          height="88"
          rx="22"
          fill="#090d16"
          stroke={`url(#${gradientId})`}
          strokeWidth="2.5"
        />

        {/* Background Grid Matrix Pattern */}
        <G opacity="0.18">
          <Circle cx="50" cy="20" r="1.5" fill="#38bdf8" />
          <Circle cx="64" cy="20" r="1.5" fill="#38bdf8" />
          <Circle cx="36" cy="34" r="1.5" fill="#38bdf8" />
          <Circle cx="64" cy="34" r="1.5" fill="#38bdf8" />
          <Circle cx="50" cy="80" r="1.5" fill="#38bdf8" />
          <Circle cx="36" cy="66" r="1.5" fill="#38bdf8" />
          <Circle cx="64" cy="66" r="1.5" fill="#38bdf8" />
        </G>

        {/* QR Locator Matrix (Top-Left) */}
        <G>
          <Rect
            x="18"
            y="18"
            width="20"
            height="20"
            rx="5"
            stroke="#00F0FF"
            strokeWidth="2.5"
            fill="none"
          />
          <Rect
            x="24"
            y="24"
            width="8"
            height="8"
            rx="2"
            fill={`url(#${gradientId})`}
          />
        </G>

        {/* QR Locator Matrix (Top-Right) */}
        <G>
          <Rect
            x="62"
            y="18"
            width="20"
            height="20"
            rx="5"
            stroke="#38bdf8"
            strokeWidth="2.5"
            fill="none"
          />
          <Rect
            x="68"
            y="24"
            width="8"
            height="8"
            rx="2"
            fill="#38bdf8"
          />
        </G>

        {/* QR Locator Matrix (Bottom-Left) */}
        <G>
          <Rect
            x="18"
            y="62"
            width="20"
            height="20"
            rx="5"
            stroke="#38bdf8"
            strokeWidth="2.5"
            fill="none"
          />
          <Rect
            x="24"
            y="68"
            width="8"
            height="8"
            rx="2"
            fill="#38bdf8"
          />
        </G>

        {/* Data Sync Node (Bottom-Right Matrix Accent) */}
        <G>
          <Rect x="64" y="64" width="7" height="7" rx="2" fill="#6366f1" />
          <Rect x="75" y="64" width="7" height="7" rx="2" fill="#38bdf8" />
          <Rect x="64" y="75" width="7" height="7" rx="2" fill="#00F0FF" />
          <Circle cx="78" cy="78" r="3.5" fill="#a855f7" />
        </G>

        {/* Central Core: High-Tech Code Chevrons `< / >` + Energy Spark Bridge */}
        <G>
          {/* Left Code Chevron '<' */}
          <Path
            d="M40 42L33 50L40 58"
            stroke="#00F0FF"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Right Code Chevron '>' */}
          <Path
            d="M60 42L67 50L60 58"
            stroke="#6366f1"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Central Energy Slash / Lightning Bridge '/' */}
          <Path
            d="M54 39L46 61"
            stroke={`url(#${gradientId})`}
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Glowing Neural Node in Core Center */}
          <Circle cx="50" cy="50" r="3.5" fill="#ffffff" />
          <Circle cx="50" cy="50" r="1.5" fill="#00F0FF" />
        </G>

        {/* Dynamic LAN Bridge Connection Wave (Top & Bottom) */}
        <Path
          d="M42 28H58"
          stroke="#0284c7"
          strokeWidth="2"
          strokeDasharray="2 3"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
};

export interface DevQRLogoProps {
  variant?: 'full' | 'icon' | 'horizontal' | 'badge';
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  theme?: 'light' | 'dark';
  style?: ViewStyle;
}

/**
 * Universal Brand Logo Component for DevQR
 */
export const DevQRLogo: React.FC<DevQRLogoProps> = ({
  variant = 'full',
  size = 'md',
  theme = 'light',
  style,
}) => {
  // Resolve icon pixel dimensions
  let iconSize = 48;
  if (typeof size === 'number') {
    iconSize = size;
  } else {
    switch (size) {
      case 'sm':
        iconSize = 32;
        break;
      case 'md':
        iconSize = 52;
        break;
      case 'lg':
        iconSize = 72;
        break;
      case 'xl':
        iconSize = 96;
        break;
    }
  }

  const isDark = theme === 'dark';

  if (variant === 'icon') {
    return <DevQRLogoMark size={iconSize} style={style} />;
  }

  if (variant === 'badge') {
    return (
      <View style={[styles.badgeContainer, style]}>
        <DevQRLogoMark size={24} glow={false} />
        <Text style={styles.badgeText}>
          DEV<Text style={styles.badgeHighlight}>QR</Text>
        </Text>
      </View>
    );
  }

  if (variant === 'horizontal') {
    return (
      <View style={[styles.horizontalContainer, style]}>
        <DevQRLogoMark size={iconSize} />
        <View style={styles.horizontalTextWrapper}>
          <View style={styles.titleRow}>
            <Text style={[styles.titleDev, isDark && styles.titleDevDark]}>
              DEV
            </Text>
            <Text style={styles.titleQR}>QR</Text>
            <View style={styles.liveDot} />
          </View>
          <Text style={[styles.horizontalSubtitle, isDark && styles.subtitleDark]}>
            Portable AI Debugging
          </Text>
        </View>
      </View>
    );
  }

  // Full Hero Lockup (Default)
  return (
    <View style={[styles.fullContainer, style]}>
      <DevQRLogoMark size={iconSize} />
      <View style={styles.fullTextWrapper}>
        <View style={styles.titleRow}>
          <Text style={[styles.heroDev, isDark && styles.titleDevDark]}>
            DEV
          </Text>
          <Text style={styles.heroQR}>QR</Text>
        </View>
        <Text style={[styles.heroSubtitle, isDark && styles.subtitleDark]}>
          Laptop Errors. Phone Intelligence.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  markWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  fullTextWrapper: {
    alignItems: 'center',
    marginTop: 12,
  },
  horizontalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  horizontalTextWrapper: {
    marginLeft: 14,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heroDev: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.8,
  },
  heroQR: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0284c7',
    letterSpacing: -0.8,
    marginLeft: 1,
  },
  titleDev: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  titleDevDark: {
    color: '#f8fafc',
  },
  titleQR: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0284c7',
    letterSpacing: -0.5,
    marginLeft: 1,
  },
  heroSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    letterSpacing: 0.2,
    marginTop: 4,
  },
  horizontalSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 1,
  },
  subtitleDark: {
    color: '#94a3b8',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#f8fafc',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  badgeHighlight: {
    color: '#38bdf8',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginLeft: 6,
    marginBottom: 4,
  },
});
