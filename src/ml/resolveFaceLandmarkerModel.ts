import { Asset } from 'expo-asset';
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';

const MODEL_FILE_NAME = 'face_landmarker.task';

let cachedPath: string | null = null;
let inflight: Promise<string> | null = null;

export function isResolvedNativeAssetPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^(file:\/\/|content:\/\/|\/|[A-Za-z]:\\)/.test(value)
  );
}

/** MediaPipe native code on Android expects a plain filesystem path. */
export function normalizeModelPathForMediaPipe(uri: string): string {
  if (uri.startsWith('file://')) {
    return decodeURI(uri.replace('file://', ''));
  }

  return uri;
}

async function copyModelToDocumentDirectory(sourceUri: string): Promise<string> {
  const destination = new File(Paths.document, MODEL_FILE_NAME);

  if (destination.exists) {
    return destination.uri;
  }

  const source = new File(sourceUri);
  const bytes = await source.arrayBuffer();

  if (destination.exists) {
    destination.delete();
  }

  destination.create();
  destination.write(new Uint8Array(bytes));

  return destination.uri;
}

/** Resolves face_landmarker.task to a native-readable file:// URI for MediaPipe. */
export async function resolveFaceLandmarkerModelPath(): Promise<string> {
  if (cachedPath && isResolvedNativeAssetPath(cachedPath)) {
    return cachedPath;
  }

  if (inflight) {
    return inflight;
  }

  inflight = (async () => {
    const configured =
      (Constants.expoConfig?.extra?.faceLandmarkerModelPath as string | undefined) ?? null;

    if (isResolvedNativeAssetPath(configured)) {
      cachedPath = configured;
      return configured;
    }

    const [asset] = await Asset.loadAsync(
      require('../../assets/models/face_landmarker.task'),
    );
    const sourceUri = asset.localUri ?? asset.uri;

    if (!sourceUri) {
      throw new Error('Face landmarker asset could not be loaded from the app bundle.');
    }

    const resolvedPath = await copyModelToDocumentDirectory(sourceUri);
    cachedPath = resolvedPath;
    return resolvedPath;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
