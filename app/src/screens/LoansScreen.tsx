import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/nav';
import { loadState } from '../storage/store';
import type { Loan, Tool } from '../types/models';

type Props = NativeStackScreenProps<RootStackParamList, 'Loans'>;

type Row = {
  loan: Loan;
  tool?: Tool;
};

export function LoansScreen({ navigation }: Props) {
  const [mineBorrowing, setMineBorrowing] = React.useState<Row[]>([]);
  const [mineLentOut, setMineLentOut] = React.useState<Row[]>([]);

  async function refresh() {
    const state = await loadState();
    const myName = state.myName || 'Me';
    const toolsById = new Map(state.tools.map((t) => [t.id, t] as const));

    const active = state.loans.filter((l) => !l.returnedAt);
    const rows: Row[] = active.map((loan) => ({ loan, tool: toolsById.get(loan.toolId) }));

    setMineBorrowing(rows.filter((r) => r.loan.borrowerName === myName));
    setMineLentOut(rows.filter((r) => r.loan.ownerName === myName));
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
        <Text style={styles.title}>Loans</Text>
        <Pressable style={styles.headerBtn} onPress={() => navigation.navigate('ToolsList')}>
          <Text style={styles.headerBtnText}>Tools</Text>
        </Pressable>
      </View>

      <Section
        title="I’m borrowing"
        rows={mineBorrowing}
        emptyText="Nothing right now."
        onPressRow={(toolId) => navigation.navigate('ToolDetail', { toolId })}
      />

      <Section
        title="I’ve loaned out"
        rows={mineLentOut}
        emptyText="Nothing right now."
        onPressRow={(toolId) => navigation.navigate('ToolDetail', { toolId })}
      />
    </View>
  );
}

function Section({
  title,
  rows,
  emptyText,
  onPressRow,
}: {
  title: string;
  rows: Row[];
  emptyText: string;
  onPressRow: (toolId: string) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rows.length === 0 ? (
        <Text style={styles.empty}>{emptyText}</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.loan.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => (item.tool ? onPressRow(item.tool.id) : undefined)}
              disabled={!item.tool}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.tool?.name ?? 'Unknown tool'}
                </Text>
                <Text style={styles.rowSub}>
                  Owner: {item.loan.ownerName} · Borrower: {item.loan.borrowerName}
                </Text>
                <Text style={styles.rowSub}>
                  Due: {item.loan.dueAt ? new Date(item.loan.dueAt).toLocaleDateString() : '—'}
                </Text>
              </View>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0d12' },
  header: {
    paddingTop: 64,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  title: { color: '#fff', fontSize: 26, fontWeight: '800' },
  headerBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)' },
  headerBtnText: { color: 'rgba(255,255,255,0.9)', fontWeight: '700' },

  section: { padding: 16, paddingBottom: 0 },
  sectionTitle: { color: '#fff', fontSize: 14, fontWeight: '900', marginBottom: 10 },
  empty: { color: 'rgba(255,255,255,0.65)', fontSize: 13, paddingVertical: 6 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 10,
  },
  rowTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 4 },
  rowSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 3 },
  chev: { color: 'rgba(255,255,255,0.6)', fontSize: 22, paddingLeft: 10 },
});
