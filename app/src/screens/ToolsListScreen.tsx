import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/nav';
import { loadState } from '../storage/store';
import type { Tool } from '../types/models';

type Props = NativeStackScreenProps<RootStackParamList, 'ToolsList'>;

export function ToolsListScreen({ navigation }: Props) {
  const [tools, setTools] = React.useState<Tool[]>([]);

  async function refresh() {
    const state = await loadState();
    setTools(state.tools);
  }

  React.useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      void refresh();
    });
    void refresh();
    return unsub;
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Handback</Text>
        <View style={styles.headerButtons}>
          <Pressable style={styles.headerBtn} onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.headerBtnText}>Settings</Text>
          </Pressable>
          <Pressable style={[styles.headerBtn, styles.primary]} onPress={() => navigation.navigate('AddTool')}>
            <Text style={[styles.headerBtnText, styles.primaryText]}>+ Tool</Text>
          </Pressable>
        </View>
      </View>

      {tools.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No tools yet</Text>
          <Text style={styles.emptyBody}>Add a tool, then start a loan and confirm it by scanning a QR code.</Text>
        </View>
      ) : (
        <FlatList
          data={tools}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <ToolRow tool={item} onPress={() => navigation.navigate('ToolDetail', { toolId: item.id })} />}
        />
      )}
    </View>
  );
}

function ToolRow({ tool, onPress }: { tool: Tool; onPress: () => void }) {
  const status = tool.currentLoanId ? 'Loaned out' : 'Available';
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {tool.name}
        </Text>
        <Text style={styles.rowSub}>
          Owner: {tool.ownerName} · {status}
        </Text>
      </View>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0d12' },
  header: {
    paddingTop: 64,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  title: { color: '#fff', fontSize: 28, fontWeight: '700', letterSpacing: 0.2 },
  headerButtons: { flexDirection: 'row', gap: 10, marginTop: 12 },
  headerBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerBtnText: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600' },
  primary: { backgroundColor: '#6ee7b7' },
  primaryText: { color: '#05140d' },
  empty: { padding: 20, marginTop: 24 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptyBody: { color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 20 },
  list: { padding: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 10,
  },
  rowMain: { flex: 1 },
  rowTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  rowSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  chev: { color: 'rgba(255,255,255,0.6)', fontSize: 22, paddingLeft: 10 },
});
