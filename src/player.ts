import * as mm from "@magenta/music";
const Tone = mm.Player.tone;
import MMLIterator from "mml-iterator";

export type Player = {
  melodyMml?: string;
  bassMml?: string;
  melodySequence?: mm.NoteSequence;
  bassSequence?: mm.NoteSequence;
  melodyPart?;
  bassPart?;
  melodyVisualizer?: mm.PianoRollCanvasVisualizer;
  bassVisualizer?: mm.PianoRollCanvasVisualizer;
  isPlaying: boolean;
  melodyCanvas: HTMLCanvasElement;
  bassCanvas: HTMLCanvasElement;
  melodyMmlInput?: HTMLInputElement;
  bassMmlInput?: HTMLInputElement;
  playButton: HTMLButtonElement;
};

const musicSpeed = 0.12;
const stepsPerQuarter = 4;
const notesStepsCount = 32;
let isStarted = false;
let melodySynth;
let bassSynth;

export function init() {
  initSynth();
  Tone.Transport.start();
}

export function start() {
  if (isStarted) {
    return;
  }
  isStarted = true;
  Tone.start();
}

export function get(
  melodyCanvas: HTMLCanvasElement,
  bassCanvas: HTMLCanvasElement,
  melodyMmlInput: HTMLInputElement,
  bassMmlInput: HTMLInputElement,
  playButton: HTMLButtonElement
): Player {
  const player: Player = {
    isPlaying: false,
    melodyCanvas,
    bassCanvas,
    melodyMmlInput,
    bassMmlInput,
    playButton,
  };
  return player;
}

export function setMml(player: Player, melodyMml: string, bassMml: string) {
  player.melodyMmlInput.value = melodyMml;
  player.bassMmlInput.value = bassMml;
  recreateSequence(player);
}

export function recreateSequence(player: Player) {
  player.melodyMml = player.melodyMmlInput.value;
  player.bassMml = player.bassMmlInput.value;
  setMelodySequence(player, createSequence(player.melodyMml));
  setBassSequence(player, createSequence(player.bassMml));
}

export function checkMml(player: Player) {
  if (
    player.melodyMml == null ||
    player.melodyMml !== player.melodyMmlInput.value
  ) {
    player.melodyMml = player.melodyMmlInput.value;
    setMelodySequence(player, createSequence(player.melodyMml));
  }
  if (player.bassMml == null || player.bassMml !== player.bassMmlInput.value) {
    player.bassMml = player.bassMmlInput.value;
    setBassSequence(player, createSequence(player.bassMml));
  }
  if (
    player.melodySequence.totalTime === 0 &&
    player.melodySequence.totalQuantizedSteps === 0 &&
    player.bassSequence.totalTime === 0 &&
    player.bassSequence.totalQuantizedSteps === 0
  ) {
    player.melodyMml = player.bassMml = undefined;
    player.melodyMmlInput.value = player.bassMmlInput.value = "";
    return false;
  }
  return true;
}

export function setMelodySequence(
  player: Player,
  melody: mm.NoteSequence,
  speed = musicSpeed
) {
  player.melodySequence = melody;
  player.melodyVisualizer = getVisualizer(
    melody,
    player.melodyCanvas,
    "100, 200, 100"
  );
  player.melodyPart = getPart(
    melody,
    melodySynth,
    speed,
    0.03,
    player.melodyVisualizer
  );
  player.melodyMml = player.melodyMmlInput.value = sequenceToMml(
    player.melodySequence
  );
}

export function setBassSequence(
  player: Player,
  bass: mm.NoteSequence,
  speed = musicSpeed
) {
  player.bassSequence = bass;
  player.bassVisualizer = getVisualizer(
    bass,
    player.bassCanvas,
    "100, 100, 200"
  );
  player.bassPart = getPart(
    bass,
    bassSynth,
    speed,
    0.12,
    player.bassVisualizer
  );
  player.bassMml = player.bassMmlInput.value = sequenceToMml(
    player.bassSequence
  );
}

export function playStopToggle(player: Player) {
  (player.isPlaying ? stop : play)(player);
}

export function play(player: Player) {
  if (player.isPlaying) {
    return;
  }
  if (!checkMml(player)) {
    return;
  }
  player.isPlaying = true;
  const now = Tone.now();
  melodySynth.toDestination();
  bassSynth.toDestination();
  player.melodyPart.start(now);
  player.bassPart.start(now);
  player.playButton.textContent = "Stop";
}

export function stop(player: Player) {
  if (!player.isPlaying) {
    return;
  }
  player.isPlaying = false;
  player.melodyPart.stop();
  player.bassPart.stop();
  melodySynth.disconnect();
  bassSynth.disconnect();
  if (player.melodyVisualizer != null) {
    player.melodyVisualizer.redraw();
  }
  if (player.bassVisualizer != null) {
    player.bassVisualizer.redraw();
  }
  player.playButton.textContent = "Play";
}

function createSequence(mml: string) {
  return mm.sequences.quantizeNoteSequence(mmlToSequence(mml), stepsPerQuarter);
}

