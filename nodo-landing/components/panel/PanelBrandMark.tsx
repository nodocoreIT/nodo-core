"use client";

import { BrandMark } from "@nodocore/shared-components";
import { useSettingsModule } from "@nodocore/nodo-modules/settings";

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
  const { themeSettings, logoSignedUrl } = useSettingsModule();

  const useCustomLogo =
    themeSettings.logoType === "custom" || Boolean(logoSignedUrl);
  const mode =
    themeSettings.logoType === "text"
      ? "text"
      : useCustomLogo
        ? "custom"
        : "default";

  return (
    <BrandMark
      onDark={onDark}
      fillWidth={fillWidth}
      iconClassName={iconClassName}
      className={className}
      mode={mode}
      orgName={themeSettings.brandText || "nodo dashboard"}
      logoUrl={logoSignedUrl}
      primaryColor={themeSettings.primaryColor}
      secondaryColor={themeSettings.secondaryColor}
      productSuffix={mode === "default" ? " Core" : undefined}
    />
  );
}
