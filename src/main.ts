import * as player from "./player";
import * as generator from "./generator";
import { musics } from "./musics";

let originPlayer: player.Player;
let generatedPlayer: player.Player;
let originPlayButton: HTMLButtonElement;
let generatedPlayButton: HTMLButtonElement;
let progressBar: HTMLDivElement;
let generateButton: HTMLButtonElement;
let copyButton: HTMLButtonElement;
let temperatureRadios: HTMLInputElement[];
let repeatCountRadios: HTMLInputElement[];
let correctingDissonanceCheckBox: HTMLInputElement;
let stateText: HTMLInputElement;
let loadButton: HTMLButtonElement;
let copyToClipboardButton: HTMLButtonElement;

const temperatures = [0.5, 1, 1.5];
const repeatCounts = [1, 2, 3];

let temperatureIndex: number;
let repeatCountIndex: number;
let rnnRepeatCount: number;
let rnnTemperature: number;
let isCorrectingDissonance = true;

let isGenerating = false;

function init() {
  getHTMLElements();
  progressBar.style.width = `${50}%`;
  progressBar.textContent = "Initializing model...";
  setTimeout(() => {
    generator.init().then(() => {
      progressBar.style.width = `${100}%`;
      progressBar.textContent = "Ready.";
      generateButton.disabled = false;
    });
  }, 0);
  player.init();
  setOriginMml(0);
  addMusicsDropDown();
  addEventListeners();
  setTemperature(1);
  setRepeatCount(1);
  setCorrectingDissonance(true);
}

window.addEventListener("load", init);

function generate() {
  if (isGenerating) {
    return;
  }
  player.start();
  generateButton.disabled = true;
  isGenerating = true;
  player.stop(generatedPlayer);
  player.stop(originPlayer);
  progressBar.textContent = "Generating...";
  progressBar.style.width = "10%";
  setTimeout(() => {
    generator
      .generate(
        originPlayer.melodySequence,
        originPlayer.bassSequence,
        progressBar,
        rnnRepeatCount,
        rnnTemperature,
        isCorrectingDissonance
      )
      .then(([melody, bass]) => {
        player.setMelodySequence(generatedPlayer, melody);
        player.setBassSequence(generatedPlayer, bass);
        progressBar.style.width = "100%";
        progressBar.textContent = "Done.";
        createState();
        player.play(generatedPlayer);
      })
      .catch((e) => {
        console.log(e);
        progressBar.style.width = "100%";
        progressBar.textContent = "ERROR";
      })
      .finally(() => {
        isGenerating = false;
        generateButton.disabled = false;
      });
  }, 0);
}

function setOriginMml(index: number) {
  const m = musics[index];
  originPlayer = player.get(
    document.getElementById("melody_origin") as HTMLCanvasElement,
    document.getElementById("bass_origin") as HTMLCanvasElement,
    document.getElementById("melody_origin_mml") as HTMLInputElement,
    document.getElementById("bass_origin_mml") as HTMLInputElement,
    originPlayButton
  );
  player.setMml(originPlayer, m.melody, m.bass);
  generatedPlayer = player.get(
    document.getElementById("melody_generated") as HTMLCanvasElement,
    document.getElementById("bass_generated") as HTMLCanvasElement,
    document.getElementById("melody_generated_mml") as HTMLInputElement,
    document.getElementById("bass_generated_mml") as HTMLInputElement,
    generatedPlayButton
  );
}

function getHTMLElements() {
  progressBar = document.getElementById("progress_bar") as HTMLDivElement;
  generateButton = document.getElementById("generate") as HTMLButtonElement;
  generateButton.disabled = true;
  copyButton = document.getElementById("copy") as HTMLButtonElement;
  originPlayButton = document.getElementById(
    "play_origin"
  ) as HTMLButtonElement;
  generatedPlayButton = document.getElementById(
    "play_generated"
  ) as HTMLButtonElement;
  correctingDissonanceCheckBox = document.getElementById(
    "dissonance_check"
  ) as HTMLInputElement;
  stateText = document.getElementById("state_text") as HTMLInputElement;
  loadButton = document.getElementById("load") as HTMLButtonElement;
  copyToClipboardButton = document.getElementById(
    "copy_to_clipboard"
  ) as HTMLButtonElement;
}

