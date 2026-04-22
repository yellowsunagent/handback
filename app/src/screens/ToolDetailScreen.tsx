import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/nav';
import { loadState } from '../storage/store';
import type { Tool } from '../types/models';

type Props = NativeStackScreenProps<RootStackParamList, 'ToolDetail'>;

export function ToolDetailScreen({ route, navigation }: Props) {
  const { toolId } = route.params;
  const [tool, setTool] = React.useState<Tool | null>(null);

  async function refresh() {
    const state = await loadState();
    setTool(state.tools.find((t) => t.id === toolId) ?? null);
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{tool.name}</Text>
      <Text style={styles.meta}>Owner: {tool.ownerName}</Text>
      <Text style={styles.meta}>Status: {status}</Text>

      <View style={{ height: 18 }} />

      <Pressable
        style={[styles.btn, styles.primary]}
        onPress={() => navigation.navigate('StartLoan', { toolId: tool.id })}
        disabled={!!tool.currentLoanId}
      >
        <Text style={[styles.btnText, styles.primaryText]}>{tool.currentLoanId ? 'Already loaned out' : 'Start loan (QR)'}</Text>
      </Pressable>

      <Pressable style={styles.btn} onPress={() => navigation.navigate('ScanLoan')}>
        <Text style={styles.btnText}>Confirm loan (scan QR)</Text>
      </Pressable>

      <Text style={styles.note}>
        Next: we’ll add due-date presets, loan history, and “mark returned”.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0d12', paddingTop: 64, paddingHorizontal: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 10 },
  meta: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginBottom: 6 },
  btn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnText: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '800' },
  primary: { backgroundColor: '#6ee7b7' },
  primaryText: { color: '#05140d' },
  note: { marginTop: 8, color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 18 },
});
