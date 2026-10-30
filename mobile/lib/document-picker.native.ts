import * as DocumentPicker from 'expo-document-picker';

type DocumentAsset = {
  uri: string;
  name?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  type?: string | null;
  file?: unknown | null;
};

type DocumentPickerOptions = {
  type?: string[];
  copyToCacheDirectory?: boolean;
  multiple?: boolean;
};

export async function getDocumentAsset(options?: DocumentPickerOptions): Promise<DocumentAsset | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: options?.type ?? ['*/*'],
    copyToCacheDirectory: options?.copyToCacheDirectory ?? true,
    multiple: options?.multiple ?? false,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.name ?? null,
    fileName: asset.name ?? null,
    mimeType: asset.mimeType ?? null,
    type: asset.mimeType ?? null,
  };
}
