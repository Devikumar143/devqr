import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SparklesIcon, CloudIcon, ChipIcon, ShieldCheckIcon } from '../src/components/SvgIcons';
import { DevQRLogo } from '../src/components/DevQRLogo';
import { MobileSecureStore } from '../src/services/secureStore';

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'welcome' | 'engine' | 'setup'>('welcome');
  const [apiKey, setApiKey] = useState('');

  const handleFinish = async () => {
    await MobileSecureStore.saveSettings({
      aiProvider: 'openai',
      onboardingCompleted: true
    });
    if (apiKey.trim()) {
      await MobileSecureStore.saveApiKey('openai', apiKey);
    }
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      {step === 'welcome' && (
        <View style={styles.content}>
          <View style={styles.badgeWrapper}>
            <SparklesIcon size={12} color="#0284c7" style={{ marginRight: 4 }} />
            <Text style={styles.badge}>PORTABLE AI DEBUGGING</Text>
          </View>

          <DevQRLogo size={76} style={{ marginVertical: 14 }} />

          <Text style={styles.desc}>
            Turn debugging context into actionable solutions on your phone. No DevQR backend required. Your debugging session belongs to you.
          </Text>

          <TouchableOpacity style={styles.btn} onPress={() => setStep('engine')} activeOpacity={0.85}>
            <Text style={styles.btnText}>GET STARTED</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'engine' && (
        <View style={styles.content}>
          <Text style={styles.stepTitle}>CHOOSE AI ENGINE</Text>
          <Text style={styles.stepSub}>Select how DevQR processes your debugging bundles</Text>

          <TouchableOpacity style={styles.cardSelect} onPress={() => setStep('setup')} activeOpacity={0.85}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.engineTitleWrap}>
                <CloudIcon size={20} color="#0284c7" style={{ marginRight: 8 }} />
                <Text style={styles.cardSelectTitle}>Cloud AI</Text>
              </View>
              <Text style={styles.recommendedBadge}>Recommended</Text>
            </View>
            <Text style={styles.cardSelectSub}>
              Use your own OpenAI / Google Gemini key directly from your device. Zero middleman server.
            </Text>
          </TouchableOpacity>

          <View style={styles.cardDisabled}>
            <View style={styles.engineTitleWrap}>
              <ChipIcon size={20} color="#64748b" style={{ marginRight: 8 }} />
              <Text style={styles.cardDisabledTitle}>Local AI</Text>
            </View>
            <Text style={styles.cardDisabledSub}>On-Device NPU / Local LLM (Coming soon)</Text>
          </View>

          <TouchableOpacity style={styles.btn} onPress={() => setStep('setup')} activeOpacity={0.85}>
            <Text style={styles.btnText}>CONTINUE</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'setup' && (
        <View style={styles.content}>
          <Text style={styles.stepTitle}>CLOUD AI SETUP</Text>
          <Text style={styles.stepSub}>Direct provider integration from device</Text>

          <View style={styles.setupCard}>
            <Text style={styles.label}>Provider: OpenAI / Google Gemini (Direct API)</Text>
            <Text style={styles.label}>API Key (Optional / Can add in Settings):</Text>
            <TextInput
              style={styles.input}
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry
              placeholder="sk-... or AIzaSy..."
              placeholderTextColor="#94a3b8"
            />
            <View style={styles.secureBadgeWrap}>
              <ShieldCheckIcon size={14} color="#16a34a" style={{ marginRight: 6 }} />
              <Text style={styles.secureBadge}>Stored securely in iOS Keychain / Android KeyStore</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.btn} onPress={handleFinish} activeOpacity={0.85}>
            <Text style={styles.btnText}>START DEBUGGING</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 25, justifyContent: 'center' },
  content: { alignItems: 'center' },
  badgeWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e0f2fe', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: 12 },
  badge: { color: '#0284c7', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  title: { color: '#0f172a', fontSize: 36, fontWeight: '900', marginBottom: 6, letterSpacing: 1 },
  titleHighlight: { color: '#0284c7' },
  subtitle: { color: '#0284c7', fontSize: 15, fontWeight: '700', marginBottom: 15 },
  desc: { color: '#64748b', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 32 },

  stepTitle: { color: '#0f172a', fontSize: 24, fontWeight: '800', marginBottom: 6, letterSpacing: 0.5 },
  stepSub: { color: '#64748b', fontSize: 13, textAlign: 'center', marginBottom: 24 },

  btn: { backgroundColor: '#0284c7', width: '100%', padding: 17, borderRadius: 14, alignItems: 'center', marginTop: 15, shadowColor: '#0284c7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 3 },
  btnText: { color: '#ffffff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },

  cardSelect: { width: '100%', backgroundColor: '#ffffff', padding: 18, borderRadius: 16, borderWidth: 2, borderColor: '#0284c7', marginBottom: 14, shadowColor: '#0284c7', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 1 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  engineTitleWrap: { flexDirection: 'row', alignItems: 'center' },
  cardSelectTitle: { color: '#0f172a', fontSize: 17, fontWeight: '800' },
  recommendedBadge: { color: '#16a34a', fontSize: 11, fontWeight: '700', backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  cardSelectSub: { color: '#64748b', fontSize: 13, lineHeight: 18 },

  cardDisabled: { width: '100%', backgroundColor: '#f1f5f9', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#cbd5e1', marginBottom: 20, opacity: 0.6 },
  cardDisabledTitle: { color: '#475569', fontSize: 17, fontWeight: '800' },
  cardDisabledSub: { color: '#94a3b8', fontSize: 13, marginTop: 4 },

  setupCard: { width: '100%', backgroundColor: '#ffffff', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 15 },
  label: { color: '#334155', fontSize: 13, fontWeight: '700', width: '100%', textAlign: 'left', marginBottom: 8 },
  input: { width: '100%', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 14, color: '#0f172a', fontSize: 13, marginBottom: 12 },
  secureBadgeWrap: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  secureBadge: { color: '#16a34a', fontSize: 12, fontWeight: '600' }
});
