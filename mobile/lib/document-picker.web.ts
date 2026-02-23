export type DocumentAsset = {
  uri: string;
  name?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  type?: string | null;
  file?: File | null;
};

type DocumentPickerOptions = {
  type?: string[];
  copyToCacheDirectory?: boolean;
  multiple?: boolean;
};

export async function getDocumentAsset(options?: DocumentPickerOptions): Promise<DocumentAsset | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = options?.multiple ?? false;
    const accept = (options?.type ?? ['*/*']).join(',');
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0] ?? null;
      if (!file) {
        resolve(null);
        return;
      }
      resolve({
        uri: URL.createObjectURL(file),
        name: file.name,
        fileName: file.name,
        mimeType: file.type || null,
        type: file.type || null,
        file,
      });
    };
    input.click();
  });
}
