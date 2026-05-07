import chroma from "chroma-js";

export interface IGeneratedColors {
  primary: string;
  page_bg: string;
  accent: string;
  primary_light: string;
  primary_dark: string;
  heading_text: string;
  body_text: string;
  section_bg: string;
  button_text: string;
}

export function generateThemeColors(
  primary: string,
  page_bg: string,
  accent: string,
): IGeneratedColors {
  const p = chroma(primary);
  const buttonText =
    chroma.contrast(primary, "white") >= 4.5 ? "#FFFFFF" : "#1A1A1A";

  return {
    primary,
    page_bg,
    accent,
    primary_light: p.brighten(1.5).hex(),
    primary_dark: p.darken(1.2).hex(),
    heading_text: p.darken(2).hex(),
    body_text: p.darken(1.5).hex(),
    section_bg: chroma.mix(page_bg, primary, 0.08, "rgb").hex(),
    button_text: buttonText,
  };
}
