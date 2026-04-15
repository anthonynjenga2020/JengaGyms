import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme';

type Props = {
  label: string;
  value: string | number;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  subtitle?: string;
};

export function MetricCard({ label, value, icon, color, subtitle }: Props) {
  return (
    <View style={[styles.card, { borderTopColor: color }]}>
      <View style={[styles.iconBox, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1A2533',
    borderRadius: 12,
    padding: 14,
    borderTopWidth: 2.5,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  iconBox: {
    width: 34, height: 34, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 2,
  },
  value: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 32,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  subtitle: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
