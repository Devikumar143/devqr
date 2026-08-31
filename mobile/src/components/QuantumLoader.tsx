import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { SparklesIcon, ChipIcon, CheckCircleIcon, FlashIcon } from './SvgIcons';

interface QuantumLoaderProps {
  title?: string;
  subtitle?: string;
  steps?: string[];
  currentStepIndex?: number;
}

export const QuantumLoader: React.FC<QuantumLoaderProps> = ({
  title = 'AI DIAGNOSTIC ENGINE',
  subtitle = 'Synthesizing surgical repair & AST blueprint...',
  steps = [
    'Direct Wi-Fi Bridge Handshake',
    'AST Parsing & Context Extraction',
    'Zero-Cloud Secret Sanitization',
    'Neural Code Synthesis & Verification'
  ],
  currentStepIndex = 2
}) => {
  // Animation Values
  const spinVal = useRef(new Animated.Value(0)).current;
  const reverseSpinVal = useRef(new Animated.Value(0)).current;
  const pulseVal = useRef(new Animated.Value(1)).current;
  const radarSweepVal = useRef(new Animated.Value(0)).current;
  const glowVal = useRef(new Animated.Value(0.4)).current;
  const [percent, setPercent] = useState(25);

  useEffect(() => {
    // 1. Continuous forward rotation
    Animated.loop(
      Animated.timing(spinVal, {
        toValue: 1,
        duration: 3500,
        easing: Easing.linear,
        useNativeDriver: true
      })
    ).start();

    // 2. Continuous reverse rotation
    Animated.loop(
      Animated.timing(reverseSpinVal, {
        toValue: 1,
        duration: 4500,
        easing: Easing.linear,
        useNativeDriver: true
      })
    ).start();

    // 3. Pulsing core glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseVal, {
          toValue: 1.15,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(pulseVal, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    ).start();

    // 4. Radar sweep
    Animated.loop(
      Animated.timing(radarSweepVal, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: true
      })
    ).start();

    // 5. Glow flicker
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowVal, {
          toValue: 0.7,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(glowVal, {
          toValue: 0.3,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    ).start();

    // 6. Smooth progress simulation
    const interval = setInterval(() => {
      setPercent(prev => {
        if (prev < 92) return prev + Math.floor(Math.random() * 8) + 3;
        return prev;
      });
    }, 450);

    return () => clearInterval(interval);
  }, []);

  const spin = spinVal.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const reverseSpin = reverseSpinVal.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg']
  });

  const radarRotate = radarSweepVal.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <View style={styles.container}>
      {/* Quantum Core Reactor Graphic (Light Theme) */}
      <View style={styles.reactorContainer}>
        {/* Outer Pulsing Aura Ring */}
        <Animated.View
          style={[
            styles.outerAura,
            {
              transform: [{ scale: pulseVal }],
              opacity: glowVal
            }
          ]}
        />

        {/* Outer Hexagon Orbit Ring */}
        <Animated.View
          style={[
            styles.outerOrbit,
            {
              transform: [{ rotate: spin }]
            }
          ]}
        >
          {/* Orbiting Satellite Nodes */}
          <View style={[styles.satelliteNode, { top: -5, left: '50%', marginLeft: -5 }]} />
          <View style={[styles.satelliteNode, { bottom: -5, left: '50%', marginLeft: -5 }]} />
          <View style={[styles.satelliteNode, { left: -5, top: '50%', marginTop: -5 }]} />
          <View style={[styles.satelliteNode, { right: -5, top: '50%', marginTop: -5 }]} />
        </Animated.View>

        {/* Inner Counter-Rotating Concentric Ring */}
        <Animated.View
          style={[
            styles.innerOrbit,
            {
              transform: [{ rotate: reverseSpin }]
            }
          ]}
        >
          <View style={[styles.miniNode, { top: '25%', left: -3 }]} />
          <View style={[styles.miniNode, { bottom: '25%', right: -3 }]} />
        </Animated.View>

        {/* 360-Degree Radar Scanner Sweep */}
        <Animated.View
          style={[
            styles.radarBeam,
            {
              transform: [{ rotate: radarRotate }]
            }
          ]}
        />

        {/* Central Luminous Core */}
        <View style={styles.centerCore}>
          <ChipIcon size={30} color="#ffffff" />
        </View>
      </View>

      {/* Title & Phase */}
      <Text style={styles.titleText}>{title}</Text>
      <View style={styles.badgeRow}>
        <FlashIcon size={12} color="#0284c7" style={{ marginRight: 5 }} />
        <Text style={styles.subtitleText}>{subtitle}</Text>
      </View>

      {/* Progress Bar with Live Telemetry */}
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>SYNTHESIS TELEMETRY</Text>
          <Text style={styles.progressPercent}>{percent}%</Text>
        </View>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
        </View>
      </View>

      {/* Diagnostic Steps Checklist */}
      <View style={styles.stepsCard}>
        {steps.map((step, idx) => {
          const isDone = idx < currentStepIndex;
          const isCurrent = idx === currentStepIndex;

          return (
            <View key={idx} style={styles.stepRow}>
              {isDone ? (
                <CheckCircleIcon size={15} color="#16a34a" style={{ marginRight: 10 }} />
              ) : isCurrent ? (
                <SparklesIcon size={15} color="#0284c7" style={{ marginRight: 10 }} />
              ) : (
                <View style={styles.pendingDot} />
              )}
              <Text
                style={[
                  styles.stepText,
                  isDone && styles.stepTextDone,
                  isCurrent && styles.stepTextCurrent
                ]}
              >
                {step}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  reactorContainer: {
    width: 170,
    height: 170,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative'
  },
  outerAura: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 24
  },
  outerOrbit: {
    position: 'absolute',
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 1.5,
    borderColor: '#bae6fd',
    borderStyle: 'dashed'
  },
  satelliteNode: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0284c7',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 2
  },
  innerOrbit: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1.5,
    borderColor: '#7dd3fc',
    opacity: 0.9
  },
  miniNode: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0284c7'
  },
  radarBeam: {
    position: 'absolute',
    width: 70,
    height: 2,
    backgroundColor: 'rgba(2, 132, 199, 0.45)',
    left: '50%',
    top: '50%',
    transformOrigin: 'left center'
  },
  centerCore: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#0284c7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#ffffff'
  },

  titleText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 6,
    textAlign: 'center'
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 20
  },
  subtitleText: {
    color: '#0369a1',
    fontSize: 11,
    fontWeight: '700'
  },

  progressContainer: {
    width: '100%',
    maxWidth: 320,
    marginBottom: 16
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  progressLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8
  },
  progressPercent: {
    color: '#0284c7',
    fontSize: 11,
    fontWeight: '900',
    fontFamily: 'monospace'
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0284c7',
    borderRadius: 3
  },

  stepsCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
    marginRight: 19,
    marginLeft: 4
  },
  stepText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600'
  },
  stepTextDone: {
    color: '#475569',
    fontWeight: '600'
  },
  stepTextCurrent: {
    color: '#0f172a',
    fontWeight: '800'
  }
});
