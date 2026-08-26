# Kommuni — Full-Stack Build Prompt for Cursor

## Role
You are building a **100% complete, runnable Expo (React Native) application** called **Kommuni** — an Edge ML/HCI research prototype for real-time multimodal music-based social interaction. Implement both the **UI** and the **on-device AI model calls/inference pipeline**. Do not simplify away any of the phases, modules, or metrics described below. Where a native capability requires a custom dev client instead of Expo Go, set that up correctly (EAS Build / `expo prebuild`).

---

## 1. Project Summary (do not alter scope)

Kommuni is an Edge ML/HCI research initiative tackling three problems in real-time multimodal interaction: high audio latency, lack of music theory constraints, and poor individual adaptability. It is an **on-device Multimodal Adaptive Generative Music AI Framework** in a mobile app, running a closed-loop pipeline from **De-escalation → Social Bridge**, for high sensory stress and non-verbal communication contexts.

- **Phase 1 — Latent Representation & Expressive Mapping:** A 1D-CNN-VAE extracts latent representations of user touch dynamics. An adaptive music theory mapping algorithm transforms high-stress touch actions in real time into soothing music constrained to a consonance envelope.
- **Phase 2 — Dyadic Generative Harmonization & Cross-Attention:** Once de-escalation is detected, the system moves to dyadic interaction. A multimodal Cross-Attention network + a lightweight generative harmonization model ("Adaptive HarmoniNet"), combined with gaze/head-pose tracking, predicts and generates complementary dyadic harmonies in real time.
- **Edge ML Optimization:** Runs 100% locally on-device. INT8 quantization + low-level audio pipeline optimization target **<15ms model inference** and **<35ms end-to-end audio feedback latency**, preserving privacy under COPPA/HIPAA (no data leaves the device except encrypted local export).

---

## 2. Confirmed Technical Decisions (binding constraints for this build)

| Decision Area | Choice |
|---|---|
| Platform / stack | **Cross-platform via Expo**, using an **Expo Dev Client** (custom native build via `expo prebuild` + EAS Build) — NOT Expo Go, because native modules are required |
| ML models | **Real model architectures** (1D-CNN-VAE, Adaptive HarmoniNet, Cross-Attention fusion) fully wired into the app and callable end-to-end, trained/tested on **synthetic data** (no real user data collection required for this build) |
| ML inference | **100% on-device** — TensorFlow.js (`@tensorflow/tfjs` + `@tensorflow/tfjs-react-native`) or ONNX Runtime React Native, no external AI/LLM API calls of any kind |
| Gaze / head-pose tracking | **`react-native-mediapipe`** (community RN wrapper around MediaPipe Face Landmarker, built on React Native Vision Camera) running inside the **Expo Dev Client**. Must extract 468-point face landmarks + iris vectors and head pose in real time. |
| Audio synthesis | **WebView-hosted Web Audio API engine** — a hidden/embedded WebView running a parametric synthesizer in JS, bridged to React Native via `postMessage`/`onMessage`, to achieve true real-time parametric synthesis (oscillators, envelopes, filters) rather than pre-rendered samples |
| Data export | Local encrypted JSON/CSV log export, on-device only |

---

## 3. Full User Journey to Implement (all phases, no phase omitted)

`[Environment Setup]` → `[Phase 1: Touch Representation & AI Smoothing]` → `[FSM Hidden State Transition]` → `[Phase 2: Multimodal Generative Harmonies]` → `[Progressive Data Assessment]`

### 3.1 Setup Phase
- Two participants sit face-to-face across a tablet/phone and launch Kommuni.
- Zero wearable sensors. App requests front-camera permission.
- On launch, concurrently initialize: (a) the lightweight on-device ML models, and (b) the WebView audio synthesis engine, in the background, with a loading/readiness UI state for each.

