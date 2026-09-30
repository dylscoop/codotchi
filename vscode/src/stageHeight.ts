/**
 * Pet stage height presets (codotchi.stageHeight) → canvas pixel height.
 * Compact stays above ~160 px so an upright Large pet (144 px + 12 px floor) still fits.
 */
export const STAGE_HEIGHT_PX: Record<string, number> = {
  compact: 180,
  normal: 240,
  tall: 320,
  extraTall: 400,
};

/** Canvas height for a stageHeight setting value; unknown values fall back to Normal. */
export function stageHeightPx(key: string | undefined): number {
  return (key !== undefined && STAGE_HEIGHT_PX[key]) || STAGE_HEIGHT_PX.normal;
}