function addEventListeners() {
  originPlayButton.addEventListener("click", () => {
    if (isGenerating) {
      return;
    }
    player.start();
    player.stop(generatedPlayer);
    player.playStopToggle(originPlayer);
  });
  generatedPlayButton.addEventListener("click", () => {
    if (isGenerating) {
      return;
    }
    player.start();
    player.stop(originPlayer);
    player.playStopToggle(generatedPlayer);
  });
  generateButton.addEventListener("click", generate);
  copyButton.addEventListener("click", () => {
    player.stop(originPlayer);
    player.stop(generatedPlayer);
    player.checkMml(originPlayer);
    player.checkMml(generatedPlayer);
    if (generatedPlayer.melodyMml == null || generatedPlayer.bassMml == null) {
      return;
    }
    player.setMml(
      originPlayer,
      generatedPlayer.melodyMml,
      generatedPlayer.bassMml
    );
  });
  temperatureRadios = [];
  temperatures.forEach((t, i) => {
    const tr = document.getElementById(
      `temperature-radio-${t}`
    ) as HTMLInputElement;
    temperatureRadios.push(tr);
    tr.addEventListener("click", () => {
      setTemperature(i);
    });
  });
  repeatCountRadios = [];
  repeatCounts.forEach((c, i) => {
    const rr = document.getElementById(`repeat-radio-${c}`) as HTMLInputElement;
    repeatCountRadios.push(rr);
    rr.addEventListener("click", () => {
      setRepeatCount(i);
    });
  });
  correctingDissonanceCheckBox.addEventListener("click", () => {
    isCorrectingDissonance = correctingDissonanceCheckBox.checked;
  });
  loadButton.addEventListener("click", load);
  copyToClipboardButton.addEventListener("click", copyToClipboard);
}

function setTemperature(index: number) {
  rnnTemperature = temperatures[index] - 0.01;
  temperatureIndex = index;
  temperatureRadios.forEach((r, i) => {
    r.checked = i === index;
  });
}

function setRepeatCount(index: number) {
  rnnRepeatCount = repeatCounts[index];
  repeatCountIndex = index;
  repeatCountRadios.forEach((r, i) => {
    r.checked = i === index;
  });
}

function setCorrectingDissonance(v: boolean) {
  isCorrectingDissonance = v;
  correctingDissonanceCheckBox.checked = v;
}

function addMusicsDropDown() {
  const button = document.getElementById("origin-musics-dropdown-menu-button");
  const menu = document.getElementById("origin-musics-dropdown-menu");
  musics.forEach((m, i) => {
    const li = document.createElement("li");
    li.textContent = m.name;
    li.className = "dropdown-item";
    li.addEventListener("click", () => {
      if (isGenerating) {
        return;
      }
      player.start();
      player.stop(originPlayer);
      player.stop(generatedPlayer);
      setOriginMml(i);
      button.textContent = m.name;
      player.play(originPlayer);
    });
    menu.appendChild(li);
  });
}

function createState() {
  const state = [
    generatedPlayer.melodyMml,
    generatedPlayer.bassMml,
    originPlayer.melodyMml,
    originPlayer.bassMml,
    temperatureIndex,
    repeatCountIndex,
    isCorrectingDissonance,
  ];
  stateText.value = JSON.stringify(state).replace(/\s/g, "");
}

function load() {
  if (isGenerating) {
    return;
  }
  try {
    player.stop(originPlayer);
    player.stop(generatedPlayer);
    [
      generatedPlayer.melodyMmlInput.value,
      generatedPlayer.bassMmlInput.value,
      originPlayer.melodyMmlInput.value,
      originPlayer.bassMmlInput.value,
      temperatureIndex,
      repeatCountIndex,
      isCorrectingDissonance,
    ] = JSON.parse(stateText.value);
    player.recreateSequence(originPlayer);
    player.recreateSequence(generatedPlayer);
    setTemperature(temperatureIndex);
    setRepeatCount(repeatCountIndex);
    setCorrectingDissonance(isCorrectingDissonance);
    player.start();
    player.play(generatedPlayer);
  } catch (e) {
    console.log(e);
    progressBar.style.width = "100%";
    progressBar.textContent = "ERROR";
  }
}

function copyToClipboard() {
  if (isGenerating) {
    return;
  }
  createState();
  navigator.clipboard.writeText(stateText.value);
}