### 3.2 Phase 1 — Emotional Representation & Generative De-escalation
- **Trigger:** a single participant in a high-stress state freely scribbles/swipes/taps on the screen (implement a full-screen touch canvas capturing continuous touch events).
- **Real-time AI/ML response:**
  - *Touch Dynamics Feature Extraction:* a 1D-CNN extracts stroke velocity (v), acceleration (a), and trajectory curvature variance from the live touch stream in real time.
  - *Generative Music Synthesis & Masking:* a 1D-CNN-VAE maps these temporal features into an emotional latent space; the latent vector feeds the procedural audio synthesizer (WebView Web Audio engine). A **Music Theory Mask Layer** post-processes generated notes to smooth chaotic movement into resolving intervals and pentatonic scales.
- **Visual representation:** implement a real-time visual (e.g., animated gradient/particle canvas) reflecting touch intensity and the emotional latent state — this was specified as a visual element in the source doc and must be present, even though the doc did not fully detail its look; use your judgment for a calming, responsive visualization tied to the same latent vector driving the audio.

### 3.3 Adaptive Phase Transition (FSM & ML Threshold Decision)
- Implement a **Finite State Machine (FSM)** that ingests probabilistic outputs from the touch dynamics model.
- Transition to Phase 2 once stroke velocity and acceleration remain within a **"Patience Baseline"** for **5 consecutive seconds**.
- UI: the interface gradient smoothly expands from single-player to a two-player canvas as harmonic parameters hand off to Phase 2.

### 3.4 Phase 2 — Multimodal Generative Harmonization & Joint Attention Reinforcement
- **Dyadic call-and-response:** Participant A taps a rhythm; Participant B responds. **Adaptive HarmoniNet** calculates rhythmic tension and interval offsets, probabilistically auto-completing complementary chords aligned with acoustic consonance rates.
- **Cross-Attention gaze coupling:**
  - Front camera + `react-native-mediapipe` extracts dyadic iris vectors and head-pose landmarks (468 points) in real time.
  - *Positive Social Reinforcement:* when mutual gaze/joint attention is detected (gaze angle < 20°), gaze features are fed as weights into the **Cross-Attention module**, immediately triggering overtone expansion and higher-dimensional harmonic generation in the audio synth as an instant musical reward.

### 3.5 Data & Log Phase
- Automatically export local **encrypted logs in JSON/CSV** recording: latency, consonance rates, cumulative joint attention frequency, and duration.
- Provide an in-app screen to view/export these logs (share sheet or local file save), suitable for later offline analysis in Python (SciPy) or R — the app itself does not need to run that analysis.

---

## 4. System Architecture — Modules to Implement (build each as a distinct, testable unit)

| # | Module | Core Algorithm / ML Technique | On-Device Deployment | Target Performance (build to hit these, log actual results) |
|---|---|---|---|---|
| 1 | Touch Dynamics VAE | 1D-CNN + VAE for feature extraction & emotional latent-space mapping | TFJS/ONNX, INT8-quantized where supported | Inference <1ms, CPU usage <1% |
| 2 | Dyadic Gaze & Pose Extractor | MediaPipe Face Landmarker (468 keypoints + iris vectors) via `react-native-mediapipe` | Native module in Expo Dev Client, GPU/NPU accelerated | 30–60 FPS real-time pose/gaze vectors |
| 3 | Adaptive HarmoniNet | Lightweight RNN / Markov Chain + differentiable Music Theory Mask | On-device (TFJS/native TS logic) | Inference <5ms, consonance rate >95% |
| 4 | Multimodal Fusion Engine | Cross-Attention mechanism fusing gaze vectors & musical parameters | On-device JS/TS vector engine | Vector computation <1ms |
| 5 | Low-Latency Audio Engine | WebView-hosted Web Audio API parametric real-time synthesizer, bridged to RN | WebView + postMessage bridge | End-to-end latency <35ms (model <15ms) |

Implement each module as an isolated, independently testable service/hook (e.g., `useTouchDynamicsVAE`, `useGazeTracking`, `useHarmoniNet`, `useCrossAttentionFusion`, `useAudioEngine`) so they can be unit-tested with synthetic inputs before wiring into the full pipeline.

