import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { ShieldCheckIcon, BugIcon, CloseIcon } from './SvgIcons';

export interface BottomAlertProps {
  visible: boolean;
  type?: 'error' | 'success' | 'info';
  title: string;
  message: string;
  actionText?: string;
  onAction?: () => void;
  onClose: () => void;
}

const { height } = Dimensions.get('window');

export const BottomAlert: React.FC<BottomAlertProps> = ({
  visible,
  type = 'info',
  title,
  message,
  actionText,
  onAction,
  onClose
}) => {
  const slideAnim = useRef(new Animated.Value(150)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 150,
          duration: 200,
          useNativeDriver: true
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true
        })
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const isError = type === 'error';
  const isSuccess = type === 'success';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim
        }
      ]}
    >
      <View style={[styles.card, isError ? styles.errorCard : isSuccess ? styles.successCard : styles.infoCard]}>
        <View style={styles.iconWrap}>
          {isError ? (
            <BugIcon size={20} color="#dc2626" />
          ) : (
            <ShieldCheckIcon size={20} color={isSuccess ? '#16a34a' : '#0284c7'} />
          )}
        </View>

        <View style={styles.textWrap}>
          <Text style={[styles.title, isError ? styles.errorTitle : styles.infoTitle]}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
        </View>

        <View style={styles.btnRow}>
          {actionText && onAction && (
            <TouchableOpacity style={styles.actionBtn} onPress={onAction} activeOpacity={0.8}>
              <Text style={styles.actionBtnText}>{actionText}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <CloseIcon size={16} color="#64748b" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 25,
    left: 15,
    right: 15,
    zIndex: 100
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6
  },
  errorCard: {
    borderColor: '#fecaca',
    backgroundColor: '#fff5f5'
  },
  successCard: {
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4'
  },
  infoCard: {
    borderColor: '#bae6fd',
    backgroundColor: '#f0f9ff'
  },
  iconWrap: {
    marginRight: 12
  },
  textWrap: {
    flex: 1,
    marginRight: 8
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2
  },
  errorTitle: {
    color: '#dc2626'
  },
  infoTitle: {
    color: '#0f172a'
  },
  message: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  actionBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9'
  }
});
