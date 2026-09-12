import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { Loan, Tool } from '../types/models';
import type { RootStackParamList } from '../types/nav';
import { localDay, dueLabel } from '../domain/dates';
import { useApp } from '../ui/AppContext';
import { Button, Card, Header, PhotoThumbnail, Screen, StatusPill } from '../ui/components';
import { colors, common } from '../ui/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ToolDetail'>;

export function ToolDetailScreen({ route, navigation }: Props) {
  const { state, refresh, commit } = useApp();
  const { toolId } = route.params;
  const [busy, setBusy] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      void refresh().catch(() => undefined);
    }, [refresh]),
  );

  if (!state) return null;
  const tool = state.tools.find((item) => item.id === toolId);
  if (!tool) {
    return <Screen><Header title="Tool not found" onBack={() => navigation.goBack()} /><Text style={common.note}>This record may have been removed from local data.</Text></Screen>;
  }
  const currentTool = tool;
  const people = new Map(state.people.map((person) => [person.id, person] as const));
  const activeLoan = state.loans.find((loan) => loan.toolId === currentTool.id && !loan.returnedOn);
  const history = state.loans.filter((loan) => loan.toolId === currentTool.id && !!loan.returnedOn).sort((a, b) => (b.returnedOn ?? '').localeCompare(a.returnedOn ?? ''));
  const isMine = currentTool.ownerId === state.profileId;
  const ownerName = people.get(currentTool.ownerId)?.name ?? 'Archived person';

  function archiveTool() {
    if (activeLoan) {
      Alert.alert('Resolve the active loan first', 'A tool with an active loan cannot be archived.');
      return;
    }
    const archive = !currentTool.archived;
    Alert.alert(archive ? `Archive ${currentTool.name}?` : `Restore ${currentTool.name}?`, archive ? 'It stays readable in history and is hidden from future selections.' : 'It will be available in future loan selections.', [
      { text: 'Cancel', style: 'cancel' },
      { text: archive ? 'Archive' : 'Restore', onPress: () => { setBusy(true); void commit({ type: 'tool', tool: { ...currentTool, archived: archive } }).then(() => navigation.goBack()).catch((error) => Alert.alert('Could not update tool', error instanceof Error ? error.message : 'Please try again.')).finally(() => setBusy(false)); } },
    ]);
  }

  return (
    <Screen>
      <Header title={currentTool.name} subtitle={currentTool.archived ? 'Archived tool — history remains available.' : undefined} onBack={() => navigation.goBack()} action={<Pressable accessibilityRole="button" onPress={() => navigation.navigate('AddTool', { toolId: currentTool.id })}><Text style={styles.link}>Edit</Text></Pressable>} />

      <View style={styles.heroRow}>
        <PhotoThumbnail uri={currentTool.photoUri} size={104} />
        <View style={styles.heroCopy}>
          <Text style={styles.kicker}>OWNER</Text>
          <Text style={styles.owner}>{ownerName}</Text>
          <StatusPill label={activeLoan ? (isMine ? 'Lent out' : 'Borrowed by me') : isMine ? 'Available for me to lend' : 'No active loan on this phone'} tone={activeLoan ? 'warning' : 'good'} />
        </View>
      </View>

      {currentTool.notes ? <Card style={styles.notesCard}><Text style={styles.cardKicker}>NOTES</Text><Text style={styles.notes}>{currentTool.notes}</Text></Card> : null}

      {activeLoan ? (
        <Card style={styles.activeCard}>
          <View style={styles.cardHeader}><Text style={styles.cardTitle}>Active loan</Text><StatusPill label={activeLoan.dueOn && activeLoan.dueOn < localDay() ? 'Overdue' : 'Outstanding'} tone={activeLoan.dueOn && activeLoan.dueOn < localDay() ? 'danger' : 'warning'} /></View>
          <Text style={styles.detailLine}>{isMine ? `With ${people.get(activeLoan.borrowerId)?.name ?? 'an archived person'}` : `From ${people.get(activeLoan.ownerId)?.name ?? 'an archived person'}`}</Text>
          <Text style={styles.detailLine}>Started {activeLoan.startedOn}</Text>
          <Text style={styles.detailLine}>Due {activeLoan.dueOn ? `${dueLabel(activeLoan.dueOn)} (${activeLoan.dueOn})` : 'No due date'}</Text>
          <Button label="Open active loan" onPress={() => navigation.navigate('LoanDetail', { loanId: activeLoan.id })} variant="secondary" style={styles.cardButton} />
        </Card>
      ) : null}

      {!activeLoan && !currentTool.archived ? (
        <View style={styles.loanActions}>
          {isMine ? <Button label="Record that I lent this" onPress={() => navigation.navigate('StartLoan', { mode: 'lend', toolId: currentTool.id })} variant="primary" /> : <Button label="Record that I borrowed this" onPress={() => navigation.navigate('StartLoan', { mode: 'borrow', toolId: currentTool.id })} variant="primary" />}
        </View>
      ) : null}

      <Button label={currentTool.archived ? 'Restore tool' : 'Archive tool'} onPress={archiveTool} variant="quiet" disabled={busy || !!activeLoan} />

      <View style={styles.historyHeader}><Text style={common.sectionTitle}>Loan history</Text>{history.length ? <Text style={styles.historyCount}>{history.length} completed</Text> : null}</View>
      {history.length === 0 ? <Text style={styles.emptyText}>Completed loans for this tool will stay here.</Text> : history.map((loan) => <HistoryRow key={loan.id} loan={loan} people={people} onPress={() => navigation.navigate('LoanDetail', { loanId: loan.id })} />)}
    </Screen>
  );
}

function HistoryRow({ loan, people, onPress }: { loan: Loan; people: Map<string, { id: string; name: string }>; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.historyRow}><View style={styles.historyMain}><Text style={styles.historyTitle}>{people.get(loan.borrowerId)?.name ?? 'Archived person'}</Text><Text style={common.rowSub}>Returned {loan.returnedOn ?? '—'} · Started {loan.startedOn}</Text></View><Text style={styles.chevron}>›</Text></Pressable>;
}

const styles = StyleSheet.create({
  link: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  heroRow: { alignItems: 'center', flexDirection: 'row', marginBottom: 23 },
  heroCopy: { flex: 1, marginLeft: 16 },
  kicker: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.7, marginBottom: 5 },
  owner: { color: colors.ink, fontSize: 19, fontWeight: '800', marginBottom: 9 },
  notesCard: { marginBottom: 17 },
  cardKicker: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.7, marginBottom: 7 },
  notes: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  activeCard: { marginBottom: 17 },
  cardHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  detailLine: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  cardButton: { marginTop: 13 },
  loanActions: { marginBottom: 3 },
  historyHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 22 },
  historyCount: { color: colors.dim, fontSize: 12 },
  emptyText: { color: colors.dim, fontSize: 13, marginBottom: 18 },
  historyRow: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 13, borderWidth: 1, flexDirection: 'row', marginBottom: 9, padding: 13 },
  historyMain: { flex: 1 },
  historyTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  chevron: { color: colors.dim, fontSize: 24, marginLeft: 8 },
});
