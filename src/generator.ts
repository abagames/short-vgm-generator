import * as mm from "@magenta/music";

const notesStepsCount = 32;
let musicRnn: mm.MusicRNN;

export function init() {
  musicRnn = new mm.MusicRNN(
    "https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/melody_rnn"
  );
  return musicRnn.initialize();
}

export async function generate(
  melodyOrigin: mm.NoteSequence,
  baseOrigin: mm.NoteSequence,
  progressBar: HTMLDivElement,
  rnnRepeatCount = 2,
  rnnTemperature = 0.99,
  isCorrectingDiscordance = true,
  notesSteps = notesStepsCount
) {
  let melody = melodyOrigin;
  let base = baseOrigin;
  for (let i = 0; i < rnnRepeatCount; i++) {
    const [nextMelody, nextBase] = await Promise.all([
      musicRnn.continueSequence(melody, notesSteps, rnnTemperature),
      musicRnn.continueSequence(base, notesSteps, rnnTemperature),
    ]);
    progressBar.style.width = `${((i + 1) / rnnRepeatCount) * 80 + 10}%`;
    melody = nextMelody as mm.NoteSequence;
    base = nextBase as mm.NoteSequence;
  }
  const offset = Math.floor(Math.random() * 11) - 5;
  shiftPitch(melody, offset);
  shiftPitch(base, offset);
  if (isCorrectingDiscordance) {
    removeDiscordance(melody, base, notesSteps);
  }
  addTime(melody);
  addTime(base);
  return [melody, base];
}

function removeDiscordance(
  s1: mm.NoteSequence,
  s2: mm.NoteSequence,
  notesSteps: number
) {
  const n1 = s1.notes;
  const n2 = s2.notes;
  let p1: number;
  let p2: number;
  let i1 = 0;
  let i2 = 0;
  for (let step = 0; step < notesSteps; step++) {
    if (i1 < n1.length && n1[i1].quantizedEndStep === step) {
      p1 = undefined;
      i1++;
    }
    if (i1 < n1.length && n1[i1].quantizedStartStep === step) {
      p1 = n1[i1].pitch;
    }
    if (i2 < n2.length && n2[i2].quantizedEndStep === step) {
      p2 = undefined;
      i2++;
    }
    if (i2 < n2.length && n2[i2].quantizedStartStep === step) {
      p2 = n2[i2].pitch;
    }
    if (p1 == null || p2 == null) {
      continue;
    }
    const f1 = pitchToFreq(p1);
    const f2 = pitchToFreq(p2);
    let isAccordance = false;
    let targetPitch;
    let minDifference = 9;
    const acceptanceDifference = 2;
    for (let i = 1; i <= 4; i++) {
      for (let j = 1; j <= 4; j++) {
        if (isAccordance) {
          break;
        } else if (Math.abs(f1 * i - f2 * j) < acceptanceDifference) {
          isAccordance = true;
        } else {
          for (let k = -3; k < 3; k++) {
            if (
              Math.abs(f1 * i - pitchToFreq(p2 + k) * j) <
                acceptanceDifference &&
              Math.abs(k) < minDifference
            ) {
              targetPitch = p2 + k;
              minDifference = Math.abs(k);
            }
          }
        }
      }
    }
    if (!isAccordance) {
      if (targetPitch == null) {
        n2.splice(i2, 1);
        p2 = undefined;
      } else {
        n2[i2].pitch = targetPitch;
      }
    }
  }
}

function addTime(s: mm.NoteSequence) {
  s.notes = s.notes.map((n) => {
    return {
      ...n,
      startTime: (4 / notesStepsCount) * n.quantizedStartStep,
      endTime: (4 / notesStepsCount) * n.quantizedEndStep,
    };
  });
}

function shiftPitch(s: mm.NoteSequence, offset: number) {
  s.notes.forEach((n) => {
    n.pitch += offset;
    if (n.pitch < 0) {
      n.pitch = 0;
    }
  });
}

function pitchToFreq(pitch) {
  return 440 * Math.pow(2, (pitch - 69) / 12);
}
