import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import Svg, { Path, Line, Polyline, Circle } from 'react-native-svg';

export type ConfirmModalVariant = 'success' | 'error' | 'warning' | 'info';

export interface ConfirmModalButton {
  label: string;
  onPress: () => void;
  /** 'primary' = filled accent, 'secondary' = outlined, 'danger' = red-ish */
  style?: 'primary' | 'secondary' | 'danger';
}

interface ConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  variant?: ConfirmModalVariant;
  title: string;
  message: string;
  buttons?: ConfirmModalButton[];
}

// ─── Icon Components ────────────────────────────────────────
const SuccessIcon = ({ size = 48 }: { size?: number }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size,
      backgroundColor: 'rgba(46, 125, 50, 0.12)',
      justifyContent: 'center',
      alignItems: 'center',
    }}
  >
    <Svg
      width={size * 0.5}
      height={size * 0.5}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#2E7D32"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Polyline points="20 6 9 17 4 12" />
    </Svg>
  </View>
);

const ErrorIcon = ({ size = 48 }: { size?: number }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size,
      backgroundColor: 'rgba(211, 47, 47, 0.12)',
      justifyContent: 'center',
      alignItems: 'center',
    }}
  >
    <Svg
      width={size * 0.5}
      height={size * 0.5}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#D32F2F"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Line x1="18" y1="6" x2="6" y2="18" />
      <Line x1="6" y1="6" x2="18" y2="18" />
    </Svg>
  </View>
);

const WarningIcon = ({ size = 48 }: { size?: number }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size,
      backgroundColor: 'rgba(244, 163, 0, 0.12)',
      justifyContent: 'center',
      alignItems: 'center',
    }}
  >
    <Svg
      width={size * 0.5}
      height={size * 0.5}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#F4A300"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <Line x1="12" y1="9" x2="12" y2="13" />
      <Line x1="12" y1="17" x2="12.01" y2="17" />
    </Svg>
  </View>
);

const InfoIcon = ({ size = 48 }: { size?: number }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size,
      backgroundColor: 'rgba(65, 45, 21, 0.10)',
      justifyContent: 'center',
      alignItems: 'center',
    }}
  >
    <Svg
      width={size * 0.5}
      height={size * 0.5}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#412D15"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Circle cx="12" cy="12" r="10" />
      <Line x1="12" y1="16" x2="12" y2="12" />
      <Line x1="12" y1="8" x2="12.01" y2="8" />
    </Svg>
  </View>
);

const iconMap: Record<ConfirmModalVariant, React.FC<{ size?: number }>> = {
  success: SuccessIcon,
  error: ErrorIcon,
  warning: WarningIcon,
  info: InfoIcon,
};

const accentMap: Record<ConfirmModalVariant, string> = {
  success: '#2E7D32',
  error: '#D32F2F',
  warning: '#F4A300',
  info: '#412D15',
};

// ─── Main Component ─────────────────────────────────────────
export function ConfirmModal({
  visible,
  onClose,
  variant = 'success',
  title,
  message,
  buttons,
}: ConfirmModalProps) {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const IconComponent = iconMap[variant];
  const accent = accentMap[variant];

  // Default single "OK" button if none provided
  const resolvedButtons: ConfirmModalButton[] = buttons && buttons.length > 0
    ? buttons
    : [{ label: 'OK', onPress: onClose, style: 'primary' }];

  const getButtonStyles = (btnStyle?: 'primary' | 'secondary' | 'danger') => {
    switch (btnStyle) {
      case 'danger':
        return {
          bg: '#D32F2F',
          text: '#FFFFFF',
          border: '#D32F2F',
        };
      case 'secondary':
        return {
          bg: 'transparent',
          text: '#412D15',
          border: 'rgba(65, 45, 21, 0.25)',
        };
      case 'primary':
      default:
        return {
          bg: accent,
          text: '#FFFFFF',
          border: accent,
        };
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 32,
        }}
        onPress={onClose}
      >
        <Animated.View
          style={{
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
            width: '100%',
            maxWidth: 360,
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FAF8F3',
              borderRadius: 28,
              paddingTop: 32,
              paddingBottom: 24,
              paddingHorizontal: 24,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.15,
              shadowRadius: 24,
              elevation: 12,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.6)',
            }}
          >
            {/* Icon */}
            <IconComponent size={56} />

            {/* Title */}
            <Text
              style={{
                fontSize: 18,
                fontWeight: '800',
                color: '#1F150C',
                marginTop: 16,
                textAlign: 'center',
                letterSpacing: -0.3,
              }}
            >
              {title}
            </Text>

            {/* Message */}
            <Text
              style={{
                fontSize: 13,
                fontWeight: '500',
                color: '#666666',
                marginTop: 8,
                textAlign: 'center',
                lineHeight: 20,
                paddingHorizontal: 8,
              }}
            >
              {message}
            </Text>

            {/* Divider */}
            <View
              style={{
                width: '100%',
                height: 1,
                backgroundColor: 'rgba(65, 45, 21, 0.08)',
                marginTop: 20,
                marginBottom: 16,
              }}
            />

            {/* Buttons */}
            <View
              style={{
                flexDirection: resolvedButtons.length > 1 ? 'row' : 'column',
                gap: 10,
                width: '100%',
              }}
            >
              {resolvedButtons.map((btn, idx) => {
                const s = getButtonStyles(btn.style);
                return (
                  <Pressable
                    key={idx}
                    onPress={() => {
                      btn.onPress();
                    }}
                    style={({ pressed }) => ({
                      flex: resolvedButtons.length > 1 ? 1 : undefined,
                      height: 44,
                      borderRadius: 14,
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: s.bg,
                      borderWidth: 1.5,
                      borderColor: s.border,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: s.text,
                        letterSpacing: 0.2,
                      }}
                    >
                      {btn.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
