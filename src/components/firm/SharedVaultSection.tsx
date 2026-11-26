import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, Clock, FileText, Folder, Lock, X } from 'lucide-react-native';
import {
  browseSharedFolder,
  type SharedFolderContents,
  type SharedVaultItem,
} from '../../lib/businessSharedApi';
import Card from '../ui/Card';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { SharedVaultViewer, type SharedFileRef } from './SharedVaultViewer';
import { useSharePresence } from './useSharePresence';

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });

/**
 * Folders and files a firm shared with me from its DocuIntelli Business vault (business DECISIONS
 * D9) — the list at the top of "From your firms". `openShareId` opens one straight away (after an
 * emailed share link was accepted).
 */
export function SharedVaultSection({
  items,
  openShareId,
  onOpened,
}: {
  items: SharedVaultItem[];
  openShareId?: string | null;
  onOpened?: () => void;
}) {
  const [open, setOpen] = useState<SharedVaultItem | null>(null);
  useEffect(() => {
    if (!openShareId) return;
    const found = items.find((i) => i.shareId === openShareId);
    if (found) setOpen(found);
    onOpened?.();
  }, [openShareId, items, onOpened]);

  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>SHARED WITH YOU</Text>
      {items.map((item) => (
        <Card key={item.shareId} style={styles.card}>
          <TouchableOpacity onPress={() => setOpen(item)} style={styles.row} activeOpacity={0.7}>
            {item.kind === 'folder' ? (
              <Folder size={20} color={colors.warning[500]} />
            ) : (
              <FileText size={20} color={colors.primary[600]} />
            )}
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.sub} numberOfLines={1}>
                From {item.firmName} · {item.canDownload ? 'Full access' : 'View only'}
                {item.expiresAt ? ` · until ${day(item.expiresAt)}` : ''}
              </Text>
            </View>
            {!item.canDownload && <Lock size={14} color={colors.slate[400]} />}
            {item.expiresAt && <Clock size={14} color={colors.slate[400]} />}
            <ChevronRight size={18} color={colors.slate[400]} />
          </TouchableOpacity>
        </Card>
      ))}

      {open?.kind === 'document' && open.documentId && open.viewAs && (
        <SharedVaultViewer
          shareId={open.shareId}
          file={{ documentId: open.documentId, name: open.name, viewAs: open.viewAs }}
          firmName={open.firmName}
          canDownload={open.canDownload}
          onClose={() => setOpen(null)}
        />
      )}
      {open?.kind === 'folder' && <SharedFolderBrowser item={open} onClose={() => setOpen(null)} />}
    </View>
  );
}

/** Inside a shared folder: breadcrumb, subfolders and files. */
function SharedFolderBrowser({ item, onClose }: { item: SharedVaultItem; onClose: () => void }) {
  const [folderId, setFolderId] = useState<string | undefined>(undefined);
  const [data, setData] = useState<SharedFolderContents | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<SharedFileRef | null>(null);
  // One heartbeat for the whole share: the open file while viewing one, otherwise the folder.
  useSharePresence(item.shareId, file ? { documentId: file.documentId } : { folderId: folderId ?? data?.path[0]?.id });

  useEffect(() => {
    let alive = true;
    setError(null);
    browseSharedFolder(item.shareId, folderId)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e?.message || 'Could not open the folder'));
    return () => {
      alive = false;
    };
  }, [item.shareId, folderId]);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
        <View style={styles.toolbar}>
          <TouchableOpacity onPress={onClose} style={{ padding: 6 }} accessibilityLabel="Close">
            <X size={20} color={colors.slate[700]} />
          </TouchableOpacity>
          <View style={styles.info}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.crumbs}>
                {(data?.path ?? [{ id: '', name: item.name }]).map((p, i, all) => (
                  <View key={p.id || i} style={styles.crumbs}>
                    {i > 0 && <ChevronRight size={12} color={colors.slate[400]} />}
                    {i === all.length - 1 ? (
                      <Text style={styles.crumbOn}>{p.name}</Text>
                    ) : (
                      <TouchableOpacity onPress={() => setFolderId(p.id)}>
                        <Text style={styles.crumb}>{p.name}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            </ScrollView>
            <Text style={styles.sub}>From {item.firmName} · {item.canDownload ? 'Full access' : 'View only'}</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.md }}>
          {error ? (
            <Text style={styles.empty}>{error}</Text>
          ) : !data ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary[600]} />
          ) : data.folders.length === 0 && data.documents.length === 0 ? (
            <Text style={styles.empty}>This folder is empty.</Text>
          ) : (
            <>
              {data.folders.map((f) => (
                <TouchableOpacity key={f.id} onPress={() => setFolderId(f.id)} style={styles.listRow}>
                  <Folder size={18} color="#f59e0b" />
                  <Text style={[styles.title, { flex: 1 }]} numberOfLines={1}>{f.name}</Text>
                  <Text style={styles.sub}>{f.documentCount}</Text>
                </TouchableOpacity>
              ))}
              {data.documents.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  onPress={() => setFile({ documentId: d.id, name: d.name, viewAs: d.viewAs })}
                  style={styles.listRow}
                >
                  <FileText size={18} color={colors.slate[400]} />
                  <Text style={[styles.title, { flex: 1 }]} numberOfLines={1}>{d.name}</Text>
                  <Text style={styles.sub}>{d.category}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
        {file && data && (
          <SharedVaultViewer
            shareId={item.shareId}
            file={file}
            firmName={item.firmName}
            canDownload={data.canDownload}
            trackPresence={false}
            onClose={() => setFile(null)}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.md },
  heading: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.slate[500], marginBottom: spacing.xs, letterSpacing: 0.5 },
  card: { marginBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm },
  info: { flex: 1 },
  title: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.slate[900] },
  sub: { fontSize: typography.fontSize.xs, color: colors.slate[500] },
  modal: { flex: 1, backgroundColor: '#fff' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.slate[200] },
  crumbs: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  crumb: { fontSize: typography.fontSize.sm, color: colors.slate[500] },
  crumbOn: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.slate[900] },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.slate[100] },
  empty: { textAlign: 'center', color: colors.slate[500], marginTop: 40 },
});