function mmlToSequence(mml) {
  let endTime = 0;
  const notes = [];
  const iter = new MMLIterator(mml);
  for (let ne of iter) {
    if (ne.type === "note") {
      endTime = ne.time + ne.duration;
      notes.push({ pitch: ne.noteNumber, startTime: ne.time, endTime });
      if (endTime >= 4) {
        break;
      }
    }
  }
  return { notes, totalTime: endTime };
}

const durationToNoteLength = [
  "",
  "16",
  "8",
  "8.",
  "4",
  "4",
  "4.",
  "4.",
  "2",
  "2",
  "2",
  "2",
  "2.",
  "2.",
  "2.",
  "2.",
  "1",
];

function sequenceToMml(seq: mm.NoteSequence) {
  const notes = seq.notes.map((n) => {
    return {
      ...midiNoteNumberToMml(n.pitch),
      start: n.quantizedStartStep,
      duration: n.quantizedEndStep - n.quantizedStartStep,
    };
  });
  const octaveFreq = [];
  const durationFreq = [];
  for (let i = 0; i < 32; i++) {
    octaveFreq.push(0);
    durationFreq.push(0);
  }
  let prevEndStep = 0;
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (n.start > prevEndStep) {
      let duration = n.start - prevEndStep;
      if (duration > notesStepsCount / 2) {
        duration = notesStepsCount / 2;
      }
      notes.splice(i, 0, {
        octave: 0,
        note: "r",
        start: prevEndStep,
        duration,
      });
      i++;
    }
    prevEndStep = n.start + n.duration;
    octaveFreq[n.octave]++;
    if (n.duration > notesStepsCount / 2) {
      n.duration = notesStepsCount / 2;
    }
    durationFreq[n.duration]++;
  }
  let baseOctave = 4;
  let maxOctaveFreq = 0;
  let baseDuration = 2;
  let maxDurationFreq = 0;
  for (let i = 0; i < notesStepsCount / 2; i++) {
    if (octaveFreq[i] > maxOctaveFreq) {
      maxOctaveFreq = octaveFreq[i];
      baseOctave = i;
    }
    if (durationFreq[i] > maxDurationFreq) {
      maxDurationFreq = durationFreq[i];
      baseDuration = i;
    }
  }
  let octave = baseOctave;
  let nextSpaceDuration = 8;
  return `l${durationToNoteLength[baseDuration]} o${baseOctave} ${notes
    .map((n) => {
      let s = "";
      if (n.start >= nextSpaceDuration) {
        s += " ";
        nextSpaceDuration += 8;
      }
      if (n.octave > 0) {
        while (n.octave < octave) {
          s += "<";
          octave--;
        }
        while (n.octave > octave) {
          s += ">";
          octave++;
        }
      }
      s += n.note;
      if (n.duration !== baseDuration) {
        s += `${durationToNoteLength[n.duration]}`;
      }
      return s;
    })
    .join("")}`;
}

const midiNumberToNoteStr = [
  "c",
  "c+",
  "d",
  "d+",
  "e",
  "f",
  "f+",
  "g",
  "g+",
  "a",
  "a+",
  "b",
];

function midiNoteNumberToMml(n: number) {
  let octave = Math.floor(n / 12) - 1;
  if (octave < 1) {
    octave = 1;
  } else if (octave > 8) {
    octave = 8;
  }
  const note = midiNumberToNoteStr[n % 12];
  return { octave, note };
}

function getPart(
  seq: mm.NoteSequence,
  synth,
  speed: number,
  volume: number,
  visualizer: mm.PianoRollCanvasVisualizer,
  notesSteps = notesStepsCount
) {
  const part = new Tone.Part(
    (time, value) => {
      synth.triggerAttackRelease(value.freq, value.duration, time, volume);
      visualizer.redraw(seq.notes[value.index]);
    },
    seq.notes.map((s, index) => {
      return {
        time: s.quantizedStartStep * speed,
        freq: pitchToFreq(s.pitch),
        duration:
          (s.quantizedEndStep - s.quantizedStartStep) * speed - speed / 4,
        index,
      };
    })
  );
  part.loopStart = 0;
  part.loopEnd = notesSteps * speed;
  part.loop = true;
  return part;
}

function getVisualizer(
  seq: mm.NoteSequence,
  canvas: HTMLCanvasElement,
  noteRGB: string
) {
  if (seq.totalTime === 0 && seq.totalQuantizedSteps === 0) {
    return;
  }
  return new mm.PianoRollCanvasVisualizer(seq, canvas, {
    noteHeight: 9,
    noteRGB,
    noteSpacing: 1,
    pixelsPerTimeStep: 87,
  });
}

function initSynth() {
  melodySynth = new Tone.Synth({
    oscillator: { type: "square" },
    envelope: {
      attack: 0,
      decay: 99,
      sustain: 1,
    },
  }).toDestination();
  bassSynth = new Tone.Synth({
    oscillator: { type: "triangle" },
    envelope: {
      attack: 0,
      decay: 99,
      sustain: 1,
    },
  }).toDestination();
}

function pitchToFreq(pitch) {
  return 440 * Math.pow(2, (pitch - 69) / 12);
}