---

## 5. Research/Validation Instrumentation to Build In

Even though this build does not need to run real studies, the app's **instrumentation must support** the project's validation strategy — implement logging/metrics hooks for:

- **Tier 1 (System Benchmark, N_sim = 1,000):** a dev-mode automated test harness that feeds 1,000 synthetic touch/gaze interaction profiles through the pipeline and reports inference latency (<15ms), end-to-end latency (<35ms), quantized model size, and consonance rate (>90%).
- **Tier 2 (Neurotypical User Study, N = 15 pairs):** the live app must log per-session joint attention duration/frequency, Rhythmic Synchrony Index (RSI), and de-escalation time (touch dynamics recovery to baseline), tagged by condition (Static/Traditional vs. Kommuni Closed-Loop; Unconstrained Tone vs. Adaptive Harmonization) to support a 2×2 within-subject design later.
- **Tier 3 (Clinical Exploratory Pilot, N = 1–2):** ensure the exported logs are structured cleanly enough to support qualitative case-study review (observation logs, timestamps, consonance/joint-attention time series).

Build a small **"Benchmark Mode"** screen in the app that runs the Tier 1 synthetic stress test and displays pass/fail against the H1 thresholds (<35ms end-to-end latency, <15% CPU usage, >90% consonance rate).

---

## 6. Non-Negotiable Performance & Compliance Targets

- Model inference: **<15ms**
- End-to-end audio feedback latency: **<35ms**
- CPU usage under load: **<15%**
- Consonance rate: **>90%** (module 3 target internally >95%)
- Patience Baseline hold time for FSM transition: **5 consecutive seconds**
- Mutual gaze detection threshold: **gaze angle < 20°**
- All processing on-device; **no data leaves the device** except user-initiated encrypted export — must be COPPA/HIPAA-consistent (no third-party analytics/AI API calls).

---

## 7. Deliverables Expected From Cursor

1. Full Expo + TypeScript project scaffold, configured for a **Dev Client build** (`app.json`/`app.config.ts`, EAS config, required native permissions for camera/microphone).
2. All 5 architecture modules implemented as real, callable code (not stubs) operating on synthetic data generators you create.
3. Full screen flow: Setup → Phase 1 canvas → FSM-driven transition animation → Phase 2 dyadic screen → Data/Log screen, plus the Benchmark Mode screen.
4. The WebView Web Audio bridge, with a defined message protocol between RN and the WebView synth (e.g., `{type: 'PLAY_NOTE', latent, mask}`).
5. The `react-native-mediapipe` + Vision Camera integration wired into Phase 2, with a documented fallback UI state if camera permission is denied.
6. A README covering: how to run (`expo prebuild`, EAS dev build steps, since Expo Go will not work), architecture overview, and how to run Benchmark Mode.
7. Basic unit tests for each module's synthetic-data path (latency + output shape assertions matching the targets in Section 6).

---

## 8. Instructions to Cursor

Build this iteratively in the following order, confirming each step compiles/runs before proceeding:
1. Project scaffold + navigation shell (Setup → Phase 1 → Transition → Phase 2 → Data Log → Benchmark Mode).
2. WebView Web Audio engine + RN bridge, tested with a hardcoded note sequence.
3. Touch canvas + 1D-CNN feature extraction + VAE latent mapping + Music Theory Mask, wired to the audio engine (complete Phase 1 loop).
4. FSM threshold logic and transition animation.
5. `react-native-mediapipe` gaze/pose integration (Dev Client build required from this point on).
6. Adaptive HarmoniNet + Cross-Attention fusion, wired to audio engine (complete Phase 2 loop).
7. Data/log export screen + Benchmark Mode synthetic test harness.
8. Final pass: verify all Section 6 targets are instrumented and visibly reported somewhere in the app (e.g., a debug overlay).

Do not add features beyond this spec, and do not omit any module, phase, or metric listed above.
