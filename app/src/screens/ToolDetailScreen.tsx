import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/nav';
import { loadState, updateLoan, updateTool } from '../storage/store';
import type { Loan, Tool } from '../types/models';

type Props = NativeStackScreenProps<RootStackParamList, 'ToolDetail'>;

export function ToolDetailScreen({ route, navigation }: Props) {
  const { toolId } = route.params;
  const [tool, setTool] = React.useState<Tool | null>(null);
  const [loan, setLoan] = React.useState<Loan | null>(null);

  async function refresh() {
    const state = await loadState();
    const t = state.tools.find((x) => x.id === toolId) ?? null;
    setTool(t);
    if (t?.currentLoanId) {
      setLoan(state.loans.find((l) => l.id === t.currentLoanId) ?? null);
    } else {
      setLoan(null);
    }
  }

  React.useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      void refresh();
    });
    void refresh();
    return unsub;
  }, [navigation, toolId]);

  if (!tool) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Tool not found</Text>
      </View>
    );
  }

  const status = tool.currentLoanId ? 'Loaned out' : 'Available';

  async function onMarkReturned() {
    if (!tool || !tool.currentLoanId || !loan) return;

    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert('Mark returned?', `${tool?.name ?? 'This tool'} will be marked as back with ${tool?.ownerName ?? 'the owner'}.`, [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Mark returned', style: 'default', onPress: () => resolve(true) },
      ]);
    });

    if (!confirmed) return;

    const returnedAt = new Date().toISOString();
    const currentTool = tool;
    await updateLoan({ ...loan, returnedAt });
    await updateTool({ ...currentTool, currentLoanId: undefined });
    await refresh();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{tool.name}</Text>
      <Text style={styles.meta}>Owner: {tool.ownerName}</Text>
      <Text style={styles.meta}>Status: {status}</Text>

      {loan ? (
        <View style={styles.loanBox}>
          <Text style={styles.loanTitle}>Current loan</Text>
          <Text style={styles.loanLine}>Borrower: {loan.borrowerName}</Text>
          <Text style={styles.loanLine}>Started: {new Date(loan.startedAt).toLocaleString()}</Text>
          {(() => {
            const dueAt = loan.dueAt;
            if (!dueAt) return <Text style={styles.loanLine}>Due: —</Text>;
            const due = new Date(dueAt).getTime();
            const days = (due - Date.now()) / (24 * 60 * 60 * 1000);
            const badge = days < 0 ? 'Overdue' : days <= 2 ? 'Due soon' : new Date(dueAt).toLocaleDateString();
            const tone = days < 0 ? styles.dangerText : days <= 2 ? styles.warnText : undefined;
            return (
              <Text style={[styles.loanLine, tone]}>Due: {badge}</Text>
            );
          })()}
        </View>
      ) : null}

      <View style={{ height: 18 }} />

      <Pressable
        style={[styles.btn, styles.primary, tool.currentLoanId && styles.btnDisabled]}
        onPress={() => navigation.navigate('StartLoan', { toolId: tool.id })}
        disabled={!!tool.currentLoanId}
      >
        <Text style={[styles.btnText, styles.primaryText]}>{tool.currentLoanId ? 'Already loaned out' : 'Start loan (QR)'}</Text>
      </Pressable>

      <Pressable style={styles.btn} onPress={() => navigation.navigate('ScanLoan')}>
        <Text style={styles.btnText}>Confirm loan (scan QR)</Text>
      </Pressable>

      <Pressable style={[styles.btn, loan ? styles.danger : styles.btnDisabled]} onPress={onMarkReturned} disabled={!loan}>
        <Text style={styles.btnText}>Mark returned</Text>
      </Pressable>

      <Text style={styles.note}>
        v1 note: because each phone is standalone, both sides won’t automatically stay in sync.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0d12', paddingTop: 64, paddingHorizontal: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 10 },
  meta: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginBottom: 6 },
  loanBox: {
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 14,
  },
  loanTitle: { color: '#fff', fontSize: 14, fontWeight: '900', marginBottom: 8 },
  loanLine: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 6 },

  btn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '800' },
  primary: { backgroundColor: '#6ee7b7' },
  primaryText: { color: '#05140d' },
  danger: { backgroundColor: '#ef4444' },
  warnText: { color: '#fbbf24' },
  dangerText: { color: '#fca5a5' },
  note: { marginTop: 8, color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 18 },
});
