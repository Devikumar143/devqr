import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { CameraIcon, FlashIcon, CloseIcon, ScanIcon } from '../src/components/SvgIcons';
import { BottomAlert } from '../src/components/BottomAlert';
import { QRDecoder } from '../src/services/qrDecoder';
import { SQLiteSessionStorage } from '../src/services/sqliteStorage';

export default function ScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [alertState, setAlertState] = useState<{
    visible: boolean;
    type?: 'error' | 'success' | 'info';
    title: string;
    message: string;
  }>({
    visible: false,
    title: '',
    message: ''
  });
  const cameraRef = useRef<any>(null);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, []);

  const processPayload = async (data: string) => {
    if (scanned || isProcessing) return;
    setIsProcessing(true);
    setScanned(true);

    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    const result = QRDecoder.decode(data);
    if (result.error) {
      setIsProcessing(false);
      setAlertState({
        visible: true,
        type: 'error',
        title: 'Scan Error',
        message: result.error
      });
      return;
    }

    if (result.isTerminal || (result.bundle as any)?.mode === 'terminal' || data.startsWith('devqr://t/')) {
      router.replace({
        pathname: '/terminal',
        params: {
          payload: data
        }
      });
      return;
    }

    if (result.isGenerator || (result.bundle as any)?.mode === 'generator' || data.startsWith('devqr://g/')) {
      router.replace({
        pathname: '/generator',
        params: {
          payload: data
        }
      });
      return;
    }

    if (result.isArchitecture || (result.bundle as any)?.mode === 'architecture' || data.startsWith('devqr://a/')) {
      router.replace({
        pathname: '/arch',
        params: {
          payload: data
        }
      });
      return;
    }

    if (result.bundle) {
      await SQLiteSessionStorage.saveSession(result.bundle as import('../src/types').DebugBundle);
      router.replace({
        pathname: '/result',
        params: {
          bundleJson: JSON.stringify(result.bundle),
          sessionId: `${result.bundle.sessionId}-${Date.now()}`
        }
      });
    }
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    processPayload(data);
  };

  const handleManualCapture = async () => {
    if (scanned || isProcessing) return;
    setIsProcessing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    setTimeout(() => {
      if (!scanned) {
        setIsProcessing(false);
        setAlertState({
          visible: true,
          type: 'info',
          title: 'Scanning for QR Code',
          message: 'Position your phone camera over the DevQR code displayed in your terminal or on screen.'
        });
      }
    }, 1000);
  };

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <CameraIcon size={48} color="#0284c7" style={{ marginBottom: 12 }} />
        <Text style={styles.text}>Camera permission required to scan DevQR codes.</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Camera Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: ['qr']
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      {/* Top Header Controls */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <CloseIcon size={20} color="#ffffff" />
        </TouchableOpacity>

        <Text style={styles.scannerTitle}>DEVQR SCANNER</Text>

        <TouchableOpacity style={styles.headerBtn} onPress={() => setTorch(!torch)}>
          <FlashIcon size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Center Reticle Focus Target */}
      <View style={styles.centerArea}>
        <View style={styles.reticle}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
          {isProcessing && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#0284c7" />
              <Text style={styles.processingText}>Decoding bundle...</Text>
            </View>
          )}
        </View>
        <Text style={styles.reticleHint}>Align DevQR terminal code within the frame</Text>
      </View>

      {/* Bottom Controls with CAPTURE Button */}
      <View style={styles.bottomArea}>
        <View style={styles.captureRow}>
          <TouchableOpacity
            style={styles.captureOuter}
            onPress={handleManualCapture}
            activeOpacity={0.8}
          >
            <View style={styles.captureInner}>
              <ScanIcon size={32} color="#ffffff" />
            </View>
          </TouchableOpacity>
        </View>
        <Text style={styles.captureLabel}>TAP TO SCAN</Text>
      </View>

      {/* Bottom Alert Banner */}
      <BottomAlert
        visible={alertState.visible}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        onClose={() => setAlertState({ ...alertState, visible: false })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', padding: 20 },
  text: { color: '#0f172a', textAlign: 'center', marginBottom: 20, fontSize: 14 },
  permissionButton: { backgroundColor: '#0284c7', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  permissionButtonText: { color: '#ffffff', fontWeight: 'bold' },

  topHeader: {
    paddingTop: 50,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10
  },
  headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  scannerTitle: { color: '#ffffff', fontSize: 14, fontWeight: 'bold', letterSpacing: 1.5 },

  centerArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  reticle: {
    width: 270,
    height: 270,
    position: 'relative',
    backgroundColor: 'rgba(2, 132, 199, 0.04)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: '#0284c7' },
  topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 10 },
  topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 10 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 10 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 10 },
  reticleHint: { color: 'rgba(255, 255, 255, 0.8)', fontSize: 12, marginTop: 15, fontWeight: '500' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', borderRadius: 10 },
  processingText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold', marginTop: 8 },

  bottomArea: { paddingBottom: 45, alignItems: 'center' },
  captureRow: { alignItems: 'center', justifyContent: 'center' },
  captureOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)'
  },
  captureInner: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
    backgroundColor: '#0284c7',
    justifyContent: 'center',
    alignItems: 'center'
  },
  captureLabel: { color: '#ffffff', fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5, marginTop: 8 }
});
