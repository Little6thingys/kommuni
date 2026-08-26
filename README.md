# Kommuni

On-device research prototype for real-time multimodal music interaction. Expo SDK 57 (React Native 0.86), TypeScript, Expo Router.

**Expo Go will not work.** Gaze tracking, Vision Camera frame processors, ONNX Runtime, and the MediaPipe landmarker require a native dev client (EAS development build or `expo prebuild` + local run).

## How to run

```sh
npm install
# If npm reports ERESOLVE on react / react-dom peers:
# npm install --legacy-peer-deps
```

Download Google’s MediaPipe `face_landmarker.task` into `assets/models/face_landmarker.task` (gitignored). The app still boots without it — Phase 2 falls back to mocked gaze (`gazeAngle: 25`) until a native-readable path exists.

Then generate native projects and install a development build:

```sh
npx expo prebuild --clean
eas build -p android --profile development
# or locally:
npx expo run:android
# npx expo run:ios
```

Start Metro against that client:

```sh
npx expo start --dev-client
```

EAS profiles live in `eas.json` (`development`, `preview`, `production`).

### Tests and typecheck

```sh
npm test
npm run typecheck
```

## Architecture

```
Touch canvas  →  1D-CNN-VAE (z ∈ R^8, stress)
                      ↓
              Music theory mask → WebView synth
                      ↓
              FSM (5s calm patience) → Phase 2
                      ↓
Gaze (MediaPipe / mock) + HarmoniNet + dyadic taps
                      ↓
              Cross-attention fusion → WebView synth
                      ↓
              MetricsStore → Data Log / Benchmark
```

| Module | Role |
| --- | --- |
| Touch Dynamics VAE | 32×5 rolling window → 8-dim latent `z` + `stressLevel` |
| Gaze tracking | Face landmarker / camera fallback → `gazeAngle`, joint attention, head pose |
| HarmoniNet | Markov + lightweight RNN → chord notes + 12-dim chord vector |
| Cross-attention | Chord query × gaze key/value → `AudioParams` + reward flag |
| Audio engine | Hidden WebView Web Audio synth (`PLAY_NOTE` / `SET_SCALE` / `STOP`) |

Screens: Setup (`app/index.tsx`) → Phase 1 touch → Phase 2 dyadic → Data Log. Benchmark Mode is a separate harness screen.

Phase 1 writes the live VAE vector into a tiny session store (`src/session/phaseLatentStore.ts`). Phase 2 HarmoniNet reads that vector instead of a hardcoded default.

## Benchmark Mode

`app/benchmark.tsx` runs 1,000 synthetic touch/gaze profiles through VAE → HarmoniNet → music-theory mask → cross-attention. Pass/fail (plan §6):

- Inference **&lt; 15 ms**
- End-to-end **&lt; 35 ms** (inference + estimated WebView render)
- CPU proxy **&lt; 15%** of a 60 fps frame
- Consonance **&gt; 90%** after the pentatonic mask

The same thresholds are asserted in `npm test` (`__tests__/pipelineLatency.test.ts` and per-module tests).

## Native MediaPipe / `face_landmarker.task`

`react-native-mediapipe` has no Expo config plugin. After prebuild you still need:

1. `assets/models/face_landmarker.task` on disk
2. A **native file/content URI** (not the bundle-relative extra `./assets/models/face_landmarker.task` in `app.config.ts`)
3. Android/iOS detector wiring in the generated native projects

Until those exist, `useGazeTracking` keeps a visible fallback banner and mocked features so Phase 2 remains testable.

## ONNX vs pure-TS encoder

The plan’s ONNX graph (`assets/models/touch_vae.ort` via `onnxruntime-react-native`) is **not** executed yet. `src/ml/modelBuilder.ts` only returns artifact paths; `src/ml/touchVAE.ts` is a **pure TypeScript** synthetic 1D-CNN-VAE encoder (target &lt; 1 ms). HarmoniNet and cross-attention are also pure TS. Swap in a real `.ort` session later without changing the screen loop.
