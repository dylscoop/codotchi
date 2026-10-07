/**
 * Pet stage height presets (codotchi.stageHeight) → canvas pixel height.
 * Compact (150 px) is a little short for an upright Large pet (144 px + 12 px floor): its head can touch the top.
 */
export const STAGE_HEIGHT_PX: Record<string, number> = {
  compact: 150,
  normal: 180,
  tall: 210,
  extraTall: 240,
};

/** Canvas height for a stageHeight setting value; unknown values fall back to Normal. */
export function stageHeightPx(key: string | undefined): number {
  return (key !== undefined && STAGE_HEIGHT_PX[key]) || STAGE_HEIGHT_PX.normal;
}
