export type AudioParams = {
  notes: number[];
  overtones: number[];
  filterFreq: number;
  latentEnergy: number;
  /** Note tail length — longer when the child is calming down. */
  releaseMs?: number;
  /** When false, new notes overlap for legato pads. */
  cutPrevious?: boolean;
  /** 0 = aroused venting, 1 = resolved calm (MelodyBridge). */
  calmness?: number;
  /** Stereo pan -1 (left) to 1 (right). */
  pan?: number;
  /** Optional pan glide target over the note release. */
  panEnd?: number;
};

export type DroneTimbre = 'default' | 'musicbox' | 'gentle';

export type DroneParams = {
  rootMidi: number;
  level: number;
  filterFreq: number;
  /** Phase 2: `gentle` = single soft sine; `musicbox` = legacy bright hum. */
  timbre?: DroneTimbre;
};

export type AudioScale = 'pentatonic' | 'chromatic';

export type AudioEngineStatus = 'idle' | 'loading' | 'ready' | 'error';

export type AudioEngineLatencyReport = {
  type: 'LATENCY_REPORT';
  inferenceMs: number;
  renderMs: number;
  activeVoices: number;
};

export type AudioEngineReadyEvent = {
  type: 'BRIDGE_READY';
};

export type AudioEngineErrorEvent = {
  type: 'ENGINE_ERROR';
  message: string;
};

export type AudioEngineEvent =
  | AudioEngineLatencyReport
  | AudioEngineReadyEvent
  | AudioEngineErrorEvent;

export type AudioEnginePlayMessage = {
  type: 'PLAY_NOTE';
  payload: AudioParams;
};

export type AudioEngineScaleMessage = {
  type: 'SET_SCALE';
  scale: AudioScale;
};

export type AudioEngineStopMessage = {
  type: 'STOP';
};

export type AudioEnginePauseMessage = {
  type: 'PAUSE';
};

export type AudioEngineResumeMessage = {
  type: 'RESUME';
};

export type AudioEngineDroneMessage = {
  type: 'SET_DRONE';
  payload: DroneParams;
};

export type AudioEngineMessage =
  | AudioEnginePlayMessage
  | AudioEngineScaleMessage
  | AudioEngineStopMessage
  | AudioEnginePauseMessage
  | AudioEngineResumeMessage
  | AudioEngineDroneMessage;

export type GazeSnapshot = {
  gazeAngle: number;
  /** Vertical iris offset in degrees (positive = looking down). */
  gazePitch?: number;
  isJointAttention: boolean;
  headPose: {
    yaw: number;
    pitch: number;
    roll: number;
  };
};

export type TouchLatent = {
  z: Float32Array;
  stressLevel: number;
};

export type HarmoniNetOutput = {
  chordNotes: number[];
  /** 12-dim pitch-class activation vector for cross-attention query. */
  chordVector: Float32Array;
  tension: number;
};

export type FusionOutput = {
  audioParams: AudioParams;
  rewardTriggered: boolean;
};

export type MetricKind =
  | 'inference'
  | 'audio_latency'
  | 'consonance'
  | 'benchmark';

export type MetricEntry = {
  id: string;
  timestamp: string;
  kind: MetricKind;
  payload: Record<string, number | string | boolean>;
};

export type PhaseState = 'LOADING' | 'PHASE1' | 'PATIENCE' | 'PHASE2' | 'DATALOG';
