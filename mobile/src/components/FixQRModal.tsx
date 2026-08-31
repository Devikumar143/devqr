import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { ShieldCheckIcon, CloseIcon, TerminalIcon, CopyIcon } from './SvgIcons';
import { FixPatch } from '../types';
import { PatchCompressor } from '../services/patchCompressor';

interface FixQRModalProps {
  visible: boolean;
  patch: FixPatch;
  onClose: () => void;
}

export const FixQRModal: React.FC<FixQRModalProps> = ({ visible, patch, onClose }) => {
  const [copied, setCopied] = useState(false);
  const payload = PatchCompressor.encodePatch(patch);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <View style={styles.badgeWrap}>
                <ShieldCheckIcon size={12} color="#0284c7" style={{ marginRight: 4 }} />
                <Text style={styles.badge}>REVERSE FIX TRANSFER</Text>
              </View>
              <Text style={styles.title}>Apply Fix on Laptop</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
              <CloseIcon size={18} color="#0f172a" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* Instruction Card */}
            <View style={styles.instructCard}>
              <Text style={styles.stepNum}>1. On your laptop terminal, run:</Text>
              <View style={styles.cmdBox}>
                <TerminalIcon size={14} color="#38bdf8" style={{ marginRight: 6 }} />
                <Text style={styles.cmdText}>devqr apply</Text>
              </View>

              <Text style={styles.stepNum}>2. Paste the payload below or enter it:</Text>
            </View>

            {/* Target File Info */}
            <View style={styles.fileCard}>
              <Text style={styles.fileLabel}>Target File:</Text>
              <Text style={styles.fileName}>{patch.file}</Text>
              {patch.verification && (
                <Text style={styles.verifyCmd}>Verification: {patch.verification}</Text>
              )}
            </View>

            {/* Payload Box with 1-Click Copy */}
            <View style={styles.payloadCard}>
              <View style={styles.payloadHeader}>
                <Text style={styles.payloadTitle}>FIX PAYLOAD STRING</Text>
                <TouchableOpacity onPress={handleCopy} style={styles.copyBtn} activeOpacity={0.8}>
                  <CopyIcon size={13} color="#ffffff" style={{ marginRight: 4 }} />
                  <Text style={styles.copyBtnText}>{copied ? '✓ Copied' : 'Copy Payload'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.payloadText} numberOfLines={3} selectable>
                {payload}
              </Text>
            </View>

            <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.doneBtnText}>Close</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 30
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  badgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4
  },
  badge: {
    color: '#0284c7',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  title: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800'
  },
  closeBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9'
  },
  body: {
    paddingHorizontal: 20
  },
  bodyContent: {
    paddingTop: 16,
    paddingBottom: 20
  },
  instructCard: {
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14
  },
  stepNum: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6
  },
  cmdBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12
  },
  cmdText: {
    color: '#38bdf8',
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: 'bold'
  },
  fileCard: {
    backgroundColor: '#f0fdf4',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 14
  },
  fileLabel: {
    color: '#166534',
    fontSize: 11,
    fontWeight: 'bold'
  },
  fileName: {
    color: '#0f172a',
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    marginTop: 2
  },
  verifyCmd: {
    color: '#0284c7',
    fontSize: 11,
    marginTop: 4,
    fontFamily: 'monospace'
  },
  payloadCard: {
    backgroundColor: '#0f172a',
    padding: 14,
    borderRadius: 14,
    marginBottom: 20
  },
  payloadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  payloadTitle: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.8
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6
  },
  copyBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold'
  },
  payloadText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16
  },
  doneBtn: {
    backgroundColor: '#0284c7',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center'
  },
  doneBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold'
  }
});
