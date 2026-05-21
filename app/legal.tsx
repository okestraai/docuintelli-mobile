import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import {
  PRIVACY_CONTENT,
  TERMS_CONTENT,
  COOKIES_CONTENT,
  FAQ_CONTENT,
  type LegalSection,
  type FaqItem,
} from '../src/content/legalContent';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius } from '../src/theme/spacing';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PAGE_CONFIG: Record<string, { title: string; sections?: LegalSection[]; faq?: FaqItem[] }> = {
  privacy: { title: 'Privacy Policy', sections: PRIVACY_CONTENT },
  terms: { title: 'Terms of Service', sections: TERMS_CONTENT },
  cookies: { title: 'Cookie Policy', sections: COOKIES_CONTENT },
  faq: { title: 'FAQ', faq: FAQ_CONTENT },
};

function SectionRenderer({ sections }: { sections: LegalSection[] }) {
  return (
    <>
      {sections.map((section, i) => (
        <View key={i} style={styles.section}>
          <Text style={styles.sectionHeading}>{section.heading}</Text>
          <Text style={styles.sectionBody}>{section.body}</Text>
        </View>
      ))}
    </>
  );
}

function FaqRenderer({ items }: { items: FaqItem[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <>
      {items.map((item, i) => {
        const isOpen = expanded.has(i);
        return (
          <TouchableOpacity
            key={i}
            style={styles.faqItem}
            onPress={() => toggle(i)}
            activeOpacity={0.7}
          >
            <View style={styles.faqHeader}>
              <Text style={styles.faqQuestion}>{item.question}</Text>
              <ChevronDown
                size={18}
                color={colors.slate[400]}
                strokeWidth={2}
                style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
              />
            </View>
            {isOpen && <Text style={styles.faqAnswer}>{item.answer}</Text>}
          </TouchableOpacity>
        );
      })}
    </>
  );
}

export default function LegalScreen() {
  const { page } = useLocalSearchParams<{ page: string }>();
  const config = PAGE_CONFIG[page || ''] || PAGE_CONFIG.privacy;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: config.title }} />
      <View style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {config.sections && <SectionRenderer sections={config.sections} />}
          {config.faq && <FaqRenderer items={config.faq} />}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },

  // Sections (Privacy, Terms, Cookies)
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeading: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.slate[900],
    marginBottom: spacing.sm,
  },
  sectionBody: {
    fontSize: typography.fontSize.base,
    color: colors.slate[600],
    lineHeight: 24,
  },

  // FAQ
  faqItem: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate[100],
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  faqQuestion: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[900],
  },
  faqAnswer: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
    lineHeight: 22,
  },
});
