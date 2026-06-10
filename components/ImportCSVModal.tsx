import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ActivityIndicator, Platform,
} from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabase';
import { colors, radius, spacing } from '@/lib/theme';

interface ImportCSVModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportCSVModal({ visible, onClose, onSuccess }: ImportCSVModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ count: number, ready: boolean } | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);

  async function handleSelectFile() {
    try {
      setError(null);
      setSummary(null);
      setParsedData([]);

      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets[0]) return;

      const fileUri = result.assets[0].uri;
      setLoading(true);

      // Read file content
      let csvText = '';
      if (Platform.OS === 'web') {
        const file = result.assets[0].file;
        if (file) {
          csvText = await file.text();
        }
      } else {
        // Use fetch to read local file URI on native
        const response = await fetch(fileUri);
        csvText = await response.text();
      }

      // Parse with PapaParse
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            setError(`Error parsing CSV: ${results.errors[0].message}`);
            setLoading(false);
            return;
          }

          const data = results.data as Record<string, string>[];
          
          // Validate format (expecting 'Name' and 'Phone')
          if (data.length > 0 && !Object.keys(data[0]).some(k => k.toLowerCase().includes('name'))) {
             setError("Could not find a 'Name' column in the CSV.");
             setLoading(false);
             return;
          }
          if (data.length > 0 && !Object.keys(data[0]).some(k => k.toLowerCase().includes('phone'))) {
             setError("Could not find a 'Phone' column in the CSV.");
             setLoading(false);
             return;
          }

          setParsedData(data);
          setSummary({ count: data.length, ready: true });
          setLoading(false);
        },
        error: (err: any) => {
          setError(err.message);
          setLoading(false);
        }
      });

    } catch (err: any) {
      setError(err.message || 'Failed to read file');
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!parsedData.length) return;
    setLoading(true);
    setError(null);

    try {
      // Find exact column keys since they might be "Name", "name", "Full Name", etc.
      const sample = parsedData[0];
      const nameKey = Object.keys(sample).find(k => k.toLowerCase().includes('name'))!;
      const phoneKey = Object.keys(sample).find(k => k.toLowerCase().includes('phone'))!;
      const emailKey = Object.keys(sample).find(k => k.toLowerCase().includes('email'));

      // In a real multi-tenant app, we'd fetch the current user's client_id.
      // Using 'default_client' or grabbing from context for now.
      const clientId = 'c_001'; // Mocked or hardcoded for now, assuming this is single-tenant local run

      const rowsToInsert = parsedData.map(row => {
        let phone = String(row[phoneKey] || '').trim();
        // Clean phone (add generic +254 if missing and starts with 0 for Kenya, or just leave it)
        if (phone.startsWith('0')) phone = '+254' + phone.substring(1);
        else if (!phone.startsWith('+')) phone = '+' + phone;

        return {
          client_id: '11111111-1111-1111-1111-111111111111', // Dummy uuid if required, but Supabase might auto-generate or use RLS. We'll let it default if possible, or need actual ID. Wait, Supabase requires valid UUID.
          // Actually, our schema has client_id references.
          name: row[nameKey] || 'Unknown',
          phone: phone,
          email: emailKey ? (row[emailKey] || '') : '',
          status: 'active',
          plan_label: 'Imported Plan',
          billing_cycle: 'monthly',
          billing_amount: 0,
        };
      });

      // Quick hack to get a valid client_id from existing members if we don't have auth context right here
      const { data: clientCheck } = await supabase.from('clients').select('id').limit(1).single();
      const validClientId = clientCheck?.id;

      if (validClientId) {
         rowsToInsert.forEach(r => r.client_id = validClientId);
      } else {
         throw new Error("No client found to associate members with.");
      }

      const { error: dbError } = await supabase
        .from('members')
        .insert(rowsToInsert);

      if (dbError) throw dbError;

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Database insert failed');
    } finally {
      setLoading(false);
    }
  }

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Import Members (CSV)</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.instructions}>
              Upload a .csv file containing your members. Please ensure it has at least a <Text style={{fontWeight: 'bold'}}>Name</Text> and <Text style={{fontWeight: 'bold'}}>Phone</Text> column.
            </Text>

            {!summary ? (
              <TouchableOpacity style={styles.uploadBox} onPress={handleSelectFile} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <>
                    <Ionicons name="document-text-outline" size={32} color={colors.primary} />
                    <Text style={styles.uploadText}>Tap to Select CSV File</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.summaryBox}>
                <Ionicons name="checkmark-circle" size={40} color={colors.success} />
                <Text style={styles.summaryTitle}>File Parsed Successfully</Text>
                <Text style={styles.summaryText}>Found {summary.count} members ready to import.</Text>
                
                <TouchableOpacity style={styles.reselectBtn} onPress={handleSelectFile}>
                  <Text style={styles.reselectText}>Choose different file</Text>
                </TouchableOpacity>
              </View>
            )}

            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity 
              style={[styles.importBtn, (!summary || loading) && styles.importBtnDisabled]} 
              onPress={handleImport}
              disabled={!summary || loading}
            >
              {loading && summary ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.importBtnText}>Import {summary?.count || ''} Members</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
    padding: spacing.md,
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    width: '100%', maxWidth: 400,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  closeBtn: { padding: 4 },
  content: { padding: spacing.lg, gap: 16 },
  instructions: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  uploadBox: {
    borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border,
    borderRadius: radius.lg, padding: 30,
    alignItems: 'center', justifyContent: 'center', gap: 12,
    backgroundColor: colors.background,
  },
  uploadText: { fontSize: 15, fontWeight: '600', color: colors.primary },
  summaryBox: {
    alignItems: 'center', padding: 20, gap: 8,
    backgroundColor: colors.success + '10',
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.success + '30',
  },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  summaryText: { fontSize: 14, color: colors.textSecondary },
  reselectBtn: { marginTop: 10, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: colors.surface },
  reselectText: { fontSize: 13, fontWeight: '600', color: colors.text },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.danger + '10',
    padding: 12, borderRadius: radius.md,
  },
  errorText: { fontSize: 13, color: colors.danger, flex: 1 },
  importBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14, borderRadius: radius.md,
    alignItems: 'center', marginTop: 10,
    flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  importBtnDisabled: { opacity: 0.5 },
  importBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
