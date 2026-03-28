import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import PdfFieldOverlay from './PdfFieldOverlay';
import FieldPalette from './FieldPalette';
import { FIELD_DEFAULTS } from '../../types/esignature';
import type { PlacedField, SignerEntry, FieldType } from '../../types/esignature';

interface FieldPlacementViewProps {
  pdfUrl: string;
  authToken?: string;
  signers: SignerEntry[];
  fields: PlacedField[];
  onFieldsChange: (fields: PlacedField[]) => void;
  selectedFieldType: FieldType | null;
  onSelectFieldType: (type: FieldType | null) => void;
  selectedSignerEmail: string | null;
}

let fieldIdCounter = 0;

export default function FieldPlacementView({
  pdfUrl,
  authToken,
  signers,
  fields,
  onFieldsChange,
  selectedFieldType,
  onSelectFieldType,
  selectedSignerEmail,
}: FieldPlacementViewProps) {
  const handlePlaceField = useCallback(
    (xPercent: number, yPercent: number, pageNumber: number) => {
      if (!selectedFieldType || !selectedSignerEmail) return;

      const defaults = FIELD_DEFAULTS[selectedFieldType];
      const newField: PlacedField = {
        id: `field_${Date.now()}_${fieldIdCounter++}`,
        signerEmail: selectedSignerEmail,
        fieldType: selectedFieldType,
        pageNumber,
        xPercent: Math.max(0, Math.min(xPercent - defaults.widthPercent / 2, 100 - defaults.widthPercent)),
        yPercent: Math.max(0, Math.min(yPercent - defaults.heightPercent / 2, 100 - defaults.heightPercent)),
        widthPercent: defaults.widthPercent,
        heightPercent: defaults.heightPercent,
      };

      onFieldsChange([...fields, newField]);
    },
    [selectedFieldType, selectedSignerEmail, fields, onFieldsChange]
  );

  const handleDeleteField = useCallback(
    (fieldId: string) => {
      onFieldsChange(fields.filter((f) => f.id !== fieldId));
    },
    [fields, onFieldsChange]
  );

  const handleMoveField = useCallback(
    (fieldId: string, deltaXPercent: number, deltaYPercent: number) => {
      onFieldsChange(
        fields.map((f) => {
          if (f.id !== fieldId) return f;
          return {
            ...f,
            xPercent: Math.max(0, Math.min(f.xPercent + deltaXPercent, 100 - f.widthPercent)),
            yPercent: Math.max(0, Math.min(f.yPercent + deltaYPercent, 100 - f.heightPercent)),
          };
        })
      );
    },
    [fields, onFieldsChange]
  );

  return (
    <View style={styles.container}>
      {/* Field type palette */}
      <FieldPalette
        selectedFieldType={selectedFieldType}
        onSelectFieldType={onSelectFieldType}
      />

      {/* PDF with field overlays — flex:1 ensures it fills remaining space without overflow */}
      <View style={{ flex: 1, overflow: 'hidden' }}>
      <PdfFieldOverlay
        pdfUrl={pdfUrl}
        authToken={authToken}
        mode="placement"
        placedFields={fields}
        signers={signers}
        selectedFieldType={selectedFieldType}
        selectedSignerEmail={selectedSignerEmail}
        onPlaceField={handlePlaceField}
        onDeleteField={handleDeleteField}
        onMoveField={handleMoveField}
      />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
