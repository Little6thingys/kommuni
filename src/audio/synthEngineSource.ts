/** Inline HTML loaded by HiddenAudioEngineWebView; keep in sync with synthEngine.html. */
export const SYNTH_ENGINE_SOURCE = String.raw`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0"
    />
    <title>Kommuni Synth Engine</title>
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: #05050a;
        overflow: hidden;
      }
    </style>
  </head>
  <body>
    <script>
      (function () {
        const BRIDGE = window.ReactNativeWebView;
        const DEFAULT_RELEASE_MS = 520;
        const MASTER_LEVEL = 1.0;
        const DRY_LEVEL = 1.0;
        const VOICE_PEAK_BASE = 0.28;
        const VOICE_PEAK_LATENT = 0.32;
        const VOICE_PEAK_CALM = 0.24;
        const VOICE_SUSTAIN_BASE = 0.14;
        const VOICE_SUSTAIN_LATENT = 0.2;
        const VOICE_SUSTAIN_CALM = 0.15;
        const DRONE_LEVEL_MAX = 1.0;
        const SCALE_MAP = {
          pentatonic: [0, 2, 4, 7, 9],
          chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        };

        let audioContext = null;
        let masterGain = null;
        let filterNode = null;
        let delayNode = null;
        let delayFeedback = null;
        let delayMix = null;
        let dryGain = null;
        let compressor = null;
        let currentScale = 'pentatonic';
        let activeVoices = [];

        let droneGain = null;
        let droneFilter = null;
        let droneOscillators = [];
        let droneActiveTimbre = 'default';
        let droneTarget = { rootMidi: 48, level: 0, filterFreq: 280 };

        function post(message) {
          BRIDGE && BRIDGE.postMessage(JSON.stringify(message));
        }

        function midiToFrequency(note) {
          return 440 * Math.pow(2, (note - 69) / 12);
        }

        function ensureContext() {
          if (!audioContext) {
            const AudioCtor = window.AudioContext || window.webkitAudioContext;
            audioContext = new AudioCtor();

            masterGain = audioContext.createGain();
            masterGain.gain.value = MASTER_LEVEL;

            filterNode = audioContext.createBiquadFilter();
            filterNode.type = 'lowpass';
            filterNode.frequency.value = 620;
            filterNode.Q.value = 0.45;

            delayNode = audioContext.createDelay(1.2);
            delayNode.delayTime.value = 0.14;

            delayFeedback = audioContext.createGain();
            delayFeedback.gain.value = 0.28;

            delayMix = audioContext.createGain();
            delayMix.gain.value = 0.5;

            dryGain = audioContext.createGain();
            dryGain.gain.value = DRY_LEVEL;

            compressor = audioContext.createDynamicsCompressor();
            compressor.threshold.value = -10;
            compressor.knee.value = 12;
            compressor.ratio.value = 2;
            compressor.attack.value = 0.008;
            compressor.release.value = 0.35;

            filterNode.connect(dryGain);
            filterNode.connect(delayNode);
            delayNode.connect(delayFeedback);
            delayFeedback.connect(delayNode);
            delayNode.connect(delayMix);

            dryGain.connect(masterGain);
            delayMix.connect(masterGain);
            masterGain.connect(compressor);
            compressor.connect(audioContext.destination);

            droneFilter = audioContext.createBiquadFilter();
            droneFilter.type = 'lowpass';
            droneFilter.frequency.value = 320;
            droneFilter.Q.value = 0.35;

            droneGain = audioContext.createGain();
            droneGain.gain.value = 0.0001;
            droneFilter.connect(droneGain);
            droneGain.connect(masterGain);
          }

          if (audioContext.state === 'suspended') {
            audioContext.resume().catch(function (error) {
              post({
                type: 'ENGINE_ERROR',
                message: String(error && error.message ? error.message : error),
              });
            });
          }

          return audioContext;
        }

        function quantizeNote(note) {
          const scale = SCALE_MAP[currentScale] || SCALE_MAP.pentatonic;
          const normalized = Math.round(note);
          const octave = Math.floor(normalized / 12);
          const pitchClass = ((normalized % 12) + 12) % 12;

          let best = scale[0];
          let bestDistance = Math.abs(best - pitchClass);

          for (let i = 1; i < scale.length; i += 1) {
            const distance = Math.abs(scale[i] - pitchClass);
            if (distance < bestDistance) {
              best = scale[i];
              bestDistance = distance;
            }
          }

          return octave * 12 + best;
        }

        function clearVoice(voice) {
          try {
            voice.oscillators.forEach(function (oscillator) {
              oscillator.stop();
              oscillator.disconnect();
            });
            voice.gain.disconnect();
          } catch (error) {
            // Nodes can already be stopped during release.
          }
        }

        function stopAllVoices() {
          activeVoices.forEach(clearVoice);
          activeVoices = [];
        }

        function stopDrone() {
          stopDroneOscillators();
          if (droneGain) {
            droneGain.gain.setTargetAtTime(0.0001, ensureContext().currentTime, 0.08);
          }
        }

        function pauseEngine() {
          const context = ensureContext();
          const now = context.currentTime;
          stopAllVoices();
          stopDrone();
          masterGain.gain.cancelScheduledValues(now);
          masterGain.gain.setValueAtTime(Math.max(masterGain.gain.value, 0.0001), now);
          masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
        }

        function resumeEngine() {
          const context = ensureContext();
          const now = context.currentTime;
          masterGain.gain.cancelScheduledValues(now);
          masterGain.gain.setTargetAtTime(MASTER_LEVEL, now, 0.06);
        }

        function stopDroneOscillators() {
          droneOscillators.forEach(function (oscillator) {
            try {
              oscillator.stop();
              oscillator.disconnect();
            } catch (error) {
              // ignore
            }
          });
          droneOscillators = [];
        }

        function setDrone(payload) {
          const context = ensureContext();
          const now = context.currentTime;
          const rootMidi = quantizeNote(payload.rootMidi || 48);
          const level = Math.max(0, Math.min(Number(payload.level) || 0, DRONE_LEVEL_MAX));
          const filterFreq = Math.max(120, payload.filterFreq || 280);
          const timbre =
            payload.timbre === 'gentle'
              ? 'gentle'
              : payload.timbre === 'musicbox'
                ? 'musicbox'
                : 'default';
          const waveType =
            timbre === 'musicbox' ? 'triangle' : 'sine';
          const gainFadeSeconds = timbre === 'gentle' ? 1.25 : 0.45;

          droneTarget = {
            rootMidi: rootMidi,
            level: level,
            filterFreq: filterFreq,
          };

          droneFilter.type = 'lowpass';
          droneFilter.Q.setTargetAtTime(
            timbre === 'gentle' ? 0.1 : timbre === 'musicbox' ? 0.16 : 0.35,
            now,
            0.25
          );
          droneFilter.frequency.setTargetAtTime(filterFreq, now, timbre === 'gentle' ? 0.55 : 0.35);
          droneGain.gain.setTargetAtTime(
            level > 0.001 ? level : 0.0001,
            now,
            gainFadeSeconds
          );

          if (level <= 0.001) {
            stopDroneOscillators();
            droneActiveTimbre = 'default';
            return;
          }

          const frequencies =
            timbre === 'musicbox'
              ? [midiToFrequency(quantizeNote(rootMidi + 12))]
              : timbre === 'gentle'
                ? [midiToFrequency(rootMidi)]
                : [
                    midiToFrequency(rootMidi),
                    midiToFrequency(rootMidi + 7),
                  ];

          if (droneOscillators.length !== frequencies.length || droneActiveTimbre !== timbre) {
            stopDroneOscillators();
            droneActiveTimbre = timbre;
            frequencies.forEach(function (frequency) {
              const oscillator = context.createOscillator();
              oscillator.type = waveType;
              oscillator.frequency.setValueAtTime(frequency, now);
              oscillator.connect(droneFilter);
              oscillator.start(now);
              droneOscillators.push(oscillator);
            });
            return;
          }

          droneOscillators.forEach(function (oscillator, index) {
            oscillator.type = waveType;
            oscillator.frequency.setTargetAtTime(frequencies[index], now, 0.35);
          });
        }

        function ensureAudible() {
          if (masterGain.gain.value < 0.01) {
            resumeEngine();
          }
        }

        function playNote(payload) {
          const startedAt = performance.now();
          const context = ensureContext();
          ensureAudible();
          const now = context.currentTime;
          const calmness = Math.max(0, Math.min(payload.calmness ?? 0.35, 1));
          const latentEnergy = Math.max(0, Math.min(payload.latentEnergy || 0, 1));
          const notes = Array.isArray(payload.notes) ? payload.notes : [];
          const overtones = Array.isArray(payload.overtones) && payload.overtones.length
            ? payload.overtones
            : [1];
          const releaseMs = Math.max(
            220,
            Math.min(payload.releaseMs || DEFAULT_RELEASE_MS, 2400)
          );
          const cutPrevious = payload.cutPrevious !== false;

          filterNode.frequency.setTargetAtTime(
            Math.max(180, payload.filterFreq || 620),
            now,
            0.04
          );

          if (cutPrevious) {
            stopAllVoices();
          }

          notes.forEach(function (rawNote) {
            const note = quantizeNote(rawNote);
            const baseFrequency = midiToFrequency(note);
            const voiceGain = context.createGain();
            voiceGain.gain.setValueAtTime(0.0001, now);

            const oscillators = overtones.map(function (strength, index) {
              const oscillator = context.createOscillator();
              const waveform =
                calmness > 0.45
                  ? 'sine'
                  : calmness > 0.2
                    ? 'triangle'
                    : index === 0
                      ? 'triangle'
                      : 'sine';
              oscillator.type = waveform;
              oscillator.frequency.setValueAtTime(
                baseFrequency * (index === 0 ? 1 : index + 1),
                now
              );
              const partialGain = context.createGain();
              partialGain.gain.setValueAtTime(
                Math.max(0.015, Math.min(Number(strength) || 0, 1)) /
                  Math.max(overtones.length, 1),
                now
              );
              oscillator.connect(partialGain);
              partialGain.connect(voiceGain);
              oscillator.start(now);
              oscillator.stop(now + releaseMs / 1000 + 0.05);
              return oscillator;
            });

            const attack = 0.02 + (1 - calmness) * 0.02;
            const sustain =
              VOICE_SUSTAIN_BASE + latentEnergy * VOICE_SUSTAIN_LATENT + calmness * VOICE_SUSTAIN_CALM;
            const peak =
              VOICE_PEAK_BASE + latentEnergy * VOICE_PEAK_LATENT + calmness * VOICE_PEAK_CALM;

            voiceGain.gain.exponentialRampToValueAtTime(peak, now + attack);
            voiceGain.gain.exponentialRampToValueAtTime(
              Math.max(0.02, sustain),
              now + releaseMs / 1000 - 0.12
            );
            voiceGain.gain.exponentialRampToValueAtTime(
              0.0001,
              now + releaseMs / 1000
            );

            const panStart =
              typeof payload.pan === 'number'
                ? Math.max(-1, Math.min(1, payload.pan))
                : 0;
            const panEnd =
              typeof payload.panEnd === 'number'
                ? Math.max(-1, Math.min(1, payload.panEnd))
                : panStart;
            const panner = context.createStereoPanner();
            panner.pan.setValueAtTime(panStart, now);
            if (panEnd !== panStart) {
              panner.pan.linearRampToValueAtTime(panEnd, now + releaseMs / 1000);
            }

            voiceGain.connect(panner);
            panner.connect(filterNode);

            const voice = {
              gain: voiceGain,
              oscillators: oscillators,
            };

            activeVoices.push(voice);

            window.setTimeout(function () {
              clearVoice(voice);
              activeVoices = activeVoices.filter(function (item) {
                return item !== voice;
              });
            }, releaseMs + 40);
          });

          post({
            type: 'LATENCY_REPORT',
            inferenceMs: 0,
            renderMs: performance.now() - startedAt,
            activeVoices: notes.length,
          });
        }

        function handleMessage(raw) {
          let payload = raw;
          if (typeof payload === 'string') {
            try {
              payload = JSON.parse(payload);
            } catch (error) {
              post({
                type: 'ENGINE_ERROR',
                message: 'Malformed bridge payload',
              });
              return;
            }
          }

          if (!payload || typeof payload.type !== 'string') {
            return;
          }

          if (payload.type === 'PLAY_NOTE') {
            playNote(payload.payload || {});
            return;
          }

          if (payload.type === 'SET_SCALE') {
            currentScale =
              payload.scale === 'chromatic' ? 'chromatic' : 'pentatonic';
            return;
          }

          if (payload.type === 'SET_DRONE') {
            setDrone(payload.payload || {});
            return;
          }

          if (payload.type === 'PAUSE') {
            pauseEngine();
            return;
          }

          if (payload.type === 'RESUME') {
            resumeEngine();
            return;
          }

          if (payload.type === 'STOP') {
            stopAllVoices();
            stopDrone();
            resumeEngine();
          }
        }

        window.addEventListener('message', function (event) {
          handleMessage(event.data);
        });

        document.addEventListener('message', function (event) {
          handleMessage(event.data);
        });

        post({ type: 'BRIDGE_READY' });
      })();
    </script>
  </body>
</html>
`;
