import type { NightInput } from "./night.js";

export interface InputHooks {
  onToolsToggle: () => void;
  onInspectClick: (nx: number, ny: number) => void;
}

/** Wire DOM events into the NightInput struct. Returns a detach fn. */
export function attachInput(canvas: HTMLCanvasElement, input: NightInput, hooks: InputHooks): () => void {
  let inspectMode = false;

  const onMouseMove = (e: MouseEvent): void => {
    if (document.pointerLockElement !== canvas) return;
    input.mouseDX += e.movementX;
    input.mouseDY += e.movementY;
  };

  const onMouseDown = (e: MouseEvent): void => {
    if (document.pointerLockElement !== canvas) return;
    if (e.button !== 0) return;
    if (inspectMode) {
      hooks.onInspectClick(e.clientX / innerWidth, e.clientY / innerHeight);
      return;
    }
    input.interactPressed = true;
    input.interactHeld = true;
  };

  const onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) input.interactHeld = false;
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "Backquote") {
      e.preventDefault();
      inspectMode = !inspectMode;
      hooks.onToolsToggle();
      return;
    }
    if (document.pointerLockElement !== canvas) return;
    switch (e.code) {
      case "KeyW":
        input.forward = true;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        input.boost = true;
        break;
      case "Space":
        if (!e.repeat) input.spacePressed = true;
        input.up = true;
        e.preventDefault();
        break;
      case "KeyC":
      case "ControlLeft":
        input.down = true;
        break;
    }
  };

  const onKeyUp = (e: KeyboardEvent): void => {
    switch (e.code) {
      case "KeyW":
        input.forward = false;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        input.boost = false;
        break;
      case "Space":
        input.up = false;
        break;
      case "KeyC":
      case "ControlLeft":
        input.down = false;
        break;
    }
  };

  const lock = (): void => {
    if (document.pointerLockElement !== canvas) void canvas.requestPointerLock();
  };

  const contextMenu = (e: Event): void => e.preventDefault();

  addEventListener("mousemove", onMouseMove);
  addEventListener("mousedown", onMouseDown);
  addEventListener("mouseup", onMouseUp);
  addEventListener("keydown", onKeyDown);
  addEventListener("keyup", onKeyUp);
  canvas.addEventListener("click", lock);
  canvas.addEventListener("contextmenu", contextMenu);

  return () => {
    removeEventListener("mousemove", onMouseMove);
    removeEventListener("mousedown", onMouseDown);
    removeEventListener("mouseup", onMouseUp);
    removeEventListener("keydown", onKeyDown);
    removeEventListener("keyup", onKeyUp);
    canvas.removeEventListener("click", lock);
    canvas.removeEventListener("contextmenu", contextMenu);
  };
}
