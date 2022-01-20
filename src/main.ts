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
let correctingDissonanceCheckBox: HTMLInputElement;

let isGenerating = false;
let rnnRepeatCount = 2;
let rnnTemperature = 1;
let isCorrectingDissonance = true;

function init() {
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
        player.play(generatedPlayer);
      })
      .catch((e) => {
        console.log(e);
        progressBar.style.width = "100%";
        progressBar.textContent = "Error.";
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
  [0.5, 1, 1.5].forEach((t) => {
    document
      .getElementById(`temperature-radio-${t}`)
      .addEventListener("click", () => {
        rnnTemperature = t - 0.01;
      });
  });
  [1, 2, 3].forEach((c) => {
    document
      .getElementById(`repeat-radio-${c}`)
      .addEventListener("click", () => {
        rnnRepeatCount = c;
      });
  });
  correctingDissonanceCheckBox.addEventListener("click", () => {
    isCorrectingDissonance = correctingDissonanceCheckBox.checked;
  });
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
