import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, ArrowLeft } from 'lucide-react-native';
import SignatureRequestBuilder from '../../src/components/esign/SignatureRequestBuilder';
import { useAuth } from '../../src/hooks/useAuth';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';
import { spacing } from '../../src/theme/spacing';

export default function CreateSignatureRequestScreen() {
  const { documentId, documentName, pdfUrl } = useLocalSearchParams<{
    documentId: string;
    documentName: string;
    pdfUrl: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();

  if (!documentId || !documentName || !pdfUrl) {
    return (
      <View style={missingStyles.container}>
        <AlertTriangle size={40} color={colors.warning[500]} strokeWidth={1.5} />
        <Text style={missingStyles.title}>Missing document info</Text>
        <Text style={missingStyles.subtitle}>Please select a document first.</Text>
        <TouchableOpacity
          style={missingStyles.button}
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/vault')}
          activeOpacity={0.7}
        >
          <ArrowLeft size={18} color={colors.white} strokeWidth={2} />
          <Text style={missingStyles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SignatureRequestBuilder
      documentId={documentId}
      documentName={documentName}
      pdfUrl={pdfUrl}
      userEmail={user?.email}
      userName={user?.user_metadata?.full_name || user?.email?.split('@')[0]}
      onClose={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/vault')}
      onSuccess={() => router.replace('/(tabs)/vault')}
    />
  );
}

const missingStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.slate[50],
    padding: spacing.xl,
    gap: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.slate[900],
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.md,
    borderRadius: 12,
    marginTop: spacing.md,
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});
