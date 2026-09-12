import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { Loan, Tool } from '../types/models';
import type { RootStackParamList } from '../types/nav';
import { localDay, dueLabel } from '../domain/dates';
import { useApp } from '../ui/AppContext';
import { Button, Card, EmptyState, Header, Screen, StatusPill } from '../ui/components';
import { colors, common } from '../ui/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Loans'>;
type Row = { loan: Loan; tool?: Tool };

export function LoansScreen({ route, navigation }: Props) {
  const { state, refresh } = useApp();
  const [tab, setTab] = React.useState<'active' | 'history'>(route.params?.initialTab ?? 'active');

  useFocusEffect(
    React.useCallback(() => {
      void refresh().catch(() => undefined);
    }, [refresh]),
  );

  if (!state) return null;
  const toolById = new Map(state.tools.map((tool) => [tool.id, tool] as const));
  const active = state.loans.filter((loan) => !loan.returnedOn);
  const history = state.loans.filter((loan) => !!loan.returnedOn).sort((a, b) => (b.returnedOn ?? '').localeCompare(a.returnedOn ?? ''));
  const lending = active.filter((loan) => loan.ownerId === state.profileId).map((loan) => ({ loan, tool: toolById.get(loan.toolId) }));
  const borrowing = active.filter((loan) => loan.borrowerId === state.profileId).map((loan) => ({ loan, tool: toolById.get(loan.toolId) }));

  return (
    <Screen>
      <Header title="Loans" subtitle="Outstanding records and completed history live on this phone." onBack={() => navigation.goBack()} action={<Pressable accessibilityRole="button" onPress={() => navigation.navigate('ScanLoan')} style={styles.scanButton}><Text style={styles.scanText}>Scan QR</Text></Pressable>} />
      <View style={styles.tabs}>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === 'active' }} onPress={() => setTab('active')} style={[styles.tab, tab === 'active' && styles.tabActive]}><Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>Outstanding ({active.length})</Text></Pressable>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === 'history' }} onPress={() => setTab('history')} style={[styles.tab, tab === 'history' && styles.tabActive]}><Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>History ({history.length})</Text></Pressable>
      </View>

      {tab === 'active' ? (
        <>
          <LoanSection title="I lent" body="Tools that belong to you" rows={lending} emptyText="Nothing lent out right now." onPress={(loanId) => navigation.navigate('LoanDetail', { loanId })} profileId={state.profileId} people={state.people} />
          <LoanSection title="I borrowed" body="Tools that belong to someone else" rows={borrowing} emptyText="Nothing borrowed right now." onPress={(loanId) => navigation.navigate('LoanDetail', { loanId })} profileId={state.profileId} people={state.people} />
          {active.length === 0 ? <EmptyState title="No outstanding loans" body="When you lend or borrow a tool, it will show up here immediately." action={<Button label="Record a loan" onPress={() => navigation.navigate('StartLoan', { mode: 'lend' })} variant="secondary" />} /> : null}
        </>
      ) : (
        <>
          {history.length === 0 ? <EmptyState title="No completed loans yet" body="Returned loans stay here so your local history remains readable." /> : history.map((loan) => <LoanRow key={loan.id} row={{ loan, tool: toolById.get(loan.toolId) }} profileId={state.profileId} people={state.people} onPress={() => navigation.navigate('LoanDetail', { loanId: loan.id })} history />)}
        </>
      )}
    </Screen>
  );
}

function LoanSection({ title, body, rows, emptyText, onPress, profileId, people }: { title: string; body: string; rows: Row[]; emptyText: string; onPress: (loanId: string) => void; profileId: string; people: { id: string; name: string }[] }) {
  return (
    <View style={styles.section}>
      <Text style={common.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{body}</Text>
      {rows.length === 0 ? <Text style={styles.emptyText}>{emptyText}</Text> : rows.map((row) => <LoanRow key={row.loan.id} row={row} profileId={profileId} people={people} onPress={() => onPress(row.loan.id)} />)}
    </View>
  );
}

function LoanRow({ row, profileId, people, onPress, history = false }: { row: Row; profileId: string; people: { id: string; name: string }[]; onPress: () => void; history?: boolean }) {
  const { loan, tool } = row;
  const personById = new Map(people.map((person) => [person.id, person] as const));
  const isLender = loan.ownerId === profileId;
  const other = personById.get(isLender ? loan.borrowerId : loan.ownerId)?.name ?? 'Archived person';
  const due = loan.dueOn ? dueLabel(loan.dueOn) : 'No due date';
  const overdue = !history && !!loan.dueOn && loan.dueOn < localDay();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rowMain}>
        <Text style={common.rowTitle} numberOfLines={1}>{tool?.name ?? 'Unknown tool'}</Text>
        <Text style={common.rowSub}>{isLender ? `With ${other}` : `From ${other}`}</Text>
        <View style={styles.rowMeta}><StatusPill label={history ? 'Returned' : overdue ? 'Overdue' : loan.dueOn ? 'Outstanding' : 'No due date'} tone={history ? 'muted' : overdue ? 'danger' : loan.dueOn ? 'warning' : 'muted'} /><Text style={styles.role}>{isLender ? 'Lent' : 'Borrowed'}</Text></View>
        <Text style={styles.dueText}>{loan.dueOn ? `${due} (${loan.dueOn})` : 'No due date'}</Text>
        <Text style={styles.dueText}>{loan.dueOn ? `${due} (${loan.dueOn})` : 'No due date'}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scanButton: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 11, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 9 },
  scanText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  tabs: { backgroundColor: colors.surface, borderRadius: 12, flexDirection: 'row', marginBottom: 25, padding: 3 },
  tab: { alignItems: 'center', borderRadius: 10, flex: 1, paddingHorizontal: 6, paddingVertical: 10 },
  tabActive: { backgroundColor: colors.surfaceRaised },
  tabText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: colors.ink },
  section: { marginBottom: 25 },
  sectionBody: { color: colors.dim, fontSize: 12, marginTop: -5, marginBottom: 10 },
  emptyText: { color: colors.dim, fontSize: 13, paddingVertical: 7 },
  row: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 15, borderWidth: 1, flexDirection: 'row', marginBottom: 9, minHeight: 78, padding: 13 },
  rowMain: { flex: 1 },
  rowMeta: { alignItems: 'center', flexDirection: 'row', marginTop: 7 },
  dueText: { color: colors.dim, fontSize: 11, lineHeight: 16, marginTop: 4 },
  role: { color: colors.dim, fontSize: 11, fontWeight: '700', marginLeft: 8 },
  chevron: { color: colors.dim, fontSize: 25, marginLeft: 8 },
  pressed: { opacity: 0.78 },
});
