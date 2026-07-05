export type DocumentAsset = {
  uri: string;
  name?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  type?: string | null;
  file?: unknown | null;
};

export type DocumentPickerOptions = {
  type?: string[];
  copyToCacheDirectory?: boolean;
  multiple?: boolean;
};

export function getDocumentAsset(options?: DocumentPickerOptions): Promise<DocumentAsset | null>;
