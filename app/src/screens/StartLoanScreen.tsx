import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/nav';
import { loadState } from '../storage/store';
import { newId } from '../lib/id';

// v1 payload (owner -> borrower)
// { v:1, kind:"loan", loanId, toolId, ownerName, dueAt? }

type Props = NativeStackScreenProps<RootStackParamList, 'StartLoan'>;

export function StartLoanScreen({ route }: Props) {
  const { toolId } = route.params;
  const [qr, setQr] = React.useState<string | null>(null);

  async function buildPayload(dueAt?: string) {
    const state = await loadState();
    const tool = state.tools.find((t) => t.id === toolId);
    if (!tool) {
      Alert.alert('Tool not found');
      return;
    }
    if (tool.currentLoanId) {
      Alert.alert('Already loaned out');
      return;
    }

    const loanId = await newId('loan');
    const payload = {
      v: 1,
      kind: 'loan',
      loanId,
      toolId: tool.id,
      ownerName: state.myName || tool.ownerName || 'Me',
      dueAt,
    };

    // We only create the Loan record after borrower confirms.
    // For now, we embed all info in QR.
    setQr(JSON.stringify(payload));
  }

  React.useEffect(() => {
    void buildPayload();
  }, [toolId]);

  async function preset(days: number) {
    const due = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    await buildPayload(due);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Start loan</Text>
      <Text style={styles.sub}>Borrower scans this QR, then taps Confirm.</Text>

      <View style={styles.qrBox}>
        {qr ? (
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontWeight: '800' }}>QR ready</Text>
        ) : (
          <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Generating…</Text>
        )}
        {/* Expo doesn’t include a QR renderer by default.
            Next step: add a QR render component so the owner can show a scannable QR. */}
      </View>

      <Text style={styles.payloadLabel}>QR payload (temporary)</Text>
      <View style={styles.payloadBox}>
        <Text style={styles.payloadText} numberOfLines={6}>
          {qr ?? ''}
        </Text>
      </View>

      <Text style={styles.presetsTitle}>Due date presets (optional)</Text>
      <View style={styles.presetRow}>
        <Pressable style={styles.presetBtn} onPress={() => preset(1)}>
          <Text style={styles.presetText}>1 day</Text>
        </Pressable>
        <Pressable style={styles.presetBtn} onPress={() => preset(3)}>
          <Text style={styles.presetText}>Weekend</Text>
        </Pressable>
        <Pressable style={styles.presetBtn} onPress={() => preset(7)}>
          <Text style={styles.presetText}>1 week</Text>
        </Pressable>
      </View>

      <Text style={styles.note}>Next: replace payload display with an actual QR renderer and store pending loan state.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0d12', paddingTop: 64, paddingHorizontal: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 6 },
  sub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 16 },
  qrBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: 14,
  },
  payloadLabel: { marginTop: 14, color: 'rgba(255,255,255,0.65)', fontSize: 12 },
  payloadBox: {
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 12,
  },
  payloadText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontFamily: 'System' },
  presetsTitle: { marginTop: 14, color: '#fff', fontSize: 14, fontWeight: '800' },
  presetRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  presetBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  presetText: { color: 'rgba(255,255,255,0.9)', fontWeight: '800' },
  note: { marginTop: 14, color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 18 },
});
