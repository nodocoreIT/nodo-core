"use client";

import { BrandMark } from "@nodocore/shared-components";
import { useSettingsModule } from "@nodocore/nodo-modules/settings";

const PANEL_LOGO_SRC = "/logos/logo compuesto_50.png";

type PanelBrandMarkProps = {
  onDark?: boolean;
  fillWidth?: boolean;
  iconClassName?: string;
  className?: string;
};

export function PanelBrandMark({
  onDark,
  fillWidth,
  iconClassName,
  className,
}: PanelBrandMarkProps) {
  const { themeSettings } = useSettingsModule();

  const mode = themeSettings.logoType === "text" ? "text" : "custom";

  return (
    <BrandMark
      onDark={onDark}
      fillWidth={fillWidth}
      iconClassName={iconClassName}
      className={className}
      mode={mode}
      orgName={themeSettings.brandText || "nodo dashboard"}
      logoUrl={PANEL_LOGO_SRC}
      primaryColor={themeSettings.primaryColor}
      secondaryColor={themeSettings.secondaryColor}
    />
  );
}
