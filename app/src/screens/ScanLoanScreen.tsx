import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/nav';
import { addLoan, addTool, loadState, updateTool } from '../storage/store';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanLoan'>;

type LoanPayload = {
  v: 1;
  kind: 'loan';
  loanId: string;
  toolId: string;
  toolName?: string;
  ownerName: string;
  dueAt?: string;
};

export function ScanLoanScreen({ navigation }: Props) {
  const [perm, setPerm] = React.useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [payload, setPayload] = React.useState<LoanPayload | null>(null);

  React.useEffect(() => {
    void (async () => {
      const res = await BarCodeScanner.requestPermissionsAsync();
      setPerm(res.status === 'granted' ? 'granted' : 'denied');
    })();
  }, []);

  async function onConfirm() {
    if (!payload) return;
    const state = await loadState();
    let tool = state.tools.find((t) => t.id === payload.toolId);
    if (!tool) {
      // Option A: auto-create tool locally so the flow works on a fresh phone.
      await addTool({
        id: payload.toolId,
        name: payload.toolName || 'Imported tool',
        ownerName: payload.ownerName,
        createdAt: new Date().toISOString(),
      });
      const nextState = await loadState();
      tool = nextState.tools.find((t) => t.id === payload.toolId);
    }

    if (!tool) {
      Alert.alert('Could not import tool', 'Please try scanning again.');
      navigation.goBack();
      return;
    }
    if (tool.currentLoanId) {
      Alert.alert('Already loaned out');
      navigation.goBack();
      return;
    }

    const borrowerName = state.myName || 'Me';

    await addLoan({
      id: payload.loanId,
      toolId: payload.toolId,
      ownerName: payload.ownerName,
      borrowerName,
      startedAt: new Date().toISOString(),
      dueAt: payload.dueAt,
    });

    await updateTool({ ...tool, currentLoanId: payload.loanId });

    Alert.alert('Loan confirmed', `${tool.name} is now marked as loaned out.`);
    navigation.navigate('ToolDetail', { toolId: tool.id });
  }

  function onScan(data: string) {
    try {
      const parsed = JSON.parse(data) as LoanPayload;
      if (!parsed || parsed.v !== 1 || parsed.kind !== 'loan') throw new Error('bad payload');
      setPayload(parsed);
    } catch {
      Alert.alert('Invalid QR', 'That QR code is not a Handback loan.');
    }
  }

  if (perm === 'denied') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Camera permission needed</Text>
        <Text style={styles.sub}>Enable camera access to scan loan QR codes.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Confirm loan</Text>
      <Text style={styles.sub}>Scan the owner’s QR code.</Text>

      <View style={styles.scannerBox}>
        {perm === 'granted' ? (
          <BarCodeScanner
            onBarCodeScanned={payload ? undefined : ({ data }) => onScan(data)}
            style={{ width: '100%', height: 320 }}
          />
        ) : (
          <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Requesting permission…</Text>
        )}
      </View>

      {payload ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Scanned</Text>
          <Text style={styles.cardLine}>Owner: {payload.ownerName}</Text>
          <Text style={styles.cardLine}>Tool: {payload.toolName ?? payload.toolId}</Text>
          <Text style={styles.cardLine}>Due: {payload.dueAt ? new Date(payload.dueAt).toLocaleDateString() : '—'}</Text>

          <Pressable style={[styles.btn, styles.primary]} onPress={onConfirm}>
            <Text style={[styles.btnText, styles.primaryText]}>Confirm</Text>
          </Pressable>

          <Pressable style={styles.btn} onPress={() => setPayload(null)}>
            <Text style={styles.btnText}>Scan again</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0d12', paddingTop: 64, paddingHorizontal: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 6 },
  sub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 16 },
  scannerBox: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  card: { marginTop: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 14 },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: '900', marginBottom: 8 },
  cardLine: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 6 },
  btn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  btnText: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '800' },
  primary: { backgroundColor: '#6ee7b7' },
  primaryText: { color: '#05140d' },
});
