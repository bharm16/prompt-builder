import type { VideoPromptIR } from '../../types';

export function enrichFromTechnicalSpecs(technical: Record<string, string>, ir: VideoPromptIR): void {
  if (technical['camera']) {
    const val = technical['camera'].toLowerCase();
    if (!ir.camera.shotType) {
      if (val.includes('close-up')) ir.camera.shotType = 'close-up';
      else if (val.includes('wide')) ir.camera.shotType = 'wide shot';
    }
    if (!ir.camera.angle) {
      if (val.includes('high-angle')) ir.camera.angle = 'high angle';
      else if (val.includes('low-angle')) ir.camera.angle = 'low angle';
    }
  }

  if (technical['lighting']) {
    const val = technical['lighting'];
    if (ir.environment.lighting.length === 0) {
      ir.environment.lighting.push(val);
    }
  }

  if (technical['audio']) {
    const val = technical['audio'];
    if (val.toLowerCase().includes('music') || val.toLowerCase().includes('score')) {
      ir.audio.music = val;
    } else if (val.toLowerCase().includes('dialogue')) {
      ir.audio.dialogue = val;
    } else {
      ir.audio.sfx = val;
    }
  }

  if (technical['style']) {
    const val = technical['style'];
    if (!ir.meta.style.includes(val)) {
      ir.meta.style.push(val);
    }
  }
}

export function enrichIR(ir: VideoPromptIR): void {
  if (ir.environment.lighting.length === 0) {
    if (ir.meta.style.includes('cyberpunk')) ir.environment.lighting.push('neon lighting');
    else if (ir.meta.style.includes('cinematic')) ir.environment.lighting.push('dramatic lighting');
  }

  if (ir.camera.movements.length === 0) {
    if (ir.actions.includes('running')) ir.camera.movements.push('tracking shot');
  }
}
