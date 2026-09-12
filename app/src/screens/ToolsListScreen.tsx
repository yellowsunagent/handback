import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from '../types/nav';
import type { Loan, Tool } from '../types/models';
import { useApp } from '../ui/AppContext';
import { Button, Card, EmptyState, Header, PhotoThumbnail, Screen, StatusPill } from '../ui/components';
import { colors, common } from '../ui/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ToolsList'>;

export function ToolsListScreen({ navigation }: Props) {
  const { state, refresh } = useApp();
  const [showArchived, setShowArchived] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      void refresh().catch(() => undefined);
    }, [refresh]),
  );

  if (!state) return null;
  const activeLoans = new Map(state.loans.filter((loan) => !loan.returnedOn).map((loan) => [loan.toolId, loan] as const));
  const people = new Map(state.people.map((person) => [person.id, person] as const));
  const currentTools = state.tools.filter((tool) => !tool.archived);
  const archivedTools = state.tools.filter((tool) => tool.archived);
  const profile = people.get(state.profileId);

  return (
    <Screen>
      <Header
        title="HandBack"
        subtitle={profile ? `Hi ${profile.name}. Keep the handoff clear.` : 'Your local tool ledger'}
        action={
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Settings')} style={styles.iconButton}>
            <Text style={styles.iconButtonText}>⚙</Text>
          </Pressable>
        }
      />

      <View style={styles.actionGrid}>
        <Pressable style={[styles.actionCard, styles.actionCardPrimary]} onPress={() => navigation.navigate('StartLoan', { mode: 'lend' })}>
          <Text style={styles.actionKicker}>I LENT A TOOL</Text>
          <Text style={styles.actionTitle}>Track it out</Text>
          <Text style={styles.actionBody}>Choose one of your available tools.</Text>
          <Text style={styles.actionArrow}>→</Text>
        </Pressable>
        <Pressable style={styles.actionCard} onPress={() => navigation.navigate('StartLoan', { mode: 'borrow' })}>
          <Text style={styles.actionKicker}>I BORROWED A TOOL</Text>
          <Text style={styles.actionTitle}>Track it back</Text>
          <Text style={styles.actionBody}>Record someone else’s tool.</Text>
          <Text style={styles.actionArrow}>→</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={common.sectionTitle}>Tool inventory</Text>
        <Pressable accessibilityRole="button" onPress={() => navigation.navigate('AddTool')}>
          <Text style={styles.link}>+ Add tool</Text>
        </Pressable>
      </View>

      {currentTools.length === 0 ? (
        <EmptyState
          title="Your inventory is ready when you are"
          body="Add the tools you own, or record a tool you borrowed from a friend."
          action={<Button label="Add a tool" onPress={() => navigation.navigate('AddTool')} variant="secondary" />}
        />
      ) : (
        currentTools.map((tool) => (
          <ToolRow
            key={tool.id}
            tool={tool}
            loan={activeLoans.get(tool.id)}
            profileId={state.profileId}
            people={people}
            onPress={() => navigation.navigate('ToolDetail', { toolId: tool.id })}
          />
        ))
      )}

      {archivedTools.length > 0 ? (
        <View style={styles.archivedBlock}>
          <Pressable accessibilityRole="button" onPress={() => setShowArchived((value) => !value)} style={styles.archivedHeader}>
            <Text style={styles.archivedTitle}>Archived tools ({archivedTools.length})</Text>
            <Text style={styles.link}>{showArchived ? 'Hide' : 'Show'}</Text>
          </Pressable>
          {showArchived
            ? archivedTools.map((tool) => (
                <ToolRow
                  key={tool.id}
                  tool={tool}
                  loan={activeLoans.get(tool.id)}
                  profileId={state.profileId}
                  people={people}
                  onPress={() => navigation.navigate('ToolDetail', { toolId: tool.id })}
                  archived
                />
              ))
            : null}
        </View>
      ) : null}

      <View style={styles.bottomLinks}>
        <Button label="Outstanding loans" onPress={() => navigation.navigate('Loans', { initialTab: 'active' })} variant="secondary" style={styles.bottomButton} />
        <Button label="People" onPress={() => navigation.navigate('People')} variant="quiet" style={styles.bottomButton} />
      </View>
    </Screen>
  );
}

function ToolRow({
  tool,
  loan,
  profileId,
  people,
  onPress,
  archived = false,
}: {
  tool: Tool;
  loan?: Loan;
  profileId: string;
  people: Map<string, { id: string; name: string }>;
  onPress: () => void;
  archived?: boolean;
}) {
  const isMine = tool.ownerId === profileId;
  let status = isMine ? 'Available for me to lend' : 'No active loan on this phone';
  let tone: 'muted' | 'good' | 'warning' = 'good';
  if (loan) {
    const otherId = isMine ? loan.borrowerId : loan.ownerId;
    status = isMine ? `Lent to ${people.get(otherId)?.name ?? 'an archived person'}` : `Borrowed from ${people.get(otherId)?.name ?? 'an archived person'}`;
    tone = 'warning';
  }
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [common.row, pressed && styles.pressed, archived && styles.archivedRow]}>
      <PhotoThumbnail uri={tool.photoUri} size={56} />
      <View style={styles.rowMain}>
        <Text style={common.rowTitle} numberOfLines={1}>{tool.name}</Text>
        <Text style={common.rowSub} numberOfLines={1}>Owner: {people.get(tool.ownerId)?.name ?? 'Archived person'}</Text>
        <View style={styles.rowStatus}><StatusPill label={status} tone={tone} /></View>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, height: 42, justifyContent: 'center', width: 42 },
  iconButtonText: { color: colors.ink, fontSize: 20 },
  actionGrid: { flexDirection: 'row', gap: 10, marginBottom: 30 },
  actionCard: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 17, borderWidth: 1, flex: 1, minHeight: 157, padding: 14 },
  actionCardPrimary: { backgroundColor: '#173227', borderColor: '#2e674f' },
  actionKicker: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.6, marginBottom: 11 },
  actionTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  actionBody: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 5 },
  actionArrow: { bottom: 9, color: colors.primary, fontSize: 22, position: 'absolute', right: 13 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  link: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  rowMain: { flex: 1, marginLeft: 12 },
  rowStatus: { marginTop: 7 },
  chevron: { color: colors.dim, fontSize: 25, marginLeft: 8 },
  pressed: { opacity: 0.78 },
  archivedBlock: { marginTop: 13 },
  archivedHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingVertical: 8 },
  archivedTitle: { color: colors.muted, fontSize: 14, fontWeight: '800' },
  archivedRow: { opacity: 0.72 },
  bottomLinks: { marginTop: 15 },
  bottomButton: { marginBottom: 10 },
});
